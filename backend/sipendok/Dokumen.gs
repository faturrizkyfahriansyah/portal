/**
 * Dokumen.gs — Validasi & generate "Dokumen Penerimaan".
 *
 * Satu dokumen = BA Penerimaan + Surat Jalan dalam SATU LEMBAR per PM.
 * Satu tanggal = satu file Word (semua PM, 1 PM = 1 lembar) + PDF opsional.
 *
 * Urutan generate (di dalam LockService):
 *   validasi -> alokasi nomor (di memori) -> bangun DOCX -> simpan file ke Drive
 *   -> catat 06_BAST & 07_DOKUMEN dalam satu tahap -> log.
 * Database ditulis TERAKHIR. Bila pencatatan gagal, file yang baru dibuat dibatalkan
 * (dibuang ke trash) dan 06_BAST dipulihkan, sehingga tidak ada nomor tercatat tanpa file
 * maupun file tanpa catatan.
 */
var Dok = {
  DOCX_MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  aktifRow: function (r) { return String(r.STATUS).indexOf('SELESAI') === 0; },

  keluar: function (r) {
    return {
      ID_DOKUMEN: r.ID_DOKUMEN, TANGGAL: r.TANGGAL, JUMLAH_PM: U.num(r.JUMLAH_PM), TOTAL_PAKET: U.num(r.TOTAL_PAKET),
      FILE_WORD: r.FILE_WORD, FILE_PDF: r.FILE_PDF, FOLDER_DRIVE: r.FOLDER_DRIVE, STATUS: r.STATUS,
      WAKTU_GENERATE: r.WAKTU_GENERATE, USER_GENERATE: r.USER_GENERATE
    };
  },

  /** Dokumen aktif (terbaru) untuk tanggal + penanda "perlu revisi" bila data berubah setelah generate. */
  statusTanggal: function (tgl, trxRows) {
    var aktif = null;
    Db.readAll('DOKUMEN').forEach(function (r) {
      if (r.TANGGAL === tgl && Dok.aktifRow(r) && (!aktif || r.WAKTU_GENERATE >= aktif.WAKTU_GENERATE)) aktif = r;
    });
    var perlu = false;
    if (aktif) {
      var rows = trxRows || Db.readAll('PENERIMAAN').filter(function (r) { return r.TANGGAL === tgl; });
      // '>=' disengaja: resolusi waktu hanya detik; lebih aman menandai 'perlu revisi' daripada melewatkan dokumen basi.
      perlu = rows.some(function (r) { return r.WAKTU_INPUT >= aktif.WAKTU_GENERATE; });
    }
    return { aktif: aktif, perluRevisi: perlu };
  },

  // ---------------------------------------------------------------- pemeriksaan lingkungan

  _cekFolder: function (settings) {
    var id = settings.FOLDER_DOKUMEN;
    if (!id) return 'Folder dokumen belum diatur (Pengaturan → FOLDER_DOKUMEN).';
    try { DriveApp.getFolderById(id).getName(); } catch (e) { return 'Folder dokumen tidak dapat dibuka. Periksa Folder ID dan izin akses.'; }
    return null;
  },

  /** Kembalikan {error, blobs, xml, jenis}. Memeriksa isi template (lembar SEKOLAH & POSYANDU, placeholder). */
  _muatTemplate: function (settings) {
    var id = settings.TEMPLATE_DOKUMEN;
    if (!id) return { error: 'Template dokumen belum diatur (Pengaturan → TEMPLATE_DOKUMEN).' };
    var file;
    try { file = DriveApp.getFileById(id); file.getName(); } catch (e) {
      return { error: 'Template dokumen tidak dapat dibuka. Periksa File ID dan izin akses.' };
    }
    try {
      var blobs = Utilities.unzip(file.getBlob().setContentType('application/zip'));
      var docBlob = blobs.filter(function (b) { return b.getName() === 'word/document.xml'; })[0];
      if (!docBlob) return { error: 'Template bukan file Word (.docx) yang valid.' };
      var xml = docBlob.getDataAsString('UTF-8');
      var probs = DocBuilder.checkTemplate(xml);
      if (probs.length) return { error: 'Template tidak lengkap/tidak valid. ' + probs.join(' ') };
      return { blobs: blobs, xml: xml, jenis: DocBuilder.jenisTersedia(xml), placeholders: DocBuilder.findPlaceholders(xml), name: file.getName() };
    } catch (e) {
      return { error: 'Template tidak dapat dibaca: ' + e.message };
    }
  },

  cekTemplate: function () {
    var r = Dok._muatTemplate(Db.settings());
    if (r.error) return { ok: false, pesan: r.error };
    return { ok: true, pesan: 'Template valid: ' + r.name + ' (lembar ' + r.jenis.join(' + ') + ')', placeholders: r.placeholders };
  },

  // ---------------------------------------------------------------- validasi

  /**
   * Periksa kelengkapan data untuk satu tanggal. Tidak menulis apa pun.
   * Setiap masalah: {level:'error'|'warning'|'info', id_pm, nama_pm, field, pesan}.
   * 'error' menghalangi generate. Data PIC hanya data internal (tidak dicetak) -> kosong = peringatan.
   */
  validasi: function (tgl) {
    U.mustDate(tgl);
    var settings = Db.settings(), pms = Db.readAll('PM'), pics = Db.readAll('PIC'), bast = Db.readAll('BAST');
    var trx = Db.readAll('PENERIMAAN').filter(function (r) { return r.TANGGAL === tgl; });
    var trxByPm = {}, trxCount = {};
    trx.forEach(function (r) { trxByPm[r.ID_PM] = r; trxCount[r.ID_PM] = (trxCount[r.ID_PM] || 0) + 1; });
    var bastByPm = {};
    bast.forEach(function (b) { if (b.TANGGAL === tgl && b.STATUS === 'AKTIF') bastByPm[b.ID_PM] = b; });

    var masalah = [], items = [];
    function msg(level, pm, field, pesan) {
      masalah.push({ level: level, id_pm: pm ? pm.ID_PM : '', nama_pm: pm ? pm.NAMA_PM : 'Pengaturan', field: field, pesan: pesan });
    }

    // lingkungan: template, folder, kode SPPG
    var tpl = Dok._muatTemplate(settings), jenisTpl = [];
    if (tpl.error) msg('error', null, 'Template', tpl.error); else jenisTpl = tpl.jenis;
    var fErr = Dok._cekFolder(settings);
    if (fErr) msg('error', null, 'Folder Drive', fErr);
    var kode = U.str(settings.KODE_SPPG);
    if (!kode) msg('error', null, 'KODE_SPPG', 'KODE_SPPG belum diatur — nomor BAST tidak dapat dibuat.');

    var jumlahPm = 0, totalPaket = 0, calon = [];
    pms.forEach(function (pm) {
      var t = trxByPm[pm.ID_PM];
      if (pm.STATUS !== 'Aktif') {
        if (t && U.num(t.TOTAL) > 0) msg('warning', pm, 'Status PM', 'PM tidak aktif tetapi memiliki data penerimaan pada tanggal ini — TIDAK disertakan.');
        return;
      }
      var item = { id_pm: pm.ID_PM, nama_pm: pm.NAMA_PM, jenis: pm.JENIS_PM, total: t ? U.num(t.TOTAL) : null,
        pic: null, sertakan: false, nomor_bast: bastByPm[pm.ID_PM] ? bastByPm[pm.ID_PM].NOMOR_BAST : null };
      items.push(item);

      var kurang = [];
      if (!U.str(pm.NAMA_PM)) kurang.push('Nama PM');
      if (Cfg.JENIS.indexOf(pm.JENIS_PM) < 0) kurang.push('Jenis PM');
      if (kurang.length) { msg('error', pm, kurang.join(', '), 'Data PM belum lengkap/benar.'); return; }

      var pic = Pic.untukPm(pm.ID_PM, pics, t);
      if (pic) item.pic = { id: pic.ID_PIC, nama: pic.NAMA_PIC };

      if (!t) { msg('error', pm, 'Jumlah penerimaan', 'Jumlah penerimaan belum diisi.'); return; }
      if (trxCount[pm.ID_PM] > 1) { msg('error', pm, 'Data transaksi', 'Ada ' + trxCount[pm.ID_PM] + ' baris transaksi untuk PM ini pada tanggal yang sama (data ganda). Rapikan di sheet 03_PENERIMAAN.'); return; }
      var allowed = Cfg.KATEGORI[pm.JENIS_PM], sum = 0, rusak = false;
      Cfg.KATEGORI_SEMUA.forEach(function (k) {
        var n = U.num(t[k]);
        if (n < 0 || Math.floor(n) !== n) { msg('error', pm, k, 'Nilai ' + k + ' tidak valid.'); rusak = true; }
        if (allowed.indexOf(k) < 0 && n !== 0) { msg('error', pm, k, 'Kategori ' + k + ' tidak berlaku untuk ' + pm.JENIS_PM + '.'); rusak = true; }
        sum += n;
      });
      if (rusak) return;
      if (sum !== U.num(t.TOTAL)) { msg('error', pm, 'Total', 'Total tidak sesuai (tercatat ' + t.TOTAL + ', seharusnya ' + sum + '). Simpan ulang penerimaan.'); return; }
      item.total = sum;
      if (sum === 0) { msg('info', pm, 'Jumlah penerimaan', 'Tidak ada penerimaan — tidak dibuatkan dokumen.'); return; }
      if (!tpl.error && jenisTpl.indexOf(pm.JENIS_PM) < 0) { msg('error', pm, 'Template ' + pm.JENIS_PM, 'Template untuk jenis ' + pm.JENIS_PM + ' tidak tersedia.'); return; }

      if (!pic) msg('warning', pm, 'PIC', 'PIC belum diisi (data internal/riwayat; tidak dicetak ke dokumen).');
      item.sertakan = true; jumlahPm++; totalPaket += sum; calon.push(pm.ID_PM);
    });

    if (!jumlahPm && !masalah.some(function (m) { return m.level === 'error'; })) {
      msg('error', null, 'Jumlah penerimaan', 'Tidak ada PM yang menerima paket pada tanggal ini.');
    }
    // nomor BAST dapat dibuat? (simulasi; tidak menulis)
    if (calon.length && kode) {
      try {
        var a = Bast.alokasi(tgl, calon, bast, kode);
        Object.keys(a).forEach(function (id) { if (Bast.parseSeq(a[id].nomor) > 999) throw new Error('Urutan nomor BAST bulan ini melebihi 999.'); });
        items.forEach(function (it) { if (a[it.id_pm]) it.nomor_bast = a[it.id_pm].nomor; });
      } catch (e) { msg('error', null, 'Nomor BAST', 'Nomor BAST tidak dapat dibuat: ' + e.message); }
    }

    var dok = Dok.statusTanggal(tgl, trx);
    var nErr = masalah.filter(function (m) { return m.level === 'error'; });
    var pmBermasalah = {}; nErr.forEach(function (m) { if (m.id_pm) pmBermasalah[m.id_pm] = true; });
    return {
      tanggal: tgl, hari: U.hariIndo(tgl), tanggalIndo: U.tanggalIndo(tgl),
      ok: nErr.length === 0, jumlahPm: jumlahPm, totalPaket: totalPaket,
      jumlahPmBermasalah: Object.keys(pmBermasalah).length,
      masalah: masalah, items: items,
      dokumen: dok.aktif ? Dok.keluar(dok.aktif) : null, perluRevisi: dok.perluRevisi
    };
  },

  // ---------------------------------------------------------------- Drive

  _subfolder: function (parent, name) {
    var it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  },

  /** SIPENDOK / 2026 / 10_OKTOBER / WORD|PDF */
  _folderTujuan: function (rootId, tgl) {
    var p = U.mustDate(tgl), root = DriveApp.getFolderById(rootId);
    var tahun = Dok._subfolder(root, String(p.y));
    var bulan = Dok._subfolder(tahun, U.pad(p.m, 2) + '_' + Cfg.BULAN[p.m - 1]);
    return { bulan: bulan, word: Dok._subfolder(bulan, 'WORD'), pdf: Dok._subfolder(bulan, 'PDF') };
  },

  _ada: function (folder, name) { return folder.getFilesByName(name).hasNext(); },

  /** DOCX -> PDF lewat konversi Google (Drive API v3 bila aktif, jika tidak getAs). */
  _buatPdf: function (wordFile, pdfFolder, pdfName) {
    var blob, tmpId = null;
    if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.create) {
      var tmp = Drive.Files.create({ name: pdfName + '.tmp', mimeType: 'application/vnd.google-apps.document' }, wordFile.getBlob());
      tmpId = tmp.id;
      try { blob = DriveApp.getFileById(tmpId).getAs('application/pdf'); }
      finally { try { DriveApp.getFileById(tmpId).setTrashed(true); } catch (e) { /* abaikan */ } }
    } else {
      blob = wordFile.getAs('application/pdf');
    }
    var f = pdfFolder.createFile(blob);
    f.setName(pdfName);
    return f;
  },

  // ---------------------------------------------------------------- generate

  /**
   * @param {{tanggal:string, generateUlang?:boolean, buatPdf?:boolean}} d
   * @return {{status:'OK'|'INVALID'|'SUDAH_ADA', ...}}
   */
  generate: function (d, user) {
    var tgl = d.tanggal; U.mustDate(tgl);
    var v = Dok.validasi(tgl);
    if (!v.ok) return { status: 'INVALID', validasi: v };

    var aktif = Dok.statusTanggal(tgl).aktif;
    if (aktif && !d.generateUlang) {
      return { status: 'SUDAH_ADA', dokumen: Dok.keluar(aktif), perluRevisi: v.perluRevisi, validasi: v };
    }

    var settings = Db.settings(), kode = U.str(settings.KODE_SPPG);
    var buatPdf = (d.buatPdf === undefined || d.buatPdf === null) ? (settings.BUAT_PDF || 'YA').toUpperCase() === 'YA' : !!d.buatPdf;

    var tpl = Dok._muatTemplate(settings);
    if (tpl.error) throw new AppError(tpl.error, 'TEMPLATE');

    var pmMap = {};
    Db.readAll('PM').forEach(function (p) { pmMap[p.ID_PM] = p; });
    var trxByPm = {};
    Db.readAll('PENERIMAAN').forEach(function (r) { if (r.TANGGAL === tgl) trxByPm[r.ID_PM] = r; });

    var sertakan = v.items.filter(function (i) { return i.sertakan; });         // urutan = urutan master PM
    var bastRows = Db.readAll('BAST');
    var bastBackup = JSON.parse(JSON.stringify(bastRows));
    var alok = Bast.alokasi(tgl, sertakan.map(function (i) { return i.id_pm; }), bastRows, kode);

    // ---- isi template: 1 PM = 1 lembar
    var p = U.mustDate(tgl);
    var rows = sertakan.map(function (i) {
      var pm = pmMap[i.id_pm], t = trxByPm[i.id_pm], allowed = Cfg.KATEGORI[pm.JENIS_PM];
      // CATATAN: data PIC (nama/HP/rekening) SENGAJA tidak dikirim ke dokumen — "Diterima oleh" harus manual.
      var o = {
        NOMOR_BAST: alok[i.id_pm].nomor, TANGGAL: U.tanggalIndo(tgl), HARI: U.hariIndo(tgl),
        BULAN: Cfg.BULAN[p.m - 1], TAHUN: String(p.y),
        NAMA_PM: pm.NAMA_PM, JENIS_PM: pm.JENIS_PM, ALAMAT_PM: pm.ALAMAT,
        TOTAL: U.fmtNum(i.total),
        NAMA_SPPG: settings.NAMA_SPPG, KODE_SPPG: kode,
        // Diperbaiki 27 Okt 2026 (laporan Master Prompt §7: "No. Kendaraan
        // tidak muncul atau kosong"). Audit: 03_PENERIMAAN SUDAH punya
        // kolom NO_KENDARAAN (diisi relawan/PIC di Penerimaan Harian,
        // lihat Penerimaan.gs/Config.gs) -- field `t` di sini SUDAH ADA
        // transaksi hari itu, cuma field-nya sebelumnya SENGAJA
        // dikosongkan, bukan krn datanya tidak ada. Fallback ke
        // ACUAN_NO_KENDARAAN PM (Data Acuan) kalau transaksi hari itu
        // kebetulan tidak mengisi kendaraan.
        NO_KENDARAAN: t.NO_KENDARAAN || pm.ACUAN_NO_KENDARAAN || ''
      };
      Cfg.KATEGORI_SEMUA.forEach(function (k) { o[k] = allowed.indexOf(k) >= 0 ? U.fmtNum(U.num(t[k])) : '-'; });
      return o;
    });
    var outXml = DocBuilder.buildBundleXml(tpl.xml, rows);
    // BARU 27 Okt 2026 -- validasi XML SEBELUM disimpan ke Drive (laporan
    // Admin: file .docx hasil generate rusak -- Word gagal buka, Drive
    // gagal preview). Audit menemukan generator (parse/fillSheet/
    // buildBundleXml) strukturnya BENAR; pola kerusakan (paragraf "Nomor
    // : {{NOMOR_BAST}}" tidak tertutup) konsisten dgn TEMPLATE ASLI yg
    // cacat struktur (kemungkinan dari proses edit manual di Word),
    // bukan bug kode. Supaya template rusak GAGAL JELAS (bukan diam2
    // menghasilkan file corrupt spt sebelumnya), validasi di sini pakai
    // XmlService.parse (SUDAH tersedia di Apps Script, parser XML
    // sungguhan -- bukan regex) -- kalau gagal, generate DIHENTIKAN
    // dgn pesan yg jelas, TIDAK ADA file/nomor tersimpan.
    try { XmlService.parse(outXml); }
    catch (eXml) {
      throw new AppError('Template dokumen menghasilkan XML tidak valid (' + eXml.message + '). Kemungkinan template Word memiliki struktur paragraf yang rusak (sering dari proses edit manual) -- periksa ulang file template di Pengaturan, khususnya area sekitar placeholder {{NOMOR_BAST}}. Tidak ada dokumen yang disimpan.', 'TEMPLATE_XML_RUSAK');
    }
    var newBlobs = tpl.blobs.map(function (b) {
      return b.getName() === 'word/document.xml' ? Utilities.newBlob(outXml, 'application/xml', 'word/document.xml') : b;
    });

    // ---- simpan file ke Drive
    var fol = Dok._folderTujuan(settings.FOLDER_DOKUMEN, tgl);
    var docsTgl = Db.readAll('DOKUMEN').filter(function (r) { return r.TANGGAL === tgl; });
    var revisi = docsTgl.length + 1;
    function namaDasar(rev) { return 'SIPENDOK_' + tgl + '_DOKUMEN-PENERIMAAN' + (rev > 1 ? '_REV' + rev : ''); }
    while (Dok._ada(fol.word, namaDasar(revisi) + '.docx')) revisi++;
    var dasar = namaDasar(revisi);

    var created = [], wordFile, pdfFile = null, pdfError = '';
    try {
      var zip = Utilities.zip(newBlobs, dasar + '.docx');
      zip.setContentType(Dok.DOCX_MIME);
      wordFile = fol.word.createFile(zip);
      wordFile.setName(dasar + '.docx');
      created.push(wordFile);
      if (buatPdf) {
        try { pdfFile = Dok._buatPdf(wordFile, fol.pdf, dasar + '.pdf'); created.push(pdfFile); }
        catch (e) { pdfError = 'PDF gagal dibuat: ' + e.message; }
      }
    } catch (e) {
      created.forEach(function (f) { try { f.setTrashed(true); } catch (x) { /* abaikan */ } });
      throw new AppError('Gagal membuat file dokumen: ' + e.message, 'GENERATE_GAGAL');
    }

    // ---- catat ke database (terakhir)
    var idDok = 'DOC-' + tgl.replace(/-/g, '') + (revisi > 1 ? '-R' + revisi : '');
    var waktu = U.now();
    var totalPaket = rows.reduce(function (a, r, ix) { return a + sertakan[ix].total; }, 0);
    var dokBaru = {
      ID_DOKUMEN: idDok, TANGGAL: tgl, JUMLAH_PM: sertakan.length, TOTAL_PAKET: totalPaket,
      FILE_WORD: wordFile.getUrl(), FILE_PDF: pdfFile ? pdfFile.getUrl() : '', FOLDER_DRIVE: fol.bulan.getUrl(),
      STATUS: pdfFile || !buatPdf ? 'SELESAI' : 'SELESAI (TANPA PDF)', WAKTU_GENERATE: waktu, USER_GENERATE: user.nama
    };
    var dokLama = null;
    try {
      // 06_BAST — pertahankan nomor lama; PM baru mendapat nomor baru; PM yang tidak lagi disertakan -> BATAL
      var disertakan = {};
      sertakan.forEach(function (i, ix) {
        disertakan[i.id_pm] = true;
        var a = alok[i.id_pm], pm = pmMap[i.id_pm];
        var obj = {
          ID_BAST: a.idBast, TANGGAL: tgl, NOMOR_BAST: a.nomor, ID_PM: pm.ID_PM, NAMA_PM: pm.NAMA_PM,
          TOTAL_PAKET: i.total, ID_TRANSAKSI: trxByPm[i.id_pm].ID_TRANSAKSI, FILE_DOKUMEN: dokBaru.FILE_WORD, STATUS: 'AKTIF'
        };
        if (a.existing) { for (var k in obj) a.existing[k] = obj[k]; } else bastRows.push(obj);
      });
      bastRows.forEach(function (b) {
        if (b.TANGGAL === tgl && b.STATUS === 'AKTIF' && !disertakan[b.ID_PM]) b.STATUS = 'BATAL';
      });
      Db.writeAll('BAST', bastRows);

      // 07_DOKUMEN_PENERIMAAN — dokumen lama pada tanggal ini ditandai DIGANTI
      dokLama = JSON.parse(JSON.stringify(Db.readAll('DOKUMEN')));
      var docsAll = Db.readAll('DOKUMEN');
      docsAll.forEach(function (r) { if (r.TANGGAL === tgl && Dok.aktifRow(r)) r.STATUS = 'DIGANTI'; });
      docsAll.push(dokBaru);
      Db.writeAll('DOKUMEN', docsAll);
    } catch (e) {
      try { Db.writeAll('BAST', bastBackup); } catch (x) { /* dilaporkan di bawah */ }
      try { if (dokLama) Db.writeAll('DOKUMEN', dokLama); } catch (x) { /* dilaporkan di bawah */ }
      created.forEach(function (f) { try { f.setTrashed(true); } catch (x) { /* abaikan */ } });
      Db.log(user.nama, 'Generate Dokumen GAGAL', 'DOKUMEN_PENERIMAAN', idDok, e.message);
      throw new AppError('Gagal mencatat dokumen ke database; file yang baru dibuat dibatalkan. Tidak ada nomor BAST yang terpakai. Detail: ' + e.message, 'GENERATE_GAGAL');
    }

    try { Pagu.bangunUlang(); } catch (e) { /* data turunan */ }
    Db.log(user.nama, revisi > 1 ? 'Generate Ulang Dokumen (revisi ' + revisi + ')' : 'Generate Dokumen', 'DOKUMEN_PENERIMAAN', idDok,
      sertakan.length + ' PM, ' + totalPaket + ' paket' + (pdfError ? ' — ' + pdfError : ''));

    return {
      status: 'OK', revisi: revisi, dokumen: Dok.keluar(dokBaru), pdfError: pdfError,
      bast: sertakan.map(function (i) { return { id_pm: i.id_pm, nama_pm: i.nama_pm, total: i.total, nomor: alok[i.id_pm].nomor, baru: alok[i.id_pm].baru }; }),
      validasi: v
    };
  },

  /** Arsip: daftar dokumen (bundle harian), opsional filter tahun/bulan; revisi lama ikut dengan status DIGANTI. */
  daftar: function (f) {
    f = f || {};
    var rows = Db.readAll('DOKUMEN').filter(function (r) {
      if (f.tahun && r.TANGGAL.substring(0, 4) !== String(f.tahun)) return false;
      if (f.bulan && r.TANGGAL.substring(5, 7) !== U.pad(f.bulan, 2)) return false;
      return true;
    });
    rows.sort(function (a, b) {
      if (a.TANGGAL !== b.TANGGAL) return a.TANGGAL < b.TANGGAL ? 1 : -1;
      return a.WAKTU_GENERATE < b.WAKTU_GENERATE ? 1 : -1;
    });
    var trxAll = Db.readAll('PENERIMAAN'), lastInput = {};
    trxAll.forEach(function (r) { if (!lastInput[r.TANGGAL] || r.WAKTU_INPUT > lastInput[r.TANGGAL]) lastInput[r.TANGGAL] = r.WAKTU_INPUT; });
    return rows.map(function (r) {
      var o = Dok.keluar(r);
      o.hari = U.hariIndo(r.TANGGAL); o.tanggalIndo = U.tanggalIndo(r.TANGGAL);
      o.aktif = Dok.aktifRow(r);
      o.perluRevisi = o.aktif && lastInput[r.TANGGAL] >= r.WAKTU_GENERATE;
      return o;
    });
  }
};


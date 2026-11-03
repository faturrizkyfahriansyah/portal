/**
 * BastSj.gs — BARU 23 Okt 2026, DIROMBAK 25 Okt 2026 (dokumen Master
 * Instruction SIPENDOK §J.2, DISETUJUI & DIKONFIRMASI Admin). Generate
 * BAST + Surat Jalan gabungan 1 PDF per PM.
 *
 * TEMPLATE SEKARANG 2 LEMBAR (SEKOLAH & POSYANDU, dipisah page-break)
 * -- PERSIS pola yang SUDAH TERBUKTI di DocBuilder.gs (Dokumen
 * Penerimaan lama). Modul ini MEMAKAI ULANG DocBuilder.parse/
 * buildBundleXml secara LANGSUNG (bukan menulis ulang logika pemisahan
 * lembar dari nol) -- SATU-SATUNYA bedanya dari DocBuilder.gs: modul
 * itu menggabungkan BANYAK PM jadi SATU file (1 tanggal), modul INI
 * generate SATU PM = SATU file (lihat buildBundleXml dipanggil dgn
 * array isi SATU baris).
 *
 * SEKOLAH: {{PORSI_KECIL}}, {{PORSI_BESAR}}, {{TOTAL}} -- dari
 *   03_PENERIMAAN (transaksi tersimpan hari itu).
 * POSYANDU: {{BALITA}}, {{BUMIL}}, {{BUSUI}}, {{TOTAL}} -- JUGA dari
 *   03_PENERIMAAN (kolom2 ini SUDAH ADA di skema lama, dipakai
 *   Dokumen Penerimaan -- TIDAK perlu kolom/skema baru).
 *
 * Placeholder umum (kedua lembar): NOMOR_BAST, HARI, TANGGAL, NAMA_PM,
 * TOTAL_PAKET, MENU_KARBOHIDRAT..MENU_PELENGKAP, NOMOR_SURAT_JALAN,
 * NO_KENDARAAN.
 */
var BastSj = (function () {
  var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var REQUIRED_UMUM = ['NOMOR_BAST', 'HARI', 'TANGGAL', 'NAMA_PM', 'TOTAL_PAKET', 'NOMOR_SURAT_JALAN', 'TOTAL', 'NO_KENDARAAN',
    'MENU_KARBOHIDRAT', 'MENU_PROTEIN_HEWANI', 'MENU_PROTEIN_NABATI', 'MENU_SAYUR', 'MENU_BUAH', 'MENU_PELENGKAP'];
  var REQUIRED_KATEGORI = { SEKOLAH: ['PORSI_KECIL', 'PORSI_BESAR'], POSYANDU: ['BALITA', 'BUMIL', 'BUSUI'] };
  var JENIS_MARKER = { SEKOLAH: 'PORSI_KECIL', POSYANDU: 'BALITA' };

  /**
   * Pemisah lembar KHUSUS modul ini (BEDA dari DocBuilder.parse) --
   * template BAST+SJ (diunggah Admin 25 Okt 2026) TIDAK memakai
   * page-break eksplisit antar lembar SEKOLAH/POSYANDU (diverifikasi
   * langsung dari file: nihil <w:br w:type="page"/> maupun
   * pageBreakBefore) -- lembar ke-2 cuma "meluber" otomatis ke halaman
   * baru. Jadi dipisah dari titik tabel header (<w:tbl>) TERDEKAT
   * SEBELUM kemunculan KEDUA teks "BADAN GIZI NASIONAL REPUBLIK
   * INDONESIA" (muncul tepat 1x di awal tiap lembar, DIVERIFIKASI
   * terhadap file asli, BUKAN tebakan -- lihat transkrip pengujian
   * Node 25 Okt 2026). Kalau Admin ganti template & pola ini tidak
   * berlaku lagi, error di bawah akan muncul jelas (bukan silently
   * salah lembar).
   */
  function pisahLembar_(xmlMentah) {
    var xml = DocBuilder.normalizePlaceholders(xmlMentah);
    var b = xml.indexOf('<w:body>');
    if (b < 0) throw new Error('Template tidak valid: <w:body> tidak ditemukan.');
    var bodyStart = b + '<w:body>'.length;
    var sectIdx = xml.lastIndexOf('<w:sectPr');
    if (sectIdx < bodyStart) throw new Error('Template tidak valid: sectPr tidak ditemukan.');
    var body = xml.substring(bodyStart, sectIdx);
    var marker = 'BADAN GIZI NASIONAL REPUBLIK INDONESIA';
    var pertama = body.indexOf(marker);
    var kedua = pertama === -1 ? -1 : body.indexOf(marker, pertama + marker.length);
    var sheets = {};
    if (kedua === -1) {
      // Hanya 1 kop ditemukan -- mungkin template SUDAH pakai page-break
      // normal (format lama/beda), coba cara DocBuilder standar dulu.
      var tStd = DocBuilder.parse(xmlMentah);
      sheets = tStd.sheets;
    } else {
      var titikPisah = body.lastIndexOf('<w:tbl>', kedua);
      if (titikPisah === -1) throw new Error('Template tidak dikenali: tabel kop lembar ke-2 tidak ditemukan.');
      var bagian = [body.substring(0, titikPisah), body.substring(titikPisah)];
      bagian.forEach(function (p) {
        Object.keys(JENIS_MARKER).forEach(function (j) { if (p.indexOf('{{' + JENIS_MARKER[j] + '}}') >= 0) sheets[j] = p; });
      });
    }
    return { head: xml.substring(0, bodyStart), tail: xml.substring(sectIdx), sheets: sheets };
  }

  /** Isi 1 lembar sesuai JENIS_PM lalu rapikan ID unik (fillSheet/makeUnique dipakai ULANG dari DocBuilder.gs, lihat catatan di sana). */
  function buatXmlUntukPm_(xmlMentah, vals) {
    var t = pisahLembar_(xmlMentah);
    var tpl = t.sheets[vals.JENIS_PM];
    if (!tpl) throw new Error('Lembar template untuk jenis PM "' + vals.JENIS_PM + '" tidak ditemukan.');
    var counter = { n: 100 };
    return t.head + DocBuilder.makeUnique(DocBuilder.fillSheet(tpl, vals), counter) + t.tail;
  }

  // Pemisah antar-PM saat digabung jadi 1 file -- paragraf page-break
  // KOSONG (sama persis pola SEP_RE yg dipakai DocBuilder.gs utk
  // memisah SEKOLAH/POSYANDU di template asli), supaya tiap PM mulai
  // di halaman baru saat dicetak/dibuka di Word.
  var PEMISAH_HALAMAN_ = '<w:p><w:pPr><w:pageBreakBefore/></w:pPr></w:p>';

  /**
   * BARU 28 Okt 2026 (DIMINTA Admin: "jangan dipisah filenya, satu file
   * gabungkan setiap harinya biar gampang cetaknya" -- Admin cetak fisik
   * tiap hari, 1 file per PM bikin ribet buka-print satu-satu).
   * Isi BANYAK PM (array {vals}) ke SATU dokumen gabungan -- pola SAMA
   * dgn DocBuilder.buildBundleXml (dipakai Dokumen.gs), tapi dipakai di
   * sini scr manual krn pisahLembar_ (lihat atas) BUKAN DocBuilder.parse
   * standar (template BAST+SJ tidak py page-break antar SEKOLAH/POSYANDU
   * di sumbernya, lihat catatan pisahLembar_).
   */
  /**
   * DIROMBAK 29 Okt 2026 (dilaporkan Admin -- "ada PM yg tanda
   * tangannya hilang, ada yg geser ke lembar berikutnya" di dokumen
   * gabungan). Dulu pakai DocBuilder.makeUnique (cuma unikkan wp:docPr
   * id) -- SEKARANG pakai makeUniqueDenganGambar_ (JUGA unikkan
   * r:embed gambar stempel/logo per salinan PM, akar masalah
   * sebenarnya -- lihat catatan lengkap di DocBuilder.gs).
   * @return {Object} { xml, petaRelasiBaru } -- caller (prosesGenerate_)
   *   WAJIB pakai petaRelasiBaru utk suntik <Relationship> baru ke
   *   word/_rels/document.xml.rels SEBELUM di-zip, kalau tidak gambar
   *   akan PECAH (r:embed menunjuk ID yg tidak terdaftar).
   */
  function gabungkanBanyakPm_(xmlMentah, daftarVals) {
    var t = pisahLembar_(xmlMentah);
    var counter = { n: 100 };
    var petaRelasiBaru = {};
    var potongan = daftarVals.map(function (vals) {
      var tpl = t.sheets[vals.JENIS_PM];
      if (!tpl) throw new Error('Lembar template untuk jenis PM "' + vals.JENIS_PM + '" tidak ditemukan.');
      return DocBuilder.makeUniqueDenganGambar_(DocBuilder.fillSheet(tpl, vals), counter, petaRelasiBaru);
    });
    return { xml: t.head + potongan.join(PEMISAH_HALAMAN_) + t.tail, petaRelasiBaru: petaRelasiBaru };
  }

  /**
   * Suntik <Relationship> baru ke XML word/_rels/document.xml.rels,
   * SATU per entri di petaRelasiBaru ({ridBaru: ridAsli}) -- Target
   * & Type-nya DISALIN dari relationship ridAsli yg SUDAH ada (gambar
   * YANG SAMA, cuma ID baru yg unik per salinan PM).
   */
  function suntikRelasiGambar_(relsXml, petaRelasiBaru) {
    var kunci = Object.keys(petaRelasiBaru);
    if (!kunci.length) return relsXml;
    var tambahan = kunci.map(function (ridBaru) {
      var ridAsli = petaRelasiBaru[ridBaru];
      var m = new RegExp('<Relationship Id="' + ridAsli + '"[^>]*/>').exec(relsXml);
      if (!m) throw new Error('Relationship asli "' + ridAsli + '" tidak ditemukan di document.xml.rels -- template mungkin rusak/berubah struktur.');
      return m[0].replace('Id="' + ridAsli + '"', 'Id="' + ridBaru + '"');
    }).join('');
    return relsXml.replace('</Relationships>', tambahan + '</Relationships>');
  }

  function muatTemplate_(settings) {
    var id = settings.TEMPLATE_BAST_SJ;
    if (!id) return { error: 'Template BAST + Surat Jalan belum diatur (Pengaturan → Generate Dokumen).' };
    var file;
    try { file = DriveApp.getFileById(id); file.getName(); }
    catch (e) { return { error: 'Template BAST + Surat Jalan tidak dapat dibuka. Periksa File ID dan izin akses.' }; }
    try {
      var blobs = Utilities.unzip(file.getBlob().setContentType('application/zip'));
      var docBlob = blobs.filter(function (b) { return b.getName() === 'word/document.xml'; })[0];
      if (!docBlob) return { error: 'Template bukan file Word (.docx) yang valid.' };
      var xmlMentah = docBlob.getDataAsString('UTF-8');
      var t;
      try { t = pisahLembar_(xmlMentah); } catch (e) { return { error: e.message }; }
      var masalah = [];
      ['SEKOLAH', 'POSYANDU'].forEach(function (jenis) {
        if (!t.sheets[jenis]) { masalah.push('Lembar ' + jenis + ' tidak ditemukan dalam template.'); return; }
        var have = DocBuilder.findPlaceholders(t.sheets[jenis]);
        var wajib = REQUIRED_UMUM.concat(REQUIRED_KATEGORI[jenis]);
        var hilang = wajib.filter(function (k) { return have.indexOf(k) < 0; });
        if (hilang.length) masalah.push('Lembar ' + jenis + ' kehilangan placeholder: {{' + hilang.join('}}, {{') + '}}.');
      });
      if (masalah.length) return { error: masalah.join(' ') };
      return { blobs: blobs, xmlMentah: xmlMentah, name: file.getName() };
    } catch (e) { return { error: 'Template tidak dapat dibaca: ' + e.message }; }
  }

  function subfolder_(parent, name) {
    var it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  }

  /** SIPENDOK/Arsip/{kodePeriode} - {namaPeriode}/ -- sesuai struktur dokumen §11/§O (per periode, BUKAN per hari). */
  function folderArsip_(rootId, periode) {
    var root = DriveApp.getFolderById(rootId);
    var arsip = subfolder_(root, 'Arsip');
    return subfolder_(arsip, 'P' + periode.kode + ' - ' + (periode.nama || 'Periode Operasional'));
  }

  function buatPdf_(wordFile, pdfFolder, pdfName) {
    var blob, tmpId = null;
    if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.create) {
      var tmp = Drive.Files.create({ name: pdfName + '.tmp', mimeType: 'application/vnd.google-apps.document' }, wordFile.getBlob());
      tmpId = tmp.id;
      try { blob = DriveApp.getFileById(tmpId).getAs('application/pdf'); }
      finally { try { DriveApp.getFileById(tmpId).setTrashed(true); } catch (e) { /* abaikan */ } }
    } else {
      blob = wordFile.getAs('application/pdf');
    }
    var f = pdfFolder.createFile(blob); f.setName(pdfName);
    return f;
  }

  /**
   * Periksa kesiapan generate utk 1 tanggal TANPA menulis apa pun --
   * dipakai halaman "Generate Dokumen" (dokumen §14, "tampilkan daftar
   * PM dengan status sebelum generate").
   */
  function pratinjau(tgl) {
    U.mustDate(tgl);
    var settings = Db.settings();
    var periode = Bast.periodeUntukTanggal(tgl);
    var menu = null, menuError = '';
    try { menu = Menu.untukTanggal(tgl); } catch (e) { menuError = e.message; }
    var tpl = muatTemplate_(settings);
    var pms = Db.readAll('PM'), bast = Db.readAll('BAST');
    var trxByPm = {};
    SipanduPm.terpadu().forEach(function (r) { if (r.TANGGAL === tgl) trxByPm[r.ID_PM] = r; });
    var bastByPm = {};
    bast.forEach(function (b) { if (b.TANGGAL === tgl && b.STATUS === 'AKTIF') bastByPm[b.ID_PM] = b; });

    // DIROMBAK 28 Okt 2026 (ikuti Master Prompt §9.1: "Jika satu file
    // gabungan sudah menjadi pola utama, jangan menampilkan tombol Buka
    // untuk setiap PM"). SEBELUMNYA fileDokumen disimpan PER-ITEM (sejak
    // digabung jadi 1 file/hari, nilainya SAMA PERSIS utk semua PM, jadi
    // mubazir & berlawanan dgn Master Prompt). SEKARANG: satu field
    // tingkat-hari saja, fileDokumenHariIni (lihat bawah).
    var fileDokumenHariIni = '', fileWordHariIni = '';
    var items = pms.map(function (pm) {
      var t = trxByPm[pm.ID_PM];
      var status, alasan = '';
      if (bastByPm[pm.ID_PM]) {
        status = 'SUDAH_DIBUAT';
        if (!fileDokumenHariIni) fileDokumenHariIni = bastByPm[pm.ID_PM].FILE_DOKUMEN || '';
        if (!fileWordHariIni) fileWordHariIni = bastByPm[pm.ID_PM].FILE_WORD || '';
      }
      else if (pm.STATUS !== 'Aktif') { status = 'DILEWATI'; alasan = 'PM nonaktif.'; }
      else if (!t) { status = 'BELUM_ADA_PENERIMAAN'; alasan = 'Belum ada penerimaan valid tersimpan untuk tanggal ini.'; }
      else { status = 'SIAP'; }
      return { id_pm: pm.ID_PM, nama_pm: pm.NAMA_PM, jenis_pm: pm.JENIS_PM, status: status, alasan: alasan, total: t ? U.num(t.TOTAL) : 0 };
    });

    var ringkasan = {
      pmAktif: pms.filter(function (p) { return p.STATUS === 'Aktif'; }).length,
      pmLiburNonaktif: pms.filter(function (p) { return p.STATUS !== 'Aktif'; }).length,
      penerimaanValid: Object.keys(trxByPm).length,
      siapGenerate: items.filter(function (i) { return i.status === 'SIAP'; }).length,
      sudahDibuat: items.filter(function (i) { return i.status === 'SUDAH_DIBUAT'; }).length,
      dilewati: items.filter(function (i) { return i.status === 'DILEWATI'; }).length,
      belumAdaPenerimaan: items.filter(function (i) { return i.status === 'BELUM_ADA_PENERIMAAN'; }).length
    };

    var blokir = [];
    if (!periode) blokir.push('Tanggal ini tidak termasuk periode operasional mana pun. Periksa Periode Kerja di Portal Pengelola.');
    if (!menu && !menuError) blokir.push('Menu untuk tanggal ini tidak ditemukan di Siklus Menu.');
    if (menuError) blokir.push(menuError);
    if (tpl.error) blokir.push(tpl.error);

    return { tanggal: tgl, periode: periode, menu: menu, template: tpl.error ? null : { nama: tpl.name }, items: items, ringkasan: ringkasan, blokir: blokir, fileDokumenHariIni: fileDokumenHariIni, fileWordHariIni: fileWordHariIni };
  }

  /**
   * Generate BAST+SJ utk SEMUA PM berstatus SIAP pada tanggal tgl.
   * WAJIB di dalam LockService (dipanggil pemanggil publik generate()).
   */
  /**
   * DIROMBAK 28 Okt 2026 (Master Prompt Bagian 7 -- Regenerate SEBELUMNYA
   * TIDAK ADA SAMA SEKALI: PM berstatus SUDAH_DIBUAT diabaikan oleh
   * generate biasa, jadi tidak ada cara mengulang walau menu berubah
   * atau ada PM baru ditambahkan setelah generate pertama).
   * Fungsi SATU ini dipakai generate() DAN regenerate() (hindari fungsi
   * duplikat, Master Prompt #9) -- bedanya cuma parameter modeRegenerate:
   *  - generate (modeRegenerate=false): HANYA proses PM berstatus SIAP
   *    (belum pernah dibuat). PM SUDAH_DIBUAT diabaikan, baris lama TIDAK
   *    disentuh.
   *  - regenerate (modeRegenerate=true): proses PM SIAP *dan*
   *    SUDAH_DIBUAT. Bast.alokasi() OTOMATIS reuse nomor lama utk PM yg
   *    sudah py baris BAST (lihat Bast.gs alokasi()) -- TIDAK pernah
   *    generate nomor baru utk PM yg sudah py nomor (Master Prompt §7.2).
   *    Baris lama di-UPDATE di tempat (Db.updateRow, pakai _row dari
   *    readAll), BUKAN ditambah baris baru -- supaya tidak ada duplikat
   *    arsip utk PM yg sama (Master Prompt §7.5).
   */
  function prosesGenerate_(tgl, user, modeRegenerate) {
    var pre = pratinjau(tgl);
    if (pre.blokir.length) throw new AppError(pre.blokir.join(' '), 'TIDAK_SIAP');
    var siap = pre.items.filter(function (i) {
      return modeRegenerate ? (i.status === 'SIAP' || i.status === 'SUDAH_DIBUAT') : i.status === 'SIAP';
    });
    if (!siap.length) return { status: 'TIDAK_ADA', ringkasan: pre.ringkasan };

    var settings = Db.settings(), kode = U.str(settings.KODE_SPPG) || 'SPPG-JC';
    var tpl = muatTemplate_(settings);
    if (tpl.error) throw new AppError(tpl.error, 'TEMPLATE');

    var pmMap = {}; Db.readAll('PM').forEach(function (p) { pmMap[p.ID_PM] = p; });
    var trxByPm = {}; SipanduPm.terpadu().forEach(function (r) { if (r.TANGGAL === tgl) trxByPm[r.ID_PM] = r; });

    var bastRows = Db.readAll('BAST');
    var alok = Bast.alokasi(tgl, siap.map(function (i) { return i.id_pm; }), bastRows, pre.periode.kode, kode);
    var folArsip = folderArsip_(settings.FOLDER_DOKUMEN, pre.periode);
    var buatPdfSetting = (settings.BUAT_PDF || 'YA').toUpperCase() === 'YA';

    var hasil = { berhasil: [], gagal: [], dilewati: pre.items.filter(function (i) { return i.status !== 'SIAP'; }) };
    var baruRows = [];

    // DIROMBAK 28 Okt 2026 (DIMINTA Admin: "jangan dipisah filenya, satu
    // file gabungkan setiap harinya biar gampang cetaknya"). SEBELUMNYA:
    // 1 file per PM (loop create+save per iterasi). SEKARANG: siapkan
    // SEMUA vals dulu (tanpa nomor utk PM yg gagal validasi dasar),
    // gabungkan jadi SATU dokumen (gabungkanBanyakPm_), SATU kali simpan
    // ke Drive -- semua PM yg berhasil memakai URL file yg SAMA.
    var siapDenganVals = [];
    siap.forEach(function (item) {
      var idPm = item.id_pm, pm = pmMap[idPm], t = trxByPm[idPm], a = alok[idPm];
      try {
        // Diperkuat 28 Okt 2026 utk regenerate: data PENERIMAAN bisa saja
        // sudah dihapus/berubah sejak generate pertama (mis. PM dibatalkan).
        if (!t) throw new Error('Data penerimaan untuk tanggal ini sudah tidak tersedia/berubah.');
        if (pm.JENIS_PM !== 'SEKOLAH' && pm.JENIS_PM !== 'POSYANDU') throw new Error('JENIS_PM "' + pm.JENIS_PM + '" tidak dikenal (harus SEKOLAH atau POSYANDU).');
        var vals = {
          JENIS_PM: pm.JENIS_PM,
          NOMOR_BAST: a.nomorBast, NOMOR_SURAT_JALAN: a.nomorSj,
          HARI: U.hariIndo(tgl), TANGGAL: U.tanggalIndo(tgl),
          NAMA_PM: pm.NAMA_PM, TOTAL_PAKET: U.fmtNum(U.num(t.TOTAL)), TOTAL: U.fmtNum(U.num(t.TOTAL)),
          NO_KENDARAAN: t.NO_KENDARAAN || pm.ACUAN_NO_KENDARAAN || '',
          MENU_KARBOHIDRAT: pre.menu.karbohidrat, MENU_PROTEIN_HEWANI: pre.menu.laukHewani, MENU_PROTEIN_NABATI: pre.menu.laukNabati,
          MENU_SAYUR: pre.menu.sayur, MENU_BUAH: pre.menu.buah, MENU_PELENGKAP: pre.menu.pelengkap
        };
        if (pm.JENIS_PM === 'SEKOLAH') { vals.PORSI_KECIL = U.fmtNum(U.num(t.PORSI_KECIL)); vals.PORSI_BESAR = U.fmtNum(U.num(t.PORSI_BESAR)); }
        else { vals.BALITA = U.fmtNum(U.num(t.BALITA)); vals.BUMIL = U.fmtNum(U.num(t.BUMIL)); vals.BUSUI = U.fmtNum(U.num(t.BUSUI)); } // POSYANDU -- kolom SUDAH ADA di 03_PENERIMAAN sejak skema lama
        siapDenganVals.push({ idPm: idPm, pm: pm, t: t, a: a, vals: vals });
      } catch (e) {
        hasil.gagal.push({ id_pm: idPm, nama_pm: pm.NAMA_PM, pesan: e.message });
      }
    });

    if (siapDenganVals.length) {
      var hasilGabung = gabungkanBanyakPm_(tpl.xmlMentah, siapDenganVals.map(function (x) { return x.vals; }));
      var outXml = hasilGabung.xml;
      // BARU 29 Okt 2026 (perbaikan tanda tangan hilang/geser): kalau ada
      // relasi gambar baru (petaRelasiBaru TIDAK kosong -- artinya >1 PM
      // digabung, gambar stempel/logo perlu ID unik per salinan), suntik
      // ke word/_rels/document.xml.rels SEBELUM di-zip. Kalau cuma 1 PM
      // (petaRelasiBaru kosong), .rels asli dipakai apa adanya -- tidak
      // ada yg perlu diubah.
      var newBlobs = tpl.blobs.map(function (b) {
        if (b.getName() === 'word/document.xml') return Utilities.newBlob(outXml, 'application/xml', 'word/document.xml');
        if (b.getName() === 'word/_rels/document.xml.rels' && Object.keys(hasilGabung.petaRelasiBaru).length) {
          var relsBaru = suntikRelasiGambar_(b.getDataAsString('UTF-8'), hasilGabung.petaRelasiBaru);
          return Utilities.newBlob(relsBaru, 'application/xml', 'word/_rels/document.xml.rels');
        }
        return b;
      });
      var dasar = 'BAST-SJ_' + tgl; // SATU nama file per TANGGAL (bukan per PM lagi)
      var zip = Utilities.zip(newBlobs, dasar + '.docx'); zip.setContentType(DOCX_MIME);
      var wordFile = folArsip.createFile(zip); wordFile.setName(dasar + '.docx');
      var pdfFile = null;
      // DIPERBAIKI 29 Okt 2026 (bug ditemukan Admin -- "ga ada download
      // word"). SEBELUMNYA wordFile SELALU dihapus (setTrashed) setelah
      // PDF dibuat -- melanggar Master Prompt §4.3 ("Tombol Word harus
      // menyediakan file .docx asli yang dapat diunduh"). SEKARANG:
      // Word TIDAK PERNAH dihapus, KEDUA file disimpan & dicatat.
      if (buatPdfSetting) { pdfFile = buatPdf_(wordFile, folArsip, dasar + '.pdf'); }
      var urlPdf = pdfFile ? pdfFile.getUrl() : '';
      var urlWord = wordFile.getUrl();
      var urlFileGabungan = urlPdf || urlWord; // field lama FILE_DOKUMEN dipertahankan (PDF kalau ada) spy kode lain yg baca field ini tetap jalan

      siapDenganVals.forEach(function (x) {
        var rowBaru = {
          ID_BAST: x.a.idBast, TANGGAL: tgl, NOMOR_BAST: x.a.nomorBast, ID_PM: x.idPm, NAMA_PM: x.pm.NAMA_PM,
          TOTAL_PAKET: U.num(x.t.TOTAL), ID_TRANSAKSI: x.t.ID_TRANSAKSI || '', FILE_DOKUMEN: urlFileGabungan, // SAMA utk semua PM hari ini
          STATUS: 'AKTIF', NOMOR_SJ: x.a.nomorSj, KODE_PERIODE: pre.periode.kode, FILE_WORD: urlWord
        };
        // Regenerate utk PM yg SUDAH py baris (x.a.existing ada, dari
        // Bast.alokasi) -- UPDATE di tempat (Master Prompt §7.5: "tidak
        // ada catatan arsip duplikat"), BUKAN baris baru. PM baru (belum
        // py baris) tetap pakai appendMany spt generate biasa.
        if (modeRegenerate && x.a.existing && x.a.existing._row) {
          Db.updateRow('BAST', x.a.existing._row, rowBaru);
        } else {
          baruRows.push(rowBaru);
        }
        hasil.berhasil.push({ id_pm: x.idPm, nama_pm: x.pm.NAMA_PM, jenis_pm: x.pm.JENIS_PM, nomorBast: x.a.nomorBast, nomorSj: x.a.nomorSj });
      });
    }

    // ---- database ditulis TERAKHIR, setelah file gabungan selesai
    // (pola sama dgn Dokumen.gs) -- supaya tidak ada nomor tercatat tanpa file.
    if (baruRows.length) Db.appendMany('BAST', baruRows);
    // Log selalu dicatat kalau ADA yg berhasil (baris baru ATAU update),
    // bukan cuma saat ada baris baru -- sebelumnya regenerate yg SEMUA
    // PM-nya sudah py baris (jadi 0 baris baru, semua update) TIDAK
    // tercatat sama sekali di log.
    if (hasil.berhasil.length) {
      Db.log(user.nama, (modeRegenerate ? 'Regenerate' : 'Generate') + ' BAST+SJ (1 file gabungan)', 'BAST', tgl,
        hasil.berhasil.length + ' PM dalam 1 dokumen (' + baruRows.length + ' baru, ' + (hasil.berhasil.length - baruRows.length) + ' update) P' + pre.periode.kode);
    }
    return { status: 'OK', hasil: hasil, ringkasan: pre.ringkasan };
  }

  return {
    pratinjau: pratinjau,
    generate: function (d, user) {
      var tgl = d.tanggal; U.mustDate(tgl);
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(25000)) throw new AppError('Sistem sedang memproses permintaan generate lain. Coba lagi sebentar.', 'LOCK_SIBUK');
      try { return prosesGenerate_(tgl, user, false); } finally { lock.releaseLock(); }
    },
    /**
     * BARU 28 Okt 2026 (Master Prompt Bagian 7 -- gap ditemukan: TIDAK
     * ADA cara mengulang dokumen yg sudah dibuat, mis. setelah menu
     * diperbaiki atau PM baru ditambahkan). Pakai LockService SAMA dgn
     * generate (satu kunci, nama sama -- generate & regenerate utk
     * tanggal yg sama TIDAK BOLEH berjalan bersamaan, Master Prompt §7.2
     * "audit penggunaan mekanisme penguncian... agar dua proses
     * bersamaan tidak menghasilkan nomor ganda").
     */
    regenerate: function (d, user) {
      var tgl = d.tanggal; U.mustDate(tgl);
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(25000)) throw new AppError('Sistem sedang memproses permintaan generate/regenerate lain. Coba lagi sebentar.', 'LOCK_SIBUK');
      try { return prosesGenerate_(tgl, user, true); } finally { lock.releaseLock(); }
    },
    // BARU 25 Okt 2026 (dipakai halaman Pengaturan -- tombol "Cek
    // template BAST + Surat Jalan"). Bentuk hasil SAMA dgn
    // Dok.cekTemplate() di Dokumen.gs supaya frontend bisa pakai pola
    // tampilan yg SAMA (lihat pengaturan.js) -- TIDAK menulis apa pun.
    cekTemplate: function () {
      var r = muatTemplate_(Db.settings());
      if (r.error) return { ok: false, pesan: r.error };
      return { ok: true, pesan: 'Template valid (2 lembar: SEKOLAH + POSYANDU): ' + r.name, placeholders: REQUIRED_UMUM.concat(['PORSI_KECIL/PORSI_BESAR (Sekolah)', 'BALITA/BUMIL/BUSUI (Posyandu)']) };
    },
    /**
     * BARU 27 Okt 2026 (GAP ditemukan Admin: tidak ada cara melihat
     * daftar dokumen BAST+SJ yg sudah di-generate -- Arsip sebelumnya
     * HANYA menampilkan dokumen Dokumen Penerimaan lama). Daftar SEMUA
     * baris 06_BAST, opsional disaring per Periode (kode periode),
     * dikelompokkan per TANGGAL utk ditampilkan Arsip.
     * @param {string} [kodePeriodeFilter] mis. "01" -- kosongkan utk semua.
     */
    daftarArsip: function (kodePeriodeFilter) {
      var rows = Db.readAll('BAST');
      if (kodePeriodeFilter) rows = rows.filter(function (r) { return String(r.KODE_PERIODE) === String(kodePeriodeFilter); });
      var perTanggal = {};
      rows.forEach(function (r) {
        var t = r.TANGGAL;
        if (!perTanggal[t]) perTanggal[t] = { tanggal: t, kodePeriode: r.KODE_PERIODE, jumlahPm: 0, totalPaket: 0, dokumen: [] };
        if (String(r.STATUS).toUpperCase() === 'AKTIF') {
          perTanggal[t].jumlahPm++;
          perTanggal[t].totalPaket += U.num(r.TOTAL_PAKET);
        }
        perTanggal[t].dokumen.push({
          idBast: r.ID_BAST, namaPm: r.NAMA_PM, nomorBast: r.NOMOR_BAST, nomorSj: r.NOMOR_SJ,
          totalPaket: U.num(r.TOTAL_PAKET), fileDokumen: r.FILE_DOKUMEN, fileWord: r.FILE_WORD, status: r.STATUS
        });
      });
      return Object.keys(perTanggal).sort().reverse().map(function (t) { return perTanggal[t]; });
    }
  };
})();


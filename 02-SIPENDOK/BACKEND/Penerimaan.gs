/** Penerimaan.gs — Transaksi penerimaan paket harian (03_PENERIMAAN). */

var Terima = {
  idTransaksi: function (tgl, idPm) { return 'TRX-' + tgl.replace(/-/g, '') + '-' + idPm.replace('-', ''); },

  /** No. Kendaraan: opsional, ≤20 karakter, huruf/angka/spasi/strip, disimpan kapital. */
  kendaraan: function (v) {
    var s = U.clean(v, 60).toUpperCase();
    if (s.length > Cfg.MAX_KENDARAAN) throw new AppError('No. Kendaraan maksimal ' + Cfg.MAX_KENDARAAN + ' karakter.', 'VALIDASI');
    if (!/^[A-Z0-9 \-]*$/.test(s)) throw new AppError('No. Kendaraan hanya boleh huruf, angka, spasi, dan tanda strip.', 'VALIDASI');
    return s;
  },

  _nilai: function (r) {
    var o = {};
    Cfg.KATEGORI_SEMUA.forEach(function (k) { o[k] = U.num(r[k]); });
    return o;
  },

  /** Data form "Penerimaan Hari Ini" untuk tanggal tertentu. */
  get: function (tgl) {
    U.mustDate(tgl);
    var pms = Db.readAll('PM'), pics = Db.readAll('PIC');
    var trx = Db.readAll('PENERIMAAN').filter(function (r) { return r.TANGGAL === tgl; });
    var byPm = {};
    trx.forEach(function (r) { byPm[r.ID_PM] = r; });
    var items = [];
    pms.forEach(function (pm) {
      var t = byPm[pm.ID_PM];
      if (pm.STATUS !== 'Aktif' && !t) return;
      var pic = Pic.untukPm(pm.ID_PM, pics, t);
      // Diperbarui 23 Okt 2026 (diaudit & DISETUJUI Admin -- lihat
      // Master.gs/Config.gs) -- kalau BELUM ada transaksi tersimpan utk
      // tanggal ini (t falsy), isi NILAI AWAL dari Data Acuan PM
      // (ACUAN_PORSI_KECIL/BESAR/NO_KENDARAAN), BUKAN kosong seperti
      // sebelumnya. "tersimpan" TETAP false -- ini cuma PRA-ISI, bukan
      // transaksi yg sudah benar2 disimpan, Admin tetap harus menekan
      // Simpan utk mengonfirmasi (sesuai dokumen §8 "tampilkan status
      // pengisian dan penyimpanan").
      var nilaiAwal, kendaraanAwal;
      if (t) {
        nilaiAwal = Terima._nilai(t); kendaraanAwal = t.NO_KENDARAAN;
      } else {
        nilaiAwal = Terima._nilai({}); // semua kategori 0 dulu (SEKOLAH/POSYANDU lama tetap dihormati formatnya)
        if (pm.ACUAN_PORSI_KECIL !== '' && pm.ACUAN_PORSI_KECIL !== undefined) nilaiAwal.PORSI_KECIL = U.num(pm.ACUAN_PORSI_KECIL);
        if (pm.ACUAN_PORSI_BESAR !== '' && pm.ACUAN_PORSI_BESAR !== undefined) nilaiAwal.PORSI_BESAR = U.num(pm.ACUAN_PORSI_BESAR);
        // DITAMBAHKAN 28 Okt 2026 (dilaporkan Admin -- "Penerima yang
        // Posyandu ga otomatis ngambil data dari PM"). Akar masalah:
        // saat pre-fill ACUAN_PORSI_KECIL/BESAR ditambahkan 23 Okt, PM
        // Posyandu MASIH pakai field lama (belum py ACUAN_BALITA/BUMIL/
        // BUSUI sendiri -- itu baru ditambahkan 27-28 Okt). Baris ini
        // TIDAK pernah ikut diperbarui, jadi Posyandu selalu mulai dari
        // kosong walau datanya SUDAH ada di PM (lihat screenshot Admin,
        // kartu PM Posyandu sudah terisi Balita/Bumil/Busui).
        if (pm.ACUAN_BALITA !== '' && pm.ACUAN_BALITA !== undefined) nilaiAwal.BALITA = U.num(pm.ACUAN_BALITA);
        if (pm.ACUAN_BUMIL !== '' && pm.ACUAN_BUMIL !== undefined) nilaiAwal.BUMIL = U.num(pm.ACUAN_BUMIL);
        if (pm.ACUAN_BUSUI !== '' && pm.ACUAN_BUSUI !== undefined) nilaiAwal.BUSUI = U.num(pm.ACUAN_BUSUI);
        kendaraanAwal = pm.ACUAN_NO_KENDARAAN || '';
      }
      items.push({
        ID_PM: pm.ID_PM, NAMA_PM: pm.NAMA_PM, JENIS_PM: pm.JENIS_PM, STATUS: pm.STATUS,
        kategori: Cfg.KATEGORI[pm.JENIS_PM] || [],
        pic: pic ? { nama: pic.NAMA_PIC, hp: pic.NOMOR_HP } : null,
        tersimpan: !!t, nilai: nilaiAwal, total: t ? U.num(t.TOTAL) : null, noKendaraan: kendaraanAwal,
        dariAcuan: !t, // BARU -- penanda utk frontend (mis. tampilkan label "dari data acuan" di field yg pra-isi)
        waktuInput: t ? t.WAKTU_INPUT : '', userInput: t ? t.USER_INPUT : ''
      });
    });
    var dok = Dok.statusTanggal(tgl, trx);
    return { tanggal: tgl, hari: U.hariIndo(tgl), tanggalIndo: U.tanggalIndo(tgl), items: items,
      dokumen: dok.aktif ? Dok.keluar(dok.aktif) : null, perluRevisi: dok.perluRevisi };
  },

  /** Simpan semua PM dalam satu proses (upsert per tanggal + PM). */
  simpan: function (d, user) {
    var tgl = d.tanggal, p = U.mustDate(tgl);
    if (p.y < 2024 || tgl > U.addDays(U.today(), Cfg.MAX_HARI_KE_DEPAN)) {
      throw new AppError('Tanggal di luar rentang yang diizinkan.', 'TANGGAL_INVALID');
    }
    if (!Array.isArray(d.rows) || !d.rows.length) throw new AppError('Tidak ada data untuk disimpan.', 'VALIDASI');
    if (d.rows.length > 200) throw new AppError('Terlalu banyak baris.', 'VALIDASI');

    var pms = Db.readAll('PM'), pics = Db.readAll('PIC');
    var pmMap = {}; pms.forEach(function (x) { pmMap[x.ID_PM] = x; });
    var existing = {};
    Db.readAll('PENERIMAAN').forEach(function (r) { if (r.TANGGAL === tgl) existing[r.ID_PM] = r; });

    var seen = {}, baru = [], ubah = [], sama = 0, dilewati = 0, errors = [];
    d.rows.forEach(function (row) {
      var pm = pmMap[row.ID_PM];
      if (!pm) { errors.push('PM tidak dikenal: ' + row.ID_PM); return; }
      if (seen[pm.ID_PM]) { errors.push(pm.NAMA_PM + ': data ganda.'); return; }
      seen[pm.ID_PM] = true;
      var ex = existing[pm.ID_PM];
      if (pm.STATUS !== 'Aktif' && !ex) { errors.push(pm.NAMA_PM + ': PM tidak aktif.'); return; }

      var allowed = Cfg.KATEGORI[pm.JENIS_PM] || [], vals = {}, anyFilled = false, total = 0, kend = '';
      try {
        kend = Terima.kendaraan(row.noKendaraan);
        Cfg.KATEGORI_SEMUA.forEach(function (k) {
          var raw = row.nilai ? row.nilai[k] : '';
          if (allowed.indexOf(k) < 0) {
            if (U.intNonNeg(raw, k) !== 0) throw new AppError('Kategori ' + k + ' tidak berlaku untuk ' + pm.JENIS_PM + '.');
            vals[k] = 0; return;
          }
          if (raw !== '' && raw !== null && raw !== undefined) anyFilled = true;
          vals[k] = U.intNonNeg(raw, k);
          total += vals[k];
        });
      } catch (e) { errors.push(pm.NAMA_PM + ': ' + e.message); return; }
      if (!anyFilled) { dilewati++; return; }

      var pic = Pic.untukPm(pm.ID_PM, pics, null);
      var obj = {
        ID_TRANSAKSI: Terima.idTransaksi(tgl, pm.ID_PM), TANGGAL: tgl, ID_PM: pm.ID_PM, NAMA_PM: pm.NAMA_PM,
        PORSI_KECIL: vals.PORSI_KECIL, PORSI_BESAR: vals.PORSI_BESAR, TENAGA_PENDIDIK: vals.TENAGA_PENDIDIK,
        BALITA: vals.BALITA, BUMIL: vals.BUMIL, BUSUI: vals.BUSUI, TOTAL: total,
        ID_PIC: pic ? pic.ID_PIC : '', NAMA_PIC: pic ? pic.NAMA_PIC : '', NO_KENDARAAN: kend,
        WAKTU_INPUT: U.now(), USER_INPUT: user.nama
      };
      if (ex) {
        var changed = Cfg.KATEGORI_SEMUA.some(function (k) { return U.num(ex[k]) !== vals[k]; }) || U.str(ex.NO_KENDARAAN) !== kend;
        if (changed) { obj._row = ex._row; ubah.push(obj); } else sama++;
      } else baru.push(obj);
    });
    if (errors.length) throw new AppError('Data tidak valid: ' + errors.join(' | '), 'VALIDASI', errors);

    ubah.forEach(function (o) { Db.updateRow('PENERIMAAN', o._row, o); });
    Db.appendMany('PENERIMAAN', baru);
    try { Pagu.bangunUlang(); } catch (e) { /* data turunan; dapat dibangun ulang */ }

    var all = Db.readAll('PENERIMAAN').filter(function (r) { return r.TANGGAL === tgl; });
    var totalPaket = all.reduce(function (a, r) { return a + U.num(r.TOTAL); }, 0);
    Db.log(user.nama, 'Simpan Penerimaan', 'PENERIMAAN', tgl,
      baru.length + ' baru, ' + ubah.length + ' diubah, ' + sama + ' tetap; total ' + totalPaket + ' paket');
    var dok = Dok.statusTanggal(tgl, all);
    return { tanggal: tgl, baru: baru.length, diubah: ubah.length, tetap: sama, dilewati: dilewati,
      totalPaket: totalPaket, perluRevisi: dok.perluRevisi };
  },

  /** Data penerimaan terakhir sebelum tanggal tertentu — untuk "Isi dari penerimaan terakhir". */
  terakhir: function (tgl) {
    U.mustDate(tgl);
    var rows = Db.readAll('PENERIMAAN').filter(function (r) { return r.TANGGAL < tgl; });
    if (!rows.length) return { tanggal: null, rows: [] };
    var last = rows.reduce(function (a, r) { return r.TANGGAL > a ? r.TANGGAL : a; }, '');
    return {
      tanggal: last, tanggalIndo: U.tanggalIndo(last),
      rows: rows.filter(function (r) { return r.TANGGAL === last; })
        .map(function (r) { return { ID_PM: r.ID_PM, nilai: Terima._nilai(r) }; })
    };
  },

  riwayat: function (f) {
    f = f || {};
    var pmMap = {}; Db.readAll('PM').forEach(function (p) { pmMap[p.ID_PM] = p; });
    var bast = {};
    Db.readAll('BAST').forEach(function (b) { if (b.STATUS === 'AKTIF') bast[b.TANGGAL + '|' + b.ID_PM] = b; });
    var docs = Db.readAll('DOKUMEN'), docByDate = {}, trxAll = Db.readAll('PENERIMAAN'), lastInput = {};
    trxAll.forEach(function (r) { if (!lastInput[r.TANGGAL] || r.WAKTU_INPUT > lastInput[r.TANGGAL]) lastInput[r.TANGGAL] = r.WAKTU_INPUT; });
    docs.forEach(function (x) {
      if (String(x.STATUS).indexOf('SELESAI') === 0) {
        if (!docByDate[x.TANGGAL] || x.WAKTU_GENERATE > docByDate[x.TANGGAL].WAKTU_GENERATE) docByDate[x.TANGGAL] = x;
      }
    });

    var rows = trxAll.filter(function (r) {
      if (f.tanggal && r.TANGGAL !== f.tanggal) return false;
      if (!f.tanggal && f.bulan && r.TANGGAL.substring(0, 7) !== (f.tahun || U.today().substring(0, 4)) + '-' + U.pad(f.bulan, 2)) return false;
      if (!f.tanggal && !f.bulan && f.tahun && r.TANGGAL.substring(0, 4) !== String(f.tahun)) return false;
      if (f.id_pm && r.ID_PM !== f.id_pm) return false;
      if (f.id_pic && r.ID_PIC !== f.id_pic) return false;
      if (f.jenis && (pmMap[r.ID_PM] || {}).JENIS_PM !== f.jenis) return false;
      return true;
    });
    rows.sort(function (a, b) {
      if (a.TANGGAL !== b.TANGGAL) return a.TANGGAL < b.TANGGAL ? 1 : -1;
      return a._row - b._row;
    });
    var truncated = rows.length > 1000;
    rows = rows.slice(0, 1000).map(function (r) {
      var pm = pmMap[r.ID_PM] || {}, dok = docByDate[r.TANGGAL], b = bast[r.TANGGAL + '|' + r.ID_PM];
      var status = 'Belum dibuat';
      if (dok) status = (lastInput[r.TANGGAL] >= dok.WAKTU_GENERATE) ? 'Perlu revisi' : 'Sudah dibuat';
      return {
        ID_TRANSAKSI: r.ID_TRANSAKSI, TANGGAL: r.TANGGAL, ID_PM: r.ID_PM, NAMA_PM: pm.NAMA_PM || r.NAMA_PM,
        JENIS_PM: pm.JENIS_PM || '', nilai: Terima._nilai(r), TOTAL: U.num(r.TOTAL), NAMA_PIC: r.NAMA_PIC, NO_KENDARAAN: r.NO_KENDARAAN,
        WAKTU_INPUT: r.WAKTU_INPUT, USER_INPUT: r.USER_INPUT, NOMOR_BAST: b ? b.NOMOR_BAST : '',
        statusDokumen: status, FILE_WORD: dok ? dok.FILE_WORD : '', FILE_PDF: dok ? dok.FILE_PDF : ''
      };
    });
    return { rows: rows, terpotong: truncated };
  }
};


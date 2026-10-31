/**
 * Api.gs — Endpoint Web App (router JSON).
 * Frontend memanggil: POST {action, token, data} dengan Content-Type text/plain
 * (menghindari preflight CORS). Semua validasi dilakukan DI SINI; data dari
 * frontend tidak pernah dipercaya.
 */
function doGet() {
  return Api.json({ ok: true, data: { app: Cfg.APP, versi: Cfg.VERSION, status: 'siap' } });
}
function doPost(e) { return Api.handle(e); }

var Api = {
  json: function (o) {
    return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  },

  /** Buang properti internal (_row) sebelum dikirim ke frontend. */
  bersih: function (v) {
    if (Array.isArray(v)) return v.map(Api.bersih);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) { if (k !== '_row') o[k] = Api.bersih(v[k]); });
      return o;
    }
    return v;
  },

  _publik: function (s) {
    return { NAMA_SPPG: s.NAMA_SPPG || '', KODE_SPPG: s.KODE_SPPG || '', TAHUN_AKTIF: s.TAHUN_AKTIF || '', BUAT_PDF: s.BUAT_PDF || 'YA' };
  },

  routes: {
    'login': { pub: true, fn: function (d) { return Auth.login(d.username, d.pin); } },

    'bootstrap': { fn: function (d, u) {
      var s = Db.settings();
      return { user: u, today: U.today(), versi: Cfg.VERSION, settings: Api._publik(s),
        pm: Pm.daftar(), pic: Pic.daftar(), tarif: Db.tarif(), kategori: Cfg.KATEGORI, tarifMap: Cfg.TARIF_MAP,
        folderRoot: s.FOLDER_DOKUMEN ? 'https://drive.google.com/drive/folders/' + s.FOLDER_DOKUMEN : '' };
    } },
    'dashboard': { fn: function (d) { return Pagu.dashboard(d.tanggal); } },

    'pm.list': { fn: function () { return Pm.daftar(); } },
    'pm.save': { write: true, fn: function (d, u) { return Pm.simpan(d, u); } },
    // BARU 23 Okt 2026 (dokumen Pembaruan SIPENDOK §6.C) -- hapus PM,
    // ditolak backend kalau sudah py riwayat (lihat Pm.hapus, Master.gs).
    'pm.delete': { write: true, fn: function (d, u) { return Pm.hapus(d, u); } },
    // BARU 25 Okt 2026 -- Portal utama (PenerimaManfaat.gs) SUDAH
    // memanggil 3 aksi ini sejak sesi sebelumnya, TAPI belum pernah ada
    // di sisi SIPENDOK (ditemukan via error "SIPENDOK: Aksi tidak
    // dikenal" di halaman Penerima Manfaat Relawan). DIKONFIRMASI Admin
    // 25 Okt 2026: angka PK/PB/Balita/Bumil/Busui bersumber dari Data
    // Acuan PM (ACUAN_PORSI_KECIL/BESAR utk Sekolah) -- Posyandu tampil
    // 0 krn memang belum ada field acuan Balita/Bumil/Busui (keputusan
    // terpisah sebelumnya, lihat Config.gs catatan ACUAN_JUMLAH_SISWA).
    'pm.ringkasRelawan': { fn: function () { return Pm.ringkasUmum_(true); } },
    'pm.ringkasPublik': { pub: true, fn: function () { return Pm.ringkasUmum_(false); } }, // diperbaiki 27 Okt 2026 -- diakses halaman publik TANPA login, wajib pub:true spy tidak ikut diverifikasi token
    // "Hari ini" utk dasbor ASN/Kepala SPPG -- BEDA dari 2 di atas,
    // pakai transaksi Penerimaan HARI INI sungguhan (bukan Acuan),
    // krn dasbor ini memang soal status operasional HARI INI secara
    // harfiah. Bentuk belum dikonfirmasi Admin -- ringkasan dasar dulu,
    // koreksi kalau bentuknya perlu disesuaikan dasbor.
    'pm.ringkasHariIniAsn': { fn: function () { return Pm.ringkasHariIniAsn_(); } },
    'pic.list': { fn: function () { return Pic.daftar(); } },
    'pic.save': { write: true, fn: function (d, u) { return Pic.simpan(d, u); } },

    'penerimaan.get': { fn: function (d) { return Terima.get(d.tanggal); } },
    'penerimaan.save': { write: true, fn: function (d, u) { return Terima.simpan(d, u); } },
    'penerimaan.terakhir': { fn: function (d) { return Terima.terakhir(d.tanggal); } },
    'penerimaan.riwayat': { fn: function (d) { return Terima.riwayat(d); } },

    'pagu.rekap': { fn: function (d) { return Pagu.rekap(d); } },

    'dokumen.validasi': { fn: function (d) { return Dok.validasi(d.tanggal); } },
    'dokumen.generate': { write: true, fn: function (d, u) { return Dok.generate(d, u); } },
    'dokumen.list': { fn: function (d) { return Dok.daftar(d); } }, // fitur lama, disembunyikan dari UI 27 Okt 2026 tapi endpoint dipertahankan
    'bastSj.daftarArsip': { fn: function (d) { return BastSj.daftarArsip(d.kodePeriode); } }, // BARU 27 Okt 2026
    // BARU 23 Okt 2026 (dokumen Pembaruan SIPENDOK §13-15) -- BAST +
    // Surat Jalan gabungan, modul TERPISAH dari dokumen.* di atas
    // (Dokumen Penerimaan harian lama, TIDAK disentuh).
    'bastSj.pratinjau': { fn: function (d) { return BastSj.pratinjau(d.tanggal); } },
    'bastSj.generate': { write: true, fn: function (d, u) { return BastSj.generate(d, u); } },
    'bastSj.regenerate': { write: true, fn: function (d, u) { return BastSj.regenerate(d, u); } }, // BARU 28 Okt 2026

    'pengaturan.get': { fn: function () { return Db.settings(); } },
    'pengaturan.save': { write: true, fn: function (d, u) { return Api._simpanPengaturan(d, u); } },
    'pengaturan.cekTemplate': { fn: function () { return Dok.cekTemplate(); } },
    'pengaturan.cekTemplateBastSj': { fn: function () { return BastSj.cekTemplate(); } },
    // BARU 25 Okt 2026 (dokumen Master Instruction SIPENDOK §M) -- Insentif PIC.
    'insentif.rekapPeriode': { fn: function (d) { return Insentif.rekapPeriode(d.idPeriode); } }, // token tidak perlu dikirim ke fungsinya -- dispatcher sudah verifikasi otomatis
    'periode.list': { fn: function () { return Bast.daftarPeriode(); } } // otentikasi otomatis oleh dispatcher, lihat catatan Insentif.gs
  },

  _simpanPengaturan: function (d, u) {
    var boleh = ['NAMA_SPPG', 'TAHUN_AKTIF', 'BUAT_PDF', 'TEMPLATE_DOKUMEN', 'TEMPLATE_BAST_SJ', 'FOLDER_DOKUMEN']; // TEMPLATE_BAST_SJ ditambahkan 25 Okt 2026
    boleh.forEach(function (k) {
      if (d[k] === undefined) return;
      var v = U.str(d[k]);
      if (k === 'TAHUN_AKTIF' && !/^\d{4}$/.test(v)) throw new AppError('Tahun aktif harus 4 digit.', 'VALIDASI');
      if (k === 'BUAT_PDF') { v = v.toUpperCase(); if (v !== 'YA' && v !== 'TIDAK') throw new AppError('BUAT_PDF harus YA atau TIDAK.', 'VALIDASI'); }
      if (k === 'NAMA_SPPG') v = U.clean(v, 80);
      if (k === 'TEMPLATE_DOKUMEN' && v) {
        if (!/^[A-Za-z0-9_-]{10,}$/.test(v)) throw new AppError('File ID template tidak valid.', 'VALIDASI');
        try { DriveApp.getFileById(v).getName(); } catch (e) { throw new AppError('File template tidak dapat dibuka dengan ID tersebut.', 'VALIDASI'); }
      }
      if (k === 'TEMPLATE_BAST_SJ' && v) { // BARU 25 Okt 2026
        if (!/^[A-Za-z0-9_-]{10,}$/.test(v)) throw new AppError('File ID template BAST+SJ tidak valid.', 'VALIDASI');
        try { DriveApp.getFileById(v).getName(); } catch (e) { throw new AppError('File template BAST+SJ tidak dapat dibuka dengan ID tersebut.', 'VALIDASI'); }
      }
      if (k === 'FOLDER_DOKUMEN' && v) {
        if (!/^[A-Za-z0-9_-]{10,}$/.test(v)) throw new AppError('Folder ID tidak valid.', 'VALIDASI');
        try { DriveApp.getFolderById(v).getName(); } catch (e) { throw new AppError('Folder tidak dapat dibuka dengan ID tersebut.', 'VALIDASI'); }
      }
      Db.setSetting(k, v);
    });
    Db.log(u.nama, 'Ubah Pengaturan', 'PENGATURAN', '', Object.keys(d).filter(function (k) { return boleh.indexOf(k) >= 0; }).join(', '));
    return Db.settings();
  },

  _kunci: function (fn) {
    var lock = LockService.getScriptLock();
    try { lock.waitLock(30000); }
    catch (e) { throw new AppError('Sistem sedang dipakai pengguna lain. Coba lagi sebentar.', 'SIBUK'); }
    try { return fn(); } finally { lock.releaseLock(); }
  },

  handle: function (e) {
    try {
      var raw = e && e.postData ? e.postData.contents : '';
      if (!raw || raw.length > 300000) throw new AppError('Permintaan tidak valid.', 'REQUEST');
      var req;
      try { req = JSON.parse(raw); } catch (x) { throw new AppError('Permintaan tidak valid.', 'REQUEST'); }
      var route = Api.routes[req.action];
      if (!route) throw new AppError('Aksi tidak dikenal.', 'REQUEST');
      var user = route.pub ? null : Auth.verify(req.token);
      var data = req.data || {};
      var result = route.write
        ? Api._kunci(function () { return route.fn(data, user); })
        : route.fn(data, user);
      return Api.json({ ok: true, data: Api.bersih(result) });
    } catch (err) {
      if (err instanceof AppError) {
        return Api.json({ ok: false, error: err.message, code: err.code, details: err.details });
      }
      console.error(err && err.stack ? err.stack : err);
      return Api.json({ ok: false, error: 'Terjadi kesalahan di server: ' + (err && err.message ? err.message : err), code: 'SERVER' });
    }
  }
};


/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * Stok.gs — Modul Stok & Persediaan Operasional (BARU)
 *
 * STATUS 30 Okt 2026: LEGACY / ARCHIVE CANDIDATE (dikonfirmasi Admin).
 * SIRAGA (SiragaDb.gs dkk, spreadsheet TERPISAH via SIRAGA_SPREADSHEET_ID)
 * adalah sistem stok yang BENAR-BENAR dipakai petugas gudang di lapangan
 * sekarang. File ini TETAP tersambung ke Code.gs (TIDAK diputus -- 68+97
 * baris riwayat transaksi historis di sini masih perlu bisa ditelusuri,
 * sesuai larangan "jangan hapus data histori"). TIDAK ADA perubahan
 * PERILAKU di file ini -- murni penanda status. Fitur BARU sebaiknya
 * dibangun di SiragaDb.gs, BUKAN di sini. Menyembunyikan panel ini dari
 * UI admin.html BELUM diputuskan -- menunggu konfirmasi terpisah.
 *
 * Modul berdiri sendiri: 4 sheet baru (17-20), TIDAK menyentuh sheet atau
 * fungsi modul lain (Absensi, Akun, Relawan, Admin, dst). Hanya menambah
 * (bukan mengubah) 4 baris di NAMA_SHEET (Utils.gs) dan beberapa `case`
 * baru di Code.gs.
 *
 * ==================================================================
 * WAJIB DISIAPKAN MANUAL sebelum modul ini berfungsi:
 * ==================================================================
 * 1. Kolom BARU "ROLE_STOK" di sheet 07_AKUN_RELAWAN (paling kanan).
 *    Boleh kosong untuk relawan biasa. Isi "PETUGAS" untuk relawan yang
 *    diberi akses modul Stok tanpa menjadikannya Admin penuh.
 * 2. Empat sheet baru berikut, dengan baris header PERSIS seperti ini:
 *
 *    17_STOK_KATEGORI
 *    ID_KATEGORI | NAMA_KATEGORI | KETERANGAN | AKTIF | DIBUAT_PADA
 *
 *    18_STOK_BARANG
 *    ID_BARANG | KODE_BARANG | NAMA_BARANG | ID_KATEGORI | SATUAN |
 *    STOK_MINIMUM | STOK_SAAT_INI | AKTIF | KETERANGAN | DIBUAT_PADA | SUBKATEGORI
 *    -- SUBKATEGORI (BARU) sengaja di kolom PALING AKHIR, bukan setelah
 *       ID_KATEGORI, supaya tidak menggeser posisi kolom STOK_SAAT_INI dkk
 *       yang sudah dipakai fungsi transaksi di bawah.
 *
 *    19_STOK_TRANSAKSI
 *    ID_TRANSAKSI | NOMOR_TRANSAKSI | TANGGAL | JENIS | SUMBER_TUJUAN |
 *    ID_PETUGAS | NAMA_PETUGAS | KETERANGAN | DIBUAT_PADA
 *
 *    20_STOK_TRANSAKSI_DETAIL
 *    ID_DETAIL | ID_TRANSAKSI | NOMOR_TRANSAKSI | ID_BARANG | NAMA_BARANG |
 *    SATUAN | JUMLAH | STOK_SEBELUM | STOK_SESUDAH
 *
 *    23_STOK_SATUAN (BARU)
 *    ID_SATUAN | NAMA_SATUAN | AKTIF
 *    -- Master satuan TERKONTROL. Barang WAJIB pilih dari daftar ini,
 *       admin tidak boleh ketik bebas ("kg"/"Kg"/"kilogram" dianggap beda).
 *
 * ==================================================================
 * BELUM diimplementasikan pada tahap ini (sesuai arahan: jangan
 * dipaksakan kalau belum aman, siapkan sebagai modul berikutnya):
 * ==================================================================
 * - Koreksi Stok (JENIS transaksi sengaja dibuat fleksibel string biasa,
 *   bukan enum kaku, supaya "KOREKSI" bisa ditambah nanti tanpa migrasi).
 * - Export Laporan (struktur data di bawah sudah cukup untuk itu nanti).
 * - Kategori belum bisa dihapus (hanya nonaktif) — konsisten dengan pola
 *   Lokasi.gs yang juga tidak pernah hard-delete data yang sudah dipakai.
 */

// ------------------------------------------------------------
// AKSES SHEET
// ------------------------------------------------------------

function getStokKategoriSheet() { return getSheet(NAMA_SHEET.STOK_KATEGORI); }
function getStokBarangSheet() { return getSheet(NAMA_SHEET.STOK_BARANG); }
function getStokTransaksiSheet() { return getSheet(NAMA_SHEET.STOK_TRANSAKSI); }
function getStokDetailSheet() { return getSheet(NAMA_SHEET.STOK_TRANSAKSI_DETAIL); }
function getStokSatuanSheet() { return getSheet(NAMA_SHEET.STOK_SATUAN); }

// ------------------------------------------------------------
// PERMISSION — dua tingkat, TIDAK mengubah Admin.gs / Akun.gs sama sekali
// ------------------------------------------------------------

/** Admin penuh saja. Dipakai untuk: Kategori, Tambah/Edit Barang, Hak Akses. */
function requireStokAdmin_(token) {
  requireAuth(token); // fungsi asli dari Admin.gs, tidak diubah
}

/**
 * Admin ATAU relawan berstatus Petugas Stok (ROLE_STOK = 'PETUGAS').
 * Dipakai untuk: Dashboard, lihat Data Barang, Barang Masuk, Barang
 * Keluar, Riwayat. Return siapa yang mengakses (dicatat sebagai Petugas
 * pada transaksi).
 */
/**
 * Admin ATAU relawan berstatus Petugas Stok (ROLE_STOK = 'PETUGAS') --
 * akses PENUH (baca+tulis). Staff (Admin Portal) HANYA lolos untuk aksi
 * BACA (aksiTulis=false, default) -- lihat-lihat saja sesuai keputusan;
 * untuk aksi tulis (Barang Masuk/Keluar) Staff ditolak dengan pesan jelas.
 * @param {string} token
 * @param {boolean} [aksiTulis] true kalau dipanggil dari aksi yang MENULIS data (Barang Masuk/Keluar).
 */
function requireStokAccess_(token, aksiTulis) {
  try {
    const username = requireAuth(token); // Admin PENUH -- selalu lolos, baca maupun tulis
    return { tipe: 'ADMIN', idPetugas: username, namaPetugas: username };
  } catch (eAdmin) {
    // Bukan token Admin -- cek dulu apakah ini sesi Staff yang valid
    // SEBELUM lanjut ke jalur relawan, supaya Staff yang mencoba aksi
    // tulis dapat pesan yang jelas ("khusus Admin/Petugas Stok"), bukan
    // pesan membingungkan seolah sesinya tidak valid sama sekali.
    let usernameStaff = null;
    try { usernameStaff = requireAuth(token, true); } catch (eStaff) { /* bukan sesi Admin Portal sama sekali -- lanjut jalur relawan di bawah */ }
    if (usernameStaff) {
      if (aksiTulis) throw new Error('Akun Staff hanya bisa melihat data Stok, tidak bisa mencatat transaksi -- khusus Admin/Petugas Stok.');
      return { tipe: 'STAFF', idPetugas: usernameStaff, namaPetugas: usernameStaff };
    }
  }

  const idRelawan = requireAuthRelawan(token); // dari Akun.gs, akan throw sendiri kalau sesi tidak valid
  const relawan = getRelawanById(idRelawan); // dari Relawan.gs -- ROLE_STOK dipindah ke sini (lihat catatan pembagian kolom)
  if (!relawan || String(relawan.roleStok || '').toUpperCase() !== 'PETUGAS') {
    throw new Error('Anda tidak memiliki izin mengakses modul Stok & Persediaan.');
  }
  return { tipe: 'PETUGAS_STOK', idPetugas: idRelawan, namaPetugas: relawan.nama || idRelawan };
}

// ------------------------------------------------------------
// UTILITAS
// ------------------------------------------------------------

function statusStokBarang_(stokSaatIni, stokMinimum) {
  if (stokSaatIni <= 0) return 'HABIS';
  if (stokSaatIni <= stokMinimum) return 'MENIPIS';
  return 'AMAN';
}

function generateIdKategori_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][0] || '').match(/^KTG(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'KTG' + String(max + 1).padStart(3, '0');
}

function generateIdBarang_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][0] || '').match(/^BRG(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'BRG' + String(max + 1).padStart(3, '0');
}

/** Format: BM-YYYYMMDD-001 / BK-YYYYMMDD-001, urut ulang tiap hari per jenis. */
function generateNomorTransaksi_(sheet, jenis) {
  const prefix = jenis === 'MASUK' ? 'BM' : 'BK';
  const tanggalStr = Utilities.formatDate(new Date(), ZONA_WAKTU, 'yyyyMMdd');
  const awalan = prefix + '-' + tanggalStr + '-';
  const data = sheet.getDataRange().getValues();
  let maxUrut = 0;
  for (let i = 1; i < data.length; i++) {
    const nomor = String(data[i][1] || '');
    if (nomor.indexOf(awalan) === 0) {
      const urut = parseInt(nomor.substring(awalan.length), 10);
      if (!isNaN(urut)) maxUrut = Math.max(maxUrut, urut);
    }
  }
  return awalan + String(maxUrut + 1).padStart(3, '0');
}

// ------------------------------------------------------------
// MASTER SATUAN (BARU) — daftar terkontrol, admin/petugas tidak boleh
// ketik bebas. Sengaja tidak bisa dihapus permanen (hanya nonaktif),
// konsisten dengan pola Kategori/Lokasi -- data yang sudah terlanjur
// dipakai barang lain tidak boleh hilang begitu saja.
// ------------------------------------------------------------

function getSatuanList(token) {
  requireStokAccess_(token);
  return sheetToObjects(getStokSatuanSheet())
    .filter(s => String(s.AKTIF).toUpperCase() !== 'NONAKTIF')
    .map(s => ({ id: s.ID_SATUAN, nama: s.NAMA_SATUAN }));
}

function getSatuanListAdmin(token) {
  requireStokAdmin_(token);
  return sheetToObjects(getStokSatuanSheet()).map(s => ({
    id: s.ID_SATUAN, nama: s.NAMA_SATUAN, aktif: String(s.AKTIF).toUpperCase() !== 'NONAKTIF'
  }));
}

function generateIdSatuan_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][0] || '').match(/^STN(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'STN' + String(max + 1).padStart(3, '0');
}

function addSatuan(body) {
  requireStokAdmin_(body.token);
  requireIzinModulBaru_(requireAuth(body.token), 'SIRAGA', 'CREATE');
  const nama = sanitize(body.nama);
  if (!nama) throw new Error('Nama satuan wajib diisi.');

  const sheet = getStokSatuanSheet();
  const sudahAda = sheetToObjects(sheet).some(s => String(s.NAMA_SATUAN).toLowerCase() === nama.toLowerCase());
  if (sudahAda) throw new Error('Satuan "' + nama + '" sudah ada.');

  const id = generateIdSatuan_(sheet);
  sheet.appendRow([id, nama, 'AKTIF']);
  return { id: id, nama: nama };
}

function updateStatusSatuanAktif(body) {
  requireStokAdmin_(body.token);
  requireIzinModulBaru_(requireAuth(body.token), 'SIRAGA', 'EDIT');
  const id = sanitize(body.id);
  const aktif = !!body.aktif;
  const sheet = getStokSatuanSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 3).setValue(aktif ? 'AKTIF' : 'NONAKTIF');
      return { success: true };
    }
  }
  throw new Error('Satuan tidak ditemukan.');
}

/** Dipakai addBarang/updateBarang: pastikan satuan yang dikirim benar-benar ada & aktif di master. */
function satuanValid_(namaSatuan) {
  return sheetToObjects(getStokSatuanSheet()).some(s =>
    s.NAMA_SATUAN === namaSatuan && String(s.AKTIF).toUpperCase() !== 'NONAKTIF'
  );
}

// ------------------------------------------------------------
// KATEGORI
// ------------------------------------------------------------

/** Untuk dropdown di form (Admin & Petugas Stok) -- hanya yang AKTIF. */
function getKategoriBarang(token) {
  requireStokAccess_(token);
  return sheetToObjects(getStokKategoriSheet())
    .filter(k => String(k.AKTIF).toUpperCase() !== 'NONAKTIF')
    .map(k => ({ id: k.ID_KATEGORI, nama: k.NAMA_KATEGORI, keterangan: k.KETERANGAN || '' }));
}

/** Untuk halaman Kelola Kategori (Admin) -- termasuk yang nonaktif. */
function getKategoriBarangAdmin(token) {
  requireStokAdmin_(token);
  return sheetToObjects(getStokKategoriSheet()).map(k => ({
    id: k.ID_KATEGORI,
    nama: k.NAMA_KATEGORI,
    keterangan: k.KETERANGAN || '',
    aktif: String(k.AKTIF).toUpperCase() !== 'NONAKTIF'
  }));
}

function addKategoriStok(body) {
  requireStokAdmin_(body.token);
  requireIzinModulBaru_(requireAuth(body.token), 'SIRAGA', 'CREATE');
  const nama = sanitize(body.nama);
  if (!nama) throw new Error('Nama kategori wajib diisi.');

  const sheet = getStokKategoriSheet();
  const id = generateIdKategori_(sheet);
  sheet.appendRow([id, nama, sanitize(body.keterangan), 'AKTIF', new Date()]);
  return { id: id, nama: nama };
}

function updateStatusKategoriAktif(body) {
  requireStokAdmin_(body.token);
  requireIzinModulBaru_(requireAuth(body.token), 'SIRAGA', 'EDIT');
  const id = sanitize(body.id);
  const aktif = !!body.aktif;
  const sheet = getStokKategoriSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 4).setValue(aktif ? 'AKTIF' : 'NONAKTIF');
      return { success: true };
    }
  }
  throw new Error('Kategori tidak ditemukan.');
}

// ------------------------------------------------------------
// DATA BARANG
// ------------------------------------------------------------

function getDataBarangList(token, params) {
  requireStokAccess_(token);
  params = params || {};

  const kategoriList = sheetToObjects(getStokKategoriSheet());
  const namaKategoriMap = {};
  kategoriList.forEach(k => { namaKategoriMap[k.ID_KATEGORI] = k.NAMA_KATEGORI; });

  let barang = sheetToObjects(getStokBarangSheet());
  if (params.kategori) barang = barang.filter(b => b.ID_KATEGORI === params.kategori);
  if (params.cari) {
    const q = String(params.cari).toLowerCase();
    barang = barang.filter(b =>
      String(b.NAMA_BARANG).toLowerCase().indexOf(q) !== -1 ||
      String(b.KODE_BARANG).toLowerCase().indexOf(q) !== -1
    );
  }

  let hasil = barang.map(b => {
    const stok = Number(b.STOK_SAAT_INI) || 0;
    const minimum = Number(b.STOK_MINIMUM) || 0;
    return {
      id: b.ID_BARANG,
      kode: b.KODE_BARANG,
      nama: b.NAMA_BARANG,
      idKategori: b.ID_KATEGORI,
      subkategori: b.SUBKATEGORI || '',
      namaKategori: namaKategoriMap[b.ID_KATEGORI] || '-',
      satuan: b.SATUAN,
      stok: stok,
      stokMinimum: minimum,
      status: statusStokBarang_(stok, minimum),
      aktif: String(b.AKTIF).toUpperCase() !== 'NONAKTIF'
    };
  });

  if (params.status) hasil = hasil.filter(b => b.status === params.status);
  return hasil;
}

function getDetailBarang(token, idBarang) {
  requireStokAccess_(token);
  idBarang = sanitize(idBarang);

  const b = sheetToObjects(getStokBarangSheet()).find(x => x.ID_BARANG === idBarang);
  if (!b) throw new Error('Barang tidak ditemukan.');

  const kategori = sheetToObjects(getStokKategoriSheet()).find(k => k.ID_KATEGORI === b.ID_KATEGORI);

  const transaksiMap = {};
  sheetToObjects(getStokTransaksiSheet()).forEach(t => { transaksiMap[t.ID_TRANSAKSI] = t; });

  let totalMasuk = 0, totalKeluar = 0;
  const riwayat = sheetToObjects(getStokDetailSheet())
    .filter(d => d.ID_BARANG === idBarang)
    .map(d => {
      const t = transaksiMap[d.ID_TRANSAKSI] || {};
      const jumlah = Number(d.JUMLAH) || 0;
      if (t.JENIS === 'MASUK') totalMasuk += jumlah;
      else if (t.JENIS === 'KELUAR') totalKeluar += jumlah;
      return {
        tanggal: t.TANGGAL || '',
        nomorTransaksi: d.NOMOR_TRANSAKSI,
        jenis: t.JENIS || '',
        jumlah: jumlah,
        stokSebelum: Number(d.STOK_SEBELUM) || 0,
        stokSesudah: Number(d.STOK_SESUDAH) || 0,
        petugas: t.NAMA_PETUGAS || '',
        keterangan: t.KETERANGAN || ''
      };
    })
    .reverse(); // baris sheet urut kronologis menaik -> baru dibalik jadi terbaru dulu

  const stok = Number(b.STOK_SAAT_INI) || 0;
  const minimum = Number(b.STOK_MINIMUM) || 0;

  return {
    id: b.ID_BARANG,
    kode: b.KODE_BARANG,
    nama: b.NAMA_BARANG,
    idKategori: b.ID_KATEGORI,
    subkategori: b.SUBKATEGORI || '',
    namaKategori: kategori ? kategori.NAMA_KATEGORI : '-',
    satuan: b.SATUAN,
    stok: stok,
    stokMinimum: minimum,
    status: statusStokBarang_(stok, minimum),
    aktif: String(b.AKTIF).toUpperCase() !== 'NONAKTIF',
    keterangan: b.KETERANGAN || '',
    totalMasuk: totalMasuk,
    totalKeluar: totalKeluar,
    riwayat: riwayat
  };
}

function addBarang(body) {
  requireStokAdmin_(body.token);
  // Penerapan NYATA Manajemen Hak Akses (16-18 Okt 2026, pembuktian --
  // bukan UI tanpa fungsi): kalau pengguna ini SUDAH dimigrasi ke role
  // baru & role itu TIDAK punya izin CREATE di modul SIRAGA (mis. Admin
  // Operasional yg sengaja dibatasi VIEW-saja), ditolak DI SINI, di
  // server -- bukan cuma tombol disembunyikan di frontend.
  requireIzinModulBaru_(requireAuth(body.token), 'SIRAGA', 'CREATE');
  const nama = sanitize(body.nama);
  const idKategori = sanitize(body.idKategori);
  const subkategori = sanitize(body.subkategori);
  const satuan = sanitize(body.satuan);
  const stokMinimum = Number(body.stokMinimum) || 0;
  const stokAwal = Number(body.stokAwal) || 0;

  if (!nama) throw new Error('Nama barang wajib diisi.');
  if (!idKategori) throw new Error('Kategori wajib dipilih.');
  if (!satuan) throw new Error('Satuan wajib dipilih.');
  if (!satuanValid_(satuan)) throw new Error('Satuan "' + satuan + '" tidak ada di Master Satuan. Pilih dari daftar yang tersedia, atau tambahkan dulu di Kelola Satuan.');
  if (stokMinimum < 0) throw new Error('Stok minimum tidak boleh negatif.');
  if (stokAwal < 0) throw new Error('Stok awal tidak boleh negatif.');

  const sheet = getStokBarangSheet();
  const id = generateIdBarang_(sheet);
  sheet.appendRow([id, id, nama, idKategori, satuan, stokMinimum, stokAwal, 'AKTIF', sanitize(body.keterangan), new Date(), subkategori]);
  return { id: id, nama: nama };
}

function updateBarang(body) {
  requireStokAdmin_(body.token);
  requireIzinModulBaru_(requireAuth(body.token), 'SIRAGA', 'EDIT'); // lihat komentar penjelasan di addBarang
  const id = sanitize(body.id);
  const nama = sanitize(body.nama);
  const idKategori = sanitize(body.idKategori);
  const subkategori = sanitize(body.subkategori);
  const satuan = sanitize(body.satuan);
  const stokMinimum = Number(body.stokMinimum) || 0;

  if (!id) throw new Error('ID barang wajib diisi.');
  if (!nama) throw new Error('Nama barang wajib diisi.');
  if (!idKategori) throw new Error('Kategori wajib dipilih.');
  if (!satuan) throw new Error('Satuan wajib dipilih.');
  if (!satuanValid_(satuan)) throw new Error('Satuan "' + satuan + '" tidak ada di Master Satuan. Pilih dari daftar yang tersedia, atau tambahkan dulu di Kelola Satuan.');
  if (stokMinimum < 0) throw new Error('Stok minimum tidak boleh negatif.');

  const sheet = getStokBarangSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 3).setValue(nama);
      sheet.getRange(i + 1, 4).setValue(idKategori);
      sheet.getRange(i + 1, 5).setValue(satuan);
      sheet.getRange(i + 1, 6).setValue(stokMinimum);
      sheet.getRange(i + 1, 9).setValue(sanitize(body.keterangan));
      sheet.getRange(i + 1, 11).setValue(subkategori);
      return { success: true };
    }
  }
  throw new Error('Barang tidak ditemukan.');
}

function updateStatusBarangAktif(body) {
  requireStokAdmin_(body.token);
  requireIzinModulBaru_(requireAuth(body.token), 'SIRAGA', 'EDIT');
  const id = sanitize(body.id);
  const aktif = !!body.aktif;
  const sheet = getStokBarangSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 8).setValue(aktif ? 'AKTIF' : 'NONAKTIF');
      return { success: true };
    }
  }
  throw new Error('Barang tidak ditemukan.');
}

// ------------------------------------------------------------
// TRANSAKSI — BARANG MASUK / KELUAR (multi-item, terkunci)
// ------------------------------------------------------------

function simpanBarangMasuk(body) {
  const akses = requireStokAccess_(body.token, true); // true = aksi tulis, Staff ditolak
  requireIzinModulBaru_(akses.idPetugas, 'SIRAGA', 'CREATE'); // akses.idPetugas: username (Admin/Staff) ATAU idRelawan (Petugas Stok) -- cekIzinModul_ otomatis deteksi tipenya
  return prosesTransaksiStok_(body, 'MASUK', akses);
}

function simpanBarangKeluar(body) {
  const akses = requireStokAccess_(body.token, true); // true = aksi tulis, Staff ditolak
  requireIzinModulBaru_(akses.idPetugas, 'SIRAGA', 'CREATE');
  return prosesTransaksiStok_(body, 'KELUAR', akses);
}

/**
 * Inti transaksi stok. Dipakai oleh Barang Masuk & Barang Keluar.
 * LockService dipasang HANYA di sini (baca stok -> validasi -> tulis),
 * bagian kritis yang benar-benar butuh konsistensi kalau 2 petugas
 * bertransaksi bersamaan -- bukan dipasang sembarangan di semua fungsi.
 */
function prosesTransaksiStok_(body, jenis, akses) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw new Error('Minimal harus ada 1 barang dalam transaksi.');

  const sumberTujuan = sanitize(body.sumberTujuan);
  const keterangan = sanitize(body.keterangan);

  const itemBersih = items.map((it, idx) => {
    const idBarang = sanitize(it.idBarang);
    const jumlah = Number(it.jumlah);
    if (!idBarang) throw new Error('Barang pada baris ke-' + (idx + 1) + ' wajib dipilih.');
    if (!jumlah || jumlah <= 0) throw new Error('Jumlah pada baris ke-' + (idx + 1) + ' harus lebih dari 0.');
    return { idBarang: idBarang, jumlah: jumlah };
  });

  const lock = LockService.getScriptLock();
  const dapatKunci = lock.tryLock(10000);
  if (!dapatKunci) {
    throw new Error('Sistem sedang sibuk memproses transaksi stok lain. Silakan coba lagi dalam beberapa detik.');
  }

  try {
    const sheetBarang = getStokBarangSheet();
    const dataBarang = sheetBarang.getDataRange().getValues();

    const petaBarang = {};
    for (let i = 1; i < dataBarang.length; i++) {
      petaBarang[String(dataBarang[i][0])] = {
        baris: i + 1,
        stok: Number(dataBarang[i][6]) || 0,
        nama: dataBarang[i][2],
        satuan: dataBarang[i][4],
        aktif: String(dataBarang[i][7]).toUpperCase() !== 'NONAKTIF'
      };
    }

    // Validasi SEMUA item dulu, sebelum menulis apa pun -- supaya tidak
    // ada transaksi yang "setengah tersimpan" kalau salah satu item gagal.
    itemBersih.forEach((it, idx) => {
      const b = petaBarang[it.idBarang];
      if (!b) throw new Error('Barang pada baris ke-' + (idx + 1) + ' tidak ditemukan.');
      if (!b.aktif) throw new Error('Barang "' + b.nama + '" sudah nonaktif, tidak bisa dipakai transaksi baru.');
      if (jenis === 'KELUAR' && it.jumlah > b.stok) {
        throw new Error('Stok tidak mencukupi untuk "' + b.nama + '" (stok saat ini: ' + b.stok + ' ' + b.satuan + ').');
      }
    });

    const sheetTransaksi = getStokTransaksiSheet();
    const idTransaksi = 'TRX' + new Date().getTime();
    const nomorTransaksi = generateNomorTransaksi_(sheetTransaksi, jenis);
    const now = new Date();
    sheetTransaksi.appendRow([
      idTransaksi, nomorTransaksi, formatTanggal(now), jenis, sumberTujuan,
      akses.idPetugas, akses.namaPetugas, keterangan, now
    ]);

    const sheetDetail = getStokDetailSheet();
    // OPTIMASI: sebelumnya appendRow() + setValue() dipanggil TERPISAH
    // untuk SETIAP item (kalau 1 transaksi ada 10 barang = 20 operasi
    // Spreadsheet). Sekarang disiapkan dulu semua di memory, ditulis
    // SEKALIGUS dalam 1 batch per sheet (2 operasi total, berapa pun
    // jumlah itemnya).
    const barisDetailBaru = [];
    itemBersih.forEach(it => {
      const b = petaBarang[it.idBarang];
      const stokSebelum = b.stok;
      const stokSesudah = jenis === 'MASUK' ? stokSebelum + it.jumlah : stokSebelum - it.jumlah;

      barisDetailBaru.push([
        'DTL' + Utilities.getUuid().substring(0, 8), idTransaksi, nomorTransaksi, it.idBarang,
        b.nama, b.satuan, it.jumlah, stokSebelum, stokSesudah
      ]);

      // Update stok di ARRAY dataBarang yang SUDAH ada di memory (bukan
      // langsung ke sheet) -- ditulis sekaligus di bawah setelah loop ini.
      dataBarang[b.baris - 1][6] = stokSesudah;
      b.stok = stokSesudah; // jaga-jaga kalau barang yang sama muncul >1x dalam 1 transaksi
    });

    // Tulis SEMUA baris detail sekaligus (1 operasi, bukan N appendRow).
    sheetDetail.getRange(sheetDetail.getLastRow() + 1, 1, barisDetailBaru.length, barisDetailBaru[0].length)
      .setValues(barisDetailBaru);

    // Tulis SELURUH kolom stok sekaligus (1 operasi, bukan N setValue) --
    // aman karena dataBarang di atas sudah berisi nilai TERBARU untuk
    // baris yang berubah, dan nilai ASLI (tidak berubah) untuk sisanya.
    const kolomStokBaru = dataBarang.slice(1).map(row => [row[6]]);
    sheetBarang.getRange(2, 7, kolomStokBaru.length, 1).setValues(kolomStokBaru);

    return { success: true, nomorTransaksi: nomorTransaksi, jumlahItem: itemBersih.length };
  } finally {
    lock.releaseLock();
  }
}

/** Riwayat lintas-barang (untuk halaman Riwayat/Laporan umum). */
function getRiwayatStokList(token, params) {
  requireStokAccess_(token);
  params = params || {};

  const transaksiMap = {};
  sheetToObjects(getStokTransaksiSheet()).forEach(t => { transaksiMap[t.ID_TRANSAKSI] = t; });

  let detail = sheetToObjects(getStokDetailSheet());
  if (params.idBarang) detail = detail.filter(d => d.ID_BARANG === params.idBarang);

  let hasil = detail.map(d => {
    const t = transaksiMap[d.ID_TRANSAKSI] || {};
    return {
      tanggal: t.TANGGAL || '',
      nomorTransaksi: d.NOMOR_TRANSAKSI,
      jenis: t.JENIS || '',
      namaBarang: d.NAMA_BARANG,
      jumlah: Number(d.JUMLAH) || 0,
      satuan: d.SATUAN,
      petugas: t.NAMA_PETUGAS || '',
      sumberTujuan: t.SUMBER_TUJUAN || '',
      keterangan: t.KETERANGAN || ''
    };
  });

  if (params.jenis) hasil = hasil.filter(h => h.jenis === params.jenis);
  return hasil.reverse();
}

// ------------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------------

function getStokDashboard(token) {
  requireStokAccess_(token);
  const barang = sheetToObjects(getStokBarangSheet()).filter(b => String(b.AKTIF).toUpperCase() !== 'NONAKTIF');

  let aman = 0, menipis = 0, habis = 0;
  const perluPerhatian = [];
  barang.forEach(b => {
    const stok = Number(b.STOK_SAAT_INI) || 0;
    const minimum = Number(b.STOK_MINIMUM) || 0;
    const status = statusStokBarang_(stok, minimum);
    if (status === 'AMAN') {
      aman++;
    } else {
      if (status === 'MENIPIS') menipis++; else habis++;
      perluPerhatian.push({ id: b.ID_BARANG, nama: b.NAMA_BARANG, stok: stok, satuan: b.SATUAN, minimum: minimum, status: status });
    }
  });
  perluPerhatian.sort((a, b) => (a.status === 'HABIS' ? -1 : 1) - (b.status === 'HABIS' ? -1 : 1));

  const hariIni = formatTanggal(new Date());
  const transaksiHariIni = sheetToObjects(getStokTransaksiSheet()).filter(t => t.TANGGAL === hariIni);

  return {
    totalJenisBarang: barang.length,
    stokAman: aman,
    stokMenipis: menipis,
    stokHabis: habis,
    transaksiMasukHariIni: transaksiHariIni.filter(t => t.JENIS === 'MASUK').length,
    transaksiKeluarHariIni: transaksiHariIni.filter(t => t.JENIS === 'KELUAR').length,
    perluPerhatian: perluPerhatian
  };
}

// ------------------------------------------------------------
// HAK AKSES (Admin menetapkan Petugas Stok)
// ------------------------------------------------------------

function getDaftarPetugasStok(token) {
  requireStokAdmin_(token);
  // PERBAIKAN: sebelumnya baca ROLE_STOK dari 07_AKUN_RELAWAN -- tapi
  // SetupKolomProfil.gs (lihat setupSemuaKolomProfil) menambahkan kolom
  // ROLE_STOK ke 01_DATA_RELAWAN, BUKAN ke 07_AKUN_RELAWAN. Ini yang
  // membuat "Hak Akses" di Admin menampilkan relawan seolah sudah diberi
  // akses (list ini benar, sesuai apa yang DITULIS), tapi relawan yang
  // BENERAN buka SIRAGA tetap ditolak -- karena requireStokAccess_ (lewat
  // getRelawanById) memeriksa kolom ROLE_STOK di sheet yang BERBEDA.
  const usernameMap = {};
  sheetToObjects(getAkunSheet()).forEach(a => { usernameMap[a.ID_RELAWAN] = a.USERNAME; });

  return sheetToObjects(getSheet(NAMA_SHEET.RELAWAN))
    .filter(r => r.ROLE_STOK !== undefined && String(r.ROLE_STOK).toUpperCase() === 'PETUGAS')
    .map(r => ({ idRelawan: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, username: usernameMap[r.ID_RELAWAN] || r.ID_RELAWAN }));
}

function setRoleStok(body) {
  requireStokAdmin_(body.token);
  const idRelawan = sanitize(body.idRelawan);
  const jadikanPetugas = !!body.jadikanPetugas;
  if (!idRelawan) throw new Error('Relawan wajib dipilih.');

  // PERBAIKAN: tulis ke 01_DATA_RELAWAN (sama seperti getDaftarPetugasStok
  // di atas & getRelawanById yang dipakai requireStokAccess_ untuk
  // memeriksa akses) -- BUKAN ke 07_AKUN_RELAWAN seperti sebelumnya.
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxId = headers.indexOf('ID_RELAWAN');
  const idxRole = headers.indexOf('ROLE_STOK');
  if (idxRole === -1) {
    throw new Error('Kolom ROLE_STOK belum ditambahkan di sheet 01_DATA_RELAWAN. Jalankan fungsi setupSemuaKolomProfil (lihat SetupKolomProfil.gs) dulu sekali.');
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === idRelawan) {
      const sebelum = String(data[i][idxRole] || '').toUpperCase() === 'PETUGAS';
      sheet.getRange(i + 1, idxRole + 1).setValue(jadikanPetugas ? 'PETUGAS' : '');
      // BARU (16-18 Okt 2026, Manajemen Hak Akses): sebelumnya perubahan
      // ini TIDAK PERNAH tercatat sama sekali -- ketahuan saat audit utk
      // Tab Riwayat Perubahan. Dicatat ke log audit yg sudah ada.
      logAudit_('UBAH_PETUGAS_STOK', 'HAK_AKSES', idRelawan, requireAuth(body.token), { sebelum: sebelum, sesudah: jadikanPetugas });
      // Invalidasi SEMUA cache yang menyimpan data relawan ini -- termasuk
      // dashboard & profil-nya sendiri, karena akses SIRAGA ikut tampil di sana.
      _invalidasiCacheRelawan_(idRelawan);
      _invalidasiCacheRelawanRow_(idRelawan);
      CacheService.getScriptCache().remove('profil_relawan_' + idRelawan);
      CacheService.getScriptCache().remove('dash_relawan_' + idRelawan);
      return { success: true };
    }
  }
  throw new Error('Relawan tidak ditemukan.');
}


/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * WebsitePublik.gs — CMS ringan untuk konten Website Publik (BARU)
 *
 * Prinsip desain penting:
 * - TIDAK membuat halaman publik baru -- cuma mengisi konten di halaman
 *   yang SUDAH ADA (index.html, profil-sppg.html, kontak.html, dst).
 * - Fallback AMAN: kalau Admin BELUM PERNAH mengisi suatu konten, sheet
 *   ini kosong untuk field itu -- dan JS di sisi Website Publik akan
 *   MEMBIARKAN teks HTML asli tetap tampil (tidak menimpa dengan kosong).
 *   Jadi TIDAK ADA risiko konten "hilang" mendadak sebelum Admin sempat isi.
 * - Sheet baru (26_KONTEN_PUBLIK) -- TIDAK menyentuh data relawan/presensi
 *   existing sama sekali, jadi risiko ke sistem lain sangat rendah.
 *
 * Kolom 26_KONTEN_PUBLIK: ID_KONTEN | HALAMAN | KUNCI | ISI | DIUBAH_PADA | DIUBAH_OLEH
 */

/**
 * Daftar field yang BISA diisi per halaman -- metadata statis (bukan dari
 * sheet), supaya Admin tahu PERSIS apa yang bisa mereka edit. Ini yang
 * mengontrol "Admin dapat melihat bagian yang tersedia" dari brief.
 */
const DAFTAR_HALAMAN_PUBLIK = [
  {
    halaman: 'beranda', label: 'Beranda', file: 'index.html',
    field: [
      { kunci: 'hero_judul', label: 'Judul Hero' },
      { kunci: 'hero_deskripsi', label: 'Deskripsi Hero' }
    ]
  },
  {
    halaman: 'profil-sppg', label: 'Profil SPPG', file: 'profil-sppg.html',
    field: [
      { kunci: 'paragraf_utama', label: 'Paragraf Utama Tentang SPPG' }
    ]
  },
  {
    halaman: 'kontak', label: 'Kontak', file: 'kontak.html',
    field: [
      { kunci: 'alamat', label: 'Alamat' },
      { kunci: 'telepon', label: 'Nomor Telepon/WhatsApp' },
      { kunci: 'email', label: 'Email' },
      { kunci: 'instagram', label: 'Link Instagram' },
      { kunci: 'instagram_username', label: 'Username Instagram (mis. @sppgjeungjing)' },
      { kunci: 'tiktok', label: 'Link TikTok' },
      { kunci: 'tiktok_username', label: 'Username TikTok (mis. @sppgjeungjing)' }
    ]
  },
  {
    halaman: 'informasi-publik', label: 'Informasi Publik', file: 'informasi-publik.html',
    field: [
      { kunci: 'deskripsi_halaman', label: 'Deskripsi Singkat Halaman' }
    ]
  },
  {
    halaman: 'struktur-pimpinan', label: 'Struktur -- Pimpinan', file: 'profil-sppg.html',
    field: [
      { kunci: 'ketua_yayasan', label: 'Ketua Yayasan' },
      { kunci: 'mitra', label: 'Mitra' },
      { kunci: 'ka_sppg', label: 'KA SPPG' },
      { kunci: 'pengawas_gizi', label: 'Pengawas Gizi' },
      { kunci: 'pengawas_keuangan', label: 'Pengawas Keuangan' },
      { kunci: 'asisten_lapangan', label: 'Asisten Lapangan' }
    ]
  },
  {
    halaman: 'struktur-juru-masak', label: 'Struktur -- Juru Masak', file: 'profil-sppg.html',
    field: [
      { kunci: 'koordinator_juru_masak', label: 'Koordinator Juru Masak' }
    ]
  },
  {
    halaman: 'struktur-divisi-persiapan', label: 'Struktur -- Divisi Persiapan', file: 'profil-sppg.html',
    field: [
      { kunci: 'anggota_persiapan_1', label: 'Anggota 1 (Koordinator)' },
      { kunci: 'anggota_persiapan_2', label: 'Anggota 2' },
      { kunci: 'anggota_persiapan_3', label: 'Anggota 3' },
      { kunci: 'anggota_persiapan_4', label: 'Anggota 4' },
      { kunci: 'anggota_persiapan_5', label: 'Anggota 5' },
      { kunci: 'anggota_persiapan_6', label: 'Anggota 6' },
      { kunci: 'anggota_persiapan_7', label: 'Anggota 7' },
      { kunci: 'anggota_persiapan_8', label: 'Anggota 8' },
      { kunci: 'anggota_persiapan_9', label: 'Anggota 9' }
    ]
  },
  {
    halaman: 'struktur-divisi-pengolahan', label: 'Struktur -- Divisi Pengolahan', file: 'profil-sppg.html',
    field: [
      { kunci: 'anggota_pengolahan_1', label: 'Anggota 1 (Koordinator)' },
      { kunci: 'anggota_pengolahan_2', label: 'Anggota 2' },
      { kunci: 'anggota_pengolahan_3', label: 'Anggota 3' },
      { kunci: 'anggota_pengolahan_4', label: 'Anggota 4' },
      { kunci: 'anggota_pengolahan_5', label: 'Anggota 5' },
      { kunci: 'anggota_pengolahan_6', label: 'Anggota 6' },
      { kunci: 'anggota_pengolahan_7', label: 'Anggota 7' },
      { kunci: 'anggota_pengolahan_8', label: 'Anggota 8' }
    ]
  },
  {
    halaman: 'struktur-divisi-pemorsian', label: 'Struktur -- Divisi Pemorsian', file: 'profil-sppg.html',
    field: [
      { kunci: 'anggota_pemorsian_1', label: 'Anggota 1 (Koordinator)' },
      { kunci: 'anggota_pemorsian_2', label: 'Anggota 2' },
      { kunci: 'anggota_pemorsian_3', label: 'Anggota 3' },
      { kunci: 'anggota_pemorsian_4', label: 'Anggota 4' },
      { kunci: 'anggota_pemorsian_5', label: 'Anggota 5' },
      { kunci: 'anggota_pemorsian_6', label: 'Anggota 6' },
      { kunci: 'anggota_pemorsian_7', label: 'Anggota 7' },
      { kunci: 'anggota_pemorsian_8', label: 'Anggota 8' },
      { kunci: 'anggota_pemorsian_9', label: 'Anggota 9' }
    ]
  },
  {
    halaman: 'struktur-lapangan', label: 'Struktur -- Petugas Lapangan', file: 'profil-sppg.html',
    field: [
      { kunci: 'petugas_gudang_1', label: 'Petugas Gudang 1' },
      { kunci: 'admin_lapangan_1', label: 'Admin 1' },
      { kunci: 'security_1', label: 'Security 1' },
      { kunci: 'security_2', label: 'Security 2' },
      { kunci: 'cleaning_service_1', label: 'Cleaning Service 1' }
    ]
  },
  {
    halaman: 'struktur-distribusi', label: 'Struktur -- Divisi Distribusi', file: 'profil-sppg.html',
    field: [
      { kunci: 'anggota_distribusi_1', label: 'Anggota 1' },
      { kunci: 'anggota_distribusi_2', label: 'Anggota 2' },
      { kunci: 'anggota_distribusi_3', label: 'Anggota 3' },
      { kunci: 'anggota_distribusi_4', label: 'Anggota 4' }
    ]
  },
  {
    halaman: 'struktur-cuci-ompreng', label: 'Struktur -- Divisi Cuci Ompreng', file: 'profil-sppg.html',
    field: [
      { kunci: 'anggota_cuci_1', label: 'Anggota 1 (Koordinator)' },
      { kunci: 'anggota_cuci_2', label: 'Anggota 2' },
      { kunci: 'anggota_cuci_3', label: 'Anggota 3' },
      { kunci: 'anggota_cuci_4', label: 'Anggota 4' },
      { kunci: 'anggota_cuci_5', label: 'Anggota 5' },
      { kunci: 'anggota_cuci_6', label: 'Anggota 6' },
      { kunci: 'anggota_cuci_7', label: 'Anggota 7' },
      { kunci: 'anggota_cuci_8', label: 'Anggota 8' },
      { kunci: 'anggota_cuci_9', label: 'Anggota 9' },
      { kunci: 'anggota_cuci_10', label: 'Anggota 10' },
      { kunci: 'anggota_cuci_11', label: 'Anggota 11' }
    ]
  }
];

function getKontenPublikSheet_() { return getSheet(NAMA_SHEET.KONTEN_PUBLIK); }

/**
 * MENU WEBSITE (bagian AI) — atur nama/urutan/status aktif-nonaktif menu
 * navigasi Website Publik. Sheet baru: 28_MENU_WEBSITE.
 * CATATAN: tombol "Portal SPPG Jeungjing →" SENGAJA TIDAK masuk daftar
 * yang bisa diatur -- itu akses kritis dari Website Publik ke Portal,
 * tidak boleh hilang/diubah tidak sengaja oleh Admin.
 */
function getMenuWebsiteSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('28_MENU_WEBSITE');
  if (!sheet) {
    // Self-healing: buat sheet + isi PERSIS 6 menu yang sudah ada di HTML
    // sekarang (tidak mengarang menu baru, tidak menghapus yang ada).
    sheet = ss.insertSheet('28_MENU_WEBSITE');
    sheet.getRange(1, 1, 1, 5).setValues([['ID', 'LABEL', 'HALAMAN', 'URUTAN', 'AKTIF']]);
    sheet.getRange(2, 1, 6, 5).setValues([
      ['MN001', 'Beranda', 'index.html', 1, 'AKTIF'],
      ['MN002', 'Profil SPPG', 'profil-sppg.html', 2, 'AKTIF'],
      ['MN003', 'Penerima Manfaat', 'penerima-manfaat.html', 3, 'AKTIF'],
      ['MN004', 'Menu Hari Ini', 'menu-hari-ini.html', 4, 'AKTIF'],
      ['MN005', 'Informasi', 'informasi-publik.html', 5, 'AKTIF'],
      ['MN006', 'Kontak', 'kontak.html', 6, 'AKTIF']
    ]);
  }
  return sheet;
}

/** DIPANGGIL DARI WEBSITE PUBLIK -- tanpa requireAuth, cuma baca menu AKTIF terurut. */
function getMenuWebsitePublik() {
  return sheetToObjects(getMenuWebsiteSheet_())
    .filter(m => String(m.AKTIF).toUpperCase() !== 'NONAKTIF')
    .sort((a, b) => (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0))
    .map(m => ({ label: m.LABEL, halaman: m.HALAMAN }));
}

function getMenuWebsiteAdmin(token) {
  requireAuth(token);
  return sheetToObjects(getMenuWebsiteSheet_())
    .sort((a, b) => (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0))
    .map(m => ({ id: m.ID, label: m.LABEL, halaman: m.HALAMAN, urutan: m.URUTAN, aktif: String(m.AKTIF).toUpperCase() !== 'NONAKTIF' }));
}

/** Update SEKALIGUS (label/urutan/aktif) untuk 1 menu -- dipanggil per-baris dari tabel Admin, bukan drag&drop. */
function updateMenuWebsite(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'MENU_HARIAN', 'EDIT');
  const id = sanitize(body.id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getMenuWebsiteSheet_();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        if (body.label !== undefined) sheet.getRange(i + 1, 2).setValue(sanitize(body.label));
        if (body.urutan !== undefined) sheet.getRange(i + 1, 4).setValue(Number(body.urutan) || 0);
        if (body.aktif !== undefined) sheet.getRange(i + 1, 5).setValue(body.aktif ? 'AKTIF' : 'NONAKTIF');
        logAudit_('UBAH_MENU_WEBSITE', 'WEBSITE_PUBLIK', id, akses, body);
        return { success: true };
      }
    }
    throw new Error('Menu tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * DATA PENERIMAAN WEBSITE (bagian AH) — beda dari getKontenPublik/setKontenPublik
 * di atas (yang untuk TEKS per field), ini untuk DATA BER-DAFTAR (banyak baris,
 * masing-masing bisa ditambah/diubah/dihapus/aktif-nonaktifkan sendiri).
 * Sheet baru: 27_DATA_PENERIMAAN | ID | KATEGORI | JUMLAH | KETERANGAN | AKTIF | URUTAN
 */
function getDataPenerimaanSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('27_DATA_PENERIMAAN');
  if (!sheet) {
    // Self-healing: buat sheet + isi 4 kategori awal PERSIS yang sudah
    // ada di HTML Website Publik (Peserta Didik/Ibu Hamil/Ibu Menyusui/
    // Balita) -- supaya tidak menghapus/mengarang struktur yang sudah ada.
    sheet = ss.insertSheet('27_DATA_PENERIMAAN');
    sheet.getRange(1, 1, 1, 6).setValues([['ID', 'KATEGORI', 'JUMLAH', 'KETERANGAN', 'AKTIF', 'URUTAN']]);
    sheet.getRange(2, 1, 4, 6).setValues([
      ['DP001', 'Peserta Didik', 0, '', 'AKTIF', 1],
      ['DP002', 'Ibu Hamil', 0, '', 'AKTIF', 2],
      ['DP003', 'Ibu Menyusui', 0, '', 'AKTIF', 3],
      ['DP004', 'Balita', 0, '', 'AKTIF', 4]
    ]);
  }
  return sheet;
}

/** DIPANGGIL DARI WEBSITE PUBLIK -- tanpa requireAuth, cuma baca item AKTIF. */
function getDataPenerimaanPublik() {
  return sheetToObjects(getDataPenerimaanSheet_())
    .filter(d => String(d.AKTIF).toUpperCase() !== 'NONAKTIF')
    .sort((a, b) => (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0))
    .map(d => ({ kategori: d.KATEGORI, jumlah: d.JUMLAH, keterangan: d.KETERANGAN }));
}

function getDataPenerimaanAdmin(token) {
  requireAuth(token);
  return sheetToObjects(getDataPenerimaanSheet_())
    .sort((a, b) => (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0))
    .map(d => ({ id: d.ID, kategori: d.KATEGORI, jumlah: d.JUMLAH, keterangan: d.KETERANGAN, aktif: String(d.AKTIF).toUpperCase() !== 'NONAKTIF' }));
}

function addDataPenerimaan(body) {
  const akses = requireAuth(body.token);
  const kategori = sanitize(body.kategori);
  if (!kategori) throw new Error('Kategori wajib diisi.');
  const lock = LockService.getScriptLock(); // P2 -- maxId dihitung lalu +1, rawan sama spt kasus Akun.gs/PenerimaManfaat.gs
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getDataPenerimaanSheet_();
    const data = sheet.getDataRange().getValues();
    let maxId = 0, maxUrutan = 0;
    for (let i = 1; i < data.length; i++) {
      const m = String(data[i][0] || '').match(/^DP(\d+)$/);
      if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
      maxUrutan = Math.max(maxUrutan, Number(data[i][5]) || 0);
    }
    const idBaru = 'DP' + String(maxId + 1).padStart(3, '0');
    sheet.appendRow([idBaru, kategori, Number(body.jumlah) || 0, sanitize(body.keterangan), 'AKTIF', maxUrutan + 1]);
    logAudit_('TAMBAH_DATA_PENERIMAAN', 'WEBSITE_PUBLIK', idBaru, akses, { kategori: kategori });
    return { success: true, id: idBaru };
  } finally {
    lock.releaseLock();
  }
}

function updateDataPenerimaan(body) {
  const akses = requireAuth(body.token);
  const id = sanitize(body.id);
  const lock1 = LockService.getScriptLock();
  if (!lock1.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getDataPenerimaanSheet_();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        if (body.kategori !== undefined) sheet.getRange(i + 1, 2).setValue(sanitize(body.kategori));
        if (body.jumlah !== undefined) sheet.getRange(i + 1, 3).setValue(Number(body.jumlah) || 0);
        if (body.keterangan !== undefined) sheet.getRange(i + 1, 4).setValue(sanitize(body.keterangan));
        logAudit_('UBAH_DATA_PENERIMAAN', 'WEBSITE_PUBLIK', id, akses, body);
        return { success: true };
      }
    }
    throw new Error('Data Penerimaan tidak ditemukan.');
  } finally {
    lock1.releaseLock();
  }
}

function toggleAktifDataPenerimaan(body) {
  const akses = requireAuth(body.token);
  const id = sanitize(body.id);
  const lock2 = LockService.getScriptLock();
  if (!lock2.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getDataPenerimaanSheet_();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        const statusBaru = body.aktif ? 'AKTIF' : 'NONAKTIF';
        sheet.getRange(i + 1, 5).setValue(statusBaru);
        logAudit_('SET_STATUS_DATA_PENERIMAAN', 'WEBSITE_PUBLIK', id, akses, { status: statusBaru });
        return { success: true };
      }
    }
    throw new Error('Data Penerimaan tidak ditemukan.');
  } finally {
    lock2.releaseLock();
  }
}

function deleteDataPenerimaan(body) {
  const akses = requireAuth(body.token);
  const id = sanitize(body.id);
  const lock3 = LockService.getScriptLock();
  if (!lock3.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getDataPenerimaanSheet_();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        sheet.deleteRow(i + 1);
        logAudit_('HAPUS_DATA_PENERIMAAN', 'WEBSITE_PUBLIK', id, akses, {});
        return { success: true };
      }
    }
    throw new Error('Data Penerimaan tidak ditemukan.');
  } finally {
    lock3.releaseLock();
  }
}

/**
 * DIPANGGIL DARI WEBSITE PUBLIK -- TANPA requireAuth (publik, tidak ada
 * login di sana). Return object {kunci: isi} untuk 1 halaman. Kunci yang
 * belum pernah diisi TIDAK ADA di object ini (bukan string kosong) --
 * supaya JS Website Publik bisa bedakan "belum diisi" vs "sengaja dikosongkan".
 */
/**
 * PERBAIKAN BUG: sebelumnya fungsi ini HANYA membaca 1 "halaman" pada
 * satu waktu (kecocokan persis) -- tapi 1 file HTML publik (mis.
 * profil-sppg.html) ternyata dipecah jadi BEBERAPA "halaman" berbeda di
 * DAFTAR_HALAMAN_PUBLIK (profil-sppg, struktur-pimpinan,
 * struktur-juru-masak, struktur-divisi-persiapan, dst -- total 9 untuk
 * profil-sppg.html saja). Halaman publiknya sendiri cuma mengirim SATU
 * nilai data-halaman-publik (\"profil-sppg\") lewat public-konten.js, jadi
 * 8 \"halaman\" LAIN yang memuat data Struktur Personel TIDAK PERNAH ikut
 * terbaca -- apa pun yang Admin simpan di sana (nama-nama di halaman
 * "Struktur -- Divisi ...") tidak pernah sampai ke tampilan publik,
 * walau tersimpan dengan benar di balik layar.
 *
 * Sekarang: begitu `halaman` yang diminta cocok dengan salah satu entri
 * DAFTAR_HALAMAN_PUBLIK, GABUNGKAN juga isi dari SEMUA entri lain yang
 * menunjuk ke FILE HTML yang SAMA -- jadi 1 permintaan dari 1 halaman
 * publik otomatis membawa SEMUA konten yang memang tampil di situ, tanpa
 * perlu mengubah halaman publik (public-konten.js/HTML) sama sekali.
 * Untuk halaman lain yang cuma py 1 mapping (Kontak, Informasi, Beranda)
 * hasilnya PERSIS SAMA seperti sebelumnya -- tidak ada perubahan perilaku.
 */
function getKontenPublik(halaman) {
  const entriDiminta = DAFTAR_HALAMAN_PUBLIK.find(h => h.halaman === halaman);
  const fileTarget = entriDiminta ? entriDiminta.file : null;
  const halamanTerkait = fileTarget
    ? DAFTAR_HALAMAN_PUBLIK.filter(h => h.file === fileTarget).map(h => h.halaman)
    : [halaman]; // halaman tidak dikenal di DAFTAR_HALAMAN_PUBLIK -- fallback ke perilaku lama (cocok persis)

  const semua = sheetToObjects(getKontenPublikSheet_());
  const hasil = {};
  semua.filter(k => halamanTerkait.indexOf(k.HALAMAN) !== -1 && k.ISI !== '' && k.ISI !== undefined && k.ISI !== null)
    .forEach(k => { hasil[k.KUNCI] = k.ISI; });
  return hasil;
}

/** Untuk Admin: daftar halaman+field (metadata) DIGABUNG isi yang sudah tersimpan. */
function getSemuaKontenPublikAdmin(token) {
  requireAuth(token);
  const semuaIsi = sheetToObjects(getKontenPublikSheet_());
  const isiById = {};
  semuaIsi.forEach(k => { isiById[k.HALAMAN + '::' + k.KUNCI] = k.ISI; });

  return DAFTAR_HALAMAN_PUBLIK.map(h => ({
    halaman: h.halaman, label: h.label, file: h.file,
    field: h.field.map(f => ({
      kunci: f.kunci, label: f.label,
      isi: isiById[h.halaman + '::' + f.kunci] || ''
    }))
  }));
}

function setKontenPublik(body) {
  const akses = requireAuth(body.token);
  const halaman = sanitize(body.halaman);
  const kunci = sanitize(body.kunci);
  const isi = sanitize(body.isi);
  if (!halaman || !kunci) throw new Error('Halaman dan kunci konten wajib diisi.');

  const halamanValid = DAFTAR_HALAMAN_PUBLIK.find(h => h.halaman === halaman);
  if (!halamanValid || !halamanValid.field.some(f => f.kunci === kunci)) {
    throw new Error('Kombinasi halaman/kunci konten tidak dikenali.');
  }

  const lock = LockService.getScriptLock(); // P2 -- cek baris ada/tidak lalu tulis/tambah; idKonten juga dihitung dari data.length
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getKontenPublikSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idxHalaman = headers.indexOf('HALAMAN');
    const idxKunci = headers.indexOf('KUNCI');
    const idxIsi = headers.indexOf('ISI');
    const idxDiubah = headers.indexOf('DIUBAH_PADA');
    const idxOleh = headers.indexOf('DIUBAH_OLEH');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idxHalaman] === halaman && data[i][idxKunci] === kunci) {
        sheet.getRange(i + 1, idxIsi + 1).setValue(isi);
        sheet.getRange(i + 1, idxDiubah + 1).setValue(new Date());
        sheet.getRange(i + 1, idxOleh + 1).setValue(akses);
        logAudit_('UBAH_KONTEN_PUBLIK', 'WEBSITE_PUBLIK', halaman + '/' + kunci, akses, { isi: isi });
        return { success: true };
      }
    }
    // Belum ada baris untuk kombinasi ini -- tambah baru.
    const idKonten = 'KP' + String(data.length).padStart(5, '0');
    sheet.appendRow([idKonten, halaman, kunci, isi, new Date(), akses]);
    logAudit_('UBAH_KONTEN_PUBLIK', 'WEBSITE_PUBLIK', halaman + '/' + kunci, akses, { isi: isi, baru: true });
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * MENU HARI INI (bagian BARU) — menu makanan harian + kandungan gizi per
 * kategori porsi, ditampilkan di menu-hari-ini.html (halaman publik ini
 * SUDAH ADA sebelumnya sebagai contoh statis -- lihat catatan di HTML-nya
 * sendiri: "beri tahu saya kapan pun siap"). Sheet baru: 29_MENU_HARIAN_PUBLIK,
 * TIDAK menyentuh data relawan/presensi/SIPANDU yang sudah ada sama sekali.
 *
 * Kolom: ID | TANGGAL | TANGGAL_ISO | HARI | MENU | KOMPOSISI |
 *   lalu utk tiap kategori (KECIL, BESAR, BALITA, BUMIL, BUSUI):
 *   KKAL_<kategori> | PROTEIN_<kategori> | LEMAK_<kategori> | KARBO_<kategori> | SERAT_<kategori>
 *   | AKTIF | DIBUAT_PADA | DIBUAT_OLEH
 *
 * Nilai gizi disimpan APA ADANYA sebagai teks persis seperti diketik Admin
 * (mis. "525,85") -- BUKAN dikonversi ke angka -- supaya format koma-desimal
 * ala Indonesia yang dipakai Admin tidak pernah berubah/salah bulat saat
 * ditampilkan lagi. TANGGAL_ISO (YYYY-MM-DD, auto) cuma dipakai internal utk
 * sortir "menu terbaru", tidak ditampilkan ke siapa pun.
 */
const KATEGORI_MENU_HARIAN = ['kecil', 'besar', 'balita', 'bumil', 'busui'];
const GIZI_MENU_HARIAN = ['kkal', 'protein', 'lemak', 'karbo', 'serat'];

function getMenuHarianSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('29_MENU_HARIAN_PUBLIK');
  if (!sheet) {
    const header = ['ID', 'TANGGAL', 'TANGGAL_ISO', 'HARI', 'MENU', 'KOMPOSISI'];
    KATEGORI_MENU_HARIAN.forEach(kat => {
      GIZI_MENU_HARIAN.forEach(g => { header.push((g + '_' + kat).toUpperCase()); });
    });
    header.push('AKTIF', 'DIBUAT_PADA', 'DIBUAT_OLEH', 'RAW_TEXT');
    sheet = ss.insertSheet('29_MENU_HARIAN_PUBLIK');
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
  // BARU: RAW_TEXT (teks asli yang ditempel Admin) -- sheet yang SUDAH ADA
  // dari sebelumnya (dibuat sebelum kolom ini ada) tidak akan punya kolom
  // ini, jadi ditambahkan otomatis di sini kalau belum ada (mekanisme yang
  // sudah dipakai aman di modul lain -- cuma menambah, tidak pernah
  // mengubah/menghapus kolom yang sudah ada).
  tambahKolomJikaBelumAda_('29_MENU_HARIAN_PUBLIK', ['RAW_TEXT']);
  return sheet;
}

/** "DD/MM/YY" atau "DD/MM/YYYY" -> "YYYY-MM-DD" (utk sortir internal saja). Tidak melempar error kalau formatnya tak terduga -- kembalikan '' supaya tetap tersimpan meski tak bisa disortir sempurna. */
function tanggalKeIso_(tanggal) {
  const m = String(tanggal || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return '';
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
  return yyyy + '-' + mm + '-' + dd;
}

/** Ubah 1 baris sheet (array nilai + header) jadi object bersarang per-kategori, dipakai admin & publik. tanggalIso ikut disertakan (dipakai getMenuHarianListAdmin utk sortir "terbaru dulu"). */
function barisMenuHarianKeObjek_(headers, baris) {
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  const hasil = {
    id: baris[idx.ID],
    tanggal: baris[idx.TANGGAL],
    tanggalIso: baris[idx.TANGGAL_ISO],
    hari: baris[idx.HARI],
    menu: baris[idx.MENU],
    komposisi: baris[idx.KOMPOSISI],
    aktif: String(baris[idx.AKTIF]).toUpperCase() !== 'NONAKTIF',
    rawText: idx.RAW_TEXT !== undefined ? String(baris[idx.RAW_TEXT] || '') : '',
    gizi: {}
  };
  KATEGORI_MENU_HARIAN.forEach(kat => {
    hasil.gizi[kat] = {};
    GIZI_MENU_HARIAN.forEach(g => {
      hasil.gizi[kat][g] = String(baris[idx[(g + '_' + kat).toUpperCase()]] || '');
    });
  });
  return hasil;
}

/**
 * PARSER OTOMATIS (backend, otoritatif) -- diporting PERSIS dari logika
 * client-side yang sudah terbukti jalan di Admin (baca_TeksMenuHarian_ di
 * admin-website-publik.js), supaya hasil Preview (client) dan hasil
 * Simpan (backend) SELALU konsisten. Backend TIDAK PERNAH mempercayai
 * field yang sudah diparse dari frontend -- ini SATU-SATUNYA sumber
 * kebenaran saat data ditulis ke Sheet.
 *
 * Toleran huruf besar/kecil & spasi, tidak gagal total kalau sebagian
 * baris tidak dikenali -- kembalikan { data, peringatan } supaya
 * pemanggil (simpan/update) bisa tetap menyimpan dengan warning, bukan
 * menolak seluruhnya (sesuai instruksi: jangan bikin blank, kasih tahu
 * bagian mana yang gagal terbaca).
 */
function parseTeksMenuHarian_(teks) {
  const hasil = { tanggal: '', hari: '', menu: '', komposisi: '', gizi: {} };
  const peringatan = [];
  const baris = String(teks || '').split('\n').map(b => b.trim()).filter(Boolean);

  if (!baris.length) {
    return { data: hasil, peringatan: ['Teks kosong -- tidak ada yang bisa dibaca.'] };
  }

  let adaGiziTerbaca = false;
  const kategoriDitemukan = {};

  baris.forEach(b => {
    let m;
    if ((m = b.match(/Data Menu Hari\s+([A-Za-z]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i))) {
      hasil.hari = m[1];
      hasil.tanggal = m[2];
      return;
    }
    if (/^menu\s*:/i.test(b)) { hasil.menu = b.replace(/^menu\s*:/i, '').trim(); return; }
    if (/^komposisi\s*:/i.test(b)) { hasil.komposisi = b.replace(/^komposisi\s*:/i, '').trim(); return; }

    const mKat = b.match(/^-?\s*(Porsi\s+kecil|Porsi\s+besar|Balita|Ibu\s+hamil|Ibu\s+menyusui)\s*:\s*(.*)$/i);
    if (mKat) {
      const namaKat = mKat[1].toLowerCase().replace(/\s+/g, ' ');
      const kunciKat = namaKat.indexOf('kecil') !== -1 ? 'kecil'
        : namaKat.indexOf('besar') !== -1 ? 'besar'
        : namaKat.indexOf('balita') !== -1 ? 'balita'
        : namaKat.indexOf('hamil') !== -1 ? 'bumil'
        : namaKat.indexOf('menyusui') !== -1 ? 'busui' : null;
      if (!kunciKat) return;
      kategoriDitemukan[kunciKat] = true;
      const bagian = mKat[2].split('|').map(s => s.trim());
      const urutanGizi = ['kkal', 'protein', 'lemak', 'karbo', 'serat'];
      const nilai = {};
      let adaAngkaDiBarisIni = false;
      bagian.forEach((s, i) => {
        // Angka format Indonesia (koma desimal) DIPERTAHANKAN APA ADANYA
        // sebagai teks -- "525,85" tetap "525,85", TIDAK pernah dikonversi
        // ke Number (yang akan merusak koma desimal ala Indonesia).
        const mAngka = s.match(/^([\d.,]+)/);
        if (mAngka && urutanGizi[i]) { nilai[urutanGizi[i]] = mAngka[1]; adaGiziTerbaca = true; adaAngkaDiBarisIni = true; }
      });
      if (!adaAngkaDiBarisIni) peringatan.push('Data gizi "' + mKat[1] + '" ditemukan tapi tidak ada angka yang terbaca.');
      hasil.gizi[kunciKat] = nilai;
    }
  });

  if (!hasil.tanggal) peringatan.push('Baris "Data Menu Hari [Hari] [Tanggal]" tidak ditemukan/tidak terbaca -- tanggal & hari perlu diisi manual.');
  if (!hasil.menu) peringatan.push('Baris "Menu:" tidak ditemukan/tidak terbaca.');
  if (!hasil.komposisi) peringatan.push('Baris "Komposisi:" tidak ditemukan/tidak terbaca.');
  ['kecil', 'besar', 'balita', 'bumil', 'busui'].forEach(k => {
    if (!kategoriDitemukan[k]) peringatan.push('Data gizi kategori "' + k + '" tidak ditemukan di teks.');
  });

  return { data: hasil, peringatan: peringatan, berhasil: !!(hasil.tanggal || hasil.menu || adaGiziTerbaca) };
}

/** DIPANGGIL DARI WEBSITE PUBLIK -- tanpa requireAuth. Ambil entri AKTIF dengan TANGGAL_ISO terbesar (menu paling baru diinput -- dalam praktiknya = menu hari ini, tanpa perlu pas 100% sama tanggal kalender kalau Admin telat input beberapa jam). Null kalau belum pernah ada entri sama sekali. */
function getMenuHarianTerbaruPublik() {
  const sheet = getMenuHarianSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  const headers = data[0].map(h => String(h).trim());
  const idxIso = headers.indexOf('TANGGAL_ISO');
  const idxAktif = headers.indexOf('AKTIF');

  let terbaru = null, isoTerbaru = '';
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxAktif]).toUpperCase() === 'NONAKTIF') continue;
    const iso = String(data[i][idxIso] || '');
    if (iso >= isoTerbaru) { isoTerbaru = iso; terbaru = data[i]; }
  }
  return terbaru ? barisMenuHarianKeObjek_(headers, terbaru) : null;
}

/**
 * BARU -- dipakai khusus oleh halaman publik /menu-hari-ini (redesign +
 * QR Code label ompreng). BEDA dari getMenuHarianTerbaruPublik (yang
 * mengambil entri PALING BARU tanpa peduli tanggalnya persis hari ini):
 * fungsi ini HANYA mencocokkan TANGGAL_ISO dengan tanggal HARI INI
 * (server, zona waktu proyek) -- kalau Admin belum input menu utk hari
 * ini secara spesifik, kembalikan null (halaman publik menampilkan
 * "belum tersedia", BUKAN menu kemarin), sesuai instruksi.
 *
 * getMenuHarianTerbaruPublik() TIDAK diubah/dihapus -- masih ada utk
 * kalau ke depannya dibutuhkan lagi, tidak ada yang bergantung ke fungsi
 * ini selain halaman publik yang baru.
 */
/**
 * Perbaikan 16 Okt 2026 (diminta Admin): SEKARANG membaca dari database
 * Siklus Menu eksternal (SiklusMenu.gs, getMenuHariIniSiklus_) --
 * SEBELUMNYA dari sheet "Menu Harian" Portal sendiri (manual per
 * kategori porsi: kecil/besar/balita/bumil/busui). Siklus Menu cuma
 * punya SATU set menu per hari (sama utk semua kategori) -- lebih
 * simpel, sesuai keputusan Admin.
 *
 * CATATAN JUJUR: saya TIDAK melihat kode frontend Website Publik yang
 * sebenarnya (proyek terpisah), jadi saya TIDAK bisa pastikan field apa
 * saja yg benar-benar dipakai di sana. Field LAMA (id/tanggal/hari/aktif/
 * menu/komposisi) dipertahankan dgn NILAI YANG MASUK AKAL (menu/komposisi
 * disusun dari field baru) supaya tampilan TIDAK rusak total kalau
 * frontend lama masih membaca field itu -- tapi field "gizi" (rincian
 * per kategori porsi) TIDAK ADA LAGI, krn Siklus Menu memang tidak
 * membedakan itu. Field BARU (karbohidrat/laukHewani/dst) ditambahkan
 * sbg sumber yang lebih akurat & sederhana utk frontend yg diperbarui.
 * MOHON VERIFIKASI tampilan Website Publik yang sebenarnya setelah
 * deploy -- kalau masih ada bagian yang rusak/kosong, itu tandanya
 * frontend-nya butuh disesuaikan juga (kirim kodenya, saya bantu).
 */
function getMenuHariIniPublik() {
  let m;
  try {
    m = getMenuHariIniTerpadu_();   // 4 Nov 2026: menu disetujui di SIPANDU baru lebih dulu, lalu Siklus Menu (cara lama)
  } catch (e) {
    return null; // sheet Siklus Menu tidak bisa diakses -- jangan error ke publik, tampilkan kosong
  }
  if (!m) return null;

  const daftarMenu = [m.karbohidrat, m.laukHewani, m.laukNabati, m.sayur, m.buah, m.pelengkap].filter(Boolean);

  return {
    id: 'SIKLUS-' + m.tanggal,
    tanggal: m.tanggal,
    tanggalIso: m.tanggal,
    hari: m.hari,
    aktif: true,
    menu: daftarMenu.join(', '), // ringkasan teks, utk frontend lama yg mengharapkan 1 string
    komposisi: m.tema || '',
    // Field BARU, lebih akurat -- disarankan dipakai kalau frontend diperbarui:
    karbohidrat: m.karbohidrat, laukHewani: m.laukHewani, laukNabati: m.laukNabati,
    sayur: m.sayur, buah: m.buah, pelengkap: m.pelengkap, tema: m.tema
  };
}

function getMenuHarianListAdmin(token) {
  requireAuth(token);
  const sheet = getMenuHarianSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .map(baris => barisMenuHarianKeObjek_(headers, baris))
    .sort((a, b) => String(b.tanggalIso || '').localeCompare(String(a.tanggalIso || '')));
}

/**
 * Simpan entri Menu Hari Ini baru. SUMBER UTAMA sekarang body.rawText (teks
 * yang ditempel Admin) -- backend mem-parse SENDIRI (parseTeksMenuHarian_),
 * TIDAK mempercayai field menu/komposisi/gizi kalau dikirim terpisah dari
 * frontend. body.tanggal/body.hari opsional -- kalau diisi, MENANG atas
 * hasil parsing (form Admin tetap punya input Tanggal/Hari terpisah);
 * kalau kosong, diambil dari baris "Data Menu Hari ..." di dalam teks.
 * RAW_TEXT SELALU disimpan apa adanya, walau sebagian parsing gagal.
 */
function simpanMenuHarianPublik(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'MENU_HARIAN', 'CREATE');
  const rawText = sanitize(body.rawText);
  if (!rawText) throw new Error('Teks menu wajib diisi.');

  const hasilParse = parseTeksMenuHarian_(rawText);
  const hasil = hasilParse.data;
  const tanggal = sanitize(body.tanggal) || hasil.tanggal;
  const hari = sanitize(body.hari) || hasil.hari;
  if (!tanggal) throw new Error('Tanggal wajib diisi (manual atau lewat baris "Data Menu Hari ...").');

  const lock = LockService.getScriptLock(); // P2 -- maxId dihitung lalu +1, pola sama spt fungsi lain yg terbukti rawan
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getMenuHarianSheet_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      const m = String(data[i][idx.ID] || '').match(/^MH(\d+)$/);
      if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
    }
    const idBaru = 'MH' + String(maxId + 1).padStart(4, '0');

    const baris = new Array(sheet.getLastColumn()).fill('');
    baris[idx.ID] = idBaru;
    baris[idx.TANGGAL] = tanggal;
    baris[idx.TANGGAL_ISO] = tanggalKeIso_(tanggal);
    baris[idx.HARI] = hari;
    baris[idx.MENU] = hasil.menu;
    baris[idx.KOMPOSISI] = hasil.komposisi;
    KATEGORI_MENU_HARIAN.forEach(kat => {
      GIZI_MENU_HARIAN.forEach(g => {
        baris[idx[(g + '_' + kat).toUpperCase()]] = (hasil.gizi[kat] && hasil.gizi[kat][g]) || '';
      });
    });
    baris[idx.AKTIF] = 'AKTIF';
    baris[idx.DIBUAT_PADA] = new Date();
    baris[idx.DIBUAT_OLEH] = akses;
    baris[idx.RAW_TEXT] = rawText;

    sheet.appendRow(baris);
    logAudit_('TAMBAH_MENU_HARIAN', 'WEBSITE_PUBLIK', idBaru, akses, { tanggal: tanggal });
    return { success: true, id: idBaru, peringatan: hasilParse.peringatan };
  } finally {
    lock.releaseLock();
  }
}

/** Sama seperti simpanMenuHarianPublik tapi UBAH baris yang sudah ada (body.id wajib). Field yang tidak dikirim (undefined) TIDAK diubah. body.rawText (kalau dikirim) di-parse ulang sepenuhnya -- SEMUA field turunan (menu/komposisi/gizi) ikut diperbarui dari teks baru itu, bukan digabung dengan nilai lama. */
function updateMenuHarianPublik(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'MENU_HARIAN', 'EDIT');
  const id = sanitize(body.id);
  if (!id) throw new Error('ID menu wajib diisi.');

  const lockU = LockService.getScriptLock();
  if (!lockU.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getMenuHarianSheet_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();

    let hasilParse = null;
    if (body.rawText !== undefined && sanitize(body.rawText)) {
      hasilParse = parseTeksMenuHarian_(sanitize(body.rawText));
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID]) !== id) continue;
      const baris = i + 1;
      const tanggalBaru = sanitize(body.tanggal) || (hasilParse && hasilParse.data.tanggal) || undefined;
      const hariBaru = sanitize(body.hari) || (hasilParse && hasilParse.data.hari) || undefined;
      if (tanggalBaru) {
        sheet.getRange(baris, idx.TANGGAL + 1).setValue(tanggalBaru);
        sheet.getRange(baris, idx.TANGGAL_ISO + 1).setValue(tanggalKeIso_(tanggalBaru));
      }
      if (hariBaru) sheet.getRange(baris, idx.HARI + 1).setValue(hariBaru);

      if (hasilParse) {
        sheet.getRange(baris, idx.MENU + 1).setValue(hasilParse.data.menu);
        sheet.getRange(baris, idx.KOMPOSISI + 1).setValue(hasilParse.data.komposisi);
        KATEGORI_MENU_HARIAN.forEach(kat => {
          GIZI_MENU_HARIAN.forEach(g => {
            sheet.getRange(baris, idx[(g + '_' + kat).toUpperCase()] + 1).setValue((hasilParse.data.gizi[kat] && hasilParse.data.gizi[kat][g]) || '');
          });
        });
        sheet.getRange(baris, idx.RAW_TEXT + 1).setValue(sanitize(body.rawText));
      } else {
        if (body.menu !== undefined) sheet.getRange(baris, idx.MENU + 1).setValue(sanitize(body.menu));
        if (body.komposisi !== undefined) sheet.getRange(baris, idx.KOMPOSISI + 1).setValue(sanitize(body.komposisi));
        const gizi = body.gizi || {};
        KATEGORI_MENU_HARIAN.forEach(kat => {
          if (!gizi[kat]) return;
          GIZI_MENU_HARIAN.forEach(g => {
            if (gizi[kat][g] === undefined) return;
            sheet.getRange(baris, idx[(g + '_' + kat).toUpperCase()] + 1).setValue(sanitize(gizi[kat][g]));
          });
        });
      }
      logAudit_('UBAH_MENU_HARIAN', 'WEBSITE_PUBLIK', id, akses, {});
      return { success: true, peringatan: hasilParse ? hasilParse.peringatan : [] };
    }
    throw new Error('Menu Hari Ini tidak ditemukan.');
  } finally {
    lockU.releaseLock();
  }
}

function toggleAktifMenuHarianPublik(body) {
  const akses = requireAuth(body.token);
  const id = sanitize(body.id);
  const lockT = LockService.getScriptLock();
  if (!lockT.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getMenuHarianSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idxAktif = headers.indexOf('AKTIF');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        const statusBaru = body.aktif ? 'AKTIF' : 'NONAKTIF';
        sheet.getRange(i + 1, idxAktif + 1).setValue(statusBaru);
        logAudit_('SET_STATUS_MENU_HARIAN', 'WEBSITE_PUBLIK', id, akses, { status: statusBaru });
        return { success: true };
      }
    }
    throw new Error('Menu Hari Ini tidak ditemukan.');
  } finally {
    lockT.releaseLock();
  }
}

function deleteMenuHarianPublik(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'MENU_HARIAN', 'DELETE');
  const id = sanitize(body.id);
  const lockD = LockService.getScriptLock();
  if (!lockD.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getMenuHarianSheet_();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        sheet.deleteRow(i + 1);
        logAudit_('HAPUS_MENU_HARIAN', 'WEBSITE_PUBLIK', id, akses, {});
        return { success: true };
      }
    }
    throw new Error('Menu Hari Ini tidak ditemukan.');
  } finally {
    lockD.releaseLock();
  }
}


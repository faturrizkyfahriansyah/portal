/**
 * ManajemenHakAkses.gs — Fondasi sistem Role x Modul x Izin yang
 * SUNGGUHAN (16-18 Okt 2026, proyek besar disetujui Admin berdasarkan
 * prompt+wireframe yang dikirim). File BARU, terpisah dari kode lama --
 * TIDAK mengubah fungsi/otorisasi yang sudah berjalan, cuma MENAMBAH.
 *
 * KEPUTUSAN DIDOKUMENTASIKAN (audit sebelum coding, sesuai permintaan
 * dokumen): sistem lama TIDAK punya matriks izin granular -- otorisasi
 * selama ini di-hardcode per fungsi (requireAuth, requireRole_, dst).
 * Membangun matriks sungguhan berarti: (1) sheet konfigurasi baru
 * (ADDITIF, sheet lama tidak disentuh), (2) kolom ROLE_BARU baru di
 * 06_ADMIN & 01_DATA_RELAWAN (ADDITIF -- kolom ROLE/STATUS lama
 * DIPERTAHANKAN APA ADANYA, tidak dihapus/diganti, sebagai jalur
 * rollback kalau ada masalah), (3) helper baru cekIzinModul_() yang
 * BENAR-BENAR dikonsultasi oleh enforcement.
 *
 * Pemetaan role lama -> 7 role baru (DISETUJUI Admin via percakapan):
 *   Admin (Portal Pengelola)        -> SUPER_ADMIN
 *   Staff (Portal Pengelola)        -> ADMIN_OPERASIONAL (dibatasi VIEW
 *                                      saja di Tab Konfigurasi -- bukan
 *                                      krn jabatannya, tapi supaya
 *                                      kemampuan PRAKTISnya tetap sama:
 *                                      baca-saja)
 *   KEPALA_SPPG (role relawan)      -> KEPALA_SPPG
 *   ASN (role relawan)              -> KOORDINATOR_OPERASIONAL (dasar:
 *                                      Monitoring adalah dashboard
 *                                      LINTAS-modul operasional, bukan
 *                                      spesifik gizi/keuangan)
 *   RELAWAN (default)               -> RELAWAN
 *   Petugas Stok (ROLE_STOK=PETUGAS)-> TETAP RELAWAN + izin modul
 *                                      SIRAGA via Tab Konfigurasi
 *                                      (SESUAI dokumen: jabatan tidak
 *                                      otomatis jadi role baru)
 */

const ROLE_PORTAL_SHEET_NAME = '32_ROLE_PORTAL';
const MODUL_PORTAL_SHEET_NAME = '33_MODUL_PORTAL';
const KONFIGURASI_HAK_AKSES_SHEET_NAME = '34_KONFIGURASI_HAK_AKSES';

// 7 role baru, disetujui Admin -- SATU tempat definisi, dipakai utk
// bootstrap sheet 32_ROLE_PORTAL (data), BUKAN utk hardcode logika.
const DAFTAR_ROLE_BARU_DEFAULT = [
  { kode: 'SUPER_ADMIN', nama: 'Super Admin', deskripsi: 'Mengelola konfigurasi sistem dan seluruh hak akses yang memang diizinkan.' },
  { kode: 'ADMIN_OPERASIONAL', nama: 'Admin Operasional', deskripsi: 'Mengelola akun dan data operasional sesuai kewenangan.' },
  { kode: 'KEPALA_SPPG', nama: 'Kepala SPPG', deskripsi: 'Memantau operasional dan menjalankan persetujuan sesuai tugas.' },
  { kode: 'PENGAWAS_GIZI', nama: 'Pengawas Gizi', deskripsi: 'Mengakses data terkait pengawasan gizi.' },
  { kode: 'PENGAWAS_KEUANGAN', nama: 'Pengawas Keuangan', deskripsi: 'Mengakses data terkait pengawasan keuangan.' },
  { kode: 'KOORDINATOR_OPERASIONAL', nama: 'Koordinator Operasional', deskripsi: 'Mengelola kegiatan operasional sesuai ruang lingkupnya.' },
  { kode: 'RELAWAN', nama: 'Relawan', deskripsi: 'Mengakses fitur sesuai jabatan, divisi, dan penugasan.' }
];

// 8 modul -- dipetakan dari bagian/menu yang BENAR-BENAR ada di Portal
// sekarang (bukan dikarang): SIRAGA, SIPANDU, SIPRES, Jadwal &
// Penugasan, Penerima Manfaat, Menu Harian, Laporan, Manajemen
// Pengguna. Angka "8" ini KEBETULAN sama dgn contoh di wireframe --
// bukan ditetapkan paksa, murni dari berapa banyak bagian nyata yg
// teridentifikasi saat audit.
const DAFTAR_MODUL_PORTAL_DEFAULT = [
  { kode: 'SIRAGA', nama: 'SIRAGA — Stok & Persediaan', deskripsi: 'Pengelolaan stok, supplier, dan transaksi barang gudang.' },
  { kode: 'SIPANDU', nama: 'SIPANDU — Operasional Produksi', deskripsi: 'Persiapan, pengolahan, pemorsian, distribusi, dan work order dapur.' },
  { kode: 'SIPRES', nama: 'SIPRES — Presensi & Kartu QR', deskripsi: 'Absensi relawan, koreksi presensi, dan kartu QR.' },
  { kode: 'JADWAL_PENUGASAN', nama: 'Jadwal & Penugasan', deskripsi: 'Shift divisi, penugasan khusus, dan kalender operasional.' },
  { kode: 'PENERIMA_MANFAAT', nama: 'Penerima Manfaat', deskripsi: 'Data dan ringkasan penerima manfaat (SIPENDOK).' },
  { kode: 'MENU_HARIAN', nama: 'Menu Harian', deskripsi: 'Rincian menu harian dan siklus menu.' },
  { kode: 'LAPORAN', nama: 'Laporan', deskripsi: 'Laporan koreksi presensi, relawan, dan jadwal/penugasan.' },
  { kode: 'MANAJEMEN_PENGGUNA', nama: 'Manajemen Pengguna', deskripsi: 'Data relawan, akun, dan role/hak akses.' }
];

// 7 jenis izin per modul, sesuai dokumen -- SATU tempat definisi.
const DAFTAR_IZIN_PORTAL = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'VALIDATE', 'APPROVE', 'EXPORT'];

/** Buat sheet 32_ROLE_PORTAL kalau belum ada, isi 7 role default sekali saja (tidak menimpa kalau sudah ada data). */
function getRolePortalSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ROLE_PORTAL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ROLE_PORTAL_SHEET_NAME);
    sheet.appendRow(['KODE_ROLE', 'NAMA_ROLE', 'DESKRIPSI']);
    DAFTAR_ROLE_BARU_DEFAULT.forEach(r => sheet.appendRow([r.kode, r.nama, r.deskripsi]));
  }
  return sheet;
}

/** Buat sheet 33_MODUL_PORTAL kalau belum ada, isi 8 modul default sekali saja. */
function getModulPortalSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MODUL_PORTAL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MODUL_PORTAL_SHEET_NAME);
    sheet.appendRow(['KODE_MODUL', 'NAMA_MODUL', 'DESKRIPSI']);
    DAFTAR_MODUL_PORTAL_DEFAULT.forEach(m => sheet.appendRow([m.kode, m.nama, m.deskripsi]));
  }
  return sheet;
}

/**
 * Buat sheet 34_KONFIGURASI_HAK_AKSES kalau belum ada -- SATU baris per
 * kombinasi Role x Modul (7 x 8 = 56 baris), semua izin default FALSE
 * KECUALI VIEW utk SUPER_ADMIN (diisi penuh di bootstrapKonfigurasiHakAksesDefault_,
 * dipanggil terpisah, BUKAN otomatis di sini -- supaya Admin PASTI
 * meninjau sebelum izin nyata berlaku, sesuai "tinjau sebelum simpan"
 * di dokumen).
 */
function getKonfigurasiHakAksesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(KONFIGURASI_HAK_AKSES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(KONFIGURASI_HAK_AKSES_SHEET_NAME);
    sheet.appendRow(['ID_KONFIGURASI', 'KODE_ROLE', 'KODE_MODUL', 'AKSES_MODUL', 'VIEW', 'CREATE', 'EDIT', 'DELETE', 'VALIDATE', 'APPROVE', 'EXPORT', 'SCOPE', 'DIUBAH_OLEH', 'DIUBAH_PADA']);
  }
  return sheet;
}

/**
 * Isi 56 baris default (7 role x 8 modul) KALAU SHEET BARU DIBUAT (kosong).
 * Default KONSERVATIF, sesuai larangan dokumen "jangan ada peningkatan
 * hak akses tidak sengaja": SUPER_ADMIN dapat semua izin penuh di semua
 * modul; 6 role lain HANYA dapat VIEW, semua izin lain FALSE. Admin
 * WAJIB meninjau & menyalakan izin lain secara eksplisit lewat Tab
 * Konfigurasi -- bukan saya yang menebak siapa boleh apa.
 *
 * TIDAK dipanggil otomatis dari getKonfigurasiHakAksesSheet_ -- dipanggil
 * terpisah (sekali, saat migrasi) supaya jelas kapan data ini mulai ada.
 */
function bootstrapKonfigurasiHakAksesDefault_() {
  const sheet = getKonfigurasiHakAksesSheet_();
  if (sheet.getLastRow() > 1) return { sudahAda: true, jumlah: sheet.getLastRow() - 1 }; // sudah pernah di-bootstrap, jangan timpa

  let nomor = 1;
  const baris = [];
  DAFTAR_ROLE_BARU_DEFAULT.forEach(r => {
    DAFTAR_MODUL_PORTAL_DEFAULT.forEach(m => {
      const superAdmin = r.kode === 'SUPER_ADMIN';
      // Pengecualian TERARAH (18 Okt 2026, ditemukan saat memperluas
      // penegakan ke fungsi transaksi SIRAGA): RELAWAN + SIRAGA default
      // VIEW-saja akan MEMATIKAN kemampuan Petugas Stok input transaksi
      // yg SUDAH BERFUNGSI (mekanisme ROLE_STOK='PETUGAS' terpisah,
      // belum diganti sistem ini) -- itu REGRESI, bukan "default aman".
      // Jadi RELAWAN+SIRAGA default dpt CREATE jg, menyamai kemampuan
      // NYATA yg sudah ada. Role & modul lain TETAP VIEW-saja apa adanya.
      const relawanSiragaCreate = r.kode === 'RELAWAN' && m.kode === 'SIRAGA';
      const create = superAdmin || relawanSiragaCreate;
      baris.push([
        'CFG' + String(nomor++).padStart(4, '0'),
        r.kode, m.kode,
        true, // AKSES_MODUL -- semua role bisa BUKA semua modul secara default (lihat isinya), tindakan nyata dibatasi kolom izin di bawah
        true, // VIEW -- semua role minimal bisa lihat
        create, superAdmin, superAdmin, superAdmin, superAdmin, superAdmin, // CREATE (lihat pengecualian di atas) / EDIT/DELETE/VALIDATE/APPROVE/EXPORT -- cuma Super Admin penuh
        'SEMUA', // SCOPE default -- Admin bisa persempit per role nanti (mis. jadi "Data sesuai divisi/penugasan")
        'SISTEM (bootstrap awal)', new Date()
      ]);
    });
  });
  sheet.getRange(2, 1, baris.length, baris[0].length).setValues(baris);
  logAudit_('BOOTSTRAP_KONFIGURASI_HAK_AKSES', 'HAK_AKSES', '-', 'SISTEM', { jumlahBaris: baris.length });
  return { sudahAda: false, jumlah: baris.length };
}

/**
 * MIGRASI (dijalankan SEKALI, manual oleh Admin lewat tombol di UI --
 * TIDAK otomatis saat deploy). Menambah kolom ROLE_BARU di 06_ADMIN &
 * 01_DATA_RELAWAN KALAU BELUM ADA (additif -- kolom ROLE/STATUS lama
 * di kedua sheet SAMA SEKALI TIDAK disentuh, tetap ada sbg jalur
 * rollback). Mengisi ROLE_BARU berdasarkan pemetaan yg disetujui Admin:
 *
 *   06_ADMIN.ROLE = 'ADMIN' (atau kosong)  -> ROLE_BARU = SUPER_ADMIN
 *   06_ADMIN.ROLE = 'STAFF'                -> ROLE_BARU = ADMIN_OPERASIONAL
 *   01_DATA_RELAWAN.ROLE = 'KEPALA_SPPG'   -> ROLE_BARU = KEPALA_SPPG
 *   01_DATA_RELAWAN.ROLE = 'ASN'           -> ROLE_BARU = KOORDINATOR_OPERASIONAL
 *   01_DATA_RELAWAN.ROLE kosong/lainnya    -> ROLE_BARU = RELAWAN
 *
 * IDEMPOTEN -- aman dipanggil berkali-kali, baris yg SUDAH punya
 * ROLE_BARU terisi TIDAK ditimpa ulang (supaya perubahan manual Admin
 * setelah migrasi pertama tidak hilang kalau tombol ini tertekan lagi).
 */
function jalankanMigrasiRoleBaru(body) {
  requireAuth(body.token); // Super Admin/Admin lama saja -- operasi sensitif
  const hasil = { admin: { diproses: 0, dilewati: 0 }, relawan: { diproses: 0, dilewati: 0 } };

  // --- 06_ADMIN ---
  const sheetAdmin = getSheet(NAMA_SHEET.ADMIN);
  const dataAdmin = sheetAdmin.getDataRange().getValues();
  const headerAdmin = dataAdmin[0].map(h => String(h).trim());
  let idxRoleBaruAdmin = headerAdmin.indexOf('ROLE_BARU');
  if (idxRoleBaruAdmin === -1) {
    sheetAdmin.getRange(1, headerAdmin.length + 1).setValue('ROLE_BARU');
    idxRoleBaruAdmin = headerAdmin.length;
  }
  const idxRoleLamaAdmin = headerAdmin.indexOf('ROLE');
  const idxUsername = headerAdmin.indexOf('USERNAME');
  for (let i = 1; i < dataAdmin.length; i++) {
    if (!dataAdmin[i][idxUsername]) continue;
    if (dataAdmin[i][idxRoleBaruAdmin]) { hasil.admin.dilewati++; continue; } // sudah di-migrasi sebelumnya, jangan timpa
    const roleLama = idxRoleLamaAdmin !== -1 ? String(dataAdmin[i][idxRoleLamaAdmin] || '').toUpperCase() : '';
    const roleBaru = roleLama === 'STAFF' ? 'ADMIN_OPERASIONAL' : 'SUPER_ADMIN';
    sheetAdmin.getRange(i + 1, idxRoleBaruAdmin + 1).setValue(roleBaru);
    hasil.admin.diproses++;
  }

  // --- 01_DATA_RELAWAN ---
  const sheetRelawan = getSheet(NAMA_SHEET.RELAWAN);
  const dataRelawan = sheetRelawan.getDataRange().getValues();
  const headerRelawan = dataRelawan[0].map(h => String(h).trim());
  let idxRoleBaruRelawan = headerRelawan.indexOf('ROLE_BARU');
  if (idxRoleBaruRelawan === -1) {
    sheetRelawan.getRange(1, headerRelawan.length + 1).setValue('ROLE_BARU');
    idxRoleBaruRelawan = headerRelawan.length;
  }
  const idxRoleLamaRelawan = headerRelawan.indexOf('ROLE');
  const idxIdRelawan = headerRelawan.indexOf('ID_RELAWAN');
  for (let i = 1; i < dataRelawan.length; i++) {
    if (!dataRelawan[i][idxIdRelawan]) continue;
    if (dataRelawan[i][idxRoleBaruRelawan]) { hasil.relawan.dilewati++; continue; }
    const roleLama = idxRoleLamaRelawan !== -1 ? String(dataRelawan[i][idxRoleLamaRelawan] || '').toUpperCase().trim() : '';
    let roleBaru = 'RELAWAN';
    if (roleLama === 'KEPALA_SPPG') roleBaru = 'KEPALA_SPPG';
    else if (roleLama === 'ASN') roleBaru = 'KOORDINATOR_OPERASIONAL';
    sheetRelawan.getRange(i + 1, idxRoleBaruRelawan + 1).setValue(roleBaru);
    hasil.relawan.diproses++;
  }

  // Bootstrap konfigurasi default SEKALIAN (idempoten, lihat fungsinya) --
  // supaya 1 tombol migrasi langsung siap dipakai Tab Konfigurasi.
  const konfigurasi = bootstrapKonfigurasiHakAksesDefault_();

  logAudit_('MIGRASI_ROLE_BARU', 'HAK_AKSES', '-', requireAuth(body.token), hasil);
  return { admin: hasil.admin, relawan: hasil.relawan, konfigurasi: konfigurasi };
}

// ============================================================
// TAB 1 — PENGGUNA & ROLE
// ============================================================

/**
 * 3 kartu statistik -- SEMUA dihitung dari data sungguhan, BUKAN
 * angka tetap (sesuai larangan eksplisit dokumen "jangan kunci 48/7/8
 * di kode"). Total Pengguna = akun Admin/Staff (06_ADMIN) + relawan
 * yang PUNYA akun login (07_AKUN_RELAWAN) -- relawan tanpa akun tidak
 * dihitung "pengguna" krn tidak bisa login sama sekali.
 */
function getStatistikHakAkses(token) {
  requireAuth(token);
  const jumlahAdmin = sheetToObjects(getSheet(NAMA_SHEET.ADMIN)).filter(a => a.USERNAME).length;
  const jumlahAkunRelawan = sheetToObjects(getAkunSheet()).length;
  const jumlahRole = getRolePortalSheet_().getLastRow() - 1;
  const jumlahModul = getModulPortalSheet_().getLastRow() - 1;
  return {
    totalPengguna: jumlahAdmin + jumlahAkunRelawan,
    totalRole: Math.max(0, jumlahRole),
    totalModul: Math.max(0, jumlahModul)
  };
}

/**
 * Daftar SEMUA pengguna (Admin/Staff + Relawan berakun) utk tabel Tab
 * 1 -- digabung dari 2 sumber krn memang 2 sistem login berbeda (lihat
 * audit di respons sebelumnya). "Jabatan" diisi dari DIVISI (sistem
 * TIDAK punya field Jabatan terpisah dari Divisi -- didokumentasikan
 * jujur di laporan akhir, bukan dikarang).
 */
function getDaftarPenggunaHakAkses(token) {
  requireAuth(token);
  const hasil = [];

  // --- Admin/Staff ---
  const headerAdmin = (function () {
    const d = getSheet(NAMA_SHEET.ADMIN).getDataRange().getValues();
    return d[0].map(h => String(h).trim());
  })();
  const adaKolomRoleBaruAdmin = headerAdmin.indexOf('ROLE_BARU') !== -1;
  sheetToObjects(getSheet(NAMA_SHEET.ADMIN)).forEach(a => {
    if (!a.USERNAME) return;
    hasil.push({
      tipe: 'ADMIN', id: a.USERNAME, nama: a.NAMA || a.USERNAME, jabatan: '(Portal Pengelola)',
      roleLama: a.ROLE || 'ADMIN', roleBaru: adaKolomRoleBaruAdmin ? (a.ROLE_BARU || '') : '',
      divisi: '-', status: a.STATUS || 'AKTIF'
    });
  });

  // --- Relawan berakun ---
  const akunMap = {};
  sheetToObjects(getAkunSheet()).forEach(ak => { akunMap[ak.ID_RELAWAN] = ak; });
  const headerRelawan = (function () {
    const d = getSheet(NAMA_SHEET.RELAWAN).getDataRange().getValues();
    return d[0].map(h => String(h).trim());
  })();
  const adaKolomRoleBaruRelawan = headerRelawan.indexOf('ROLE_BARU') !== -1;
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).forEach(r => {
    if (!akunMap[r.ID_RELAWAN]) return; // relawan tanpa akun TIDAK termasuk "pengguna" (tidak bisa login)
    hasil.push({
      tipe: 'RELAWAN', id: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, jabatan: r.DIVISI || '-',
      roleLama: r.ROLE || 'RELAWAN', roleBaru: adaKolomRoleBaruRelawan ? (r.ROLE_BARU || '') : '',
      divisi: r.DIVISI || '-', status: String(r.STATUS || '').toUpperCase() === 'AKTIF' ? 'AKTIF' : 'NONAKTIF',
      petugasStok: String(r.ROLE_STOK || '').toUpperCase() === 'PETUGAS'
    });
  });

  hasil.sort((a, b) => a.nama.localeCompare(b.nama));
  return hasil;
}

/**
 * Ubah ROLE_BARU seorang pengguna (Admin ATAU Relawan, dibedakan via
 * body.tipe). Validasi WAJIB: jangan sampai SUPER_ADMIN aktif terakhir
 * di-downgrade (sesuai dokumen §6 & §11 "Perlindungan Super Admin aktif
 * terakhir"). Dicatat ke log audit yg SUDAH ADA (bukan sheet baru).
 */
function ubahRoleBaruPengguna(body) {
  const aktor = requireAuth(body.token);
  const tipe = sanitize(body.tipe); // 'ADMIN' | 'RELAWAN'
  const id = sanitize(body.id);
  const roleBaru = sanitize(body.roleBaru);
  const alasan = sanitize(body.alasan);
  if (!id || !roleBaru) throw new Error('Pengguna dan role baru wajib diisi.');
  const kodeRoleValid = DAFTAR_ROLE_BARU_DEFAULT.map(r => r.kode);
  if (kodeRoleValid.indexOf(roleBaru) === -1) throw new Error('Role tidak dikenali.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    let roleLama = '';
    if (tipe === 'ADMIN') {
      const sheet = getSheet(NAMA_SHEET.ADMIN);
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const idxUsername = headers.indexOf('USERNAME');
      let idxRoleBaru = headers.indexOf('ROLE_BARU');
      if (idxRoleBaru === -1) { sheet.getRange(1, headers.length + 1).setValue('ROLE_BARU'); idxRoleBaru = headers.length; }

      // Proteksi Super Admin aktif terakhir: kalau pengguna INI sedang
      // SUPER_ADMIN dan mau diubah jadi BUKAN SUPER_ADMIN, pastikan masih
      // ada SUPER_ADMIN aktif LAIN setelah perubahan ini.
      let baris = -1, roleSaatIni = '';
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxUsername]) === id) { baris = i; roleSaatIni = idxRoleBaru < data[i].length ? data[i][idxRoleBaru] : ''; break; }
      }
      if (baris === -1) throw new Error('Akun Admin tidak ditemukan.');
      roleLama = roleSaatIni || 'SUPER_ADMIN';
      if (roleLama === 'SUPER_ADMIN' && roleBaru !== 'SUPER_ADMIN') {
        const idxStatus = headers.indexOf('STATUS');
        let jumlahSuperAdminAktifLain = 0;
        for (let i = 1; i < data.length; i++) {
          if (i === baris) continue;
          const statusAktif = idxStatus === -1 || String(data[i][idxStatus] || 'AKTIF').toUpperCase() === 'AKTIF';
          const roleIni = idxRoleBaru < data[i].length ? data[i][idxRoleBaru] : '';
          if (statusAktif && roleIni === 'SUPER_ADMIN') jumlahSuperAdminAktifLain++;
        }
        if (jumlahSuperAdminAktifLain === 0) throw new Error('Tidak bisa mengubah role ini -- akan membuat sistem kehilangan seluruh Super Admin aktif. Tetapkan Super Admin lain terlebih dahulu.');
      }
      sheet.getRange(baris + 1, idxRoleBaru + 1).setValue(roleBaru);
    } else if (tipe === 'RELAWAN') {
      const sheet = getSheet(NAMA_SHEET.RELAWAN);
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const idxId = headers.indexOf('ID_RELAWAN');
      let idxRoleBaru = headers.indexOf('ROLE_BARU');
      if (idxRoleBaru === -1) { sheet.getRange(1, headers.length + 1).setValue('ROLE_BARU'); idxRoleBaru = headers.length; }
      let baris = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxId]) === id) { baris = i; roleLama = idxRoleBaru < data[i].length ? data[i][idxRoleBaru] : ''; break; }
      }
      if (baris === -1) throw new Error('Relawan tidak ditemukan.');
      roleLama = roleLama || 'RELAWAN';
      sheet.getRange(baris + 1, idxRoleBaru + 1).setValue(roleBaru);
      _invalidasiCacheRelawan_(id);
    } else {
      throw new Error('Tipe pengguna tidak dikenali.');
    }

    logAudit_('UBAH_ROLE_BARU', 'HAK_AKSES', id, aktor, { tipe: tipe, roleLama: roleLama, roleBaru: roleBaru, alasan: alasan || '(tidak diisi)' });
    return { success: true, roleLama: roleLama, roleBaru: roleBaru };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// TAB 2 — KONFIGURASI HAK AKSES
// ============================================================

/** Daftar role & modul (utk isi dropdown "Pilih Role"/"Pilih Modul"). */
function getDaftarRoleDanModulHakAkses(token) {
  requireAuth(token);
  return {
    role: sheetToObjects(getRolePortalSheet_()).map(r => ({ kode: r.KODE_ROLE, nama: r.NAMA_ROLE, deskripsi: r.DESKRIPSI })),
    modul: sheetToObjects(getModulPortalSheet_()).map(m => ({ kode: m.KODE_MODUL, nama: m.NAMA_MODUL, deskripsi: m.DESKRIPSI }))
  };
}

/** Baca 1 baris konfigurasi (role x modul) utk ditampilkan di form Tab 2. */
function getKonfigurasiHakAksesSatu(body) {
  requireAuth(body.token);
  const roleKode = sanitize(body.roleKode);
  const modulKode = sanitize(body.modulKode);
  if (!roleKode || !modulKode) throw new Error('Role dan modul wajib dipilih.');
  const baris = sheetToObjects(getKonfigurasiHakAksesSheet_()).find(r => r.KODE_ROLE === roleKode && r.KODE_MODUL === modulKode);
  if (!baris) throw new Error('Konfigurasi belum ada utk kombinasi ini -- jalankan migrasi/bootstrap dulu.');
  return {
    idKonfigurasi: baris.ID_KONFIGURASI, roleKode: baris.KODE_ROLE, modulKode: baris.KODE_MODUL,
    aksesModul: !!baris.AKSES_MODUL,
    izin: { VIEW: !!baris.VIEW, CREATE: !!baris.CREATE, EDIT: !!baris.EDIT, DELETE: !!baris.DELETE, VALIDATE: !!baris.VALIDATE, APPROVE: !!baris.APPROVE, EXPORT: !!baris.EXPORT },
    scope: baris.SCOPE || 'SEMUA',
    diubahOleh: baris.DIUBAH_OLEH || '', diubahPada: baris.DIUBAH_PADA || ''
  };
}

/**
 * Simpan 1 baris konfigurasi. Validasi: SUPER_ADMIN tidak boleh
 * direndahkan jadi tanpa akses modul MANAJEMEN_PENGGUNA (sesuai §11
 * "cegah eskalasi/degradasi yg merusak sistem") -- Super Admin WAJIB
 * tetap bisa kelola pengguna, kalau tidak sistem kehilangan jalur
 * administrasi sama sekali.
 */
function simpanKonfigurasiHakAkses(body) {
  const aktor = requireAuth(body.token);
  const roleKode = sanitize(body.roleKode);
  const modulKode = sanitize(body.modulKode);
  const aksesModul = !!body.aksesModul;
  const izin = body.izin || {};
  const scope = sanitize(body.scope) || 'SEMUA';

  if (roleKode === 'SUPER_ADMIN' && modulKode === 'MANAJEMEN_PENGGUNA' && (!aksesModul || !izin.VIEW || !izin.EDIT)) {
    throw new Error('Super Admin wajib tetap punya akses penuh ke modul Manajemen Pengguna -- kalau tidak, sistem kehilangan jalur administrasi.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getKonfigurasiHakAksesSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idx = {}; headers.forEach((h, i) => { idx[h] = i; });
    for (let i = 1; i < data.length; i++) {
      if (data[i][idx.KODE_ROLE] === roleKode && data[i][idx.KODE_MODUL] === modulKode) {
        const sebelum = { aksesModul: !!data[i][idx.AKSES_MODUL], izin: DAFTAR_IZIN_PORTAL.reduce((o, k) => { o[k] = !!data[i][idx[k]]; return o; }, {}), scope: data[i][idx.SCOPE] };
        sheet.getRange(i + 1, idx.AKSES_MODUL + 1).setValue(aksesModul);
        DAFTAR_IZIN_PORTAL.forEach(k => sheet.getRange(i + 1, idx[k] + 1).setValue(!!izin[k]));
        sheet.getRange(i + 1, idx.SCOPE + 1).setValue(scope);
        sheet.getRange(i + 1, idx.DIUBAH_OLEH + 1).setValue(aktor);
        sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(new Date());
        logAudit_('UBAH_KONFIGURASI_HAK_AKSES', 'HAK_AKSES', roleKode + '/' + modulKode, aktor, {
          sebelum: sebelum, sesudah: { aksesModul: aksesModul, izin: izin, scope: scope }
        });
        return { success: true };
      }
    }
    // Diperbaiki 24 Okt 2026 (dilaporkan Admin: "Konfigurasi tidak
    // ditemukan" saat Simpan kombinasi role+modul yg BELUM pernah
    // dibuat bootstrap/migrasi sebelumnya -- mis. kombinasi modul
    // custom yg baru pertama kali dicentang). SEBELUMNYA fungsi ini
    // HANYA bisa UBAH baris yg sudah ada, selalu gagal kalau baris
    // utk kombinasi itu belum pernah ada -- padahal halaman ini
    // SENGAJA mengizinkan Admin pilih module manapun scr bebas ("boleh
    // lebih dari satu"), jadi kombinasi baru yg belum ada barisnya
    // adalah hal NORMAL, bukan kondisi error. Sekarang: BUAT baris
    // baru kalau belum ada, bukan tolak.
    const idBaru = 'KFG' + String(data.length).padStart(4, '0') + '-' + Utilities.getUuid().slice(0, 6);
    const barisBaru = headers.map(() => '');
    barisBaru[idx.ID_KONFIGURASI] = idBaru;
    barisBaru[idx.KODE_ROLE] = roleKode;
    barisBaru[idx.KODE_MODUL] = modulKode;
    barisBaru[idx.AKSES_MODUL] = aksesModul;
    DAFTAR_IZIN_PORTAL.forEach(k => { barisBaru[idx[k]] = !!izin[k]; });
    barisBaru[idx.SCOPE] = scope;
    barisBaru[idx.DIUBAH_OLEH] = aktor;
    barisBaru[idx.DIUBAH_PADA] = new Date();
    sheet.appendRow(barisBaru);
    logAudit_('TAMBAH_KONFIGURASI_HAK_AKSES', 'HAK_AKSES', roleKode + '/' + modulKode, aktor, { aksesModul, izin, scope });
    return { success: true, baru: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * PENGECEKAN IZIN SUNGGUHAN (16-18 Okt 2026) -- ini yg membedakan dari
 * "UI statis tanpa fungsi nyata" yg dilarang dokumen. Dipakai server
 * SEBELUM mengizinkan tindakan, bukan cuma utk sembunyikan tombol di
 * frontend. idRelawanAtauUsername: ID relawan ATAU username Admin
 * (fungsi ini otomatis deteksi tipenya & cari ROLE_BARU yg sesuai).
 */
function cekIzinModul_(idRelawanAtauUsername, modulKode, izin) {
  // PENGAMAN KRITIS: kalau migrasi/bootstrap BELUM pernah dijalankan
  // (sheet konfigurasi kosong), JANGAN tolak semua orang -- itu akan
  // merusak SIRAGA (dan modul lain yg kelak disambungkan) SEBELUM Admin
  // sempat menjalankan migrasi sama sekali. Izinkan dulu (spt sebelum
  // fitur ini ada) sampai konfigurasi sungguhan tersedia.
  if (getKonfigurasiHakAksesSheet_().getLastRow() <= 1) return true;

  // Cari ROLE_BARU: coba Admin dulu, baru Relawan.
  let roleBaru = null;
  const admin = sheetToObjects(getSheet(NAMA_SHEET.ADMIN)).find(a => a.USERNAME === idRelawanAtauUsername);
  if (admin) {
    roleBaru = admin.ROLE_BARU || 'SUPER_ADMIN'; // belum dimigrasi -> anggap Super Admin (akun Admin lama SELALU penuh, jangan pernah terkunci keluar)
  } else {
    const relawan = getRelawanById(idRelawanAtauUsername);
    if (relawan) roleBaru = relawan.roleBaru || 'RELAWAN';
  }
  if (!roleBaru) return false; // pengguna tidak dikenali -- tolak, jangan anggap diizinkan

  const baris = sheetToObjects(getKonfigurasiHakAksesSheet_()).find(r => r.KODE_ROLE === roleBaru && r.KODE_MODUL === modulKode);
  if (!baris) return false; // belum ada konfigurasi -- tolak (aman by default), BUKAN izinkan
  if (!baris.AKSES_MODUL) return false;
  if (izin === 'AKSES_MODUL') return true; // cuma cek bisa buka modul, tidak perlu izin tindakan spesifik
  return !!baris[izin];
}

/**
 * BARU 30 Okt 2026 (Tahap 4 -- Penataan Navigasi PORTAL). Status AKSES_MODUL
 * (ya/tidak) utk SEMUA modul sekaligus, bagi pengguna yg sedang login --
 * dipakai sidebar terpusat (lihat NavigasiTerpusat.js) supaya TIDAK perlu
 * 10 panggilan API terpisah (1 per modul) cuma utk gambar status kunci di
 * sidebar. Pakai ULANG persis logika cekIzinModul_ (roleBaru + baris
 * konfigurasi), bukan logika baru.
 * @return {Object} { "SIMSDM": true, "SIRAGA": false, ... } -- key = KODE_MODUL persis dari 33_MODUL_PORTAL
 */
function getAksesModulSaya(token) {
  let idPengguna;
  try { idPengguna = requireAuthRelawan(token); }
  catch (e) { idPengguna = requireAuth(token, true); } // bukan token relawan -- coba sbg admin (izinkan Staff juga, cuma utk BACA status sendiri)

  const semuaModul = sheetToObjects(getModulPortalSheet_());
  const hasil = {};
  semuaModul.forEach(m => { hasil[m.KODE_MODUL] = cekIzinModul_(idPengguna, m.KODE_MODUL, 'AKSES_MODUL'); });
  return hasil;
}

/**
 * Pembungkus siap-pakai: throw kalau TIDAK diizinkan. Dipakai di titik
 * enforcement (lihat Stok.gs utk contoh penerapan nyata ke SIRAGA).
 */
function requireIzinModulBaru_(idPengguna, modulKode, izin) {
  if (!cekIzinModul_(idPengguna, modulKode, izin)) {
    throw new Error('Anda tidak memiliki izin "' + izin + '" untuk modul ini.');
  }
}

// ============================================================
// TAB 3 — RIWAYAT PERUBAHAN
// ============================================================

/**
 * Riwayat perubahan hak akses -- memakai ULANG log audit yg SUDAH ADA
 * (24_AUDIT_LOG via getAuditLogListAdmin, Utils.gs), DISARING ke
 * MODUL='HAK_AKSES' saja (tidak membuat sheet log terpisah, sesuai
 * larangan "jangan buat struktur baru tanpa perlu"). Password/token/
 * hash TIDAK PERNAH masuk ke log ini -- logAudit_ cuma pernah dipanggil
 * dgn detail berisi role/izin/alasan, tidak pernah data rahasia.
 */
function getRiwayatPerubahanHakAkses(body) {
  requireAuth(body.token);
  const cari = sanitize(body.cari || '').toLowerCase();
  const jenis = sanitize(body.jenis || ''); // '' = semua, atau cocok dgn nilai AKSI

  const semua = getAuditLogListAdmin(body.token); // sudah dibatasi 200 terbaru & dibalik (terbaru dulu)
  const relevan = semua.filter(r => r.modul === 'HAK_AKSES');
  const tersaring = relevan.filter(r => {
    if (jenis && r.aksi !== jenis) return false;
    if (cari) {
      const gabung = (r.aksi + ' ' + r.idTerkait + ' ' + r.aktor + ' ' + JSON.stringify(r.detail || {})).toLowerCase();
      if (gabung.indexOf(cari) === -1) return false;
    }
    return true;
  });

  const LABEL_AKSI = {
    UBAH_ROLE_BARU: 'Role pengguna diubah',
    UBAH_KONFIGURASI_HAK_AKSES: 'Izin modul diperbarui',
    UBAH_PETUGAS_STOK: 'Status Petugas Stok diubah',
    MIGRASI_ROLE_BARU: 'Migrasi role dijalankan',
    BOOTSTRAP_KONFIGURASI_HAK_AKSES: 'Konfigurasi awal dibuat'
  };

  return tersaring.map(r => {
    let detailObjek = {};
    try { detailObjek = typeof r.detail === 'string' ? JSON.parse(r.detail) : (r.detail || {}); } catch (e) { /* biarkan kosong kalau rusak */ }
    return {
      waktu: r.waktu, aksi: r.aksi, labelAksi: LABEL_AKSI[r.aksi] || r.aksi,
      target: r.idTerkait, pelaku: r.aktor, detail: detailObjek
    };
  });
}


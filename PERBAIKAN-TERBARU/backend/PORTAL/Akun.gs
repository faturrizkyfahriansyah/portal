/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Akun.gs — Akun, login, dan profil relawan (Tahap 2, 3, 4 dari roadmap)
 *
 * Modul ini BERDIRI SENDIRI dari sistem absensi lama (Absensi.gs, script.js,
 * absensi.html). Belum ada yang menghubungkan login relawan ke proses
 * absensi — itu direncanakan pada tahap berikutnya (Fase 7 di roadmap).
 *
 * Data akun disimpan di sheet BARU: 07_AKUN_RELAWAN, terhubung ke
 * 01_DATA_RELAWAN lewat ID_RELAWAN. Sheet 01_DATA_RELAWAN sendiri TIDAK
 * diubah sama sekali — nol risiko ke sistem absensi yang sudah berjalan.
 *
 * Kolom 07_AKUN_RELAWAN:
 *   ID_RELAWAN | USERNAME | PASSWORD_HASH | SALT | NO_HP | EMAIL |
 *   STATUS_AKUN | WAJIB_GANTI_PASSWORD | DIBUAT_PADA | LOGIN_TERAKHIR |
 *   TOKEN_AKTIF | TOKEN_KADALUARSA  <-- BARU (lihat catatan sesi di bawah)
 *
 * PERBAIKAN: sesi relawan (Tahap 3) tadinya HANYA disimpan di CacheService,
 * yang punya batas KERAS 21600 detik (6 jam) dari Google -- tidak bisa
 * diperpanjang lewat kode. Untuk relawan yang HP/tabletnya ditampilkan
 * terus-menerus di lokasi (tidak login ulang tiap hari), sesi ditulis JUGA
 * ke sheet ini (kolom TOKEN_AKTIF + TOKEN_KADALUARSA) sebagai penyimpanan
 * jangka panjang. CacheService tetap dipakai sebagai jalur cepat (supaya
 * tidak selalu baca Spreadsheet); begitu cache itu kadaluarsa (>6 jam),
 * requireAuthRelawan_ otomatis jatuh ke pengecekan sheet sebelum menyerah.
 *
 * WAJIB: tambahkan 2 kolom baru ini secara manual di sheet 07_AKUN_RELAWAN
 * kalau belum ada -- kode di bawah aman (tidak error) walau kolom ini
 * belum ditambahkan, tapi relawan akan tetap logout tiap 6 jam sampai
 * kolomnya dibuat.
 */

// Berapa lama sesi relawan bertahan tanpa perlu login ulang (dalam hari).
// >>> UBAH ANGKA INI SESUAI KEBUTUHAN (mis. 90 untuk perangkat kios yang jarang login ulang) <<<
const DURASI_SESI_RELAWAN_HARI = 90;

// ------------------------------------------------------------
// UTILITAS SHEET AKUN
// ------------------------------------------------------------

function getAkunSheet() {
  return getSheet(NAMA_SHEET.AKUN_RELAWAN);
}

/** Membaca header sheet Akun menjadi { NAMA_KOLOM: indexAngka (mulai 0) }. */
function akunHeaderIndex_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  return idx;
}

/** Mencari baris akun berdasarkan ID_RELAWAN. Return null jika tidak ada. */
/**
 * DIMEMOISASI PER-ID, PER-EKSEKUSI (bukan lintas-request). Fungsi ini
 * dipanggil di 22 tempat berbeda -- termasuk DI DALAM LOOP di
 * PushNotifikasi.gs (cek semua relawan tiap 30 menit) yang sebelumnya
 * membaca ULANG SELURUH sheet Akun untuk SETIAP relawan (50 relawan =
 * 50x baca sheet yang sama dalam 1 eksekusi).
 *
 * AMAN dari data basi: setiap fungsi yang MENULIS ke sheet Akun WAJIB
 * memanggil _invalidasiCacheAkun_(idRelawan) setelah menulis, supaya
 * panggilan berikutnya (kalau ada, dalam eksekusi yang sama) baca ulang
 * dari sheet, bukan pakai cache lama.
 */
let _cacheAkunPerId = {};
function cariAkunByIdRelawan_(idRelawan) {
  if (_cacheAkunPerId[idRelawan] !== undefined) return _cacheAkunPerId[idRelawan];
  const sheet = getAkunSheet();
  const data = sheet.getDataRange().getValues();
  const idx = akunHeaderIndex_(sheet);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_RELAWAN]) === idRelawan) {
      const hasil = { baris: i + 1, data: data[i], idx: idx };
      _cacheAkunPerId[idRelawan] = hasil;
      return hasil;
    }
  }
  _cacheAkunPerId[idRelawan] = null;
  return null;
}

/** Dipanggil SETELAH menulis ke sheet Akun, supaya cache tidak basi kalau ada baca ulang dalam eksekusi yang sama. */
function _invalidasiCacheAkun_(idRelawan) {
  delete _cacheAkunPerId[idRelawan];
}

/**
 * Mencari baris akun berdasarkan TOKEN_AKTIF yang tersimpan di sheet (jalur
 * cadangan saat CacheService sudah kadaluarsa, lihat catatan di atas file).
 * Return null kalau kolomnya belum ada di sheet, tokennya tidak cocok, atau
 * sudah lewat TOKEN_KADALUARSA.
 */
function cariAkunByTokenSheet_(token) {
  const sheet = getAkunSheet();
  const idx = akunHeaderIndex_(sheet);
  if (idx.TOKEN_AKTIF === undefined || idx.TOKEN_KADALUARSA === undefined) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.TOKEN_AKTIF]) === token && data[i][idx.TOKEN_AKTIF] !== '') {
      const kadaluarsa = data[i][idx.TOKEN_KADALUARSA];
      if (kadaluarsa instanceof Date && kadaluarsa.getTime() > Date.now()) {
        return { baris: i + 1, data: data[i], idx: idx };
      }
      return null; // token ada tapi sudah lewat masa berlaku
    }
  }
  return null;
}

/** Mencari baris akun berdasarkan USERNAME (tidak case-sensitive). Return null jika tidak ada. */
function cariAkunByUsername_(username) {
  const sheet = getAkunSheet();
  const data = sheet.getDataRange().getValues();
  const idx = akunHeaderIndex_(sheet);
  const target = String(username).toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.USERNAME]).toLowerCase() === target) {
      return { baris: i + 1, data: data[i], idx: idx };
    }
  }
  return null;
}

/** Password acak 8 karakter, menghindari karakter yang gampang tertukar (0/O, 1/l/I). */
function generatePasswordSementara_() {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let hasil = '';
  for (let i = 0; i < 8; i++) {
    hasil += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return hasil;
}

// ------------------------------------------------------------
// TAHAP 2 — ADMIN: KELOLA AKUN RELAWAN
// ------------------------------------------------------------

/** Daftar status akun untuk dashboard admin — TIDAK PERNAH mengembalikan hash/salt. */
function getAkunRelawanList() {
  const rows = sheetToObjects(getAkunSheet());
  return rows.map(r => ({
    idRelawan: r.ID_RELAWAN,
    username: r.USERNAME,
    statusAkun: r.STATUS_AKUN,
    wajibGantiPassword: r.WAJIB_GANTI_PASSWORD === true || String(r.WAJIB_GANTI_PASSWORD).toUpperCase() === 'TRUE'
  }));
}

/**
 * Admin membuat akun baru untuk relawan yang sudah ada di 01_DATA_RELAWAN.
 * Password sementara dibuat otomatis oleh sistem dan HANYA muncul pada
 * respons pemanggilan ini — setelah ini hanya hash yang tersimpan, tidak
 * bisa dilihat lagi. Admin wajib langsung mencatat & menyampaikannya ke
 * relawan yang bersangkutan.
 */
function addAkunRelawan(body) {
  const idRelawan = sanitize(body.idRelawan);
  const username = sanitize(body.username).toLowerCase();

  if (!idRelawan) throw new Error('Relawan wajib dipilih.');
  if (!username || username.length < 4) throw new Error('Username minimal 4 karakter.');
  if (!/^[a-z0-9._]+$/.test(username)) throw new Error('Username hanya boleh huruf kecil, angka, titik, dan garis bawah.');

  const relawan = getRelawanById(idRelawan);
  if (!relawan) throw new Error('Data relawan tidak ditemukan.');

  // P2 (Audit Lanjutan §4) -- kunci dipasang SEBELUM pengecekan
  // keunikan username/akun, bukan hanya sebelum menulis. Ini pola
  // "baca lalu tulis" klasik yang rawan race condition: tanpa kunci,
  // 2 admin yg nyaris bersamaan membuat akun dgn username SAMA bisa
  // lolos dua-duanya (masing2 mengecek SEBELUM yg lain sempat
  // menyimpan), menghasilkan 2 akun berbeda dgn username kembar.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada perubahan akun lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    if (cariAkunByIdRelawan_(idRelawan)) throw new Error('Relawan ini sudah mempunyai akun.');
    if (cariAkunByUsername_(username)) throw new Error('Username sudah dipakai, gunakan username lain.');

    const passwordSementara = generatePasswordSementara_();
    const salt = Utilities.getUuid();
    const hash = hashPassword(passwordSementara, salt);

  // PERBAIKAN BUG BESAR: sebelumnya appendRow([...]) memakai array dengan
  // POSISI TETAP (urutan lama dari SEBELUM sheet 07_AKUN_RELAWAN berkembang
  // jadi 23 kolom -- ROLE_STOK, FCM_TOKEN, ROLE, dan banyak kolom LAST_*_
  // CHANGE ditambahkan belakangan). Akibatnya SETIAP akun baru salah
  // tempat total: SALT (posisi ke-4) mendarat di kolom D, yang di sheet
  // SEKARANG adalah STATUS_AKUN -- bukan "AKTIF" yang tertulis di sana,
  // tapi string UUID acak. Itu sebabnya akun baru SELALU gagal login
  // dengan pesan persis "Akun tidak aktif. Hubungi admin." -- BUKAN
  // masalah relawan tertentu, tapi SETIAP akun yang dibuat lewat tombol
  // ini sejak sheet berkembang.
  //
  // Sekarang pakai akunHeaderIndex_ (mekanisme header-map yang SUDAH ADA,
  // sudah dipakai fungsi baca seperti cariAkunByIdRelawan_/relawanLogin,
  // dan sudah dipakai fungsi tulis lain seperti resetPasswordRelawan di
  // atas) -- apa yang ditulis di sini dijamin ke kolom yang SAMA dengan
  // yang dibaca relawanLogin, tidak peduli urutan kolom di sheet berubah
  // di masa depan.
  const sheet = getAkunSheet();
  const idx = akunHeaderIndex_(sheet);
  const baris = new Array(sheet.getLastColumn()).fill('');

  function isi(namaKolom, nilai) {
    if (idx[namaKolom] === undefined) {
      throw new Error('Kolom "' + namaKolom + '" tidak ditemukan di sheet 07_AKUN_RELAWAN -- periksa header sheet sebelum membuat akun.');
    }
    baris[idx[namaKolom]] = nilai;
  }

  // Field WAJIB (lihat instruksi: ID_RELAWAN, USERNAME, USERNAME_DIUBAH_PADA,
  // STATUS_AKUN, PASSWORD_HASH, SALT, WAJIB_GANTI_PASSWORD, DIBUAT_PADA, ROLE).
  isi('ID_RELAWAN', idRelawan);
  isi('USERNAME', username);
  isi('USERNAME_DIUBAH_PADA', ''); // belum pernah diubah -- kosong, BUKAN tanggal dibuat
  isi('STATUS_AKUN', 'AKTIF');
  isi('PASSWORD_HASH', hash);
  isi('SALT', salt);
  isi('WAJIB_GANTI_PASSWORD', true);
  isi('DIBUAT_PADA', new Date());
  // ROLE di sheet AKUN ini tidak dibaca fungsi mana pun saat ini (beda
  // dari ROLE di 01_DATA_RELAWAN yang dipakai getRoleRelawan_ untuk
  // ASN/Kepala SPPG) -- kemungkinan besar dimaksudkan sebagai cerminan
  // dari kolom yang sama itu. Disalin apa adanya supaya konsisten &
  // tidak dibiarkan kosong tanpa alasan; TIDAK memengaruhi fungsi apa
  // pun yang sudah berjalan karena memang belum ada yang membacanya.
  isi('ROLE', relawan.role || '');

  // SEMUA kolom lain (LOGIN_TERAKHIR, TOKEN_AKTIF, TOKEN_KADALUARSA,
  // ROLE_STOK, FCM_TOKEN, NOTIF_HP_AKTIF, TERAKHIR_DIINGATKAN,
  // PROFIL_REMINDER_TERKIRIM, LAST_*_CHANGE) SENGAJA dibiarkan kosong
  // (nilai default array di atas) -- BUKAN diisi UUID/tanggal/nilai
  // acak hanya supaya baris terlihat penuh, sesuai instruksi. Ini juga
  // PERSIS bagaimana field itu kosong untuk akun yang dibuat manual
  // sebelumnya.
  //
  // CATATAN: form ini juga mengumpulkan "No HP (opsional)" -- sheet
  // 07_AKUN_RELAWAN TIDAK PUNYA kolom NO_HP/EMAIL sama sekali (itu ada
  // di 01_DATA_RELAWAN). Nilai itu sebelumnya "tertulis" ke kolom yang
  // salah akibat bug array posisi di atas -- sekarang TIDAK ditulis ke
  // mana pun (tidak ada tempat yang benar untuk itu di sheet ini).
  // Field itu dibiarkan ada di form (di luar scope perbaikan bug ini),
  // tapi nilainya tidak lagi disimpan -- lihat laporan.

    sheet.appendRow(baris);
    _invalidasiCacheAkun_(idRelawan);

    return {
      idRelawan: idRelawan,
      nama: relawan.nama,
      username: username,
      passwordSementara: passwordSementara
    };
  } finally {
    lock.releaseLock();
  }
}

/** Admin mereset password relawan (akun terkunci / lupa & belum ada OTP). Password lama langsung tidak berlaku. */
function resetPasswordRelawan(body) {
  const idRelawan = sanitize(body.idRelawan);
  const lock = LockService.getScriptLock(); // P2 -- cegah 2 reset bersamaan utk akun yg sama saling menimpa
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const akun = cariAkunByIdRelawan_(idRelawan);
    if (!akun) throw new Error('Akun relawan tidak ditemukan.');

    const passwordBaru = generatePasswordSementara_();
    const salt = Utilities.getUuid();
    const hash = hashPassword(passwordBaru, salt);

    const sheet = getAkunSheet();
    sheet.getRange(akun.baris, akun.idx.PASSWORD_HASH + 1).setValue(hash);
    sheet.getRange(akun.baris, akun.idx.SALT + 1).setValue(salt);
    sheet.getRange(akun.baris, akun.idx.WAJIB_GANTI_PASSWORD + 1).setValue(true);
    _invalidasiCacheAkun_(idRelawan);

    return { idRelawan: idRelawan, passwordSementara: passwordBaru };
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// TAHAP 3 — LOGIN RELAWAN
// ------------------------------------------------------------

function relawanLogin(username, password) {
  username = sanitize(username);
  if (!username || !password) throw new Error('Username dan password wajib diisi.');

  const akun = cariAkunByUsername_(username);
  if (!akun) throw new Error('Username atau password salah.');

  if (String(akun.data[akun.idx.STATUS_AKUN]).toUpperCase() !== 'AKTIF') {
    throw new Error('Akun tidak aktif. Hubungi admin.');
  }

  const hash = hashPassword(password, akun.data[akun.idx.SALT]);
  if (hash !== akun.data[akun.idx.PASSWORD_HASH]) throw new Error('Username atau password salah.');

  const idRelawan = String(akun.data[akun.idx.ID_RELAWAN]);
  const relawan = getRelawanById(idRelawan);
  if (!relawan || String(relawan.status).toUpperCase() !== 'AKTIF') {
    throw new Error('Data relawan tidak aktif. Hubungi admin.');
  }

  const token = generateToken();
  // Jalur cepat: CacheService (server), maks 6 jam -- ini batas KERAS dari Google.
  CacheService.getScriptCache().put('sesi_relawan_' + token, idRelawan, 21600);

  // Jalur jangka panjang: simpan token yang SAMA + tanggal kadaluarsa ke sheet,
  // supaya begitu cache di atas kadaluarsa, relawan tetap tidak perlu login
  // ulang selama masih dalam DURASI_SESI_RELAWAN_HARI (lihat requireAuthRelawan).
  if (akun.idx.TOKEN_AKTIF !== undefined && akun.idx.TOKEN_KADALUARSA !== undefined) {
    const kadaluarsa = new Date(Date.now() + DURASI_SESI_RELAWAN_HARI * 24 * 60 * 60 * 1000);
    const sheetAkun = getAkunSheet();
    sheetAkun.getRange(akun.baris, akun.idx.TOKEN_AKTIF + 1).setValue(token);
    sheetAkun.getRange(akun.baris, akun.idx.TOKEN_KADALUARSA + 1).setValue(kadaluarsa);
  }

  // Catat waktu login terakhir (dipakai nanti di halaman Pengaturan Akun).
  // Dicek dulu supaya tetap aman kalau kolom LOGIN_TERAKHIR belum ditambahkan ke sheet.
  if (akun.idx.LOGIN_TERAKHIR !== undefined) {
    getAkunSheet().getRange(akun.baris, akun.idx.LOGIN_TERAKHIR + 1).setValue(new Date());
    _invalidasiCacheAkun_(idRelawan);
  }

  const wajib = akun.data[akun.idx.WAJIB_GANTI_PASSWORD];
  // BARU 30 Okt 2026 (Tahap 3 -- Autentikasi Terpusat): token tambahan
  // utk modul lain (SIPENDOK dkk) verifikasi identitas tanpa login
  // ulang. ADITIF, dibungkus try/catch -- kalau AUTH_TERPUSAT_SECRET
  // belum disiapkan (lihat AuthTerpusat.gs), login tetap normal, cuma
  // field ini kosong. TIDAK PERNAH menggagalkan login yg sudah jalan.
  let tokenTerpusat = '';
  try { tokenTerpusat = buatTokenTerpusat_(idRelawan, relawan.nama, relawan.roleBaru); } catch (e) { /* belum disetup -- aman diabaikan */ }
  return {
    token: token,
    idRelawan: idRelawan,
    nama: relawan.nama,
    divisi: relawan.divisi,
    wajibGantiPassword: wajib === true || String(wajib).toUpperCase() === 'TRUE',
    tokenTerpusat: tokenTerpusat
  };
}

function logoutRelawan(body) {
  if (body && body.token) {
    CacheService.getScriptCache().remove('sesi_relawan_' + body.token);

    // Hapus juga token jangka panjang di sheet, supaya perangkat yang sudah
    // "Keluar" tidak bisa otomatis masuk lagi walau tokennya masih tersimpan.
    const akun = cariAkunByTokenSheet_(body.token);
    if (akun && akun.idx.TOKEN_AKTIF !== undefined) {
      getAkunSheet().getRange(akun.baris, akun.idx.TOKEN_AKTIF + 1).setValue('');
      getAkunSheet().getRange(akun.baris, akun.idx.TOKEN_KADALUARSA + 1).setValue('');
      _invalidasiCacheAkun_(idRelawan);
    }
  }
  return { success: true };
}

/**
 * Dipanggil di awal setiap aksi relawan yang butuh login.
 *
 * Sengaja memvalidasi ULANG status akun di sini (bukan cuma saat login) —
 * supaya begitu Admin menonaktifkan akun ini, permintaan BERIKUTNYA dari
 * relawan tsb langsung ditolak & sesinya dihapus dari server, tanpa perlu
 * menunggu token kedaluwarsa (maks 6 jam). Bukan real-time seketika (server
 * tidak tahu token mana yang sedang aktif dipakai), tapi setiap kali relawan
 * melakukan aksi apa pun (buka halaman, simpan profil, dll.) statusnya
 * dicek ulang — sesuai jawaban "berkala/setiap request penting".
 */
function requireAuthRelawan(token) {
  if (!token) throw new Error('Sesi tidak valid. Silakan login kembali.');

  let idRelawan = CacheService.getScriptCache().get('sesi_relawan_' + token);

  if (!idRelawan) {
    // Cache 6-jam sudah kadaluarsa (batas keras dari Google) -- coba cari
    // sesi jangka panjang di sheet sebelum menyerah (lihat catatan di atas file).
    const akunToken = cariAkunByTokenSheet_(token);
    if (!akunToken) throw new Error('Sesi telah berakhir. Silakan login kembali.');
    idRelawan = String(akunToken.data[akunToken.idx.ID_RELAWAN]);
    // Isi ulang cache cepat supaya request berikutnya tidak perlu baca sheet lagi.
    CacheService.getScriptCache().put('sesi_relawan_' + token, idRelawan, 21600);
  }

  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun || String(akun.data[akun.idx.STATUS_AKUN]).toUpperCase() !== 'AKTIF') {
    CacheService.getScriptCache().remove('sesi_relawan_' + token);
    throw new Error('Akun Anda telah dinonaktifkan oleh Admin. Silakan hubungi Admin.');
  }

  return idRelawan;
}

/** Admin mengaktifkan/menonaktifkan akun relawan. Lihat catatan di requireAuthRelawan soal kapan sesi berhenti berlaku. */
function updateStatusAkunRelawan(body) {
  const idRelawan = sanitize(body.idRelawan);
  const statusBaru = sanitize(body.statusBaru).toUpperCase();
  if (statusBaru !== 'AKTIF' && statusBaru !== 'NONAKTIF') throw new Error('Status tidak valid.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const akun = cariAkunByIdRelawan_(idRelawan);
    if (!akun) throw new Error('Akun relawan tidak ditemukan.');

    getAkunSheet().getRange(akun.baris, akun.idx.STATUS_AKUN + 1).setValue(statusBaru);
    _invalidasiCacheAkun_(idRelawan);
    return { idRelawan: idRelawan, statusAkun: statusBaru };
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// TAHAP 4 — PROFIL RELAWAN
// ------------------------------------------------------------

/** Identitas resmi (ID/Nama/Divisi/Status, milik Admin) digabung data yang boleh dilengkapi relawan (No HP/Email). */
/**
 * Modul Pengaturan Akun (Modul Dashboard Relawan #3) — SENGAJA terpisah dari
 * getProfilRelawan(): Profil = identitas, Pengaturan = keamanan/status akun.
 * Tidak mengulang nama/ID/username/No HP/Email di sini.
 */
function getPengaturanAkun(token) {
  const idRelawan = requireAuthRelawan(token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');

  const loginTerakhir = akun.idx.LOGIN_TERAKHIR !== undefined ? akun.data[akun.idx.LOGIN_TERAKHIR] : '';
  return {
    statusAkun: akun.data[akun.idx.STATUS_AKUN],
    loginTerakhir: loginTerakhir instanceof Date ? loginTerakhir.toISOString() : (loginTerakhir || ''),
    // BARU: dipakai widget "Ubah Username" yang sekarang dipindah ke
    // halaman ini (Pengaturan Akun), bukan lagi di Profil Saya.
    username: akun.data[akun.idx.USERNAME],
    gantiUsername: statusGantiUsername_(akun)
  };
}

/** Kolom baru di 01_DATA_RELAWAN yang dipakai modul Profil Saya -- dipanggil di awal getProfilRelawan & tiap fungsi update supaya sheet lama (dibuat sebelum kolom ini ada) otomatis lengkap, tanpa migrasi manual. */
function pastikanKolomProfilRelawan_() {
  tambahKolomJikaBelumAda_(NAMA_SHEET.RELAWAN, [
    'JABATAN', 'TEMPAT_LAHIR', 'STATUS_PERNIKAHAN', 'AGAMA',
    'KONTAK_DARURAT_HUBUNGAN_LAINNYA',
    'LAST_DATA_PRIBADI_CHANGE', 'LAST_KONTAK_CHANGE'
  ]);
}

/**
 * Profil Relawan versi ADMIN/Staff (Bagian B, Redesain Menu Relawan) --
 * BEDA dari getProfilRelawan di bawah (itu SELF-SERVICE, sumber idRelawan
 * dari token milik relawan sendiri). Fungsi ini sengaja DIPISAH, bukan
 * refactor getProfilRelawan, supaya fungsi self-service yang sudah
 * teruji TIDAK disentuh sama sekali -- risiko regresi nol thd fitur yg
 * sudah berjalan. Field yang BEDA dari versi self-service:
 *  - nomorRekening ikut (admin/staff yg berwenang boleh lihat; relawan
 *    sendiri TIDAK diberi balik via jalur ini -- lihat getProfilRelawan)
 *  - statusAkun & wajibGantiPassword ikut (utk Bagian G -- Hak Akses)
 *  - TIDAK ada bolehUbah/cooldown -- itu konsep utk relawan MENGEDIT
 *    profil SENDIRI; Admin yg mengedit prosesnya sendiri (lihat fungsi
 *    update* yang sudah ada), bukan dibatasi cooldown yang sama.
 */
function getProfilRelawanAdmin(body) {
  requireAuth(body.token, true); // Staff boleh LIHAT (sesuai pola baca di tempat lain), tulis tetap lewat fungsi update* yg masing2 sudah Admin-only
  const idRelawan = sanitize(body.idRelawan);
  const relawan = getRelawanById(idRelawan);
  if (!relawan) throw new Error('Data relawan tidak ditemukan.');
  const akun = cariAkunByIdRelawan_(idRelawan);

  return {
    id: relawan.id, nama: relawan.nama, divisi: relawan.divisi, jabatan: relawan.jabatan || '',
    status: relawan.status, tanggalBergabung: relawan.tanggalBergabung || '',
    username: akun ? akun.data[akun.idx.USERNAME] : '',

    nik: relawan.nik || '', tempatLahir: relawan.tempatLahir || '', tanggalLahir: relawan.tanggalLahir || '',
    jenisKelamin: relawan.jenisKelamin || '', statusPernikahan: relawan.statusPernikahan || '', agama: relawan.agama || '',
    alamat: relawan.alamat || '', noHp: relawan.noHp || '', email: relawan.email || '',
    fotoProfilUrl: relawan.fotoProfilId ? urlFotoReference_(relawan.fotoProfilId) : null,
    nomorRekening: relawan.nomorRekening || '',

    kontakDarurat: {
      nama: relawan.kontakDaruratNama || '', hubungan: relawan.kontakDaruratHubungan || '',
      hubunganLainnya: relawan.kontakDaruratHubunganLainnya || '', noHp: relawan.kontakDaruratNoHp || ''
    },

    akses: {
      role: relawan.role || 'RELAWAN',
      petugasStok: String(relawan.roleStok || '').toUpperCase() === 'PETUGAS', // boolean bersih utk checkbox (Bagian Hak Akses Terpadu, 16 Okt 2026) -- hakAkses di bawah tetap dipertahankan (teks tampilan lama)
      hakAkses: (String(relawan.roleStok || '').toUpperCase() === 'PETUGAS') ? 'Petugas Stok (SIRAGA)' : 'Standar',
      statusAkun: akun ? String(akun.data[akun.idx.STATUS_AKUN] || '') : '(belum ada akun)',
      wajibGantiPassword: akun && akun.idx.WAJIB_GANTI_PASSWORD !== undefined ? !!akun.data[akun.idx.WAJIB_GANTI_PASSWORD] : false,
      terakhirLogin: akun && akun.idx.LOGIN_TERAKHIR !== undefined ? (akun.data[akun.idx.LOGIN_TERAKHIR] || null) : null
    },

    // Kelengkapan Profil (Bagian B.B): sistem TIDAK punya penanda "wajib"
    // resmi di kolom manapun (sudah dicek -- cuma Kontak Darurat yg
    // divalidasi saat disimpan). 7 item di bawah adalah definisi yang
    // MASUK AKAL utk "profil terpakai" (identitas+kontak+rekening+darurat),
    // ditetapkan di sini scr eksplisit -- BUKAN klaim aturan backend resmi.
    kelengkapan: (function () {
      const item = [
        { label: 'NIK', ada: !!relawan.nik },
        { label: 'Tanggal Lahir', ada: !!relawan.tanggalLahir },
        { label: 'Jenis Kelamin', ada: !!relawan.jenisKelamin },
        { label: 'Alamat', ada: !!relawan.alamat },
        { label: 'Nomor HP', ada: !!relawan.noHp },
        { label: 'Nomor Rekening', ada: !!relawan.nomorRekening },
        { label: 'Kontak Darurat', ada: !!(relawan.kontakDaruratNama && relawan.kontakDaruratNoHp) }
      ];
      const terisi = item.filter(function (i) { return i.ada; }).length;
      return { persen: Math.round((terisi / item.length) * 100), terisi: terisi, total: item.length, belumLengkap: item.filter(function (i) { return !i.ada; }).map(function (i) { return i.label; }) };
    })()
  };
}

/**
 * Edit profil relawan OLEH ADMIN (Bagian B.H, Redesain Menu Relawan) --
 * BEDA dari updateDataPribadiRelawan/updateKontakRelawan/updateAlamatRelawan/
 * updateKontakDaruratRelawan (4 fungsi self-service, masing2 pakai
 * requireAuthRelawan + cooldown 14 hari per kelompok -- itu MEMANG utk
 * membatasi relawan mengedit data SENDIRI, bukan utk Admin). Admin TIDAK
 * tunduk cooldown yang sama -- satu fungsi ini menangani SEMUA field
 * sekaligus (bukan 4 terpisah), field yg tidak dikirim tidak disentuh.
 * nama/divisi/status/nomorRekening TETAP lewat updateRelawan yang sudah
 * ada (Relawan.gs) -- fungsi ini KHUSUS field yg sebelumnya cuma bisa
 * diedit relawan sendiri (NIK, lahir, alamat, kontak, kontak darurat).
 */
function updateProfilRelawanAdmin(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'MANAJEMEN_PENGGUNA', 'EDIT');
  const idRelawan = sanitize(body.idRelawan);
  const baris = cariRelawanRow_(idRelawan);
  if (!baris) throw new Error('Data relawan tidak ditemukan.');
  const idx = baris.idx;
  const sheet = getSheet(NAMA_SHEET.RELAWAN);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const setJikaAda = function (field, kolom, pakaiTeks) {
      if (body[field] === undefined) return;
      if (idx[kolom] === undefined) return; // kolom belum ada di sheet -- lewati, jangan error
      if (pakaiTeks) paksaKolomTeks_(sheet, baris.baris, idx[kolom] + 1);
      sheet.getRange(baris.baris, idx[kolom] + 1).setValue(sanitize(body[field]));
    };
    setJikaAda('nik', 'NIK', true);
    setJikaAda('tempatLahir', 'TEMPAT_LAHIR');
    setJikaAda('tanggalLahir', 'TANGGAL_LAHIR', true);
    setJikaAda('jenisKelamin', 'JENIS_KELAMIN');
    setJikaAda('statusPernikahan', 'STATUS_PERNIKAHAN');
    setJikaAda('agama', 'AGAMA');
    setJikaAda('alamat', 'ALAMAT');
    setJikaAda('noHp', 'NO_HP', true);
    setJikaAda('email', 'EMAIL');
    setJikaAda('kontakDaruratNama', 'KONTAK_DARURAT_NAMA');
    setJikaAda('kontakDaruratHubungan', 'KONTAK_DARURAT_HUBUNGAN');
    setJikaAda('kontakDaruratHubunganLainnya', 'KONTAK_DARURAT_HUBUNGAN_LAINNYA');
    setJikaAda('kontakDaruratNoHp', 'KONTAK_DARURAT_NO_HP', true);

    _invalidasiCacheRelawan_(idRelawan);
    logAudit_('UBAH_PROFIL_RELAWAN_ADMIN', 'PROFIL_RELAWAN', idRelawan, aktor, {});
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function getProfilRelawan(token) {
  pastikanKolomProfilRelawan_();
  const idRelawan = requireAuthRelawan(token);
  const relawan = getRelawanById(idRelawan);
  if (!relawan) throw new Error('Data relawan tidak ditemukan.');

  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');
  const barisRelawan = cariRelawanRow_(idRelawan);
  const idx = akun.idx;

  return {
    id: relawan.id,
    nama: relawan.nama,
    divisi: relawan.divisi,
    jabatan: relawan.jabatan || '',
    status: relawan.status,
    tanggalBergabung: relawan.tanggalBergabung || '',
    username: akun.data[idx.USERNAME],

    // Field KONTAK & PROFIL -- di 01_DATA_RELAWAN (lihat getRelawanById di Relawan.gs).
    noHp: relawan.noHp || '',
    email: relawan.email || '',
    tempatLahir: relawan.tempatLahir || '',
    tanggalLahir: relawan.tanggalLahir || '',
    jenisKelamin: relawan.jenisKelamin || '',
    statusPernikahan: relawan.statusPernikahan || '',
    agama: relawan.agama || '',
    alamat: relawan.alamat || '',
    fotoProfilUrl: relawan.fotoProfilId ? urlFotoReference_(relawan.fotoProfilId) : null,
    gantiUsername: statusGantiUsername_(akun),

    // NIK -- SEKARANG ikut cooldown 14 hari kelompok "Data Pribadi" (BUKAN
    // lagi terkunci PERMANEN setelah sekali isi). Dikirim penuh (bukan
    // masked) -- ini permintaan profil MILIK SENDIRI lewat sesi yang
    // divalidasi (requireAuthRelawan), relawan lain tidak bisa memintanya.
    nik: relawan.nik || '',

    kontakDarurat: {
      nama: relawan.kontakDaruratNama || '',
      hubungan: relawan.kontakDaruratHubungan || '',
      hubunganLainnya: relawan.kontakDaruratHubunganLainnya || '',
      noHp: relawan.kontakDaruratNoHp || ''
    },

    // Bagian AKSES -- murni informasi, TIDAK BISA diedit dari halaman ini.
    akses: {
      role: relawan.role || 'RELAWAN',
      hakAkses: (String(relawan.roleStok || '').toUpperCase() === 'PETUGAS') ? 'Petugas Stok (SIRAGA)' : 'Standar',
      terakhirLogin: (idx.LOGIN_TERAKHIR !== undefined) ? (akun.data[idx.LOGIN_TERAKHIR] || null) : null
    },

    // BARU: status boleh-ubah per KELOMPOK (1 tombol = 1 kelompok = 1
    // cooldown bersama). `tanggalBolehLagi` (ISO) HANYA dipakai frontend
    // saat pengguna mencoba menekan tombol yang sedang terkunci -- bukan
    // ditampilkan proaktif di halaman utama.
    bolehUbah: {
      dataPribadi: infoCooldown_(barisRelawan, 'LAST_DATA_PRIBADI_CHANGE'),
      kontak: infoCooldown_(barisRelawan, 'LAST_KONTAK_CHANGE'),
      alamat: infoCooldown_(barisRelawan, 'LAST_ADDRESS_CHANGE'),
      kontakDarurat: infoCooldown_(barisRelawan, 'LAST_EMERGENCY_CONTACT_CHANGE'),
      fotoProfil: infoCooldown_(akun, 'LAST_PROFILE_PHOTO_CHANGE')
    }
  };
}

/**
 * 4 fungsi di bawah ini MENGGANTIKAN updateProfilRelawan (lama, per-field
 * independen) -- diaudit dulu, dipastikan TIDAK ada pemanggil lain selain
 * profil.js (yang ikut ditulis ulang di paket ini), jadi aman diganti
 * total, bukan sekadar ditambah.
 *
 * Beda utama: cooldown sekarang per KELOMPOK (1 tombol "Ubah ..." = 1
 * timestamp bersama utk SEMUA field di bagian itu), bukan per-field
 * independen -- supaya cocok dgn UI baru (tombol per bagian, sesuai
 * spesifikasi). Kelompok yg TERKUNCI menolak SELURUH permintaan (throw),
 * bukan diam-diam skip sebagian -- karena sekarang 1 tombol = 1 aksi
 * simpan yang jelas, bukan form gabungan banyak field independen.
 */

function updateDataPribadiRelawan(body) {
  pastikanKolomProfilRelawan_();
  const idRelawan = requireAuthRelawan(body.token);
  const baris = cariRelawanRow_(idRelawan);
  if (!baris) throw new Error('Data relawan tidak ditemukan.');

  // BARU: kalau masih terkunci, TIDAK throw -- dikembalikan sebagai hasil
  // normal (tersimpan:false) supaya tanggalBolehLagi (dipakai modal "Data
  // masih terkunci") ikut sampai ke frontend. Melempar Error di sini akan
  // membuang properti tambahan itu (Code.gs cuma meneruskan err.message).
  const info = infoCooldown_(baris, 'LAST_DATA_PRIBADI_CHANGE');
  if (!info.boleh) {
    return { success: true, tersimpan: false, tanggalBolehLagi: info.tanggalBolehLagi };
  }

  const nik = body.nik !== undefined ? sanitize(body.nik).replace(/\D/g, '') : undefined;
  if (nik !== undefined && nik && nik.length !== 16) throw new Error('NIK harus terdiri dari 16 digit angka.');
  const tanggalLahir = body.tanggalLahir !== undefined ? sanitize(body.tanggalLahir) : undefined;
  const jenisKelamin = body.jenisKelamin !== undefined ? sanitize(body.jenisKelamin) : undefined;
  if (jenisKelamin && ['Laki-laki', 'Perempuan'].indexOf(jenisKelamin) === -1) throw new Error('Jenis kelamin tidak valid.');
  const statusPernikahan = body.statusPernikahan !== undefined ? sanitize(body.statusPernikahan) : undefined;
  if (statusPernikahan && ['Belum Menikah', 'Menikah', 'Cerai Hidup', 'Cerai Mati'].indexOf(statusPernikahan) === -1) throw new Error('Status tidak valid.');

  const lock = LockService.getScriptLock(); // P2 -- cegah klik ganda/kiriman dobel saling menimpa baris yg sama
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.RELAWAN);
    const idx = baris.idx;
    if (nik !== undefined) sheet.getRange(baris.baris, idx.NIK + 1).setNumberFormat('@').setValue(nik);
    if (body.tempatLahir !== undefined) sheet.getRange(baris.baris, idx.TEMPAT_LAHIR + 1).setValue(sanitize(body.tempatLahir));
    if (tanggalLahir !== undefined) sheet.getRange(baris.baris, idx.TANGGAL_LAHIR + 1).setNumberFormat('@').setValue(tanggalLahir);
    if (jenisKelamin !== undefined) sheet.getRange(baris.baris, idx.JENIS_KELAMIN + 1).setValue(jenisKelamin);
    if (statusPernikahan !== undefined) sheet.getRange(baris.baris, idx.STATUS_PERNIKAHAN + 1).setValue(statusPernikahan);
    if (body.agama !== undefined) sheet.getRange(baris.baris, idx.AGAMA + 1).setValue(sanitize(body.agama));
    sheet.getRange(baris.baris, idx.LAST_DATA_PRIBADI_CHANGE + 1).setValue(new Date());

    _invalidasiCacheRelawan_(idRelawan);
    logAudit_('UBAH_DATA_PRIBADI', 'PROFIL_RELAWAN', idRelawan, idRelawan, {});
    return { success: true, tersimpan: true };
  } finally {
    lock.releaseLock();
  }
}

function updateKontakRelawan(body) {
  pastikanKolomProfilRelawan_();
  const idRelawan = requireAuthRelawan(body.token);
  const baris = cariRelawanRow_(idRelawan);
  if (!baris) throw new Error('Data relawan tidak ditemukan.');

  // BARU: kalau masih terkunci, TIDAK throw -- dikembalikan sebagai hasil
  // normal (tersimpan:false) supaya tanggalBolehLagi (dipakai modal "Data
  // masih terkunci") ikut sampai ke frontend. Melempar Error di sini akan
  // membuang properti tambahan itu (Code.gs cuma meneruskan err.message).
  const info = infoCooldown_(baris, 'LAST_KONTAK_CHANGE');
  if (!info.boleh) {
    return { success: true, tersimpan: false, tanggalBolehLagi: info.tanggalBolehLagi };
  }

  const noHp = sanitize(body.noHp);
  const email = sanitize(body.email);
  if (noHp && !/^0\d{8,14}$/.test(noHp.replace(/[\s-]/g, ''))) throw new Error('Nomor telepon tidak valid (mulai dari 0, 9-15 digit).');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Format email tidak valid.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.RELAWAN);
    const idx = baris.idx;
    sheet.getRange(baris.baris, idx.NO_HP + 1).setNumberFormat('@').setValue(noHp);
    sheet.getRange(baris.baris, idx.EMAIL + 1).setValue(email);
    sheet.getRange(baris.baris, idx.LAST_KONTAK_CHANGE + 1).setValue(new Date());

    _invalidasiCacheRelawan_(idRelawan);
    logAudit_('UBAH_KONTAK', 'PROFIL_RELAWAN', idRelawan, idRelawan, {});
    return { success: true, tersimpan: true };
  } finally {
    lock.releaseLock();
  }
}

function updateAlamatRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const baris = cariRelawanRow_(idRelawan);
  if (!baris || baris.idx.ALAMAT === undefined) throw new Error('Data relawan tidak ditemukan.');

  // BARU: kalau masih terkunci, TIDAK throw -- dikembalikan sebagai hasil
  // normal (tersimpan:false) supaya tanggalBolehLagi (dipakai modal "Data
  // masih terkunci") ikut sampai ke frontend. Melempar Error di sini akan
  // membuang properti tambahan itu (Code.gs cuma meneruskan err.message).
  const info = infoCooldown_(baris, 'LAST_ADDRESS_CHANGE');
  if (!info.boleh) {
    return { success: true, tersimpan: false, tanggalBolehLagi: info.tanggalBolehLagi };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.RELAWAN);
    sheet.getRange(baris.baris, baris.idx.ALAMAT + 1).setValue(sanitize(body.alamat));
    sheet.getRange(baris.baris, baris.idx.LAST_ADDRESS_CHANGE + 1).setValue(new Date());

    _invalidasiCacheRelawan_(idRelawan);
    logAudit_('UBAH_ALAMAT', 'PROFIL_RELAWAN', idRelawan, idRelawan, {});
    return { success: true, tersimpan: true };
  } finally {
    lock.releaseLock();
  }
}

function updateKontakDaruratRelawan(body) {
  pastikanKolomProfilRelawan_();
  const idRelawan = requireAuthRelawan(body.token);
  const baris = cariRelawanRow_(idRelawan);
  if (!baris || baris.idx.KONTAK_DARURAT_NAMA === undefined) throw new Error('Data relawan tidak ditemukan.');

  // BARU: kalau masih terkunci, TIDAK throw -- dikembalikan sebagai hasil
  // normal (tersimpan:false) supaya tanggalBolehLagi (dipakai modal "Data
  // masih terkunci") ikut sampai ke frontend. Melempar Error di sini akan
  // membuang properti tambahan itu (Code.gs cuma meneruskan err.message).
  const info = infoCooldown_(baris, 'LAST_EMERGENCY_CONTACT_CHANGE');
  if (!info.boleh) {
    return { success: true, tersimpan: false, tanggalBolehLagi: info.tanggalBolehLagi };
  }

  const nama = sanitize(body.nama);
  const hubungan = sanitize(body.hubungan);
  const hubunganLainnya = sanitize(body.hubunganLainnya);
  const noHp = sanitize(body.noHp);
  if (!nama || !hubungan || !noHp) throw new Error('Nama, Hubungan, dan Nomor Telepon wajib diisi.');
  if (hubungan === 'Lainnya' && !hubunganLainnya) throw new Error('Isi kolom "Hubungan Lainnya".');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.RELAWAN);
    const idx = baris.idx;
    sheet.getRange(baris.baris, idx.KONTAK_DARURAT_NAMA + 1).setValue(nama);
    sheet.getRange(baris.baris, idx.KONTAK_DARURAT_HUBUNGAN + 1).setValue(hubungan);
    sheet.getRange(baris.baris, idx.KONTAK_DARURAT_HUBUNGAN_LAINNYA + 1).setValue(hubungan === 'Lainnya' ? hubunganLainnya : '');
    sheet.getRange(baris.baris, idx.KONTAK_DARURAT_NO_HP + 1).setNumberFormat('@').setValue(noHp);
    sheet.getRange(baris.baris, idx.LAST_EMERGENCY_CONTACT_CHANGE + 1).setValue(new Date());

    _invalidasiCacheRelawan_(idRelawan);
    logAudit_('UBAH_KONTAK_DARURAT', 'PROFIL_RELAWAN', idRelawan, idRelawan, {});
    return { success: true, tersimpan: true };
  } finally {
    lock.releaseLock();
  }
}

const JEDA_GANTI_USERNAME_HARI = 14;

function statusGantiUsername_(akun) {
  if (akun.idx.USERNAME_DIUBAH_PADA === undefined) return { boleh: true, sisaHari: 0 };
  const terakhir = akun.data[akun.idx.USERNAME_DIUBAH_PADA];
  if (!(terakhir instanceof Date)) return { boleh: true, sisaHari: 0 };
  const selisihHari = Math.floor((Date.now() - terakhir.getTime()) / 86400000);
  const sisa = JEDA_GANTI_USERNAME_HARI - selisihHari;
  return sisa > 0 ? { boleh: false, sisaHari: sisa } : { boleh: true, sisaHari: 0 };
}

/**
 * FUNGSI GENERIK cooldown (14 hari) untuk field/kelompok profil yang bisa
 * diubah relawan sendiri. Dipakai baik untuk cooldown PER-FIELD (Foto
 * Profil) maupun PER-KELOMPOK (Data Pribadi, Kontak, Alamat, Kontak
 * Darurat -- 1 timestamp bersama untuk semua field dalam 1 tombol "Ubah").
 *
 * BARU: sekarang mengembalikan TANGGAL BOLEH LAGI (ISO, kalau memang
 * sedang terkunci) -- dipakai frontend HANYA saat pengguna mencoba
 * menekan tombol yang terkunci ("Data dapat diubah kembali pada ...").
 * TIDAK dipakai untuk menampilkan countdown proaktif di halaman utama.
 */
const JEDA_PROFIL_HARI = 14;
function infoCooldown_(objek, namaKolomTimestamp) {
  if (!objek || objek.idx[namaKolomTimestamp] === undefined) return { boleh: true, tanggalBolehLagi: null }; // kolom belum ada -- backward compatible, anggap boleh
  const terakhir = objek.data[objek.idx[namaKolomTimestamp]];
  if (!(terakhir instanceof Date)) return { boleh: true, tanggalBolehLagi: null };
  const bolehLagiPada = new Date(terakhir.getTime() + JEDA_PROFIL_HARI * 86400000);
  const boleh = Date.now() >= bolehLagiPada.getTime();
  return { boleh: boleh, tanggalBolehLagi: boleh ? null : bolehLagiPada.toISOString() };
}

/** Wrapper ringkas (boolean saja) -- dipertahankan untuk pemanggil yang cuma butuh true/false (mis. simpanFotoProfilRelawan). */
function bolehUbahField_(akun, namaKolomTimestamp) {
  return infoCooldown_(akun, namaKolomTimestamp).boleh;
}

/** Ganti username relawan -- menyentuh JALUR LOGIN, validasi ketat. */
function gantiUsernameRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');
  if (akun.idx.USERNAME_DIUBAH_PADA === undefined) {
    throw new Error('Kolom USERNAME_DIUBAH_PADA belum ada di 07_AKUN_RELAWAN. Hubungi Admin untuk menambahkannya.');
  }
  const status = statusGantiUsername_(akun);
  if (!status.boleh) throw new Error('Data ini belum dapat diubah saat ini.');

  const baru = sanitize(body.usernameBaru).toLowerCase();
  if (baru.length < 4) throw new Error('Username minimal 4 karakter.');
  if (!/^[a-z0-9._]+$/.test(baru)) throw new Error('Username hanya boleh huruf kecil, angka, titik, dan garis bawah.');
  if (baru === String(akun.data[akun.idx.USERNAME]).toLowerCase()) throw new Error('Username baru sama dengan yang sekarang.');

  const semuaAkun = sheetToObjects(getAkunSheet());
  const bentrok = semuaAkun.some(a => String(a.USERNAME).toLowerCase() === baru && String(a.ID_RELAWAN) !== idRelawan);
  if (bentrok) throw new Error('Username "' + baru + '" sudah dipakai. Silakan pilih yang lain.');

  const sheet = getAkunSheet();
  sheet.getRange(akun.baris, akun.idx.USERNAME + 1).setValue(baru);
  sheet.getRange(akun.baris, akun.idx.USERNAME_DIUBAH_PADA + 1).setValue(new Date());
  _invalidasiCacheAkun_(idRelawan);
  logAudit_('GANTI_USERNAME', 'AKUN_RELAWAN', idRelawan, idRelawan, { usernameBaru: baru });
  try { kirimPushNotifikasi_(idRelawan, 'Username Berhasil Diubah', 'Username akun kamu sekarang: ' + baru + '. Kalau bukan kamu yang mengubah, segera hubungi Admin.', {}); } catch (e) { /* jangan gagalkan ganti username kalau push gagal */ }
  return { success: true, username: baru };
}

/** Simpan foto profil ke Drive (folder terpisah dari swafoto absensi). */
function simpanFotoProfilRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');
  const barisRelawan = cariRelawanRow_(idRelawan); // FOTO_PROFIL disimpan di 01_DATA_RELAWAN
  if (!barisRelawan || barisRelawan.idx.FOTO_PROFIL === undefined) {
    throw new Error('Kolom FOTO_PROFIL belum ada di 01_DATA_RELAWAN. Hubungi Admin untuk menambahkannya.');
  }
  // Cooldown-nya TETAP di 07_AKUN_RELAWAN (LAST_PROFILE_PHOTO_CHANGE) --
  // lihat catatan pembagian kolom: timestamp cooldown tetap berdekatan
  // dengan kolom lain yang sudah ada di sheet akun.
  if (!body.fotoBase64) throw new Error('Foto belum dipilih.');
  const infoFoto = infoCooldown_(akun, 'LAST_PROFILE_PHOTO_CHANGE');
  if (!infoFoto.boleh) {
    return { success: true, tersimpan: false, tanggalBolehLagi: infoFoto.tanggalBolehLagi };
  }
  const cocok = String(body.fotoBase64).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!cocok) throw new Error('Format foto tidak dikenali.');
  if (['jpeg', 'jpg', 'png', 'webp'].indexOf(cocok[1].toLowerCase()) === -1) {
    throw new Error('Format foto harus JPG, PNG, atau WEBP.');
  }
  const perkiraanUkuranByte = cocok[2].length * 0.75;
  if (perkiraanUkuranByte > 5 * 1024 * 1024) throw new Error('Ukuran foto maksimal 5MB.');

  const blob = Utilities.newBlob(Utilities.base64Decode(cocok[2]), 'image/' + cocok[1], 'profil-' + idRelawan + '.jpg');
  const root = DriveApp.getRootFolder();
  const folder = getOrCreateFolder_(root, 'FOTO_PROFIL_SPPG_JEUNGJING');
  const lama = barisRelawan.data[barisRelawan.idx.FOTO_PROFIL];
  if (lama) { try { DriveApp.getFileById(lama).setTrashed(true); } catch (e) { /* file sudah hilang -- abaikan */ } }

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  getSheet(NAMA_SHEET.RELAWAN).getRange(barisRelawan.baris, barisRelawan.idx.FOTO_PROFIL + 1).setValue(file.getId());
  if (akun.idx.LAST_PROFILE_PHOTO_CHANGE !== undefined) {
    getAkunSheet().getRange(akun.baris, akun.idx.LAST_PROFILE_PHOTO_CHANGE + 1).setValue(new Date());
  }
  _invalidasiCacheRelawan_(idRelawan);
  _invalidasiCacheAkun_(idRelawan);
  return { success: true, tersimpan: true, fotoProfilUrl: urlFotoReference_(file.getId()) };
}

function gantiPasswordRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');

  const passwordLama = body.passwordLama || '';
  const passwordBaru = body.passwordBaru || '';
  if (passwordBaru.length < 6) throw new Error('Password baru minimal 6 karakter.');

  const hashLama = hashPassword(passwordLama, akun.data[akun.idx.SALT]);
  if (hashLama !== akun.data[akun.idx.PASSWORD_HASH]) throw new Error('Password lama salah.');

  const saltBaru = Utilities.getUuid();
  const hashBaru = hashPassword(passwordBaru, saltBaru);

  const sheet = getAkunSheet();
  sheet.getRange(akun.baris, akun.idx.PASSWORD_HASH + 1).setValue(hashBaru);
  sheet.getRange(akun.baris, akun.idx.SALT + 1).setValue(saltBaru);
  sheet.getRange(akun.baris, akun.idx.WAJIB_GANTI_PASSWORD + 1).setValue(false);
  _invalidasiCacheAkun_(idRelawan);

  logAudit_('GANTI_PASSWORD', 'AKUN_RELAWAN', idRelawan, idRelawan, {});
  // Konfirmasi keamanan: kalau BUKAN relawan itu sendiri yang mengganti
  // (akun dicuri/disalahgunakan), setidaknya pemilik asli tahu lewat push.
  try { kirimPushNotifikasi_(idRelawan, 'Password Berhasil Diubah', 'Password akun kamu baru saja diganti. Kalau bukan kamu yang mengubah, segera hubungi Admin.', {}); } catch (e) { /* jangan gagalkan ganti password kalau push gagal */ }

  return { success: true };
}



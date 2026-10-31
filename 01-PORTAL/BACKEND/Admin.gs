/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Admin.gs — Login admin & manajemen sesi
 */

function adminLogin(username, password) {
  username = sanitize(username);
  if (!username || !password) throw new Error('Username dan password wajib diisi.');

  const sheet = getSheet(NAMA_SHEET.ADMIN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxUser = headers.indexOf('USERNAME');
  const idxHash = headers.indexOf('PASSWORD_HASH');
  const idxSalt = headers.indexOf('SALT');
  const idxStatus = headers.indexOf('STATUS'); // -1 kalau kolom belum ada (akun lama) -- itu OK

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]).toLowerCase() === username.toLowerCase()) {
      // Backward compatible: kalau kolom STATUS belum ada, ATAU kosong,
      // anggap AKTIF (supaya akun Admin existing tidak pernah ter-lock
      // keluar hanya karena kolom baru ini ditambahkan).
      const status = idxStatus !== -1 ? String(data[i][idxStatus] || 'AKTIF').toUpperCase() : 'AKTIF';
      if (status === 'NONAKTIF') throw new Error('Akun Pengelola ini sudah dinonaktifkan.');

      const salt = data[i][idxSalt];
      const hash = hashPassword(password, salt);
      if (hash === data[i][idxHash]) {
        const token = generateToken();
        // Sesi disimpan di CacheService (server), BUKAN di browser/localStorage.
        // Maksimal masa berlaku CacheService adalah 6 jam.
        CacheService.getScriptCache().put('sesi_' + token, username, 21600);
        // Role dikirim ke frontend supaya UI bisa disesuaikan (Staff = akses
        // monitoring terbatas) -- pembatasan SESUNGGUHNYA tetap ditegakkan
        // di backend lewat requireAuth(token), ini HANYA untuk tampilan.
        const idxRole = headers.indexOf('ROLE');
        const role = idxRole !== -1 ? (String(data[i][idxRole] || 'ADMIN').toUpperCase() === 'STAFF' ? 'STAFF' : 'ADMIN') : 'ADMIN';

        // BARU 30 Okt 2026 (Tahap 3 lanjutan): token terpusat, pola SAMA
        // dgn relawanLogin (lihat Akun.gs & catatan di AuthTerpusat.gs).
        // ADITIF, dibungkus try/catch -- login TETAP normal kalau secret
        // belum disiapkan ATAU akun ini belum py ID_RELAWAN_TERKAIT.
        // idRelawan dari ID_RELAWAN_TERKAIT kalau terisi (akun admin yg
        // sudah tertaut ke identitas relawan/staf) -- kalau KOSONG
        // (admin teknis tanpa identitas relawan), pakai 'ADMIN:'+username
        // sbg identitas pengganti, supaya modul lain (SIPENDOK dkk)
        // TETAP bisa mengenali "siapa" walau bukan format ID_RELAWAN asli.
        let tokenTerpusat = '';
        try {
          const idxTerkait = headers.indexOf('ID_RELAWAN_TERKAIT');
          const idRelawanUtkToken = (idxTerkait !== -1 && data[i][idxTerkait]) ? String(data[i][idxTerkait]) : ('ADMIN:' + username);
          tokenTerpusat = buatTokenTerpusat_(idRelawanUtkToken, username, role === 'STAFF' ? 'STAFF' : 'SUPER_ADMIN');
        } catch (e) { /* belum disetup -- aman diabaikan, lihat catatan sama di Akun.gs */ }

        return { token: token, username: username, role: role, tokenTerpusat: tokenTerpusat };
      }
      break;
    }
  }
  throw new Error('Username atau password salah.');
}

/**
 * Validasi sesi Admin yang SUDAH ADA -- dipakai frontend untuk memulihkan
 * sesi setelah refresh/buka ulang halaman, TANPA perlu username/password
 * lagi. Kalau token masih berlaku, kembalikan info yang sama seperti
 * adminLogin (username, role). Kalau tidak, requireAuth sendiri yang
 * melempar error "Sesi tidak valid"/"Sesi telah berakhir. Silakan login
 * kembali." -- pesan yang SAMA dipakai konsisten di semua tempat lain,
 * supaya frontend bisa mendeteksi "perlu login ulang" lewat 1 pola teks
 * yang seragam (lihat apakahErrorSesiTidakValid di auth-admin.js).
 */
function validasiSesiAdmin(token) {
  const username = requireAuth(token, true); // true = Staff juga boleh restore sesinya sendiri
  const role = getRolePengelola_(username);
  return { username: username, role: role };
}

/**
 * JEMBATAN SIPANDU UNTUK ADMIN.
 * Admin (akun 06_ADMIN, terpisah dari akun relawan) "dipinjamkan" sesi
 * relawan miliknya SENDIRI supaya bisa dapat akses SIPANDU (role SIPANDU
 * dicek berdasarkan ID_RELAWAN, bukan akun Admin).
 *
 * DISEDERHANAKAN setelah SIPANDU digabung ke proyek yang sama: dulu WAJIB
 * menulis token ke sheet (TOKEN_AKTIF/TOKEN_KADALUARSA) supaya bisa
 * divalidasi lintas-proyek. SEKARANG cukup CacheService biasa -- SIPANDU
 * membaca CacheService yang SAMA (1 proyek), tidak perlu tulis ke sheet.
 *
 * Keamanan: HANYA bisa masuk sebagai relawan yang SUDAH DITAUTKAN ke akun
 * Admin itu sendiri (kolom ID_RELAWAN_TERKAIT di 06_ADMIN).
 */
function masukSebagaiRelawanUntukSipandu(token) {
  const username = requireAuth(token);

  const sheetAdmin = getSheet(NAMA_SHEET.ADMIN);
  const data = sheetAdmin.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxUser = headers.indexOf('USERNAME');
  const idxRelawanTerkait = headers.indexOf('ID_RELAWAN_TERKAIT');

  if (idxRelawanTerkait === -1) {
    throw new Error('Kolom ID_RELAWAN_TERKAIT belum ada di 06_ADMIN. Tambahkan dulu, lalu isi dengan ID relawan Anda sendiri (mis. R001).');
  }

  let idRelawanTerkait = '';
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]).toLowerCase() === username.toLowerCase()) {
      idRelawanTerkait = String(data[i][idxRelawanTerkait] || '').trim();
      break;
    }
  }
  if (!idRelawanTerkait) {
    throw new Error('Akun Admin ini belum ditautkan ke relawan mana pun. Isi kolom ID_RELAWAN_TERKAIT di 06_ADMIN dengan ID relawan Anda (mis. R001).');
  }

  const relawan = getRelawanById(idRelawanTerkait);
  if (!relawan || String(relawan.status).toUpperCase() !== 'AKTIF') {
    throw new Error('Data relawan tertaut (' + idRelawanTerkait + ') tidak aktif.');
  }

  const relawanToken = generateToken();
  CacheService.getScriptCache().put('sesi_relawan_' + relawanToken, idRelawanTerkait, 21600);

  logAudit_('JEMBATAN_SIPANDU', 'ADMIN', idRelawanTerkait, username, { masukSebagai: relawan.nama });
  return {
    token: relawanToken,
    idRelawan: idRelawanTerkait,
    nama: relawan.nama,
    divisi: relawan.divisi,
    wajibGantiPassword: false
  };
}

/**
 * Dipanggil di awal setiap aksi admin untuk memastikan sesi masih berlaku.
 *
 * SEJAK penambahan role STAFF (monitoring, akses terbatas): parameter kedua
 * `izinkanStaff` menentukan apakah akun ber-role STAFF boleh memanggil aksi
 * ini. DEFAULT-nya `false` (harus ADMIN/akses penuh) -- supaya SEMUA
 * pemanggilan requireAuth(token) yang sudah ada di seluruh kode (tanpa
 * parameter kedua) OTOMATIS jadi khusus-Admin tanpa perlu diubah satu-satu.
 * Fungsi yang memang boleh diakses Staff (daftar monitoring yang disepakati)
 * memanggil requireAuth(token, true) secara eksplisit -- lihat masing-masing.
 *
 * @param {string} token
 * @param {boolean} [izinkanStaff] true HANYA untuk aksi monitoring read-only yang disepakati boleh diakses Staff.
 */
function requireAuth(token, izinkanStaff) {
  if (!token) throw new Error('Sesi tidak valid. Silakan login kembali.');
  const username = CacheService.getScriptCache().get('sesi_' + token);
  if (!username) throw new Error('Sesi telah berakhir. Silakan login kembali.');
  if (!izinkanStaff && getRolePengelola_(username) === 'STAFF') {
    throw new Error('Akun Staff tidak memiliki akses ke fitur ini -- khusus Admin (akses penuh).');
  }
  return username;
}

/** Role akun Pengelola (ADMIN/STAFF) dari sheet 06_ADMIN. Backward compatible: kolom ROLE belum ada / akun tidak ketemu -> dianggap ADMIN (tidak pernah diam-diam mengunci akun yang sudah berjalan). */
function getRolePengelola_(username) {
  const sheet = getSheet(NAMA_SHEET.ADMIN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxUser = headers.indexOf('USERNAME');
  const idxRole = headers.indexOf('ROLE');
  if (idxRole === -1) return 'ADMIN';
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]).toLowerCase() === String(username).toLowerCase()) {
      return String(data[i][idxRole] || 'ADMIN').toUpperCase() === 'STAFF' ? 'STAFF' : 'ADMIN';
    }
  }
  return 'ADMIN';
}

/**
 * JALANKAN FUNGSI INI SATU KALI SAJA dari editor Apps Script untuk membuat
 * (atau mengganti) akun admin Anda:
 *   1. Ganti nilai USERNAME_BARU dan PASSWORD_BARU di bawah ini.
 *   2. Pilih fungsi "setupAdminPassword" pada dropdown di atas editor Apps Script.
 *   3. Klik tombol "Run" (▶). Berikan izin akses saat diminta.
 *   4. Cek sheet 06_ADMIN — baris kedua akan terisi otomatis.
 *   5. Setelah berhasil, sebaiknya kosongkan kembali PASSWORD_BARU di kode ini
 *      agar password asli tidak tertinggal sebagai teks biasa di dalam skrip.
 */
function setupAdminPassword() {
  const USERNAME_BARU = 'admin';
  const PASSWORD_BARU = 'GantiPasswordIni123';

  const salt = Utilities.getUuid();
  const hash = hashPassword(PASSWORD_BARU, salt);
  const sheet = getSheet(NAMA_SHEET.ADMIN);
  sheet.getRange(2, 1, 1, 3).setValues([[USERNAME_BARU, hash, salt]]);
  Logger.log('Akun admin berhasil dibuat/diperbarui. Username: ' + USERNAME_BARU);
}

/**
 * LUPA PASSWORD ADMIN — bagian 1 dari 2.
 * DIJALANKAN MANUAL dari editor Apps Script oleh developer/pengelola
 * sistem (BUKAN dipanggil dari web) -- sesuai teks yang sudah ada di
 * admin.html: "Kode reset didapat dari developer/pengelola sistem —
 * dibuat manual, bukan otomatis. Berlaku 15 menit."
 *
 * Cara pakai: ganti USERNAME_ADMIN di bawah, jalankan fungsi ini dari
 * editor, lalu lihat kode 6 digit di Logger (View > Logs) dan sampaikan
 * ke Admin yang bersangkutan lewat WhatsApp/telepon (BUKAN lewat email/
 * chat yang bisa disadap, karena kode ini setara akses masuk).
 *
 * Butuh 2 kolom baru di 06_ADMIN: RESET_KODE, RESET_KODE_KADALUARSA
 */
function buatKodeResetAdminPassword() {
  const USERNAME_ADMIN = 'admin'; // <-- GANTI dengan username Admin yang lupa password

  const sheet = getSheet(NAMA_SHEET.ADMIN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxUser = headers.indexOf('USERNAME');
  const idxKode = headers.indexOf('RESET_KODE');
  const idxKadaluarsa = headers.indexOf('RESET_KODE_KADALUARSA');

  if (idxKode === -1 || idxKadaluarsa === -1) {
    throw new Error('Kolom RESET_KODE / RESET_KODE_KADALUARSA belum ada di 06_ADMIN. Tambahkan dulu kedua kolom itu.');
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]).toLowerCase() === USERNAME_ADMIN.toLowerCase()) {
      const kode = String(Math.floor(100000 + Math.random() * 900000)); // 6 digit
      const kadaluarsa = new Date(Date.now() + 15 * 60 * 1000);
      sheet.getRange(i + 1, idxKode + 1).setValue(kode);
      sheet.getRange(i + 1, idxKadaluarsa + 1).setValue(kadaluarsa);
      Logger.log('Kode reset untuk "' + USERNAME_ADMIN + '": ' + kode + ' (berlaku 15 menit sampai ' + kadaluarsa + ')');
      return;
    }
  }
  throw new Error('Username Admin "' + USERNAME_ADMIN + '" tidak ditemukan di 06_ADMIN.');
}

/**
 * LUPA PASSWORD ADMIN — bagian 2 dari 2.
 * Dipanggil dari web (form "Lupa Password" di admin.html) setelah Admin
 * menerima kode dari langkah 1 di atas.
 */
function resetAdminPasswordWithCode(body) {
  const username = sanitize(body.username);
  const kode = sanitize(body.kode);
  const passwordBaru = body.passwordBaru;
  if (!username || !kode || !passwordBaru) throw new Error('Username, kode, dan password baru wajib diisi.');
  if (String(passwordBaru).length < 6) throw new Error('Password baru minimal 6 karakter.');

  const sheet = getSheet(NAMA_SHEET.ADMIN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxUser = headers.indexOf('USERNAME');
  const idxKode = headers.indexOf('RESET_KODE');
  const idxKadaluarsa = headers.indexOf('RESET_KODE_KADALUARSA');
  const idxHash = headers.indexOf('PASSWORD_HASH');
  const idxSalt = headers.indexOf('SALT');

  if (idxKode === -1 || idxKadaluarsa === -1) {
    throw new Error('Kolom RESET_KODE / RESET_KODE_KADALUARSA belum ada di 06_ADMIN.');
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]).toLowerCase() === username.toLowerCase()) {
      const kodeTersimpan = String(data[i][idxKode] || '');
      const kadaluarsa = data[i][idxKadaluarsa];

      if (!kodeTersimpan || kodeTersimpan !== kode) {
        throw new Error('Kode reset salah. Minta kode baru dari developer/pengelola sistem.');
      }
      if (!(kadaluarsa instanceof Date) || kadaluarsa.getTime() < Date.now()) {
        throw new Error('Kode reset sudah kadaluarsa (berlaku 15 menit). Minta kode baru.');
      }

      const salt = Utilities.getUuid();
      const hash = hashPassword(passwordBaru, salt);
      sheet.getRange(i + 1, idxHash + 1).setValue(hash);
      sheet.getRange(i + 1, idxSalt + 1).setValue(salt);
      // Kode dipakai sekali -- kosongkan supaya tidak bisa dipakai ulang.
      sheet.getRange(i + 1, idxKode + 1).setValue('');
      sheet.getRange(i + 1, idxKadaluarsa + 1).setValue('');

      logAudit_('RESET_PASSWORD_ADMIN', 'ADMIN', username, username, {});
      return { success: true };
    }
  }
  throw new Error('Username Admin tidak ditemukan.');
}

/** Logout Admin -- hapus sesi dari CacheService supaya token tidak bisa dipakai lagi. */
function logoutAdmin(body) {
  if (body && body.token) {
    CacheService.getScriptCache().remove('sesi_' + body.token);
  }
  return { success: true };
}


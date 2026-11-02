/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * PengelolaSPPG.gs — Kelola banyak akun Pengelola/Admin (BARU)
 *
 * Sheet 06_ADMIN SUDAH MENDUKUNG banyak baris sejak awal (adminLogin sudah
 * generik, loop semua baris) -- yang belum ada cuma UI untuk kelolanya.
 * File ini MENAMBAHKAN itu, TANPA mengubah cara login/autentikasi yang
 * sudah berjalan.
 *
 * Kolom BARU yang dibutuhkan di 06_ADMIN (backward compatible -- kalau
 * belum ada, kode di bawah otomatis anggap semua akun existing "AKTIF"
 * supaya akun Admin yang sudah ada TIDAK PERNAH ter-lock keluar):
 *   NAMA | STATUS (AKTIF/NONAKTIF) | ROLE (ADMIN) | DIBUAT_PADA
 */

function getDaftarPengelola(token) {
  requireAuth(token);
  const sheet = getSheet(NAMA_SHEET.ADMIN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  const daftar = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][idx.USERNAME]) continue; // baris kosong
    daftar.push({
      username: data[i][idx.USERNAME],
      nama: idx.NAMA !== undefined ? (data[i][idx.NAMA] || '') : '',
      // Backward compatible: kolom STATUS belum tentu ada di sheet lama --
      // kalau belum ada, SEMUA akun existing dianggap AKTIF (tidak pernah
      // mengunci akun Admin yang sudah berjalan).
      status: idx.STATUS !== undefined ? (data[i][idx.STATUS] || 'AKTIF') : 'AKTIF',
      role: idx.ROLE !== undefined ? (data[i][idx.ROLE] || 'ADMIN') : 'ADMIN',
      dibuatPada: idx.DIBUAT_PADA !== undefined ? data[i][idx.DIBUAT_PADA] : ''
    });
  }
  return daftar;
}

function addPengelola(body) {
  const akses = requireAuth(body.token);
  const username = sanitize(body.username);
  const password = body.password;
  const nama = sanitize(body.nama);
  if (!username) throw new Error('Username wajib diisi.');
  if (!password || String(password).length < 6) throw new Error('Password minimal 6 karakter.');

  const sheet = getSheet(NAMA_SHEET.ADMIN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxUser = headers.indexOf('USERNAME');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]).toLowerCase() === username.toLowerCase()) {
      throw new Error('Username "' + username + '" sudah dipakai.');
    }
  }
  ['NAMA', 'STATUS', 'ROLE', 'DIBUAT_PADA'].forEach(kolom => {
    if (headers.indexOf(kolom) === -1) {
      throw new Error('Kolom "' + kolom + '" belum ada di sheet 06_ADMIN. Tambahkan dulu kolom ini (di baris header) sebelum menambah Pengelola baru.');
    }
  });

  const salt = Utilities.getUuid();
  const hash = hashPassword(password, salt);
  const idxSalt = headers.indexOf('SALT');
  const idxHash = headers.indexOf('PASSWORD_HASH');
  const idxNama = headers.indexOf('NAMA');
  const idxStatus = headers.indexOf('STATUS');
  const idxRole = headers.indexOf('ROLE');
  const idxDibuat = headers.indexOf('DIBUAT_PADA');

  const barisBaru = new Array(headers.length).fill('');
  barisBaru[idxUser] = username;
  barisBaru[idxSalt] = salt;
  barisBaru[idxHash] = hash;
  barisBaru[idxNama] = nama;
  barisBaru[idxStatus] = 'AKTIF';
  barisBaru[idxRole] = sanitize(body.role) || 'ADMIN';
  barisBaru[idxDibuat] = new Date();
  sheet.appendRow(barisBaru);

  logAudit_('TAMBAH_PENGELOLA', 'PENGELOLA_SPPG', username, akses, { nama: nama });
  return { success: true, username: username };
}

function updatePengelola(body) {
  const akses = requireAuth(body.token);
  const username = sanitize(body.username);
  if (!username) throw new Error('Username wajib diisi.');

  const sheet = getSheet(NAMA_SHEET.ADMIN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxUser = headers.indexOf('USERNAME');
  const idxNama = headers.indexOf('NAMA');
  const idxRole = headers.indexOf('ROLE');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]).toLowerCase() === username.toLowerCase()) {
      if (idxNama !== -1 && body.nama !== undefined) {
        sheet.getRange(i + 1, idxNama + 1).setValue(sanitize(body.nama));
      }
      if (idxRole !== -1 && body.role) {
        sheet.getRange(i + 1, idxRole + 1).setValue(sanitize(body.role));
      }
      logAudit_('UBAH_PENGELOLA', 'PENGELOLA_SPPG', username, akses, { nama: body.nama, role: body.role });
      return { success: true };
    }
  }
  throw new Error('Akun Pengelola tidak ditemukan.');
}

/** Aktifkan/nonaktifkan akun Pengelola. Tidak bisa menonaktifkan akun yang sedang dipakai (diri sendiri) -- mencegah admin terkunci keluar tanpa akun lain. */
function setStatusPengelola(body) {
  const akses = requireAuth(body.token);
  const username = sanitize(body.username);
  const statusBaru = body.aktif ? 'AKTIF' : 'NONAKTIF';
  if (!username) throw new Error('Username wajib diisi.');
  if (!body.aktif && username.toLowerCase() === String(akses).toLowerCase()) {
    throw new Error('Tidak bisa menonaktifkan akun yang sedang Anda gunakan sendiri.');
  }

  const sheet = getSheet(NAMA_SHEET.ADMIN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxUser = headers.indexOf('USERNAME');
  const idxStatus = headers.indexOf('STATUS');
  if (idxStatus === -1) throw new Error('Kolom "STATUS" belum ada di sheet 06_ADMIN. Tambahkan dulu kolom ini.');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]).toLowerCase() === username.toLowerCase()) {
      sheet.getRange(i + 1, idxStatus + 1).setValue(statusBaru);
      logAudit_('SET_STATUS_PENGELOLA', 'PENGELOLA_SPPG', username, akses, { status: statusBaru });
      return { success: true };
    }
  }
  throw new Error('Akun Pengelola tidak ditemukan.');
}


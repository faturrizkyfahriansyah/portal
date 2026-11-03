/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * PengelolaSPPG.gs — Kelola banyak akun Pengelola/Admin, DENGAN JABATAN (ditulis ulang 4 Nov 2026).
 *
 * KEPUTUSAN ADMIN (3 Nov 2026): Kepala SPPG, Pengawas/Ahli Gizi, dan Pengawas Keuangan didaftarkan di sini sebagai
 * Pengelola dengan JABATAN. Jabatan menentukan ROLE_BARU (hak akses yang diatur di Manajemen Hak Akses, yang TETAP).
 *
 * PERBAIKAN: versi lama menolak menambah akun bila kolom STATUS/ROLE/DIBUAT_PADA belum ada di 06_ADMIN -- padahal sheet
 * nyata tidak memilikinya, jadi menu ini tidak bisa menambah akun. Sekarang kolom ditambahkan OTOMATIS (di kanan, data lama
 * tidak berubah). adminLogin memperlakukan STATUS kosong sebagai AKTIF, jadi akun lama TIDAK terkunci.
 *
 * PERHATIAN KEAMANAN: akun tanpa ROLE_BARU dianggap SUPER_ADMIN (akses penuh) oleh cekIzinModul_. Karena itu jabatan selain
 * "Pengelola" SELALU mengisi ROLE_BARU; dan sistem menolak operasi yang membuat akses penuh habis (lihat jumlahSuperAdminAktif_).
 */
var JABATAN_PENGELOLA = {
  PENGELOLA:         { nama: 'Pengelola (akses penuh)', roleBaru: '' },
  KEPALA_SPPG:       { nama: 'Kepala SPPG', roleBaru: 'KEPALA_SPPG' },
  PENGAWAS_GIZI:     { nama: 'Pengawas Gizi / Ahli Gizi', roleBaru: 'PENGAWAS_GIZI' },
  PENGAWAS_KEUANGAN: { nama: 'Pengawas Keuangan', roleBaru: 'PENGAWAS_KEUANGAN' },
  ADMIN_OPERASIONAL: { nama: 'Admin Operasional', roleBaru: 'ADMIN_OPERASIONAL' },
  KOORDINATOR:       { nama: 'Koordinator Operasional', roleBaru: 'KOORDINATOR_OPERASIONAL' }
};
var KOLOM_PENGELOLA = ['NAMA', 'STATUS', 'ROLE', 'DIBUAT_PADA', 'JABATAN', 'ROLE_BARU'];

/** Pastikan kolom tersedia (ditambah di kanan bila belum ada), lalu baca seluruh sheet. */
function bacaPengelola_() {
  const sheet = getSheet(NAMA_SHEET.ADMIN);
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  const kurang = KOLOM_PENGELOLA.filter(function (k) { return headers.indexOf(k) < 0; });
  if (kurang.length) { sheet.getRange(1, headers.length + 1, 1, kurang.length).setValues([kurang]); headers = headers.concat(kurang); }
  const idx = {}; headers.forEach(function (h, i) { idx[h] = i; });
  const data = sheet.getDataRange().getValues();
  return { sheet: sheet, data: data, idx: idx, headers: headers };
}
function roleEfektifPengelola_(baris, idx) { return String(baris[idx.ROLE_BARU] || '').trim() || 'SUPER_ADMIN'; }
function pengelolaAktif_(baris, idx) { return String(baris[idx.STATUS] || 'AKTIF').toUpperCase() !== 'NONAKTIF'; }
function jabatanDariBaris_(baris, idx) {
  const kode = String(baris[idx.JABATAN] || '').trim().toUpperCase();
  if (JABATAN_PENGELOLA[kode]) return kode;
  const role = String(baris[idx.ROLE_BARU] || '').trim();
  if (!role || role === 'SUPER_ADMIN') return 'PENGELOLA';
  const cocok = Object.keys(JABATAN_PENGELOLA).filter(function (k) { return JABATAN_PENGELOLA[k].roleBaru === role; })[0];
  return cocok || '';
}
/** Jumlah akun AKTIF berakses penuh (SUPER_ADMIN) selain `kecuali` -- pengaman agar akses penuh tidak pernah habis. */
function jumlahSuperAdminAktif_(p, kecuali) {
  let n = 0;
  for (let i = 1; i < p.data.length; i++) {
    const u = String(p.data[i][p.idx.USERNAME] || ''); if (!u) continue;
    if (kecuali && u.toLowerCase() === String(kecuali).toLowerCase()) continue;
    if (pengelolaAktif_(p.data[i], p.idx) && roleEfektifPengelola_(p.data[i], p.idx) === 'SUPER_ADMIN') n++;
  }
  return n;
}
function cariBarisPengelola_(p, username) {
  for (let i = 1; i < p.data.length; i++) if (String(p.data[i][p.idx.USERNAME]).toLowerCase() === String(username).toLowerCase()) return i;
  return -1;
}
function roleBaruDariJabatan_(jabatan) {
  const j = JABATAN_PENGELOLA[jabatan];
  if (!j) throw new Error('Jabatan tidak dikenal. Pilihan: ' + Object.keys(JABATAN_PENGELOLA).join(', ') + '.');
  if (j.roleBaru) {
    const ada = sheetToObjects(getRolePortalSheet_()).some(function (r) { return r.KODE_ROLE === j.roleBaru; });
    if (!ada) throw new Error('Role "' + j.roleBaru + '" belum ada di sheet 32_ROLE_PORTAL. Jalankan jalankanPastikanModulRbacLengkap atau tambahkan rolenya dulu.');
  }
  return j.roleBaru;
}

function getDaftarPengelola(token) {
  const akses = requireAuth(token);
  requireIzinModulBaru_(akses, 'MANAJEMEN_PENGGUNA', 'VIEW');
  const p = bacaPengelola_(), daftar = [];
  for (let i = 1; i < p.data.length; i++) {
    const b = p.data[i]; if (!b[p.idx.USERNAME]) continue;
    const jab = jabatanDariBaris_(b, p.idx);
    daftar.push({
      username: b[p.idx.USERNAME], nama: b[p.idx.NAMA] || '',
      status: String(b[p.idx.STATUS] || 'AKTIF').toUpperCase() === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF',   // STATUS kosong = AKTIF (sama dgn adminLogin)
      role: b[p.idx.ROLE] || 'ADMIN', jabatan: jab, namaJabatan: jab ? JABATAN_PENGELOLA[jab].nama : '(role manual)',
      roleBaru: roleEfektifPengelola_(b, p.idx), dibuatPada: b[p.idx.DIBUAT_PADA] || ''
    });
  }
  return daftar;
}

function addPengelola(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'MANAJEMEN_PENGGUNA', 'CREATE');
  const username = sanitize(body.username), password = body.password, nama = sanitize(body.nama);
  const jabatan = (sanitize(body.jabatan) || 'PENGELOLA').toUpperCase();
  const role = (sanitize(body.role) || 'ADMIN').toUpperCase();
  if (!username) throw new Error('Username wajib diisi.');
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) throw new Error('Username 3-40 karakter: huruf, angka, titik, garis bawah, atau strip (tanpa spasi).');
  if (!password || String(password).length < 8) throw new Error('Password minimal 8 karakter.');
  if (['ADMIN', 'STAFF'].indexOf(role) < 0) throw new Error('Role harus ADMIN atau STAFF.');
  const roleBaru = roleBaruDariJabatan_(jabatan);

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const p = bacaPengelola_();
    if (cariBarisPengelola_(p, username) >= 0) throw new Error('Username "' + username + '" sudah dipakai.');
    const salt = Utilities.getUuid(), baris = new Array(p.headers.length).fill('');
    baris[p.idx.USERNAME] = username; baris[p.idx.SALT] = salt; baris[p.idx.PASSWORD_HASH] = hashPassword(password, salt);
    baris[p.idx.NAMA] = nama; baris[p.idx.STATUS] = 'AKTIF'; baris[p.idx.ROLE] = role; baris[p.idx.DIBUAT_PADA] = new Date();
    baris[p.idx.JABATAN] = jabatan; baris[p.idx.ROLE_BARU] = roleBaru;
    p.sheet.appendRow(baris);
    logAudit_('TAMBAH_PENGELOLA', 'PENGELOLA_SPPG', username, akses, { nama: nama, jabatan: jabatan, roleBaru: roleBaru || 'SUPER_ADMIN' });
    return { success: true, username: username, jabatan: jabatan, roleBaru: roleBaru || 'SUPER_ADMIN' };
  } finally { lock.releaseLock(); }
}

function updatePengelola(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'MANAJEMEN_PENGGUNA', 'EDIT');
  const username = sanitize(body.username);
  if (!username) throw new Error('Username wajib diisi.');
  const roleBody = body.role ? sanitize(body.role).toUpperCase() : '';
  if (roleBody && ['ADMIN', 'STAFF'].indexOf(roleBody) < 0) throw new Error('Role harus ADMIN atau STAFF.');
  const jabatan = body.jabatan !== undefined && body.jabatan !== null && sanitize(body.jabatan) !== '' ? sanitize(body.jabatan).toUpperCase() : '';
  const roleBaru = jabatan ? roleBaruDariJabatan_(jabatan) : null;

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const p = bacaPengelola_(), i = cariBarisPengelola_(p, username);
    if (i < 0) throw new Error('Akun Pengelola tidak ditemukan.');
    if (jabatan) {
      const sekarangRole = roleEfektifPengelola_(p.data[i], p.idx), baruEfektif = roleBaru || 'SUPER_ADMIN';
      if (baruEfektif !== sekarangRole) {
        if (username.toLowerCase() === String(akses).toLowerCase() && baruEfektif !== 'SUPER_ADMIN') throw new Error('Tidak bisa membatasi akses akun yang sedang Anda gunakan sendiri.');
        if (sekarangRole === 'SUPER_ADMIN' && pengelolaAktif_(p.data[i], p.idx) && jumlahSuperAdminAktif_(p, username) === 0) throw new Error('Harus tersisa minimal satu Pengelola aktif dengan akses penuh.');
      }
      p.sheet.getRange(i + 1, p.idx.JABATAN + 1).setValue(jabatan);
      p.sheet.getRange(i + 1, p.idx.ROLE_BARU + 1).setValue(roleBaru);
    }
    if (body.nama !== undefined) p.sheet.getRange(i + 1, p.idx.NAMA + 1).setValue(sanitize(body.nama));
    if (roleBody) p.sheet.getRange(i + 1, p.idx.ROLE + 1).setValue(roleBody);
    logAudit_('UBAH_PENGELOLA', 'PENGELOLA_SPPG', username, akses, { nama: body.nama, role: roleBody, jabatan: jabatan, roleBaru: roleBaru === null ? undefined : (roleBaru || 'SUPER_ADMIN') });
    return { success: true };
  } finally { lock.releaseLock(); }
}

function setStatusPengelola(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'MANAJEMEN_PENGGUNA', 'EDIT');
  const username = sanitize(body.username), statusBaru = body.aktif ? 'AKTIF' : 'NONAKTIF';
  if (!username) throw new Error('Username wajib diisi.');
  if (!body.aktif && username.toLowerCase() === String(akses).toLowerCase()) throw new Error('Tidak bisa menonaktifkan akun yang sedang Anda gunakan sendiri.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const p = bacaPengelola_(), i = cariBarisPengelola_(p, username);
    if (i < 0) throw new Error('Akun Pengelola tidak ditemukan.');
    if (!body.aktif && roleEfektifPengelola_(p.data[i], p.idx) === 'SUPER_ADMIN' && pengelolaAktif_(p.data[i], p.idx) && jumlahSuperAdminAktif_(p, username) === 0) throw new Error('Harus tersisa minimal satu Pengelola aktif dengan akses penuh.');
    p.sheet.getRange(i + 1, p.idx.STATUS + 1).setValue(statusBaru);
    logAudit_('SET_STATUS_PENGELOLA', 'PENGELOLA_SPPG', username, akses, { status: statusBaru });
    return { success: true };
  } finally { lock.releaseLock(); }
}

/**
 * SIPANDU — SipanduHakAkses.gs
 * Kelola Hak Akses: Admin pilih relawan dari daftar + assign ROLE_SIPANDU
 * lewat UI, pola sama persis dengan "Hak Akses" di modul Stok Portal
 * Relawan (setRoleStok).
 *
 * ==================================================================
 * PERBAIKAN PENTING (masalah "ayam-telur"): sebelumnya fungsi-fungsi
 * di sini pakai requireSipanduPermission_ (artinya harus SUDAH punya
 * akses SIPANDU dulu untuk bisa kasih akses SIPANDU ke orang lain --
 * kalau belum ada SIAPA PUN yang berhasil masuk SIPANDU, tidak ada
 * jalan untuk kasih akses pertama kali).
 *
 * SEKARANG pakai requireAuth (login Admin PORTAL biasa) -- Admin Portal
 * SELALU bisa kelola Hak Akses SIPANDU dari Admin Panel, TIDAK PERNAH
 * bergantung pada status SIPANDU-nya sendiri. Ini juga yang membuat UI-nya
 * bisa dipindah ke admin.html (pola sama persis dengan Hak Akses SIRAGA),
 * bukan lagi di dalam sipandu.html.
 * ==================================================================
 */

function getDaftarRelawanUntukHakAkses(token) {
  requireAuth(token); // Admin Portal -- BUKAN requireSipanduPermission_

  const semuaRelawanAktif = getRelawanList(null, false).map(r => ({ id: r.id, nama: r.nama }));

  const usersSipandu = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.USERS));
  const peta = {};
  usersSipandu.forEach(u => { peta[u.ID_USER] = { role: u.ROLE_SIPANDU, aktif: String(u.AKTIF).toUpperCase() !== 'NONAKTIF' }; });

  return semuaRelawanAktif.map(r => ({
    id: r.id,
    nama: r.nama,
    roleSipandu: peta[r.id] ? peta[r.id].role : '',
    aktifDiSipandu: peta[r.id] ? peta[r.id].aktif : false,
    terdaftar: !!peta[r.id]
  }));
}

function getDaftarRoleSipandu(token) {
  requireAuth(token);
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.ROLES)).map(r => ({ kode: r.KODE, nama: r.NAMA }));
}

/**
 * Assign/ubah role SIPANDU seorang relawan. Kalau relawan itu belum
 * pernah terdaftar di USERS, baris baru ditambahkan; kalau sudah ada,
 * diperbarui di tempat.
 */
function setSipanduUserRole(body) {
  const akses = requireAuth(body.token); // Admin Portal
  const idRelawan = sipanduSanitize(body.idRelawan);
  const nama = sipanduSanitize(body.nama);
  const role = sipanduSanitize(body.role);
  const aktif = body.aktif !== false; // default true kalau tidak dikirim

  if (!idRelawan) throw new Error('Relawan wajib dipilih.');
  if (!role) throw new Error('Role wajib dipilih.');

  const rolesValid = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.ROLES)).some(r => r.KODE === role);
  if (!rolesValid) throw new Error('Role "' + role + '" tidak dikenali di sheet ROLES.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_USER]) === idRelawan) {
      sheet.getRange(i + 1, idx.NAMA + 1).setValue(nama);
      sheet.getRange(i + 1, idx.ROLE_SIPANDU + 1).setValue(role);
      sheet.getRange(i + 1, idx.AKTIF + 1).setValue(aktif ? 'AKTIF' : 'NONAKTIF');
      logAudit_('SIPANDU_SET_ROLE', 'SIPANDU_USERS', idRelawan, akses, { role: role, aktif: aktif });
      return { success: true, diperbarui: true };
    }
  }

  sheet.appendRow([idRelawan, nama, role, aktif ? 'AKTIF' : 'NONAKTIF', new Date()]);
  logAudit_('SIPANDU_SET_ROLE', 'SIPANDU_USERS', idRelawan, akses, { role: role, aktif: aktif, baru: true });
  return { success: true, diperbarui: false };
}

/** Cabut akses SIPANDU seorang relawan (nonaktifkan, bukan hapus baris -- jaga jejak audit). */
function cabutSipanduUserRole(body) {
  const akses = requireAuth(body.token); // Admin Portal
  const idRelawan = sipanduSanitize(body.idRelawan);

  const sheet = getSipanduSheet(SIPANDU_SHEET.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxId = headers.indexOf('ID_USER');
  const idxAktif = headers.indexOf('AKTIF');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === idRelawan) {
      sheet.getRange(i + 1, idxAktif + 1).setValue('NONAKTIF');
      logAudit_('SIPANDU_CABUT_ROLE', 'SIPANDU_USERS', idRelawan, akses, { dicabut: true });
      return { success: true };
    }
  }
  throw new Error('Relawan ini belum pernah terdaftar di SIPANDU.');
}


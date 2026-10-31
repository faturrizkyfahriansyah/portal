/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * AuthTerpusat.gs — Tahap 3: Autentikasi Terpusat, BARU 30 Okt 2026.
 *
 * Portal MENERBITKAN token tambahan bertanda tangan HMAC (pola PERSIS
 * sama dgn Auth.gs SIPENDOK yg SUDAH terbukti jalan -- bukan skema
 * baru) supaya SIPENDOK (dan nanti modul lain yg kompatibel) bisa
 * MEMVERIFIKASI identitas orang ybs TANPA perlu login terpisah.
 *
 * ADITIF MURNI -- tidak mengganti relawanLogin/adminLogin yg sudah
 * ada, cuma MENAMBAH 1 field `tokenTerpusat` di hasil login. Sesi
 * Portal sendiri (CacheService, lihat requireAuth di Admin.gs) SAMA
 * SEKALI tidak disentuh/diganti -- itu tetap jalan apa adanya.
 *
 * PRASYARAT (manual, SEKALI, tidak bisa dari kode): Script Properties
 * Portal HARUS py `AUTH_TERPUSAT_SECRET` -- string acak panjang (mis.
 * 32+ karakter), DIBUAT SEKALI, lalu SECRET YANG SAMA PERSIS disalin
 * ke Script Properties SIPENDOK (lihat VerifikasiTokenPortal.gs) dan
 * modul lain yg akan ikut. Jangan pernah taruh di kode/GitHub.
 */

function ambilSecretAuthTerpusat_() {
  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_TERPUSAT_SECRET');
  if (!secret) throw new Error('AUTH_TERPUSAT_SECRET belum diset di Script Properties Portal. Buat SEKALI (mis. lewat generateSecretAuthTerpusat di editor), salin nilainya ke Script Properties SIPENDOK juga.');
  return secret;
}

/**
 * JALANKAN SEKALI dari editor Apps Script utk membuat secret baru --
 * HANYA kalau AUTH_TERPUSAT_SECRET belum pernah diset. Hasilnya
 * ditulis ke Logger (View > Logs) -- SALIN nilainya scr manual ke
 * Script Properties Portal (key: AUTH_TERPUSAT_SECRET) DAN ke Script
 * Properties SIPENDOK dgn key yg SAMA. Setelah disalin, JANGAN
 * jalankan fungsi ini lagi (akan bikin secret baru & token lama jadi
 * tidak valid di semua sistem).
 */
function generateSecretAuthTerpusat() {
  const sudahAda = PropertiesService.getScriptProperties().getProperty('AUTH_TERPUSAT_SECRET');
  if (sudahAda) { Logger.log('AUTH_TERPUSAT_SECRET SUDAH ADA -- tidak dibuat ulang (supaya token yg sudah beredar tidak mendadak tidak valid). Nilainya TIDAK ditampilkan lagi di sini demi keamanan -- cek langsung di Project Settings > Script Properties kalau perlu menyalinnya ulang.'); return; }
  const secret = Utilities.base64EncodeWebSafe(Utilities.getUuid() + Utilities.getUuid());
  PropertiesService.getScriptProperties().setProperty('AUTH_TERPUSAT_SECRET', secret);
  Logger.log('AUTH_TERPUSAT_SECRET baru dibuat: ' + secret);
  Logger.log('WAJIB: salin nilai PERSIS di atas ke Script Properties SIPENDOK (key sama: AUTH_TERPUSAT_SECRET) sebelum token terpusat bisa dipakai di sana.');
}

/**
 * Buat token terpusat bertanda tangan -- dipanggil SETELAH login Portal
 * berhasil (relawan maupun admin), DITAMBAHKAN sbg field tambahan di
 * hasil login, bukan pengganti token sesi Portal yg sudah ada.
 * @param {string} idRelawan
 * @param {string} nama
 * @param {string} roleBaru nilai ROLE_BARU (01_DATA_RELAWAN) -- dipakai modul lain utk cek hak akses tanpa tanya balik ke Portal
 * @return {string} token format "<payload base64>.<tanda tangan base64>", berlaku 6 jam (samakan dgn masa berlaku sesi Portal sendiri)
 */
function buatTokenTerpusat_(idRelawan, nama, roleBaru) {
  const payload = { idRelawan: idRelawan, nama: nama, role: roleBaru || 'RELAWAN', exp: Date.now() + 6 * 3600 * 1000 };
  const b = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(b, ambilSecretAuthTerpusat_()));
  return b + '.' + sig;
}

/**
 * Verifikasi token terpusat (dipakai Portal SENDIRI kalau suatu saat
 * perlu, tapi fungsi UTAMANYA dipakai modul LAIN -- lihat
 * VerifikasiTokenPortal.gs di SIPENDOK utk salinan verifikasi sisi
 * penerima).
 * @return {Object} {idRelawan, nama, role} kalau valid
 */
function verifikasiTokenTerpusat_(token) {
  const gagal = new Error('Sesi terpusat tidak valid/berakhir. Silakan login kembali.');
  if (!token || String(token).indexOf('.') < 0) throw gagal;
  const bagian = String(token).split('.');
  const harapan = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], ambilSecretAuthTerpusat_()));
  if (bagian[1] !== harapan) throw gagal;
  let payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString('UTF-8')); }
  catch (e) { throw gagal; }
  if (!payload.exp || payload.exp < Date.now()) throw gagal;
  return { idRelawan: payload.idRelawan, nama: payload.nama, role: payload.role };
}

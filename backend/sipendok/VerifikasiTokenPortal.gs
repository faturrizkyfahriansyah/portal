/**
 * SIPENDOK — VerifikasiTokenPortal.gs — Tahap 3: Autentikasi Terpusat, BARU 30 Okt 2026.
 *
 * Penerima sisi SIPENDOK utk token terpusat yang diterbitkan Portal
 * (lihat AuthTerpusat.gs di proyek Portal). ADITIF MURNI -- objek
 * `Auth` yang sudah ada (login/verify dgn AUTH_SECRET milik SIPENDOK
 * sendiri) SAMA SEKALI tidak diubah. Ini jalur VERIFIKASI KEDUA yg
 * TERPISAH, dipakai HANYA kalau route tertentu sengaja memilih
 * menerima token Portal (lihat catatan pemakaian di Api.gs).
 *
 * PRASYARAT (manual, SEKALI): Script Properties SIPENDOK HARUS py
 * `AUTH_TERPUSAT_SECRET` dgn NILAI PERSIS SAMA dgn punya Portal
 * (disalin manual sekali dari Logger Portal, lihat
 * generateSecretAuthTerpusat di AuthTerpusat.gs Portal). TIDAK boleh
 * disamakan dgn AUTH_SECRET milik SIPENDOK sendiri (itu punya SIPENDOK
 * sendiri, biarkan apa adanya).
 */
function verifikasiTokenPortal_(token) {
  var gagal = new AppError('Sesi Portal tidak valid/berakhir. Silakan login ulang di Portal.', 'SESI_HABIS');
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_TERPUSAT_SECRET');
  if (!secret) throw new AppError('AUTH_TERPUSAT_SECRET belum diset di Script Properties SIPENDOK -- salin dari Portal dulu (lihat AuthTerpusat.gs).', 'BELUM_SETUP');
  if (!token || String(token).indexOf('.') < 0) throw gagal;
  var bagian = String(token).split('.');
  var harapan = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], secret));
  if (bagian[1] !== harapan) throw gagal;
  var payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString('UTF-8')); }
  catch (e) { throw gagal; }
  if (!payload.exp || payload.exp < Date.now()) throw gagal;
  return { idRelawan: payload.idRelawan, nama: payload.nama, role: payload.role };
}

/**
 * 4 Nov 2026 (keputusan Admin): SIPENDOK TIDAK punya login sendiri lagi. Satu-satunya pintu = Portal. Token aplikasi diterbitkan Portal
 * (terbitkanTokenAplikasi) HANYA bila akun diberi akses SIPENDOK, dan diperiksa ULANG tiap permintaan terhadap sheet 35_AKSES_RELAWAN_MODUL.
 */
function verifikasiTokenAplikasi_(token, modul) {
  var gagal = new AppError('Sesi tidak valid atau berakhir. Buka kembali SIPENDOK dari Portal.', 'SESI_HABIS');
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_TERPUSAT_SECRET');
  if (!secret) throw new AppError('AUTH_TERPUSAT_SECRET belum diset di Script Properties SIPENDOK -- salin dari Portal (lihat AuthTerpusat.gs).', 'KONFIG');
  if (!token || String(token).indexOf('.') < 0) throw gagal;
  var bagian = String(token).split('.');
  if (bagian[1] !== Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], secret))) throw gagal;
  var payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString('UTF-8')); } catch (e) { throw gagal; }
  if (!payload.exp || payload.exp < Date.now() || payload.modul !== modul) throw gagal;
  return payload;
}
function cekAksesPortalSheet_(payload, modul) {
  if (payload.jenis !== 'RELAWAN' || payload.role === 'SUPER_ADMIN') return true;
  var cache = CacheService.getScriptCache(), kunci = 'akses:' + payload.idRelawan + ':' + modul, c = cache.get(kunci);
  var tolak = new AppError('Akses Anda ke ' + modul + ' belum diberikan atau telah dicabut oleh Pengelola.', 'AKSES_DITOLAK');
  if (c === '1') return true;
  if (c === '0') throw tolak;
  var sh = ssPortal_().getSheetByName('35_AKSES_RELAWAN_MODUL'), ada = false;
  if (sh && sh.getLastRow() > 1) {
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) { if (String(data[i][0]).trim() === String(payload.idRelawan).trim() && String(data[i][1]).trim() === modul) { ada = true; break; } }
  }
  cache.put(kunci, ada ? '1' : '0', ada ? 60 : 10);   // pencabutan berlaku <= 60 dtk; pemberian baru <= 10 dtk
  if (!ada) throw tolak;
  return true;
}

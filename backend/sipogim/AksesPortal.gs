/**
 * SIPOGIM — AksesPortal.gs (BARU 4 Nov 2026, keputusan Admin): SIPOGIM TIDAK punya login sendiri lagi. Satu-satunya pintu = Portal.
 * Token aplikasi diterbitkan Portal (terbitkanTokenAplikasi, modul SIPOGIM) HANYA bila akun diberi akses SIPOGIM, dan diperiksa ULANG tiap
 * permintaan terhadap sheet 35_AKSES_RELAWAN_MODUL di spreadsheet Portal (read-only).
 * PRASYARAT (sekali): Script Properties SIPOGIM = AUTH_TERPUSAT_SECRET (sama dengan Portal) dan PORTAL_SPREADSHEET_ID (jalankan hubungkanPortalSipogim).
 */
function verifikasiTokenAplikasi_(token, modul) {
  const gagal = new Error('Sesi tidak valid atau berakhir. Buka kembali SIPOGIM dari Portal.');
  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_TERPUSAT_SECRET');
  if (!secret) throw new Error('AUTH_TERPUSAT_SECRET belum diset di Script Properties SIPOGIM -- salin dari Portal (lihat AuthTerpusat.gs).');
  if (!token || String(token).indexOf('.') < 0) throw gagal;
  const bagian = String(token).split('.');
  if (bagian[1] !== Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], secret))) throw gagal;
  let payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString('UTF-8')); } catch (e) { throw gagal; }
  if (!payload.exp || payload.exp < Date.now() || payload.modul !== modul) throw gagal;
  return payload;
}
function cekAksesPortalSheet_(payload, modul) {
  if (payload.jenis !== 'RELAWAN' || payload.role === 'SUPER_ADMIN') return true;
  const cache = CacheService.getScriptCache(), kunci = 'akses:' + payload.idRelawan + ':' + modul, c = cache.get(kunci);
  const tolak = new Error('Akses Anda ke ' + modul + ' belum diberikan atau telah dicabut oleh Pengelola.');
  if (c === '1') return true;
  if (c === '0') throw tolak;
  const id = PropertiesService.getScriptProperties().getProperty('PORTAL_SPREADSHEET_ID');
  if (!id) throw new Error('PORTAL_SPREADSHEET_ID belum diset -- jalankan hubungkanPortalSipogim.');
  const sh = SpreadsheetApp.openById(id).getSheetByName('35_AKSES_RELAWAN_MODUL');
  let ada = false;
  if (sh && sh.getLastRow() > 1) { const data = sh.getDataRange().getValues(); for (let i = 1; i < data.length; i++) { if (String(data[i][0]).trim() === String(payload.idRelawan).trim() && String(data[i][1]).trim() === modul) { ada = true; break; } } }
  cache.put(kunci, ada ? '1' : '0', ada ? 60 : 10);
  if (!ada) throw tolak;
  return true;
}
/** Hubungkan SEKALI: ganti ID dengan ID spreadsheet DATABASE PORTAL, lalu Run. */
function hubungkanPortalSipogim() {
  const ID = 'GANTI_DENGAN_ID_SPREADSHEET_PORTAL', log = function (t) { try { Logger.log(t); } catch (e) { /* abaikan */ } return t; };
  if (ID === 'GANTI_DENGAN_ID_SPREADSHEET_PORTAL') return log('BELUM DIISI: ganti teks GANTI_DENGAN_ID_SPREADSHEET_PORTAL dengan ID spreadsheet DATABASE PORTAL, lalu Run lagi.');
  try { const ss = SpreadsheetApp.openById(ID); PropertiesService.getScriptProperties().setProperty('PORTAL_SPREADSHEET_ID', ID); return log('Tersambung ke "' + ss.getName() + '".'); }
  catch (e) { return log('GAGAL: ' + e.message); }
}

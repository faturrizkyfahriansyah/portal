/**
 * DIAGNOSA MENDALAM SIPANDU
 *
 * CARA PAKAI:
 * 1. Tempel fungsi ini ke file BARU di Apps Script (klik + di "Files" → Script,
 *    beri nama "DiagnosaSipandu")
 * 2. Pilih fungsi "diagnosaSipandu" di dropdown atas editor
 * 3. Klik ▷ Run (izinkan akses kalau diminta)
 * 4. Buka View → Logs (atau ikon ⏱️ Executions)
 * 5. SCREENSHOT SELURUH hasil log itu, kirim ke saya
 *
 * Ini akan menunjukkan PERSIS: apakah SIPANDU_SPREADSHEET_ID sudah benar,
 * sheet apa saja yang GENUINELY ada di database SIPANDU kamu (nama persis,
 * termasuk kalau ada spasi/beda huruf besar-kecil), dan berapa baris data
 * di masing-masing -- supaya saya berhenti menebak dan bisa cocokkan kode
 * dengan kenyataan.
 */
function diagnosaSipandu() {
  Logger.log('=== 1. SIPANDU_SPREADSHEET_ID ===');
  const id = PropertiesService.getScriptProperties().getProperty('SIPANDU_SPREADSHEET_ID');
  Logger.log('Script Property SIPANDU_SPREADSHEET_ID: ' + (id || '(KOSONG / BELUM DIISI)'));

  if (!id) {
    Logger.log('BERHENTI -- Script Property belum diisi. Isi dulu, baru jalankan ulang fungsi ini.');
    return;
  }

  Logger.log('');
  Logger.log('=== 2. Coba buka Spreadsheet SIPANDU pakai ID itu ===');
  let ss;
  try {
    ss = SpreadsheetApp.openById(id);
    Logger.log('BERHASIL dibuka. Nama file: "' + ss.getName() + '"');
    Logger.log('URL: ' + ss.getUrl());
  } catch (e) {
    Logger.log('GAGAL dibuka: ' + e.message);
    Logger.log('Kemungkinan: ID salah, atau akun yang menjalankan Apps Script ini tidak punya akses ke Spreadsheet tsb.');
    return;
  }

  Logger.log('');
  Logger.log('=== 3. Daftar SEMUA sheet/tab yang GENUINELY ada (nama persis) ===');
  const semuaSheet = ss.getSheets();
  semuaSheet.forEach(sh => {
    const nama = sh.getName();
    const jumlahBaris = sh.getLastRow();
    Logger.log('  - "' + nama + '"  (panjang nama: ' + nama.length + ' karakter, baris data: ' + jumlahBaris + ')');
  });

  Logger.log('');
  Logger.log('=== 4. Cek spesifik: apakah ada sheet bernama persis "USERS", "ROLES", "CONFIG"? ===');
  ['USERS', 'ROLES', 'CONFIG', 'PERMISSIONS', 'ROLE_PERMISSIONS'].forEach(nama => {
    const sh = ss.getSheetByName(nama);
    Logger.log('  "' + nama + '": ' + (sh ? 'ADA (baris: ' + sh.getLastRow() + ')' : 'TIDAK ADA persis dengan nama ini'));
  });

  Logger.log('');
  Logger.log('=== 5. Kalau ada sheet USERS, tunjukkan header kolomnya ===');
  const shUsers = ss.getSheetByName('USERS');
  if (shUsers) {
    const header = shUsers.getRange(1, 1, 1, shUsers.getLastColumn()).getValues()[0];
    Logger.log('Header USERS: ' + JSON.stringify(header));
  } else {
    Logger.log('(dilewati, sheet USERS tidak ada)');
  }

  Logger.log('');
  Logger.log('=== SELESAI -- screenshot semua log di atas, kirim ke Claude ===');
}


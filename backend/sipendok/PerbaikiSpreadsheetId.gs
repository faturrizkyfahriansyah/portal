/**
 * PerbaikiSpreadsheetId.gs — darurat 25 Okt 2026.
 * Script Property 'SPREADSHEET_ID' sebelumnya ketimpa teks "undefined"
 * (bukan ID asli), menyebabkan setup()/migrasiDariV1() gagal dengan
 * "Illegal spreadsheet id or key: undefined". Jalankan fungsi di bawah
 * SEKALI untuk menimpanya dengan ID spreadsheet SIPENDOK yang benar,
 * BARU setelah itu jalankan setup() lagi dari Setup.gs.
 */
function perbaikiSpreadsheetId() {
  setSpreadsheetId('1OZGFUPoCaSwbnbPNWQ0L7VQ0ek8f9kP3y9B7jf0_-Rw');
}


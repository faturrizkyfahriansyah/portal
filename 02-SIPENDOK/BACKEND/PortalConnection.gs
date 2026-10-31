/**
 * PortalConnection.gs — koneksi bersama ke spreadsheet Portal Pengelola.
 *
 * Digunakan oleh Bast.gs (periode BAST/SJ) dan modul lain yang memerlukan
 * akses baca ke spreadsheet Portal. Tidak menulis atau mengubah data Portal.
 */
function ssPortal_() {
  var settings = Db.settings();
  var id = String(
    settings.PORTAL_SPREADSHEET_ID ||
    '1zMPP49ec963RuN7scvAqWYcZlxtalJMi7EVwU_xe3Io'
  ).trim();

  if (!id) {
    throw new AppError(
      'PORTAL_SPREADSHEET_ID belum diatur di Pengaturan SIPENDOK.',
      'PORTAL_KONFIG'
    );
  }

  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new AppError(
      'SIPENDOK tidak dapat membuka spreadsheet Portal Pengelola. ' +
      'Periksa PORTAL_SPREADSHEET_ID dan izin akses akun Apps Script.',
      'PORTAL_AKSES'
    );
  }
}


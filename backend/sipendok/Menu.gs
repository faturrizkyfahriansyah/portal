/**
 * Menu.gs — BARU 23 Okt 2026 (dokumen Pembaruan SIPENDOK §13.D, DISETUJUI
 * Admin). Baca Siklus Menu LANGSUNG dari spreadsheet "DATABASE SIKLUS
 * MENU SPPG 2026" -- SAMA PERSIS ID/tab/kolom dengan SiklusMenu.gs di
 * proyek Apps Script Portal UTAMA (diverifikasi, BUKAN tebakan):
 *   ID: 1VyYjXgjYsyHm-A8bxgOsVlTV3RDc-JZZGba8JInngk0
 *   Tab: "MASTER MENU 2026"
 *   Kolom: A=Minggu B=Hari C=Tanggal D=Karbohidrat E=Lauk Hewani
 *          F=Lauk Nabati G=Sayur H=Buah I=Pelengkap J=Tema
 *
 * BERBEDA dari SiklusMenu.gs Portal utama: fungsi DI SINI mencari menu
 * utk TANGGAL EKSPLISIT (tanggal operasional dokumen yg sedang dibuat)
 * -- TIDAK ADA logika "ganti ke besok jam 15:00 WIB", krn itu cuma
 * relevan utk widget Dashboard "Menu Hari Ini", bukan utk mengisi
 * dokumen BAST tanggal tertentu (dokumen §13.D: "Jika data menu tidak
 * ditemukan, tampilkan kesalahan dan jangan mengisi menu dari tanggal
 * lain" -- jadi TIDAK BOLEH ada fallback/pergeseran tanggal apa pun).
 */
var SIKLUS_MENU_SHEET_ID = '1VyYjXgjYsyHm-A8bxgOsVlTV3RDc-JZZGba8JInngk0';
var SIKLUS_MENU_TAB = 'MASTER MENU 2026';

var Menu = {
  /**
   * @param {string} tglIso "yyyy-MM-dd"
   * @return {Object|null} {karbohidrat, laukHewani, laukNabati, sayur, buah, pelengkap, tema} -- null kalau tanggal tidak ada di jadwal siklus.
   */
  untukTanggal: function (tglIso) {
    var p = U.mustDate(tglIso);
    var ss;
    try { ss = SpreadsheetApp.openById(SIKLUS_MENU_SHEET_ID); }
    catch (e) { throw new AppError('Spreadsheet Siklus Menu tidak dapat dibuka. Periksa izin akses akun yang menjalankan SIPENDOK.', 'MENU_GAGAL_BACA'); }
    var sheet = ss.getSheetByName(SIKLUS_MENU_TAB);
    if (!sheet) throw new AppError('Tab "' + SIKLUS_MENU_TAB + '" tidak ditemukan di spreadsheet Siklus Menu.', 'MENU_TAB_TIDAK_ADA');

    var data = sheet.getDataRange().getValues();
    for (var i = 0; i < data.length; i++) {
      var tgl = data[i][2]; // kolom C
      if (!(tgl instanceof Date)) continue; // lewati baris judul periode/header kolom yg berulang di tab ini
      var tglRowIso = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
      if (tglRowIso !== tglIso) continue;
      return {
        karbohidrat: data[i][3] || '', laukHewani: data[i][4] || '', laukNabati: data[i][5] || '',
        sayur: data[i][6] || '', buah: data[i][7] || '', pelengkap: data[i][8] || '', tema: data[i][9] || ''
      };
    }
    return null;
  }
};


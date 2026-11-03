/**
 * OperasionalQr.gs — DIROMBAK TOTAL 30 Okt 2026 (INSIDEN KRITIS).
 *
 * File ini SEBELUMNYA berisi 16 fungsi yang SEMUANYA ternyata duplikat
 * dari fungsi yang SUDAH ADA dan LEBIH LENGKAP di file lain
 * (AbsensiQr.gs, AdminDashboard.gs, Admin.gs, Absensi.gs). Dibangun
 * tanpa sadar itu krn audit sebelumnya tidak melihat file-file
 * tsb sama sekali (TIDAK diberikan dalam konteks kerja).
 *
 * AKIBAT: karena deklarasi `function` (beda dgn const/let) TIDAK
 * menyebabkan error saat didobel -- yang dimuat BELAKANGAN (OperasionalQr.gs,
 * urutan alfabet setelah file aslinya) diam-diam MENANG, menimpa versi
 * asli yang lebih lengkap dan benar. ini akar penyebab sesungguhnya
 * dari "Sesi tidak valid" yang berulang kali muncul acak -- versi saya
 * memanggil requireAuth(token) TANPA parameter kedua (izinkanStaff),
 * beda dari versi asli AdminDashboard.gs yg benar: requireAuth(token, true).
 *
 * Diperbaiki dengan MENGHAPUS SEMUA 16 fungsi duplikat itu -- supaya
 * versi ASLI (yang sudah lebih teruji & lengkap) kembali jadi satu-satunya
 * definisi, tidak lagi tertimpa. Fungsi berikut SEKARANG HANYA ADA di
 * file aslinya masing-masing (TIDAK PERLU diapa-apakan lagi di sini):
 *   AbsensiQr.gs    : getOperasionalAktifQr, getDaftarRingkasKiosk,
 *                      submitAbsensiQr, getDaftarKartuAdmin,
 *                      generateKartuAdmin, setStatusKartuAdmin,
 *                      getDataKartuCetakAdmin, getDataKartuCetakRelawan
 *   AdminDashboard.gs: getDashboardPengelolaRingan, getRingkasanAkunRelawan,
 *                      getSiragaDashboard, getSipanduDashboardRingkas,
 *                      getRekapDuaMingguDashboard
 *   Admin.gs        : validasiSesiAdmin
 *   Absensi.gs      : getDashboardRelawanP0, getDashboardRelawanP1
 *
 * HANYA fungsi di bawah ini yang BENAR-BENAR baru/unik (dikonfirmasi
 * TIDAK ada di file manapun lain lewat audit menyeluruh 63 file,
 * 30 Okt 2026) -- lihat SiklusMenu.gs utk sumber datanya.
 */
function getMenuHariIniDashboard() {
  try {
    return getMenuHariIniTerpadu_();   // 4 Nov 2026: menu disetujui di SIPANDU baru lebih dulu, lalu Siklus Menu (cara lama)
  } catch (e) {
    return null; // spreadsheet/tab tidak bisa diakses -- frontend sudah menangani dgn baik
  }
}

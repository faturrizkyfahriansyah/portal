/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Code.gs — Routing utama (doGet & doPost)
 *
 * PENTING: setelah menyalin semua file .gs ke proyek Apps Script Anda,
 * deploy sebagai Web App:
 *   Deploy → New deployment → Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 * Salin URL yang diberikan ke dalam config.js pada website (folder utama).
 *
 * Permintaan GET dipakai untuk MEMBACA data (getDivisi, getRelawan, dst.)
 * Permintaan POST dipakai untuk MENULIS data (submitAbsensi, login, dst.)
 * POST dikirim tanpa header Content-Type khusus agar tidak memicu CORS
 * preflight yang tidak didukung Apps Script — lihat komentar di common.js.
 *
 * DIRAPIKAN 30 Okt 2026 (dari file ASLI yg disalin langsung dari Apps
 * Script live Admin, bukan dari export/ZIP lama -- lihat percakapan).
 * Dihapus: ~18 `case` yg DITULIS 2x (duplikat persis, case kedua TIDAK
 * PERNAH jalan di JS switch -- mubazir, bukan bug yg bikin crash).
 * DIPERBAIKI: 'addNotifikasiSistem' & 'addPengumuman' di doPost dulu
 * py 2 definisi -- yg PERTAMA (yg sebenarnya aktif) TANPA requireAuth,
 * yg KEDUA (mati, tidak pernah jalan) PAKAI requireAuth. Sekarang cuma
 * 1 definisi, DENGAN requireAuth (celah keamanan tanpa sengaja tertutup).
 * DITAMBAHKAN: getRingkasanPmPublik & getProfilTimPublik (website
 * publik -- index.html & profil-sppg.html, lihat PmSipendok.gs).
 */

function doGet(e) {
  try {
    const action = e.parameter && e.parameter.action;
    if (!action) return gagal('Aksi API tidak diberikan oleh permintaan.', 'MISSING_ACTION');
    let data;
    switch (action) {
      // ===== 4 case BARU 30 Okt 2026 (Tahap 5) -- sistem presensi V2
      // (Roster-First, lihat MigrasiRosterV2.gs/Roster.gs/AbsensiV2.gs/
      // RekapV2.gs) DISAMBUNGKAN atas persetujuan Admin -- TOMBOL aktif,
      // TAPI migrasi (jalankanMigrasiRosterV2, lihat doPost) TETAP cuma
      // jalan kalau Admin sendiri yg memicu dari UI, tidak otomatis. =====
      case 'getStatusRosterRelawan':
        data = getStatusRosterRelawan(e.parameter.token);
        break;
      case 'getRekapHarianV2':
        data = getRekapHarianV2(e.parameter.tanggalOperasional, e.parameter.token);
        break;
      case 'getRiwayatAbsensiRelawanV2':
        data = getRiwayatAbsensiRelawanV2(e.parameter.token);
        break;
      case 'getRekapDuaMingguV2':
        data = getRekapDuaMingguV2(e.parameter.idPeriode, e.parameter.token);
        break;
      case 'getAksesModulSaya':
        // BARU 30 Okt 2026 (Tahap 4 -- Penataan Navigasi).
        data = getAksesModulSaya(e.parameter.token);
        break;
      case 'getRingkasanPmDashboard':
        // BARU 28 Okt 2026 (dilaporkan Admin -- "PM ga muncul"). Baca
        // dari spreadsheet SIPENDOK, sheet 01_PM -- lihat PmSipendok.gs.
        data = getRingkasanPmDashboard();
        break;
      case 'getRingkasanPmPublik':
        // BARU 29 Okt 2026 (website publik index.html -- kartu Penerima
        // Manfaat HARDCODED "—", tidak pernah memanggil API).
        data = getRingkasanPmPublik();
        break;
      case 'getProfilTimPublik':
        // BARU 29 Okt 2026 (DIMINTA Admin -- Profil SPPG diganti dari
        // CMS manual ke auto-sync 01_DATA_RELAWAN).
        data = getProfilTimPublik();
        break;
      case 'getJadwalRelawan':
        data = getJadwalRelawan(e.parameter.token);
        break;
      case 'getJadwalListAdmin':
        requireAuth(e.parameter.token);
        data = getJadwalListAdmin();
        break;
      case 'getInformasiRelawan':
        data = getInformasiRelawan(e.parameter.token);
        break;
      case 'getInformasiListAdmin':
        requireAuth(e.parameter.token);
        data = getInformasiListAdmin();
        break;
      case 'getDokumenRelawan':
        data = getDokumenRelawan(e.parameter.token);
        break;
      case 'getDokumenListAdmin':
        requireAuth(e.parameter.token);
        data = getDokumenListAdmin();
        break;
      case 'getNotifikasiRelawan':
        data = getNotifikasiRelawan(e.parameter.token);
        break;
      case 'getPengumumanListAdmin':
        requireAuth(e.parameter.token);
        data = getPengumumanListAdmin();
        break;
      case 'getNotifikasiListAdmin':
        requireAuth(e.parameter.token);
        data = getNotifikasiListAdmin();
        break;
      case 'getRekapDetailUntukExport':
        data = getRekapDetailUntukExport(e.parameter.token, e.parameter.periodeAwal, e.parameter.periodeAkhir);
        break;
      case 'getTrenKehadiran7Hari':
        data = getTrenKehadiran7Hari(e.parameter.token);
        break;
      case 'getDashboardLengkapRelawan':
        data = getDashboardLengkapRelawan(e.parameter.token);
        break;
      case 'getJadwalSayaHariIni':
        data = getJadwalSayaHariIni(e.parameter.token);
        break;
      case 'getDashboardRelawanP0':
        data = getDashboardRelawanP0(e.parameter.token);
        break;
      case 'getDashboardRelawanP1':
        data = getDashboardRelawanP1(e.parameter.token);
        break;
      case 'getPenerimaManfaatRelawan':
        data = getPenerimaManfaatRelawan(e.parameter.token);
        break;
      case 'getDashboardPengelolaRingan':
        data = getDashboardPengelolaRingan(e.parameter.token);
        break;
      case 'getRingkasanAkunRelawan':
        data = getRingkasanAkunRelawan(e.parameter.token);
        break;
      case 'getSiragaDashboard':
        data = getSiragaDashboard(e.parameter.token);
        break;
      case 'getSipanduDashboardRingkas':
        data = getSipanduDashboardRingkas(e.parameter.token);
        break;
      case 'getRekapDuaMingguDashboard':
        data = getRekapDuaMingguDashboard(e.parameter.token);
        break;
      case 'getMenuHariIniDashboard':
        data = getMenuHariIniDashboard();
        break;
      case 'getOperasionalAktifQr':
        // BARU 29 Okt 2026 (dilaporkan Admin -- kios QR absensi selalu
        // "Data operasional belum dapat dimuat"). Case ini TIDAK PERNAH
        // ADA meski dipanggil absensi-qr.js -- lihat OperasionalQr.gs.
        data = getOperasionalAktifQr();
        break;
      case 'validasiSesiAdmin':
        // BARU 29 Okt 2026 (dilaporkan Admin -- "Sesi tidak valid" /
        // "koneksi bermasalah" terus saat buka ulang halaman admin).
        // Case ini TIDAK PERNAH ADA meski dipanggil admin.js -- lihat
        // OperasionalQr.gs.
        data = validasiSesiAdmin(e.parameter.token);
        break;
      case 'health':
        data = { status: 'OK', waktuServer: new Date().toISOString() };
        break;
      case 'getDivisi':
        data = getDivisiList();
        break;
      case 'getRelawan':
        data = getRelawanList(e.parameter.divisi, e.parameter.semua === '1');
        break;
      case 'getAbsensi':
        data = getAbsensiList(e.parameter);
        break;
      case 'getRekapHarian':
        data = getRekapHarian(e.parameter.tanggal, e.parameter.token); // DIPERBAIKI 1 Nov 2026: token SEBELUMNYA tidak diteruskan -> fungsi selalu menolak "Sesi tidak valid"
        break;
      case 'getRekapBulanan':
        data = getRekapBulanan(e.parameter.bulan, e.parameter.tahun);
        break;
      case 'getRekapDuaMinggu':
        data = getRekapDuaMinggu(e.parameter.periodeAwal, e.parameter.periodeAkhir, e.parameter.token); // DIPERBAIKI 1 Nov 2026: sama seperti getRekapHarian di atas
        break;
      case 'getAkunRelawanList':
        requireAuth(e.parameter.token);
        data = getAkunRelawanList();
        break;
      case 'getProfilRelawan':
        data = getProfilRelawan(e.parameter.token);
        break;
      case 'getRiwayatAbsensiRelawan':
        data = getRiwayatAbsensiRelawan(e.parameter.token);
        break;
      case 'getStatusAbsensiRelawan':
        data = getStatusAbsensiRelawan(e.parameter.token);
        break;
      case 'getPengaturanAkun':
        data = getPengaturanAkun(e.parameter.token);
        break;
      case 'getPeriodeListAdmin':
        requireAuth(e.parameter.token);
        data = getPeriodeListAdmin();
        break;
      case 'getKalenderListAdmin':
        requireAuth(e.parameter.token);
        data = getKalenderListAdmin(e.parameter.idPeriode);
        break;
      case 'getLokasiListAdmin':
        requireAuth(e.parameter.token);
        data = getLokasiListAdmin();
        break;
      case 'getKategoriBarang':
        data = getKategoriBarang(e.parameter.token);
        break;
      case 'getKategoriBarangAdmin':
        data = getKategoriBarangAdmin(e.parameter.token);
        break;
      case 'getSatuanList':
        data = getSatuanList(e.parameter.token);
        break;
      case 'getProfilRoleSaya':
        data = getProfilRoleSaya(e.parameter.token);
        break;
      case 'masukSebagaiRelawanUntukSipandu':
        data = masukSebagaiRelawanUntukSipandu(e.parameter.token);
        break;
      case 'getAuditLogListAdmin':
        data = getAuditLogListAdmin(e.parameter.token);
        break;
      case 'getRingkasanMonitoring':
        data = getRingkasanMonitoring(e.parameter.token);
        break;
      case 'getDaftarRelawanUntukRoleAdmin':
        data = getDaftarRelawanUntukRoleAdmin(e.parameter.token);
        break;
      case 'getSatuanListAdmin':
        data = getSatuanListAdmin(e.parameter.token);
        break;
      case 'getDataBarangList':
        data = getDataBarangList(e.parameter.token, e.parameter);
        break;
      case 'getDetailBarang':
        data = getDetailBarang(e.parameter.token, e.parameter.idBarang);
        break;
      case 'getRiwayatStokList':
        data = getRiwayatStokList(e.parameter.token, e.parameter);
        break;
      case 'getStokDashboard':
        data = getStokDashboard(e.parameter.token);
        break;
      case 'getDaftarPetugasStok':
        data = getDaftarPetugasStok(e.parameter.token);
        break;
      case 'getShiftDivisiListAdmin':
        requireAuth(e.parameter.token);
        data = getShiftDivisiListAdmin(e.parameter.idPeriode);
        break;
      case 'getPenugasanKhususListAdmin':
        requireAuth(e.parameter.token);
        data = getPenugasanKhususListAdmin(e.parameter.idOperasional);
        break;
      case 'cariAbsensiUntukKoreksi':
        data = cariAbsensiUntukKoreksi(e.parameter.token, e.parameter.idRelawan, e.parameter.tanggalPresensi);
        break;
      // ===== 22 case BARU 30 Okt 2026 (audit 63 file resmi) -- fungsi SUDAH ADA & LENGKAP,
      // cuma belum pernah terdaftar di sini. TIDAK ADA logika baru ditulis, murni
      // menyambungkan ke fungsi yg sudah ada di file aslinya (lihat komentar tiap baris). =====
      case 'getDaftarPengelola':
        data = getDaftarPengelola(e.parameter.token); // PengelolaSPPG.gs
        break;
      case 'getDaftarPenggunaHakAkses':
        data = getDaftarPenggunaHakAkses(e.parameter.token); // ManajemenHakAkses.gs
        break;
      case 'getDaftarRelawanUntukHakAkses':
        data = getDaftarRelawanUntukHakAkses(e.parameter.token); // SipanduHakAkses.gs
        break;
      case 'getDaftarRoleDanModulHakAkses':
        data = getDaftarRoleDanModulHakAkses(e.parameter.token); // ManajemenHakAkses.gs
        break;
      case 'getDaftarRoleSipandu':
        data = getDaftarRoleSipandu(e.parameter.token); // SipanduHakAkses.gs
        break;
      case 'getDaftarTemplatKeterangan':
        data = getDaftarTemplatKeterangan(e.parameter.token); // SikopMultiShift.gs
        break;
      case 'getDataPenerimaanAdmin':
        data = getDataPenerimaanAdmin(e.parameter.token); // WebsitePublik.gs
        break;
      case 'getKonfigurasiValidasiJadwal':
        data = getKonfigurasiValidasiJadwal(e.parameter.token); // SikopMultiShift.gs
        break;
      case 'getLogAktivitas':
        data = getLogAktivitas(e.parameter.token); // Pengaturan.gs
        break;
      case 'getMenuHarianListAdmin':
        data = getMenuHarianListAdmin(e.parameter.token); // WebsitePublik.gs
        break;
      case 'getMenuWebsiteAdmin':
        data = getMenuWebsiteAdmin(e.parameter.token); // WebsitePublik.gs
        break;
      case 'getPenerimaManfaatAdmin':
        data = getPenerimaManfaatAdmin(e.parameter.token); // PenerimaManfaat.gs
        break;
      case 'getPengajuanKetidakhadiranRelawan':
        data = getPengajuanKetidakhadiranRelawan(e.parameter.token); // PengajuanKetidakhadiran.gs
        break;
      case 'getPengaturanPortal':
        data = getPengaturanPortal(e.parameter.token); // Pengaturan.gs
        break;
      case 'getRekapPenerimaManfaatAdmin':
        data = getRekapPenerimaManfaatAdmin(e.parameter.token); // PenerimaManfaat.gs
        break;
      case 'getRingkasanPengajuanKetidakhadiranAdmin':
        data = getRingkasanPengajuanKetidakhadiranAdmin(e.parameter.token); // PengajuanKetidakhadiran.gs
        break;
      case 'getSemuaKontenPublikAdmin':
        data = getSemuaKontenPublikAdmin(e.parameter.token); // WebsitePublik.gs
        break;
      case 'getSipanduDashboard':
        data = getSipanduDashboard(e.parameter.token); // SipanduDashboard.gs
        break;
      case 'getSiragaSatuanList':
        data = getSiragaSatuanList(); // SiragaMasterData.gs -- tanpa parameter
        break;
      case 'getStatistikHakAkses':
        data = getStatistikHakAkses(e.parameter.token); // ManajemenHakAkses.gs
        break;
      case 'getWorkOrderList':
        data = getWorkOrderList(e.parameter.token, e.parameter); // SipanduWorkOrder.gs -- param kedua 'filter', pola sama dgn getDataBarangList
        break;
      case 'usulkanPemetaanIdRelawan':
        data = usulkanPemetaanIdRelawan(e.parameter.token); // PerbaikanIdRelawan.gs
        break;

      default:
        return gagal('Aksi tidak dikenali: ' + action, 'UNKNOWN_ACTION');
    }
    return sukses(data);
  } catch (err) {
    return gagal(err.message || 'Terjadi kesalahan pada server.', klasifikasiError_(err));
  }
}

function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return gagal('Permintaan tidak valid (format data rusak). Silakan muat ulang halaman.', 'INVALID_REQUEST');
    }
    const action = body && body.action;
    if (!action) return gagal('Aksi API tidak diberikan oleh permintaan.', 'MISSING_ACTION');
    let data;
    switch (action) {
      // ===== 7 case BARU 30 Okt 2026 (Tahap 5) -- lihat catatan di doGet
      // di atas, sistem V2 yg sama. =====
      case 'submitAbsensiV2':
        data = submitAbsensiV2(body);
        break;
      case 'jalankanMigrasiRosterV2':
        data = jalankanMigrasiRosterV2(body);
        break;
      case 'koreksiRosterV2':
        data = koreksiRosterV2(body);
        break;
      case 'jalankanValidasiIntegritasRosterV2':
        data = jalankanValidasiIntegritasRosterV2(body);
        break;
      case 'hapusKolomLamaAbsensiAdmin':
        data = hapusKolomLamaAbsensiAdmin(body);
        break;
      case 'buatRosterUntukOperasionalAdmin':
        data = buatRosterUntukOperasionalAdmin(body);
        break;
      case 'getRosterUntukOperasionalAdmin':
        data = getRosterUntukOperasionalAdmin(body);
        break;
      // ===== 2 case BARU 30 Okt 2026 (Tahap 5, audit SIKOP+SIPRES) --
      // fungsi lengkap & teruji, genuinely tidak terdaftar (murni
      // penyambungan). 3 fungsi simpanRekap*KeSheet SENGAJA TIDAK
      // disambungkan di sini -- signaturenya minta parameter `rekap`
      // (objek hasil hitung, bukan input sederhana dari UI), kemungkinan
      // besar dimaksudkan dipanggil INTERNAL oleh getRekapHarian/dst,
      // bukan endpoint API berdiri sendiri -- butuh keputusan desain,
      // bukan sekadar sambung. =====
      case 'isiAbsensiHadirMassal':
        data = isiAbsensiHadirMassal(body);
        break;
      case 'validasiJadwalDivisi':
        data = validasiJadwalDivisi(body);
        break;
      case 'jalankanPastikanModulRbacLengkap':
        // BARU 30 Okt 2026 (Tahap 7) -- lihat MigrasiSIMSDM.gs.
        data = jalankanPastikanModulRbacLengkap(body);
        break;
      case 'jalankanRapikanSpreadsheetSIMSDM':
        // BARU 30 Okt 2026 -- lihat MigrasiSIMSDM.gs.
        data = jalankanRapikanSpreadsheetSIMSDM(body);
        break;
      case 'getDataKartuCetakRelawan':
        data = getDataKartuCetakRelawan(body);
        break;
      // ===== 4 Nov 2026 -- tarif dengan TANGGAL BERLAKU (MasterTarif.gs). Aksi lama (getMasterTarifStandingAdmin, updateTarifRelawanAdmin) TETAP ada. =====
      case 'getMasterTarifAdmin':
        data = getMasterTarifAdmin(body);
        break;
      case 'simpanTarifBerlakuAdmin':
        data = simpanTarifBerlakuAdmin(body);
        break;
      case 'getRiwayatTarifAdmin':
        data = getRiwayatTarifAdmin(body);
        break;
      case 'getMasterTarifStandingAdmin':
        data = getMasterTarifStandingAdmin(body.token);
        break;
      case 'updateTarifRelawanAdmin':
        data = updateTarifRelawanAdmin(body);
        break;
      // ===== BARU 3 Nov 2026 -- SIPANDU database baru (SipanduV2.gs). Semua POST, token di body. =====
      case 'getStatusSipanduV2':
        data = getStatusSipanduV2(body);
        break;
      case 'getInstansiV2':
        data = getInstansiV2(body);
        break;
      case 'simpanInstansiV2':
        data = simpanInstansiV2(body);
        break;
      case 'simpanPicV2':
        data = simpanPicV2(body);
        break;
      case 'tugaskanPicV2':
        data = tugaskanPicV2(body);
        break;
      case 'getPmHarianV2':
        data = getPmHarianV2(body);
        break;
      case 'simpanPmHarianV2':
        data = simpanPmHarianV2(body);
        break;
      case 'getRiwayatPmV2':
        data = getRiwayatPmV2(body);
        break;
      case 'getDaftarTanggalPmV2':
        data = getDaftarTanggalPmV2(body);
        break;
      case 'getRingkasanPmV2':
        data = getRingkasanPmV2(body);
        break;
      case 'getMenuHarianV2':
        data = getMenuHarianV2(body);
        break;
      case 'getMenuMingguV2':
        data = getMenuMingguV2(body);
        break;
      case 'simpanMenuHarianV2':
        data = simpanMenuHarianV2(body);
        break;
      case 'getSaranMenuV2':
        data = getSaranMenuV2(body);
        break;
      case 'getMasterTarifLainV2':
        data = getMasterTarifLainV2(body);
        break;
      case 'simpanTarifLainV2':
        data = simpanTarifLainV2(body);
        break;
      case 'getRiwayatTarifLainV2':
        data = getRiwayatTarifLainV2(body);
        break;
      case 'getRekapPaguV2':
        data = getRekapPaguV2(body);
        break;
      case 'getKalenderRentangV2':
        data = getKalenderRentangV2(body);
        break;
      case 'simpanKalenderTanggalV2':
        data = simpanKalenderTanggalV2(body);
        break;
      case 'hapusKalenderTanggalV2':
        data = hapusKalenderTanggalV2(body);
        break;
      case 'simpanKalenderMassalV2':
        data = simpanKalenderMassalV2(body);
        break;
      case 'getRekapInsentifPicV2':
        data = getRekapInsentifPicV2(body);
        break;
      case 'getRekapBiayaV2':
        data = getRekapBiayaV2(body);
        break;
      case 'getAksesRelawanModul':
        data = getAksesRelawanModul(body);
        break;
      case 'simpanAksesRelawanModul':
        data = simpanAksesRelawanModul(body);
        break;
      case 'terbitkanTokenAplikasi':
        data = terbitkanTokenAplikasi(body);
        break;
      case 'getStatusJadwalOtomatis':
        data = getStatusJadwalOtomatis(body);
        break;
      case 'matikanJadwalOtomatis':
        data = matikanJadwalOtomatis(body);
        break;
      case 'hidupkanJadwalOtomatis':
        data = hidupkanJadwalOtomatis(body);
        break;
      case 'getRencanaImporRiwayatV2':
        data = getRencanaImporRiwayatV2(body);
        break;
      case 'jalankanImporRiwayatV2':
        data = jalankanImporRiwayatV2(body);
        break;
      case 'getRekapMingguanAdmin':
        // BARU 30 Okt 2026 -- "Rekap Per Minggu" (lihat MasterTarif.gs).
        // Dalam proses ini JUGA ditemukan & diperbaiki 2 bug nyata di
        // getRekapPenggajianAdmin (case di bawah): token tidak diteruskan
        // ke getRekapDuaMinggu (selalu lempar "Sesi tidak valid"), dan
        // .map() dipanggil langsung ke objek (bukan ke .data) -- KEDUANYA
        // membuat "Rekap Per Periode" kemungkinan besar rusak total
        // sebelum perbaikan ini.
        data = getRekapMingguanAdmin(body);
        break;
      case 'getRekapPenggajianAdmin':
        data = getRekapPenggajianAdmin(body);
        break;
      case 'getDaftarKartuAdmin':
        // BARU 29 Okt 2026 (dilaporkan Admin -- "Aksi tidak dikenali:
        // getDaftarKartuAdmin", panel Kartu QR). 4 case ini (sampai
        // getDataKartuCetakAdmin di bawah) TIDAK PERNAH ADA meski
        // dipanggil admin-kartu-qr.js -- lihat OperasionalQr.gs.
        data = getDaftarKartuAdmin(body.token);
        break;
      case 'generateKartuAdmin':
        data = generateKartuAdmin(body);
        break;
      case 'setStatusKartuAdmin':
        data = setStatusKartuAdmin(body);
        break;
      case 'getDataKartuCetakAdmin':
        data = getDataKartuCetakAdmin(body);
        break;
      case 'getDaftarRingkasKiosk':
        // BARU 29 Okt 2026 (dilaporkan Admin -- "SIPRES ga ada yg
        // muncul"). Case ini & submitAbsensiQr TIDAK PERNAH ADA meski
        // dipanggil absensi-qr.js -- lihat OperasionalQr.gs.
        data = getDaftarRingkasKiosk(body);
        break;
      case 'submitAbsensiQr':
        data = submitAbsensiQr(body);
        break;
      case 'submitAbsensi':
        data = submitAbsensi(body);
        break;
      case 'ajukanIzinSakit':
        data = ajukanIzinSakit(body);
        break;
      case 'login':
        data = adminLogin(body.username, body.password);
        break;
      case 'logout':
        data = logoutAdmin(body);
        break;
      case 'logoutAdmin':
        data = logoutAdmin(body);
        break;
      case 'resetAdminPasswordWithCode':
        data = resetAdminPasswordWithCode(body);
        break;
      case 'addRelawan':
        requireAuth(body.token);
        data = addRelawan(body);
        break;
      case 'updateRelawan':
        requireAuth(body.token);
        data = updateRelawan(body);
        break;
      case 'addDivisi':
        requireAuth(body.token);
        data = addDivisi(body);
        break;
      case 'addAkunRelawan':
        requireAuth(body.token);
        data = addAkunRelawan(body);
        break;
      case 'resetPasswordRelawan':
        requireAuth(body.token);
        data = resetPasswordRelawan(body);
        break;
      case 'updateStatusAkunRelawan':
        requireAuth(body.token);
        data = updateStatusAkunRelawan(body);
        break;
      case 'addInformasi':
        requireAuth(body.token);
        data = addInformasi(body);
        break;
      case 'updateInformasi':
        requireAuth(body.token);
        data = updateInformasi(body);
        break;
      case 'updateStatusInformasi':
        requireAuth(body.token);
        data = updateStatusInformasi(body);
        break;
      case 'addJadwal':
        requireAuth(body.token);
        data = addJadwal(body);
        break;
      case 'updateJadwal':
        requireAuth(body.token);
        data = updateJadwal(body);
        break;
      case 'deleteJadwal':
        requireAuth(body.token);
        data = deleteJadwal(body);
        break;
      case 'loginRelawan':
        data = relawanLogin(body.username, body.password);
        break;
      case 'logoutRelawan':
        data = logoutRelawan(body);
        break;
      case 'updateProfilRelawan':
        data = updateProfilRelawan(body);
        break;
      case 'kirimTestPushNotifikasi':
        data = kirimTestPushNotifikasi(body);
        break;
      case 'simpanTokenPushNotifikasi':
        data = simpanTokenPushNotifikasi(body);
        break;
      case 'nonaktifkanPushNotifikasi':
        data = nonaktifkanPushNotifikasi(body);
        break;
      case 'gantiUsernameRelawan':
        data = gantiUsernameRelawan(body);
        break;
      case 'simpanFotoProfilRelawan':
        data = simpanFotoProfilRelawan(body);
        break;
      case 'addDokumen':
        requireAuth(body.token);
        data = addDokumen(body);
        break;
      case 'updateStatusDokumen':
        requireAuth(body.token);
        data = updateStatusDokumen(body);
        break;
      case 'addNotifikasiSistem':
        // DIRAPIKAN 30 Okt 2026: dulu ada 2 definisi case ini -- yg
        // PERTAMA (aktif) TANPA requireAuth, yg kedua (mati) PAKAI.
        // Sekarang 1 definisi, DENGAN requireAuth.
        requireAuth(body.token);
        data = addNotifikasiSistem(body);
        break;
      case 'addPengumuman':
        requireAuth(body.token);
        data = addPengumuman(body);
        break;
      case 'importRelawanMassal':
        data = importRelawanMassal(body);
        break;
      case 'gantiPasswordRelawan':
        data = gantiPasswordRelawan(body);
        break;
      case 'addPeriode':
        requireAuth(body.token);
        data = addPeriode(body);
        break;
      case 'updatePeriode':
        requireAuth(body.token);
        data = updatePeriode(body);
        break;
      case 'updateStatusPeriode':
        requireAuth(body.token);
        data = updateStatusPeriode(body);
        break;
      case 'deletePeriode':
        requireAuth(body.token);
        data = deletePeriode(body);
        break;
      case 'addOperasional':
        requireAuth(body.token);
        data = addOperasional(body);
        break;
      case 'addOperasionalBulk':
        requireAuth(body.token);
        data = addOperasionalBulk(body);
        break;
      case 'updateStatusOperasional':
        requireAuth(body.token);
        data = updateStatusOperasional(body);
        break;
      case 'deleteOperasional':
        requireAuth(body.token);
        data = deleteOperasional(body);
        break;
      case 'hapusSemuaOperasionalPeriode':
        requireAuth(body.token);
        data = hapusSemuaOperasionalPeriode(body);
        break;
      case 'addLokasi':
        requireAuth(body.token);
        data = addLokasi(body);
        break;
      case 'updateLokasi':
        requireAuth(body.token);
        data = updateLokasi(body);
        break;
      case 'updateStatusLokasiAktif':
        requireAuth(body.token);
        data = updateStatusLokasiAktif(body);
        break;
      case 'deleteLokasi':
        requireAuth(body.token);
        data = deleteLokasi(body);
        break;
      case 'addKategoriStok':
        data = addKategoriStok(body);
        break;
      case 'updateStatusKategoriAktif':
        data = updateStatusKategoriAktif(body);
        break;
      case 'addSatuan':
        data = addSatuan(body);
        break;
      case 'updateStatusSatuanAktif':
        data = updateStatusSatuanAktif(body);
        break;
      case 'addBarang':
        data = addBarang(body);
        break;
      case 'updateBarang':
        data = updateBarang(body);
        break;
      case 'updateStatusBarangAktif':
        data = updateStatusBarangAktif(body);
        break;
      case 'simpanBarangMasuk':
        data = simpanBarangMasuk(body);
        break;
      case 'simpanBarangKeluar':
        data = simpanBarangKeluar(body);
        break;
      case 'setRoleStok':
        data = setRoleStok(body);
        break;
      case 'setRoleRelawan':
        data = setRoleRelawan(body);
        break;
      case 'addShiftDivisi':
        data = addShiftDivisi(body);
        break;
      case 'deleteShiftDivisi':
        data = deleteShiftDivisi(body);
        break;
      case 'addPenugasanKhusus':
        data = addPenugasanKhusus(body);
        break;
      case 'deletePenugasanKhusus':
        data = deletePenugasanKhusus(body);
        break;
      case 'koreksiTanggalOperasionalAbsensi':
        data = koreksiTanggalOperasionalAbsensi(body);
        break;
      // ===== 108 case BARU 30 Okt 2026 (audit 63 file resmi) -- fungsi SUDAH ADA & LENGKAP,
      // cuma belum pernah terdaftar di sini. TIDAK ADA logika baru ditulis, murni
      // menyambungkan ke fungsi yg sudah ada di file aslinya (lihat komentar tiap baris). =====
      case 'addDataPenerimaan':
        data = addDataPenerimaan(body); // WebsitePublik.gs
        break;
      case 'addPenerimaManfaat':
        data = addPenerimaManfaat(body); // PenerimaManfaat.gs
        break;
      case 'addPengelola':
        data = addPengelola(body); // PengelolaSPPG.gs
        break;
      case 'addPenugasanKhususBulk':
        data = addPenugasanKhususBulk(body); // shift.gs
        break;
      case 'addSiragaBarang':
        data = addSiragaBarang(body); // SiragaMasterData.gs
        break;
      case 'addSiragaKategori':
        data = addSiragaKategori(body); // SiragaMasterData.gs
        break;
      case 'addSiragaSupplier':
        data = addSiragaSupplier(body); // SiragaMasterData.gs
        break;
      case 'ajukanKebutuhan':
        data = ajukanKebutuhan(body); // Koordinator.gs
        break;
      case 'ajukanKetidakhadiran':
        data = ajukanKetidakhadiran(body); // PengajuanKetidakhadiran.gs
        break;
      case 'ajukanRetur':
        data = ajukanRetur(body); // Koordinator.gs
        break;
      case 'batalkanPengajuanKetidakhadiran':
        data = batalkanPengajuanKetidakhadiran(body); // PengajuanKetidakhadiran.gs
        break;
      case 'batalkanSiragaOpname':
        data = batalkanSiragaOpname(body); // SiragaOpname.gs
        break;
      case 'bentukJadwal':
        data = bentukJadwal(body); // SikopPembuatanJadwal.gs
        break;
      case 'bentukUlangJadwal':
        data = bentukUlangJadwal(body); // SikopPembuatanJadwal.gs
        break;
      case 'buatJadwalIndividu':
        data = buatJadwalIndividu(body); // JadwalIndividu.gs
        break;
      case 'buatLaporanKendala':
        data = buatLaporanKendala(body); // Koordinator.gs
        break;
      case 'cabutSipanduUserRole':
        data = cabutSipanduUserRole(body); // SipanduHakAkses.gs
        break;
      case 'cobaSinkronisasiUlang':
        data = cobaSinkronisasiUlang(body); // SikopPenetapan.gs
        break;
      case 'deleteDataPenerimaan':
        data = deleteDataPenerimaan(body); // WebsitePublik.gs
        break;
      case 'deleteMenuHarianPublik':
        data = deleteMenuHarianPublik(body); // WebsitePublik.gs
        break;
      case 'diagnosaSiragaAdmin':
        data = diagnosaSiragaAdmin(body); // SiragaDb.gs
        break;
      case 'getDaftarBarangUntukForm':
        data = getDaftarBarangUntukForm(body); // Koordinator.gs
        break;
      case 'getDaftarPenetapanPeriode':
        data = getDaftarPenetapanPeriode(body); // SikopPenetapan.gs
        break;
      case 'getDaftarRelawanUntukJadwalIndividu':
        data = getDaftarRelawanUntukJadwalIndividu(body); // JadwalIndividu.gs
        break;
      case 'getDuplikatRosterAdmin':
        data = getDuplikatRosterAdmin(body); // Absensi.gs
        break;
      case 'getJadwalAnggotaKoordinator':
        data = getJadwalAnggotaKoordinator(body); // SikopPenetapan.gs
        break;
      case 'getJadwalIndividuRelawan':
        data = getJadwalIndividuRelawan(body); // JadwalIndividu.gs
        break;
      case 'getKonfigurasiHakAksesSatu':
        data = getKonfigurasiHakAksesSatu(body); // ManajemenHakAkses.gs
        break;
      case 'getKonfigurasiMultiShiftDivisi':
        data = getKonfigurasiMultiShiftDivisi(body); // SikopMultiShift.gs
        break;
      case 'getLaporanJadwalPenugasan':
        data = getLaporanJadwalPenugasan(body); // LaporanRelawanJadwal.gs
        break;
      case 'getLaporanKendalaKoordinator':
        data = getLaporanKendalaKoordinator(body); // Koordinator.gs
        break;
      case 'getLaporanKoreksiPresensi':
        data = getLaporanKoreksiPresensi(body); // LaporanSipika.gs
        break;
      case 'getLaporanRelawan':
        data = getLaporanRelawan(body); // LaporanRelawanJadwal.gs
        break;
      case 'getMonitoringPresensiAdmin':
        data = getMonitoringPresensiAdmin(body); // MigrasiRosterV2.gs
        break;
      case 'getPengajuanKebutuhanAdmin':
        data = getPengajuanKebutuhanAdmin(body); // Koordinator.gs
        break;
      case 'getPengajuanKebutuhanKoordinator':
        data = getPengajuanKebutuhanKoordinator(body); // Koordinator.gs
        break;
      case 'getPengajuanKetidakhadiranAdmin':
        data = getPengajuanKetidakhadiranAdmin(body); // PengajuanKetidakhadiran.gs
        break;
      case 'getProfilRelawanAdmin':
        data = getProfilRelawanAdmin(body); // Akun.gs
        break;
      case 'getReturBarangAdmin':
        data = getReturBarangAdmin(body); // Koordinator.gs
        break;
      case 'getReturBarangKoordinator':
        data = getReturBarangKoordinator(body); // Koordinator.gs
        break;
      case 'getRingkasanPemeriksaanPeriode':
        data = getRingkasanPemeriksaanPeriode(body); // SikopPenetapan.gs
        break;
      case 'getRiwayatPenetapanDivisi':
        data = getRiwayatPenetapanDivisi(body); // SikopPenetapan.gs
        break;
      case 'getRiwayatPerubahanHakAkses':
        data = getRiwayatPerubahanHakAkses(body); // ManajemenHakAkses.gs
        break;
      case 'getSiragaActivityLogs':
        data = getSiragaActivityLogs(body); // SiragaDb.gs
        break;
      case 'getSiragaBarangList':
        data = getSiragaBarangList(body); // SiragaMasterData.gs
        break;
      case 'getSiragaBarangListAdmin':
        data = getSiragaBarangListAdmin(body); // SiragaMasterData.gs
        break;
      case 'getSiragaBatchList':
        data = getSiragaBatchList(body); // SiragaBatch.gs
        break;
      case 'getSiragaBatchListAdmin':
        data = getSiragaBatchListAdmin(body); // SiragaBatch.gs
        break;
      case 'getSiragaDashboardV2':
        data = getSiragaDashboardV2(body); // SiragaDb.gs
        break;
      case 'getSiragaKartuStok':
        data = getSiragaKartuStok(body); // SiragaStok.gs
        break;
      case 'getSiragaKategoriList':
        data = getSiragaKategoriList(body); // SiragaMasterData.gs
        break;
      case 'getSiragaKategoriListAdmin':
        data = getSiragaKategoriListAdmin(body); // SiragaMasterData.gs
        break;
      case 'getSiragaOpnameList':
        data = getSiragaOpnameList(body); // SiragaOpname.gs
        break;
      case 'getSiragaSupplierList':
        data = getSiragaSupplierList(body); // SiragaMasterData.gs
        break;
      case 'getSiragaSupplierListAdmin':
        data = getSiragaSupplierListAdmin(body); // SiragaMasterData.gs
        break;
      case 'getSiragaTransaksiList':
        data = getSiragaTransaksiList(body); // SiragaStok.gs
        break;
      case 'getStatusPenetapanAdmin':
        data = getStatusPenetapanAdmin(body); // SikopPenetapan.gs
        break;
      case 'getTugasHarianKoordinator':
        data = getTugasHarianKoordinator(body); // Koordinator.gs
        break;
      case 'hapusAbsensi':
        data = hapusAbsensi(body); // shift.gs
        break;
      case 'hapusJadwalIndividu':
        data = hapusJadwalIndividu(body); // JadwalIndividu.gs
        break;
      case 'hapusKelompokRotasi':
        data = hapusKelompokRotasi(body); // SikopMultiShift.gs
        break;
      case 'hapusShiftDivisiDetail':
        data = hapusShiftDivisiDetail(body); // SikopMultiShift.gs
        break;
      case 'hapusTemplatKeterangan':
        data = hapusTemplatKeterangan(body); // SikopMultiShift.gs
        break;
      case 'isiStokFisikSiragaOpname':
        data = isiStokFisikSiragaOpname(body); // SiragaOpname.gs
        break;
      case 'jalankanMigrasiRoleBaru':
        data = jalankanMigrasiRoleBaru(body); // ManajemenHakAkses.gs
        break;
      case 'kirimNotifikasiKategoriKehadiran':
        data = kirimNotifikasiKategoriKehadiran(body); // AdminDashboard.gs
        break;
      case 'koreksiAbsensiAktual':
        data = koreksiAbsensiAktual(body); // JadwalIndividu.gs
        break;
      case 'mulaiSiragaOpname':
        data = mulaiSiragaOpname(body); // SiragaOpname.gs
        break;
      case 'pindahTanggalJadwalIndividu':
        data = pindahTanggalJadwalIndividu(body); // JadwalIndividu.gs
        break;
      case 'pratinjauPembuatanJadwal':
        data = pratinjauPembuatanJadwal(body); // SikopPembuatanJadwal.gs
        break;
      case 'prosesPengajuanKebutuhan':
        data = prosesPengajuanKebutuhan(body); // Koordinator.gs
        break;
      case 'prosesReturBarang':
        data = prosesReturBarang(body); // Koordinator.gs
        break;
      case 'selesaikanSiragaOpname':
        data = selesaikanSiragaOpname(body); // SiragaOpname.gs
        break;
      case 'setKontenPublik':
        data = setKontenPublik(body); // WebsitePublik.gs
        break;
      case 'setPengaturanPortal':
        data = setPengaturanPortal(body); // Pengaturan.gs
        break;
      case 'setSipanduUserRole':
        data = setSipanduUserRole(body); // SipanduHakAkses.gs
        break;
      case 'setStatusPenerimaManfaat':
        data = setStatusPenerimaManfaat(body); // PenerimaManfaat.gs
        break;
      case 'setStatusPengelola':
        data = setStatusPengelola(body); // PengelolaSPPG.gs
        break;
      case 'setujuiPengajuanKetidakhadiran':
        data = setujuiPengajuanKetidakhadiran(body); // PengajuanKetidakhadiran.gs
        break;
      case 'simpanKelompokRotasi':
        data = simpanKelompokRotasi(body); // SikopMultiShift.gs
        break;
      case 'simpanKonfigurasiHakAkses':
        data = simpanKonfigurasiHakAkses(body); // ManajemenHakAkses.gs
        break;
      case 'simpanKonfigurasiValidasiJadwal':
        data = simpanKonfigurasiValidasiJadwal(body); // SikopMultiShift.gs
        break;
      case 'simpanMenuHarianPublik':
        data = simpanMenuHarianPublik(body); // WebsitePublik.gs
        break;
      case 'simpanOverrideShiftTanggal':
        data = simpanOverrideShiftTanggal(body); // SikopMultiShift.gs
        break;
      case 'simpanShiftDivisiDetail':
        data = simpanShiftDivisiDetail(body); // SikopMultiShift.gs
        break;
      case 'simpanTemplatKeterangan':
        data = simpanTemplatKeterangan(body); // SikopMultiShift.gs
        break;
      case 'simpanTugasHarian':
        data = simpanTugasHarian(body); // Koordinator.gs
        break;
      case 'siragaBarangKeluar':
        data = siragaBarangKeluar(body); // SiragaStok.gs
        break;
      case 'siragaBarangMasuk':
        data = siragaBarangMasuk(body); // SiragaStok.gs
        break;
      case 'siragaPemusnahan':
        data = siragaPemusnahan(body); // SiragaStok.gs
        break;
      case 'siragaTransfer':
        data = siragaTransfer(body); // SiragaStok.gs
        break;
      case 'tandaiHadirManual':
        data = tandaiHadirManual(body); // shift.gs
        break;
      case 'terapkanPemetaanIdRelawan':
        data = terapkanPemetaanIdRelawan(body); // PerbaikanIdRelawan.gs
        break;
      case 'tetapkanJadwalDivisi':
        data = tetapkanJadwalDivisi(body); // SikopPenetapan.gs
        break;
      case 'toggleAktifDataPenerimaan':
        data = toggleAktifDataPenerimaan(body); // WebsitePublik.gs
        break;
      case 'toggleAktifMenuHarianPublik':
        data = toggleAktifMenuHarianPublik(body); // WebsitePublik.gs
        break;
      case 'tolakPengajuanKetidakhadiran':
        data = tolakPengajuanKetidakhadiran(body); // PengajuanKetidakhadiran.gs
        break;
      case 'ubahJadwalIndividu':
        data = ubahJadwalIndividu(body); // JadwalIndividu.gs
        break;
      case 'ubahRoleBaruPengguna':
        data = ubahRoleBaruPengguna(body); // ManajemenHakAkses.gs
        break;
      case 'updateDataPenerimaan':
        data = updateDataPenerimaan(body); // WebsitePublik.gs
        break;
      case 'updateMenuHarianPublik':
        data = updateMenuHarianPublik(body); // WebsitePublik.gs
        break;
      case 'updateMenuWebsite':
        data = updateMenuWebsite(body); // WebsitePublik.gs
        break;
      case 'updatePenerimaManfaat':
        data = updatePenerimaManfaat(body); // PenerimaManfaat.gs
        break;
      case 'updatePengelola':
        data = updatePengelola(body); // PengelolaSPPG.gs
        break;
      case 'updateProfilRelawanAdmin':
        data = updateProfilRelawanAdmin(body); // Akun.gs
        break;
      case 'updateSiragaBarangStatus':
        data = updateSiragaBarangStatus(body); // SiragaMasterData.gs
        break;
      case 'updateSiragaKategoriStatus':
        data = updateSiragaKategoriStatus(body); // SiragaMasterData.gs
        break;
      case 'updateSiragaSupplier':
        data = updateSiragaSupplier(body); // SiragaMasterData.gs
        break;

      default:
        return gagal('Aksi tidak dikenali: ' + action, 'UNKNOWN_ACTION');
    }
    return sukses(data);
  } catch (err) {
    return gagal(err.message || 'Terjadi kesalahan pada server.', klasifikasiError_(err));
  }
}

/**
 * Mengelompokkan pesan error menjadi kode kategori sederhana, supaya
 * frontend/log bisa membedakan "sesi habis" dari "input tidak valid" dari
 * "kesalahan server murni" — tanpa mengubah pesan yang sudah ada.
 */
function klasifikasiError_(err) {
  const pesan = String((err && err.message) || '').toLowerCase();
  if (pesan.indexOf('sesi') !== -1) return 'AUTH_ERROR';
  if (pesan.indexOf('tidak ditemukan') !== -1) return 'DATA_NOT_FOUND';
  if (pesan.indexOf('wajib') !== -1 || pesan.indexOf('tidak valid') !== -1 || pesan.indexOf('minimal') !== -1) return 'VALIDATION_ERROR';
  return 'SERVER_ERROR';
}


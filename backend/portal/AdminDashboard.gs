/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * AdminDashboard.gs — Agregator Dashboard Pengelola (BARU)
 *
 * Satu fungsi, satu panggilan API, menggabungkan ringkasan dari beberapa
 * modul (SIPRES, SIKOP, SIRAGA, SIPANDU) khusus untuk Dashboard Pengelola.
 * SEMUA logic DASAR di-reuse dari fungsi yang sudah ada (getRekapHarian,
 * statusStokBarang_, dst) -- file ini CUMA mengagregasi & meringkas,
 * tidak menduplikasi logic hitung yang sudah ada di modul lain.
 *
 * Otorisasi pakai requireAuth (Admin Portal biasa) -- BUKAN
 * requireSipanduPermission_/requireRole_ relawan -- supaya Dashboard
 * Pengelola SELALU bisa diakses Admin, tidak bergantung status
 * akses relawan/SIPANDU Admin itu sendiri (pola sama seperti perbaikan
 * Hak Akses SIPANDU sebelumnya).
 */
/**
 * Kirim notifikasi HANYA ke relawan dalam 1 kategori kehadiran hari ini
 * (Belum Absen Masuk / Belum Absen Pulang / Terlambat / Belum Absen).
 * Daftar ID dihitung ULANG di backend (BUKAN percaya ID yang dikirim
 * client) -- supaya Admin tidak bisa "dibohongi" client yang sudah basi
 * jadi mengirim ke orang yang salah.
 */
const KATEGORI_NOTIF_KEHADIRAN_VALID = ['belumMasuk', 'belumPulang', 'terlambat', 'belumAbsen'];
const JUDUL_KATEGORI_KEHADIRAN = {
  belumMasuk: 'Pengingat Absen Masuk',
  belumPulang: 'Pengingat Absen Pulang',
  terlambat: 'Catatan Keterlambatan',
  belumAbsen: 'Pengingat Presensi Hari Ini'
};
const ISI_KATEGORI_KEHADIRAN = {
  belumMasuk: 'Anda belum melakukan Absen Masuk hari ini. Segera lakukan presensi.',
  belumPulang: 'Anda belum melakukan Absen Pulang hari ini. Jangan lupa presensi pulang sebelum meninggalkan lokasi.',
  terlambat: 'Anda tercatat terlambat pada presensi hari ini. Mohon diperhatikan untuk hari berikutnya.',
  belumAbsen: 'Anda belum melakukan presensi sama sekali hari ini. Segera lakukan Absen Masuk.'
};

function kirimNotifikasiKategoriKehadiran(body) {
  const admin = requireAuth(body.token);
  const kategori = sanitize(body.kategori);
  if (KATEGORI_NOTIF_KEHADIRAN_VALID.indexOf(kategori) === -1) throw new Error('Kategori tidak valid.');

  const hariIni = formatTanggal(new Date());
  const rekap = getRekapHarian(hariIni, body.token).data;
  let idTarget = [];
  if (kategori === 'belumMasuk') idTarget = rekap.filter(r => r.status === 'BELUM ABSEN').map(r => r.id);
  else if (kategori === 'terlambat') idTarget = rekap.filter(r => r.status === 'TERLAMBAT').map(r => r.id);
  else if (kategori === 'belumPulang') idTarget = rekap.filter(r => (r.status === 'HADIR' || r.status === 'TERLAMBAT') && !r.jamPulang).map(r => r.id);
  else if (kategori === 'belumAbsen') idTarget = rekap.filter(r => r.status !== 'HADIR' && r.status !== 'TERLAMBAT').map(r => r.id);

  if (!idTarget.length) return { success: true, jumlahDikirim: 0 };

  const judul = JUDUL_KATEGORI_KEHADIRAN[kategori];
  const isi = ISI_KATEGORI_KEHADIRAN[kategori];
  idTarget.forEach(idR => {
    catatNotifikasi_('Presensi', judul, isi, idR);
    try { kirimPushNotifikasi_(idR, '📢 ' + judul, isi, { link: '/absensi.html' }); } catch (e) { /* push gagal -- jangan gagalkan pencatatan */ }
  });

  logAudit_('KIRIM_NOTIFIKASI_KATEGORI', 'DASHBOARD_PENGELOLA', kategori, admin, { jumlah: idTarget.length });
  return { success: true, jumlahDikirim: idTarget.length };
}

function getDashboardPengelola(token) {
  const _t0 = Date.now();
  requireAuth(token, true); // true = Staff (monitoring) boleh akses ringkasan ini
  Logger.log('[DASHBOARD] setelah requireAuth: ' + (Date.now()-_t0) + 'ms');
  const hariIni = formatTanggal(new Date());

  // ---- 1. KEHADIRAN HARI INI (reuse getRekapHarian, tidak scan ulang) ----
  // 6 kategori sesuai spesifikasi -- "Belum Absen Masuk" HANYA relawan yang
  // genuinely belum ada record sama sekali (exclude Izin/Sakit/Cuti, karena
  // mereka SUDAH punya keterangan/aktivitas). "Belum Absen" lebih umum --
  // gabungan (belum lapor sama sekali) + (Izin/Sakit/Cuti), karena
  // sama-sama berarti "tidak datang bekerja" hari ini.
  let kehadiran = { terlambat: 0, sudahMasuk: 0, sudahPulang: 0, belumMasuk: 0, belumPulang: 0, belumAbsen: 0 };
  const idBelumMasuk = [], idBelumPulang = [], idTerlambat = [], idBelumAbsen = [];
  try {
    const rekap = getRekapHarian(hariIni, token).data;
    rekap.forEach(r => {
      if (r.status === 'TERLAMBAT') { kehadiran.terlambat++; idTerlambat.push(r.id); }
      if (r.status === 'HADIR' || r.status === 'TERLAMBAT') {
        kehadiran.sudahMasuk++;
        if (r.jamPulang) { kehadiran.sudahPulang++; }
        else { kehadiran.belumPulang++; idBelumPulang.push(r.id); }
      } else if (r.status === 'BELUM ABSEN') {
        kehadiran.belumMasuk++; idBelumMasuk.push(r.id);
        kehadiran.belumAbsen++; idBelumAbsen.push(r.id);
      } else {
        // IZIN / SAKIT / CUTI -- sudah ada keterangan, tapi tetap "tidak
        // datang bekerja" hari ini, jadi ikut dihitung di "Belum Absen".
        kehadiran.belumAbsen++; idBelumAbsen.push(r.id);
      }
    });
  } catch (e) { /* biarkan default 0 kalau ada masalah baca Absensi -- jangan gagalkan seluruh Dashboard */ }

  Logger.log('[DASHBOARD] setelah bagian 1 (Kehadiran): ' + (Date.now()-_t0) + 'ms');
  // ---- 2. JADWAL & PENUGASAN HARI INI ----
  // Definisi sederhana: dianggap "sudah diatur" kalau ADA minimal 1 baris
  // di Shift Divisi ATAU Penugasan Khusus untuk operasional hari ini.
  let jadwal = { sudahDiatur: false, jumlahShiftDivisi: 0, jumlahPenugasanKhusus: 0 };
  try {
    const shiftDivisi = getShiftDivisiRows_();
    const penugasanKhusus = getPenugasanKhususRows_();
    jadwal.jumlahShiftDivisi = shiftDivisi.length;
    jadwal.jumlahPenugasanKhusus = penugasanKhusus.filter(p => {
      // ID_OPERASIONAL biasanya memuat tanggal -- cek kecocokan longgar dengan hari ini.
      return String(p.ID_OPERASIONAL || '').indexOf(hariIni) !== -1;
    }).length;
    jadwal.sudahDiatur = (!jadwalOtomatisMati_() && jadwal.jumlahShiftDivisi > 0) || jadwal.jumlahPenugasanKhusus > 0;   // 4 Nov 2026: jadwal otomatis mati -> hanya penugasan yang dihitung
  } catch (e) { /* biarkan default kalau sheet Shift belum ada/kosong */ }

  Logger.log('[DASHBOARD] setelah bagian 2 (Jadwal): ' + (Date.now()-_t0) + 'ms');
  // ---- 3. SIRAGA — PERSEDIAAN (reuse statusStokBarang_) ----
  let siraga = { totalBarang: 0, aman: 0, menipis: 0, kritis: 0 };
  try {
    const sheet = getSheet(NAMA_SHEET.STOK_BARANG);
    const barang = sheetToObjects(sheet).filter(b => String(b.AKTIF).toUpperCase() !== 'FALSE' && b.AKTIF !== false);
    siraga.totalBarang = barang.length;
    barang.forEach(b => {
      const status = statusStokBarang_(Number(b.STOK_SAAT_INI) || 0, Number(b.STOK_MINIMUM) || 0);
      if (status === 'AMAN') siraga.aman++;
      else if (status === 'MENIPIS') siraga.menipis++;
      else siraga.kritis++; // HABIS dipetakan sebagai "kritis" di Dashboard
    });
  } catch (e) { /* biarkan default kalau sheet Barang belum ada/kosong */ }

  Logger.log('[DASHBOARD] setelah bagian 3 (SIRAGA): ' + (Date.now()-_t0) + 'ms');
  // ---- 4. SIPANDU — ringkasan (baca langsung, TANPA requireSipanduPermission_,
  //         karena Admin sudah tervalidasi requireAuth di atas -- pola sama
  //         seperti perbaikan Hak Akses SIPANDU sebelumnya) ----
  let sipandu = { adaData: false, woHariIni: 0, perluValidasi: 0 };
  try {
    const semuaWo = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS));
    sipandu.adaData = semuaWo.length > 0;
    sipandu.woHariIni = semuaWo.filter(w => String(w.TANGGAL || '').indexOf(hariIni) !== -1).length;
    sipandu.perluValidasi = semuaWo.filter(w => String(w.STATUS).toUpperCase() === 'MENUNGGU_VALIDASI').length;
  } catch (e) { /* SIPANDU_SPREADSHEET_ID mungkin belum diisi -- jangan gagalkan Dashboard Pengelola */ }

  Logger.log('[DASHBOARD] setelah bagian 4 (SIPANDU): ' + (Date.now()-_t0) + 'ms');
  // ---- 5. PERIODE AKTIF + KALENDER OPERASIONAL (reuse getKalenderListAdmin) ----
  // Judul kalender = nama Periode Aktif (bukan judul statis), status per
  // tanggal pakai field STATUS yang SUDAH ADA di sheet Kalender (bukan
  // logic baru) -- sesuai instruksi "gunakan status existing".
  let periodeAktif = null;
  let kalenderPeriodeAktif = [];
  try {
    sinkronStatusPeriodeOtomatis_();   // 4 Nov 2026: status periode mengikuti tanggal (menu Periode disembunyikan)
    const semuaPeriode = sheetToObjects(getPeriodeSheet());
    const aktif = semuaPeriode.find(p => String(p.STATUS).toUpperCase() === 'AKTIF');
    if (aktif) {
      periodeAktif = {
        id: aktif.ID_PERIODE, nama: aktif.NAMA_PERIODE,
        tanggalMulai: aktif.TANGGAL_MULAI, tanggalSelesai: aktif.TANGGAL_SELESAI,
        // Versi ISO -- WAJIB dipakai untuk perbandingan/pemanggilan fungsi
        // lain (mis. getRekapDuaMinggu, yang membandingkan tanggal sebagai
        // string), karena TANGGAL_MULAI mentah dari sheet BUKAN format ISO.
        tanggalMulaiIso: tanggalSheetKeIso_(aktif.TANGGAL_MULAI),
        tanggalSelesaiIso: tanggalSheetKeIso_(aktif.TANGGAL_SELESAI)
      };
      kalenderPeriodeAktif = getKalenderListAdmin(aktif.ID_PERIODE).map(k => ({
        ...k,
        adalahHariIni: tanggalSheetKeIso_(k.tanggal) === hariIni
      }));
    }
  } catch (e) { /* biarkan null kalau Periode/Kalender belum diisi -- jangan gagalkan Dashboard */ }

  Logger.log('[DASHBOARD] setelah bagian 5 (Periode+Kalender): ' + (Date.now()-_t0) + 'ms');
  // ---- 6. REKAP 2 MINGGU — otomatis "Sementara" atau "Selesai" mengikuti
  //         status Periode Aktif (reuse getRekapDuaMinggu, tidak scan ulang) ----
  let rekapDuaMinggu = { tersedia: false, sementara: true, judul: '', data: [] };
  try {
    if (periodeAktif) {
      rekapDuaMinggu.tersedia = true;
      rekapDuaMinggu.sementara = true; // periode AKTIF berarti masih berjalan -> sementara
      rekapDuaMinggu.judul = periodeAktif.nama;
      rekapDuaMinggu.data = getRekapDuaMinggu(periodeAktif.tanggalMulaiIso, periodeAktif.tanggalSelesaiIso, token).data; // ekstrak array-nya saja (bukan seluruh wrapper {periodeAwal,periodeAkhir,totalHariKerja,data}) -- lihat catatan bug ganda-wrap
    } else {
      // Tidak ada periode AKTIF -- ambil periode SELESAI paling baru sebagai rekap final.
      const semuaPeriode = sheetToObjects(getPeriodeSheet());
      const selesai = semuaPeriode.filter(p => String(p.STATUS).toUpperCase() === 'SELESAI')
        .sort((a, b) => (tanggalSheetKeIso_(b.TANGGAL_SELESAI) || '').localeCompare(tanggalSheetKeIso_(a.TANGGAL_SELESAI) || ''))[0];
      if (selesai) {
        rekapDuaMinggu.tersedia = true;
        rekapDuaMinggu.sementara = false;
        rekapDuaMinggu.judul = selesai.NAMA_PERIODE;
        rekapDuaMinggu.data = getRekapDuaMinggu(tanggalSheetKeIso_(selesai.TANGGAL_MULAI), tanggalSheetKeIso_(selesai.TANGGAL_SELESAI), token).data; // ekstrak array-nya saja (bukan seluruh wrapper {periodeAwal,periodeAkhir,totalHariKerja,data}) -- lihat catatan bug ganda-wrap
      }
    }
  } catch (e) { /* biarkan default kalau data periode/rekap belum tersedia */ }

  Logger.log('[DASHBOARD] TOTAL SELESAI: ' + (Date.now()-_t0) + 'ms');
  return {
    tanggal: hariIni, kehadiran: kehadiran, jadwal: jadwal, siraga: siraga, sipandu: sipandu,
    periodeAktif: periodeAktif, kalenderPeriodeAktif: kalenderPeriodeAktif, rekapDuaMinggu: rekapDuaMinggu,
    idRelawanBelumMasuk: idBelumMasuk, idRelawanBelumPulang: idBelumPulang,
    idRelawanTerlambat: idTerlambat, idRelawanBelumAbsen: idBelumAbsen
  };
}

// ==================================================================
// OPTIMASI (menggantikan getDashboardPengelola di atas untuk pemakaian
// baru) -- getDashboardPengelola SENGAJA TIDAK dihapus/diubah (sesuai
// instruksi "jangan hapus endpoint lama sembarangan"), tapi TIDAK lagi
// dipanggil dari initDashboard() di admin.js. Fungsi itu menggabungkan
// 6 bagian yang prioritasnya berbeda-beda (Kehadiran P1 s.d. Rekap P6)
// jadi SATU response -- akibatnya Kehadiran, yang paling sering dilihat,
// ikut menunggu Rekap 2 Minggu selesai dihitung, walau tidak saling
// berhubungan sama sekali.
//
// 4 fungsi di bawah memecahnya sesuai prioritas: P1-P3 digabung (semuanya
// ringan & sama-sama harus tampil duluan), P4 (ringkasan akun), P5
// (SIRAGA), dan Rekap 2 Minggu masing-masing JADI REQUEST TERPISAH --
// supaya salah satu yang lambat/gagal tidak menahan yang lain.
// ==================================================================

/** P1 (Kehadiran) + P2 (Jadwal) + P3 (Kalender/Periode) -- digabung 1 request karena sama-sama ringan & sama-sama prioritas utama. */
function getDashboardPengelolaRingan(token) {
  requireAuth(token, true);
  const hariIni = formatTanggal(new Date());

  // ---- P1: KEHADIRAN HARI INI (reuse getRekapHarian, tidak scan ulang) ----
  let kehadiran = { terlambat: 0, sudahMasuk: 0, sudahPulang: 0, belumMasuk: 0, belumPulang: 0, belumAbsen: 0, totalTerjadwal: 0 };
  const idBelumMasuk = [], idBelumPulang = [], idTerlambat = [], idBelumAbsen = [];
  try {
    const rekap = getRekapHarian(hariIni, token).data;
    kehadiran.totalTerjadwal = rekap.length; // BARU (16 Okt 2026, diminta Admin) -- jumlah relawan terjadwal hari ini
    rekap.forEach(r => {
      if (r.status === 'TERLAMBAT') { kehadiran.terlambat++; idTerlambat.push(r.id); }
      if (r.status === 'HADIR' || r.status === 'TERLAMBAT') {
        kehadiran.sudahMasuk++;
        if (r.jamPulang) { kehadiran.sudahPulang++; }
        else { kehadiran.belumPulang++; idBelumPulang.push(r.id); }
      } else if (r.status === 'BELUM ABSEN') {
        kehadiran.belumMasuk++; idBelumMasuk.push(r.id);
        kehadiran.belumAbsen++; idBelumAbsen.push(r.id);
      } else {
        kehadiran.belumAbsen++; idBelumAbsen.push(r.id);
      }
    });
  } catch (e) { /* biarkan default 0 -- jangan gagalkan bagian lain */ }

  // ---- P2: JADWAL & PENUGASAN HARI INI ----
  let jadwal = { sudahDiatur: false, jumlahShiftDivisi: 0, jumlahPenugasanKhusus: 0 };
  try {
    const shiftDivisi = getShiftDivisiRows_();
    const penugasanKhusus = getPenugasanKhususRows_();
    jadwal.jumlahShiftDivisi = shiftDivisi.length;
    jadwal.jumlahPenugasanKhusus = penugasanKhusus.filter(p => String(p.ID_OPERASIONAL || '').indexOf(hariIni) !== -1).length;
    jadwal.sudahDiatur = (!jadwalOtomatisMati_() && jadwal.jumlahShiftDivisi > 0) || jadwal.jumlahPenugasanKhusus > 0;   // 4 Nov 2026: jadwal otomatis mati -> hanya penugasan yang dihitung
  } catch (e) { /* biarkan default */ }

  // ---- P3: PERIODE AKTIF + KALENDER OPERASIONAL ----
  let periodeAktif = null;
  let kalenderPeriodeAktif = [];
  try {
    const semuaPeriode = sheetToObjects(getPeriodeSheet());
    const aktif = semuaPeriode.find(p => String(p.STATUS).toUpperCase() === 'AKTIF');
    if (aktif) {
      periodeAktif = {
        id: aktif.ID_PERIODE, nama: aktif.NAMA_PERIODE,
        tanggalMulai: aktif.TANGGAL_MULAI, tanggalSelesai: aktif.TANGGAL_SELESAI,
        tanggalMulaiIso: tanggalSheetKeIso_(aktif.TANGGAL_MULAI),
        tanggalSelesaiIso: tanggalSheetKeIso_(aktif.TANGGAL_SELESAI)
      };
      kalenderPeriodeAktif = getKalenderListAdmin(aktif.ID_PERIODE).map(k => ({
        ...k,
        adalahHariIni: tanggalSheetKeIso_(k.tanggal) === hariIni
      }));
    }
  } catch (e) { /* biarkan null */ }

  return {
    tanggal: hariIni, kehadiran: kehadiran, jadwal: jadwal,
    periodeAktif: periodeAktif, kalenderPeriodeAktif: kalenderPeriodeAktif,
    idRelawanBelumMasuk: idBelumMasuk, idRelawanBelumPulang: idBelumPulang,
    idRelawanTerlambat: idTerlambat, idRelawanBelumAbsen: idBelumAbsen
  };
}

/** P4 -- ringkasan Akun Relawan SAJA (total/aktif/nonaktif), BUKAN seluruh baris/kolom seperti getAkunRelawanList. Untuk Dashboard; panel "Akun Relawan" tetap pakai getAkunRelawanList seperti biasa. */
function getRingkasanAkunRelawan(token) {
  requireAuth(token, true);
  const akun = sheetToObjects(getAkunSheet());
  let aktif = 0, nonaktif = 0;
  akun.forEach(a => {
    if (String(a.STATUS_AKUN).toUpperCase() === 'AKTIF') aktif++; else nonaktif++;
  });
  return { total: akun.length, aktif: aktif, nonaktif: nonaktif };
}

/** P5 -- SIRAGA, request terpisah supaya tidak menahan/tertahan P1-P4. */
function getSiragaDashboard(token) {
  requireAuth(token, true);
  let siraga = { totalBarang: 0, aman: 0, menipis: 0, kritis: 0 };
  try {
    const sheet = getSheet(NAMA_SHEET.STOK_BARANG);
    const barang = sheetToObjects(sheet).filter(b => String(b.AKTIF).toUpperCase() !== 'FALSE' && b.AKTIF !== false);
    siraga.totalBarang = barang.length;
    barang.forEach(b => {
      const status = statusStokBarang_(Number(b.STOK_SAAT_INI) || 0, Number(b.STOK_MINIMUM) || 0);
      if (status === 'AMAN') siraga.aman++;
      else if (status === 'MENIPIS') siraga.menipis++;
      else siraga.kritis++;
    });
  } catch (e) { /* biarkan default kalau sheet Barang belum ada/kosong */ }
  return siraga;
}

/** SIPANDU ringkasan -- request terpisah, tidak lagi ikut menahan P1-P4. */
function getSipanduDashboardRingkas(token) {
  requireAuth(token, true);
  const hariIni = formatTanggal(new Date());
  let sipandu = { adaData: false, woHariIni: 0, perluValidasi: 0 };
  try {
    const semuaWo = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS));
    sipandu.adaData = semuaWo.length > 0;
    sipandu.woHariIni = semuaWo.filter(w => String(w.TANGGAL || '').indexOf(hariIni) !== -1).length;
    sipandu.perluValidasi = semuaWo.filter(w => String(w.STATUS).toUpperCase() === 'MENUNGGU_VALIDASI').length;
  } catch (e) { /* SIPANDU_SPREADSHEET_ID mungkin belum diisi */ }
  return sipandu;
}

/** P6 -- Rekap 2 Minggu, request TERPISAH (paling berpotensi berat) -- TIDAK BOLEH menahan status "Dashboard siap". */
function getRekapDuaMingguDashboard(token) {
  requireAuth(token, true);
  let rekapDuaMinggu = { tersedia: false, sementara: true, judul: '', data: [] };
  try {
    const semuaPeriode = sheetToObjects(getPeriodeSheet());
    const aktif = semuaPeriode.find(p => String(p.STATUS).toUpperCase() === 'AKTIF');
    if (aktif) {
      const tanggalMulaiIso = tanggalSheetKeIso_(aktif.TANGGAL_MULAI);
      const tanggalSelesaiIso = tanggalSheetKeIso_(aktif.TANGGAL_SELESAI);
      rekapDuaMinggu.tersedia = true;
      rekapDuaMinggu.sementara = true;
      rekapDuaMinggu.judul = aktif.NAMA_PERIODE;
      rekapDuaMinggu.data = getRekapDuaMinggu(tanggalMulaiIso, tanggalSelesaiIso, token).data; // ekstrak array-nya saja (bukan seluruh wrapper {periodeAwal,periodeAkhir,totalHariKerja,data}) -- lihat catatan bug ganda-wrap
    } else {
      const selesai = semuaPeriode.filter(p => String(p.STATUS).toUpperCase() === 'SELESAI')
        .sort((a, b) => (tanggalSheetKeIso_(b.TANGGAL_SELESAI) || '').localeCompare(tanggalSheetKeIso_(a.TANGGAL_SELESAI) || ''))[0];
      if (selesai) {
        rekapDuaMinggu.tersedia = true;
        rekapDuaMinggu.sementara = false;
        rekapDuaMinggu.judul = selesai.NAMA_PERIODE;
        rekapDuaMinggu.data = getRekapDuaMinggu(tanggalSheetKeIso_(selesai.TANGGAL_MULAI), tanggalSheetKeIso_(selesai.TANGGAL_SELESAI), token).data; // ekstrak array-nya saja (bukan seluruh wrapper {periodeAwal,periodeAkhir,totalHariKerja,data}) -- lihat catatan bug ganda-wrap
      }
    }
  } catch (e) { /* biarkan default */ }
  return rekapDuaMinggu;
}


/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Absensi.gs — Kirim absensi, cegah duplikasi, rekap harian & bulanan
 *
 * ============================================================
 * FASE 5 — CATATAN PEROMBAKAN submitAbsensi() (fungsi terproteksi)
 * ============================================================
 * BEFORE : Identitas (id/nama/divisi) dikirim APA ADANYA dari body request
 *          (form dropdown, tanpa login). Kunci duplikat: ID_RELAWAN+TANGGAL
 *          (TANGGAL = tanggal kalender perangkat/server saat submit).
 * AFTER  : Identitas WAJIB dari session login (requireAuthRelawan) — tidak
 *          pernah dipercaya dari body. Selfie + GPS wajib, divalidasi ulang
 *          di server (jarak vs MASTER_LOKASI_SPPG). Kunci duplikat:
 *          ID_RELAWAN+ID_OPERASIONAL+JENIS_ABSENSI. TANGGAL diisi dari
 *          TANGGAL_OPERASIONAL (Kalender Operasional) bukan tanggal
 *          perangkat — sehingga shift lintas tengah malam tetap tercatat
 *          di hari operasional yang benar TANPA mengubah satu pun logika
 *          Rekap Harian/Bulanan/2-Minggu/Riwayat di bawah (semua masih
 *          mengelompokkan berdasarkan TANGGAL, persis seperti sebelumnya).
 * WHY    : Permintaan eksplisit (lihat dokumen "Perombakan Fitur Absensi")
 *          — sistem belum diterapkan resmi, perombakan alur diizinkan.
 * RISK   : Relawan tanpa akun tidak bisa absen sampai Admin membuatkan akun
 *          (lihat tab Akun Relawan). QR code lama tidak lagi dipakai.
 * ROLLBACK: Simpan salinan file ini sebelum menimpa. 03_DATA_ABSENSI kolom
 *          A–I (data lama) tidak diubah strukturnya — hanya menambah kolom
 *          J–P di akhir — jadi rollback kode tidak merusak data yang sudah
 *          masuk lewat versi baru (kolom baru cukup diabaikan oleh kode lama).
 * ============================================================
 */

// ------------------------------------------------------------
// SUBMIT ABSENSI (Fase 5 — Selfie + GPS, identitas dari session)
// ------------------------------------------------------------

/** Semua baris 03_DATA_ABSENSI dengan TANGGAL sudah diseragamkan jadi teks "dd/MM/yyyy"
 * (lihat catatan bacaTanggalDMY_ di Utils.gs — perbaikan penting terhadap bug Sheets
 * yang otomatis mengonversi teks tanggal menjadi tipe Date). */
/**
 * DIMEMOISASI PER EKSEKUSI SCRIPT (bukan lintas-request). Diverifikasi
 * AMAN: kedua fungsi yang MENULIS ke sheet Absensi (submitAbsensi,
 * koreksiTanggalOperasionalAbsensi) tidak pernah memanggil fungsi ini
 * LAGI setelah menulis dalam eksekusi yang sama -- jadi tidak ada risiko
 * membaca data basi. Sebelumnya terpanggil sampai belasan kali lintas
 * modul; dalam satu request Dashboard saja bisa 3x baca sheet yang sama.
 */
let _cacheAbsensiRows = null;
function getAbsensiRows_() {
  if (_cacheAbsensiRows) return _cacheAbsensiRows;
  const rows = sheetToObjects(getSheet(NAMA_SHEET.ABSENSI));
  rows.forEach(r => {
    if (r.TANGGAL) r.TANGGAL = bacaTanggalDMY_(r.TANGGAL);
    if (r.JAM) r.JAM = bacaJamHMS_(r.JAM);
  });
  _cacheAbsensiRows = rows;
  return rows;
}

function submitAbsensi(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const relawan = getRelawanById(idRelawan);
  if (!relawan || String(relawan.status).toUpperCase() !== 'AKTIF') {
    throw new Error('Data relawan tidak aktif. Hubungi admin.');
  }
  const jenis = sanitize(body.jenis).toUpperCase();
  if (jenis === 'MASUK') return submitAbsensiMasukInternal_(idRelawan, relawan, body);
  if (jenis === 'PULANG') return submitAbsensiPulangInternal_(idRelawan, relawan, body);
  throw new Error('Jenis absensi tidak valid.');
}

/**
 * ROSTER-FIRST (menggantikan versi event-first lama sepenuhnya, nama
 * fungsi dipertahankan sama supaya Code.gs & frontend tidak perlu
 * diubah). Baris presensi SUDAH ADA (status "BELUM ABSEN") sejak roster
 * dibuat oleh buatRosterUntukOperasional_ (Roster.gs, dipanggil otomatis
 * saat Admin mengatur Tanggal Operasional/Shift Divisi/Penugasan
 * Khusus) -- fungsi ini MENCARI baris itu dan MENG-UPDATE, TIDAK PERNAH
 * menambah baris baru. TANGGAL_OPERASIONAL TIDAK ditentukan ulang di
 * sini -- sudah tetap sejak roster dibuat (§E/§F dokumen: jadwal
 * menentukan, absensi cuma mengisi realisasi).
 */
function submitAbsensiMasukInternal_(idRelawan, relawan, body) {
  if (cariRosterSedangBerjalan_(idRelawan)) {
    throw new Error('Anda sudah melakukan absensi masuk dan belum absen pulang. Selesaikan absensi pulang terlebih dahulu.');
  }
  const sekarangCek = new Date();
  const pilihan = daftarRosterCheckIn_(idRelawan, sekarangCek);
  const roster = pilihan.aktif[0] || null;
  if (!roster) {
    if (pilihan.kadaluarsa.length) {
      const terakhir = pilihan.kadaluarsa[pilihan.kadaluarsa.length - 1];
      throw new Error('Jadwal presensi Anda untuk tanggal operasional ' + terakhir.TANGGAL_OPERASIONAL +
        ' sudah berakhir dan tercatat Tidak Hadir, sehingga tidak dapat diabsen lagi. Jika ini keliru, hubungi Admin SPPG.');
    }
    throw new Error('Presensi gagal diproses. Data jadwal Anda tidak ditemukan. Silakan hubungi Admin SPPG.');
  }
  cekJendelaBukaPresensi_(roster, sekarangCek);

  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const akurasi = body.akurasi !== undefined && body.akurasi !== null && body.akurasi !== '' ? Number(body.akurasi) : '';
  validasiKoordinat_(lat, lng);

  const fotoBase64 = body.fotoBase64;
  if (!fotoBase64 || typeof fotoBase64 !== 'string' || fotoBase64.length < 100) {
    throw new Error('Swafoto wajib diambil sebelum melakukan absensi.');
  }
  if (fotoBase64.length > 6 * 1024 * 1024) {
    throw new Error('Ukuran foto terlalu besar. Coba ambil ulang swafoto.');
  }

  const lokasi = getLokasiAktif_();
  if (!lokasi) throw new Error('Lokasi SPPG belum diatur oleh Admin. Hubungi admin sebelum melakukan absensi.');
  const jarak = hitungJarakMeter_(lat, lng, lokasi.latitude, lokasi.longitude);
  const statusLokasi = jarak <= lokasi.radiusMeter ? 'DALAM_ZONA' : 'LUAR_ZONA';
  if (statusLokasi === 'LUAR_ZONA') {
    throw new Error('Lokasi Anda berada di luar radius absensi (±' + Math.round(jarak) + ' m dari ' +
      lokasi.nama + ', radius diizinkan ' + lokasi.radiusMeter + ' m). Absensi tidak dapat dilakukan dari lokasi ini.');
  }

  const now = new Date();
  const fileId = uploadSelfieKeDrive_(fotoBase64, idRelawan, 'MASUK', roster.TANGGAL_OPERASIONAL, now);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, terlalu banyak yang absen bersamaan. Silakan coba lagi dalam beberapa detik.');

  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    let baris = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_ABSENSI]) === roster.ID_ABSENSI) { baris = i + 1; break; }
    }
    if (baris === -1) throw new Error('Presensi gagal diproses. Data jadwal Anda tidak ditemukan. Silakan hubungi Admin SPPG.');
    if (String(data[baris - 1][idx.STATUS_MASUK]) !== 'BELUM') {
      throw new Error('Anda sudah melakukan absensi masuk pada operasional ini.');
    }

    const tanggalMasuk = formatTanggal(now);
    const jamMasuk = formatJam(now);

    const jamJadwalMasuk = roster.JAM_JADWAL_MASUK;
    let keterlambatanMenit = 0;
    let statusMasuk = 'VALID';
    if (jamJadwalMasuk) {
      const [hJ, mJ] = jamJadwalMasuk.split(':').map(Number);
      const [hA, mA] = jamMasuk.split(':').map(Number);
      let selisih = (hA * 60 + mA) - (hJ * 60 + mJ);
      if (selisih < -600) selisih += 1440;
      keterlambatanMenit = Math.max(0, selisih - (typeof TOLERANSI_KETERLAMBATAN_MENIT !== 'undefined' ? TOLERANSI_KETERLAMBATAN_MENIT : 0));
      statusMasuk = keterlambatanMenit > 0 ? 'TERLAMBAT' : 'VALID';
    }

    sheet.getRange(baris, idx.TANGGAL_MASUK + 1).setValue(tanggalMasuk);
    sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jamMasuk);
    sheet.getRange(baris, idx.STATUS_MASUK + 1).setValue(statusMasuk);
    sheet.getRange(baris, idx.STATUS_KEHADIRAN + 1).setValue(statusMasuk === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR');
    sheet.getRange(baris, idx.KETERLAMBATAN_MENIT + 1).setValue(keterlambatanMenit);
    sheet.getRange(baris, idx.LATITUDE_MASUK + 1).setValue(lat);
    sheet.getRange(baris, idx.LONGITUDE_MASUK + 1).setValue(lng);
    sheet.getRange(baris, idx.GPS_ACCURACY_MASUK + 1).setValue(akurasi);
    sheet.getRange(baris, idx.JARAK_MASUK_METER + 1).setValue(Math.round(jarak));
    sheet.getRange(baris, idx.FOTO_MASUK + 1).setValue(fileId);
    sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(now);
    paksaKolomTeks_(sheet, baris, idx.TANGGAL_MASUK + 1);
    sheet.getRange(baris, idx.TANGGAL_MASUK + 1).setValue(tanggalMasuk);
    paksaKolomTeks_(sheet, baris, idx.JAM_MASUK + 1);
    sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jamMasuk);

    _invalidasiCacheRosterV2_();
    _cacheAbsensiRows = null;
    logAudit_('CHECK_IN', 'ABSENSI', roster.ID_ABSENSI, idRelawan, { jamMasuk: jamMasuk, statusMasuk: statusMasuk, keterlambatanMenit: keterlambatanMenit });

    return {
      // Field LAMA dipertahankan -- frontend existing (absensi.js) tidak perlu diubah.
      jenis: 'MASUK', tanggal: roster.TANGGAL_OPERASIONAL, jam: jamMasuk,
      idOperasional: roster.ID_OPERASIONAL, jarakMeter: Math.round(jarak),
      statusLokasi: statusLokasi, fotoUrl: urlFotoReference_(fileId),
      // Field BARU (roster-first).
      idAbsensi: roster.ID_ABSENSI, statusMasuk: statusMasuk, keterlambatanMenit: keterlambatanMenit
    };
  } finally {
    lock.releaseLock();
  }
}

function submitAbsensiPulangInternal_(idRelawan, relawan, body) {
  const roster = cariRosterMasukTerakhir_(idRelawan);
  if (!roster) throw new Error('Anda belum melakukan absensi masuk. Tidak dapat melakukan absensi pulang.');
  if (roster.STATUS_PULANG !== 'BELUM') throw new Error('Anda sudah melakukan absensi pulang pada operasional ini.');

  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const akurasi = body.akurasi !== undefined && body.akurasi !== null && body.akurasi !== '' ? Number(body.akurasi) : '';
  validasiKoordinat_(lat, lng);

  const fotoBase64 = body.fotoBase64;
  if (!fotoBase64 || typeof fotoBase64 !== 'string' || fotoBase64.length < 100) {
    throw new Error('Swafoto wajib diambil sebelum melakukan absensi.');
  }
  if (fotoBase64.length > 6 * 1024 * 1024) {
    throw new Error('Ukuran foto terlalu besar. Coba ambil ulang swafoto.');
  }

  const lokasi = getLokasiAktif_();
  if (!lokasi) throw new Error('Lokasi SPPG belum diatur oleh Admin. Hubungi admin sebelum melakukan absensi.');
  const jarak = hitungJarakMeter_(lat, lng, lokasi.latitude, lokasi.longitude);
  const statusLokasi = jarak <= lokasi.radiusMeter ? 'DALAM_ZONA' : 'LUAR_ZONA';
  if (statusLokasi === 'LUAR_ZONA') {
    throw new Error('Lokasi Anda berada di luar radius absensi (±' + Math.round(jarak) + ' m dari ' +
      lokasi.nama + ', radius diizinkan ' + lokasi.radiusMeter + ' m). Absensi tidak dapat dilakukan dari lokasi ini.');
  }

  const now = new Date();
  const fileId = uploadSelfieKeDrive_(fotoBase64, idRelawan, 'PULANG', roster.TANGGAL_OPERASIONAL, now);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, terlalu banyak yang absen bersamaan. Silakan coba lagi dalam beberapa detik.');

  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    let baris = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_ABSENSI]) === roster.ID_ABSENSI) { baris = i + 1; break; }
    }
    if (baris === -1) throw new Error('Presensi gagal diproses. Data jadwal Anda tidak ditemukan. Silakan hubungi Admin SPPG.');
    if (String(data[baris - 1][idx.STATUS_MASUK]) === 'BELUM') throw new Error('Anda belum melakukan absensi masuk. Tidak dapat melakukan absensi pulang.');
    if (String(data[baris - 1][idx.STATUS_PULANG]) !== 'BELUM') throw new Error('Anda sudah melakukan absensi pulang pada operasional ini.');

    const tanggalPulang = formatTanggal(now);
    const jamPulang = formatJam(now);

    sheet.getRange(baris, idx.TANGGAL_PULANG + 1).setValue(tanggalPulang);
    sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamPulang);
    sheet.getRange(baris, idx.STATUS_PULANG + 1).setValue('VALID');
    sheet.getRange(baris, idx.STATUS_KEHADIRAN + 1).setValue(
      String(data[baris - 1][idx.STATUS_MASUK]) === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR LENGKAP'
    );
    sheet.getRange(baris, idx.LATITUDE_PULANG + 1).setValue(lat);
    sheet.getRange(baris, idx.LONGITUDE_PULANG + 1).setValue(lng);
    sheet.getRange(baris, idx.GPS_ACCURACY_PULANG + 1).setValue(akurasi);
    sheet.getRange(baris, idx.JARAK_PULANG_METER + 1).setValue(Math.round(jarak));
    sheet.getRange(baris, idx.FOTO_PULANG + 1).setValue(fileId);
    sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(now);
    paksaKolomTeks_(sheet, baris, idx.TANGGAL_PULANG + 1);
    sheet.getRange(baris, idx.TANGGAL_PULANG + 1).setValue(tanggalPulang);
    paksaKolomTeks_(sheet, baris, idx.JAM_PULANG + 1);
    sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamPulang);

    _invalidasiCacheRosterV2_();
    _cacheAbsensiRows = null;
    logAudit_('CHECK_OUT', 'ABSENSI', roster.ID_ABSENSI, idRelawan, { jamPulang: jamPulang });

    return {
      jenis: 'PULANG', tanggal: roster.TANGGAL_OPERASIONAL, jam: jamPulang,
      idOperasional: roster.ID_OPERASIONAL, jarakMeter: Math.round(jarak),
      statusLokasi: statusLokasi, fotoUrl: urlFotoReference_(fileId),
      idAbsensi: roster.ID_ABSENSI
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * §3 dokumen "Pengajuan Ketidakhadiran": jalur BARU (PengajuanKetidakhadiran.gs,
 * ajukanKetidakhadiran) menggantikan fungsi ini utk pengajuan yang melalui
 * alur persetujuan MENUNGGU->DISETUJUI/DITOLAK. Fungsi lama ini
 * DIPERTAHANKAN apa adanya (tidak dihapus, kompatibel mundur kalau ada
 * pemanggil lain), TAPI TIDAK LAGI cocok dgn skema baru (mengandalkan
 * tentukanOperasionalAktifHariIni_ & appendRow gaya lama) -- lihat catatan
 * di badan fungsi.
 */
function ajukanIzinSakit(body) {
  throw new Error('Fitur ini sudah digantikan oleh Pengajuan Ketidakhadiran (ajukanKetidakhadiran). Silakan gunakan menu Pengajuan Ketidakhadiran.');
}

// ------------------------------------------------------------
// STATUS ABSENSI RELAWAN (dipakai absensi.html — satu panggilan gabungan)
// ROSTER-FIRST: dibaca langsung dari baris roster, bukan menebak dari timestamp.
// ------------------------------------------------------------

function getStatusAbsensiRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  return getStatusAbsensiRelawan_(idRelawan);
}

/**
 * Versi internal (idRelawan langsung, tanpa validasi token ulang) --
 * DIEKSTRAK dari getStatusAbsensiRelawan di atas supaya bisa dipanggil
 * dari getDashboardRelawanP0 tanpa requireAuthRelawan berulang (audit
 * performance: 5x requireAuthRelawan dalam 1 permintaan Dashboard --
 * lihat laporan). Isi & urutan logika TIDAK diubah sama sekali dari
 * versi sebelumnya, cuma dipindah ke sini.
 */
function getStatusAbsensiRelawan_(idRelawan) {
  const relawan = getRelawanById(idRelawan);
  const lokasi = getLokasiAktif_();

  const rosterTerbuka = cariRosterSedangBerjalan_(idRelawan);
  const rosterBerikutnya = rosterTerbuka || cariRosterUntukCheckIn_(idRelawan);

  let adaOperasional = false, idOperasional = null, tanggalOperasional = null, hariOperasional = '';
  let masukInfo = { sudah: false }, pulangInfo = { sudah: false };

  if (rosterBerikutnya) {
    adaOperasional = true;
    idOperasional = rosterBerikutnya.ID_OPERASIONAL;
    tanggalOperasional = rosterBerikutnya.TANGGAL_OPERASIONAL;
    hariOperasional = rosterBerikutnya.HARI_OPERASIONAL;
    if (rosterBerikutnya.STATUS_MASUK !== 'BELUM') {
      masukInfo = {
        sudah: true, jam: rosterBerikutnya.JAM_MASUK, keterangan: '',
        isIzinSakitCuti: ['IZIN', 'SAKIT', 'CUTI'].indexOf(rosterBerikutnya.STATUS_KEHADIRAN) !== -1,
        jarakMeter: rosterBerikutnya.JARAK_MASUK_METER !== '' ? Number(rosterBerikutnya.JARAK_MASUK_METER) : null,
        statusLokasi: null,
        fotoUrl: rosterBerikutnya.FOTO_MASUK ? urlFotoReference_(rosterBerikutnya.FOTO_MASUK) : null,
        latitude: rosterBerikutnya.LATITUDE_MASUK !== '' ? Number(rosterBerikutnya.LATITUDE_MASUK) : null,
        longitude: rosterBerikutnya.LONGITUDE_MASUK !== '' ? Number(rosterBerikutnya.LONGITUDE_MASUK) : null
      };
    }
    if (rosterBerikutnya.STATUS_PULANG !== 'BELUM') {
      pulangInfo = {
        sudah: true, jam: rosterBerikutnya.JAM_PULANG, keterangan: '', isIzinSakitCuti: false,
        jarakMeter: rosterBerikutnya.JARAK_PULANG_METER !== '' ? Number(rosterBerikutnya.JARAK_PULANG_METER) : null,
        statusLokasi: null,
        fotoUrl: rosterBerikutnya.FOTO_PULANG ? urlFotoReference_(rosterBerikutnya.FOTO_PULANG) : null,
        latitude: rosterBerikutnya.LATITUDE_PULANG !== '' ? Number(rosterBerikutnya.LATITUDE_PULANG) : null,
        longitude: rosterBerikutnya.LONGITUDE_PULANG !== '' ? Number(rosterBerikutnya.LONGITUDE_PULANG) : null
      };
    }
  }

  let durasi = null;
  if (masukInfo.sudah && pulangInfo.sudah && rosterBerikutnya.JAM_MASUK && rosterBerikutnya.JAM_PULANG) {
    const [hM, mM] = rosterBerikutnya.JAM_MASUK.split(':').map(Number);
    const [hP, mP] = rosterBerikutnya.JAM_PULANG.split(':').map(Number);
    let totalMenit = (hP * 60 + mP) - (hM * 60 + mM);
    if (totalMenit < 0) totalMenit += 1440;
    durasi = Math.floor(totalMenit / 60) + ' jam ' + (totalMenit % 60) + ' menit';
  }

  return {
    identitas: { id: idRelawan, nama: relawan ? relawan.nama : '', divisi: relawan ? relawan.divisi : '' },
    lokasiSppg: lokasi ? { nama: lokasi.nama, latitude: lokasi.latitude, longitude: lokasi.longitude, radiusMeter: lokasi.radiusMeter } : null,
    operasional: adaOperasional ? { ada: true, idOperasional: idOperasional, tanggal: tanggalOperasional, hari: hariOperasional } : { ada: false },
    masuk: masukInfo,
    pulang: pulangInfo,
    durasi: durasi
  };
}

/** Dipertahankan (dipakai kode lain yg mungkin masih memanggilnya) -- kini menerima baris roster BARU (bukan baris event lama). */
function buildDetailAbsensi_(row) {
  if (!row) return { sudah: false };
  return {
    sudah: true,
    jam: row.JAM_MASUK || row.JAM_PULANG || '',
    keterangan: '',
    isIzinSakitCuti: ['IZIN', 'SAKIT', 'CUTI'].indexOf(row.STATUS_KEHADIRAN) !== -1,
    jarakMeter: row.JARAK_MASUK_METER !== '' && row.JARAK_MASUK_METER !== undefined ? Number(row.JARAK_MASUK_METER) : null,
    statusLokasi: row.STATUS_LOKASI || null,
    fotoUrl: row.FOTO_MASUK ? urlFotoReference_(row.FOTO_MASUK) : null,
    latitude: row.LATITUDE_MASUK !== '' && row.LATITUDE_MASUK !== undefined ? Number(row.LATITUDE_MASUK) : null,
    longitude: row.LONGITUDE_MASUK !== '' && row.LONGITUDE_MASUK !== undefined ? Number(row.LONGITUDE_MASUK) : null
  };
}

/** DIPERTAHANKAN sbg kompatibilitas nama -- roster-first menggantikan konsep "masuk terbuka" dgn cariRosterSedangBerjalan_ (Roster.gs/AbsensiV2.gs). */
function cariMasukTerbuka_(semuaAbsensiSaya) {
  return null; // tidak lagi dipakai jalur utama -- lihat cariRosterSedangBerjalan_
}

/**
 * DEPRECATED -- roster-first TIDAK LAGI menebak tanggal operasional dari
 * timestamp (§E/§F dokumen: "jangan gunakan timestamp sebagai sumber
 * tanggal operasional"). Dipertahankan sbg fungsi kosong (return null)
 * murni supaya pemanggil lama yang belum sempat diaudit tidak error
 * "function is not defined" -- TIDAK dipakai jalur utama manapun lagi.
 */
function tentukanOperasionalAktifHariIni_(idRelawan) {
  return null;
}

/** DEPRECATED, sama seperti di atas -- status operasional sekarang dibaca langsung dari roster (getStatusAbsensiRelawan), bukan ditebak. */
function getStatusOperasionalUntukRelawan_(idRelawan) {
  const roster = cariRosterSedangBerjalan_(idRelawan) || cariRosterUntukCheckIn_(idRelawan);
  if (!roster) return { status: 'LIBUR', label: '🔴 LIBUR', keterangan: 'Tidak ada jadwal operasional saat ini.' };
  return {
    status: roster.STATUS_KEHADIRAN === 'BELUM ABSEN' ? 'OPERASIONAL' : roster.STATUS_KEHADIRAN,
    label: roster.STATUS_KEHADIRAN === 'BELUM ABSEN' ? '🟢 OPERASIONAL' : roster.STATUS_KEHADIRAN,
    keterangan: '', tanggal: roster.TANGGAL_OPERASIONAL, hari: roster.HARI_OPERASIONAL
  };
}



// ------------------------------------------------------------
// GOOGLE DRIVE — PENYIMPANAN SELFIE
// Struktur: ABSENSI_SELFIE/TAHUN/BULAN/DD-MM-YYYY/ID_JENIS_HHmmss.jpg
// Spreadsheet hanya menyimpan FILE_ID (kolom FOTO_REFERENCE) sebagai
// referensi — bukan file gambar itu sendiri (§P dokumen pengembangan).
// ------------------------------------------------------------

function uploadSelfieKeDrive_(fotoBase64, idRelawan, jenis, tanggalOperasionalDMY, now) {
  try {
    const base64Bersih = String(fotoBase64).replace(/^data:image\/\w+;base64,/, '');
    const bytes = Utilities.base64Decode(base64Bersih);
    const blob = Utilities.newBlob(bytes, 'image/jpeg');

    const bagian = tanggalOperasionalDMY.split('/');
    const dd = bagian[0], mm = bagian[1], yyyy = bagian[2];

    const root = getOrCreateFolder_(DriveApp.getRootFolder(), 'ABSENSI_SELFIE');
    const folderTahun = getOrCreateFolder_(root, yyyy);
    const folderBulan = getOrCreateFolder_(folderTahun, mm);
    const folderTanggal = getOrCreateFolder_(folderBulan, dd + '-' + mm + '-' + yyyy);

    const stempel = Utilities.formatDate(now, ZONA_WAKTU, 'HHmmss');
    blob.setName(idRelawan + '_' + jenis + '_' + stempel + '.jpg');

    const file = folderTanggal.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getId();
  } catch (err) {
    console.error('[uploadSelfieKeDrive_]', err.message);
    throw new Error('Gagal mengunggah foto ke penyimpanan. Silakan coba lagi.');
  }
}

function getOrCreateFolder_(parent, nama) {
  const existing = parent.getFoldersByName(nama);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(nama);
}

function urlFotoReference_(fileId) {
  if (!fileId) return null;
  // PERBAIKAN: format "uc?export=view" sering gagal tampil sebagai <img> --
  // Google kadang mengarahkannya ke halaman peringatan/scan virus alih-alih
  // gambar mentah, terutama saat diakses berulang kali (hotlink). Format
  // "thumbnail" di bawah ini disajikan lewat CDN gambar Google yang jauh
  // lebih stabil untuk ditampilkan langsung di tag <img>.
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
}

// ------------------------------------------------------------
// DAFTAR ABSENSI (Admin — tidak diubah dari versi sebelumnya)
// ------------------------------------------------------------

function getAbsensiList(params) {
  const rows = getRosterV2Rows_().filter(r => r.ID_ABSENSI);
  return rows.filter(r => {
    if (params.tanggal && r.TANGGAL_OPERASIONAL !== params.tanggal) return false;
    if (params.divisi && r.DIVISI !== params.divisi) return false;
    if (params.nama && r.NAMA_RELAWAN !== params.nama) return false;
    return true;
  });
}

// ------------------------------------------------------------
// REKAP HARIAN — TIDAK DIUBAH (masih mengelompokkan berdasarkan TANGGAL,
// yang sekarang diisi dari TANGGAL_OPERASIONAL — tetap benar tanpa perubahan)
// ------------------------------------------------------------

function getRekapHarian(tanggal, token) {
  requireAuth(token, true);
  const tanggalOperasional = sanitize(tanggal) || formatTanggal(new Date());
  const baris = getRosterV2Rows_().filter(r => r.TANGGAL_OPERASIONAL === tanggalOperasional && r.ID_ABSENSI);
  const terurut = baris.sort((a, b) => (a.DIVISI || '').localeCompare(b.DIVISI || '') || (a.JAM_JADWAL_MASUK || '').localeCompare(b.JAM_JADWAL_MASUK || '') || a.ID_RELAWAN.localeCompare(b.ID_RELAWAN));

  return {
    tanggal: tanggalOperasional,
    totalJadwal: baris.length,
    hadir: baris.filter(r => r.STATUS_KEHADIRAN === 'HADIR' || r.STATUS_KEHADIRAN === 'HADIR LENGKAP').length,
    terlambat: baris.filter(r => r.STATUS_KEHADIRAN === 'TERLAMBAT').length,
    izin: baris.filter(r => r.STATUS_KEHADIRAN === 'IZIN').length,
    sakit: baris.filter(r => r.STATUS_KEHADIRAN === 'SAKIT').length,
    cuti: baris.filter(r => r.STATUS_KEHADIRAN === 'CUTI').length,
    belumAbsen: baris.filter(r => r.STATUS_KEHADIRAN === 'BELUM ABSEN').length,
    // §PENTING: 'data' -- BENTUK & NAMA FIELD INI dipertahankan PERSIS
    // sesuai yang dibaca admin.js (panelHarian, fungsi renderRekapHarianTable/
    // renderStatCards/renderDivisiGrid) supaya tabel Rekap Harian Admin
    // (dipakai harian) tidak rusak. Field baru boleh ditambah, TAPI field
    // lama (nama, status, keterangan, lokasiMasuk/Pulang, fotoMasukUrl/
    // PulangUrl) tidak boleh dihapus/diganti nama tanpa mengecek admin.js.
    data: terurut.map(r => {
      const izinSakitCuti = ['IZIN', 'SAKIT', 'CUTI'].indexOf(r.STATUS_KEHADIRAN) !== -1;
      // 'HADIR LENGKAP' (sudah checkout) DISAMAKAN jadi 'HADIR' DI SINI --
      // admin.js (renderStatCards) menghitung kartu statistik dgn
      // pencocokan persis status === 'HADIR', bukan 'HADIR LENGKAP', jadi
      // kalau tidak dinormalisasi relawan yang sudah checkout akan
      // hilang dari hitungan "Hadir".
      const statusUntukAdmin = r.STATUS_KEHADIRAN === 'HADIR LENGKAP' ? 'HADIR' : r.STATUS_KEHADIRAN;
      return {
        id: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, divisi: r.DIVISI,
        jamMasuk: r.JAM_MASUK || null, jamPulang: r.JAM_PULANG || null,
        status: statusUntukAdmin,
        keterangan: izinSakitCuti ? r.STATUS_KEHADIRAN.charAt(0) + r.STATUS_KEHADIRAN.slice(1).toLowerCase() : '',
        lokasiMasuk: buildLokasiRingkasRoster_(r.JARAK_MASUK_METER),
        lokasiPulang: buildLokasiRingkasRoster_(r.JARAK_PULANG_METER),
        fotoMasukUrl: r.FOTO_MASUK ? urlFotoReference_(r.FOTO_MASUK) : null,
        fotoPulangUrl: r.FOTO_PULANG ? urlFotoReference_(r.FOTO_PULANG) : null
      };
    }),
    // 'detail' -- bentuk BARU (roster-first, field lengkap) utk konsumen baru
    // (belum ada yang memakainya saat ini, disiapkan utk kebutuhan mendatang).
    detail: terurut.map(r => ({
      idAbsensi: r.ID_ABSENSI, idRelawan: r.ID_RELAWAN, namaRelawan: r.NAMA_RELAWAN, divisi: r.DIVISI,
      namaShift: r.NAMA_SHIFT, jamJadwalMasuk: r.JAM_JADWAL_MASUK, jamJadwalPulang: r.JAM_JADWAL_PULANG,
      jamMasuk: r.JAM_MASUK || null, jamPulang: r.JAM_PULANG || null,
      status: r.STATUS_KEHADIRAN, keterlambatanMenit: Number(r.KETERLAMBATAN_MENIT) || 0
    }))
  };
}
/** Sama seperti buildLokasiRingkas_ lama, tapi utk baris roster-first --
 * kalau JARAK_METER tercatat, absensi itu SELALU "Dalam Zona" (submitAbsensi
 * MENOLAK penyimpanan kalau di luar radius -- lihat validasi di Absensi.gs),
 * jadi status zona tidak perlu disimpan terpisah per baris lagi. */
function buildLokasiRingkasRoster_(jarakMeter) {
  if (jarakMeter === '' || jarakMeter === undefined || jarakMeter === null) return null;
  return Math.round(Number(jarakMeter)) + ' m · Dalam Zona';
}
function buildLokasiRingkas_(rec) {
  if (!rec || rec.JARAK_METER === '' || rec.JARAK_METER === undefined || rec.JARAK_METER === null) return null;
  const zona = rec.STATUS_LOKASI === 'DALAM_ZONA' ? 'Dalam Zona' : (rec.STATUS_LOKASI === 'LUAR_ZONA' ? 'Luar Zona' : '');
  return Math.round(Number(rec.JARAK_METER)) + ' m' + (zona ? ' · ' + zona : '');
}

function simpanRekapHarianKeSheet(tanggal, rekap) {
  const sheet = getSheet(NAMA_SHEET.REKAP_HARIAN);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === tanggal) sheet.deleteRow(i + 1);
  }
  if (!rekap.length) return;
  const rows = rekap.map(r => [tanggal, r.id, r.nama, r.divisi, r.jamMasuk, r.jamPulang, r.status, r.keterangan]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ------------------------------------------------------------
// REKAP BULANAN — TIDAK DIUBAH
// ------------------------------------------------------------

function getRekapBulanan(bulan, tahun) {
  const now = new Date();
  bulan = Number(bulan) || Number(Utilities.formatDate(now, ZONA_WAKTU, 'M'));
  tahun = Number(tahun) || Number(Utilities.formatDate(now, ZONA_WAKTU, 'yyyy'));

  const relawanList = getRelawanList(null, false);
  const semuaRoster = getRosterV2Rows_().filter(r => r.ID_ABSENSI);

  const rosterBulanIni = semuaRoster.filter(a => {
    const bagian = String(a.TANGGAL_OPERASIONAL).split('/');
    return bagian.length === 3 && Number(bagian[1]) === bulan && Number(bagian[2]) === tahun;
  });

  const tanggalUnik = Array.from(new Set(rosterBulanIni.map(a => a.TANGGAL_OPERASIONAL)));

  const rekap = relawanList.map(r => {
    const recRoster = rosterBulanIni.filter(a => a.ID_RELAWAN === r.id);
    let hadir = 0, terlambat = 0, izin = 0, sakit = 0, cuti = 0;

    recRoster.forEach(a => {
      const st = a.STATUS_KEHADIRAN;
      if (st === 'IZIN') izin++;
      else if (st === 'SAKIT') sakit++;
      else if (st === 'CUTI') cuti++;
      else if (st === 'TERLAMBAT') terlambat++;
      else if (st === 'HADIR' || st === 'HADIR LENGKAP') hadir++;
    });

    const tidakHadir = Math.max(0, tanggalUnik.length - (hadir + terlambat + izin + sakit + cuti));

    return { id: r.id, nama: r.nama, divisi: r.divisi, hadir: hadir, terlambat: terlambat, izin: izin, sakit: sakit, cuti: cuti, tidakHadir: tidakHadir };
  });

  try { simpanRekapBulananKeSheet(bulan, tahun, rekap); } catch (e) { /* jangan gagalkan permintaan utama */ }

  return { bulan: bulan, tahun: tahun, data: rekap };
}

function simpanRekapBulananKeSheet(bulan, tahun, rekap) {
  const sheet = getSheet(NAMA_SHEET.REKAP_BULANAN);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (Number(data[i][0]) === bulan && Number(data[i][1]) === tahun) sheet.deleteRow(i + 1);
  }
  if (!rekap.length) return;
  const rows = rekap.map(r => [bulan, tahun, r.id, r.nama, r.divisi, r.hadir, r.terlambat, r.izin, r.sakit, r.tidakHadir, r.cuti]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ------------------------------------------------------------
// REKAP 2 MINGGU — TIDAK DIUBAH
// ------------------------------------------------------------

function tanggalSheetKeIso_(tanggalSheet) {
  const bagian = String(tanggalSheet).split('/');
  if (bagian.length !== 3) return null;
  const dd = bagian[0].padStart(2, '0');
  const mm = bagian[1].padStart(2, '0');
  const yyyy = bagian[2];
  return yyyy + '-' + mm + '-' + dd;
}

function getRekapDuaMinggu(periodeAwal, periodeAkhir, token) {
  requireAuth(token, true);
  periodeAwal = sanitize(periodeAwal);
  periodeAkhir = sanitize(periodeAkhir);
  if (!periodeAwal || !periodeAkhir) throw new Error('Periode awal dan akhir wajib diisi.');
  if (periodeAwal > periodeAkhir) throw new Error('Periode awal tidak boleh setelah periode akhir.');

  const barisPeriode = getRosterV2Rows_().filter(r => {
    if (!r.ID_ABSENSI) return false;
    const iso = tanggalSheetKeIso_(r.TANGGAL_OPERASIONAL);
    return iso && iso >= periodeAwal && iso <= periodeAkhir;
  });

  // Perbaikan (dilaporkan Admin, 15 Okt 2026): "Alfa" (dulu dilabeli
  // "Tidak Hadir") TIDAK BOLEH menghitung tanggal yang belum terjadi.
  // Sebelum ini, BELUM ABSEN dihitung utk SELURUH rentang periode --
  // kalau hari ini baru pertengahan periode, sisa tanggal yg BELUM
  // LEWAT otomatis berstatus BELUM ABSEN (wajar, memang belum waktunya)
  // tapi ikut tertambah sbg "Tidak Hadir", padahal bukan kelalaian.
  // hariIniIso dipakai utk membatasi: BELUM ABSEN cuma dihitung Alfa
  // kalau tanggalnya SUDAH LEWAT atau HARI INI -- bukan ke depan.
  const hariIniIso = tanggalSheetKeIso_(formatTanggal(new Date()));

  const perRelawan = {};
  barisPeriode.forEach(r => {
    if (!perRelawan[r.ID_RELAWAN]) {
      perRelawan[r.ID_RELAWAN] = { id: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, divisi: r.DIVISI, hadir: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, alfa: 0, totalHariKerja: 0, hariKerjaSudahLewat: 0 };
    }
    const p = perRelawan[r.ID_RELAWAN];
    p.totalHariKerja++;
    const iso = tanggalSheetKeIso_(r.TANGGAL_OPERASIONAL);
    const sudahLewat = iso && iso <= hariIniIso;
    if (sudahLewat) p.hariKerjaSudahLewat++;
    const st = r.STATUS_KEHADIRAN;
    if (st === 'HADIR' || st === 'HADIR LENGKAP') p.hadir++;
    else if (st === 'TERLAMBAT') p.terlambat++;
    else if (st === 'IZIN') p.izin++;
    else if (st === 'SAKIT') p.sakit++;
    else if (st === 'CUTI') p.cuti++;
    else if (st === 'BELUM ABSEN' && sudahLewat) p.alfa++; // HANYA dihitung Alfa kalau tanggalnya sudah lewat/hari ini -- tanggal depan dibiarkan, bukan kelalaian
  });

  // tidakHadir DIPERTAHANKAN sbg nama field (kompatibilitas data lama --
  // simpanRekapDuaMingguKeSheet & pemanggil lain mengharapkan field ini),
  // isinya SEKARANG nilai Alfa yang sudah benar (bukan nama field baru
  // yg memaksa ubah semua pemanggil). Label "Alfa" di tampilan diatur di
  // frontend, bukan di sini.
  const rekap = Object.values(perRelawan).map(p => ({
    id: p.id, nama: p.nama, divisi: p.divisi, hadir: p.hadir, terlambat: p.terlambat,
    izin: p.izin, sakit: p.sakit, cuti: p.cuti, tidakHadir: p.alfa,
    totalHariKerja: p.totalHariKerja, hariKerjaSudahLewat: p.hariKerjaSudahLewat
  }));
  return { periodeAwal: periodeAwal, periodeAkhir: periodeAkhir, totalHariKerja: barisPeriode.length, data: rekap };
}
function simpanRekapDuaMingguKeSheet(periodeAwal, periodeAkhir, rekap) {
  const sheet = getSheet(NAMA_SHEET.REKAP_DUA_MINGGU);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === periodeAwal && String(data[i][1]) === periodeAkhir) sheet.deleteRow(i + 1);
  }
  if (!rekap.length) return;
  const rows = rekap.map(r => [
    periodeAwal, periodeAkhir, r.id, r.nama, r.divisi,
    r.hadir, r.terlambat, r.izin, r.sakit, r.tidakHadir, r.totalHariKerja
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ------------------------------------------------------------
// RIWAYAT ABSENSI RELAWAN — TIDAK DIUBAH
// ------------------------------------------------------------

// ------------------------------------------------------------
// RIWAYAT ABSENSI RELAWAN
// PERBAIKAN (Fase 4): sebelumnya berbasis 14 hari KALENDER mundur apa
// adanya -- tanggal yang bukan hari operasional (libur/belum ada jadwal)
// ikut ditandai "Tidak Hadir" secara keliru. Sekarang berbasis Kalender
// Operasional yang Admin buat (2 periode terbaru), dan membedakan:
//   - "Tidak Hadir"      : ada shift/penugasan tapi tidak ada presensi
//   - "Tidak Ada Jadwal" : relawan memang tidak diketahui bertugas hari
//                          itu (sesuai §53 -- jangan dianggap tidak hadir
//                          kalau tidak ada shift/penugasan sama sekali)
// Kalau modul Shift belum ada, otomatis fallback ke "Tidak Hadir" seperti
// perilaku lama (aman, tidak breaking).
// ------------------------------------------------------------

/**
 * §B-§E dokumen SIPRES UI: Riwayat Presensi relawan.
 * - Otomatis pakai PERIODE AKTIF (relawan tidak memilih periode manual).
 * - totalJadwal = seluruh baris roster relawan pada periode itu.
 * - Statistik grid 2x3: HADIR, TERLAMBAT, IZIN, SAKIT, CUTI, TIDAK HADIR.
 * - "TIDAK HADIR" DITURUNKAN (bukan status tersimpan): roster yang
 *   TANGGAL_OPERASIONAL-nya SUDAH LEWAT tapi STATUS_KEHADIRAN masih
 *   "BELUM ABSEN" -- beda dari "Belum Absen" murni (jadwal hari ini/
 *   akan datang yang memang belum waktunya).
 */
function getRiwayatAbsensiRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const periodeAktif = getPeriodeAktif_();

  if (!periodeAktif) {
    return { periode: null, totalJadwal: 0, stats: { hadir: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, tidakHadir: 0 }, items: [] };
  }

  const hariIniKunci = dmyKeKunciUrut_(formatTanggal(new Date()));
  // PERBAIKAN: sebelumnya menampilkan SELURUH roster periode aktif, termasuk
  // jadwal yang masih MURNI masa depan (belum waktunya sama sekali) --
  // Riwayat Presensi seharusnya cuma yang "sudah dilaksanakan atau sedang
  // dilaksanakan", bukan jadwal yang akan datang (itu bagian "Jadwal &
  // Penugasan" -- lihat getJadwalRelawan, Jadwal.gs). <= hariIniKunci
  // dipakai (bukan <) supaya jadwal HARI INI (sedang berjalan) tetap ikut.
  const baris = getRosterV2Rows_().filter(r => r.ID_ABSENSI && r.ID_RELAWAN === idRelawan && r.ID_PERIODE === periodeAktif.id && dmyKeKunciUrut_(r.TANGGAL_OPERASIONAL) <= hariIniKunci);

  const stats = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, tidakHadir: 0 };
  const items = baris
    .sort((a, b) => dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL)))
    .map(r => {
      const sudahLewat = dmyKeKunciUrut_(r.TANGGAL_OPERASIONAL) < hariIniKunci;
      let statusTampil = r.STATUS_KEHADIRAN;
      if (statusTampil === 'BELUM ABSEN' && sudahLewat) statusTampil = 'TIDAK HADIR';

      if (statusTampil === 'HADIR' || statusTampil === 'HADIR LENGKAP') stats.hadir++;
      else if (statusTampil === 'TERLAMBAT') stats.terlambat++;
      else if (statusTampil === 'IZIN') stats.izin++;
      else if (statusTampil === 'SAKIT') stats.sakit++;
      else if (statusTampil === 'CUTI') stats.cuti++;
      else if (statusTampil === 'TIDAK HADIR') stats.tidakHadir++;

      return {
        idAbsensi: r.ID_ABSENSI, idPeriode: r.ID_PERIODE, idOperasional: r.ID_OPERASIONAL,
        tanggal: r.TANGGAL_OPERASIONAL, hari: r.HARI_OPERASIONAL, divisi: r.DIVISI, namaShift: r.NAMA_SHIFT,
        jamJadwalMasuk: r.JAM_JADWAL_MASUK, jamJadwalPulang: r.JAM_JADWAL_PULANG,
        jamMasuk: r.JAM_MASUK || null, jamPulang: r.JAM_PULANG || null,
        status: statusTampil, keterlambatanMenit: Number(r.KETERLAMBATAN_MENIT) || 0,
        masuk: r.JAM_MASUK ? {
          jam: r.JAM_MASUK, jarakMeter: r.JARAK_MASUK_METER !== '' ? Number(r.JARAK_MASUK_METER) : null,
          fotoUrl: r.FOTO_MASUK ? urlFotoReference_(r.FOTO_MASUK) : null,
          latitude: r.LATITUDE_MASUK !== '' ? Number(r.LATITUDE_MASUK) : null, longitude: r.LONGITUDE_MASUK !== '' ? Number(r.LONGITUDE_MASUK) : null
        } : null,
        pulang: r.JAM_PULANG ? {
          jam: r.JAM_PULANG, jarakMeter: r.JARAK_PULANG_METER !== '' ? Number(r.JARAK_PULANG_METER) : null,
          fotoUrl: r.FOTO_PULANG ? urlFotoReference_(r.FOTO_PULANG) : null,
          latitude: r.LATITUDE_PULANG !== '' ? Number(r.LATITUDE_PULANG) : null, longitude: r.LONGITUDE_PULANG !== '' ? Number(r.LONGITUDE_PULANG) : null
        } : null
      };
    });

  return { periode: periodeAktif, totalJadwal: items.length, stats: stats, items: items };
}
function getRekapDetailUntukExport(token, periodeAwal, periodeAkhir) {
  requireAuth(token, true); // true = Staff (monitoring) boleh export laporan
  periodeAwal = sanitize(periodeAwal);
  periodeAkhir = sanitize(periodeAkhir);
  if (!periodeAwal || !periodeAkhir) throw new Error('Periode awal dan akhir wajib diisi.');
  if (periodeAwal > periodeAkhir) throw new Error('Periode awal tidak boleh setelah periode akhir.');

  const relawanList = getRelawanList(null, false);
  const namaById = {}; const divisiById = {};
  relawanList.forEach(r => { namaById[r.id] = r.nama; divisiById[r.id] = r.divisi; });

  const semuaRoster = getRosterV2Rows_().filter(a => {
    if (!a.ID_ABSENSI) return false;
    const iso = tanggalSheetKeIso_(a.TANGGAL_OPERASIONAL);
    return iso && iso >= periodeAwal && iso <= periodeAkhir;
  });

  const hasil = semuaRoster.map(a => {
    let status;
    const st = a.STATUS_KEHADIRAN;
    if (st === 'IZIN' || st === 'SAKIT' || st === 'CUTI') status = st.charAt(0) + st.slice(1).toLowerCase();
    else if (st === 'TERLAMBAT') status = 'Terlambat';
    else if (st === 'HADIR' || st === 'HADIR LENGKAP') status = 'Hadir';
    else status = 'Tidak Hadir';

    return {
      nama: namaById[a.ID_RELAWAN] || a.NAMA_RELAWAN || a.ID_RELAWAN,
      divisi: divisiById[a.ID_RELAWAN] || a.DIVISI || '-',
      tanggal: a.TANGGAL_OPERASIONAL,
      jamMasuk: a.JAM_MASUK || '-',
      jamPulang: a.JAM_PULANG || '-',
      status: status
    };
  }).sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama));

  return { periodeAwal: periodeAwal, periodeAkhir: periodeAkhir, data: hasil };
}

/** Tren kehadiran 7 hari terakhir -- dipakai grafik ringan Dashboard Admin. */
function getTrenKehadiran7Hari(token) {
  requireAuth(token);
  const relawanAktifCount = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).filter(r => String(r.STATUS).toUpperCase() === 'AKTIF').length;
  const semuaRoster = getRosterV2Rows_().filter(r => r.ID_ABSENSI);

  const hasil = [];
  for (let i = 6; i >= 0; i--) {
    const tgl = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const tglIso = tanggalSheetKeIso_(formatTanggal(tgl));
    const hadirHariItu = new Set();
    semuaRoster.forEach(a => {
      if ((a.STATUS_KEHADIRAN === 'HADIR' || a.STATUS_KEHADIRAN === 'HADIR LENGKAP' || a.STATUS_KEHADIRAN === 'TERLAMBAT') && tanggalSheetKeIso_(a.TANGGAL_OPERASIONAL) === tglIso) hadirHariItu.add(a.ID_RELAWAN);
    });
    hasil.push({
      tanggal: Utilities.formatDate(tgl, Session.getScriptTimeZone(), 'dd/MM'),
      hadir: hadirHariItu.size,
      totalRelawan: relawanAktifCount
    });
  }
  return hasil;
}

/**
 * DASHBOARD LENGKAP — 1 pemanggilan untuk seluruh data yang dibutuhkan
 * Dashboard relawan (hemat request, sesuai prinsip "jangan request
 * berkali-kali"). SENGAJA memanggil ULANG fungsi-fungsi yang SUDAH ADA
 * (getStatusAbsensiRelawan, getStatusOperasionalHariIni, getJadwalRelawan,
 * getRiwayatAbsensiRelawan, getInformasiRelawan) -- BUKAN menulis ulang
 * logicnya di sini, supaya tidak ada 2 sumber kebenaran yang bisa beda.
 */
function getDashboardLengkapRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const relawan = getRelawanById(idRelawan);
  const akun = cariAkunByIdRelawan_(idRelawan);

  const presensi = getStatusAbsensiRelawan(token);
  const statusOperasional = getStatusOperasionalUntukRelawan_(idRelawan);

  // JADWAL SAYA -- SUMBER DIALIHKAN ke Shift & Koreksi (getJadwalSayaHariIni)
  // sesuai instruksi konsolidasi. Jadwal.gs (manual lama) TIDAK LAGI dipakai
  // sebagai sumber di sini -- lihat catatan DEPRECATED di Jadwal.gs.
  let jadwalHariIni = null;
  try {
    const j = getJadwalSayaHariIni(token);
    if (j.ada) jadwalHariIni = { waktu: j.waktu, penugasan: j.penugasan, status: j.status };
  } catch (e) { /* modul Shift mungkin belum diisi Admin -- Dashboard tetap tampil tanpa bagian ini */ }

  // Ringkasan Kehadiran (4 kategori: Total Hadir/Terlambat/Izin-Sakit/Tidak
  // Hadir) -- dihitung dari getRiwayatAbsensiRelawan yang SUDAH ADA.
  let ringkasanKehadiran = { totalHadir: 0, terlambat: 0, izinSakit: 0, tidakHadir: 0 };
  try {
    const riwayat = getRiwayatAbsensiRelawan(token);
    (riwayat.items || []).forEach(item => {
      if (item.status === 'Hadir') ringkasanKehadiran.totalHadir++;
      else if (item.status === 'Terlambat') { ringkasanKehadiran.totalHadir++; ringkasanKehadiran.terlambat++; }
      else if (item.status === 'Izin' || item.status === 'Sakit' || item.status === 'Cuti') ringkasanKehadiran.izinSakit++;
      else if (item.status === 'Tidak Hadir') ringkasanKehadiran.tidakHadir++;
    });
  } catch (e) { /* diamkan -- tampilkan 0 kalau gagal, jangan gagalkan seluruh Dashboard */ }

  // Informasi Penting -- 5 item teratas saja dari getInformasiRelawan yang SUDAH ADA.
  let informasiPenting = [];
  try { informasiPenting = getInformasiRelawan(token).slice(0, 5); } catch (e) { /* diamkan */ }

  return {
    identitas: {
      nama: relawan ? relawan.nama : '',
      id: idRelawan,
      divisi: relawan ? relawan.divisi : '',
      statusAkun: akun ? String(akun.data[akun.idx.STATUS_AKUN] || '').toUpperCase() : '',
      fotoProfilUrl: (relawan && relawan.fotoProfilId)
        ? urlFotoReference_(relawan.fotoProfilId) : null
    },
    statusOperasional: statusOperasional,
    jadwalHariIni: jadwalHariIni,
    presensiHariIni: presensi,
    ringkasanKehadiran: ringkasanKehadiran,
    informasiPenting: informasiPenting
  };
}

/**
 * ======================================================================
 * AUDIT PERFORMANCE (disetujui) -- getDashboardLengkapRelawan DIPERTAHANKAN
 * UTUH di atas (tidak dihapus/diubah -- aman kalau perlu rollback), TAPI
 * TIDAK LAGI dipanggil dashboard.js setelah paket ini di-deploy. Dipecah
 * jadi 2 endpoint independen mengikuti pola yang SUDAH TERBUKTI di
 * admin.js (SUMBER_DASHBOARD + render per-key):
 *
 *   P0 -- getDashboardRelawanP0: Identitas + Status Operasional + Jadwal
 *         Hari Ini + Presensi Hari Ini. Relawan BUTUH ini SEGERA (tahu
 *         status kehadirannya sendiri).
 *   P1 -- getDashboardRelawanP1: Ringkasan Kehadiran (4 angka) +
 *         Informasi Penting. Boleh menyusul belakangan.
 *
 * requireAuthRelawan dipanggil SEKALI di masing-masing endpoint (bukan
 * 5x seperti getDashboardLengkapRelawan lama) -- idRelawan yang sudah
 * tervalidasi dioper ke fungsi _-internal (getStatusAbsensiRelawan_ dkk
 * di atas), bukan token mentah yang memicu validasi ulang.
 * ======================================================================
 */

function getDashboardRelawanP0(token) {
  const idRelawan = requireAuthRelawan(token);
  const relawan = getRelawanById(idRelawan);
  const akun = cariAkunByIdRelawan_(idRelawan);

  const presensi = getStatusAbsensiRelawan_(idRelawan);
  const statusOperasional = getStatusOperasionalUntukRelawan_(idRelawan);

  let jadwalHariIni = null;
  try {
    const j = getJadwalSayaHariIni_(idRelawan);
    if (j.ada) jadwalHariIni = { waktu: j.waktu, penugasan: j.penugasan, status: j.status };
  } catch (e) { /* modul Shift mungkin belum diisi Admin -- Dashboard tetap tampil tanpa bagian ini */ }

  return {
    identitas: {
      nama: relawan ? relawan.nama : '',
      id: idRelawan,
      divisi: relawan ? relawan.divisi : '',
      statusAkun: akun ? String(akun.data[akun.idx.STATUS_AKUN] || '').toUpperCase() : '',
      fotoProfilUrl: (relawan && relawan.fotoProfilId) ? urlFotoReference_(relawan.fotoProfilId) : null
    },
    statusOperasional: statusOperasional,
    jadwalHariIni: jadwalHariIni,
    presensiHariIni: presensi
  };
}

function getDashboardRelawanP1(token) {
  const idRelawan = requireAuthRelawan(token);

  let ringkasanKehadiran = { totalHadir: 0, terlambat: 0, izinSakit: 0, tidakHadir: 0 };
  try { ringkasanKehadiran = hitungRingkasanKehadiranRingan_(idRelawan); }
  catch (e) { /* diamkan -- tampilkan 0 kalau gagal, jangan gagalkan bagian lain */ }

  let informasiPenting = [];
  try { informasiPenting = getInformasiRelawan_(idRelawan).slice(0, 5); } catch (e) { /* diamkan */ }

  return { ringkasanKehadiran: ringkasanKehadiran, informasiPenting: informasiPenting };
}

/**
 * Versi RINGAN dari perhitungan 4 agregat (Total Hadir/Terlambat/Izin-
 * Sakit/Tidak Hadir) -- LANGSUNG dari getRosterV2Rows_ (sudah ter-cache
 * per-eksekusi), TANPA lewat getRiwayatAbsensiRelawan yang membangun
 * seluruh detail (jam/GPS/foto per hari) hanya untuk dibuang lagi
 * setelah dihitung jadi angka. Logika kategorisasi status SAMA PERSIS
 * dengan getRiwayatAbsensiRelawan (Absensi.gs) supaya angkanya tetap
 * konsisten -- lihat audit §L.2.
 */
function hitungRingkasanKehadiranRingan_(idRelawan) {
  const periodeAktif = getPeriodeAktif_();
  if (!periodeAktif) return { totalHadir: 0, terlambat: 0, izinSakit: 0, tidakHadir: 0 };

  const hariIniKunci = dmyKeKunciUrut_(formatTanggal(new Date()));
  const baris = getRosterV2Rows_().filter(r => r.ID_ABSENSI && r.ID_RELAWAN === idRelawan && r.ID_PERIODE === periodeAktif.id);

  let totalHadir = 0, terlambat = 0, izinSakit = 0, tidakHadir = 0;
  baris.forEach(r => {
    const sudahLewat = dmyKeKunciUrut_(r.TANGGAL_OPERASIONAL) < hariIniKunci;
    let status = r.STATUS_KEHADIRAN;
    if (status === 'BELUM ABSEN' && sudahLewat) status = 'TIDAK HADIR';

    if (status === 'HADIR' || status === 'HADIR LENGKAP') totalHadir++;
    else if (status === 'TERLAMBAT') { totalHadir++; terlambat++; }
    else if (status === 'IZIN' || status === 'SAKIT' || status === 'CUTI') izinSakit++;
    else if (status === 'TIDAK HADIR') tidakHadir++;
  });
  return { totalHadir: totalHadir, terlambat: terlambat, izinSakit: izinSakit, tidakHadir: tidakHadir };
}

/**
 * ISI ABSEN MANUAL MASSAL -- Admin menandai SEMUA relawan aktif "Hadir"
 * untuk 1 tanggal operasional, dipakai untuk memulihkan data yang hilang
 * (mis. baris ter-hapus tidak sengaja). Jam masuk/pulang diambil OTOMATIS
 * dari jadwal shift masing-masing relawan (Penugasan Khusus lalu Shift
 * Divisi, lewat resolveShiftUntukRelawan_ yang sudah ada) -- BUKAN diisi
 * manual per orang.
 *
 * Aturan:
 * - Relawan yang SUDAH punya baris MASUK utk operasional ini DILEWATI
 *   (tidak dibuat dobel) -- aman dijalankan berulang utk tanggal yang
 *   SEBAGIAN datanya hilang, sisanya masih ada.
 * - Relawan tanpa shift yang bisa di-resolve (belum diatur di Shift
 *   Divisi/Penugasan Khusus) DILEWATI juga -- dilaporkan terpisah,
 *   supaya Admin tahu siapa yang perlu diisi manual/dicek sendiri.
 * - Menghormati pembatasan divisi-khusus tanggal itu (fitur Kalender ->
 *   Tambah Satu Tanggal -> pilih Divisi) -- relawan di luar divisi yang
 *   diizinkan TIDAK ikut dibuatkan baris.
 * - KETERANGAN diberi tanda "Diisi manual oleh Admin" supaya baris ini
 *   tetap bisa dibedakan dari absensi asli relawan sendiri kalau perlu
 *   ditelusuri nanti -- TIDAK memengaruhi perhitungan Hadir/Terlambat di
 *   Rekap (yang mengecek nilai PERSIS 'Izin'/'Sakit'/'Cuti', bukan teks
 *   ini).
 * - Ditulis pakai header-map (bukan posisi tetap) dan SATU kali setValues
 *   massal (bukan appendRow berulang) -- lebih aman & jauh lebih cepat
 *   utk puluhan relawan sekaligus.
 */
/**
 * ROSTER-FIRST (menggantikan versi lama yang sempat dinonaktifkan saat
 * migrasi skema). Menandai SEMUA relawan yang ditugaskan pada 1 tanggal
 * operasional sebagai "Hadir" sekaligus -- dipakai kalau data presensi
 * hari itu hilang/perlu dipulihkan manual.
 *
 * Alur:
 * 1) Pastikan roster utk tanggal ini SUDAH ADA (panggil
 *    buatRosterUntukOperasional_ -- idempotent, aman dipanggil ulang;
 *    ini juga otomatis membuat baris utk relawan yang entah kenapa
 *    belum py roster sama sekali).
 * 2) Baris roster dgn STATUS_KEHADIRAN='BELUM ABSEN' -> diisi Hadir,
 *    JAM_MASUK/JAM_PULANG disalin dari JAM_JADWAL_MASUK/PULANG (§ jam
 *    diambil otomatis dari shift, BUKAN diisi manual).
 * 3) Baris yang SUDAH punya data (bukan BELUM ABSEN) -> DILEWATI, TIDAK
 *    ditimpa (sesuai deskripsi UI: "yang sudah punya data tidak akan ditimpa").
 * 4) Relawan yang eligible tapi TETAP tidak punya roster setelah langkah 1
 *    (shift-nya tidak bisa di-resolve sama sekali) -> dilaporkan terpisah,
 *    BUKAN diam-diam dilewati.
 */
function isiAbsensiHadirMassal(body) {
  const akses = requireAuth(body.token);
  const tanggal = sanitize(body.tanggal); // format dd/MM/yyyy
  if (!tanggal) throw new Error('Tanggal wajib diisi.');

  const entriKalender = getKalenderRows_().find(k => k.TANGGAL_OPERASIONAL === tanggal && String(k.STATUS).toUpperCase() === 'AKTIF');
  if (!entriKalender) throw new Error('Tidak ada operasional AKTIF untuk tanggal ini.');
  const idOperasional = entriKalender.ID_OPERASIONAL;

  // Langkah 1 -- pastikan roster ada utk semua relawan eligible (idempotent).
  buatRosterUntukOperasional_(idOperasional, akses);

  // Langkah 2-4
  const sheet = getSheet(NAMA_SHEET.ABSENSI);
  const idx = akunHeaderIndex_(sheet);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const tanggalHariIni = formatTanggal(now);
  const jamHariIni = formatJam(now);

  let jumlahDitambahkan = 0;
  const dilewatiSudahAda = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_OPERASIONAL]) !== idOperasional) continue;
    if (!String(data[i][idx.ID_ABSENSI] || '')) continue; // bukan baris roster-first (mis. legasi) -- lewati

    const statusSaatIni = String(data[i][idx.STATUS_KEHADIRAN]);
    const nama = String(data[i][idx.NAMA_RELAWAN]);
    const baris = i + 1;

    if (statusSaatIni !== 'BELUM ABSEN') {
      dilewatiSudahAda.push(nama);
      continue;
    }

    const jamJadwalMasuk = String(data[i][idx.JAM_JADWAL_MASUK] || '');
    const jamJadwalPulang = String(data[i][idx.JAM_JADWAL_PULANG] || '');

    sheet.getRange(baris, idx.TANGGAL_MASUK + 1).setValue(tanggalHariIni);
    sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jamJadwalMasuk || jamHariIni);
    sheet.getRange(baris, idx.STATUS_MASUK + 1).setValue('VALID');
    if (jamJadwalPulang) {
      sheet.getRange(baris, idx.TANGGAL_PULANG + 1).setValue(tanggalHariIni);
      sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamJadwalPulang);
      sheet.getRange(baris, idx.STATUS_PULANG + 1).setValue('VALID');
    }
    sheet.getRange(baris, idx.STATUS_KEHADIRAN + 1).setValue(jamJadwalPulang ? 'HADIR LENGKAP' : 'HADIR');
    sheet.getRange(baris, idx.KETERANGAN + 1).setValue('Diisi manual oleh Admin (data hilang)');
    sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(now);
    paksaKolomTeks_(sheet, baris, idx.TANGGAL_MASUK + 1);
    sheet.getRange(baris, idx.TANGGAL_MASUK + 1).setValue(tanggalHariIni);
    if (jamJadwalPulang) {
      paksaKolomTeks_(sheet, baris, idx.TANGGAL_PULANG + 1);
      sheet.getRange(baris, idx.TANGGAL_PULANG + 1).setValue(tanggalHariIni);
    }
    jumlahDitambahkan++;
  }

  // Langkah 4 -- relawan eligible tapi tetap tidak punya roster (shift tidak ter-resolve).
  const eligible = getRelawanRosterUntukOperasional_(idOperasional);
  const idRelawanPunyaRoster = new Set();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_OPERASIONAL]) === idOperasional && String(data[i][idx.ID_ABSENSI] || '')) {
      idRelawanPunyaRoster.add(String(data[i][idx.ID_RELAWAN]));
    }
  }
  const semuaRelawanAktif = getRelawanList(null, false);
  const daftarDivisiKhusus = entriKalender.DIVISI_KHUSUS
    ? String(entriKalender.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean)
    : [];
  let calonEligibleTanpaShift = semuaRelawanAktif;
  if (daftarDivisiKhusus.length) calonEligibleTanpaShift = calonEligibleTanpaShift.filter(r => daftarDivisiKhusus.indexOf(r.divisi) !== -1);
  const dilewatiTanpaShift = calonEligibleTanpaShift
    .filter(r => !idRelawanPunyaRoster.has(r.id))
    .map(r => r.nama);

  _invalidasiCacheRosterV2_();
  logAudit_('ISI_ABSEN_MASSAL', 'ABSENSI', idOperasional, akses, { jumlahDitambahkan: jumlahDitambahkan, jumlahDilewatiSudahAda: dilewatiSudahAda.length, jumlahDilewatiTanpaShift: dilewatiTanpaShift.length });

  return {
    jumlahDitambahkan: jumlahDitambahkan,
    jumlahDilewatiSudahAda: dilewatiSudahAda.length,
    dilewatiSudahAda: dilewatiSudahAda,
    jumlahDilewatiTanpaShift: dilewatiTanpaShift.length,
    dilewatiTanpaShift: dilewatiTanpaShift
  };
}

/**
 * Diagnostik Duplikat Roster (15 Okt 2026) -- dibangun krn Admin
 * melaporkan "Total Hari Kerja" di Rekap Per Periode tidak konsisten
 * dgn "Target" di Pemeriksaan Jadwal Individu (13/14 vs seharusnya 10).
 * getRekapDuaMinggu menghitung Total Hari Kerja dari JUMLAH BARIS
 * roster yg ada -- kalau ada baris DUPLIKAT (1 relawan, 1 tanggal, >1
 * baris ID_ABSENSI berbeda -- kemungkinan besar tertinggal dari
 * SEBELUM LockService ditambahkan di Shift.gs/JadwalIndividu.gs),
 * angkanya ikut tertambah tanpa relawan itu benar2 kerja ekstra.
 *
 * Fungsi ini MURNI DIAGNOSTIK (baca saja, tidak mengubah apa pun) --
 * menunjukkan PERSIS relawan+tanggal mana yg punya baris ganda, supaya
 * Admin bisa hapus baris yg salah lewat tombol "Hapus" yg SUDAH ADA di
 * Pemeriksaan Jadwal Individu (bukan dihapus otomatis di sini -- Admin
 * yg memutuskan baris mana yg benar, terutama kalau keduanya punya
 * status presensi berbeda).
 */
function getDuplikatRosterAdmin(body) {
  requireAuth(body.token, true); // baca saja -- Staff boleh lihat, sama spt laporan lain
  // Pola SAMA dgn getRekapPenggajian_ (MasterTarif.gs) -- terima idPeriode
  // (bukan tanggal mentah dari frontend), konversi DD/MM/YYYY -> ISO di
  // sini. Konsisten, dan frontend tinggal pakai idPeriode yg sudah
  // dipilih di dropdown Rekap Per Periode yg sama.
  const idPeriode = sanitize(body.idPeriode);
  if (!idPeriode) throw new Error('Periode wajib dipilih.');
  const periode = getPeriodeById_(idPeriode);
  if (!periode) throw new Error('Periode tidak ditemukan.');
  const periodeAwal = tanggalSheetKeIso_(periode.tanggalMulai);
  const periodeAkhir = tanggalSheetKeIso_(periode.tanggalSelesai);

  const barisPeriode = getRosterV2Rows_().filter(r => {
    if (!r.ID_ABSENSI) return false;
    const iso = tanggalSheetKeIso_(r.TANGGAL_OPERASIONAL);
    return iso && iso >= periodeAwal && iso <= periodeAkhir;
  });

  const grup = {};
  barisPeriode.forEach(r => {
    const kunci = r.ID_RELAWAN + '|' + r.TANGGAL_OPERASIONAL;
    if (!grup[kunci]) grup[kunci] = [];
    grup[kunci].push({
      idAbsensi: r.ID_ABSENSI,
      status: r.STATUS_KEHADIRAN || '',
      jamJadwal: (r.JAM_JADWAL_MASUK || '') + ' - ' + (r.JAM_JADWAL_PULANG || ''),
      jamAktual: r.JAM_MASUK ? (r.JAM_MASUK + ' - ' + (r.JAM_PULANG || '')) : '(belum absen)'
    });
  });

  const hasil = [];
  Object.keys(grup).forEach(kunci => {
    if (grup[kunci].length > 1) {
      const bagian = kunci.split('|');
      const idRelawan = bagian[0], tanggal = bagian[1];
      const relawan = getRelawanById(idRelawan);
      hasil.push({
        idRelawan: idRelawan,
        nama: relawan ? relawan.nama : idRelawan,
        divisi: relawan ? relawan.divisi : '',
        tanggal: tanggal,
        jumlahDuplikat: grup[kunci].length,
        baris: grup[kunci]
      });
    }
  });

  hasil.sort((a, b) => a.nama.localeCompare(b.nama));
  return { periodeAwal: periodeAwal, periodeAkhir: periodeAkhir, jumlahMasalah: hasil.length, data: hasil };
}


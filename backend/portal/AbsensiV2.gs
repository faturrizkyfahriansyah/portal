/**
 * SPPG JEUNGJING — ROSTER-FIRST ATTENDANCE (SIPRES FINAL REFACTOR)
 * AbsensiV2.gs — Check-in/Check-out yang MENG-UPDATE baris roster yang
 * SUDAH ADA (03_DATA_ABSENSI_V2), bukan menambah baris baru. Ini modul
 * PARALEL -- lihat catatan desain lengkap di Roster.gs. submitAbsensi()
 * lama (Absensi.gs) TIDAK diubah/dihapus sama sekali.
 *
 * PRINSIP (§C, §E, §F dokumen instruksi):
 * "Jadwal menentukan SIAPA dan untuk OPERASIONAL KAPAN. Absensi hanya
 * mengisi realisasi kehadirannya." -- TANGGAL_OPERASIONAL SUDAH TETAP
 * sejak roster dibuat (lihat Roster.gs), TIDAK PERNAH ditentukan ulang
 * dari timestamp saat tombol ditekan.
 */

const TOLERANSI_TERLAMBAT_MENIT_V2 = (typeof TOLERANSI_KETERLAMBATAN_MENIT !== 'undefined') ? TOLERANSI_KETERLAMBATAN_MENIT : 0;

function dmyKeKunciUrut_(dmy) {
  const bagian = String(dmy || '').split('/');
  if (bagian.length !== 3) return '00000000';
  const [d, m, y] = bagian;
  return y.padStart(4, '0') + m.padStart(2, '0') + d.padStart(2, '0');
}

/**
 * Mencari baris roster MILIK relawan ini yang masih STATUS_MASUK='BELUM'
 * -- ini PENGGANTI tentukanOperasionalAktifHariIni_ untuk alur baru:
 * bukan menebak tanggal operasional dari jam sekarang, tapi mencari
 * roster yang MEMANG SUDAH ADA dan cocok.
 *
 * Kalau relawan punya lebih dari 1 kandidat (mis. roster beberapa hari
 * ke depan sudah dibuat sekaligus), jam sekarang dipakai HANYA sebagai
 * TIE-BREAKER (§F: "jam 16:00 cuma alat bantu pencarian, bukan sumber
 * kebenaran") -- bukan untuk membuat/menebak roster baru.
 */
/**
 * ATURAN JENDELA PRESENSI (per baris roster) -- menjawab: "relawan yang
 * belum absen di operasional 28, apakah masih bisa absen utk operasional 29?"
 * JAWABAN: TIDAK. Baris yang shift-nya sudah BERAKHIR dianggap kedaluwarsa
 * (tercatat Tidak Hadir di rekap) dan TIDAK lagi bisa dipakai check-in.
 *
 * Konvensi waktu (sama dgn desain roster-first: shift yang mulai >= jam
 * JAM_MULAI_CEK_OPERASIONAL_BESOK (16:00) milik operasional HARI BERIKUTNYA,
 * mis. OP 21 shift 16:00-00:00 -> mulai 20/09 16:00, selesai 21/09 00:00):
 *   mulai  = tgl operasional + jam masuk (dikurangi 1 hari kalau jam masuk >= 16:00)
 *   akhir  = mulai + durasi shift (jam pulang - jam masuk; default 12 jam kalau tanpa jam pulang)
 *   buka   = mulai - TOLERANSI_BUKA_PRESENSI_MENIT
 * Check-in hanya sah kalau: buka <= sekarang <= akhir.
 */
const TOLERANSI_BUKA_PRESENSI_MENIT = 60;
const DURASI_SHIFT_DEFAULT_MENIT = 720;

function jendelaPresensiRoster_(r) {
  const tgl = String(r.TANGGAL_OPERASIONAL || '').split('/').map(Number);
  const mMasuk = String(r.JAM_JADWAL_MASUK || '').match(/(\d{1,2}):(\d{2})/);
  if (tgl.length !== 3 || tgl.some(isNaN) || !mMasuk) return null; // jadwal tak lengkap -> tidak dibatasi (perilaku lama)
  const hM = Number(mMasuk[1]), mM = Number(mMasuk[2]);
  let durasi = DURASI_SHIFT_DEFAULT_MENIT;
  const mPulang = String(r.JAM_JADWAL_PULANG || '').match(/(\d{1,2}):(\d{2})/);
  if (mPulang) {
    durasi = (Number(mPulang[1]) * 60 + Number(mPulang[2])) - (hM * 60 + mM);
    if (durasi <= 0) durasi += 1440;
  }
  const hariGeser = hM >= JAM_MULAI_CEK_OPERASIONAL_BESOK ? -1 : 0;
  const mulai = new Date(tgl[2], tgl[1] - 1, tgl[0] + hariGeser, hM, mM, 0);
  return {
    buka: new Date(mulai.getTime() - TOLERANSI_BUKA_PRESENSI_MENIT * 60000),
    akhir: new Date(mulai.getTime() + durasi * 60000)
  };
}

/**
 * Baris roster yang BOLEH dipakai check-in: STATUS_MASUK='BELUM' dan shift-nya
 * BELUM berakhir; dipilih tanggal operasional PALING AWAL. Baris yang sudah
 * lewat TIDAK ikut (sebelumnya baris lama yang terlewat ikut "mencuri" check-in
 * hari berikutnya). Jendela BUKA sengaja tidak dicek di sini (fungsi ini juga
 * dipakai utk menampilkan jadwal berikutnya di halaman Presensi/Dashboard) --
 * pengecekan buka dilakukan saat submit, lihat cekJendelaBukaPresensi_.
 */
function cariRosterUntukCheckIn_(idRelawan, sekarang) {
  sekarang = sekarang || new Date();
  return daftarRosterCheckIn_(idRelawan, sekarang).aktif[0] || null;
}

/** Pisahkan baris BELUM milik relawan jadi {aktif (urut tanggal), kadaluarsa}. */
function daftarRosterCheckIn_(idRelawan, sekarang) {
  const urut = (a, b) => dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL));
  const kandidat = getRosterV2Rows_().filter(r => r.ID_RELAWAN === idRelawan && r.STATUS_MASUK === 'BELUM').sort(urut);
  const aktif = [], kadaluarsa = [];
  kandidat.forEach(r => {
    const j = jendelaPresensiRoster_(r);
    if (j && sekarang.getTime() > j.akhir.getTime()) kadaluarsa.push(r); else aktif.push(r);
  });
  return { aktif: aktif, kadaluarsa: kadaluarsa };
}

/** Lempar error jelas kalau presensi utk baris ini belum dibuka. */
function cekJendelaBukaPresensi_(roster, sekarang) {
  const j = jendelaPresensiRoster_(roster);
  if (j && sekarang.getTime() < j.buka.getTime()) {
    throw new Error('Presensi untuk jadwal tanggal operasional ' + roster.TANGGAL_OPERASIONAL + ' (shift ' + roster.JAM_JADWAL_MASUK +
      ') belum dibuka. Presensi dapat dilakukan mulai ' + Utilities.formatDate(j.buka, ZONA_WAKTU, 'dd/MM/yyyy HH:mm') + '.');
  }
}

/** Baris roster milik relawan ini yang sedang STATUS_MASUK != 'BELUM' TAPI STATUS_PULANG='BELUM' -- shift yang sedang berjalan (checked in, not yet out). Dipakai untuk MENOLAK check-in kedua sebelum mencari roster baru. */
/**
 * PERBAIKAN PENTING: sebelumnya fungsi ini mencari roster "sudah Masuk,
 * belum Pulang" TANPA batas waktu sama sekali -- kalau relawan lupa scan
 * Pulang SATU KALI SAJA, baris roster itu akan SELAMANYA dianggap "sedang
 * berjalan" di hari-hari berikutnya, membuat relawan tidak pernah bisa
 * Masuk lagi (sistem terus bilang "sudah Masuk", padahal itu punya hari
 * yang sudah lama lewat) sampai ada Admin yang membetulkan manual.
 *
 * PERBAIKAN DITULIS ULANG SEKALI LAGI: percobaan pertama memakai selisih
 * TANGGAL_OPERASIONAL kalender -- ternyata itu TIDAK BISA membedakan
 * "lupa pulang kemarin" (harus dianggap basi) dari "shift lintas tengah
 * malam yang sungguh masih berjalan" (harus tetap terdeteksi), karena
 * KEDUANYA sama-sama punya TANGGAL_OPERASIONAL=kemarin, STATUS_PULANG=
 * BELUM -- tidak bisa dibedakan dari tanggalnya saja.
 * Sekarang dipakai SELISIH WAKTU SUNGGUHAN sejak JAM_MASUK (reuse pola
 * yang sama dengan hitungMenitSejakMasuk_ di AbsensiQr.gs), dibandingkan
 * dengan DURASI_SHIFT_DEFAULT_MENIT (asumsi lama shift yang SUDAH ada di
 * sistem) + jeda wajar utk telat scan Pulang. Shift yang masih dalam
 * rentang wajar tetap terdeteksi "sedang berjalan"; yang sudah jauh
 * melewati itu dianggap basi, tidak lagi memblokir Masuk baru.
 */
function cariRosterSedangBerjalan_(idRelawan) {
  const kandidat = getRosterV2Rows_().filter(r => r.ID_RELAWAN === idRelawan && r.STATUS_MASUK !== 'BELUM' && r.STATUS_PULANG === 'BELUM');
  if (!kandidat.length) return null;
  const terbaru = kandidat.sort((a, b) => dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL)))[0];

  const tgl = String(terbaru.TANGGAL_MASUK || '').split('/').map(Number);
  const jam = String(terbaru.JAM_MASUK || '').match(/(\d{1,2}):(\d{2})/);
  if (tgl.length !== 3 || tgl.some(isNaN) || !jam) return terbaru; // data tak lengkap -- jangan gagal diam-diam, biarkan alur lama berjalan
  const waktuMasuk = new Date(tgl[2], tgl[1] - 1, tgl[0], Number(jam[1]), Number(jam[2]), 0);
  const menitSejakMasuk = Math.floor((new Date().getTime() - waktuMasuk.getTime()) / 60000);

  const JEDA_WAJAR_TELAT_PULANG_MENIT = 240; // 4 jam -- cukup longgar utk telat scan Pulang wajar
  if (menitSejakMasuk > DURASI_SHIFT_DEFAULT_MENIT + JEDA_WAJAR_TELAT_PULANG_MENIT) return null;
  return terbaru;
}

/** Baris roster MASUK PALING BARU milik relawan ini (STATUS_MASUK != 'BELUM'), apa pun status pulangnya -- dipakai alur check-out utk membedakan "belum pernah check-in" dari "sudah checkout" (§S). */
function cariRosterMasukTerakhir_(idRelawan) {
  const kandidat = getRosterV2Rows_().filter(r => r.ID_RELAWAN === idRelawan && r.STATUS_MASUK !== 'BELUM');
  if (!kandidat.length) return null;
  return kandidat.sort((a, b) => dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL)))[0];
}

/**
 * CHECK-IN (roster-first). Alur persis §R:
 * 1-3) requireAuthRelawan (identitas dari session, TIDAK PERNAH dari body).
 * 4) cariRosterUntukCheckIn_.
 * 5) ID_ABSENSI SUDAH ADA di baris roster (dibuat saat roster dibuat).
 * 6) TANGGAL_OPERASIONAL TIDAK ditentukan ulang di sini -- sudah tetap dari roster.
 * 7) Cek belum py JAM_MASUK (STATUS_MASUK='BELUM').
 * 8-11) Validasi GPS & radius (server, tidak percaya frontend).
 * 12) Terlambat dihitung dari JAM_JADWAL_MASUK baris roster itu sendiri.
 * 13-19) UPDATE baris roster yang sama (bukan appendRow).
 */
function submitAbsensiV2MasukInternal_(idRelawan, relawan, body) {
  // Cek dulu: relawan ini SEDANG dalam shift terbuka (sudah check-in,
  // belum check-out) di roster LAIN? Kalau ya, itu error yang BEDA dari
  // "tidak ada roster" -- harus ditolak dgn pesan yang benar (persis
  // seperti submitAbsensi lama: cariMasukTerbuka_ dicek LEBIH DULU).
  if (cariRosterSedangBerjalan_(idRelawan)) {
    throw new Error('Anda sudah melakukan absensi masuk dan belum absen pulang. Selesaikan absensi pulang terlebih dahulu.');
  }

  const roster = cariRosterUntukCheckIn_(idRelawan);
  if (!roster) {
    throw new Error('Presensi gagal diproses. Data jadwal Anda tidak ditemukan. Silakan hubungi Admin SPPG.');
  }

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
    const sheet = getRosterSheetV2_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    const idxId = idx.ID_ABSENSI;
    let baris = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxId]) === roster.ID_ABSENSI) { baris = i + 1; break; }
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
      if (selisih < -600) selisih += 1440; // lintas tengah malam (jadwal malam, aktual dini hari)
      keterlambatanMenit = Math.max(0, selisih - TOLERANSI_TERLAMBAT_MENIT_V2);
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
    logAudit_('CHECK_IN_V2', 'ROSTER_V2', roster.ID_ABSENSI, idRelawan, { jamMasuk: jamMasuk, statusMasuk: statusMasuk, keterlambatanMenit: keterlambatanMenit });
    if (statusMasuk === 'TERLAMBAT') kirimNotifikasiTerlambat_(idRelawan, keterlambatanMenit);

    return {
      idAbsensi: roster.ID_ABSENSI,
      idOperasional: roster.ID_OPERASIONAL,
      tanggalOperasional: roster.TANGGAL_OPERASIONAL,
      jamMasuk: jamMasuk,
      statusMasuk: statusMasuk,
      keterlambatanMenit: keterlambatanMenit,
      jarakMeter: Math.round(jarak)
    };
  } finally {
    lock.releaseLock();
  }
}

/** CHECK-OUT (roster-first). UPDATE baris roster yang SAMA (§S) -- dilarang append row baru. */
function submitAbsensiV2PulangInternal_(idRelawan, relawan, body) {
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
    const sheet = getRosterSheetV2_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    const idxId = idx.ID_ABSENSI;
    let baris = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxId]) === roster.ID_ABSENSI) { baris = i + 1; break; }
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
    logAudit_('CHECK_OUT_V2', 'ROSTER_V2', roster.ID_ABSENSI, idRelawan, { jamPulang: jamPulang });

    return {
      idAbsensi: roster.ID_ABSENSI,
      idOperasional: roster.ID_OPERASIONAL,
      tanggalOperasional: roster.TANGGAL_OPERASIONAL,
      jamPulang: jamPulang,
      jarakMeter: Math.round(jarak)
    };
  } finally {
    lock.releaseLock();
  }
}

/** Dispatch tunggal, sama pola dengan submitAbsensi lama -- {token, jenis: MASUK|PULANG, ...}. */
function submitAbsensiV2(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const relawan = getRelawanById(idRelawan);
  if (!relawan || String(relawan.status).toUpperCase() !== 'AKTIF') {
    throw new Error('Data relawan tidak aktif. Hubungi admin.');
  }
  const jenis = sanitize(body.jenis).toUpperCase();
  if (jenis === 'MASUK') return submitAbsensiV2MasukInternal_(idRelawan, relawan, body);
  if (jenis === 'PULANG') return submitAbsensiV2PulangInternal_(idRelawan, relawan, body);
  throw new Error('Jenis absensi tidak valid.');
}

/** Status roster relawan saat ini (dipakai halaman absensi versi baru -- BELUM dipasang ke UI, lihat catatan Roster.gs). */
function getStatusRosterRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const semua = getRosterV2Rows_().filter(r => r.ID_RELAWAN === idRelawan);
  const terbuka = cariRosterSedangBerjalan_(idRelawan) || cariRosterUntukCheckIn_(idRelawan);
  return {
    rosterAktif: terbuka || null,
    riwayat: semua.sort((a, b) => dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL)))
  };
}


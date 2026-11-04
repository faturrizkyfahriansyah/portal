/**
 * PushNotifikasi.gs — Notifikasi ke notification tray HP relawan lewat
 * Firebase Cloud Messaging (FCM). Backend tetap Apps Script + Spreadsheet
 * sesuai aturan proyek -- FCM cuma "jembatan pengiriman", bukan hosting/
 * database baru.
 *
 * ISI DULU 3 SCRIPT PROPERTY INI SEBELUM DIPAKAI (Project Settings >
 * Script Properties di Apps Script):
 *   FCM_PROJECT_ID           -- dari firebaseConfig.projectId
 *   FCM_SERVICE_ACCOUNT_EMAIL -- dari file JSON service account, field "client_email"
 *   FCM_SERVICE_ACCOUNT_KEY   -- dari file JSON service account, field "private_key"
 *                                (termasuk baris -----BEGIN PRIVATE KEY-----)
 *
 * Kolom baru yang perlu ditambahkan manual di 07_AKUN_RELAWAN:
 *   FCM_TOKEN            -- token perangkat relawan (diisi otomatis oleh sistem)
 *   NOTIF_HP_AKTIF       -- TRUE/FALSE, relawan boleh menonaktifkan
 *   TERAKHIR_DIINGATKAN  -- dipakai supaya tidak spam (1x per hari per jenis)
 */

// ------------------------------------------------------------
// SIMPAN TOKEN PERANGKAT
// ------------------------------------------------------------

function simpanTokenPushNotifikasi(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');
  if (akun.idx.FCM_TOKEN === undefined) {
    throw new Error('Kolom FCM_TOKEN belum ada di 07_AKUN_RELAWAN. Tambahkan dulu kolom ini.');
  }

  const sheet = getAkunSheet();
  sheet.getRange(akun.baris, akun.idx.FCM_TOKEN + 1).setValue(sanitize(body.fcmToken));
  if (akun.idx.NOTIF_HP_AKTIF !== undefined) {
    sheet.getRange(akun.baris, akun.idx.NOTIF_HP_AKTIF + 1).setValue(true);
  }
  return { success: true };
}

function nonaktifkanPushNotifikasi(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun || akun.idx.NOTIF_HP_AKTIF === undefined) return { success: true };
  getAkunSheet().getRange(akun.baris, akun.idx.NOTIF_HP_AKTIF + 1).setValue(false);
  return { success: true };
}

// ------------------------------------------------------------
// INTI PENGIRIMAN (FCM HTTP v1 API + OAuth2 Service Account)
// ------------------------------------------------------------

/** Base64url encode -- FCM/JWT butuh varian ini, beda dikit dari base64 biasa. */
function _base64UrlEncode_(bytesAtauTeks) {
  let base64;
  if (typeof bytesAtauTeks === 'string') {
    base64 = Utilities.base64Encode(bytesAtauTeks, Utilities.Charset.UTF_8);
  } else {
    base64 = Utilities.base64Encode(bytesAtauTeks);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Ambil OAuth2 access token pakai Service Account (JWT Bearer flow) --
 * pola standar Google, satu-satunya cara resmi memanggil FCM HTTP v1 API.
 * Token di-cache 55 menit (kadaluarsa asli 1 jam) supaya tidak generate
 * ulang di setiap pengiriman.
 */
function _ambilAccessTokenFcm_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('fcm_access_token');
  if (cached) return cached;

  const email = PropertiesService.getScriptProperties().getProperty('FCM_SERVICE_ACCOUNT_EMAIL');
  let privateKey = PropertiesService.getScriptProperties().getProperty('FCM_SERVICE_ACCOUNT_KEY');
  if (!email || !privateKey) {
    throw new Error('FCM_SERVICE_ACCOUNT_EMAIL / FCM_SERVICE_ACCOUNT_KEY belum diisi di Script Properties.');
  }
  // Kalau di-paste sebagai teks literal "\n" (dua karakter, bukan baris
  // baru sungguhan -- ini yang paling sering terjadi kalau copy-paste dari
  // file JSON), ubah dulu jadi baris baru asli supaya PEM-nya valid.
  privateKey = privateKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const bagianHeader = _base64UrlEncode_(JSON.stringify(header));
  const bagianClaim = _base64UrlEncode_(JSON.stringify(claim));
  const input = bagianHeader + '.' + bagianClaim;

  const signatureBytes = Utilities.computeRsaSha256Signature(input, privateKey);
  const jwt = input + '.' + _base64UrlEncode_(signatureBytes);

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  const hasil = JSON.parse(resp.getContentText());
  if (!hasil.access_token) {
    throw new Error('Gagal ambil access token FCM: ' + resp.getContentText());
  }
  cache.put('fcm_access_token', hasil.access_token, 55 * 60);
  return hasil.access_token;
}

/**
 * Kirim 1 notifikasi push ke 1 relawan. Dipakai internal saja (nama
 * berakhiran _) -- dipanggil dari fungsi-fungsi pengecekan otomatis di
 * bawah, atau bisa dipanggil manual dari Admin nanti.
 * Kegagalan kirim TIDAK melempar error ke pemanggil -- supaya 1 relawan
 * yang tokennya kadaluarsa tidak menghentikan proses untuk relawan lain.
 */
function kirimPushNotifikasi_(idRelawan, judul, isiPesan, dataTambahan) {
  try {
    const akun = cariAkunByIdRelawan_(idRelawan);
    if (!akun || akun.idx.FCM_TOKEN === undefined) return false;

    const token = akun.data[akun.idx.FCM_TOKEN];
    if (!token) return false; // relawan belum pernah mengizinkan notifikasi

    if (akun.idx.NOTIF_HP_AKTIF !== undefined && akun.data[akun.idx.NOTIF_HP_AKTIF] === false) {
      return false; // relawan sudah matikan notifikasi HP
    }

    const projectId = PropertiesService.getScriptProperties().getProperty('FCM_PROJECT_ID');
    const accessToken = _ambilAccessTokenFcm_();

    const payload = {
      message: {
        token: token,
        notification: { title: judul, body: isiPesan },
        webpush: {
          notification: { icon: 'assets/icon-192.png' },
          fcm_options: { link: (dataTambahan && dataTambahan.link) || '/' }
        }
      }
    };

    const resp = UrlFetchApp.fetch(
      'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send',
      {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + accessToken },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    return resp.getResponseCode() === 200;
  } catch (e) {
    Logger.log('Gagal kirim push ke ' + idRelawan + ': ' + e.message);
    return false;
  }
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #1: BELUM ABSEN MASUK
// Dipanggil dari time-driven trigger (lihat panduan) -- mengecek semua
// relawan yang operasionalnya sudah berjalan tapi belum absen masuk.
// ------------------------------------------------------------

function cekBelumAbsenDanKirimPush() {
  const hariIni = formatTanggal(new Date());
  // ROSTER-FIRST: baris roster HARI INI dgn STATUS_MASUK='BELUM' SUDAH
  // berisi JAM_JADWAL_MASUK-nya sendiri -- tidak perlu lagi
  // tentukanOperasionalAktifHariIni_/resolveShiftUntukRelawan_ terpisah.
  const rosterBelumMasukHariIni = getRosterV2Rows_().filter(a =>
    a.ID_ABSENSI && a.TANGGAL_OPERASIONAL === hariIni && a.STATUS_MASUK === 'BELUM' && a.JAM_JADWAL_MASUK
  );

  const jamSekarang = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  let terkirim = 0;

  rosterBelumMasukHariIni.forEach(a => {
    const [jamShift, menitShift] = String(a.JAM_JADWAL_MASUK).split(':').map(Number);
    const [jamNow, menitNow] = jamSekarang.split(':').map(Number);
    const menitLewat = (jamNow * 60 + menitNow) - (jamShift * 60 + menitShift);
    if (menitLewat < 30) return;

    const akun = cariAkunByIdRelawan_(a.ID_RELAWAN);
    if (akun && akun.idx.TERAKHIR_DIINGATKAN !== undefined) {
      const terakhir = akun.data[akun.idx.TERAKHIR_DIINGATKAN];
      if (terakhir && tanggalSheetKeIso_(formatTanggal(new Date(terakhir))) === tanggalSheetKeIso_(hariIni)) return;
    }

    const terkirimKe = kirimPushNotifikasi_(a.ID_RELAWAN, 'Belum Absen Masuk', 'Kamu belum absen masuk hari ini. Segera absen ya!', { link: '/absensi.html' });
    if (terkirimKe && akun && akun.idx.TERAKHIR_DIINGATKAN !== undefined) {
      getAkunSheet().getRange(akun.baris, akun.idx.TERAKHIR_DIINGATKAN + 1).setValue(new Date());
      terkirim++;
    }
  });

  Logger.log('cekBelumAbsenDanKirimPush: ' + terkirim + ' notifikasi terkirim.');
}

// ------------------------------------------------------------
// NOTIFIKASI TERLAMBAT -- LANGSUNG SAAT SCAN, BUKAN BATCH 30 MENIT
// Berbeda dari pengingat2 di atas (yg nunggu kondisi lalu dicek per
// 30 menit), ini dipanggil LANGSUNG dari dalam proses absen Masuk itu
// sendiri (AbsensiV2.gs & AbsensiQr.gs, 2 tempat -- HP & QR), tepat
// saat statusnya ditentukan TERLAMBAT. Jadi relawan tahu SAAT ITU JUGA,
// bukan menunggu siklus trigger berikutnya.
// ------------------------------------------------------------
function kirimNotifikasiTerlambat_(idRelawan, keterlambatanMenit) {
  try {
    const judul = 'Anda Terlambat';
    const isi = 'Absen Masuk Anda tercatat terlambat ' + keterlambatanMenit + ' menit dari jadwal.';
    catatNotifikasi_('Jadwal', judul, isi, idRelawan);
    kirimPushNotifikasi_(idRelawan, judul, isi, { link: '/absensi.html' });
  } catch (e) {
    Logger.log('kirimNotifikasiTerlambat_ gagal (tidak menggagalkan proses absen): ' + e.message);
  }
}

// ------------------------------------------------------------
// PENGINGAT JADWAL HARI INI -- OTOMATIS
// Sebelumnya Pengelola mengirim ini MANUAL setiap hari lewat form Buat
// Notifikasi, isinya sama tiap kali (cuma tanggal yang beda). Sekarang
// dikirim otomatis lewat trigger yang SUDAH ADA (30 menit sekali, lihat
// jalankanSemuaPengecekanNotifikasiOtomatis) -- TIDAK perlu trigger baru.
// Supaya tidak terkirim berulang-ulang sepanjang hari, HANYA dikirim
// dalam JENDELA WAKTU singkat di pagi hari (lihat konstanta di bawah).
// Personalisasi PER RELAWAN -- tiap orang dapat jam shift-nya sendiri,
// bukan 1 pesan generik yang sama utk semua.
// ------------------------------------------------------------
const JAM_MULAI_PENGINGAT_JADWAL = '06:00';
const JAM_SELESAI_PENGINGAT_JADWAL = '06:30'; // jendela 30 menit -- cukup lebar utk trigger yg jalan tiap 30 menit, tidak akan pernah terlewat

function cekPengingatJadwalHariIniDanKirimPush() {
  const jamSekarang = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  if (jamSekarang < JAM_MULAI_PENGINGAT_JADWAL || jamSekarang >= JAM_SELESAI_PENGINGAT_JADWAL) return;

  const hariIni = formatTanggal(new Date());
  const rosterHariIni = getRosterV2Rows_().filter(a => a.ID_ABSENSI && a.TANGGAL_OPERASIONAL === hariIni && a.JAM_JADWAL_MASUK);

  let terkirim = 0;
  rosterHariIni.forEach(a => {
    const akun = cariAkunByIdRelawan_(a.ID_RELAWAN);
    if (akun && akun.idx.TERAKHIR_DIINGATKAN_JADWAL !== undefined) {
      const terakhir = akun.data[akun.idx.TERAKHIR_DIINGATKAN_JADWAL];
      if (terakhir && tanggalSheetKeIso_(formatTanggal(new Date(terakhir))) === tanggalSheetKeIso_(hariIni)) return; // sudah dikirim hari ini, lewati
    }

    const rentangJam = a.JAM_JADWAL_MASUK + (a.JAM_JADWAL_PULANG ? ' - ' + a.JAM_JADWAL_PULANG : '');
    const judul = 'Pengingat Jadwal Hari Ini';
    const isi = 'Jadwal Anda hari ini, ' + (a.HARI_OPERASIONAL || '') + ' ' + hariIni + ': ' + (a.NAMA_SHIFT || a.DIVISI || 'Shift') + ', pukul ' + rentangJam + '.';

    catatNotifikasi_('Jadwal', judul, isi, a.ID_RELAWAN);
    const terkirimKe = kirimPushNotifikasi_(a.ID_RELAWAN, judul, isi, { link: '/jadwal.html' });

    if (akun && akun.idx.TERAKHIR_DIINGATKAN_JADWAL !== undefined) {
      getAkunSheet().getRange(akun.baris, akun.idx.TERAKHIR_DIINGATKAN_JADWAL + 1).setValue(new Date());
    }
    if (terkirimKe) terkirim++;
  });

  Logger.log('cekPengingatJadwalHariIniDanKirimPush: ' + terkirim + ' notifikasi terkirim.');
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #2: LENGKAPI PROFIL
// Dikirim SEKALI SAJA per relawan (bukan berulang tiap hari) -- ditandai
// lewat kolom PROFIL_REMINDER_TERKIRIM supaya tidak spam.
// ------------------------------------------------------------

function cekProfilBelumLengkapDanKirimPush() {
  const semuaAkun = sheetToObjects(getAkunSheet());
  let terkirim = 0;

  semuaAkun.forEach(a => {
    if (a.PROFIL_REMINDER_TERKIRIM === true || String(a.PROFIL_REMINDER_TERKIRIM).toUpperCase() === 'TRUE') return;

    const belumLengkap = !a.TANGGAL_LAHIR || !a.JENIS_KELAMIN || !a.ALAMAT || !a.FOTO_PROFIL;
    if (!belumLengkap) return;

    const berhasil = kirimPushNotifikasi_(a.ID_RELAWAN, 'Lengkapi Profil Kamu', 'Beberapa data profil kamu masih kosong. Yuk lengkapi di menu Profil Saya.', { link: '/profil.html' });
    if (berhasil) {
      const akun = cariAkunByIdRelawan_(a.ID_RELAWAN);
      if (akun && akun.idx.PROFIL_REMINDER_TERKIRIM !== undefined) {
        getAkunSheet().getRange(akun.baris, akun.idx.PROFIL_REMINDER_TERKIRIM + 1).setValue(true);
        terkirim++;
      }
    }
  });

  Logger.log('cekProfilBelumLengkapDanKirimPush: ' + terkirim + ' notifikasi terkirim.');
}

/**
 * Dipanggil 1 fungsi ini saja dari time-driven trigger (tiap 30 menit) --
 * menjalankan kedua pengecekan di atas sekaligus.
 */

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #3: BELUM ABSEN PULANG
// ------------------------------------------------------------

function cekBelumAbsenPulangDanKirimPush() {
  const hariIni = formatTanggal(new Date());
  // ROSTER-FIRST: baris sudah MASUK (bukan Izin/Sakit/Cuti) tapi belum
  // PULANG, dgn JAM_JADWAL_PULANG sudah tersedia langsung di baris yang sama.
  const rosterBelumPulangHariIni = getRosterV2Rows_().filter(a =>
    a.ID_ABSENSI && a.TANGGAL_OPERASIONAL === hariIni &&
    a.STATUS_MASUK && a.STATUS_MASUK !== 'BELUM' &&
    a.STATUS_PULANG === 'BELUM' && a.JAM_JADWAL_PULANG
  );

  const jamSekarang = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  let terkirim = 0;

  rosterBelumPulangHariIni.forEach(a => {
    const [jamShift, menitShift] = String(a.JAM_JADWAL_PULANG).split(':').map(Number);
    const [jamNow, menitNow] = jamSekarang.split(':').map(Number);
    const menitLewat = (jamNow * 60 + menitNow) - (jamShift * 60 + menitShift);
    if (menitLewat < 30) return;

    const akun = cariAkunByIdRelawan_(a.ID_RELAWAN);
    const kunciSudahIngat = 'PULANG:' + tanggalSheetKeIso_(hariIni);
    if (akun && akun.idx.TERAKHIR_DIINGATKAN !== undefined) {
      const terakhir = String(akun.data[akun.idx.TERAKHIR_DIINGATKAN] || '');
      if (terakhir === kunciSudahIngat) return;
    }

    const terkirimKe = kirimPushNotifikasi_(a.ID_RELAWAN, 'Belum Absen Pulang', 'Kamu sudah absen masuk tapi belum absen pulang hari ini.', { link: '/absensi.html' });
    if (terkirimKe && akun && akun.idx.TERAKHIR_DIINGATKAN !== undefined) {
      getAkunSheet().getRange(akun.baris, akun.idx.TERAKHIR_DIINGATKAN + 1).setValue(kunciSudahIngat);
      terkirim++;
    }
  });

  Logger.log('cekBelumAbsenPulangDanKirimPush: ' + terkirim + ' notifikasi terkirim.');
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #4: STOK MENIPIS/HABIS (SIRAGA)
// Pakai statusStokBarang_ yang SUDAH ADA di Stok.gs. Dikirim maks 1x per
// hari per barang (disimpan di Script Properties) supaya tidak spam.
// ------------------------------------------------------------

function cekStokMenipisDanKirimPush() {
  let barang;
  try {
    barang = sheetToObjects(getStokBarangSheet()).filter(b => String(b.AKTIF).toUpperCase() !== 'NONAKTIF');
  } catch (e) {
    Logger.log('cekStokMenipisDanKirimPush: modul SIRAGA belum tersedia -- dilewati.');
    return;
  }

  // PERBAIKAN: sebelumnya baca dari 07_AKUN_RELAWAN dengan nilai 'AKTIF' --
  // dua-duanya salah (lihat perbaikan setRoleStok/getDaftarPetugasStok di
  // Stok.gs). Kolom ROLE_STOK yang benar-benar dipakai ada di
  // 01_DATA_RELAWAN dengan nilai 'PETUGAS'. Sebelum ini, fungsi tidak
  // pernah menemukan siapa pun -- notifikasi stok menipis tidak pernah terkirim.
  const petugasStok = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).filter(r => String(r.ROLE_STOK).toUpperCase() === 'PETUGAS');
  if (!petugasStok.length) { Logger.log('cekStokMenipisDanKirimPush: belum ada Petugas Stok terdaftar.'); return; }

  const hariIniIso = tanggalSheetKeIso_(formatTanggal(new Date()));
  const props = PropertiesService.getScriptProperties();
  let terkirim = 0;

  barang.forEach(b => {
    const stokSaatIni = Number(b.STOK_SAAT_INI) || 0;
    const stokMinimum = Number(b.STOK_MINIMUM) || 0;
    const status = statusStokBarang_(stokSaatIni, stokMinimum);
    if (status === 'AMAN') return;

    const kunciProp = 'stok_diingatkan_' + b.ID_BARANG;
    if (props.getProperty(kunciProp) === hariIniIso + ':' + status) return;

    const emoji = status === 'HABIS' ? '' : '';
    const judul = emoji + ' Stok ' + (status === 'HABIS' ? 'Habis' : 'Menipis') + ': ' + b.NAMA_BARANG;
    const isi = 'Sisa ' + stokSaatIni + ' ' + b.SATUAN + ' (minimum ' + stokMinimum + ' ' + b.SATUAN + ').';

    petugasStok.forEach(p => kirimPushNotifikasi_(p.ID_RELAWAN, judul, isi, { link: '/stok-relawan.html' }));
    try { catatNotifikasi_('Sistem', judul, isi, 'SEMUA'); } catch (e) { /* modul Notifikasi mungkin belum siap */ }

    props.setProperty(kunciProp, hariIniIso + ':' + status);
    terkirim++;
  });

  Logger.log('cekStokMenipisDanKirimPush: ' + terkirim + ' notifikasi stok terkirim.');
}

function jalankanSemuaPengecekanNotifikasiOtomatis() {
  // PENCEGAHAN EKSEKUSI BERTABRAKAN: kalau ada 2 trigger (sengaja atau
  // tidak sengaja terpasang dobel) yang memicu fungsi ini di waktu yang
  // berdekatan, TANPA lock ini keduanya akan jalan BERSAMAAN -- berisiko
  // kirim notifikasi dobel ke relawan yang sama, dan saling tabrakan saat
  // menulis kolom TERAKHIR_DIINGATKAN/Script Properties yang sama.
  // tryLock TIDAK menunggu lama (5 detik) -- kalau memang sedang ada
  // proses lain berjalan, lewati saja putaran ini, biar trigger
  // berikutnya yang coba lagi -- jangan sampai numpuk antrian tunggu.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('jalankanSemuaPengecekanNotifikasiOtomatis: eksekusi lain sedang berjalan, putaran ini dilewati.');
    return;
  }
  try {
    cekBelumAbsenDanKirimPush();
    cekBelumAbsenPulangDanKirimPush();
    cekPengingatJadwalHariIniDanKirimPush();
    cekProfilBelumLengkapDanKirimPush();
    // cekStokMenipisDanKirimPush(); -- DIMATIKAN atas permintaan Pengelola:
    // transaksi SIRAGA keluar-masuk sangat sering (ratusan/hari), status
    // barang bisa bolak-balik MENIPIS<->AMAN berkali-kali sehari, membuat
    // push ini jadi mengganggu. Info stok menipis/habis TETAP tersedia --
    // sudah tampil otomatis di Dashboard SIRAGA (lihat getStokDashboard,
    // bagian "perluPerhatian") setiap kali Pengelola membuka halamannya,
    // cukup sebagai info pasif, tidak perlu mendorong/push. Fungsinya
    // sendiri TIDAK dihapus (jaga-jaga kalau suatu saat ingin diaktifkan
    // lagi dengan aturan yang lebih longgar), cuma pemanggilannya di sini
    // yang dihentikan.
    prosesAntrianPushSipandu();
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// ANTRIAN PUSH DARI SIPANDU (proyek Apps Script TERPISAH)
// SIPANDU tidak bisa memanggil kirimPushNotifikasi_ secara langsung
// (beda proyek). Solusinya: SIPANDU MENULIS permintaan ke sheet ini
// (dengan membuka Spreadsheet Portal lewat ID -- pola SAMA seperti
// SipanduAuth.gs membaca 07_AKUN_RELAWAN), lalu Portal utama yang
// MEMBACA & MENGIRIM lewat trigger 30-menit yang sudah ada.
//
// Kolom 25_ANTRIAN_PUSH_SIPANDU: ID | ID_RELAWAN | JUDUL | ISI | LINK | STATUS | DIBUAT_PADA
// STATUS: MENUNGGU -> TERKIRIM (atau GAGAL, tetap disimpan untuk audit)
// ------------------------------------------------------------

function prosesAntrianPushSipandu() {
  let sheet;
  try {
    sheet = getSheet(NAMA_SHEET.ANTRIAN_PUSH_SIPANDU);
  } catch (e) {
    Logger.log('prosesAntrianPushSipandu: sheet 25_ANTRIAN_PUSH_SIPANDU belum dibuat -- dilewati.');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  let terkirim = 0;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.STATUS]).toUpperCase() !== 'MENUNGGU') continue;

    const idRelawan = String(data[i][idx.ID_RELAWAN]);
    const judul = String(data[i][idx.JUDUL]);
    const isi = String(data[i][idx.ISI]);
    const link = String(data[i][idx.LINK] || '');

    const berhasil = kirimPushNotifikasi_(idRelawan, judul, isi, { link: link });
    sheet.getRange(i + 1, idx.STATUS + 1).setValue(berhasil ? 'TERKIRIM' : 'GAGAL');
    if (berhasil) terkirim++;
  }

  Logger.log('prosesAntrianPushSipandu: ' + terkirim + ' notifikasi dari SIPANDU terkirim.');
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #5: REKAP MINGGUAN
// Dipasang di TRIGGER TERPISAH (mingguan, bukan tiap 30 menit -- lihat
// panduan) supaya tidak ikut jalan berkali-kali dalam 1 minggu yang sama.
// Rekap per-relawan dikirim sebagai push; rekap per-divisi dicatat sebagai
// 1 notifikasi Sistem (dibaca Admin/siapa saja lewat halaman Notifikasi).
// ------------------------------------------------------------

function kirimRekapMingguan() {
  const sekarang = new Date();
  const tujuhHariLalu = new Date(sekarang.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tujuhHariLaluIso = tanggalSheetKeIso_(formatTanggal(tujuhHariLalu));
  const sekarangIso = tanggalSheetKeIso_(formatTanggal(sekarang));

  const roster7Hari = getRosterV2Rows_().filter(a => {
    if (!a.ID_ABSENSI) return false;
    const iso = tanggalSheetKeIso_(a.TANGGAL_OPERASIONAL || '');
    return iso >= tujuhHariLaluIso && iso <= sekarangIso;
  });

  const relawanAktif = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).filter(r => String(r.STATUS).toUpperCase() === 'AKTIF');

  // ---- Rekap per relawan (push ke masing-masing) ----
  relawanAktif.forEach(r => {
    // "Terealisasi" = statusnya bukan lagi BELUM ABSEN (roster yang belum
    // terjadi tidak ikut dihitung sbg aktivitas minggu ini).
    const milikSaya = roster7Hari.filter(a => a.ID_RELAWAN === r.ID_RELAWAN && a.STATUS_KEHADIRAN !== 'BELUM ABSEN');
    if (!milikSaya.length) return; // tidak ada aktivitas minggu ini -- tidak perlu kirim rekap kosong

    let hadir = 0, terlambat = 0, izinSakit = 0;
    milikSaya.forEach(a => {
      if (a.STATUS_KEHADIRAN === 'IZIN' || a.STATUS_KEHADIRAN === 'SAKIT' || a.STATUS_KEHADIRAN === 'CUTI') { izinSakit++; return; }
      hadir++;
      if (a.STATUS_KEHADIRAN === 'TERLAMBAT' || (Number(a.KETERLAMBATAN_MENIT) || 0) > 0) terlambat++;
    });

    const isi = 'Minggu ini: ' + hadir + ' hadir' + (terlambat ? ', ' + terlambat + ' terlambat' : '') + (izinSakit ? ', ' + izinSakit + ' izin/sakit/cuti' : '') + '.';
    kirimPushNotifikasi_(r.ID_RELAWAN, 'Rekap Minggu Ini', isi, { link: '/riwayat.html' });
  });

  // ---- Rekap per divisi (1 notifikasi sistem, dibaca siapa saja) ----
  const rekapDivisi = {};
  relawanAktif.forEach(r => {
    const divisi = r.DIVISI || 'Tanpa Divisi';
    if (!rekapDivisi[divisi]) rekapDivisi[divisi] = { hadir: 0 };
    const jumlahHadir = roster7Hari.filter(a => a.ID_RELAWAN === r.ID_RELAWAN && (a.STATUS_KEHADIRAN === 'HADIR' || a.STATUS_KEHADIRAN === 'HADIR LENGKAP' || a.STATUS_KEHADIRAN === 'TERLAMBAT')).length;
    rekapDivisi[divisi].hadir += jumlahHadir;
  });
  const ringkasanDivisi = Object.keys(rekapDivisi).map(d => d + ': ' + rekapDivisi[d].hadir + 'x hadir').join(' · ');
  try { catatNotifikasi_('Sistem', 'Rekap Mingguan per Divisi', ringkasanDivisi || 'Belum ada aktivitas minggu ini.', 'SEMUA'); } catch (e) { /* abaikan kalau modul Notifikasi belum siap */ }

  Logger.log('kirimRekapMingguan selesai: ' + relawanAktif.length + ' relawan diperiksa.');
}

// ------------------------------------------------------------
// TEST DARI WEB — supaya Admin bisa uji kirim notifikasi tanpa perlu
// buka Apps Script sama sekali (cukup dari Dashboard Admin).
// ------------------------------------------------------------

/**
 * Versi VERBOSE dari kirimPushNotifikasi_ -- TIDAK menelan error, dipakai
 * KHUSUS untuk tombol Test dari web supaya Admin bisa lihat penyebab
 * asli kalau gagal. Untuk pengecekan otomatis massal, tetap pakai
 * kirimPushNotifikasi_ yang aman (1 relawan gagal tidak menghentikan yang lain).
 */
function _kirimPushVerbose_(idRelawan, judul, isiPesan) {
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun || akun.idx.FCM_TOKEN === undefined) throw new Error('Kolom FCM_TOKEN tidak ditemukan di sheet.');
  const token = akun.data[akun.idx.FCM_TOKEN];
  if (!token) throw new Error('Relawan ini belum punya token (belum pernah klik "Aktifkan Notifikasi HP").');

  const projectId = PropertiesService.getScriptProperties().getProperty('FCM_PROJECT_ID');
  if (!projectId) throw new Error('Script Property FCM_PROJECT_ID belum diisi.');

  const accessToken = _ambilAccessTokenFcm_(); // akan throw sendiri kalau service account salah/belum diisi

  const payload = {
    message: {
      token: token,
      notification: { title: judul, body: isiPesan },
      webpush: { notification: { icon: 'assets/icon-192.png' }, fcm_options: { link: '/' } }
    }
  };

  const resp = UrlFetchApp.fetch(
    'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const kode = resp.getResponseCode();
  if (kode !== 200) {
    throw new Error('FCM menolak (HTTP ' + kode + '): ' + resp.getContentText());
  }
  return true;
}

function kirimTestPushNotifikasi(body) {
  const usernameAdmin = requireAuth(body.token);
  const idRelawan = sanitize(body.idRelawan);
  if (!idRelawan) throw new Error('ID Relawan wajib diisi.');

  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Relawan dengan ID tersebut tidak ditemukan.');

  // _kirimPushVerbose_ SENGAJA dibiarkan melempar error apa adanya ke
  // sini -- tidak ditangkap -- supaya pesannya sampai persis ke Admin.
  _kirimPushVerbose_(idRelawan, 'Test Notifikasi', 'Ini notifikasi percobaan dari Admin. Kalau kamu lihat ini, berarti sistem notifikasi HP sudah jalan!');

  logAudit_('TEST_PUSH_NOTIFIKASI', 'PUSH_NOTIF', idRelawan, usernameAdmin, { berhasil: true });
  return { success: true };
}


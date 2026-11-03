/**
 * SPPG JEUNGJING — SIPRES: ABSENSI QR
 * AbsensiQr.gs — jalur presensi tambahan via kartu QR pribadi relawan,
 * dibaca kamera HP/tablet petugas (tanpa login, tanpa GPS, tanpa selfie).
 *
 * PRINSIP (disepakati sebelum file ini ditulis, lihat riwayat pembahasan):
 * - Database TETAP SATU: 03_DATA_ABSENSI, struktur TIDAK diubah sama sekali.
 * - 01_DATA_RELAWAN mendapat 4 kolom aditif (lihat setupKolomKartuQr).
 * - Jendela Masuk REUSE 100% dari AbsensiV2.gs (jendelaPresensiRoster_,
 *   cekJendelaBukaPresensi_, daftarRosterCheckIn_) -- TIDAK diubah.
 * - Aturan Pulang REUSE 100% (tidak ada cutoff waktu baru) -- satu-satunya
 *   tambahan adalah jeda minimum anti-double-scan (§ lihat
 *   JEDA_MINIMUM_PULANG_QR_MENIT di bawah), KHUSUS jalur ini.
 * - submitAbsensi/submitAbsensiMasukInternal_/submitAbsensiPulangInternal_
 *   (jalur HP) TIDAK DISENTUH SAMA SEKALI. Penulisan baris roster untuk
 *   jalur QR memakai fungsi INTERNAL TERPISAH (tulisAbsensiMasukQr_/
 *   tulisAbsensiPulangQr_) yang secara sengaja MENIRU (bukan memanggil)
 *   logika penulisan HP, supaya perubahan/bug di jalur QR yang masih baru
 *   ini mustahil merembet ke jalur HP yang sudah lama berjalan dan teruji.
 *   Ini trade-off sadar: sedikit duplikasi kode demi nol risiko ke fungsi
 *   existing -- sesuai prioritas eksplisit "jangan merusak yang sudah ada"
 *   di atas "hindari duplikasi kecil".
 * - Hasil scan (termasuk yang "ditolak" secara bisnis, mis. kartu nonaktif)
 *   BUKAN exception -- itu hasil NORMAL dari sebuah scan, dikembalikan
 *   lewat sukses(data) dengan data.kode terstruktur (lihat KODE_HASIL_QR).
 *   Exception (throw) hanya dipakai utk kegagalan BENAR-BENAR tak terduga
 *   (LockService timeout, dll), yang mengalir ke gagal()/klasifikasiError_
 *   existing di Code.gs TANPA PERLU diubah sama sekali.
 */

const KOLOM_KARTU_QR = ['TOKEN_KARTU', 'STATUS_KARTU', 'KARTU_DIBUAT_PADA', 'KARTU_DIUBAH_PADA'];

/** Jeda minimum sejak JAM_MASUK aktual sebelum scan berikutnya boleh dievaluasi sbg Pulang -- KHUSUS jalur QR, murni anti-double-scan, BUKAN toleransi/aturan jam kerja. */
const JEDA_MINIMUM_PULANG_QR_MENIT = 10;

const KODE_HASIL_QR = {
  BERHASIL_MASUK: 'BERHASIL_MASUK',
  BERHASIL_PULANG: 'BERHASIL_PULANG',
  SUDAH_MASUK: 'SUDAH_MASUK',            // scan berikutnya masih dalam jeda anti-double-scan
  SUDAH_LENGKAP: 'SUDAH_LENGKAP',
  BELUM_WAKTUNYA: 'BELUM_WAKTUNYA',      // jendela Masuk belum buka
  DI_LUAR_JENDELA: 'DI_LUAR_JENDELA',    // jadwal sudah lewat/kedaluwarsa
  IZIN_AKTIF: 'IZIN_AKTIF',              // sudah IZIN/SAKIT/CUTI disetujui utk tanggal ini
  KARTU_TIDAK_DIKENAL: 'KARTU_TIDAK_DIKENAL',
  KARTU_NONAKTIF: 'KARTU_NONAKTIF',
  RELAWAN_NONAKTIF: 'RELAWAN_NONAKTIF',
  JADWAL_TIDAK_DITEMUKAN: 'JADWAL_TIDAK_DITEMUKAN',
  BELUM_BISA_PULANG: 'BELUM_BISA_PULANG'
};

// ============================================================
// SETUP KOLOM (sekali jalan, idempotent -- pola SAMA PERSIS dgn
// setupSemuaKolomProfil di SetupKolomProfil.gs, reuse tambahKolomJikaBelumAda_)
// ============================================================
function setupKolomKartuQr() {
  const hasil = tambahKolomJikaBelumAda_(NAMA_SHEET.RELAWAN, KOLOM_KARTU_QR);
  Logger.log('=== SETUP KOLOM KARTU QR SELESAI ===');
  Logger.log('Ditambahkan: ' + (hasil.ditambahkan.join(', ') || '(tidak ada, semua sudah ada)'));
  Logger.log('Sudah ada sebelumnya: ' + (hasil.sudahAda.join(', ') || '(tidak ada)'));
  return hasil;
}

// ============================================================
// PENCARIAN RELAWAN BY TOKEN_KARTU
// ============================================================
/**
 * PERUBAHAN ARSITEKTUR PENTING -- TOLONG DIBACA:
 * Endpoint ini mengirim SELURUH daftar {TOKEN_KARTU, nama, id, divisi} ke
 * perangkat kios supaya scan terasa instan (lookup lokal, bukan ke server
 * tiap scan). Ini mengubah model keamanan kartu yang sudah disepakati
 * sebelumnya: TOKEN_KARTU awalnya SENGAJA dirahasiakan di server (supaya
 * kartu hilang/difoto orang lain tidak mudah disalahgunakan tanpa akses ke
 * sistem). Dengan endpoint ini, SELURUH token relawan AKTIF akan tersimpan
 * di localStorage perangkat kios.
 * KIOSK_API_KEY di bawah HANYA proteksi dasar (mencegah penemuan tidak
 * sengaja) -- BUKAN keamanan sungguhan, karena kunci ini ikut termuat di
 * kode JavaScript halaman kios yang bisa dilihat siapa pun yang membuka
 * "view source". Keamanan sebenarnya tetap bergantung pada: perangkat kios
 * fisik dipegang petugas tepercaya, dan TIDAK dipakai di jaringan publik
 * tanpa pengawasan.
 */
const KIOSK_API_KEY = 'GANTI_DENGAN_KUNCI_RAHASIA_ANDA_SENDIRI_YANG_PANJANG';

function getDaftarRingkasKiosk(body) {
  periksaAksesKiosk_(body);   // 4 Nov 2026: kioskKey statis DIGANTI token aplikasi + pemberian akses per relawan (AksesAplikasi.gs)
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const idx = akunHeaderIndex_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const hasil = [];
  for (let i = 0; i < data.length; i++) {
    const token = idx.TOKEN_KARTU !== undefined ? data[i][idx.TOKEN_KARTU] : '';
    const statusKartu = idx.STATUS_KARTU !== undefined ? String(data[i][idx.STATUS_KARTU] || '').toUpperCase() : '';
    const statusRelawan = idx.STATUS !== undefined ? String(data[i][idx.STATUS] || '').toUpperCase() : '';
    if (!token || statusKartu !== 'AKTIF' || statusRelawan !== 'AKTIF') continue;
    hasil.push({
      token: String(token),
      id: String(data[i][idx.ID_RELAWAN] || ''),
      nama: String(data[i][idx.NAMA_RELAWAN] || ''),
      divisi: String(data[i][idx.DIVISI] || '')
    });
  }
  return hasil;
}

function cariRelawanByTokenKartu_(tokenKartu) {
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const idx = akunHeaderIndex_(sheet);
  if (idx.TOKEN_KARTU === undefined) throw new Error('Kolom kartu QR belum disiapkan. Jalankan setupKolomKartuQr() dari Apps Script terlebih dahulu.');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.TOKEN_KARTU]) === tokenKartu) {
      return {
        idRelawan: String(data[i][idx.ID_RELAWAN]), nama: String(data[i][idx.NAMA_RELAWAN] || ''),
        divisi: String(data[i][idx.DIVISI] || ''), statusRelawan: String(data[i][idx.STATUS] || '').toUpperCase(),
        statusKartu: String(data[i][idx.STATUS_KARTU] || '').toUpperCase(), baris: i + 1, idx: idx, sheet: sheet
      };
    }
  }
  return null;
}

// ============================================================
// ENDPOINT UTAMA: SCAN QR
// ============================================================
/**
 * @param {Object} body { tokenKartu } -- SENGAJA field ini bernama
 *   'tokenKartu', BUKAN 'token', supaya tidak pernah tertukar konsep
 *   dengan token SESI LOGIN (requireAuthRelawan) yang dipakai di semua
 *   endpoint lain. Endpoint ini TIDAK memanggil requireAuthRelawan sama
 *   sekali -- identitas 100% berasal dari pencarian TOKEN_KARTU di server.
 */
function submitAbsensiQr(body) {
  // Perbaikan keamanan (18 Okt 2026, audit SIPRES QR diminta dokumen
  // Manajemen Hak Akses): SEBELUMNYA endpoint ini TIDAK memvalidasi
  // kioskKey sama sekali -- satu-satunya pelindung adalah tokenKartu
  // (UUID acak, memang praktis tak bisa ditebak), tapi kalau SATU token
  // bocor (kartu fisik hilang/difoto), bisa dipakai submit absensi dari
  // MANA SAJA tanpa perlu berada di kios. Sekarang WAJIB kioskKey jg --
  // pertahanan berlapis (token SAJA tidak lagi cukup).
  periksaAksesKiosk_(body);   // 4 Nov 2026: kioskKey statis DIGANTI token aplikasi + pemberian akses per relawan (AksesAplikasi.gs)
  const tokenKartu = sanitize(body.tokenKartu);
  const mode = String(body.mode || 'AUTO').trim().toUpperCase();
  if (!tokenKartu) throw new Error('Kode kartu tidak terbaca. Silakan scan ulang.');
  if (['AUTO', 'MASUK', 'PULANG'].indexOf(mode) === -1) throw new Error('Jenis absensi tidak valid.');

  // IDEMPOTENCY: body.idScan (UUID dibuat klien saat scan terjadi) -- kalau
  // ID ini SUDAH pernah diproses (retry dari antrean offline, atau request
  // terkirim dobel krn jaringan lambat), kembalikan hasil yang SAMA tanpa
  // memproses ulang. CATATAN JUJUR: logika di bawah ini SUDAH SECARA ALAMI
  // idempotent untuk kasus umum (cek status roster dulu sebelum menulis --
  // retry setelah sukses otomatis kena cabang SUDAH_MASUK/SUDAH_LENGKAP,
  // bukan nulis dobel). Cache 10 menit ini lapisan tambahan KHUSUS utk retry
  // yang terjadi HAMPIR BERSAMAAN (sebelum LockService sempat men-serialize
  // keduanya secara berurutan).
  const idScan = sanitize(body.idScan || '');
  const cacheIdempoten = idScan ? CacheService.getScriptCache() : null;
  const kunciIdempoten = idScan ? 'SIPRES_QR_IDEMPOTEN_' + idScan : null;
  if (cacheIdempoten) {
    const tersimpan = cacheIdempoten.get(kunciIdempoten);
    if (tersimpan) { try { return JSON.parse(tersimpan); } catch (_) {} }
  }
  const hasilAkhir = submitAbsensiQrInternal_(tokenKartu, mode);
  if (cacheIdempoten) cacheIdempoten.put(kunciIdempoten, JSON.stringify(hasilAkhir), 600);
  return hasilAkhir;
}

function submitAbsensiQrInternal_(tokenKartu, mode) {

  const relawanInfo = cariRelawanByTokenKartu_(tokenKartu);
  if (!relawanInfo) return { kode: KODE_HASIL_QR.KARTU_TIDAK_DIKENAL, pesan: 'Kartu tidak dikenali oleh sistem.' };
  if (relawanInfo.statusKartu !== 'AKTIF') return { kode: KODE_HASIL_QR.KARTU_NONAKTIF, nama: relawanInfo.nama, pesan: 'Kartu ini sudah dinonaktifkan.' };
  if (relawanInfo.statusRelawan !== 'AKTIF') return { kode: KODE_HASIL_QR.RELAWAN_NONAKTIF, nama: relawanInfo.nama, pesan: 'Status relawan ini sudah tidak aktif.' };

  const idRelawan = relawanInfo.idRelawan;
  const nama = relawanInfo.nama;
  const divisi = relawanInfo.divisi;

  // --- Mode eksplisit MASUK/PULANG dari petugas. AUTO tetap dipertahankan untuk kompatibilitas lama. ---
  const rosterBerjalan = cariRosterSedangBerjalan_(idRelawan);
  if (rosterBerjalan) {
    if (['IZIN', 'SAKIT', 'CUTI'].indexOf(String(rosterBerjalan.STATUS_KEHADIRAN).toUpperCase()) !== -1) {
      return { kode: KODE_HASIL_QR.IZIN_AKTIF, nama: nama, divisi: divisi, tanggal: rosterBerjalan.TANGGAL_OPERASIONAL, pesan: 'Operasional ' + rosterBerjalan.TANGGAL_OPERASIONAL + ' sudah tercatat ' + rosterBerjalan.STATUS_KEHADIRAN + '.' };
    }
    const menitSejakMasuk = hitungMenitSejakMasuk_(rosterBerjalan);
    if (mode === 'MASUK') {
      return { kode: KODE_HASIL_QR.SUDAH_MASUK, nama: nama, divisi: divisi, tanggal: rosterBerjalan.TANGGAL_OPERASIONAL, jamMasuk: rosterBerjalan.JAM_MASUK, pesan: 'Anda sudah tercatat Masuk untuk operasional ' + rosterBerjalan.TANGGAL_OPERASIONAL + ', pukul ' + rosterBerjalan.JAM_MASUK + '.' };
    }
    if (mode === 'PULANG' && (menitSejakMasuk === null || menitSejakMasuk < JEDA_MINIMUM_PULANG_QR_MENIT)) {
      return { kode: KODE_HASIL_QR.BELUM_BISA_PULANG, nama: nama, divisi: divisi, tanggal: rosterBerjalan.TANGGAL_OPERASIONAL, jamMasuk: rosterBerjalan.JAM_MASUK, pesan: 'Absensi Pulang belum dapat dilakukan. Absensi Masuk operasional ' + rosterBerjalan.TANGGAL_OPERASIONAL + ' baru tercatat pukul ' + rosterBerjalan.JAM_MASUK + '.' };
    }
    if (mode === 'PULANG' || mode === 'AUTO') return prosesAbsensiQrPulang_(rosterBerjalan, nama, divisi);
  }

  // --- Belum ada yang berjalan: mode PULANG tidak boleh mengubahnya menjadi MASUK ---
  if (mode === 'PULANG') {
    const terakhirPulang = cariRosterMasukTerakhir_(idRelawan);
    if (terakhirPulang && String(terakhirPulang.STATUS_PULANG || '') !== 'BELUM') {
      return { kode: KODE_HASIL_QR.SUDAH_LENGKAP, nama: nama, divisi: divisi, tanggal: terakhirPulang.TANGGAL_OPERASIONAL, jamMasuk: terakhirPulang.JAM_MASUK, jamPulang: terakhirPulang.JAM_PULANG, pesan: 'Absensi Masuk dan Pulang untuk operasional ' + terakhirPulang.TANGGAL_OPERASIONAL + ' sudah lengkap.' };
    }
    return { kode: KODE_HASIL_QR.BELUM_BISA_PULANG, nama: nama, divisi: divisi, tanggal: terakhirPulang ? terakhirPulang.TANGGAL_OPERASIONAL : '', pesan: 'Absensi Pulang belum dapat dilakukan karena Absensi Masuk belum tercatat.' };
  }

  // --- Belum ada yang berjalan: coba jalur Masuk (reuse 100% jendela existing) ---
  const sekarang = new Date();
  const pilihan = daftarRosterCheckIn_(idRelawan, sekarang);
  const rosterUntukMasuk = pilihan.aktif[0] || null;

  if (!rosterUntukMasuk) {
    if (pilihan.kadaluarsa.length) return { kode: KODE_HASIL_QR.DI_LUAR_JENDELA, nama: nama, divisi: divisi, pesan: 'Jadwal hari ini sudah lewat dan tercatat Tidak Hadir.' };
    // Bisa juga karena sudah Masuk+Pulang lengkap pada operasional terakhir -- cek dulu sebelum bilang "jadwal tidak ditemukan"
    const terakhir = cariRosterMasukTerakhir_(idRelawan);
    if (terakhir && terakhir.STATUS_PULANG !== 'BELUM') {
      return { kode: KODE_HASIL_QR.SUDAH_LENGKAP, nama: nama, divisi: divisi, jamMasuk: terakhir.JAM_MASUK, jamPulang: terakhir.JAM_PULANG, pesan: 'Presensi hari ini sudah lengkap.' };
    }
    if (['IZIN', 'SAKIT', 'CUTI'].indexOf(String((terakhir || {}).STATUS_KEHADIRAN).toUpperCase()) !== -1) {
      return { kode: KODE_HASIL_QR.IZIN_AKTIF, nama: nama, divisi: divisi, pesan: 'Tanggal ini sudah tercatat ' + terakhir.STATUS_KEHADIRAN + '.' };
    }
    return { kode: KODE_HASIL_QR.JADWAL_TIDAK_DITEMUKAN, nama: nama, divisi: divisi, pesan: 'Jadwal Anda tidak ditemukan. Hubungi Admin SPPG.' };
  }
  if (['IZIN', 'SAKIT', 'CUTI'].indexOf(String(rosterUntukMasuk.STATUS_KEHADIRAN).toUpperCase()) !== -1) {
    return { kode: KODE_HASIL_QR.IZIN_AKTIF, nama: nama, divisi: divisi, pesan: 'Tanggal ini sudah tercatat ' + rosterUntukMasuk.STATUS_KEHADIRAN + '.' };
  }
  try {
    cekJendelaBukaPresensi_(rosterUntukMasuk, sekarang);
  } catch (e) {
    return { kode: KODE_HASIL_QR.BELUM_WAKTUNYA, nama: nama, divisi: divisi, pesan: e.message };
  }
  return prosesAbsensiQrMasuk_(rosterUntukMasuk, nama, divisi);
}

/** Menit sejak JAM_MASUK aktual (parse TANGGAL_MASUK+JAM_MASUK dari baris roster). null kalau tidak bisa diparse (tidak dibatasi). */
function hitungMenitSejakMasuk_(roster) {
  const tgl = String(roster.TANGGAL_MASUK || '').split('/').map(Number);
  const jam = String(roster.JAM_MASUK || '').match(/(\d{1,2}):(\d{2})/);
  if (tgl.length !== 3 || tgl.some(isNaN) || !jam) return null;
  const waktuMasuk = new Date(tgl[2], tgl[1] - 1, tgl[0], Number(jam[1]), Number(jam[2]), 0);
  return Math.floor((new Date().getTime() - waktuMasuk.getTime()) / 60000);
}

// ============================================================
// PENULISAN ROSTER — khusus jalur QR (lihat catatan trade-off di header file)
// ============================================================
function prosesAbsensiQrMasuk_(roster, nama, divisi) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, terlalu banyak yang absen bersamaan. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    let baris = -1;
    for (let i = 1; i < data.length; i++) { if (String(data[i][idx.ID_ABSENSI]) === roster.ID_ABSENSI) { baris = i + 1; break; } }
    if (baris === -1) return { kode: KODE_HASIL_QR.JADWAL_TIDAK_DITEMUKAN, nama: nama, divisi: divisi, pesan: 'Jadwal Anda tidak ditemukan. Hubungi Admin SPPG.' };
    // Baca ulang status DI DALAM lock -- bisa saja berubah sejak pembacaan di luar lock (mis. jalur HP dipakai bersamaan).
    if (String(data[baris - 1][idx.STATUS_MASUK]) !== 'BELUM') {
      return { kode: KODE_HASIL_QR.SUDAH_MASUK, nama: nama, divisi: divisi, jamMasuk: String(data[baris - 1][idx.JAM_MASUK]), pesan: 'Sudah tercatat Masuk.' };
    }

    const now = new Date();
    const tanggalMasuk = formatTanggal(now);
    const jamMasuk = formatJam(now);
    const jamJadwalMasuk = roster.JAM_JADWAL_MASUK;
    let keterlambatanMenit = 0, statusMasuk = 'VALID';
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
    sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(now);
    paksaKolomTeks_(sheet, baris, idx.TANGGAL_MASUK + 1); sheet.getRange(baris, idx.TANGGAL_MASUK + 1).setValue(tanggalMasuk);
    paksaKolomTeks_(sheet, baris, idx.JAM_MASUK + 1); sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jamMasuk);

    _invalidasiCacheRosterV2_();
    _cacheAbsensiRows = null;
    logAudit_('CHECK_IN', 'ABSENSI', roster.ID_ABSENSI, roster.ID_RELAWAN, { jamMasuk: jamMasuk, sumber: 'SCANNER_QR' });
    if (statusMasuk === 'TERLAMBAT') kirimNotifikasiTerlambat_(roster.ID_RELAWAN, keterlambatanMenit);

    return {
      kode: KODE_HASIL_QR.BERHASIL_MASUK, nama: nama, divisi: divisi, jam: jamMasuk,
      tanggal: roster.TANGGAL_OPERASIONAL, statusMasuk: statusMasuk, keterlambatanMenit: keterlambatanMenit
    };
  } finally { lock.releaseLock(); }
}

function prosesAbsensiQrPulang_(roster, nama, divisi) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, terlalu banyak yang absen bersamaan. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    let baris = -1;
    for (let i = 1; i < data.length; i++) { if (String(data[i][idx.ID_ABSENSI]) === roster.ID_ABSENSI) { baris = i + 1; break; } }
    if (baris === -1) return { kode: KODE_HASIL_QR.JADWAL_TIDAK_DITEMUKAN, nama: nama, divisi: divisi, pesan: 'Jadwal Anda tidak ditemukan. Hubungi Admin SPPG.' };
    if (String(data[baris - 1][idx.STATUS_PULANG]) !== 'BELUM') {
      return {
        kode: KODE_HASIL_QR.SUDAH_LENGKAP, nama: nama, divisi: divisi,
        jamMasuk: String(data[baris - 1][idx.JAM_MASUK]), jamPulang: String(data[baris - 1][idx.JAM_PULANG]), pesan: 'Presensi hari ini sudah lengkap.'
      };
    }

    const now = new Date();
    const tanggalPulang = formatTanggal(now);
    const jamPulang = formatJam(now);

    sheet.getRange(baris, idx.TANGGAL_PULANG + 1).setValue(tanggalPulang);
    sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamPulang);
    sheet.getRange(baris, idx.STATUS_PULANG + 1).setValue('VALID');
    sheet.getRange(baris, idx.STATUS_KEHADIRAN + 1).setValue(String(data[baris - 1][idx.STATUS_MASUK]) === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR LENGKAP');
    sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(now);
    paksaKolomTeks_(sheet, baris, idx.TANGGAL_PULANG + 1); sheet.getRange(baris, idx.TANGGAL_PULANG + 1).setValue(tanggalPulang);
    paksaKolomTeks_(sheet, baris, idx.JAM_PULANG + 1); sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamPulang);

    _invalidasiCacheRosterV2_();
    _cacheAbsensiRows = null;
    logAudit_('CHECK_OUT', 'ABSENSI', roster.ID_ABSENSI, roster.ID_RELAWAN, { jamPulang: jamPulang, sumber: 'SCANNER_QR' });

    return { kode: KODE_HASIL_QR.BERHASIL_PULANG, nama: nama, divisi: divisi, jam: jamPulang, tanggal: roster.TANGGAL_OPERASIONAL };
  } finally { lock.releaseLock(); }
}

// ============================================================
// KIOS QR: DATA OPERASIONAL AKTIF
// ============================================================
/**
 * Mengambil tanggal operasional yang sedang menjadi acuan kios.
 * Aturan: sebelum 15:00 gunakan operasional hari ini jika ada;
 * mulai 15:00 gunakan operasional berikutnya. Sumber tetap kalender
 * operasional yang sudah tercermin pada 03_DATA_ABSENSI/roster.
 * Tidak memblokir kamera; endpoint ini hanya untuk informasi di kios.
 */
/**
 * AUDIT (disetujui, lihat laporan): versi sebelumnya fungsi ini MEMBACA
 * SELURUH kolom TANGGAL_OPERASIONAL/STATUS_OPERASIONAL di 03_DATA_ABSENSI
 * (tabel roster -- bisa jadi ribuan baris, satu per relawan per hari) DAN
 * menghitung ulang aturan "cutoff 15:00" sendiri dari nol. Ini melanggar
 * instruksi eksplisit "jangan menulis ulang aturan 15:00 secara hardcode,
 * reuse fungsi existing" -- dan berisiko: kalau aturan pergantian
 * operasional yang SEBENARNYA (per-shift, lihat JAM_MULAI_CEK_OPERASIONAL_BESOK
 * di AbsensiV2.gs) berbeda dari angka 15:00 yang ditulis ulang di sini,
 * Portal dan SIPRES QR bisa menampilkan tanggal operasional YANG BERBEDA
 * untuk kasus yang sama -- persis skenario yang harus dihindari.
 *
 * PERBAIKAN: pakai ULANG getStatusOperasionalHariIni() (Kalender.gs) --
 * fungsi yang SAMA yang sudah jadi acuan Dashboard Relawan selama ini,
 * membaca 15_KALENDER_OPERASIONAL (satu baris per TANGGAL KALENDER, bukan
 * per relawan -- jauh lebih kecil & lebih cepat dibaca daripada
 * 03_DATA_ABSENSI). TIDAK ADA aturan jam baru ditulis di file ini.
 *
 * CATATAN JUJUR soal cakupan: getStatusOperasionalHariIni() menjawab
 * "apakah HARI INI (tanggal kalender) operasional", TIDAK memprediksi
 * "sudah lewat jam sekian, tampilkan tanggal BESOK" -- karena aturan
 * pergantian shift lintas-tengah-malam itu SIFATNYA PER RELAWAN/PER SHIFT
 * (jam mulai shift beda-beda per relawan), bukan satu jam cutoff tunggal
 * untuk seluruh SPPG. Tidak ada satu "sumber kebenaran operasional"
 * tunggal yang relawan-independen selain kalender harian ini -- mencoba
 * menebak "operasional besok" tanpa tahu relawan mana yang di-scan
 * sebenarnya mengarang aturan baru, bukan reuse. Banner kios karena itu
 * menampilkan status HARI INI (match dgn yang Portal Relawan tampilkan),
 * dan tanggal operasional yang SEBENARNYA dipakai tetap ditentukan per
 * scan oleh submitAbsensiQr (yang memang sudah reuse roster relawan
 * ybs) -- sama seperti jalur HP.
 */
/** "01 Oktober 2026" -- Utilities.formatDate TIDAK punya parameter locale, jadi nama bulan disusun manual, bukan bergantung locale skrip. */
function formatTanggalIndonesiaQr_(tanggal, tz) {
  const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const dd = Utilities.formatDate(tanggal, tz, 'dd');
  const bulanIndex = Number(Utilities.formatDate(tanggal, tz, 'M')) - 1;
  const yyyy = Utilities.formatDate(tanggal, tz, 'yyyy');
  return dd + ' ' + namaBulan[bulanIndex] + ' ' + yyyy;
}

/**
 * Status Kalender utk TANGGAL TERTENTU -- logika klasifikasi IDENTIK dengan
 * getStatusOperasionalHariIni() (Kalender.gs, dipakai Dashboard Relawan):
 * sumber data sama (getKalenderRows_()), aturan sama (DIBATALKAN -> LIBUR,
 * "terbatas" di keterangan -> TERBATAS, fallback akhir pekan). Diduplikasi
 * seperlunya HANYA karena fungsi aslinya hardcode new Date() internal dan
 * tidak menerima parameter tanggal -- bukan aturan baru, aturan SAMA
 * diterapkan ke tanggal target yang berbeda.
 */
function getStatusKalenderUntukTanggalQr_(tanggalTarget) {
  const tglStr = formatTanggal(tanggalTarget);
  const hariMinggu = tanggalTarget.getDay();
  const entri = getKalenderRows_().find(k => k.TANGGAL_OPERASIONAL === tglStr);
  if (entri) {
    if (String(entri.STATUS).toUpperCase() === 'DIBATALKAN') {
      return { status: 'LIBUR', label: '🔴 LIBUR', keterangan: entri.KETERANGAN || '' };
    }
    const ketLower = String(entri.KETERANGAN || '').toLowerCase();
    if (ketLower.indexOf('terbatas') !== -1) {
      return { status: 'OPERASIONAL_TERBATAS', label: '🟡 OPERASIONAL TERBATAS', keterangan: entri.KETERANGAN };
    }
    return { status: 'OPERASIONAL', label: '🟢 OPERASIONAL', keterangan: entri.KETERANGAN || '' };
  }
  const isWeekend = (hariMinggu === 0 || hariMinggu === 6);
  return isWeekend
    ? { status: 'LIBUR', label: '🔴 LIBUR (akhir pekan)', keterangan: '' }
    : { status: 'OPERASIONAL', label: '🟢 OPERASIONAL', keterangan: '' };
}

function getOperasionalAktifQr(body) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'SIPRES_QR_OPERASIONAL_AKTIF_V4';
  const cached = cache.get(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch (_) {} }

  const tz = ZONA_WAKTU || Session.getScriptTimeZone() || 'Asia/Jakarta';
  const now = new Date();
  // REUSE konstanta global yang SUDAH ADA (Utils.gs, dipakai AbsensiV2.gs utk
  // jendela presensi per-shift) -- BUKAN angka baru yang ditulis khusus di sini.
  // Jam sekarang >= 16:00 -> kios menampilkan tanggal operasional BESOK,
  // konsisten dgn konvensi shift sore/malam yang sudah berlaku di sistem.
  const jamSekarang = Number(Utilities.formatDate(now, tz, 'H'));
  const tanggalTarget = new Date(now);
  if (jamSekarang >= JAM_MULAI_CEK_OPERASIONAL_BESOK) tanggalTarget.setDate(tanggalTarget.getDate() + 1);

  const status = getStatusKalenderUntukTanggalQr_(tanggalTarget);

  const aktif = status.status === 'OPERASIONAL' || status.status === 'OPERASIONAL_TERBATAS';
  const hasil = {
    kode: aktif ? 'OPERASIONAL_AKTIF' : 'OPERASIONAL_TIDAK_AKTIF',
    aktif: aktif,
    tanggal: formatTanggal(tanggalTarget),
    tanggalIso: Utilities.formatDate(tanggalTarget, tz, 'yyyy-MM-dd'),
    label: aktif ? ('Operasional ' + formatTanggalIndonesiaQr_(tanggalTarget, tz)) : status.label,
    statusKalender: status.status
  };
  // 15 detik: kios boleh lihat status yang sedikit basi (bukan detik-per-detik),
  // tapi TIDAK menyimpan lama-lama supaya perubahan Kalender oleh Admin cepat terlihat.
  cache.put(cacheKey, JSON.stringify(hasil), 15);
  return hasil;
}

// ============================================================
// ADMIN: KELOLA KARTU QR
// ============================================================
function getDaftarKartuAdmin(body) {
  requireAuth(body.token);
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const idx = akunHeaderIndex_(sheet);
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    list.push({
      id: String(data[i][idx.ID_RELAWAN]), nama: String(data[i][idx.NAMA_RELAWAN] || ''),
      divisi: String(data[i][idx.DIVISI] || ''), statusRelawan: String(data[i][idx.STATUS] || '').toUpperCase(),
      statusKartu: idx.STATUS_KARTU !== undefined && data[i][idx.STATUS_KARTU] ? String(data[i][idx.STATUS_KARTU]).toUpperCase() : 'BELUM_DIBUAT',
      punyaToken: idx.TOKEN_KARTU !== undefined && !!data[i][idx.TOKEN_KARTU]
    });
  }
  return list.sort((a, b) => a.nama.localeCompare(b.nama));
}

/** Generate (kartu belum pernah ada) ATAU Regenerate (sudah ada, token lama diganti) -- satu fungsi, karena secara teknis operasinya identik: timpa TOKEN_KARTU dengan nilai acak baru. */
function generateKartuAdmin(body) {
  const aktor = requireAuth(body.token);
  const idRelawan = sanitize(body.idRelawan);
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const idx = akunHeaderIndex_(sheet);
  if (idx.TOKEN_KARTU === undefined) throw new Error('Kolom kartu QR belum disiapkan. Jalankan setupKolomKartuQr() dari Apps Script terlebih dahulu.');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_RELAWAN]) === idRelawan) {
      const tokenBaru = Utilities.getUuid(); // sama persis pola salt password existing -- acak, praktis tak bisa ditebak
      const now = new Date();
      const sudahAda = !!data[i][idx.TOKEN_KARTU];
      sheet.getRange(i + 1, idx.TOKEN_KARTU + 1).setValue(tokenBaru);
      sheet.getRange(i + 1, idx.STATUS_KARTU + 1).setValue('AKTIF');
      if (!sudahAda) sheet.getRange(i + 1, idx.KARTU_DIBUAT_PADA + 1).setValue(now);
      sheet.getRange(i + 1, idx.KARTU_DIUBAH_PADA + 1).setValue(now);
      logAudit_(sudahAda ? 'REGENERATE_KARTU' : 'GENERATE_KARTU', 'KARTU_QR', idRelawan, aktor, {});
      return { idRelawan: idRelawan, tokenKartu: tokenBaru };
    }
  }
  throw new Error('Relawan tidak ditemukan.');
}

function setStatusKartuAdmin(body) {
  const aktor = requireAuth(body.token);
  const idRelawan = sanitize(body.idRelawan);
  const status = sanitize(body.status).toUpperCase();
  if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw new Error('Status tidak valid.');
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const idx = akunHeaderIndex_(sheet);
  if (idx.TOKEN_KARTU === undefined) throw new Error('Kolom kartu QR belum disiapkan. Jalankan setupKolomKartuQr() dari Apps Script terlebih dahulu.');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_RELAWAN]) === idRelawan) {
      if (!data[i][idx.TOKEN_KARTU]) throw new Error('Relawan ini belum punya kartu -- generate dulu.');
      sheet.getRange(i + 1, idx.STATUS_KARTU + 1).setValue(status);
      sheet.getRange(i + 1, idx.KARTU_DIUBAH_PADA + 1).setValue(new Date());
      logAudit_(status === 'AKTIF' ? 'AKTIFKAN_KARTU' : 'NONAKTIFKAN_KARTU', 'KARTU_QR', idRelawan, aktor, {});
      return { success: true };
    }
  }
  throw new Error('Relawan tidak ditemukan.');
}

/**
 * Data siap-cetak utk satu ATAU banyak relawan (dipakai halaman
 * preview/print Admin). Hanya baca, tidak mengubah token.
 * Diperbarui 23 Okt 2026 (dokumen Kartu Identitas Relawan §D/§E):
 * foto profil disertakan -- SUMBER SAMA dgn Profil Saya (kolom
 * FOTO_PROFIL di 01_DATA_RELAWAN, lihat Akun.gs simpanFotoProfilRelawan),
 * TIDAK ada penyimpanan/unggahan foto baru. URL dibentuk via
 * urlFotoReference_ (SUDAH ADA, Absensi.gs) -- fungsi yg SAMA dipakai
 * jalur foto profil lain, bukan logic baru.
 */
function getDataKartuCetakAdmin(body) {
  requireAuth(body.token);
  const daftarId = Array.isArray(body.idRelawanList) ? body.idRelawanList : [sanitize(body.idRelawan)];
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const idx = akunHeaderIndex_(sheet);
  const data = sheet.getDataRange().getValues();
  const hasil = [];
  daftarId.forEach(id => {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_RELAWAN]) === id) {
        const tokenKartu = idx.TOKEN_KARTU !== undefined ? data[i][idx.TOKEN_KARTU] : '';
        if (!tokenKartu) return; // belum punya kartu -- lewati, jangan gagalkan seluruh permintaan cetak-banyak
        const fotoId = idx.FOTO_PROFIL !== undefined ? data[i][idx.FOTO_PROFIL] : '';
        hasil.push({
          id: id, nama: String(data[i][idx.NAMA_RELAWAN] || ''),
          divisi: String(data[i][idx.DIVISI] || ''), tokenKartu: String(tokenKartu),
          statusRelawan: String(data[i][idx.STATUS] || '').toUpperCase(),
          fotoProfilUrl: fotoId ? urlFotoReference_(fotoId) : ''
        });
        break;
      }
    }
  });
  return hasil;
}

/**
 * BARU 23 Okt 2026 (dokumen Kartu Identitas Relawan §F/§G) -- versi
 * RELAWAN dari getDataKartuCetakAdmin. Identitas diambil dari SESI
 * (requireAuthRelawan), BUKAN dari parameter body -- relawan TIDAK
 * BISA minta kartu relawan lain lewat body.idRelawan walau dikirim
 * paksa, krn fungsi ini SAMA SEKALI tidak membaca field itu. Kalau
 * kartu belum dibuat Admin, kembalikan penanda eksplisit (BUKAN array
 * kosong yg ambigu dgn "sedang memuat") supaya frontend bisa tampilkan
 * pesan yg tepat tanpa Generate/Regenerate (relawan TIDAK berwenang).
 */
function getDataKartuCetakRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const idx = akunHeaderIndex_(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_RELAWAN]) === idRelawan) {
      const tokenKartu = idx.TOKEN_KARTU !== undefined ? data[i][idx.TOKEN_KARTU] : '';
      const statusKartu = idx.STATUS_KARTU !== undefined ? String(data[i][idx.STATUS_KARTU] || '').toUpperCase() : '';
      if (!tokenKartu || statusKartu !== 'AKTIF') {
        return { tersedia: false };
      }
      const fotoId = idx.FOTO_PROFIL !== undefined ? data[i][idx.FOTO_PROFIL] : '';
      return {
        tersedia: true,
        id: idRelawan, nama: String(data[i][idx.NAMA_RELAWAN] || ''),
        divisi: String(data[i][idx.DIVISI] || ''), tokenKartu: String(tokenKartu),
        statusRelawan: String(data[i][idx.STATUS] || '').toUpperCase(),
        fotoProfilUrl: fotoId ? urlFotoReference_(fotoId) : ''
      };
    }
  }
  throw new Error('Data relawan tidak ditemukan.');
}


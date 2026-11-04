/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * Shift.gs — Modul Shift per Divisi & Penugasan Khusus (BARU)
 *
 * Modul berdiri sendiri: 2 sheet baru (21-22), TIDAK menyentuh sheet lain.
 * SATU fungsi di file ini menyentuh Absensi.gs secara TIDAK LANGSUNG lewat
 * pemanggilan (resolveShiftUntukRelawan_), dan Absensi.gs sendiri diedit
 * minimal (lihat catatan "INTEGRASI SHIFT" di Absensi.gs) dengan fallback
 * wajib ke perilaku LAMA kalau data Shift belum diisi Admin.
 *
 * ==================================================================
 * WAJIB DISIAPKAN MANUAL sebelum modul ini berfungsi:
 * ==================================================================
 * 21_SHIFT_DIVISI
 * ID_SHIFT | ID_PERIODE | NAMA_DIVISI | JAM_MASUK | JAM_PULANG | KETERANGAN | DIBUAT_PADA
 *   -- 1 baris berlaku untuk SEMUA tanggal operasional dalam 1 Periode.
 *   -- NAMA_DIVISI dicocokkan LANGSUNG ke kolom DIVISI di 01_DATA_RELAWAN
 *      (sheet 02_DATA_DIVISI memang cuma berisi daftar nama, tidak ada ID
 *      terpisah -- lihat Relawan.gs:getDivisiList()).
 *
 * 22_PENUGASAN_KHUSUS
 * ID_PENUGASAN | ID_OPERASIONAL | ID_RELAWAN | JAM_MASUK | JAM_PULANG | CATATAN | DIBUAT_PADA
 *   -- override per relawan, per tanggal operasional spesifik.
 *
 * ==================================================================
 * PRIORITAS RESOLUSI (dipakai resolveShiftUntukRelawan_):
 *   1. Penugasan Khusus (relawan + tanggal operasional spesifik)
 *   2. Shift Divisi (divisi relawan + periode tanggal operasional itu)
 *   3. null -- pemanggil (Absensi.gs) WAJIB fallback ke aturan lama
 *      (JAM_MULAI_CEK_OPERASIONAL_BESOK / JAM_MASUK_STANDAR global)
 * ==================================================================
 */

function getShiftDivisiSheet() { return getSheet(NAMA_SHEET.SHIFT_DIVISI); }
function getPenugasanKhususSheet() { return getSheet(NAMA_SHEET.PENUGASAN_KHUSUS); }

/**
 * PERBAIKAN PERFORMA (audit timeout "Exceeded maximum execution time" pada
 * jalankanSemuaPengecekanNotifikasiOtomatis): resolveShiftUntukRelawan_
 * dipanggil di DALAM LOOP per-relawan oleh cekBelumAbsenDanKirimPush &
 * cekBelumAbsenPulangDanKirimPush (sampai 2x per relawan yang belum
 * absen/pulang). Sebelum ini, setiap panggilan membaca PENUH ulang sheet
 * 22_PENUGASAN_KHUSUS & 21_SHIFT_DIVISI dari awal (tidak ada memoisasi) --
 * untuk N relawan, itu artinya sampai puluhan/ratusan kali baca sheet yang
 * SAMA dalam satu eksekusi trigger, dan sheet Penugasan Khusus sendiri
 * makin besar sejak ada fitur "bulk" (1 divisi x 1 periode bisa bikin
 * puluhan baris sekaligus). Sekarang dibaca SEKALI per eksekusi, dipakai
 * ulang dari memori -- pola yang SAMA seperti getAbsensiRows_/
 * getKalenderRows_ yang sudah ada di modul lain.
 */
let _cachePenugasanKhususRows = null;
function getPenugasanKhususRows_() {
  if (_cachePenugasanKhususRows) return _cachePenugasanKhususRows;
  _cachePenugasanKhususRows = sheetToObjects(getPenugasanKhususSheet());
  return _cachePenugasanKhususRows;
}
function _invalidasiCachePenugasanKhusus_() { _cachePenugasanKhususRows = null; }

let _cacheShiftDivisiRows = null;
function getShiftDivisiRows_() {
  if (_cacheShiftDivisiRows) return _cacheShiftDivisiRows;
  _cacheShiftDivisiRows = sheetToObjects(getShiftDivisiSheet());
  return _cacheShiftDivisiRows;
}
function _invalidasiCacheShiftDivisi_() { _cacheShiftDivisiRows = null; }

// ------------------------------------------------------------
// RESOLUSI SHIFT — dipakai Absensi.gs, HARUS ringan & tahan-gagal
// (kalau sheet belum ada / kosong, kembalikan null, JANGAN throw,
// supaya absensi tidak ikut rusak kalau modul Shift belum disiapkan).
// ------------------------------------------------------------

/**
 * Mencari jam shift (masuk & pulang) untuk seorang relawan pada satu
 * entri operasional spesifik. Return null kalau tidak ada data Shift
 * SAMA SEKALI untuk kombinasi ini (pemanggil wajib fallback).
 * @param {string} idRelawan
 * @param {string} idOperasional  ID_OPERASIONAL dari 15_KALENDER_OPERASIONAL
 */
function resolveShiftUntukRelawan_(idRelawan, idOperasional, abaikanSakelar) {
  try {
    // 1) Penugasan Khusus (paling prioritas)
    const khusus = getPenugasanKhususRows_()
      .find(p => p.ID_OPERASIONAL === idOperasional && p.ID_RELAWAN === idRelawan);
    if (khusus && khusus.JAM_MASUK) {
      const hasilKhusus = { jamMasuk: String(khusus.JAM_MASUK), jamPulang: khusus.JAM_PULANG ? String(khusus.JAM_PULANG) : null, sumber: 'KHUSUS' };
      // 4 Nov 2026: baris hasil migrasi jadwal otomatis membawa shift malam & aturan tanggal (dibaca Roster.gs); baris lama tidak punya kolomnya -> perilaku lama.
      if (String(khusus.LINTAS_TENGAH_MALAM || '').toUpperCase() === 'YA') hasilKhusus.lintasTengahMalam = true;
      if (khusus.ATURAN_TANGGAL_ACUAN) hasilKhusus.aturanTanggalAcuan = String(khusus.ATURAN_TANGGAL_ACUAN);
      return hasilKhusus;
    }

    // 4 Nov 2026 (keputusan Admin): jadwal OTOMATIS per divisi dimatikan -- hanya penugasan per relawan (langkah 1) yang menentukan jadwal.
    // Sakelar JADWAL_OTOMATIS='TIDAK' diset oleh matikanJadwalOtomatis (MigrasiJadwal.gs) SETELAH semua jadwal otomatis dijadikan penugasan.
    if (!abaikanSakelar && jadwalOtomatisMati_()) return null;

    // 1.5) Multi-shift (Security/Pengolahan/Persiapan -- 18 Okt 2026,
    // lihat SikopMultiShift.gs). HANYA aktif utk divisi yg memang
    // dikonfigurasi di 35_SHIFT_DIVISI_DETAIL -- divisi lain melewati
    // ini (return null) dan lanjut ke langkah 2 (Shift Divisi lama, TIDAK
    // berubah sama sekali).
    const multiShift = resolveMultiShiftUntukRelawan_(idRelawan, idOperasional);
    if (multiShift) return multiShift;

    // 2) Shift Divisi (perlu tahu ID_PERIODE dari entri operasional, dan divisi relawan)
    const opRow = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasional);
    if (!opRow) return null;

    const relawan = getRelawanById(idRelawan);
    if (!relawan || !relawan.divisi) return null;

    const shift = getShiftDivisiRows_().find(s =>
      s.ID_PERIODE === opRow.ID_PERIODE && s.NAMA_DIVISI === relawan.divisi
    );
    if (shift && shift.JAM_MASUK) {
      return { jamMasuk: String(shift.JAM_MASUK), jamPulang: shift.JAM_PULANG ? String(shift.JAM_PULANG) : null, sumber: 'DIVISI' };
    }

    return null;
  } catch (err) {
    // Modul Shift belum disiapkan (sheet belum dibuat) atau error lain --
    // JANGAN sampai ini mematikan absensi. Pemanggil akan fallback.
    return null;
  }
}

/**
 * Dipakai tentukanOperasionalAktifHariIni_ (Absensi.gs) untuk tahu jam
 * berapa shift relawan ini MULAI pada entri operasional tertentu, dengan
 * toleransi datang awal (menit) supaya relawan yang datang sedikit lebih
 * cepat dari jam shift tetap tercatat ke operasional yang benar.
 * Return null kalau tidak ada data Shift (pemanggil fallback ke aturan lama).
 */
function jamMulaiShiftDenganToleransi_(idRelawan, idOperasional, toleransiMenit) {
  const shift = resolveShiftUntukRelawan_(idRelawan, idOperasional);
  if (!shift || !shift.jamMasuk) return null;
  const [h, m] = shift.jamMasuk.split(':').map(Number);
  const total = h * 60 + m - (toleransiMenit || 0);
  const totalAman = ((total % 1440) + 1440) % 1440; // jaga-jaga kalau toleransi bikin lewat tengah malam
  const hh = Math.floor(totalAman / 60);
  const mm = totalAman % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

/**
 * Versi shift-aware dari apakahTerlambat(): kalau relawan ini punya data
 * Shift (Penugasan Khusus atau Shift Divisi) untuk operasional yang
 * bersangkutan, bandingkan ke situ. Kalau tidak ada data Shift sama
 * sekali, otomatis fallback ke apakahTerlambat() lama (JAM_MASUK_STANDAR
 * global) -- perilaku persis seperti sebelum modul Shift ada.
 */
function apakahTerlambatShiftAware_(idRelawan, idOperasional, jamString) {
  if (idRelawan && idOperasional) {
    const shift = resolveShiftUntukRelawan_(idRelawan, idOperasional);
    if (shift && shift.jamMasuk) {
      return apakahTerlambatDenganBatas_(jamString, shift.jamMasuk);
    }
  }
  return apakahTerlambat(jamString);
}

/**
 * Menandai seberapa mepet pengajuan Izin/Sakit dibanding jam shift relawan
 * (Fase 4). BUKAN penolakan -- pengajuan tetap selalu diterima, ini
 * murni penanda buat Admin. Kalau modul Shift/data shift belum ada,
 * fallback ke JAM_MASUK_STANDAR global.
 *
 * CATATAN keterbatasan: perhitungan pakai jam-di-hari-yang-sama (belum
 * menghitung lintas tengah malam secara presisi) -- cukup akurat untuk
 * penanda "mepet/telat", tidak dipakai untuk keputusan otomatis apa pun.
 *
 * @return 'TEPAT_WAKTU' | 'MEPET' | 'TELAT'
 */
function statusKetepatanPengajuanIzin_(idRelawan, idOperasional) {
  let jamMasukShift = JAM_MASUK_STANDAR;
  if (typeof resolveShiftUntukRelawan_ === 'function') {
    try {
      const shift = resolveShiftUntukRelawan_(idRelawan, idOperasional);
      if (shift && shift.jamMasuk) jamMasukShift = shift.jamMasuk;
    } catch (e) { /* fallback ke JAM_MASUK_STANDAR di atas */ }
  }

  const jamSekarangStr = Utilities.formatDate(new Date(), ZONA_WAKTU, 'HH:mm');
  const [hNow, mNow] = jamSekarangStr.split(':').map(Number);
  const [hShift, mShift] = jamMasukShift.split(':').map(Number);
  const selisihMenit = (hShift * 60 + mShift) - (hNow * 60 + mNow);

  if (selisihMenit < 0) return 'TELAT';
  if (selisihMenit < BATAS_JAM_PENGAJUAN_IZIN_SEBELUM_SHIFT * 60) return 'MEPET';
  return 'TEPAT_WAKTU';
}

// ------------------------------------------------------------
// SHIFT DIVISI — CRUD (Admin)
// ------------------------------------------------------------

function getShiftDivisiListAdmin(idPeriode) {
  let list = getShiftDivisiRows_();
  if (idPeriode) list = list.filter(s => s.ID_PERIODE === idPeriode);
  return list.map(s => ({
    id: s.ID_SHIFT,
    idPeriode: s.ID_PERIODE,
    namaDivisi: s.NAMA_DIVISI,
    jamMasuk: s.JAM_MASUK,
    jamPulang: s.JAM_PULANG || '',
    keterangan: s.KETERANGAN || ''
  }));
}

function generateIdShift_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][0] || '').match(/^SFT(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'SFT' + String(max + 1).padStart(3, '0');
}

function addShiftDivisi(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'JADWAL_PENUGASAN', 'CREATE');
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);
  const jamMasuk = sanitize(body.jamMasuk);
  const jamPulang = sanitize(body.jamPulang);

  if (!idPeriode) throw new Error('Periode wajib dipilih.');
  if (!namaDivisi) throw new Error('Divisi wajib dipilih.');
  if (!/^\d{2}:\d{2}$/.test(jamMasuk)) throw new Error('Jam masuk wajib format HH:mm.');
  if (jamPulang && !/^\d{2}:\d{2}$/.test(jamPulang)) throw new Error('Jam pulang wajib format HH:mm.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada perubahan jadwal lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getShiftDivisiSheet();

    // Satu kombinasi (periode, divisi) cukup 1 baris -- kalau sudah ada, perbarui.
    const data = sheet.getDataRange().getValues();
    let hasil = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === idPeriode && String(data[i][2]) === namaDivisi) {
        sheet.getRange(i + 1, 4, 1, 3).setValues([[jamMasuk, jamPulang, sanitize(body.keterangan)]]);
        _invalidasiCacheShiftDivisi_();
        hasil = { id: data[i][0], diperbarui: true };
        break;
      }
    }
    if (!hasil) {
      const id = generateIdShift_(sheet);
      sheet.appendRow([id, idPeriode, namaDivisi, jamMasuk, jamPulang, sanitize(body.keterangan), new Date()]);
      _invalidasiCacheShiftDivisi_();
      hasil = { id: id, diperbarui: false };
    }

    // ROSTER-FIRST (§I, §G): begitu jam Shift Divisi utk 1 periode+divisi
    // tersimpan, bentuk roster utk SEMUA tanggal operasional periode itu
    // yang belum punya roster (idempotent -- lihat catatan keterbatasan di
    // Roster.gs soal baris yang SUDAH ada tidak diubah retroaktif).
    // Tetap di dalam lock yang sama -- mencegah 2 admin menyentuh Shift
    // Divisi utk kombinasi sama di saat berdekatan sekaligus mencegah
    // proses roster-generation saling tabrakan.
    try {
      getKalenderRows_().filter(k => k.ID_PERIODE === idPeriode).forEach(k => {
        buatRosterUntukOperasional_(k.ID_OPERASIONAL, akses);
      });
    } catch (e) { /* jangan gagalkan §AX */ }

    return hasil;
  } finally {
    lock.releaseLock();
  }
}

function deleteShiftDivisi(body) {
  requireIzinModulBaru_(requireAuth(body.token), 'JADWAL_PENUGASAN', 'DELETE');
  const id = sanitize(body.id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada perubahan jadwal lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getShiftDivisiSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) { sheet.deleteRow(i + 1); _invalidasiCacheShiftDivisi_(); return { success: true }; }
    }
    throw new Error('Data Shift tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// PENUGASAN KHUSUS — CRUD (Admin)
// ------------------------------------------------------------

function getPenugasanKhususListAdmin(idOperasional) {
  const namaMap = {};
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).forEach(r => { namaMap[r.ID_RELAWAN] = r.NAMA_RELAWAN; });

  let list = getPenugasanKhususRows_();
  if (idOperasional) list = list.filter(p => p.ID_OPERASIONAL === idOperasional);
  return list.map(p => ({
    id: p.ID_PENUGASAN,
    idOperasional: p.ID_OPERASIONAL,
    idRelawan: p.ID_RELAWAN,
    namaRelawan: namaMap[p.ID_RELAWAN] || p.ID_RELAWAN,
    jamMasuk: p.JAM_MASUK,
    jamPulang: p.JAM_PULANG || '',
    catatan: p.CATATAN || ''
  }));
}

function generateIdPenugasanKhusus_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][0] || '').match(/^PGK(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'PGK' + String(max + 1).padStart(3, '0');
}

function addPenugasanKhusus(body) {
  const akses = requireAuth(body.token);
  const idOperasional = sanitize(body.idOperasional);
  const idRelawan = sanitize(body.idRelawan);
  const jamMasuk = sanitize(body.jamMasuk);
  const jamPulang = sanitize(body.jamPulang);

  if (!idOperasional) throw new Error('Tanggal operasional wajib dipilih.');
  if (!idRelawan) throw new Error('Relawan wajib dipilih.');
  if (!/^\d{2}:\d{2}$/.test(jamMasuk)) throw new Error('Jam masuk wajib format HH:mm.');
  if (jamPulang && !/^\d{2}:\d{2}$/.test(jamPulang)) throw new Error('Jam pulang wajib format HH:mm.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada penugasan lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  let id;
  try {
    const sheet = getPenugasanKhususSheet();
    id = generateIdPenugasanKhusus_(sheet);
    var catatan = sanitize(body.catatan);
    sheet.appendRow([id, idOperasional, idRelawan, jamMasuk, jamPulang, catatan, new Date()]);
    _invalidasiCachePenugasanKhusus_();

    // ROSTER-FIRST (§H, §I): Penugasan Khusus mengalahkan Shift Divisi --
    // bentuk/perbarui roster utk kombinasi (operasional, relawan) ini.
    try { buatRosterUntukOperasional_(idOperasional, akses); } catch (e) { /* jangan gagalkan §AX */ }
  } finally {
    lock.releaseLock();
  }

  // PENUGASAN BARU -- push notification dipindah ke sini (dari Jadwal.gs
  // lama yang sekarang deprecated) sesuai konsolidasi sumber jadwal.
  // SENGAJA di LUAR lock -- panggilan notifikasi (bisa lambat/ke layanan
  // luar) tidak perlu menahan kunci tulis sheet lebih lama dari perlu.
  try {
    const opRow = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasional);
    const isi = (catatan || 'Penugasan khusus') + (opRow ? ' · ' + opRow.TANGGAL_OPERASIONAL : '') + ' · ' + jamMasuk + (jamPulang ? '-' + jamPulang : '');
    catatNotifikasi_('Penugasan', 'Penugasan Baru', isi, idRelawan);
    kirimPushNotifikasi_(idRelawan, 'Penugasan Baru', isi, { link: '/jadwal.html' });
  } catch (e) { /* push notif gagal -- jangan gagalkan pembuatan penugasan */ }

  return { id: id };
}

/**
 * Penugasan Khusus BULK — Admin bisa pilih 1 minggu (7 hari dari tanggal
 * mulai, BUKAN lagi 1 Periode penuh yang bisa 2+ minggu) dan/atau 1 Divisi
 * penuh (bukan cuma 1 relawan). Sesuai keputusan yang sudah disepakati
 * sebelumnya: "per Divisi" HANYA alat bantu input, BUKAN sumbu data baru
 * -- hasil akhirnya tetap satu baris per relawan per hari, persis seperti
 * addPenugasanKhusus tunggal, cuma dibuat sekaligus dalam SATU eksekusi
 * (bukan puluhan/ratusan panggilan HTTP terpisah dari frontend).
 *
 * Body: { token, idOperasional? | tanggalMulaiMinggu?, idRelawan? | namaDivisi?, jamMasuk, jamPulang, catatan }
 * (persis 1 dari 2 pilihan tanggal, persis 1 dari 2 pilihan relawan)
 *
 * Kalau kombinasi (idOperasional, idRelawan) SUDAH ADA baris-nya (mis.
 * bagian dari batch sebelumnya yang tumpang tindih), baris itu DIPERBARUI
 * (bukan ditambah baris baru) -- mencegah baris ganda yang bisa bikin
 * hasil ambigu di resolveShiftUntukRelawan_ (yang cuma mengambil baris
 * PERTAMA yang cocok).
 */
function addPenugasanKhususBulk(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'JADWAL_PENUGASAN', 'CREATE');
  const jamMasuk = sanitize(body.jamMasuk);
  const jamPulang = sanitize(body.jamPulang);
  const catatan = sanitize(body.catatan);
  if (!/^\d{2}:\d{2}$/.test(jamMasuk)) throw new Error('Jam masuk wajib format HH:mm.');
  if (jamPulang && !/^\d{2}:\d{2}$/.test(jamPulang)) throw new Error('Jam pulang wajib format HH:mm.');

  // ---- Daftar tanggal operasional: 1 hari, ATAU 1 minggu (7 hari) dari tanggal mulai ----
  // PERUBAHAN: dulu bulk bisa mencakup 1 Periode PENUH (bisa 2+ minggu
  // sekaligus, tergantung panjang periode) -- lalu dibatasi TEPAT 7
  // hari demi keamanan. DIKEMBALIKAN SEBAGIAN 24 Okt 2026 (diminta
  // Admin, demi kecepatan di tengah pemulihan data) -- kalau Admin
  // EKSPLISIT memilih Periode dari dropdown baru (bukan cuma isi
  // tanggal manual), frontend mengirim tanggalAkhirMinggu = tanggal
  // selesai periode itu, dan cakupan mengikuti periode PENUH, bukan
  // 7 hari. Kalau tanggalAkhirMinggu TIDAK dikirim (tanggal diisi
  // manual tanpa pilih periode, perilaku LAMA), tetap default 7 hari
  // spt sebelumnya -- supaya penugasan tanpa sengaja ke rentang luas
  // TETAP tidak mungkin terjadi tanpa Admin secara sadar pilih Periode.
  let daftarIdOperasional = [];
  if (body.tanggalMulaiMinggu) {
    const mulaiIso = sanitize(body.tanggalMulaiMinggu); // <input type="date"> -> sudah "yyyy-MM-dd"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mulaiIso)) throw new Error('Tanggal mulai minggu tidak valid.');
    const mulai = new Date(mulaiIso + 'T00:00:00');
    let akhir = new Date(mulai.getTime() + 6 * 86400000); // default: +6 hari = total 7 hari termasuk tanggal mulai
    const akhirIso = sanitize(body.tanggalAkhirMinggu);
    if (akhirIso && /^\d{4}-\d{2}-\d{2}$/.test(akhirIso)) {
      const akhirDariPeriode = new Date(akhirIso + 'T00:00:00');
      if (akhirDariPeriode.getTime() >= mulai.getTime()) akhir = akhirDariPeriode; // pakai tanggal akhir periode, BUKAN +6 hari
    }
    daftarIdOperasional = getKalenderRows_()
      .filter(k => {
        const iso = tanggalSheetKeIso_(k.TANGGAL_OPERASIONAL);
        if (!iso) return false;
        const t = new Date(iso + 'T00:00:00').getTime();
        return t >= mulai.getTime() && t <= akhir.getTime();
      })
      .map(k => k.ID_OPERASIONAL);
    if (!daftarIdOperasional.length) throw new Error('Tidak ada tanggal operasional pada rentang 1 minggu yang dipilih.');
  } else if (body.idOperasional) {
    daftarIdOperasional = [sanitize(body.idOperasional)];
  } else {
    throw new Error('Tanggal operasional atau Periode wajib dipilih.');
  }

  // ---- Daftar relawan: 1 relawan, ATAU semua anggota AKTIF 1 Divisi ----
  let daftarIdRelawan = [];
  if (body.namaDivisi) {
    daftarIdRelawan = getRelawanList(sanitize(body.namaDivisi), false).map(r => r.id);
    if (!daftarIdRelawan.length) throw new Error('Tidak ada relawan aktif pada divisi yang dipilih.');
  } else if (body.idRelawan) {
    daftarIdRelawan = [sanitize(body.idRelawan)];
  } else {
    throw new Error('Relawan atau Divisi wajib dipilih.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada penugasan lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  const semuaTarget = []; // { idOperasional, idRelawan } -- dipakai lagi utk notifikasi di LUAR lock
  let barisBaru;
  try {
    const sheet = getPenugasanKhususSheet();
    const data = sheet.getDataRange().getValues();

    // Peta baris yang SUDAH ADA (kunci "idOperasional|idRelawan" -> nomor baris sheet, 1-based).
    const barisAda = {};
    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      barisAda[data[i][1] + '|' + data[i][2]] = i + 1;
      const cocok = String(data[i][0] || '').match(/^PGK(\d+)$/i);
      if (cocok) maxId = Math.max(maxId, parseInt(cocok[1], 10));
    }

    barisBaru = [];
    daftarIdOperasional.forEach(idOp => {
      daftarIdRelawan.forEach(idRel => {
        semuaTarget.push({ idOperasional: idOp, idRelawan: idRel });
        const kunci = idOp + '|' + idRel;
        if (barisAda[kunci]) {
          // Sudah ada -- PERBARUI di tempat, bukan tambah baris baru.
          sheet.getRange(barisAda[kunci], 4, 1, 3).setValues([[jamMasuk, jamPulang, catatan]]);
        } else {
          maxId++;
          barisBaru.push(['PGK' + String(maxId).padStart(3, '0'), idOp, idRel, jamMasuk, jamPulang, catatan, new Date()]);
        }
      });
    });

    if (barisBaru.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, barisBaru.length, barisBaru[0].length).setValues(barisBaru);
    }
    _invalidasiCachePenugasanKhusus_();

    // ROSTER-FIRST (§H, §I) -- bentuk/perbarui roster utk SETIAP kombinasi
    // (operasional, relawan) yang baru saja ditugaskan/diperbarui lewat
    // bulk ini. Dedup ID_OPERASIONAL dulu supaya buatRosterUntukOperasional_
    // (yang memproses SEMUA relawan eligible sekaligus per operasional)
    // tidak dipanggil berulang tanpa perlu utk operasional yang sama.
    try {
      const idOperasionalUnik = Array.from(new Set(semuaTarget.map(t => t.idOperasional)));
      idOperasionalUnik.forEach(idOp => buatRosterUntukOperasional_(idOp, akses));
    } catch (e) { /* jangan gagalkan §AX */ }
  } finally {
    lock.releaseLock();
  }

  // Push notifikasi ke semua relawan target -- SENGAJA di LUAR lock (bisa
  // lambat, tidak perlu menahan kunci tulis sheet). Per-item try/catch
  // supaya 1 gagal kirim tidak menggagalkan penugasan lain yang sudah tersimpan.
  const kalenderMap = {};
  getKalenderRows_().forEach(k => { kalenderMap[k.ID_OPERASIONAL] = k.TANGGAL_OPERASIONAL; });
  semuaTarget.forEach(t => {
    try {
      const isi = (catatan || 'Penugasan khusus') + (kalenderMap[t.idOperasional] ? ' · ' + kalenderMap[t.idOperasional] : '') + ' · ' + jamMasuk + (jamPulang ? '-' + jamPulang : '');
      catatNotifikasi_('Penugasan', 'Penugasan Baru', isi, t.idRelawan);
      kirimPushNotifikasi_(t.idRelawan, 'Penugasan Baru', isi, { link: '/jadwal.html' });
    } catch (e) { /* jangan gagalkan target lain */ }
  });

  logAudit_('TAMBAH_PENUGASAN_KHUSUS_BULK', 'SHIFT', '', akses, {
    jumlahHari: daftarIdOperasional.length, jumlahRelawan: daftarIdRelawan.length, jumlahBaris: semuaTarget.length
  });
  return { success: true, jumlah: semuaTarget.length, jumlahBaru: barisBaru.length, jumlahDiperbarui: semuaTarget.length - barisBaru.length };
}

function deletePenugasanKhusus(body) {
  requireIzinModulBaru_(requireAuth(body.token), 'JADWAL_PENUGASAN', 'DELETE');
  const id = sanitize(body.id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada perubahan penugasan lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getPenugasanKhususSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) { sheet.deleteRow(i + 1); _invalidasiCachePenugasanKhusus_(); return { success: true }; }
    }
    throw new Error('Penugasan khusus tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// KOREKSI TANGGAL OPERASIONAL (tombol permanen, Admin)
// Dipakai kalau ada baris di 03_DATA_ABSENSI yang salah "menempel" ke
// tanggal operasional yang keliru (mis. kasus shift lintas tengah malam
// sebelum modul Shift terisi lengkap). TIDAK mengubah TIMESTAMP asli,
// TIDAK mengubah JAM -- hanya kolom TANGGAL & ID_OPERASIONAL.
// ------------------------------------------------------------

/** Cari baris absensi seorang relawan pada tanggal presensi aktual tertentu (untuk dipilih di UI koreksi). */
/** ROSTER-FIRST: 1 relawan + 1 tanggal operasional = 1 baris (bukan lagi MASUK/PULANG terpisah). Dikembalikan berbasis ID_ABSENSI. */
function cariAbsensiUntukKoreksi(token, idRelawan, tanggalPresensi) {
  requireAuth(token);
  idRelawan = sanitize(idRelawan);
  tanggalPresensi = sanitize(tanggalPresensi);

  return getRosterV2Rows_()
    .filter(a => a.ID_ABSENSI && a.ID_RELAWAN === idRelawan && a.TANGGAL_OPERASIONAL === tanggalPresensi)
    .map(a => ({
      idAbsensi: a.ID_ABSENSI,
      nama: a.NAMA_RELAWAN,
      idOperasionalSaatIni: a.ID_OPERASIONAL,
      tanggalOperasionalSaatIni: a.TANGGAL_OPERASIONAL,
      jamMasuk: a.JAM_MASUK || null,
      jamPulang: a.JAM_PULANG || null,
      status: a.STATUS_KEHADIRAN
    }));
}

/**
 * Koreksi manual (ROSTER-FIRST): pindahkan 1 baris roster ke
 * ID_OPERASIONAL yang benar. JAM_MASUK/JAM_PULANG asli TIDAK disentuh --
 * ini murni memindahkan baris ke "operasional" yang seharusnya, bukan
 * mengubah kapan relawan sebenarnya absen. Karena ID_ABSENSI diturunkan
 * dari (ID_OPERASIONAL, ID_RELAWAN), ID_ABSENSI ikut diperbarui supaya
 * tetap konsisten dgn isinya sendiri.
 */
function koreksiTanggalOperasionalAbsensi(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'SIPRES', 'EDIT');
  const idAbsensiLama = sanitize(body.idAbsensi);
  const idOperasionalBaru = sanitize(body.idOperasionalBaru);
  if (!idAbsensiLama || !idOperasionalBaru) throw new Error('Data koreksi tidak lengkap.');

  const opBaru = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasionalBaru);
  if (!opBaru) throw new Error('Entri operasional tujuan tidak ditemukan.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada koreksi lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_ABSENSI]) === idAbsensiLama) {
        const idRelawan = String(data[i][idx.ID_RELAWAN]);
        const idAbsensiBaru = buatIdAbsensiV2_(idOperasionalBaru, idRelawan);
        // Cegah tabrakan -- kalau baris tujuan (operasional baru utk relawan
        // yang sama) SUDAH ADA, jangan timpa diam-diam.
        const sudahAdaTujuan = data.some((r, j) => j > 0 && j !== i && String(r[idx.ID_ABSENSI]) === idAbsensiBaru);
        if (sudahAdaTujuan) throw new Error('Relawan ini sudah punya baris presensi pada operasional tujuan. Batalkan dulu salah satunya sebelum memindahkan.');

        const baris = i + 1;
        sheet.getRange(baris, idx.ID_ABSENSI + 1).setValue(idAbsensiBaru);
        sheet.getRange(baris, idx.ID_PERIODE + 1).setValue(opBaru.ID_PERIODE);
        sheet.getRange(baris, idx.ID_OPERASIONAL + 1).setValue(idOperasionalBaru);
        sheet.getRange(baris, idx.HARI_OPERASIONAL + 1).setValue(opBaru.HARI);
        sheet.getRange(baris, idx.TANGGAL_OPERASIONAL + 1).setValue(opBaru.TANGGAL_OPERASIONAL);
        paksaKolomTeks_(sheet, baris, idx.TANGGAL_OPERASIONAL + 1);
        sheet.getRange(baris, idx.TANGGAL_OPERASIONAL + 1).setValue(opBaru.TANGGAL_OPERASIONAL);
        sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(new Date());

        _invalidasiCacheRosterV2_();
        logAudit_('KOREKSI_OPERASIONAL_ABSENSI', 'ABSENSI', idAbsensiBaru, akses, { dari: idAbsensiLama, ke: idAbsensiBaru, idOperasionalBaru: idOperasionalBaru });
        return { success: true, idAbsensiBaru: idAbsensiBaru, tanggalBaru: opBaru.TANGGAL_OPERASIONAL };
      }
    }
    throw new Error('Baris absensi yang sesuai tidak ditemukan (mungkin sudah dikoreksi sebelumnya).');
  } finally {
    lock.releaseLock();
  }
}

/**
 * KOREKSI MANUAL -- tandai relawan HADIR untuk 1 baris roster yang
 * STATUS_MASUK-nya masih 'BELUM' (relawan hadir di lapangan tapi gagal/
 * tidak sempat scan -- kendala HP, kartu rusak, dll). Dipakai lewat
 * 'Koreksi Tanggal' (cari dgn cariAbsensiUntukKoreksi, lalu panggil ini
 * dgn idAbsensi hasilnya) -- BUKAN fungsi terpisah, supaya petugas cuma
 * perlu satu tempat utk urusan koreksi presensi.
 *
 * SENGAJA TIDAK diizinkan menimpa baris yang SUDAH punya JAM_MASUK --
 * itu scan sungguhan, mengubahnya diam-diam lewat jalur ini berisiko
 * menutupi kesalahan scan asli. Kalau jam/statusnya memang perlu diubah,
 * itu kasus berbeda, bukan "tandai hadir manual".
 *
 * Jam Masuk/Pulang diisi dari JAM_JADWAL_MASUK/PULANG baris roster itu
 * sendiri (bukan dikarang) -- satu-satunya sumber waktu yang masuk akal
 * tersedia untuk kehadiran yang tidak sempat tercatat otomatis.
 * KETERANGAN WAJIB diisi -- ini memengaruhi REKAP PENGGAJIAN (lihat
 * MasterTarif.gs), jadi perlu alasan yang tercatat jelas utk audit,
 * bukan sekadar klik tanpa jejak.
 */
function tandaiHadirManual(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'SIPRES', 'EDIT');
  const idAbsensi = sanitize(body.idAbsensi);
  const keterangan = sanitize(body.keterangan);
  if (!idAbsensi) throw new Error('ID_ABSENSI wajib diisi.');
  if (!keterangan) throw new Error('Keterangan/alasan koreksi wajib diisi (akan tercatat untuk audit, memengaruhi rekap penggajian).');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada koreksi lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_ABSENSI]) !== idAbsensi) continue;
      const baris = i + 1;
      if (String(data[i][idx.STATUS_MASUK]) !== 'BELUM') {
        throw new Error('Baris ini sudah punya catatan Masuk (hasil scan sungguhan) -- tidak bisa ditimpa lewat Tandai Hadir Manual. Gunakan Koreksi Tanggal kalau yang perlu diperbaiki cuma operasionalnya.');
      }

      const jamJadwalMasuk = String(data[i][idx.JAM_JADWAL_MASUK] || '08:00');
      const jamJadwalPulang = String(data[i][idx.JAM_JADWAL_PULANG] || '16:00');
      const tglOperasional = String(data[i][idx.TANGGAL_OPERASIONAL]);
      const now = new Date();
      // Konsisten dgn perbaikan di JadwalIndividu.gs (koreksiAbsensiAktual):
      // KETERANGAN sheet = teks alasan apa adanya, siapa/kapan sudah
      // tercatat independen lewat logAudit_() (parameter akses + WAKTU
      // otomatis) -- tidak perlu diulang sbg prefix di kolom Catatan.

      sheet.getRange(baris, idx.TANGGAL_MASUK + 1).setValue(tglOperasional);
      paksaKolomTeks_(sheet, baris, idx.TANGGAL_MASUK + 1);
      sheet.getRange(baris, idx.TANGGAL_MASUK + 1).setValue(tglOperasional);
      sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jamJadwalMasuk);
      paksaKolomTeks_(sheet, baris, idx.JAM_MASUK + 1);
      sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jamJadwalMasuk);
      sheet.getRange(baris, idx.STATUS_MASUK + 1).setValue('HADIR');

      sheet.getRange(baris, idx.TANGGAL_PULANG + 1).setValue(tglOperasional);
      paksaKolomTeks_(sheet, baris, idx.TANGGAL_PULANG + 1);
      sheet.getRange(baris, idx.TANGGAL_PULANG + 1).setValue(tglOperasional);
      sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamJadwalPulang);
      paksaKolomTeks_(sheet, baris, idx.JAM_PULANG + 1);
      sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamJadwalPulang);
      sheet.getRange(baris, idx.STATUS_PULANG + 1).setValue('VALID');

      sheet.getRange(baris, idx.STATUS_KEHADIRAN + 1).setValue('HADIR LENGKAP');
      sheet.getRange(baris, idx.KETERANGAN + 1).setValue(keterangan);
      sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(now);

      _invalidasiCacheRosterV2_();
      logAudit_('TANDAI_HADIR_MANUAL', 'ABSENSI', idAbsensi, akses, { tanggalOperasional: tglOperasional, keterangan: keterangan });
      return { success: true, idAbsensi: idAbsensi, tanggalOperasional: tglOperasional };
    }
    throw new Error('Baris absensi tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hapus 1 baris presensi (ROSTER-FIRST -- 1 baris = seluruh presensi
 * relawan itu utk 1 operasional, bukan hanya Masuk ATAU Pulang) yang
 * keliru/data test. Dicari lewat ID_ABSENSI (pasti unik, lihat
 * cariAbsensiUntukKoreksi utk mendapatkan ID-nya dulu).
 *
 * TIDAK menghapus foto di Google Drive -- dibiarkan saja, tidak ada
 * risiko apa pun kalau foto itu jadi tidak terpakai.
 */
function hapusAbsensi(body) {
  const akses = requireAuth(body.token);
  const idAbsensi = sanitize(body.idAbsensi);
  if (!idAbsensi) throw new Error('ID_ABSENSI wajib diisi.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada perubahan presensi lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_ABSENSI]) === idAbsensi) {
        sheet.deleteRow(i + 1);
        _invalidasiCacheRosterV2_();
        logAudit_('HAPUS_ABSENSI', 'ABSENSI', idAbsensi, akses, {});
        return { success: true };
      }
    }
    throw new Error('Baris absensi yang sesuai tidak ditemukan (mungkin sudah dihapus sebelumnya).');
  } finally {
    lock.releaseLock();
  }
}

/**
 * "JADWAL SAYA" — SATU SUMBER KEBENARAN dari Shift & Koreksi (BUKAN dari
 * 10_JADWAL/Jadwal.gs lagi, sesuai instruksi konsolidasi). Menu yang
 * ditampilkan ke pengguna tetap bernama "Jadwal & Penugasan" -- ini murni
 * perubahan SUMBER DATA di baliknya.
 *
 * Menggabungkan:
 *   - Status Operasional hari ini (LIBUR -> jadwal = "Libur", tidak perlu
 *     cek shift sama sekali)
 *   - resolveShiftUntukRelawan_ (SUDAH ADA) untuk jam masuk/pulang
 *   - CATATAN dari Penugasan Khusus sebagai deskripsi tugas (kalau sumber
 *     KHUSUS) -- field ini yang paling dekat menggantikan "Penugasan"
 *     bebas teks dari sistem manual lama
 *   - Status absensi AKTUAL hari itu untuk tentukan Terjadwal/Sedang
 *     Bertugas/Selesai
 */
function getJadwalSayaHariIni(token) {
  const idRelawan = requireAuthRelawan(token);
  return getJadwalSayaHariIni_(idRelawan);
}

/** Versi internal (idRelawan langsung) -- diekstrak sama seperti getStatusAbsensiRelawan_ di atas, alasan sama. */
function getJadwalSayaHariIni_(idRelawan) {
  const statusOp = getStatusOperasionalHariIni();

  if (statusOp.status === 'LIBUR') {
    return { ada: true, waktu: '', penugasan: 'Libur', status: 'Libur' };
  }

  // ROSTER-FIRST: cari langsung baris roster relawan ini utk HARI INI
  // (tanggal kalender, bukan tebakan operasional-aktif) -- lebih akurat
  // drpd tentukanOperasionalAktifHariIni_ yang sudah deprecated.
  const hariIni = formatTanggal(new Date());
  const roster = getRosterV2Rows_().find(r => r.ID_ABSENSI && r.ID_RELAWAN === idRelawan && r.TANGGAL_OPERASIONAL === hariIni);
  if (!roster) return { ada: false };

  const relawan = getRelawanById(idRelawan);
  let penugasan = roster.NAMA_SHIFT === 'Penugasan Khusus'
    ? (getPenugasanKhususRows_().find(p => p.ID_OPERASIONAL === roster.ID_OPERASIONAL && p.ID_RELAWAN === idRelawan) || {}).CATATAN || 'Penugasan Khusus'
    : (relawan ? relawan.divisi : 'Tugas Umum');

  const waktu = roster.JAM_JADWAL_MASUK ? (roster.JAM_JADWAL_MASUK + (roster.JAM_JADWAL_PULANG ? ' – ' + roster.JAM_JADWAL_PULANG : '')) : '';

  let status = 'Terjadwal';
  if (roster.STATUS_MASUK !== 'BELUM' && roster.STATUS_PULANG !== 'BELUM') status = 'Selesai';
  else if (roster.STATUS_MASUK !== 'BELUM') status = 'Sedang Bertugas';

  return { ada: true, waktu: waktu, penugasan: penugasan, status: status };
}


/**
 * SikopMultiShift.gs — Fondasi multi-shift per divisi (Security,
 * Pengolahan, Persiapan), disetujui Admin setelah audit menyeluruh
 * (18 Okt 2026, lihat PROMPT IMPLEMENTASI FINAL SIKOP). File BARU,
 * terpisah dari Shift.gs/Roster.gs lama -- TIDAK mengubah fungsi yang
 * sudah berjalan, cuma MENAMBAH satu titik sambungan di
 * resolveShiftUntukRelawan_ (Shift.gs).
 *
 * KEPUTUSAN FONDASI (temuan audit, didokumentasikan): sistem lama HANYA
 * mendukung 1 jam-masuk/pulang per (periode, divisi) -- addShiftDivisi
 * TIDAK punya konsep "Shift 1/Shift 2" sama sekali. 3 sheet ADDITIF di
 * bawah ini MENAMBAH kemampuan itu tanpa mengubah struktur lama:
 *
 *   35_SHIFT_DIVISI_DETAIL   -- pola shift (berapa shift, jam berapa,
 *                                rotasi atau tetap, hari khusus) PER
 *                                (periode, divisi). Divisi yg TIDAK
 *                                punya baris di sini tetap memakai
 *                                mekanisme lama (addShiftDivisi, 1
 *                                shift) apa adanya.
 *   36_KELOMPOK_ROTASI_RELAWAN -- relawan mana di Kelompok A/B, utk
 *                                divisi yg rotasinya MINGGUAN.
 *   37_OVERRIDE_SHIFT_TANGGAL -- pengecualian PER TANGGAL (kasus
 *                                Persiapan: tanggal tertentu jadi 2
 *                                shift, tanggal lain tetap 1 shift).
 */

const SHIFT_DIVISI_DETAIL_SHEET_NAME = '35_SHIFT_DIVISI_DETAIL';
const KELOMPOK_ROTASI_SHEET_NAME = '36_KELOMPOK_ROTASI_RELAWAN';
const OVERRIDE_SHIFT_TANGGAL_SHEET_NAME = '37_OVERRIDE_SHIFT_TANGGAL';

function getShiftDivisiDetailSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHIFT_DIVISI_DETAIL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHIFT_DIVISI_DETAIL_SHEET_NAME);
    // NOMOR_SHIFT: 1 atau 2. LINTAS_TENGAH_MALAM: TRUE kalau jam pulang
    // ada di tanggal BERIKUTNYA (Security Shift 2). POLA_ROTASI: 'TETAP'
    // (shift tidak pernah bertukar, mis. Security kalau rotasinya cuma
    // per-individu bukan per-kelompok) atau 'MINGGUAN' (Kelompok A/B
    // bertukar shift tiap minggu, lihat 36_KELOMPOK_ROTASI_RELAWAN).
    // HARI_KHUSUS: nama hari (mis. "JUMAT") di mana SEMUA shift
    // digabung jadi 1 jam masuk-bersama -- kosong kalau divisi ini
    // tidak punya pengecualian hari tertentu.
    // ATURAN_TANGGAL_ACUAN ditambahkan 22 Okt 2026 (diminta Admin:
    // "aturan Hadir dihitung dari jam masuk atau di hari berikutnya...
    // tiap divisi bisa pilih"). Nilai: 'MULAI_SHIFT' (default, SAMA
    // dgn perilaku lama) atau 'HARI_BERIKUTNYA'. HANYA memengaruhi
    // TANGGAL_OPERASIONAL yg ditulis ke roster (dipakai laporan/rekap)
    // -- ID_OPERASIONAL (dipakai pencocokan QR SIPRES) SENGAJA TIDAK
    // ikut berubah, supaya integrasi absensi yg sudah berjalan aman.
    sheet.appendRow(['ID_DETAIL', 'ID_PERIODE', 'NAMA_DIVISI', 'NOMOR_SHIFT', 'JAM_MASUK', 'JAM_PULANG', 'LINTAS_TENGAH_MALAM', 'POLA_ROTASI', 'HARI_KHUSUS', 'JAM_MASUK_HARI_KHUSUS', 'JAM_PULANG_HARI_KHUSUS', 'DIBUAT_OLEH', 'DIBUAT_PADA', 'ATURAN_TANGGAL_ACUAN']);
  } else {
    // Pengaman migrasi (22 Okt 2026): sheet ini mungkin sudah dibuat
    // SEBELUM kolom ATURAN_TANGGAL_ACUAN ada (header lama cuma 13
    // kolom). Tambahkan kalau belum ada -- sama pola dgn
    // tambahKolomJikaBelumAda_ (SetupKolomProfil.gs), diinline di sini
    // krn fungsi itu pakai getSheet(nama) sedang di sini sheet-nya
    // SUDAH di tangan.
    const headerSekarang = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(h => String(h).trim());
    if (headerSekarang.indexOf('ATURAN_TANGGAL_ACUAN') === -1) {
      sheet.getRange(1, headerSekarang.length + 1).setValue('ATURAN_TANGGAL_ACUAN');
    }
  }
  return sheet;
}

// ============================================================
// CACHE PER-EKSEKUSI -- BARU 25 Okt 2026 (perbaikan performa, akar
// masalah timeout/lambat saat Pembuatan Jadwal). SEBELUMNYA,
// resolveMultiShiftUntukRelawan_ memanggil sheetToObjects(getXxxSheet_())
// LANGSUNG tiap kali dipanggil -- fungsi itu dipanggil SEKALI PER
// RELAWAN PER TANGGAL OPERASIONAL (nested loop di Roster.gs), jadi utk
// 150 relawan x 10 tanggal = 1500 kali pemanggilan, SETIAP KALI baca
// ulang 3 sheet dari API Google Sheets dari NOL -- bisa 3000+ panggilan
// API dalam SATU eksekusi, itulah penyebab timeout 6 menit. Pola cache
// di bawah SAMA PERSIS dgn getRosterV2Rows_/getKalenderRows_ (Roster.gs/
// modul lain) yg SUDAH terbukti aman dipakai produksi: baca SEKALI per
// eksekusi script, simpan di variabel global, pemanggilan berikutnya
// pakai yg sudah di-cache. Variabel global Apps Script OTOMATIS reset
// tiap eksekusi baru (tiap request HTTP terpisah) -- TIDAK ada risiko
// data basi antar-request, cuma MENGHEMAT pembacaan ULANG dalam SATU
// proses yang sama.
let _cacheShiftDivisiDetailRows = null;
function getShiftDivisiDetailRowsCached_() {
  if (!_cacheShiftDivisiDetailRows) _cacheShiftDivisiDetailRows = sheetToObjects(getShiftDivisiDetailSheet_());
  return _cacheShiftDivisiDetailRows;
}
let _cacheKelompokRotasiRows = null;
function getKelompokRotasiRowsCached_() {
  if (!_cacheKelompokRotasiRows) _cacheKelompokRotasiRows = sheetToObjects(getKelompokRotasiSheet_());
  return _cacheKelompokRotasiRows;
}
let _cacheOverrideShiftTanggalRows = null;
function getOverrideShiftTanggalRowsCached_() {
  if (!_cacheOverrideShiftTanggalRows) _cacheOverrideShiftTanggalRows = sheetToObjects(getOverrideShiftTanggalSheet_());
  return _cacheOverrideShiftTanggalRows;
}
/** Dipanggil setelah simpan/hapus ke 3 sheet di atas, DALAM eksekusi yg sama (jaga-jaga defensif -- lihat pemanggilan di fungsi CRUD di bawah). */
function _invalidasiCacheMultiShift_() {
  _cacheShiftDivisiDetailRows = null; _cacheKelompokRotasiRows = null; _cacheOverrideShiftTanggalRows = null;
}

function getKelompokRotasiSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(KELOMPOK_ROTASI_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(KELOMPOK_ROTASI_SHEET_NAME);
    // KELOMPOK: 'A' atau 'B'. Minggu 1: Kelompok A di NOMOR_SHIFT yg
    // tertulis di sini sbg SHIFT_MINGGU_1; Minggu 2 otomatis TERBALIK
    // (bukan disimpan dobel -- dihitung saat resolusi, lihat fungsi di
    // bawah) -- sesuai dokumen "Shift 1 & Shift 2 bertukar tiap minggu".
    sheet.appendRow(['ID_KELOMPOK', 'ID_PERIODE', 'NAMA_DIVISI', 'ID_RELAWAN', 'KELOMPOK', 'SHIFT_MINGGU_1', 'DIBUAT_OLEH', 'DIBUAT_PADA']);
  }
  return sheet;
}

// ============================================================
// PENETAPAN JADWAL RESMI (18 Okt 2026, SIKOP) -- status per divisi +
// snapshot versi resmi SUNGGUHAN (disetujui Admin: bukan penanda
// status saja, data benar-benar disalin ke sheet terpisah).
// ============================================================
const STATUS_PENETAPAN_SHEET_NAME = '38_STATUS_PENETAPAN_DIVISI';
const VERSI_RESMI_SHEET_NAME = '39_VERSI_RESMI_JADWAL';

function getStatusPenetapanSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(STATUS_PENETAPAN_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(STATUS_PENETAPAN_SHEET_NAME);
    // STATUS: DRAFT | PERLU_PERBAIKAN | SIAP_DITETAPKAN | DITETAPKAN.
    // STATUS_SINKRONISASI: '' (blm pernah ditetapkan) | MENUNGGU |
    // TERSINKRON | GAGAL -- TERPISAH dari STATUS (sesuai dokumen §13
    // "pisahkan status penetapan dari status sinkronisasi").
    sheet.appendRow(['ID_STATUS', 'ID_PERIODE', 'NAMA_DIVISI', 'STATUS', 'VERSI_AKTIF', 'STATUS_SINKRONISASI', 'DIUBAH_PADA']);
  }
  return sheet;
}

function getVersiResmiSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(VERSI_RESMI_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(VERSI_RESMI_SHEET_NAME);
    // DATA_JADWAL_JSON: snapshot SUNGGUHAN (bukan referensi/pointer) --
    // array JSON berisi seluruh baris roster (periode, divisi) pada
    // saat ditetapkan: tanggal, relawan, shift, jam. Ini yg membuatnya
    // "versi resmi tersimpan sendiri" sesuai permintaan Admin, bukan
    // cuma status di atas data yg sama.
    sheet.appendRow(['ID_VERSI', 'ID_PERIODE', 'NAMA_DIVISI', 'NOMOR_VERSI', 'DATA_JADWAL_JSON', 'JUMLAH_BARIS', 'DITETAPKAN_OLEH', 'DITETAPKAN_PADA', 'ALASAN_REVISI']);
  }
  return sheet;
}

// ============================================================
// PENGATURAN -- 2 bagian BARU (21 Okt 2026, dokumen Pembaruan SIKOP
// §D.4-5): Validasi Jadwal (toggle aturan opsional) & Templat
// Keterangan Penugasan.
// ============================================================
function getValidasiJadwalKonfigSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('45_VALIDASI_JADWAL_KONFIG');
  if (!sheet) {
    sheet = ss.insertSheet('45_VALIDASI_JADWAL_KONFIG');
    sheet.appendRow(['ID_ATURAN', 'NAMA_ATURAN', 'KETERANGAN', 'AKTIF', 'WAJIB', 'DIUBAH_OLEH', 'DIUBAH_PADA']);
    // Aturan WAJIB (§F dokumen -- "pertahankan validasi kritis") --
    // AKTIF selalu TRUE, WAJIB=TRUE berarti TIDAK BISA dimatikan Admin
    // (ditegakkan di backend, bukan cuma UI disabled). Aturan OPSIONAL
    // diisi AKTIF=TRUE scr default (konservatif -- semua nyala dulu,
    // Admin yg matikan kalau memang tidak relevan utk divisinya).
    // Kolom per baris: [id_slug, nama, keterangan, aktifDefault, wajib]
    const bawaan = [
      ['shift_wajib_terisi', 'Shift wajib sudah terisi', 'Setiap anggota aktif wajib punya penugasan pada tanggal operasionalnya.', true, true],
      ['rotasi_sesuai', 'Rotasi Kelompok sesuai jadwal', 'Shift relawan sesuai hasil perhitungan rotasi Kelompok Minggu 1/2.', true, true],
      ['hari_khusus_seragam', 'Hari Khusus (masuk bersama) seragam', 'Semua anggota divisi di hari khusus (mis. Jumat Pengolahan) punya jam yang sama.', true, false],
      ['jam_tidak_kosong', 'Jam masuk/pulang tidak kosong', 'Baris roster tidak boleh punya jam jadwal kosong.', true, false],
      ['tidak_ada_penugasan_ganda', 'Tidak ada penugasan ganda', 'Satu relawan tidak boleh punya 2 baris roster di tanggal operasional yang sama.', true, false],
      ['tidak_jadwal_di_libur', 'Tidak ada jadwal di tanggal Libur', 'Roster tidak boleh berisi penugasan pada tanggal berstatus Libur.', true, false],
      ['divisi_sesuai_cakupan_khusus', 'Divisi sesuai cakupan Operasional Khusus', 'Pada tanggal Operasional Khusus, cuma divisi dalam cakupan yang boleh punya jadwal.', true, false],
      ['divisi_anggota_sesuai', 'Divisi anggota sesuai data relawan', 'Divisi pada baris roster harus sama dengan divisi relawan saat ini (bukan data basi).', true, false]
    ];
    bawaan.forEach(b => sheet.appendRow([b[0], b[1], b[2], b[3], b[4], 'SISTEM (bawaan)', new Date()]));
  }
  return sheet;
}

function getTemplatKeteranganSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('44_TEMPLAT_KETERANGAN');
  if (!sheet) {
    sheet = ss.insertSheet('44_TEMPLAT_KETERANGAN');
    sheet.appendRow(['ID_TEMPLAT', 'KATEGORI', 'JUDUL', 'ISI_TEKS', 'DIBUAT_OLEH', 'DIBUAT_PADA']);
  }
  return sheet;
}

/** Baca konfigurasi Validasi Jadwal -- dipakai Pengaturan (tampil+edit) DAN validasiJadwalDivisi (cek AKTIF sebelum menjalankan tiap aturan opsional). */
function getKonfigurasiValidasiJadwal(token) {
  requireAuth(token, true);
  return sheetToObjects(getValidasiJadwalKonfigSheet_()).map(v => ({
    id: v.ID_ATURAN, nama: v.NAMA_ATURAN, keterangan: v.KETERANGAN, aktif: !!v.AKTIF, wajib: !!v.WAJIB
  }));
}

function simpanKonfigurasiValidasiJadwal(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'JADWAL_PENUGASAN', 'EDIT');
  const idAturan = sanitize(body.idAturan);
  const aktif = !!body.aktif;
  const sheet = getValidasiJadwalKonfigSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {}; headers.forEach((h, i) => { idx[h] = i; });
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx.ID_ATURAN] === idAturan) {
      // §F "pertahankan validasi kritis yang wajib" -- aturan WAJIB
      // ditegakkan DI SINI, bukan cuma UI: tidak bisa dimatikan,
      // berapa pun kali diminta.
      if (data[i][idx.WAJIB] === true && !aktif) {
        throw new Error('Aturan ini WAJIB (validasi kritis) dan tidak bisa dimatikan.');
      }
      sheet.getRange(i + 1, idx.AKTIF + 1).setValue(aktif);
      sheet.getRange(i + 1, idx.DIUBAH_OLEH + 1).setValue(akses);
      sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(new Date());
      return { success: true };
    }
  }
  throw new Error('Aturan tidak ditemukan.');
}

/** Templat Keterangan -- CRUD ringan. */
function getDaftarTemplatKeterangan(token) {
  requireAuth(token, true);
  return sheetToObjects(getTemplatKeteranganSheet_()).map(t => ({ id: t.ID_TEMPLAT, kategori: t.KATEGORI, judul: t.JUDUL, isiTeks: t.ISI_TEKS }));
}

function simpanTemplatKeterangan(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'JADWAL_PENUGASAN', 'CREATE');
  const kategori = sanitize(body.kategori);
  const judul = sanitize(body.judul);
  const isiTeks = sanitize(body.isiTeks);
  if (!kategori || !judul || !isiTeks) throw new Error('Kategori, judul, dan isi teks wajib diisi.');
  const sheet = getTemplatKeteranganSheet_();
  const id = 'TPL' + String(sheet.getLastRow()).padStart(4, '0');
  sheet.appendRow([id, kategori, judul, isiTeks, akses, new Date()]);
  return { success: true, id: id };
}

function hapusTemplatKeterangan(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'JADWAL_PENUGASAN', 'DELETE');
  const idTemplat = sanitize(body.idTemplat);
  const sheet = getTemplatKeteranganSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idTemplat) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  throw new Error('Templat tidak ditemukan.');
}

function getOverrideShiftTanggalSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(OVERRIDE_SHIFT_TANGGAL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(OVERRIDE_SHIFT_TANGGAL_SHEET_NAME);
    sheet.appendRow(['ID_OVERRIDE', 'ID_PERIODE', 'NAMA_DIVISI', 'TANGGAL_DMY', 'NOMOR_SHIFT', 'JAM_MASUK', 'JAM_PULANG', 'KETERANGAN', 'DIBUAT_OLEH', 'DIBUAT_PADA']);
  }
  return sheet;
}

/**
 * Hitung minggu ke berapa (1 atau 2) suatu tanggal dalam periode --
 * dasar dari getPeriodeById_ (tanggalMulai sudah ISO). Minggu 1 = 7
 * hari pertama periode, Minggu 2 = sisanya. TIDAK mengasumsikan
 * periode SELALU 14 hari persis -- murni dihitung dari selisih hari.
 */
function hitungMingguDalamPeriode_(idPeriode, tanggalIso) {
  const periode = getPeriodeById_(idPeriode);
  if (!periode) return 1;
  const awal = new Date(tanggalSheetKeIso_(periode.tanggalMulai) + 'T00:00:00Z');
  const target = new Date(tanggalIso + 'T00:00:00Z');
  const selisihHari = Math.floor((target - awal) / (1000 * 60 * 60 * 24));
  return selisihHari < 7 ? 1 : 2;
}

/**
 * Titik sambungan ke resolveShiftUntukRelawan_ (Shift.gs) -- dipanggil
 * SEBELUM fallback ke Shift Divisi lama. Return null kalau divisi ini
 * TIDAK pakai sistem multi-shift baru (35_SHIFT_DIVISI_DETAIL kosong
 * utk kombinasi periode+divisi ini) -- supaya fallback lama tetap
 * berfungsi utk SEMUA divisi lain yg belum dikonfigurasi di sini.
 *
 * Urutan prioritas (didokumentasikan, bukan tebakan):
 *   1. Override per-tanggal (37_OVERRIDE_SHIFT_TANGGAL) -- kasus
 *      Persiapan: tanggal tertentu jadi 2 shift, SELEBIHNYA tetap pola
 *      dasar shift tunggal apa pun yg ada di detail (biasanya shift 1).
 *   2. Hari Khusus (mis. Jumat Pengolahan) -- SEMUA shift digabung jadi
 *      1 jam masuk-bersama, utk HARI itu saja, rotasi TIDAK ikut
 *      berubah (sesuai dokumen §8.5 "pengecualian Jumat tidak mereset
 *      rotasi").
 *   3. Rotasi normal -- Kelompok A/B x Minggu 1/2 -> nomor shift
 *      efektif -> jam dari 35_SHIFT_DIVISI_DETAIL baris nomor shift itu.
 *
 * Kalau relawan BELUM di-assign ke Kelompok (36_KELOMPOK_ROTASI_RELAWAN)
 * utk divisi yg memang perlu rotasi, return null (TIDAK menebak shift 1
 * sbg default) -- supaya Admin sadar ada relawan yg perlu di-assign dulu
 * (muncul kosong di roster, bukan salah assign diam-diam).
 */
function resolveMultiShiftUntukRelawan_(idRelawan, idOperasional) {
  try {
    const opRow = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasional);
    if (!opRow) return null;
    const relawan = getRelawanById(idRelawan);
    if (!relawan || !relawan.divisi) return null;
    const idPeriode = opRow.ID_PERIODE; // tetap dipakai utk Override per-tanggal & perhitungan Minggu 1/2 (keduanya GENUINELY butuh konteks periode berjalan)
    const divisi = relawan.divisi;
    const tanggalDMY = opRow.TANGGAL_OPERASIONAL;
    const tanggalIso = tanggalSheetKeIso_(tanggalDMY);

    // Diperbaiki 22 Okt 2026 (diminta Admin -- bug desain nyata):
    // Pola Kerja (shift detail) & Kelompok Rotasi BUKAN LAGI
    // per-periode -- standing config per DIVISI, berlaku terus sampai
    // diubah lagi. Filter ID_PERIODE DIHAPUS dari kedua lookup ini
    // (tapi KOLOM di sheet tetap ada, sengaja tidak dihapus/migrasi,
    // supaya tidak menyentuh struktur data tanpa perlu -- baris lama yg
    // kebetulan masih bertuliskan ID_PERIODE tertentu tetap kebaca,
    // krn sekarang dicari TANPA peduli isi kolom itu).
    const detailRows = getShiftDivisiDetailRowsCached_()
      .filter(d => d.NAMA_DIVISI === divisi);
    if (!detailRows.length) return null; // divisi ini belum dikonfigurasi di sistem baru -- fallback ke Shift Divisi lama

    // 1) Override per-tanggal (Persiapan) -- TETAP per periode+tanggal,
    // ini GENUINELY pengecualian utk 1 tanggal spesifik, bukan standing config.
    const overrideHariIni = getOverrideShiftTanggalRowsCached_()
      .filter(o => o.ID_PERIODE === idPeriode && o.NAMA_DIVISI === divisi && String(o.TANGGAL_DMY) === String(tanggalDMY));
    if (overrideHariIni.length) {
      const kelompokRow = getKelompokRotasiRowsCached_()
        .find(k => k.NAMA_DIVISI === divisi && k.ID_RELAWAN === idRelawan);
      const nomorDicari = kelompokRow ? Number(kelompokRow.SHIFT_MINGGU_1) : 1;
      const overrideShift = overrideHariIni.find(o => Number(o.NOMOR_SHIFT) === nomorDicari) || overrideHariIni[0];
      if (overrideShift && overrideShift.JAM_MASUK) {
        return { jamMasuk: String(overrideShift.JAM_MASUK), jamPulang: overrideShift.JAM_PULANG ? String(overrideShift.JAM_PULANG) : null, sumber: 'DIVISI_MULTI_OVERRIDE' };
      }
    }

    // 2) Hari Khusus (mis. Jumat Pengolahan -- masuk bersama)
    const namaHari = String(opRow.HARI || '').toUpperCase();
    const detailHariKhusus = detailRows.find(d => d.HARI_KHUSUS && String(d.HARI_KHUSUS).toUpperCase() === namaHari);
    if (detailHariKhusus && detailHariKhusus.JAM_MASUK_HARI_KHUSUS) {
      return { jamMasuk: String(detailHariKhusus.JAM_MASUK_HARI_KHUSUS), jamPulang: detailHariKhusus.JAM_PULANG_HARI_KHUSUS ? String(detailHariKhusus.JAM_PULANG_HARI_KHUSUS) : null, sumber: 'DIVISI_MULTI_HARI_KHUSUS' };
    }

    // 3) Rotasi normal -- Kelompok Rotasi standing per divisi (lihat catatan di atas).
    const kelompokRow = getKelompokRotasiRowsCached_()
      .find(k => k.NAMA_DIVISI === divisi && k.ID_RELAWAN === idRelawan);
    if (!kelompokRow) return null; // belum di-assign kelompok -- JANGAN menebak, biarkan kosong supaya Admin sadar

    const polaRotasi = detailRows[0] ? String(detailRows[0].POLA_ROTASI || 'TETAP').toUpperCase() : 'TETAP';
    let nomorShiftEfektif = Number(kelompokRow.SHIFT_MINGGU_1);
    if (polaRotasi === 'MINGGUAN') {
      // hitungMingguDalamPeriode_ TETAP butuh idPeriode -- ini BUKAN
      // config tersimpan, tapi perhitungan dinamis "tanggal ini jatuh
      // di minggu keberapa DARI periode yg SEDANG diproses", jadi
      // berbeda sifatnya dari Pola Kerja/Kelompok yg di atas.
      const minggu = hitungMingguDalamPeriode_(idPeriode, tanggalIso);
      if (minggu === 2) nomorShiftEfektif = nomorShiftEfektif === 1 ? 2 : 1;
    }

    const detailShift = detailRows.find(d => Number(d.NOMOR_SHIFT) === nomorShiftEfektif);
    if (!detailShift || !detailShift.JAM_MASUK) return null;
    return {
      jamMasuk: String(detailShift.JAM_MASUK), jamPulang: detailShift.JAM_PULANG ? String(detailShift.JAM_PULANG) : null, sumber: 'DIVISI_MULTI',
      nomorShift: nomorShiftEfektif, lintasTengahMalam: !!detailShift.LINTAS_TENGAH_MALAM,
      // BARU 22 Okt 2026 -- ikut disertakan supaya buatRosterUntukOperasional_
      // (Roster.gs) bisa menerapkannya saat menulis TANGGAL_OPERASIONAL.
      aturanTanggalAcuan: String(detailShift.ATURAN_TANGGAL_ACUAN || 'MULAI_SHIFT')
    };
  } catch (e) {
    return null; // JANGAN sampai mematikan roster/absensi -- fallback aman
  }
}

// ============================================================
// CRUD -- Konfigurasi Multi-Shift (dipanggil dari UI Admin)
// ============================================================

/**
 * Simpan/perbarui 1 baris pola shift (NOMOR_SHIFT) utk 1 divisi.
 * Diperbaiki 22 Okt 2026 (diminta Admin): BUKAN LAGI per periode --
 * standing config per divisi, berlaku terus sampai diubah lagi
 * (kolom ID_PERIODE di sheet sengaja TETAP ADA, diisi 'STANDING',
 * supaya struktur sheet tidak perlu diubah/dimigrasi -- cuma sekarang
 * TIDAK dipakai sbg bagian kunci pencarian).
 */
function simpanShiftDivisiDetail(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'CREATE');
  const namaDivisi = sanitize(body.namaDivisi);
  const nomorShift = Number(body.nomorShift);
  const jamMasuk = sanitize(body.jamMasuk);
  const jamPulang = sanitize(body.jamPulang);
  if (!namaDivisi) throw new Error('Divisi wajib diisi.');
  if (nomorShift !== 1 && nomorShift !== 2) throw new Error('Nomor shift wajib 1 atau 2.');
  if (!/^\d{2}:\d{2}$/.test(jamMasuk)) throw new Error('Jam masuk wajib format HH:mm.');
  // BARU 22 Okt 2026 -- lihat catatan di getShiftDivisiDetailSheet_.
  const aturanTanggalAcuan = (sanitize(body.aturanTanggalAcuan) === 'HARI_BERIKUTNYA') ? 'HARI_BERIKUTNYA' : 'MULAI_SHIFT';

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Coba lagi beberapa detik.');
  try {
    _invalidasiCacheMultiShift_(); // jaga-jaga (lihat catatan di definisinya) -- cache kadaluarsa kalau simpan & baca terjadi di eksekusi yg sama
    const sheet = getShiftDivisiDetailSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idx = {}; headers.forEach((h, i) => { idx[h] = i; });
    for (let i = 1; i < data.length; i++) {
      if (data[i][idx.NAMA_DIVISI] === namaDivisi && Number(data[i][idx.NOMOR_SHIFT]) === nomorShift) {
        sheet.getRange(i + 1, idx.JAM_MASUK + 1).setValue(jamMasuk);
        sheet.getRange(i + 1, idx.JAM_PULANG + 1).setValue(jamPulang);
        sheet.getRange(i + 1, idx.LINTAS_TENGAH_MALAM + 1).setValue(!!body.lintasTengahMalam);
        sheet.getRange(i + 1, idx.POLA_ROTASI + 1).setValue(sanitize(body.polaRotasi) || 'TETAP');
        sheet.getRange(i + 1, idx.HARI_KHUSUS + 1).setValue(sanitize(body.hariKhusus) || '');
        sheet.getRange(i + 1, idx.JAM_MASUK_HARI_KHUSUS + 1).setValue(sanitize(body.jamMasukHariKhusus) || '');
        sheet.getRange(i + 1, idx.JAM_PULANG_HARI_KHUSUS + 1).setValue(sanitize(body.jamPulangHariKhusus) || '');
        if (idx.ATURAN_TANGGAL_ACUAN !== undefined) sheet.getRange(i + 1, idx.ATURAN_TANGGAL_ACUAN + 1).setValue(aturanTanggalAcuan);
        logAudit_('UBAH_SHIFT_DIVISI_DETAIL', 'JADWAL_PENUGASAN', namaDivisi + '/shift' + nomorShift, aktor, body);
        return { success: true, diperbarui: true };
      }
    }
    const id = 'SDD' + String(data.length).padStart(4, '0');
    sheet.appendRow([id, 'STANDING', namaDivisi, nomorShift, jamMasuk, jamPulang, !!body.lintasTengahMalam, sanitize(body.polaRotasi) || 'TETAP', sanitize(body.hariKhusus) || '', sanitize(body.jamMasukHariKhusus) || '', sanitize(body.jamPulangHariKhusus) || '', aktor, new Date(), aturanTanggalAcuan]);
    logAudit_('TAMBAH_SHIFT_DIVISI_DETAIL', 'JADWAL_PENUGASAN', namaDivisi + '/shift' + nomorShift, aktor, body);
    return { success: true, diperbarui: false };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Assign relawan ke Kelompok A/B + shift-nya di Minggu 1 (Minggu 2
 * otomatis terbalik, dihitung saat resolusi). Diperbaiki 22 Okt 2026:
 * standing per divisi, BUKAN per periode (lihat catatan di atas).
 */
function simpanKelompokRotasi(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'CREATE');
  const namaDivisi = sanitize(body.namaDivisi);
  const idRelawan = sanitize(body.idRelawan);
  const kelompok = sanitize(body.kelompok).toUpperCase();
  const shiftMinggu1 = Number(body.shiftMinggu1);
  if (!namaDivisi || !idRelawan) throw new Error('Data wajib tidak lengkap.');
  if (kelompok !== 'A' && kelompok !== 'B') throw new Error('Kelompok wajib A atau B.');
  if (shiftMinggu1 !== 1 && shiftMinggu1 !== 2) throw new Error('Shift Minggu 1 wajib 1 atau 2.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Coba lagi beberapa detik.');
  try {
    _invalidasiCacheMultiShift_();
    const sheet = getKelompokRotasiSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idx = {}; headers.forEach((h, i) => { idx[h] = i; });
    for (let i = 1; i < data.length; i++) {
      if (data[i][idx.NAMA_DIVISI] === namaDivisi && data[i][idx.ID_RELAWAN] === idRelawan) {
        sheet.getRange(i + 1, idx.KELOMPOK + 1).setValue(kelompok);
        sheet.getRange(i + 1, idx.SHIFT_MINGGU_1 + 1).setValue(shiftMinggu1);
        return { success: true, diperbarui: true };
      }
    }
    const id = 'KR' + String(data.length).padStart(4, '0');
    sheet.appendRow([id, 'STANDING', namaDivisi, idRelawan, kelompok, shiftMinggu1, aktor, new Date()]);
    return { success: true, diperbarui: false };
  } finally {
    lock.releaseLock();
  }
}

/** Override shift tambahan utk 1 tanggal spesifik (kasus Persiapan). */
function simpanOverrideShiftTanggal(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'CREATE');
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);
  const tanggalDMY = sanitize(body.tanggalDMY);
  const nomorShift = Number(body.nomorShift);
  const jamMasuk = sanitize(body.jamMasuk);
  if (!idPeriode || !namaDivisi || !tanggalDMY) throw new Error('Data wajib tidak lengkap.');
  if (!/^\d{2}:\d{2}$/.test(jamMasuk)) throw new Error('Jam masuk wajib format HH:mm.');

  _invalidasiCacheMultiShift_();
  const sheet = getOverrideShiftTanggalSheet_();
  const id = 'OVR' + String(sheet.getLastRow()).padStart(4, '0');
  sheet.appendRow([id, idPeriode, namaDivisi, tanggalDMY, nomorShift, jamMasuk, sanitize(body.jamPulang), sanitize(body.keterangan), aktor, new Date()]);
  logAudit_('TAMBAH_OVERRIDE_SHIFT_TANGGAL', 'JADWAL_PENUGASAN', idPeriode + '/' + namaDivisi + '/' + tanggalDMY, aktor, body);
  return { success: true, id: id };
}

/**
 * Hapus 1 baris Pola Shift (Pola Kerja per Divisi). BARU 22 Okt 2026
 * (diminta Admin: "setiap modul sediakan aksi Hapus" -- sebelumnya
 * tabel ini tidak punya kolom Aksi sama sekali).
 */
function hapusShiftDivisiDetail(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'DELETE');
  const id = sanitize(body.id);
  if (!id) throw new Error('ID wajib diisi.');
  _invalidasiCacheMultiShift_();
  const sheet = getShiftDivisiDetailSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      logAudit_('HAPUS_SHIFT_DIVISI_DETAIL', 'JADWAL_PENUGASAN', id, aktor, {});
      return { success: true };
    }
  }
  throw new Error('Baris tidak ditemukan.');
}

/** Hapus 1 relawan dari Kelompok Rotasi. BARU 22 Okt 2026 (sama alasan di atas). */
function hapusKelompokRotasi(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'DELETE');
  const id = sanitize(body.id);
  if (!id) throw new Error('ID wajib diisi.');
  _invalidasiCacheMultiShift_();
  const sheet = getKelompokRotasiSheet_();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      logAudit_('HAPUS_KELOMPOK_ROTASI', 'JADWAL_PENUGASAN', id, aktor, {});
      return { success: true };
    }
  }
  throw new Error('Baris tidak ditemukan.');
}

/**
 * Baca konfigurasi lengkap 1 divisi -- utk ditampilkan di UI.
 * Diperbaiki 22 Okt 2026 (diminta Admin): Pola Kerja (detail) & Kelompok
 * Rotasi dibaca TANPA filter periode (standing config). Override
 * Per Tanggal TETAP per periode -- idPeriode di sini jadi OPSIONAL,
 * hanya dipakai utk menyaring daftar Override yg ditampilkan (supaya
 * UI tidak menumpuk override dari periode lama yg sudah lewat); kalau
 * idPeriode tidak dikirim, semua override divisi ini ditampilkan.
 */
function getKonfigurasiMultiShiftDivisi(body) {
  requireAuth(body.token, true);
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);
  const semuaOverride = sheetToObjects(getOverrideShiftTanggalSheet_()).filter(o => o.NAMA_DIVISI === namaDivisi);
  return {
    detail: sheetToObjects(getShiftDivisiDetailSheet_()).filter(d => d.NAMA_DIVISI === namaDivisi),
    kelompok: sheetToObjects(getKelompokRotasiSheet_()).filter(k => k.NAMA_DIVISI === namaDivisi),
    override: idPeriode ? semuaOverride.filter(o => o.ID_PERIODE === idPeriode) : semuaOverride
  };
}


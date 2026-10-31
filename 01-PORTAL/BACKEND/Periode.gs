/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Periode.gs — Periode Kerja (fondasi data, Fase 2)
 *
 * Modul berdiri sendiri, sheet baru (14_PERIODE_KERJA) — tidak menyentuh
 * sheet/fungsi lain. Belum ada satu pun modul existing (Absensi, Rekap,
 * Jadwal) yang bergantung pada Periode — jadi modul ini AMAN ditambahkan
 * tanpa risiko terhadap sistem yang sudah berjalan.
 *
 * Satu periode kerja TIDAK otomatis membuat tanggal operasional — itu
 * tugas Kalender.gs (KALENDER_OPERASIONAL), yang merujuk ke ID_PERIODE di
 * sini sebagai konteksnya (lihat §9–§10 dokumen pengembangan).
 *
 * Kolom 14_PERIODE_KERJA:
 *   ID_PERIODE | NAMA_PERIODE | TANGGAL_MULAI | TANGGAL_SELESAI | STATUS | KETERANGAN
 *   STATUS: DRAFT | AKTIF | SELESAI | DITUTUP
 *
 * Admin-only untuk saat ini (semua action di bawah wajib token admin via
 * requireAuth). Relawan belum melihat Periode secara langsung — mereka
 * akan melihat KALENDER_OPERASIONAL/JADWAL, bukan Periode itu sendiri
 * (§61 dokumen: kalender adalah pusat konteks, bukan Periode).
 */

const STATUS_PERIODE_VALID = ['DRAFT', 'AKTIF', 'SELESAI', 'DITUTUP'];

function getPeriodeSheet() {
  return getSheet(NAMA_SHEET.PERIODE);
}

function generateIdPeriode_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^PRD(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'PRD' + String(max + 1).padStart(3, '0');
}

/** Semua baris Periode dengan TANGGAL_MULAI/TANGGAL_SELESAI sudah diseragamkan jadi teks "dd/MM/yyyy". */
/** Cache per-eksekusi (audit performance: sebelumnya baca sheet 14_PERIODE_KERJA
 * setiap kali dipanggil, termasuk dari dalam getDashboardRelawanP1 -> getPeriodeAktif_
 * -> getPeriodeById_, yang keduanya memanggil fungsi ini). Pola SAMA dengan
 * _cacheRelawanPerId/_cacheAkunPerId di modul lain. */
let _cachePeriodeRows = null;
function getPeriodeRows_() {
  if (_cachePeriodeRows) return _cachePeriodeRows;
  const rows = sheetToObjects(getPeriodeSheet());
  rows.forEach(r => {
    if (r.TANGGAL_MULAI) r.TANGGAL_MULAI = bacaTanggalDMY_(r.TANGGAL_MULAI);
    if (r.TANGGAL_SELESAI) r.TANGGAL_SELESAI = bacaTanggalDMY_(r.TANGGAL_SELESAI);
  });
  _cachePeriodeRows = rows;
  return rows;
}

/** Untuk Admin — semua periode, terbaru (tanggal mulai) di atas. */
function getPeriodeListAdmin() {
  const semua = getPeriodeRows_();
  return semua
    .map(p => ({
      id: p.ID_PERIODE,
      nama: p.NAMA_PERIODE,
      tanggalMulai: p.TANGGAL_MULAI,
      tanggalSelesai: p.TANGGAL_SELESAI,
      status: p.STATUS,
      keterangan: p.KETERANGAN
    }))
    .sort((a, b) => {
      const isoA = tanggalSheetKeIso_(a.tanggalMulai) || '';
      const isoB = tanggalSheetKeIso_(b.tanggalMulai) || '';
      return isoB.localeCompare(isoA);
    });
}

/** Dipakai internal oleh Kalender.gs untuk membaca rentang tanggal & validasi ID_PERIODE. Return null jika tidak ditemukan. */
function getPeriodeById_(id) {
  const semua = getPeriodeRows_();
  const p = semua.find(r => r.ID_PERIODE === id);
  if (!p) return null;
  return {
    id: p.ID_PERIODE,
    nama: p.NAMA_PERIODE,
    // bacaTanggalDMY_ dipanggil lagi di sini sebagai jaga-jaga (defense in
    // depth) -- getPeriodeRows_ di atas SEHARUSNYA sudah menyeragamkan ini
    // jadi string "dd/MM/yyyy", tapi ada laporan nyata error
    // "...split is not a function" pada pemanggil (addOperasionalBulk) yang
    // mengindikasikan nilai ini kadang belum berupa string murni saat tiba
    // di sana. Memanggil bacaTanggalDMY_ lagi DI SINI tidak berbahaya sama
    // sekali kalau nilainya memang sudah string (cuma String(str) -> str
    // yang sama), tapi menjamin SETIAP pemanggil getPeriodeById_ aman.
    tanggalMulai: bacaTanggalDMY_(p.TANGGAL_MULAI),   // dd/MM/yyyy
    tanggalSelesai: bacaTanggalDMY_(p.TANGGAL_SELESAI), // dd/MM/yyyy
    status: p.STATUS,
    keterangan: p.KETERANGAN
  };
}

/** Periode dgn STATUS='AKTIF' -- dipakai Riwayat Presensi relawan & Monitoring Pengelola (§B/§I dokumen SIPRES UI: "otomatis pakai periode aktif"). Kalau ada >1 AKTIF (seharusnya tidak), ambil yang paling baru dibuat. */
function getPeriodeAktif_() {
  const semua = getPeriodeRows_().filter(p => String(p.STATUS).toUpperCase() === 'AKTIF');
  if (!semua.length) return null;
  const p = semua[semua.length - 1];
  return getPeriodeById_(p.ID_PERIODE);
}

function addPeriode(body) {
  const nama = sanitize(body.nama);
  const tanggalMulaiIso = sanitize(body.tanggalMulai); // yyyy-MM-dd dari <input type="date">
  const tanggalSelesaiIso = sanitize(body.tanggalSelesai);
  const keterangan = sanitize(body.keterangan);

  if (!nama) throw new Error('Nama periode wajib diisi.');
  if (!tanggalMulaiIso || !tanggalSelesaiIso) throw new Error('Tanggal mulai dan tanggal selesai wajib diisi.');
  if (tanggalMulaiIso > tanggalSelesaiIso) throw new Error('Tanggal mulai tidak boleh setelah tanggal selesai.');

  const tanggalMulaiDMY = isoKeDmy_(tanggalMulaiIso);
  const tanggalSelesaiDMY = isoKeDmy_(tanggalSelesaiIso);

  const sheet = getPeriodeSheet();
  const id = generateIdPeriode_(sheet);
  sheet.appendRow([id, nama, tanggalMulaiDMY, tanggalSelesaiDMY, 'DRAFT', keterangan]);
  // Tulis ulang kolom tanggal sebagai teks murni — appendRow di atas berpotensi
  // sudah "dimasak" jadi Date oleh Sheets (lihat catatan paksaKolomTeks_ di Utils.gs).
  const baris = sheet.getLastRow();
  paksaKolomTeks_(sheet, baris, 3);
  sheet.getRange(baris, 3).setValue(tanggalMulaiDMY);
  paksaKolomTeks_(sheet, baris, 4);
  sheet.getRange(baris, 4).setValue(tanggalSelesaiDMY);

  // FONDASI PENGGAJIAN: siapkan baris Master Tarif utk semua relawan
  // aktif begitu periode dibuat (§8) -- JABATAN/TARIF_HARIAN dikosongkan,
  // Pengelola yang mengisi belakangan. Dibungkus try/catch supaya
  // kegagalan di sini TIDAK PERNAH menggagalkan pembuatan periode itu
  // sendiri (aksi utama Admin).
  // Dihapus 23 Okt 2026 (diminta Admin): Master Tarif sekarang STANDING
  // (lihat MasterTarif.gs) -- tidak perlu lagi "disiapkan" per periode
  // baru, jadi hook ini sudah tidak relevan.

  return { id: id, nama: nama, status: 'DRAFT' };
}

function updatePeriode(body) {
  const id = sanitize(body.id);
  const nama = sanitize(body.nama);
  const tanggalMulaiIso = sanitize(body.tanggalMulai);
  const tanggalSelesaiIso = sanitize(body.tanggalSelesai);
  const keterangan = sanitize(body.keterangan);

  if (!id) throw new Error('ID periode wajib diisi.');
  if (!nama) throw new Error('Nama periode wajib diisi.');
  if (!tanggalMulaiIso || !tanggalSelesaiIso) throw new Error('Tanggal mulai dan tanggal selesai wajib diisi.');
  if (tanggalMulaiIso > tanggalSelesaiIso) throw new Error('Tanggal mulai tidak boleh setelah tanggal selesai.');

  const lock = LockService.getScriptLock(); // BARU (16 Okt 2026) -- UI utk fungsi ini baru ditambahkan, sekalian dilindungi konsisten dgn fungsi tulis lain
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getPeriodeSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        const statusSaatIni = String(data[i][4]);
        paksaKolomTeks_(sheet, i + 1, 3);
        paksaKolomTeks_(sheet, i + 1, 4);
        sheet.getRange(i + 1, 1, 1, 6).setValues([[
          id, nama, isoKeDmy_(tanggalMulaiIso), isoKeDmy_(tanggalSelesaiIso), statusSaatIni, keterangan
        ]]);
        return { success: true };
      }
    }
    throw new Error('Periode tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

function updateStatusPeriode(body) {
  const id = sanitize(body.id);
  const status = sanitize(body.status).toUpperCase();
  if (!id) throw new Error('ID periode wajib diisi.');
  if (STATUS_PERIODE_VALID.indexOf(status) === -1) throw new Error('Status periode tidak valid.');

  const sheet = getPeriodeSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 5).setValue(status);
      return { success: true, status: status };
    }
  }
  throw new Error('Periode tidak ditemukan.');
}

/** Hapus periode — HANYA diizinkan kalau periode ini belum punya satu pun tanggal
 * operasional (15_KALENDER_OPERASIONAL), supaya tidak ada entri kalender yang jadi
 * "yatim" (menunjuk ID_PERIODE yang sudah tidak ada). Kalau masih ada tanggalnya,
 * arahkan Admin memakai tombol "Hapus Semua" di tab Kalender Operasional dulu. */
function deletePeriode(body) {
  const id = sanitize(body.id);
  if (!id) throw new Error('ID periode wajib diisi.');

  const kalenderTerkait = getKalenderRows_().filter(k => k.ID_PERIODE === id);
  if (kalenderTerkait.length > 0) {
    throw new Error('Periode ini masih memiliki ' + kalenderTerkait.length + ' tanggal operasional. ' +
      'Hapus semua tanggalnya dulu lewat tab Kalender Operasional (tombol "Hapus Semua"), baru periode ini bisa dihapus.');
  }

  const sheet = getPeriodeSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Periode tidak ditemukan.');
}

/** "yyyy-MM-dd" (dari <input type="date">) -> "dd/MM/yyyy" (format tanggal di sheet, sama seperti Jadwal.gs). */
function isoKeDmy_(iso) {
  const [yyyy, mm, dd] = String(iso).split('-');
  return `${dd}/${mm}/${yyyy}`;
}


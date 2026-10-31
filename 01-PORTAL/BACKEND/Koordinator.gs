/**
 * Koordinator.gs — 4 modul operasional harian Koordinator (21 Okt
 * 2026, dokumen "Fitur Koordinator"): Pembagian Tugas Harian, Laporan
 * & Kendala, Pengajuan Kebutuhan, Retur Barang. File BARU, 4 sheet
 * BARU (additif, tidak mengubah struktur lama) -- SEMUA request
 * koordinator divalidasi requireRoleBaru_(['KOORDINATOR_OPERASIONAL'])
 * di SERVER, bukan cuma disembunyikan di frontend (sesuai dokumen §3,
 * §12). idDivisi TIDAK PERNAH dipercaya dari frontend -- selalu diambil
 * dari akses.divisi (profil relawan yg login), sesuai dokumen §12
 * "jangan mempercayai ID divisi dari frontend".
 */

// ============================================================
// SHEET BARU (dibuat otomatis saat pertama diakses)
// ============================================================
function getTugasHarianSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('40_TUGAS_HARIAN');
  if (!sheet) {
    sheet = ss.insertSheet('40_TUGAS_HARIAN');
    sheet.appendRow(['ID_TUGAS', 'TANGGAL_DMY', 'DIVISI', 'ID_RELAWAN', 'NAMA_RELAWAN', 'TUGAS', 'LOKASI_POS', 'CATATAN_INSTRUKSI', 'DIBUAT_OLEH', 'DIBUAT_PADA', 'DIUBAH_PADA']);
  }
  return sheet;
}
function getLaporanKendalaSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('41_LAPORAN_KENDALA');
  if (!sheet) {
    sheet = ss.insertSheet('41_LAPORAN_KENDALA');
    sheet.appendRow(['ID_LAPORAN', 'TANGGAL_DMY', 'DIVISI', 'JENIS_KENDALA', 'JUDUL', 'URAIAN', 'DAMPAK_URGENSI', 'TINDAKAN_AWAL', 'TUJUAN', 'STATUS', 'CATATAN_TINDAK_LANJUT', 'DILAPORKAN_OLEH', 'DIBUAT_PADA', 'DIUBAH_PADA']);
  }
  return sheet;
}
function getPengajuanKebutuhanSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('42_PENGAJUAN_KEBUTUHAN');
  if (!sheet) {
    sheet = ss.insertSheet('42_PENGAJUAN_KEBUTUHAN');
    sheet.appendRow(['ID_PENGAJUAN', 'TANGGAL_DMY', 'DIVISI', 'NAMA_BARANG', 'KATEGORI', 'JUMLAH', 'SATUAN', 'ALASAN', 'PRIORITAS', 'STATUS', 'CATATAN_PERSETUJUAN', 'DIAJUKAN_OLEH', 'DIBUAT_PADA', 'DIPROSES_OLEH', 'DIPROSES_PADA']);
  }
  return sheet;
}
function getReturBarangSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('43_RETUR_BARANG');
  if (!sheet) {
    sheet = ss.insertSheet('43_RETUR_BARANG');
    sheet.appendRow(['ID_RETUR', 'TANGGAL_DMY', 'DIVISI', 'NAMA_BARANG', 'KATEGORI', 'JUMLAH', 'SATUAN', 'ALASAN_RETUR', 'KONDISI_BARANG', 'URAIAN', 'STATUS', 'CATATAN_GUDANG', 'DIAJUKAN_OLEH', 'DIBUAT_PADA', 'DIPROSES_OLEH', 'DIPROSES_PADA']);
  }
  return sheet;
}

function generateIdBaris_(sheet, prefiks) {
  return prefiks + String(sheet.getLastRow()).padStart(5, '0');
}

/** Akses koordinator + divisinya -- SATU titik, dipakai SEMUA fungsi di bawah. idDivisi TIDAK PERNAH dari body/frontend. */
function aksesKoordinator_(token) {
  const akses = requireRoleBaru_(token, ['KOORDINATOR_OPERASIONAL']);
  if (!akses.divisi) throw new Error('Divisi Anda belum diatur -- hubungi Admin.');
  return akses;
}

// ============================================================
// 1) PEMBAGIAN TUGAS HARIAN
// ============================================================

/** Daftar barang/kategori SIRAGA ringan -- VIEW saja, tidak butuh akses Petugas Stok (beda dari getKategoriBarang/getDataBarangList yg butuh requireStokAccess_). */
function getDaftarBarangUntukForm(body) {
  aksesKoordinator_(body.token);
  return {
    kategori: sheetToObjects(getStokKategoriSheet()).filter(k => String(k.AKTIF).toUpperCase() !== 'NONAKTIF').map(k => ({ id: k.ID_KATEGORI, nama: k.NAMA_KATEGORI })),
    barang: sheetToObjects(getStokBarangSheet()).filter(b => String(b.AKTIF).toUpperCase() !== 'NONAKTIF').map(b => ({ id: b.ID_BARANG, nama: b.NAMA_BARANG, idKategori: b.ID_KATEGORI, satuan: b.SATUAN || '' }))
  };
}

function simpanTugasHarian(body) {
  const akses = aksesKoordinator_(body.token);
  const tanggalDMY = sanitize(body.tanggalDMY);
  const idRelawan = sanitize(body.idRelawan);
  const tugas = sanitize(body.tugas);
  if (!tanggalDMY || !idRelawan || !tugas) throw new Error('Tanggal, relawan, dan tugas wajib diisi.');

  const relawan = getRelawanById(idRelawan);
  if (!relawan || relawan.divisi !== akses.divisi) throw new Error('Relawan tidak ditemukan di divisi Anda.');

  const idTugas = sanitize(body.idTugas); // ada = update, kosong = baru
  const sheet = getTugasHarianSheet_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Coba lagi beberapa detik.');
  try {
    if (idTugas) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const idx = {}; headers.forEach((h, i) => { idx[h] = i; });
      for (let i = 1; i < data.length; i++) {
        if (data[i][idx.ID_TUGAS] === idTugas && data[i][idx.DIVISI] === akses.divisi) {
          sheet.getRange(i + 1, idx.TUGAS + 1, 1, 3).setValues([[tugas, sanitize(body.lokasiPos), sanitize(body.catatanInstruksi)]]);
          sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(new Date());
          return { success: true, id: idTugas };
        }
      }
      throw new Error('Tugas tidak ditemukan atau bukan milik divisi Anda.');
    } else {
      const id = generateIdBaris_(sheet, 'TGS');
      sheet.appendRow([id, tanggalDMY, akses.divisi, idRelawan, relawan.nama, tugas, sanitize(body.lokasiPos), sanitize(body.catatanInstruksi), akses.idRelawan, new Date(), '']);
      return { success: true, id: id };
    }
  } finally {
    lock.releaseLock();
  }
}

/** Daftar tugas 1 tanggal + relawan yg BELUM dapat tugas (diminta dokumen §6 "tugas yang belum diisi"). */
function getTugasHarianKoordinator(body) {
  const akses = aksesKoordinator_(body.token);
  const tanggalDMY = sanitize(body.tanggalDMY) || formatTanggal(new Date());
  const tugasHariIni = sheetToObjects(getTugasHarianSheet_()).filter(t => t.TANGGAL_DMY === tanggalDMY && t.DIVISI === akses.divisi);
  const relawanDivisi = getRelawanList(null, false).filter(r => r.divisi === akses.divisi);
  const idRelawanBertugas = new Set(tugasHariIni.map(t => t.ID_RELAWAN));
  const belumDitugaskan = relawanDivisi.filter(r => !idRelawanBertugas.has(r.id)).map(r => ({ id: r.id, nama: r.nama }));
  return { divisi: akses.divisi, tanggal: tanggalDMY, tugas: tugasHariIni, belumDitugaskan: belumDitugaskan };
}

// ============================================================
// 2) LAPORAN & KENDALA
// ============================================================
const JENIS_KENDALA_VALID = ['PERSONEL', 'PERALATAN', 'BAHAN', 'PROSES_KERJA', 'KEBERSIHAN_KEAMANAN_PANGAN', 'DISTRIBUSI', 'LAINNYA'];
const STATUS_LAPORAN_VALID = ['MENUNGGU', 'DIPROSES', 'PERLU_INFO_TAMBAHAN', 'SELESAI'];

function buatLaporanKendala(body) {
  const akses = aksesKoordinator_(body.token);
  const jenisKendala = sanitize(body.jenisKendala);
  const judul = sanitize(body.judul);
  const uraian = sanitize(body.uraian);
  if (!jenisKendala || !judul || !uraian) throw new Error('Jenis kendala, judul, dan uraian wajib diisi.');
  if (JENIS_KENDALA_VALID.indexOf(jenisKendala) === -1) throw new Error('Jenis kendala tidak valid.');

  const sheet = getLaporanKendalaSheet_();
  const id = generateIdBaris_(sheet, 'LAP');
  sheet.appendRow([
    id, sanitize(body.tanggalDMY) || formatTanggal(new Date()), akses.divisi, jenisKendala, judul, uraian,
    sanitize(body.dampakUrgensi), sanitize(body.tindakanAwal), sanitize(body.tujuan),
    'MENUNGGU', '', akses.idRelawan, new Date(), ''
  ]);
  logAudit_('BUAT_LAPORAN_KENDALA', 'KOORDINATOR', id, akses.idRelawan, { divisi: akses.divisi, jenisKendala, judul });
  return { success: true, id: id };
}

function getLaporanKendalaKoordinator(body) {
  const akses = aksesKoordinator_(body.token);
  const semua = sheetToObjects(getLaporanKendalaSheet_()).filter(l => l.DIVISI === akses.divisi);
  return semua.sort((a, b) => new Date(b.DIBUAT_PADA) - new Date(a.DIBUAT_PADA)).map(l => ({
    id: l.ID_LAPORAN, tanggal: l.TANGGAL_DMY, jenisKendala: l.JENIS_KENDALA, judul: l.JUDUL,
    uraian: l.URAIAN, status: l.STATUS, catatanTindakLanjut: l.CATATAN_TINDAK_LANJUT || '', dibuatPada: l.DIBUAT_PADA
  }));
}

// ============================================================
// 3) PENGAJUAN KEBUTUHAN
// ============================================================
const PRIORITAS_VALID = ['RENDAH', 'SEDANG', 'TINGGI'];
const STATUS_PENGAJUAN_KEBUTUHAN_VALID = ['MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DITOLAK', 'SEDANG_DIPROSES', 'TERPENUHI_SEBAGIAN', 'SELESAI'];

function ajukanKebutuhan(body) {
  const akses = aksesKoordinator_(body.token);
  const namaBarang = sanitize(body.namaBarang);
  const jumlah = Number(body.jumlah);
  if (!namaBarang || !jumlah || jumlah <= 0) throw new Error('Nama barang dan jumlah (lebih dari 0) wajib diisi.');
  const prioritas = sanitize(body.prioritas) || 'SEDANG';
  if (PRIORITAS_VALID.indexOf(prioritas) === -1) throw new Error('Prioritas tidak valid.');

  const sheet = getPengajuanKebutuhanSheet_();
  const id = generateIdBaris_(sheet, 'PGK');
  sheet.appendRow([
    id, formatTanggal(new Date()), akses.divisi, namaBarang, sanitize(body.kategori), jumlah, sanitize(body.satuan),
    sanitize(body.alasan), prioritas, 'MENUNGGU_PERSETUJUAN', '', akses.idRelawan, new Date(), '', ''
  ]);
  logAudit_('AJUKAN_KEBUTUHAN', 'KOORDINATOR', id, akses.idRelawan, { divisi: akses.divisi, namaBarang, jumlah });
  return { success: true, id: id };
}

function getPengajuanKebutuhanKoordinator(body) {
  const akses = aksesKoordinator_(body.token);
  const semua = sheetToObjects(getPengajuanKebutuhanSheet_()).filter(p => p.DIVISI === akses.divisi);
  return semua.sort((a, b) => new Date(b.DIBUAT_PADA) - new Date(a.DIBUAT_PADA)).map(p => ({
    id: p.ID_PENGAJUAN, tanggal: p.TANGGAL_DMY, namaBarang: p.NAMA_BARANG, kategori: p.KATEGORI,
    jumlah: p.JUMLAH, satuan: p.SATUAN, prioritas: p.PRIORITAS, status: p.STATUS,
    catatanPersetujuan: p.CATATAN_PERSETUJUAN || ''
  }));
}

// ============================================================
// 4) RETUR BARANG
// ============================================================
const ALASAN_RETUR_VALID = ['RUSAK_PECAH', 'CACAT_TIDAK_BERFUNGSI', 'TIDAK_SESUAI_SPESIFIKASI', 'SALAH_JENIS_JUMLAH', 'TIDAK_LAYAK_DIGUNAKAN', 'LAINNYA'];
const STATUS_RETUR_VALID = ['MENUNGGU_PEMERIKSAAN', 'DITERIMA_GUDANG', 'DITOLAK', 'DALAM_PENANGANAN', 'SELESAI'];

function ajukanRetur(body) {
  const akses = aksesKoordinator_(body.token);
  const namaBarang = sanitize(body.namaBarang);
  const jumlah = Number(body.jumlah);
  const alasanRetur = sanitize(body.alasanRetur);
  if (!namaBarang || !jumlah || jumlah <= 0) throw new Error('Nama barang dan jumlah (lebih dari 0) wajib diisi.');
  if (!alasanRetur || ALASAN_RETUR_VALID.indexOf(alasanRetur) === -1) throw new Error('Alasan retur wajib dipilih dengan benar.');

  const sheet = getReturBarangSheet_();
  const id = generateIdBaris_(sheet, 'RTR');
  sheet.appendRow([
    id, formatTanggal(new Date()), akses.divisi, namaBarang, sanitize(body.kategori), jumlah, sanitize(body.satuan),
    alasanRetur, sanitize(body.kondisiBarang), sanitize(body.uraian), 'MENUNGGU_PEMERIKSAAN', '',
    akses.idRelawan, new Date(), '', ''
  ]);
  logAudit_('AJUKAN_RETUR', 'KOORDINATOR', id, akses.idRelawan, { divisi: akses.divisi, namaBarang, jumlah, alasanRetur });
  return { success: true, id: id };
}

function getReturBarangKoordinator(body) {
  const akses = aksesKoordinator_(body.token);
  const semua = sheetToObjects(getReturBarangSheet_()).filter(r => r.DIVISI === akses.divisi);
  return semua.sort((a, b) => new Date(b.DIBUAT_PADA) - new Date(a.DIBUAT_PADA)).map(r => ({
    id: r.ID_RETUR, tanggal: r.TANGGAL_DMY, namaBarang: r.NAMA_BARANG, jumlah: r.JUMLAH, satuan: r.SATUAN,
    alasanRetur: r.ALASAN_RETUR, status: r.STATUS, catatanGudang: r.CATATAN_GUDANG || ''
  }));
}

// ============================================================
// SISI ADMIN — Persetujuan Pengajuan Kebutuhan & Pemeriksaan Retur
// Barang (21 Okt 2026, diminta Admin -- sebelumnya pengajuan koordinator
// tidak ada yg bisa memprosesnya, menumpuk selamanya di "Menunggu").
// ============================================================

/** Semua pengajuan kebutuhan LINTAS DIVISI -- utk Admin Operasional. */
function getPengajuanKebutuhanAdmin(body) {
  const aktor = requireAuth(body.token, true);
  const statusFilter = sanitize(body.status);
  let semua = sheetToObjects(getPengajuanKebutuhanSheet_());
  if (statusFilter) semua = semua.filter(p => p.STATUS === statusFilter);
  return semua.sort((a, b) => new Date(b.DIBUAT_PADA) - new Date(a.DIBUAT_PADA)).map(p => ({
    id: p.ID_PENGAJUAN, tanggal: p.TANGGAL_DMY, divisi: p.DIVISI, namaBarang: p.NAMA_BARANG, kategori: p.KATEGORI,
    jumlah: p.JUMLAH, satuan: p.SATUAN, alasan: p.ALASAN, prioritas: p.PRIORITAS, status: p.STATUS,
    catatanPersetujuan: p.CATATAN_PERSETUJUAN || '', diajukanOleh: p.DIAJUKAN_OLEH
  }));
}

/** Ubah status 1 pengajuan kebutuhan (Disetujui/Ditolak/Sedang Diproses/Terpenuhi Sebagian/Selesai). */
function prosesPengajuanKebutuhan(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'MANAJEMEN_PENGGUNA', 'APPROVE'); // persetujuan kebutuhan = wewenang Admin Operasional, bukan modul SIRAGA (ini baru PENGAJUAN, bukan transaksi stok)
  const idPengajuan = sanitize(body.idPengajuan);
  const statusBaru = sanitize(body.statusBaru);
  if (!idPengajuan || !statusBaru) throw new Error('ID pengajuan dan status baru wajib diisi.');
  if (STATUS_PENGAJUAN_KEBUTUHAN_VALID.indexOf(statusBaru) === -1) throw new Error('Status tidak valid.');

  const sheet = getPengajuanKebutuhanSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {}; headers.forEach((h, i) => { idx[h] = i; });
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx.ID_PENGAJUAN] === idPengajuan) {
      sheet.getRange(i + 1, idx.STATUS + 1).setValue(statusBaru);
      sheet.getRange(i + 1, idx.CATATAN_PERSETUJUAN + 1).setValue(sanitize(body.catatan));
      sheet.getRange(i + 1, idx.DIPROSES_OLEH + 1).setValue(aktor);
      sheet.getRange(i + 1, idx.DIPROSES_PADA + 1).setValue(new Date());
      logAudit_('PROSES_PENGAJUAN_KEBUTUHAN', 'KOORDINATOR', idPengajuan, aktor, { statusBaru, catatan: sanitize(body.catatan) });
      return { success: true };
    }
  }
  throw new Error('Pengajuan tidak ditemukan.');
}

/** Semua retur barang LINTAS DIVISI -- utk Petugas Stok/Gudang. */
function getReturBarangAdmin(body) {
  const aktor = requireAuth(body.token, true);
  const statusFilter = sanitize(body.status);
  let semua = sheetToObjects(getReturBarangSheet_());
  if (statusFilter) semua = semua.filter(r => r.STATUS === statusFilter);
  return semua.sort((a, b) => new Date(b.DIBUAT_PADA) - new Date(a.DIBUAT_PADA)).map(r => ({
    id: r.ID_RETUR, tanggal: r.TANGGAL_DMY, divisi: r.DIVISI, namaBarang: r.NAMA_BARANG, kategori: r.KATEGORI,
    jumlah: r.JUMLAH, satuan: r.SATUAN, alasanRetur: r.ALASAN_RETUR, kondisiBarang: r.KONDISI_BARANG, uraian: r.URAIAN,
    status: r.STATUS, catatanGudang: r.CATATAN_GUDANG || '', diajukanOleh: r.DIAJUKAN_OLEH
  }));
}

/**
 * Ubah status 1 retur barang. requireStokAccess_ (SAMA dgn akses
 * SIRAGA Petugas Stok/Admin -- §9 dokumen "petugas gudang memeriksa").
 * TIDAK otomatis menyesuaikan stok (§9 "jangan otomatis tambah/kurang
 * stok hanya berdasarkan retur" -- penyesuaian stok, kalau memang
 * perlu, tetap lewat mekanisme SIRAGA yg sudah ada, terpisah dari sini).
 */
function prosesReturBarang(body) {
  const akses = requireStokAccess_(body.token, true);
  const idRetur = sanitize(body.idRetur);
  const statusBaru = sanitize(body.statusBaru);
  if (!idRetur || !statusBaru) throw new Error('ID retur dan status baru wajib diisi.');
  if (STATUS_RETUR_VALID.indexOf(statusBaru) === -1) throw new Error('Status tidak valid.');

  const sheet = getReturBarangSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {}; headers.forEach((h, i) => { idx[h] = i; });
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx.ID_RETUR] === idRetur) {
      sheet.getRange(i + 1, idx.STATUS + 1).setValue(statusBaru);
      sheet.getRange(i + 1, idx.CATATAN_GUDANG + 1).setValue(sanitize(body.catatan));
      sheet.getRange(i + 1, idx.DIPROSES_OLEH + 1).setValue(akses.idPetugas || akses);
      sheet.getRange(i + 1, idx.DIPROSES_PADA + 1).setValue(new Date());
      logAudit_('PROSES_RETUR_BARANG', 'KOORDINATOR', idRetur, akses.idPetugas || akses, { statusBaru, catatan: sanitize(body.catatan) });
      return { success: true };
    }
  }
  throw new Error('Retur tidak ditemukan.');
}

// ============================================================
// RINGKASAN (diminta dokumen §10 -- koordinator tahu status semua
// pengajuan/laporan/retur miliknya dalam 1 panggilan, utk dashboard).
// ============================================================
function getRingkasanKoordinator(body) {
  const akses = aksesKoordinator_(body.token);
  const laporan = sheetToObjects(getLaporanKendalaSheet_()).filter(l => l.DIVISI === akses.divisi);
  const kebutuhan = sheetToObjects(getPengajuanKebutuhanSheet_()).filter(p => p.DIVISI === akses.divisi);
  const retur = sheetToObjects(getReturBarangSheet_()).filter(r => r.DIVISI === akses.divisi);
  return {
    laporanBelumSelesai: laporan.filter(l => l.STATUS !== 'SELESAI').length,
    kebutuhanMenunggu: kebutuhan.filter(p => p.STATUS === 'MENUNGGU_PERSETUJUAN').length,
    returMenunggu: retur.filter(r => r.STATUS === 'MENUNGGU_PEMERIKSAAN').length
  };
}


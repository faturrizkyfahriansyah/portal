/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Dokumen.gs — Dokumen & Panduan (Modul Dashboard Relawan #7)
 */

const KATEGORI_DOKUMEN_VALID = ['Dokumen Relawan', 'SOP', 'Surat', 'Formulir', 'Panduan Kerja', 'Dokumen Administrasi', 'Dokumen untuk Relawan'];

function getDokumenSheet() {
  return getSheet(NAMA_SHEET.DOKUMEN);
}

function generateIdDokumen_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^DOC(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'DOC' + String(max + 1).padStart(3, '0');
}

/** FASE 8 — sama polanya dengan Informasi.gs: validasi role di server. */
function getDokumenRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const roleSaya = getRoleRelawan_(idRelawan);
  const semua = sheetToObjects(getDokumenSheet());
  return semua
    .filter(d => String(d.STATUS).toUpperCase() === 'AKTIF')
    .filter(d => {
      const target = String(d.TARGET_ROLE || '').toUpperCase().trim();
      return !target || target === 'SEMUA' || target === roleSaya;
    })
    .map(d => ({ id: d.ID, judul: d.JUDUL, deskripsi: d.DESKRIPSI, kategori: d.KATEGORI, url: d.URL || '' }))
    .reverse();
}

function getDokumenListAdmin() {
  const semua = sheetToObjects(getDokumenSheet());
  return semua.map(d => ({
    id: d.ID, judul: d.JUDUL, deskripsi: d.DESKRIPSI, kategori: d.KATEGORI, url: d.URL || '', status: d.STATUS,
    targetRole: d.TARGET_ROLE || 'SEMUA'
  })).reverse();
}

function addDokumen(body) {
  const judul = sanitize(body.judul);
  const deskripsi = sanitize(body.deskripsi);
  const kategori = sanitize(body.kategori);
  const url = sanitize(body.url);
  const targetRole = sanitize(body.targetRole) || 'SEMUA';
  if (!judul) throw new Error('Judul dokumen wajib diisi.');
  if (KATEGORI_DOKUMEN_VALID.indexOf(kategori) === -1) throw new Error('Kategori dokumen tidak valid.');
  if (['SEMUA', 'RELAWAN', 'ASN', 'KEPALA_SPPG'].indexOf(targetRole) === -1) throw new Error('Target role tidak dikenali.');

  const sheet = getDokumenSheet();
  const id = generateIdDokumen_(sheet);
  // TARGET_ROLE di kolom paling akhir (ke-7), sama prinsipnya dengan Informasi.gs.
  sheet.appendRow([id, judul, deskripsi, kategori, url, 'AKTIF', new Date(), targetRole]);
  return { id: id };
}

function updateStatusDokumen(body) {
  const id = sanitize(body.id);
  const statusBaru = sanitize(body.statusBaru).toUpperCase();
  if (statusBaru !== 'AKTIF' && statusBaru !== 'NONAKTIF') throw new Error('Status tidak valid.');

  const sheet = getDokumenSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 6).setValue(statusBaru);
      return { id: id, status: statusBaru };
    }
  }
  throw new Error('Dokumen tidak ditemukan.');
}


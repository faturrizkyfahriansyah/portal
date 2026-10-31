/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Notifikasi.gs — Notification Center (Modul Dashboard Relawan #6)
 */

const KATEGORI_NOTIFIKASI_VALID = ['Jadwal', 'Penugasan', 'Informasi', 'Sistem'];

function getNotifikasiSheet() {
  return getSheet(NAMA_SHEET.NOTIFIKASI);
}

function generateIdNotifikasi_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^NTF(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'NTF' + String(max + 1).padStart(3, '0');
}

function catatNotifikasi_(kategori, judul, isi, idRelawan) {
  try {
    const sheet = getNotifikasiSheet();
    const id = generateIdNotifikasi_(sheet);
    sheet.appendRow([id, kategori, judul, isi, idRelawan || 'SEMUA', new Date()]);
  } catch (err) {
    // Kegagalan mencatat notifikasi tidak boleh menggagalkan aksi utama.
  }
}

function getNotifikasiRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const relawanSaya = getRelawanById(idRelawan);
  const divisiSaya = relawanSaya ? relawanSaya.divisi : '';
  const semua = sheetToObjects(getNotifikasiSheet());
  return semua
    .filter(n => cocokTargetPenerima_(n.ID_RELAWAN, idRelawan, divisiSaya))
    .map(n => ({
      id: n.ID, kategori: n.KATEGORI, judul: n.JUDUL, isi: n.ISI,
      tanggal: (n.DIBUAT_PADA instanceof Date) ? n.DIBUAT_PADA.toISOString() : String(n.DIBUAT_PADA)
    }))
    .reverse();
}

function getNotifikasiListAdmin() {
  const semua = sheetToObjects(getNotifikasiSheet());
  return semua.map(n => ({
    id: n.ID, kategori: n.KATEGORI, judul: n.JUDUL, isi: n.ISI, idRelawan: n.ID_RELAWAN,
    tanggal: (n.DIBUAT_PADA instanceof Date) ? n.DIBUAT_PADA.toISOString() : String(n.DIBUAT_PADA)
  })).reverse();
}

/** Admin membuat notifikasi Sistem manual -- SEKARANG juga diteruskan ke Push. */
function addNotifikasiSistem(body) {
  const usernameAdmin = requireAuth(body.token);
  const judul = sanitize(body.judul);
  const isi = sanitize(body.isi);
  const kategori = sanitize(body.kategori) || 'Sistem';
  const idRelawanTujuan = sanitize(body.idRelawan) || 'SEMUA';
  if (!judul) throw new Error('Judul notifikasi wajib diisi.');
  if (!isi) throw new Error('Isi notifikasi wajib diisi.');
  if (KATEGORI_NOTIFIKASI_VALID.indexOf(kategori) === -1) throw new Error('Kategori notifikasi tidak valid.');

  catatNotifikasi_(kategori, judul, isi, idRelawanTujuan);

  // Pakai helper terpusat -- paham SEMUA/DIVISI:x/individu dengan benar,
  // sama seperti yang dipakai Informasi.gs & Pengumuman.gs.
  try {
    resolveDaftarPenerimaRelawan_(idRelawanTujuan).forEach(idR =>
      kirimPushNotifikasi_(idR, '📢 ' + judul, isi, { link: '/notifikasi.html' }));
  } catch (e) { /* push notif gagal -- jangan gagalkan pencatatan notifikasi */ }

  logAudit_('BUAT_NOTIFIKASI_MANUAL', 'NOTIFIKASI', idRelawanTujuan, usernameAdmin, { judul: judul });
  return { success: true };
}


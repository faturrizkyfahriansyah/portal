/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Informasi.gs — Pusat Informasi (Modul Dashboard Relawan #4)
 */

function getInformasiSheet() {
  return getSheet(NAMA_SHEET.INFORMASI);
}

function generateIdInformasi_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^INFO(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'INFO' + String(max + 1).padStart(3, '0');
}

/**
 * FASE 8 — akses berdasarkan role, divalidasi DI SINI (server), bukan
 * cuma disembunyikan di frontend. Kolom TARGET_ROLE bersifat OPSIONAL
 * dan backward-compatible: kosong/tidak ada = tampil untuk SEMUA role
 * (perilaku lama tetap sama persis untuk data yang sudah ada).
 */
/**
 * FASE 8 (role) + TARGET PENERIMA (Semua/Divisi/Individu) — 2 DIMENSI
 * FILTER TERPISAH yang bisa digabung. roleSaya dicek terhadap TARGET_ROLE
 * (ASN/KEPALA_SPPG/RELAWAN/SEMUA), dan idRelawan/divisiSaya dicek terhadap
 * TARGET_PENERIMA (format SAMA seperti yang sudah dipakai di Jadwal.gs:
 * "SEMUA" | ID relawan spesifik | "DIVISI:NamaDivisi").
 */
function getInformasiRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  return getInformasiRelawan_(idRelawan);
}

/** Versi internal (idRelawan langsung) -- diekstrak sama seperti fungsi lain di atas, alasan sama (audit performance Dashboard). */
function getInformasiRelawan_(idRelawan) {
  const roleSaya = getRoleRelawan_(idRelawan);
  const relawanSaya = getRelawanById(idRelawan);
  const divisiSaya = relawanSaya ? relawanSaya.divisi : '';

  const semua = sheetToObjects(getInformasiSheet());
  return semua
    .filter(i => String(i.STATUS).toUpperCase() === 'AKTIF')
    .filter(i => {
      const targetRole = String(i.TARGET_ROLE || '').toUpperCase().trim();
      return !targetRole || targetRole === 'SEMUA' || targetRole === roleSaya;
    })
    .filter(i => cocokTargetPenerima_(i.TARGET_PENERIMA, idRelawan, divisiSaya))
    .map(i => ({ id: i.ID, judul: i.JUDUL, isi: i.ISI, tanggal: i.TANGGAL }))
    .reverse();
}

function getInformasiListAdmin() {
  const semua = sheetToObjects(getInformasiSheet());
  return semua.map(i => ({
    id: i.ID, judul: i.JUDUL, isi: i.ISI, tanggal: i.TANGGAL, status: i.STATUS,
    targetRole: i.TARGET_ROLE || 'SEMUA',
    targetPenerima: i.TARGET_PENERIMA || 'SEMUA'
  })).reverse();
}

function addInformasi(body) {
  const judul = sanitize(body.judul);
  const isi = sanitize(body.isi);
  const targetRole = sanitize(body.targetRole) || 'SEMUA';
  const targetPenerima = sanitize(body.targetPenerima) || 'SEMUA'; // BARU: Semua/DIVISI:x/ID relawan
  if (!judul) throw new Error('Judul wajib diisi.');
  if (!isi) throw new Error('Isi informasi wajib diisi.');
  if (['SEMUA', 'RELAWAN', 'ASN', 'KEPALA_SPPG'].indexOf(targetRole) === -1) {
    throw new Error('Target role tidak dikenali.');
  }

  const sheet = getInformasiSheet();
  const id = generateIdInformasi_(sheet);
  // TARGET_ROLE (kolom 7) dari Fase 8, TARGET_PENERIMA (kolom 8, BARU) dari
  // pembaruan ini -- keduanya ditulis di AKHIR, kolom 1-6 tidak bergeser.
  sheet.appendRow([id, judul, isi, formatTanggal(new Date()), 'AKTIF', new Date(), targetRole, targetPenerima]);

  const daftarPenerima = resolveDaftarPenerimaRelawan_(targetPenerima);
  daftarPenerima.forEach(idR => catatNotifikasi_('Informasi', judul, isi, idR));

  try {
    daftarPenerima.forEach(idR => kirimPushNotifikasi_(idR, 'ℹ️ ' + judul, isi, { link: '/informasi.html' }));
  } catch (e) { /* push notif gagal -- jangan gagalkan pembuatan informasi */ }

  return { id: id };
}

function updateInformasi(body) {
  const id = sanitize(body.id);
  const judul = sanitize(body.judul);
  const isi = sanitize(body.isi);
  if (!judul) throw new Error('Judul wajib diisi.');
  if (!isi) throw new Error('Isi informasi wajib diisi.');

  const sheet = getInformasiSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 2).setValue(judul);
      sheet.getRange(i + 1, 3).setValue(isi);
      return { success: true };
    }
  }
  throw new Error('Informasi tidak ditemukan.');
}

function updateStatusInformasi(body) {
  const id = sanitize(body.id);
  const statusBaru = sanitize(body.statusBaru).toUpperCase();
  if (statusBaru !== 'AKTIF' && statusBaru !== 'NONAKTIF') throw new Error('Status tidak valid.');

  const sheet = getInformasiSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 5).setValue(statusBaru);
      return { id: id, status: statusBaru };
    }
  }
  throw new Error('Informasi tidak ditemukan.');
}


/**
 * SIPOGIM — Padanan.gs
 * Kelola antrian padanan nama menu -> resep. Status: usulan (hasil
 * pencocokan otomatis, perlu 1 ketuk konfirmasi), belum_ada_resep
 * (tidak ada yang cocok, perlu resep baru atau pilih manual),
 * terkonfirmasi, diabaikan (sengaja tidak dihitung, mis. "Snack",
 * "Air mineral" yang tidak relevan dihitung gizi detailnya).
 */

function getPadananList(body) {
  const filter = sanitizeSipogim_(body.status || 'perlu_perhatian'); // default: usulan + belum_ada_resep
  const semua = sheetToObjectsSipogim_(getSheetSipogim_('PADANAN_NAMA'));
  const dipilih = filter === 'perlu_perhatian'
    ? semua.filter(p => p.STATUS === 'usulan' || p.STATUS === 'belum_ada_resep')
    : semua.filter(p => p.STATUS === filter);

  const semuaResep = sheetToObjectsSipogim_(getSheetSipogim_('RESEP'));
  return dipilih.map(p => {
    const resep = semuaResep.find(r => r.ID === p.RESEP_ID);
    return {
      id: p.ID, namaMenu: p.NAMA_CONTOH, namaNorm: p.NAMA_NORM, status: p.STATUS,
      resepId: p.RESEP_ID || null, namaResep: resep ? resep.NAMA : null, skor: angkaAtauNullSipogim_(p.SKOR)
    };
  }).sort((a, b) => a.namaMenu.localeCompare(b.namaMenu));
}

/**
 * Satu tindakan utk 3 kemungkinan (dibedakan dari field yg dikirim):
 * - { id, setuju:true } -> konfirmasi usulan otomatis APA ADANYA.
 * - { id, resepId } -> pasang/ganti ke resep PILIHAN MANUAL (baik dari usulan maupun belum_ada_resep).
 * - { id, abaikan:true } -> tandai diabaikan (tidak dihitung, tidak menghalangi total hari).
 */
function konfirmasiPadanan(body) {
  const namaAktor = wajibNamaSaya_(body);
  const sheet = getSheetSipogim_('PADANAN_NAMA');
  const lama = sheetToObjectsSipogim_(sheet).find(p => p.ID === body.id);
  if (!lama) throw new Error('Padanan tidak ditemukan.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let resepIdBaru = lama.RESEP_ID, statusBaru;
    if (body.abaikan) { statusBaru = 'diabaikan'; resepIdBaru = ''; }
    else if (body.resepId) {
      const resep = sheetToObjectsSipogim_(getSheetSipogim_('RESEP')).find(r => r.ID === body.resepId);
      if (!resep) throw new Error('Resep pilihan tidak ditemukan.');
      resepIdBaru = body.resepId; statusBaru = 'terkonfirmasi';
    } else if (body.setuju) {
      if (!lama.RESEP_ID) throw new Error('Tidak ada resep yang diusulkan utk dikonfirmasi.');
      statusBaru = 'terkonfirmasi';
    } else {
      throw new Error('Tindakan tidak jelas -- kirim setuju, resepId, atau abaikan.');
    }

    sheet.getRange(lama.__baris, 4, 1, 6).setValues([[resepIdBaru, statusBaru, lama.CARA, lama.SKOR, namaAktor, sekarangSipogim_()]]);
    catatRiwayatSipogim_(namaAktor, 'padanan', body.id, 'konfirmasi', { STATUS: lama.STATUS }, { STATUS: statusBaru, RESEP_ID: resepIdBaru },
      namaAktor + ' ' + (statusBaru === 'diabaikan' ? 'mengabaikan' : 'mengonfirmasi') + ' padanan "' + lama.NAMA_CONTOH + '".');
    return { id: body.id, statusBaru: statusBaru };
  } finally { lock.releaseLock(); }
}

/** Jalan pintas dari Beranda/Padanan: buat resep baru LANGSUNG dari nama menu yg belum ada resepnya. */
function buatResepDariPadanan(body) {
  const namaAktor = wajibNamaSaya_(body);
  const sheetPadanan = getSheetSipogim_('PADANAN_NAMA');
  const padanan = sheetToObjectsSipogim_(sheetPadanan).find(p => p.ID === body.id);
  if (!padanan) throw new Error('Padanan tidak ditemukan.');

  const hasilResep = tambahResep({
    token: body.token, namaSaya: body.namaSaya,
    nama: padanan.NAMA_CONTOH, kategori: sanitizeSipogim_(body.kategori), bahan: []
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheetPadanan.getRange(padanan.__baris, 4, 1, 6).setValues([[hasilResep.id, 'terkonfirmasi', 'manual', '', namaAktor, sekarangSipogim_()]]);
    catatRiwayatSipogim_(namaAktor, 'padanan', body.id, 'buat_resep', null, { resepId: hasilResep.id },
      namaAktor + ' membuat resep baru "' + padanan.NAMA_CONTOH + '" langsung dari antrian padanan.');
    return { padananId: body.id, resepId: hasilResep.id };
  } finally { lock.releaseLock(); }
}


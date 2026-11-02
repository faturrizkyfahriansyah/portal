/**
 * SIPOGIM — Bahan.gs
 * CRUD Bahan. Status AWAL bahan baru: 'draf' kalau kelima nilai gizi
 * terisi (data ada, tinggal direview), 'perlu_dicek' kalau ada yang
 * kosong (lebih mendesak -- datanya sendiri belum lengkap). Ini
 * penafsiran saya atas spesifikasi bagian 10 (tabel sumbernya sendiri
 * tidak 100% tegas soal pemicu persis) -- masuk akal dan konsisten
 * dgn aturan "lengkap" di bagian 6, tapi beri tahu saya kalau
 * maksudnya beda.
 */

function getBahanList(body) {
  const cari = normalisasiNamaSipogim_(body.cari || '');
  const semua = sheetToObjectsSipogim_(getSheetSipogim_('BAHAN'));
  return semua
    .filter(b => !cari || b.NAMA_NORM.indexOf(cari) !== -1)
    .map(b => ({
      id: b.ID, nama: b.NAMA, bentuk: b.BENTUK, status: b.STATUS,
      lengkap: apakahBahanLengkapSipogim_(b)
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

function getBahanDetail(body) {
  const b = sheetToObjectsSipogim_(getSheetSipogim_('BAHAN')).find(x => x.ID === body.id);
  if (!b) throw new Error('Bahan tidak ditemukan.');
  return {
    id: b.ID, nama: b.NAMA, bentuk: b.BENTUK, takaranG: b.TAKARAN_G,
    energiKkal: angkaAtauNullSipogim_(b.ENERGI_KKAL), proteinG: angkaAtauNullSipogim_(b.PROTEIN_G),
    lemakG: angkaAtauNullSipogim_(b.LEMAK_G), karbohidratG: angkaAtauNullSipogim_(b.KARBOHIDRAT_G),
    seratG: angkaAtauNullSipogim_(b.SERAT_G), asalData: b.ASAL_DATA, sumberCatatan: b.SUMBER_CATATAN,
    status: b.STATUS, dicekOleh: b.DICEK_OLEH, dicekPada: b.DICEK_PADA,
    versi: Number(b.VERSI || 1) // dikirim balik saat ubahBahan -- lihat catatan kunci optimis di sana
  };
}

function validasiInputBahan_(body) {
  const nama = sanitizeSipogim_(body.nama);
  if (!nama) throw new Error('Nama bahan wajib diisi.');
  const takaranG = Number(body.takaranG);
  if (!takaranG || takaranG <= 0) throw new Error('Takaran (gram) wajib diisi, lebih dari 0.');
  return { nama: nama, takaranG: takaranG };
}

function tambahBahan(body) {
  const nama_ = wajibNamaSaya_(body);
  const v = validasiInputBahan_(body);
  const namaNorm = normalisasiNamaSipogim_(v.nama);

  const sheet = getSheetSipogim_('BAHAN');
  const existing = sheetToObjectsSipogim_(sheet).find(b => b.NAMA_NORM === namaNorm);
  if (existing) throw new Error('Bahan dengan nama ini sudah ada: "' + existing.NAMA + '".');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = generateIdSipogim_('BH', sheet);
    const sekarang = sekarangSipogim_();
    const dataBaru = {
      ID: id, NAMA: v.nama, NAMA_NORM: namaNorm, BENTUK: sanitizeSipogim_(body.bentuk), TAKARAN_G: v.takaranG,
      ENERGI_KKAL: angkaAtauNullSipogim_(body.energiKkal), PROTEIN_G: angkaAtauNullSipogim_(body.proteinG),
      LEMAK_G: angkaAtauNullSipogim_(body.lemakG), KARBOHIDRAT_G: angkaAtauNullSipogim_(body.karbohidratG),
      SERAT_G: angkaAtauNullSipogim_(body.seratG), ASAL_DATA: sanitizeSipogim_(body.asalData) || 'input_manual',
      SUMBER_CATATAN: sanitizeSipogim_(body.sumberCatatan)
    };
    dataBaru.STATUS = apakahBahanLengkapSipogim_(dataBaru) ? 'draf' : 'perlu_dicek';
    sheet.appendRow([
      dataBaru.ID, dataBaru.NAMA, dataBaru.NAMA_NORM, dataBaru.BENTUK, dataBaru.TAKARAN_G,
      dataBaru.ENERGI_KKAL, dataBaru.PROTEIN_G, dataBaru.LEMAK_G, dataBaru.KARBOHIDRAT_G, dataBaru.SERAT_G,
      dataBaru.ASAL_DATA, dataBaru.SUMBER_CATATAN, dataBaru.STATUS, '', '', 1, nama_, sekarang
    ]);
    catatRiwayatSipogim_(nama_, 'bahan', id, 'tambah', null, dataBaru, nama_ + ' menambah bahan "' + v.nama + '".');
    return { id: id };
  } finally { lock.releaseLock(); }
}

function ubahBahan(body) {
  const namaAktor = wajibNamaSaya_(body);
  const sheet = getSheetSipogim_('BAHAN');
  const idx = headerIndexSipogim_(sheet);
  const semua = sheetToObjectsSipogim_(sheet);
  const lama = semua.find(b => b.ID === body.id);
  if (!lama) throw new Error('Bahan tidak ditemukan.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // PENTING (uji terima #10) -- lihat catatan serupa di Resep.gs/ubahResep.
    if (body.versi !== undefined && Number(body.versi) !== Number(lama.VERSI || 1)) {
      throw new Error('KONFLIK: Bahan ini sudah diubah orang lain sejak Anda membukanya. Muat ulang dulu sebelum menyimpan lagi.');
    }
    const kolomDataUtama = ['nama', 'bentuk', 'takaranG', 'energiKkal', 'proteinG', 'lemakG', 'karbohidratG', 'seratG'];
    const adaPerubahanData = kolomDataUtama.some(k => body[k] !== undefined);

    const sesudah = Object.assign({}, lama);
    if (body.nama !== undefined) { sesudah.NAMA = sanitizeSipogim_(body.nama); sesudah.NAMA_NORM = normalisasiNamaSipogim_(body.nama); }
    if (body.bentuk !== undefined) sesudah.BENTUK = sanitizeSipogim_(body.bentuk);
    if (body.takaranG !== undefined) sesudah.TAKARAN_G = Number(body.takaranG);
    if (body.energiKkal !== undefined) sesudah.ENERGI_KKAL = angkaAtauNullSipogim_(body.energiKkal);
    if (body.proteinG !== undefined) sesudah.PROTEIN_G = angkaAtauNullSipogim_(body.proteinG);
    if (body.lemakG !== undefined) sesudah.LEMAK_G = angkaAtauNullSipogim_(body.lemakG);
    if (body.karbohidratG !== undefined) sesudah.KARBOHIDRAT_G = angkaAtauNullSipogim_(body.karbohidratG);
    if (body.seratG !== undefined) sesudah.SERAT_G = angkaAtauNullSipogim_(body.seratG);
    if (body.sumberCatatan !== undefined) sesudah.SUMBER_CATATAN = sanitizeSipogim_(body.sumberCatatan);

    // Spesifikasi: mengubah gizi/takaran mengembalikan status ke draf BILA sebelumnya sudah_dicek.
    // Mengubah catatan saja TIDAK mengubah status.
    if (adaPerubahanData && lama.STATUS === 'sudah_dicek') sesudah.STATUS = 'draf';

    sheet.getRange(lama.__baris, 1, 1, 18).setValues([[
      sesudah.ID, sesudah.NAMA, sesudah.NAMA_NORM, sesudah.BENTUK, sesudah.TAKARAN_G,
      sesudah.ENERGI_KKAL, sesudah.PROTEIN_G, sesudah.LEMAK_G, sesudah.KARBOHIDRAT_G, sesudah.SERAT_G,
      sesudah.ASAL_DATA, sesudah.SUMBER_CATATAN, sesudah.STATUS, sesudah.DICEK_OLEH, sesudah.DICEK_PADA,
      Number(sesudah.VERSI || 1) + 1, namaAktor, sekarangSipogim_()
    ]]);
    catatRiwayatSipogim_(namaAktor, 'bahan', body.id, 'ubah', lama, sesudah, namaAktor + ' mengubah bahan "' + sesudah.NAMA + '".');
    return { id: body.id, statusBaru: sesudah.STATUS };
  } finally { lock.releaseLock(); }
}

/** Setujui bahan -- WAJIB PIN. Hanya bisa disetujui kalau datanya lengkap. */
function setujuiBahan(body) {
  const namaAktor = wajibNamaSaya_(body);
  periksaPin_(body.pin);

  const sheet = getSheetSipogim_('BAHAN');
  const lama = sheetToObjectsSipogim_(sheet).find(b => b.ID === body.id);
  if (!lama) throw new Error('Bahan tidak ditemukan.');
  if (!apakahBahanLengkapSipogim_(lama)) throw new Error('Bahan belum lengkap -- tidak bisa disetujui sebelum kelima nilai gizi terisi.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sekarang = sekarangSipogim_();
    sheet.getRange(lama.__baris, 13, 1, 3).setValues([['sudah_dicek', namaAktor, sekarang]]); // STATUS, DICEK_OLEH, DICEK_PADA
    catatRiwayatSipogim_(namaAktor, 'bahan', body.id, 'setujui', { STATUS: lama.STATUS }, { STATUS: 'sudah_dicek' }, namaAktor + ' menyetujui bahan "' + lama.NAMA + '".');
    return { id: body.id };
  } finally { lock.releaseLock(); }
}


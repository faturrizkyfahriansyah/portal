/**
 * SIPOGIM — Resep.gs
 * CRUD Resep + baris Resep_Bahan. Daftar bahan resep SELALU dikirim
 * sebagai daftar LENGKAP dari frontend (bukan diff baris per baris) --
 * baris lama utk resep itu dihapus & ditulis ulang tiap kali diubah.
 * Lebih sederhana & jauh lebih kecil kemungkinan salah drpd mencocokkan
 * baris satu-satu.
 */

function getResepList(body) {
  const cari = normalisasiNamaSipogim_(body.cari || '');
  const semua = sheetToObjectsSipogim_(getSheetSipogim_('RESEP'));
  return semua
    .filter(r => !cari || r.NAMA_NORM.indexOf(cari) !== -1)
    .map(r => ({ id: r.ID, nama: r.NAMA, kategori: r.KATEGORI, jenis: r.JENIS, status: r.STATUS }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

function getResepDetail(body) {
  const resep = sheetToObjectsSipogim_(getSheetSipogim_('RESEP')).find(r => r.ID === body.id);
  if (!resep) throw new Error('Resep tidak ditemukan.');

  const semuaBahan = sheetToObjectsSipogim_(getSheetSipogim_('BAHAN'));
  const baris = sheetToObjectsSipogim_(getSheetSipogim_('RESEP_BAHAN'))
    .filter(rb => rb.RESEP_ID === body.id)
    .sort((a, b) => (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0))
    .map(rb => {
      const b = semuaBahan.find(x => x.ID === rb.BAHAN_ID);
      return {
        bahanId: rb.BAHAN_ID, namaBahan: b ? b.NAMA : '(bahan terhapus)',
        gramBesar: angkaAtauNullSipogim_(rb.GRAM_BESAR), gramKecil: angkaAtauNullSipogim_(rb.GRAM_KECIL),
        bahanLengkap: b ? apakahBahanLengkapSipogim_(b) : false
      };
    });

  const hasilBesar = hitungGiziResep_(body.id, 'besar');
  const hasilKecil = hitungGiziResep_(body.id, 'kecil');

  return {
    id: resep.ID, nama: resep.NAMA, kategori: resep.KATEGORI, jenis: resep.JENIS,
    status: resep.STATUS, catatan: resep.CATATAN, dicekOleh: resep.DICEK_OLEH, dicekPada: resep.DICEK_PADA,
    bahan: baris, giziBesar: hasilBesar, giziKecil: hasilKecil,
    versi: Number(resep.VERSI || 1) // dikirim balik saat ubahResep -- lihat catatan kunci optimis di sana
  };
}

function simpanBarisResepBahan_(resepId, bahanList) {
  const sheet = getSheetSipogim_('RESEP_BAHAN');
  const semua = sheetToObjectsSipogim_(sheet);
  const barisLama = semua.filter(rb => rb.RESEP_ID === resepId);
  // Hapus dari bawah ke atas supaya nomor baris sisanya tidak bergeser di tengah penghapusan.
  barisLama.sort((a, b) => b.__baris - a.__baris).forEach(rb => sheet.deleteRow(rb.__baris));

  bahanList.forEach((bl, i) => {
    const id = Utilities.getUuid();
    sheet.appendRow([id, resepId, bl.bahanId, angkaAtauNullSipogim_(bl.gramBesar), angkaAtauNullSipogim_(bl.gramKecil), i + 1, sanitizeSipogim_(bl.catatan)]);
  });
}

function tambahResep(body) {
  const namaAktor = wajibNamaSaya_(body);
  const nama = sanitizeSipogim_(body.nama);
  if (!nama) throw new Error('Nama resep wajib diisi.');
  const bahanList = Array.isArray(body.bahan) ? body.bahan : [];

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheetSipogim_('RESEP');
    const id = generateIdSipogim_('RS', sheet);
    const namaNorm = normalisasiNamaSipogim_(nama);
    sheet.appendRow([
      id, nama, namaNorm, sanitizeSipogim_(body.kategori), sanitizeSipogim_(body.jenis), 'draf',
      '', '', sanitizeSipogim_(body.catatan), 1, namaAktor, sekarangSipogim_()
    ]);
    simpanBarisResepBahan_(id, bahanList);
    catatRiwayatSipogim_(namaAktor, 'resep', id, 'tambah', null, { nama: nama, jumlahBahan: bahanList.length }, namaAktor + ' menambah resep "' + nama + '".');
    return { id: id };
  } finally { lock.releaseLock(); }
}

function ubahResep(body) {
  const namaAktor = wajibNamaSaya_(body);
  const sheet = getSheetSipogim_('RESEP');
  const lama = sheetToObjectsSipogim_(sheet).find(r => r.ID === body.id);
  if (!lama) throw new Error('Resep tidak ditemukan.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // PENTING (uji terima #10): kunci optimis -- frontend WAJIB kirim
    // versi yg terakhir dilihatnya (dari getResepDetail). Kalau sudah
    // beda dgn versi sungguhan SEKARANG di sheet, berarti ada orang lain
    // yg menyimpan perubahan di antara saat form dibuka dan disimpan --
    // tolak, JANGAN menimpa punya orang itu. Dicek di DALAM LockService
    // (baca+tulis sbg satu langkah) supaya 2 permintaan yg datang nyaris
    // bersamaan tidak bisa sama-sama lolos.
    if (body.versi !== undefined && Number(body.versi) !== Number(lama.VERSI || 1)) {
      throw new Error('KONFLIK: Resep ini sudah diubah orang lain sejak Anda membukanya. Muat ulang dulu sebelum menyimpan lagi.');
    }

    const sesudah = Object.assign({}, lama);
    if (body.nama !== undefined) { sesudah.NAMA = sanitizeSipogim_(body.nama); sesudah.NAMA_NORM = normalisasiNamaSipogim_(body.nama); }
    if (body.kategori !== undefined) sesudah.KATEGORI = sanitizeSipogim_(body.kategori);
    if (body.jenis !== undefined) sesudah.JENIS = sanitizeSipogim_(body.jenis);
    if (body.catatan !== undefined) sesudah.CATATAN = sanitizeSipogim_(body.catatan);

    // Spesifikasi: ubah gram / tambah-hapus bahan -> status kembali draf bila
    // sebelumnya sudah_dicek. Ubah catatan saja TIDAK mengubah status.
    const bahanBerubah = body.bahan !== undefined;
    if (bahanBerubah && lama.STATUS === 'sudah_dicek') sesudah.STATUS = 'draf';

    sheet.getRange(lama.__baris, 1, 1, 12).setValues([[
      sesudah.ID, sesudah.NAMA, sesudah.NAMA_NORM, sesudah.KATEGORI, sesudah.JENIS, sesudah.STATUS,
      sesudah.DICEK_OLEH, sesudah.DICEK_PADA, sesudah.CATATAN, Number(sesudah.VERSI || 1) + 1, namaAktor, sekarangSipogim_()
    ]]);
    if (bahanBerubah) simpanBarisResepBahan_(body.id, body.bahan);

    catatRiwayatSipogim_(namaAktor, 'resep', body.id, 'ubah', lama, sesudah, namaAktor + ' mengubah resep "' + sesudah.NAMA + '".');
    return { id: body.id, statusBaru: sesudah.STATUS };
  } finally { lock.releaseLock(); }
}

function duplikatResep(body) {
  const namaAktor = wajibNamaSaya_(body);
  const resepSheet = getSheetSipogim_('RESEP');
  const asli = sheetToObjectsSipogim_(resepSheet).find(r => r.ID === body.id);
  if (!asli) throw new Error('Resep sumber tidak ditemukan.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = generateIdSipogim_('RS', resepSheet);
    const namaBaru = asli.NAMA + ' (salinan)';
    resepSheet.appendRow([
      id, namaBaru, normalisasiNamaSipogim_(namaBaru), asli.KATEGORI, asli.JENIS, 'draf',
      '', '', asli.CATATAN, 1, namaAktor, sekarangSipogim_()
    ]);
    const barisAsli = sheetToObjectsSipogim_(getSheetSipogim_('RESEP_BAHAN')).filter(rb => rb.RESEP_ID === body.id);
    simpanBarisResepBahan_(id, barisAsli.map(rb => ({ bahanId: rb.BAHAN_ID, gramBesar: rb.GRAM_BESAR, gramKecil: rb.GRAM_KECIL, catatan: rb.CATATAN })));
    catatRiwayatSipogim_(namaAktor, 'resep', id, 'duplikat', null, { dariId: body.id }, namaAktor + ' menduplikat resep "' + asli.NAMA + '" menjadi "' + namaBaru + '".');
    return { id: id };
  } finally { lock.releaseLock(); }
}

/** Setujui resep -- WAJIB PIN. Hanya bisa kalau KEDUA jenis porsi (besar & kecil) lengkap. */
function setujuiResep(body) {
  const namaAktor = wajibNamaSaya_(body);
  periksaPin_(body.pin);

  const sheet = getSheetSipogim_('RESEP');
  const lama = sheetToObjectsSipogim_(sheet).find(r => r.ID === body.id);
  if (!lama) throw new Error('Resep tidak ditemukan.');

  const besar = hitungGiziResep_(body.id, 'besar');
  const kecil = hitungGiziResep_(body.id, 'kecil');
  if (!besar.lengkap || !kecil.lengkap) {
    throw new Error('Resep belum lengkap (porsi besar dan kecil harus lengkap keduanya) -- tidak bisa disetujui.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sekarang = sekarangSipogim_();
    sheet.getRange(lama.__baris, 6, 1, 3).setValues([['sudah_dicek', namaAktor, sekarang]]); // STATUS, DICEK_OLEH, DICEK_PADA
    catatRiwayatSipogim_(namaAktor, 'resep', body.id, 'setujui', { STATUS: lama.STATUS }, { STATUS: 'sudah_dicek' }, namaAktor + ' menyetujui resep "' + lama.NAMA + '".');
    return { id: body.id };
  } finally { lock.releaseLock(); }
}


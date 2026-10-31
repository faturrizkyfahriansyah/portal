/**
 * SIPANDU — SipanduPersiapanPengolahan.gs
 * Persiapan & Pengolahan (§9) -- masing-masing bisa punya BANYAK baris
 * per Work Order (1 baris = 1 bahan/kegiatan), beda dari Work Order/Menu
 * yang 1 baris = 1 entitas utuh.
 */

// ------------------------------------------------------------
// PERSIAPAN
// ------------------------------------------------------------

function getPreparationList(token, idWo) {
  requireSipanduPermission_(token, 'preparation.view');
  idWo = sipanduSanitize(idWo);
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PREPARATION))
    .filter(p => p.ID_WO === idWo)
    .map(p => ({
      id: p.ID_PREPARATION,
      bahan: p.BAHAN,
      jumlah: Number(p.JUMLAH) || 0,
      satuan: p.SATUAN,
      waktu: p.WAKTU,
      pic: p.PIC,
      status: p.STATUS,
      catatan: p.CATATAN || ''
    }));
}

function addPreparationItem(body) {
  const akses = requireSipanduPermission_(body.token, 'preparation.edit');
  const idWo = sipanduSanitize(body.idWo);
  const bahan = sipanduSanitize(body.bahan);
  if (!idWo) throw new Error('Work Order wajib dipilih.');
  if (!bahan) throw new Error('Nama bahan wajib diisi.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.PREPARATION);
  const id = generateSipanduId_(sheet, 'PRP', 'ID_PREPARATION');
  sheet.appendRow([
    id, idWo, bahan, Number(body.jumlah) || 0, sipanduSanitize(body.satuan),
    sipanduSanitize(body.waktu), sipanduSanitize(body.pic) || akses.nama,
    sipanduSanitize(body.status) || 'BELUM_MULAI', sipanduSanitize(body.catatan),
    akses.nama, new Date()
  ]);

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'PREPARATION', idWo, akses, 'SUKSES', { bahan: bahan });
  return { id: id };
}

function updatePreparationItem(body) {
  const akses = requireSipanduPermission_(body.token, 'preparation.edit');
  const sheet = getSipanduSheet(SIPANDU_SHEET.PREPARATION);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_PREPARATION]) === sipanduSanitize(body.id)) {
      if (body.jumlah !== undefined) sheet.getRange(i + 1, idx.JUMLAH + 1).setValue(Number(body.jumlah) || 0);
      if (body.satuan !== undefined) sheet.getRange(i + 1, idx.SATUAN + 1).setValue(sipanduSanitize(body.satuan));
      if (body.status !== undefined) sheet.getRange(i + 1, idx.STATUS + 1).setValue(sipanduSanitize(body.status));
      if (body.catatan !== undefined) sheet.getRange(i + 1, idx.CATATAN + 1).setValue(sipanduSanitize(body.catatan));
      logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'PREPARATION', data[i][idx.ID_WO], akses, 'SUKSES', body);
      return { success: true };
    }
  }
  throw new Error('Data Persiapan tidak ditemukan.');
}

// ------------------------------------------------------------
// PENGOLAHAN
// ------------------------------------------------------------

function getProcessingList(token, idWo) {
  requireSipanduPermission_(token, 'processing.view');
  idWo = sipanduSanitize(idWo);
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PROCESSING))
    .filter(p => p.ID_WO === idWo)
    .map(p => ({
      id: p.ID_PROCESSING,
      kegiatan: p.KEGIATAN,
      bahan: p.BAHAN,
      jumlah: Number(p.JUMLAH) || 0,
      satuan: p.SATUAN,
      waktu: p.WAKTU,
      pic: p.PIC,
      status: p.STATUS,
      catatan: p.CATATAN || ''
    }));
}

function addProcessingItem(body) {
  const akses = requireSipanduPermission_(body.token, 'processing.edit');
  const idWo = sipanduSanitize(body.idWo);
  const kegiatan = sipanduSanitize(body.kegiatan);
  if (!idWo) throw new Error('Work Order wajib dipilih.');
  if (!kegiatan) throw new Error('Nama kegiatan wajib diisi.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.PROCESSING);
  const id = generateSipanduId_(sheet, 'PRC', 'ID_PROCESSING');
  sheet.appendRow([
    id, idWo, kegiatan, sipanduSanitize(body.bahan), Number(body.jumlah) || 0, sipanduSanitize(body.satuan),
    sipanduSanitize(body.waktu), sipanduSanitize(body.pic) || akses.nama,
    sipanduSanitize(body.status) || 'BELUM_MULAI', sipanduSanitize(body.catatan),
    akses.nama, new Date()
  ]);

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'PROCESSING', idWo, akses, 'SUKSES', { kegiatan: kegiatan });
  return { id: id };
}

function updateProcessingItem(body) {
  const akses = requireSipanduPermission_(body.token, 'processing.edit');
  const sheet = getSipanduSheet(SIPANDU_SHEET.PROCESSING);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_PROCESSING]) === sipanduSanitize(body.id)) {
      if (body.jumlah !== undefined) sheet.getRange(i + 1, idx.JUMLAH + 1).setValue(Number(body.jumlah) || 0);
      if (body.satuan !== undefined) sheet.getRange(i + 1, idx.SATUAN + 1).setValue(sipanduSanitize(body.satuan));
      if (body.status !== undefined) sheet.getRange(i + 1, idx.STATUS + 1).setValue(sipanduSanitize(body.status));
      if (body.catatan !== undefined) sheet.getRange(i + 1, idx.CATATAN + 1).setValue(sipanduSanitize(body.catatan));
      logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'PROCESSING', data[i][idx.ID_WO], akses, 'SUKSES', body);
      return { success: true };
    }
  }
  throw new Error('Data Pengolahan tidak ditemukan.');
}


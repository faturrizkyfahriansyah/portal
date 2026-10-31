/**
 * SIPANDU — SipanduWorkOrder.gs
 * Work Order adalah PUSAT seluruh data operasional SIPANDU (§4).
 *
 * CATATAN ARSITEKTUR: Google Sheets tidak punya trigger otomatis seperti
 * database sungguhan (Postgres). Karena itu audit log & validasi di sini
 * ditulis EKSPLISIT di setiap fungsi (lewat logSipanduAudit_()) -- BUKAN
 * otomatis. Kalau nanti nambah fungsi baru yang mengubah data penting,
 * WAJIB ingat panggil logSipanduAudit_() juga, tidak akan tercatat sendiri.
 */

// ------------------------------------------------------------
// WORK ORDER — CRUD
// ------------------------------------------------------------

function getWorkOrderList(token, filter) {
  requireSipanduPermission_(token, 'wo.view');
  filter = filter || {};

  const menuMap = {};
  sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.MENU)).forEach(m => { menuMap[m.ID_MENU] = m.NAMA_MENU; });

  let list = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS));
  if (filter.status) list = list.filter(w => w.STATUS === filter.status);
  if (filter.tanggal) list = list.filter(w => w.TANGGAL === filter.tanggal);

  return list.map(w => ({
    id: w.ID_WO,
    nomorWO: w.NOMOR_WO,
    tanggal: w.TANGGAL,
    status: w.STATUS,
    jumlahPorsi: Number(w.JUMLAH_PORSI) || 0,
    idMenu: w.ID_MENU,
    namaMenu: menuMap[w.ID_MENU] || '-',
    catatan: w.CATATAN || ''
  })).sort((a, b) => b.nomorWO.localeCompare(a.nomorWO));
}

function getWorkOrderDetail(token, idWo) {
  requireSipanduPermission_(token, 'wo.view');
  idWo = sipanduSanitize(idWo);

  const wo = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS)).find(w => w.ID_WO === idWo);
  if (!wo) throw new Error('Work Order tidak ditemukan.');

  const menu = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.MENU)).find(m => m.ID_MENU === wo.ID_MENU);

  const beneficiaries = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.BENEFICIARIES)).filter(b => b.ID_WO === idWo);
  const totalPenerimaManfaat = beneficiaries.reduce((sum, b) => sum + (Number(b.TOTAL) || 0), 0);

  const validasi = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.VALIDATION)).find(v => v.ID_WO === idWo);

  return {
    id: wo.ID_WO,
    nomorWO: wo.NOMOR_WO,
    tanggal: wo.TANGGAL,
    status: wo.STATUS,
    jumlahPorsi: Number(wo.JUMLAH_PORSI) || 0,
    idMenu: wo.ID_MENU,
    namaMenu: menu ? menu.NAMA_MENU : '-',
    catatan: wo.CATATAN || '',
    totalPenerimaManfaat: totalPenerimaManfaat,
    jumlahLokasiPenerima: beneficiaries.length,
    validasi: validasi ? { isReady: String(validasi.IS_READY).toUpperCase() === 'TRUE', divalidasiOleh: validasi.DIVALIDASI_OLEH || '' } : null,
    dibuatOleh: wo.DIBUAT_OLEH,
    dibuatPada: wo.DIBUAT_PADA
  };
}

function addWorkOrder(body) {
  const akses = requireSipanduPermission_(body.token, 'wo.create');
  const tanggal = sipanduSanitize(body.tanggal); // format YYYY-MM-DD dari <input type=date>
  const idMenu = sipanduSanitize(body.idMenu);
  const jumlahPorsi = Number(body.jumlahPorsi) || 0;

  if (!tanggal) throw new Error('Tanggal Work Order wajib diisi.');
  if (jumlahPorsi < 0) throw new Error('Jumlah porsi tidak boleh negatif.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS);
  const tanggalYMD = tanggal.replace(/-/g, '');
  const nomorWO = generateNomorWO_(sheet, tanggalYMD);
  const id = generateSipanduId_(sheet, 'WO', 'ID_WO');
  const now = new Date();

  sheet.appendRow([
    id, nomorWO, tanggal, 'DRAFT', jumlahPorsi, idMenu, sipanduSanitize(body.catatan),
    akses.nama, now, akses.nama, now, '', ''
  ]);

  logSipanduAudit_('CREATE_WO', 'WORK_ORDER', id, akses, 'SUKSES', { nomorWO: nomorWO });

  // Work Order baru dimulai dari tahap Persiapan -- beri tahu Koordinator
  // Persiapan supaya bisa langsung ditindaklanjuti.
  cariUserSipanduByRole_('KOORDINATOR_PERSIAPAN').forEach(idRelawan => {
    antrikanPushKePortal_(idRelawan, '📋 Work Order Baru', 'WO ' + nomorWO + ' (' + jumlahPorsi + ' porsi) untuk tanggal ' + tanggal + ' siap diproses.', '/sipandu.html');
  });
  return { id: id, nomorWO: nomorWO };
}

function updateWorkOrder(body) {
  const akses = requireSipanduPermission_(body.token, 'wo.edit');
  const idWo = sipanduSanitize(body.id);
  const jumlahPorsiBaru = body.jumlahPorsi !== undefined ? Number(body.jumlahPorsi) : null;

  const sheet = getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_WO]) === idWo) {
      // PERBATASAN (§ sama seperti versi Supabase): jumlah_porsi butuh
      // permission TERPISAH dari wo.edit biasa, ditegakkan di sini secara
      // eksplisit -- BUKAN cuma disembunyikan di frontend.
      if (jumlahPorsiBaru !== null && jumlahPorsiBaru !== Number(data[i][idx.JUMLAH_PORSI])) {
        try {
          requireSipanduPermission_(body.token, 'wo.edit_jumlah_porsi');
        } catch (e) {
          throw new Error('Anda tidak memiliki izin (wo.edit_jumlah_porsi) untuk mengubah jumlah porsi.');
        }
        if (jumlahPorsiBaru < 0) throw new Error('Jumlah porsi tidak boleh negatif.');
        sheet.getRange(i + 1, idx.JUMLAH_PORSI + 1).setValue(jumlahPorsiBaru);
      }

      if (body.idMenu !== undefined) sheet.getRange(i + 1, idx.ID_MENU + 1).setValue(sipanduSanitize(body.idMenu));
      if (body.catatan !== undefined) sheet.getRange(i + 1, idx.CATATAN + 1).setValue(sipanduSanitize(body.catatan));
      sheet.getRange(i + 1, idx.DIUBAH_OLEH + 1).setValue(akses.nama);
      sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(new Date());

      if (typeof tandaiSnapshotStale_ === 'function') tandaiSnapshotStale_(idWo);
      logSipanduAudit_('UPDATE_WO', 'WORK_ORDER', idWo, akses, 'SUKSES', body);
      return { success: true };
    }
  }
  throw new Error('Work Order tidak ditemukan.');
}

// ------------------------------------------------------------
// TRANSISI STATUS — satu-satunya jalur resmi ubah status (§5)
// ------------------------------------------------------------

function advanceWorkOrderStatus(body) {
  const akses = requireSipanduPermission_(body.token, 'wo.edit');
  const idWo = sipanduSanitize(body.id);
  const targetStatus = sipanduSanitize(body.targetStatus);

  const sheet = getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  let baris = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_WO]) === idWo) { baris = i; break; }
  }
  if (baris === -1) throw new Error('Work Order tidak ditemukan.');

  const statusSekarang = data[baris][idx.STATUS];
  const jumlahPorsi = Number(data[baris][idx.JUMLAH_PORSI]) || 0;
  const idMenuWo = data[baris][idx.ID_MENU];

  let diizinkan = false;

  if (statusSekarang === 'DRAFT' && targetStatus === 'DATA_LENGKAP') {
    if (!idMenuWo || jumlahPorsi <= 0) {
      throw new Error('Data Work Order belum lengkap (menu/jumlah porsi).');
    }
    const jumlahPenerima = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.BENEFICIARIES))
      .filter(b => b.ID_WO === idWo).length;
    if (jumlahPenerima === 0) throw new Error('Penerima manfaat belum diisi.');
    diizinkan = true;

  } else if (statusSekarang === 'DATA_LENGKAP' && targetStatus === 'READY') {
    const validasi = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.VALIDATION)).find(v => v.ID_WO === idWo);
    if (!validasi || String(validasi.IS_READY).toUpperCase() !== 'TRUE') {
      throw new Error('Work Order belum dinyatakan siap lewat proses Validasi.');
    }
    diizinkan = true;

  } else if (statusSekarang === 'READY' && targetStatus === 'POP_FILLED') {
    requireSipanduPermission_(body.token, 'pop.fill');
    const snapshots = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.POP_SNAPSHOT))
      .filter(s => s.ID_WO === idWo)
      .sort((a, b) => String(b.DIBUAT_PADA).localeCompare(String(a.DIBUAT_PADA)));
    if (!snapshots.length) throw new Error('Snapshot POP belum tersedia untuk Work Order ini.');
    if (String(snapshots[0].STATUS).toUpperCase() === 'STALE') {
      throw new Error('Snapshot POP sudah usang (data sumber berubah) -- generate ulang POP sebelum lanjut.');
    }
    diizinkan = true;

  } else if (statusSekarang === 'POP_FILLED' && targetStatus === 'COMPLETED') {
    const logSelesai = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.POP_FILL_LOG))
      .some(l => l.ID_WO === idWo && l.STATUS === 'COMPLETED');
    if (!logSelesai) throw new Error('POP belum dikonfirmasi selesai.');
    diizinkan = true;
  }

  if (!diizinkan) {
    throw new Error('Transisi status ' + statusSekarang + ' -> ' + targetStatus + ' tidak diizinkan.');
  }

  sheet.getRange(baris + 1, idx.STATUS + 1).setValue(targetStatus);
  sheet.getRange(baris + 1, idx.DIUBAH_OLEH + 1).setValue(akses.nama);
  sheet.getRange(baris + 1, idx.DIUBAH_PADA + 1).setValue(new Date());
  if (targetStatus === 'READY') {
    sheet.getRange(baris + 1, idx.DIVALIDASI_OLEH + 1).setValue(akses.nama);
    sheet.getRange(baris + 1, idx.DIVALIDASI_PADA + 1).setValue(new Date());
  }

  logSipanduAudit_('CHANGE_WO_STATUS', 'WORK_ORDER', idWo, akses, 'SUKSES', { dari: statusSekarang, ke: targetStatus });
  return { success: true, statusBaru: targetStatus };
}

// ------------------------------------------------------------
// AUDIT LOG — ditulis EKSPLISIT (lihat catatan arsitektur di atas file)
// ------------------------------------------------------------

function logSipanduAudit_(aksi, modul, idWo, akses, hasil, detail) {
  try {
    const sheet = getSipanduSheet(SIPANDU_SHEET.AUDIT_LOG);
    const id = generateSipanduId_(sheet, 'AUD', 'ID_AUDIT');
    sheet.appendRow([
      id, aksi, modul, idWo || '', akses ? akses.idUser : '', new Date(), hasil,
      JSON.stringify(detail || {})
    ]);
  } catch (e) {
    // Audit log gagal ditulis TIDAK BOLEH menggagalkan aksi utama pengguna --
    // tapi ini serius, jadi dicatat lewat Logger biar kelihatan di execution log.
    Logger.log('GAGAL menulis audit log: ' + e.message);
  }
}


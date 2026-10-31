/**
 * SIPANDU — SipanduPemorsianDistribusiCuci.gs
 * Pemorsian, Distribusi (armada + tujuan), Cuci Ompreng (§9).
 * Nama tampilan UI tetap "Cuci Ompreng" -- role terkait "Koordinator Cuci
 * Ompreng", BUKAN "Koordinator Ompreng".
 */

// ------------------------------------------------------------
// PEMORSIAN
// ------------------------------------------------------------

function getPortioningList(token, idWo) {
  requireSipanduPermission_(token, 'portioning.view');
  idWo = sipanduSanitize(idWo);
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PORTIONING))
    .filter(p => p.ID_WO === idWo)
    .map(p => ({
      id: p.ID_PORTIONING,
      sesi: p.SESI,
      target: Number(p.TARGET) || 0,
      jumlahSelesai: Number(p.JUMLAH_SELESAI) || 0,
      waktuMulai: p.WAKTU_MULAI,
      waktuSelesai: p.WAKTU_SELESAI,
      pic: p.PIC,
      status: p.STATUS
    }));
}

function addPortioningSesi(body) {
  const akses = requireSipanduPermission_(body.token, 'portioning.edit');
  const idWo = sipanduSanitize(body.idWo);
  if (!idWo) throw new Error('Work Order wajib dipilih.');

  const target = Math.max(0, Number(body.target) || 0);
  const sheet = getSipanduSheet(SIPANDU_SHEET.PORTIONING);
  const id = generateSipanduId_(sheet, 'PTS', 'ID_PORTIONING');
  sheet.appendRow([
    id, idWo, sipanduSanitize(body.sesi) || 'Sesi 1', target, 0,
    sipanduSanitize(body.waktuMulai), '', sipanduSanitize(body.pic) || akses.nama,
    'BELUM_MULAI', akses.nama, new Date()
  ]);

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'PORTIONING', idWo, akses, 'SUKSES', { sesi: body.sesi });
  return { id: id };
}

function updatePortioningSesi(body) {
  const akses = requireSipanduPermission_(body.token, 'portioning.edit');
  const sheet = getSipanduSheet(SIPANDU_SHEET.PORTIONING);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_PORTIONING]) === sipanduSanitize(body.id)) {
      if (body.jumlahSelesai !== undefined) sheet.getRange(i + 1, idx.JUMLAH_SELESAI + 1).setValue(Math.max(0, Number(body.jumlahSelesai) || 0));
      if (body.waktuSelesai !== undefined) sheet.getRange(i + 1, idx.WAKTU_SELESAI + 1).setValue(sipanduSanitize(body.waktuSelesai));
      if (body.status !== undefined) sheet.getRange(i + 1, idx.STATUS + 1).setValue(sipanduSanitize(body.status));
      logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'PORTIONING', data[i][idx.ID_WO], akses, 'SUKSES', body);
      return { success: true };
    }
  }
  throw new Error('Data Pemorsian tidak ditemukan.');
}

// ------------------------------------------------------------
// DISTRIBUSI (armada/ritase + daftar tujuan per armada)
// ------------------------------------------------------------
// DISTRIBUSI — direvisi mengikuti alur POP BGN asli (Bab 5 manual):
// Fase 1 Pengiriman (Berangkat -> Diterima) + Fase 2 Pengambilan
// (Dijadwalkan -> Berangkat -> Kembali ke SPPG), lengkap dengan foto
// di tiap titik konfirmasi -- BUKAN lagi model sederhana 1-status.
//
// Alur status per tujuan (DISTRIBUTION_STOPS.STATUS):
//   DITUGASKAN -> BERANGKAT -> DITERIMA -> PENGAMBILAN_DIJADWALKAN
//   -> PENGAMBILAN_BERANGKAT -> SELESAI
// ------------------------------------------------------------

/** Upload foto operasional (dipakai bersama semua titik foto Distribusi/Cuci). */
function _sipanduOrCreateFolder_(parent, nama) {
  const it = parent.getFoldersByName(nama);
  if (it.hasNext()) return it.next();
  return parent.createFolder(nama);
}

function _sipanduUnggahFoto_(fotoBase64, prefix) {
  if (!fotoBase64) return null;
  const cocok = String(fotoBase64).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!cocok) throw new Error('Format foto tidak dikenali.');
  const blob = Utilities.newBlob(Utilities.base64Decode(cocok[2]), 'image/' + cocok[1], prefix + '-' + Date.now() + '.jpg');
  const root = DriveApp.getRootFolder();
  const folder = _sipanduOrCreateFolder_(root, 'FOTO_OPERASIONAL_SIPANDU');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1000';
}

function getDistributionList(token, idWo) {
  requireSipanduPermission_(token, 'distribution.view');
  idWo = sipanduSanitize(idWo);

  const routes = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.DISTRIBUTION)).filter(r => r.ID_WO === idWo);
  const allStops = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.DISTRIBUTION_STOPS));

  return routes.map(r => ({
    id: r.ID_DISTRIBUTION,
    namaKurir: r.NAMA_KURIR,
    platKendaraan: r.KENDARAAN,
    tujuan: allStops
      .filter(s => s.ID_DISTRIBUTION === r.ID_DISTRIBUTION)
      .sort((a, b) => (Number(a.URUTAN) || 0) - (Number(b.URUTAN) || 0))
      .map(s => ({
        id: s.ID_STOP,
        namaTujuan: s.NAMA_TUJUAN,
        jumlahPorsiBesar: Number(s.JUMLAH_PORSI_BESAR) || 0,
        jumlahPorsiKecil: Number(s.JUMLAH_PORSI_KECIL) || 0,
        jam: s.JAM,
        batasWaktu: s.BATAS_WAKTU || '',
        catatan: s.CATATAN || '',
        status: s.STATUS,
        fotoSebelumKirim: s.FOTO_SEBELUM_KIRIM || null,
        waktuBerangkat: s.WAKTU_BERANGKAT || '',
        waktuDiterima: s.WAKTU_DITERIMA || '',
        fotoDiterima: s.FOTO_DITERIMA || null,
        jumlahOmprengAmbil: s.JUMLAH_OMPRENG_DIAMBIL || '',
        namaKurirAmbil: s.NAMA_KURIR_AMBIL || '',
        platKurirAmbil: s.PLAT_KURIR_AMBIL || '',
        waktuDijadwalkanAmbil: s.WAKTU_DIJADWALKAN_AMBIL || '',
        waktuBerangkatAmbil: s.WAKTU_BERANGKAT_AMBIL || '',
        fotoSaatAmbil: s.FOTO_SAAT_AMBIL || null,
        waktuKembaliSppg: s.WAKTU_KEMBALI_SPPG || '',
        fotoSaatKembali: s.FOTO_SAAT_KEMBALI || null
      }))
  }));
}

function addDistributionRoute(body) {
  const akses = requireSipanduPermission_(body.token, 'distribution.edit');
  const idWo = sipanduSanitize(body.idWo);
  if (!idWo) throw new Error('Work Order wajib dipilih.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.DISTRIBUTION);
  const id = generateSipanduId_(sheet, 'DST', 'ID_DISTRIBUTION');
  sheet.appendRow([id, idWo, sipanduSanitize(body.namaKurir), sipanduSanitize(body.platKendaraan), akses.nama, new Date()]);

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'DISTRIBUTION', idWo, akses, 'SUKSES', { namaKurir: body.namaKurir });
  return { id: id };
}

function addDistributionStop(body) {
  const akses = requireSipanduPermission_(body.token, 'distribution.edit');
  const idDistribution = sipanduSanitize(body.idDistribution);
  const namaTujuan = sipanduSanitize(body.namaTujuan);
  if (!idDistribution) throw new Error('Armada/ritase wajib dipilih.');
  if (!namaTujuan) throw new Error('Nama tujuan wajib diisi.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.DISTRIBUTION_STOPS);
  const id = generateSipanduId_(sheet, 'STP', 'ID_STOP');
  const urutan = sipanduSheetToObjects(sheet).filter(s => s.ID_DISTRIBUTION === idDistribution).length + 1;

  sheet.appendRow([
    id, idDistribution, namaTujuan,
    Math.max(0, Number(body.jumlahPorsiBesar) || 0), Math.max(0, Number(body.jumlahPorsiKecil) || 0),
    sipanduSanitize(body.jam), sipanduSanitize(body.batasWaktu), urutan, sipanduSanitize(body.catatan),
    'DITUGASKAN',
    '', '', '', '',  // fase 1: foto sebelum kirim, waktu berangkat, waktu diterima, foto diterima
    '', '', '', '', '', '', '', '',  // fase 2: jumlah ambil, kurir ambil, plat ambil, dijadwalkan, berangkat ambil, foto ambil, kembali, foto kembali
    akses.nama, new Date()
  ]);

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'DISTRIBUTION_STOPS', idDistribution, akses, 'SUKSES', { namaTujuan: namaTujuan });
  return { id: id };
}

/** Helper internal: cari baris ID_STOP di sheet DISTRIBUTION_STOPS, kembalikan {sheet, baris, idx, idDistribution}. */
function _cariBarisStop_(idStop) {
  const sheet = getSipanduSheet(SIPANDU_SHEET.DISTRIBUTION_STOPS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_STOP]) === idStop) {
      return { sheet: sheet, baris: i + 1, idx: idx, idDistribution: data[i][idx.ID_DISTRIBUTION] };
    }
  }
  throw new Error('Tujuan distribusi tidak ditemukan.');
}

/** Fase 1 langkah 1: kurir berangkat menuju lokasi (§5.3.1 POP). */
function catatPengirimanBerangkat(body) {
  const akses = requireSipanduPermission_(body.token, 'distribution.edit');
  const info = _cariBarisStop_(sipanduSanitize(body.id));
  const fotoUrl = _sipanduUnggahFoto_(body.fotoSebelumKirim, 'kirim-berangkat');

  if (fotoUrl) info.sheet.getRange(info.baris, info.idx.FOTO_SEBELUM_KIRIM + 1).setValue(fotoUrl);
  info.sheet.getRange(info.baris, info.idx.WAKTU_BERANGKAT + 1).setValue(sipanduSanitize(body.waktuBerangkat) || new Date().toISOString());
  info.sheet.getRange(info.baris, info.idx.STATUS + 1).setValue('BERANGKAT');

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'DISTRIBUTION_STOPS', info.idDistribution, akses, 'SUKSES', { fase: 'kurir_berangkat' });
  return { success: true };
}

/** Fase 1 langkah 2: konfirmasi sampai & diterima di tujuan (§5.3.1 POP). */
function catatPengirimanSampai(body) {
  const akses = requireSipanduPermission_(body.token, 'distribution.edit');
  const info = _cariBarisStop_(sipanduSanitize(body.id));
  const fotoUrl = _sipanduUnggahFoto_(body.fotoDiterima, 'kirim-diterima');

  info.sheet.getRange(info.baris, info.idx.WAKTU_DITERIMA + 1).setValue(sipanduSanitize(body.waktuDiterima) || new Date().toISOString());
  if (fotoUrl) info.sheet.getRange(info.baris, info.idx.FOTO_DITERIMA + 1).setValue(fotoUrl);
  info.sheet.getRange(info.baris, info.idx.STATUS + 1).setValue('DITERIMA');

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'DISTRIBUTION_STOPS', info.idDistribution, akses, 'SUKSES', { fase: 'diterima_tujuan' });
  return { success: true };
}

/** Fase 2 langkah 1: jadwalkan penjemputan ompreng kosong (§5.3.2 POP). */
function jadwalkanPengambilan(body) {
  const akses = requireSipanduPermission_(body.token, 'distribution.edit');
  const info = _cariBarisStop_(sipanduSanitize(body.id));

  info.sheet.getRange(info.baris, info.idx.JUMLAH_OMPRENG_DIAMBIL + 1).setValue(Math.max(0, Number(body.jumlahOmprengAmbil) || 0));
  info.sheet.getRange(info.baris, info.idx.NAMA_KURIR_AMBIL + 1).setValue(sipanduSanitize(body.namaKurirAmbil));
  info.sheet.getRange(info.baris, info.idx.PLAT_KURIR_AMBIL + 1).setValue(sipanduSanitize(body.platKurirAmbil));
  info.sheet.getRange(info.baris, info.idx.WAKTU_DIJADWALKAN_AMBIL + 1).setValue(sipanduSanitize(body.waktuDijadwalkanAmbil));
  info.sheet.getRange(info.baris, info.idx.STATUS + 1).setValue('PENGAMBILAN_DIJADWALKAN');

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'DISTRIBUTION_STOPS', info.idDistribution, akses, 'SUKSES', { fase: 'jadwalkan_pengambilan' });
  return { success: true };
}

/** Fase 2 langkah 2: kurir pengambil berangkat menuju lokasi PM (§5.3.2 POP). */
function catatPengambilanBerangkat(body) {
  const akses = requireSipanduPermission_(body.token, 'distribution.edit');
  const info = _cariBarisStop_(sipanduSanitize(body.id));
  const fotoUrl = _sipanduUnggahFoto_(body.fotoSaatAmbil, 'ambil-berangkat');

  info.sheet.getRange(info.baris, info.idx.WAKTU_BERANGKAT_AMBIL + 1).setValue(sipanduSanitize(body.waktuBerangkatAmbil) || new Date().toISOString());
  if (fotoUrl) info.sheet.getRange(info.baris, info.idx.FOTO_SAAT_AMBIL + 1).setValue(fotoUrl);
  info.sheet.getRange(info.baris, info.idx.STATUS + 1).setValue('PENGAMBILAN_BERANGKAT');

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'DISTRIBUTION_STOPS', info.idDistribution, akses, 'SUKSES', { fase: 'pengambilan_berangkat' });
  return { success: true };
}

/** Fase 2 langkah 3 (terakhir): ompreng kembali di SPPG -- tujuan ini SELESAI (§5.3.2 POP). */
function catatOmprengKembali(body) {
  const akses = requireSipanduPermission_(body.token, 'distribution.edit');
  const info = _cariBarisStop_(sipanduSanitize(body.id));
  const fotoUrl = _sipanduUnggahFoto_(body.fotoSaatKembali, 'ompreng-kembali');

  info.sheet.getRange(info.baris, info.idx.WAKTU_KEMBALI_SPPG + 1).setValue(sipanduSanitize(body.waktuKembali) || new Date().toISOString());
  if (fotoUrl) info.sheet.getRange(info.baris, info.idx.FOTO_SAAT_KEMBALI + 1).setValue(fotoUrl);
  info.sheet.getRange(info.baris, info.idx.STATUS + 1).setValue('SELESAI');

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'DISTRIBUTION_STOPS', info.idDistribution, akses, 'SUKSES', { fase: 'ompreng_kembali' });
  return { success: true };
}

// ------------------------------------------------------------
// CUCI OMPRENG — direvisi mengikuti alur POP (Bab 6 manual):
// Belum Dicuci -> Sedang Dicuci -> Selesai Dicuci, dengan waktu
// mulai & selesai tercatat terpisah (bukan 1 baris sekaligus).
// ------------------------------------------------------------

function getWashingList(token, idWo) {
  requireSipanduPermission_(token, 'washing.view');
  idWo = sipanduSanitize(idWo);
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WASHING))
    .filter(w => w.ID_WO === idWo)
    .map(w => ({
      id: w.ID_WASHING,
      jumlahDiterima: Number(w.JUMLAH_DITERIMA) || 0,
      waktuMulaiCuci: w.WAKTU_MULAI_CUCI || '',
      waktuSelesaiCuci: w.WAKTU_SELESAI_CUCI || '',
      jumlahDicuci: w.JUMLAH_DICUCI || '',
      status: w.STATUS,
      catatan: w.CATATAN || ''
    }));
}

function addWashingRecord(body) {
  const akses = requireSipanduPermission_(body.token, 'washing.edit');
  const idWo = sipanduSanitize(body.idWo);
  if (!idWo) throw new Error('Work Order wajib dipilih.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.WASHING);
  const id = generateSipanduId_(sheet, 'WSH', 'ID_WASHING');
  sheet.appendRow([
    id, idWo, Math.max(0, Number(body.jumlahDiterima) || 0),
    '', '', '', 'BELUM_DICUCI', sipanduSanitize(body.catatan), akses.nama, akses.nama, new Date()
  ]);

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'WASHING', idWo, akses, 'SUKSES', { jumlahDiterima: body.jumlahDiterima });
  return { id: id };
}

function _cariBarisWashing_(idWashing) {
  const sheet = getSipanduSheet(SIPANDU_SHEET.WASHING);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_WASHING]) === idWashing) {
      return { sheet: sheet, baris: i + 1, idx: idx, idWo: data[i][idx.ID_WO] };
    }
  }
  throw new Error('Catatan pencucian tidak ditemukan.');
}

/** §6.1 langkah 3-9: mulai proses pencucian. */
function mulaiPencucian(body) {
  const akses = requireSipanduPermission_(body.token, 'washing.edit');
  const info = _cariBarisWashing_(sipanduSanitize(body.id));

  info.sheet.getRange(info.baris, info.idx.WAKTU_MULAI_CUCI + 1).setValue(sipanduSanitize(body.waktuMulai) || new Date().toISOString());
  if (body.catatan !== undefined) info.sheet.getRange(info.baris, info.idx.CATATAN + 1).setValue(sipanduSanitize(body.catatan));
  info.sheet.getRange(info.baris, info.idx.STATUS + 1).setValue('SEDANG_DICUCI');

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'WASHING', info.idWo, akses, 'SUKSES', { fase: 'mulai_cuci' });
  return { success: true };
}

/** §6.1 langkah 11-16: catat pencucian selesai. */
function selesaikanPencucian(body) {
  const akses = requireSipanduPermission_(body.token, 'washing.edit');
  const info = _cariBarisWashing_(sipanduSanitize(body.id));

  info.sheet.getRange(info.baris, info.idx.WAKTU_SELESAI_CUCI + 1).setValue(sipanduSanitize(body.waktuSelesai) || new Date().toISOString());
  info.sheet.getRange(info.baris, info.idx.JUMLAH_DICUCI + 1).setValue(Math.max(0, Number(body.jumlahDicuci) || 0));
  if (body.catatan !== undefined) info.sheet.getRange(info.baris, info.idx.CATATAN + 1).setValue(sipanduSanitize(body.catatan));
  info.sheet.getRange(info.baris, info.idx.STATUS + 1).setValue('SELESAI_DICUCI');

  logSipanduAudit_('UPDATE_OPERATIONAL_DATA', 'WASHING', info.idWo, akses, 'SUKSES', { fase: 'selesai_cuci' });
  return { success: true };
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS: BATAS WAKTU DISTRIBUSI MENDEKAT / TERLEWAT
// Dipasang di TRIGGER TERPISAH milik proyek SIPANDU sendiri (lihat
// panduan) -- BUKAN trigger Portal utama, karena datanya (DISTRIBUTION_STOPS)
// cuma ada di Spreadsheet SIPANDU.
// ------------------------------------------------------------

function cekBatasWaktuDistribusiSipandu() {
  const semuaStop = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.DISTRIBUTION_STOPS));
  const semuaRoute = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.DISTRIBUTION));
  const routeById = {};
  semuaRoute.forEach(r => { routeById[r.ID_DISTRIBUTION] = r; });

  const sekarang = new Date();
  const koordinatorDistribusi = cariUserSipanduByRole_('KOORDINATOR_DISTRIBUSI');
  let terkirim = 0;

  semuaStop.forEach(s => {
    // Hanya relevan untuk yang belum berangkat & punya batas waktu
    if (s.STATUS !== 'DITUGASKAN' || !s.BATAS_WAKTU) return;

    const batasWaktu = new Date(s.BATAS_WAKTU);
    if (isNaN(batasWaktu.getTime())) return;

    const menitTersisa = (batasWaktu.getTime() - sekarang.getTime()) / 60000;
    const sudahLewat = menitTersisa < 0;
    const mendekat = menitTersisa >= 0 && menitTersisa <= 60; // dalam 1 jam ke depan

    if (!sudahLewat && !mendekat) return;

    // Cegah spam: tandai lewat properti sekali per stop per kondisi
    const props = PropertiesService.getScriptProperties();
    const kunciProp = 'batas_distribusi_' + s.ID_STOP + '_' + (sudahLewat ? 'LEWAT' : 'MENDEKAT');
    if (props.getProperty(kunciProp) === 'TERKIRIM') return;

    const route = routeById[s.ID_DISTRIBUTION] || {};
    const judul = sudahLewat ? '🔴 Batas Waktu Distribusi Terlewat' : '⏰ Batas Waktu Distribusi Mendekat';
    const isi = s.NAMA_TUJUAN + ' (kurir: ' + (route.NAMA_KURIR || '-') + ') ' + (sudahLewat ? 'sudah melewati' : 'akan mencapai') + ' batas waktu penugasan.';

    koordinatorDistribusi.forEach(idRelawan => antrikanPushKePortal_(idRelawan, judul, isi, '/sipandu.html'));
    props.setProperty(kunciProp, 'TERKIRIM');
    terkirim++;
  });

  Logger.log('cekBatasWaktuDistribusiSipandu: ' + terkirim + ' notifikasi terkirim.');
}


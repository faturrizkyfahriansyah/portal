/**
 * SIPANDU — SipanduDashboard.gs
 * §11: WO HARI INI, TOTAL PORSI, WO READY, OPERASIONAL BERJALAN,
 * POP READY, POP STALE, POP FILLED, COMPLETED.
 *
 * CATATAN JUJUR: "OPERASIONAL BERJALAN" butuh data dari Persiapan/
 * Pengolahan/Pemorsian/Distribusi/Cuci Ompreng -- modul-modul itu BELUM
 * dibangun di tahap ini. Field itu untuk sementara selalu 0 (bukan error),
 * dan akan otomatis terisi begitu modul-modul tsb dibuat menyusul --
 * TIDAK PERLU mengubah fungsi ini lagi nanti kalau modulnya sudah ada
 * (asalkan nama sheet & kolom STATUS konsisten).
 */

function getSipanduDashboard(token) {
  requireSipanduPermission_(token, 'wo.view');

  const semuaWo = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS));
  const hariIni = Utilities.formatDate(new Date(), SIPANDU_ZONA_WAKTU, 'yyyy-MM-dd');

  const woHariIni = semuaWo.filter(w => w.TANGGAL === hariIni);
  const totalPorsiHariIni = woHariIni.reduce((sum, w) => sum + (Number(w.JUMLAH_PORSI) || 0), 0);
  const woReady = semuaWo.filter(w => w.STATUS === 'READY').length;
  const popFilled = semuaWo.filter(w => w.STATUS === 'POP_FILLED').length;
  const completed = semuaWo.filter(w => w.STATUS === 'COMPLETED').length;

  let popReady = 0;
  let popStale = 0;
  try {
    const snapshots = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.POP_SNAPSHOT));
    popReady = snapshots.filter(s => String(s.STATUS).toUpperCase() === 'READY').length;
    popStale = snapshots.filter(s => String(s.STATUS).toUpperCase() === 'STALE').length;
  } catch (e) { /* sheet POP_SNAPSHOT belum ada isinya -- biarkan 0 */ }

  let operasionalBerjalan = 0;
  try {
    const modulOperasional = [SIPANDU_SHEET.PREPARATION, SIPANDU_SHEET.PROCESSING, SIPANDU_SHEET.PORTIONING];
    modulOperasional.forEach(nama => {
      operasionalBerjalan += sipanduSheetToObjects(getSipanduSheet(nama))
        .filter(r => String(r.STATUS).toUpperCase() === 'BERJALAN').length;
    });
  } catch (e) { /* biarkan 0 kalau sheet modul terkait belum ada isinya */ }

  return {
    woHariIni: woHariIni.length,
    totalPorsiHariIni: totalPorsiHariIni,
    woReady: woReady,
    operasionalBerjalan: operasionalBerjalan,
    popReady: popReady,
    popStale: popStale,
    popFilled: popFilled,
    completed: completed
  };
}


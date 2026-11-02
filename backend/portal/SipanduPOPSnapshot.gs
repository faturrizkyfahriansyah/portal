/**
 * SIPANDU — SipanduPOPSnapshot.gs
 * Generate POP + Snapshot (§13-15). Bagian ini SEPENUHNYA internal
 * SIPANDU -- tidak tergantung struktur form POP (BGN), jadi aman
 * dibangun sekarang. Auto-Fill (yang BUTUH tahu struktur form POP asli)
 * ada di SipanduAutoFillPOP.gs terpisah, dengan keterbatasan yang
 * dijelaskan jujur di situ.
 */

// ------------------------------------------------------------
// GENERATE POP → SNAPSHOT (§13-14)
// ------------------------------------------------------------

function generatePOP(body) {
  const akses = requireSipanduPermission_(body.token, 'pop.fill');
  const idWo = sipanduSanitize(body.idWo);

  const wo = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS)).find(w => w.ID_WO === idWo);
  if (!wo) throw new Error('Work Order tidak ditemukan.');
  if (wo.STATUS !== 'READY' && wo.STATUS !== 'POP_FILLED') {
    throw new Error('Work Order harus berstatus READY dulu sebelum Generate POP (status sekarang: ' + wo.STATUS + ').');
  }

  const menu = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.MENU)).find(m => m.ID_MENU === wo.ID_MENU);
  const gizi = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.MENU_GIZI)).filter(g => g.ID_MENU === wo.ID_MENU);
  const beneficiaries = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.BENEFICIARIES)).filter(b => b.ID_WO === idWo);

  const totalPenerima = { pb: 0, pk: 0, bumil: 0, busui: 0, balita: 0 };
  beneficiaries.forEach(b => {
    totalPenerima.pb += Number(b.PB) || 0;
    totalPenerima.pk += Number(b.PK) || 0;
    totalPenerima.bumil += Number(b.BUMIL) || 0;
    totalPenerima.busui += Number(b.BUSUI) || 0;
    totalPenerima.balita += Number(b.BALITA) || 0;
  });

  // Ambil jam mulai/selesai per tahap dari Persiapan & Pengolahan yang
  // sudah dicatat -- dipakai MIN(waktu) & MAX(waktu) dari baris-baris
  // per bahan sebagai perkiraan jam mulai/selesai tahap. CATATAN JUJUR:
  // ini pendekatan, bukan jam mulai/selesai eksplisit per tahap (SIPANDU
  // belum punya pencatatan itu secara langsung -- lihat status pengembangan).
  const persiapan = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PREPARATION)).filter(p => p.ID_WO === idWo);
  const pengolahan = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PROCESSING)).filter(p => p.ID_WO === idWo);
  const pemorsian = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PORTIONING)).filter(p => p.ID_WO === idWo);

  const snapshotData = {
    wo: { id: wo.ID_WO, nomorWO: wo.NOMOR_WO, tanggal: wo.TANGGAL, jumlahPorsi: Number(wo.JUMLAH_PORSI) || 0 },
    menu: menu ? {
      nama: menu.NAMA_MENU, karbohidrat: menu.KARBOHIDRAT, proteinHewani: menu.PROTEIN_HEWANI,
      proteinNabati: menu.PROTEIN_NABATI, sayuran: menu.SAYURAN, buah: menu.BUAH
    } : null,
    dataGizi: gizi.map(g => ({ kategori: g.KATEGORI, energi: g.ENERGI, protein: g.PROTEIN, lemak: g.LEMAK, karbohidrat: g.KARBOHIDRAT, serat: g.SERAT })),
    penerimaManfaat: { perLokasi: beneficiaries.map(b => ({ lokasi: b.LOKASI, total: b.TOTAL })), total: totalPenerima },
    persiapan: { jumlahItem: persiapan.length, waktuList: persiapan.map(p => p.WAKTU) },
    pengolahan: { jumlahItem: pengolahan.length, waktuList: pengolahan.map(p => p.WAKTU) },
    pemorsian: pemorsian.map(p => ({ sesi: p.SESI, target: p.TARGET, jumlahSelesai: p.JUMLAH_SELESAI, waktuMulai: p.WAKTU_MULAI, waktuSelesai: p.WAKTU_SELESAI }))
  };

  const sheet = getSipanduSheet(SIPANDU_SHEET.POP_SNAPSHOT);
  const semuaSnapshot = sipanduSheetToObjects(sheet).filter(s => s.ID_WO === idWo);
  const versi = semuaSnapshot.length + 1;
  const id = generateSipanduId_(sheet, 'SNAP', 'ID_SNAPSHOT');

  sheet.appendRow([
    id, idWo, versi, wo.TANGGAL, JSON.stringify(snapshotData.menu), JSON.stringify(snapshotData),
    snapshotData.wo.jumlahPorsi, JSON.stringify(snapshotData.penerimaManfaat), JSON.stringify(snapshotData.dataGizi),
    'READY', akses.nama, new Date()
  ]);

  logSipanduAudit_('GENERATE_POP', 'POP_SNAPSHOT', idWo, akses, 'SUKSES', { versi: versi });
  return { id: id, versi: versi };
}

function getLatestSnapshot(token, idWo) {
  requireSipanduPermission_(token, 'pop.view');
  idWo = sipanduSanitize(idWo);
  const snapshots = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.POP_SNAPSHOT))
    .filter(s => s.ID_WO === idWo)
    .sort((a, b) => (Number(b.VERSI) || 0) - (Number(a.VERSI) || 0));

  if (!snapshots.length) return null;
  const s = snapshots[0];
  let data = null;
  try { data = JSON.parse(s.KOMPOSISI_JSON); } catch (e) { data = null; }

  return {
    id: s.ID_SNAPSHOT,
    versi: Number(s.VERSI) || 1,
    status: s.STATUS,
    isStale: String(s.STATUS).toUpperCase() === 'STALE',
    dibuatOleh: s.DIBUAT_OLEH,
    dibuatPada: s.DIBUAT_PADA,
    data: data
  };
}

/**
 * Tandai SEMUA snapshot aktif (READY) milik 1 WO jadi STALE (§15).
 * Dipanggil manual dari updateWorkOrder/addBeneficiary/setMenuGizi kalau
 * WO itu SUDAH punya snapshot -- Sheets tidak punya trigger otomatis
 * seperti database sungguhan, jadi ini WAJIB dipanggil eksplisit di
 * fungsi manapun yang mengubah data sumber POP.
 */
function tandaiSnapshotStale_(idWo) {
  try {
    const sheet = getSipanduSheet(SIPANDU_SHEET.POP_SNAPSHOT);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idxWo = headers.indexOf('ID_WO');
    const idxStatus = headers.indexOf('STATUS');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxWo]) === idWo && String(data[i][idxStatus]).toUpperCase() === 'READY') {
        sheet.getRange(i + 1, idxStatus + 1).setValue('STALE');
      }
    }
  } catch (e) {
    // Sheet POP_SNAPSHOT mungkin belum ada baris -- aman diabaikan.
  }
}


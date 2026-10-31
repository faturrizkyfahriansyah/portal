/**
 * SIPANDU — SipanduValidasi.gs
 * Validasi (§20 versi Supabase, diadaptasi ke Sheets) -- checklist
 * kesiapan Work Order sebelum boleh naik status ke READY.
 *
 * Checklist dihitung OTOMATIS dari data yang sudah ada (§56 semangat
 * "jangan cuma andalkan input manual"), tapi tetap WAJIB dikonfirmasi
 * eksplisit oleh yang punya permission validation.validate -- bukan
 * auto-ready begitu saja tanpa ada orang yang bertanggung jawab.
 */

function getValidationStatus(token, idWo) {
  requireSipanduPermission_(token, 'validation.view');
  idWo = sipanduSanitize(idWo);

  const wo = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS)).find(w => w.ID_WO === idWo);
  if (!wo) throw new Error('Work Order tidak ditemukan.');

  const beneficiaries = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.BENEFICIARIES)).filter(b => b.ID_WO === idWo);
  const preparation = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PREPARATION)).filter(p => p.ID_WO === idWo);
  const processing = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PROCESSING)).filter(p => p.ID_WO === idWo);
  const portioning = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PORTIONING)).filter(p => p.ID_WO === idWo);
  const distribution = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.DISTRIBUTION)).filter(d => d.ID_WO === idWo);

  // Dihitung otomatis dari data sungguhan -- ini SARAN, bukan otomatis
  // dianggap benar. Yang divalidasi tetap harus eksplisit konfirmasi.
  const checklistOtomatis = {
    wo: true,
    tanggal: !!wo.TANGGAL,
    menu: !!wo.ID_MENU,
    jumlah_porsi: Number(wo.JUMLAH_PORSI) > 0,
    beneficiaries: beneficiaries.length > 0,
    preparation: preparation.length > 0,
    processing: processing.length > 0,
    portioning: portioning.length > 0,
    distribution: distribution.length > 0
  };

  const existing = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.VALIDATION)).find(v => v.ID_WO === idWo);
  let checklistTersimpan = null;
  if (existing) {
    try { checklistTersimpan = JSON.parse(existing.CHECKLIST); } catch (e) { checklistTersimpan = null; }
  }

  return {
    checklistOtomatis: checklistOtomatis,
    checklistTersimpan: checklistTersimpan,
    isReady: existing ? String(existing.IS_READY).toUpperCase() === 'TRUE' : false,
    divalidasiOleh: existing ? existing.DIVALIDASI_OLEH : '',
    divalidasiPada: existing ? existing.DIVALIDASI_PADA : ''
  };
}

/**
 * Simpan checklist yang SUDAH DIKONFIRMASI manual (boleh beda dari
 * checklistOtomatis kalau yang validasi punya alasan, mis. persiapan
 * memang belum dicatat sistemnya tapi sudah dikerjakan di lapangan --
 * tapi TIDAK BOLEH tandai ready kalau syarat paling inti belum ada).
 */
function setValidationChecklist(body) {
  const akses = requireSipanduPermission_(body.token, 'validation.validate');
  const idWo = sipanduSanitize(body.idWo);
  const checklist = body.checklist || {};
  const isReady = !!body.isReady;

  if (isReady) {
    const wajib = ['wo', 'tanggal', 'menu', 'jumlah_porsi', 'beneficiaries'];
    const belumLengkap = wajib.filter(k => !checklist[k]);
    if (belumLengkap.length) {
      throw new Error('Belum bisa ditandai Ready — checklist berikut belum dicentang: ' + belumLengkap.join(', '));
    }
  }

  const sheet = getSipanduSheet(SIPANDU_SHEET.VALIDATION);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_WO]) === idWo) {
      sheet.getRange(i + 1, idx.CHECKLIST + 1).setValue(JSON.stringify(checklist));
      sheet.getRange(i + 1, idx.IS_READY + 1).setValue(isReady);
      sheet.getRange(i + 1, idx.DIVALIDASI_OLEH + 1).setValue(akses.nama);
      sheet.getRange(i + 1, idx.DIVALIDASI_PADA + 1).setValue(new Date());
      logSipanduAudit_('UPDATE_WO', 'VALIDATION', idWo, akses, 'SUKSES', { isReady: isReady });
      return { success: true, isReady: isReady };
    }
  }

  const id = generateSipanduId_(sheet, 'VAL', 'ID_VALIDATION');
  sheet.appendRow([id, idWo, JSON.stringify(checklist), isReady, akses.nama, new Date()]);
  logSipanduAudit_('UPDATE_WO', 'VALIDATION', idWo, akses, 'SUKSES', { isReady: isReady });
  return { id: id, isReady: isReady };
}


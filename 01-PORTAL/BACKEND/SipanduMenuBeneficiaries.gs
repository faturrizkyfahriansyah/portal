/**
 * SIPANDU — SipanduMenuBeneficiaries.gs
 * Menu (§6-7) & Penerima Manfaat (§8) -- dibuat di tahap ini karena
 * Work Order LANGSUNG bergantung ke keduanya untuk naik status
 * (DRAFT -> DATA_LENGKAP butuh menu + penerima manfaat terisi).
 * Modul operasional lain (Persiapan, Pengolahan, dst.) BELUM dibuat --
 * lihat SIPANDU-STATUS-PENGEMBANGAN.md untuk daftar lengkap yang tersisa.
 */

// ------------------------------------------------------------
// MENU
// ------------------------------------------------------------

function getMenuList(token) {
  requireSipanduPermission_(token, 'menu.view');
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.MENU))
    .filter(m => String(m.STATUS).toUpperCase() !== 'NONAKTIF')
    .map(m => ({
      id: m.ID_MENU,
      nama: m.NAMA_MENU,
      karbohidrat: m.KARBOHIDRAT || '',
      proteinHewani: m.PROTEIN_HEWANI || '',
      proteinNabati: m.PROTEIN_NABATI || '',
      sayuran: m.SAYURAN || '',
      buah: m.BUAH || ''
    }));
}

function addMenu(body) {
  const akses = requireSipanduPermission_(body.token, 'menu.create');
  const nama = sipanduSanitize(body.nama);
  if (!nama) throw new Error('Nama menu wajib diisi.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.MENU);
  const id = generateSipanduId_(sheet, 'MNU', 'ID_MENU');
  const now = new Date();
  sheet.appendRow([
    id, nama, sipanduSanitize(body.karbohidrat), sipanduSanitize(body.proteinHewani),
    sipanduSanitize(body.proteinNabati), sipanduSanitize(body.sayuran), sipanduSanitize(body.buah),
    'AKTIF', akses.nama, now, akses.nama, now
  ]);

  logSipanduAudit_('CREATE_MENU', 'MENU', id, akses, 'SUKSES', { nama: nama });
  return { id: id, nama: nama };
}

/**
 * Data gizi per kategori penerima manfaat (§7). Dibuat sebagai fungsi
 * TERPISAH (bukan dipaksa jadi kolom tunggal di MENU) supaya 1 menu bisa
 * py sampai 5 baris gizi (PB/PK/BUMIL/BUSUI/BALITA) tanpa kolom meledak.
 */
function setMenuGizi(body) {
  const akses = requireSipanduPermission_(body.token, 'menu.edit');
  const idMenu = sipanduSanitize(body.idMenu);
  const kategori = sipanduSanitize(body.kategori); // PB | PK | BUMIL | BUSUI | BALITA
  if (!idMenu || !kategori) throw new Error('Menu dan kategori wajib diisi.');

  const sheet = getSipanduSheet(SIPANDU_SHEET.MENU_GIZI);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_MENU]) === idMenu && data[i][idx.KATEGORI] === kategori) {
      sheet.getRange(i + 1, idx.ENERGI + 1, 1, 4).setValues([[
        Number(body.energi) || 0, Number(body.protein) || 0, Number(body.lemak) || 0, Number(body.karbohidrat) || 0
      ]]);
      sheet.getRange(i + 1, idx.SERAT + 1).setValue(Number(body.serat) || 0);
      logSipanduAudit_('UPDATE_MENU', 'MENU_GIZI', idMenu, akses, 'SUKSES', body);
      return { success: true, diperbarui: true };
    }
  }

  const id = generateSipanduId_(sheet, 'GZ', 'ID_MENU_GIZI');
  sheet.appendRow([
    id, idMenu, kategori, Number(body.energi) || 0, Number(body.protein) || 0,
    Number(body.lemak) || 0, Number(body.karbohidrat) || 0, Number(body.serat) || 0
  ]);
  logSipanduAudit_('UPDATE_MENU', 'MENU_GIZI', idMenu, akses, 'SUKSES', body);
  return { id: id, diperbarui: false };
}

// ------------------------------------------------------------
// PENERIMA MANFAAT (Beneficiaries)
// ------------------------------------------------------------

function getBeneficiaryList(token, idWo) {
  requireSipanduPermission_(token, 'beneficiaries.view');
  idWo = sipanduSanitize(idWo);
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.BENEFICIARIES))
    .filter(b => b.ID_WO === idWo)
    .map(b => ({
      id: b.ID_BENEFICIARY,
      lokasi: b.LOKASI,
      pb: Number(b.PB) || 0,
      pk: Number(b.PK) || 0,
      bumil: Number(b.BUMIL) || 0,
      busui: Number(b.BUSUI) || 0,
      balita: Number(b.BALITA) || 0,
      total: Number(b.TOTAL) || 0
    }));
}

function addBeneficiary(body) {
  const akses = requireSipanduPermission_(body.token, 'beneficiaries.create');
  const idWo = sipanduSanitize(body.idWo);
  const lokasi = sipanduSanitize(body.lokasi);
  if (!idWo) throw new Error('Work Order wajib dipilih.');
  if (!lokasi) throw new Error('Nama lokasi wajib diisi.');

  const pb = Math.max(0, Number(body.pb) || 0);
  const pk = Math.max(0, Number(body.pk) || 0);
  const bumil = Math.max(0, Number(body.bumil) || 0);
  const busui = Math.max(0, Number(body.busui) || 0);
  const balita = Math.max(0, Number(body.balita) || 0);
  const total = pb + pk + bumil + busui + balita;

  const sheet = getSipanduSheet(SIPANDU_SHEET.BENEFICIARIES);
  const id = generateSipanduId_(sheet, 'BNF', 'ID_BENEFICIARY');
  const now = new Date();
  // TOTAL dihitung di sini (bukan generated column seperti di Postgres --
  // Sheets tidak punya itu) -- SELALU hitung ulang saat baca kalau ragu,
  // jangan cuma percaya kolom TOTAL kalau ada indikasi data diedit manual.
  sheet.appendRow([id, idWo, lokasi, pb, pk, bumil, busui, balita, total, akses.nama, now]);

  if (typeof tandaiSnapshotStale_ === 'function') tandaiSnapshotStale_(idWo);
  logSipanduAudit_('UPDATE_BENEFICIARIES', 'BENEFICIARIES', idWo, akses, 'SUKSES', { lokasi: lokasi, total: total });
  return { id: id, total: total };
}


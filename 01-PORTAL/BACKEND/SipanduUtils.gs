/**
 * SIPANDU — Sistem Informasi Pengelolaan Data & Operasional SPPG
 * SipanduUtils.gs — utilitas dasar (sheet, ID, response JSON)
 *
 * ==================================================================
 * DIGABUNG ke proyek Apps Script Portal Relawan (bukan proyek terpisah
 * lagi) -- ini menghilangkan masalah "sesi ditolak" yang sebelumnya
 * terjadi karena CacheService antar-proyek tidak bisa saling dibaca.
 * Sekarang SIPANDU pakai persis mekanisme sesi yang sama dengan
 * SIRAGA/SIPRES/Monitoring (requireAuthRelawan di Akun.gs).
 *
 * DATABASE (Spreadsheet) TETAP TERPISAH -- keputusan sadar, bukan
 * kebetulan. Diakses lewat ID (Script Property SIPANDU_SPREADSHEET_ID,
 * lihat getSipanduSpreadsheet_ di Utils.gs Portal), BUKAN
 * getActiveSpreadsheet() lagi (yang sekarang akan salah mengarah ke
 * Spreadsheet Portal, karena proyeknya sudah gabung).
 * ==================================================================
 */

const SIPANDU_SHEET = {
  USERS: 'USERS',
  ROLES: 'ROLES',
  PERMISSIONS: 'PERMISSIONS',
  ROLE_PERMISSIONS: 'ROLE_PERMISSIONS',
  WORK_ORDERS: 'WORK_ORDERS',
  MENU: 'MENU',
  MENU_GIZI: 'MENU_GIZI',
  BENEFICIARIES: 'BENEFICIARIES',
  PREPARATION: 'PREPARATION',
  PROCESSING: 'PROCESSING',
  PORTIONING: 'PORTIONING',
  DISTRIBUTION: 'DISTRIBUTION',
  DISTRIBUTION_STOPS: 'DISTRIBUTION_STOPS',
  WASHING: 'WASHING',
  VALIDATION: 'VALIDATION',
  POP_SNAPSHOT: 'POP_SNAPSHOT',
  POP_FILL_LOG: 'POP_FILL_LOG',
  AUDIT_LOG: 'AUDIT_LOG'
};

const SIPANDU_ZONA_WAKTU = 'Asia/Jakarta';

/**
 * Header default + isi awal untuk sheet yang AMAN dibuat otomatis kalau
 * belum ada (murni struktur akses/role, bukan data operasional). Sheet
 * operasional (WORK_ORDERS dkk) SENGAJA TIDAK di-auto-create -- kalau itu
 * belum ada, itu tanda ada masalah setup yang lebih besar yang perlu
 * diperiksa manual, bukan "diselesaikan" dengan sheet kosong.
 */
const SIPANDU_SHEET_AMAN_DIBUAT_OTOMATIS_ = {
  USERS: { header: ['ID_USER', 'NAMA', 'ROLE_SIPANDU', 'AKTIF', 'DIBUAT_PADA'], isiAwal: [] },
  ROLES: {
    header: ['ID_ROLE', 'KODE', 'NAMA'],
    isiAwal: [
      ['ROL001', 'ADMIN', 'Admin'],
      ['ROL002', 'ASN', 'ASN'],
      ['ROL003', 'RELAWAN', 'Relawan']
    ]
  }
};

function getSipanduSheet(namaSheet) {
  const ss = getSipanduSpreadsheet_(); // dari Utils.gs Portal -- database SIPANDU tetap terpisah
  let sheet = ss.getSheetByName(namaSheet);
  if (sheet) return sheet;

  // Self-healing: kalau ini sheet struktur akses (USERS/ROLES) yang AMAN
  // dibuat otomatis, buat sekarang dengan header + isi awal yang benar --
  // supaya fitur Hak Akses SIPANDU SELALU bisa dipakai, tidak bergantung
  // pada asumsi struktur Spreadsheet yang sudah ada sebelumnya.
  const template = SIPANDU_SHEET_AMAN_DIBUAT_OTOMATIS_[namaSheet];
  if (template) {
    sheet = ss.insertSheet(namaSheet);
    sheet.getRange(1, 1, 1, template.header.length).setValues([template.header]);
    if (template.isiAwal.length) {
      sheet.getRange(2, 1, template.isiAwal.length, template.isiAwal[0].length).setValues(template.isiAwal);
    }
    return sheet;
  }

  throw new Error('Sheet "' + namaSheet + '" tidak ditemukan di database SIPANDU. Periksa kembali struktur Spreadsheet (lihat SIPANDU-SETUP-SHEET.md).');
}

/** Sama seperti sheetToObjects di Portal Relawan -- header-based, aman kalau kolom belum lengkap. */
function sipanduSheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function sipanduSanitize(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/[<>]/g, '');
}

/** ID generator generik: PREFIX + 5 digit urut, mis. WO00001, MNU00042. */
function generateSipanduId_(sheet, prefix, kolomId) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = kolomId ? headers.indexOf(kolomId) : 0;
  let max = 0;
  const pola = new RegExp('^' + prefix + '(\\d+)$', 'i');
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][idx] || '').match(pola);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return prefix + String(max + 1).padStart(5, '0');
}

/** Nomor WO format WO-YYYYMMDD-NNNN (§4 dokumen), urut ulang per tanggal. */
function generateNomorWO_(sheet, tanggalYMD) {
  const awalan = 'WO-' + tanggalYMD + '-';
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxNomor = headers.indexOf('NOMOR_WO');
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const nomor = String(data[i][idxNomor] || '');
    if (nomor.indexOf(awalan) === 0) {
      const urut = parseInt(nomor.substring(awalan.length), 10);
      if (!isNaN(urut)) max = Math.max(max, urut);
    }
  }
  return awalan + String(max + 1).padStart(4, '0');
}

function sipanduSukses(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sipanduGagal(message, errorCode) {
  // PENTING: kunci "message" (bukan "error") -- disamakan persis dengan
  // format gagal() di Portal Relawan, supaya frontend (sipandu-common.js)
  // bisa pakai pola apiGet/apiPost yang SAMA PERSIS tanpa cabang kode beda.
  return ContentService.createTextOutput(JSON.stringify({ success: false, message: message, errorCode: errorCode || 'ERROR' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sipanduKlasifikasiError_(err) {
  const msg = String(err && err.message || err || '');
  if (msg.indexOf('izin') !== -1 || msg.indexOf('permission') !== -1) return 'FORBIDDEN';
  if (msg.indexOf('tidak ditemukan') !== -1) return 'NOT_FOUND';
  if (msg.indexOf('sesi') !== -1 || msg.indexOf('login') !== -1) return 'UNAUTHENTICATED';
  return 'ERROR';
}

/**
 * KIRIM PUSH NOTIFICATION — sebelumnya harus lewat "antrian" tertulis ke
 * sheet karena SIPANDU proyek terpisah tidak bisa memanggil fungsi Portal
 * secara langsung. SEKARANG karena sudah 1 proyek, cukup panggil
 * kirimPushNotifikasi_ (PushNotifikasi.gs Portal) LANGSUNG -- tidak perlu
 * mekanisme antrian/tulis-sheet-lalu-tunggu-trigger lagi.
 */
function antrikanPushKePortal_(idRelawan, judul, isi, link) {
  try {
    kirimPushNotifikasi_(idRelawan, judul, isi, { link: link });
  } catch (e) {
    // Diamkan -- ini fitur pelengkap, bukan inti dari aksi SIPANDU.
  }
}

/** Cari semua ID_USER di SIPANDU yang punya role tertentu (mis. koordinator terkait). */
function cariUserSipanduByRole_(kodeRole) {
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.USERS))
    .filter(u => u.ROLE_SIPANDU === kodeRole && String(u.AKTIF).toUpperCase() !== 'NONAKTIF')
    .map(u => u.ID_USER);
}


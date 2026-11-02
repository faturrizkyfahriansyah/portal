/**
 * SIPOGIM — Utils.gs
 * Helper umum dipakai semua file lain. Pola penamaan (akhiran _ utk
 * fungsi internal) mengikuti konvensi yang sama dengan proyek Portal
 * SPPG Jeungjing, supaya siapa pun yang sudah kenal kode Portal bisa
 * langsung membaca kode ini.
 */

function getSsSipogim_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}
function getSheetSipogim_(namaSheet) {
  const sheet = getSsSipogim_().getSheetByName(namaSheet);
  if (!sheet) throw new Error('Sheet "' + namaSheet + '" tidak ditemukan. Jalankan jalankanSetupSipogim() dulu.');
  return sheet;
}

/** Baca 1 sheet jadi array of object, key = header kolom. Baris kosong total dilewati. */
function sheetToObjectsSipogim_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const header = data[0];
  const hasil = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.every(c => c === '' || c === null)) continue;
    const obj = {};
    header.forEach((h, idx) => { obj[h] = row[idx]; });
    obj.__baris = i + 1; // nomor baris asli di sheet (1-based), dipakai utk update/hapus
    hasil.push(obj);
  }
  return hasil;
}

/** { NAMA_KOLOM: indexAngka0 } dari baris header (baris 1). */
function headerIndexSipogim_(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });
  return idx;
}

function generateIdSipogim_(prefix, sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  const re = new RegExp('^' + prefix + '(\\d+)$', 'i');
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0] || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return prefix + String(max + 1).padStart(3, '0');
}

/** Normalisasi nama: huruf kecil, rapikan spasi, buang tanda baca ringan. Dipakai utk pencocokan nama. */
function normalisasiNamaSipogim_(teks) {
  return String(teks || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"()]/g, '');
}

function sanitizeSipogim_(v) { return v === undefined || v === null ? '' : String(v).trim(); }

/** Angka atau NULL -- PENTING: beda dari Number(x)||0, karena nilai gizi kosong TIDAK boleh jadi 0. */
function angkaAtauNullSipogim_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function formatTanggalSipogim_(d) {
  return Utilities.formatDate(d, 'Asia/Jakarta', 'dd/MM/yyyy');
}

/**
 * PENGAMAN: Google Sheets kadang otomatis mengubah teks "dd/MM/yyyy"
 * yang ditulis ke sel jadi tipe Tanggal asli (bukan teks) -- terutama
 * kalau kolom itu belum pernah dipaksa format teks (@) sebelum ditulis.
 * Akibatnya waktu dibaca lagi, nilainya jadi objek Date, bukan string,
 * dan .split('/') di kode lain gagal ("x.split is not a function").
 * Fungsi ini menormalkan APA PUN yang masuk (string ATAU Date) jadi
 * string "dd/MM/yyyy" yang konsisten -- dipakai di titik baca TANGGAL,
 * supaya baris lama yang terlanjur tersimpan sbg Date tetap bisa dipakai
 * tanpa perlu dihapus/diimpor ulang.
 */
function normalisasiTanggalSipogim_(nilai) {
  if (nilai instanceof Date) return formatTanggalSipogim_(nilai);
  return String(nilai || '');
}
function sekarangSipogim_() { return new Date(); }

/** Hash satu-arah (SHA-256 + garam tetap per-instalasi). BUKAN bcrypt/argon2id --
 * Apps Script tidak punya itu secara bawaan; ini kompromi yang disengaja
 * utk alat internal tim kecil, bukan sistem publik. Lihat catatan di
 * rencana SIPOGIM. */
function hashRahasia_(teks) {
  const garam = 'sipogim-sppg-jeungjing-v1'; // tetap, tidak perlu rahasia tinggi (lihat catatan di atas)
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, garam + ':' + teks);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function getPengaturan_(kunci, fallback) {
  const sheet = getSheetSipogim_('PENGATURAN');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === kunci) return data[i][1] === '' ? fallback : data[i][1];
  }
  return fallback;
}
function setPengaturan_(kunci, nilai) {
  const sheet = getSheetSipogim_('PENGATURAN');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === kunci) { sheet.getRange(i + 1, 2).setValue(nilai); return; }
  }
  sheet.appendRow([kunci, nilai]);
}

/**
 * Catat 1 baris ke RIWAYAT. Dipanggil dari dalam transaksi yang sama
 * (di bawah LockService) dengan perubahan datanya sendiri -- lihat
 * pemanggil di Bahan.gs/Resep.gs/Padanan.gs.
 */
function catatRiwayatSipogim_(aktorNama, entitas, entitasId, aksi, sebelum, sesudah, ringkasan) {
  const sheet = getSheetSipogim_('RIWAYAT');
  const id = generateIdSipogim_('RW', sheet);
  sheet.appendRow([
    id, sekarangSipogim_(), aktorNama, '', entitas, entitasId, aksi,
    sebelum ? JSON.stringify(sebelum) : '', sesudah ? JSON.stringify(sesudah) : '', ringkasan || ''
  ]);
}


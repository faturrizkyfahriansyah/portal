/**
 * Setup.gs — Fungsi yang dijalankan MANUAL dari editor Apps Script (sekali / bila perlu).
 *
 *  1. (opsional) setSpreadsheetId('<ID>')     — jika script TIDAK terikat ke spreadsheet
 *  2. setup()                                   — buat sheet/header, tarif, pengaturan, folder Drive, secret
 *  3. setTemplateFileId('<ID file .docx>')      — ID template Word yang sudah diunggah ke Drive
 *  4. tambahPengguna('fatur', 'Fatur', '123456')— buat akun login (PIN min. 6 karakter)
 *  5. cekKonfigurasi()                          — pastikan semuanya siap
 */

function setSpreadsheetId(id) {
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', String(id).trim());
  Db._ss = null;
  Logger.log('Spreadsheet: ' + Db.ss().getName());
}

function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID') && !SpreadsheetApp.getActiveSpreadsheet()) {
    var ss = SpreadsheetApp.create('DB_SIPENDOK_SPPG_JEUNGJING');
    props.setProperty('SPREADSHEET_ID', ss.getId());
    Logger.log('Spreadsheet baru dibuat: ' + ss.getUrl());
  }
  Db._ss = null;

  migrasiDariV1();
  Object.keys(Cfg.SHEET).forEach(function (k) { Db.ensureSheet(k); });

  if (!Db.readAll('TARIF').length) Db.appendMany('TARIF', Cfg.DEFAULT_TARIF.map(function (r) {
    return { JENIS_PORSI: r[0], TOTAL: r[1], BAHAN_BAKU: r[2], MITRA_FASILITAS: r[3], OPERASIONAL: r[4] };
  }));
  var ada = {}; Db.readAll('PENGATURAN').forEach(function (r) { ada[r.KUNCI] = true; });
  Db.appendMany('PENGATURAN', Cfg.DEFAULT_PENGATURAN.filter(function (r) { return !ada[r[0]]; })
    .map(function (r) { return { KUNCI: r[0], NILAI: r[1], KETERANGAN: r[2] }; }));

  if (!props.getProperty('AUTH_SECRET')) props.setProperty('AUTH_SECRET', Utilities.getUuid() + Utilities.getUuid());

  if (!Db.settings().FOLDER_DOKUMEN) {
    var root = DriveApp.createFolder('SIPENDOK');
    Db.setSetting('FOLDER_DOKUMEN', root.getId());
    Logger.log('Folder Drive "SIPENDOK" dibuat: ' + root.getUrl());
  }
  Logger.log('setup() selesai. Langkah berikut: setTemplateFileId(...), tambahPengguna(...), lalu cekKonfigurasi().');
}

function setTemplateFileId(id) {
  var f = DriveApp.getFileById(String(id).trim());
  Db.setSetting('TEMPLATE_DOKUMEN', f.getId());
  Logger.log('Template: ' + f.getName());
  Logger.log(JSON.stringify(Dok.cekTemplate()));
}

function tambahPengguna(username, nama, pin) { Auth.buatPengguna(username, nama, pin); Logger.log('Pengguna "' + username + '" disimpan.'); }
function hapusPengguna(username) { Auth.hapusPengguna(username); Logger.log('Pengguna "' + username + '" dihapus.'); }

/** Bangun ulang 05_PERHITUNGAN_HARIAN dari 03_PENERIMAAN & 04_TARIF (mis. setelah tarif diubah). */
function bangunUlangPerhitungan() { Logger.log(Pagu.bangunUlang() + ' hari dihitung.'); }

function cekKonfigurasi() {
  var s = Db.settings(), out = [];
  out.push('Spreadsheet : ' + Db.ss().getName());
  out.push('Sheet       : ' + Object.keys(Cfg.SHEET).map(function (k) { return Db.sheet(k) && Cfg.SHEET[k]; }).join(', '));
  out.push('PM aktif    : ' + Db.readAll('PM').filter(function (p) { return p.STATUS === 'Aktif'; }).length);
  out.push('Tarif       : ' + JSON.stringify(Db.tarif()));
  out.push('Folder      : ' + (Dok._cekFolder(s) || 'OK'));
  out.push('Template    : ' + JSON.stringify(Dok.cekTemplate()));
  out.push('Pengguna    : ' + Object.keys(Auth._users()).join(', ') + (Object.keys(Auth._users()).length ? '' : '(BELUM ADA — jalankan tambahPengguna)'));
  Logger.log(out.join('\n'));
}

/**
 * Migrasi data dari SIPENDOK 1.0 → 1.1 (aman dijalankan berulang):
 *  - 03_PENERIMAAN: menambah kolom NO_KENDARAAN (sebelum WAKTU_INPUT) bila belum ada
 *  - 01_PM: JENIS_PM "Sekolah"/"Posyandu" → "SEKOLAH"/"POSYANDU"
 * Dipanggil otomatis oleh setup().
 */
function migrasiDariV1() {
  var ss = Db.ss(), n = 0;
  var sh = ss.getSheetByName(Cfg.SHEET.PENERIMAAN);
  if (sh) {
    var old = Cfg.HEAD_PENERIMAAN_V1, cur = sh.getRange(1, 1, 1, old.length).getValues()[0];
    if (old.every(function (h, i) { return String(cur[i]).trim() === h; })) {
      var kol = old.indexOf('WAKTU_INPUT') + 1;
      sh.insertColumnBefore(kol);
      sh.getRange(1, kol, 1, 1).setValue('NO_KENDARAAN');   // header kolom baru, agar ensureSheet() tidak menolak
      n++;
    }
  }
  var pm = ss.getSheetByName(Cfg.SHEET.PM);
  if (pm && pm.getLastRow() > 1) {
    var rng = pm.getRange(2, 3, pm.getLastRow() - 1, 1), v = rng.getValues();
    var baru = v.map(function (r) { return [String(r[0]).trim().toUpperCase()]; });
    if (JSON.stringify(v) !== JSON.stringify(baru)) { rng.setValues(baru); n++; }
  }
  n += migrasiKolomAcuanPm_();
  n += migrasiKolomPeriodeBast_();
  n += migrasiKolomJumlahSiswaPm_();
  n += migrasiKolomPosyanduPm_();
  if (n) Logger.log('Migrasi v1 → v1.1: ' + n + ' perubahan.');
  return n;
}

/**
 * Migrasi v1.1 → v1.2 (23 Okt 2026, DISETUJUI Admin -- lihat Bast.gs):
 * tambahkan NOMOR_SJ & KODE_PERIODE ke AKHIR sheet 06_BAST. Pola SAMA
 * dgn migrasiKolomAcuanPm_ -- lihat catatan di sana utk alasan lengkap
 * kenapa migrasi eksplisit ini WAJIB sebelum ensureSheet('BAST').
 */
function migrasiKolomPeriodeBast_() {
  var ss = Db.ss(), sh = ss.getSheetByName(Cfg.SHEET.BAST);
  if (!sh) return 0;
  var kolomSaatIni = Math.max(sh.getLastColumn(), 1);
  var headerSaatIni = sh.getRange(1, 1, 1, kolomSaatIni).getValues()[0].map(function (h) { return String(h).trim(); });
  var kolomBaru = ['NOMOR_SJ', 'KODE_PERIODE'];
  var sudahAda = kolomBaru.every(function (k) { return headerSaatIni.indexOf(k) !== -1; });
  if (sudahAda) return 0;
  var mulaiDari = headerSaatIni.length + 1;
  sh.getRange(1, mulaiDari, 1, kolomBaru.length).setValues([kolomBaru]);
  return 1;
}

/**
 * Migrasi v1.1 → v1.2 (23 Okt 2026, DISETUJUI & DISEDERHANAKAN Admin --
 * lihat Master.gs/Config.gs): tambahkan 3 kolom "nilai acuan"
 * (ACUAN_PORSI_KECIL, ACUAN_PORSI_BESAR, ACUAN_NO_KENDARAAN) ke AKHIR
 * sheet 01_PM -- HANYA Porsi Kecil/Besar/Kendaraan, SENGAJA tidak ada
 * Tenaga Pendidik/Balita/Bumil/Busui (sesuai arahan terbaru: Data
 * Acuan PM disederhanakan, tidak membedakan Sekolah/Posyandu). Aman
 * dipanggil berulang. WAJIB dijalankan sebelum ensureSheet('PM') --
 * lihat catatan lengkap sebelumnya ttg kenapa ensureSheet butuh ini.
 */
function migrasiKolomAcuanPm_() {
  var ss = Db.ss(), pm = ss.getSheetByName(Cfg.SHEET.PM);
  if (!pm) return 0; // belum ada sheet -- ensureSheet akan membuatnya LANGSUNG dgn header lengkap, tidak perlu migrasi
  var kolomSaatIni = Math.max(pm.getLastColumn(), 1);
  var headerSaatIni = pm.getRange(1, 1, 1, kolomSaatIni).getValues()[0].map(function (h) { return String(h).trim(); });
  var kolomAcuan = ['ACUAN_PORSI_KECIL', 'ACUAN_PORSI_BESAR', 'ACUAN_NO_KENDARAAN'];
  var sudahAda = kolomAcuan.every(function (k) { return headerSaatIni.indexOf(k) !== -1; });
  if (sudahAda) return 0;
  var mulaiDari = headerSaatIni.length + 1;
  pm.getRange(1, mulaiDari, 1, kolomAcuan.length).setValues([kolomAcuan]);
  return 1;
}

/**
 * Migrasi v1.2 → v1.3 (25 Okt 2026, DISETUJUI Admin -- lihat Insentif.gs):
 * tambahkan ACUAN_JUMLAH_SISWA ke AKHIR sheet 01_PM. Pola SAMA dgn
 * migrasiKolomAcuanPm_ -- lihat catatan lengkap di sana.
 */
function migrasiKolomJumlahSiswaPm_() {
  var ss = Db.ss(), pm = ss.getSheetByName(Cfg.SHEET.PM);
  if (!pm) return 0;
  var kolomSaatIni = Math.max(pm.getLastColumn(), 1);
  var headerSaatIni = pm.getRange(1, 1, 1, kolomSaatIni).getValues()[0].map(function (h) { return String(h).trim(); });
  if (headerSaatIni.indexOf('ACUAN_JUMLAH_SISWA') !== -1) return 0;
  pm.getRange(1, headerSaatIni.length + 1, 1, 1).setValues([['ACUAN_JUMLAH_SISWA']]);
  return 1;
}

/**
 * Migrasi v1.3 → v1.4 (27 Okt 2026, DISETUJUI Admin): tambahkan
 * ACUAN_BALITA, ACUAN_BUMIL, ACUAN_BUSUI ke AKHIR sheet 01_PM --
 * kembalikan pembedaan Sekolah/Posyandu utk template BAST+SJ 2 lembar.
 * Pola SAMA dgn migrasiKolomJumlahSiswaPm_.
 */
function migrasiKolomPosyanduPm_() {
  var ss = Db.ss(), pm = ss.getSheetByName(Cfg.SHEET.PM);
  if (!pm) return 0;
  var kolomSaatIni = Math.max(pm.getLastColumn(), 1);
  var headerSaatIni = pm.getRange(1, 1, 1, kolomSaatIni).getValues()[0].map(function (h) { return String(h).trim(); });
  if (headerSaatIni.indexOf('ACUAN_BALITA') !== -1) return 0;
  var kolomBaru = ['ACUAN_BALITA', 'ACUAN_BUMIL', 'ACUAN_BUSUI'];
  pm.getRange(1, headerSaatIni.length + 1, 1, kolomBaru.length).setValues([kolomBaru]);
  return 1;
}


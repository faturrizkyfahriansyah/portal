/**
 * SipanduV2.gs — SIPANDU dengan DATABASE BARU (Blueprint §10, keputusan Admin 3 Nov 2026).
 *
 * Cakupan paket ini: Master Instansi, Master PIC (+ riwayat penugasan), dan Manajemen PM Harian
 * (isi per tanggal, salin dari tanggal sebelumnya, SATU konfirmasi untuk seluruh daftar, koreksi
 * beralasan + riwayat). TIDAK menyentuh SIPANDU lama (Operasional Produksi) maupun SIPENDOK.
 *
 * DATABASE: spreadsheet terpisah "DATABASE SIPANDU BARU" (file DATABASE_SIPANDU_BARU_SPPG_JEUNGJING.xlsx
 * diimpor ke Google Sheets). Hubungkan SEKALI dari editor Apps Script:
 *     setSipanduV2SpreadsheetId('<ID spreadsheet>')     lalu     diagnosaSipanduV2()
 *
 * ATURAN (Blueprint §10.3 & §24):
 *  - Tanggal = acuan. Tidak ada periode, tidak ada "acuan" per instansi.
 *  - Satu konfirmasi untuk seluruh daftar PM tanggal itu (bukan per instansi). Tanpa konfirmasi = tidak disimpan.
 *  - KOSONG (belum diisi) != 0 (sudah diisi nol). TOTAL tidak disimpan, selalu dihitung.
 *  - Koreksi: wajib alasan; setiap kolom yang berubah dicatat (nilai sebelum, nilai baru, siapa, kapan) di PM_HISTORY.
 *  - PIC berganti = baris penugasan baru, baris lama ditutup (TANGGAL_AKHIR); riwayat tidak dihapus.
 *  - Setiap operasi tulis memakai LockService (mencegah dua pengguna menimpa bersamaan).
 */
var SIPANDU_V2 = {
  PROP: 'SIPANDU_V2_SPREADSHEET_ID',
  SHEET: { INSTANSI: 'MASTER_INSTANSI', PIC: 'MASTER_PIC', PIC_INSTANSI: 'PIC_INSTANSI', PM_HARIAN: 'PM_HARIAN',
           DETAIL: 'DETAIL_PM_HARIAN', HISTORY: 'PM_HISTORY', AUDIT: 'AUDIT_LOG', JENIS: 'REF_JENIS_INSTANSI', MENU: 'MENU_HARIAN', TARIF: 'MASTER_TARIF' },
  KATEGORI: ['PK', 'PB', 'BUMIL', 'BUSUI', 'BALITA'],
  HEADER_WAJIB: {
    MASTER_INSTANSI: ['ID_INSTANSI', 'NAMA_INSTANSI', 'JENIS_INSTANSI', 'NPSN', 'STATUS', 'URUTAN_TAMPIL', 'JUMLAH_SISWA'],
    MASTER_PIC: ['ID_PIC', 'NAMA_PIC', 'JABATAN', 'NOMOR_HP', 'NOMOR_REKENING', 'STATUS'],
    PIC_INSTANSI: ['ID_PIC_INSTANSI', 'ID_INSTANSI', 'ID_PIC', 'TANGGAL_MULAI', 'TANGGAL_AKHIR'],
    PM_HARIAN: ['ID_PM_HARIAN', 'TANGGAL', 'STATUS', 'DIKONFIRMASI_OLEH', 'DIKONFIRMASI_PADA', 'DISALIN_DARI_TANGGAL'],
    DETAIL_PM_HARIAN: ['ID_DETAIL', 'ID_PM_HARIAN', 'ID_INSTANSI', 'PK', 'PB', 'BUMIL', 'BUSUI', 'BALITA', 'ID_PIC', 'NO_KENDARAAN'],
    PM_HISTORY: ['ID_HISTORY', 'WAKTU', 'ID_PM_HARIAN', 'TANGGAL', 'ID_INSTANSI', 'KOLOM', 'NILAI_SEBELUM', 'NILAI_BARU', 'ALASAN', 'DIUBAH_OLEH'],
    AUDIT_LOG: ['ID_AUDIT', 'WAKTU', 'AKTOR', 'AKSI', 'TABEL', 'ID_TERKAIT', 'DETAIL'],
    REF_JENIS_INSTANSI: ['KODE', 'NAMA'],
    MASTER_TARIF: ['ID_TARIF', 'KATEGORI', 'KUNCI', 'BATAS_MIN', 'BATAS_MAKS', 'TARIF', 'SATUAN', 'TANGGAL_BERLAKU'],
    MENU_HARIAN: ['ID_MENU', 'TANGGAL', 'KARBOHIDRAT', 'LAUK_HEWANI', 'LAUK_NABATI', 'SAYUR', 'BUAH', 'PERLENGKAPAN', 'STATUS', 'DISETUJUI_OLEH', 'DISETUJUI_PADA']
  }
};

// ======================= KONEKSI & DIAGNOSA =======================
/** Tulis ke Log Eksekusi (editor Apps Script TIDAK menampilkan nilai kembalian fungsi). */
function v2Log_(x) { try { Logger.log(typeof x === 'string' ? x : JSON.stringify(x)); } catch (e) { /* di luar editor: abaikan */ } return x; }

/**
 * CARA MENGHUBUNGKAN (dari editor Apps Script, tanpa mengetik argumen):
 *   1. Ganti teks GANTI_DENGAN_ID_SPREADSHEET di bawah dengan ID spreadsheet SIPANDU baru
 *      (bagian tautan di antara /d/ dan /edit), tetap di dalam tanda kutip.
 *   2. Pilih fungsi "hubungkanSipanduV2" di menu atas, klik Run (setujui izin saat diminta).
 *   3. Lihat hasilnya di "Execution log" (bawah layar): harus tertulis "Tersambung ke ...".
 */
function hubungkanSipanduV2() {
  var ID = 'GANTI_DENGAN_ID_SPREADSHEET';
  if (ID === 'GANTI_DENGAN_ID_SPREADSHEET') return v2Log_('BELUM DIISI: ganti teks GANTI_DENGAN_ID_SPREADSHEET pada fungsi hubungkanSipanduV2 dengan ID spreadsheet, lalu Run lagi.');
  try { return v2Log_(setSipanduV2SpreadsheetId(ID)); } catch (e) { return v2Log_('GAGAL: ' + e.message); }
}
/** Periksa sambungan & struktur kapan saja (hasil di Execution log). */
function periksaSipanduV2() { return v2Log_(diagnosaSipanduV2()); }

/** Jalankan SEKALI dari editor Apps Script. Memeriksa struktur, baru menyimpan ID. */
function setSipanduV2SpreadsheetId(idSpreadsheet) {
  var id = String(idSpreadsheet || '').trim();
  if (!id) throw new Error('Isi ID spreadsheet (bagian antara /d/ dan /edit pada tautan).');
  var ss = SpreadsheetApp.openById(id);
  var laporan = v2PeriksaStruktur_(ss);
  if (laporan.masalah.length) throw new Error('Struktur database belum sesuai:\n- ' + laporan.masalah.join('\n- '));
  PropertiesService.getScriptProperties().setProperty(SIPANDU_V2.PROP, id);
  return 'Tersambung ke "' + ss.getName() + '". ' + laporan.ringkas;
}

function diagnosaSipanduV2() {
  var id = PropertiesService.getScriptProperties().getProperty(SIPANDU_V2.PROP);
  if (!id) return 'BELUM TERSAMBUNG. Jalankan setSipanduV2SpreadsheetId(ID).';
  var laporan = v2PeriksaStruktur_(SpreadsheetApp.openById(id));
  return (laporan.masalah.length ? 'MASALAH:\n- ' + laporan.masalah.join('\n- ') + '\n' : 'Struktur OK. ') + laporan.ringkas;
}

function v2PeriksaStruktur_(ss) {
  var masalah = [], ringkas = [];
  Object.keys(SIPANDU_V2.HEADER_WAJIB).forEach(function (nama) {
    var sh = ss.getSheetByName(nama);
    if (!sh) { masalah.push('Sheet "' + nama + '" tidak ditemukan.'); return; }
    var header = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    var kurang = SIPANDU_V2.HEADER_WAJIB[nama].filter(function (h) { return header.indexOf(h) < 0; });
    if (kurang.length) masalah.push('Sheet "' + nama + '" kekurangan kolom: ' + kurang.join(', '));
    ringkas.push(nama + '=' + Math.max(sh.getLastRow() - 1, 0));
  });
  return { masalah: masalah, ringkas: ringkas.join(', ') };
}

function v2Spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(SIPANDU_V2.PROP);
  if (!id) throw new Error('SIPANDU_V2_BELUM_DISAMBUNGKAN: database SIPANDU baru belum disambungkan. Jalankan setSipanduV2SpreadsheetId(ID) di editor Apps Script.');
  return SpreadsheetApp.openById(id);
}

// ======================= LAPISAN DATA =======================
function v2Sheet_(kunci) {
  var sh = v2Spreadsheet_().getSheetByName(SIPANDU_V2.SHEET[kunci]);
  if (!sh) throw new Error('Sheet "' + SIPANDU_V2.SHEET[kunci] + '" tidak ditemukan di database SIPANDU baru.');
  return sh;
}
/** Baca satu sheet -> { header:[...], baris:[{kolom:nilai, _row:nomorBaris}] }; baris kosong dilewati. */
function v2Baca_(kunci) {
  var sh = v2Sheet_(kunci), semua = sh.getDataRange().getValues();
  var header = (semua[0] || []).map(function (h) { return String(h).trim(); });
  var baris = [];
  for (var i = 1; i < semua.length; i++) {
    var r = semua[i];
    if (!r.some(function (c) { return c !== '' && c !== null; })) continue;
    var o = { _row: i + 1 };
    header.forEach(function (h, j) { if (h) o[h] = r[j]; });
    baris.push(o);
  }
  return { header: header, baris: baris };
}
function v2Tambah_(kunci, obj, header) {
  var sh = v2Sheet_(kunci);
  sh.appendRow(header.map(function (h) { return (obj[h] === undefined || obj[h] === null) ? '' : obj[h]; }));
}
function v2Ubah_(kunci, barisLama, perubahan, header) {
  var sh = v2Sheet_(kunci);
  var arr = header.map(function (h) { var v = (perubahan[h] !== undefined) ? perubahan[h] : barisLama[h]; return (v === undefined || v === null) ? '' : v; });
  sh.getRange(barisLama._row, 1, 1, header.length).setValues([arr]);
}
function v2Audit_(aktor, aksi, tabel, idTerkait, detail) {
  try {
    var t = v2Baca_('AUDIT');
    v2Tambah_('AUDIT', { ID_AUDIT: 'AUD-' + Utilities.getUuid().slice(0, 8), WAKTU: new Date(), AKTOR: aktor, AKSI: aksi, TABEL: tabel, ID_TERKAIT: idTerkait, DETAIL: (typeof detail === 'string' ? detail : JSON.stringify(detail || {})).slice(0, 900) }, t.header);
  } catch (e) { /* audit tidak boleh menggagalkan operasi utama */ }
  try { logAudit_(aksi, 'SIPANDU', idTerkait, aktor, detail); } catch (e) { /* idem */ }
}

// ======================= UTIL =======================
function v2Str_(v) { return (v === null || v === undefined) ? '' : String(v).replace(/\s+/g, ' ').trim(); }
function v2Tz_() { return Session.getScriptTimeZone() || 'Asia/Jakarta'; }
function v2IsoValid_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return false;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) && Number(m[1]) >= 2020 && Number(m[1]) <= 2100;
}
/** Nilai sel (Date atau teks) -> 'yyyy-MM-dd' atau ''. */
function v2Iso_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, v2Tz_(), 'yyyy-MM-dd');
  var s = String(v).trim(), m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}
function v2Tgl_(iso) { var p = iso.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
function v2HariKe_(iso, n) { var d = v2Tgl_(iso); d.setDate(d.getDate() + n); return Utilities.formatDate(d, v2Tz_(), 'yyyy-MM-dd'); }
/** '' / null -> null (belum diisi). Angka bulat >= 0 -> number. Selain itu error. */
function v2Angka_(v, label) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  var s = String(v).trim();
  if (!/^\d+$/.test(s)) throw new Error(label + ' harus berupa angka bulat 0 atau lebih (atau dikosongkan bila belum diisi).');
  var n = Number(s);
  if (n > 100000) throw new Error(label + ' tidak masuk akal (' + n + ').');
  return n;
}
function v2Nilai_(v) { return (v === '' || v === null || v === undefined) ? null : Number(v); }
function v2Normal_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function v2NomorBerikut_(baris, kolom, prefix, lebar) {
  var maks = 0;
  baris.forEach(function (r) { var m = new RegExp('^' + prefix + '-(\\d+)$').exec(String(r[kolom] || '')); if (m) maks = Math.max(maks, Number(m[1])); });
  return prefix + '-' + ('000000' + (maks + 1)).slice(-lebar);
}
/** ACUAN (4 Nov 2026): nilai AWAL untuk mengisi PM Harian, seperti di SIPENDOK. BUKAN sumber laporan. */
var V2_ACUAN = [['acuanPk', 'ACUAN_PORSI_KECIL'], ['acuanPb', 'ACUAN_PORSI_BESAR'], ['acuanBalita', 'ACUAN_BALITA'], ['acuanBumil', 'ACUAN_BUMIL'], ['acuanBusui', 'ACUAN_BUSUI']];
var V2_KOLOM_ACUAN = ['ACUAN_PORSI_KECIL', 'ACUAN_PORSI_BESAR', 'ACUAN_BALITA', 'ACUAN_BUMIL', 'ACUAN_BUSUI', 'ACUAN_NO_KENDARAAN'];
/** Tambahkan kolom yang belum ada di kanan sheet (data tidak berubah). Dipakai bila database dibuat dari versi skema lama. */
function v2PastikanKolom_(kunci, kolom) {
  var sh = v2Sheet_(kunci), header = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  var kurang = kolom.filter(function (k) { return header.indexOf(k) < 0; });
  if (kurang.length) sh.getRange(1, header.length + 1, 1, kurang.length).setValues([kurang]);
  return kurang.length;
}
function v2Cek_(body, izin) {
  var aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'SIPANDU', izin);
  return aktor;
}
function v2BisaEdit_(aktor) { try { return cekIzinModul_(aktor, 'SIPANDU', 'EDIT'); } catch (e) { return false; } }
function v2Kunci_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ======================= STATUS =======================
function getStatusSipanduV2(body) {
  v2Cek_(body, 'VIEW');
  try {
    var laporan = v2PeriksaStruktur_(v2Spreadsheet_());
    return { terhubung: laporan.masalah.length === 0, pesan: laporan.masalah.length ? laporan.masalah.join(' ') : '', ringkas: laporan.ringkas };
  } catch (e) {
    return { terhubung: false, pesan: String(e.message || e).replace('SIPANDU_V2_BELUM_DISAMBUNGKAN: ', ''), ringkas: '' };
  }
}

// ======================= MASTER INSTANSI & PIC =======================
function v2PenugasanAktif_(penugasan, idInstansi, iso) {
  var cocok = penugasan.filter(function (p) {
    var mulai = v2Iso_(p.TANGGAL_MULAI), akhir = v2Iso_(p.TANGGAL_AKHIR);
    return p.ID_INSTANSI === idInstansi && mulai && mulai <= iso && (!akhir || akhir >= iso);
  });
  cocok.sort(function (a, b) { return v2Iso_(a.TANGGAL_MULAI) < v2Iso_(b.TANGGAL_MULAI) ? 1 : -1; });
  return cocok.length ? cocok[0] : null;
}

function getInstansiV2(body) {
  var aktor = v2Cek_(body, 'VIEW');
  var boleh = v2BisaEdit_(aktor);
  var ins = v2Baca_('INSTANSI').baris, pic = v2Baca_('PIC').baris, pen = v2Baca_('PIC_INSTANSI').baris, jenis = v2Baca_('JENIS').baris;
  var hariIni = Utilities.formatDate(new Date(), v2Tz_(), 'yyyy-MM-dd');
  var picMap = {}; pic.forEach(function (p) { picMap[p.ID_PIC] = p; });
  var instansi = ins.map(function (r) {
    var tugas = v2PenugasanAktif_(pen, r.ID_INSTANSI, hariIni), p = tugas ? picMap[tugas.ID_PIC] : null;
    return { idInstansi: r.ID_INSTANSI, nama: r.NAMA_INSTANSI, jenis: r.JENIS_INSTANSI, npsn: v2Str_(r.NPSN), alamat: v2Str_(r.ALAMAT), desa: v2Str_(r.DESA_KELURAHAN),
             kecamatan: v2Str_(r.KECAMATAN), jumlahSiswa: v2Nilai_(r.JUMLAH_SISWA),
             acuanPk: v2Nilai_(r.ACUAN_PORSI_KECIL), acuanPb: v2Nilai_(r.ACUAN_PORSI_BESAR), acuanBalita: v2Nilai_(r.ACUAN_BALITA), acuanBumil: v2Nilai_(r.ACUAN_BUMIL), acuanBusui: v2Nilai_(r.ACUAN_BUSUI), acuanNoKendaraan: v2Str_(r.ACUAN_NO_KENDARAAN), urutan: v2Nilai_(r.URUTAN_TAMPIL), status: v2Str_(r.STATUS), keterangan: v2Str_(r.KETERANGAN),
             idPic: p ? p.ID_PIC : '', namaPic: p ? p.NAMA_PIC : '', jabatanPic: p ? v2Str_(p.JABATAN) : '' };
  }).sort(function (a, b) { return ((a.urutan === null ? 9999 : a.urutan) - (b.urutan === null ? 9999 : b.urutan)) || String(a.nama).localeCompare(String(b.nama)); });
  var daftarPic = pic.map(function (p) {
    var punya = pen.filter(function (x) { return x.ID_PIC === p.ID_PIC && !v2Iso_(x.TANGGAL_AKHIR); }).map(function (x) { return x.ID_INSTANSI; });
    return { idPic: p.ID_PIC, nama: p.NAMA_PIC, jabatan: v2Str_(p.JABATAN), nomorHp: v2Str_(p.NOMOR_HP), nomorRekening: boleh ? v2Str_(p.NOMOR_REKENING) : (p.NOMOR_REKENING ? '••••' : ''),
             status: v2Str_(p.STATUS), keterangan: v2Str_(p.KETERANGAN), instansiAktif: punya };
  });
  return { instansi: instansi, pic: daftarPic, jenis: jenis.map(function (j) { return { kode: j.KODE, nama: j.NAMA }; }), bolehEdit: boleh };
}

function simpanInstansiV2(body) {
  var aktor = requireAuth(body.token);
  var id = v2Str_(body.idInstansi);
  requireIzinModulBaru_(aktor, 'SIPANDU', id ? 'EDIT' : 'CREATE');
  var nama = v2Str_(body.nama), jenis = v2Str_(body.jenis).toUpperCase(), status = (v2Str_(body.status) || 'AKTIF').toUpperCase();
  var npsn = v2Str_(body.npsn).replace(/\s/g, '');
  if (!nama) throw new Error('Nama instansi wajib diisi.');
  if (nama.length > 150) throw new Error('Nama instansi terlalu panjang (maks 150 karakter).');
  if (['AKTIF', 'NONAKTIF'].indexOf(status) < 0) throw new Error('Status harus AKTIF atau NONAKTIF.');
  if (npsn && !/^\d{5,12}$/.test(npsn)) throw new Error('NPSN harus berupa 5-12 angka.');
  var jumlahSiswa = v2Angka_(body.jumlahSiswa, 'Jumlah siswa');
  var urutan = v2Angka_(body.urutan, 'Urutan tampil');
  var acuan = {}; V2_ACUAN.forEach(function (a) { var n = v2Angka_(body[a[0]], 'Acuan ' + a[1].replace('ACUAN_', '').toLowerCase()); acuan[a[1]] = n === null ? '' : n; });
  acuan.ACUAN_NO_KENDARAAN = v2Str_(body.acuanNoKendaraan).toUpperCase();
  if (acuan.ACUAN_NO_KENDARAAN.length > 30) throw new Error('Nomor kendaraan acuan terlalu panjang.');
  return v2Kunci_(function () {
    v2PastikanKolom_('INSTANSI', V2_KOLOM_ACUAN);
    var t = v2Baca_('INSTANSI'), jenisRef = v2Baca_('JENIS').baris.map(function (j) { return j.KODE; });
    if (jenisRef.indexOf(jenis) < 0) throw new Error('Jenis instansi tidak dikenal. Pilih: ' + jenisRef.join(', ') + '.');
    var lama = id ? t.baris.filter(function (r) { return r.ID_INSTANSI === id; })[0] : null;
    if (id && !lama) throw new Error('Instansi ' + id + ' tidak ditemukan.');
    var kembar = t.baris.filter(function (r) { return r.ID_INSTANSI !== id && v2Normal_(r.NAMA_INSTANSI) === v2Normal_(nama); })[0];
    if (kembar) throw new Error('Nama instansi sudah ada (' + kembar.ID_INSTANSI + ' - ' + kembar.NAMA_INSTANSI + ').');
    if (npsn) { var npsnKembar = t.baris.filter(function (r) { return r.ID_INSTANSI !== id && v2Str_(r.NPSN) === npsn; })[0]; if (npsnKembar) throw new Error('NPSN ' + npsn + ' sudah dipakai ' + npsnKembar.NAMA_INSTANSI + '.'); }
    var data = { NAMA_INSTANSI: nama, JENIS_INSTANSI: jenis, NPSN: npsn, ALAMAT: v2Str_(body.alamat), DESA_KELURAHAN: v2Str_(body.desa), KECAMATAN: v2Str_(body.kecamatan),
                 JUMLAH_SISWA: jumlahSiswa === null ? '' : jumlahSiswa, URUTAN_TAMPIL: urutan === null ? '' : urutan, STATUS: status, KETERANGAN: v2Str_(body.keterangan), DIUBAH_PADA: new Date(), DIUBAH_OLEH: aktor };
    Object.keys(acuan).forEach(function (k) { data[k] = acuan[k]; });
    if (lama) { v2Ubah_('INSTANSI', lama, data, t.header); v2Audit_(aktor, 'UBAH_INSTANSI_V2', 'MASTER_INSTANSI', id, { nama: nama, status: status }); return { idInstansi: id, baru: false }; }
    var idBaru = v2NomorBerikut_(t.baris, 'ID_INSTANSI', 'PM', 3);
    data.ID_INSTANSI = idBaru; data.DIBUAT_PADA = new Date(); data.DIBUAT_OLEH = aktor;
    if (!data.URUTAN_TAMPIL) data.URUTAN_TAMPIL = t.baris.length + 1;
    v2Tambah_('INSTANSI', data, t.header);
    v2Audit_(aktor, 'TAMBAH_INSTANSI_V2', 'MASTER_INSTANSI', idBaru, { nama: nama, jenis: jenis });
    return { idInstansi: idBaru, baru: true };
  });
}

function simpanPicV2(body) {
  var aktor = requireAuth(body.token);
  var id = v2Str_(body.idPic);
  requireIzinModulBaru_(aktor, 'SIPANDU', id ? 'EDIT' : 'CREATE');
  var nama = v2Str_(body.nama), status = (v2Str_(body.status) || 'AKTIF').toUpperCase();
  if (!nama) throw new Error('Nama PIC wajib diisi.');
  if (['AKTIF', 'NONAKTIF'].indexOf(status) < 0) throw new Error('Status harus AKTIF atau NONAKTIF.');
  return v2Kunci_(function () {
    var t = v2Baca_('PIC');
    var lama = id ? t.baris.filter(function (r) { return r.ID_PIC === id; })[0] : null;
    if (id && !lama) throw new Error('PIC ' + id + ' tidak ditemukan.');
    // HP & rekening: format yang DIKETIK pengguna dipertahankan apa adanya (mis. 0812-3456-7890), divalidasi hanya bila
    // BERUBAH dari nilai tersimpan -- jadi mengedit jabatan tidak mengubah/menolak data lama. Bentuk samaran (••••) = tidak diubah.
    var hp = v2Str_(body.nomorHp), rek = v2Str_(body.nomorRekening);
    if (lama && /•/.test(rek)) rek = v2Str_(lama.NOMOR_REKENING);
    if (hp && !(lama && hp === v2Str_(lama.NOMOR_HP)) && !/^\+?\d{6,16}$/.test(hp.replace(/[\s-]/g, ''))) throw new Error('Nomor HP tidak valid (hanya angka, boleh diawali +).');
    if (rek && !(lama && rek === v2Str_(lama.NOMOR_REKENING)) && !/^\d{4,25}$/.test(rek.replace(/[\s.-]/g, ''))) throw new Error('Nomor rekening hanya boleh angka (4-25 digit).');
    var data = { NAMA_PIC: nama, JABATAN: v2Str_(body.jabatan), NOMOR_HP: hp, NOMOR_REKENING: rek, STATUS: status, KETERANGAN: v2Str_(body.keterangan), DIUBAH_PADA: new Date(), DIUBAH_OLEH: aktor };
    if (lama) { v2Ubah_('PIC', lama, data, t.header); v2Audit_(aktor, 'UBAH_PIC_V2', 'MASTER_PIC', id, { nama: nama, status: status }); return { idPic: id, baru: false }; }
    var idBaru = v2NomorBerikut_(t.baris, 'ID_PIC', 'PIC', 3);
    data.ID_PIC = idBaru; data.DIBUAT_PADA = new Date(); data.DIBUAT_OLEH = aktor;
    v2Tambah_('PIC', data, t.header);
    v2Audit_(aktor, 'TAMBAH_PIC_V2', 'MASTER_PIC', idBaru, { nama: nama });
    return { idPic: idBaru, baru: true };
  });
}

/** Ganti/tetapkan PIC sebuah instansi. Baris lama ditutup (TANGGAL_AKHIR = sehari sebelum mulai), tidak dihapus. */
function tugaskanPicV2(body) {
  var aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'SIPANDU', 'EDIT');
  var idInstansi = v2Str_(body.idInstansi), idPic = v2Str_(body.idPic), mulai = v2Str_(body.tanggalMulai);
  if (!idInstansi || !idPic) throw new Error('Instansi dan PIC wajib dipilih.');
  if (!v2IsoValid_(mulai)) throw new Error('Tanggal mulai tidak valid.');
  return v2Kunci_(function () {
    var ins = v2Baca_('INSTANSI').baris, pic = v2Baca_('PIC').baris, pen = v2Baca_('PIC_INSTANSI');
    if (!ins.some(function (r) { return r.ID_INSTANSI === idInstansi; })) throw new Error('Instansi tidak ditemukan.');
    var p = pic.filter(function (r) { return r.ID_PIC === idPic; })[0];
    if (!p) throw new Error('PIC tidak ditemukan.');
    if (v2Str_(p.STATUS).toUpperCase() !== 'AKTIF') throw new Error('PIC ' + p.NAMA_PIC + ' berstatus NONAKTIF.');
    var terbuka = pen.baris.filter(function (r) { return r.ID_INSTANSI === idInstansi && !v2Iso_(r.TANGGAL_AKHIR); })[0];
    if (terbuka && terbuka.ID_PIC === idPic) throw new Error(p.NAMA_PIC + ' sudah menjadi PIC instansi ini.');
    if (terbuka && v2Iso_(terbuka.TANGGAL_MULAI) >= mulai) throw new Error('Tanggal mulai harus setelah ' + v2Iso_(terbuka.TANGGAL_MULAI) + ' (mulai PIC saat ini).');
    if (terbuka) v2Ubah_('PIC_INSTANSI', terbuka, { TANGGAL_AKHIR: v2Tgl_(v2HariKe_(mulai, -1)), KETERANGAN: v2Str_(terbuka.KETERANGAN) }, pen.header);
    var idBaru = v2NomorBerikut_(pen.baris, 'ID_PIC_INSTANSI', 'PI', 3);
    v2Tambah_('PIC_INSTANSI', { ID_PIC_INSTANSI: idBaru, ID_INSTANSI: idInstansi, ID_PIC: idPic, TANGGAL_MULAI: v2Tgl_(mulai), KETERANGAN: v2Str_(body.keterangan), DIBUAT_PADA: new Date(), DIBUAT_OLEH: aktor }, pen.header);
    v2Audit_(aktor, 'TUGASKAN_PIC_V2', 'PIC_INSTANSI', idBaru, { instansi: idInstansi, pic: idPic, mulai: mulai, menggantikan: terbuka ? terbuka.ID_PIC : '' });
    return { idPicInstansi: idBaru };
  });
}

// ======================= PM HARIAN =======================
function v2Jumlah_(r) {
  var ada = false, t = 0;
  SIPANDU_V2.KATEGORI.forEach(function (k) { if (r[k] !== null && r[k] !== undefined && r[k] !== '') { ada = true; t += Number(r[k]); } });
  return ada ? t : null;
}

/** Bangun tampilan PM sebuah tanggal. salinDari (opsional): isi awal dari tanggal lain bila tanggal ini BELUM punya data. */
function v2PmHarianData_(iso, salinDari, dariAcuan) {
  var ins = v2Baca_('INSTANSI').baris, pen = v2Baca_('PIC_INSTANSI').baris, pic = v2Baca_('PIC').baris;
  var hdr = v2Baca_('PM_HARIAN').baris, det = v2Baca_('DETAIL').baris;
  var picMap = {}; pic.forEach(function (p) { picMap[p.ID_PIC] = p; });
  var header = hdr.filter(function (h) { return v2Iso_(h.TANGGAL) === iso; })[0] || null;
  var peringatan = '';
  var sumber = null, sumberTanggal = '';
  if (header) {
    sumber = det.filter(function (d) { return d.ID_PM_HARIAN === header.ID_PM_HARIAN; });
    if (salinDari || dariAcuan) peringatan = 'Tanggal ini sudah memiliki data tersimpan; permintaan salin/isi dari acuan diabaikan. Gunakan Ubah untuk mengoreksi.';
  } else if (salinDari) {
    if (!v2IsoValid_(salinDari)) throw new Error('Tanggal asal salinan tidak valid.');
    var hs = hdr.filter(function (h) { return v2Iso_(h.TANGGAL) === salinDari; })[0];
    if (!hs) throw new Error('Tanggal ' + salinDari + ' belum memiliki data PM untuk disalin.');
    sumber = det.filter(function (d) { return d.ID_PM_HARIAN === hs.ID_PM_HARIAN; });
    sumberTanggal = salinDari;
  }
  var perInstansi = {}; (sumber || []).forEach(function (d) { perInstansi[d.ID_INSTANSI] = d; });
  var tampil = ins.filter(function (r) { return v2Str_(r.STATUS).toUpperCase() === 'AKTIF' || (header && perInstansi[r.ID_INSTANSI]); });
  tampil.sort(function (a, b) { return ((v2Nilai_(a.URUTAN_TAMPIL) === null ? 9999 : v2Nilai_(a.URUTAN_TAMPIL)) - (v2Nilai_(b.URUTAN_TAMPIL) === null ? 9999 : v2Nilai_(b.URUTAN_TAMPIL))) || String(a.NAMA_INSTANSI).localeCompare(String(b.NAMA_INSTANSI)); });
  var baris = tampil.map(function (r) {
    var d = perInstansi[r.ID_INSTANSI];
    var tugas = v2PenugasanAktif_(pen, r.ID_INSTANSI, iso);
    var idPic = header && d && d.ID_PIC ? d.ID_PIC : (tugas ? tugas.ID_PIC : '');
    var acuan = { pk: v2Nilai_(r.ACUAN_PORSI_KECIL), pb: v2Nilai_(r.ACUAN_PORSI_BESAR), bumil: v2Nilai_(r.ACUAN_BUMIL), busui: v2Nilai_(r.ACUAN_BUSUI), balita: v2Nilai_(r.ACUAN_BALITA), noKendaraan: v2Str_(r.ACUAN_NO_KENDARAAN) };
    var pakaiAcuan = !header && !salinDari && dariAcuan === true;
    var o = { idInstansi: r.ID_INSTANSI, nama: r.NAMA_INSTANSI, jenis: r.JENIS_INSTANSI, nonaktif: v2Str_(r.STATUS).toUpperCase() !== 'AKTIF',
              noKendaraan: d ? v2Str_(d.NO_KENDARAAN) : (pakaiAcuan ? acuan.noKendaraan : ''), idPic: idPic, namaPic: idPic && picMap[idPic] ? picMap[idPic].NAMA_PIC : '', tersimpan: !!(header && d), acuan: acuan };
    SIPANDU_V2.KATEGORI.forEach(function (k) { o[k.toLowerCase()] = d ? v2Nilai_(d[k]) : (pakaiAcuan ? acuan[k.toLowerCase()] : null); });
    o.total = v2Jumlah_({ PK: o.pk, PB: o.pb, BUMIL: o.bumil, BUSUI: o.busui, BALITA: o.balita });
    return o;
  });
  var tot = { pk: 0, pb: 0, bumil: 0, busui: 0, balita: 0, porsi: 0, instansiTerisi: 0 };
  baris.forEach(function (b) { ['pk', 'pb', 'bumil', 'busui', 'balita'].forEach(function (k) { tot[k] += b[k] || 0; }); if (b.total !== null) { tot.porsi += b.total; tot.instansiTerisi++; } });
  var sebelumnya = hdr.map(function (h) { return v2Iso_(h.TANGGAL); }).filter(function (t) { return t && t < iso; }).sort().pop() || '';
  return {
    tanggal: iso,
    header: header ? { idPmHarian: header.ID_PM_HARIAN, status: v2Str_(header.STATUS), dikonfirmasiOleh: v2Str_(header.DIKONFIRMASI_OLEH),
                       dikonfirmasiPada: header.DIKONFIRMASI_PADA ? Utilities.formatDate(new Date(header.DIKONFIRMASI_PADA), v2Tz_(), 'yyyy-MM-dd HH:mm') : '',
                       disalinDariTanggal: v2Iso_(header.DISALIN_DARI_TANGGAL) } : null,
    draftSalinan: !header && !!salinDari, draftAcuan: !header && !salinDari && dariAcuan === true, disalinDariTanggal: sumberTanggal, tanggalSebelumnya: sebelumnya,
    baris: baris, total: tot, peringatan: peringatan
  };
}

function getPmHarianV2(body) {
  v2Cek_(body, 'VIEW');
  var iso = v2Str_(body.tanggal);
  if (!v2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  return v2PmHarianData_(iso, v2Str_(body.salinDari), body.dariAcuan === true);
}

/**
 * Simpan PM harian satu tanggal. body: { token, tanggal, konfirmasi:true, alasan?, salinDariTanggal?, baris:[{idInstansi,pk,pb,bumil,busui,balita,noKendaraan}] }
 * Tanggal baru -> simpan awal. Tanggal yang sudah ada -> KOREKSI (alasan wajib, tiap perubahan dicatat di PM_HISTORY).
 */
function simpanPmHarianV2(body) {
  var aktor = requireAuth(body.token);
  var iso = v2Str_(body.tanggal);
  if (!v2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  if (body.konfirmasi !== true) throw new Error('Centang konfirmasi bahwa seluruh daftar PM tanggal ini sudah diperiksa sebelum menyimpan.');
  if (!Array.isArray(body.baris) || !body.baris.length) throw new Error('Tidak ada baris PM yang dikirim.');
  var masuk = [], terlihat = {};
  body.baris.forEach(function (b) {
    var id = v2Str_(b.idInstansi);
    if (!id) throw new Error('Ada baris tanpa instansi.');
    if (terlihat[id]) throw new Error('Instansi ' + id + ' muncul lebih dari sekali.');
    terlihat[id] = true;
    var r = { idInstansi: id, noKendaraan: v2Str_(b.noKendaraan).toUpperCase() };
    if (r.noKendaraan.length > 30) throw new Error('Nomor kendaraan terlalu panjang (' + id + ').');
    SIPANDU_V2.KATEGORI.forEach(function (k) { r[k] = v2Angka_(b[k.toLowerCase()], k + ' (' + id + ')'); });
    masuk.push(r);
  });
  return v2Kunci_(function () {
    var ins = v2Baca_('INSTANSI').baris, pen = v2Baca_('PIC_INSTANSI').baris;
    var hdrT = v2Baca_('PM_HARIAN'), detT = v2Baca_('DETAIL'), hisT = v2Baca_('HISTORY');
    var header = hdrT.baris.filter(function (h) { return v2Iso_(h.TANGGAL) === iso; })[0] || null;
    requireIzinModulBaru_(aktor, 'SIPANDU', header ? 'EDIT' : 'CREATE');
    var insMap = {}; ins.forEach(function (r) { insMap[r.ID_INSTANSI] = r; });
    var lama = {}; if (header) detT.baris.filter(function (d) { return d.ID_PM_HARIAN === header.ID_PM_HARIAN; }).forEach(function (d) { lama[d.ID_INSTANSI] = d; });
    var adaIsi = false;
    masuk.forEach(function (r) {
      var rec = insMap[r.idInstansi];
      if (!rec) throw new Error('Instansi ' + r.idInstansi + ' tidak ada di Master Instansi.');
      var berisi = r.noKendaraan !== '' || SIPANDU_V2.KATEGORI.some(function (k) { return r[k] !== null; });
      if (berisi) adaIsi = true;
      if (v2Str_(rec.STATUS).toUpperCase() !== 'AKTIF' && !lama[r.idInstansi] && berisi) throw new Error('Instansi ' + rec.NAMA_INSTANSI + ' berstatus NONAKTIF.');
    });
    if (!adaIsi && !header) throw new Error('Belum ada angka yang diisi. Isi minimal satu instansi.');

    // ---- hitung perubahan (hanya relevan utk koreksi) ----
    var perubahan = [];
    masuk.forEach(function (r) {
      var d = lama[r.idInstansi];
      SIPANDU_V2.KATEGORI.concat(['NO_KENDARAAN']).forEach(function (k) {
        var sebelum = d ? (k === 'NO_KENDARAAN' ? v2Str_(d[k]) : v2Nilai_(d[k])) : (k === 'NO_KENDARAAN' ? '' : null);
        var sesudah = k === 'NO_KENDARAAN' ? r.noKendaraan : r[k];
        if (sebelum !== sesudah) perubahan.push({ idInstansi: r.idInstansi, kolom: k, sebelum: sebelum === null ? '' : sebelum, sesudah: sesudah === null ? '' : sesudah });
      });
    });
    var alasan = v2Str_(body.alasan);
    if (header) {
      if (alasan.length < 3) throw new Error('Alasan koreksi wajib diisi (minimal 3 karakter).');
      if (!perubahan.length) throw new Error('Tidak ada perubahan untuk disimpan.');
    }

    // ---- tulis ----
    var sekarang = new Date(), kodeTgl = iso.replace(/-/g, '');
    if (!header) {
      var salin = v2Str_(body.salinDariTanggal);
      v2Tambah_('PM_HARIAN', { ID_PM_HARIAN: 'PMH-' + kodeTgl, TANGGAL: v2Tgl_(iso), STATUS: 'TERVERIFIKASI', DIKONFIRMASI_OLEH: aktor, DIKONFIRMASI_PADA: sekarang,
                               DISALIN_DARI_TANGGAL: v2IsoValid_(salin) ? v2Tgl_(salin) : '', DIBUAT_PADA: sekarang, DIBUAT_OLEH: aktor }, hdrT.header);
    } else {
      v2Ubah_('PM_HARIAN', header, { STATUS: 'TERVERIFIKASI', DIKONFIRMASI_OLEH: aktor, DIKONFIRMASI_PADA: sekarang, DIUBAH_PADA: sekarang, DIUBAH_OLEH: aktor }, hdrT.header);
    }
    var idHeader = header ? header.ID_PM_HARIAN : 'PMH-' + kodeTgl;
    masuk.forEach(function (r) {
      var d = lama[r.idInstansi];
      var nilai = { PK: r.PK === null ? '' : r.PK, PB: r.PB === null ? '' : r.PB, BUMIL: r.BUMIL === null ? '' : r.BUMIL, BUSUI: r.BUSUI === null ? '' : r.BUSUI, BALITA: r.BALITA === null ? '' : r.BALITA, NO_KENDARAAN: r.noKendaraan };
      if (d) {
        var berubah = perubahan.some(function (p) { return p.idInstansi === r.idInstansi; });
        if (berubah) { nilai.DIUBAH_PADA = sekarang; nilai.DIUBAH_OLEH = aktor; v2Ubah_('DETAIL', d, nilai, detT.header); }
      } else if (r.noKendaraan !== '' || SIPANDU_V2.KATEGORI.some(function (k) { return r[k] !== null; })) {
        var tugas = v2PenugasanAktif_(pen, r.idInstansi, iso);
        nilai.ID_DETAIL = 'DTL-' + kodeTgl + '-' + r.idInstansi; nilai.ID_PM_HARIAN = idHeader; nilai.ID_INSTANSI = r.idInstansi;
        nilai.ID_PIC = tugas ? tugas.ID_PIC : ''; nilai.DIBUAT_PADA = sekarang; nilai.DIBUAT_OLEH = aktor;
        v2Tambah_('DETAIL', nilai, detT.header);
      }
    });
    if (header) perubahan.forEach(function (p) {
      v2Tambah_('HISTORY', { ID_HISTORY: 'HIS-' + Utilities.getUuid().slice(0, 8), WAKTU: sekarang, ID_PM_HARIAN: idHeader, ID_DETAIL: 'DTL-' + kodeTgl + '-' + p.idInstansi, TANGGAL: v2Tgl_(iso),
                              ID_INSTANSI: p.idInstansi, KOLOM: p.kolom, NILAI_SEBELUM: p.sebelum, NILAI_BARU: p.sesudah, ALASAN: alasan, DIUBAH_OLEH: aktor }, hisT.header);
    });
    v2Audit_(aktor, header ? 'KOREKSI_PM_HARIAN_V2' : 'SIMPAN_PM_HARIAN_V2', 'PM_HARIAN', idHeader, { tanggal: iso, perubahan: perubahan.length, alasan: alasan });
    return v2PmHarianData_(iso, '', false);
  });
}

function getRiwayatPmV2(body) {
  v2Cek_(body, 'VIEW');
  var iso = v2Str_(body.tanggal);
  if (!v2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  var ins = {}; v2Baca_('INSTANSI').baris.forEach(function (r) { ins[r.ID_INSTANSI] = r.NAMA_INSTANSI; });
  var h = v2Baca_('HISTORY').baris.filter(function (r) { return v2Iso_(r.TANGGAL) === iso; });
  h.sort(function (a, b) { return new Date(b.WAKTU) - new Date(a.WAKTU); });
  return { tanggal: iso, riwayat: h.map(function (r) { return { waktu: Utilities.formatDate(new Date(r.WAKTU), v2Tz_(), 'yyyy-MM-dd HH:mm'), instansi: ins[r.ID_INSTANSI] || r.ID_INSTANSI, kolom: r.KOLOM,
                                                              sebelum: v2Str_(r.NILAI_SEBELUM), sesudah: v2Str_(r.NILAI_BARU), alasan: v2Str_(r.ALASAN), oleh: v2Str_(r.DIUBAH_OLEH) }; }) };
}

/** Arsip: daftar tanggal yang sudah punya data PM (terbaru dulu) + total porsi. */
function getDaftarTanggalPmV2(body) {
  v2Cek_(body, 'VIEW');
  var batas = Math.min(Math.max(Number(body.batas) || 60, 1), 400);
  var hdr = v2Baca_('PM_HARIAN').baris, det = v2Baca_('DETAIL').baris, jumlah = {};
  det.forEach(function (d) { var j = v2Jumlah_({ PK: v2Nilai_(d.PK), PB: v2Nilai_(d.PB), BUMIL: v2Nilai_(d.BUMIL), BUSUI: v2Nilai_(d.BUSUI), BALITA: v2Nilai_(d.BALITA) }); var o = jumlah[d.ID_PM_HARIAN] = jumlah[d.ID_PM_HARIAN] || { porsi: 0, instansi: 0 }; if (j !== null) { o.porsi += j; o.instansi++; } });
  var daftar = hdr.map(function (h) { var o = jumlah[h.ID_PM_HARIAN] || { porsi: 0, instansi: 0 }; return { tanggal: v2Iso_(h.TANGGAL), status: v2Str_(h.STATUS), totalPorsi: o.porsi, jumlahInstansi: o.instansi, dikonfirmasiOleh: v2Str_(h.DIKONFIRMASI_OLEH) }; });
  daftar.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
  return { tanggal: daftar.slice(0, batas) };
}

/** Ringkasan per tanggal utk rentang (dipakai Kalender/Dashboard pada tahap berikutnya). */
function getRingkasanPmV2(body) {
  v2Cek_(body, 'VIEW');
  var awal = v2Str_(body.tanggalAwal), akhir = v2Str_(body.tanggalAkhir);
  if (!v2IsoValid_(awal) || !v2IsoValid_(akhir) || awal > akhir) throw new Error('Rentang tanggal tidak valid.');
  var hdr = v2Baca_('PM_HARIAN').baris.filter(function (h) { var t = v2Iso_(h.TANGGAL); return t >= awal && t <= akhir; }), det = v2Baca_('DETAIL').baris, hasil = [];
  hdr.forEach(function (h) {
    var o = { tanggal: v2Iso_(h.TANGGAL), status: v2Str_(h.STATUS), jumlahInstansi: 0, pk: 0, pb: 0, bumil: 0, busui: 0, balita: 0, total: 0 };
    det.filter(function (d) { return d.ID_PM_HARIAN === h.ID_PM_HARIAN; }).forEach(function (d) {
      var ada = false;
      SIPANDU_V2.KATEGORI.forEach(function (k) { var n = v2Nilai_(d[k]); if (n !== null) { ada = true; o[k.toLowerCase()] += n; o.total += n; } });
      if (ada) o.jumlahInstansi++;
    });
    hasil.push(o);
  });
  hasil.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
  return { ringkasan: hasil };
}


// ======================= STATUS KALENDER (dibaca dari SIKOP, hanya baca) =======================
/**
 * Status tanggal menurut Kalender Operasional (SIKOP, sheet 15_KALENDER_OPERASIONAL), sesuai keputusan Admin 3 Nov 2026:
 * TIDAK ada status otomatis. Tanggal tanpa entri = BELUM_DIATUR (bukan operasional, bukan libur).
 *   STATUS AKTIF + DIVISI_KHUSUS terisi -> OPERASIONAL_KHUSUS | STATUS AKTIF -> OPERASIONAL | LIBUR/DIBATALKAN/TANGGAL_MERAH -> LIBUR
 * Mengembalikan { 'yyyy-MM-dd': { status, keterangan } }. Gagal membaca kalender -> {} (tidak pernah melempar galat).
 */
function v2PetaKalender_() {
  var peta = {};
  try {
    getKalenderRows_().forEach(function (k) {
      var iso = tanggalSheetKeIso_(k.TANGGAL_OPERASIONAL);
      if (!iso) return;
      var st = String(k.STATUS || '').toUpperCase(), status;
      if (st === 'LIBUR' || st === 'DIBATALKAN' || st === 'TANGGAL_MERAH') status = 'LIBUR';
      else status = v2Str_(k.DIVISI_KHUSUS) ? 'OPERASIONAL_KHUSUS' : 'OPERASIONAL';
      peta[iso] = { status: status, keterangan: v2Str_(k.KETERANGAN), divisiKhusus: v2Str_(k.DIVISI_KHUSUS) };
    });
  } catch (e) { /* kalender tidak terbaca: semua BELUM_DIATUR */ }
  return peta;
}
function v2StatusTanggal_(peta, iso) { return peta[iso] || { status: 'BELUM_DIATUR', keterangan: '', divisiKhusus: '' }; }
var V2_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function v2NamaHari_(iso) { return V2_HARI[v2Tgl_(iso).getDay()]; }

// ======================= MANAJEMEN MENU (menu harian per tanggal) =======================
var V2_KOMPONEN_MENU = [['karbohidrat', 'KARBOHIDRAT'], ['laukHewani', 'LAUK_HEWANI'], ['laukNabati', 'LAUK_NABATI'], ['sayur', 'SAYUR'], ['buah', 'BUAH'], ['perlengkapan', 'PERLENGKAPAN']];

function v2MenuObjek_(r) {
  var o = { idMenu: r.ID_MENU, status: v2Str_(r.STATUS) || 'DRAFT', disetujuiOleh: v2Str_(r.DISETUJUI_OLEH), sumber: v2Str_(r.SUMBER) || 'MANUAL', keterangan: v2Str_(r.KETERANGAN),
            disetujuiPada: r.DISETUJUI_PADA ? Utilities.formatDate(new Date(r.DISETUJUI_PADA), v2Tz_(), 'yyyy-MM-dd HH:mm') : '' };
  V2_KOMPONEN_MENU.forEach(function (k) { o[k[0]] = v2Str_(r[k[1]]); });
  return o;
}

function getMenuHarianV2(body) {
  v2Cek_(body, 'VIEW');
  var iso = v2Str_(body.tanggal);
  if (!v2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  var baris = v2Baca_('MENU').baris.filter(function (r) { return v2Iso_(r.TANGGAL) === iso; })[0];
  return { tanggal: iso, hari: v2NamaHari_(iso), kalender: v2StatusTanggal_(v2PetaKalender_(), iso), menu: baris ? v2MenuObjek_(baris) : null };
}

/** Menu 7 hari kalender mulai tanggalMulai. Hari LIBUR ditampilkan sebagai libur, bukan "menu kosong yang harus dibuat". */
function getMenuMingguV2(body) {
  v2Cek_(body, 'VIEW');
  var awal = v2Str_(body.tanggalMulai);
  if (!v2IsoValid_(awal)) throw new Error('Tanggal mulai tidak valid.');
  var peta = v2PetaKalender_(), menu = {};
  v2Baca_('MENU').baris.forEach(function (r) { menu[v2Iso_(r.TANGGAL)] = r; });
  var hari = [];
  for (var i = 0; i < 7; i++) {
    var iso = v2HariKe_(awal, i);
    hari.push({ tanggal: iso, hari: v2NamaHari_(iso), kalender: v2StatusTanggal_(peta, iso), menu: menu[iso] ? v2MenuObjek_(menu[iso]) : null });
  }
  return { tanggalMulai: awal, tanggalAkhir: v2HariKe_(awal, 6), hari: hari };
}

/**
 * Simpan menu satu tanggal. body: { token, tanggal, status:'DRAFT'|'DISETUJUI', keterangan?, karbohidrat, laukHewani, laukNabati, sayur, buah, perlengkapan }
 * DISETUJUI wajib memuat Karbohidrat dan minimal satu Lauk. Hanya menu DISETUJUI yang tampil di dashboard dan website.
 * Tanggal yang bukan hari operasional menurut Kalender TIDAK ditolak, hanya diberi peringatan.
 */
function simpanMenuHarianV2(body) {
  var aktor = requireAuth(body.token);
  var iso = v2Str_(body.tanggal);
  if (!v2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  var status = (v2Str_(body.status) || 'DRAFT').toUpperCase();
  if (['DRAFT', 'DISETUJUI'].indexOf(status) < 0) throw new Error('Status menu harus DRAFT atau DISETUJUI.');
  var isi = {};
  V2_KOMPONEN_MENU.forEach(function (k) {
    var v = v2Str_(body[k[0]]);
    if (v.length > 120) throw new Error('Isian ' + k[0] + ' terlalu panjang (maks 120 karakter).');
    isi[k[1]] = v;
  });
  if (!V2_KOMPONEN_MENU.some(function (k) { return isi[k[1]] !== ''; })) throw new Error('Isi minimal satu komponen menu.');
  if (status === 'DISETUJUI' && !(isi.KARBOHIDRAT && (isi.LAUK_HEWANI || isi.LAUK_NABATI))) throw new Error('Untuk menyetujui menu, isi minimal Karbohidrat dan satu Lauk (hewani atau nabati).');
  var keterangan = v2Str_(body.keterangan);
  return v2Kunci_(function () {
    var t = v2Baca_('MENU');
    var lama = t.baris.filter(function (r) { return v2Iso_(r.TANGGAL) === iso; })[0] || null;
    requireIzinModulBaru_(aktor, 'SIPANDU', lama ? 'EDIT' : 'CREATE');
    var sekarang = new Date();
    var data = { STATUS: status, KETERANGAN: keterangan, DISETUJUI_OLEH: status === 'DISETUJUI' ? aktor : '', DISETUJUI_PADA: status === 'DISETUJUI' ? sekarang : '', DIUBAH_PADA: sekarang, DIUBAH_OLEH: aktor };
    Object.keys(isi).forEach(function (k) { data[k] = isi[k]; });
    var ringkas = { tanggal: iso, status: status };
    if (lama) {
      var berubah = V2_KOMPONEN_MENU.filter(function (k) { return v2Str_(lama[k[1]]) !== isi[k[1]]; }).map(function (k) { return k[0] + ': "' + v2Str_(lama[k[1]]) + '" -> "' + isi[k[1]] + '"'; });
      ringkas.perubahan = berubah; ringkas.statusSebelum = v2Str_(lama.STATUS);
      v2Ubah_('MENU', lama, data, t.header);
    } else {
      data.ID_MENU = 'MNU-' + iso.replace(/-/g, ''); data.TANGGAL = v2Tgl_(iso); data.SUMBER = 'MANUAL'; data.DIBUAT_PADA = sekarang; data.DIBUAT_OLEH = aktor;
      v2Tambah_('MENU', data, t.header);
    }
    v2Audit_(aktor, lama ? 'UBAH_MENU_V2' : 'TAMBAH_MENU_V2', 'MENU_HARIAN', 'MNU-' + iso.replace(/-/g, ''), ringkas);
    var kal = v2StatusTanggal_(v2PetaKalender_(), iso), peringatan = '';
    if (kal.status === 'LIBUR') peringatan = 'Tanggal ini berstatus LIBUR di Kalender Operasional.';
    else if (kal.status === 'BELUM_DIATUR') peringatan = 'Tanggal ini belum diatur di Kalender Operasional (belum ditetapkan sebagai hari operasional).';
    var tersimpan = v2Baca_('MENU').baris.filter(function (r) { return v2Iso_(r.TANGGAL) === iso; })[0];
    return { tanggal: iso, baru: !lama, peringatan: peringatan, menu: v2MenuObjek_(tersimpan), kalender: kal };
  });
}

/** Saran isian (untuk daftar pilihan) dari menu yang pernah disimpan: nilai unik per komponen, paling sering dulu. */
function getSaranMenuV2(body) {
  v2Cek_(body, 'VIEW');
  var hitung = {};
  V2_KOMPONEN_MENU.forEach(function (k) { hitung[k[0]] = {}; });
  v2Baca_('MENU').baris.forEach(function (r) { V2_KOMPONEN_MENU.forEach(function (k) { var v = v2Str_(r[k[1]]); if (v) hitung[k[0]][v] = (hitung[k[0]][v] || 0) + 1; }); });
  var hasil = {};
  Object.keys(hitung).forEach(function (k) { hasil[k] = Object.keys(hitung[k]).sort(function (a, b) { return (hitung[k][b] - hitung[k][a]) || a.localeCompare(b); }).slice(0, 200); });
  return hasil;
}

// ======================= ADAPTOR UNTUK DASHBOARD & WEBSITE (dengan jalur cadangan) =======================
// Aturan emas: adaptor TIDAK PERNAH melempar galat. Bila database SIPANDU baru belum tersambung, belum ada data terverifikasi untuk
// hari ini, atau apa pun gagal -> mengembalikan null, dan pemanggil memakai cara lama (kolom acuan SIPENDOK / Siklus Menu).
function v2HariIniIso_() { return Utilities.formatDate(new Date(), v2Tz_(), 'yyyy-MM-dd'); }

function v2Tersambung_() { try { v2Spreadsheet_(); return true; } catch (e) { return false; } }
/** Struktur sheet yang dibutuhkan konsumen PM (PM_HARIAN, DETAIL_PM_HARIAN, MASTER_INSTANSI) utuh? Bila tidak -> adaptor null -> cara lama. */
function v2StrukturPmOk_() {
  try {
    var ss = v2Spreadsheet_();
    return ['PM_HARIAN', 'DETAIL_PM_HARIAN', 'MASTER_INSTANSI'].every(function (nama) {
      var sh = ss.getSheetByName(nama); if (!sh || !sh.getLastColumn()) return false;
      var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      return SIPANDU_V2.HEADER_WAJIB[nama].every(function (k) { return header.indexOf(k) >= 0; });
    });
  } catch (e) { return false; }
}
/** Tanggal PM_HARIAN TERVERIFIKASI terbaru yang <= iso ('' bila belum ada). */
function v2TanggalPmTerakhir_(iso) {
  var t = v2Baca_('PM_HARIAN').baris.filter(function (h) { return v2Str_(h.STATUS) === 'TERVERIFIKASI'; }).map(function (h) { return v2Iso_(h.TANGGAL); }).filter(function (x) { return x && x <= iso; }).sort();
  return t.length ? t[t.length - 1] : '';
}
/**
 * Bentuk SAMA dengan getRingkasanPmDashboard (PmSipendok.gs). REVISI Admin 4 Nov 2026: bila database PM Harian TERSAMBUNG, tampilan
 * HANYA membaca PM HARIAN -- TIDAK PERNAH kolom acuan. Hari ini bila ada; bila tidak, data terverifikasi TERAKHIR (ditandai
 * bukanHariIni + tanggalData); bila belum ada sama sekali, nol + belumAdaData. null hanya bila database belum tersambung/rusak
 * (pemanggil memakai cara lama sementara waktu).
 */
function v2RingkasanPmDashboard_(iso) {
  if (!v2Tersambung_() || !v2StrukturPmOk_()) return null;
  try {
    var tanggal = v2TanggalPmTerakhir_(iso);
    var tglIndo = function (i) { return (typeof tanggalIndoPm_ === 'function') ? tanggalIndoPm_(v2Tgl_(i)) : i; };
    if (!tanggal) return { tanggalIndo: tglIndo(iso), jumlahPmHariIni: 0, jumlahPmLibur: 0, totalPK: 0, totalPB: 0, total3B: 0, totalBalita: 0, totalBusui: 0, totalBumil: 0, pmHariIni: [], pmLibur: [], sumber: 'SIPANDU_V2', belumAdaData: true, tanggalData: '', bukanHariIni: false };
    var hdr = v2Baca_('PM_HARIAN').baris.filter(function (h) { return v2Iso_(h.TANGGAL) === tanggal && v2Str_(h.STATUS) === 'TERVERIFIKASI'; })[0];
    var ins = v2Baca_('INSTANSI').baris, peta = {};
    v2Baca_('DETAIL').baris.filter(function (d) { return d.ID_PM_HARIAN === hdr.ID_PM_HARIAN; }).forEach(function (d) { peta[d.ID_INSTANSI] = d; });
    ins.sort(function (a, b) { return ((v2Nilai_(a.URUTAN_TAMPIL) === null ? 9999 : v2Nilai_(a.URUTAN_TAMPIL)) - (v2Nilai_(b.URUTAN_TAMPIL) === null ? 9999 : v2Nilai_(b.URUTAN_TAMPIL))) || String(a.NAMA_INSTANSI).localeCompare(String(b.NAMA_INSTANSI)); });
    var n = function (v) { return v2Nilai_(v) === null ? 0 : v2Nilai_(v); };
    var aktif = [], libur = [], tot = { pk: 0, pb: 0, bumil: 0, busui: 0, balita: 0 };
    ins.forEach(function (r) {
      var d = peta[r.ID_INSTANSI];
      var pk = d ? n(d.PK) : 0, pb = d ? n(d.PB) : 0, bumil = d ? n(d.BUMIL) : 0, busui = d ? n(d.BUSUI) : 0, balita = d ? n(d.BALITA) : 0, jumlah = pk + pb + bumil + busui + balita;
      if (jumlah > 0) {
        aktif.push({ NAMA_PM: r.NAMA_INSTANSI, JENIS_PM: r.JENIS_INSTANSI, PK: pk, PB: pb, TIGA_B: bumil + busui + balita, BALITA: balita, BUSUI: busui, BUMIL: bumil, JUMLAH: jumlah });
        tot.pk += pk; tot.pb += pb; tot.bumil += bumil; tot.busui += busui; tot.balita += balita;
      } else if (v2Str_(r.STATUS).toUpperCase() === 'AKTIF') libur.push({ NAMA_PM: r.NAMA_INSTANSI, JENIS_PM: r.JENIS_INSTANSI });
    });
    return { tanggalIndo: tglIndo(tanggal), jumlahPmHariIni: aktif.length, jumlahPmLibur: libur.length,
             totalPK: tot.pk, totalPB: tot.pb, total3B: tot.bumil + tot.busui + tot.balita, totalBalita: tot.balita, totalBusui: tot.busui, totalBumil: tot.bumil,
             pmHariIni: aktif, pmLibur: libur, sumber: 'SIPANDU_V2', belumAdaData: false, tanggalData: tanggal, bukanHariIni: tanggal !== iso };
  } catch (e) { return null; }
}
/** Bentuk SAMA dengan getRingkasanPmPublik (website publik). */
function v2RingkasanPmPublik_(iso) {
  var r = v2RingkasanPmDashboard_(iso);
  return r ? { pesertaDidik: r.totalPK + r.totalPB, ibuHamil: r.totalBumil, ibuMenyusui: r.totalBusui, balita: r.totalBalita, sumber: 'SIPANDU_V2', belumAdaData: r.belumAdaData, tanggalData: r.tanggalData, bukanHariIni: r.bukanHariIni } : null;
}
/** Menu hari ini dari SIPANDU baru (hanya DISETUJUI). Bentuk SAMA dengan getMenuHariIniSiklus_ (SiklusMenu.gs). */
function v2MenuHariIni_(iso) {
  try {
    var r = v2Baca_('MENU').baris.filter(function (x) { return v2Iso_(x.TANGGAL) === iso && v2Str_(x.STATUS) === 'DISETUJUI'; })[0];
    if (!r) return null;
    return { tanggal: iso, hari: v2NamaHari_(iso), karbohidrat: v2Str_(r.KARBOHIDRAT), laukHewani: v2Str_(r.LAUK_HEWANI), laukNabati: v2Str_(r.LAUK_NABATI), sayur: v2Str_(r.SAYUR), buah: v2Str_(r.BUAH), pelengkap: v2Str_(r.PERLENGKAPAN), tema: '' };
  } catch (e) { return null; }
}
/** Satu pintu menu hari ini untuk dashboard & website: SIPANDU baru (disetujui) -> bila tidak ada, Siklus Menu (cara lama). */
function getMenuHariIniTerpadu_() {
  try { var m = v2MenuHariIni_(v2HariIniIso_()); if (m) return m; } catch (e) { /* SipanduV2 belum ada/tersambung */ }
  return getMenuHariIniSiklus_();
}

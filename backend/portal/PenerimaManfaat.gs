/**
 * SPPG JEUNGJING — DATA PENERIMA MANFAAT (detail per instansi)
 *
 * BERBEDA dari sheet 27_DATA_PENERIMAAN (WebsitePublik.gs) yang sudah ada
 * sebelumnya -- itu cuma 4 angka ringkasan (Peserta Didik/Ibu Hamil/Ibu
 * Menyusui/Balita), TIDAK menyimpan rincian per sekolah/posyandu maupun
 * PK/PB. Sheet itu SENGAJA TIDAK disentuh/dihapus di file ini (masih
 * dipakai getDataPenerimaanPublik/Admin di WebsitePublik.gs) -- fitur ini
 * berdiri sendiri, sheet: 30_PENERIMA_MANFAAT.
 *
 * PEROMBAKAN (audit thd sheet live sebelum mengubah kode): struktur SUDAH
 * ADA persis seperti dibuat -- ID_PENERIMAAN, KATEGORI, INSTANSI, PK, PB,
 * BUMIL, BUSUI, BALITA, JUMLAH, STATUS, DIBUAT_PADA, DIUBAH_PADA -- PLUS 2
 * kolom yang SUDAH ditambahkan manual oleh Admin di Sheet: KETERANGAN dan
 * BUDGET (nominal Rupiah per baris, data internal). Kolom "ORIENTASI" dan
 * "NAMA" di prompt permintaan terbaru adalah nama KONSEP yang SAMA dengan
 * KATEGORI dan INSTANSI existing -- dipetakan (mapping) di kode, BUKAN
 * mengganti nama kolom Sheet, supaya data lama tidak perlu disentuh.
 * URUTAN_TAMPIL, DIBUAT_OLEH, DIUBAH_OLEH ditambahkan baru (belum ada
 * sebelumnya) lewat mekanisme tambah-kolom-aman yang sudah dipakai di
 * modul lain -- data existing tidak tersentuh sama sekali.
 *
 * DITEMUKAN saat audit: baris terakhir Sheet live berisi ringkasan TOTAL
 * yang diketik manual Admin ("TOTAL OPERASIONAL (STATUS AKTIF)" di kolom
 * ID_PENERIMAAN, dengan PK/PB/dst berisi HASIL PENJUMLAHAN, bukan data
 * penerima sungguhan). SEMUA fungsi baca di file ini sekarang menyaring
 * baris semacam ini (ID_PENERIMAAN tidak berpola PM###) lewat
 * getBarisPmValid_ -- kalau tidak, baris itu akan ikut terhitung dobel di
 * rekap/total dan tampil sebagai baris aneh di tabel.
 *
 * KATEGORI hanya 2 nilai: PESERTA_DIDIK (pakai PK+PB, BUMIL/BUSUI/BALITA=0)
 * atau 3B (pakai BUMIL+BUSUI+BALITA, PK/PB=0). JUMLAH SELALU dihitung
 * ulang di backend -- frontend tidak pernah dipercaya untuk nilai ini.
 *
 * HAK AKSES data internal (BUDGET, KETERANGAN, DIBUAT_OLEH, DIUBAH_OLEH):
 * HANYA getPenerimaManfaatAdmin yang mengirimkannya. getPenerimaManfaatRelawan
 * dan getPenerimaManfaatPublik TIDAK PERNAH menyertakan field ini sama
 * sekali di objek yang dikembalikan -- bukan disaring di frontend.
 */

const KATEGORI_PM_VALID = ['PESERTA_DIDIK', '3B'];

function getPenerimaManfaatSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('30_PENERIMA_MANFAAT');
  if (!sheet) {
    sheet = ss.insertSheet('30_PENERIMA_MANFAAT');
    sheet.getRange(1, 1, 1, 12).setValues([[
      'ID_PENERIMAAN', 'KATEGORI', 'INSTANSI', 'PK', 'PB', 'BUMIL', 'BUSUI',
      'BALITA', 'JUMLAH', 'STATUS', 'DIBUAT_PADA', 'DIUBAH_PADA'
    ]]);
  }
  return sheet;
}

/** Kolom baru (belum ada di Sheet live saat audit) -- aman dipanggil berkali-kali, cuma menambah kalau memang belum ada. KETERANGAN & BUDGET TIDAK perlu ditambahkan di sini -- sudah ada duluan di Sheet (ditambahkan manual oleh Admin). */
function pastikanKolomPmBaru_() {
  tambahKolomJikaBelumAda_('30_PENERIMA_MANFAAT', ['URUTAN_TAMPIL', 'DIBUAT_OLEH', 'DIUBAH_OLEH']);
}

/**
 * SATU-SATUNYA titik baca baris mentah -- SEMUA fungsi lain di file ini
 * wajib lewat sini, bukan sheetToObjects langsung, supaya baris ringkasan
 * seperti "TOTAL OPERASIONAL (STATUS AKTIF)" (ditemukan di Sheet live
 * saat audit -- lihat catatan berkas di atas) tidak pernah ikut
 * terhitung sebagai data penerima sungguhan. Juga mengurutkan hasil
 * berdasarkan URUTAN_TAMPIL (kalau diisi), fallback ke urutan baris asli.
 */
function getBarisPmValid_() {
  pastikanKolomPmBaru_();
  const semua = sheetToObjects(getPenerimaManfaatSheet_());
  const valid = semua.filter(r => /^PM\d+$/i.test(String(r.ID_PENERIMAAN || '').trim()));
  valid.forEach((r, i) => { r._urutanAsli = i; }); // fallback stabil kalau URUTAN_TAMPIL kosong/sama
  valid.sort((a, b) => {
    const ua = a.URUTAN_TAMPIL !== '' && a.URUTAN_TAMPIL !== undefined && a.URUTAN_TAMPIL !== null ? Number(a.URUTAN_TAMPIL) : null;
    const ub = b.URUTAN_TAMPIL !== '' && b.URUTAN_TAMPIL !== undefined && b.URUTAN_TAMPIL !== null ? Number(b.URUTAN_TAMPIL) : null;
    if (ua !== null && ub !== null && ua !== ub) return ua - ub;
    if (ua !== null && ub === null) return -1;
    if (ua === null && ub !== null) return 1;
    return a._urutanAsli - b._urutanAsli;
  });
  return valid;
}

/** Angka >= 0 yang valid (bukan NaN/negatif/teks bukan angka). Kosong/undefined dianggap 0. */
function angkaPmValid_(nilai, namaField) {
  if (nilai === undefined || nilai === null || nilai === '') return 0;
  const n = Number(nilai);
  if (isNaN(n) || n < 0) throw new Error(namaField + ' harus berupa angka 0 atau lebih besar.');
  return Math.round(n);
}

/** Validasi + normalisasi 1 payload Penerima Manfaat (dipakai add & update). Return objek angka yang sudah bersih + JUMLAH terhitung. */
function validasiPenerimaManfaat_(body, idSaatIniUntukEditDiabaikan) {
  const kategori = sanitize(body.kategori).toUpperCase();
  if (KATEGORI_PM_VALID.indexOf(kategori) === -1) {
    throw new Error('Kategori tidak valid -- harus PESERTA_DIDIK atau 3B.');
  }
  const instansi = sanitize(body.instansi);
  if (!instansi) throw new Error('Nama instansi wajib diisi.');

  // Cegah data ganda tidak sengaja (§7) -- nama sama PERSIS (tanpa besar/
  // kecil huruf) pada kategori yang SAMA. Instansi berbeda kategori boleh
  // sama nama (jarang, tapi tidak dilarang spesifikasi).
  const duplikat = getBarisPmValid_().find(r =>
    String(r.ID_PENERIMAAN) !== String(idSaatIniUntukEditDiabaikan || '') &&
    String(r.KATEGORI).toUpperCase() === kategori &&
    String(r.INSTANSI).trim().toLowerCase() === instansi.toLowerCase()
  );
  if (duplikat) throw new Error('Nama "' + instansi + '" sudah terdaftar pada kategori yang sama (' + duplikat.ID_PENERIMAAN + ').');

  let pk = 0, pb = 0, bumil = 0, busui = 0, balita = 0;
  if (kategori === 'PESERTA_DIDIK') {
    pk = angkaPmValid_(body.pk, 'PK');
    pb = angkaPmValid_(body.pb, 'PB');
    // BUMIL/BUSUI/BALITA dipaksa 0 utk kategori ini -- TIDAK peduli apa
    // pun yang dikirim frontend (sesuai instruksi §8).
  } else {
    bumil = angkaPmValid_(body.bumil, 'BUMIL');
    busui = angkaPmValid_(body.busui, 'BUSUI');
    balita = angkaPmValid_(body.balita, 'BALITA');
    // PK/PB dipaksa 0 utk kategori ini.
  }

  const jumlah = kategori === 'PESERTA_DIDIK' ? (pk + pb) : (bumil + busui + balita);

  // BUDGET -- data internal (nominal Rupiah), opsional, HANYA diproses di
  // sini (dipanggil dari fungsi ADMIN). angkaPmValid_ dipakai lagi supaya
  // aturan yang sama berlaku (>=0, bukan teks/NaN).
  const budget = body.budget !== undefined ? angkaPmValid_(body.budget, 'Budget') : undefined;
  const keterangan = body.keterangan !== undefined ? sanitize(body.keterangan) : undefined;
  const urutanTampil = body.urutanTampil !== undefined && body.urutanTampil !== ''
    ? angkaPmValid_(body.urutanTampil, 'Urutan tampil') : undefined;

  return { kategori: kategori, instansi: instansi, pk: pk, pb: pb, bumil: bumil, busui: busui, balita: balita, jumlah: jumlah, budget: budget, keterangan: keterangan, urutanTampil: urutanTampil };
}

function generateIdPenerimaManfaat_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0] || '').match(/^PM(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return 'PM' + String(max + 1).padStart(3, '0');
}

/** ADMIN -- semua record (AKTIF + NONAKTIF). Field internal (BUDGET, KETERANGAN, audit) HANYA di sini. */
function getPenerimaManfaatAdmin(token) {
  requireAuth(token, true); // true = Staff (monitoring) boleh lihat, sesuai pola akses-baca lain
  return getBarisPmValid_().map(r => ({
    id: r.ID_PENERIMAAN, kategori: r.KATEGORI, instansi: r.INSTANSI,
    pk: Number(r.PK) || 0, pb: Number(r.PB) || 0,
    bumil: Number(r.BUMIL) || 0, busui: Number(r.BUSUI) || 0, balita: Number(r.BALITA) || 0,
    jumlah: Number(r.JUMLAH) || 0, status: r.STATUS,
    urutanTampil: r.URUTAN_TAMPIL !== '' && r.URUTAN_TAMPIL !== undefined ? Number(r.URUTAN_TAMPIL) : null,
    // Data internal -- HANYA muncul di sini (Admin), tidak pernah di
    // getPenerimaManfaatRelawan/Publik sama sekali.
    keterangan: r.KETERANGAN || '',
    budget: r.BUDGET !== '' && r.BUDGET !== undefined ? Number(r.BUDGET) || 0 : 0,
    dibuatPada: r.DIBUAT_PADA, dibuatOleh: r.DIBUAT_OLEH || '',
    diubahPada: r.DIUBAH_PADA, diubahOleh: r.DIUBAH_OLEH || ''
  }));
}

/**
 * ADMIN -- rekap total (termasuk BUDGET, data internal). Dihitung dari
 * getBarisPmValid_ juga (baris TOTAL manual di Sheet TIDAK ikut, supaya
 * tidak dobel-hitung).
 */
function getRekapPenerimaManfaatAdmin(token) {
  requireAuth(token, true);
  const semua = getBarisPmValid_().filter(r => String(r.STATUS).toUpperCase() === 'AKTIF');
  const hasil = { totalPk: 0, totalPb: 0, totalBumil: 0, totalBusui: 0, totalBalita: 0, totalPenerima: 0, totalBudget: 0, jumlahAktif: semua.length };
  semua.forEach(r => {
    hasil.totalPk += Number(r.PK) || 0;
    hasil.totalPb += Number(r.PB) || 0;
    hasil.totalBumil += Number(r.BUMIL) || 0;
    hasil.totalBusui += Number(r.BUSUI) || 0;
    hasil.totalBalita += Number(r.BALITA) || 0;
    hasil.totalPenerima += Number(r.JUMLAH) || 0;
    hasil.totalBudget += (r.BUDGET !== '' && r.BUDGET !== undefined) ? (Number(r.BUDGET) || 0) : 0;
  });
  return hasil;
}

/**
 * RELAWAN -- READ ONLY, hanya STATUS=AKTIF. TIDAK PERNAH menyertakan
 * BUDGET/KETERANGAN/DIBUAT_OLEH/DIUBAH_OLEH/DIBUAT_PADA/DIUBAH_PADA --
 * bukan disaring di frontend, field itu memang tidak pernah dibaca dari
 * Sheet di sini sama sekali.
 */
/**
 * INTEGRASI SIPENDOK (§ baru): SIPENDOK sekarang SUMBER UTAMA data
 * Penerima Manfaat -- sheet 30_PENERIMA_MANFAAT milik Portal sendiri
 * TIDAK lagi dibaca oleh 2 fungsi di bawah (getPenerimaManfaatRelawan/
 * Publik). Sheet & fungsi admin (add/update/setStatus) di file ini
 * SENGAJA TIDAK dihapus/diubah -- itu keputusan terpisah yang belum
 * diminta; mengubahnya sekarang berisiko menghapus jalur kerja yang
 * mungkin masih dipakai tanpa sepengetahuan.
 *
 * Bentuk data yang dikembalikan ke frontend DIPERTAHANKAN PERSIS sama
 * seperti sebelumnya (field: id/kategori/instansi/pk/pb/bumil/busui/
 * balita/jumlah, + ringkasan utk versi publik) -- supaya halaman HTML
 * yang sudah ada TIDAK PERLU diubah sama sekali, hanya sumber datanya
 * yang berubah.
 *
 * Pemetaan konsep: JENIS_PM SIPENDOK ('SEKOLAH'/'POSYANDU') <-> KATEGORI
 * Portal ('PESERTA_DIDIK'/'3B') -- sesuai profil datanya (SEKOLAH pakai
 * PK/PB, POSYANDU pakai Bumil/Busui/Balita, persis makna KATEGORI lama).
 */
const SIPENDOK_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyAbHHQql3WL6HBZ2eIT-72zheK5VRgRFuRol39po2n8lR22V8Iqjj_1ofpeXY2pb8i/exec';

function panggilSipendok_(action) {
  const resp = UrlFetchApp.fetch(SIPENDOK_WEB_APP_URL, {
    method: 'post',
    contentType: 'text/plain', // SENGAJA text/plain -- SIPENDOK (Api.gs) baca begini utk hindari preflight CORS, bukan application/json
    payload: JSON.stringify({ action: action, data: {}, token: buatTokenAplikasi_('PORTAL', 'Portal', 'SISTEM', 'SISTEM', 'SIPENDOK', 5) }),   // 4 Nov 2026: SIPENDOK kini mewajibkan token
    muteHttpExceptions: true
  });
  let json;
  try { json = JSON.parse(resp.getContentText()); }
  catch (e) { throw new Error('SIPENDOK mengembalikan respons tidak terbaca.'); }
  if (!json.ok) throw new Error('SIPENDOK: ' + (json.error || 'gagal mengambil data.'));
  return json.data;
}

function pmSipendokKeBentukLama_(item) {
  const kategori = item.JENIS_PM === 'POSYANDU' ? '3B' : 'PESERTA_DIDIK';
  return {
    id: item.ID_PM, kategori: kategori, instansi: item.NAMA_PM,
    pk: Number(item.PK) || 0, pb: Number(item.PB) || 0,
    bumil: Number(item.BUMIL) || 0, busui: Number(item.BUSUI) || 0, balita: Number(item.BALITA) || 0,
    jumlah: Number(item.JUMLAH) || 0,
    tanggalData: item.tanggalDataIndo || null // BARU -- supaya UI bisa tampilkan "data per tanggal X" kalau mau, tidak wajib dipakai frontend
  };
}

/**
 * Ringkasan Penerima Manfaat HARI INI utk Monitoring ASN/Kepala SPPG --
 * dipanggil dari getRingkasanMonitoring (Role.gs), BUKAN endpoint
 * publik/dispatch sendiri (makanya trailing underscore, pola private
 * helper yg sama dgn fungsi lain di proyek ini). Bentuk hasil DIBIARKAN
 * APA ADANYA dari SIPENDOK (pm.ringkasHariIniAsn) -- tidak perlu
 * transformasi spt pmSipendokKeBentukLama_ krn ini dasbor BARU, bukan
 * menyambung ke tampilan lama yg sudah ada bentuknya.
 */
function ringkasPenerimaManfaatHariIni_() {
  return panggilSipendok_('pm.ringkasHariIniAsn');
}

function getPenerimaManfaatRelawan(token) {
  requireAuthRelawan(token);
  const daftar = panggilSipendok_('pm.ringkasRelawan');
  return daftar.map(item => {
    const o = pmSipendokKeBentukLama_(item);
    o.namaPic = item.namaPic || ''; // HANYA di jalur Relawan (sudah login Portal) -- TIDAK pernah di jalur Publik
    return o;
  });
}

/**
 * PUBLIK -- TANPA requireAuth (halaman publik tidak ada login). TIDAK
 * PERNAH menyertakan namaPic/BUDGET/KETERANGAN/field internal lain --
 * route SIPENDOK yang dipanggil (pm.ringkasPublik) sendiri sudah
 * membuang namaPic sebelum dikirim (lihat Penerimaan.gs di SIPENDOK),
 * jadi ini pertahanan berlapis, bukan satu-satunya penyaring.
 */
function getPenerimaManfaatPublik() {
  const daftar = panggilSipendok_('pm.ringkasPublik').map(pmSipendokKeBentukLama_);

  let totalPesertaDidik = 0, totalB3 = 0, totalPk = 0, totalPb = 0, totalBumil = 0, totalBusui = 0, totalBalita = 0;
  daftar.forEach(d => {
    if (d.kategori === 'PESERTA_DIDIK') { totalPesertaDidik += d.jumlah; totalPk += d.pk; totalPb += d.pb; }
    else { totalB3 += d.jumlah; totalBumil += d.bumil; totalBusui += d.busui; totalBalita += d.balita; }
  });

  return {
    data: daftar,
    ringkasan: {
      total: totalPesertaDidik + totalB3,
      totalPesertaDidik: totalPesertaDidik,
      totalB3: totalB3,
      totalPk: totalPk, totalPb: totalPb,
      totalBumil: totalBumil, totalBusui: totalBusui, totalBalita: totalBalita
    }
  };
}

/**
 * TAMBAH -- header-map (BUKAN array posisi tetap), sesuai instruksi.
 * Alur: requireAuth -> validasi -> hitung JUMLAH -> buat ID -> tulis.
 */
function addPenerimaManfaat(body) {
  const akses = requireAuth(body.token); // Admin PENUH -- ini aksi tulis/kelola data, bukan sekadar monitoring
  const bersih = validasiPenerimaManfaat_(body);

  const lock = LockService.getScriptLock(); // P2 -- generateIdPenerimaManfaat_ baca ID tertinggi lalu +1; tanpa kunci 2 admin bisa dapat ID sama
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getPenerimaManfaatSheet_();
    const idx = akunHeaderIndex_(sheet); // helper generik baca header, sudah dipakai aman di modul lain
    const idBaru = generateIdPenerimaManfaat_(sheet);
    const sekarang = new Date();

    const baris = new Array(sheet.getLastColumn()).fill('');
    baris[idx.ID_PENERIMAAN] = idBaru;
    baris[idx.KATEGORI] = bersih.kategori;
    baris[idx.INSTANSI] = bersih.instansi;
    baris[idx.PK] = bersih.pk;
    baris[idx.PB] = bersih.pb;
    baris[idx.BUMIL] = bersih.bumil;
    baris[idx.BUSUI] = bersih.busui;
    baris[idx.BALITA] = bersih.balita;
    baris[idx.JUMLAH] = bersih.jumlah;
    baris[idx.STATUS] = 'AKTIF';
    if (idx.KETERANGAN !== undefined) baris[idx.KETERANGAN] = bersih.keterangan || '';
    if (idx.BUDGET !== undefined) baris[idx.BUDGET] = bersih.budget || 0;
    if (idx.URUTAN_TAMPIL !== undefined && bersih.urutanTampil !== undefined) baris[idx.URUTAN_TAMPIL] = bersih.urutanTampil;
    baris[idx.DIBUAT_PADA] = sekarang;
    if (idx.DIBUAT_OLEH !== undefined) baris[idx.DIBUAT_OLEH] = akses;
    baris[idx.DIUBAH_PADA] = sekarang;
    if (idx.DIUBAH_OLEH !== undefined) baris[idx.DIUBAH_OLEH] = akses;

    sheet.appendRow(baris);
    logAudit_('TAMBAH_PENERIMA_MANFAAT', 'PENERIMA_MANFAAT', idBaru, akses, { kategori: bersih.kategori, instansi: bersih.instansi, jumlah: bersih.jumlah });
    return { success: true, id: idBaru, jumlah: bersih.jumlah };
  } finally {
    lock.releaseLock();
  }
}

/** UBAH -- JUMLAH TIDAK BISA diedit langsung, selalu dihitung ulang dari PK/PB atau BUMIL/BUSUI/BALITA yang baru. */
function updatePenerimaManfaat(body) {
  const akses = requireAuth(body.token);
  const id = sanitize(body.id);
  if (!id) throw new Error('ID Penerima Manfaat wajib diisi.');
  const bersih = validasiPenerimaManfaat_(body, id);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getPenerimaManfaatSheet_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_PENERIMAAN]) === id) {
        const baris = i + 1;
        sheet.getRange(baris, idx.KATEGORI + 1).setValue(bersih.kategori);
        sheet.getRange(baris, idx.INSTANSI + 1).setValue(bersih.instansi);
        sheet.getRange(baris, idx.PK + 1).setValue(bersih.pk);
        sheet.getRange(baris, idx.PB + 1).setValue(bersih.pb);
        sheet.getRange(baris, idx.BUMIL + 1).setValue(bersih.bumil);
        sheet.getRange(baris, idx.BUSUI + 1).setValue(bersih.busui);
        sheet.getRange(baris, idx.BALITA + 1).setValue(bersih.balita);
        sheet.getRange(baris, idx.JUMLAH + 1).setValue(bersih.jumlah);
        if (idx.KETERANGAN !== undefined && bersih.keterangan !== undefined) sheet.getRange(baris, idx.KETERANGAN + 1).setValue(bersih.keterangan);
        if (idx.BUDGET !== undefined && bersih.budget !== undefined) sheet.getRange(baris, idx.BUDGET + 1).setValue(bersih.budget);
        if (idx.URUTAN_TAMPIL !== undefined && bersih.urutanTampil !== undefined) sheet.getRange(baris, idx.URUTAN_TAMPIL + 1).setValue(bersih.urutanTampil);
        sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(new Date());
        if (idx.DIUBAH_OLEH !== undefined) sheet.getRange(baris, idx.DIUBAH_OLEH + 1).setValue(akses);
        logAudit_('UBAH_PENERIMA_MANFAAT', 'PENERIMA_MANFAAT', id, akses, { kategori: bersih.kategori, instansi: bersih.instansi, jumlah: bersih.jumlah });
        return { success: true, jumlah: bersih.jumlah };
      }
    }
    throw new Error('Data Penerima Manfaat tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/** Soft delete -- toggle AKTIF/NONAKTIF, TIDAK PERNAH menghapus baris (histori tetap tersimpan). */
function setStatusPenerimaManfaat(body) {
  const akses = requireAuth(body.token);
  const id = sanitize(body.id);
  const statusBaru = body.aktif ? 'AKTIF' : 'NONAKTIF';

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
  const sheet = getPenerimaManfaatSheet_();
  const idx = akunHeaderIndex_(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_PENERIMAAN]) === id) {
      sheet.getRange(i + 1, idx.STATUS + 1).setValue(statusBaru);
      sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(new Date());
      if (idx.DIUBAH_OLEH !== undefined) sheet.getRange(i + 1, idx.DIUBAH_OLEH + 1).setValue(akses);
      logAudit_('SET_STATUS_PENERIMA_MANFAAT', 'PENERIMA_MANFAAT', id, akses, { status: statusBaru });
      return { success: true };
    }
  }
  throw new Error('Data Penerima Manfaat tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * ISI DATA AWAL (SEKALI JALAN) -- data nyata dari rekap Excel/foto yang
 * diberikan Admin (17 baris: 11 Peserta Didik, 6 Posyandu/3B). Dijalankan
 * MANUAL lewat editor Apps Script (pilih fungsi ini -> Run) -- SENGAJA
 * TIDAK didaftarkan di Code.gs/dispatch web, supaya tidak bisa terpanggil
 * tidak sengaja lewat HTTP/frontend.
 *
 * PENGAMAN: kalau sheet 30_PENERIMA_MANFAAT SUDAH punya data (baris > 1),
 * fungsi ini BERHENTI dan tidak menambah apa pun -- mencegah data dobel
 * kalau tombol Run tidak sengaja ditekan lagi.
 */
function seedPenerimaManfaatAwal_() {
  const sheet = getPenerimaManfaatSheet_();
  if (sheet.getLastRow() > 1) {
    Logger.log('Sheet 30_PENERIMA_MANFAAT sudah berisi data (' + (sheet.getLastRow() - 1) + ' baris) -- seed dibatalkan supaya tidak dobel. Kosongkan dulu manual kalau memang mau isi ulang dari awal.');
    return;
  }

  const dataAwal = [
    // [KATEGORI, INSTANSI, PK, PB, BUMIL, BUSUI, BALITA]
    ['PESERTA_DIDIK', 'PAUD Sahara', 35, 4, 0, 0, 0],
    ['PESERTA_DIDIK', 'PAUD Almayanti', 16, 3, 0, 0, 0],
    ['PESERTA_DIDIK', 'PAUD Puspa Pelita Bangsa', 43, 4, 0, 0, 0],
    ['PESERTA_DIDIK', 'PAUD SPS Berlian', 37, 4, 0, 0, 0],
    ['PESERTA_DIDIK', 'SDIT & PAUD Madinatul Ilmi', 75, 63, 0, 0, 0],
    ['PESERTA_DIDIK', 'SDN Jeungjing 3', 160, 179, 0, 0, 0],
    ['PESERTA_DIDIK', 'SDN Jeungjing 2', 191, 240, 0, 0, 0],
    ['PESERTA_DIDIK', 'SDN Jeungjing 1', 329, 376, 0, 0, 0],
    ['PESERTA_DIDIK', 'MI Al-Habibah', 77, 87, 0, 0, 0],
    ['PESERTA_DIDIK', 'MTS Asmaul Husna', 0, 119, 0, 0, 0],
    ['PESERTA_DIDIK', 'SMKS Gyokai Indonesia Kompeten', 0, 705, 0, 0, 0],
    ['3B', 'Posyandu Kenanga', 0, 0, 16, 7, 27],
    ['3B', 'Posyandu Melati', 0, 0, 7, 3, 40],
    ['3B', 'Posyandu Budi Asih', 0, 0, 4, 12, 34],
    ['3B', 'Posyandu Flamboyan 2', 0, 0, 10, 5, 35],
    ['3B', 'Posyandu Kemuning 2', 0, 0, 5, 7, 38],
    ['3B', 'Posyandu Pesona', 0, 0, 4, 3, 43]
  ];

  const idx = akunHeaderIndex_(sheet);
  const sekarang = new Date();
  let nomor = 1;
  const semuaBaris = dataAwal.map(d => {
    const [kategori, instansi, pk, pb, bumil, busui, balita] = d;
    const jumlah = kategori === 'PESERTA_DIDIK' ? (pk + pb) : (bumil + busui + balita);
    const baris = new Array(sheet.getLastColumn()).fill('');
    baris[idx.ID_PENERIMAAN] = 'PM' + String(nomor++).padStart(3, '0');
    baris[idx.KATEGORI] = kategori;
    baris[idx.INSTANSI] = instansi;
    baris[idx.PK] = pk;
    baris[idx.PB] = pb;
    baris[idx.BUMIL] = bumil;
    baris[idx.BUSUI] = busui;
    baris[idx.BALITA] = balita;
    baris[idx.JUMLAH] = jumlah;
    baris[idx.STATUS] = 'AKTIF';
    baris[idx.DIBUAT_PADA] = sekarang;
    baris[idx.DIUBAH_PADA] = sekarang;
    return baris;
  });

  sheet.getRange(2, 1, semuaBaris.length, sheet.getLastColumn()).setValues(semuaBaris);

  const totalPk = dataAwal.reduce((s, d) => s + d[2], 0);
  const totalPb = dataAwal.reduce((s, d) => s + d[3], 0);
  const totalBumil = dataAwal.reduce((s, d) => s + d[4], 0);
  const totalBusui = dataAwal.reduce((s, d) => s + d[5], 0);
  const totalBalita = dataAwal.reduce((s, d) => s + d[6], 0);
  const totalSeluruh = totalPk + totalPb + totalBumil + totalBusui + totalBalita;
  Logger.log('Selesai: ' + semuaBaris.length + ' baris ditambahkan. TOTAL PK=' + totalPk + ' PB=' + totalPb + ' BUMIL=' + totalBumil + ' BUSUI=' + totalBusui + ' BALITA=' + totalBalita + ' -- TOTAL SELURUH=' + totalSeluruh + ' (cocokkan dengan rekap Anda: 3.047)');
}


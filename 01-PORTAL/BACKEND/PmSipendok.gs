/**
 * PmSipendok.gs — BARU 28 Okt 2026.
 *
 * Latar belakang: halaman "Penerima Manfaat" di Portal
 * (admin-penerima-manfaat-ops.js) memanggil aksi getRingkasanPmDashboard.
 * Komentar di file itu sendiri bilang "pakai ulang aksi yg sudah ada" --
 * tapi diaudit, fungsi ini TIDAK PERNAH DIBUAT sama sekali: tidak ada
 * definisinya di .gs manapun, dan tidak ada case-nya di Code.gs doGet.
 * Itu sebab halaman selalu kosong/"PM ga muncul" (dilaporkan Admin).
 *
 * Fungsi di sini membaca LANGSUNG dari spreadsheet SIPENDOK, sheet
 * 01_PM SAJA (bukan transaksi harian 03_PENERIMAAN -- DIMINTA Admin,
 * lihat catatan di getRingkasanPmDashboard di bawah) -- integrasi
 * lintas-spreadsheet, kebalikan dari pola SIPENDOK baca Portal lewat
 * PORTAL_SPREADSHEET_ID.
 *
 * CATATAN PENTING: SIPENDOK_SPREADSHEET_ID di bawah diambil dari URL
 * spreadsheet SIPENDOK yg terlihat di screenshot Admin sepanjang sesi
 * ini. Kalau keliru atau spreadsheet SIPENDOK pernah dipindah/diganti,
 * PERBARUI nilai ini.
 */

var SIPENDOK_SPREADSHEET_ID = '1OZGFUPoCaSwbnbPNWQ0L7VQ0ek8f9kP3y9B7jf0_-Rw';

var NAMA_HARI_ID_ = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
var NAMA_BULAN_ID_ = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function tanggalIndoPm_(d) {
  return NAMA_HARI_ID_[d.getDay()] + ', ' + d.getDate() + ' ' + NAMA_BULAN_ID_[d.getMonth()] + ' ' + d.getFullYear();
}

/**
 * DIROMBAK 28 Okt 2026 (DIMINTA Admin): "portal cukup ngambil dari PM
 * aja, nggak usah dari penerimaan, soalnya nanti takut kosong kalau
 * ngambil dari penerimaan... kalau emang ada pembaruan data pasti
 * diubah dari PM-nya." SEBELUMNYA baca 03_PENERIMAAN (transaksi harian,
 * bisa saja belum sempat diisi Admin -> dashboard keliatan kosong
 * padahal PM-nya aktif). SEKARANG: HANYA baca 01_PM -- jumlah porsi
 * dari ACUAN_PORSI_KECIL/ACUAN_PORSI_BESAR/ACUAN_BALITA/ACUAN_BUMIL/
 * ACUAN_BUSUI (data acuan/rujukan PM, bukan transaksi harian), dan
 * status "libur" ditentukan dari STATUS PM itu sendiri (Aktif/Tidak
 * Aktif), bukan dari ada-tidaknya transaksi hari ini.
 */
function getRingkasanPmDashboard() {
  var ss;
  try {
    ss = SpreadsheetApp.openById(SIPENDOK_SPREADSHEET_ID);
  } catch (e) {
    // Spreadsheet tidak bisa dibuka (ID salah, atau belum dibagikan ke
    // akun yg menjalankan script Portal ini) -- kembalikan null spy
    // frontend tampilkan pesan "periksa koneksi ke SIPENDOK" yg SUDAH
    // disiapkan di admin-penerima-manfaat-ops.js, bukan error mentah.
    return null;
  }
  var shPm = ss.getSheetByName('01_PM');
  if (!shPm) return null;

  var now = new Date();

  // ---- 01_PM: SATU-SATUNYA sumber data (nama, jenis, status, acuan porsi)
  var dataPm = shPm.getDataRange().getValues();
  var headPm = dataPm[0], idxPm = {};
  headPm.forEach(function (h, i) { idxPm[String(h).trim()] = i; });
  var num_ = function (v) { return (v === '' || v === undefined || v === null || isNaN(v)) ? 0 : Number(v); };

  var pmHariIni = [], pmLibur = [];
  var totalPK = 0, totalPB = 0, total3B = 0;
  for (var i = 1; i < dataPm.length; i++) {
    var r = dataPm[i];
    var idPm = String(r[idxPm.ID_PM] || '');
    if (!idPm) continue;
    var namaPm = String(r[idxPm.NAMA_PM] || '');
    var jenisPm = String(r[idxPm.JENIS_PM] || '');
    var status = String(r[idxPm.STATUS] || '');

    if (status !== 'Aktif') { pmLibur.push({ NAMA_PM: namaPm, JENIS_PM: jenisPm }); continue; }

    var pk = num_(r[idxPm.ACUAN_PORSI_KECIL]);
    var pb = num_(r[idxPm.ACUAN_PORSI_BESAR]);
    var tb = num_(r[idxPm.ACUAN_BALITA]) + num_(r[idxPm.ACUAN_BUMIL]) + num_(r[idxPm.ACUAN_BUSUI]);
    var jumlah = pk + pb + tb;
    totalPK += pk; totalPB += pb; total3B += tb;
    pmHariIni.push({ NAMA_PM: namaPm, JENIS_PM: jenisPm, PK: pk, PB: pb, TIGA_B: tb, JUMLAH: jumlah });
  }

  return {
    tanggalIndo: tanggalIndoPm_(now),
    jumlahPmHariIni: pmHariIni.length,
    jumlahPmLibur: pmLibur.length,
    totalPK: totalPK, totalPB: totalPB, total3B: total3B,
    pmHariIni: pmHariIni, pmLibur: pmLibur
  };
}

/**
 * BARU 29 Okt 2026 (DIMINTA Admin -- halaman Profil SPPG/daftar tim
 * diganti dari CMS manual ke auto-sync dari 01_DATA_RELAWAN).
 * Mengelompokkan relawan AKTIF per divisi, sesuai struktur HTML
 * profil-sppg.html. Nama divisi di sini DICOCOKKAN ke nama DIVISI
 * SEBENARNYA di 01_DATA_RELAWAN (case-insensitive) -- kalau nama
 * persisnya beda dari dugaan di sini, grup itu akan kosong (TIDAK
 * error, cuma kosong -- frontend menampilkan "—" dgn aman).
 * "Mitra" & "KA SPPG" SENGAJA TIDAK disertakan -- posisi
 * kepemimpinan unik, bukan "relawan" biasa, tetap via CMS manual
 * (public-konten.js, TIDAK diubah).
 */
function getProfilTimPublik() {
  var ss;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { return null; }
  var sheet = ss.getSheetByName('01_DATA_RELAWAN');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim().toUpperCase(); });
  var idxNama = headers.indexOf('NAMA'), idxDivisi = headers.indexOf('DIVISI'), idxStatus = headers.indexOf('STATUS');
  if (idxNama === -1 || idxDivisi === -1) return null;

  var perDivisi = {}; // { 'NAMA DIVISI UPPERCASE': ['Nama 1', 'Nama 2', ...] }
  for (var i = 1; i < data.length; i++) {
    if (idxStatus !== -1 && String(data[i][idxStatus] || '').toUpperCase() !== 'AKTIF') continue;
    var divisi = String(data[i][idxDivisi] || '').trim().toUpperCase();
    var nama = String(data[i][idxNama] || '').trim();
    if (!divisi || !nama) continue;
    if (!perDivisi[divisi]) perDivisi[divisi] = [];
    perDivisi[divisi].push(nama);
  }

  // Ambil nama pertama dari divisi (cocokkan beberapa kemungkinan nama,
  // krn blm 100% pasti nama persisnya) -- utk kartu 1-orang.
  function satu(daftarKemungkinanNama) {
    for (var i = 0; i < daftarKemungkinanNama.length; i++) {
      var arr = perDivisi[daftarKemungkinanNama[i].toUpperCase()];
      if (arr && arr.length) return arr[0];
    }
    return null;
  }
  // Ambil SEMUA nama dari divisi (cocokkan beberapa kemungkinan nama) -- utk kartu daftar/ol.
  function banyak(daftarKemungkinanNama) {
    for (var i = 0; i < daftarKemungkinanNama.length; i++) {
      var arr = perDivisi[daftarKemungkinanNama[i].toUpperCase()];
      if (arr && arr.length) return arr;
    }
    return [];
  }

  return {
    pengawasGizi: satu(['PENGAWAS GIZI']),
    pengawasKeuangan: satu(['PENGAWASAN KEUANGAN', 'PENGAWAS KEUANGAN']),
    asistenLapangan: satu(['ASISTEN LAPANGAN']),
    koordinatorJuruMasak: satu(['KOORDINATOR JURU MASAK', 'HEAD CHEF']),
    petugasGudang: satu(['PETUGAS GUDANG', 'PETUGAS LOGISTIK']),
    admin: satu(['ADMIN']),
    cleaningService: satu(['CLEANING SERVICE']),
    security: banyak(['SECURITY']),
    divisiPersiapan: banyak(['PERSIAPAN']),
    divisiPengolahan: banyak(['PENGOLAHAN']),
    divisiPemorsian: banyak(['PEMORSIAN']),
    divisiDistribusi: banyak(['DISTRIBUSI', 'DRIVER/DISTRIBUSI']),
    divisiCuciOmpreng: banyak(['CUCI OMPRENG'])
  };
}

/**
 * BARU 29 Okt 2026 (website publik -- index.html, kartu "Penerima
 * Manfaat" sebelumnya HARDCODED "—" di HTML, tidak pernah memanggil
 * API sama sekali). Beda dari getRingkasanPmDashboard (totalPK/PB/3B
 * digabung) -- di sini 3B DIPISAH jadi 3 kategori krn tampilan publik
 * minta Peserta Didik/Ibu Hamil/Ibu Menyusui/Balita terpisah. PUBLIK
 * (tanpa token) -- SENGAJA, sama spt getRingkasanPmDashboard &
 * getMenuHariIniDashboard, halaman ini memang utk pengunjung umum.
 */
function getRingkasanPmPublik() {
  var ss;
  try { ss = SpreadsheetApp.openById(SIPENDOK_SPREADSHEET_ID); } catch (e) { return null; }
  var shPm = ss.getSheetByName('01_PM');
  if (!shPm) return null;
  var dataPm = shPm.getDataRange().getValues();
  var headPm = dataPm[0], idxPm = {};
  headPm.forEach(function (h, i) { idxPm[String(h).trim()] = i; });
  var num_ = function (v) { return (v === '' || v === undefined || v === null || isNaN(v)) ? 0 : Number(v); };

  var pesertaDidik = 0, ibuHamil = 0, ibuMenyusui = 0, balita = 0;
  for (var i = 1; i < dataPm.length; i++) {
    var r = dataPm[i];
    if (!r[idxPm.ID_PM]) continue;
    if (String(r[idxPm.STATUS] || '') !== 'Aktif') continue;
    pesertaDidik += num_(r[idxPm.ACUAN_PORSI_KECIL]) + num_(r[idxPm.ACUAN_PORSI_BESAR]);
    ibuHamil += num_(r[idxPm.ACUAN_BUMIL]);
    ibuMenyusui += num_(r[idxPm.ACUAN_BUSUI]);
    balita += num_(r[idxPm.ACUAN_BALITA]);
  }
  return { pesertaDidik: pesertaDidik, ibuHamil: ibuHamil, ibuMenyusui: ibuMenyusui, balita: balita };
}

// getPenerimaManfaatRelawan DIHAPUS dari sini 30 Okt 2026 (INSIDEN
// KRITIS -- lihat catatan di atas file). Nama fungsi ini SAMA PERSIS
// dgn yg SUDAH ADA & lebih proper di PenerimaManfaat.gs (pakai pola
// panggilSipendok_, memanggil Web App SIPENDOK sendiri via HTTP --
// BUKAN baca langsung spreadsheet spt versi saya di sini). Versi di
// sini diam-diam MENIMPA versi asli (dimuat belakangan scr alfabet).
// TIDAK PERLU diganti/dipanggil ulang di sini -- versi PenerimaManfaat.gs
// otomatis jadi satu-satunya definisi lagi setelah baris ini dihapus.


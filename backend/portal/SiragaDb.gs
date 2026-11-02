/**
 * SPPG JEUNGJING — SIRAGA (Sistem Informasi Persediaan dan Gudang) v2
 * SiragaDb.gs — koneksi ke SPREADSHEET TERPISAH + definisi skema 9 tabel.
 *
 * ==================================================================
 * DATABASE TERPISAH DARI PORTAL
 * ==================================================================
 *
 * ID Spreadsheet SIRAGA disimpan di Script Properties.
 *
 * Karena project Apps Script dapat memiliki lebih dari 50 Script Properties,
 * ID SIRAGA diinisialisasi secara PROGRAMATIS melalui fungsi:
 *
 *     setSiragaSpreadsheetId()
 *
 * Jalankan fungsi tersebut SATU KALI.
 *
 * Setelah ID tersimpan, jalankan:
 *
 *     setupSiragaSpreadsheet()
 *
 * Fungsi tersebut akan membuat 9 sheet SIRAGA jika belum tersedia.
 *
 * ==================================================================
 * SPREADSHEET SIRAGA
 * ==================================================================
 *
 * ID Spreadsheet:
 * 1Zoh_KmOKX6FxXQ5XNbTtv2QaqWWYzWPMD1N_9uB0LEQ
 *
 * ID disimpan otomatis ke Script Properties oleh:
 * setSiragaSpreadsheetId()
 *
 * USER/ROLE tetap 100% berasal dari Portal.
 *
 * ==================================================================
 * KENAPA FILE BARU, BUKAN MENIMPA Stok.gs
 * ==================================================================
 *
 * Stok.gs v1 tetap dipertahankan.
 * SIRAGA v2 berjalan sebagai lapisan baru dengan spreadsheet terpisah.
 */


/**
 * ================================================================
 * KONFIGURASI SIRAGA
 * ================================================================
 */

const SIRAGA_SPREADSHEET_ID_DEFAULT =
  '1Zoh_KmOKX6FxXQ5XNbTtv2QaqWWYzWPMD1N_9uB0LEQ';


/**
 * Mendapatkan Spreadsheet SIRAGA.
 *
 * ID dibaca dari Script Properties.
 *
 * Jika property belum tersedia, fungsi memberikan pesan yang jelas
 * mengenai fungsi yang harus dijalankan.
 */
function getSiragaSpreadsheet_() {

  const id = PropertiesService
    .getScriptProperties()
    .getProperty('SIRAGA_SPREADSHEET_ID');

  if (!id) {
    throw new Error(
      'SIRAGA_SPREADSHEET_ID belum tersedia. ' +
      'Jalankan fungsi setSiragaSpreadsheetId() satu kali dari Apps Script.'
    );
  }

  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error(
      'Gagal membuka spreadsheet SIRAGA. ' +
      'Kemungkinan: (1) ID spreadsheet salah; ' +
      '(2) file bukan Google Sheets; ' +
      '(3) akun yang menjalankan script tidak memiliki akses ke spreadsheet. ' +
      'ID yang digunakan: ' + id
    );
  }
}


/**
 * ================================================================
 * INISIALISASI ID SPREADSHEET SIRAGA
 * ================================================================
 *
 * Jalankan SATU KALI:
 *
 *     setSiragaSpreadsheetId()
 *
 * Fungsi ini tidak menghapus atau mengubah Script Property lainnya.
 */
function setSiragaSpreadsheetId() {

  const id = SIRAGA_SPREADSHEET_ID_DEFAULT;

  PropertiesService
    .getScriptProperties()
    .setProperty('SIRAGA_SPREADSHEET_ID', id);

  Logger.log(
    'SIRAGA_SPREADSHEET_ID berhasil disimpan: ' + id
  );

  return {
    berhasil: true,
    property: 'SIRAGA_SPREADSHEET_ID',
    id: id
  };
}


/**
 * ================================================================
 * CEK KONEKSI SPREADSHEET SIRAGA
 * ================================================================
 *
 * Hanya membaca property dan membuka spreadsheet.
 * Tidak mengubah data.
 */
function cekSiragaSpreadsheet() {

  const id = PropertiesService
    .getScriptProperties()
    .getProperty('SIRAGA_SPREADSHEET_ID');

  if (!id) {
    throw new Error(
      'SIRAGA_SPREADSHEET_ID belum tersimpan. ' +
      'Jalankan setSiragaSpreadsheetId() terlebih dahulu.'
    );
  }

  let ss;

  try {
    ss = SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error(
      'Property SIRAGA_SPREADSHEET_ID sudah ada, tetapi spreadsheet tidak dapat dibuka. ' +
      'ID: ' + id
    );
  }

  const hasil = {
    berhasil: true,
    id: id,
    nama: ss.getName(),
    url: ss.getUrl(),
    jumlahSheet: ss.getSheets().length,
    daftarSheet: ss.getSheets().map(function(sheet) {
      return sheet.getName();
    })
  };

  Logger.log(JSON.stringify(hasil, null, 2));

  return hasil;
}


/**
 * ================================================================
 * STATUS AKTIF SIRAGA
 * ================================================================
 */

function statusAktifSiraga_(status) {

  const s = String(
    status === undefined || status === null ? '' : status
  )
    .trim()
    .toUpperCase();

  return s === 'AKTIF' || s === 'PERTAHANKAN';
}


function statusNormalSiraga_(status) {

  return statusAktifSiraga_(status)
    ? 'AKTIF'
    : 'NONAKTIF';
}


/**
 * ================================================================
 * NAMA SHEET SIRAGA
 * ================================================================
 */

const SIRAGA_SHEET = {

  CONFIG: '01_CONFIG',

  KATEGORI: '02_KATEGORI',

  BARANG: '03_BARANG',

  SUPPLIER: '04_SUPPLIER',

  TRANSAKSI: '05_TRANSAKSI',

  TRANSAKSI_DETAIL: '06_TRANSAKSI_DETAIL',

  BATCH: '07_BATCH',

  STOCK_OPNAME: '08_STOCK_OPNAME',

  LOG_AKTIVITAS: '09_LOG_AKTIVITAS'

};


/**
 * ================================================================
 * HEADER 9 TABEL SIRAGA
 * ================================================================
 */

const SIRAGA_HEADER = {

  '01_CONFIG': [
    'KEY',
    'VALUE',
    'KETERANGAN',
    'DIUBAH_PADA'
  ],

  '02_KATEGORI': [
    'ID_KATEGORI',
    'NAMA_KATEGORI',
    'STATUS',
    'KETERANGAN',
    'DIBUAT_PADA',
    'DIUBAH_PADA'
  ],

  '03_BARANG': [
    'ID_BARANG',
    'KODE_BARANG',
    'NAMA_BARANG',
    'ID_KATEGORI',
    'SATUAN',
    'STOK_MINIMUM',
    'KELOLA_BATCH',
    'KELOLA_EXPIRED',
    'STATUS',
    'KETERANGAN',
    'DIBUAT_OLEH',
    'DIBUAT_PADA',
    'DIUBAH_OLEH',
    'DIUBAH_PADA'
  ],

  '04_SUPPLIER': [
    'ID_SUPPLIER',
    'NAMA_SUPPLIER',
    'KONTAK',
    'ALAMAT',
    'STATUS',
    'KETERANGAN',
    'DIBUAT_PADA',
    'DIUBAH_PADA'
  ],

  '05_TRANSAKSI': [
    'ID_TRANSAKSI',
    'NOMOR_TRANSAKSI',
    'TANGGAL',
    'JENIS_TRANSAKSI',
    'STATUS',
    'SUMBER',
    'TUJUAN',
    'ID_SUPPLIER',
    'ALASAN_PEMUSNAHAN',
    'ID_PETUGAS',
    'NAMA_PETUGAS',
    'KETERANGAN',
    'DIBUAT_PADA',
    'DIUBAH_PADA',
    'DISELESAIKAN_PADA',
    'DIBATALKAN_PADA'
  ],

  '06_TRANSAKSI_DETAIL': [
    'ID_DETAIL',
    'ID_TRANSAKSI',
    'NOMOR_TRANSAKSI',
    'ID_BARANG',
    'NAMA_BARANG',
    'SATUAN',
    'ID_BATCH',
    'QTY',
    'TANGGAL_PRODUKSI',
    'TANGGAL_EXPIRED'
  ],

  '07_BATCH': [
    'ID_BATCH',
    'ID_BARANG',
    'NOMOR_BATCH',
    'TANGGAL_PRODUKSI',
    'TANGGAL_EXPIRED',
    'STATUS',
    'KETERANGAN',
    'DIBUAT_PADA'
  ],

  '08_STOCK_OPNAME': [
    'ID_OPNAME',
    'TANGGAL',
    'ID_BARANG',
    'NAMA_BARANG',
    'ID_BATCH',
    'STOK_SISTEM',
    'STOK_FISIK',
    'SELISIH',
    'STATUS',
    'ID_PETUGAS',
    'NAMA_PETUGAS',
    'KETERANGAN',
    'ID_TRANSAKSI_PENYESUAIAN',
    'DIBUAT_PADA',
    'DISELESAIKAN_PADA'
  ],

  '09_LOG_AKTIVITAS': [
    'ID_LOG',
    'AKSI',
    'MODUL',
    'ID_TERKAIT',
    'AKTOR',
    'DETAIL',
    'WAKTU'
  ]

};


/**
 * ================================================================
 * SETUP SPREADSHEET SIRAGA
 * ================================================================
 *
 * Idempotent:
 * - Sheet yang sudah ada tidak dihapus.
 * - Header yang sudah ada tidak ditimpa.
 * - Kolom yang belum ada ditambahkan di ujung kanan.
 * - Sheet yang belum ada dibuat otomatis.
 */
function setupSiragaSpreadsheet() {

  const ss = getSiragaSpreadsheet_();

  const dibuat = [];

  Object.keys(SIRAGA_HEADER).forEach(function(namaSheet) {

    let sheet = ss.getSheetByName(namaSheet);

    if (!sheet) {

      sheet = ss.insertSheet(namaSheet);

      sheet
        .getRange(
          1,
          1,
          1,
          SIRAGA_HEADER[namaSheet].length
        )
        .setValues([
          SIRAGA_HEADER[namaSheet]
        ]);

      sheet.setFrozenRows(1);

      dibuat.push(namaSheet);

    } else {

      const kolomDitambah =
        pastikanKolomSiraga_(
          sheet,
          SIRAGA_HEADER[namaSheet]
        );

      if (kolomDitambah.length) {

        Logger.log(
          namaSheet +
          ': kolom ditambahkan -> ' +
          kolomDitambah.join(', ')
        );

      }

    }

  });


  /**
   * Hapus Sheet1 default jika:
   * - masih ada
   * - jumlah sheet > 9
   *
   * Tidak mengganggu 9 sheet SIRAGA.
   */
  const sheetDefault =
    ss.getSheetByName('Sheet1');

  if (
    sheetDefault &&
    ss.getSheets().length > 9
  ) {

    try {

      ss.deleteSheet(sheetDefault);

    } catch (e) {

      Logger.log(
        'Sheet1 tidak dapat dihapus: ' +
        e.message
      );

    }

  }


  /**
   * CONFIG DEFAULT
   */
  const sheetConfig =
    ss.getSheetByName(
      SIRAGA_SHEET.CONFIG
    );

  if (sheetConfig.getLastRow() < 2) {

    const now = new Date();

    sheetConfig
      .getRange(2, 1, 3, 4)
      .setValues([

        [
          'BATAS_MENDEKATI_MINIMUM_PERSEN',
          '20',
          'Stok dianggap "Mendekati Minimum" kalau <= (Stok Minimum x (100+ini)/100)',
          now
        ],

        [
          'BATAS_PERINGATAN_EXPIRED_HARI',
          '30',
          'Batch dianggap "Akan Kedaluwarsa" kalau tanggal expired <= N hari dari sekarang',
          now
        ],

        [
          'NAMA_GUDANG',
          'Gudang SPPG Jeungjing',
          'Ditampilkan di header/laporan SIRAGA',
          now
        ]

      ]);

  }


  /**
   * KATEGORI AWAL
   *
   * Helper ini sudah tersedia pada modul SIRAGA lainnya.
   */
  try {

    siapkanKategoriAwalSiraga_();

  } catch (e) {

    Logger.log(
      'Gagal isi kategori awal: ' +
      e.message
    );

  }


  Logger.log(
    'setupSiragaSpreadsheet selesai. ' +
    'Sheet baru dibuat: ' +
    (
      dibuat.length
        ? dibuat.join(', ')
        : '(tidak ada, semua sudah ada sebelumnya)'
    )
  );


  return {
    sheetDibuat: dibuat
  };

}


/**
 * ================================================================
 * AMBIL SHEET SIRAGA
 * ================================================================
 */

function getSiragaSheet_(namaSheet) {

  const ss =
    getSiragaSpreadsheet_();

  const sheet =
    ss.getSheetByName(namaSheet);

  if (!sheet) {

    throw new Error(
      'Sheet ' +
      namaSheet +
      ' belum ada di spreadsheet SIRAGA. ' +
      'Jalankan setupSiragaSpreadsheet() dulu.'
    );

  }

  return sheet;
}


/**
 * ================================================================
 * CACHE DATA SIRAGA
 * ================================================================
 */

const _cacheSiragaRows = {};


function getSiragaRows_(namaSheet) {

  if (_cacheSiragaRows[namaSheet]) {

    return _cacheSiragaRows[namaSheet];

  }

  const rows =
    sheetToObjects(
      getSiragaSheet_(namaSheet)
    );


  rows.forEach(function(r) {

    Object.keys(r).forEach(function(k) {

      if (
        k.indexOf('TANGGAL') === 0 &&
        r[k] instanceof Date
      ) {

        r[k] =
          formatTanggal(r[k]);

      }

    });

  });


  _cacheSiragaRows[namaSheet] =
    rows;

  return rows;
}


function _invalidasiCacheSiraga_(namaSheet) {

  if (namaSheet) {

    delete _cacheSiragaRows[namaSheet];

  } else {

    Object.keys(
      _cacheSiragaRows
    ).forEach(function(k) {

      delete _cacheSiragaRows[k];

    });

  }

}


/**
 * ================================================================
 * CONFIG
 * ================================================================
 */

function getSiragaConfig_(key, fallback) {

  const row =
    getSiragaRows_(
      SIRAGA_SHEET.CONFIG
    ).find(function(r) {

      return r.KEY === key;

    });


  return row
    ? row.VALUE
    : fallback;

}


/**
 * ================================================================
 * PERMISSION
 * ================================================================
 */

function requireSiragaAccess_(token, aksiTulis) {

  try {

    const username =
      requireAuth(token);

    return {

      tipe: 'ADMIN',

      idPetugas: username,

      namaPetugas: username

    };

  } catch (eAdmin) {

    let usernameStaff = null;

    try {

      usernameStaff =
        requireAuth(token, true);

    } catch (eStaff) {

      // lanjut ke relawan

    }


    if (usernameStaff) {

      if (aksiTulis) {

        throw new Error(
          'Akun Staff hanya bisa melihat data SIRAGA, ' +
          'tidak bisa mencatat transaksi -- khusus Admin/Petugas Stok.'
        );

      }


      return {

        tipe: 'STAFF',

        idPetugas: usernameStaff,

        namaPetugas: usernameStaff

      };

    }

  }


  const idRelawan =
    requireAuthRelawan(token);

  const relawan =
    getRelawanById(idRelawan);


  if (
    !relawan ||
    String(relawan.roleStok || '')
      .toUpperCase() !== 'PETUGAS'
  ) {

    throw new Error(
      'Anda tidak memiliki izin mengakses modul SIRAGA.'
    );

  }


  return {

    tipe: 'PETUGAS_STOK',

    idPetugas: idRelawan,

    namaPetugas:
      relawan.nama || idRelawan

  };

}


function requireSiragaAdmin_(token) {

  requireAuth(token);

}


/**
 * ================================================================
 * GENERATE ID
 * ================================================================
 */

function generateBanyakIdSiraga_(
  sheet,
  prefix,
  kolomId,
  jumlah
) {

  const pertama =
    generateIdSiraga_(
      sheet,
      prefix,
      kolomId
    );

  const mulai =
    parseInt(
      pertama.split('-')[1],
      10
    );

  const hasil = [];

  for (
    let i = 0;
    i < jumlah;
    i++
  ) {

    hasil.push(
      prefix +
      '-' +
      String(mulai + i)
        .padStart(6, '0')
    );

  }

  return hasil;
}


/**
 * Ambil header sheet.
 */
function headerSiraga_(sheet) {

  const lebar =
    sheet.getLastColumn();

  if (!lebar) return [];

  return sheet
    .getRange(
      1,
      1,
      1,
      lebar
    )
    .getValues()[0]
    .map(function(h) {

      return String(h).trim();

    });

}


/**
 * Tambahkan kolom yang belum ada.
 */
function pastikanKolomSiraga_(
  sheet,
  kolomDiharapkan
) {

  const header =
    headerSiraga_(sheet);

  const ditambah = [];


  kolomDiharapkan.forEach(
    function(k) {

      if (
        header.indexOf(k) === -1
      ) {

        sheet
          .getRange(
            1,
            header.length + 1
          )
          .setValue(k);

        header.push(k);

        ditambah.push(k);

      }

    }
  );


  return ditambah;
}


/**
 * ================================================================
 * GENERATE ID SIRAGA
 * ================================================================
 */

function generateIdSiraga_(
  sheet,
  prefix,
  kolomId
) {

  let idx = 0;


  if (typeof kolomId === 'string') {

    const pos =
      headerSiraga_(sheet)
        .indexOf(kolomId);

    idx =
      pos === -1
        ? 0
        : pos;

  } else if (
    typeof kolomId === 'number'
  ) {

    idx = kolomId;

  }


  const data =
    sheet.getDataRange()
      .getValues();

  let max = 0;


  const re =
    new RegExp(
      '^' +
      prefix +
      '-?0*(\\d+)$',
      'i'
    );


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    const cocok =
      String(
        data[i][idx] || ''
      ).match(re);


    if (cocok) {

      max =
        Math.max(
          max,
          parseInt(
            cocok[1],
            10
          )
        );

    }

  }


  return (
    prefix +
    '-' +
    String(max + 1)
      .padStart(6, '0')
  );

}


/**
 * ================================================================
 * TAMBAH BANYAK BARIS
 * ================================================================
 */

function siragaTambahBanyakBaris_(
  namaSheet,
  daftarObjek
) {

  if (!daftarObjek.length) return;


  const sheet =
    getSiragaSheet_(namaSheet);


  const kunci = [];


  daftarObjek.forEach(
    function(o) {

      Object.keys(o)
        .forEach(function(k) {

          if (
            kunci.indexOf(k) === -1
          ) {

            kunci.push(k);

          }

        });

    }
  );


  pastikanKolomSiraga_(
    sheet,
    kunci
  );


  const header =
    headerSiraga_(sheet);


  const baris =
    daftarObjek.map(
      function(o) {

        return header.map(
          function(h) {

            return (
              o[h] === undefined ||
              o[h] === null
            )
              ? ''
              : o[h];

          }
        );

      }
    );


  const mulai =
    sheet.getLastRow() + 1;


  header.forEach(
    function(h, c) {

      if (
        h.indexOf('TANGGAL') === 0
      ) {

        sheet
          .getRange(
            mulai,
            c + 1,
            baris.length,
            1
          )
          .setNumberFormat('@');

      }

    }
  );


  sheet
    .getRange(
      mulai,
      1,
      baris.length,
      header.length
    )
    .setValues(baris);


  _invalidasiCacheSiraga_(
    namaSheet
  );

}


function siragaTambahBaris_(
  namaSheet,
  objek
) {

  siragaTambahBanyakBaris_(
    namaSheet,
    [objek]
  );

}


/**
 * ================================================================
 * LOG AKTIVITAS
 * ================================================================
 */

function catatLogSiraga_(
  aksi,
  modul,
  idTerkait,
  aktor,
  detail
) {

  try {

    const sheet =
      getSiragaSheet_(
        SIRAGA_SHEET.LOG_AKTIVITAS
      );


    const id =
      generateIdSiraga_(
        sheet,
        'LOG',
        'ID_LOG'
      );


    siragaTambahBaris_(
      SIRAGA_SHEET.LOG_AKTIVITAS,
      {

        ID_LOG: id,

        AKSI: aksi,

        MODUL: modul,

        ID_TERKAIT:
          idTerkait || '',

        AKTOR:
          aktor || '',

        DETAIL:
          JSON.stringify(
            detail || {}
          ),

        WAKTU:
          new Date()

      }
    );


  } catch (e) {

    Logger.log(
      '[catatLogSiraga_] gagal mencatat log: ' +
      e.message
    );

  }

}


/**
 * ================================================================
 * DASHBOARD
 * ================================================================
 */

function getSiragaDashboardV2(body) {

  requireSiragaAccess_(
    body.token
  );


  const semuaBarang =
    getSiragaRows_(
      SIRAGA_SHEET.BARANG
    );


  const barangAktif =
    semuaBarang.filter(
      function(b) {

        return statusAktifSiraga_(
          b.STATUS
        );

      }
    );


  const stokMap =
    getSiragaStokSemuaBarang_();


  let aman = 0;

  let mendekati = 0;

  let bawahMinimum = 0;

  let habis = 0;


  barangAktif.forEach(
    function(b) {

      const stok =
        stokMap[b.ID_BARANG] || 0;


      const status =
        hitungStatusStokSiraga_(
          stok,
          Number(
            b.STOK_MINIMUM
          ) || 0
        );


      if (status === 'AMAN') {

        aman++;

      } else if (
        status === 'MENDEKATI MINIMUM'
      ) {

        mendekati++;

      } else if (
        status === 'DI BAWAH MINIMUM'
      ) {

        bawahMinimum++;

      } else if (
        status === 'HABIS'
      ) {

        habis++;

      }

    }
  );


  const ringkasanExpired =
    hitungRingkasanExpiredSiraga_();


  const hariIni =
    formatTanggal(
      new Date()
    );


  const transaksiHariIni =
    getSiragaRows_(
      SIRAGA_SHEET.TRANSAKSI
    ).filter(function(t) {

      return (
        t.TANGGAL === hariIni &&
        t.STATUS === 'SELESAI'
      );

    });


  return {

    totalBarang:
      semuaBarang.length,

    barangAktif:
      barangAktif.length,

    stokAman:
      aman,

    stokMendekatiMinimum:
      mendekati,

    stokDiBawahMinimum:
      bawahMinimum,

    barangHabis:
      habis,

    akanExpired:
      ringkasanExpired.akanExpired,

    expired:
      ringkasanExpired.expired,

    transaksiHariIni:
      transaksiHariIni.length,

    barangMasukHariIni:
      transaksiHariIni.filter(
        function(t) {

          return t.JENIS_TRANSAKSI === 'MASUK';

        }
      ).length,

    barangKeluarHariIni:
      transaksiHariIni.filter(
        function(t) {

          return t.JENIS_TRANSAKSI === 'KELUAR';

        }
      ).length

  };

}


/**
 * ================================================================
 * LOG AKTIVITAS — ADMIN
 * ================================================================
 */

function getSiragaActivityLogs(body) {

  requireSiragaAdmin_(
    body.token
  );


  let logs =
    getSiragaRows_(
      SIRAGA_SHEET.LOG_AKTIVITAS
    );


  if (body.modul) {

    logs =
      logs.filter(
        function(l) {

          return l.MODUL === body.modul;

        }
      );

  }


  if (body.aksi) {

    logs =
      logs.filter(
        function(l) {

          return l.AKSI === body.aksi;

        }
      );

  }


  return logs
    .sort(
      function(a, b) {

        return (
          (b.WAKTU instanceof Date
            ? b.WAKTU.getTime()
            : 0) -
          (a.WAKTU instanceof Date
            ? a.WAKTU.getTime()
            : 0)
        );

      }
    )
    .slice(0, 500)
    .map(
      function(l) {

        return {

          id: l.ID_LOG,

          aksi: l.AKSI,

          modul: l.MODUL,

          idTerkait:
            l.ID_TERKAIT,

          aktor:
            l.AKTOR,

          detail:
            l.DETAIL,

          waktu:
            l.WAKTU

        };

      }
    );

}


/**
 * ================================================================
 * DIAGNOSA SIRAGA
 * ================================================================
 *
 * Hanya membaca database.
 * Tidak mengubah data.
 */
function diagnosaSiraga() {

  const ss =
    getSiragaSpreadsheet_();


  const hasil = {

    namaSpreadsheet:
      ss.getName(),

    sheet: [],

    barang: null,

    catatan: []

  };


  Object.keys(
    SIRAGA_HEADER
  ).forEach(
    function(nama) {

      const sh =
        ss.getSheetByName(nama);


      if (!sh) {

        hasil.sheet.push({

          nama: nama,

          ada: false

        });


        hasil.catatan.push(
          'Sheet ' +
          nama +
          ' TIDAK ADA -- jalankan setupSiragaSpreadsheet().'
        );


        return;

      }


      const header =
        headerSiraga_(sh);


      const diharapkan =
        SIRAGA_HEADER[nama];


      const hilang =
        diharapkan.filter(
          function(k) {

            return header.indexOf(k) === -1;

          }
        );


      const tambahan =
        header.filter(
          function(k) {

            return (
              k &&
              diharapkan.indexOf(k) === -1
            );

          }
        );


      hasil.sheet.push({

        nama: nama,

        ada: true,

        jumlahBaris:
          Math.max(
            0,
            sh.getLastRow() - 1
          ),

        kolomHilang:
          hilang,

        kolomTambahan:
          tambahan

      });


      if (hilang.length) {

        hasil.catatan.push(
          nama +
          ': kolom belum ada -> ' +
          hilang.join(', ') +
          ' (akan ditambahkan otomatis oleh setupSiragaSpreadsheet atau saat data pertama ditulis).'
        );

      }

    }
  );


  const shBarang =
    ss.getSheetByName(
      SIRAGA_SHEET.BARANG
    );


  if (shBarang) {

    const barang =
      sheetToObjects(
        shBarang
      );


    const kategoriId =
      new Set();


    const shKat =
      ss.getSheetByName(
        SIRAGA_SHEET.KATEGORI
      );


    if (shKat) {

      sheetToObjects(
        shKat
      ).forEach(
        function(k) {

          if (k.ID_KATEGORI) {

            kategoriId.add(
              String(
                k.ID_KATEGORI
              )
            );

          }

        }
      );

    }


    const distribusiStatus = {};

    const hitungId = {};

    const kategoriYatim = {};

    const satuanAsing = {};

    let aktif = 0;


    barang.forEach(
      function(b) {

        const st =
          String(
            b.STATUS === undefined
              ? ''
              : b.STATUS
          ).trim() ||
          '(kosong)';


        distribusiStatus[st] =
          (
            distribusiStatus[st] || 0
          ) + 1;


        if (
          statusAktifSiraga_(
            b.STATUS
          )
        ) {

          aktif++;

        }


        const id =
          String(
            b.ID_BARANG || ''
          );


        hitungId[id] =
          (
            hitungId[id] || 0
          ) + 1;


        const kat =
          String(
            b.ID_KATEGORI || ''
          );


        if (
          kat &&
          !kategoriId.has(kat)
        ) {

          kategoriYatim[kat] =
            (
              kategoriYatim[kat] || 0
            ) + 1;

        }


        const sat =
          String(
            b.SATUAN || ''
          ).trim();


        if (
          sat &&
          SIRAGA_SATUAN_LIST
            .indexOf(
              sat.toUpperCase()
            ) === -1
        ) {

          satuanAsing[sat] =
            (
              satuanAsing[sat] || 0
            ) + 1;

        }

      }
    );


    const idGanda =
      Object.keys(
        hitungId
      ).filter(
        function(id) {

          return (
            id &&
            hitungId[id] > 1
          );

        }
      );


    hasil.barang = {

      total:
        barang.length,

      terbacaAktif:
        aktif,

      distribusiStatus:
        distribusiStatus,

      idGanda:
        idGanda,

      kategoriTidakDitemukan:
        kategoriYatim,

      satuanTidakDikenal:
        satuanAsing,

      contohId:
        barang
          .slice(0, 3)
          .map(
            function(b) {

              return b.ID_BARANG;

            }
          )

    };


    Object.keys(
      distribusiStatus
    ).forEach(
      function(st) {

        const u =
          st.toUpperCase();


        if (
          [
            'AKTIF',
            'PERTAHANKAN',
            'NONAKTIF'
          ].indexOf(u) === -1
        ) {

          hasil.catatan.push(
            'STATUS barang bernilai "' +
            st +
            '" (' +
            distribusiStatus[st] +
            ' baris) dianggap TIDAK aktif -- tidak muncul di form transaksi.'
          );

        }

      }
    );


    if (idGanda.length) {

      hasil.catatan.push(
        'ID_BARANG ganda: ' +
        idGanda.join(', ') +
        ' -- perlu dirapikan.'
      );

    }


    if (
      Object.keys(
        kategoriYatim
      ).length
    ) {

      hasil.catatan.push(
        'ID_KATEGORI di barang tidak ada di sheet 02_KATEGORI: ' +
        Object.keys(kategoriYatim).join(', ') +
        ' -- kategori barang ini tampil "-".'
      );

    }


    if (
      Object.keys(
        satuanAsing
      ).length
    ) {

      hasil.catatan.push(
        'SATUAN di luar daftar standar: ' +
        Object.keys(satuanAsing).join(', ') +
        ' -- tetap terbaca, tapi tidak bisa dipilih ulang di dropdown Satuan.'
      );

    }

  }


  Logger.log(
    JSON.stringify(
      hasil,
      null,
      2
    )
  );


  return hasil;

}


/**
 * ================================================================
 * DIAGNOSA SIRAGA — ADMIN ENDPOINT
 * ================================================================
 */

function diagnosaSiragaAdmin(body) {

  requireSiragaAdmin_(
    body.token
  );

  return diagnosaSiraga();

}
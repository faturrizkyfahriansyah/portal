/**
 * Db.gs — Akses Google Spreadsheet (database SIPENDOK).
 *
 * Semua sheet berada dalam SATU spreadsheet.
 * Transaksi penerimaan menggunakan SATU sheet (03_PENERIMAAN)
 * sepanjang tahun — tidak ada sheet per bulan.
 */

var Db = {
  _ss: null,

  /**
   * Mengambil instance Spreadsheet.
   * Menggunakan SPREADSHEET_ID jika tersedia.
   */
  ss: function () {
    if (Db._ss) return Db._ss;

    var id = PropertiesService
      .getScriptProperties()
      .getProperty('SPREADSHEET_ID');

    var ss = id
      ? SpreadsheetApp.openById(id)
      : SpreadsheetApp.getActiveSpreadsheet();

    if (!ss) {
      throw new AppError(
        'Database belum diatur. Jalankan setup() terlebih dahulu.',
        'DB_BELUM_ADA'
      );
    }

    Db._ss = ss;
    return ss;
  },

  /**
   * Mengambil sheet berdasarkan key pada Cfg.SHEET.
   */
  sheet: function (key) {
    var name = Cfg.SHEET[key];
    var sh = Db.ss().getSheetByName(name);

    if (!sh) {
      throw new AppError(
        'Sheet "' + name + '" tidak ditemukan. Jalankan setup().',
        'SHEET_HILANG'
      );
    }

    return sh;
  },

  /**
   * Normalisasi satu nilai sel berdasarkan nama kolom.
   */
  _norm: function (col, v) {
    if (v instanceof Date) {
      return col.indexOf('WAKTU') === 0
        ? U.cellDateTime(v)
        : U.cellDate(v);
    }

    if (col === 'JENIS_PM') {
      return String(
        v === null || v === undefined ? '' : v
      ).trim().toUpperCase();
    }

    if (typeof v === 'string') {
      return v.trim();
    }

    return v === null || v === undefined ? '' : v;
  },

  /**
   * Membaca seluruh isi sheet sebagai array objek.
   * Setiap objek memiliki properti _row sebagai nomor baris.
   */
  readAll: function (key) {
    var sh = Db.sheet(key);
    var head = Cfg.HEAD[key];
    var last = sh.getLastRow();

    if (last < 2) return [];

    var vals = sh
      .getRange(2, 1, last - 1, head.length)
      .getValues();

    var out = [];

    for (var i = 0; i < vals.length; i++) {
      var row = vals[i];
      var empty = true;
      var obj = { _row: i + 2 };

      for (var c = 0; c < head.length; c++) {
        var value = Db._norm(head[c], row[c]);

        if (value !== '') {
          empty = false;
        }

        obj[head[c]] = value;
      }

      if (!empty) {
        out.push(obj);
      }
    }

    return out;
  },

  /**
   * Mengubah objek menjadi array sesuai urutan header.
   */
  _toArr: function (key, obj) {
    return Cfg.HEAD[key].map(function (header) {
      var value = obj[header];

      return value === undefined || value === null
        ? ''
        : value;
    });
  },

  /**
   * Menambahkan banyak baris sekaligus.
   */
  appendMany: function (key, objs) {
    if (!objs || !objs.length) return;

    var sh = Db.sheet(key);
    var cols = Cfg.HEAD[key].length;
    var start = Math.max(sh.getLastRow(), 1) + 1;

    var values = objs.map(function (obj) {
      return Db._toArr(key, obj);
    });

    sh.getRange(start, 1, values.length, cols)
      .setValues(values);
  },

  /**
   * Memperbarui satu baris berdasarkan nomor baris sheet.
   */
  updateRow: function (key, rowNum, obj) {
    var cols = Cfg.HEAD[key].length;

    Db.sheet(key)
      .getRange(rowNum, 1, 1, cols)
      .setValues([Db._toArr(key, obj)]);
  },

  /**
   * Menghapus satu baris secara permanen.
   *
   * Digunakan oleh Pm.hapus dan Master.gs.
   * Pastikan rowNum merupakan nomor baris data yang valid.
   */
  deleteRow: function (key, rowNum) {
    var sh = Db.sheet(key);
    var row = Number(rowNum);

    if (!Number.isInteger(row) || row < 2 || row > sh.getLastRow()) {
      throw new AppError(
        'Nomor baris tidak valid untuk penghapusan.',
        'BARIS_TIDAK_VALID'
      );
    }

    sh.deleteRow(row);
  },

  /**
   * Menulis ulang seluruh isi tabel tanpa menghapus header.
   * Membersihkan sisa isi lama jika data baru lebih sedikit.
   */
  writeAll: function (key, objs) {
    var sh = Db.sheet(key);
    var cols = Cfg.HEAD[key].length;
    var last = sh.getLastRow();
    var rows = objs || [];

    if (rows.length > 0) {
      var values = rows.map(function (obj) {
        return Db._toArr(key, obj);
      });

      sh.getRange(2, 1, values.length, cols)
        .setValues(values);
    }

    var oldN = Math.max(last - 1, 0);

    if (oldN > rows.length) {
      sh.getRange(
        rows.length + 2,
        1,
        oldN - rows.length,
        cols
      ).clearContent();
    }
  },

  /**
   * Memastikan sheet dan header tersedia.
   * Aman dipanggil berulang selama skema header sesuai.
   */
  ensureSheet: function (key) {
    var ss = Db.ss();
    var name = Cfg.SHEET[key];
    var head = Cfg.HEAD[key];

    if (!name || !head || !head.length) {
      throw new AppError(
        'Konfigurasi sheet atau header tidak ditemukan: ' + key,
        'KONFIGURASI_SHEET_SALAH'
      );
    }

    var sh = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
    }

    var cur = sh
      .getRange(1, 1, 1, head.length)
      .getValues()[0];

    var same = head.every(function (header, i) {
      return String(cur[i]).trim() === header;
    });

    if (!same) {
      var hasContent = cur.some(function (value) {
        return String(value).trim() !== '';
      });

      if (hasContent) {
        throw new AppError(
          'Header sheet "' + name +
          '" tidak sesuai skema SIPENDOK. ' +
          'Periksa kolom baris 1.',
          'HEADER_SALAH'
        );
      }

      sh.getRange(1, 1, 1, head.length)
        .setValues([head]);
    }

    sh.getRange(1, 1, 1, head.length)
      .setFontWeight('bold')
      .setBackground('#e8eef6');

    sh.setFrozenRows(1);

    // Format kolom tertentu sebagai teks biasa.
    (Cfg.TEXT_COLS[key] || []).forEach(function (header) {
      var idx = head.indexOf(header) + 1;

      if (idx > 0) {
        sh.getRange(
          2,
          idx,
          Math.max(sh.getMaxRows() - 1, 1),
          1
        ).setNumberFormat('@');
      }
    });

    return sh;
  },

  /**
   * Mengambil pengaturan menjadi objek {KUNCI: NILAI}.
   */
  settings: function () {
    var out = {};

    Db.readAll('PENGATURAN').forEach(function (row) {
      out[row.KUNCI] = row.NILAI === undefined
        ? ''
        : String(row.NILAI);
    });

    return out;
  },

  /**
   * Menyimpan atau memperbarui satu pengaturan.
   */
  setSetting: function (kunci, nilai) {
    var rows = Db.readAll('PENGATURAN');
    var hit = null;

    rows.forEach(function (row) {
      if (row.KUNCI === kunci) {
        hit = row;
      }
    });

    if (hit) {
      Db.sheet('PENGATURAN')
        .getRange(hit._row, 2)
        .setValue(String(nilai));
    } else {
      Db.appendMany('PENGATURAN', [{
        KUNCI: kunci,
        NILAI: String(nilai),
        KETERANGAN: ''
      }]);
    }
  },

  /**
   * Mengambil tarif berdasarkan jenis porsi.
   */
  tarif: function () {
    var out = {};

    Db.readAll('TARIF').forEach(function (row) {
      out[row.JENIS_PORSI] = {
        TOTAL: U.num(row.TOTAL),
        BAHAN_BAKU: U.num(row.BAHAN_BAKU),
        MITRA_FASILITAS: U.num(row.MITRA_FASILITAS),
        OPERASIONAL: U.num(row.OPERASIONAL)
      };
    });

    if (!out['Porsi Kecil'] || !out['Porsi Besar']) {
      throw new AppError(
        'Sheet 04_TARIF harus berisi "Porsi Kecil" dan "Porsi Besar".',
        'TARIF_HILANG'
      );
    }

    return out;
  },

  /**
   * Mencatat aktivitas ke sheet LOG.
   * Kegagalan pencatatan log tidak menggagalkan proses utama.
   */
  log: function (
    user,
    aktivitas,
    modul,
    idData,
    keterangan
  ) {
    try {
      Db.appendMany('LOG', [{
        WAKTU: U.now('dd/MM/yyyy HH:mm:ss'),
        USER: user || '-',
        AKTIVITAS: aktivitas,
        MODUL: modul,
        ID_DATA: idData || '',
        KETERANGAN: keterangan || ''
      }]);
    } catch (e) {
      // Log tidak boleh menggagalkan proses utama.
    }
  }
};
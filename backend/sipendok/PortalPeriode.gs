/**
 * PortalPeriode.gs
 * Integrasi BACA-SAJA ke database Portal SPPG.
 *
 * Sumber:
 *   14_PERIODE_KERJA
 *   15_KALENDER_OPERASIONAL
 *
 * Tidak menulis atau mengubah data pada spreadsheet Portal.
 * Konfigurasi disimpan melalui Pengaturan SIPENDOK.
 */

var PortalPeriode = {
  ID_DEFAULT: '1zMPP49ec963RuN7scvAqWYcZlxtalJMi7EVwU_xe3Io',

  SHEET_PERIODE_DEFAULT: '14_PERIODE_KERJA',
  SHEET_KALENDER_DEFAULT: '15_KALENDER_OPERASIONAL',

  /**
   * Membaca pengaturan SIPENDOK.
   */
  _setting: function (key, fallback) {
    var settings = Db.settings();
    return String(settings[key] || fallback || '').trim();
  },

  /**
   * Membuka spreadsheet Portal dalam mode baca-saja.
   */
  _ss: function () {
    var id = PortalPeriode._setting(
      'PORTAL_SPREADSHEET_ID',
      PortalPeriode.ID_DEFAULT
    );

    if (!id) {
      throw new AppError(
        'ID spreadsheet Portal belum diatur.',
        'PORTAL_KONFIG'
      );
    }

    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      throw new AppError(
        'SIPENDOK tidak dapat membaca spreadsheet Portal. ' +
        'Periksa ID spreadsheet dan izin akses akun Apps Script.',
        'PORTAL_AKSES'
      );
    }
  },

  /**
   * Membaca baris spreadsheet dan memvalidasi header.
   */
  _rows: function (sheetName, requiredHeaders) {
    var ss = PortalPeriode._ss();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new AppError(
        'Sheet Portal "' + sheetName + '" tidak ditemukan.',
        'PORTAL_SHEET'
      );
    }

    var values = sheet.getDataRange().getValues();

    if (!values.length || !values[0].length) {
      throw new AppError(
        'Sheet Portal "' + sheetName + '" belum memiliki header.',
        'PORTAL_SKEMA'
      );
    }

    var headers = values[0].map(function (value) {
      return String(value || '').trim().toUpperCase();
    });

    requiredHeaders.forEach(function (header) {
      if (headers.indexOf(header) === -1) {
        throw new AppError(
          'Kolom ' + header +
          ' tidak ditemukan pada sheet Portal ' + sheetName + '.',
          'PORTAL_SKEMA'
        );
      }
    });

    return values
      .slice(1)
      .filter(function (row) {
        return row.some(function (value) {
          return value !== '' && value !== null;
        });
      })
      .map(function (row) {
        var result = {};

        headers.forEach(function (header, index) {
          if (header) {
            result[header] = row[index];
          }
        });

        return result;
      });
  },

  /**
   * Menormalisasi tanggal menjadi yyyy-MM-dd.
   */
  _date: function (value) {
    if (
      value instanceof Date &&
      !isNaN(value.getTime())
    ) {
      return Utilities.formatDate(
        value,
        Cfg.TZ,
        'yyyy-MM-dd'
      );
    }

    var str = String(
      value === null || value === undefined ? '' : value
    ).trim();

    if (!str) return '';

    var match = str.match(
      /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/
    );

    if (match) {
      return match[3] + '-' +
        ('0' + match[2]).slice(-2) + '-' +
        ('0' + match[1]).slice(-2);
    }

    var iso = str.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (iso) {
      return iso[1] + '-' + iso[2] + '-' + iso[3];
    }

    return '';
  },

  /**
   * Mengambil seluruh daftar periode kerja.
   */
  daftar: function () {
    var sheetName = PortalPeriode._setting(
      'PORTAL_SHEET_PERIODE',
      PortalPeriode.SHEET_PERIODE_DEFAULT
    );

    var rows = PortalPeriode._rows(sheetName, [
      'ID_PERIODE',
      'NAMA_PERIODE',
      'TANGGAL_MULAI',
      'TANGGAL_SELESAI',
      'STATUS'
    ]);

    return rows.map(function (row) {
      return {
        ID_PERIODE: String(row.ID_PERIODE || '').trim(),

        NAMA_PERIODE: String(
          row.NAMA_PERIODE || ''
        ).trim(),

        TANGGAL_MULAI: PortalPeriode._date(
          row.TANGGAL_MULAI
        ),

        TANGGAL_SELESAI: PortalPeriode._date(
          row.TANGGAL_SELESAI
        ),

        STATUS: String(
          row.STATUS || ''
        ).trim().toUpperCase(),

        KETERANGAN: String(
          row.KETERANGAN || ''
        ).trim()
      };
    }).filter(function (row) {
      return row.ID_PERIODE !== '';
    });
  },

  /**
   * Mengambil kalender operasional.
   * Jika tanggal kosong, mengambil semua tanggal.
   */
  kalender: function (tanggal) {
    var sheetName = PortalPeriode._setting(
      'PORTAL_SHEET_KALENDER',
      PortalPeriode.SHEET_KALENDER_DEFAULT
    );

    var target = PortalPeriode._date(tanggal);

    var rows = PortalPeriode._rows(sheetName, [
      'ID_PERIODE',
      'TANGGAL_OPERASIONAL',
      'STATUS'
    ]);

    return rows.map(function (row) {
      return {
        ID_PERIODE: String(
          row.ID_PERIODE || ''
        ).trim(),

        TANGGAL_OPERASIONAL: PortalPeriode._date(
          row.TANGGAL_OPERASIONAL
        ),

        STATUS: String(
          row.STATUS || ''
        ).trim().toUpperCase(),

        HARI: String(row.HARI || '').trim(),

        ID_OPERASIONAL: String(
          row.ID_OPERASIONAL || ''
        ).trim(),

        KETERANGAN: String(
          row.KETERANGAN || ''
        ).trim()
      };
    }).filter(function (row) {
      return !target ||
        row.TANGGAL_OPERASIONAL === target;
    });
  },

  /**
   * Menentukan periode yang berkaitan dengan tanggal operasional.
   *
   * Prioritas:
   * 1. Periode yang terhubung melalui kalender operasional.
   * 2. Periode yang rentang tanggalnya mencakup tanggal target.
   */
  untukTanggal: function (tanggal) {
    var target = PortalPeriode._date(tanggal);

    if (!target) {
      throw new AppError(
        'Tanggal operasional tidak valid.',
        'VALIDASI'
      );
    }

    var kalender = PortalPeriode.kalender(target);
    var periodIds = {};

    kalender.forEach(function (row) {
      if (row.ID_PERIODE) {
        periodIds[row.ID_PERIODE] = true;
      }
    });

    var periods = PortalPeriode.daftar();

    var found = periods.filter(function (period) {
      if (periodIds[period.ID_PERIODE]) {
        return true;
      }

      return period.TANGGAL_MULAI &&
        period.TANGGAL_SELESAI &&
        target >= period.TANGGAL_MULAI &&
        target <= period.TANGGAL_SELESAI;
    });

    if (!found.length) {
      return {
        tanggal: target,
        periode: null,
        kalender: kalender,
        pesan: 'Tanggal ini belum terhubung ke periode Portal.'
      };
    }

    // Utamakan periode yang secara eksplisit
    // terhubung melalui kalender operasional.
    found.sort(function (a, b) {
      return (
        (periodIds[b.ID_PERIODE] ? 1 : 0) -
        (periodIds[a.ID_PERIODE] ? 1 : 0)
      );
    });

    return {
      tanggal: target,
      periode: found[0],
      kalender: kalender,
      pesan: ''
    };
  },

  /**
   * Memeriksa koneksi dan jumlah data periode.
   */
  status: function () {
    var ss = PortalPeriode._ss();

    return {
      terhubung: true,
      namaSpreadsheet: ss.getName(),
      spreadsheetId: ss.getId(),

      sheetPeriode: PortalPeriode._setting(
        'PORTAL_SHEET_PERIODE',
        PortalPeriode.SHEET_PERIODE_DEFAULT
      ),

      sheetKalender: PortalPeriode._setting(
        'PORTAL_SHEET_KALENDER',
        PortalPeriode.SHEET_KALENDER_DEFAULT
      ),

      jumlahPeriode: PortalPeriode.daftar().length
    };
  }
};


/**
 * Konfigurasi awal Portal SIPENDOK.
 *
 * Hanya mengisi pengaturan yang belum tersedia.
 * Tidak mengubah spreadsheet Portal.
 */
function konfigurasiPortalSIPENDOK() {
  var current = Db.settings();

  if (!current.PORTAL_SPREADSHEET_ID) {
    Db.setSetting(
      'PORTAL_SPREADSHEET_ID',
      PortalPeriode.ID_DEFAULT
    );
  }

  if (!current.PORTAL_SHEET_PERIODE) {
    Db.setSetting(
      'PORTAL_SHEET_PERIODE',
      PortalPeriode.SHEET_PERIODE_DEFAULT
    );
  }

  if (!current.PORTAL_SHEET_KALENDER) {
    Db.setSetting(
      'PORTAL_SHEET_KALENDER',
      PortalPeriode.SHEET_KALENDER_DEFAULT
    );
  }

  return PortalPeriode.status();
}


/**
 * Diagnostik koneksi Portal.
 *
 * Jalankan manual dari editor Apps Script SIPENDOK.
 */
function diagnostikPortalPeriode() {
  try {
    var status = PortalPeriode.status();

    Logger.log(
      'STATUS PORTAL:\n' +
      JSON.stringify(status, null, 2)
    );

    var periode = PortalPeriode.daftar();
    Logger.log('Jumlah periode: ' + periode.length);

    var kalender = PortalPeriode.kalender('');
    Logger.log('Jumlah kalender: ' + kalender.length);

    return {
      status: status,
      jumlahPeriode: periode.length,
      jumlahKalender: kalender.length
    };

  } catch (e) {
    Logger.log('Kode error: ' + (e.code || '-'));
    Logger.log('Pesan error: ' + (e.message || e));
    Logger.log('Stack: ' + (e.stack || ''));

    throw e;
  }
}
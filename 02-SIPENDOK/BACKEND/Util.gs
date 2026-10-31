/** Util.gs — Error aplikasi, tanggal, angka, format. */

function AppError(message, code, details) {
  this.name = 'AppError';
  this.message = message;
  this.code = code || 'ERROR';
  this.details = details || null;
}
AppError.prototype = Object.create(Error.prototype);
AppError.prototype.constructor = AppError;

var U = {
  pad: function (n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; },

  /** Waktu sekarang di Asia/Jakarta. fmt mengikuti Utilities.formatDate. */
  now: function (fmt) { return Utilities.formatDate(new Date(), Cfg.TZ, fmt || 'yyyy-MM-dd HH:mm:ss'); },
  today: function () { return U.now('yyyy-MM-dd'); },

  /** Validasi ketat 'yyyy-MM-dd' dan kembalikan {y,m,d} atau null. */
  parseDate: function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d, dow: dt.getUTCDay() };
  },
  mustDate: function (s) {
    var p = U.parseDate(s);
    if (!p) throw new AppError('Tanggal tidak valid. Gunakan format yyyy-MM-dd.', 'TANGGAL_INVALID');
    return p;
  },
  addDays: function (dateStr, n) {
    var p = U.mustDate(dateStr);
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return dt.getUTCFullYear() + '-' + U.pad(dt.getUTCMonth() + 1, 2) + '-' + U.pad(dt.getUTCDate(), 2);
  },
  hariIndo: function (dateStr) { return Cfg.HARI[U.mustDate(dateStr).dow]; },
  tanggalIndo: function (dateStr) {
    var p = U.mustDate(dateStr);
    return U.pad(p.d, 2) + ' ' + Cfg.BULAN[p.m - 1] + ' ' + p.y;
  },

  /** Nilai sel (Date / string) -> 'yyyy-MM-dd'. */
  cellDate: function (v) {
    if (v instanceof Date) return Utilities.formatDate(v, Cfg.TZ, 'yyyy-MM-dd');
    return String(v === null || v === undefined ? '' : v).trim().substring(0, 10);
  },
  cellDateTime: function (v) {
    if (v instanceof Date) return Utilities.formatDate(v, Cfg.TZ, 'yyyy-MM-dd HH:mm:ss');
    return String(v === null || v === undefined ? '' : v).trim();
  },
  str: function (v) { return String(v === null || v === undefined ? '' : v).trim(); },

  /** Bilangan bulat >= 0; kosong -> 0. Melempar AppError bila tidak valid. */
  intNonNeg: function (v, label) {
    if (v === '' || v === null || v === undefined) return 0;
    var n = Number(v);
    if (!isFinite(n) || Math.floor(n) !== n || n < 0 || n > Cfg.MAX_JUMLAH) {
      throw new AppError((label || 'Jumlah') + ' harus bilangan bulat 0 – ' + Cfg.MAX_JUMLAH + '.', 'JUMLAH_INVALID');
    }
    return n;
  },
  num: function (v) { var n = Number(v); return isFinite(n) ? n : 0; },

  fmtNum: function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); },
  fmtRp: function (n) { return 'Rp' + U.fmtNum(n); },

  /** Kunci periode dari tanggal: 'yyyy-MM'. */
  ym: function (dateStr) { return String(dateStr).substring(0, 7); },

  eq: function (a, b) { return U.str(a).toLowerCase() === U.str(b).toLowerCase(); },

  /** Nomor urut berikutnya dari ID berformat PREFIX-### */
  nextId: function (prefix, existingIds, width) {
    var max = 0, re = new RegExp('^' + prefix + '-?(\\d+)$');
    existingIds.forEach(function (id) {
      var m = re.exec(U.str(id));
      if (m && +m[1] > max) max = +m[1];
    });
    return prefix + '-' + U.pad(max + 1, width || 3);
  }
};

/** Bersihkan teks bebas dari input pengguna (spasi ganda, karakter kontrol, awalan formula). */
U.clean = function (v, max) {
  var s = String(v === null || v === undefined ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[=@]+/, '');
  return s.substring(0, max || 200);
};


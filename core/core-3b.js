/* core-3b.js -- aturan validasi + pengisi template MPM (template-04). Dipakai halaman kader dan panel admin.
   SUMBER YANG SAMA dengan blok validasi di Pendataan3B.gs (bagian antara penanda VALIDASI-MULAI/SELESAI disalin otomatis;
   uji sinkron memeriksanya). Tanpa DOM, tanpa variabel global selain window.Core3B. */
window.Core3B = (function () {
/*VALIDASI-MULAI*/
var KAT = {
  'Ibu Hamil':    { code: 'pos15-ibu-hamil' },
  'Ibu Menyusui': { code: 'pos15-ibu-menyusui' },
  'Balita':       { code: 'pos15-balita' }
};
var MAX_ROWS = 9998; // baris 3..10000 pada template

function pad2(n) { return String(n).padStart(2, '0'); }

function parseDMY(s) {
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
  if (!m) return null;
  var d = +m[1], mo = +m[2], y = +m[3];
  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
function fmtDMY(dt) { return pad2(dt.getUTCDate()) + '/' + pad2(dt.getUTCMonth() + 1) + '/' + dt.getUTCFullYear(); }
function todayUTC() { var n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
// sama seperti EDATE() di Excel
function edate(dt, n) {
  var t = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + n, 1));
  var last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(dt.getUTCDate(), last)));
}
function excelSerial(dt) { return Math.round((dt.getTime() - Date.UTC(1899, 11, 30)) / 86400000); }
function maskDate(raw) {
  var d = String(raw || '').replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
  if (d.length > 2) return d.slice(0, 2) + '/' + d.slice(2);
  return d;
}
function normNama(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function ageYears(dt, today) {
  var a = today.getUTCFullYear() - dt.getUTCFullYear();
  if (today.getUTCMonth() < dt.getUTCMonth() || (today.getUTCMonth() === dt.getUTCMonth() && today.getUTCDate() < dt.getUTCDate())) a--;
  return a;
}
// 6 digit tengah NIK yang harus sama dengan tanggal lahir (perempuan: tanggal + 40)
function nikSegment(dt, gender) {
  return pad2(dt.getUTCDate() + (gender === 'P' ? 40 : 0)) + pad2(dt.getUTCMonth() + 1) + String(dt.getUTCFullYear()).slice(-2);
}

// Field per kategori (urutan tampil)
var FIELDS = {
  'Ibu Hamil':    ['nama', 'tgl', 'nik', 'hpht'],
  'Ibu Menyusui': ['nama', 'tgl', 'nik', 'anak_nama', 'anak_tgl', 'anak_nik'],
  'Balita':       ['nama', 'tgl', 'gender', 'nik', 'ibu_nama', 'ibu_nik']
};

function errNama(s, who) {
  s = normNama(s);
  if (!s) return 'Nama ' + who + ' wajib diisi.';
  if (!/^[A-Z' -]+$/.test(s)) return "Nama hanya boleh huruf, spasi, tanda - dan '. Tanpa titik atau angka (tulis MUHAMMAD, bukan M.).";
  if (s.replace(/[^A-Z]/g, '').length < 2) return 'Nama terlalu pendek.';
  return '';
}
function errNik16(s, who) {
  if (!s) return 'NIK ' + who + ' wajib diisi (16 angka).';
  if (!/^\d+$/.test(s)) return 'NIK hanya boleh angka.';
  if (s.length !== 16) return 'NIK harus 16 angka. Sekarang baru ' + s.length + ' angka.';
  return '';
}

/* validasi satu data. others = data lain di daftar (untuk cek NIK ganda).
   Hasil: {errors:{field:pesan}, warnings:{field:pesan}} */
function validate(kat, v, today, others) {
  var e = {}, w = {};
  var t6 = edate(today, -6), t60 = edate(today, -60), t11 = edate(today, -11), t24 = edate(today, -24);
  var who = kat === 'Balita' ? 'balita' : 'ibu';
  var gender = kat === 'Balita' ? v.gender : 'P';
  var tgl = parseDMY(v.tgl);

  var m = errNama(v.nama, who); if (m) e.nama = m;

  if (!v.tgl) e.tgl = 'Tanggal lahir wajib diisi.';
  else if (!tgl) e.tgl = 'Tulis tanggal lengkap dan benar, contoh 01/01/2000.';
  else if (tgl > t6) e.tgl = 'Usia minimal 6 bulan. Pastikan ini tanggal lahir ' + who + ', bukan tanggal lahir anaknya.';
  else if (kat === 'Balita' && tgl <= t60) e.tgl = 'Usia balita maksimal 59 bulan. Anak ini sudah 5 tahun atau lebih, tidak masuk kategori Balita.';
  else if (kat !== 'Balita') {
    var age = ageYears(tgl, today);
    if (age < 12 || age > 55) w.tgl = 'Cek lagi: usia ibu tercatat ' + age + ' tahun.';
  }

  if (kat === 'Balita' && gender !== 'L' && gender !== 'P') e.gender = 'Pilih jenis kelamin balita.';

  var me = errNik16(v.nik, who);
  if (me) e.nik = me;
  else if (!tgl || e.tgl) e.nik = 'Isi tanggal lahir dengan benar dulu, supaya NIK bisa dicek.';
  else if (gender !== 'L' && gender !== 'P') e.nik = 'Pilih jenis kelamin dulu, supaya NIK bisa dicek.';
  else {
    var seg = nikSegment(tgl, gender);
    if (v.nik.slice(6, 12) !== seg) e.nik = 'Angka ke-7 sampai ke-12 NIK harus ' + seg + ' (dari tanggal lahir' + (gender === 'P' ? ', tanggal ditambah 40 untuk perempuan' : '') + '). Di NIK ini tertulis ' + v.nik.slice(6, 12) + '.';
  }
  if (!e.nik) {
    var dup = (others || []).filter(function (o) { return o.nik === v.nik; })[0];
    if (dup) e.nik = 'NIK ini sudah ada di daftar atas nama ' + dup.nama + '.';
    else if (kat === 'Ibu Menyusui' && v.anak_nik && v.nik === v.anak_nik) e.nik = 'NIK ibu tidak boleh sama dengan NIK anak.';
    else if (kat === 'Balita' && v.ibu_nik && v.nik === v.ibu_nik) e.nik = 'NIK balita tidak boleh sama dengan NIK ibu.';
  }

  if (kat === 'Ibu Hamil') {
    var h = parseDMY(v.hpht);
    if (!v.hpht) e.hpht = 'HPHT wajib diisi.';
    else if (!h) e.hpht = 'Tulis tanggal lengkap dan benar, contoh 02/06/2026.';
    else if (h > today) e.hpht = 'HPHT tidak boleh setelah hari ini.';
    else if (h < t11) e.hpht = 'HPHT maksimal 11 bulan ke belakang (paling lama ' + fmtDMY(t11) + ').';
  }

  if (kat === 'Ibu Menyusui') {
    m = errNama(v.anak_nama, 'anak'); if (m) e.anak_nama = m;
    var at = parseDMY(v.anak_tgl);
    if (!v.anak_tgl) e.anak_tgl = 'Tanggal lahir anak wajib diisi.';
    else if (!at) e.anak_tgl = 'Tulis tanggal lengkap dan benar, contoh 01/01/2026.';
    else if (at > today) e.anak_tgl = 'Tanggal lahir anak tidak boleh setelah hari ini.';
    else if (at < t24) e.anak_tgl = 'Anak maksimal 2 tahun (paling lama lahir ' + fmtDMY(t24) + ').';
    else if (tgl && !e.tgl && at <= tgl) e.anak_tgl = 'Anak harus lahir setelah ibunya. Cek lagi tanggal lahir ibu dan anak.';
    m = errNik16(v.anak_nik, 'anak'); if (m) e.anak_nik = m;
    else if (v.anak_nik === v.nik) e.anak_nik = 'NIK anak tidak boleh sama dengan NIK ibu.';
  }

  if (kat === 'Balita') {
    m = errNama(v.ibu_nama, 'ibu'); if (m) e.ibu_nama = m;
    m = errNik16(v.ibu_nik, 'ibu'); if (m) e.ibu_nik = m;
    else if (v.ibu_nik === v.nik) e.ibu_nik = 'NIK ibu tidak boleh sama dengan NIK balita.';
  }
  return { errors: e, warnings: w };
}
/*VALIDASI-SELESAI*/
/* ---------- isi template resmi (XML) ---------- */
function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function colIdx(c) { var n = 0; for (var i = 0; i < c.length; i++) n = n * 26 + c.charCodeAt(i) - 64; return n; }

// kolom -> {gaya (s), jenis: 't' teks | 'n' angka}
var COLSTYLE = { A: 4, B: 9, C: 5, E: 6, F: 6, G: 5, H: 5, L: 9, M: 4, N: 6, O: 6, P: 9, Q: 4, R: 6, S: 6 };

function recordCells(rec) {
  var gender = rec.kategori === 'Balita' ? rec.gender : 'P';
  var tgl = parseDMY(rec.tgl);
  var nama = normNama(rec.nama);
  var c = {
    A: { t: nama }, B: { n: excelSerial(tgl) }, C: { t: gender }, E: { t: 'nik' }, F: { t: rec.nik },
    G: { t: 'POS' }, H: { t: 'POS - ' + rec.kategori }
  };
  if (rec.kategori === 'Ibu Hamil') c.L = { n: excelSerial(parseDMY(rec.hpht)) };
  if (rec.kategori === 'Ibu Menyusui') {
    c.M = { t: normNama(rec.anak_nama) }; c.N = { t: 'nik' }; c.O = { t: rec.anak_nik }; c.P = { n: excelSerial(parseDMY(rec.anak_tgl)) };
  }
  if (rec.kategori === 'Balita') {
    c.Q = { t: normNama(rec.ibu_nama) }; c.R = { t: 'nik' }; c.S = { t: rec.ibu_nik };
  }
  // nilai tersimpan untuk kolom rumus I, J, K (Excel menghitung ulang saat dibuka)
  var cached = { I: "'" + fmtDMY(tgl), J: KAT[rec.kategori].code, K: nama };
  return { cells: c, cached: cached };
}

function buildSheet(sheetXml, sstXml, records) {
  if (records.length > MAX_ROWS) throw new Error('Terlalu banyak data. Maksimal ' + MAX_ROWS + ' baris per file.');
  var sstMatch = /<sst\b[^>]*>/.exec(sstXml);
  var tag = sstMatch[0];
  var uniq = +/uniqueCount="(\d+)"/.exec(tag)[1];
  var count = +/\bcount="(\d+)"/.exec(tag)[1];
  var map = {}, newSi = '', refs = 0;
  function sidx(text) {
    refs++;
    if (!(text in map)) { map[text] = uniq++; newSi += '<si><t xml:space="preserve">' + xmlEsc(text) + '</t></si>'; }
    return map[text];
  }
  var out = sheetXml;
  for (var i = records.length - 1; i >= 0; i--) { // dari bawah supaya posisi teks tidak bergeser
    var r = 3 + i;
    var rc = recordCells(records[i]);
    var start = out.indexOf('<row r="' + r + '" ');
    var end = out.indexOf('</row>', start) + 6;
    if (start < 0 || end < 6) throw new Error('Baris ' + r + ' tidak ditemukan di template.');
    var rowXml = out.slice(start, end);
    var openTag = /^<row\b[^>]*>/.exec(rowXml)[0].replace(/\sspans="[^"]*"/, '');
    var existing = {};
    var re = /<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, m;
    while ((m = re.exec(rowXml))) existing[m[1]] = m[0];
    var cells = {};
    Object.keys(existing).forEach(function (k) { cells[k] = existing[k]; });
    Object.keys(rc.cells).forEach(function (k) {
      var cell = rc.cells[k], ref = k + r, s = COLSTYLE[k];
      cells[k] = ('t' in cell)
        ? '<c r="' + ref + '" s="' + s + '" t="s"><v>' + sidx(cell.t) + '</v></c>'
        : '<c r="' + ref + '" s="' + s + '"><v>' + cell.n + '</v></c>';
    });
    Object.keys(rc.cached).forEach(function (k) {
      var ex = cells[k];
      if (!ex) throw new Error('Sel rumus ' + k + r + ' tidak ada di template.');
      var val = xmlEsc(rc.cached[k]);
      if (/<v\s*\/>|<v><\/v>/.test(ex)) cells[k] = ex.replace(/<v\s*\/>|<v><\/v>/, '<v>' + val + '</v>');
      else cells[k] = ex.replace(/<v>[\s\S]*?<\/v>/, '<v>' + val + '</v>');
    });
    var body = Object.keys(cells).sort(function (a, b) { return colIdx(a) - colIdx(b); }).map(function (k) { return cells[k]; }).join('');
    out = out.slice(0, start) + openTag + body + '</row>' + out.slice(end);
  }
  var sst = sstXml.replace(tag, tag.replace(/uniqueCount="\d+"/, 'uniqueCount="' + uniq + '"').replace(/\bcount="\d+"/, 'count="' + (count + refs) + '"'))
                  .replace('</sst>', newSi + '</sst>');
  return { sheet: out, sst: sst };
}
function patchWorkbook(wbXml) {
  return wbXml.replace(/<calcPr\b([^>]*?)\/>/, function (m, a) { return /fullCalcOnLoad/.test(a) ? m : '<calcPr' + a + ' fullCalcOnLoad="1"/>'; });
}

return { KAT: KAT, FIELDS: FIELDS, MAX_ROWS: MAX_ROWS, pad2: pad2, parseDMY: parseDMY, fmtDMY: fmtDMY, todayUTC: todayUTC, edate: edate,
  excelSerial: excelSerial, maskDate: maskDate, normNama: normNama, nikSegment: nikSegment, validate: validate,
  buildSheet: buildSheet, patchWorkbook: patchWorkbook };
})();

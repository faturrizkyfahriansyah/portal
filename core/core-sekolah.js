// core-sekolah.js — aturan validasi, pembaca tempelan Excel, dan pembuat berkas Excel untuk pendataan SATUAN PENDIDIKAN (25 Nov 2026).
// Blok validasi di bawah adalah SALINAN IDENTIK dari PendataanSekolah.gs (server mengulang semua aturan). Kesamaannya diuji otomatis; jangan diubah sepihak.
// Format berkas keluaran = contoh Admin (DARUL UMMAH.xlsx): NISN/NIK, Nama Penerima, Tanggal Lahir, Jenis Kelamin ID (392 L / 64 P), Nama Orang Tua, Posisi, Status Menerima.
window.CoreSekolah = (function () {
var SEK = { POSISI: { '1': 'Siswa', '2': 'Guru', '3': 'Tendik' }, MAKS_TEMPEL: 300 };

function normNama(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function parseDMY(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
function umur(dt, today) {
  let a = today.getUTCFullYear() - dt.getUTCFullYear();
  const m = today.getUTCMonth() - dt.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dt.getUTCDate())) a--;
  return a;
}
/** v = {posisi,nomor,nama,tgl,gender,ortu,status}; today = Date UTC; opsi.padNol = lengkapi NISN 8-9 angka dengan nol (tempelan Excel). */
function validate(v, today, opsi) {
  const e = {}, b = {}; let perlu = false;
  const pos = String(v.posisi === undefined || v.posisi === null || v.posisi === '' ? '1' : v.posisi).trim();
  if (!SEK.POSISI[pos]) e.posisi = 'Pilih Siswa, Guru, atau Tendik.';
  b.posisi = pos;
  let nomor = String(v.nomor === undefined || v.nomor === null ? '' : v.nomor).replace(/\s+/g, '');
  if (!nomor) e.nomor = pos === '1' ? 'NISN wajib diisi (10 angka).' : 'NIK wajib diisi (16 angka).';
  else if (!/^\d+$/.test(nomor)) e.nomor = 'Hanya boleh angka.';
  else if (pos === '1') {
    if (nomor.length !== 10 && nomor.length !== 16) {
      if (opsi && opsi.padNol && nomor.length >= 8 && nomor.length < 10) { nomor = ('0000000000' + nomor).slice(-10); perlu = true; }
      else if (nomor.length < 10) e.nomor = 'NISN harus 10 angka. Sekarang baru ' + nomor.length + ' angka. Bila NISN diawali angka 0, ketik juga angka 0-nya.';
      else e.nomor = 'NISN harus 10 angka (atau NIK 16 angka bila belum punya NISN). Sekarang ' + nomor.length + ' angka.';
    }
  } else if (nomor.length !== 16) e.nomor = 'NIK harus 16 angka. Sekarang ' + nomor.length + ' angka.';
  b.nomor = nomor;
  const nama = normNama(v.nama);
  if (!nama) e.nama = 'Nama wajib diisi.';
  else if (!/^[A-Z' .-]+$/.test(nama)) e.nama = "Nama hanya boleh huruf, spasi, titik, tanda - dan '. Tanpa angka.";
  else if (nama.replace(/[^A-Z]/g, '').length < 2) e.nama = 'Nama terlalu pendek.';
  else if (nama.length > 100) e.nama = 'Nama terlalu panjang (maksimal 100 huruf).';
  b.nama = nama;
  const tglS = String(v.tgl || '').trim(), tgl = parseDMY(tglS);
  if (!tglS) e.tgl = 'Tanggal lahir wajib diisi.';
  else if (!tgl) e.tgl = 'Tulis tanggal lengkap dan benar, contoh 17/08/2010.';
  else if (tgl > today) e.tgl = 'Tanggal lahir tidak boleh setelah hari ini.';
  else if (SEK.POSISI[pos]) {
    const u = umur(tgl, today);
    if (pos === '1' && (u < 3 || u > 25)) e.tgl = 'Umur siswa ' + u + ' tahun tidak wajar (harus 3 sampai 25). Periksa tahun lahir.';
    else if (pos !== '1' && (u < 17 || u > 80)) e.tgl = 'Umur ' + u + ' tahun tidak wajar untuk guru/tendik (harus 17 sampai 80). Periksa tahun lahir.';
  }
  b.tgl = tglS;
  const g = String(v.gender || '').trim().toUpperCase();
  if (g !== 'L' && g !== 'P') e.gender = 'Pilih Laki-laki atau Perempuan.';
  b.gender = g;
  let ortu = normNama(v.ortu);
  if (!ortu && pos !== '1') ortu = '-';
  if (!ortu) e.ortu = 'Nama orang tua/wali wajib. Isi tanda - bila tidak ada.';
  else if (ortu !== '-') {
    if (!/^[A-Z' .-]+$/.test(ortu)) e.ortu = "Nama orang tua hanya boleh huruf, spasi, titik, tanda - dan '.";
    else if (ortu.replace(/[^A-Z]/g, '').length < 2) e.ortu = 'Nama orang tua terlalu pendek (atau isi tanda - bila tidak ada).';
    else if (ortu.length > 100) e.ortu = 'Nama orang tua terlalu panjang (maksimal 100 huruf).';
  }
  b.ortu = ortu;
  const st = String(v.status === undefined || v.status === null || v.status === '' ? 'true' : v.status).trim().toLowerCase();
  b.status = (st === 'false' || st === '0' || st === 'tidak') ? 'false' : 'true';
  return { errors: e, data: b, perluKonfirmasi: perlu };
}

/* ---------- tanggal & tempelan ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDMY(dt) { return pad2(dt.getUTCDate()) + '/' + pad2(dt.getUTCMonth() + 1) + '/' + dt.getUTCFullYear(); }
function todayUTC() { var n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
function excelSerial(dt) { return Math.round((dt.getTime() - Date.UTC(1899, 11, 30)) / 86400000); }
/** Ketikan angka saja -> DD/MM/YYYY otomatis (maks 8 angka). */
function maskDate(raw) {
  var d = String(raw || '').replace(/\D/g, '').slice(0, 8), o = d.slice(0, 2);
  if (d.length > 2) o += '/' + d.slice(2, 4); if (d.length > 4) o += '/' + d.slice(4, 8); return o;
}
/** Tanggal dari Excel: 17-08-2010, 17/08/2010, 17.08.2010, 2010-08-17, atau angka serial Excel -> DD/MM/YYYY (kosong bila tidak dikenali). */
function tglDariTempelan(s) {
  s = String(s == null ? '' : s).trim(); if (!s) return '';
  var m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(s); if (m) return pad2(+m[1]) + '/' + pad2(+m[2]) + '/' + m[3];
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s); if (m) return pad2(+m[3]) + '/' + pad2(+m[2]) + '/' + m[1];
  if (/^\d{5}$/.test(s)) { var dt = new Date(Date.UTC(1899, 11, 30) + (+s) * 86400000); return fmtDMY(dt); }
  return s;
}
function jkDariTempelan(s) {
  s = String(s == null ? '' : s).trim().toUpperCase();
  if (s === '392' || s === 'L' || s === 'LAKI-LAKI' || s === 'LAKI LAKI' || s === 'LAKI' || s === 'PRIA') return 'L';
  if (s === '64' || s === 'P' || s === 'PEREMPUAN' || s === 'WANITA') return 'P';
  return '';
}
/**
 * Teks tempelan dari Excel (kolom: NISN/NIK, Nama, Tanggal Lahir, Jenis Kelamin, Nama Orang Tua, [Posisi], [Status]) -> daftar baris.
 * Pemisah kolom: tab (hasil salin dari Excel); bila tidak ada tab dicoba titik koma. Baris judul dan baris petunjuk dilewati. Baris kosong diabaikan.
 */
function parseTempelan(teks, posisiBawaan) {
  var baris = String(teks || '').replace(/\r/g, '').split('\n'), hasil = [];
  baris.forEach(function (ln) {
    if (!ln.replace(/[\t; ]/g, '')) return;
    var sel = ln.indexOf('\t') >= 0 ? ln.split('\t') : (ln.indexOf(';') >= 0 ? ln.split(';') : [ln]);
    sel = sel.map(function (x) { return x.replace(/^"+|"+$/g, '').trim(); });
    var a = (sel[0] || '').toUpperCase();
    if (/^NISN/.test(a) || /^NISN \(/.test(a) || /DIGIT\)/.test(a)) return;           // judul/petunjuk template
    var pos = sel[5] === undefined || sel[5] === '' ? String(posisiBawaan || '1') : String(sel[5]).replace(/\.0+$/, '');
    hasil.push({ nomor: sel[0] || '', nama: sel[1] || '', tgl: tglDariTempelan(sel[2]), gender: jkDariTempelan(sel[3]), ortu: sel[4] || '', posisi: pos, status: sel[6] === undefined || sel[6] === '' ? 'true' : String(sel[6]).toLowerCase() });
  });
  return hasil;
}

/* ---------- pembuat berkas Excel (mengedit template asli) ---------- */
var MAX_ROWS = 9998;
function xmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
/** records = [{nomor,nama,tgl(DD/MM/YYYY),gender,ortu,posisi,status(boolean)}] -> { sheet, sst } (teks lembar & sharedStrings baru). Baris 1-2 (judul & petunjuk) dipertahankan; data mulai baris 3. */
function buildSheet(sheetXml, sstXml, records) {
  if (records.length > MAX_ROWS) throw new Error('Terlalu banyak data. Maksimal ' + MAX_ROWS + ' baris per file.');
  var tag = /<sst\b[^>]*>/.exec(sstXml)[0], uniq = +/uniqueCount="(\d+)"/.exec(tag)[1], count = +/\bcount="(\d+)"/.exec(tag)[1], map = {}, baru = '', refs = 0;
  function sidx(t) { refs++; if (!(t in map)) { map[t] = uniq++; baru += '<si><t xml:space="preserve">' + xmlEsc(t) + '</t></si>'; } return map[t]; }
  var rows = '';
  records.forEach(function (r, i) {
    var n = 3 + i, tgl = parseDMY(r.tgl);
    rows += '<row r="' + n + '">'
      + '<c r="A' + n + '" s="14" t="s"><v>' + sidx(String(r.nomor)) + '</v></c>'
      + '<c r="B' + n + '" s="15" t="s"><v>' + sidx(normNama(r.nama)) + '</v></c>'
      + '<c r="C' + n + '" s="16"><v>' + excelSerial(tgl) + '</v></c>'
      + '<c r="D' + n + '" s="14"><v>' + (r.gender === 'L' ? 392 : 64) + '</v></c>'
      + '<c r="E' + n + '" s="14" t="s"><v>' + sidx(normNama(r.ortu) || '-') + '</v></c>'
      + '<c r="F' + n + '" s="17"><v>' + Number(r.posisi) + '</v></c>'
      + '<c r="G' + n + '" s="18" t="s"><v>' + sidx(r.status ? 'true' : 'false') + '</v></c></row>';
  });
  var out = sheetXml.replace(/<row r="(?:[3-9]|\d{2,})"[\s\S]*?<\/row>/g, '').replace(/<row r="(?:[3-9]|\d{2,})"[^>]*\/>/g, '');
  out = out.replace('</sheetData>', rows + '</sheetData>').replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:G' + (2 + Math.max(records.length, 0)) + '"/>');
  var sst = sstXml.replace(tag, tag.replace(/uniqueCount="\d+"/, 'uniqueCount="' + uniq + '"').replace(/\bcount="\d+"/, 'count="' + (count + refs) + '"')).replace('</sst>', baru + '</sst>');
  return { sheet: out, sst: sst };
}

function patchWorkbook(wbXml) {
  return wbXml.replace(/<calcPr\b([^>]*?)\/>/, function (m, a) { return /fullCalcOnLoad/.test(a) ? m : '<calcPr' + a + ' fullCalcOnLoad="1"/>'; });
}

return { SEK: SEK, patchWorkbook: patchWorkbook, MAX_ROWS: MAX_ROWS, validate: validate, normNama: normNama, parseDMY: parseDMY, fmtDMY: fmtDMY, todayUTC: todayUTC, maskDate: maskDate, parseTempelan: parseTempelan,
  tglDariTempelan: tglDariTempelan, jkDariTempelan: jkDariTempelan, buildSheet: buildSheet, excelSerial: excelSerial };
})();

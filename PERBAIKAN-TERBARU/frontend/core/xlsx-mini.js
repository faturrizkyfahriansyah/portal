/* xlsx-mini.js — pembuat berkas Excel (.xlsx) asli, TANPA pustaka luar (BARU 4 Nov 2026).
 * Mengganti ekspor CSV yang berantakan di Excel berbahasa Indonesia (pemisah koma tidak dikenali -> semua masuk kolom A).
 * Fitur: banyak lembar, lebar kolom, warna sel, huruf tebal, border, format Rupiah, sel gabung, beku panel, filter, cetak lanskap.
 * Teks disimpan sebagai TEKS (nomor rekening tidak menjadi notasi ilmiah). Berkas ZIP tanpa kompresi (store) -> sederhana & kompatibel.
 * Pakai:  Xlsx.unduh('nama.xlsx', { lembar: [ { nama, kolom:[lebar...], baris:[[sel,...],...], bekuBaris, bekuKolom, gabung:['A1:E1'], filter:'A2:E9' } ] })
 * sel = null | angka | teks | { v:nilai, s:{ f:'b|bw|t|i', fl:'#RRGGBB', b:1, n:'rp|int', h:'center|left|right', w:1 } } */
(function (root) {
  'use strict';
  var enc = new TextEncoder();
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function esc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function kolomHuruf(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function u16(v) { return [v & 255, (v >>> 8) & 255]; } function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
  function zip(berkas) {
    var bagian = [], pusat = [], offset = 0, tgl = ((2026 - 1980) << 9) | (1 << 5) | 1;
    berkas.forEach(function (b) {
      var nama = enc.encode(b.nama), data = enc.encode(b.isi), crc = crc32(data);
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(tgl), u32(crc), u32(data.length), u32(data.length), u16(nama.length), u16(0));
      bagian.push(new Uint8Array(lh), nama, data);
      pusat.push({ nama: nama, crc: crc, ukuran: data.length, offset: offset });
      offset += lh.length + nama.length + data.length;
    });
    var awalPusat = offset, ukuranPusat = 0;
    pusat.forEach(function (p) {
      var ch = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(tgl), u32(p.crc), u32(p.ukuran), u32(p.ukuran), u16(p.nama.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(p.offset));
      bagian.push(new Uint8Array(ch), p.nama); ukuranPusat += ch.length + p.nama.length;
    });
    bagian.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(pusat.length), u16(pusat.length), u32(ukuranPusat), u32(awalPusat), u16(0))));
    var total = bagian.reduce(function (s, x) { return s + x.length; }, 0), out = new Uint8Array(total), pos = 0;
    bagian.forEach(function (x) { out.set(x, pos); pos += x.length; });
    return out;
  }
  function buat(opsi) {
    // ---- registri gaya ----
    var fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    var borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>', '<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>'];
    var xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], peta = {};
    function cari(arr, x) { var i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; }
    function gaya(s) {
      if (!s) return 0;
      var kunci = JSON.stringify(s); if (peta[kunci] !== undefined) return peta[kunci];
      var warnaTeks = s.f === 'bw' ? '<color rgb="FFFFFFFF"/>' : (s.tw ? '<color rgb="FF' + String(s.tw).replace('#', '') + '"/>' : '');
      var f = '<font>' + ((s.f === 'b' || s.f === 'bw') ? '<b/>' : '') + (s.f === 'i' ? '<i/>' : '') + '<sz val="' + (s.z || 11) + '"/>' + warnaTeks + '<name val="Calibri"/></font>';
      var fl = s.fl ? '<fill><patternFill patternType="solid"><fgColor rgb="FF' + String(s.fl).replace('#', '') + '"/><bgColor indexed="64"/></patternFill></fill>' : null;
      var nf = s.n === 'rp' ? 164 : (s.n === 'int' ? 3 : 0);
      var al = (s.h || s.v || s.w) ? '<alignment' + (s.h ? ' horizontal="' + s.h + '"' : '') + ' vertical="' + (s.v || 'center') + '"' + (s.w ? ' wrapText="1"' : '') + '/>' : '';
      var xf = '<xf numFmtId="' + nf + '" fontId="' + cari(fonts, f) + '" fillId="' + (fl ? cari(fills, fl) : 0) + '" borderId="' + (s.b ? 1 : 0) + '" xfId="0"' + (nf ? ' applyNumberFormat="1"' : '') + ' applyFont="1" applyFill="1" applyBorder="1"' + (al ? ' applyAlignment="1">' + al + '</xf>' : '/>');
      xfs.push(xf); peta[kunci] = xfs.length - 1; return peta[kunci];
    }
    var lembar = opsi.lembar, sheetXml = [];
    lembar.forEach(function (L, idx) {
      var baris = L.baris || [], maxKol = 0, rows = [];
      baris.forEach(function (r, i) {
        var sel = [], tinggi = (L.tinggiBaris && L.tinggiBaris[i + 1]) ? ' ht="' + L.tinggiBaris[i + 1] + '" customHeight="1"' : '';
        r.forEach(function (c, j) {
          if (c === null || c === undefined || c === '') { if (!(c && c.s)) return; }
          var v = c, s = null; if (c !== null && typeof c === 'object') { v = c.v; s = c.s; }
          var ref = kolomHuruf(j) + (i + 1), st = gaya(s), sa = st ? ' s="' + st + '"' : ''; if (j + 1 > maxKol) maxKol = j + 1;
          if (v === null || v === undefined || v === '') sel.push('<c r="' + ref + '"' + sa + '/>');
          else if (typeof v === 'number' && isFinite(v)) sel.push('<c r="' + ref + '"' + sa + '><v>' + v + '</v></c>');
          else sel.push('<c r="' + ref + '"' + sa + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>');
        });
        rows.push('<row r="' + (i + 1) + '"' + tinggi + '>' + sel.join('') + '</row>');
      });
      var bb = L.bekuBaris || 0, bk = L.bekuKolom || 0, pane = '';
      if (bb || bk) pane = '<sheetViews><sheetView workbookViewId="0"><pane' + (bk ? ' xSplit="' + bk + '"' : '') + (bb ? ' ySplit="' + bb + '"' : '') + ' topLeftCell="' + kolomHuruf(bk) + (bb + 1) + '" activePane="' + (bb && bk ? 'bottomRight' : (bb ? 'bottomLeft' : 'topRight')) + '" state="frozen"/></sheetView></sheetViews>';
      else pane = '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
      var cols = (L.kolom && L.kolom.length) ? '<cols>' + L.kolom.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '';
      var gabung = (L.gabung && L.gabung.length) ? '<mergeCells count="' + L.gabung.length + '">' + L.gabung.map(function (g) { return '<mergeCell ref="' + g + '"/>'; }).join('') + '</mergeCells>' : '';
      var filter = L.filter ? '<autoFilter ref="' + L.filter + '"/>' : '';
      sheetXml.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' + pane + '<sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + rows.join('') + '</sheetData>' + filter + gabung + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>');
    });
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp&quot;#,##0"/></numFmts><fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts><fills count="' + fills.length + '">' + fills.join('') + '</fills><borders count="' + borders.length + '">' + borders.join('') + '</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    var nama = lembar.map(function (L, i) { return '<sheet name="' + esc(String(L.nama || 'Sheet' + (i + 1)).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('');
    var dn = lembar.map(function (L, i) { return L.filter ? '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + String(L.nama || 'Sheet' + (i + 1)).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31).replace(/'/g, "''") + '\'!' + L.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2') + '</definedName>' : ''; }).join('');
    var berkas = [
      { nama: '[Content_Types].xml', isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + lembar.map(function (L, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { nama: '_rels/.rels', isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nama: 'xl/workbook.xml', isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + nama + '</sheets>' + (dn ? '<definedNames>' + dn + '</definedNames>' : '') + '</workbook>' },
      { nama: 'xl/_rels/workbook.xml.rels', isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + lembar.map(function (L, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (lembar.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nama: 'xl/styles.xml', isi: styles }
    ];
    sheetXml.forEach(function (x, i) { berkas.push({ nama: 'xl/worksheets/sheet' + (i + 1) + '.xml', isi: x }); });
    return zip(berkas);
  }
  function unduh(namaBerkas, opsi) {
    var blob = new Blob([buat(opsi)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = namaBerkas; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  /** Pembantu: satu tabel rapi (judul, kepala biru, baris, baris total). kolom = [{ judul, lebar, tipe:'teks'|'angka'|'rp'|'tengah' }], baris = [[nilai,...]], total = [nilai,...] (opsional). */
  function unduhTabel(namaBerkas, o) {
    var kep = { f: 'bw', fl: '1F3864', b: 1, h: 'center', w: 1 }, n = o.kolom.length;
    var gayaTipe = function (t, tebal) { var s = { b: 1 }; if (t === 'rp') s.n = 'rp'; else if (t === 'angka') s.n = 'int'; else if (t === 'tengah') s.h = 'center'; if (tebal) { s.f = 'b'; s.fl = 'E8EDF5'; } return s; };
    var isi = o.baris.map(function (r) { return r.map(function (v, i) { return { v: v, s: gayaTipe(o.kolom[i].tipe) }; }); });
    var baris = [[{ v: o.judul || '', s: { f: 'b', z: 14 } }], o.kolom.map(function (k) { return { v: k.judul, s: kep }; })].concat(isi);
    if (o.total) baris.push(o.total.map(function (v, i) { return { v: v, s: gayaTipe(o.kolom[i].tipe, true) }; }));
    unduh(namaBerkas, { lembar: [{ nama: o.nama || 'Data', kolom: o.kolom.map(function (k) { return k.lebar || 14; }), tinggiBaris: { 1: 24, 2: 30 }, bekuBaris: 2, gabung: n > 1 ? ['A1:' + kolomHuruf(n - 1) + '1'] : [], filter: 'A2:' + kolomHuruf(n - 1) + (isi.length + 2), baris: baris }] });
  }
  /** Pembantu paling sederhana (pengganti CSV): rows[0] = kepala, sisanya data. Lebar kolom otomatis; angka tetap angka, teks (mis. nomor rekening) tetap teks. */
  function unduhDaftar(namaBerkas, rows, o) {
    o = o || {}; var n = rows[0].length, kep = { f: 'bw', fl: '1F3864', b: 1, h: 'center', w: 1 };
    var lebar = rows[0].map(function (_, j) { var m = 6; rows.forEach(function (r, i) { var v = r[j], len = (v === null || v === undefined) ? 0 : String(v).length; if (i === 0) len = Math.ceil(len * 1.1) + 2; if (len > m) m = len; }); return Math.min(46, m + 2); });
    var baris = rows.map(function (r, i) { return r.map(function (v) { if (i === 0) return { v: v, s: kep }; return (v === null || v === undefined) ? '' : { v: v, s: { b: 1 } }; }); });
    unduh(namaBerkas, { lembar: [{ nama: o.nama || 'Data', kolom: lebar, bekuBaris: 1, tinggiBaris: { 1: 28 }, filter: rows.length > 1 ? 'A1:' + kolomHuruf(n - 1) + rows.length : null, baris: baris }] });
  }
  var api = { buat: buat, unduh: unduh, unduhTabel: unduhTabel, unduhDaftar: unduhDaftar, kolomHuruf: kolomHuruf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Xlsx = api;
})(typeof window !== 'undefined' ? window : this);

/**
 * DocBuilder.gs — Mesin penggabung dokumen (fungsi murni, tanpa API Google; dapat diuji di Node).
 *
 * File template master berisi DUA lembar contoh yang dipisah page-break:
 *   - lembar SEKOLAH  : memuat {{PORSI_KECIL}} (+ {{PORSI_BESAR}}, {{TENAGA_PENDIDIK}})
 *   - lembar POSYANDU : memuat {{BALITA}}      (+ {{BUMIL}}, {{BUSUI}})
 * Jenis lembar dikenali dari placeholder, bukan dari urutan. Untuk N PM, lembar yang sesuai
 * dengan jenis PM digandakan => 1 PM = 1 halaman, semua PM satu tanggal dalam SATU document.xml.
 *
 * ATURAN: Nama/No. Telp penerima ("Diterima oleh") harus kosong/manual. Karena itu data PIC
 * TIDAK PERNAH diberikan ke template, dan template yang memakai {{NAMA_PIC}}/{{NO_HP_PIC}} ditolak.
 */
var DocBuilder = (function () {

  var PAGE_SEP = '<w:p><w:pPr><w:pageBreakBefore/></w:pPr></w:p>';
  // paragraf kosong ber-pageBreakBefore (toleran terhadap atribut rsid/paraId hasil simpan Word)
  var SEP_RE = /<w:p(?: [^>]*)?><w:pPr><w:pageBreakBefore\/>(?:<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr>)?<\/w:pPr><\/w:p>/;

  var JENIS_MARKER = { SEKOLAH: 'PORSI_KECIL', POSYANDU: 'BALITA' };
  var REQUIRED = ['NOMOR_BAST', 'HARI', 'TANGGAL', 'NAMA_PM', 'TOTAL'];
  var REQUIRED_KATEGORI = {
    SEKOLAH: ['PORSI_KECIL', 'PORSI_BESAR', 'TENAGA_PENDIDIK'],
    POSYANDU: ['BALITA', 'BUMIL', 'BUSUI']
  };
  var FORBIDDEN = ['NAMA_PIC', 'NO_HP_PIC', 'NOMOR_HP', 'JABATAN_PIC', 'NOMOR_REKENING'];

  function escapeXml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  /** Gabungkan placeholder yang terpecah antar-<w:r> menjadi token {{NAMA}} utuh. */
  function normalizePlaceholders(xml) {
    var re = /\{(?:<[^>]*>)*\{((?:[^{}<]|<[^>]*>)*?)\}(?:<[^>]*>)*\}/g;
    return xml.replace(re, function (all, inner) {
      return '{{' + inner.replace(/<[^>]*>/g, '').replace(/\s+/g, '') + '}}';
    });
  }

  function placeholdersOf(xml) {
    var found = {}, m, re = /\{\{([A-Z0-9_]+)\}\}/g;
    while ((m = re.exec(xml)) !== null) found[m[1]] = true;
    return Object.keys(found);
  }

  /** Pecah document.xml -> {head, tail, sheets: {SEKOLAH: xml, POSYANDU: xml}, unknown: n}. */
  function parse(docXml) {
    var xml = normalizePlaceholders(docXml);
    var b = xml.indexOf('<w:body>');
    if (b < 0) throw new Error('Template tidak valid: <w:body> tidak ditemukan.');
    var bodyStart = b + '<w:body>'.length;
    var sectIdx = xml.lastIndexOf('<w:sectPr');
    if (sectIdx < bodyStart) throw new Error('Template tidak valid: sectPr tidak ditemukan.');
    var body = xml.substring(bodyStart, sectIdx), sheets = {}, unknown = 0, rest = body, m;
    var gre = new RegExp(SEP_RE.source, 'g'), parts = [], last = 0;
    while ((m = gre.exec(body)) !== null) { parts.push(body.substring(last, m.index)); last = m.index + m[0].length; }
    parts.push(body.substring(last));
    parts.forEach(function (p) {
      var kind = null;
      Object.keys(JENIS_MARKER).forEach(function (j) { if (p.indexOf('{{' + JENIS_MARKER[j] + '}}') >= 0) kind = j; });
      if (kind && !sheets[kind]) sheets[kind] = p; else if (!kind) unknown++;
    });
    return { head: xml.substring(0, bodyStart), tail: xml.substring(sectIdx), sheets: sheets, unknown: unknown };
  }

  /** Daftar masalah template (array string; kosong = valid). */
  function checkTemplate(docXml) {
    var probs = [], t;
    try { t = parse(docXml); } catch (e) { return [e.message]; }
    Object.keys(JENIS_MARKER).forEach(function (j) {
      if (!t.sheets[j]) { probs.push('Lembar template ' + j + ' tidak ditemukan (harus memuat {{' + JENIS_MARKER[j] + '}}).'); return; }
      var have = placeholdersOf(t.sheets[j]);
      var miss = REQUIRED.concat(REQUIRED_KATEGORI[j]).filter(function (p) { return have.indexOf(p) < 0; });
      if (miss.length) probs.push('Template ' + j + ' kehilangan placeholder: {{' + miss.join('}}, {{') + '}}.');
      var bad = have.filter(function (p) { return FORBIDDEN.indexOf(p) >= 0; });
      if (bad.length) probs.push('Template ' + j + ' memakai {{' + bad.join('}}, {{') + '}} — dilarang: Nama/No. Telp penerima harus kosong/manual.');
    });
    return probs;
  }

  function jenisTersedia(docXml) { var t = parse(docXml); return Object.keys(t.sheets); }
  function findPlaceholders(docXml) { return placeholdersOf(normalizePlaceholders(docXml)); }

  function fillSheet(sheetXml, values) {
    return sheetXml.replace(/\{\{([A-Z0-9_]+)\}\}/g, function (all, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? escapeXml(values[key]) : '';
    });
  }

  function makeUnique(xml, counter) {
    xml = xml.replace(/<wp:docPr id="\d+"/g, function () { return '<wp:docPr id="' + (++counter.n) + '"'; });
    return xml.replace(/ w14:paraId="[0-9A-Fa-f]+"/g, '').replace(/ w14:textId="[0-9A-Fa-f]+"/g, '')
      .replace(/ wp14:anchorId="[0-9A-Fa-f]+"/g, '').replace(/ wp14:editId="[0-9A-Fa-f]+"/g, '');
  }

  /**
   * BARU 29 Okt 2026 (dilaporkan Admin -- di dokumen gabungan BANYAK PM
   * 1 file, "ada PM yg tanda tangannya hilang, ada yg geser ke lembar
   * berikutnya"). FUNGSI TERPISAH, BUKAN mengubah makeUnique di atas --
   * supaya Dokumen.gs (fitur lama, pakai buildBundleXml+makeUnique)
   * SAMA SEKALI tidak tersentuh/berisiko kena dampak.
   *
   * Akar masalah diaudit: SEMUA salinan gambar stempel (1 PM = 2
   * kemunculan, BAST+SJ) berbagi SATU r:embed (relationship ID) yg SAMA
   * -- bahkan dlm 1 lembar template tunggal, rId gambar stempel dipakai
   * ulang 4x. Saat digabung BANYAK PM (gabungkanBanyakPm_, BastSj.gs),
   * satu rId yg SAMA bisa dirujuk oleh PULUHAN <w:drawing> anchored
   * (floating) di SATU dokumen -- pola ini scr teknis diizinkan OOXML,
   * tapi TERBUKTI tidak stabil di rendering sebagian kasus (stempel
   * hilang/salah lembar utk PM tertentu).
   *
   * Fungsi ini memberi SETIAP kemunculan r:embed ID BARU yg genuinely
   * unik (bukan dipakai ulang), dicatat di petaRelasiBaru supaya
   * caller bisa menambahkan baris <Relationship> baru yg sepadan ke
   * document.xml.rels (menunjuk file gambar YANG SAMA, cuma ID beda).
   * @param {Object} petaRelasiBaru diisi {ridBaru: ridAsli, ...} -- caller WAJIB proses ini stlh pemanggilan.
   */
  function makeUniqueDenganGambar_(xml, counter, petaRelasiBaru) {
    xml = xml.replace(/<wp:docPr id="\d+"/g, function () { return '<wp:docPr id="' + (++counter.n) + '"'; });
    xml = xml.replace(/r:embed="(rId\d+)"/g, function (semua, ridAsli) {
      var ridBaru = 'rImgGab' + (++counter.n);
      petaRelasiBaru[ridBaru] = ridAsli;
      return 'r:embed="' + ridBaru + '"';
    });
    return xml.replace(/ w14:paraId="[0-9A-Fa-f]+"/g, '').replace(/ w14:textId="[0-9A-Fa-f]+"/g, '')
      .replace(/ wp14:anchorId="[0-9A-Fa-f]+"/g, '').replace(/ wp14:editId="[0-9A-Fa-f]+"/g, '');
  }

  /**
   * @param {string} templateDocXml  isi word/document.xml template master
   * @param {Array<Object>} rows     satu objek per PM; wajib ada JENIS_PM ('SEKOLAH'|'POSYANDU')
   */
  function buildBundleXml(templateDocXml, rows) {
    if (!rows || !rows.length) throw new Error('Tidak ada data PM untuk dibuat dokumennya.');
    var t = parse(templateDocXml), counter = { n: 100 };
    var sheets = rows.map(function (vals) {
      var tpl = t.sheets[vals.JENIS_PM];
      if (!tpl) throw new Error('Template untuk jenis PM "' + vals.JENIS_PM + '" tidak tersedia.');
      var safe = {};
      Object.keys(vals).forEach(function (k) { if (FORBIDDEN.indexOf(k) < 0) safe[k] = vals[k]; });   // PIC tidak pernah masuk dokumen
      return makeUnique(fillSheet(tpl, safe), counter);
    });
    return t.head + sheets.join(PAGE_SEP) + t.tail;
  }

  return {
    escapeXml: escapeXml, normalizePlaceholders: normalizePlaceholders, parse: parse, checkTemplate: checkTemplate,
    jenisTersedia: jenisTersedia, findPlaceholders: findPlaceholders, buildBundleXml: buildBundleXml,
    REQUIRED: REQUIRED, FORBIDDEN: FORBIDDEN,
    // Diekspos 25 Okt 2026 (dipakai BastSj.gs -- template BAST+SJ TIDAK
    // pakai page-break antar lembar spt template Dokumen Penerimaan,
    // jadi BastSj.gs punya pemisah lembar SENDIRI, tapi tetap memakai
    // ULANG fillSheet/makeUnique drpd menulis ulang logika isi-placeholder.
    // PENAMBAHAN MURNI -- tidak mengubah fungsi/perilaku apa pun di atas,
    // AMAN utk fitur Dokumen Penerimaan yang sudah berjalan.
    fillSheet: fillSheet, makeUnique: makeUnique,
    // Diekspos 29 Okt 2026 (dipakai BastSj.gs -- perbaikan tanda tangan
    // hilang/geser di dokumen gabungan banyak PM, lihat catatan di atas
    // fungsi ini). PENAMBAHAN MURNI, tidak mengubah apa pun yg sudah ada.
    makeUniqueDenganGambar_: makeUniqueDenganGambar_
  };
})();


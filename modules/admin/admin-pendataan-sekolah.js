// SPPG JEUNGJING — SIPIKA: Pendataan satuan pendidikan (Admin, 25 Nov 2026). Dimuat oleh admin-pendataan-3b.js ke tab "Satuan pendidikan" pada halaman Pendataan BNBA.
// Lihat/hapus data yang diisi PIC sekolah dan UNDUH file Excel berformat contoh (DARUL UMMAH), dibuat di browser dari template + data server.
// Data berisi NISN/NIK: hanya Admin (Staff ditolak server). Unduhan dicatat di server (siapa, kapan, berapa baris).
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const panel = $('panelPendataan3B'); if (!panel || $('skAdmin')) return;
  const C = window.CoreSekolah; if (!C) return;
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: window.sppgAdminToken }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  const TPL = 'assets/mpm/template-import-penerima-manfaat-sekolah.xlsx';
  const POS = { 1: 'Siswa', 2: 'Guru', 3: 'Tendik' };
  let data = null, sibuk = false;

  const root = document.createElement('div'); root.id = 'skAdmin';
  root.innerHTML = '<p class="bb-d" style="margin:0 0 10px">Data siswa, guru, dan tendik per satuan pendidikan, diisi PIC lewat Portal PIC, lalu diunduh sebagai file Excel berformat contoh. <b>Berisi NISN/NIK: jangan dibagikan.</b></p>'
    + '<div id="skDaftar"></div><div id="skData"></div>';
  ($('bnSek') || panel).appendChild(root);

  async function muat() {
    $('skDaftar').innerHTML = '<p class="pg-sub">Memuat…</p>';
    try { data = await api('getDaftarSekolah3BAdmin'); } catch (e) { $('skDaftar').innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    if (window.bnRingkasSekolah) window.bnRingkasSekolah(data.sekolah);
    gambar();
  }
  function gambar() {
    const el = $('skDaftar');
    if (!data.sekolah.length) { el.innerHTML = '<div class="bb-kosong">Belum ada satuan pendidikan aktif di SIPANDU.</div>'; return; }
    const ang = function (n) { return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    let h = '<div class="bb-aksi" style="margin:0 0 10px"><button type="button" class="btn-mini primary" id="skSemua">Unduh semua satuan pendidikan</button></div><div class="bb-grid">';
    data.sekolah.forEach(function (s) {
      const j = s.jumlah, t = s.target || 0, pr = t > 0 ? Math.min(100, Math.round(j.siswa * 100 / t)) : 0, lengkap = t > 0 && j.siswa >= t;
      h += '<div class="bb-i" data-sk="' + esc(s.id) + '"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><h4>' + esc(s.nama) + '</h4><small>' + esc(s.jenis) + '</small></div>'
        + (t <= 0 ? '<span class="pg-status pg-kosong">Target belum diatur</span>' : lengkap ? '<span class="pg-status pg-ok">Lengkap</span>' : '<span class="pg-status pg-wait">Kurang ' + ang(t - j.siswa) + '</span>') + '</div>'
        + '<div><b style="font-size:20px">' + ang(j.siswa) + '</b> <small>siswa' + (t ? ' dari ' + ang(t) + ' · ' + pr + '%' : '') + '</small></div>'
        + (t ? '<div class="bb-bar' + (lengkap ? ' ok' : '') + '"><i style="width:' + pr + '%"></i></div>' : '')
        + '<div class="bb-cp"><span>Guru ' + j.guru + '</span><span>Tendik ' + j.tendik + '</span></div>'
        + '<small>' + (j.perluKonfirmasi ? '<b>' + j.perluKonfirmasi + ' NISN menunggu konfirmasi PIC</b>' : 'tidak ada yang tertunda') + '</small>'
        + '<details><summary>PIC dan password (' + (s.picDetail || []).length + ')</summary><div style="margin-top:6px">' + ((s.picDetail || []).length && window.bnBarisPic ? s.picDetail.map(window.bnBarisPic).join('') : '<small>Belum ada PIC di SIPANDU.</small>') + '</div></details>'
        + '<div class="bb-aksi"><button type="button" class="btn-mini" data-lihat="' + esc(s.id) + '">Lihat data</button><button type="button" class="btn-mini primary" data-unduh="' + esc(s.id) + '"' + (j.total ? '' : ' disabled') + '>Unduh Excel</button></div></div>';
    });
    el.innerHTML = h + '</div>';
    if (window.bnPasangPassword) window.bnPasangPassword(el, muat);
    $('skSemua').addEventListener('click', function () { unduh(null); });
    el.querySelectorAll('[data-unduh]').forEach(function (b) { b.addEventListener('click', function () { unduh(b.dataset.unduh); }); });
    el.querySelectorAll('[data-lihat]').forEach(function (b) { b.addEventListener('click', function () { lihat(b.dataset.lihat); }); });
  }
  async function lihat(idi) {
    const el = $('skData'); el.innerHTML = '<p class="pg-sub">Memuat data…</p>';
    let d; try { d = await api('getLihatSekolah3BAdmin', { idInstansi: idi }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    el.innerHTML = '<div class="bb-kartu" style="margin-top:14px"><h3>Data ' + esc(d.instansi.nama) + ' (' + d.items.length + ')</h3><div style="margin-top:8px">' + (d.items.length ? '<div class="table-wrap"><table class="rmg-tabel" id="skTabel"><thead><tr><th>Posisi</th><th>NISN/NIK</th><th>Nama</th><th>Lahir</th><th>JK</th><th>Orang tua</th><th>Status</th><th></th></tr></thead><tbody>' + d.items.map(function (x) {
      return '<tr><td>' + esc(x.posisiNama) + '</td><td>' + esc(x.nomor) + (x.perluKonfirmasi ? ' <b>(menunggu konfirmasi)</b>' : '') + '</td><td>' + esc(x.nama) + '</td><td>' + esc(x.tgl) + '</td><td>' + esc(x.gender) + '</td><td>' + esc(x.ortu) + '</td><td>' + (x.status ? 'menerima' : 'tidak menerima') + '</td><td><button type="button" class="btn-mini" data-hapus="' + esc(x.id) + '">Hapus</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="pg-sub">Belum ada data.</p>') + '</div></div>';
    el.querySelectorAll('[data-hapus]').forEach(function (b) { b.addEventListener('click', async function () { if (!confirm('Hapus data ini? (Dihapus dari daftar dan tidak ikut diunduh.)')) return;
      try { await api('hapusSekolah3BAdmin', { idRekam: b.dataset.hapus }); info('Dihapus.'); } catch (e) { lapor(e.message); } lihat(idi); muat(); }); });
  }

  /* ---------- unduh ---------- */
  function muatJsZip() {
    if (window.JSZip) return Promise.resolve();
    return new Promise(function (ok, gagal) { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = ok; s.onerror = function () { gagal(new Error('Alat pembuat file Excel gagal dimuat. Periksa koneksi internet.')); }; document.head.appendChild(s); });
  }
  async function buatXlsx(records) {
    const buf = await (await fetch(TPL + '?v=20261125b')).arrayBuffer();
    const zip = await window.JSZip.loadAsync(buf, { createFolders: false });
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string'), sst = await zip.file('xl/sharedStrings.xml').async('string'), wb = await zip.file('xl/workbook.xml').async('string');
    const out = C.buildSheet(sheet, sst, records), op = { createFolders: false };
    zip.file('xl/worksheets/sheet1.xml', out.sheet, op); zip.file('xl/sharedStrings.xml', out.sst, op); zip.file('xl/workbook.xml', C.patchWorkbook(wb), op);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  async function sha(bytes) { try { const h = await crypto.subtle.digest('SHA-256', bytes); return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); } catch (e) { return ''; } }
  function simpanBerkas(nama, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const aman = function (s) { return String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  async function unduh(idi) {
    if (sibuk) return; sibuk = true;
    try {
      await muatJsZip();
      const d = await api('getDataEksporSekolah3BAdmin', idi ? { idInstansi: idi } : {}), tgl = d.tanggal.replace(/-/g, '');
      const berkas = [], kecuali = [];
      for (let i = 0; i < d.sekolah.length; i++) {
        const s = d.sekolah[i]; s.dikecualikan.forEach(function (x) { kecuali.push(s.nama + ': ' + x.nama + ' — ' + x.alasan); });
        for (let o = 0, n = 1; o < s.records.length; o += d.maksBaris, n++) {
          const bagian = s.records.slice(o, o + d.maksBaris), bytes = await buatXlsx(bagian);
          berkas.push({ idInstansi: s.idInstansi, nama: 'Import-Sekolah-' + aman(s.nama) + '-' + tgl + (s.records.length > d.maksBaris ? '-' + n : '') + '.xlsx', bytes: bytes, jumlah: bagian.length });
        }
      }
      if (!berkas.length) { lapor('Tidak ada data yang bisa diunduh.' + (kecuali.length ? ' Semua data perlu diperiksa dulu.' : '')); sibuk = false; return; }
      if (berkas.length === 1) simpanBerkas(berkas[0].nama, new Blob([berkas[0].bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      else { const z = new window.JSZip(); berkas.forEach(function (b) { z.file(b.nama, b.bytes); }); simpanBerkas('Import-Sekolah-Semua-' + tgl + '.zip', await z.generateAsync({ type: 'blob', compression: 'STORE' })); }
      for (let i = 0; i < berkas.length; i++) { try { await api('catatEksporSekolah3BAdmin', { idInstansi: berkas[i].idInstansi, namaFile: berkas[i].nama, jumlahBaris: berkas[i].jumlah, checksum: await sha(berkas[i].bytes) }); } catch (e) { /* catatan gagal tidak membatalkan unduhan */ } }
      info(berkas.length + ' file siap.' + (kecuali.length ? ' ' + kecuali.length + ' data TIDAK ikut.' : ''));
      if (kecuali.length) alert('Data berikut tidak ikut diunduh. Minta PIC memeriksa/mengonfirmasinya:\n\n' + kecuali.join('\n'));
      muat();
    } catch (e) { lapor(e.message); }
    sibuk = false;
  }
  muat();
})();

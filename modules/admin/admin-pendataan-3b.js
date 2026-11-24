// SPPG JEUNGJING — SIPIKA: Pendataan 3B (Admin, 24 Nov 2026).
// Kelola PIN PIC, kode kelompok MPM, putaran pemutakhiran, lihat/hapus data, dan UNDUH file template MPM (dibuat di browser dari data server).
// Data berisi NIK: hanya Admin (Staff ditolak server). Unduhan dicatat di server (siapa, kapan, berapa baris).
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const panel = $('panelPendataan3B'); if (!panel) return;
  const C = window.Core3B;
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: window.sppgAdminToken }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  const dmy = function (iso) { const s = String(iso || '').slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : ''; };
  const TPL = 'assets/mpm/template-import-penerima-manfaat-posyandu.xlsx';
  let data = null, sibuk = false;

  panel.innerHTML = '<div class="shell-page-head"><div><h2 class="shell-page-title">Pendataan 3B (Posyandu)</h2><p class="shell-page-sub">Data Ibu Hamil, Ibu Menyusui, dan Balita per Posyandu, diisi PIC lewat <b>pic.html</b>, lalu diunduh sebagai file template MPM. <b>Berisi NIK: jangan dibagikan.</b></p></div></div>'
    + '<div id="p3Info"></div><div id="p3Pos" class="panel-block"></div>'
    + '<h4 style="margin:16px 0 6px">Pemutakhiran data berkala</h4><div id="p3Peng" class="panel-block"></div>'
    + '<div id="p3Data"></div>'
    + '<h4 style="margin:16px 0 6px">Riwayat unduhan</h4><div id="p3Riw" class="panel-block"></div>';

  async function muat() {
    $('p3Pos').innerHTML = '<p class="pg-sub">Memuat…</p>';
    try { data = await api('getPosyandu3BAdmin'); } catch (e) {
      $('p3Pos').innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return;
    }
    gambarPos(); gambarPeng(); muatRiwayat();
  }
  function gambarPos() {
    const el = $('p3Pos'); let h = '<div class="pg-aksi" style="margin-bottom:8px"><button type="button" class="btn-mini primary" id="p3Semua">Unduh semua Posyandu (ZIP)</button></div>';
    h += '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Posyandu</th><th>Kode kelompok MPM</th><th>PIC dan PIN</th><th>Data</th><th>Aksi</th></tr></thead><tbody>';
    data.posyandu.forEach(function (p) {
      h += '<tr' + (p.aktif ? '' : ' style="opacity:.55"') + '><td><b>' + esc(p.nama) + '</b>' + (p.aktif ? '' : '<br><small>NONAKTIF</small>') + '</td>'
        + '<td>' + (p.kodeKelompok ? esc(p.kodeKelompok) : '<small>belum diisi</small>') + ' <button type="button" class="btn-mini" data-kode="' + esc(p.id) + '">Ubah</button></td><td>'
        + (p.pic.length ? p.pic.map(function (c) {
          return '<div style="margin-bottom:4px"><b>' + esc(c.nama) + '</b> · ' + (c.adaHp ? esc(c.hp) : '<span class="pg-err">HP belum diisi di SIPANDU</span>') + '<br><small>PIN: ' + (c.pinStatus === 'DIATUR' ? 'sudah diatur ' + dmy(c.pinDiaturPada) : '<b>belum diatur</b>') + (c.terkunci ? ' · <b style="color:#b3261e">TERKUNCI</b>' : '') + '</small> '
            + '<button type="button" class="btn-mini" data-pin="' + esc(c.idPic) + '"' + (c.adaHp ? '' : ' disabled') + '>' + (c.pinStatus === 'DIATUR' ? 'Atur ulang PIN' : 'Buat PIN') + '</button></div>'; }).join('') : '<small>Belum ada PIC di SIPANDU.</small>') + '</td>'
        + '<td>Bumil ' + p.jumlah['Ibu Hamil'] + ' · Busui ' + p.jumlah['Ibu Menyusui'] + ' · Balita ' + p.jumlah['Balita'] + '<br><small>' + (p.jumlah.perluDiperbarui ? '<b>' + p.jumlah.perluDiperbarui + ' perlu diperbarui</b>' : 'semua terbarui') + '</small></td>'
        + '<td><button type="button" class="btn-mini" data-lihat="' + esc(p.id) + '">Lihat data</button> <button type="button" class="btn-mini primary" data-unduh="' + esc(p.id) + '"' + (p.jumlah.total ? '' : ' disabled') + '>Unduh Excel</button></td></tr>';
    });
    h += '</tbody></table></div>';
    if (data.picLainnya && data.picLainnya.length) {
      h += '<h5 style="margin:14px 0 4px">PIC satuan pendidikan / instansi lain</h5><div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>PIC</th><th>Instansi</th><th>PIN</th></tr></thead><tbody>'
        + data.picLainnya.map(function (c) { return '<tr><td><b>' + esc(c.nama) + '</b><br><small>' + (c.adaHp ? esc(c.hp) : 'HP belum diisi') + '</small></td><td>' + esc(c.instansi.join(', ')) + '</td><td>' + (c.pinStatus === 'DIATUR' ? 'diatur ' + dmy(c.pinDiaturPada) : '<b>belum diatur</b>') + ' <button type="button" class="btn-mini" data-pin="' + esc(c.idPic) + '"' + (c.adaHp ? '' : ' disabled') + '>' + (c.pinStatus === 'DIATUR' ? 'Atur ulang PIN' : 'Buat PIN') + '</button></td></tr>'; }).join('')
        + '</tbody></table></div>';
    }
    el.innerHTML = h;
    $('p3Semua').addEventListener('click', function () { unduh(null); });
    el.querySelectorAll('[data-unduh]').forEach(function (b) { b.addEventListener('click', function () { unduh(b.dataset.unduh); }); });
    el.querySelectorAll('[data-lihat]').forEach(function (b) { b.addEventListener('click', function () { lihat(b.dataset.lihat); }); });
    el.querySelectorAll('[data-kode]').forEach(function (b) { b.addEventListener('click', async function () {
      const p = data.posyandu.filter(function (x) { return x.id === b.dataset.kode; })[0], k = prompt('Kode kelompok MPM untuk ' + p.nama + ' (dari layar Kelompok Penerima Manfaat MPM, kolom Kode). Kosongkan untuk menghapus:', p.kodeKelompok || '');
      if (k === null) return; try { await api('simpanKodeKelompok3BAdmin', { idInstansi: p.id, kode: k.trim() }); info('Kode disimpan.'); } catch (e) { lapor(e.message); } muat(); }); });
    el.querySelectorAll('[data-pin]').forEach(function (b) { b.addEventListener('click', async function () {
      if (!confirm('Buat/atur ulang PIN untuk PIC ini? PIN lama (bila ada) tidak berlaku lagi dan sesi PIC otomatis berakhir.')) return;
      try { const r = await api('aturPin3BAdmin', { idPic: b.dataset.pin }); alert('PIN untuk ' + r.nama + ' (HP ' + r.nomorHp + '):\n\n' + r.pin + '\n\n' + r.catatan); } catch (e) { lapor(e.message); } muat(); }); });
  }
  function gambarPeng() {
    const p = data.pengaturan, el = $('p3Peng');
    el.innerHTML = '<p class="pg-sub">' + (p.putaranTanggal ? '<b>Putaran pemutakhiran AKTIF</b> sejak ' + dmy(p.putaranTanggal) + (p.putaranCatatan ? ': “' + esc(p.putaranCatatan) + '”' : '') + '. Data yang belum diperbarui sejak tanggal itu ditandai “perlu diperbarui” di layar PIC.' : 'Tidak ada putaran aktif. Tekan “Mulai putaran” untuk meminta semua PIC memperbarui data (data yang belum disentuh sejak hari ini ditandai).') + '</p>'
    + '<div class="pg-aksi"><input type="text" id="p3Cat" placeholder="Catatan untuk PIC (mis. batas waktu)" style="min-width:260px"> <button type="button" class="btn-mini primary" id="p3Mulai">Mulai putaran</button> ' + (p.putaranTanggal ? '<button type="button" class="btn-mini" id="p3Akhiri">Akhiri putaran</button>' : '') + '</div>'
    + '<p class="pg-sub" style="margin-top:10px">Batas otomatis: data yang tidak diperbarui lebih dari <input type="number" id="p3Bln" min="0" max="36" value="' + p.batasBulan + '" style="width:64px"> bulan ditandai perlu diperbarui (0 = tidak dipakai). <button type="button" class="btn-mini" id="p3SimpanBln">Simpan</button></p>';
    $('p3Mulai').addEventListener('click', async function () { if (!confirm('Mulai putaran pemutakhiran? Semua data yang belum diperbarui sejak hari ini akan ditandai di layar PIC.')) return;
      try { await api('simpanPengaturan3BAdmin', { mulaiPutaran: true, catatan: $('p3Cat').value }); info('Putaran dimulai.'); } catch (e) { lapor(e.message); } muat(); });
    if ($('p3Akhiri')) $('p3Akhiri').addEventListener('click', async function () { try { await api('simpanPengaturan3BAdmin', { akhiriPutaran: true }); info('Putaran diakhiri.'); } catch (e) { lapor(e.message); } muat(); });
    $('p3SimpanBln').addEventListener('click', async function () { try { await api('simpanPengaturan3BAdmin', { batasBulan: Number($('p3Bln').value) }); info('Disimpan.'); } catch (e) { lapor(e.message); } muat(); });
  }
  async function lihat(idi) {
    const el = $('p3Data'), p = data.posyandu.filter(function (x) { return x.id === idi; })[0]; el.innerHTML = '<p class="pg-sub">Memuat data…</p>';
    let d; try { d = await api('getDaftarPenerima3B', { idInstansi: idi }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    el.innerHTML = '<h4 style="margin:16px 0 6px">Data ' + esc(p.nama) + ' (' + d.items.length + ')</h4><div class="panel-block">' + (d.items.length ? '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Kategori</th><th>Nama</th><th>Lahir</th><th>NIK</th><th>Pasangan</th><th>Diperbarui</th><th></th></tr></thead><tbody>' + d.items.map(function (x) {
      const ps = x.kategori === 'Ibu Hamil' ? 'HPHT ' + esc(x.hpht) : x.kategori === 'Ibu Menyusui' ? 'Anak ' + esc(x.anak_nama) + ' · ' + esc(x.anak_nik) : 'Ibu ' + esc(x.ibu_nama) + ' · ' + esc(x.ibu_nik);
      return '<tr><td>' + esc(x.kategori) + '</td><td>' + esc(x.nama) + '</td><td>' + esc(x.tgl) + '</td><td>' + esc(x.nik) + '</td><td>' + ps + '</td><td>' + dmy(x.diperbaruiPada) + (x.perluDiperbarui ? ' <b>(perlu diperbarui)</b>' : '') + (x.catatan ? '<br><small class="pg-err">' + esc(x.catatan) + '</small>' : '') + '</td><td><button type="button" class="btn-mini" data-hapus="' + esc(x.id) + '">Hapus</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="pg-sub">Belum ada data.</p>') + '</div>';
    el.querySelectorAll('[data-hapus]').forEach(function (b) { b.addEventListener('click', async function () { if (!confirm('Hapus data ini? (Dihapus dari daftar dan tidak ikut diunduh.)')) return;
      try { await api('hapusPenerima3B', { idInstansi: idi, id: b.dataset.hapus }); info('Dihapus.'); } catch (e) { lapor(e.message); } lihat(idi); muat(); }); });
  }
  async function muatRiwayat() {
    const el = $('p3Riw'); let d; try { d = await api('getRiwayatEkspor3BAdmin', { limit: 50 }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    if (!d.items.length) { el.innerHTML = '<p class="pg-sub">Belum ada unduhan.</p>'; return; }
    el.innerHTML = '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Waktu</th><th>Posyandu</th><th>File</th><th>Baris</th><th>Oleh</th><th>Status unggah ke MPM</th></tr></thead><tbody>' + d.items.map(function (x) {
      return '<tr><td>' + esc(x.dibuatPada) + '</td><td>' + esc(x.posyandu) + '</td><td>' + esc(x.namaFile) + '</td><td>' + x.jumlahBaris + '</td><td>' + esc(x.dibuatOleh) + '</td><td><select data-st="' + esc(x.id) + '">' + ['BELUM', 'SUDAH', 'DITOLAK'].map(function (s) { return '<option' + (s === x.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></div>';
    el.querySelectorAll('[data-st]').forEach(function (s) { s.addEventListener('change', async function () { try { await api('ubahStatusUnggah3BAdmin', { idEkspor: s.dataset.st, status: s.value }); info('Status disimpan.'); } catch (e) { lapor(e.message); muatRiwayat(); } }); });
  }

  /* ---------- unduh ---------- */
  function muatJsZip() {
    if (window.JSZip) return Promise.resolve();
    return new Promise(function (ok, gagal) { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = ok; s.onerror = function () { gagal(new Error('Pustaka Excel gagal dimuat. Periksa koneksi internet.')); }; document.head.appendChild(s); });
  }
  async function buatXlsx(records) {
    const buf = await (await fetch(TPL + '?v=20261124a')).arrayBuffer();
    const zip = await window.JSZip.loadAsync(buf, { createFolders: false });   // tanpa entri folder: urutan & nama entri tetap sama dengan template asli
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string'), sst = await zip.file('xl/sharedStrings.xml').async('string'), wb = await zip.file('xl/workbook.xml').async('string');
    const out = C.buildSheet(sheet, sst, records);
    const op = { createFolders: false };
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
      const d = await api('getDataEkspor3BAdmin', idi ? { idInstansi: idi } : {}), tgl = d.tanggal.replace(/-/g, '');
      const berkas = [], kecuali = [];
      for (let i = 0; i < d.posyandu.length; i++) {
        const p = d.posyandu[i]; p.dikecualikan.forEach(function (x) { kecuali.push(p.nama + ': ' + x.nama + ' (' + x.kategori + ') — ' + x.alasan); });
        for (let o = 0, n = 1; o < p.records.length; o += d.maksBaris, n++) {
          const bagian = p.records.slice(o, o + d.maksBaris), bytes = await buatXlsx(bagian);
          const nama = 'Import-3B-' + aman(p.nama) + '-' + tgl + (p.records.length > d.maksBaris ? '-' + n : '') + '.xlsx';
          berkas.push({ idInstansi: p.idInstansi, nama: nama, bytes: bytes, jumlah: bagian.length });
        }
      }
      if (!berkas.length) { lapor('Tidak ada data yang bisa diunduh.' + (kecuali.length ? ' Semua data perlu diperiksa dulu.' : '')); sibuk = false; return; }
      if (berkas.length === 1) simpanBerkas(berkas[0].nama, new Blob([berkas[0].bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      else { const z = new window.JSZip(); berkas.forEach(function (b) { z.file(b.nama, b.bytes); }); simpanBerkas('Import-3B-Semua-Posyandu-' + tgl + '.zip', await z.generateAsync({ type: 'blob', compression: 'STORE' })); }
      for (let i = 0; i < berkas.length; i++) { try { await api('catatEkspor3BAdmin', { idInstansi: berkas[i].idInstansi, namaFile: berkas[i].nama, jumlahBaris: berkas[i].jumlah, checksum: await sha(berkas[i].bytes) }); } catch (e) { /* catatan gagal tidak membatalkan unduhan */ } }
      info(berkas.length + ' file siap.' + (kecuali.length ? ' ' + kecuali.length + ' data TIDAK ikut (lewat batas usia/tidak valid lagi).' : ''));
      if (kecuali.length) alert('Data berikut tidak ikut diunduh karena sudah tidak memenuhi aturan MPM (mis. balita sudah 5 tahun). Minta PIC memeriksa/mengubahnya:\n\n' + kecuali.join('\n'));
      muatRiwayat();
    } catch (e) { lapor(e.message); }
    sibuk = false;
  }
  muat();
  // Pendataan satuan pendidikan (25 Nov 2026): bagian tambahan di panel yang sama
  (function () { function muatSekolah() { const s = document.createElement('script'); s.src = 'modules/admin/admin-pendataan-sekolah.js?v=20261125b'; document.head.appendChild(s); }
    if (window.CoreSekolah) muatSekolah(); else { const c = document.createElement('script'); c.src = 'core/core-sekolah.js?v=20261125b'; c.onload = muatSekolah; document.head.appendChild(c); } })();
})();

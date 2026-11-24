// SPPG JEUNGJING — SIKOP: Penetapan Pergiliran (22 Nov 2026, Tahap 3). TAHAP 2 dari alur dua tahap kewenangan.
// SIKOP memeriksa pengajuan dari SIMSDM lalu MENETAPKAN secara resmi (kewenangan Tetapkan Jadwal yang sudah ada). Hanya penetapan ini yang mengubah jadwal (status Libur Pergiliran).
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const dmy = function (iso) { return String(iso || '').split('-').reverse().join('/'); };
  const rp = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const panel = $('panelPenetapanPergiliran'); if (!panel) return;
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: window.sppgAdminToken }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  panel.innerHTML = '<div class="shell-page-head"><div><h2 class="shell-page-title">Penetapan Pergiliran</h2><p class="shell-page-sub">Periksa pengajuan libur pergiliran dari SIMSDM, lalu tetapkan atau tolak. Setelah ditetapkan, relawan berstatus <b>Libur Pergiliran</b>: tidak perlu absen, bukan alfa, dan tidak dibayar pada tanggal itu. SIPRES membaca hasilnya.</p></div></div>'
    + '<h4 style="margin:4px 0 6px">Kebutuhan tenaga menunggu pengesahan</h4><div id="ptKeb" class="panel-block"></div>'
    + '<h4 style="margin:16px 0 6px">Pengajuan pergiliran menunggu penetapan</h4><div id="ptAntrean" class="panel-block"></div><h4 style="margin:16px 0 6px">Libur yang sudah ditetapkan (hari ini dan mendatang)</h4><div id="ptDitetapkan" class="panel-block"></div>';
  async function muat() { await Promise.all([muatKeb(), muatAntrean(), muatDitetapkan()]); }
  /** Pengesahan master kebutuhan tenaga (angka yang disusun SIMSDM) = penetapan resmi SIKOP. */
  async function muatKeb() {
    const el = $('ptKeb'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let d; try { d = await api('getKebutuhanTenagaAdmin'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    if (!d.kebutuhan.length) { el.innerHTML = '<p class="pg-sub">SIMSDM belum mengisi kebutuhan tenaga. Tanpa kebutuhan yang DISAHKAN, sistem tidak merekomendasikan libur.</p>'; return; }
    el.innerHTML = '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Divisi</th><th>Mode</th><th>Min / ideal tetap</th><th>PM per tenaga (maks / ideal)</th><th>Jabatan wajib</th><th>Status</th><th></th></tr></thead><tbody>' + d.kebutuhan.map(function (b) {
      return '<tr><td>' + esc(b.divisi) + '</td><td>' + esc(b.mode) + '</td><td>' + (b.minTetap === null ? '–' : b.minTetap) + ' / ' + (b.idealTetap === null ? '–' : b.idealTetap) + '</td><td>' + (b.pmMaks || '–') + ' / ' + (b.pmIdeal || '–') + '</td><td>' + esc(b.jabatanWajibTeks || '–') + '</td><td><b>' + esc(b.status) + '</b></td><td>' + (b.status !== 'DISAHKAN' ? '<button type="button" class="btn-mini primary" data-sahkan="' + esc(b.divisi) + '">Sahkan</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    el.querySelectorAll('[data-sahkan]').forEach(function (b) { b.addEventListener('click', async function () {
      if (!confirm('Sahkan kebutuhan divisi ' + b.dataset.sahkan + '? Mesin rekomendasi akan memakai angka ini.')) return;
      try { await api('sahkanKebutuhanTenaga', { divisi: b.dataset.sahkan }); info('Disahkan.'); } catch (e) { lapor(e.message); } muatKeb(); }); });
  }
  async function muatAntrean() {
    const el = $('ptAntrean'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let d; try { d = await api('getPengajuanPergiliran'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    if (!d.batches.length) { el.innerHTML = '<p class="pg-sub">Tidak ada pengajuan yang menunggu penetapan.</p>'; return; }
    el.innerHTML = d.batches.map(function (b) {
      const pm = b.pemeriksaan, per = {}; b.items.forEach(function (x) { (per[x.tanggal + '|' + x.divisi] = per[x.tanggal + '|' + x.divisi] || []).push(x); });
      return '<div class="pg-valid" data-batch="' + esc(b.idBatch) + '"><div><b>' + esc(b.idBatch) + '</b> · diajukan ' + esc(b.diajukanOleh) + ' · ' + esc(b.diajukanPada) + ' · ' + dmy(b.awal) + ' s.d. ' + dmy(b.akhir) + ' · ' + b.jumlah + ' libur</div>'
        + '<div style="margin:6px 0">' + (pm.valid ? '<b style="color:#2e7d32">✓ Lolos pemeriksaan terhadap data terbaru.</b>' : '<b style="color:#b3261e">✕ Tidak lolos pemeriksaan (data berubah sejak diajukan):</b>') + pm.kesalahan.map(function (k) { return '<div class="pg-err">' + esc(k.pesan) + '</div>'; }).join('') + pm.peringatan.map(function (k) { return '<div class="pg-warn">' + esc(k.pesan) + '</div>'; }).join('') + '</div>'
        + Object.keys(per).sort().map(function (k) { const p = k.split('|'), r = per[k]; return '<div class="pg-div"><div class="pg-div-head"><b>' + dmy(p[0]) + ' · ' + esc(p[1]) + '</b> <span>PM ' + esc(r[0].pm === '' ? '–' : r[0].pm) + ' · tersedia ' + esc(r[0].tersedia) + ' · min ' + esc(r[0].min) + ' · ideal ' + esc(r[0].ideal) + '</span></div>'
          + r.map(function (x) { return '<label class="pg-chip" title="' + esc(x.alasan) + '"><input type="checkbox" data-id="' + esc(x.id) + '" checked> ' + esc(x.nama) + (x.sumber === 'MANUAL' ? ' (manual)' : '') + '</label>'; }).join('') + '</div>'; }).join('')
        + '<div class="pg-aksi"><button type="button" class="btn-mini primary" data-tetapkan="' + esc(b.idBatch) + '"' + (pm.valid ? '' : ' disabled') + '>Tetapkan yang dicentang</button><button type="button" class="btn-mini" data-tolak="' + esc(b.idBatch) + '">Tolak yang dicentang</button></div></div>';
    }).join('');
    const ids = function (batch) { return Array.prototype.map.call(el.querySelectorAll('[data-batch="' + batch + '"] input[data-id]:checked'), function (c) { return c.dataset.id; }); };
    el.querySelectorAll('[data-tetapkan]').forEach(function (b) { b.addEventListener('click', async function () {
      const sel = ids(b.dataset.tetapkan); if (!sel.length) return lapor('Pilih minimal satu.');
      if (!confirm('Tetapkan ' + sel.length + ' libur pergiliran? Jadwal relawan terkait berubah menjadi Libur Pergiliran (tidak dibayar).')) return;
      try { const r = await api('tetapkanPergiliran', { idBatch: b.dataset.tetapkan, ids: sel }); info('Ditetapkan: ' + r.diterapkan + ' libur. Insentif yang tidak dibayarkan: ' + rp(r.dampakInsentif) + '.'); } catch (e) { lapor(e.message); } muat(); }); });
    el.querySelectorAll('[data-tolak]').forEach(function (b) { b.addEventListener('click', async function () {
      const sel = ids(b.dataset.tolak); if (!sel.length) return lapor('Pilih minimal satu.');
      const a = prompt('Alasan menolak (wajib):'); if (!a || !a.trim()) return;
      try { await api('tolakPengajuanPergiliran', { idBatch: b.dataset.tolak, ids: sel, alasan: a.trim() }); info('Pengajuan ditolak. Jadwal tidak berubah.'); } catch (e) { lapor(e.message); } muat(); }); });
  }
  async function muatDitetapkan() {
    const el = $('ptDitetapkan'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let d; const hariIni = new Date(), iso = hariIni.getFullYear() + '-' + String(hariIni.getMonth() + 1).padStart(2, '0') + '-' + String(hariIni.getDate()).padStart(2, '0');
    try { d = await api('getRiwayatPergiliran', { status: 'DITETAPKAN', awal: iso }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    if (!d.items.length) { el.innerHTML = '<p class="pg-sub">Belum ada.</p>'; return; }
    el.innerHTML = '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Tanggal</th><th>Relawan</th><th>Divisi</th><th>Ditetapkan oleh</th><th>Insentif tidak dibayar</th><th></th></tr></thead><tbody>' + d.items.map(function (x) { return '<tr><td>' + dmy(x.TANGGAL) + '</td><td>' + esc(x.NAMA_RELAWAN) + '</td><td>' + esc(x.DIVISI) + '</td><td>' + esc(x.DITETAPKAN_OLEH) + '</td><td>' + rp(x.DAMPAK_INSENTIF) + '</td><td><button type="button" class="btn-mini" data-batal="' + esc(x.ID_PERGILIRAN) + '">Batalkan</button></td></tr>'; }).join('') + '</tbody></table></div>';
    el.querySelectorAll('[data-batal]').forEach(function (b) { b.addEventListener('click', async function () {
      const a = prompt('Alasan pembatalan (wajib):'); if (!a || !a.trim()) return;
      try { await api('batalkanPergiliran', { ids: [b.dataset.batal], alasan: a.trim() }); info('Dibatalkan; jadwal kembali normal.'); } catch (e) { lapor(e.message); } muat(); }); });
  }
  muat();
})();

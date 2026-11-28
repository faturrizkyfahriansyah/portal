// SPPG JEUNGJING — SIKOP: Penetapan Pergiliran (22 Nov 2026, Tahap 3; tampilan disederhanakan 28 Nov 2026, 28b). TAHAP 2 dari alur dua tahap kewenangan.
// SIKOP memeriksa pengajuan dari SIMSDM lalu MENETAPKAN secara resmi (kewenangan Tetapkan Jadwal yang sudah ada). Hanya penetapan ini yang mengubah jadwal (status Libur Pergiliran).
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const dmy = function (iso) { return String(iso || '').split('-').reverse().join('/'); };
  const rp = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const hariNama = function (iso) { const p = String(iso || '').split('-'); return p.length === 3 ? ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay()] : ''; };
  const panel = $('panelPenetapanPergiliran'); if (!panel) return;
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: window.sppgAdminToken }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  if (!document.getElementById('pgGaya')) { const st = document.createElement('style'); st.id = 'pgGaya'; st.textContent =
    '.pg-atas{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0 12px}'
    + '.pg-kartu{border:1px solid var(--color-border,#d5dbe3);border-radius:12px;padding:14px 16px;margin:0 0 12px;background:var(--color-surface-raised,#fff)}'
    + '.pg-kartu-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}'
    + '.pg-kartu-j{font-size:15px;font-weight:700;margin:0}.pg-kartu-d{font-size:12.5px;color:var(--color-text-muted,#55606f);margin:2px 0 0;max-width:62ch}'
    + '.pg-kartu-b{margin-top:10px}.pg-sakelar{display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer}.pg-sakelar input{width:20px;height:20px}'
    + '.pg-langkah{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 10px}.pg-langkah span{border:1px solid var(--color-border,#d5dbe3);border-radius:999px;padding:2px 10px;font-size:12.5px;color:var(--color-text-muted,#55606f)}'
    + '.pg-lencana{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}.pg-lencana.ok{background:#e6f4ea;color:#1e6b34}.pg-lencana.err{background:#fde8e6;color:#b3261e}.pg-lencana.wait{background:#fff4e0;color:#8a5a00}'
    + '.pg-kosong{border:1px dashed var(--color-border,#d5dbe3);border-radius:12px;padding:18px;text-align:center;color:var(--color-text-muted,#55606f)}';
    document.head.appendChild(st); }
  const kotak = function (judul, nilai, sub) { return '<div class="pg-kotak"><div class="pg-kotak-j">' + judul + '</div><div class="pg-kotak-n">' + nilai + '</div>' + (sub ? '<div class="pg-kotak-s">' + sub + '</div>' : '') + '</div>'; };
  const T = { antre: null, tetap: null };
  panel.innerHTML = '<div class="shell-page-head"><div><h2 class="shell-page-title">Penetapan Pergiliran</h2><p class="shell-page-sub">Periksa libur yang diajukan SIMSDM, lalu tetapkan atau tolak. Yang ditetapkan menjadi <b>Libur Pergiliran</b>: tidak perlu absen, bukan alfa, dan tidak dibayar pada tanggal itu.</p></div></div>'
    + '<div class="pg-atas" id="ptAtas"></div>'
    + '<h4 style="margin:4px 0 8px">Menunggu penetapan</h4><div id="ptAntrean"></div>'
    + '<h4 style="margin:18px 0 8px">Sudah ditetapkan (hari ini dan mendatang)</h4><div id="ptDitetapkan"></div>'
    + '<div id="ptKebWrap" style="display:none"><h4 style="margin:18px 0 8px">Kebutuhan tenaga yang belum disahkan</h4><div id="ptKeb"></div></div>';
  function atas() {
    const el = $('ptAtas'); if (!el) return; const a = T.antre, t = T.tetap, k = [];
    if (a) { const libur = a.batches.reduce(function (n, b) { return n + b.jumlah; }, 0), bermasalah = a.batches.filter(function (b) { return !b.pemeriksaan.valid; }).length;
      k.push(kotak('Menunggu penetapan', a.batches.length, libur + ' libur'), kotak('Perlu dicek', bermasalah, bermasalah ? 'data berubah sejak diajukan' : 'semua lolos pemeriksaan')); }
    if (t) k.push(kotak('Ditetapkan mendatang', t.items.length, 'libur'), kotak('Insentif tidak dibayar', rp(t.items.reduce(function (n, x) { return n + (Number(x.DAMPAK_INSENTIF) || 0); }, 0)), 'dari libur di atas'));
    el.innerHTML = k.join('');
  }
  async function muat() { await Promise.all([muatKeb(), muatAntrean(), muatDitetapkan()]); }
  /** Pengesahan master kebutuhan tenaga lama (angka yang disusun SIMSDM) = penetapan resmi SIKOP. Tampil hanya bila ada yang belum disahkan. */
  async function muatKeb() {
    const el = $('ptKeb'), wrap = $('ptKebWrap');
    let d; try { d = await api('getKebutuhanTenagaAdmin'); } catch (e) { wrap.style.display = ''; el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    const ada = (d.kebutuhan || []).some(function (b) { return b.status !== 'DISAHKAN'; });
    wrap.style.display = ada ? '' : 'none'; if (!ada) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Divisi</th><th>Mode</th><th>Min / ideal tetap</th><th>PM per tenaga (maks / ideal)</th><th>Jabatan wajib</th><th>Status</th><th></th></tr></thead><tbody>' + d.kebutuhan.map(function (b) {
      return '<tr><td>' + esc(b.divisi) + '</td><td>' + esc(b.mode) + '</td><td>' + (b.minTetap === null ? '–' : b.minTetap) + ' / ' + (b.idealTetap === null ? '–' : b.idealTetap) + '</td><td>' + (b.pmMaks || '–') + ' / ' + (b.pmIdeal || '–') + '</td><td>' + esc(b.jabatanWajibTeks || '–') + '</td><td><b>' + esc(b.status) + '</b></td><td>' + (b.status !== 'DISAHKAN' ? '<button type="button" class="btn-mini primary" data-sahkan="' + esc(b.divisi) + '">Sahkan</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    el.querySelectorAll('[data-sahkan]').forEach(function (b) { b.addEventListener('click', async function () {
      if (!confirm('Sahkan kebutuhan divisi ' + b.dataset.sahkan + '? Mesin rekomendasi akan memakai angka ini.')) return;
      try { await api('sahkanKebutuhanTenaga', { divisi: b.dataset.sahkan }); info('Disahkan.'); } catch (e) { lapor(e.message); } muatKeb(); }); });
  }
  async function muatAntrean() {
    const el = $('ptAntrean'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let d; try { d = await api('getPengajuanPergiliran'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    T.antre = d; atas();
    if (!d.batches.length) { el.innerHTML = '<div class="pg-kosong"><b>Tidak ada pengajuan yang menunggu.</b><br>Pengajuan dari SIMSDM › Pergiliran akan muncul di sini.</div>'; return; }
    el.innerHTML = d.batches.map(function (b) {
      const pm = b.pemeriksaan, per = {}; b.items.forEach(function (x) { (per[x.tanggal + '|' + x.divisi] = per[x.tanggal + '|' + x.divisi] || []).push(x); });
      return '<div class="pg-kartu pg-valid" data-batch="' + esc(b.idBatch) + '"><div class="pg-kartu-h"><div><h4 class="pg-kartu-j">' + (b.awal === b.akhir ? hariNama(b.awal) + ' ' + dmy(b.awal) : dmy(b.awal) + ' – ' + dmy(b.akhir)) + ' · ' + b.jumlah + ' libur</h4><div class="pg-kartu-d">Diajukan ' + esc(b.diajukanOleh) + ' · ' + esc(b.diajukanPada) + ' · ' + esc(b.idBatch) + '</div></div>'
        + (pm.valid ? '<span class="pg-lencana ok">Lolos pemeriksaan</span>' : '<span class="pg-lencana err">Perlu dicek: data berubah sejak diajukan</span>') + '</div>'
        + pm.kesalahan.map(function (k) { return '<div class="pg-err">' + esc(k.pesan) + '</div>'; }).join('') + pm.peringatan.map(function (k) { return '<div class="pg-warn">' + esc(k.pesan) + '</div>'; }).join('')
        + '<div class="pg-kartu-b">' + Object.keys(per).sort().map(function (k) { const p = k.split('|'), r = per[k]; return '<div class="pg-div"><div class="pg-div-head"><b>' + hariNama(p[0]) + ' ' + dmy(p[0]) + ' · ' + esc(p[1]) + '</b> <span>PM ' + esc(r[0].pm === '' ? '–' : r[0].pm) + ' · tersedia ' + esc(r[0].tersedia) + ' · min ' + esc(r[0].min) + ' · ideal ' + esc(r[0].ideal) + '</span></div>'
          + r.map(function (x) { return '<label class="pg-chip" title="' + esc(x.alasan) + '"><input type="checkbox" data-id="' + esc(x.id) + '" checked> ' + esc(x.nama) + (x.sumber === 'MANUAL' ? ' (manual)' : '') + '</label>'; }).join('') + '</div>'; }).join('') + '</div>'
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
    T.tetap = d; atas();
    if (!d.items.length) { el.innerHTML = '<div class="pg-kosong">Belum ada libur yang ditetapkan untuk hari ini dan seterusnya.</div>'; return; }
    el.innerHTML = '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Tanggal</th><th>Relawan</th><th>Divisi</th><th>Ditetapkan oleh</th><th>Insentif tidak dibayar</th><th></th></tr></thead><tbody>' + d.items.map(function (x) { return '<tr><td>' + hariNama(x.TANGGAL) + ' ' + dmy(x.TANGGAL) + '</td><td>' + esc(x.NAMA_RELAWAN) + '</td><td>' + esc(x.DIVISI) + '</td><td>' + esc(x.DITETAPKAN_OLEH) + '</td><td>' + rp(x.DAMPAK_INSENTIF) + '</td><td><button type="button" class="btn-mini" data-batal="' + esc(x.ID_PERGILIRAN) + '">Batalkan</button></td></tr>'; }).join('') + '</tbody></table></div>';
    el.querySelectorAll('[data-batal]').forEach(function (b) { b.addEventListener('click', async function () {
      const a = prompt('Alasan pembatalan (wajib):'); if (!a || !a.trim()) return;
      try { await api('batalkanPergiliran', { ids: [b.dataset.batal], alasan: a.trim() }); info('Dibatalkan; jadwal kembali normal.'); } catch (e) { lapor(e.message); } muat(); }); });
  }
  muat();
})();

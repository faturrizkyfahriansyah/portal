// SPPG JEUNGJING — ADMIN: Dashboard "Perlu Perhatian", Pengajuan Ketidakhadiran, Rekap Pekan Ini (10 Nov 2026, permintaan Admin).
// Satu permintaan ke getDashboardPerhatian; tiap sumber di server dipisah (satu gagal tidak mematikan yang lain). Tidak mengubah data.
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const rp = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const tglIndo = function (iso) { return String(iso || '').split('-').reverse().join('/'); };
  let sedangMuat = false, terakhirMuat = 0;

  function bukaPanel(panel) { const t = document.querySelector('[data-panel="' + panel + '"]'); if (t) t.click(); }

  function renderPerhatian(d) {
    const isi = $('dpPerhatianIsi'); if (!isi) return;
    if (!d.items.length) isi.innerHTML = '<div class="dp-kosong">✓ Tidak ada yang perlu ditindaklanjuti saat ini.</div>';
    else isi.innerHTML = d.items.map(function (x, i) {
      return '<div class="dp-item ' + esc(String(x.tingkat).toLowerCase()) + '"><span class="dp-teks">' + esc(x.teks) + '</span>' + (x.panel ? '<button type="button" class="btn-mini" data-dp-i="' + i + '">' + esc(x.aksi || 'Buka') + '</button>' : '') + '</div>';
    }).join('');
    isi.querySelectorAll('button[data-dp-i]').forEach(function (b) { b.addEventListener('click', function () { bukaPanel(d.items[Number(b.dataset.dpI)].panel); }); });
    const w = $('dpWaktu'); if (w) w.textContent = d.dibuat ? 'Diperbarui ' + String(d.dibuat).slice(11, 16) : '';
  }

  function renderPengajuan(d) {
    const kartu = $('dpPengajuanCard'), isi = $('dpPengajuanIsi'); if (!kartu || !isi) return;
    const p = d.pengajuan || { menunggu: 0, daftar: [], hariIni: [] };
    if (!p.menunggu && !p.hariIni.length) { kartu.style.display = 'none'; return; }
    kartu.style.display = '';
    let html = '';
    if (p.menunggu) {
      html += '<p class="dp-info" style="margin:0 0 4px;"><b>' + p.menunggu + '</b> menunggu keputusan' + (p.menunggu > p.daftar.length ? ' (menampilkan ' + p.daftar.length + ' tertua)' : '') + ':</p>';
      html += p.daftar.map(function (x) { return '<div class="dp-peng"><b>' + esc(x.nama) + ' · ' + esc(x.jenis) + '</b><span>' + esc(x.divisi) + ' · ' + esc(x.mulai) + (x.selesai && x.selesai !== x.mulai ? ' – ' + esc(x.selesai) : '') + (x.alasan ? ' · ' + esc(x.alasan) : '') + '</span></div>'; }).join('');
    }
    if (p.hariIni.length) html += '<p class="dp-info">Tidak masuk hari ini (sudah disetujui): ' + p.hariIni.map(function (x) { return esc(x.nama) + ' (' + esc(x.jenis) + ')'; }).join(', ') + '.</p>';
    isi.innerHTML = html;
  }

  function renderRekapPekan(d) {
    const judul = $('ovRekapJudul'), isi = $('ovRekapIsi'); if (!judul || !isi) return;
    const r = d.rekapPekan;
    if (!r) { isi.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);margin:0;">Rekap pekan ini belum dapat dimuat.</p>'; return; }
    judul.textContent = 'Rekap Pekan Ini — ' + tglIndo(r.awal) + ' s/d ' + tglIndo(r.akhir) + ' (Minggu–Jumat)';
    const chip = function (n, label) { return '<span class="dp-chip"><b>' + n + '</b>' + label + '</span>'; };
    isi.innerHTML = '<div class="dp-chips">' + chip(rp(r.totalInsentif), 'Total Insentif') + chip(r.hadir, 'Hadir') + chip(r.terlambat, 'Terlambat') + chip(r.izin, 'Izin') + chip(r.sakit, 'Sakit') + chip(r.alfa, 'Alfa') + chip(r.cuti, 'Cuti') + '</div>';
  }

  async function muat(paksa) {
    if (sedangMuat || !window.sppgAdminToken) return;
    if (!paksa && Date.now() - terakhirMuat < 20000) return;   // jangan membanjiri server bila menu dibuka berulang
    sedangMuat = true; const isi = $('dpPerhatianIsi');
    try {
      const d = await apiGet('getDashboardPerhatian', { token: window.sppgAdminToken });
      d.items = d.items || []; terakhirMuat = Date.now();
      renderPerhatian(d); renderPengajuan(d); renderRekapPekan(d);
    } catch (err) {
      // Staff / sesi berakhir / server lambat: tampilkan satu baris, jangan memecah halaman.
      if (isi) isi.innerHTML = '<div class="dp-kosong" style="color:#c0392b;">' + esc((err && err.message) || 'Gagal memuat.') + ' <button type="button" class="btn-mini" id="dpCobaLagi">Coba lagi</button></div>';
      const b = $('dpCobaLagi'); if (b) b.addEventListener('click', function () { muat(true); });
      const kartu = $('dpPengajuanCard'); if (kartu) kartu.style.display = 'none';
      const ri = $('ovRekapIsi'); if (ri && /Memuat/.test(ri.textContent)) ri.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);margin:0;">Rekap pekan ini belum dapat dimuat.</p>';
    } finally { sedangMuat = false; }
  }

  let sudahInit = false;
  function init() {
    if (sudahInit || !window.sppgAdminToken) return; sudahInit = true;
    const b = $('dpMuatUlang'); if (b) b.addEventListener('click', function () { muat(true); });
    const bp = $('dpBukaPengajuan'); if (bp) bp.addEventListener('click', function () { bukaPanel('panelPengajuanKetidakhadiranAdmin'); });
    const menu = document.querySelector('[data-panel="panelOverview"]'); if (menu) menu.addEventListener('click', function () { muat(false); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && $('panelOverview') && $('panelOverview').classList.contains('active')) muat(false); });
    setInterval(function () { if (!document.hidden && $('panelOverview') && $('panelOverview').classList.contains('active')) muat(true); }, 5 * 60 * 1000);
    muat(true);
  }
  window.addEventListener('sppg-admin-ready', init);
  if (window.sppgAdminToken) init();   // jaga-jaga bila event sudah lewat sebelum berkas ini dimuat (pola sama dgn admin-kartu-qr.js)
})();

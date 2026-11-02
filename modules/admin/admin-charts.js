// ============================================================
// admin-charts.js — Dashboard Visual Admin
// File BARU, mandiri. Grafik dibuat pakai CSS murni (bar sederhana dari
// <div> lebar proporsional) -- BUKAN library charting (Chart.js dkk)
// supaya tetap ringan sesuai permintaan, dan responsif otomatis karena
// cuma HTML+CSS biasa, bukan <canvas>.
// ============================================================

(function () {
  'use strict';

  function token() { return window.sppgAdminToken; }

  function bikinWadahGrafik_() {
    const panel = document.getElementById('panelOverview');
    if (!panel) return null;
    if (document.getElementById('wadahGrafikDashboard')) return document.getElementById('wadahGrafikDashboard');

    const wadah = document.createElement('div');
    wadah.id = 'wadahGrafikDashboard';
    wadah.style.marginTop = '20px';
    wadah.innerHTML = `
      <p class="section-title">Tren Kehadiran (7 Hari Terakhir)</p>
      <div id="grafikTrenKehadiran" class="panel-block" style="display:flex;align-items:flex-end;gap:8px;height:140px;padding:14px;"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px;">
        <div>
          <p class="section-title">SIRAGA — Status Stok</p>
          <div id="grafikStok" class="panel-block"></div>
        </div>
        <div>
          <p class="section-title">SIPANDU — Status Work Order</p>
          <div id="grafikSipandu" class="panel-block"></div>
        </div>
      </div>
    `;
    panel.appendChild(wadah);
    return wadah;
  }

  function renderBarVertikal_(wadahId, data, warnaFn) {
    const wadah = document.getElementById(wadahId);
    if (!data || !data.length) { wadah.innerHTML = '<p class="empty-state" style="margin:0;">Belum ada data.</p>'; return; }
    const maks = Math.max(1, ...data.map(d => d.hadir));
    wadah.innerHTML = data.map(d => {
      const tinggiPersen = Math.round((d.hadir / maks) * 100);
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <span style="font-size:11px;font-weight:700;color:var(--color-navy);">${d.hadir}</span>
          <div style="width:100%;background:${warnaFn(d)};border-radius:4px 4px 0 0;height:${Math.max(4, tinggiPersen)}px;transition:height .3s;"></div>
          <span style="font-size:10px;color:var(--color-text-muted);">${d.tanggal}</span>
        </div>`;
    }).join('');
  }

  function renderBarHorizontal_(wadahId, entri) {
    const wadah = document.getElementById(wadahId);
    const total = entri.reduce((s, e) => s + e.jumlah, 0);
    if (!total) { wadah.innerHTML = '<p class="empty-state" style="margin:0;">Belum ada data.</p>'; return; }
    wadah.innerHTML = entri.map(e => {
      const persen = Math.round((e.jumlah / total) * 100);
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
            <span>${e.label}</span><strong>${e.jumlah}</strong>
          </div>
          <div style="background:#eef0f3;border-radius:6px;height:8px;overflow:hidden;">
            <div style="width:${persen}%;height:100%;background:${e.warna};"></div>
          </div>
        </div>`;
    }).join('');
  }

  async function muatSemuaGrafik_() {
    try {
      const tren = await apiGet('getTrenKehadiran7Hari', { token: token() });
      renderBarVertikal_('grafikTrenKehadiran', tren, () => '#12294d');
    } catch (e) { /* panel lain tetap coba dimuat walau ini gagal */ }

    try {
      const ringkasan = await apiGet('getRingkasanMonitoring', { token: token() });
      if (ringkasan.stok) {
        renderBarHorizontal_('grafikStok', [
          { label: 'Aman', jumlah: ringkasan.stok.aman, warna: '#1a7a4c' },
          { label: 'Menipis', jumlah: ringkasan.stok.menipis, warna: '#c9962c' },
          { label: 'Habis', jumlah: ringkasan.stok.habis, warna: '#b23a3a' }
        ]);
      } else {
        document.getElementById('grafikStok').innerHTML = '<p class="empty-state" style="margin:0;">Modul SIRAGA belum tersedia.</p>';
      }

      if (ringkasan.sipandu) {
        const s = ringkasan.sipandu.perStatus;
        renderBarHorizontal_('grafikSipandu', [
          { label: 'Draft', jumlah: s.DRAFT, warna: '#9ca3af' },
          { label: 'Data Lengkap', jumlah: s.DATA_LENGKAP, warna: '#3b7dd8' },
          { label: 'Ready', jumlah: s.READY, warna: '#c9962c' },
          { label: 'POP Filled', jumlah: s.POP_FILLED, warna: '#7c5cbf' },
          { label: 'Completed', jumlah: s.COMPLETED, warna: '#1a7a4c' }
        ]);
      } else {
        document.getElementById('grafikSipandu').innerHTML = '<p class="empty-state" style="margin:0;">SIPANDU belum tersambung (isi SIPANDU_SPREADSHEET_ID di Script Properties).</p>';
      }
    } catch (e) { /* diamkan -- panel tren di atas tetap tampil walau ini gagal */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    let percobaan = 0;
    const interval = setInterval(() => {
      const wadah = bikinWadahGrafik_();
      percobaan++;
      if (wadah || percobaan > 20) clearInterval(interval);
      if (wadah) muatSemuaGrafik_();
    }, 300);
  });
})();

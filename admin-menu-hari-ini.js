// admin-menu-hari-ini.js — Menu Hari Ini sebagai halaman sendiri
// (sebelumnya cuma kartu di dashboard). Pakai ulang aksi
// getMenuHariIniDashboard yg sudah ada -- tanpa gerbang role, tidak ada
// logika baru di backend.
(function () {
  const el = document.getElementById('mhiKonten');

  async function muat() {
    el.innerHTML = '<p style="margin:0;font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const m = await apiGet('getMenuHariIniDashboard', {});
      if (!m) {
        el.innerHTML = '<div class="empty-state">Menu hari ini belum tersedia di database siklus menu — di luar jadwal yang sudah diisi, atau sheet belum dapat diakses.</div>';
        return;
      }
      el.innerHTML = `
        <p style="margin:0 0 14px;font-size:14px;color:var(--color-text-muted);font-weight:600;">${escapeHtml(m.hari)}, ${escapeHtml(m.tanggal)}${m.tema ? ' — Tema: ' + escapeHtml(m.tema) : ''}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
          ${['karbohidrat:Karbohidrat', 'laukHewani:Lauk Hewani', 'laukNabati:Lauk Nabati', 'sayur:Sayur', 'buah:Buah', 'pelengkap:Pelengkap / Finishing'].map(pasangan => {
            const [kunci, label] = pasangan.split(':');
            return `<div style="background:var(--color-primary-soft);border-radius:10px;padding:14px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:var(--color-primary);text-transform:uppercase;">${label}</p>
              <p style="margin:0;font-size:15px;font-weight:600;">${escapeHtml(m[kunci] || '-')}</p>
            </div>`;
          }).join('')}
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  muat();
})();

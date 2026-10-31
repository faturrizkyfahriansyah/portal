// SPPG JEUNGJING — LOGIC HALAMAN DOKUMEN & PANDUAN (dokumen.html)
// Menggunakan collection Dokumen yang sesungguhnya di backend
// (getDokumenRelawan) — dikelola Admin lewat menu Dokumen.

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const list = document.getElementById('dokumenList');
  const searchInput = document.getElementById('docSearch');
  const tabs = document.querySelectorAll('#dokumenTabs .chip-tab');
  let items = [];
  let kategoriAktif = '';

  function render() {
    const q = (searchInput.value || '').trim().toLowerCase();
    let rows = items;
    if (kategoriAktif) rows = rows.filter(d => d.kategori === kategoriAktif);
    if (q) rows = rows.filter(d => (d.judul + ' ' + (d.deskripsi || '')).toLowerCase().indexOf(q) !== -1);

    if (!rows.length) {
      list.innerHTML = '<div class="shell-empty"><p>Belum ada dokumen yang tersedia.</p></div>';
      return;
    }

    const byKategori = {};
    rows.forEach(d => { (byKategori[d.kategori] = byKategori[d.kategori] || []).push(d); });

    list.innerHTML = Object.keys(byKategori).map(kat => `
      <p class="doc-group-title">${escapeHtml(kat)}</p>
      ${byKategori[kat].map(d => `
        <div class="doc-item">
          <span class="doc-item-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v5h5"/></svg></span>
          <span class="doc-item-text">
            <strong>${escapeHtml(d.judul)}</strong>
            <span>${escapeHtml(d.deskripsi || '')}</span>
          </span>
          ${d.url ? `<a href="${escapeHtml(d.url)}" target="_blank" rel="noopener" class="btn-mini" style="text-decoration:none;">Unduh</a>` : ''}
        </div>`).join('')}
    `).join('');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      kategoriAktif = tab.dataset.kat || '';
      render();
    });
  });
  searchInput.addEventListener('input', render);

  try {
    showLoading('Memuat dokumen...');
    items = await apiGet('getDokumenRelawan', { token: sesi.token });
    hideLoading();
    render();
  } catch (err) {
    hideLoading();
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat dokumen.');
  }
});

// SPPG JEUNGJING — LOGIC HALAMAN NOTIFIKASI (notifikasi.html)
// Menggunakan collection Notifikasi yang sesungguhnya di backend
// (getNotifikasiRelawan) — tercatat otomatis dari Jadwal/Informasi/
// Pengumuman, atau dikirim manual oleh Admin (kategori Sistem).
// Status "sudah dibaca" tetap disimpan per perangkat (localStorage),
// lihat getNotifReadSet/addNotifRead/markAllNotifRead di app-shell.js.

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('notifMain');
  const list = document.getElementById('notifList');
  const tabs = document.querySelectorAll('#notifTabs .chip-tab');
  const detailOverlay = document.getElementById('notifDetailOverlay');
  const detailIcon = document.getElementById('notifDetailIcon');
  const detailJudul = document.getElementById('notifDetailJudul');
  const detailTanggal = document.getElementById('notifDetailTanggal');
  const detailIsi = document.getElementById('notifDetailIsi');
  let items = [];
  let kategoriAktif = 'semua';

  function bukaDetail(item) {
    detailIcon.className = 'activity-item-icon ' + typeClass(item.kategori);
    detailIcon.innerHTML = iconFor(item.kategori);
    detailJudul.textContent = item.judul;
    detailTanggal.textContent = formatTanggalWaktuIndoShell(item.tanggal);
    detailIsi.textContent = item.isi;
    detailOverlay.classList.remove('is-hidden');
  }

  function tutupDetail() {
    detailOverlay.classList.add('is-hidden');
  }

  document.getElementById('btnTutupNotifDetail').addEventListener('click', tutupDetail);
  detailOverlay.addEventListener('click', (e) => { if (e.target === detailOverlay) tutupDetail(); });

  function iconFor(kategori) {
    if (kategori === 'Informasi') return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/></svg>';
    if (kategori === 'Sistem') return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>';
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>';
  }
  function typeClass(kategori) {
    if (kategori === 'Informasi') return 'type-informasi';
    if (kategori === 'Sistem') return 'type-absensi';
    return 'type-jadwal';
  }

  function render() {
    const readSet = getNotifReadSet(sesi.idRelawan);
    let rows = items;
    if (kategoriAktif === 'belum') rows = rows.filter(i => !readSet.has(i.id));
    else if (kategoriAktif !== 'semua') rows = rows.filter(i => i.kategori.toLowerCase() === kategoriAktif);

    if (!rows.length) {
      list.innerHTML = `<div class="shell-empty"><p>Belum ada notifikasi ${kategoriAktif === 'belum' ? 'yang belum dibaca' : 'baru'}.</p></div>`;
      return;
    }

    list.innerHTML = rows.map(i => `
      <button type="button" class="activity-item" data-id="${i.id}" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--color-border);cursor:pointer;font-family:inherit;${readSet.has(i.id) ? 'opacity:.6;' : ''}">
        <span class="activity-item-icon ${typeClass(i.kategori)}">${iconFor(i.kategori)}</span>
        <span class="activity-item-body">
          <p class="activity-title">${escapeHtml(i.judul)}${!readSet.has(i.id) ? ' <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--color-danger);margin-left:4px;"></span>' : ''}</p>
          <p class="activity-desc">${escapeHtml(i.isi)}</p>
          <p class="activity-time">${escapeHtml(formatTanggalWaktuIndoShell(i.tanggal))}</p>
        </span>
      </button>`).join('');

    list.querySelectorAll('.activity-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = items.find(i => String(i.id) === btn.dataset.id);
        addNotifRead(sesi.idRelawan, btn.dataset.id);
        render();
        if (item) bukaDetail(item);
      });
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      kategoriAktif = tab.dataset.cat;
      render();
    });
  });

  document.getElementById('btnTandaiSemua').addEventListener('click', () => {
    markAllNotifRead(sesi.idRelawan, items.map(i => i.id));
    render();
  });

  try {
    showLoading('Memuat notifikasi...');
    const notifikasi = await apiGet('getNotifikasiRelawan', { token: sesi.token });
    hideLoading();

    items = (notifikasi || []).map(n => ({ id: n.id, kategori: n.kategori, judul: n.judul, isi: n.isi, tanggal: n.tanggal }));
    main.style.display = 'block';
    render();
  } catch (err) {
    hideLoading();
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat notifikasi.');
  }
});

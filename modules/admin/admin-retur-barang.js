// admin-retur-barang.js — Sisi Admin/Gudang: periksa & konfirmasi
// retur barang dari Koordinator (21 Okt 2026, dokumen Fitur
// Koordinator §9). TIDAK otomatis menyesuaikan stok -- penyesuaian
// stok (kalau memang perlu) tetap lewat mekanisme SIRAGA yang sudah
// ada, terpisah dari halaman ini.
(function () {
  const T = window.sppgAdminToken;
  const LABEL_STATUS = { MENUNGGU_PEMERIKSAAN: 'Menunggu Pemeriksaan', DITERIMA_GUDANG: 'Diterima Gudang', DITOLAK: 'Ditolak', DALAM_PENANGANAN: 'Dalam Penanganan', SELESAI: 'Selesai' };
  const BADGE_STATUS = { MENUNGGU_PEMERIKSAAN: 'nonaktif', DITERIMA_GUDANG: 'aktif', DITOLAK: 'sakit', DALAM_PENANGANAN: 'terlambat', SELESAI: 'aktif' };
  const LABEL_ALASAN = { RUSAK_PECAH: 'Rusak/Pecah', CACAT_TIDAK_BERFUNGSI: 'Cacat/Tidak Berfungsi', TIDAK_SESUAI_SPESIFIKASI: 'Tidak Sesuai Spesifikasi', SALAH_JENIS_JUMLAH: 'Salah Jenis/Jumlah', TIDAK_LAYAK_DIGUNAKAN: 'Tidak Layak Digunakan', LAINNYA: 'Lainnya' };

  async function muat() {
    const el = document.getElementById('rbaIsi');
    el.innerHTML = '<div class="empty-state">Memuat...</div>';
    try {
      const daftar = await apiPost('getReturBarangAdmin', { token: T, status: document.getElementById('rbaFilterStatus').value });
      if (!daftar.length) { el.innerHTML = '<div class="empty-state">Tidak ada pengajuan retur.</div>'; return; }
      el.innerHTML = daftar.map(r => `
        <div class="panel-block" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
            <div>
              <span class="badge ${BADGE_STATUS[r.status] || 'nonaktif'}">${LABEL_STATUS[r.status] || r.status}</span>
              <span class="badge nonaktif" style="margin-left:4px;">${escapeHtml(r.divisi)}</span>
              <p style="margin:6px 0 2px;font-weight:700;">${escapeHtml(r.namaBarang)} — ${escapeHtml(r.jumlah)} ${escapeHtml(r.satuan || '')}</p>
              <p style="margin:0;font-size:11px;color:var(--color-text-muted);">${escapeHtml(r.tanggal)} · ${LABEL_ALASAN[r.alasanRetur] || r.alasanRetur} · #${escapeHtml(r.id)}</p>
              ${r.kondisiBarang ? `<p style="margin:6px 0 0;font-size:13px;">Kondisi: ${escapeHtml(r.kondisiBarang)}</p>` : ''}
              ${r.uraian ? `<p style="margin:4px 0 0;font-size:13px;color:var(--color-text-muted);">${escapeHtml(r.uraian)}</p>` : ''}
              ${r.catatanGudang ? `<div style="background:var(--color-bg);border-radius:8px;padding:8px 10px;margin-top:8px;"><p style="margin:0;font-size:11px;font-weight:700;color:var(--color-text-muted);">CATATAN GUDANG</p><p style="margin:2px 0 0;font-size:13px;">${escapeHtml(r.catatanGudang)}</p></div>` : ''}
            </div>
            <button type="button" class="btn-mini primary btn-proses-retur" data-id="${escapeHtml(r.id)}" data-status="${escapeHtml(r.status)}">Proses</button>
          </div>
        </div>`).join('');

      el.querySelectorAll('.btn-proses-retur').forEach(btn => {
        btn.addEventListener('click', () => bukaDialogProses_(btn.dataset.id, btn.dataset.status));
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  function bukaDialogProses_(id, statusSekarang) {
    const statusBaru = prompt('Ubah status retur #' + id + ' menjadi (ketik salah satu persis):\n' + Object.keys(LABEL_STATUS).join(', '), statusSekarang);
    if (!statusBaru || !LABEL_STATUS[statusBaru]) { if (statusBaru !== null) showError('Status tidak valid.'); return; }
    const catatan = prompt('Catatan gudang (opsional):') || '';
    prosesRetur_(id, statusBaru, catatan);
  }

  async function prosesRetur_(idRetur, statusBaru, catatan) {
    showLoading('Memproses...');
    try {
      await apiPost('prosesReturBarang', { token: T, idRetur, statusBaru, catatan });
      hideLoading();
      showSuccess('Status retur diperbarui.');
      muat();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal memproses retur.');
    }
  }

  document.getElementById('rbaFilterStatus').addEventListener('change', muat);
  muat();
})();

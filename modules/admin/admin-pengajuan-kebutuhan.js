// admin-pengajuan-kebutuhan.js — Sisi Admin: proses pengajuan
// kebutuhan dari Koordinator (21 Okt 2026, dokumen Fitur Koordinator
// §8). Ini BUKAN transaksi stok -- cuma mengubah status pengajuan.
(function () {
  const T = window.sppgAdminToken;
  const LABEL_STATUS = { MENUNGGU_PERSETUJUAN: 'Menunggu Persetujuan', DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak', SEDANG_DIPROSES: 'Sedang Diproses', TERPENUHI_SEBAGIAN: 'Terpenuhi Sebagian', SELESAI: 'Selesai' };
  const BADGE_STATUS = { MENUNGGU_PERSETUJUAN: 'nonaktif', DISETUJUI: 'aktif', DITOLAK: 'sakit', SEDANG_DIPROSES: 'terlambat', TERPENUHI_SEBAGIAN: 'terlambat', SELESAI: 'aktif' };
  const LABEL_PRIORITAS = { RENDAH: 'Rendah', SEDANG: 'Sedang', TINGGI: 'Tinggi' };

  async function muat() {
    const el = document.getElementById('pkaIsi');
    el.innerHTML = '<div class="empty-state">Memuat...</div>';
    try {
      const daftar = await apiPost('getPengajuanKebutuhanAdmin', { token: T, status: document.getElementById('pkaFilterStatus').value });
      if (!daftar.length) { el.innerHTML = '<div class="empty-state">Tidak ada pengajuan.</div>'; return; }
      el.innerHTML = daftar.map(p => `
        <div class="panel-block" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
            <div>
              <span class="badge ${BADGE_STATUS[p.status] || 'nonaktif'}">${LABEL_STATUS[p.status] || p.status}</span>
              <span class="badge nonaktif" style="margin-left:4px;">${escapeHtml(p.divisi)}</span>
              <p style="margin:6px 0 2px;font-weight:700;">${escapeHtml(p.namaBarang)} — ${escapeHtml(p.jumlah)} ${escapeHtml(p.satuan || '')}</p>
              <p style="margin:0;font-size:11px;color:var(--color-text-muted);">${escapeHtml(p.tanggal)} · Prioritas ${LABEL_PRIORITAS[p.prioritas] || p.prioritas} · #${escapeHtml(p.id)}</p>
              ${p.alasan ? `<p style="margin:6px 0 0;font-size:13px;">${escapeHtml(p.alasan)}</p>` : ''}
              ${p.catatanPersetujuan ? `<div style="background:var(--color-bg);border-radius:8px;padding:8px 10px;margin-top:8px;"><p style="margin:0;font-size:11px;font-weight:700;color:var(--color-text-muted);">CATATAN</p><p style="margin:2px 0 0;font-size:13px;">${escapeHtml(p.catatanPersetujuan)}</p></div>` : ''}
            </div>
            <button type="button" class="btn-mini primary btn-proses-pengajuan" data-id="${escapeHtml(p.id)}" data-status="${escapeHtml(p.status)}">Proses</button>
          </div>
        </div>`).join('');

      el.querySelectorAll('.btn-proses-pengajuan').forEach(btn => {
        btn.addEventListener('click', () => bukaDialogProses_(btn.dataset.id, btn.dataset.status));
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  function bukaDialogProses_(id, statusSekarang) {
    const pilihan = Object.keys(LABEL_STATUS).map(s => `${s === statusSekarang ? '→ ' : '  '}${LABEL_STATUS[s]}`).join('\n');
    const statusBaru = prompt('Ubah status pengajuan #' + id + ' menjadi (ketik salah satu persis):\n' + Object.keys(LABEL_STATUS).join(', '), statusSekarang);
    if (!statusBaru || !LABEL_STATUS[statusBaru]) { if (statusBaru !== null) showError('Status tidak valid.'); return; }
    const catatan = prompt('Catatan (opsional):') || '';
    prosesPengajuan_(id, statusBaru, catatan);
  }

  async function prosesPengajuan_(idPengajuan, statusBaru, catatan) {
    showLoading('Memproses...');
    try {
      await apiPost('prosesPengajuanKebutuhan', { token: T, idPengajuan, statusBaru, catatan });
      hideLoading();
      showSuccess('Status pengajuan diperbarui.');
      muat();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal memproses pengajuan.');
    }
  }

  document.getElementById('pkaFilterStatus').addEventListener('change', muat);
  muat();
})();

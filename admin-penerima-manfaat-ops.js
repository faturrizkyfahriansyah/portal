// admin-penerima-manfaat-ops.js — Penerima Manfaat sebagai halaman
// sendiri (sebelumnya cuma kartu di dashboard). Pakai ulang aksi
// getRingkasanPmDashboard yg sudah ada -- field pmHariIni/pmLibur (per
// institusi) SUDAH ADA di respons yg sama, tidak perlu panggilan backend
// baru utk tabel di bawah.
(function () {
  const elRingkasan = document.getElementById('pmoRingkasan');
  const elTbodyAktif = document.getElementById('pmoTbodyAktif');
  const elTbodyLibur = document.getElementById('pmoTbodyLibur');

  const LABEL_JENIS = { SEKOLAH: 'Sekolah', POSYANDU: 'Posyandu' };

  async function muat() {
    try {
      const pm = await apiGet('getRingkasanPmDashboard', {});
      if (!pm) {
        elRingkasan.innerHTML = '<div class="empty-state">Data Penerima Manfaat belum tersedia — periksa koneksi ke SIPENDOK.</div>';
        elTbodyAktif.innerHTML = '<tr><td colspan="6"><div class="empty-state">—</div></td></tr>';
        elTbodyLibur.innerHTML = '<tr><td colspan="2"><div class="empty-state">—</div></td></tr>';
        return;
      }

      const totalPorsi = pm.totalPK + pm.totalPB + pm.total3B;
      elRingkasan.innerHTML = `
        <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
          <div>
            <div style="font-size:32px;font-weight:800;color:var(--color-success);line-height:1;">${totalPorsi.toLocaleString('id-ID')}</div>
            <div style="font-size:12.5px;color:var(--color-text-muted);margin-top:4px;font-weight:600;">Total Porsi PM Hari Ini (${escapeHtml(pm.tanggalIndo)})</div>
          </div>
          <div style="text-align:right;font-size:12px;color:var(--color-text-muted);">
            <div>${pm.jumlahPmHariIni} institusi aktif</div>
            <div>${pm.jumlahPmLibur} institusi libur</div>
          </div>
        </div>
        <div class="admin-stat-grid" style="grid-template-columns:repeat(3,1fr);">
          <div class="admin-stat-card accent-info"><div class="admin-stat-value">${pm.totalPK.toLocaleString('id-ID')}</div><div class="admin-stat-label">Porsi Kecil (PK)</div></div>
          <div class="admin-stat-card accent-info"><div class="admin-stat-value">${pm.totalPB.toLocaleString('id-ID')}</div><div class="admin-stat-label">Porsi Besar (PB)</div></div>
          <div class="admin-stat-card accent-warning"><div class="admin-stat-value">${pm.total3B.toLocaleString('id-ID')}</div><div class="admin-stat-label">Balita+Bumil+Busui (3B)</div></div>
        </div>`;

      elTbodyAktif.innerHTML = !pm.pmHariIni.length
        ? '<tr><td colspan="6"><div class="empty-state">Tidak ada institusi aktif hari ini.</div></td></tr>'
        : pm.pmHariIni.map(p => `<tr>
            <td>${escapeHtml(p.NAMA_PM)}</td>
            <td>${escapeHtml(LABEL_JENIS[p.JENIS_PM] || p.JENIS_PM)}</td>
            <td>${p.PK}</td><td>${p.PB}</td><td>${p.TIGA_B}</td><td><b>${p.JUMLAH}</b></td>
          </tr>`).join('');

      elTbodyLibur.innerHTML = !pm.pmLibur.length
        ? '<tr><td colspan="2"><div class="empty-state">Tidak ada institusi libur hari ini — semua aktif.</div></td></tr>'
        : pm.pmLibur.map(p => `<tr><td>${escapeHtml(p.NAMA_PM)}</td><td>${escapeHtml(LABEL_JENIS[p.JENIS_PM] || p.JENIS_PM)}</td></tr>`).join('');
    } catch (err) {
      elRingkasan.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  muat();
})();

// pengajuan-kebutuhan-koordinator.js — Pengajuan Kebutuhan (21 Okt
// 2026, dokumen Fitur Koordinator §8). BUKAN transaksi stok -- murni
// pengajuan, stok tidak otomatis berkurang (ditegaskan di backend jg).
document.addEventListener('DOMContentLoaded', () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) { window.location.href = 'login.html'; return; }
  const TOKEN = sesi.token;

  const LABEL_STATUS = { MENUNGGU_PERSETUJUAN: 'Menunggu Persetujuan', DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak', SEDANG_DIPROSES: 'Sedang Diproses', TERPENUHI_SEBAGIAN: 'Terpenuhi Sebagian', SELESAI: 'Selesai' };
  const BADGE_STATUS = { MENUNGGU_PERSETUJUAN: 'belum-absen', DISETUJUI: 'hadir', DITOLAK: 'sakit', SEDANG_DIPROSES: 'terlambat', TERPENUHI_SEBAGIAN: 'terlambat', SELESAI: 'hadir' };
  const LABEL_PRIORITAS = { RENDAH: 'Rendah', SEDANG: 'Sedang', TINGGI: 'Tinggi' };

  const elForm = document.getElementById('pkFormWrap');
  const elIsi = document.getElementById('pkIsi');

  document.getElementById('pkBtnBuat').addEventListener('click', () => { elForm.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.getElementById('pkBtnBatal').addEventListener('click', () => { elForm.style.display = 'none'; document.getElementById('formPengajuan').reset(); });

  async function muatPilihanBarang_() {
    try {
      const d = await apiPost('getDaftarBarangUntukForm', { token: TOKEN });
      document.getElementById('pkDaftarBarang').innerHTML = d.barang.map(b => `<option value="${escapeHtml(b.nama)}">`).join('');
      document.getElementById('pkKategori').innerHTML = '<option value="">Pilih Kategori (opsional)...</option>' + d.kategori.map(k => `<option value="${escapeHtml(k.nama)}">${escapeHtml(k.nama)}</option>`).join('');
    } catch (err) { /* daftar barang cuma bantuan pengisian, kegagalannya tidak menghalangi form */ }
  }

  async function muat() {
    elIsi.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const daftar = await apiPost('getPengajuanKebutuhanKoordinator', { token: TOKEN });
      if (!daftar.length) { elIsi.innerHTML = '<div class="empty-state">Belum ada pengajuan kebutuhan.</div>'; return; }
      elIsi.innerHTML = `
        <div class="table-wrap">
          <table class="tabel-jadi-kartu">
            <thead><tr><th>Tanggal</th><th>Barang</th><th>Jumlah</th><th>Prioritas</th><th>Status</th><th>Catatan</th></tr></thead>
            <tbody>
              ${daftar.map(p => `
                <tr>
                  <td data-label="Tanggal">${escapeHtml(p.tanggal)}</td>
                  <td data-label="Barang"><b>${escapeHtml(p.namaBarang)}</b>${p.kategori ? ' <span style="color:var(--color-text-muted);font-size:11px;">(' + escapeHtml(p.kategori) + ')</span>' : ''}</td>
                  <td data-label="Jumlah">${escapeHtml(p.jumlah)} ${escapeHtml(p.satuan || '')}</td>
                  <td data-label="Prioritas">${LABEL_PRIORITAS[p.prioritas] || p.prioritas}</td>
                  <td data-label="Status"><span class="badge ${BADGE_STATUS[p.status] || 'belum-absen'}">${LABEL_STATUS[p.status] || p.status}</span></td>
                  <td data-label="Catatan">${escapeHtml(p.catatanPersetujuan || '-')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      elIsi.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  document.getElementById('formPengajuan').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Mengirim...';
    try {
      await apiPost('ajukanKebutuhan', {
        token: TOKEN, namaBarang: document.getElementById('pkNamaBarang').value.trim(),
        kategori: document.getElementById('pkKategori').value, jumlah: document.getElementById('pkJumlah').value,
        satuan: document.getElementById('pkSatuan').value.trim(), prioritas: document.getElementById('pkPrioritas').value,
        alasan: document.getElementById('pkAlasan').value.trim()
      });
      showSuccess('Pengajuan terkirim, menunggu persetujuan.');
      e.target.reset();
      elForm.style.display = 'none';
      muat();
    } catch (err) {
      showError(err.message || 'Gagal mengirim pengajuan.');
    } finally {
      btn.disabled = false; btn.textContent = 'Kirim Pengajuan';
    }
  });

  muatPilihanBarang_();
  muat();
});

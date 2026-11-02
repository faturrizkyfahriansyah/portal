// retur-barang-koordinator.js — Retur Barang (21 Okt 2026, dokumen
// Fitur Koordinator §9). Stok TIDAK otomatis disesuaikan hanya karena
// pengajuan retur -- menunggu konfirmasi petugas gudang.
document.addEventListener('DOMContentLoaded', () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) { window.location.href = 'login.html'; return; }
  const TOKEN = sesi.token;

  const LABEL_STATUS = { MENUNGGU_PEMERIKSAAN: 'Menunggu Pemeriksaan', DITERIMA_GUDANG: 'Diterima Gudang', DITOLAK: 'Ditolak', DALAM_PENANGANAN: 'Dalam Penanganan', SELESAI: 'Selesai' };
  const BADGE_STATUS = { MENUNGGU_PEMERIKSAAN: 'belum-absen', DITERIMA_GUDANG: 'hadir', DITOLAK: 'sakit', DALAM_PENANGANAN: 'terlambat', SELESAI: 'hadir' };
  const LABEL_ALASAN = { RUSAK_PECAH: 'Rusak/Pecah', CACAT_TIDAK_BERFUNGSI: 'Cacat/Tidak Berfungsi', TIDAK_SESUAI_SPESIFIKASI: 'Tidak Sesuai Spesifikasi', SALAH_JENIS_JUMLAH: 'Salah Jenis/Jumlah', TIDAK_LAYAK_DIGUNAKAN: 'Tidak Layak Digunakan', LAINNYA: 'Lainnya' };

  const elForm = document.getElementById('rbFormWrap');
  const elIsi = document.getElementById('rbIsi');

  document.getElementById('rbBtnBuat').addEventListener('click', () => { elForm.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.getElementById('rbBtnBatal').addEventListener('click', () => { elForm.style.display = 'none'; document.getElementById('formRetur').reset(); });

  async function muatPilihanBarang_() {
    try {
      const d = await apiPost('getDaftarBarangUntukForm', { token: TOKEN });
      document.getElementById('rbDaftarBarang').innerHTML = d.barang.map(b => `<option value="${escapeHtml(b.nama)}">`).join('');
      document.getElementById('rbKategori').innerHTML = '<option value="">Pilih Kategori (opsional)...</option>' + d.kategori.map(k => `<option value="${escapeHtml(k.nama)}">${escapeHtml(k.nama)}</option>`).join('');
    } catch (err) { /* bantuan pengisian saja */ }
  }

  async function muat() {
    elIsi.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const daftar = await apiPost('getReturBarangKoordinator', { token: TOKEN });
      if (!daftar.length) { elIsi.innerHTML = '<div class="empty-state">Belum ada pengajuan retur.</div>'; return; }
      elIsi.innerHTML = `
        <div class="table-wrap">
          <table class="tabel-jadi-kartu">
            <thead><tr><th>Tanggal</th><th>Barang</th><th>Jumlah</th><th>Alasan</th><th>Status</th><th>Catatan Gudang</th></tr></thead>
            <tbody>
              ${daftar.map(r => `
                <tr>
                  <td data-label="Tanggal">${escapeHtml(r.tanggal)}</td>
                  <td data-label="Barang"><b>${escapeHtml(r.namaBarang)}</b></td>
                  <td data-label="Jumlah">${escapeHtml(r.jumlah)} ${escapeHtml(r.satuan || '')}</td>
                  <td data-label="Alasan">${LABEL_ALASAN[r.alasanRetur] || r.alasanRetur}</td>
                  <td data-label="Status"><span class="badge ${BADGE_STATUS[r.status] || 'belum-absen'}">${LABEL_STATUS[r.status] || r.status}</span></td>
                  <td data-label="Catatan Gudang">${escapeHtml(r.catatanGudang || '-')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      elIsi.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  document.getElementById('formRetur').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Mengirim...';
    try {
      await apiPost('ajukanRetur', {
        token: TOKEN, namaBarang: document.getElementById('rbNamaBarang').value.trim(),
        kategori: document.getElementById('rbKategori').value, jumlah: document.getElementById('rbJumlah').value,
        satuan: document.getElementById('rbSatuan').value.trim(), alasanRetur: document.getElementById('rbAlasan').value,
        kondisiBarang: document.getElementById('rbKondisi').value.trim(), uraian: document.getElementById('rbUraian').value.trim()
      });
      showSuccess('Pengajuan retur terkirim, menunggu pemeriksaan gudang.');
      e.target.reset();
      elForm.style.display = 'none';
      muat();
    } catch (err) {
      showError(err.message || 'Gagal mengajukan retur.');
    } finally {
      btn.disabled = false; btn.textContent = 'Ajukan Retur';
    }
  });

  muatPilihanBarang_();
  muat();
});

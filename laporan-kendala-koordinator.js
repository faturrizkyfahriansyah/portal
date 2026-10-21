// laporan-kendala-koordinator.js — Laporan & Kendala (21 Okt 2026,
// dokumen Fitur Koordinator §7). Status PENGIRIMAN (tersimpan di
// server) BEDA dari status PENYELESAIAN (MENUNGGU/DIPROSES/dst) --
// laporan terkirim BUKAN berarti kendala selesai.
document.addEventListener('DOMContentLoaded', () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) { window.location.href = 'login.html'; return; }
  const TOKEN = sesi.token;

  const LABEL_JENIS = { PERSONEL: 'Kekurangan Personel', PERALATAN: 'Kerusakan Peralatan', BAHAN: 'Kekurangan Bahan', PROSES_KERJA: 'Proses Kerja', KEBERSIHAN_KEAMANAN_PANGAN: 'Kebersihan/Keamanan Pangan', DISTRIBUSI: 'Distribusi', LAINNYA: 'Lainnya' };
  const LABEL_STATUS = { MENUNGGU: 'Menunggu', DIPROSES: 'Diproses', PERLU_INFO_TAMBAHAN: 'Perlu Info Tambahan', SELESAI: 'Selesai' };
  const BADGE_STATUS = { MENUNGGU: 'belum-absen', DIPROSES: 'terlambat', PERLU_INFO_TAMBAHAN: 'terlambat', SELESAI: 'hadir' };

  const elForm = document.getElementById('lkFormWrap');
  const elIsi = document.getElementById('lkIsi');

  document.getElementById('lkBtnBuat').addEventListener('click', () => { elForm.style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.getElementById('lkBtnBatal').addEventListener('click', () => { elForm.style.display = 'none'; document.getElementById('formLaporan').reset(); });

  async function muat() {
    elIsi.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const daftar = await apiPost('getLaporanKendalaKoordinator', { token: TOKEN });
      if (!daftar.length) { elIsi.innerHTML = '<div class="empty-state">Belum ada laporan kendala.</div>'; return; }
      elIsi.innerHTML = daftar.map(l => `
        <div class="panel-block" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <span class="badge ${BADGE_STATUS[l.status] || 'belum-absen'}">${LABEL_STATUS[l.status] || l.status}</span>
              <p style="margin:6px 0 2px;font-weight:700;">${escapeHtml(l.judul)}</p>
              <p style="margin:0;font-size:11px;color:var(--color-text-muted);">${escapeHtml(LABEL_JENIS[l.jenisKendala] || l.jenisKendala)} · ${escapeHtml(l.tanggal)} · #${escapeHtml(l.id)}</p>
              <p style="margin:6px 0 0;font-size:13px;">${escapeHtml(l.uraian)}</p>
              ${l.catatanTindakLanjut ? `<div style="background:var(--color-bg);border-radius:8px;padding:8px 10px;margin-top:8px;"><p style="margin:0;font-size:11px;font-weight:700;color:var(--color-text-muted);">CATATAN TINDAK LANJUT</p><p style="margin:2px 0 0;font-size:13px;">${escapeHtml(l.catatanTindakLanjut)}</p></div>` : ''}
            </div>
          </div>
        </div>`).join('');
    } catch (err) {
      elIsi.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  document.getElementById('formLaporan').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Mengirim...';
    try {
      await apiPost('buatLaporanKendala', {
        token: TOKEN, jenisKendala: document.getElementById('lkJenis').value,
        judul: document.getElementById('lkJudul').value.trim(), uraian: document.getElementById('lkUraian').value.trim(),
        dampakUrgensi: document.getElementById('lkDampak').value.trim(), tindakanAwal: document.getElementById('lkTindakan').value.trim(),
        tujuan: document.getElementById('lkTujuan').value.trim()
      });
      showSuccess('Laporan terkirim. Status penyelesaian masih "Menunggu" sampai ditangani.');
      e.target.reset();
      elForm.style.display = 'none';
      muat();
    } catch (err) {
      showError(err.message || 'Gagal mengirim laporan.');
    } finally {
      btn.disabled = false; btn.textContent = 'Kirim Laporan';
    }
  });

  muat();
});

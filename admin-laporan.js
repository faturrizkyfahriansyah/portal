// admin-laporan.js — Laporan SIPIKA (Keputusan Final Implementasi #2).
// Kategori "Koreksi Presensi" -- satu-satunya yg dibangun tahap ini.
// Lazy-loaded via MODUL_LAZY (admin.js) saat panelLaporan dibuka.
(function () {
  function token() { return window.sppgAdminToken; } // pola sama dgn modul lazy-load lain

  const el = {
    dari: document.getElementById('laporanKoreksiDari'),
    sampai: document.getElementById('laporanKoreksiSampai'),
    btnMuat: document.getElementById('btnMuatLaporanKoreksi'),
    btnExport: document.getElementById('btnExportLaporanKoreksi'),
    tbody: document.getElementById('tbodyLaporanKoreksi')
  };

  const LABEL_AKSI = {
    UBAH_JADWAL_INDIVIDU: 'Ubah Jadwal', HAPUS_JADWAL_INDIVIDU: 'Hapus Jadwal',
    KOREKSI_ABSENSI_AKTUAL: 'Koreksi Absen', KOREKSI_OPERASIONAL_ABSENSI: 'Pindah Tanggal',
    TANDAI_HADIR_MANUAL: 'Tandai Hadir Manual', HAPUS_ABSENSI: 'Hapus Presensi'
  };

  let dataTerakhir = [];

  function toDateInput(d) { return d.toISOString().slice(0, 10); }
  function isiDefaultTanggal() {
    const now = new Date();
    const sebulanLalu = new Date(now.getTime() - 30 * 86400000);
    el.sampai.value = toDateInput(now);
    el.dari.value = toDateInput(sebulanLalu);
  }

  async function muatLaporan() {
    if (!el.dari.value || !el.sampai.value) { showError('Pilih rentang tanggal dulu.'); return; }
    el.tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const hasil = await apiPost('getLaporanKoreksiPresensi', { token: token(), dari: el.dari.value, sampai: el.sampai.value });
      dataTerakhir = hasil.data;
      if (!dataTerakhir.length) { el.tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Tidak ada koreksi presensi pada rentang tanggal ini.</div></td></tr>'; return; }
      el.tbody.innerHTML = dataTerakhir.map(r => `<tr>
        <td>${escapeHtml(formatWaktuLaporan_(r.waktu))}</td>
        <td>${escapeHtml(LABEL_AKSI[r.aksi] || r.aksi)}</td>
        <td>${escapeHtml(r.petugas || '-')}</td>
        <td>${escapeHtml(r.keterangan || '-')}</td>
        <td>${escapeHtml(r.ringkasan || '-')}</td>
      </tr>`).join('');
    } catch (err) {
      el.tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">❌ ${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  function formatWaktuLaporan_(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  el.btnMuat.addEventListener('click', muatLaporan);

  el.btnExport.addEventListener('click', () => {
    if (!dataTerakhir.length) { showError('Belum ada data untuk diekspor -- klik Tampilkan dulu.'); return; }
    const header = ['Waktu', 'Jenis Koreksi', 'Petugas', 'Keterangan Admin', 'Ringkasan Perubahan'];
    const baris = dataTerakhir.map(r => [
      formatWaktuLaporan_(r.waktu), LABEL_AKSI[r.aksi] || r.aksi, r.petugas || '', r.keterangan || '', r.ringkasan || ''
    ]);
    const csv = [header, ...baris].map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'laporan-koreksi-presensi-' + el.dari.value + '-sd-' + el.sampai.value + '.csv';
    a.click();
  });

  isiDefaultTanggal();
  muatLaporan();
})();

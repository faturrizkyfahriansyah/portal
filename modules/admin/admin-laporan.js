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

  // ===== LAPORAN RELAWAN (P3C) =====
  const elR = {
    btnMuat: document.getElementById('btnMuatLaporanRelawan'),
    btnExport: document.getElementById('btnExportLaporanRelawan'),
    ringkasan: document.getElementById('ringkasanLaporanRelawan'),
    tbody: document.getElementById('tbodyLaporanRelawan')
  };
  let dataRelawanTerakhir = [];

  async function muatLaporanRelawan() {
    elR.tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const hasil = await apiPost('getLaporanRelawan', { token: token() });
      dataRelawanTerakhir = hasil.daftar;
      elR.ringkasan.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        <span class="badge aktif">Aktif: ${hasil.totalAktif}</span>
        <span class="badge nonaktif">Nonaktif: ${hasil.totalNonaktif}</span>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Divisi</th><th>Aktif</th><th>Nonaktif</th></tr></thead><tbody>
        ${hasil.ringkasanDivisi.map(d => `<tr><td>${escapeHtml(d.divisi)}</td><td>${d.aktif}</td><td>${d.nonaktif}</td></tr>`).join('')}
      </tbody></table></div>`;
      elR.tbody.innerHTML = dataRelawanTerakhir.map(r => `<tr>
        <td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.nama)}</td><td>${escapeHtml(r.divisi || '-')}</td>
        <td><span class="badge ${String(r.status).toUpperCase() === 'AKTIF' ? 'aktif' : 'nonaktif'}">${escapeHtml(r.status)}</span></td>
      </tr>`).join('');
    } catch (err) {
      elR.tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">❌ ${escapeHtml(err.message)}</div></td></tr>`;
    }
  }
  elR.btnMuat.addEventListener('click', muatLaporanRelawan);
  elR.btnExport.addEventListener('click', () => {
    if (!dataRelawanTerakhir.length) { showError('Belum ada data -- klik Tampilkan dulu.'); return; }
    const header = ['ID', 'Nama', 'Divisi', 'Status'];
    const baris = dataRelawanTerakhir.map(r => [r.id, r.nama, r.divisi || '', r.status]);
    const csv = [header, ...baris].map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'laporan-relawan.csv';
    a.click();
  });
  muatLaporanRelawan();

  // ===== LAPORAN JADWAL & PENUGASAN (P3C) =====
  const elJ = {
    periode: document.getElementById('laporanJadwalPeriode'),
    divisi: document.getElementById('laporanJadwalDivisi'),
    btnMuat: document.getElementById('btnMuatLaporanJadwal'),
    btnExport: document.getElementById('btnExportLaporanJadwal'),
    tbody: document.getElementById('tbodyLaporanJadwal')
  };
  let dataJadwalTerakhir = [];

  async function isiDropdownPeriodeDivisiLaporan() {
    try {
      const [periodeList, divisiList] = await Promise.all([
        apiGet('getPeriodeListAdmin', { token: token() }),
        apiGetCached('getDivisi', { token: token() }, 600000)
      ]);
      elJ.periode.innerHTML = periodeList.map(p => `<option value="${escapeHtml(p.id)}" ${p.aktif ? 'selected' : ''}>${escapeHtml(p.nama)}${p.aktif ? ' (Aktif)' : ''}</option>`).join('');
      elJ.divisi.innerHTML = '<option value="">Semua Divisi</option>' + divisiList.map(d => `<option value="${escapeHtml(d.nama)}">${escapeHtml(d.nama)}</option>`).join('');
    } catch (e) { /* biarkan kosong kalau gagal -- tombol Tampilkan akan tetap menampilkan error yg jelas */ }
  }

  async function muatLaporanJadwal() {
    if (!elJ.periode.value) { showError('Pilih periode dulu.'); return; }
    elJ.tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const hasil = await apiPost('getLaporanJadwalPenugasan', { token: token(), idPeriode: elJ.periode.value, divisi: elJ.divisi.value });
      dataJadwalTerakhir = hasil.data;
      if (!dataJadwalTerakhir.length) { elJ.tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Tidak ada relawan aktif pada divisi ini.</div></td></tr>'; return; }
      const labelStatus = { sesuai: 'Sesuai', kurang: 'Kurang', berlebih: 'Berlebih' };
      elJ.tbody.innerHTML = dataJadwalTerakhir.map(r => `<tr>
        <td>${escapeHtml(r.nama)}</td><td>${escapeHtml(r.divisi || '-')}</td><td>${r.target}</td><td>${r.terjadwal}</td>
        <td><span class="badge ${r.status === 'sesuai' ? 'aktif' : 'nonaktif'}">${labelStatus[r.status] || r.status}</span></td>
      </tr>`).join('');
    } catch (err) {
      elJ.tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">❌ ${escapeHtml(err.message)}</div></td></tr>`;
    }
  }
  elJ.btnMuat.addEventListener('click', muatLaporanJadwal);
  elJ.btnExport.addEventListener('click', () => {
    if (!dataJadwalTerakhir.length) { showError('Belum ada data -- klik Tampilkan dulu.'); return; }
    const header = ['Nama', 'Divisi', 'Target', 'Terjadwal', 'Status'];
    const baris = dataJadwalTerakhir.map(r => [r.nama, r.divisi || '', r.target, r.terjadwal, r.status]);
    const csv = [header, ...baris].map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'laporan-jadwal-penugasan-' + elJ.periode.value + '.csv';
    a.click();
  });
  isiDropdownPeriodeDivisiLaporan();
})();

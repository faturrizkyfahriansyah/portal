// jadwal-anggota.js — Jadwal Anggota utk Koordinator Operasional (18
// Okt 2026, SIKOP). Gerbang akses SUNGGUHAN ada di server
// (getJadwalAnggotaKoordinator menolak non-Koordinator) -- halaman ini
// cuma MEMANGGIL & MENAMPILKAN, bukan tempat otorisasi.
document.addEventListener('DOMContentLoaded', () => {
  const sesi = ambilSesiRelawan(); // helper yg SAMA dipakai monitoring.js -- BUKAN localStorage langsung
  if (!sesi || !sesi.token) { window.location.href = 'login.html'; return; }
  const TOKEN = sesi.token;

  function tanggalKeDMY_(iso) {
    const b = iso.split('-');
    return b[2] + '/' + b[1] + '/' + b[0];
  }
  function dmyKeIso_(dmy) {
    const b = dmy.split('/');
    return b[2] + '-' + b[1] + '-' + b[0];
  }

  const elTanggal = document.getElementById('jaTanggal');
  const elIsi = document.getElementById('jaIsi');

  async function muat() {
    const tanggalDMY = elTanggal.value ? tanggalKeDMY_(elTanggal.value) : '';
    elIsi.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const hasil = await apiPost('getJadwalAnggotaKoordinator', { token: TOKEN, tanggal: tanggalDMY });

      if (!elTanggal.value) elTanggal.value = dmyKeIso_(hasil.tanggal);

      if (!hasil.data.length) {
        elIsi.innerHTML = `<div class="empty-state">Tidak ada jadwal untuk divisi ${escapeHtml(hasil.divisi)} pada tanggal ${escapeHtml(hasil.tanggal)}.</div>`;
        return;
      }

      elIsi.innerHTML = `
        <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px;">Divisi: <b style="color:var(--color-navy);">${escapeHtml(hasil.divisi)}</b> · ${hasil.jumlahAnggota} anggota terjadwal · ${escapeHtml(hasil.tanggal)}</p>
        <div class="table-wrap">
          <table class="tabel-jadi-kartu">
            <thead><tr><th>Nama</th><th>ID</th><th>Shift</th><th>Jam Jadwal</th><th>Status</th><th>Jam Aktual</th></tr></thead>
            <tbody>
              ${hasil.data.map(a => `
                <tr>
                  <td data-label="Nama"><b>${escapeHtml(a.nama)}</b></td>
                  <td data-label="ID">${escapeHtml(a.idRelawan || '-')}</td>
                  <td data-label="Shift">${escapeHtml(a.namaShift || '-')}</td>
                  <td data-label="Jam Jadwal">${escapeHtml(a.jamMasukJadwal)}${a.jamPulangJadwal ? ' - ' + escapeHtml(a.jamPulangJadwal) : ''}</td>
                  <td data-label="Status"><span class="badge ${a.status === 'BELUM ABSEN' ? 'nonaktif' : (a.status === 'HADIR' || a.status === 'TERLAMBAT' ? 'aktif' : 'nonaktif')}">${escapeHtml(a.status)}</span></td>
                  <td data-label="Jam Aktual">${a.jamMasukAktual ? escapeHtml(a.jamMasukAktual) + (a.jamPulangAktual ? ' - ' + escapeHtml(a.jamPulangAktual) : ' (belum pulang)') : '-'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      elIsi.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  elTanggal.addEventListener('change', muat);
  document.getElementById('jaBtnHariIni').addEventListener('click', () => { elTanggal.value = ''; muat(); });

  muat();
});

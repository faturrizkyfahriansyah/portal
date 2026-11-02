// monitoring-kehadiran-koordinator.js — Monitoring Kehadiran utk
// Koordinator Operasional (21 Okt 2026, dokumen Fitur Koordinator).
// Pakai ULANG getJadwalAnggotaKoordinator (SAMA PERSIS dgn Jadwal
// Relawan) -- SATU sumber data (roster resmi + SIPRES), BUKAN sistem
// absensi baru. Bedanya cuma penekanan tampilan: di sini status &
// keterlambatan yg ditonjolkan, bukan jadwalnya.
document.addEventListener('DOMContentLoaded', () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) { window.location.href = 'login.html'; return; }
  const TOKEN = sesi.token;

  function tanggalKeDMY_(iso) { const b = iso.split('-'); return b[2] + '/' + b[1] + '/' + b[0]; }
  function dmyKeIso_(dmy) { const b = dmy.split('/'); return b[2] + '-' + b[1] + '-' + b[0]; }

  const LABEL_STATUS = {
    'BELUM ABSEN': 'Belum Masuk', 'HADIR': 'Sudah Masuk', 'HADIR LENGKAP': 'Sudah Pulang',
    'TERLAMBAT': 'Terlambat', 'IZIN': 'Izin', 'SAKIT': 'Sakit', 'ALFA': 'Alfa'
  };
  const BADGE_STATUS = {
    'BELUM ABSEN': 'belum-absen', 'HADIR': 'hadir', 'HADIR LENGKAP': 'hadir',
    'TERLAMBAT': 'terlambat', 'IZIN': 'izin', 'SAKIT': 'sakit', 'ALFA': 'sakit'
  };

  const elTanggal = document.getElementById('mkTanggal');
  const elIsi = document.getElementById('mkIsi');
  const elWaktuMuat = document.getElementById('mkWaktuMuat');

  async function muat() {
    const tanggalDMY = elTanggal.value ? tanggalKeDMY_(elTanggal.value) : '';
    elIsi.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const hasil = await apiPost('getJadwalAnggotaKoordinator', { token: TOKEN, tanggal: tanggalDMY });
      if (!elTanggal.value) elTanggal.value = dmyKeIso_(hasil.tanggal);
      elWaktuMuat.textContent = 'Data per ' + new Date(hasil.waktuDimuat || Date.now()).toLocaleTimeString('id-ID');

      if (!hasil.data.length) {
        elIsi.innerHTML = `<div class="empty-state">Tidak ada jadwal untuk divisi ${escapeHtml(hasil.divisi)} pada tanggal ${escapeHtml(hasil.tanggal)}, jadi tidak ada yang bisa dipantau.</div>`;
        return;
      }

      elIsi.innerHTML = `
        <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px;">Divisi: <b style="color:var(--color-navy);">${escapeHtml(hasil.divisi)}</b> · ${hasil.jumlahAnggota} anggota terjadwal · ${escapeHtml(hasil.tanggal)}</p>
        <div class="table-wrap">
          <table class="tabel-jadi-kartu">
            <thead><tr><th>Nama</th><th>Jadwal Masuk</th><th>Masuk Aktual</th><th>Jadwal Pulang</th><th>Pulang Aktual</th><th>Status</th></tr></thead>
            <tbody>
              ${hasil.data.map(a => `
                <tr>
                  <td data-label="Nama"><b>${escapeHtml(a.nama)}</b></td>
                  <td data-label="Jadwal Masuk">${escapeHtml(a.jamMasukJadwal || '-')}</td>
                  <td data-label="Masuk Aktual">${a.jamMasukAktual ? escapeHtml(a.jamMasukAktual) : '-'}${a.menitTerlambat ? ` <span style="color:var(--color-warning);font-size:11px;">(telat ${a.menitTerlambat} mnt)</span>` : ''}</td>
                  <td data-label="Jadwal Pulang">${escapeHtml(a.jamPulangJadwal || '-')}</td>
                  <td data-label="Pulang Aktual">${a.jamPulangAktual ? escapeHtml(a.jamPulangAktual) : '-'}</td>
                  <td data-label="Status"><span class="badge ${BADGE_STATUS[a.status] || 'belum-absen'}">${escapeHtml(LABEL_STATUS[a.status] || a.status)}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      elIsi.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  elTanggal.addEventListener('change', muat);
  document.getElementById('mkBtnHariIni').addEventListener('click', () => { elTanggal.value = ''; muat(); });
  // Segarkan (diminta dokumen: "penyegaran data tanpa harus keluar-masuk") --
  // panggil ULANG dgn tanggal yg SAMA, bukan reset ke hari ini.
  document.getElementById('mkBtnRefresh').addEventListener('click', muat);

  muat();
});

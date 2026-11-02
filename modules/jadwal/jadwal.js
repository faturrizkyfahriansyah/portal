// SPPG JEUNGJING — LOGIC HALAMAN JADWAL & PENUGASAN (jadwal.html)

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('jadwalMain');
  const list = document.getElementById('jadwalList');

  try {
    showLoading('Memuat jadwal...');
    const data = await apiGet('getJadwalRelawan', { token: sesi.token });
    hideLoading();

    if (!data.length) {
      list.innerHTML = `<div class="jadwal-card"><div class="jadwal-card-body"><p class="jadwal-card-ket">Belum ada jadwal atau penugasan untuk Anda saat ini.</p></div></div>`;
    } else {
      list.innerHTML = data.map(j => {
        const [dd, mm] = j.tanggal.split('/');
        const namaBulanSingkat = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const statusClass = ['Terjadwal', 'Selesai', 'Dibatalkan'].includes(j.status) ? j.status : 'Terjadwal';
        return `
        <div class="jadwal-card">
          <div class="jadwal-card-date">
            <span class="jadwal-card-day">${j.hari || ''}</span>
            <span class="jadwal-card-num">${dd} ${namaBulanSingkat[Number(mm) - 1]}</span>
            ${j.waktu ? `<span class="jadwal-card-time">${escapeHtml(j.waktu)}</span>` : ''}
          </div>
          <div class="jadwal-card-body">
            <p class="jadwal-card-title">${escapeHtml(j.penugasan)}</p>
            ${j.keterangan ? `<p class="jadwal-card-ket">${escapeHtml(j.keterangan)}</p>` : ''}
            <span class="jadwal-card-status ${statusClass}">${escapeHtml(j.status || 'Terjadwal')}</span>
          </div>
        </div>`;
      }).join('');
    }

    main.style.display = 'block';
  } catch (err) {
    hideLoading();
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat jadwal.');
  }
});

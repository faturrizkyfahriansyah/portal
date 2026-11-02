// SPPG JEUNGJING — LOGIC HALAMAN INFORMASI (informasi.html)

/** tanggal "dd/MM/yyyy" -> "15 Agustus 2026". */
function formatTanggalPanjangIndo(tanggalDMY) {
  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const [dd, mm, yyyy] = tanggalDMY.split('/').map(Number);
  return `${dd} ${namaBulan[mm - 1]} ${yyyy}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('informasiMain');
  const list = document.getElementById('informasiList');

  try {
    showLoading('Memuat informasi...');
    const data = await apiGet('getInformasiRelawan', { token: sesi.token });
    hideLoading();

    if (!data.length) {
      list.innerHTML = `<div class="info-card"><p class="info-card-body">Belum ada informasi saat ini.</p></div>`;
    } else {
      list.innerHTML = data.map(i => `
        <div class="info-card">
          <p class="info-card-date">${formatTanggalPanjangIndo(i.tanggal)}</p>
          <h3 class="info-card-title">${escapeHtml(i.judul)}</h3>
          <p class="info-card-body">${escapeHtml(i.isi)}</p>
        </div>`).join('');
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
    showError(err.message || 'Gagal memuat informasi.');
  }
});

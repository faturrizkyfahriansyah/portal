// SPPG JEUNGJING — LOGIC HALAMAN RIWAYAT PRESENSI (riwayat.html)
// Roster-first: periode aktif otomatis, grid 2x3 statistik, card vertikal,
// detail sheet saat kartu ditekan. Menggunakan fungsi bersama dari
// common.js (apiGet, dst.) dan auth-relawan.js.

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const NAMA_BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function parseTanggalDMY(tanggalStr) {
  const [dd, mm, yyyy] = tanggalStr.split('/').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function formatTanggalPanjang(tanggalStr) {
  const d = parseTanggalDMY(tanggalStr);
  return `${d.getDate()} ${NAMA_BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
}

function badgeClassUntukStatus(status) {
  const peta = {
    'HADIR': 'hadir', 'HADIR LENGKAP': 'hadir', 'TERLAMBAT': 'terlambat',
    'IZIN': 'izin', 'SAKIT': 'sakit', 'CUTI': 'cuti',
    'TIDAK HADIR': 'tidak-hadir', 'BELUM ABSEN': 'belum-absen', 'BELUM PULANG': 'terlambat'
  };
  return peta[status] || 'belum-absen';
}

function labelStatus(status) {
  const peta = { 'HADIR LENGKAP': 'HADIR' };
  return peta[status] || status;
}

let dataRiwayatTerkini = [];

function renderKartuRiwayat(items) {
  const list = document.getElementById('riwayatList');
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">Belum ada jadwal pada periode ini.</div>';
    return;
  }
  list.innerHTML = items.map((r, i) => {
    const d = parseTanggalDMY(r.tanggal);
    const namaHari = NAMA_HARI[d.getDay()];
    const tglSingkat = `${d.getDate()} ${NAMA_BULAN_SINGKAT[d.getMonth()]}`;
    const jadwalText = (r.jamJadwalMasuk || '–') + (r.jamJadwalPulang ? ' – ' + r.jamJadwalPulang.slice(0, 5) : '');
    return `
    <button type="button" class="riwayat-item is-${badgeClassUntukStatus(r.status)}" data-idx="${i}">
      <div class="riwayat-item-date">
        <span class="riwayat-day-name">${namaHari}</span>
        <span class="riwayat-day-num">${tglSingkat}</span>
      </div>
      <div class="riwayat-item-detail">
        <div class="riwayat-item-top">
          <strong class="riwayat-item-shift">${escapeHtml(r.namaShift || r.divisi || '')}</strong>
          <span class="riwayat-badge ${badgeClassUntukStatus(r.status)}">${labelStatus(r.status)}</span>
        </div>
        <div class="riwayat-item-jam">Jadwal ${jadwalText.slice(0, 5) === '–' ? jadwalText : jadwalText}</div>
        <div class="riwayat-item-jam">Masuk ${r.jamMasuk ? r.jamMasuk.slice(0, 5) : '—'} · Pulang ${r.jamPulang ? r.jamPulang.slice(0, 5) : '—'}</div>
      </div>
    </button>`;
  }).join('');

  list.querySelectorAll('.riwayat-item').forEach(el => {
    el.addEventListener('click', () => bukaDetailSheet(items[Number(el.dataset.idx)]));
  });
}

function barisDetail(label, value) {
  if (value === null || value === undefined || value === '') return '';
  return `<div class="detail-row"><span class="detail-row-label">${label}</span><span class="detail-row-value">${value}</span></div>`;
}

function bukaDetailSheet(r) {
  const body = document.getElementById('detailSheetBody');
  const d = parseTanggalDMY(r.tanggal);
  const namaHari = NAMA_HARI[d.getDay()];

  let html = `
    <div class="detail-sheet-head">
      <span class="riwayat-badge ${badgeClassUntukStatus(r.status)}">${labelStatus(r.status)}</span>
      <h2>${namaHari}, ${formatTanggalPanjang(r.tanggal)}</h2>
    </div>
    <div class="detail-section">
      ${barisDetail('Divisi', escapeHtml(r.divisi || '-'))}
      ${barisDetail('Jadwal Shift', escapeHtml(r.namaShift || '-'))}
      ${barisDetail('Jam Jadwal', (r.jamJadwalMasuk || '–') + (r.jamJadwalPulang ? ' – ' + r.jamJadwalPulang : ''))}
      ${barisDetail('Jam Masuk Aktual', r.jamMasuk ? r.jamMasuk.slice(0, 5) : '—')}
      ${barisDetail('Jam Pulang Aktual', r.jamPulang ? r.jamPulang.slice(0, 5) : '—')}
      ${r.keterlambatanMenit > 0 ? barisDetail('Keterlambatan', r.keterlambatanMenit + ' menit') : ''}
    </div>`;

  if (r.masuk) {
    html += `
    <p class="detail-section-title">Presensi Masuk</p>
    <div class="detail-section">
      ${barisDetail('Waktu', r.masuk.jam ? r.masuk.jam.slice(0, 5) : '-')}
      ${r.masuk.jarakMeter !== null ? barisDetail('Jarak dari Lokasi', '±' + r.masuk.jarakMeter + ' m') : ''}
      ${r.masuk.fotoUrl ? `<a href="${r.masuk.fotoUrl}" target="_blank" rel="noopener" class="detail-foto-link">Lihat Swafoto Masuk →</a>` : ''}
    </div>`;
  }
  if (r.pulang) {
    html += `
    <p class="detail-section-title">Presensi Pulang</p>
    <div class="detail-section">
      ${barisDetail('Waktu', r.pulang.jam ? r.pulang.jam.slice(0, 5) : '-')}
      ${r.pulang.jarakMeter !== null ? barisDetail('Jarak dari Lokasi', '±' + r.pulang.jarakMeter + ' m') : ''}
      ${r.pulang.fotoUrl ? `<a href="${r.pulang.fotoUrl}" target="_blank" rel="noopener" class="detail-foto-link">Lihat Swafoto Pulang →</a>` : ''}
    </div>`;
  }

  body.innerHTML = html;
  document.getElementById('detailSheetOverlay').classList.remove('is-hidden');
}

function tutupDetailSheet() {
  document.getElementById('detailSheetOverlay').classList.add('is-hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('btnTutupDetail').addEventListener('click', tutupDetailSheet);
  document.getElementById('detailSheetOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'detailSheetOverlay') tutupDetailSheet();
  });

  const main = document.getElementById('riwayatMain');
  const kosong = document.getElementById('riwayatKosong');

  try {
    showLoading('Memuat riwayat presensi...');
    const hasil = await apiGet('getRiwayatAbsensiRelawan', { token: sesi.token });
    hideLoading();

    if (!hasil.periode) {
      kosong.style.display = 'block';
      return;
    }

    // Perbaikan 18 Okt 2026 (diminta Admin): cukup judul periode yang
    // DIBUAT PENGELOLA (mis. "Periode 16-29 September 2026" kalau itu
    // namanya), TANPA rentang tanggal mentah di belakangnya -- nama
    // periode itu sendiri sudah cukup jelas, tidak perlu diulang.
    document.getElementById('periodeRange').textContent = hasil.periode.nama;
    document.getElementById('periodeTotalJadwal').textContent = hasil.totalJadwal;

    const s = hasil.stats || {};
    document.getElementById('statHadir').textContent = s.hadir || 0;
    document.getElementById('statTerlambat').textContent = s.terlambat || 0;
    document.getElementById('statIzin').textContent = s.izin || 0;
    document.getElementById('statSakit').textContent = s.sakit || 0;
    document.getElementById('statCuti').textContent = s.cuti || 0;
    document.getElementById('statTidakHadir').textContent = s.tidakHadir || 0;

    dataRiwayatTerkini = hasil.items || [];
    renderKartuRiwayat(dataRiwayatTerkini);

    main.style.display = 'block';
  } catch (err) {
    hideLoading();
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat riwayat.');
    kosong.textContent = 'Data belum dapat dimuat. Periksa koneksi internet Anda.';
    kosong.style.display = 'block';
  }
});

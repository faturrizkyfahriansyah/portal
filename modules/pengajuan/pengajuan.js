// SPPG JEUNGJING — LOGIC HALAMAN PENGAJUAN KETIDAKHADIRAN (pengajuan.html)
// Alur persetujuan BARU: MENUNGGU -> DISETUJUI/DITOLAK. Terpisah dari
// Riwayat Presensi. Menggunakan common.js (apiGet/apiPost) & auth-relawan.js.

const NAMA_HARI_PJ = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN_PJ = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

let jenisTerpilih = null;
let fileDokumenBase64 = null;

function bacaFileSebagaiDataUrl_(berkas) {
  return new Promise((resolve, reject) => {
    if (berkas.size > 5 * 1024 * 1024) { reject(new Error('Ukuran dokumen maksimal 5 MB.')); return; }
    const pembaca = new FileReader();
    pembaca.onerror = () => reject(new Error('Gagal membaca berkas dokumen.'));
    pembaca.onload = () => resolve(pembaca.result);
    pembaca.readAsDataURL(berkas);
  });
}

function badgeClassPengajuan(status) {
  const peta = { 'MENUNGGU': 'terlambat', 'DISETUJUI': 'hadir', 'DITOLAK': 'sakit', 'DIBATALKAN': 'tidak-hadir' };
  return peta[status] || 'tidak-hadir';
}

function formatTanggalRingkas(iso) {
  // input dari backend sudah dd/MM/yyyy
  const [dd, mm, yyyy] = iso.split('/').map(Number);
  return `${dd} ${NAMA_BULAN_PJ[mm - 1]} ${yyyy}`;
}

function perbaruiTombolKirim() {
  const alasan = document.getElementById('inputAlasanPengajuan').value.trim();
  const mulai = document.getElementById('inputTanggalMulai').value;
  const selesai = document.getElementById('inputTanggalSelesai').value;
  document.getElementById('btnKirimPengajuan').disabled = !(jenisTerpilih && alasan && mulai && selesai);
}

let riwayatPengajuanTerkini = [];

function renderRiwayatPengajuan(items) {
  const list = document.getElementById('riwayatPengajuanList');
  const kosong = document.getElementById('riwayatPengajuanKosong');
  if (!items.length) {
    list.innerHTML = '';
    kosong.style.display = 'block';
    return;
  }
  kosong.style.display = 'none';
  list.innerHTML = items.map((p, i) => {
    const rentang = p.tanggalMulai === p.tanggalSelesai
      ? formatTanggalRingkas(p.tanggalMulai)
      : `${formatTanggalRingkas(p.tanggalMulai)} – ${formatTanggalRingkas(p.tanggalSelesai)}`;
    return `
    <button type="button" class="riwayat-item is-${badgeClassPengajuan(p.status)}" data-idx="${i}">
      <div class="riwayat-item-detail">
        <div class="pengajuan-item-top">
          <strong class="pengajuan-item-jenis">${p.jenis}</strong>
          <span class="riwayat-badge ${badgeClassPengajuan(p.status)}">${p.status}</span>
        </div>
        <div class="riwayat-item-jam">${rentang}</div>
      </div>
    </button>`;
  }).join('');

  list.querySelectorAll('.riwayat-item').forEach(el => {
    el.addEventListener('click', () => bukaDetailPengajuan(items[Number(el.dataset.idx)]));
  });
}

function baris_(label, value) {
  if (value === null || value === undefined || value === '') return '';
  return `<div class="detail-row"><span class="detail-row-label">${label}</span><span class="detail-row-value">${value}</span></div>`;
}

function bukaDetailPengajuan(p) {
  const rentang = p.tanggalMulai === p.tanggalSelesai
    ? formatTanggalRingkas(p.tanggalMulai)
    : `${formatTanggalRingkas(p.tanggalMulai)} – ${formatTanggalRingkas(p.tanggalSelesai)}`;

  let html = `
    <div class="detail-sheet-head">
      <span class="riwayat-badge ${badgeClassPengajuan(p.status)}">${p.status}</span>
      <h2>${p.jenis} · ${rentang}</h2>
    </div>
    <div class="detail-section">
      ${baris_('Alasan', escapeHtml(p.alasan))}
      ${p.dokumenUrl ? `<div class="detail-row"><span class="detail-row-label">Dokumen</span><a href="${p.dokumenUrl}" target="_blank" rel="noopener" class="detail-row-value" style="color:var(--color-sky-deep);">Lihat →</a></div>` : ''}
      ${baris_('Waktu Pengajuan', p.dibuatPada ? new Date(p.dibuatPada).toLocaleString('id-ID') : '-')}
      ${p.diprosesPada ? baris_('Waktu Diproses', new Date(p.diprosesPada).toLocaleString('id-ID')) : ''}
    </div>`;

  if (p.status === 'DITOLAK' && p.catatanPengelola) {
    html += `<p class="detail-section-title">Catatan Pengelola</p><div class="detail-section"><div class="detail-row" style="display:block;padding:10px 0;">${escapeHtml(p.catatanPengelola)}</div></div>`;
  }
  if (p.status === 'MENUNGGU') {
    html += `<button type="button" class="btn-outline" id="btnBatalkanPengajuanIni" style="width:100%;margin-top:16px;" data-id="${p.id}">Batalkan Pengajuan</button>`;
  }

  document.getElementById('detailPengajuanBody').innerHTML = html;
  document.getElementById('detailPengajuanOverlay').classList.remove('is-hidden');

  const btnBatal = document.getElementById('btnBatalkanPengajuanIni');
  if (btnBatal) btnBatal.addEventListener('click', () => batalkanPengajuan(p.id));
}

async function batalkanPengajuan(id) {
  if (!confirm('Batalkan pengajuan ini?')) return;
  const sesi = ambilSesiRelawan();
  try {
    showLoading('Membatalkan...');
    await apiPost('batalkanPengajuanKetidakhadiran', { token: sesi.token, id: id });
    hideLoading();
    document.getElementById('detailPengajuanOverlay').classList.add('is-hidden');
    await muatRiwayatPengajuan();
  } catch (err) {
    hideLoading();
    showError(err.message || 'Gagal membatalkan pengajuan.');
  }
}

async function muatRiwayatPengajuan() {
  const sesi = ambilSesiRelawan();
  const hasil = await apiGet('getPengajuanKetidakhadiranRelawan', { token: sesi.token });
  riwayatPengajuanTerkini = hasil || [];
  renderRiwayatPengajuan(riwayatPengajuanTerkini);
}

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  document.querySelectorAll('.absensi-pill-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.absensi-pill-choice').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      jenisTerpilih = btn.dataset.jenis;
      perbaruiTombolKirim();
    });
  });

  document.getElementById('inputAlasanPengajuan').addEventListener('input', perbaruiTombolKirim);
  document.getElementById('inputTanggalMulai').addEventListener('change', () => {
    const mulai = document.getElementById('inputTanggalMulai').value;
    const selesaiInput = document.getElementById('inputTanggalSelesai');
    if (mulai && (!selesaiInput.value || selesaiInput.value < mulai)) selesaiInput.value = mulai;
    if (mulai) selesaiInput.min = mulai;
    perbaruiTombolKirim();
  });
  document.getElementById('inputTanggalSelesai').addEventListener('change', perbaruiTombolKirim);

  document.getElementById('inputDokumenPengajuan').addEventListener('change', async (e) => {
    const berkas = e.target.files[0];
    const label = document.getElementById('labelFileDokumen');
    if (!berkas) { label.textContent = 'Belum ada file dipilih'; fileDokumenBase64 = null; return; }
    try {
      fileDokumenBase64 = await bacaFileSebagaiDataUrl_(berkas);
      label.textContent = berkas.name;
    } catch (err) {
      showError(err.message);
      e.target.value = '';
      label.textContent = 'Belum ada file dipilih';
      fileDokumenBase64 = null;
    }
  });

  document.getElementById('btnKirimPengajuan').addEventListener('click', async () => {
    const tombol = document.getElementById('btnKirimPengajuan');
    tombol.disabled = true;
    tombol.textContent = 'Mengirim...';
    try {
      const payload = {
        token: sesi.token,
        jenis: jenisTerpilih,
        tanggalMulai: document.getElementById('inputTanggalMulai').value,
        tanggalSelesai: document.getElementById('inputTanggalSelesai').value,
        alasan: document.getElementById('inputAlasanPengajuan').value.trim()
      };
      if (fileDokumenBase64) payload.dokumenBase64 = fileDokumenBase64;

      await apiPost('ajukanKetidakhadiran', payload);

      document.getElementById('overlaySuksesPengajuan').classList.remove('is-hidden');
      // Reset form
      jenisTerpilih = null; fileDokumenBase64 = null;
      document.querySelectorAll('.absensi-pill-choice').forEach(b => b.classList.remove('selected'));
      document.getElementById('inputAlasanPengajuan').value = '';
      document.getElementById('inputTanggalMulai').value = '';
      document.getElementById('inputTanggalSelesai').value = '';
      document.getElementById('inputDokumenPengajuan').value = '';
      document.getElementById('labelFileDokumen').textContent = 'Belum ada file dipilih';

      await muatRiwayatPengajuan();
    } catch (err) {
      showError(err.message || 'Gagal mengirim pengajuan.');
    } finally {
      tombol.textContent = 'Ajukan';
      perbaruiTombolKirim();
    }
  });

  document.getElementById('btnTutupSuksesPengajuan').addEventListener('click', () => {
    document.getElementById('overlaySuksesPengajuan').classList.add('is-hidden');
  });
  document.getElementById('btnTutupDetailPengajuan').addEventListener('click', () => {
    document.getElementById('detailPengajuanOverlay').classList.add('is-hidden');
  });
  document.getElementById('detailPengajuanOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'detailPengajuanOverlay') document.getElementById('detailPengajuanOverlay').classList.add('is-hidden');
  });

  try {
    showLoading('Memuat data...');
    await muatRiwayatPengajuan();
    hideLoading();
  } catch (err) {
    hideLoading();
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat riwayat pengajuan.');
  }
});

// ============================================================
// SPPG JEUNGJING — LOGIC HALAMAN ABSENSI (absensi.html) — Fase 5
// Identitas dari SESSION PORTAL (bukan pilih Divisi/Nama manual lagi).
// Wajib: Swafoto (kamera langsung, bukan galeri) + GPS + validasi zona.
// ============================================================

let sesiAbsensi = null;
let statusTerkini = null;     // hasil getStatusAbsensiRelawan terakhir
let jenisAktif = null;        // 'MASUK' | 'PULANG' — jenis yang sedang diisi di form
let fotoDataUrl = null;       // hasil capture kamera (base64 data URL)
let lokasiSaya = null;        // { latitude, longitude, akurasi }
let zonaValid = false;        // hasil perhitungan jarak vs radius (client-side, hanya utk UX)
let streamKamera = null;      // MediaStream aktif, supaya bisa di-stop
// (variabel jenisIzinDipilih dipindah ke pengajuan.js -- tidak dipakai di sini lagi)

const el = {};

document.addEventListener('DOMContentLoaded', async () => {
  sesiAbsensi = ambilSesiRelawan();
  if (!sesiAbsensi || !sesiAbsensi.token) {
    window.location.href = 'login.html';
    return;
  }

  Object.assign(el, {
    absensiMain: document.getElementById('absensiMain'),
    absensiAvatar: document.getElementById('absensiAvatar'),
    absensiNama: document.getElementById('absensiNama'),
    absensiDivisiId: document.getElementById('absensiDivisiId'),

    stateKosong: document.getElementById('stateKosong'),
    pesanKosong: document.getElementById('pesanKosong'),

    ringkasanMasuk: document.getElementById('ringkasanMasuk'),
    ringkasanJamMasuk: document.getElementById('ringkasanJamMasuk'),
    ringkasanZonaMasuk: document.getElementById('ringkasanZonaMasuk'),

    stateKonfirmasi: document.getElementById('stateKonfirmasi'),
    confirmBanner: document.getElementById('confirmBanner'),
    confirmIcon: document.getElementById('confirmIcon'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmSub: document.getElementById('confirmSub'),
    btnLanjutkanAbsen: document.getElementById('btnLanjutkanAbsen'),

    overlaySuksesAbsen: document.getElementById('overlaySuksesAbsen'),
    suksesCircle: document.getElementById('suksesCircle'),
    suksesTitle: document.getElementById('suksesTitle'),
    suksesJenis: document.getElementById('suksesJenis'),
    suksesJam: document.getElementById('suksesJam'),
    suksesLokasi: document.getElementById('suksesLokasi'),
    btnTutupSukses: document.getElementById('btnTutupSukses'),

    stateForm: document.getElementById('stateForm'),
    labelJenis: document.getElementById('labelJenis'),
    judulForm: document.getElementById('judulForm'),
    cameraBox: document.getElementById('cameraBox'),
    cameraPlaceholder: document.getElementById('cameraPlaceholder'),
    videoLive: document.getElementById('videoLive'),
    fotoPreview: document.getElementById('fotoPreview'),
    btnAmbilFoto: document.getElementById('btnAmbilFoto'),
    btnUlangFoto: document.getElementById('btnUlangFoto'),
    canvasCapture: document.getElementById('canvasCapture'),
    gpsRow: document.getElementById('gpsRow'),
    zonaBadgeWrap: document.getElementById('zonaBadgeWrap'),
    inputKeteranganAbsen: document.getElementById('inputKeteranganAbsen'),
    btnKirimAbsen: document.getElementById('btnKirimAbsen'),

    stateSelesai: document.getElementById('stateSelesai'),
    detailInfoList: document.getElementById('detailInfoList'),
    detailFotoWrap: document.getElementById('detailFotoWrap')
  });

  el.btnAmbilFoto.addEventListener('click', ambilSwafoto);
  el.btnUlangFoto.addEventListener('click', mulaiKamera);
  el.inputKeteranganAbsen.addEventListener('input', perbaruiTombolKirim);
  el.btnKirimAbsen.addEventListener('click', kirimAbsensi);
  el.btnLanjutkanAbsen.addEventListener('click', lanjutkanKeForm);
  el.btnTutupSukses.addEventListener('click', tutupOverlaySukses);

  // Kamera & GPS dilepas kalau pengguna pindah halaman/menutup tab, supaya
  // tidak ada indikator kamera menyala terus tanpa alasan.
  window.addEventListener('pagehide', hentikanKamera);

  await muatStatusAbsensi();
});

// ------------------------------------------------------------
// MUAT STATUS (dipanggil saat buka halaman & setelah submit berhasil)
// ------------------------------------------------------------

async function muatStatusAbsensi() {
  hentikanKamera();
  showLoading('Memuat status absensi...');
  try {
    statusTerkini = await apiGet('getStatusAbsensiRelawan', { token: sesiAbsensi.token });
    hideLoading();
    renderStatus();
    el.absensiMain.style.display = 'block';
  } catch (err) {
    hideLoading();
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat status absensi.');
  }
}

function renderStatus() {
  const s = statusTerkini;

  el.absensiAvatar.textContent = initialsFromName(s.identitas.nama);
  el.absensiNama.textContent = s.identitas.nama;
  el.absensiDivisiId.textContent = s.identitas.id + ' • ' + s.identitas.divisi;

  // Sembunyikan semua state dulu, baru tampilkan satu yang sesuai.
  el.stateKosong.style.display = 'none';
  el.ringkasanMasuk.style.display = 'none';
  el.stateKonfirmasi.style.display = 'none';
  el.stateForm.style.display = 'none';
  el.stateSelesai.style.display = 'none';

  if (!s.operasional.ada) {
    el.stateKosong.style.display = 'block';
    return;
  }

  const masukIzinSakit = s.masuk.sudah && s.masuk.isIzinSakit;

  if (masukIzinSakit) {
    tampilkanSelesaiIzinSakit();
    return;
  }

  if (s.masuk.sudah && s.pulang.sudah) {
    tampilkanSelesaiLengkap();
    return;
  }

  if (s.masuk.sudah && !s.pulang.sudah) {
    el.ringkasanMasuk.style.display = 'block';
    el.ringkasanJamMasuk.textContent = s.masuk.jam || '–';
    el.ringkasanZonaMasuk.textContent = s.masuk.statusLokasi === 'DALAM_ZONA' ? 'Dalam zona disetujui' : 'Di luar zona';
    mulaiFormJenis('PULANG');
    return;
  }

  // Belum masuk sama sekali, operasional tersedia.
  mulaiFormJenis('MASUK');
}

// ------------------------------------------------------------
// STATE: FORM (Masuk/Pulang)
// ------------------------------------------------------------

function mulaiFormJenis(jenis) {
  jenisAktif = jenis;
  fotoDataUrl = null;
  lokasiSaya = null;
  zonaValid = false;

  // PERBAIKAN UX: jangan langsung nyalakan kamera. Tampilkan dulu banner
  // konfirmasi besar biar relawan sadar betul ini akan mencatat Masuk atau
  // Pulang, sebelum kamera/GPS aktif -- mencegah salah kirim tanpa sadar.
  const isMasuk = jenis === 'MASUK';
  el.confirmBanner.className = 'absensi-confirm-banner ' + (isMasuk ? 'jenis-masuk' : 'jenis-pulang');
  el.confirmIcon.className = 'absensi-confirm-icon';
  el.confirmIcon.textContent = isMasuk ? '→' : '←';
  el.confirmTitle.textContent = isMasuk ? 'Anda Akan Absen MASUK' : 'Anda Akan Absen PULANG';
  el.confirmSub.textContent = isMasuk
    ? 'Belum ada catatan hadir untuk operasional hari ini.'
    : 'Ini akan mengakhiri sesi kerja Anda untuk operasional hari ini.';
  el.btnLanjutkanAbsen.textContent = isMasuk ? 'Ya, Mulai Absen Masuk' : 'Ya, Mulai Absen Pulang';
  el.btnLanjutkanAbsen.className = 'btn-submit';

  el.stateKonfirmasi.style.display = 'block';
  el.stateForm.style.display = 'none';
}

function lanjutkanKeForm() {
  const jenis = jenisAktif;
  const isMasuk = jenis === 'MASUK';

  el.labelJenis.textContent = isMasuk ? 'PRESENSI MASUK' : 'PRESENSI PULANG';
  el.labelJenis.className = 'absensi-jenis-label ' + (isMasuk ? 'jenis-masuk' : 'jenis-pulang');
  el.judulForm.textContent = isMasuk ? 'Presensi Masuk' : 'Presensi Pulang';
  el.inputKeteranganAbsen.value = '';
  el.btnUlangFoto.style.display = 'none';
  el.fotoPreview.style.display = 'none';
  el.videoLive.style.display = 'none';
  el.cameraPlaceholder.style.display = 'block';
  el.cameraPlaceholder.textContent = '📷 Menyiapkan kamera…';

  el.stateKonfirmasi.style.display = 'none';
  el.stateForm.style.display = 'block';
  perbaruiTombolKirim();

  mulaiKamera();
  mulaiGps();
}

// ----- KAMERA -----

async function mulaiKamera() {
  hentikanKamera();
  fotoDataUrl = null;
  el.fotoPreview.style.display = 'none';
  el.btnUlangFoto.style.display = 'none';
  el.btnAmbilFoto.style.display = 'block';
  el.btnAmbilFoto.disabled = true;
  el.cameraPlaceholder.style.display = 'block';
  el.cameraPlaceholder.textContent = '📷 Menyiapkan kamera…';
  perbaruiTombolKirim();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    el.cameraPlaceholder.textContent = 'Perangkat/browser ini tidak mendukung kamera. Gunakan browser lain (Chrome/Safari terbaru).';
    return;
  }

  try {
    streamKamera = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }, // prioritaskan kamera depan
      audio: false
    });
    el.videoLive.srcObject = streamKamera;
    el.videoLive.style.display = 'block';
    el.cameraPlaceholder.style.display = 'none';
    el.btnAmbilFoto.disabled = false;
  } catch (err) {
    el.cameraPlaceholder.textContent = 'Tidak dapat mengakses kamera. Periksa izin kamera pada browser Anda, lalu muat ulang halaman.';
  }
}

function ambilSwafoto() {
  if (!streamKamera) return;
  const video = el.videoLive;
  const canvas = el.canvasCapture;

  // PERBAIKAN: sebelumnya canvas memakai resolusi PENUH kamera HP (bisa
  // 1280x960 ke atas). Setelah dijadikan base64, payload-nya bisa 300-700KB
  // -- itu penyebab utama absensi sering timeout di jaringan 4G, karena
  // Apps Script harus menerima, mendekode, lalu mengunggahnya ke Drive.
  // Sekarang sisi terpanjang dibatasi 720px: ukuran turun drastis, wajah
  // tetap jelas untuk verifikasi.
  const MAKS_SISI = 720;
  const lebarAsli = video.videoWidth || 720;
  const tinggiAsli = video.videoHeight || 960;
  const skala = Math.min(1, MAKS_SISI / Math.max(lebarAsli, tinggiAsli));
  const lebar = Math.round(lebarAsli * skala);
  const tinggi = Math.round(tinggiAsli * skala);

  canvas.width = lebar;
  canvas.height = tinggi;
  canvas.getContext('2d').drawImage(video, 0, 0, lebar, tinggi);
  fotoDataUrl = canvas.toDataURL('image/jpeg', 0.72);

  el.fotoPreview.src = fotoDataUrl;
  el.fotoPreview.style.display = 'block';
  el.videoLive.style.display = 'none';
  el.btnAmbilFoto.style.display = 'none';
  el.btnUlangFoto.style.display = 'block';

  hentikanKamera(); // lepas kamera setelah foto diambil, tidak perlu tetap menyala
  perbaruiTombolKirim();
}

function hentikanKamera() {
  if (streamKamera) {
    streamKamera.getTracks().forEach(t => t.stop());
    streamKamera = null;
  }
}

// ----- GPS -----

function mulaiGps() {
  el.gpsRow.className = 'absensi-gps-row';
  el.gpsRow.textContent = '📍 Mengambil lokasi Anda…';
  el.zonaBadgeWrap.innerHTML = '';
  lokasiSaya = null;
  zonaValid = false;
  perbaruiTombolKirim();

  if (!navigator.geolocation) {
    tampilkanGpsGagal('Perangkat/browser ini tidak mendukung GPS.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      lokasiSaya = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        akurasi: pos.coords.accuracy
      };
      evaluasiZona();
    },
    (err) => {
      let pesan = 'Lokasi tidak dapat diperoleh.';
      if (err.code === err.PERMISSION_DENIED) pesan = 'Izin lokasi ditolak. Aktifkan izin lokasi untuk melakukan absensi.';
      tampilkanGpsGagal(pesan);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function tampilkanGpsGagal(pesan) {
  el.gpsRow.className = 'absensi-gps-row bad';
  el.gpsRow.innerHTML = '⚠️ ' + escapeHtml(pesan) + '<br><button type="button" class="absensi-gps-retry" id="btnUlangGps">Coba Lagi</button>';
  document.getElementById('btnUlangGps').addEventListener('click', mulaiGps);
  perbaruiTombolKirim();
}

function evaluasiZona() {
  const lokasiSppg = statusTerkini && statusTerkini.lokasiSppg;
  if (!lokasiSppg) {
    el.gpsRow.className = 'absensi-gps-row bad';
    el.gpsRow.textContent = '⚠️ Lokasi SPPG belum diatur oleh Admin. Absensi belum dapat dilakukan.';
    zonaValid = false;
    perbaruiTombolKirim();
    return;
  }

  const jarak = hitungJarakMeterClient_(lokasiSaya.latitude, lokasiSaya.longitude, lokasiSppg.latitude, lokasiSppg.longitude);
  zonaValid = jarak <= lokasiSppg.radiusMeter;

  el.gpsRow.className = 'absensi-gps-row ok';
  el.gpsRow.textContent = `📍 Lokasi terdeteksi (±${Math.round(lokasiSaya.akurasi)} m akurasi GPS).`;

  const badge = document.createElement('span');
  badge.className = 'absensi-zone-badge ' + (zonaValid ? 'ok' : 'bad');
  // Teks disederhanakan -- cukup tampilkan jarak aktual, tanpa label
  // "Disetujui/Di Luar Zona" eksplisit (sistem radius yang menentukan
  // lewat pemblokiran tombol kirim, warna hijau/merah tetap jadi
  // indikator visualnya). Logic zonaValid/pemblokiran SAMA SEKALI
  // tidak diubah -- cuma teks tampilannya.
  badge.textContent = zonaValid
    ? `📍 Jarak Aktual: ${Math.round(jarak)} m dari ${lokasiSppg.nama}`
    : `⚠️ Jarak Aktual: ${Math.round(jarak)} m dari ${lokasiSppg.nama} (di luar radius ${lokasiSppg.radiusMeter} m)`;
  el.zonaBadgeWrap.innerHTML = '';
  el.zonaBadgeWrap.appendChild(badge);

  perbaruiTombolKirim();
}

function hitungJarakMeterClient_(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ----- TOMBOL KIRIM -----

function perbaruiTombolKirim() {
  el.btnKirimAbsen.disabled = !(fotoDataUrl && lokasiSaya && zonaValid);
}

async function kirimAbsensi() {
  if (!fotoDataUrl || !lokasiSaya || !zonaValid) return;
  el.btnKirimAbsen.disabled = true;

  const payloadAbsensi = {
    token: sesiAbsensi.token,
    jenis: jenisAktif,
    latitude: lokasiSaya.latitude,
    longitude: lokasiSaya.longitude,
    akurasi: lokasiSaya.akurasi,
    fotoBase64: fotoDataUrl,
    keterangan: el.inputKeteranganAbsen.value.trim()
  };

  // MODE OFFLINE: kalau perangkat memang sedang tanpa koneksi, jangan
  // buang waktu mencoba kirim (pasti gagal) -- langsung antrikan.
  if (typeof offlineAbsensi !== 'undefined' && !offlineAbsensi.sedangOnline()) {
    offlineAbsensi.tambahKeAntrian(payloadAbsensi);
    showSuccess('Kamu sedang offline. Absensi disimpan di perangkat dan akan otomatis terkirim begitu koneksi kembali.');
    perbaruiTombolKirim();
    return;
  }

  showLoading(jenisAktif === 'MASUK' ? 'Mengirim absensi masuk...' : 'Mengirim absensi pulang...');
  try {
    const hasil = await apiPost('submitAbsensi', payloadAbsensi, 45000); // timeout lebih panjang: upload foto ke Drive perlu waktu lebih dari 20 detik standar

    hideLoading();
    tampilkanOverlaySukses(hasil);
  } catch (err) {
    // PENTING: kalau gagal karena JARINGAN/TIMEOUT (bukan ditolak server),
    // data BISA JADI sebenarnya sudah tersimpan -- server tetap memproses
    // walau browser berhenti menunggu. Dulu di sini langsung menampilkan
    // "Server tidak merespons", padahal absennya sudah masuk; relawan lalu
    // mencoba lagi dan dapat pesan "Anda sudah absen" yang membingungkan.
    // Sekarang: cek dulu ke server, baru laporkan kondisi yang sebenarnya.
    const mungkinTersimpan = /tidak merespons|belum dapat dikirim|koneksi/i.test(err.message || '');
    if (mungkinTersimpan) {
      showLoading('Memeriksa apakah absensi sudah tersimpan...');
      try {
        const cek = await apiGet('getStatusAbsensiRelawan', { token: sesiAbsensi.token });
        hideLoading();
        const detail = jenisAktif === 'MASUK' ? cek.masuk : cek.pulang;
        if (detail && detail.sudah) {
          statusTerkini = cek;
          tampilkanOverlaySukses({
            jenis: jenisAktif,
            jam: detail.jam || '',
            statusLokasi: detail.statusLokasi || ''
          });
          return;
        }
        if (typeof offlineAbsensi !== 'undefined') {
          offlineAbsensi.tambahKeAntrian(payloadAbsensi);
          showSuccess('Absensi belum tersimpan. Disimpan di perangkat, akan otomatis dicoba kirim ulang.');
        } else {
          showError('Absensi belum tersimpan. Koneksi terputus saat mengirim — silakan coba kirim lagi.');
        }
        perbaruiTombolKirim();
        return;
      } catch (errCek) {
        hideLoading();
        // Tidak bisa dipastikan tersimpan atau tidak (cek status pun gagal
        // karena jaringan) -- daripada minta relawan menebak-nebak, langsung
        // antrikan saja. Kalau ternyata percobaan awal SUDAH berhasil,
        // sinkronisasi nanti akan mendeteksi "sudah absen" dan otomatis
        // menganggapnya sukses (lihat offline-absensi.js) -- tidak akan
        // membuat data ganda.
        if (typeof offlineAbsensi !== 'undefined') {
          offlineAbsensi.tambahKeAntrian(payloadAbsensi);
          showSuccess('Koneksi tidak stabil. Absensi disimpan di perangkat dan akan diperiksa ulang otomatis.');
        } else {
          showError('Koneksi terputus dan status absensi belum bisa dipastikan. Muat ulang halaman untuk memeriksa sebelum mengirim ulang.');
        }
        perbaruiTombolKirim();
        return;
      }
    }

    hideLoading();
    showError(err.message || 'Absensi gagal dikirim.');
    perbaruiTombolKirim();
  }
}

// ------------------------------------------------------------
// LAYAR SUKSES (wajib ditutup manual sebelum lanjut, biar relawan
// yakin betul absennya sudah masuk & tahu jenis + jam yang tercatat)
// ------------------------------------------------------------

function tampilkanOverlaySukses(hasil) {
  const isMasuk = hasil.jenis === 'MASUK';
  el.suksesCircle.className = 'absensi-success-circle ' + (isMasuk ? 'jenis-masuk' : 'jenis-pulang');
  el.suksesTitle.textContent = isMasuk ? 'Absen Masuk Berhasil' : 'Absen Pulang Berhasil';
  el.suksesJenis.textContent = hasil.jenis;
  el.suksesJam.textContent = hasil.jam || '–';
  el.suksesLokasi.textContent = labelZona_(hasil.statusLokasi);
  el.overlaySuksesAbsen.classList.remove('is-hidden');
}

async function tutupOverlaySukses() {
  el.overlaySuksesAbsen.classList.add('is-hidden');
  await muatStatusAbsensi();
}

// ------------------------------------------------------------
// STATE: SELESAI / DETAIL
// ------------------------------------------------------------

function baris_(label, nilai) {
  return `<div class="profile-identity-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(nilai)}</span></div>`;
}

function labelZona_(statusLokasi) {
  if (statusLokasi === 'DALAM_ZONA') return 'Dalam zona disetujui';
  if (statusLokasi === 'LUAR_ZONA') return 'Di luar zona';
  return '–';
}

function tampilkanSelesaiIzinSakit() {
  const s = statusTerkini;
  el.detailInfoList.innerHTML =
    baris_('Tanggal', s.operasional.tanggal) +
    baris_('Status', s.masuk.keterangan) +
    baris_('Keterangan', s.masuk.keterangan);
  el.detailFotoWrap.innerHTML = '';
  el.stateSelesai.style.display = 'block';
}

function tampilkanSelesaiLengkap() {
  const s = statusTerkini;
  let baris =
    baris_('Tanggal', s.operasional.tanggal) +
    baris_('Jam Masuk', s.masuk.jam || '–') +
    baris_('Jam Pulang', s.pulang.jam || '–') +
    baris_('Durasi Kerja', s.durasi || '–') +
    baris_('Status Lokasi Masuk', labelZona_(s.masuk.statusLokasi)) +
    baris_('Status Lokasi Pulang', labelZona_(s.pulang.statusLokasi));
  if (s.masuk.keterangan) baris += baris_('Keterangan', s.masuk.keterangan);
  el.detailInfoList.innerHTML = baris;

  // SELALU render 2 kotak (Masuk kiri, Pulang kanan) -- kalau salah satu
  // foto belum ada, tampilkan placeholder yang jelas, BUKAN menghilangkan
  // kontainernya sama sekali (supaya layout 2 kolom selalu konsisten).
  const kotakFoto_ = (url, label) => url
    ? `<div class="absensi-detail-photo"><img src="${escapeHtml(url)}" alt="Swafoto ${label}" loading="lazy"><span>Swafoto ${label}</span></div>`
    : `<div class="absensi-detail-photo absensi-detail-photo--kosong"><span class="absensi-detail-photo-placeholder">📷 Foto ${label} belum tersedia</span><span>Swafoto ${label}</span></div>`;
  const foto = kotakFoto_(s.masuk.fotoUrl, 'Masuk') + kotakFoto_(s.pulang.fotoUrl, 'Pulang');
  el.detailFotoWrap.innerHTML = foto;

  el.stateSelesai.style.display = 'block';
}

// ------------------------------------------------------------
// Catatan: fungsi Ajukan Izin/Sakit/Cuti SUDAH DIPINDAH ke halaman
// tersendiri (pengajuan.html + pengajuan.js) -- terpisah dari Presensi,
// bukan lagi bagian dari alur Absen Masuk/Pulang di file ini.
// ------------------------------------------------------------

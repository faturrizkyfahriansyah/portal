// SPPG JEUNGJING — SIPRES: ABSENSI QR (halaman kamera, tanpa login)
// Tidak memuat auth-relawan.js/app-shell.js apa pun -- halaman ini berdiri
// sendiri sesuai keputusan desain. Memakai ulang config.js/common.js yang
// sudah ada (apiPost + registrasi Service Worker otomatis lewat common.js).

let videoEl, canvasEl, ctx;
let sedangProses = false;   // true selagi menunggu jawaban server -- cegah kirim ganda
let cooldownAktif = false;  // jeda singkat SETELAH hasil ditampilkan, sebelum siap baca lagi
let loopHandle = null;

// ============================================================
// SUARA — dibuat langsung lewat Web Audio API (oscillator), BUKAN file
// mp3 -- tidak ada aset suara siap pakai di project ini, dan nada
// sintetis ini menjamin selalu bisa dimainkan tanpa bergantung file
// eksternal yang mungkin belum ada. Tiap kategori punya pola nada beda.
// ============================================================
let _audioCtx = null;
function ambilAudioCtx_() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
function mainkanNada_(pola) {
  try {
    const ac = ambilAudioCtx_();
    let waktu = ac.currentTime;
    pola.forEach(([freq, durasi, jeda]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, waktu);
      gain.gain.exponentialRampToValueAtTime(0.001, waktu + durasi);
      osc.connect(gain).connect(ac.destination);
      osc.start(waktu);
      osc.stop(waktu + durasi);
      waktu += durasi + (jeda || 0);
    });
  } catch (e) { /* audio opsional -- jangan sampai gagal audio menghentikan alur absensi */ }
}
const SUARA = {
  BERHASIL_MASUK: () => mainkanNada_([[880, .12, .04], [1175, .16, 0]]),
  BERHASIL_PULANG: () => mainkanNada_([[1175, .12, .04], [880, .16, 0]]),
  INFO: () => mainkanNada_([[660, .18, 0]]),
  ERROR: () => mainkanNada_([[300, .22, .05], [220, .28, 0]])
};

// ============================================================
// KAMERA + LOOP BACA QR (jsQR)
// ============================================================
async function mulaiKamera_() {
  const pesanError = document.getElementById('pesanErrorKamera');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    videoEl.srcObject = stream;
    await videoEl.play();
    document.getElementById('izinKameraOverlay').classList.add('tersembunyi');
    loopBacaQr_();
  } catch (e) {
    pesanError.textContent = 'Gagal mengakses kamera: ' + (e.message || 'izin ditolak') + '. Periksa izin kamera browser, lalu muat ulang halaman.';
  }
}

function loopBacaQr_() {
  if (loopHandle) cancelAnimationFrame(loopHandle);
  const tick = () => {
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && !sedangProses && !cooldownAktif) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const frame = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      const kode = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
      if (kode && kode.data) {
        prosesHasilScan_(kode.data.trim());
      }
    }
    loopHandle = requestAnimationFrame(tick);
  };
  loopHandle = requestAnimationFrame(tick);
}

// ============================================================
// KIRIM KE BACKEND + TAMPILKAN HASIL
// ============================================================
async function prosesHasilScan_(tokenKartu) {
  if (!tokenKartu || sedangProses) return;
  sedangProses = true;
  tampilkanStatusSiap_(false);
  try {
    const res = await apiPost('submitAbsensiQr', { tokenKartu: tokenKartu }, 15000);
    tampilkanHasil_(res);
  } catch (err) {
    tampilkanHasil_({ kode: 'ERROR_KONEKSI', pesan: err.message || 'Tidak dapat terhubung ke server.' });
  } finally {
    sedangProses = false;
  }
}

const TAMPILAN_HASIL = {
  BERHASIL_MASUK: { ikon: '✓', judul: 'ABSENSI MASUK BERHASIL', warna: 'sukses', target: 'sukses', suara: 'BERHASIL_MASUK' },
  BERHASIL_PULANG: { ikon: '✓', judul: 'ABSENSI PULANG BERHASIL', warna: 'sukses', target: 'sukses', suara: 'BERHASIL_PULANG' },
  SUDAH_MASUK: { ikon: 'ℹ', judul: 'SUDAH ABSEN MASUK', warna: 'info', target: '', suara: 'INFO' },
  SUDAH_LENGKAP: { ikon: 'ℹ', judul: 'ABSENSI SUDAH LENGKAP', warna: 'info', target: '', suara: 'INFO' },
  BELUM_WAKTUNYA: { ikon: 'ℹ', judul: 'BELUM WAKTUNYA', warna: 'info', target: 'gagal', suara: 'INFO' },
  DI_LUAR_JENDELA: { ikon: '✕', judul: 'JADWAL SUDAH LEWAT', warna: 'bahaya', target: 'gagal', suara: 'ERROR' },
  IZIN_AKTIF: { ikon: 'ℹ', judul: 'SUDAH TERCATAT IZIN', warna: 'info', target: '', suara: 'INFO' },
  KARTU_TIDAK_DIKENAL: { ikon: '✕', judul: 'KARTU TIDAK DIKENAL', warna: 'bahaya', target: 'gagal', suara: 'ERROR' },
  KARTU_NONAKTIF: { ikon: '✕', judul: 'KARTU NONAKTIF', warna: 'bahaya', target: 'gagal', suara: 'ERROR' },
  RELAWAN_NONAKTIF: { ikon: '✕', judul: 'RELAWAN NONAKTIF', warna: 'bahaya', target: 'gagal', suara: 'ERROR' },
  JADWAL_TIDAK_DITEMUKAN: { ikon: '✕', judul: 'JADWAL TIDAK DITEMUKAN', warna: 'bahaya', target: 'gagal', suara: 'ERROR' },
  ERROR_KONEKSI: { ikon: '✕', judul: 'ERROR KONEKSI / SERVER', warna: 'bahaya', target: 'gagal', suara: 'ERROR' }
};

function tampilkanHasil_(d) {
  // apiPost (common.js) sudah mengembalikan json.data langsung (dikonfirmasi dari
  // kodenya) -- d di sini SUDAH berupa {kode, nama, ...}, bukan wrapper lagi.
  const kode = (d && d.kode) || 'ERROR_KONEKSI';
  const tampilan = TAMPILAN_HASIL[kode] || TAMPILAN_HASIL.ERROR_KONEKSI;

  const kartu = document.getElementById('kartuHasil');
  kartu.className = 'kartu-hasil tampil warna-' + tampilan.warna;
  document.getElementById('hasilIkon').textContent = tampilan.ikon;
  document.getElementById('hasilJudul').textContent = tampilan.judul;
  document.getElementById('hasilNama').textContent = d.nama || '-';
  document.getElementById('hasilDivisi').textContent = d.divisi ? ('Divisi: ' + d.divisi) : '';
  document.getElementById('hasilPesan').textContent = d.pesan || '';

  const jamEl = document.getElementById('hasilJam');
  jamEl.textContent = d.jam || '';

  const badge = document.getElementById('hasilBadge');
  if (d.statusMasuk === 'TERLAMBAT') {
    badge.style.display = 'inline-block';
    badge.textContent = 'TERLAMBAT ' + d.keterlambatanMenit + ' MENIT';
    badge.style.background = '#fdf1de'; badge.style.color = '#8a5a12';
  } else {
    badge.style.display = 'none';
  }

  const target = document.getElementById('kameraTarget');
  target.className = 'kamera-target' + (tampilan.target ? ' ' + tampilan.target : '');

  if (SUARA[tampilan.suara]) SUARA[tampilan.suara]();

  cooldownAktif = true;
  setTimeout(() => {
    kartu.classList.remove('tampil');
    target.className = 'kamera-target';
    tampilkanStatusSiap_(true);
    cooldownAktif = false;
  }, 4000);
}

function tampilkanStatusSiap_(siap) {
  document.getElementById('statusSiap').textContent = siap ? 'SIAP MEMBACA' : 'MEMPROSES...';
  document.getElementById('statusInstruksi').style.visibility = siap ? 'visible' : 'hidden';
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  videoEl = document.getElementById('video');
  canvasEl = document.createElement('canvas'); // tidak perlu tampil di halaman, cuma media proses decode
  ctx = canvasEl.getContext('2d', { willReadFrequently: true });

  document.getElementById('btnMulaiKamera').addEventListener('click', () => {
    // Buka AudioContext dari gestur pengguna (wajib di banyak browser mobile
    // sebelum audio bisa dimainkan) -- sekaligus tombol yang sama memicu izin kamera.
    ambilAudioCtx_();
    mulaiKamera_();
  });
});

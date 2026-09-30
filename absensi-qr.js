// SPPG JEUNGJING — SIPRES: ABSENSI QR (halaman kamera, tanpa login)
// Tidak memuat auth-relawan.js/app-shell.js apa pun -- halaman ini berdiri
// sendiri sesuai keputusan desain. Memakai ulang config.js/common.js yang
// sudah ada (apiPost + registrasi Service Worker otomatis lewat common.js).

let videoEl, canvasEl, ctx;
let sedangProses = false;   // true selagi menunggu jawaban server -- cegah kirim ganda
let cooldownAktif = false;  // jeda singkat SETELAH hasil ditampilkan, sebelum siap baca lagi
let loopHandle = null;
let waktuFrameQrTerakhir = 0;
const INTERVAL_SCAN_QR_MS = 90;

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

function decodeFrame_(sourceCanvas, sourceCtx) {
  if (typeof window.jsQR !== 'function') return null;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (!w || !h) return null;

  // Pass 1: seluruh frame.
  let frame = sourceCtx.getImageData(0, 0, w, h);
  let kode = window.jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
  if (kode && kode.data) return kode;

  // Pass 2: fokus ke area tengah. Ini membantu ketika QR relatif kecil
  // terhadap frame kamera HP. Gunakan canvas terpisah agar tidak mengubah
  // canvas utama yang mengikuti resolusi kamera.
  const cropRatio = 0.72;
  const cw = Math.max(240, Math.floor(w * cropRatio));
  const ch = Math.max(240, Math.floor(h * cropRatio));
  const sx = Math.max(0, Math.floor((w - cw) / 2));
  const sy = Math.max(0, Math.floor((h - ch) / 2));
  const scanCanvas = decodeFrame_._cropCanvas || (decodeFrame_._cropCanvas = document.createElement('canvas'));
  const scale = Math.min(2, Math.max(1, 640 / Math.max(cw, ch)));
  scanCanvas.width = Math.floor(cw * scale);
  scanCanvas.height = Math.floor(ch * scale);
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
  scanCtx.imageSmoothingEnabled = false;
  scanCtx.drawImage(sourceCanvas, sx, sy, cw, ch, 0, 0, scanCanvas.width, scanCanvas.height);
  frame = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
  kode = window.jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
  return kode && kode.data ? kode : null;
}

function loopBacaQr_() {
  if (loopHandle) cancelAnimationFrame(loopHandle);
  const tick = (timestamp) => {
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && !sedangProses && !cooldownAktif && (timestamp - waktuFrameQrTerakhir >= INTERVAL_SCAN_QR_MS)) {
      waktuFrameQrTerakhir = timestamp;

      // Jika library decoder gagal dimuat, tampilkan error yang jelas
      // daripada membiarkan loop berhenti diam-diam karena ReferenceError.
      if (typeof window.jsQR !== 'function') {
        tampilkanErrorScanner_('Mesin pembaca QR belum termuat. Muat ulang halaman dengan koneksi internet aktif.');
      } else {
        const w = videoEl.videoWidth;
        const h = videoEl.videoHeight;
        if (w && h) {
          canvasEl.width = w;
          canvasEl.height = h;
          ctx.drawImage(videoEl, 0, 0, w, h);
          try {
            const kode = decodeFrame_(canvasEl, ctx);
            if (kode && kode.data) prosesHasilScan_(kode.data.trim());
          } catch (e) {
            console.error('SIPRES QR decoder error:', e);
          }
        }
      }
    }
    loopHandle = requestAnimationFrame(tick);
  };
  loopHandle = requestAnimationFrame(tick);
}

let scannerErrorAktif = false;
function tampilkanErrorScanner_(pesan) {
  if (scannerErrorAktif) return;
  scannerErrorAktif = true;
  const el = document.getElementById('statusSiap');
  const instruksi = document.getElementById('statusInstruksi');
  if (el) { el.textContent = 'SCANNER QR TIDAK SIAP'; el.style.color = '#b23a3a'; }
  if (instruksi) instruksi.textContent = pesan;
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
    // Kompatibilitas defensif: jika backend lama masih membungkus data satu tingkat, buka di sini.
    const hasil = (res && res.kode) ? res : ((res && res.data && res.data.kode) ? res.data : res);
    tampilkanHasil_(hasil);
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
    const siapDecoder = await (window.sipresQrReady || Promise.resolve(typeof window.jsQR === 'function'));
    if (!siapDecoder || typeof window.jsQR !== 'function') {
      tampilkanErrorScanner_('Library pembaca QR gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.');
      return;
    }
    mulaiKamera_();
  });

  // Audit runtime: halaman tidak boleh masuk mode siap jika decoder belum ada.
  // Ini mencegah kegagalan diam-diam ketika CDN library gagal dimuat.
  window.addEventListener('load', async () => {
    const siapDecoder = await (window.sipresQrReady || Promise.resolve(typeof window.jsQR === 'function'));
    if (!siapDecoder || typeof window.jsQR !== 'function') {
      tampilkanErrorScanner_('Library pembaca QR gagal dimuat dari semua sumber. Periksa koneksi internet lalu muat ulang.');
    }
  });
});

// SPPG JEUNGJING — SIPRES: ABSENSI QR (halaman kamera, tanpa login)
// Tidak memuat auth-relawan.js/app-shell.js apa pun -- halaman ini berdiri
// sendiri sesuai keputusan desain. Memakai ulang config.js/common.js yang
// sudah ada (apiPost + registrasi Service Worker otomatis lewat common.js).

/**
 * PERBAIKAN DIAGNOSTIK: apiPost (common.js, dipakai SELURUH project) SENGAJA
 * menyederhanakan semua kegagalan fetch jadi satu pesan generik "periksa
 * koneksi internet" -- itu pilihan yang TEPAT untuk halaman relawan biasa,
 * tapi salah untuk halaman ini: petugas di lapangan butuh tahu PERSIS jenis
 * kegagalannya (timeout? server menjawab gagal dgn pesan tertentu? respons
 * rusak? benar-benar network?), bukan pesan yang sama untuk semua kasus.
 * Fungsi ini TIDAK mengubah common.js sama sekali (jadi halaman lain tidak
 * terdampak) -- ia memakai ulang fetchDenganTimeout_ + GOOGLE_APPS_SCRIPT_WEB_APP_URL
 * yang sudah ada, tapi meneruskan detail error APA ADANYA ke pemanggil.
 */
async function apiPostDiagnostik_(action, payload, timeoutMs) {
  let res;
  try {
    res = await fetchDenganTimeout_(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify(Object.assign({}, payload, { action }))
    }, timeoutMs);
  } catch (err) {
    throw new Error((err.name || 'Error') + ': ' + (err.message || 'tidak diketahui') + ' (kemungkinan jaringan/timeout/CORS -- lihat kode error ini)');
  }
  const teksMentah = await res.text();
  let json;
  try {
    json = JSON.parse(teksMentah);
  } catch (e) {
    throw new Error('Respons server tidak terbaca (HTTP ' + res.status + '). Cuplikan: "' + teksMentah.slice(0, 120) + '"');
  }
  if (!json.success) throw new Error((json.message || 'Server menjawab gagal tanpa pesan') + (json.error ? ' [kode: ' + json.error + ']' : ''));
  return json.data;
}

let videoEl, canvasEl, ctx;
let sedangProses = false;   // true selagi menunggu jawaban server -- cegah kirim ganda
let cooldownAktif = false;  // jeda singkat SETELAH hasil ditampilkan, sebelum siap baca lagi
let modeAbsensi = null;       // MASUK/PULANG dipilih petugas sebelum scan
let loopHandle = null;
let waktuFrameQrTerakhir = 0;
const INTERVAL_SCAN_QR_MS = 140;
// PERBAIKAN: 2500ms terlalu singkat utk membaca kartu hasil (ikon+judul+nama+
// divisi+jam sekaligus) di kondisi lapangan -- dinaikkan jadi 5 detik supaya
// petugas sempat membaca DAN menjauhkan kartu lama sebelum kamera siap baca
// lagi (juga mengurangi risiko salah baca kartu yang belum sempat disingkirkan).
const COOLDOWN_HASIL_MS = 5000;

// ============================================================
// SUARA — dibuat langsung lewat Web Audio API (oscillator), BUKAN file
// mp3 -- tidak ada aset suara siap pakai di project ini, dan nada
// sintetis ini menjamin selalu bisa dimainkan tanpa bergantung file
// eksternal yang mungkin belum ada. Tiap kategori punya pola nada beda.
// ============================================================
let _audioCtx = null;
function ambilAudioCtx_() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // PERBAIKAN: sekadar membuat AudioContext saat klik TIDAK SELALU cukup utk
  // membukanya secara permanen -- terutama iOS Safari, yang kadang tetap
  // 'suspended'/'interrupted' walau context dibuat di dalam gesture pengguna.
  // resume() aman dipanggil berkali-kali (tidak efek apa-apa kalau sudah
  // 'running'), jadi dipanggil di sini SETIAP kali diambil, bukan cuma sekali.
  if (_audioCtx.state === 'suspended' || _audioCtx.state === 'interrupted') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}
function mainkanNada_(pola) {
  try {
    const ac = ambilAudioCtx_();
    if (ac.state !== 'running') return; // masih terkunci -- diam2 lewati drpd error/berisik salah
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

  // Pass 1: seluruh frame kamera.
  let frame = sourceCtx.getImageData(0, 0, w, h);
  let kode = window.jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
  if (kode && kode.data) return kode;

  // Pass 2: crop area tengah + pembesaran ringan agar QR kartu yang relatif
  // kecil di frame HP lebih mudah dibaca.
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

let scannerErrorAktif = false;
function tampilkanErrorScanner_(pesan) {
  if (scannerErrorAktif) return;
  scannerErrorAktif = true;
  const el = document.getElementById('statusSiap');
  const instruksi = document.getElementById('statusInstruksi');
  if (el) el.textContent = 'SCANNER QR TIDAK SIAP';
  if (el) el.style.background = 'rgba(178,58,58,.92)';
  if (instruksi) instruksi.textContent = pesan;
}

function loopBacaQr_() {
  if (loopHandle) cancelAnimationFrame(loopHandle);
  const tick = (timestamp) => {
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && !sedangProses && !cooldownAktif && modeAbsensi && (timestamp - waktuFrameQrTerakhir >= INTERVAL_SCAN_QR_MS)) {
      waktuFrameQrTerakhir = timestamp;

      if (typeof window.jsQR !== 'function') {
        tampilkanErrorScanner_('Mesin pembaca QR belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
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

// ============================================================
// KIRIM KE BACKEND + TAMPILKAN HASIL
// ============================================================
async function prosesHasilScan_(tokenKartu) {
  if (!tokenKartu || sedangProses || !modeAbsensi) return;
  sedangProses = true;
  tampilkanStatusSiap_(false);
  try {
    const hasil = await apiPostDiagnostik_('submitAbsensiQr', { tokenKartu: tokenKartu, mode: modeAbsensi }, 15000);
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
  BELUM_BISA_PULANG: { ikon: 'ℹ', judul: 'BELUM BISA ABSEN PULANG', warna: 'info', target: '', suara: 'INFO' },
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
  if (d.tanggal) document.getElementById('operasionalTanggal').textContent = 'Operasional: ' + d.tanggal;

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
  }, COOLDOWN_HASIL_MS);
}

function tampilkanStatusSiap_(siap) {
  document.getElementById('statusSiap').textContent = siap ? 'SIAP MEMBACA' : 'MEMPROSES...';
  document.getElementById('statusInstruksi').style.visibility = siap ? 'visible' : 'hidden';
}


// ============================================================
// OPERASIONAL KIOS — dimuat terpisah dari proses kamera/scan
// ============================================================
async function muatOperasionalKios_() {
  const elTanggal = document.getElementById('operasionalTanggal');
  const elStatus = document.getElementById('operasionalStatus');
  if (!elTanggal || typeof window.apiPost !== 'function') return;
  elTanggal.textContent = 'Memuat operasional...';
  try {
    // PERBAIKAN: timeout sebelumnya 3500ms -- jauh lebih pendek dari standar
    // project (API_TIMEOUT_MS = 20000ms di common.js). Apps Script Web App
    // biasa perlu beberapa detik saat "cold start" (jarang dipanggil), jadi
    // 3.5 detik SERING gagal walau backend sebenarnya sehat -- inilah
    // penyebab paling mungkin dari "Data operasional belum dapat dimuat"
    // yang terlihat konsisten di lapangan. Dinaikkan ke 15000ms.
    const d = await apiPostDiagnostik_('getOperasionalAktifQr', {}, 15000);
    if (d && d.kode === 'OPERASIONAL_AKTIF' && d.tanggal) {
      elTanggal.textContent = 'Operasional: ' + d.tanggal;
      if (elStatus) { elStatus.textContent = '● OPERASIONAL AKTIF'; elStatus.className = 'operasional-status aktif'; }
      return;
    }
    if (d && d.kode === 'OPERASIONAL_TIDAK_AKTIF') {
      elTanggal.textContent = d.label || 'Tidak ada operasional aktif';
      if (elStatus) { elStatus.textContent = '● OPERASIONAL TIDAK AKTIF'; elStatus.className = 'operasional-status tidak-aktif'; }
      return;
    }
    // BUG SEBELUMNYA: baris elStatus.textContent tidak ada di cabang ini --
    // teks jadi macet di "Memeriksa status..." (dari HTML awal) walau warnanya
    // sudah berubah oranye lewat className, membuat tampilan tidak konsisten
    // persis seperti yang terlihat di lapangan.
    elTanggal.textContent = 'Data operasional belum tersedia (respons server tidak dikenali: kode="' + (d && d.kode) + '")';
    if (elStatus) { elStatus.textContent = '● RESPONS TIDAK DIKENALI'; elStatus.className = 'operasional-status gagal'; }
    return;
  } catch (e) {
    // Tampilkan alasan SEBENARNYA (timeout vs pesan error server) -- sebelumnya
    // pesan generik yang sama untuk semua jenis kegagalan, menyulitkan diagnosa
    // dari lapangan (persis kasus yang terjadi).
    const alasan = (e && e.message) ? e.message : 'sebab tidak diketahui';
    elTanggal.textContent = 'Data operasional belum dapat dimuat (' + alasan + ')';
    if (elStatus) { elStatus.textContent = '● GAGAL MEMUAT'; elStatus.className = 'operasional-status gagal'; }
    console.warn('SIPRES operasional kiosk:', e);
  }
}

// ============================================================
// PILIH MODE ABSENSI
// ============================================================
function pilihModeAbsensi_(mode) {
  modeAbsensi = mode;
  const btnMasuk = document.getElementById('btnMasuk');
  const btnPulang = document.getElementById('btnPulang');
  btnMasuk.classList.toggle('aktif-masuk', mode === 'MASUK');
  btnPulang.classList.toggle('aktif-pulang', mode === 'PULANG');
  document.getElementById('statusSiap').textContent = 'SIAP MEMBACA';
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  videoEl = document.getElementById('video');
  canvasEl = document.createElement('canvas');
  ctx = canvasEl.getContext('2d', { willReadFrequently: true });

  muatOperasionalKios_();

  document.getElementById('btnMasuk').addEventListener('click', () => pilihModeAbsensi_('MASUK'));
  document.getElementById('btnPulang').addEventListener('click', () => pilihModeAbsensi_('PULANG'));

  // Penting: tombol ini harus tetap responsif di Android/iOS.
  // Tunggu library QR selesai dimuat tanpa memutus event click dengan
  // syntax/await yang tidak valid. Permission kamera dipicu dari gestur ini.
  document.getElementById('btnMulaiKamera').addEventListener('click', async () => {
    // Buka audio SEKARANG, di dalam gestur klik ini -- bukan menunggu hasil
    // scan pertama (yang terjadi async, sudah di luar gestur, terlalu
    // terlambat utk membuka audio di browser yang ketat soal ini).
    const ac = ambilAudioCtx_();
    try { await ac.resume(); } catch (_) {}
    const siapDecoder = await (window.sipresQrReady || Promise.resolve(typeof window.jsQR === 'function'));
    if (!siapDecoder || typeof window.jsQR !== 'function') {
      tampilkanErrorScanner_('Library pembaca QR gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.');
      return;
    }
    await mulaiKamera_();
  });

  window.addEventListener('load', async () => {
    const siapDecoder = await (window.sipresQrReady || Promise.resolve(typeof window.jsQR === 'function'));
    if (!siapDecoder || typeof window.jsQR !== 'function') {
      tampilkanErrorScanner_('Library pembaca QR gagal dimuat dari semua sumber. Periksa koneksi internet lalu muat ulang.');
    }
  });
});

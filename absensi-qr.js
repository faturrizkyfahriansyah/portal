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

// ============================================================
// CACHE RELAWAN (lookup instan di perangkat, tanpa ke server tiap scan)
// PERINGATAN KEAMANAN: ini menyimpan SELURUH TOKEN_KARTU relawan aktif di
// localStorage perangkat kios. KIOSK_KEY di bawah HANYA proteksi dasar,
// BUKAN keamanan sungguhan (kode ini bisa dilihat siapa saja yang membuka
// "view source" halaman). Harus SAMA PERSIS dengan KIOSK_API_KEY di
// AbsensiQr.gs. GANTI nilainya, jangan pakai contoh ini apa adanya.
// ============================================================
const KIOSK_KEY = 'GANTI_DENGAN_KUNCI_RAHASIA_ANDA_SENDIRI_YANG_PANJANG';
const KUNCI_CACHE_RELAWAN = 'sipres_qr_cache_relawan_v1';
const KUNCI_WAKTU_CACHE_RELAWAN = 'sipres_qr_cache_relawan_waktu_v1';
const INTERVAL_REFRESH_CACHE_MS = 5 * 60 * 1000;

let _petaRelawan = new Map();

function muatCacheRelawanDariLocalStorage_() {
  try {
    const mentah = localStorage.getItem(KUNCI_CACHE_RELAWAN);
    if (!mentah) return;
    const daftar = JSON.parse(mentah);
    _petaRelawan = new Map(daftar.map((r) => [r.token, r]));
  } catch (e) { console.warn('SIPRES QR: gagal memuat cache relawan lokal', e); }
}

async function segarkanCacheRelawan_() {
  try {
    const daftar = await apiPostDiagnostik_('getDaftarRingkasKiosk', { kioskKey: KIOSK_KEY }, 20000);
    if (Array.isArray(daftar)) {
      _petaRelawan = new Map(daftar.map((r) => [r.token, r]));
      localStorage.setItem(KUNCI_CACHE_RELAWAN, JSON.stringify(daftar));
      localStorage.setItem(KUNCI_WAKTU_CACHE_RELAWAN, String(Date.now()));
    }
  } catch (e) {
    // Diam -- cache lama (kalau ada) tetap dipakai. Ini wajar terjadi saat offline.
    console.warn('SIPRES QR: gagal menyegarkan cache relawan, memakai cache lama', e);
  }
}

function cariRelawanLokal_(token) {
  return _petaRelawan.get(token) || null;
}

// ============================================================
// ANTREAN SINKRON OFFLINE-SAFE
// Absensi yang gagal terkirim (jaringan bermasalah) disimpan di sini,
// BUKAN dianggap gagal permanen -- dicoba lagi otomatis di latar belakang.
// idScan per-item dipakai backend utk idempotency (retry tidak terhitung dobel).
// ============================================================
const KUNCI_ANTREAN = 'sipres_qr_antrean_v1';
const BATAS_PERCOBAAN_ANTREAN = 30; // amankan dari macet selamanya kalau datanya memang rusak

function muatAntrean_() {
  try { return JSON.parse(localStorage.getItem(KUNCI_ANTREAN) || '[]'); }
  catch (e) { return []; }
}
function simpanAntrean_(antrean) {
  try { localStorage.setItem(KUNCI_ANTREAN, JSON.stringify(antrean)); } catch (e) { /* storage penuh/nonaktif -- tidak fatal */ }
}
function tambahKeAntrean_(item) {
  const antrean = muatAntrean_();
  antrean.push(item);
  simpanAntrean_(antrean);
  perbaruiIndikatorJaringan_();
}

let _sedangMemprosesAntrean = false;
async function prosesAntrean_() {
  if (_sedangMemprosesAntrean || !navigator.onLine) return;
  _sedangMemprosesAntrean = true;
  try {
    let antrean = muatAntrean_();
    while (antrean.length > 0) {
      const item = antrean[0];
      try {
        await apiPostDiagnostik_('submitAbsensiQr', { tokenKartu: item.tokenKartu, mode: item.mode, idScan: item.idScan }, 15000);
        antrean.shift();
        simpanAntrean_(antrean);
      } catch (e) {
        item.percobaanKe = (item.percobaanKe || 0) + 1;
        if (item.percobaanKe > BATAS_PERCOBAAN_ANTREAN) { antrean.shift(); simpanAntrean_(antrean); continue; }
        simpanAntrean_(antrean);
        break; // tunggu siklus berikutnya (backoff alami lewat interval, bukan loop ketat)
      }
    }
  } finally {
    _sedangMemprosesAntrean = false;
    perbaruiIndikatorJaringan_();
  }
}

function perbaruiIndikatorJaringan_() {
  const elOnline = document.getElementById('statusOnline');
  const elAntrean = document.getElementById('statusAntrean');
  if (elOnline) {
    elOnline.textContent = navigator.onLine ? '● Online' : '● Offline';
    elOnline.className = 'status-online ' + (navigator.onLine ? 'online' : 'offline');
  }
  if (elAntrean) {
    const n = muatAntrean_().length;
    elAntrean.textContent = n > 0 ? (n + ' menunggu sinkron') : '';
  }
}

function buatIdScan_() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'scan-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

let videoEl, canvasEl, ctx;
let sedangProses = false;   // true selagi menunggu jawaban server -- cegah kirim ganda
let cooldownAktif = false;  // jeda singkat SETELAH hasil ditampilkan, sebelum siap baca lagi
let modeAbsensi = null;       // MASUK/PULANG dipilih petugas sebelum scan
let loopHandle = null;
let waktuFrameQrTerakhir = 0;
// ~11fps (target 10-15fps yang diminta) -- cukup responsif, tidak membebani
// CPU kamera HP kelas menengah ke bawah yang dipakai relawan di lapangan.
const INTERVAL_SCAN_QR_MS = 90;
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
  ERROR: () => mainkanNada_([[300, .22, .05], [220, .28, 0]]),
  // Nada pendek NETRAL -- "scan tertangkap", BUKAN sukses/gagal, dipakai saat
  // identitas lokal ditemukan dan sedang menunggu konfirmasi server.
  TERTANGKAP: () => mainkanNada_([[500, .06, 0]])
};
function getar_(pola) { try { if (navigator.vibrate) navigator.vibrate(pola); } catch (e) {} }

// ============================================================
// KAMERA + LOOP BACA QR (jsQR)
// ============================================================
let _barcodeDetector = null;
async function siapkanBarcodeDetector_() {
  // BarcodeDetector API: decoding native browser, jauh lebih cepat dari jsQR
  // (JS murni). Tidak didukung semua browser (terutama belum ada di Firefox/
  // Safari desktop) -- karena itu TETAP jsQR sbg fallback, bukan pengganti.
  if (!('BarcodeDetector' in window)) return;
  try {
    const formatDidukung = await window.BarcodeDetector.getSupportedFormats();
    if (formatDidukung.includes('qr_code')) {
      _barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
    }
  } catch (e) { _barcodeDetector = null; }
}

async function mulaiKamera_() {
  const pesanError = document.getElementById('pesanErrorKamera');
  try {
    // Resolusi dibatasi 640x480 -- cukup utk baca QR kartu jarak dekat, dan
    // frame lebih kecil = decode per-frame lebih cepat (penting utk jsQR,
    // yang memproses piksel di JS murni, bukan native).
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    document.getElementById('izinKameraOverlay').classList.add('tersembunyi');
    await siapkanBarcodeDetector_();
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

let _sedangDeteksiFrame = false;
async function deteksiSatuFrame_() {
  try {
    if (_barcodeDetector) {
      const hasil = await _barcodeDetector.detect(videoEl);
      if (hasil && hasil.length && hasil[0].rawValue) {
        prosesHasilScan_(String(hasil[0].rawValue).trim());
      }
      return;
    }
    if (typeof window.jsQR !== 'function') {
      tampilkanErrorScanner_('Mesin pembaca QR belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
      return;
    }
    const w = videoEl.videoWidth, h = videoEl.videoHeight;
    if (!w || !h) return;
    canvasEl.width = w; canvasEl.height = h;
    ctx.drawImage(videoEl, 0, 0, w, h);
    const kode = decodeFrame_(canvasEl, ctx);
    if (kode && kode.data) prosesHasilScan_(kode.data.trim());
  } catch (e) {
    console.error('SIPRES QR decoder error:', e);
  }
}

function loopBacaQr_() {
  if (loopHandle) cancelAnimationFrame(loopHandle);
  const tick = (timestamp) => {
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && !sedangProses && !cooldownAktif && modeAbsensi && !_sedangDeteksiFrame && (timestamp - waktuFrameQrTerakhir >= INTERVAL_SCAN_QR_MS)) {
      waktuFrameQrTerakhir = timestamp;
      _sedangDeteksiFrame = true;
      // Sengaja TIDAK di-await di sini -- requestAnimationFrame harus tetap
      // sinkron/cepat tiap panggilan. Flag _sedangDeteksiFrame mencegah
      // deteksi tumpang-tindih tanpa memblokir render loop itu sendiri.
      deteksiSatuFrame_().finally(() => { _sedangDeteksiFrame = false; });
    }
    loopHandle = requestAnimationFrame(tick);
  };
  loopHandle = requestAnimationFrame(tick);
}

// ============================================================
// KIRIM KE BACKEND + TAMPILKAN HASIL
// ============================================================
let _tokenTerakhirDiproses = null;
let _waktuTokenTerakhir = 0;
// Jeda KHUSUS utk token yang SAMA (diminta: 2-3 detik) -- BUKAN jeda umum yg
// memblokir semua pembacaan. Kartu BERBEDA tetap bisa langsung dipindai
// berurutan tanpa menunggu, hanya kartu yg SAMA yg ditahan sebentar supaya
// kamera yg masih melihatnya tidak membaca ulang sbg scan baru.
const JEDA_TOKEN_SAMA_MS = 2500;

async function prosesHasilScan_(tokenKartu) {
  if (!tokenKartu || !modeAbsensi) return;
  const sekarang = Date.now();
  if (tokenKartu === _tokenTerakhirDiproses && (sekarang - _waktuTokenTerakhir) < JEDA_TOKEN_SAMA_MS) return;
  if (sedangProses) return;
  _tokenTerakhirDiproses = tokenKartu;
  _waktuTokenTerakhir = sekarang;
  sedangProses = true;

  const infoLokal = cariRelawanLokal_(tokenKartu);
  const idScan = buatIdScan_();

  // Identitas tampil SEKETIKA dari cache lokal (murni pencarian di memori,
  // tanpa menunggu server) -- TAPI statusnya "memproses konfirmasi", BUKAN
  // "berhasil". Prinsip "jangan klaim berhasil sebelum server konfirmasi"
  // tetap dipegang -- yang dipercepat hanya MUNCULNYA IDENTITAS, bukan
  // KEPASTIAN HASIL.
  if (infoLokal) tampilkanMemproses_(infoLokal);
  else tampilkanStatusSiap_(false);

  try {
    const hasil = await apiPostDiagnostik_('submitAbsensiQr', { tokenKartu, mode: modeAbsensi, idScan }, 15000);
    tampilkanHasil_(hasil);
  } catch (err) {
    // Gagal terkirim (jaringan/timeout) -- SIMPAN ke antrean utk dicoba lagi
    // otomatis, JANGAN langsung diklaim error permanen kalau identitasnya
    // dikenali lokal (kemungkinan besar cuma soal koneksi sesaat).
    tambahKeAntrean_({ idScan, tokenKartu, mode: modeAbsensi, waktu: Date.now() });
    if (infoLokal) tampilkanMenungguSinkron_(infoLokal);
    else tampilkanHasil_({ kode: 'ERROR_KONEKSI', pesan: 'Server tidak dapat diakses. Mode offline aktif -- absen tersimpan dan akan dikirim otomatis.' });
  } finally {
    sedangProses = false;
  }
}

function tampilkanMemproses_(info) {
  const kartu = document.getElementById('kartuHasil');
  kartu.className = 'kartu-hasil tampil warna-info';
  document.getElementById('hasilIkon').textContent = '…';
  document.getElementById('hasilJudul').textContent = 'MEMPROSES KONFIRMASI';
  document.getElementById('hasilNama').textContent = info.nama || '-';
  document.getElementById('hasilDivisi').textContent = info.divisi ? ('Divisi: ' + info.divisi) : '';
  document.getElementById('hasilPesan').textContent = 'Menunggu konfirmasi server...';
  document.getElementById('hasilJam').textContent = '';
  document.getElementById('hasilBadge').style.display = 'none';
  SUARA.TERTANGKAP();
  getar_(35);
}

function tampilkanMenungguSinkron_(info) {
  const kartu = document.getElementById('kartuHasil');
  kartu.className = 'kartu-hasil tampil warna-info';
  document.getElementById('hasilIkon').textContent = '⏳';
  document.getElementById('hasilJudul').textContent = 'TERSIMPAN, MENUNGGU SINKRON';
  document.getElementById('hasilNama').textContent = info.nama || '-';
  document.getElementById('hasilDivisi').textContent = info.divisi ? ('Divisi: ' + info.divisi) : '';
  document.getElementById('hasilPesan').textContent = 'Koneksi bermasalah. BELUM DIPASTIKAN BERHASIL -- akan dikirim otomatis & diproses server begitu koneksi kembali.';
  document.getElementById('hasilJam').textContent = '';
  document.getElementById('hasilBadge').style.display = 'none';
  getar_([30, 40, 30]);

  const target = document.getElementById('kameraTarget');
  cooldownAktif = true;
  setTimeout(() => {
    kartu.classList.remove('tampil');
    target.className = 'kamera-target';
    tampilkanStatusSiap_(true);
    cooldownAktif = false;
  }, 3500);
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
  if (tampilan.warna === 'sukses') getar_(60);
  else if (tampilan.warna === 'bahaya') getar_([40, 50, 40, 50]);
  else getar_(35);

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

  // Cache relawan: muat yang tersimpan SEKETIKA (sinkron, dari localStorage)
  // supaya lookup lokal langsung bisa dipakai sejak scan pertama, lalu
  // segarkan di latar belakang tanpa memblokir apa pun.
  muatCacheRelawanDariLocalStorage_();
  segarkanCacheRelawan_();
  setInterval(segarkanCacheRelawan_, INTERVAL_REFRESH_CACHE_MS);

  // Antrean sinkron: coba proses segera (kalau ada sisa dari sesi sebelumnya
  // yang belum terkirim), lalu berkala + setiap kali koneksi kembali online.
  perbaruiIndikatorJaringan_();
  prosesAntrean_();
  setInterval(prosesAntrean_, 8000);
  window.addEventListener('online', () => { perbaruiIndikatorJaringan_(); prosesAntrean_(); });
  window.addEventListener('offline', perbaruiIndikatorJaringan_);

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

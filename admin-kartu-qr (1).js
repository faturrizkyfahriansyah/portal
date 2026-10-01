// SPPG JEUNGJING — ADMIN: Kartu QR (panelKartuQr)
// Lazy-loaded oleh admin.js saat tab "Kartu QR" pertama kali dibuka.
// QR dibuat dgn qrcodejs -- library YANG SUDAH DIPAKAI project ini
// (qr-label-ompreng.html) -- dimuat lewat CDN di bawah, bukan library baru.

let sesiKartuQr = null;
let daftarKartuCache = [];
const idTerpilihKq = new Set();

function escapeHtmlKq_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ============================================================
// MUAT & RENDER DAFTAR
// ============================================================
async function muatDaftarKartuAdmin_() {
  daftarKartuCache = await apiPost('getDaftarKartuAdmin', { token: sesiKartuQr.token });
  renderDaftarKartuAdmin_(document.getElementById('kqCari').value.trim());
}

function badgeStatusRelawanKq_(status) { return status === 'AKTIF' ? 'hadir' : 'tidak-hadir'; }
function badgeStatusKartuKq_(status) {
  if (status === 'AKTIF') return 'hadir';
  if (status === 'NONAKTIF') return 'sakit';
  return 'belum-absen'; // BELUM_DIBUAT
}

function renderDaftarKartuAdmin_(cari) {
  const q = (cari || '').toLowerCase();
  const list = q ? daftarKartuCache.filter(r => r.nama.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : daftarKartuCache;
  const tbody = document.getElementById('kqTbody');
  document.getElementById('kqEmpty').style.display = list.length ? 'none' : 'block';

  tbody.innerHTML = list.map(r => `
    <tr style="border-bottom:1px solid var(--color-border);">
      <td style="padding:6px;"><input type="checkbox" class="kq-check" data-id="${r.id}" data-nama="${escapeHtmlKq_(r.nama)}" ${r.statusKartu === 'BELUM_DIBUAT' ? 'disabled' : ''} ${idTerpilihKq.has(r.id) ? 'checked' : ''}></td>
      <td style="padding:6px;">${r.id}</td>
      <td>${escapeHtmlKq_(r.nama)}</td>
      <td>${escapeHtmlKq_(r.divisi)}</td>
      <td><span class="riwayat-badge ${badgeStatusRelawanKq_(r.statusRelawan)}">${r.statusRelawan}</span></td>
      <td><span class="riwayat-badge ${badgeStatusKartuKq_(r.statusKartu)}">${r.statusKartu === 'BELUM_DIBUAT' ? 'Belum Dibuat' : r.statusKartu}</span></td>
      <td style="white-space:nowrap;">
        ${r.statusKartu === 'BELUM_DIBUAT'
          ? `<button class="btn-mini primary" data-aksi="generate" data-id="${r.id}">Generate</button>`
          : `<button class="btn-mini" data-aksi="preview" data-id="${r.id}">Preview</button>
             <button class="btn-mini" data-aksi="regenerate" data-id="${r.id}">Regenerate</button>
             <button class="btn-mini" data-aksi="toggle" data-id="${r.id}" data-status="${r.statusKartu === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'}">${r.statusKartu === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button>`
        }
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.kq-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) idTerpilihKq.add(cb.dataset.id); else idTerpilihKq.delete(cb.dataset.id);
      perbaruiTombolCetakTerpilih_();
    });
  });
  tbody.querySelectorAll('[data-aksi]').forEach(btn => {
    btn.addEventListener('click', () => tanganiAksiKartu_(btn.dataset.aksi, btn.dataset.id, btn.dataset.status));
  });
}

function perbaruiTombolCetakTerpilih_() {
  document.getElementById('kqJumlahTerpilih').textContent = idTerpilihKq.size;
  document.getElementById('btnCetakTerpilihKq').disabled = idTerpilihKq.size === 0;
}

// ============================================================
// AKSI: GENERATE / REGENERATE / AKTIFKAN / NONAKTIFKAN
// ============================================================
async function tanganiAksiKartu_(aksi, id, status) {
  try {
    if (aksi === 'generate' || aksi === 'regenerate') {
      if (aksi === 'regenerate' && !confirm('Regenerate kartu ini? Kartu lama (QR yang sudah dicetak) langsung tidak berlaku lagi.')) return;
      await apiPost('generateKartuAdmin', { token: sesiKartuQr.token, idRelawan: id });
      showError(aksi === 'regenerate' ? '✅ Kartu diregenerasi. Cetak ulang kartu baru untuk relawan ini.' : '✅ Kartu berhasil dibuat.');
      await muatDaftarKartuAdmin_();
    } else if (aksi === 'toggle') {
      await apiPost('setStatusKartuAdmin', { token: sesiKartuQr.token, idRelawan: id, status: status });
      await muatDaftarKartuAdmin_();
    } else if (aksi === 'preview') {
      await bukaPreviewKartu_(id);
    }
  } catch (err) { showError(err.message || 'Gagal memproses kartu.'); }
}

// ============================================================
// TEMPLATE KARTU (dipakai preview & print, sama persis)
// ============================================================
/**
 * Kartu ID Relawan -- struktur & styling mengikuti template "front v3" yang
 * sudah disetujui (ornamen batik ASLI dari referensi, bukan rekonstruksi
 * SVG -- lihat assets/batik-ornamen.png, assets/logo-bgn.png, assets/logo.png).
 * Struktur HTML harus identik dengan kartu-id-relawan-template.html supaya
 * pratinjau Admin dan contoh standalone selalu sinkron satu sama lain.
 */
function htmlKartuQr_(data, idQrUnik) {
  return `
    <div class="card front">
      <img class="batik watermark c1" src="assets/batik-ornamen.png" alt="">
      <img class="batik watermark c2" src="assets/batik-ornamen.png" alt="">
      <img class="batik watermark c3" src="assets/batik-ornamen.png" alt="">
      <img class="batik watermark c4" src="assets/batik-ornamen.png" alt="">
      <div class="top">
        <div class="logos">
          <img class="logo" src="assets/logo-bgn.png" alt="Logo BGN">
          <div class="logo-divider"></div>
          <img class="logo sppg" src="assets/logo.png" alt="Logo SPPG Jeungjing">
        </div>
        <div class="brand">SPPG JEUNGJING</div>
        <div class="gold-line"></div>
      </div>
      <div class="body">
        <div class="title"><span class="garis"></span><i class="diamond"></i><span class="title-teks">Kartu Absensi Relawan</span><i class="diamond"></i><span class="garis"></span></div>
        <div class="name">${escapeHtmlKq_(data.nama).toUpperCase()}</div>
        <div class="meta">
          <div>ID: <strong>${escapeHtmlKq_(data.id)}</strong></div>
          <div>Divisi: <strong>${escapeHtmlKq_(data.divisi).toUpperCase()}</strong></div>
        </div>
        <div class="qr-wrap"><div id="${idQrUnik}"></div></div>
      </div>
      <div class="bottom"></div>
    </div>`;
}


/** Render QR sungguhan ke dalam elemen ber-id idQrUnik, pakai qrcodejs (sama seperti qr-label-ompreng.html). */
function renderQrKeElemen_(idQrUnik, teks) {
  const el = document.getElementById(idQrUnik);
  if (!el) return;
  new QRCode(el, { text: teks, width: 300, height: 300, correctLevel: QRCode.CorrectLevel.M });
}

// ============================================================
// PREVIEW SATU KARTU
// ============================================================
async function bukaPreviewKartu_(id) {
  const data = (await apiPost('getDataKartuCetakAdmin', { token: sesiKartuQr.token, idRelawan: id }))[0];
  if (!data) { showError('Data kartu tidak ditemukan.'); return; }
  const area = document.getElementById('kqPreviewArea');
  area.innerHTML = `<div class="kartu-qr-preview-scale">${htmlKartuQr_(data, 'kqPreviewQr')}</div>`;
  renderQrKeElemen_('kqPreviewQr', data.tokenKartu);
  document.getElementById('kqPreviewOverlay').classList.remove('is-hidden');
  window._kqDataPreviewAktif = data;
}

// ============================================================
// CETAK (satu dari preview, atau banyak dari checklist)
// ============================================================
function cetakSatuDariPreview_() {
  const data = window._kqDataPreviewAktif;
  if (!data) return;
  const area = document.getElementById('areaCetakKartuQr');
  area.innerHTML = `<div class="kartu-qr-grid-cetak">${htmlKartuQr_(data, 'kqCetakSatuQr')}</div>`;
  renderQrKeElemen_('kqCetakSatuQr', data.tokenKartu);
  setTimeout(() => window.print(), 200); // beri waktu QRCode.js selesai menggambar sebelum dialog print dibuka
}

async function cetakTerpilih_() {
  if (!idTerpilihKq.size) return;
  try {
    const daftar = await apiPost('getDataKartuCetakAdmin', { token: sesiKartuQr.token, idRelawanList: Array.from(idTerpilihKq) });
    if (!daftar.length) { showError('Tidak ada kartu valid untuk dicetak dari yang dipilih.'); return; }
    const area = document.getElementById('areaCetakKartuQr');
    area.innerHTML = `<div class="kartu-qr-grid-cetak">${daftar.map((d, i) => htmlKartuQr_(d, 'kqCetakBanyakQr' + i)).join('')}</div>`;
    daftar.forEach((d, i) => renderQrKeElemen_('kqCetakBanyakQr' + i, d.tokenKartu));
    setTimeout(() => window.print(), 300);
  } catch (err) { showError(err.message || 'Gagal menyiapkan cetak.'); }
}

let _kqCssTeksCache = null;
/**
 * Download PNG dari KARTU YANG BENAR-BENAR TAMPIL di layar (lewat SVG
 * foreignObject), bukan menggambar ulang dari nol dengan koordinat
 * hardcode terpisah seperti versi sebelumnya. PERBAIKAN PENTING: versi lama
 * punya implementasi duplikat -- rasio landscape lama, 1 logo, teks "SIPRES"
 * yang sudah dihapus dari desain utama -- semuanya diam-diam tidak ikut
 * ter-update setiap kali desain kartu direvisi di admin-kartu-qr.js/portal.css,
 * persis itu yang dilaporkan ("hasil unduh masih yang lama"). Dengan
 * menangkap elemen kartu yang SUNGGUHAN, hasil unduh dijamin SELALU sama
 * dengan yang tampil di preview -- tidak mungkin menyimpang lagi di masa depan.
 */
async function downloadPreviewSebagaiPng_() {
  const kartuAsli = document.querySelector('#kqPreviewArea .card.front');
  if (!kartuAsli) { showError('Pratinjau kartu belum siap. Tunggu sebentar lalu coba lagi.'); return; }
  const data = window._kqDataPreviewAktif;
  try {
    if (!_kqCssTeksCache) {
      const res = await fetch('portal.css');
      _kqCssTeksCache = await res.text();
    }

    const MM_KE_PX = 300 / 25.4; // target ~300dpi
    const W = Math.round(54 * MM_KE_PX), H = Math.round(86 * MM_KE_PX);

    const klon = kartuAsli.cloneNode(true);
    // QR dirender qrcodejs sbg <canvas> atau <img> -- SVG foreignObject tidak
    // selalu merender <canvas> hidup dgn benar, jadi diganti dulu dgn <img> dari data URL.
    const qrAsli = kartuAsli.querySelector('.qr-wrap canvas, .qr-wrap img');
    const qrKlon = klon.querySelector('.qr-wrap canvas, .qr-wrap img');
    if (qrAsli && qrKlon) {
      const dataUrlQr = qrAsli.tagName === 'CANVAS' ? qrAsli.toDataURL('image/png') : qrAsli.src;
      const imgPengganti = document.createElement('img');
      imgPengganti.src = dataUrlQr;
      imgPengganti.style.cssText = qrKlon.style.cssText || 'width:100%;height:100%;display:block;';
      qrKlon.replaceWith(imgPengganti);
    }

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('xmlns', svgNs);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 54 86');
    const fo = document.createElementNS(svgNs, 'foreignObject');
    fo.setAttribute('width', '54'); fo.setAttribute('height', '86');
    const style = document.createElement('style');
    style.textContent = _kqCssTeksCache;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:54mm;height:86mm;';
    wrapper.appendChild(klon);
    fo.appendChild(style);
    fo.appendChild(wrapper);
    svg.appendChild(fo);

    const svgTeks = new XMLSerializer().serializeToString(svg);
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgTeks);

    const gambarSvg = new Image();
    await new Promise((resolve, reject) => {
      gambarSvg.onload = resolve;
      gambarSvg.onerror = () => reject(new Error('Gagal merender kartu ke gambar.'));
      gambarSvg.src = svgUrl;
    });

    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(gambarSvg, 0, 0, W, H);

    const a = document.createElement('a');
    a.download = 'Kartu-ID-' + String((data && data.id) || 'Relawan').replace(/[^a-zA-Z0-9_-]+/g, '-') + '.png';
    a.href = c.toDataURL('image/png');
    a.click();
  } catch (err) {
    showError(err.message || 'Gagal membuat file PNG kartu.');
  }
}

// ============================================================
// INIT (lazy-loaded)
// ============================================================
function initKartuQr_() {
  sesiKartuQr = { token: window.sppgAdminToken };
  if (!sesiKartuQr.token) return;

  muatDaftarKartuAdmin_().catch(err => showError(err.message || 'Gagal memuat daftar kartu.'));

  document.getElementById('kqCari').addEventListener('input', (e) => {
    clearTimeout(window._kqCariTimeout);
    window._kqCariTimeout = setTimeout(() => renderDaftarKartuAdmin_(e.target.value.trim()), 300);
  });
  document.getElementById('kqPilihSemua').addEventListener('change', (e) => {
    daftarKartuCache.forEach(r => { if (r.statusKartu !== 'BELUM_DIBUAT') { if (e.target.checked) idTerpilihKq.add(r.id); else idTerpilihKq.delete(r.id); } });
    renderDaftarKartuAdmin_(document.getElementById('kqCari').value.trim());
    perbaruiTombolCetakTerpilih_();
  });
  document.getElementById('btnCetakTerpilihKq').addEventListener('click', cetakTerpilih_);
  document.getElementById('btnTutupPreviewKq').addEventListener('click', () => document.getElementById('kqPreviewOverlay').classList.add('is-hidden'));
  document.getElementById('btnPrintPreviewKq').addEventListener('click', cetakSatuDariPreview_);
  document.getElementById('btnDownloadPreviewKq').addEventListener('click', downloadPreviewSebagaiPng_);
}

let sudahInitKq = false;
window.addEventListener('sppg-admin-ready', () => { if (!sudahInitKq) { sudahInitKq = true; initKartuQr_(); } });
if (window.sppgAdminToken && !sudahInitKq) { sudahInitKq = true; initKartuQr_(); } // jaga-jaga kalau event sudah tertembak sebelum file ini dimuat (sama seperti admin-stok.js)

// id-card-saya.js — Portal Relawan: ID Card Saya (23 Okt 2026, dokumen
// Kartu Identitas Relawan §F). Struktur kartu & teknik render SAMA
// PERSIS dengan admin-kartu-qr.js (htmlKartuQr_/downloadPreviewSebagaiPng_)
// -- SENGAJA diduplikasi (bukan dipanggil lintas-file) krn Portal
// Pengelola & Portal Relawan tidak berbagi bundel JS, pola yg SAMA
// dgn pemisahan lain di proyek ini (mis. admin-shift.js vs frontend
// relawan). Backend: getDataKartuCetakRelawan (AbsensiQr.gs) --
// identitas dari SESI, relawan TIDAK BISA minta kartu relawan lain.
// Style kartu (termasuk .foto-profil) SEMUANYA ada di portal.css --
// tidak ada file CSS terpisah lagi.

function escapeHtmlIcs_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

let dataKartuIcs = null;

// ============================================================
// TEMPLATE KARTU -- struktur IDENTIK dgn htmlKartuQr_ (admin-kartu-qr.js),
// supaya portal.css/kartu-identitas.css yg sama berlaku tanpa perlu
// aturan CSS terpisah. Foto profil + placeholder sama persis.
// ============================================================
function htmlKartuIcs_(data, idQrUnik) {
  const fotoHtml = data.fotoProfilUrl
    ? `<img class="foto-profil" src="${escapeHtmlIcs_(data.fotoProfilUrl)}" alt="Foto ${escapeHtmlIcs_(data.nama)}">`
    : `<div class="foto-profil foto-profil-kosong" aria-label="Foto belum tersedia">
         <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
       </div>`;
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
        <div class="title"><span class="garis"></span><i class="diamond"></i><span class="title-teks">Kartu Identitas Relawan</span><i class="diamond"></i><span class="garis"></span></div>
        ${fotoHtml}
        <div class="name">${escapeHtmlIcs_(data.nama).toUpperCase()}</div>
        <div class="meta">
          <div>ID: <strong>${escapeHtmlIcs_(data.id)}</strong></div>
          <div>Divisi: <strong>${escapeHtmlIcs_(data.divisi).toUpperCase()}</strong></div>
        </div>
        <div class="qr-wrap"><div id="${idQrUnik}"></div></div>
      </div>
      <div class="bottom"></div>
    </div>`;
}

function renderQrKeElemenIcs_(idQrUnik, teks) {
  const el = document.getElementById(idQrUnik);
  if (!el) return;
  new QRCode(el, { text: teks, width: 300, height: 300, correctLevel: QRCode.CorrectLevel.M });
}

// ============================================================
// RENDER KARTU UTAMA (di badan halaman) + PERINGATAN FOTO
// ============================================================
function renderKartuUtamaIcs_() {
  const area = document.getElementById('icsKartuArea');
  area.innerHTML = htmlKartuIcs_(dataKartuIcs, 'icsKartuQrUtama');
  renderQrKeElemenIcs_('icsKartuQrUtama', dataKartuIcs.tokenKartu);
  document.getElementById('icsFotoPeringatan').style.display = dataKartuIcs.fotoProfilUrl ? 'none' : 'block';
}

// ============================================================
// PREVIEW
// ============================================================
function bukaPreviewIcs_() {
  const area = document.getElementById('icsPreviewArea');
  area.innerHTML = htmlKartuIcs_(dataKartuIcs, 'icsKartuQrPreview');
  renderQrKeElemenIcs_('icsKartuQrPreview', dataKartuIcs.tokenKartu);
  document.getElementById('icsPreviewOverlay').classList.remove('is-hidden');
}

// ============================================================
// CETAK -- layout kartu sama dgn Admin (areaCetakKartuQr, CSS
// @media print sudah ada di portal.css dari fitur Admin, SAMA berlaku
// di sini krn kelasnya identik).
// ============================================================
function cetakIcs_() {
  const area = document.getElementById('areaCetakKartuQr');
  area.innerHTML = `<div class="kartu-qr-grid-cetak">${htmlKartuIcs_(dataKartuIcs, 'icsKartuQrCetak')}</div>`;
  renderQrKeElemenIcs_('icsKartuQrCetak', dataKartuIcs.tokenKartu);
  setTimeout(() => window.print(), 200); // beri waktu QRCode.js selesai menggambar, pola sama dgn Admin
}

// ============================================================
// UNDUH PDF -- teknik render SAMA dgn downloadPreviewSebagaiPng_
// (admin-kartu-qr.js): kartu yg SUNGGUHAN tampil di layar ditangkap
// lewat SVG foreignObject -> canvas, supaya hasil unduh DIJAMIN sama
// dgn yg tampil, tidak mungkin menyimpang. Langkah TERAKHIR beda:
// canvas dibungkus jsPDF (bukan di-export PNG) sesuai dokumen §F
// "Unduh PDF".
// ============================================================
let _icsCssTeksCache = null;
async function unduhPdfIcs_() {
  const tombol = document.getElementById('icsBtnUnduhPdf');
  const kartuAsli = document.querySelector('#icsKartuArea .card.front');
  if (!kartuAsli) { showError('Kartu belum siap. Tunggu sebentar lalu coba lagi.'); return; }
  tombol.disabled = true;
  const labelAsli = tombol.textContent;
  tombol.textContent = 'Menyiapkan PDF...';
  try {
    if (!_icsCssTeksCache) {
      // Diperbarui 23 Okt 2026 -- .foto-profil kini TERINTEGRASI
      // LANGSUNG ke portal.css, cukup 1 fetch (sama spt Admin).
      const res = await fetch('portal.css');
      _icsCssTeksCache = await res.text();
    }

    const MM_KE_PX = 300 / 25.4; // target ~300dpi, SAMA dgn Admin
    const W = Math.round(54 * MM_KE_PX), H = Math.round(86 * MM_KE_PX);

    const klon = kartuAsli.cloneNode(true);
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
    style.textContent = _icsCssTeksCache;
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

    // Bungkus jadi PDF (jsPDF, dimuat via CDN di id-card-saya.html) --
    // ukuran halaman PDF disamakan dgn ukuran kartu fisik (54x86mm),
    // bukan A4, supaya saat dicetak langsung pas tanpa perlu skala manual.
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [54, 86] });
    pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, 54, 86);
    pdf.save('Kartu-ID-' + String(dataKartuIcs.id || 'Relawan').replace(/[^a-zA-Z0-9_-]+/g, '-') + '.pdf');
  } catch (err) {
    showError(err.message || 'Gagal membuat file PDF kartu.');
  } finally {
    tombol.disabled = false;
    tombol.textContent = labelAsli;
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const elMuat = document.getElementById('icsMuat');
  try {
    dataKartuIcs = await apiPost('getDataKartuCetakRelawan', { token: sesi.token });
    elMuat.style.display = 'none';
    if (!dataKartuIcs.tersedia) {
      document.getElementById('icsBelumAda').style.display = 'block';
      return;
    }
    document.getElementById('icsIsi').style.display = 'block';
    renderKartuUtamaIcs_();
  } catch (err) {
    elMuat.textContent = '❌ ' + (err.message || 'Gagal memuat data kartu.');
    return;
  }

  document.getElementById('icsBtnPreview').addEventListener('click', bukaPreviewIcs_);
  document.getElementById('icsBtnTutupPreview').addEventListener('click', () => document.getElementById('icsPreviewOverlay').classList.add('is-hidden'));
  document.getElementById('icsBtnCetak').addEventListener('click', cetakIcs_);
  document.getElementById('icsBtnUnduhPdf').addEventListener('click', unduhPdfIcs_);
});

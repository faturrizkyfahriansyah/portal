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
function htmlKartuQr_(data, idQrUnik) {
  return `
    <div class="kartu-qr">
      <div class="kartu-qr-header"><img src="assets/logo.png" alt="Logo SPPG"><span>SPPG JEUNGJING</span></div>
      <div class="kartu-qr-judul">Kartu Absensi Relawan</div>
      <div class="kartu-qr-body">
        <div class="kartu-qr-info">
          <div class="kartu-qr-nama">${escapeHtmlKq_(data.nama)}</div>
          <div class="kartu-qr-meta">ID: ${escapeHtmlKq_(data.id)}<br>Divisi: ${escapeHtmlKq_(data.divisi)}</div>
        </div>
        <div class="kartu-qr-qr" id="${idQrUnik}"></div>
      </div>
      <div class="kartu-qr-footer">SIPRES • SPPG Jeungjing</div>
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

/** Download PNG kartu yang sedang dipreview. Tidak memakai library tambahan: QR diambil dari canvas qrcodejs, lalu seluruh kartu digambar ulang ke canvas. */
async function downloadPreviewSebagaiPng_() {
  const data = window._kqDataPreviewAktif;
  if (!data) return;
  try {
    const qrEl = document.getElementById('kqPreviewQr');
    const qrCanvas = qrEl && qrEl.querySelector('canvas');
    const qrImg = qrEl && qrEl.querySelector('img');
    if (!qrCanvas && !qrImg) throw new Error('QR belum selesai dibuat. Tunggu sebentar lalu coba lagi.');

    const W = 1011, H = 638; // rasio CR80 85.6 x 54 mm pada ~300 DPI
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);

    // Ornamen header navy + aksen emas.
    x.fillStyle = '#0b2340'; x.fillRect(0, 0, W, 108);
    x.fillStyle = '#c9962c'; x.fillRect(0, 103, W, 5);
    x.fillStyle = '#eaf0f7'; x.beginPath(); x.arc(W - 28, 24, 88, 0, Math.PI * 2); x.fill();

    const logo = new Image();
    logo.src = 'assets/logo.png';
    await new Promise((resolve, reject) => { logo.onload = resolve; logo.onerror = reject; });
    const lh = 62, lw = logo.naturalWidth ? lh * logo.naturalWidth / logo.naturalHeight : 62;
    x.drawImage(logo, 30, 22, lw, lh);

    x.fillStyle = '#ffffff'; x.font = '800 30px Arial';
    x.fillText('SPPG JEUNGJING', 30 + lw + 18, 58);
    x.font = '700 22px Arial'; x.fillStyle = '#c9962c';
    x.fillText('KARTU ABSENSI RELAWAN', 30, 155);

    x.fillStyle = '#0b2340'; x.font = '800 38px Arial';
    const nama = String(data.nama || '-');
    let namaTampil = nama;
    if (namaTampil.length > 25) namaTampil = namaTampil.slice(0, 24) + '…';
    x.fillText(namaTampil, 30, 225);

    x.fillStyle = '#556070'; x.font = '500 25px Arial';
    x.fillText('ID: ' + String(data.id || '-'), 30, 270);
    x.fillText('Divisi: ' + String(data.divisi || '-'), 30, 307);

    const qSize = 270;
    if (qrCanvas) x.drawImage(qrCanvas, W - qSize - 42, 155, qSize, qSize);
    else {
      const img = new Image(); img.src = qrImg.src;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      x.drawImage(img, W - qSize - 42, 155, qSize, qSize);
    }

    x.fillStyle = '#8b95a3'; x.font = '500 18px Arial';
    x.fillText('SIPRES • SPPG Jeungjing', 30, H - 28);

    const a = document.createElement('a');
    a.download = 'Kartu-QR-' + String(data.id || 'Relawan').replace(/[^a-zA-Z0-9_-]+/g, '-') + '.png';
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

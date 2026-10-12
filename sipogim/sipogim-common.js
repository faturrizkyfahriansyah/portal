/**
 * SIPOGIM — sipogim-common.js
 * Helper dipakai di semua halaman. Pola apiPost SENGAJA ditiru persis
 * dari common.js Portal SPPG Jeungjing (tanpa header Content-Type,
 * supaya tidak kena preflight CORS -- Apps Script Web App tidak
 * mendukungnya) -- lihat SIPOGIM_WEB_APP_URL di sipogim-config.js.
 */

function escapeHtmlSipogim(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function apiPostSipogim(action, payload) {
  if (!SIPOGIM_WEB_APP_URL || SIPOGIM_WEB_APP_URL.indexOf('GANTI_') === 0) {
    throw new Error('SIPOGIM belum terhubung ke server. Isi SIPOGIM_WEB_APP_URL di sipogim-config.js.');
  }
  const token = sessionStorage.getItem('sipogim_token') || '';
  const namaSaya = localStorage.getItem('sipogim_nama_saya') || '';
  let res;
  try {
    res = await fetch(SIPOGIM_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify(Object.assign({}, payload, { action, token, namaSaya }))
    });
  } catch (err) {
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.');
  }
  let json;
  try { json = JSON.parse(await res.text()); }
  catch (err) { throw new Error('Server memberi respons yang tidak terbaca.'); }
  if (!json.success) {
    if (/sesi (tidak valid|berakhir)/i.test(json.message || '')) {
      sessionStorage.removeItem('sipogim_token');
      if (!location.pathname.endsWith('login.html')) location.href = 'login.html';
    }
    throw new Error(json.message || 'Terjadi kesalahan pada server.');
  }
  return json.data;
}

function sesiSipogimAda() { return !!sessionStorage.getItem('sipogim_token'); }
function wajibLoginSipogim() { if (!sesiSipogimAda()) location.href = 'login.html'; }
function namaSayaSipogim() { return localStorage.getItem('sipogim_nama_saya') || ''; }

/** Dipanggil di awal tiap halaman (selain login.html) setelah sesi terkonfirmasi ada,
 * memastikan "Nama saya" sudah terisi -- kalau belum, tampilkan modal pengisian
 * sebelum halaman bisa dipakai utk aksi tulis (lihat spesifikasi bagian 4). */
function pastikanNamaSayaSipogim() {
  if (namaSayaSipogim()) return;
  const nama = prompt('Siapa nama Anda? (akan dicatat setiap kali Anda mengubah data)');
  if (nama && nama.trim().length >= 2) localStorage.setItem('sipogim_nama_saya', nama.trim());
}

function tampilkanGalatSipogim(elemenAtauId, err) {
  const el = typeof elemenAtauId === 'string' ? document.getElementById(elemenAtauId) : elemenAtauId;
  if (el) el.textContent = '⚠️ ' + err.message;
  console.error(err);
}

function formatAngkaSipogim(n, desimal) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });
}

const LABEL_STATUS_SIPOGIM = { perlu_dicek: 'Perlu dicek', draf: 'Draf', sudah_dicek: 'Sudah dicek' };
const KELAS_STATUS_SIPOGIM = { perlu_dicek: 'status-danger', draf: 'status-warning', sudah_dicek: 'status-success' };
function badgeStatusSipogim(status) {
  const label = LABEL_STATUS_SIPOGIM[status] || status || '-';
  const kelas = KELAS_STATUS_SIPOGIM[status] || 'status-warning';
  return `<span class="sg-badge ${kelas}">${escapeHtmlSipogim(label)}</span>`;
}

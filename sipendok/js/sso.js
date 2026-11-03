/* sso.js — SIPENDOK TIDAK punya login sendiri (keputusan Admin 4 Nov 2026). Masuk hanya lewat sesi Portal + pemberian akses per relawan
 * (Portal: Manajemen Hak Akses > Akses Per Relawan). Menukar sesi Portal dengan token aplikasi (terbitkanTokenAplikasi). Server SIPENDOK
 * memverifikasi tanda tangan token dan memeriksa ulang akses di setiap permintaan; bagian ini hanya mengurus tampilan. */
import { session } from './api.js';
import { h } from './util.js';

const PORTAL_URL = (typeof GOOGLE_APPS_SCRIPT_WEB_APP_URL !== 'undefined') ? GOOGLE_APPS_SCRIPT_WEB_APP_URL : '';
function sesiPortal() {
  for (const kunci of ['sppgRelawanSession', 'sppgAdminSession']) {
    try { const s = JSON.parse(localStorage.getItem(kunci) || 'null'); if (s && s.token) return { token: s.token, admin: kunci === 'sppgAdminSession' }; } catch { /* abaikan */ }
  }
  return null;
}
export const kembaliKePortal = () => { location.href = (sesiPortal() && sesiPortal().admin) ? '../admin.html' : '../dashboard.html'; };

function kartu(app, judul, isi, tombol) {
  app.replaceChildren(h('div', { class: 'main', style: { maxWidth: '420px', margin: '60px auto', textAlign: 'center' } },
    h('h2', {}, judul), h('p', { style: { color: 'var(--muted)' } }, isi), h('div', { class: 'row', style: { justifyContent: 'center', gap: '8px' } }, ...tombol)));
}
export async function masukLewatPortal(app, ulang) {
  app.replaceChildren(h('div', { class: 'main', style: { textAlign: 'center', marginTop: '80px' } }, 'Memeriksa akses dari Portal…'));
  const sesi = sesiPortal();
  if (!sesi) { kartu(app, 'Belum masuk Portal', 'SIPENDOK dibuka dari Portal. Silakan masuk ke Portal terlebih dahulu.', [h('button', { class: 'btn', onclick: () => { location.href = '../login.html'; } }, 'Masuk ke Portal')]); return false; }
  try {
    const res = await fetch(PORTAL_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', body: JSON.stringify({ action: 'terbitkanTokenAplikasi', token: sesi.token, kodeModul: 'SIPENDOK' }) });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Akses ditolak.');
    session.set(json.data.token, { username: json.data.nama, nama: json.data.nama });
    await ulang();
    return true;
  } catch (e) {
    kartu(app, 'Tidak dapat membuka SIPENDOK', String(e.message || e), [h('button', { class: 'btn', onclick: () => masukLewatPortal(app, ulang) }, 'Coba lagi'), h('button', { class: 'btn ghost', onclick: kembaliKePortal }, 'Kembali ke Portal')]);
    return false;
  }
}

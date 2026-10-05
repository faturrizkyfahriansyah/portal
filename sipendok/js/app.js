/* app.js — shell aplikasi: login, navigasi (sidebar / bottom-nav), router hash, PWA. */
import { h, icon } from './util.js';
import { api, session, onAuthLost, apiConfigured } from './api.js';
import { S, loadBootstrap } from './store.js';
import { toast, modal, confirmDialog, skeleton, banner, errMsg } from './ui.js';
import { renderLogin } from './pages/login.js';

const ROUTES = {
  dashboard: { title: 'Dashboard', icon: 'home', mod: () => import('./pages/dashboard.js') },
  pm: { title: 'PM', icon: 'users', mod: () => import('./pages/pm.js') },
  pic: { title: 'PIC', icon: 'user', mod: () => import('./pages/pic.js') },
  penerimaan: { title: 'Penerimaan', icon: 'inbox', mod: () => import('./pages/penerimaan.js') },
  pagu: { title: 'Pagu & Perhitungan', icon: 'chart', mod: () => import('./pages/pagu.js') },
  dokumen: { title: 'Dokumen Penerimaan', icon: 'file', mod: () => import('./pages/dokumen.js') },
  arsip: { title: 'Arsip', icon: 'archive', mod: () => import('./pages/arsip.js') },
  pengaturan: { title: 'Pengaturan', icon: 'settings', mod: () => import('./pages/pengaturan.js') }
};
const SIDE = ['dashboard', 'pm', 'pic', 'penerimaan', 'pagu', 'dokumen', 'arsip', 'pengaturan'];
const BOTTOM = ['dashboard', 'penerimaan', 'dokumen', 'arsip'];
const MORE = ['pm', 'pic', 'pagu', 'pengaturan'];

const app = document.getElementById('app');
let view = null, seq = 0, guard = null, current = 'dashboard', lastHash = '#/dashboard', ignoreHash = false;

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installEvt = e; });

function parseHash() {
  const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [name, qs] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { name: ROUTES[name] ? name : 'dashboard', params };
}
export function go(path) { location.hash = '#/' + path; }

function logout() {
  session.clear(); S.pm = []; S.pic = [];
  location.hash = ''; start();
}

function buildShell() {
  const u = session.user || {};
  const navLink = (name) => h('a', { href: '#/' + name, 'data-nav': name }, icon(ROUTES[name].icon, 20), ROUTES[name].title);
  const side = h('aside', { class: 'side' },
    h('div', { class: 'brand' }, h('img', { src: 'icons/icon-192.png', alt: '' }), h('div', {}, h('b', {}, 'SIPENDOK'), h('span', {}, S.settings.NAMA_SPPG || 'SPPG Jeungjing'))),
    h('nav', {}, SIDE.map(navLink)),
    h('div', { class: 'user' }, icon('user', 18), h('span', {}, u.nama || ''), h('button', { title: 'Keluar', 'aria-label': 'Keluar', onclick: askLogout }, icon('logout', 18))));
  const top = h('header', { class: 'topbar' }, h('img', { class: 'brand-mark', src: 'icons/icon-192.png', alt: '' }),
    h('div', {}, h('div', { class: 't1' }, 'SIPENDOK'), h('div', { class: 't2' }, S.settings.NAMA_SPPG || 'SPPG Jeungjing')), h('div', { class: 'page-title', id: 'page-title' }));
  view = h('main', { class: 'main', id: 'view' });
  const bottom = h('nav', { class: 'bottom', 'aria-label': 'Menu utama' },
    BOTTOM.map((n) => h('a', { href: '#/' + n, 'data-nav': n }, icon(ROUTES[n].icon, 22), ROUTES[n].title.replace('Dokumen Penerimaan', 'Dokumen'))),
    h('button', { 'data-nav': 'more', onclick: openMore }, icon('more', 22), 'Lainnya'));
  const offline = h('div', { class: 'offline hidden', id: 'offline' }, 'Tidak ada koneksi internet — data tidak dapat dimuat/disimpan.');
  app.replaceChildren(h('div', { class: 'shell' }, side, h('div', {}, offline, top, view)), bottom);
  const syncNet = () => document.getElementById('offline')?.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', syncNet); window.addEventListener('offline', syncNet); syncNet();
}

async function askLogout() {
  if (guard && guard() && !(await confirmDialog({ title: 'Ada data belum disimpan', message: 'Keluar sekarang akan membuang perubahan. Lanjutkan?', danger: true }))) return;
  logout();
}

function openMore() {
  const m = modal({
    title: 'Menu lainnya',
    body: h('div', { class: 'stack' },
      MORE.map((n) => h('a', { class: 'btn ghost block', style: { justifyContent: 'flex-start' }, href: '#/' + n, onclick: () => m.close() }, icon(ROUTES[n].icon, 20), ROUTES[n].title)),
      h('button', { class: 'btn ghost block', style: { justifyContent: 'flex-start', color: 'var(--err)' }, onclick: () => { m.close(); askLogout(); } }, icon('logout', 20), 'Keluar'))
  });
}

function markNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const n = a.getAttribute('data-nav');
    a.classList.toggle('on', n === name || (n === 'more' && MORE.includes(name)));
  });
  const t = document.getElementById('page-title'); if (t) t.textContent = ROUTES[name].title;
  document.title = ROUTES[name].title + ' — SIPENDOK';
}

async function route() {
  if (ignoreHash) { ignoreHash = false; return; }
  const { name, params } = parseHash();
  if (guard && guard()) {
    const okLeave = await confirmDialog({ title: 'Ada data belum disimpan', message: 'Berpindah halaman akan membuang perubahan yang belum disimpan. Lanjutkan?', confirmText: 'Buang & pindah', danger: true });
    if (!okLeave) { ignoreHash = true; location.hash = lastHash; return; }
  }
  guard = null; lastHash = location.hash || '#/dashboard'; current = name;
  const my = ++seq;
  markNav(name);
  view.classList.remove('with-bar'); document.querySelectorAll('.savebar').forEach((e) => e.remove());
  view.replaceChildren(skeleton(3));
  window.scrollTo(0, 0);
  try {
    const mod = await ROUTES[name].mod();
    if (my !== seq) return;
    const ctx = {
      params, alive: () => my === seq, go,
      setGuard: (fn) => { guard = fn; },
      withBar: (el) => { view.classList.toggle('with-bar', !!el); document.querySelectorAll('.savebar').forEach((e) => e.remove()); if (el) document.getElementById('app').append(el); }
    };
    view.replaceChildren();
    await mod.render(view, ctx);
  } catch (e) {
    if (my !== seq) return;
    view.replaceChildren(banner('err', h('b', {}, 'Gagal memuat halaman. '), errMsg(e)), h('div', { style: { marginTop: '12px' } }, h('button', { class: 'btn', onclick: route }, icon('refresh', 18), 'Coba lagi')));
  }
}

async function start() {
  guard = null;
  if (!session.token) {
    renderLogin(app, async () => { await start(); });
    return;
  }
  app.replaceChildren(h('div', { class: 'main' }, skeleton(4)));
  try {
    await loadBootstrap();
  } catch (e) {
    if (e.code === 'SESI_HABIS') return;   // onAuthLost akan menampilkan login
    app.replaceChildren(h('div', { class: 'main' }, banner('err', h('b', {}, 'Tidak dapat memuat data. '), errMsg(e)),
      h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn', onclick: start }, icon('refresh', 18), 'Coba lagi'), h('button', { class: 'btn ghost', onclick: logout }, 'Keluar'))));
    return;
  }
  buildShell();
  window.removeEventListener('hashchange', route); window.addEventListener('hashchange', route);
  await route();
}

onAuthLost(() => { toast('Sesi berakhir. Silakan masuk kembali.', 'warn'); start(); });

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Versi baru SIPENDOK tersedia.', 'info', { ms: 12000, action: { label: 'Muat ulang', fn: () => location.reload() } });
          }
        });
      });
    }).catch(() => {});
  });
}

if (!apiConfigured()) console.warn('SIPENDOK: API_URL belum diatur di config.js');
start();

/* SIPENDOK service worker — hanya menyimpan "kerangka" aplikasi agar cepat & dapat dipasang.
 * Data (Google Apps Script) TIDAK pernah disimpan di cache: PWA bukan database. */
const VERSION = 'sipendok-v1.1.0';
const SHELL = [
  './', './index.html', './config.js', './manifest.json', './css/app.css',
  './js/app.js', './js/api.js', './js/store.js', './js/ui.js', './js/util.js',
  './js/pages/login.js', './js/pages/dashboard.js', './js/pages/penerimaan.js', './js/pages/pm.js', './js/pages/pic.js',
  './js/pages/pagu.js', './js/pages/dokumen.js', './js/pages/arsip.js', './js/pages/pengaturan.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // API & lintas-origin: langsung ke jaringan
  // stale-while-revalidate untuk berkas aplikasi
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { net.catch(() => {}); return hit; }
      const res = await net;
      return res || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    })
  );
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

// SPPG JEUNGJING — Service Worker (Fase 2)
//
// Sebelumnya file ini TIDAK ADA sama sekali walau sudah didaftarkan di
// common.js (navigator.serviceWorker.register('service-worker.js')) --
// pendaftaran selalu gagal diam-diam (404, ditangkap .catch() yang memang
// disengaja untuk itu), jadi TIDAK PERNAH ada Service Worker aktif
// sebelum file ini dibuat. Efeknya: TIDAK ADA risiko "cache lama nyangkut"
// dari versi sebelumnya -- ini benar-benar mulai dari nol.
//
// ATURAN KETAT (sesuai instruksi optimasi Fase 2):
//   1. HANYA meng-cache asset statis: HTML, CSS, JS, ikon, font.
//   2. TIDAK PERNAH meng-cache: request ke Apps Script (data pribadi,
//      absensi, profil, token, dll) -- semua itu SELALU langsung ke
//      jaringan, tidak pernah lewat Service Worker ini sama sekali.
//   3. HANYA menangani method GET. POST/PUT/DELETE (submit absensi, simpan
//      profil, dst.) tidak disentuh sama sekali oleh 'fetch' handler ini.
//   4. Versi cache baru otomatis membuang cache versi lama (lihat 'activate'),
//      supaya update aplikasi tidak pernah "nyangkut" di versi basi.

const CACHE_NAME = 'sppg-static-v1'; // NAIKKAN nomor ini kalau strategi cache di file ini diubah lagi nanti -- cache lama otomatis dibuang saat versi baru aktif.

/** True kalau request ini menuju backend API (Apps Script) atau layanan pihak ketiga -- JANGAN PERNAH disentuh cache. */
function permintaanApiAtauPihakKetiga_(url) {
  return (
    url.hostname.indexOf('script.google.com') !== -1 ||
    url.hostname.indexOf('script.googleusercontent.com') !== -1 ||
    url.hostname.indexOf('googleapis.com') !== -1 ||
    url.hostname.indexOf('firebaseio.com') !== -1 ||
    url.hostname.indexOf('googletagmanager.com') !== -1
  );
}

self.addEventListener('install', () => {
  // Versi baru langsung siap dipakai, tidak menunggu semua tab lama ditutup.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namaCache) => Promise.all(
        namaCache.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Cuma tangani GET. Semua method lain (POST/PUT/DELETE) dibiarkan lewat
  // apa adanya ke jaringan -- ini termasuk SEMUA aksi tulis (submit
  // absensi, simpan profil, kirim pengajuan, dll).
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Lintas-origin ke Apps Script/API/layanan pihak ketiga mana pun --
  // JANGAN PERNAH di-cache, selalu ke jaringan apa adanya.
  if (permintaanApiAtauPihakKetiga_(url)) return;

  // Cuma tangani asset dari origin situs ini sendiri (HTML/CSS/JS/gambar/font).
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((tersimpan) => {
        // Selalu coba ambil versi terbaru di jaringan untuk kunjungan
        // BERIKUTNYA (stale-while-revalidate) -- kalau sukses & valid,
        // perbarui cache. Kalau jaringan gagal (offline), fallback ke
        // yang tersimpan di cache (kalau ada).
        const dariJaringan = fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200 && resp.type === 'basic') {
              cache.put(req, resp.clone());
            }
            return resp;
          })
          .catch(() => tersimpan);

        // Kalau sudah ada di cache: kembalikan LANGSUNG (cepat, termasuk
        // saat offline), sambil tetap memperbarui cache di belakang layar.
        // Kalau belum ada di cache sama sekali: tunggu jaringan.
        return tersimpan || dariJaringan;
      })
    )
  );
});

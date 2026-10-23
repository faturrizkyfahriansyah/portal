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

const CACHE_NAME = 'sppg-static-v2'; // NAIKKAN nomor ini kalau strategi cache di file ini diubah lagi nanti -- cache lama otomatis dibuang saat versi baru aktif.

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

  // Diperbaiki 23 Okt 2026 (dilaporkan Admin: tombol sudah diperbaiki &
  // dideploy berkali-kali, tapi browser TETAP menampilkan pesan versi
  // LAMA -- bahkan setelah hard refresh). SEBAB: strategi lama
  // (stale-while-revalidate) SELALU mengembalikan versi CACHE LAMA
  // secara instan kalau sudah pernah tersimpan, baru memperbarui cache
  // utk kunjungan BERIKUTNYA -- utk situs yg sedang sering diubah
  // (seperti proyek ini), ini berarti perubahan baru BISA butuh 2 kali
  // reload utk benar2 terlihat, dan dalam kondisi tertentu (banyak tab
  // terbuka, dsb) bisa terasa "nyangkut" lebih lama lagi.
  //
  // DIGANTI ke NETWORK-FIRST utk HTML/JS/CSS (file yg paling sering
  // berubah selama pengembangan aktif): coba jaringan DULU setiap kali;
  // cache HANYA dipakai sbg fallback kalau jaringan benar2 gagal
  // (offline). Ini MENGHILANGKAN risiko "kode lama nyangkut" sepenuhnya
  // selama ada koneksi internet -- pengorbanannya cuma sedikit lebih
  // lambat drpd cache-first, which Not noticeable utk file JS/CSS
  // berukuran kecil-menengah seperti ini.
  const path = url.pathname;
  const asetSeringBerubah = /\.(js|html|css)$/i.test(path) || path === '/' || path.endsWith('/');

  if (asetSeringBerubah) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Diperbaiki 23 Okt 2026 (dilaporkan: "Failed to execute 'clone'
          // on Response: Response body is already used"). SEBAB: .clone()
          // SEBELUMNYA dipanggil DI DALAM caches.open().then(...) yg async
          // -- browser bisa saja sudah mulai memakai body `resp` asli
          // (utk merender halaman) SEBELUM clone() sempat jalan, krn
          // caches.open() butuh waktu (walau singkat) utk selesai. Clone
          // HARUS dipanggil SEKETIKA/SYNCHRONOUS di sini, sebelum operasi
          // async apa pun -- baru hasil clone-nya yg dikirim ke dalam .then().
          const salinanUtkCache = (resp && resp.status === 200 && resp.type === 'basic') ? resp.clone() : null;
          if (salinanUtkCache) caches.open(CACHE_NAME).then((cache) => cache.put(req, salinanUtkCache));
          return resp;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(req)))
    );
    return;
  }

  // Aset jarang berubah (gambar, font, ikon) -- TETAP cache-first demi
  // kecepatan, aman krn file jenis ini praktis tidak pernah diedit ulang
  // dgn nama yg sama.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((tersimpan) => {
        const dariJaringan = fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200 && resp.type === 'basic') cache.put(req, resp.clone());
            return resp;
          })
          .catch(() => tersimpan);
        return tersimpan || dariJaringan;
      })
    )
  );
});

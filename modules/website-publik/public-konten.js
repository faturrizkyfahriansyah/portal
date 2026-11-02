// ============================================================
// public-konten.js — Website Publik membaca konten dari CMS Admin
// Dipasang di halaman publik yang punya elemen data-konten="kunci".
// FALLBACK AMAN: kalau konten belum pernah diisi Admin, elemen SAMA
// SEKALI TIDAK DISENTUH -- teks HTML asli yang sudah ada tetap tampil.
// ============================================================

(function () {
  const halaman = document.body.getAttribute('data-halaman-publik');
  if (!halaman) return; // halaman ini belum diaktifkan untuk CMS

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const url = GOOGLE_APPS_SCRIPT_WEB_APP_URL + '?action=getKontenPublik&halaman=' + encodeURIComponent(halaman);
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success || !json.data) return;

      const konten = json.data;
      document.querySelectorAll('[data-konten]').forEach(el => {
        const kunci = el.getAttribute('data-konten');
        if (konten[kunci]) el.textContent = konten[kunci];
      });
      // BARU: data-konten-href -- sama seperti data-konten di atas, tapi
      // untuk elemen <a> yang perlu diperbarui atribut href-nya (mis. link
      // Instagram/TikTok), bukan teksnya. Fallback aman yang sama: kalau
      // Admin belum isi, href asli di HTML (biasanya "#") tetap dipakai.
      document.querySelectorAll('[data-konten-href]').forEach(el => {
        const kunci = el.getAttribute('data-konten-href');
        if (konten[kunci]) el.setAttribute('href', konten[kunci]);
      });
    } catch (e) {
      // Gagal ambil konten CMS -- diamkan, teks HTML asli tetap tampil (fallback aman).
    }
  });
})();

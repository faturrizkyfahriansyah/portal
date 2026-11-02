// terapkan-preferensi.js — Terapkan preferensi Tampilan (Tema/Ukuran
// Teks/Kepadatan) SEDINI MUNGKIN di setiap halaman, supaya tidak ada
// "kedipan" tampilan default sebelum preferensi tersimpan diterapkan.
// Disimpan di localStorage (per-perangkat) -- portal ini bukan React/
// artifact sandbox, jadi localStorage aman dipakai di sini.
(function () {
  const html = document.documentElement;

  const tema = localStorage.getItem('sppgTema') || 'terang';
  let temaAktif = tema;
  if (tema === 'sistem') {
    temaAktif = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'gelap' : 'terang';
  }
  html.setAttribute('data-tema', temaAktif);

  const ukuranTeks = localStorage.getItem('sppgUkuranTeks') || 'normal';
  html.setAttribute('data-ukuran-teks', ukuranTeks);

  const kepadatan = localStorage.getItem('sppgKepadatan') || 'nyaman';
  html.setAttribute('data-kepadatan', kepadatan);
})();

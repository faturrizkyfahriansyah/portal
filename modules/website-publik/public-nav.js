// ============================================================
// public-nav.js — Sidebar navigasi (slide dari kanan) Website Publik.
// Dipakai bersama di semua halaman publik lewat markup yang sama persis
// (lihat komponen di setiap file .html: .pub-menu-btn, .pub-sidebar, dst).
//
// Menu sekarang BISA diatur (nama/urutan/aktif) dari Admin -> Website
// Publik -> Menu Website (GET getMenuWebsitePublik). FALLBACK AMAN: kalau
// fetch gagal, markup <nav> ASLI yang sudah ada di HTML tetap dipakai
// apa adanya -- menu tidak pernah hilang/kosong karena masalah jaringan.
// Tombol CTA "Portal SPPG Jeungjing ->" TIDAK disentuh sama sekali.
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const btnBuka = document.querySelector('.pub-menu-btn');
  const sidebar = document.querySelector('.pub-sidebar');
  const overlay = document.querySelector('.pub-overlay');
  const btnTutup = document.querySelector('.pub-sidebar-close');
  if (!btnBuka || !sidebar || !overlay) return;

  function buka() { sidebar.classList.add('is-open'); overlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  function tutup() { sidebar.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow = ''; }

  btnBuka.addEventListener('click', buka);
  if (btnTutup) btnTutup.addEventListener('click', tutup);
  overlay.addEventListener('click', tutup);

  // Coba muat menu dinamis dari Admin -- HANYA ganti link REGULER
  // (bukan tombol CTA Portal), dan HANYA kalau berhasil & tidak kosong.
  try {
    if (typeof GOOGLE_APPS_SCRIPT_WEB_APP_URL !== 'undefined') {
      const res = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL + '?action=getMenuWebsitePublik');
      const json = await res.json();
      if (json.success && json.data && json.data.length) {
        const nav = sidebar.querySelector('nav');
        const cta = nav.querySelector('.pub-sidebar-cta'); // tombol Portal -- dipertahankan APA ADANYA
        nav.querySelectorAll('a:not(.pub-sidebar-cta)').forEach(a => a.remove());
        json.data.forEach(m => {
          const a = document.createElement('a');
          a.href = m.halaman;
          a.textContent = m.label;
          nav.insertBefore(a, cta);
        });
      }
    }
  } catch (e) {
    // Gagal ambil menu dinamis -- diamkan, markup <nav> ASLI di HTML tetap dipakai.
  }

  // Tandai menu aktif berdasarkan file halaman saat ini.
  const halamanIni = window.location.pathname.split('/').pop() || 'index.html';
  sidebar.querySelectorAll('a[href]').forEach(a => {
    if (a.getAttribute('href') === halamanIni) a.classList.add('is-active');
  });
});

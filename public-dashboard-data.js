// ============================================================
// public-dashboard-data.js — BARU 29 Okt 2026.
// Mengisi "Menu Hari Ini" & "Penerima Manfaat" di index.html dengan
// data LIVE (sebelumnya HARDCODED langsung di HTML -- "Nasi",
// "Ayam Bumbu", dan angka "—" yang TIDAK PERNAH memanggil API sama
// sekali). Beda dari public-konten.js (CMS, utk teks yg diedit Admin
// manual spt Profil Tim) -- INI data OPERASIONAL harian yg memang
// HARUS auto-berubah tiap hari, jadi diambil LANGSUNG dari backend,
// bukan lewat CMS. Pola fetch SAMA dgn public-nav.js (fetch mentah,
// bukan apiGet -- common.js tidak dimuat di halaman publik).
//
// Dipasang HANYA di halaman yang PUNYA elemen .pub-menu-grid dan/atau
// .pub-benef-grid (saat ini index.html) -- aman dimuat di halaman lain
// yang tidak punya elemen ini, script langsung berhenti (lihat if di
// bawah).
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const gridMenu = document.querySelector('.pub-menu-grid');
  const gridBenef = document.querySelector('.pub-benef-grid');
  if (!gridMenu && !gridBenef) return; // halaman ini tidak punya kedua elemen -- tidak relevan

  const IKON = { karbohidrat: '🍚', laukHewani: '🍗', laukNabati: '🌱', sayur: '🥬', buah: '🍉', pelengkap: '🥛' };
  const LABEL_KATEGORI = { karbohidrat: 'Karbohidrat', laukHewani: 'Protein Hewani', laukNabati: 'Protein Nabati', sayur: 'Serat & Vitamin', buah: 'Buah', pelengkap: 'Pelengkap' };

  if (gridMenu) {
    try {
      const res = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL + '?action=getMenuHariIniDashboard');
      const json = await res.json();
      const m = json.success ? json.data : null;
      if (m) {
        const urutan = ['karbohidrat', 'laukHewani', 'laukNabati', 'sayur', 'buah', 'pelengkap'];
        gridMenu.innerHTML = urutan
          .filter((k) => m[k]) // lewati field kosong (mis. pelengkap sering tidak diisi)
          .map((k) => `<div class="pub-menu-item"><div class="ico">${IKON[k]}</div><div class="label">${escapeHtmlPublik_(m[k])}</div><div class="val">${LABEL_KATEGORI[k]}</div></div>`)
          .join('');
      } else {
        gridMenu.innerHTML = '<p style="color:var(--pub-text-muted,#777);">Menu hari ini belum tersedia di database siklus menu.</p>';
      }
    } catch (e) {
      // Diam -- konten HTML asli (hardcoded) tetap tampil kalau fetch gagal total,
      // drpd halaman publik kosong total krn masalah jaringan sesaat.
    }
  }

  if (gridBenef) {
    try {
      const res = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL + '?action=getRingkasanPmPublik');
      const json = await res.json();
      const p = json.success ? json.data : null;
      if (p) {
        const kartu = gridBenef.querySelectorAll('.pub-benef-card b');
        // Urutan PERSIS sesuai HTML asli: Peserta Didik, Ibu Hamil, Ibu Menyusui, Balita
        const nilai = [p.pesertaDidik, p.ibuHamil, p.ibuMenyusui, p.balita];
        kartu.forEach((el, i) => { if (nilai[i] !== undefined) el.textContent = formatAngkaPublik_(nilai[i]); });
      }
    } catch (e) {
      // Diam -- "—" asli tetap tampil kalau fetch gagal, drpd error terlihat pengunjung umum.
    }
  }
});

function escapeHtmlPublik_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function formatAngkaPublik_(n) {
  return Number(n).toLocaleString('id-ID');
}

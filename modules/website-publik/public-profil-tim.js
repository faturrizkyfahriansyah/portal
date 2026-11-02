// ============================================================
// public-profil-tim.js — BARU 29 Okt 2026 (DIMINTA Admin: Profil
// SPPG diganti dari CMS manual ke auto-sync 01_DATA_RELAWAN).
// Dipasang HANYA di profil-sppg.html (lewat pengecekan elemen di
// bawah -- aman kalau script ini kelak ikut termuat di halaman lain).
// Fallback aman SAMA spt public-dashboard-data.js: kalau fetch gagal
// atau satu grup kosong (nama divisi tidak cocok), konten HARDCODED
// asli di HTML tetap tampil -- publik TIDAK PERNAH melihat "kosong".
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const elCekAda = document.getElementById('timPengawasGizi');
  if (!elCekAda) return; // bukan halaman profil-sppg.html

  try {
    const res = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL + '?action=getProfilTimPublik');
    const json = await res.json();
    if (!json.success || !json.data) return; // diam -- fallback hardcoded tetap tampil
    const p = json.data;

    const isiSatu = (id, nama) => { if (nama) { const el = document.getElementById(id); if (el) el.textContent = nama; } };
    const isiDaftar = (id, daftarNama) => {
      if (!daftarNama || !daftarNama.length) return; // kosong -- biarkan daftar hardcoded asli tampil
      const el = document.getElementById(id);
      if (el) el.innerHTML = daftarNama.map((n) => `<li>${escapeHtmlTim_(n)}</li>`).join('');
    };

    isiSatu('timPengawasGizi', p.pengawasGizi);
    isiSatu('timPengawasKeuangan', p.pengawasKeuangan);
    isiSatu('timAsistenLapangan', p.asistenLapangan);
    isiSatu('timKoordinatorMasak', p.koordinatorJuruMasak);
    isiSatu('timPetugasGudang', p.petugasGudang);
    isiSatu('timAdmin', p.admin);
    isiSatu('timCleaningService', p.cleaningService);
    isiDaftar('timSecurity', p.security);
    isiDaftar('timDivisiPersiapan', p.divisiPersiapan);
    isiDaftar('timDivisiPengolahan', p.divisiPengolahan);
    isiDaftar('timDivisiPemorsian', p.divisiPemorsian);
    isiDaftar('timDivisiDistribusi', p.divisiDistribusi);
    isiDaftar('timDivisiCuciOmpreng', p.divisiCuciOmpreng);
  } catch (e) {
    // Diam -- fallback hardcoded asli tetap tampil, drpd halaman Profil Tim kosong/error.
  }
});

function escapeHtmlTim_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

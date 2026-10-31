/**
 * SPPG JEUNGJING — core/NavigasiTerpusat.js (v2, DIROMBAK 30 Okt 2026)
 * Tahap 4: Penataan Navigasi PORTAL.
 *
 * DIROMBAK dari versi pertama setelah diaudit langsung thd HTML ASLI:
 * sidebar relawan (dashboard.html dkk) py tombol Keluar (#btnLogoutShell)
 * & Ciutkan Menu (#shellCollapseToggle) yang SUDAH TERSAMBUNG di luar
 * daftar link -- MENGGANTI seluruh sidebar (rencana v1) berisiko merusak
 * itu di 23 halaman sekaligus. admin.html pula pakai <button data-panel>
 * dgn sistem tab sendiri yg sudah canggih (lazy-load dkk) -- SAMA SEKALI
 * beda dari <a href> biasa di sisi relawan.
 *
 * PENDEKATAN BARU (lebih aman): MEMPERKAYA link/tombol yang SUDAH ADA di
 * HTML (tambah ikon gembok + nonaktifkan klik kalau belum berizin),
 * BUKAN membongkar & menulis ulang sidebar. Tidak menyentuh struktur,
 * tombol Keluar, Ciutkan Menu, atau sistem tab admin.html sama sekali.
 *
 * CARA PASANG (SAMA utk admin.html maupun halaman relawan):
 * <script src="core/NavigasiTerpusat.js"></script> SETELAH core/common.js & config.js.
 * Lalu panggil terapkanStatusAksesNavigasi({ token: authToken }) SETELAH
 * login berhasil / sesi dipulihkan.
 *
 * Tidak perlu tahu jenis portal/daftar menu scr eksplisit -- fungsi ini
 * BEKERJA DARI HTML yg sudah ada: cari semua elemen `.shell-nav-link`
 * (link relawan) ATAU `.admin-tab-btn` (tombol admin), cocokkan ke
 * KODE_MODUL lewat PETA_HREF_KE_MODUL_ di bawah (berbasis href/data-panel
 * yg SUDAH ada di markup, bukan menebak/membuat baru).
 */

// Peta href (sisi relawan) / data-panel (sisi admin) -> KODE_MODUL,
// DIAMBIL LANGSUNG dari markup HTML yang sudah ada (diverifikasi, bukan
// dikarang). Item yg TIDAK ada di peta ini (Dashboard/Profil/dll) dianggap
// selalu terbuka -- tidak pernah dikunci, sesuai BAB III.3-3.4 roadmap.
const PETA_HREF_KE_MODUL_ = {
  // -- Sisi Relawan (href file HTML) --
  'absensi.html': 'SIPRES', 'riwayat.html': 'SIPRES', 'pengajuan.html': 'SIPRES', 'monitoring-kehadiran-koordinator.html': 'SIPRES',
  'sipandu.html': 'SIPANDU',
  'siraga.html': 'SIRAGA', 'stok-relawan.html': 'SIRAGA', 'pengajuan-kebutuhan-koordinator.html': 'SIRAGA', 'retur-barang-koordinator.html': 'SIRAGA',
  'jadwal.html': 'SIKOP', 'jadwal-anggota.html': 'SIKOP', 'pembagian-tugas-koordinator.html': 'SIKOP',
  // 'laporan-kendala-koordinator.html' & 'monitoring.html' SENGAJA tidak
  // dipetakan -- ambigu antara SIPIKA/SIKOP, drpd nebak salah dibiarkan
  // terbuka (fail-open, bukan dikunci asal-asalan).
  'informasi.html': 'SIPIKA', 'notifikasi.html': 'SIPIKA', 'penerimaan-pat.html': 'SIPIKA', 'dokumen.html': 'SIPIKA',
  '../02-SIPENDOK/index.html': 'SIPENDOK',
  '../03-SIPOGIM/beranda.html': 'SIPOGIM'
};
const PETA_PANEL_KE_MODUL_ = {
  // -- Sisi Admin (data-panel, lihat admin.html) --
  panelRelawan: 'SIMSDM', panelAkun: 'SIMSDM', panelDivisi: 'SIMSDM', panelRoleAkses: 'SIMSDM', panelManajemenHakAkses: 'SIMSDM', panelPengelolaSppg: 'SIMSDM', panelProfilRelawan: 'SIMSDM',
  panelHarian: 'SIPRES', panelDuaMinggu: 'SIPRES', panelMasterTarif: 'SIPRES', panelMonitoringPresensi: 'SIPRES', panelPengajuanKetidakhadiranAdmin: 'SIPRES', panelJadwalIndividu: 'SIPRES', panelKartuQr: 'SIPRES', panelLaporan: 'SIPRES',
  panelPeriode: 'SIKOP', panelKalender: 'SIKOP', panelLokasi: 'SIKOP', panelJadwal: 'SIKOP', panelShift: 'SIKOP',
  panelStok: 'SIRAGA', panelPengajuanKebutuhanAdmin: 'SIRAGA', panelReturBarangAdmin: 'SIRAGA',
  panelHakAksesSipandu: 'SIPANDU',
  panelInformasi: 'SIPIKA', panelPengumuman: 'SIPIKA', panelNotifikasiAdmin: 'SIPIKA', panelDokumen: 'SIPIKA', panelPenerimaManfaatOps: 'SIPIKA',
  panelWebsitePublik: 'SIPIKA',
  panelMenuHariIni: 'SIPOGIM'
};

/**
 * Ambil token OTOMATIS, tidak perlu dioper manual per halaman -- coba
 * dari sesi Admin dulu (window.sppgAdminToken, diset modules/admin/admin.js), baru
 * sesi Relawan (ambilSesiRelawan(), core/auth-relawan.js). Kosong kalau
 * belum ada DUA-duanya (belum login/sesi belum dipulihkan).
 */
function ambilTokenOtomatis_() {
  if (typeof window.sppgAdminToken === 'string' && window.sppgAdminToken) return window.sppgAdminToken;
  if (typeof ambilSesiRelawan === 'function') {
    const sesi = ambilSesiRelawan();
    if (sesi && sesi.token) return sesi.token;
  }
  return '';
}

/**
 * Dipanggil OTOMATIS saat file ini dimuat (lihat pemanggilan diri
 * sendiri di baris paling bawah) -- TIDAK perlu dipanggil manual per
 * halaman. Coba ulang tiap 500ms sampai 10 detik (login/pemulihan sesi
 * sering baru SELESAI beberapa saat setelah halaman dimuat, bukan
 * langsung) -- berhenti begitu token ketemu & berhasil diterapkan,
 * atau begitu 10 detik habis tanpa token (anggap memang belum login,
 * diam saja -- halaman LOGIN sendiri wajar tidak pernah py token).
 */
function mulaiTerapkanStatusAksesNavigasi_() {
  let percobaan = 0;
  const batas = 20; // 20 x 500ms = 10 detik
  const interval = setInterval(async () => {
    percobaan++;
    const token = ambilTokenOtomatis_();
    if (token) { clearInterval(interval); await terapkanStatusAksesNavigasi_({ token }); }
    else if (percobaan >= batas) { clearInterval(interval); }
  }, 500);
}

/**
 * @param {Object} opsi { token: string }
 * Aman dipanggil di halaman MANAPUN -- kalau elemen relevan tidak
 * ditemukan (mis. halaman tanpa sidebar), tidak melakukan apa-apa.
 */
async function terapkanStatusAksesNavigasi_(opsi) {
  const linkRelawan = document.querySelectorAll('a.shell-nav-link[href]');
  const tombolAdmin = document.querySelectorAll('button.admin-tab-btn[data-panel]');
  if (!linkRelawan.length && !tombolAdmin.length) return; // halaman ini tidak py elemen relevan

  let aksesModul = {};
  try {
    aksesModul = await apiGet('getAksesModulSaya', { token: opsi.token });
  } catch (e) {
    console.warn('NavigasiTerpusat: gagal ambil status akses, sidebar ditampilkan terbuka semua sementara.', e.message);
    return; // fail-open -- JANGAN kunci apa pun kalau statusnya sendiri gagal diambil
  }

  function kunciElemen_(el, kodeModul) {
    el.classList.add('shell-nav-link--terkunci');
    el.insertAdjacentHTML('beforeend', '<span class="shell-nav-gembok" aria-hidden="true" style="margin-left:auto;opacity:.6;">🔒</span>');
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      alert('Anda belum memiliki akses ke modul ini. Hubungi Pengelola kalau merasa ini keliru.');
    }, true); // capture:true -- pastikan tertangkap LEBIH DULU drpd listener lain yg sudah ada di elemen ini (mis. tab-switch admin.html)
  }

  linkRelawan.forEach(a => {
    const href = (a.getAttribute('href') || '').split('#')[0].split('?')[0];
    const kodeModul = PETA_HREF_KE_MODUL_[href];
    if (kodeModul && aksesModul[kodeModul] === false) kunciElemen_(a, kodeModul);
  });

  tombolAdmin.forEach(btn => {
    const kodeModul = PETA_PANEL_KE_MODUL_[btn.dataset.panel];
    if (kodeModul && aksesModul[kodeModul] === false) kunciElemen_(btn, kodeModul);
  });
}

// Mulai otomatis -- lihat catatan mulaiTerapkanStatusAksesNavigasi_ di atas.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mulaiTerapkanStatusAksesNavigasi_);
} else {
  mulaiTerapkanStatusAksesNavigasi_();
}

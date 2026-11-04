/**
 * SPPG JEUNGJING — NavigasiTerpusat.js (v2, DIROMBAK 30 Okt 2026)
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
 * <script src="core/NavigasiTerpusat.js"></script> SETELAH common.js & config.js.
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
  'sipendok/index.html': 'SIPENDOK',
  'sipogim/beranda.html': 'SIPOGIM',
  'absensi-qr.html': 'SIPRES_QR'   // 4 Nov 2026: SIPRES QR (tanpa login) diatur per relawan di Manajemen Hak Akses
};
const PETA_PANEL_KE_MODUL_ = {
  // -- Sisi Admin (data-panel, lihat admin.html) --
  panelRelawan: 'SIMSDM', panelAkun: 'SIMSDM', panelDivisi: 'SIMSDM', panelRoleAkses: 'SIMSDM', panelManajemenHakAkses: 'SIMSDM', panelPengelolaSppg: 'SIMSDM', panelProfilRelawan: 'SIMSDM',
  panelHarian: 'SIPRES', panelRekapMingguan: 'SIPRES', panelSipanduMaster: 'SIPANDU', panelSipanduPm: 'SIPANDU', panelSipanduMenu: 'SIPANDU', panelSipanduPagu: 'SIPANDU', panelSipanduBiaya: 'SIPANDU', panelDuaMinggu: 'SIPRES', panelMasterTarif: 'SIPRES', panelMonitoringPresensi: 'SIPRES', panelPengajuanKetidakhadiranAdmin: 'SIPRES', panelJadwalIndividu: 'SIPRES', panelKartuQr: 'SIMSDM', panelLaporan: 'SIPRES',
  panelPeriode: 'SIKOP', panelKalender: 'SIKOP', panelKalenderOperasional: 'SIKOP', panelLokasi: 'SIKOP', panelJadwal: 'SIKOP', panelShift: 'SIKOP',
  panelStok: 'SIRAGA', panelPengajuanKebutuhanAdmin: 'SIRAGA', panelReturBarangAdmin: 'SIRAGA',
  panelHakAksesSipandu: 'SIPANDU',
  panelInformasi: 'SIPIKA', panelPengumuman: 'SIPIKA', panelNotifikasiAdmin: 'SIPIKA', panelDokumen: 'SIPIKA', panelPenerimaManfaatOps: 'SIPIKA',
  panelWebsitePublik: 'SIPIKA',
  panelMenuHariIni: 'SIPOGIM'
};

/**
 * Ambil token OTOMATIS, tidak perlu dioper manual per halaman -- coba
 * dari sesi Admin dulu (window.sppgAdminToken, diset admin.js), baru
 * sesi Relawan (ambilSesiRelawan(), auth-relawan.js). Kosong kalau
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
/**
 * 4 Nov 2026: SIPENDOK, SIPOGIM, SIPRES QR (dibuka tanpa login) TAMPIL di sidebar SEMUA relawan, tetapi terkunci bagi yang belum diberi akses
 * (Manajemen Hak Akses > Akses Per Relawan). Disisipkan SEKALI di sini (bukan diedit di 23 halaman). Hanya di sisi relawan, dan hanya setelah
 * status akses berhasil diambil (bila gagal: tidak ditampilkan, bukan terbuka).
 */
function sisipkanAplikasiTanpaLogin_() {
  const nav = document.querySelector('nav.shell-nav');
  if (!nav || document.querySelector('button.admin-tab-btn[data-panel]') || nav.querySelector('[data-aplikasi-tanpa-login]')) return;
  const ikon = function (d) { return '<span class="icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg></span>'; };
  const daftar = [
    { href: 'sipendok/index.html', nama: 'SIPENDOK', ikon: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>' },
    { href: 'sipogim/beranda.html', nama: 'SIPOGIM', ikon: '<path d="M4 3v8a3 3 0 0 0 3 3v7M7 3v8M10 3v8a3 3 0 0 1-3 3"/><path d="M17 3c-2 2-3 5-3 8s1 4 3 4v6"/>' },
    { href: 'absensi-qr.html', nama: 'SIPRES QR', ikon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>' }
  ];
  const judul = document.createElement('p'); judul.className = 'shell-nav-group-title'; judul.textContent = 'Aplikasi Lain'; judul.setAttribute('data-aplikasi-tanpa-login', '1');
  nav.appendChild(judul);
  daftar.forEach(function (x) {
    if (nav.querySelector('a[href="' + x.href + '"]')) return;
    const a = document.createElement('a'); a.href = x.href; a.className = 'shell-nav-link'; a.setAttribute('data-aplikasi-tanpa-login', '1');
    a.innerHTML = ikon(x.ikon) + '<span>' + x.nama + '</span>'; nav.appendChild(a);
  });
}

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

  try { sisipkanAplikasiTanpaLogin_(); } catch (e) { console.warn('NavigasiTerpusat: gagal menyisipkan aplikasi lain', e.message); }

  function kunciElemen_(el, kodeModul) {
    el.classList.add('shell-nav-link--terkunci');
    // Penanda terkunci berupa TEKS (bukan ikon gembok; Admin 4 Nov: tampilan resmi tanpa ikon/emoji).
    el.insertAdjacentHTML('beforeend', '<span class="shell-nav-gembok" style="margin-left:auto;font-size:10.5px;font-weight:600;opacity:.7;">Terkunci</span>');
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      alert('Anda belum memiliki akses ke modul ini. Hubungi Pengelola kalau merasa ini keliru.');
    }, true); // capture:true -- pastikan tertangkap LEBIH DULU drpd listener lain yg sudah ada di elemen ini (mis. tab-switch admin.html)
  }

  document.querySelectorAll('a.shell-nav-link[href]').forEach(a => {
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

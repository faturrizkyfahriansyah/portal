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
  panelPergiliran: 'SIMSDM', panelPenetapanPergiliran: 'SIKOP', panelRelawan: 'SIMSDM', panelAkun: 'SIMSDM', panelDivisi: 'SIMSDM', panelRoleAkses: 'SIMSDM', panelManajemenHakAkses: 'SIMSDM', panelPengelolaSppg: 'SIMSDM', panelVerifikasiWa: 'SIMSDM', panelProfilRelawan: 'SIMSDM',
  panelHarian: 'SIPRES', panelRekapMingguan: 'SIPRES', panelSipanduMaster: 'SIPANDU', panelSipanduPm: 'SIPANDU', panelSipanduMenu: 'SIPANDU', panelSipanduPagu: 'SIPANDU', panelSipanduBiaya: 'SIPANDU', panelDuaMinggu: 'SIPRES', panelMasterTarif: 'SIPRES', panelMonitoringPresensi: 'SIPRES', panelPengajuanKetidakhadiranAdmin: 'SIPRES', panelJadwalIndividu: 'SIPRES', panelDiagnosaAbsen: 'SIPRES', panelKartuQr: 'SIMSDM', panelLaporan: 'SIPRES',
  panelPeriode: 'SIKOP', panelKalender: 'SIKOP', panelKalenderOperasional: 'SIKOP', panelLokasi: 'SIKOP', panelJadwal: 'SIKOP', panelShift: 'SIKOP',
  panelStok: 'SIRAGA', panelPengajuanKebutuhanAdmin: 'SIRAGA', panelReturBarangAdmin: 'SIRAGA',
  panelHakAksesSipandu: 'SIPANDU',
  panelInformasi: 'SIPIKA', panelPengumuman: 'SIPIKA', panelNotifikasiAdmin: 'SIPIKA', panelDokumen: 'SIPIKA', panelPenerimaManfaatOps: 'SIPIKA', panelPendataan3B: 'SIPIKA',
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


/* ================================================================
 * 22 Nov 2026 (Tahap 2, R8): SIDEBAR PORTAL RELAWAN JADI 6 GRUP
 * Beranda, Presensi, Jadwal dan Tugas, Pengajuan, Informasi dan Bantuan, Profil.
 * Grup Koordinator dan Pengawasan HANYA muncul untuk role yang berhak.
 *
 * Pendekatan sama dengan berkas ini: link yang SUDAH ada di tiap halaman DIPINDAHKAN (bukan ditulis ulang), jadi ikon, penanda halaman aktif,
 * tombol Keluar dan Ciutkan Menu tidak tersentuh. Bila apa pun gagal, sidebar lama tetap tampil apa adanya.
 * Ini hanya tampilan: hak akses tetap dijaga server (requireRoleBaru_/requireRole_), halamannya sendiri tidak berubah.
 * ================================================================ */
const GRUP_SIDEBAR_RELAWAN_ = [
  { kunci: 'beranda', judul: 'Beranda', href: ['dashboard.html'] },
  { kunci: 'presensi', judul: 'Presensi', href: ['absensi.html', 'riwayat.html', 'absensi-qr.html'] },
  { kunci: 'jadwal', judul: 'Jadwal dan Tugas', href: ['jadwal.html', 'sipandu.html', 'siraga.html', 'stok-relawan.html', 'sipendok/index.html', 'sipogim/beranda.html'] },
  { kunci: 'koordinator', judul: 'Koordinator', bersyarat: 'koordinator', href: ['jadwal-anggota.html', 'monitoring-kehadiran-koordinator.html', 'pembagian-tugas-koordinator.html', 'laporan-kendala-koordinator.html', 'pengajuan-kebutuhan-koordinator.html', 'retur-barang-koordinator.html'] },
  { kunci: 'pengawasan', judul: 'Pengawasan', bersyarat: 'pengawasan', href: ['monitoring.html'] },
  { kunci: 'pengajuan', judul: 'Pengajuan', href: ['pengajuan.html'] },
  { kunci: 'informasi', judul: 'Informasi dan Bantuan', href: ['notifikasi.html', 'informasi.html', 'penerimaan-pat.html', 'dokumen.html', 'bantuan.html'] },
  { kunci: 'profil', judul: 'Profil', href: ['profil.html', 'id-card-saya.html', 'pengaturan.html'] }
];
/** Aplikasi tanpa login yang disisipkan belakangan (sisipkanAplikasiTanpaLogin_) -> grup tujuannya. */
const GRUP_APLIKASI_TANPA_LOGIN_ = { 'absensi-qr.html': 'presensi', 'sipendok/index.html': 'jadwal', 'sipogim/beranda.html': 'jadwal' };

const KATALOG_MENU_RELAWAN_ = {"dashboard.html": {"l": "Dashboard", "i": "<path d=\"M3 11l9-8 9 8\"/><path d=\"M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10\"/>"}, "profil.html": {"l": "Profil Saya", "i": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 20c0-4 4-6 8-6s8 2 8 6\"/>"}, "id-card-saya.html": {"l": "ID Card Saya", "i": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><circle cx=\"8.5\" cy=\"10.5\" r=\"1.8\"/><path d=\"M5.5 16c.5-2 2-3 3-3s2.5 1 3 3\"/><path d=\"M14 9h5M14 13h3\"/>"}, "absensi.html": {"l": "Presensi Kehadiran", "i": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 3h6v3H9z\"/><path d=\"M9 12l2 2 4-4\"/>"}, "riwayat.html": {"l": "Riwayat Presensi", "i": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 8v4l3 2\"/>"}, "pengajuan.html": {"l": "Pengajuan Ketidakhadiran", "i": "<path d=\"M9 12h6\"/><path d=\"M12 9v6\"/><circle cx=\"12\" cy=\"12\" r=\"9\"/>"}, "sipandu.html": {"l": "Produksi & Data Operasional", "i": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/><path d=\"M8 9h8M8 13h8M8 17h4\"/>"}, "siraga.html": {"l": "Stok & Persediaan", "i": "<path d=\"M21 8l-9-5-9 5 9 5 9-5z\"/><path d=\"M3 8v8l9 5 9-5V8\"/><path d=\"M12 13v8\"/>"}, "jadwal.html": {"l": "Jadwal & Penugasan", "i": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"16\" rx=\"2\"/><path d=\"M4 10h16\"/><path d=\"M8 3v4\"/><path d=\"M16 3v4\"/>"}, "jadwal-anggota.html": {"l": "Jadwal Relawan", "i": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18\"/>"}, "monitoring-kehadiran-koordinator.html": {"l": "Monitoring Kehadiran", "i": "<path d=\"M3 3v18h18\"/><path d=\"M7 15l4-6 4 3 5-8\"/>"}, "pembagian-tugas-koordinator.html": {"l": "Pembagian Tugas Harian", "i": "<path d=\"M9 11l3 3L22 4\"/><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>"}, "laporan-kendala-koordinator.html": {"l": "Laporan & Kendala", "i": "<path d=\"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>"}, "pengajuan-kebutuhan-koordinator.html": {"l": "Pengajuan Kebutuhan", "i": "<path d=\"M20 7h-9\"/><path d=\"M14 17H5\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/>"}, "retur-barang-koordinator.html": {"l": "Retur Barang", "i": "<path d=\"M3 12l6-6M3 12l6 6M3 12h18\"/>"}, "monitoring.html": {"l": "Pengawasan Pengelola SPPG", "i": "<path d=\"M3 3v18h18\"/><path d=\"M7 15l4-6 4 3 5-8\"/>"}, "notifikasi.html": {"l": "Notifikasi", "i": "<path d=\"M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6\"/><path d=\"M10 21h4\"/>"}, "informasi.html": {"l": "Informasi", "i": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6\"/><path d=\"M12 7.5v.01\"/>"}, "penerimaan-pat.html": {"l": "Penerima Manfaat", "i": "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>"}, "dokumen.html": {"l": "Dokumen", "i": "<path d=\"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z\"/>"}, "bantuan.html": {"l": "Bantuan", "i": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2\"/><path d=\"M12 17v.01\"/>"}, "pengaturan.html": {"l": "Pengaturan Akun", "i": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z\"/>"}};   // href -> { l: label, i: isi <svg> } (disalin dari sidebar Dashboard)
const ALIAS_MENU_RELAWAN_ = { 'siraga.html': 'stok-relawan.html', 'stok-relawan.html': 'siraga.html' };   // dua halaman SIRAGA yang sama-sama dipakai tautannya

function hrefAnchorNav_(a) { return (a.getAttribute('href') || '').split('#')[0].split('?')[0]; }

function rapikanSidebarRelawan_() {
  const nav = document.querySelector('nav.shell-nav');
  if (!nav || nav.getAttribute('data-sudah-dirapikan') === '1') return;
  if (nav.querySelector('button.admin-tab-btn[data-panel]')) return;                      // sidebar admin: tidak disentuh
  const anchors = Array.prototype.slice.call(nav.querySelectorAll('a.shell-nav-link[href]'));
  if (!anchors.some(function (a) { return hrefAnchorNav_(a) === 'dashboard.html'; })) return;   // bukan sidebar utama relawan
  try {
    // Tiap halaman dulu memuat sidebar yang BERBEDA-BEDA (mis. halaman Koordinator tanpa Presensi/Jadwal). Tautan yang belum ada dibuat dari katalog Dashboard,
    // supaya enam grup sama di semua halaman. Tautan yang sudah ada tidak diganti.
    Object.keys(KATALOG_MENU_RELAWAN_).forEach(function (h) {
      if (anchors.some(function (a) { const x = hrefAnchorNav_(a); return x === h || x === ALIAS_MENU_RELAWAN_[h]; })) return;
      const k = KATALOG_MENU_RELAWAN_[h]; const a = document.createElement('a'); a.href = h; a.className = 'shell-nav-link'; a.setAttribute('data-dibuat-terpusat', '1');
      a.innerHTML = '<span class="icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + k.i + '</svg></span><span>' + k.l.replace(/&/g, '&amp;') + '</span>';
      nav.appendChild(a); anchors.push(a);
    });
    const peta = {}; GRUP_SIDEBAR_RELAWAN_.forEach(function (g) { g.href.forEach(function (h) { peta[h] = g.kunci; }); });
    const isi = {}, sisa = [];
    anchors.forEach(function (a) { const k = peta[hrefAnchorNav_(a)]; if (k) (isi[k] = isi[k] || []).push(a); else sisa.push(a); });
    Array.prototype.slice.call(nav.querySelectorAll('.shell-nav-group-title, .shell-nav-group-desc')).forEach(function (el) { el.parentNode.removeChild(el); });
    const susun = function (kunci, judul, daftar, bersyarat) {
      if (!daftar || !daftar.length) return;
      const p = document.createElement('p'); p.className = 'shell-nav-group-title'; p.textContent = judul; p.setAttribute('data-grup', kunci);
      if (bersyarat) { p.setAttribute('data-bersyarat', bersyarat); p.style.display = 'none'; }
      nav.appendChild(p);
      daftar.forEach(function (a) { a.setAttribute('data-grup-item', kunci); if (bersyarat) { a.setAttribute('data-bersyarat', bersyarat); a.style.display = 'none'; } nav.appendChild(a); });
    };
    GRUP_SIDEBAR_RELAWAN_.forEach(function (g) {
      const urut = (isi[g.kunci] || []).slice().sort(function (x, y) { return g.href.indexOf(hrefAnchorNav_(x)) - g.href.indexOf(hrefAnchorNav_(y)); });
      susun(g.kunci, g.judul, urut, g.bersyarat);
    });
    susun('lainnya', 'Lainnya', sisa, null);      // link yang belum dikenal TIDAK dihilangkan
    nav.setAttribute('data-sudah-dirapikan', '1');
  } catch (e) { console.warn('NavigasiTerpusat: gagal merapikan sidebar relawan, sidebar lama dipertahankan.', e.message); }
}

/** Sisipkan anchor ke akhir grupnya (dipakai sisipkanAplikasiTanpaLogin_). false bila sidebar belum dirapikan. */
function sisipkanDiGrupSidebar_(nav, kunciGrup, a) {
  if (nav.getAttribute('data-sudah-dirapikan') !== '1') return false;
  const item = nav.querySelectorAll('[data-grup-item="' + kunciGrup + '"]');
  const acuan = item.length ? item[item.length - 1] : nav.querySelector('p[data-grup="' + kunciGrup + '"]');
  if (!acuan) return false;
  a.setAttribute('data-grup-item', kunciGrup);
  acuan.parentNode.insertBefore(a, acuan.nextSibling);
  return true;
}

/**
 * Tampilkan grup Koordinator / Pengawasan bagi yang berhak. Memakai endpoint YANG SUDAH ADA (getProfilRoleSaya).
 * Fail-open: bila peran tidak bisa diketahui (jaringan gagal / backend belum diperbarui), grupnya TAMPIL seperti sebelumnya;
 * penjaga sebenarnya tetap di server.
 */
async function terapkanPeranSidebarRelawan_(token) {
  const nav = document.querySelector('nav.shell-nav');
  if (!nav || nav.getAttribute('data-sudah-dirapikan') !== '1' || typeof apiGet !== 'function') return;
  const kunciCache = 'sppgPeranMenu:' + String(token).slice(-16);
  let peran = null;
  try { peran = JSON.parse(sessionStorage.getItem(kunciCache) || 'null'); } catch (e) { peran = null; }
  if (!peran) {
    try {
      const r = await apiGet('getProfilRoleSaya', { token: token });
      peran = { role: String((r && r.role) || 'RELAWAN').toUpperCase(),
                koordinator: (r && typeof r.koordinator === 'boolean') ? r.koordinator : (r && r.roleBaru ? String(r.roleBaru).toUpperCase() === 'KOORDINATOR_OPERASIONAL' : null) };
      try { sessionStorage.setItem(kunciCache, JSON.stringify(peran)); } catch (e) { /* abaikan */ }
    } catch (e) { peran = null; }
  }
  const tampil = {
    koordinator: peran === null || peran.koordinator === null || peran.koordinator === true,
    pengawasan: peran === null || peran.role === 'ASN' || peran.role === 'KEPALA_SPPG'
  };
  Object.keys(tampil).forEach(function (k) {
    if (!tampil[k]) return;
    Array.prototype.slice.call(nav.querySelectorAll('[data-bersyarat="' + k + '"]')).forEach(function (el) { el.style.display = ''; });
  });
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
    if (token) { clearInterval(interval); await Promise.all([terapkanPeranSidebarRelawan_(token).catch(function (e) { console.warn('NavigasiTerpusat: peran sidebar', e.message); }), terapkanStatusAksesNavigasi_({ token })]); }
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
  const dirapikan = nav.getAttribute('data-sudah-dirapikan') === '1';
  if (!dirapikan) { const judul = document.createElement('p'); judul.className = 'shell-nav-group-title'; judul.textContent = 'Aplikasi Lain'; judul.setAttribute('data-aplikasi-tanpa-login', '1');
  nav.appendChild(judul); }
  daftar.forEach(function (x) {
    if (nav.querySelector('a[href="' + x.href + '"]')) return;
    const a = document.createElement('a'); a.href = x.href; a.className = 'shell-nav-link'; a.setAttribute('data-aplikasi-tanpa-login', '1');
    a.innerHTML = ikon(x.ikon) + '<span>' + x.nama + '</span>'; if (!(dirapikan && sisipkanDiGrupSidebar_(nav, GRUP_APLIKASI_TANPA_LOGIN_[x.href], a))) nav.appendChild(a);
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
  document.addEventListener('DOMContentLoaded', function () { rapikanSidebarRelawan_(); mulaiTerapkanStatusAksesNavigasi_(); });
} else {
  rapikanSidebarRelawan_(); mulaiTerapkanStatusAksesNavigasi_();
}

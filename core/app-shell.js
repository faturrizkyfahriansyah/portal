// ============================================================
// SPPG JEUNGJING — APP SHELL (perilaku navigasi bersama)
// Dipakai oleh seluruh halaman Portal Relawan & Dashboard Admin.
// Tidak bergantung pada logic modul manapun (Absensi, dst.) —
// murni mengurus sidebar/drawer/topbar supaya tidak ditulis
// ulang di setiap halaman.
// ============================================================

/**
 * Inisialisasi perilaku shell: buka/tutup drawer (mobile), toggle
 * collapse sidebar (laptop/desktop), dan menandai menu aktif.
 * @param {object} [opts]
 * @param {string} [opts.storageKey] kunci localStorage untuk status collapse (beda per role)
 */
function initShell(opts) {
  const options = opts || {};
  const storageKey = options.storageKey || 'sppgSidebarCollapsed';

  const sidebar = document.querySelector('.shell-sidebar');
  const overlay = document.querySelector('.shell-overlay');
  const burger = document.querySelector('.shell-topbar-burger');
  const closeBtn = document.querySelector('.shell-sidebar-close');
  const collapseBtn = document.querySelector('.shell-sidebar-collapse-toggle');

  function openDrawer() {
    if (!sidebar) return;
    sidebar.classList.add('is-open');
    if (overlay) overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (burger) burger.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  // Menutup drawer otomatis saat sebuah link menu diklik (khusus mobile),
  // supaya pengguna tidak perlu menutup manual setiap pindah halaman.
  if (sidebar) {
    sidebar.querySelectorAll('a.shell-nav-link').forEach((link) => {
      link.addEventListener('click', () => { if (window.innerWidth < 1080) closeDrawer(); });
    });
  }

  // Collapse sidebar (icon-only) — hanya berpengaruh di layar laptop/desktop via CSS.
  if (collapseBtn && sidebar) {
    const savedCollapsed = localStorage.getItem(storageKey) === '1';
    if (savedCollapsed) sidebar.classList.add('is-collapsed');
    collapseBtn.addEventListener('click', () => {
      const nowCollapsed = sidebar.classList.toggle('is-collapsed');
      localStorage.setItem(storageKey, nowCollapsed ? '1' : '0');
    });
  }
}

/** Set inisial 1-2 huruf dari nama, dipakai untuk avatar bulat. */
function initialsFromName(nama) {
  if (!nama) return '?';
  const parts = String(nama).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format ISO datetime -> "12 Agustus 2026, 08:30" (dipakai beberapa modul). */
function formatTanggalWaktuIndoShell(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const p2 = n => String(n).padStart(2, '0');
  return `${d.getDate()} ${namaBulan[d.getMonth()]} ${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "dd/MM/yyyy" -> Date, dipakai untuk mengurutkan aktivitas terbaru. */
function parseTanggalDMYShell(str) {
  if (!str) return null;
  const parts = String(str).split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  return new Date(yyyy, mm - 1, dd);
}

/**
 * Boot standar untuk seluruh halaman Portal Relawan (selain login.html/index.html):
 * - Menjamin ada sesi aktif (kalau tidak, lempar ke login.html).
 * - Mengisi nama/status akun di topbar & sidebar dengan DATA AKTUAL (bukan hard-code).
 * - Menghitung badge notifikasi dari Informasi + Jadwal yang belum "dibaca" (lokal per perangkat).
 * - Memasang tombol Keluar di sidebar.
 * Dipanggil sekali di setiap halaman shell, terpisah dari logic modul masing-masing
 * (profil.js, riwayat.js, dst.) supaya modul-modul itu tidak perlu diubah.
 */
async function bootRelawanShell() {
  const sesi = (typeof ambilSesiRelawan === 'function') ? ambilSesiRelawan() : null;
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  initShell({ storageKey: 'sppgSidebarCollapsedRelawan' });

  const btnLogout = document.getElementById('btnLogoutShell');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try { await apiPost('logoutRelawan', { token: sesi.token }); } catch (e) { /* tetap keluar walau offline */ }
      hapusSesiRelawan();
      window.location.href = 'portal.html';
    });
  }

  // Permintaan getProfilRelawan disimpan sebagai PROMISE BERSAMA (bukan
  // langsung di-await) supaya halaman lain (dashboard.js) yang butuh data
  // sama bisa menunggu promise ini alih-alih mengirim request kedua yang
  // identik ke server -- ini salah satu penyebab dashboard terasa lambat.
  window.sppgProfilPromise = apiGet('getProfilRelawan', { token: sesi.token });

  // FASE 2: getNotifikasiRelawan TIDAK bergantung pada hasil getProfilRelawan
  // -- sebelumnya baru dikirim SETELAH profil selesai (menunggu bergantian),
  // padahal keduanya bisa jalan BERSAMAAN. Dipicu di sini (sebelum await
  // manapun) supaya kedua request benar-benar berangkat di waktu yang sama.
  const notifikasiPromise = apiGet('getNotifikasiRelawan', { token: sesi.token }).catch(() => []);

  try {
    const profil = await window.sppgProfilPromise;
    const inisial = initialsFromName(profil.nama);
    const isAktif = (profil.status || 'Aktif').toLowerCase().indexOf('nonaktif') === -1;

    // Sebelumnya avatar SELALU ditulis sebagai inisial teks, walau foto
    // profil sudah ada (fotoProfilUrl dari getProfilRelawan tidak pernah
    // dicek di sini) -- itu sebabnya foto muncul di halaman Profil (yang
    // membacanya sendiri) tapi tidak pernah muncul di header/sidebar.
    document.querySelectorAll('#topbarAvatar, #sidebarAvatar, #profilAvatar').forEach(el => {
      if (profil.fotoProfilUrl) {
        el.innerHTML = `<img src="${profil.fotoProfilUrl}" alt="Foto profil" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        el.textContent = inisial;
      }
    });
    const namaEl = document.getElementById('sidebarNama');
    if (namaEl) namaEl.textContent = profil.nama;
    const statusEl = document.getElementById('sidebarStatus');
    if (statusEl) {
      statusEl.classList.add(isAktif ? 'aktif' : 'nonaktif');
      statusEl.textContent = isAktif ? 'Akun Aktif' : 'Akun Tidak Aktif';
    }

    // Badge notifikasi: dari collection Notifikasi asli di backend, dikurangi
    // yang ID-nya sudah tercatat "dibaca" di perangkat ini (lihat notifikasi.js).
    const notifikasi = await notifikasiPromise;
    const readSet = getNotifReadSet(sesi.idRelawan);
    let belum = 0;
    (notifikasi || []).forEach(n => { if (!readSet.has(n.id)) belum++; });

    const bellCount = document.getElementById('topbarBellCount');
    if (bellCount) {
      if (belum > 0) {
        bellCount.textContent = belum > 9 ? '9+' : String(belum);
        bellCount.classList.remove('is-hidden');
      } else {
        bellCount.classList.add('is-hidden');
      }
    }
  } catch (err) {
    // OPTIMASI: sebelumnya SEMUA error di sini (termasuk gangguan
    // jaringan biasa) langsung dianggap "sesi berakhir" -- ini fungsi
    // shell yang jalan di SETIAP halaman relawan, jadi gangguan jaringan
    // sesaat bisa memaksa logout dari halaman mana pun. Sekarang cuma
    // redirect ke Login kalau pesannya memang menandakan sesi tidak
    // valid/berakhir.
    if (typeof apakahErrorSesiTidakValid === 'function' && apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      if (typeof simpanNotisLogin === 'function') simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
    }
    // Error jaringan biasa: diamkan saja di sini -- nama/status/badge
    // notifikasi di sidebar cukup tetap kosong/default untuk sesi ini,
    // TIDAK memaksa keluar dari halaman yang sedang dibuka relawan.
  }
}

/** Kunci localStorage tempat menyimpan id notifikasi yang sudah "dibaca" per relawan. */
function notifReadKey(idRelawan) { return 'sppgNotifRead:' + (idRelawan || 'anon'); }

function getNotifReadSet(idRelawan) {
  try {
    const raw = localStorage.getItem(notifReadKey(idRelawan));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) { return new Set(); }
}

function addNotifRead(idRelawan, notifId) {
  const set = getNotifReadSet(idRelawan);
  set.add(notifId);
  try { localStorage.setItem(notifReadKey(idRelawan), JSON.stringify(Array.from(set))); } catch (e) { /* abaikan */ }
}

function markAllNotifRead(idRelawan, ids) {
  const set = getNotifReadSet(idRelawan);
  ids.forEach(id => set.add(id));
  try { localStorage.setItem(notifReadKey(idRelawan), JSON.stringify(Array.from(set))); } catch (e) { /* abaikan */ }
}

// Dipicu di sini (bukan lewat <script> inline per halaman) supaya SELALU
// berjalan LEBIH DULU daripada dashboard.js/profil.js dkk -- app-shell.js
// dimuat lebih awal di <head>/<body>, jadi listener DOMContentLoaded-nya
// pasti terdaftar lebih dulu. Ini yang membuat window.sppgProfilPromise
// (lihat bootRelawanShell) benar-benar bisa dipakai bersama, bukan cuma
// tertulis di kode tapi tidak pernah kejadian tepat waktu.
// Dipicu di sini (bukan lewat <script> inline per halaman) supaya SELALU
// berjalan LEBIH DULU daripada dashboard.js/profil.js dkk -- app-shell.js
// dimuat lebih awal di <head>/<body>, jadi listener DOMContentLoaded-nya
// pasti terdaftar lebih dulu.
//
// PERBAIKAN PENTING: admin.html JUGA memuat app-shell.js (untuk initShell
// dkk), tapi admin TIDAK PERNAH punya sesi relawan -- kalau bootRelawanShell
// dipicu di situ, dia akan selalu redirect ke login.html (relawan), bikin
// halaman Admin jadi tidak bisa diakses sama sekali. Makanya di sini
// SENGAJA dicek dulu: kalau <body> punya class "admin-body", jangan
// otomatis boot sebagai relawan.
document.addEventListener('DOMContentLoaded', function () {
  if (document.body.classList.contains('admin-body')) return;
  bootRelawanShell();
});

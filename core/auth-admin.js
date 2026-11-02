// SPPG JEUNGJING — Sesi login Admin/Pengelola
// Token disimpan di localStorage supaya refresh/buka ulang halaman TIDAK
// perlu login ulang selama sesi di server (CacheService, maks 6 jam)
// masih berlaku. Pola SAMA seperti auth-relawan.js (dipakai login.js/
// profil.js relawan) -- disatukan gayanya supaya konsisten satu sama lain.
// TIDAK PERNAH menyimpan password -- hanya token + info ringan (username, role).

const ADMIN_SESSION_KEY = 'sppgAdminSession';

function simpanSesiAdmin(data) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(data));
}

function ambilSesiAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function hapusSesiAdmin() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

/**
 * true kalau pesan error menandakan sesi memang tidak valid/berakhir --
 * server SELALU menyertakan frasa "login kembali" utk kasus itu (lihat
 * requireAuth di Admin.gs: "Sesi tidak valid. Silakan login kembali." /
 * "Sesi telah berakhir. Silakan login kembali."). BUKAN dipakai untuk
 * error jaringan/timeout biasa (pesannya beda, mis. "tidak merespons"),
 * dan BUKAN untuk error hak akses (mis. pesan "khusus Admin" utk Staff --
 * itu sesinya tetap valid, cuma tidak punya izin).
 *
 * Dipakai untuk membedakan 2 hal yang harus ditangani BEDA:
 *   SESSION INVALID -> hapus sesi lokal, kembali ke Login.
 *   NETWORK ERROR   -> JANGAN hapus sesi, tampilkan retry saja.
 */
function apakahErrorSesiTidakValid(pesanError) {
  return /login kembali/i.test(pesanError || '');
}

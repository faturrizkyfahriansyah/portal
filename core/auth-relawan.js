// SPPG JEUNGJING — Sesi login relawan (Tahap 3)
// Dipakai bersama oleh login.js & profil.js.
// Token disimpan di localStorage supaya relawan tidak perlu login ulang
// setiap membuka Portal di HP yang sama. Sesi tetap kedaluwarsa otomatis
// di server (CacheService, maks 6 jam) — lihat catatan di Akun.gs.

const RELAWAN_SESSION_KEY = 'sppgRelawanSession';

function simpanSesiRelawan(data) {
  localStorage.setItem(RELAWAN_SESSION_KEY, JSON.stringify(data));
}

function ambilSesiRelawan() {
  try {
    const raw = localStorage.getItem(RELAWAN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function hapusSesiRelawan() {
  localStorage.removeItem(RELAWAN_SESSION_KEY);
}

// Dipakai saat sesi relawan dipaksa berakhir (mis. akun dinonaktifkan Admin),
// supaya login.html bisa menampilkan pesan yang jelas, bukan cuma form kosong.
const RELAWAN_NOTICE_KEY = 'sppgRelawanLoginNotice';

function simpanNotisLogin(pesan) {
  try { sessionStorage.setItem(RELAWAN_NOTICE_KEY, pesan); } catch (e) { /* abaikan kalau storage tidak tersedia */ }
}

/** Ambil sekali lalu langsung dihapus, supaya tidak muncul lagi di reload berikutnya. */
function ambilDanHapusNotisLogin() {
  try {
    const pesan = sessionStorage.getItem(RELAWAN_NOTICE_KEY);
    sessionStorage.removeItem(RELAWAN_NOTICE_KEY);
    return pesan;
  } catch (e) {
    return null;
  }
}

/**
 * true kalau pesan error menandakan sesi memang tidak valid/berakhir --
 * server SELALU menyertakan frasa "login kembali" utk kasus itu (lihat
 * requireAuthRelawan di Akun.gs). BUKAN dipakai untuk error jaringan/
 * timeout biasa (pesannya beda). Dipakai untuk membedakan 2 hal yang
 * harus ditangani BEDA di tiap halaman relawan:
 *   SESSION INVALID -> hapus sesi lokal, kembali ke Login.
 *   NETWORK ERROR   -> JANGAN hapus sesi, tampilkan retry saja.
 */
function apakahErrorSesiTidakValid(pesanError) {
  return /login kembali/i.test(pesanError || '');
}

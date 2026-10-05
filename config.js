// ============================================================
// SPPG JEUNGJING — KONFIGURASI PORTAL
// ============================================================
// File ini SATU-SATUNYA tempat menyimpan URL Apps Script.
// Jangan tulis URL di file lain mana pun — kalau nanti ganti
// deployment, cukup ubah di sini saja.
// ============================================================

// ============================================================
// PORTAL RELAWAN
// Aplikasi utama / portal besar — Absensi (SIPRES), Stok (SIRAGA),
// Shift, Role, dan seluruh modul yang hidup di proyek Apps Script
// utama (Absensi.gs, Admin.gs, Akun.gs, Stok.gs, Shift.gs, Role.gs, dst).
// ============================================================

const GOOGLE_APPS_SCRIPT_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby5uuwdo0G-W22txE7eOSuHuFGc_XYnrhm7SyGvLsbXApJiJNE4eM5nuFYJ29uXM8yMIw/exec';

// ============================================================
// SIPANDU
// DIGABUNG ke proyek Apps Script Portal Relawan yang sama sejak paket
// ini (menghilangkan masalah "sesi ditolak" akibat CacheService antar
// proyek yang tidak bisa saling dibaca). Database (Spreadsheet) SIPANDU
// TETAP TERPISAH -- diakses lewat Script Property SIPANDU_SPREADSHEET_ID
// di sisi Apps Script, bukan di sini.
// ============================================================

const SIPANDU_API_URL = GOOGLE_APPS_SCRIPT_WEB_APP_URL;

// ============================================================
// SYSTEM
// ============================================================

// Set true sementara di perangkat sendiri untuk melihat log tiap
// request API (aksi, durasi, status) di Console browser -- TIDAK PERNAH
// mencatat password/token. Selalu false saat dipakai/dibagikan ke relawan.
const DEBUG_MODE = false;

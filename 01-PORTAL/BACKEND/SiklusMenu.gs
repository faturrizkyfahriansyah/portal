/**
 * SiklusMenu.gs — Rincian Menu Hari Ini, dibaca LANGSUNG dari Spreadsheet
 * "DATABASE SIKLUS MENU SPPG 2026" milik Anda (BUKAN sheet Portal
 * sendiri, BUKAN lewat SIPOGIM/SIPENDOK -- sesuai arahan eksplisit Anda
 * utk pakai database siklus menu ini).
 *
 * Struktur dikonfirmasi LANGSUNG dari file .xlsx yang Anda unggah
 * (bukan tebakan): tab "MASTER MENU 2026" sudah berupa 1 baris per hari
 * (bukan per-bahan seperti tab detail per-periode), dgn kolom:
 * A=Minggu, B=Hari, C=Tanggal, D=Karbohidrat, E=Lauk Hewani,
 * F=Lauk Nabati, G=Sayur, H=Buah, I=Pelengkap/Finishing, J=Tema.
 * Tab ini berisi beberapa blok PERIODE berurutan (baris judul periode
 * + baris header kolom berulang sebelum tiap blok) -- kode di bawah
 * SENGAJA tidak peduli blok, cuma mencari baris yg kolom C-nya cocok
 * dgn TANGGAL TARGET (lihat JAM_PINDAH_MENU_WIB di bawah), di mana pun
 * posisinya.
 *
 * PRASYARAT DEPLOYMENT (WAJIB, tidak bisa saya verifikasi dari sini):
 * Spreadsheet ini harus di-share minimal "Siapa saja yang punya tautan
 * - Dapat melihat" ATAU dibagikan eksplisit ke akun yang menjalankan
 * Apps Script Portal -- kalau tidak, openById di bawah akan gagal
 * dengan error izin, bukan diam-diam mengembalikan kosong.
 */

const SIKLUS_MENU_SHEET_ID = '1VyYjXgjYsyHm-A8bxgOsVlTV3RDc-JZZGba8JInngk0';
const SIKLUS_MENU_TAB = 'MASTER MENU 2026';

// Keputusan Admin (15 Okt 2026): menu HARI INI yang tampil di Portal
// SENGAJA berganti ke menu BESOK mulai jam segini (WIB) -- supaya
// menjelang sore, tampilan sudah menunjukkan menu persiapan besok,
// bukan menu hari ini yang sudah/segera selesai disajikan. Ubah angka
// ini kalau jam potongnya perlu disesuaikan nanti -- satu tempat,
// bukan tersebar di banyak baris kode.
const JAM_PINDAH_MENU_WIB = 15;

/** Pecah epoch (UTC ms) jadi komponen tanggal+jam WIB, murni aritmetika -- tidak bergantung resolusi nama zona waktu apa pun (punya spreadsheet sumber maupun proyek Apps Script ini). */
function pecahWaktuJakarta_(dateObj) {
  const JAM_WIB_MS = 7 * 60 * 60 * 1000;
  const bergeser = new Date(dateObj.getTime() + JAM_WIB_MS);
  return { tahun: bergeser.getUTCFullYear(), bulan: bergeser.getUTCMonth() + 1, tanggal: bergeser.getUTCDate(), jam: bergeser.getUTCHours() };
}
function samaTanggalJakarta_(a, bKomponen) {
  const x = pecahWaktuJakarta_(a);
  return x.tahun === bKomponen.tahun && x.bulan === bKomponen.bulan && x.tanggal === bKomponen.tanggal;
}

/**
 * Dipanggil dari getRingkasanMonitoring (Role.gs) & 2 aksi dashboard
 * (getMenuHariIniDashboard, Menu Hari Ini sbg halaman sendiri) -- pola
 * try/catch sama dgn sumber data lain, kalau sheet belum bisa diakses
 * fitur lain TETAP tampil normal.
 */
function getMenuHariIniSiklus_() {
  const ss = SpreadsheetApp.openById(SIKLUS_MENU_SHEET_ID);
  const sheet = ss.getSheetByName(SIKLUS_MENU_TAB);
  if (!sheet) throw new Error('Tab "' + SIKLUS_MENU_TAB + '" tidak ditemukan di spreadsheet siklus menu.');

  const data = sheet.getDataRange().getValues();
  const sekarang = new Date();
  const waktuWib = pecahWaktuJakarta_(sekarang);

  // Tanggal TARGET: hari ini, KECUALI sudah lewat JAM_PINDAH_MENU_WIB --
  // dalam hal itu targetnya BESOK. Dihitung lewat epoch (tambah 1 hari =
  // +86400000 ms), bukan string, supaya pergantian bulan/tahun otomatis
  // benar tanpa logika kalender manual.
  let targetEpoch = sekarang.getTime();
  if (waktuWib.jam >= JAM_PINDAH_MENU_WIB) {
    targetEpoch += 24 * 60 * 60 * 1000;
  }
  const targetKomponen = pecahWaktuJakarta_(new Date(targetEpoch));
  const targetStr = targetKomponen.tahun + '-' + String(targetKomponen.bulan).padStart(2, '0') + '-' + String(targetKomponen.tanggal).padStart(2, '0');

  for (let i = 0; i < data.length; i++) {
    const tgl = data[i][2]; // kolom C
    if (!(tgl instanceof Date)) continue; // lewati baris judul periode/header kolom yg berulang
    if (!samaTanggalJakarta_(tgl, targetKomponen)) continue;

    return {
      tanggal: targetStr,
      hari: data[i][1] || '',
      karbohidrat: data[i][3] || '',
      laukHewani: data[i][4] || '',
      laukNabati: data[i][5] || '',
      sayur: data[i][6] || '',
      buah: data[i][7] || '',
      pelengkap: data[i][8] || '',
      tema: data[i][9] || ''
    };
  }

  return null; // tanggal target tidak ada di jadwal siklus (mis. di luar rentang periode yg sudah diisi, atau akhir pekan)
}


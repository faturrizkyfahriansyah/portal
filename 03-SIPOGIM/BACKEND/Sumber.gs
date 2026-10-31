/**
 * SIPOGIM — Sumber.gs
 * Antarmuka SumberMenu.baca() -- baca MASTER MENU 2026 dari Google
 * Sheets. Dipisah dari Sinkron.gs sesuai spesifikasi ("antarmuka tetap
 * dipisah agar sumber lain bisa ditambah nanti").
 *
 * PENYEDERHANAAN DISENGAJA dari draf: draf mengasumsikan Google Sheets
 * API + service account (kunci JSON terpisah yang harus dijaga). Di
 * sini pakai SpreadsheetApp.openById() bawaan Apps Script -- TIDAK ada
 * kunci API sama sekali. Cukup spreadsheet MASTER MENU dibagikan akses
 * "Lihat" ke akun Google yang sama dengan pemilik proyek Apps Script
 * SIPOGIM ini (dikonfirmasi: akun yang sama dgn Portal). Ini juga
 * otomatis menyelesaikan poin "nilai mentah, bukan rumus" -- getValues()
 * bawaan SUDAH mengembalikan hasil rumus (bukan teks rumusnya), beda
 * dari draf yang mengantisipasi minta UNFORMATTED_VALUE secara eksplisit.
 */

const KATEGORI_KOLOM_DEFAULT = ['Karbohidrat', 'Lauk Hewani', 'Lauk Nabati', 'Sayur', 'Buah', 'Pelengkap / Finishing'];

function daftarKategoriKolom_() {
  const raw = getPengaturan_('KATEGORI_KOLOM', '');
  if (!raw) return KATEGORI_KOLOM_DEFAULT;
  try { return JSON.parse(raw); } catch (e) { return KATEGORI_KOLOM_DEFAULT; }
}

function apakahSelGalat_(nilai) {
  return typeof nilai === 'string' && /^#[A-Z0-9/]+[!?]?$/.test(nilai.trim());
}

/**
 * Baca seluruh MASTER MENU 2026. Mengembalikan:
 * { baris: [{periode, tanggal(Date), kategori, namaMentah, refSumber}],
 *   galat: [{refSumber, pesan}] }
 * Tidak pernah menulis ke spreadsheet sumber -- hanya getValues().
 */
function bacaMasterMenu_() {
  const idSpreadsheetMenu = getPengaturan_('ID_SPREADSHEET_MENU', '');
  if (!idSpreadsheetMenu) throw new Error('ID_SPREADSHEET_MENU belum diisi di sheet PENGATURAN.');

  let ssMenu;
  try { ssMenu = SpreadsheetApp.openById(idSpreadsheetMenu); }
  catch (e) { throw new Error('Gagal membuka spreadsheet menu. Pastikan ID benar dan sudah dibagikan akses ke akun ini.'); }

  const sheet = ssMenu.getSheetByName('MASTER MENU 2026');
  if (!sheet) throw new Error('Sheet "MASTER MENU 2026" tidak ditemukan di spreadsheet sumber.');

  const data = sheet.getDataRange().getValues();
  const kategoriKolom = daftarKategoriKolom_();

  const hasilBaris = [];
  const hasilGalat = [];
  let periodeAktif = null;
  let petaKolom = null; // { 'Karbohidrat': 3, 'Lauk Hewani': 4, ... } -- index 0-based

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const selA = row[0];

    // Baris "PERIODE n" -- nama periode sebenarnya diambil dari baris BERIKUTNYA (rentang tanggal).
    if (typeof selA === 'string' && /^PERIODE\s+\d+/i.test(selA.trim())) {
      const baitRentang = data[i + 1] ? data[i + 1][0] : null;
      periodeAktif = (baitRentang && typeof baitRentang === 'string') ? baitRentang.trim() : selA.trim();
      petaKolom = null; // reset -- header kolom periode ini belum ditemukan
      continue;
    }

    // Baris header kolom: punya sel "Tanggal" di suatu kolom.
    const idxTanggal = row.indexOf('Tanggal');
    if (idxTanggal !== -1 && periodeAktif) {
      petaKolom = { tanggal: idxTanggal };
      kategoriKolom.forEach(nama => {
        const idx = row.indexOf(nama);
        if (idx !== -1) petaKolom[nama] = idx;
      });
      continue;
    }

    // Baris data: kolom Tanggal berisi objek Date sungguhan.
    if (petaKolom && row[petaKolom.tanggal] instanceof Date) {
      const tanggal = row[petaKolom.tanggal];
      kategoriKolom.forEach(kategori => {
        if (petaKolom[kategori] === undefined) return; // kolom ini tidak ada di periode ini, lewati
        const kolIdx = petaKolom[kategori];
        const nilai = row[kolIdx];
        const refSumber = 'MASTER MENU 2026!' + columnToLetterSipogim_(kolIdx + 1) + (i + 1);

        if (apakahSelGalat_(nilai)) {
          hasilGalat.push({ refSumber: refSumber, pesan: 'Sel berisi galat: ' + nilai });
          return;
        }
        const namaMentah = sanitizeSipogim_(nilai);
        if (!namaMentah || namaMentah === '-') return; // kosong/"-" = tidak ada hidangan, bukan galat

        hasilBaris.push({ periode: periodeAktif, tanggal: tanggal, kategori: kategori, namaMentah: namaMentah, refSumber: refSumber });
      });
    }
  }

  return { baris: hasilBaris, galat: hasilGalat };
}

function columnToLetterSipogim_(kolom) {
  let huruf = '';
  while (kolom > 0) {
    const sisa = (kolom - 1) % 26;
    huruf = String.fromCharCode(65 + sisa) + huruf;
    kolom = Math.floor((kolom - sisa) / 26);
  }
  return huruf;
}


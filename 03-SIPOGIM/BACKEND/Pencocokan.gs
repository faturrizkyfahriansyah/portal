/**
 * SIPOGIM — Pencocokan.gs
 * Pencocokan nama menu ke resep, berjenjang sesuai spesifikasi bagian 7:
 * 1. Padanan sudah terkonfirmasi -> dipakai.
 * 2. nama_norm sama persis dgn nama resep -> otomatis terkonfirmasi.
 * 3. Kemiripan teks >= 0,85 -> usulan (perlu konfirmasi 1 ketuk).
 * 4. Tidak ada yang cocok -> belum_ada_resep, masuk antrian Beranda.
 *
 * Skor kemiripan pakai jarak Levenshtein dinormalisasi (0-1). Apps
 * Script tidak punya pustaka fuzzy-matching bawaan -- fungsi di bawah
 * ditulis sendiri (DP sederhana O(n*m), cukup cepat utk nama hidangan
 * yg pendek, tidak perlu pustaka luar).
 */

function jarakLevenshtein_(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const biaya = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + biaya);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Skor 0..1, 1 = identik. */
function skorKemiripanSipogim_(a, b) {
  const panjangMaks = Math.max(a.length, b.length);
  if (panjangMaks === 0) return 1;
  return 1 - (jarakLevenshtein_(a, b) / panjangMaks);
}

const AMBANG_USULAN_SIPOGIM = 0.85;

/**
 * Jalankan pencocokan berjenjang utk satu nama_norm BARU (belum ada
 * baris padanan_nama sama sekali). Membuat 1 baris padanan_nama dan
 * mengembalikannya. Dipanggil dari Sinkron.gs utk tiap nama_norm baru.
 */
function jalankanPencocokan_(namaNorm, namaContoh) {
  const sheetPadanan = getSheetSipogim_('PADANAN_NAMA');
  const sheetResep = getSheetSipogim_('RESEP');
  const semuaResep = sheetToObjectsSipogim_(sheetResep);

  // Tahap 2: sama persis dgn nama resep (setelah normalisasi).
  const cocokPersis = semuaResep.find(r => r.NAMA_NORM === namaNorm);
  if (cocokPersis) {
    return simpanPadanan_(namaNorm, namaContoh, cocokPersis.ID, 'terkonfirmasi', 'otomatis', 1, sheetPadanan);
  }

  // Tahap 3: kemiripan teks, ambang 0,85. Ambil skor TERTINGGI di antara semua resep.
  let terbaik = null, skorTerbaik = 0;
  semuaResep.forEach(r => {
    const skor = skorKemiripanSipogim_(namaNorm, r.NAMA_NORM);
    if (skor > skorTerbaik) { skorTerbaik = skor; terbaik = r; }
  });
  if (terbaik && skorTerbaik >= AMBANG_USULAN_SIPOGIM) {
    return simpanPadanan_(namaNorm, namaContoh, terbaik.ID, 'usulan', 'otomatis', skorTerbaik, sheetPadanan);
  }

  // Tahap 4: tidak ada yang cocok.
  return simpanPadanan_(namaNorm, namaContoh, null, 'belum_ada_resep', 'otomatis', null, sheetPadanan);
}

function simpanPadanan_(namaNorm, namaContoh, resepId, status, cara, skor, sheet) {
  const id = generateIdSipogim_('PD', sheet);
  sheet.appendRow([id, namaNorm, namaContoh, resepId || '', status, cara, skor === null ? '' : skor, '', '']);
  return { id: id, namaNorm: namaNorm, resepId: resepId, status: status, skor: skor };
}

/** Cari baris padanan_nama yang sudah ada utk satu nama_norm, atau null kalau belum pernah dicatat. */
function cariPadananExisting_(namaNorm) {
  const semua = sheetToObjectsSipogim_(getSheetSipogim_('PADANAN_NAMA'));
  return semua.find(p => p.NAMA_NORM === namaNorm) || null;
}


/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * PerbaikanIdRelawan.gs — Pemulihan ID_RELAWAN yang diedit LANGSUNG di
 * sheet 01_DATA_RELAWAN (mengganti pola lama seperti "R001" jadi pola
 * baru seperti "R-ASL-001"), TANPA ikut memperbarui sheet lain yang
 * menyimpan ID LAMA sebagai referensi: 07_AKUN_RELAWAN (login),
 * 03_DATA_ABSENSI (riwayat presensi), 22_PENUGASAN_KHUSUS,
 * 12_NOTIFIKASI. Akibatnya login gagal ("Data relawan tidak aktif")
 * karena akun tidak lagi bisa menemukan baris relawannya sendiri.
 *
 * ID LAMA tidak tercatat di mana pun secara eksplisit (tidak ada riwayat
 * versi tersisa) -- satu-satunya jejak yang masih ada adalah NAMA_RELAWAN
 * yang tersimpan APA ADANYA di 03_DATA_ABSENSI setiap kali seseorang
 * pernah absen. Itu dipakai sebagai kunci pencocokan.
 *
 * ALUR (2 LANGKAH, SENGAJA dipisah demi keamanan data):
 *   1. usulkanPemetaanIdRelawan(token) -- HANYA MEMBACA. Mengusulkan
 *      pemetaan ID LAMA -> ID BARU dengan mencocokkan nama. TIDAK
 *      mengubah data apa pun, aman dipanggil berkali-kali.
 *   2. terapkanPemetaanIdRelawan(body) -- BARU MENULIS, HANYA untuk
 *      pasangan (idLama, idBaru) yang sudah ditinjau & dikonfirmasi
 *      Admin lewat UI (bukan otomatis semua diterapkan begitu saja).
 */

/** Cari baris relawan (di 01_DATA_RELAWAN SAAT INI) berdasarkan nama PERSIS (case-insensitive, spasi berlebih diabaikan). Bisa mengembalikan 0, 1, atau lebih dari 1 (nama dobel). */
function cariRelawanByNamaPersis_(semuaRelawanSaatIni, nama) {
  const namaBersih = String(nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!namaBersih) return [];
  return semuaRelawanSaatIni.filter(r =>
    String(r.NAMA_RELAWAN || '').trim().toLowerCase().replace(/\s+/g, ' ') === namaBersih
  );
}

/** Jarak edit (Levenshtein) sederhana -- dipakai HANYA sebagai jalur cadangan kalau tidak ada kecocokan PERSIS, untuk menangkap typo/ejaan tipis (mis. "Yuningish" vs "Yuningsih"). */
function jarakLevenshtein_(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp.push(new Array(n + 1).fill(0)); dp[i][0] = i; }
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Cari relawan dengan nama MIRIP (bukan persis) -- typo/ejaan tipis saja
 * (jarak edit kecil relatif terhadap panjang nama). SENGAJA konservatif:
 * nama yang beda jauh (mis. cuma sebagian nama, atau nama tambahan/kurang
 * banyak kata) TIDAK dianggap mirip -- itu harus dipilih manual oleh
 * Admin, bukan ditebak sistem, supaya tidak salah gabung riwayat 2 orang.
 */
function cariRelawanMiripNama_(semuaRelawanSaatIni, nama) {
  const namaBersih = String(nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!namaBersih) return [];
  return semuaRelawanSaatIni.filter(r => {
    const namaLain = String(r.NAMA_RELAWAN || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!namaLain || namaLain === namaBersih) return false;
    const jarak = jarakLevenshtein_(namaBersih, namaLain);
    const panjangMax = Math.max(namaBersih.length, namaLain.length);
    return jarak <= 2 || (jarak / panjangMax) <= 0.12;
  });
}

/**
 * Usulan pemetaan ID LAMA -> ID BARU. HANYA MEMBACA, tidak menulis apa pun.
 * Return array objek: { idLama, nama, idBaruUsulan, kandidat[], status,
 *   adaAkunLogin, adaPenugasanKhusus, jumlahAbsensi }
 * status salah satu dari: 'cocok' | 'ambigu' | 'tidak_ketemu' | 'tanpa_nama'
 */
function usulkanPemetaanIdRelawan(token) {
  requireAuth(token); // Admin PENUH saja -- operasi pemulihan data sensitif, Staff tidak boleh

  const relawanSaatIni = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN));
  const idSaatIniSet = {};
  relawanSaatIni.forEach(r => { idSaatIniSet[r.ID_RELAWAN] = true; });

  // Satu-satunya sheet yang masih menyimpan NAMA di samping ID LAMA.
  const absensiRows = sheetToObjects(getSheet(NAMA_SHEET.ABSENSI));
  const petaLamaKeNama = {};
  absensiRows.forEach(a => {
    if (a.ID_RELAWAN && !petaLamaKeNama[a.ID_RELAWAN]) petaLamaKeNama[a.ID_RELAWAN] = a.NAMA_RELAWAN;
  });

  // Kumpulkan SEMUA id lama yang masih dirujuk di sheet lain (walau tidak
  // punya riwayat absensi sama sekali -- tetap dimasukkan supaya Admin
  // tahu ID ini juga perlu perhatian, walau tidak bisa dicocokkan otomatis).
  const idDariAkun = {};
  sheetToObjects(getAkunSheet()).forEach(a => { if (a.ID_RELAWAN) idDariAkun[a.ID_RELAWAN] = true; });
  const idDariPenugasan = {};
  getPenugasanKhususRows_().forEach(p => { if (p.ID_RELAWAN) idDariPenugasan[p.ID_RELAWAN] = true; });

  const semuaIdLama = {};
  Object.keys(petaLamaKeNama).forEach(id => { semuaIdLama[id] = true; });
  Object.keys(idDariAkun).forEach(id => { semuaIdLama[id] = true; });
  Object.keys(idDariPenugasan).forEach(id => { semuaIdLama[id] = true; });

  const hasil = [];
  Object.keys(semuaIdLama).forEach(idLama => {
    // ID ini MASIH ada persis di 01_DATA_RELAWAN saat ini -> tidak diubah, lewati.
    if (idSaatIniSet[idLama]) return;

    const nama = petaLamaKeNama[idLama] || '';
    let kandidat = nama ? cariRelawanByNamaPersis_(relawanSaatIni, nama) : [];
    let status;
    if (!nama) {
      status = 'tanpa_nama';
    } else if (kandidat.length === 1) {
      status = 'cocok';
    } else if (kandidat.length === 0) {
      // Tidak ada kecocokan PERSIS -- coba jalur cadangan (typo/ejaan tipis)
      // sebelum menyerah ke 'tidak_ketemu'. Status 'mirip' SENGAJA dibedakan
      // dari 'cocok' -- ditampilkan dengan peringatan ekstra di UI, tidak
      // pernah dipercaya otomatis seperti kecocokan persis.
      const kandidatMirip = cariRelawanMiripNama_(relawanSaatIni, nama);
      if (kandidatMirip.length === 1) { kandidat = kandidatMirip; status = 'mirip'; }
      else if (kandidatMirip.length > 1) { kandidat = kandidatMirip; status = 'ambigu'; }
      else status = 'tidak_ketemu';
    } else {
      status = 'ambigu';
    }

    hasil.push({
      idLama: idLama,
      nama: nama,
      idBaruUsulan: kandidat.length === 1 ? kandidat[0].ID_RELAWAN : '',
      kandidat: kandidat.map(r => ({ id: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, divisi: r.DIVISI })),
      status: status,
      adaAkunLogin: !!idDariAkun[idLama],
      adaPenugasanKhusus: !!idDariPenugasan[idLama],
      jumlahAbsensi: absensiRows.filter(a => a.ID_RELAWAN === idLama).length
    });
  });

  // Yang ada akun login paling mendesak (blokir login) -- taruh paling atas.
  hasil.sort((a, b) => (b.adaAkunLogin - a.adaAkunLogin) || (b.jumlahAbsensi - a.jumlahAbsensi));
  return hasil;
}

/**
 * Terapkan pemetaan yang SUDAH ditinjau & dikonfirmasi Admin.
 * Body: { token, pemetaan: [{ idLama, idBaru }, ...] }
 *
 * Validasi KETAT sebelum menulis apa pun sama sekali:
 *  - idBaru wajib ada persis di 01_DATA_RELAWAN saat ini.
 *  - Tidak boleh ada 2 idLama berbeda dipetakan ke idBaru yang sama
 *    (akan menggabungkan riwayat 2 orang berbeda jadi satu -- berbahaya,
 *    langsung dibatalkan seluruhnya kalau ini terdeteksi).
 */
function terapkanPemetaanIdRelawan(body) {
  const akses = requireAuth(body.token);
  const pemetaan = Array.isArray(body.pemetaan) ? body.pemetaan : [];
  if (!pemetaan.length) throw new Error('Tidak ada pemetaan yang dikirim.');

  const idValidSet = {};
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).forEach(r => { idValidSet[r.ID_RELAWAN] = true; });

  const idBaruTerpakai = {};
  const petaGanti = {};
  pemetaan.forEach(p => {
    const idLama = sanitize(p.idLama);
    const idBaru = sanitize(p.idBaru);
    if (!idLama || !idBaru) throw new Error('Ada baris pemetaan yang idLama/idBaru-nya kosong.');
    if (!idValidSet[idBaru]) throw new Error('ID baru "' + idBaru + '" tidak ditemukan di data relawan saat ini -- dibatalkan, tidak ada yang ditulis.');
    if (idBaruTerpakai[idBaru]) throw new Error('ID baru "' + idBaru + '" dipetakan dari lebih dari 1 ID lama -- ini akan menggabungkan riwayat 2 orang berbeda, dibatalkan demi keamanan. Tidak ada yang ditulis.');
    idBaruTerpakai[idBaru] = idLama;
    petaGanti[idLama] = idBaru;
  });

  const ringkasan = { akun: 0, absensi: 0, penugasanKhusus: 0, notifikasi: 0 };

  function gantiIdDiSheet_(sheet, namaKolomId) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idx = headers.indexOf(namaKolomId);
    if (idx === -1) return 0;
    let jumlah = 0;
    for (let i = 1; i < data.length; i++) {
      const idLama = String(data[i][idx]);
      if (idLama !== 'SEMUA' && petaGanti[idLama]) {
        sheet.getRange(i + 1, idx + 1).setValue(petaGanti[idLama]);
        jumlah++;
      }
    }
    return jumlah;
  }

  ringkasan.akun = gantiIdDiSheet_(getAkunSheet(), 'ID_RELAWAN');
  ringkasan.absensi = gantiIdDiSheet_(getSheet(NAMA_SHEET.ABSENSI), 'ID_RELAWAN');
  ringkasan.penugasanKhusus = gantiIdDiSheet_(getPenugasanKhususSheet(), 'ID_RELAWAN');
  ringkasan.notifikasi = gantiIdDiSheet_(getSheet(NAMA_SHEET.NOTIFIKASI), 'ID_RELAWAN');
  _invalidasiCachePenugasanKhusus_();

  // Bersihkan semua memoisasi per-eksekusi yang mungkin terkait -- aman
  // walau sebagian ID target belum pernah di-cache sama sekali.
  _cacheAbsensiRows = null;
  Object.keys(petaGanti).forEach(idLama => {
    const idBaru = petaGanti[idLama];
    _invalidasiCacheAkun_(idBaru);
    _invalidasiCacheRelawan_(idBaru);
    _invalidasiCacheRelawanRow_(idBaru);
  });

  logAudit_('PERBAIKAN_ID_RELAWAN', 'RELAWAN', '', akses, { pemetaan: petaGanti, ringkasan: ringkasan });
  return { success: true, ringkasan: ringkasan };
}


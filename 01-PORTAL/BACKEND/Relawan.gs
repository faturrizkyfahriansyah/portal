/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Relawan.gs — Data relawan & divisi
 */

/**
 * TAMBALAN DARURAT (dipulihkan lagi -- lihat catatan pengiriman):
 * dipanggil di 9 tempat (login, absensi, profil, shift, stok).
 */
/**
 * DIMEMOISASI PER-ID, PER-EKSEKUSI (pola sama dengan cariAkunByIdRelawan_
 * di Akun.gs). Dipanggil di 16 titik berbeda di seluruh sistem -- sebuah
 * request Dashboard saja bisa memanggil ini beberapa kali. Invalidasi
 * dipanggil di semua titik yang MENULIS ke sheet Relawan (updateRelawan,
 * importRelawanMassal) supaya tidak ada risiko data basi.
 */
/**
 * Cari baris relawan di 01_DATA_RELAWAN dengan INDEX KOLOM DINAMIS --
 * pola sama persis dengan cariAkunByIdRelawan_ di Akun.gs. Dipakai untuk
 * field IDENTITAS ADMINISTRATIF (NIK, Kontak Darurat, Tanggal Bergabung)
 * yang sengaja ditaruh di SINI (bukan 07_AKUN_RELAWAN) supaya sheet akun
 * tidak terus memanjang, dan supaya data ini mudah dicek langsung di
 * sheet utama relawan tanpa buka sheet akun terpisah.
 */
function cariRelawanRow_(idRelawan) {
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_RELAWAN]) === String(idRelawan)) {
      return { baris: i + 1, data: data[i], idx: idx };
    }
  }
  return null;
}

/** Baris mentah sheet -> bentuk objek publik getRelawanById. Dipakai bareng oleh getRelawanById & _muatSemuaRelawanById_ (SATU tempat, tidak dobel logika). */
function _relawanRowKeBentukPublik_(relawan) {
  return {
    id: relawan.ID_RELAWAN,
    nama: relawan.NAMA_RELAWAN,
    divisi: relawan.DIVISI,
    status: relawan.STATUS,
    // Field IDENTITAS ADMINISTRATIF -- ditaruh di 01_DATA_RELAWAN (bukan
    // 07_AKUN_RELAWAN), lihat cariRelawanRow_. undefined-safe: kalau
    // kolomnya belum ditambahkan ke sheet, cukup jadi string kosong.
    nik: relawan.NIK || '',
    tanggalBergabung: relawan.TANGGAL_BERGABUNG || '',
    jabatan: relawan.JABATAN || '',
    tempatLahir: relawan.TEMPAT_LAHIR || '',
    statusPernikahan: relawan.STATUS_PERNIKAHAN || '',
    agama: relawan.AGAMA || '',
    kontakDaruratNama: relawan.KONTAK_DARURAT_NAMA || '',
    kontakDaruratHubungan: relawan.KONTAK_DARURAT_HUBUNGAN || '',
    kontakDaruratHubunganLainnya: relawan.KONTAK_DARURAT_HUBUNGAN_LAINNYA || '',
    kontakDaruratNoHp: relawan.KONTAK_DARURAT_NO_HP || '',
    // Field KONTAK & PROFIL -- PINDAH dari 07_AKUN_RELAWAN ke sini supaya
    // sheet akun tidak terus memanjang, dan supaya lebih mudah dicek
    // langsung bareng data relawan lain (lihat diskusi pembagian kolom).
    noHp: relawan.NO_HP || '',
    email: relawan.EMAIL || '',
    tanggalLahir: relawan.TANGGAL_LAHIR || '',
    jenisKelamin: relawan.JENIS_KELAMIN || '',
    alamat: relawan.ALAMAT || '',
    fotoProfilId: relawan.FOTO_PROFIL || '', // ID file Drive mentah -- URL dibentuk di pemanggil
    // Role & Role Stok -- field ADMIN-MANAGED untuk otorisasi (ASN/Kepala
    // SPPG, Petugas Stok). PINDAH dari 07_AKUN_RELAWAN -- field ini murni
    // klasifikasi relawan, bukan hal teknis login.
    role: relawan.ROLE || '',
    roleBaru: relawan.ROLE_BARU || '', // Manajemen Hak Akses (16-18 Okt 2026) -- kosong kalau belum dimigrasi
    roleStok: relawan.ROLE_STOK || '',
    // Rekap Per Periode -- disimpan sbg TEKS (lihat updateRelawan) supaya
    // angka nol di depan nomor rekening tidak pernah hilang.
    nomorRekening: relawan.NOMOR_REKENING !== undefined ? String(relawan.NOMOR_REKENING || '') : ''
  };
}

// Diperbaiki 25 Okt 2026 (perbaikan performa, bagian dari audit yg SAMA
// dgn cache Multi-Shift di SikopMultiShift.gs). SEBELUMNYA: cache per-ID
// (_cacheRelawanPerId), TAPI setiap ID BARU (cache miss) tetap membaca
// ULANG SELURUH sheet Relawan dari awal cuma utk cari 1 baris -- utk N
// relawan BERBEDA dipanggil dlm 1 eksekusi (persis kasus
// buatRosterUntukOperasional_/getRelawanRosterUntukOperasional_, yg
// memanggil ini utk SETIAP relawan), itu N kali baca penuh sheet yg
// SAMA. Sekarang: baca sheet SEKALI, bangun peta id->objek LENGKAP,
// simpan peta itu (bukan per-ID) -- pemanggilan berikutnya, apa pun
// ID-nya, tinggal ambil dari peta di memori, 0 panggilan API tambahan.
let _petaRelawanById = null;
function _muatSemuaRelawanById_() {
  if (_petaRelawanById) return _petaRelawanById;
  const peta = {};
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).forEach(r => {
    peta[String(r.ID_RELAWAN)] = _relawanRowKeBentukPublik_(r);
  });
  _petaRelawanById = peta;
  return peta;
}
function getRelawanById(id) {
  const peta = _muatSemuaRelawanById_();
  const key = String(id);
  return peta[key] !== undefined ? peta[key] : null;
}

/** Dipanggil setelah menulis ke sheet Relawan, supaya cache tidak basi kalau ada baca ulang dalam eksekusi yang sama. */
function _invalidasiCacheRelawan_(id) {
  _petaRelawanById = null; // peta PENUH dibuang (bukan 1 entri) -- dibangun ulang (SEKALI lagi) saat dibutuhkan berikutnya, konsisten dgn strategi "baca sekali per eksekusi"
}

function getDivisiList() {
  // Divisi jarang berubah -- di-cache 10 menit di server (CacheService)
  // supaya tidak baca ulang Spreadsheet tiap kali dipanggil. Kalau Admin
  // baru saja menambah divisi, perubahannya baru terlihat maksimal 10
  // menit kemudian -- tukar cepat kalau kamu butuh instan (lihat addDivisi
  // di bawah, sudah menghapus cache ini otomatis begitu ada divisi baru).
  const cache = CacheService.getScriptCache();
  const tersimpan = cache.get('cache_divisi_list');
  if (tersimpan) return JSON.parse(tersimpan);

  const sheet = getSheet(NAMA_SHEET.DIVISI);
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const nama = sanitize(data[i][0]);
    if (nama) list.push(nama);
  }
  cache.put('cache_divisi_list', JSON.stringify(list), 600); // 10 menit
  return list;
}

/**
 * @param {string} [divisi] filter berdasarkan divisi (opsional)
 * @param {boolean} [semua] jika true, kembalikan relawan AKTIF & NONAKTIF (dipakai dashboard admin).
 *                          Jika false/kosong, hanya relawan AKTIF (dipakai form absensi publik).
 */
function getRelawanList(divisi, semua) {
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const rows = sheetToObjects(sheet);
  return rows
    .filter(r => semua ? true : String(r.STATUS).toUpperCase() === 'AKTIF')
    .filter(r => !divisi || r.DIVISI === divisi)
    .map(r => ({ id: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, divisi: r.DIVISI, status: r.STATUS, nomorRekening: r.NOMOR_REKENING || '' }));
}

/**
 * DIPERBAIKI 30 Okt 2026 (ditemukan saat kerja SIMSDM): versi LAMA fungsi
 * ini generate format "R001, R002, dst" -- TIDAK PERNAH cocok dengan
 * format ID yang BENAR-BENAR dipakai di data nyata ("S-KAS-001",
 * "R-PRS-001", dst). Regex lama /^R(\d+)$/i tidak pernah match ID
 * manapun di 01_DATA_RELAWAN, jadi `max` SELALU 0 -- kalau dipanggil
 * sebelum ini, HASILNYA SELALU "R001" berapa pun relawan yang sudah ada,
 * menyimpang dari pola S-/R- + kode 3 huruf + nomor urut yang sudah
 * mapan. Diperbaiki sepenuhnya, format BARU: "S-KAS-001" / "R-PRS-001".
 *
 * Kode 3 huruf per divisi/jabatan DIAMBIL LANGSUNG dari pola ID yang
 * SUDAH ada di data nyata (diverifikasi 30 Okt 2026), bukan dikarang.
 * "HEAD CHEF" dikonfirmasi Admin TERMASUK (12 nilai Divisi final).
 */
var KODE_DIVISI_JABATAN_ = {
  // -- Peran Staf (prefiks S-) --
  'KA SPPG': 'KAS',
  'PENGAWAS GIZI': 'GIZ',
  'PENGAWASAN KEUANGAN': 'KEU',
  // -- Divisi Relawan (prefiks R-), 12 nilai final (keputusan Admin 30 Okt 2026) --
  'PERSIAPAN': 'PRS',
  'PENGOLAHAN': 'PGL',
  'PEMORSIAN': 'PMS',
  'CUCI OMPRENG': 'CMO',
  'DRIVER': 'DRV',             // koreksi dari 'DRIVER/DISTRIBUSI' lama
  'ASISTEN DRIVER': 'ASD',     // koreksi dari 'ASISTEN DISTRIBUSI' lama
  'ADMIN': 'ADM',
  'SECURITY': 'SEC',
  'CLEANING SERVICE': 'CS',    // koreksi dari 'CLEANING SERVICE/OB' lama
  'ASISTEN LAPANGAN': 'ASL',
  'PETUGAS LOGISTIK': 'LOG',
  'HEAD CHEF': 'HC'
};

/**
 * Membuat ID baru format "S-KAS-001"/"R-PRS-001" dst -- prefiks dari
 * kategoriSdm ('STAFF' -> S-, selain itu -> R-), kode 3 huruf dari
 * KODE_DIVISI_JABATAN_, nomor urut dari ID TERTINGGI yang SUDAH ada
 * utk kombinasi prefiks+kode YANG SAMA (bukan nomor urut global --
 * tiap divisi/jabatan punya urutannya sendiri, sesuai pola asli).
 * @param {Sheet} sheet sheet 01_DATA_RELAWAN
 * @param {string} divisiAtauJabatan nilai persis dari KODE_DIVISI_JABATAN_ (case-insensitive)
 * @param {string} kategoriSdm 'STAFF' atau 'RELAWAN'
 */
function generateIdRelawan(sheet, divisiAtauJabatan, kategoriSdm) {
  const kode = KODE_DIVISI_JABATAN_[String(divisiAtauJabatan || '').toUpperCase().trim()];
  if (!kode) throw new Error('Kode ID untuk "' + divisiAtauJabatan + '" belum terdaftar di KODE_DIVISI_JABATAN_. Tambahkan dulu kode 3 hurufnya di Relawan.gs sebelum memakai divisi/jabatan baru ini.');
  const prefiks = String(kategoriSdm || '').toUpperCase() === 'STAFF' ? 'S' : 'R';
  const pola = new RegExp('^' + prefiks + '-' + kode + '-(\\d+)$', 'i');
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(pola);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return prefiks + '-' + kode + '-' + String(max + 1).padStart(3, '0');
}

function addRelawan(body) {
  const nama = sanitize(body.nama);
  const divisi = sanitize(body.divisi);
  if (!nama) throw new Error('Nama relawan wajib diisi.');
  if (!divisi) throw new Error('Divisi wajib dipilih.');
  if (!getDivisiList().includes(divisi)) throw new Error('Divisi tidak dikenali.');

  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const id = generateIdRelawan(sheet, divisi, 'RELAWAN'); // addRelawan khusus kategori Relawan (pakai Divisi) -- lihat catatan generateIdRelawan
  sheet.appendRow([id, nama, divisi, 'AKTIF']);
  return { id: id, nama: nama, divisi: divisi, status: 'AKTIF' };
}

function updateRelawan(body) {
  const id = sanitize(body.id);
  if (!id) throw new Error('ID relawan wajib diisi.');

  const lock = LockService.getScriptLock(); // BARU (16 Okt 2026) -- sebelumnya fungsi ini tidak terkunci; sekarang BISA menulis ke banyak baris roster sekaligus (propagasi divisi), perlu dilindungi
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      const baris = i + 1;
      const namaLama = data[i][1]; // kolom B
      const divisiLama = data[i][2]; // kolom C -- keduanya disimpan SEBELUM ditimpa, utk deteksi perubahan di bawah
      if (body.nama !== undefined && body.nama !== '') {
        sheet.getRange(baris, 2).setValue(sanitize(body.nama));
      }
      if (body.divisi !== undefined && body.divisi !== '') {
        sheet.getRange(baris, 3).setValue(sanitize(body.divisi));
      }
      if (body.status !== undefined && body.status !== '') {
        sheet.getRange(baris, 4).setValue(sanitize(body.status).toUpperCase());
      }
      // Rekap Per Periode -- Nomor Rekening. Kolom ini DITAMBAHKAN DINAMIS
      // di ujung kanan (lihat SetupKolomProfil.gs), posisinya TIDAK TETAP
      // seperti nama/divisi/status di atas -- karena itu WAJIB dicari lewat
      // nama header (idx), bukan angka kolom hardcode. Boleh dikosongkan
      // (body.nomorRekening === '' tetap diproses, bukan diabaikan seperti
      // field lain di atas -- supaya admin bisa MENGOSONGKAN rekening yang
      // salah input, bukan cuma bisa mengisi).
      if (body.nomorRekening !== undefined) {
        const headerSheet = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        const kolomRekening = headerSheet.indexOf('NOMOR_REKENING') + 1; // +1: Sheets 1-based, indexOf -1 -> 0 -> dianggap "tidak ketemu" di bawah
        if (kolomRekening > 0) {
          const nilaiRekening = sanitize(body.nomorRekening).replace(/[^0-9]/g, ''); // hanya digit -- nomor rekening tidak punya huruf/simbol
          paksaKolomTeks_(sheet, baris, kolomRekening);
          sheet.getRange(baris, kolomRekening).setValue(nilaiRekening);
        }
      }
      // Propagasi Nama & Divisi (16 Okt 2026, diperluas dari perbaikan
      // Divisi sebelumnya -- Admin melaporkan Nama JUGA tersimpan sbg
      // SALINAN di tempat yg sama persis: Roster.gs, MasterTarif.gs,
      // PengajuanKetidakhadiran.gs (semua baris[idx.NAMA_RELAWAN] =
      // relawan.nama) -- BUKAN diambil live dari sheet Relawan. Digabung
      // jadi SATU pemindaian per sheet (bukan pindai 2x utk nama lalu
      // divisi terpisah) -- lebih efisien, hasil akhirnya sama.
      //
      // ID_RELAWAN SENGAJA TIDAK termasuk di sini -- itu kunci relasi ke
      // SEMUA tabel lain (bukan sekadar label spt nama/divisi), mengubahnya
      // perlu alat terpisah dgn pengamanan jauh lebih ketat, bukan field
      // edit biasa. Lihat juga §9 "jangan ubah format ID relawan".
      const namaBaruSan = body.nama !== undefined ? sanitize(body.nama) : null;
      const divisiBaruSan = body.divisi !== undefined && body.divisi !== '' ? sanitize(body.divisi) : null;
      const namaBerubah = namaBaruSan && namaBaruSan !== String(namaLama);
      const divisiBerubah = divisiBaruSan && divisiBaruSan !== String(divisiLama);

      if (namaBerubah || divisiBerubah) {
        const hariIniIso = tanggalSheetKeIso_(formatTanggal(new Date()));

        // 1) Roster V2 -- jadwal yg BELUM terjadi (>= hari ini). Yg sudah
        // lewat SENGAJA tidak disentuh -- riwayat presensi nyata, perlu
        // dijaga akurasinya scr historis (nama/divisi apa yg benar2
        // berlaku SAAT relawan itu bekerja hari itu).
        const sheetRoster = getRosterSheetV2_();
        const idxRoster = akunHeaderIndex_(sheetRoster);
        const dataRoster = sheetRoster.getDataRange().getValues();
        for (let j = 1; j < dataRoster.length; j++) {
          if (String(dataRoster[j][idxRoster.ID_RELAWAN]) !== id) continue;
          const isoBaris = tanggalSheetKeIso_(dataRoster[j][idxRoster.TANGGAL_OPERASIONAL]);
          if (!isoBaris || isoBaris < hariIniIso) continue;
          if (namaBerubah) sheetRoster.getRange(j + 1, idxRoster.NAMA_RELAWAN + 1).setValue(namaBaruSan);
          if (divisiBerubah) sheetRoster.getRange(j + 1, idxRoster.DIVISI + 1).setValue(divisiBaruSan);
        }
        _invalidasiCacheRosterV2_();

        // 2) Master Tarif -- SEMUA periode (pengaturan pembayaran, bukan
        // rekaman kejadian -- aman selalu disamakan dgn kondisi terkini).
        const sheetTarif = getMasterTarifSheet_();
        const idxTarif = akunHeaderIndex_(sheetTarif);
        const dataTarif = sheetTarif.getDataRange().getValues();
        for (let j = 1; j < dataTarif.length; j++) {
          if (String(dataTarif[j][idxTarif.ID_RELAWAN]) !== id) continue;
          if (namaBerubah && idxTarif.NAMA_RELAWAN !== undefined) sheetTarif.getRange(j + 1, idxTarif.NAMA_RELAWAN + 1).setValue(namaBaruSan);
          if (divisiBerubah && idxTarif.DIVISI !== undefined) sheetTarif.getRange(j + 1, idxTarif.DIVISI + 1).setValue(divisiBaruSan);
        }

        // 3) Pengajuan Ketidakhadiran -- HANYA yg masih MENUNGGU (belum
        // diproses) -- yg sudah final (DISETUJUI/DITOLAK/DIBATALKAN)
        // SENGAJA tidak disentuh, itu riwayat keputusan.
        const sheetPengajuan = getPengajuanKetidakhadiranSheet_();
        const idxPengajuan = akunHeaderIndex_(sheetPengajuan);
        const dataPengajuan = sheetPengajuan.getDataRange().getValues();
        let pengajuanTersentuh = false;
        for (let j = 1; j < dataPengajuan.length; j++) {
          if (String(dataPengajuan[j][idxPengajuan.ID_RELAWAN]) !== id) continue;
          if (String(dataPengajuan[j][idxPengajuan.STATUS]) !== 'MENUNGGU') continue;
          if (namaBerubah && idxPengajuan.NAMA_RELAWAN !== undefined) { sheetPengajuan.getRange(j + 1, idxPengajuan.NAMA_RELAWAN + 1).setValue(namaBaruSan); pengajuanTersentuh = true; }
          if (divisiBerubah && idxPengajuan.DIVISI !== undefined) { sheetPengajuan.getRange(j + 1, idxPengajuan.DIVISI + 1).setValue(divisiBaruSan); pengajuanTersentuh = true; }
        }
        if (pengajuanTersentuh) _invalidasiCachePengajuanKetidakhadiran_();
      }

      _invalidasiCacheRelawan_(id);
      return { id: id, success: true };
    }
  }
  throw new Error('Relawan tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * IMPORT RELAWAN MASSAL — alur: baca CSV di frontend -> kirim baris ke
 * sini -> backend VALIDASI ULANG (tidak percaya data mentah dari client)
 * + cek duplikasi -> kalau body.konfirmasi=false cuma PREVIEW (tidak
 * menulis apa pun) -> Admin lihat hasil -> kirim lagi dengan
 * konfirmasi=true untuk benar-benar menyimpan yang valid saja.
 */
function importRelawanMassal(body) {
  const usernameAdmin = requireAuth(body.token);
  const baris = Array.isArray(body.rows) ? body.rows : [];
  const konfirmasi = body.konfirmasi === true;
  if (!baris.length) throw new Error('Tidak ada data untuk diimpor.');

  const divisiValid = getDivisiList();
  const relawanSheet = getSheet(NAMA_SHEET.RELAWAN);
  const existingData = relawanSheet.getDataRange().getValues();
  const namaSudahAda = new Set();
  for (let i = 1; i < existingData.length; i++) {
    const n = sanitize(existingData[i][1]);
    if (n) namaSudahAda.add(n.toLowerCase());
  }

  const hasilValid = [];
  const hasilTidakValid = [];
  const hasilDuplikat = [];
  const namaDalamBatchIni = new Set(); // cegah duplikat ANTAR baris di file yang sama

  baris.forEach((r, idx) => {
    const nomorBaris = idx + 1;
    const nama = sanitize(r.nama);
    const divisi = sanitize(r.divisi);

    if (!nama) { hasilTidakValid.push({ baris: nomorBaris, nama: r.nama || '', alasan: 'Nama kosong' }); return; }
    if (!divisi) { hasilTidakValid.push({ baris: nomorBaris, nama: nama, alasan: 'Divisi kosong' }); return; }
    if (!divisiValid.includes(divisi)) { hasilTidakValid.push({ baris: nomorBaris, nama: nama, alasan: 'Divisi "' + divisi + '" tidak dikenali' }); return; }

    const kunciNama = nama.toLowerCase();
    if (namaSudahAda.has(kunciNama) || namaDalamBatchIni.has(kunciNama)) {
      hasilDuplikat.push({ baris: nomorBaris, nama: nama, alasan: 'Nama sudah ada' });
      return;
    }

    namaDalamBatchIni.add(kunciNama);
    hasilValid.push({ baris: nomorBaris, nama: nama, divisi: divisi });
  });

  if (!konfirmasi) {
    // Mode PREVIEW -- tidak menulis apa pun, cuma laporkan hasil validasi.
    return {
      mode: 'preview',
      totalDiperiksa: baris.length,
      jumlahValid: hasilValid.length,
      jumlahTidakValid: hasilTidakValid.length,
      jumlahDuplikat: hasilDuplikat.length,
      valid: hasilValid, tidakValid: hasilTidakValid, duplikat: hasilDuplikat
    };
  }

  // Mode KONFIRMASI -- benar-benar tulis yang valid.
  const now = new Date();
  const barisBaru = hasilValid.map(r => {
    const id = generateIdRelawan(relawanSheet, r.divisi, 'RELAWAN'); // import massal khusus kategori Relawan -- lihat catatan generateIdRelawan
    // generateIdRelawan baca ulang sheet tiap panggil -- aman dari
    // tabrakan ID walau ditulis satu-satu lewat appendRow di bawah.
    relawanSheet.appendRow([id, r.nama, r.divisi, 'AKTIF', now, now]);
    return { id: id, nama: r.nama, divisi: r.divisi };
  });

  logAudit_('IMPORT_RELAWAN_MASSAL', 'RELAWAN', '', usernameAdmin, { jumlah: barisBaru.length });

  return {
    mode: 'konfirmasi',
    jumlahBerhasil: barisBaru.length,
    jumlahDilewati: hasilTidakValid.length + hasilDuplikat.length,
    data: barisBaru
  };
}

function addDivisi(body) {
  const nama = sanitize(body.nama);
  if (!nama) throw new Error('Nama divisi wajib diisi.');

  const existing = getDivisiList();
  if (existing.some(d => d.toLowerCase() === nama.toLowerCase())) {
    throw new Error('Divisi tersebut sudah ada.');
  }
  const sheet = getSheet(NAMA_SHEET.DIVISI);
  sheet.appendRow([nama]);
  CacheService.getScriptCache().remove('cache_divisi_list'); // supaya langsung kelihatan, tidak nunggu 10 menit
  return { nama: nama };
}


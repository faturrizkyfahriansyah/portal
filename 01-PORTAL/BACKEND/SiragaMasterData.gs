/**
 * SPPG JEUNGJING — SIRAGA v2 — SiragaMasterData.gs
 * Master data: Kategori (02), Barang (03), Supplier (04), + Satuan (§8:
 * daftar TETAP/hardcoded, BUKAN tabel -- sesuai instruksi eksplisit
 * "JANGAN membuat tabel SATUAN baru").
 */

// ------------------------------------------------------------
// SATUAN (§8) -- daftar tetap, bukan tabel, bukan text bebas.
// ------------------------------------------------------------

const SIRAGA_SATUAN_LIST = [
  'KG', 'GRAM', 'TON', 'LITER', 'ML', 'PCS', 'PACK', 'DUS', 'KARUNG',
  'BOTOL', 'GALON', 'BUNGKUS', 'SACHET', 'IKAT', 'LUSIN', 'SET', 'UNIT'
];

function getSiragaSatuanList() {
  return SIRAGA_SATUAN_LIST;
}

// ------------------------------------------------------------
// KATEGORI (§7) -- dropdown terkontrol, 8 kategori awal.
// ------------------------------------------------------------

const SIRAGA_KATEGORI_AWAL = ['BAHAN PANGAN', 'BUMBU', 'KEMASAN', 'ATK', 'APD', 'KEBERSIHAN', 'PERLENGKAPAN', 'LAINNYA'];

/** Dipanggil sekali dari setupSiragaSpreadsheet() alur lengkap (lihat siapkanSiragaAwal di bawah) -- isi 8 kategori awal kalau sheet Kategori masih kosong. */
function siapkanKategoriAwalSiraga_() {
  const sheet = getSiragaSheet_(SIRAGA_SHEET.KATEGORI);
  if (sheet.getLastRow() >= 2) return { dibuat: 0 }; // sudah pernah diisi, jangan dobel
  const now = new Date();
  const rows = SIRAGA_KATEGORI_AWAL.map((nama, i) => ({ ID_KATEGORI: 'KTG-' + String(i + 1).padStart(6, '0'), NAMA_KATEGORI: nama, STATUS: 'AKTIF', KETERANGAN: '', DIBUAT_PADA: now, DIUBAH_PADA: now }));
  siragaTambahBanyakBaris_(SIRAGA_SHEET.KATEGORI, rows);
  return { dibuat: rows.length };
}

/** Relawan/Petugas -- dropdown, hanya AKTIF. */
function getSiragaKategoriList(body) {
  requireSiragaAccess_(body.token);
  siapkanKategoriAwalSiraga_(); // self-healing: isi 8 kategori awal kalau masih kosong (idempotent)
  return getSiragaRows_(SIRAGA_SHEET.KATEGORI)
    .filter(k => statusAktifSiraga_(k.STATUS))
    .map(k => ({ id: k.ID_KATEGORI, nama: k.NAMA_KATEGORI }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

/** Admin -- kelola, termasuk yang NONAKTIF. */
function getSiragaKategoriListAdmin(body) {
  requireSiragaAdmin_(body.token);
  siapkanKategoriAwalSiraga_(); // self-healing: isi 8 kategori awal kalau masih kosong (idempotent)
  return getSiragaRows_(SIRAGA_SHEET.KATEGORI)
    .map(k => ({ id: k.ID_KATEGORI, nama: k.NAMA_KATEGORI, status: statusNormalSiraga_(k.STATUS), statusAsli: k.STATUS, keterangan: k.KETERANGAN }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

function addSiragaKategori(body) {
  requireSiragaAdmin_(body.token);
  const nama = sanitize(body.nama).toUpperCase();
  if (!nama) throw new Error('Nama kategori wajib diisi.');
  const sheet = getSiragaSheet_(SIRAGA_SHEET.KATEGORI);
  const sudahAda = getSiragaRows_(SIRAGA_SHEET.KATEGORI).some(k => String(k.NAMA_KATEGORI).toUpperCase() === nama);
  if (sudahAda) throw new Error('Kategori "' + nama + '" sudah ada.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const id = generateIdSiraga_(sheet, 'KTG', 'ID_KATEGORI');
    const now = new Date();
    siragaTambahBaris_(SIRAGA_SHEET.KATEGORI, { ID_KATEGORI: id, NAMA_KATEGORI: nama, STATUS: 'AKTIF', KETERANGAN: sanitize(body.keterangan), DIBUAT_PADA: now, DIUBAH_PADA: now });
    catatLogSiraga_('TAMBAH_KATEGORI', 'KATEGORI', id, 'ADMIN', { nama: nama });
    return { id: id, nama: nama };
  } finally { lock.releaseLock(); }
}

function updateSiragaKategoriStatus(body) {
  requireSiragaAdmin_(body.token);
  const id = sanitize(body.id);
  const status = sanitize(body.status).toUpperCase();
  if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw new Error('Status tidak valid.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const sheet = getSiragaSheet_(SIRAGA_SHEET.KATEGORI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_KATEGORI]) === id) {
        sheet.getRange(i + 1, idx.STATUS + 1).setValue(status);
        sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(new Date());
        _invalidasiCacheSiraga_(SIRAGA_SHEET.KATEGORI);
        catatLogSiraga_(status === 'AKTIF' ? 'AKTIFKAN_KATEGORI' : 'NONAKTIFKAN_KATEGORI', 'KATEGORI', id, 'ADMIN', {});
        return { success: true };
      }
    }
    throw new Error('Kategori tidak ditemukan.');
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------
// SUPPLIER (§9)
// ------------------------------------------------------------

function getSiragaSupplierList(body) {
  requireSiragaAccess_(body.token);
  return getSiragaRows_(SIRAGA_SHEET.SUPPLIER)
    .filter(s => statusAktifSiraga_(s.STATUS))
    .map(s => ({ id: s.ID_SUPPLIER, nama: s.NAMA_SUPPLIER, kontak: s.KONTAK }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

function getSiragaSupplierListAdmin(body) {
  requireSiragaAdmin_(body.token);
  return getSiragaRows_(SIRAGA_SHEET.SUPPLIER)
    .map(s => ({ id: s.ID_SUPPLIER, nama: s.NAMA_SUPPLIER, kontak: s.KONTAK, alamat: s.ALAMAT, status: statusNormalSiraga_(s.STATUS), statusAsli: s.STATUS, keterangan: s.KETERANGAN }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

function addSiragaSupplier(body) {
  requireSiragaAdmin_(body.token); // supplier: kelola khusus Admin
  const nama = sanitize(body.nama);
  if (!nama) throw new Error('Nama supplier wajib diisi.');
  const sheet = getSiragaSheet_(SIRAGA_SHEET.SUPPLIER);
  const sudahAda = getSiragaRows_(SIRAGA_SHEET.SUPPLIER).some(s => String(s.NAMA_SUPPLIER).toLowerCase() === nama.toLowerCase());
  if (sudahAda) throw new Error('Supplier "' + nama + '" sudah ada.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const id = generateIdSiraga_(sheet, 'SUP', 'ID_SUPPLIER');
    const now = new Date();
    siragaTambahBaris_(SIRAGA_SHEET.SUPPLIER, { ID_SUPPLIER: id, NAMA_SUPPLIER: nama, KONTAK: sanitize(body.kontak), ALAMAT: sanitize(body.alamat), STATUS: 'AKTIF', KETERANGAN: sanitize(body.keterangan), DIBUAT_PADA: now, DIUBAH_PADA: now });
    catatLogSiraga_('TAMBAH_SUPPLIER', 'SUPPLIER', id, 'ADMIN', { nama: nama });
    return { id: id, nama: nama };
  } finally { lock.releaseLock(); }
}

function updateSiragaSupplier(body) {
  requireSiragaAdmin_(body.token);
  const id = sanitize(body.id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const sheet = getSiragaSheet_(SIRAGA_SHEET.SUPPLIER);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_SUPPLIER]) === id) {
        const baris = i + 1;
        if (body.nama !== undefined) sheet.getRange(baris, idx.NAMA_SUPPLIER + 1).setValue(sanitize(body.nama));
        if (body.kontak !== undefined) sheet.getRange(baris, idx.KONTAK + 1).setValue(sanitize(body.kontak));
        if (body.alamat !== undefined) sheet.getRange(baris, idx.ALAMAT + 1).setValue(sanitize(body.alamat));
        if (body.keterangan !== undefined) sheet.getRange(baris, idx.KETERANGAN + 1).setValue(sanitize(body.keterangan));
        if (body.status !== undefined) {
          const status = sanitize(body.status).toUpperCase();
          if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw new Error('Status tidak valid.');
          sheet.getRange(baris, idx.STATUS + 1).setValue(status);
        }
        sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(new Date());
        _invalidasiCacheSiraga_(SIRAGA_SHEET.SUPPLIER);
        catatLogSiraga_('UBAH_SUPPLIER', 'SUPPLIER', id, 'ADMIN', {});
        return { success: true };
      }
    }
    throw new Error('Supplier tidak ditemukan.');
  } finally { lock.releaseLock(); }
}

// ------------------------------------------------------------
// BARANG (§6) -- master barang. STOK bukan field di sini (dihitung, lihat SiragaStok.gs).
// ------------------------------------------------------------

function validasiKategoriAktif_(idKategori) {
  const k = getSiragaRows_(SIRAGA_SHEET.KATEGORI).find(x => x.ID_KATEGORI === idKategori);
  if (!k) throw new Error('Kategori tidak ditemukan.');
  if (!statusAktifSiraga_(k.STATUS)) throw new Error('Kategori "' + k.NAMA_KATEGORI + '" sudah nonaktif.');
  return k;
}
function validasiSatuan_(satuan) {
  if (SIRAGA_SATUAN_LIST.indexOf(String(satuan).toUpperCase()) === -1) {
    throw new Error('Satuan tidak valid -- harus salah satu dari daftar satuan yang tersedia.');
  }
  return String(satuan).toUpperCase();
}

/** Dropdown searchable Barang (§16/§17) -- Admin/Petugas, hanya AKTIF, dgn kategori+satuan terlampir utk auto-fill. */
function getSiragaBarangList(body) {
  requireSiragaAccess_(body.token);
  const kategoriMap = {};
  getSiragaRows_(SIRAGA_SHEET.KATEGORI).forEach(k => { kategoriMap[k.ID_KATEGORI] = k.NAMA_KATEGORI; });

  let list = getSiragaRows_(SIRAGA_SHEET.BARANG).filter(b => statusAktifSiraga_(b.STATUS));
  if (body.cari) {
    const q = String(body.cari).toLowerCase();
    list = list.filter(b => String(b.NAMA_BARANG).toLowerCase().indexOf(q) !== -1 || String(b.KODE_BARANG).toLowerCase().indexOf(q) !== -1);
  }
  const stokMap = getSiragaStokSemuaBarang_(); // dari SiragaStok.gs -- {idBarang: stokAngka}
  return list.map(b => ({
    id: b.ID_BARANG, kode: b.KODE_BARANG, nama: b.NAMA_BARANG,
    idKategori: b.ID_KATEGORI, namaKategori: kategoriMap[b.ID_KATEGORI] || '-',
    satuan: b.SATUAN, stokMinimum: Number(b.STOK_MINIMUM) || 0,
    kelolaBatch: String(b.KELOLA_BATCH).toUpperCase() === 'YA',
    kelolaExpired: String(b.KELOLA_EXPIRED).toUpperCase() === 'YA',
    stok: stokMap[b.ID_BARANG] || 0,
    statusStok: hitungStatusStokSiraga_(stokMap[b.ID_BARANG] || 0, Number(b.STOK_MINIMUM) || 0)
  })).sort((a, b) => a.nama.localeCompare(b.nama));
}

/** Admin -- daftar lengkap termasuk NONAKTIF, utk Master Data > Data Barang. */
/**
 * PERBAIKAN: sebelumnya .sort() di akhir fungsi ini memanggil
 * a.nama.localeCompare(b.nama) TANPA jaga-jaga kalau ada barang dengan
 * NAMA_BARANG kosong/kosong total (mis. baris lama, atau input manual
 * yang terlewat salah satu kolomnya) -- SATU baris saja yang nama-nya
 * undefined akan membuat .localeCompare() error dan MENGGAGALKAN SELURUH
 * daftar (bukan cuma baris itu yang hilang, tapi SEMUA 228 barang jadi
 * tidak tampil sama sekali). Dashboard (getSiragaDashboardV2) tidak kena
 * dampak ini karena dia tidak pernah menyentuh field nama sama sekali --
 * itu sebabnya Dashboard berhasil sementara Data Barang gagal total,
 * walau keduanya baca dari spreadsheet SIRAGA yang sama persis.
 * Sekarang nama yang kosong diperlakukan sbg teks kosong ('') saat
 * dibandingkan -- barang itu tetap TAMPIL di daftar (supaya Admin bisa
 * melihat & memperbaiki datanya), cuma urutannya di paling atas/bawah.
 */
function getSiragaBarangListAdmin(body) {
  requireSiragaAdmin_(body.token);
  const kategoriMap = {};
  getSiragaRows_(SIRAGA_SHEET.KATEGORI).forEach(k => { kategoriMap[k.ID_KATEGORI] = k.NAMA_KATEGORI; });
  const stokMap = getSiragaStokSemuaBarang_();
  return getSiragaRows_(SIRAGA_SHEET.BARANG).map(b => ({
    id: b.ID_BARANG, kode: b.KODE_BARANG || '', nama: b.NAMA_BARANG || '',
    idKategori: b.ID_KATEGORI, namaKategori: kategoriMap[b.ID_KATEGORI] || '-',
    satuan: b.SATUAN, stokMinimum: Number(b.STOK_MINIMUM) || 0,
    kelolaBatch: String(b.KELOLA_BATCH).toUpperCase() === 'YA',
    kelolaExpired: String(b.KELOLA_EXPIRED).toUpperCase() === 'YA',
    status: statusNormalSiraga_(b.STATUS), statusAsli: b.STATUS, keterangan: b.KETERANGAN,
    stok: stokMap[b.ID_BARANG] || 0
  })).sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || '')));
}

function addSiragaBarang(body) {
  const akses = requireSiragaAccess_(body.token, false);
  requireSiragaAdmin_(body.token); // tambah barang: khusus Admin
  const nama = sanitize(body.nama);
  if (!nama) throw new Error('Nama barang wajib diisi.');
  const idKategori = sanitize(body.idKategori);
  validasiKategoriAktif_(idKategori);
  const satuan = validasiSatuan_(body.satuan);
  const stokMinimum = Number(body.stokMinimum);
  if (isNaN(stokMinimum) || stokMinimum < 0) throw new Error('Stok minimum harus angka >= 0.');

  const sheet = getSiragaSheet_(SIRAGA_SHEET.BARANG);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const idx = buatIdKodeBarangSiraga_(sheet, idKategori);
    const now = new Date();
    siragaTambahBaris_(SIRAGA_SHEET.BARANG, {
      ID_BARANG: idx.id, KODE_BARANG: idx.kode, NAMA_BARANG: nama, ID_KATEGORI: idKategori, SATUAN: satuan,
      STOK_MINIMUM: stokMinimum, KELOLA_BATCH: body.kelolaBatch ? 'YA' : 'TIDAK', KELOLA_EXPIRED: body.kelolaExpired ? 'YA' : 'TIDAK',
      STATUS: 'AKTIF', KETERANGAN: sanitize(body.keterangan),
      DIBUAT_OLEH: akses.idPetugas, DIBUAT_PADA: now, DIUBAH_OLEH: akses.idPetugas, DIUBAH_PADA: now
    });
    catatLogSiraga_('TAMBAH_BARANG', 'BARANG', idx.id, akses.idPetugas, { nama: nama });
    return { id: idx.id, kode: idx.kode, nama: nama };
  } finally { lock.releaseLock(); }
}

/**
 * ID & kode barang baru MENGIKUTI POLA DATA YANG SUDAH ADA (ID lama dipertahankan, tidak diubah):
 *   kategori berkode (mis. ID_KATEGORI "KTG-OPS")  -> ID "BRG-OPS-048", kode "OPS-048"
 *   kategori tanpa kode (mis. "KTG-000001")        -> ID "BRG-000048", kode "BRG000048"
 * Nomor urut = nomor tertinggi di SELURUH barang + 1 (berlanjut lintas kategori, seperti data yang ada).
 */
function buatIdKodeBarangSiraga_(sheet, idKategori) {
  const semuaId = getSiragaRows_(SIRAGA_SHEET.BARANG).map(b => String(b.ID_BARANG || ''));
  let max = 0;
  semuaId.forEach(id => { const m = id.match(/^BRG-(?:[A-Za-z0-9]+-)?0*(\d+)$/i); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  const kodeKat = String(idKategori || '').replace(/^KTG-/i, '');
  const berkode = kodeKat && !/^\d+$/.test(kodeKat);
  const ada = new Set(semuaId);
  let nomor = max + 1, id, kode;
  do {
    const n3 = String(nomor).padStart(3, '0');
    if (berkode) { id = 'BRG-' + kodeKat + '-' + n3; kode = kodeKat + '-' + n3; }
    else { id = 'BRG-' + String(nomor).padStart(6, '0'); kode = 'BRG' + String(nomor).padStart(6, '0'); }
    nomor++;
  } while (ada.has(id));
  return { id: id, kode: kode };
}

function updateSiragaBarang(body) {
  const akses = requireSiragaAccess_(body.token, false);
  requireSiragaAdmin_(body.token);
  const id = sanitize(body.id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const sheet = getSiragaSheet_(SIRAGA_SHEET.BARANG);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_BARANG]) === id) {
        const baris = i + 1;
        if (body.nama !== undefined) sheet.getRange(baris, idx.NAMA_BARANG + 1).setValue(sanitize(body.nama));
        if (body.idKategori !== undefined) { validasiKategoriAktif_(body.idKategori); sheet.getRange(baris, idx.ID_KATEGORI + 1).setValue(body.idKategori); }
        if (body.satuan !== undefined) sheet.getRange(baris, idx.SATUAN + 1).setValue(validasiSatuan_(body.satuan));
        if (body.stokMinimum !== undefined) {
          const sm = Number(body.stokMinimum);
          if (isNaN(sm) || sm < 0) throw new Error('Stok minimum harus angka >= 0.');
          sheet.getRange(baris, idx.STOK_MINIMUM + 1).setValue(sm);
        }
        if (body.kelolaBatch !== undefined) sheet.getRange(baris, idx.KELOLA_BATCH + 1).setValue(body.kelolaBatch ? 'YA' : 'TIDAK');
        if (body.kelolaExpired !== undefined) sheet.getRange(baris, idx.KELOLA_EXPIRED + 1).setValue(body.kelolaExpired ? 'YA' : 'TIDAK');
        if (body.keterangan !== undefined) sheet.getRange(baris, idx.KETERANGAN + 1).setValue(sanitize(body.keterangan));
        sheet.getRange(baris, idx.DIUBAH_OLEH + 1).setValue(akses.idPetugas);
        sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(new Date());
        _invalidasiCacheSiraga_(SIRAGA_SHEET.BARANG);
        catatLogSiraga_('UBAH_BARANG', 'BARANG', id, akses.idPetugas, {});
        return { success: true };
      }
    }
    throw new Error('Barang tidak ditemukan.');
  } finally { lock.releaseLock(); }
}

function updateSiragaBarangStatus(body) {
  const akses = requireSiragaAccess_(body.token, false);
  requireSiragaAdmin_(body.token);
  const id = sanitize(body.id);
  const status = sanitize(body.status).toUpperCase();
  if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw new Error('Status tidak valid.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const sheet = getSiragaSheet_(SIRAGA_SHEET.BARANG);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_BARANG]) === id) {
        sheet.getRange(i + 1, idx.STATUS + 1).setValue(status);
        sheet.getRange(i + 1, idx.DIUBAH_OLEH + 1).setValue(akses.idPetugas);
        sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(new Date());
        _invalidasiCacheSiraga_(SIRAGA_SHEET.BARANG);
        catatLogSiraga_(status === 'AKTIF' ? 'AKTIFKAN_BARANG' : 'NONAKTIFKAN_BARANG', 'BARANG', id, akses.idPetugas, {});
        return { success: true };
      }
    }
    throw new Error('Barang tidak ditemukan.');
  } finally { lock.releaseLock(); }
}

/** §24 -- status stok TURUNAN, tidak pernah disimpan manual. Batas "Mendekati Minimum" dari CONFIG. */
function hitungStatusStokSiraga_(stok, stokMinimum) {
  if (stok <= 0) return 'HABIS';
  if (stok <= stokMinimum) return 'DI BAWAH MINIMUM';
  const persenMendekati = Number(getSiragaConfig_('BATAS_MENDEKATI_MINIMUM_PERSEN', 20));
  const batasMendekati = stokMinimum * (100 + persenMendekati) / 100;
  if (stok <= batasMendekati) return 'MENDEKATI MINIMUM';
  return 'AMAN';
}


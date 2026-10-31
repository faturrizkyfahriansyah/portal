/**
 * SPPG JEUNGJING — SIRAGA v2 — SiragaStok.gs
 * TRANSACTION ENGINE TUNGGAL (§10/§11) -- SATU mesin utk MASUK, KELUAR,
 * TRANSFER, PENYESUAIAN, PEMUSNAHAN. TIDAK ADA tabel terpisah per jenis.
 *
 * STOK TIDAK PERNAH DISIMPAN MANUAL (§13) -- selalu dihitung ON-DEMAND
 * dari 06_TRANSAKSI_DETAIL milik transaksi berstatus SELESAI saja.
 *
 * ==================================================================
 * KEPUTUSAN DESAIN: ARAH PENGARUH TRANSFER TERHADAP STOK
 * ==================================================================
 * Skema ini (mengikuti §6 persis) TIDAK memiliki dimensi "lokasi" pada
 * tabel BARANG -- artinya hanya ADA SATU angka stok per barang, bukan
 * per lokasi. §23 secara eksplisit menyebut "Transfer harus MENGURANGI
 * stok sumber" -- karena itu, TRANSFER diperlakukan SAMA seperti KELUAR
 * secara stok (mengurangi), dengan SUMBER/TUJUAN sebagai catatan/dropdown
 * informasional, BUKAN kolam stok terpisah. Kalau ke depan dibutuhkan
 * pelacakan stok PER LOKASI sungguhan, itu perubahan skema terpisah
 * (field LOKASI di BARANG atau tabel lokasi baru) -- di luar cakupan
 * paket ini, didokumentasikan sbg keputusan sadar, bukan diabaikan.
 */

const SIRAGA_JENIS_TRANSAKSI = ['MASUK', 'KELUAR', 'TRANSFER', 'PENYESUAIAN', 'PEMUSNAHAN'];
const SIRAGA_STATUS_TRANSAKSI = ['DRAFT', 'SELESAI', 'DIBATALKAN'];
const SIRAGA_ALASAN_PEMUSNAHAN = ['RUSAK', 'KEDALUWARSA', 'TIDAK LAYAK', 'HILANG/RUSAK DALAM PENYIMPANAN', 'LAINNYA'];

/** +qty utk MASUK & (PENYESUAIAN naik ditangani terpisah di opname, qty di sini SUDAH bertanda +/-), -qty utk KELUAR/TRANSFER/PEMUSNAHAN. */
function arahStokSiraga_(jenis) {
  if (jenis === 'MASUK') return 1;
  if (jenis === 'KELUAR' || jenis === 'TRANSFER' || jenis === 'PEMUSNAHAN') return -1;
  if (jenis === 'PENYESUAIAN') return null; // tanda ditentukan oleh QTY itu sendiri (bisa + atau -), lihat SiragaOpname.gs
  throw new Error('Jenis transaksi tidak valid.');
}

/**
 * Hitung stok SEMUA barang sekaligus (1 pembacaan sheet TRANSAKSI +
 * TRANSAKSI_DETAIL, bukan query per-barang) -- dipakai getSiragaBarangList
 * dkk supaya tidak N+1 query (§16/§28 performa).
 * @return {Object} {idBarang: stokAngka}
 */
function getSiragaStokSemuaBarang_() {
  const transaksiSelesai = new Set(
    getSiragaRows_(SIRAGA_SHEET.TRANSAKSI)
      .filter(t => t.STATUS === 'SELESAI')
      .map(t => t.ID_TRANSAKSI)
  );
  const jenisById = {};
  getSiragaRows_(SIRAGA_SHEET.TRANSAKSI).forEach(t => { jenisById[t.ID_TRANSAKSI] = t.JENIS_TRANSAKSI; });

  const stok = {};
  getSiragaRows_(SIRAGA_SHEET.TRANSAKSI_DETAIL).forEach(d => {
    if (!transaksiSelesai.has(d.ID_TRANSAKSI)) return;
    const jenis = jenisById[d.ID_TRANSAKSI];
    const arah = arahStokSiraga_(jenis);
    const qty = Number(d.QTY) || 0;
    const efek = arah === null ? qty : arah * Math.abs(qty); // PENYESUAIAN: tanda dari QTY tersimpan; lainnya: tanda dari jenis
    stok[d.ID_BARANG] = (stok[d.ID_BARANG] || 0) + efek;
  });
  return stok;
}

/** Stok 1 barang saja (dipanggil form Barang Keluar/Transfer/Pemusnahan saat barang dipilih). */
function getSiragaStokBarang_(idBarang) {
  return getSiragaStokSemuaBarang_()[idBarang] || 0;
}

/** ADMIN/PETUGAS -- dispatch endpoint utk auto-fill (§17) saat barang dipilih di form transaksi. */
function getSiragaStokDetailBarang(body) {
  requireSiragaAccess_(body.token);
  const idBarang = sanitize(body.idBarang);
  const barang = getSiragaRows_(SIRAGA_SHEET.BARANG).find(b => b.ID_BARANG === idBarang);
  if (!barang) throw new Error('Barang tidak ditemukan.');
  const stok = getSiragaStokBarang_(idBarang);
  const stokMinimum = Number(barang.STOK_MINIMUM) || 0;
  return {
    id: barang.ID_BARANG, nama: barang.NAMA_BARANG, satuan: barang.SATUAN,
    stok: stok, stokMinimum: stokMinimum, statusStok: hitungStatusStokSiraga_(stok, stokMinimum),
    kelolaBatch: String(barang.KELOLA_BATCH).toUpperCase() === 'YA',
    kelolaExpired: String(barang.KELOLA_EXPIRED).toUpperCase() === 'YA'
  };
}

// ------------------------------------------------------------
// TRANSACTION ENGINE INTI (§10/§11/§29)
// ------------------------------------------------------------

/**
 * Buat transaksi baru -- SATU fungsi utk SEMUA jenis (§10/§11: user tidak
 * pilih jenis manual, ditentukan otomatis dari MENU yang memanggil).
 *
 * @param {Object} body {
 *   token, jenis ('MASUK'|'KELUAR'|'TRANSFER'|'PEMUSNAHAN' -- PENYESUAIAN
 *     HANYA dibuat sistem lewat Stock Opname, TIDAK lewat fungsi ini
 *     langsung, lihat SiragaOpname.gs),
 *   tanggal (opsional, default hari ini),
 *   sumber, tujuan (sesuai jenis),
 *   idSupplier (utk MASUK),
 *   alasanPemusnahan, keteranganAlasanLainnya (utk PEMUSNAHAN),
 *   keterangan,
 *   statusAwal ('DRAFT'|'SELESAI', default 'SELESAI'),
 *   items: [{idBarang, qty, idBatch, tanggalProduksi, tanggalExpired}, ...]
 * }
 */
function buatSiragaTransaksi_(body, jenisTetap) {
  const akses = requireSiragaAccess_(body.token, true);
  const jenis = jenisTetap || sanitize(body.jenis).toUpperCase();
  if (SIRAGA_JENIS_TRANSAKSI.indexOf(jenis) === -1 || jenis === 'PENYESUAIAN') {
    throw new Error('Jenis transaksi tidak valid utk dibuat langsung.');
  }
  const statusAwal = sanitize(body.statusAwal).toUpperCase() || 'SELESAI';
  if (SIRAGA_STATUS_TRANSAKSI.indexOf(statusAwal) === -1 || statusAwal === 'DIBATALKAN') {
    throw new Error('Status awal tidak valid.');
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new Error('Minimal harus ada 1 barang dalam transaksi.');

  let alasanPemusnahan = '';
  if (jenis === 'PEMUSNAHAN') {
    alasanPemusnahan = sanitize(body.alasanPemusnahan).toUpperCase();
    if (SIRAGA_ALASAN_PEMUSNAHAN.indexOf(alasanPemusnahan) === -1) throw new Error('Alasan pemusnahan wajib dipilih dari daftar.');
    if (alasanPemusnahan === 'LAINNYA' && !sanitize(body.keterangan)) throw new Error('Keterangan wajib diisi kalau alasan pemusnahan "LAINNYA".');
  }
  if (jenis === 'TRANSFER' && (!sanitize(body.sumber) || !sanitize(body.tujuan))) {
    throw new Error('Sumber dan Tujuan wajib diisi utk Transfer.');
  }
  if (jenis === 'MASUK' && body.idSupplier) {
    const supplier = getSiragaRows_(SIRAGA_SHEET.SUPPLIER).find(s => s.ID_SUPPLIER === sanitize(body.idSupplier));
    if (!supplier || !statusAktifSiraga_(supplier.STATUS)) throw new Error('Supplier tidak valid/sudah nonaktif.');
  }

  // Validasi & bersihkan tiap item SEBELUM masuk critical section (§29: jangan kerjaan berat di dalam lock).
  const barangMap = {};
  getSiragaRows_(SIRAGA_SHEET.BARANG).forEach(b => { barangMap[b.ID_BARANG] = b; });
  const batchMap = {};
  getSiragaRows_(SIRAGA_SHEET.BATCH).forEach(bt => { batchMap[bt.ID_BATCH] = bt; });

  const itemBersih = items.map((it, idx) => {
    const idBarang = sanitize(it.idBarang);
    const qty = Number(it.qty);
    if (!idBarang) throw new Error('Barang pada baris ke-' + (idx + 1) + ' wajib dipilih.');
    if (!qty || qty <= 0) throw new Error('Qty pada baris ke-' + (idx + 1) + ' harus lebih dari 0.');
    const barang = barangMap[idBarang];
    if (!barang) throw new Error('Barang pada baris ke-' + (idx + 1) + ' tidak ditemukan.');
    if (!statusAktifSiraga_(barang.STATUS)) throw new Error('Barang "' + barang.NAMA_BARANG + '" sudah nonaktif.');

    let idBatch = '', tanggalProduksi = '', tanggalExpired = '';
    const kelolaBatch = String(barang.KELOLA_BATCH).toUpperCase() === 'YA';
    const kelolaExpired = String(barang.KELOLA_EXPIRED).toUpperCase() === 'YA';

    if (jenis === 'MASUK' && (kelolaBatch || kelolaExpired)) {
      // MASUK dgn batch/expired: buat batch BARU (§18/§19) -- nomor batch dibuat sistem.
      tanggalProduksi = kelolaExpired ? sanitize(it.tanggalProduksi) : '';
      tanggalExpired = kelolaExpired ? sanitize(it.tanggalExpired) : '';
      if (kelolaExpired && !tanggalExpired) throw new Error('Tanggal expired wajib diisi utk "' + barang.NAMA_BARANG + '" (barang ini mengelola tanggal kedaluwarsa).');
    } else if (jenis !== 'MASUK' && kelolaBatch) {
      // KELUAR/TRANSFER/PEMUSNAHAN dari barang ber-batch: WAJIB pilih batch existing (§18 dependent dropdown).
      idBatch = sanitize(it.idBatch);
      if (!idBatch) throw new Error('Batch wajib dipilih utk "' + barang.NAMA_BARANG + '".');
      const batch = batchMap[idBatch];
      if (!batch || batch.ID_BARANG !== idBarang) throw new Error('Batch tidak valid utk "' + barang.NAMA_BARANG + '".');
    }

    return { idBarang: idBarang, nama: barang.NAMA_BARANG, satuan: barang.SATUAN, qty: qty, idBatch: idBatch, tanggalProduksi: tanggalProduksi, tanggalExpired: tanggalExpired, kelolaBatch: kelolaBatch, kelolaExpired: kelolaExpired };
  });

  // ============================================================
  // CRITICAL SECTION (§29): LOCK -> ambil stok TERBARU -> validasi -> simpan -> release.
  // ============================================================
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk memproses transaksi lain. Silakan coba lagi dalam beberapa detik.');

  try {
    // Stok diambil ULANG di dalam lock (bukan pakai hasil validasi di luar lock yang mungkin sudah basi -- §29).
    if (statusAwal === 'SELESAI' && (jenis === 'KELUAR' || jenis === 'TRANSFER' || jenis === 'PEMUSNAHAN')) {
      const stokTerbaru = getSiragaStokSemuaBarang_();
      itemBersih.forEach(it => {
        const stokSaatIni = stokTerbaru[it.idBarang] || 0;
        if (it.qty > stokSaatIni) {
          throw new Error('Stok tidak mencukupi untuk "' + it.nama + '" (stok tersedia: ' + stokSaatIni + ' ' + it.satuan + ').');
        }
      });
    }

    const sheetTransaksi = getSiragaSheet_(SIRAGA_SHEET.TRANSAKSI);
    const idTransaksi = generateIdSiraga_(sheetTransaksi, 'TRX', 'ID_TRANSAKSI');
    const nomorTransaksi = generateSiragaNomorTransaksi_(sheetTransaksi, jenis);
    const now = new Date();
    const tanggal = sanitize(body.tanggal) || formatTanggal(now);

    siragaTambahBaris_(SIRAGA_SHEET.TRANSAKSI, {
      ID_TRANSAKSI: idTransaksi, NOMOR_TRANSAKSI: nomorTransaksi, TANGGAL: tanggal, JENIS_TRANSAKSI: jenis, STATUS: statusAwal,
      SUMBER: sanitize(body.sumber), TUJUAN: sanitize(body.tujuan), ID_SUPPLIER: sanitize(body.idSupplier), ALASAN_PEMUSNAHAN: alasanPemusnahan,
      ID_PETUGAS: akses.idPetugas, NAMA_PETUGAS: akses.namaPetugas, KETERANGAN: sanitize(body.keterangan),
      DIBUAT_PADA: now, DIUBAH_PADA: now, DISELESAIKAN_PADA: statusAwal === 'SELESAI' ? now : '', DIBATALKAN_PADA: ''
    });

    // Batch BARU (utk MASUK dgn batch/expired) dibuat SEBELUM detail supaya ID_BATCH sudah tersedia.
    // ID batch dibuat SEKALIGUS (bukan satu-satu) supaya tiap batch dalam transaksi ini punya ID berbeda.
    const sheetBatch = getSiragaSheet_(SIRAGA_SHEET.BATCH);
    const itemBerbatch = itemBersih.filter(it => jenis === 'MASUK' && (it.kelolaBatch || it.kelolaExpired));
    if (itemBerbatch.length) {
      const idBatchBaru = generateBanyakIdSiraga_(sheetBatch, 'BAT', 'ID_BATCH', itemBerbatch.length);
      const barisBatchBaru = itemBerbatch.map((it, n) => {
        it.idBatch = idBatchBaru[n]; // dipakai saat tulis detail di bawah
        return { ID_BATCH: idBatchBaru[n], ID_BARANG: it.idBarang, NOMOR_BATCH: idBatchBaru[n], TANGGAL_PRODUKSI: it.tanggalProduksi, TANGGAL_EXPIRED: it.tanggalExpired, STATUS: 'AKTIF', KETERANGAN: '', DIBUAT_PADA: now };
      });
      siragaTambahBanyakBaris_(SIRAGA_SHEET.BATCH, barisBatchBaru);
    }

    const sheetDetail = getSiragaSheet_(SIRAGA_SHEET.TRANSAKSI_DETAIL);
    const idDetail = generateBanyakIdSiraga_(sheetDetail, 'DTL', 'ID_DETAIL', itemBersih.length);
    siragaTambahBanyakBaris_(SIRAGA_SHEET.TRANSAKSI_DETAIL, itemBersih.map((it, n) => ({
      ID_DETAIL: idDetail[n], ID_TRANSAKSI: idTransaksi, NOMOR_TRANSAKSI: nomorTransaksi, ID_BARANG: it.idBarang, NAMA_BARANG: it.nama, SATUAN: it.satuan,
      ID_BATCH: it.idBatch, QTY: it.qty, TANGGAL_PRODUKSI: it.tanggalProduksi, TANGGAL_EXPIRED: it.tanggalExpired
    })));

    _invalidasiCacheSiraga_(); // stok, batch, transaksi semua berubah -- reset semua cache
    catatLogSiraga_('BUAT_TRANSAKSI', 'TRANSAKSI', idTransaksi, akses.idPetugas, { jenis: jenis, nomorTransaksi: nomorTransaksi, status: statusAwal, jumlahItem: itemBersih.length });
    if (statusAwal === 'SELESAI') {
      catatLogSiraga_('SELESAIKAN_TRANSAKSI', 'TRANSAKSI', idTransaksi, akses.idPetugas, { nomorTransaksi: nomorTransaksi });
    }

    return { success: true, idTransaksi: idTransaksi, nomorTransaksi: nomorTransaksi, status: statusAwal };
  } finally {
    lock.releaseLock();
  }
}

function generateSiragaNomorTransaksi_(sheet, jenis) {
  const prefix = { MASUK: 'BM', KELUAR: 'BK', TRANSFER: 'TF', PENYESUAIAN: 'PY', PEMUSNAHAN: 'PM' }[jenis];
  const tanggalStr = Utilities.formatDate(new Date(), ZONA_WAKTU, 'yyyyMMdd');
  const awalan = prefix + '-' + tanggalStr + '-';
  const data = sheet.getDataRange().getValues();
  const kolNomor = Math.max(0, headerSiraga_(sheet).indexOf('NOMOR_TRANSAKSI'));
  let maxUrut = 0;
  for (let i = 1; i < data.length; i++) {
    const nomor = String(data[i][kolNomor] || '');
    if (nomor.indexOf(awalan) === 0) {
      const urut = parseInt(nomor.substring(awalan.length), 10);
      if (!isNaN(urut)) maxUrut = Math.max(maxUrut, urut);
    }
  }
  return awalan + String(maxUrut + 1).padStart(3, '0');
}

// ------------------------------------------------------------
// DISPATCH ENDPOINTS per menu (§11: jenis otomatis dari menu)
// ------------------------------------------------------------

function siragaBarangMasuk(body) { return buatSiragaTransaksi_(body, 'MASUK'); }
function siragaBarangKeluar(body) { return buatSiragaTransaksi_(body, 'KELUAR'); }
function siragaTransfer(body) { return buatSiragaTransaksi_(body, 'TRANSFER'); }
function siragaPemusnahan(body) { return buatSiragaTransaksi_(body, 'PEMUSNAHAN'); }

/** §12 -- selesaikan transaksi DRAFT (baru MEMENGARUHI stok setelah ini). Validasi stok diulang di sini (bisa saja stok berubah sejak DRAFT dibuat). */
function selesaikanSiragaTransaksi(body) {
  const akses = requireSiragaAccess_(body.token, true);
  const idTransaksi = sanitize(body.idTransaksi);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const sheet = getSiragaSheet_(SIRAGA_SHEET.TRANSAKSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_TRANSAKSI]) === idTransaksi) {
        if (String(data[i][idx.STATUS]) !== 'DRAFT') throw new Error('Hanya transaksi berstatus DRAFT yang bisa diselesaikan.');
        const jenis = String(data[i][idx.JENIS_TRANSAKSI]);

        if (jenis === 'KELUAR' || jenis === 'TRANSFER' || jenis === 'PEMUSNAHAN') {
          const detailTransaksi = getSiragaRows_(SIRAGA_SHEET.TRANSAKSI_DETAIL).filter(d => d.ID_TRANSAKSI === idTransaksi);
          const stokTerbaru = getSiragaStokSemuaBarang_();
          detailTransaksi.forEach(d => {
            const stokSaatIni = stokTerbaru[d.ID_BARANG] || 0;
            if (Number(d.QTY) > stokSaatIni) throw new Error('Stok tidak mencukupi untuk "' + d.NAMA_BARANG + '" (stok tersedia: ' + stokSaatIni + ' ' + d.SATUAN + ').');
          });
        }

        const now = new Date();
        sheet.getRange(i + 1, idx.STATUS + 1).setValue('SELESAI');
        sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(now);
        sheet.getRange(i + 1, idx.DISELESAIKAN_PADA + 1).setValue(now);
        _invalidasiCacheSiraga_();
        catatLogSiraga_('SELESAIKAN_TRANSAKSI', 'TRANSAKSI', idTransaksi, akses.idPetugas, { nomorTransaksi: data[i][idx.NOMOR_TRANSAKSI] });
        return { success: true };
      }
    }
    throw new Error('Transaksi tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/** §12 -- batalkan transaksi (DRAFT atau SELESAI -- kalau SELESAI, pembatalan otomatis "mengembalikan" stok karena stok dihitung, bukan disimpan, sehingga transaksi DIBATALKAN otomatis tidak lagi terhitung). */
function batalkanSiragaTransaksi(body) {
  const akses = requireSiragaAccess_(body.token, true);
  const idTransaksi = sanitize(body.idTransaksi);
  const sheet = getSiragaSheet_(SIRAGA_SHEET.TRANSAKSI);
  const idx = akunHeaderIndex_(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_TRANSAKSI]) === idTransaksi) {
      if (String(data[i][idx.STATUS]) === 'DIBATALKAN') throw new Error('Transaksi ini sudah dibatalkan sebelumnya.');
      const now = new Date();
      sheet.getRange(i + 1, idx.STATUS + 1).setValue('DIBATALKAN');
      sheet.getRange(i + 1, idx.DIUBAH_PADA + 1).setValue(now);
      sheet.getRange(i + 1, idx.DIBATALKAN_PADA + 1).setValue(now);
      _invalidasiCacheSiraga_();
      catatLogSiraga_('BATALKAN_TRANSAKSI', 'TRANSAKSI', idTransaksi, akses.idPetugas, { nomorTransaksi: data[i][idx.NOMOR_TRANSAKSI] });
      return { success: true };
    }
  }
  throw new Error('Transaksi tidak ditemukan.');
}

/** Baca 1 transaksi + detail-nya (utk halaman detail/cetak). */
function getSiragaTransaksi(body) {
  requireSiragaAccess_(body.token);
  const idTransaksi = sanitize(body.idTransaksi);
  const t = getSiragaRows_(SIRAGA_SHEET.TRANSAKSI).find(x => x.ID_TRANSAKSI === idTransaksi);
  if (!t) throw new Error('Transaksi tidak ditemukan.');
  const detail = getSiragaRows_(SIRAGA_SHEET.TRANSAKSI_DETAIL).filter(d => d.ID_TRANSAKSI === idTransaksi);
  return {
    id: t.ID_TRANSAKSI, nomor: t.NOMOR_TRANSAKSI, tanggal: t.TANGGAL, jenis: t.JENIS_TRANSAKSI, status: t.STATUS,
    sumber: t.SUMBER, tujuan: t.TUJUAN, idSupplier: t.ID_SUPPLIER, alasanPemusnahan: t.ALASAN_PEMUSNAHAN,
    namaPetugas: t.NAMA_PETUGAS, keterangan: t.KETERANGAN,
    dibuatPada: t.DIBUAT_PADA, diselesaikanPada: t.DISELESAIKAN_PADA, dibatalkanPada: t.DIBATALKAN_PADA,
    items: detail.map(d => ({ idBarang: d.ID_BARANG, nama: d.NAMA_BARANG, satuan: d.SATUAN, qty: Number(d.QTY), idBatch: d.ID_BATCH, tanggalExpired: d.TANGGAL_EXPIRED }))
  };
}

/** Daftar transaksi dgn filter (§Laporan). */
function getSiragaTransaksiList(body) {
  requireSiragaAccess_(body.token);
  let list = getSiragaRows_(SIRAGA_SHEET.TRANSAKSI);
  if (body.jenis) list = list.filter(t => t.JENIS_TRANSAKSI === body.jenis);
  if (body.status) list = list.filter(t => t.STATUS === body.status);
  if (body.tanggalDari) list = list.filter(t => tanggalSheetKeIso_(t.TANGGAL) >= body.tanggalDari);
  if (body.tanggalSampai) list = list.filter(t => tanggalSheetKeIso_(t.TANGGAL) <= body.tanggalSampai);
  return list
    .sort((a, b) => (b.DIBUAT_PADA instanceof Date ? b.DIBUAT_PADA.getTime() : 0) - (a.DIBUAT_PADA instanceof Date ? a.DIBUAT_PADA.getTime() : 0))
    .slice(0, 300)
    .map(t => ({ id: t.ID_TRANSAKSI, nomor: t.NOMOR_TRANSAKSI, tanggal: t.TANGGAL, jenis: t.JENIS_TRANSAKSI, status: t.STATUS, namaPetugas: t.NAMA_PETUGAS, keterangan: t.KETERANGAN }));
}

// ------------------------------------------------------------
// KARTU STOK (§25) -- diturunkan dari TRANSAKSI+DETAIL, bukan tabel sendiri.
// ------------------------------------------------------------

function getSiragaKartuStok(body) {
  requireSiragaAccess_(body.token);
  const idBarang = sanitize(body.idBarang);
  if (!idBarang) throw new Error('Barang wajib dipilih.');

  const transaksiById = {};
  getSiragaRows_(SIRAGA_SHEET.TRANSAKSI).forEach(t => { transaksiById[t.ID_TRANSAKSI] = t; });

  const baris = getSiragaRows_(SIRAGA_SHEET.TRANSAKSI_DETAIL)
    .filter(d => d.ID_BARANG === idBarang)
    .map(d => ({ detail: d, transaksi: transaksiById[d.ID_TRANSAKSI] }))
    .filter(x => x.transaksi && x.transaksi.STATUS === 'SELESAI')
    .sort((a, b) => tanggalSheetKeIso_(a.transaksi.TANGGAL).localeCompare(tanggalSheetKeIso_(b.transaksi.TANGGAL)) || String(a.detail.ID_DETAIL).localeCompare(String(b.detail.ID_DETAIL)));

  let saldo = 0;
  const kartu = baris.map(x => {
    const jenis = x.transaksi.JENIS_TRANSAKSI;
    const qty = Number(x.detail.QTY) || 0;
    const arah = arahStokSiraga_(jenis);
    const efek = arah === null ? qty : arah * Math.abs(qty);
    saldo += efek;
    return {
      tanggal: x.transaksi.TANGGAL, nomorTransaksi: x.transaksi.NOMOR_TRANSAKSI, jenis: jenis, keterangan: x.transaksi.KETERANGAN,
      masuk: jenis === 'MASUK' ? qty : (jenis === 'PENYESUAIAN' && efek > 0 ? efek : 0),
      keluar: (jenis === 'KELUAR' || jenis === 'TRANSFER') ? qty : (jenis === 'PENYESUAIAN' && efek < 0 ? Math.abs(efek) : 0),
      penyesuaian: jenis === 'PENYESUAIAN' ? efek : 0,
      pemusnahan: jenis === 'PEMUSNAHAN' ? qty : 0,
      saldo: saldo
    };
  });
  return { idBarang: idBarang, kartu: kartu, saldoAkhir: saldo };
}


/**
 * SPPG JEUNGJING â€” SIRAGA v2 â€” SiragaOpname.gs
 * Stock Opname (Â§20/Â§21) -- alur: pilih barang -> snapshot stok sistem ->
 * user input stok fisik -> hitung selisih -> review -> selesaikan ->
 * sistem OTOMATIS buat transaksi PENYESUAIAN (Â§21, user TIDAK pernah
 * membuat transaksi PENYESUAIAN secara langsung -- satu-satunya jalan
 * masuk PENYESUAIAN adalah lewat modul ini).
 */

const SIRAGA_STATUS_OPNAME = ['DRAFT', 'SELESAI', 'DIBATALKAN'];

/**
 * Langkah 1-3 (Â§20): pilih barang -> AMBIL & SIMPAN snapshot stok sistem
 * SAAT INI ke baris opname baru berstatus DRAFT. STOK_FISIK masih kosong
 * (diisi user di langkah berikutnya, terpisah -- supaya snapshot stok
 * sistem TIDAK berubah lagi walau ada transaksi lain masuk di antara
 * opname dimulai & diselesaikan).
 */
function mulaiSiragaOpname(body) {
  const akses = requireSiragaAccess_(body.token, true);
  const idBarang = sanitize(body.idBarang);
  const idBatch = sanitize(body.idBatch); // opsional -- opname bisa per-barang total ATAU per-batch spesifik

  const barang = getSiragaRows_(SIRAGA_SHEET.BARANG).find(b => b.ID_BARANG === idBarang);
  if (!barang) throw new Error('Barang tidak ditemukan.');

  const lock = LockService.getScriptLock(); // P2 -- generateIdSiraga_ baca ID tertinggi lalu +1, juga baca stok sistem saat ini (perlu konsisten dgn transaksi lain)
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const stokSistem = idBatch ? (getSiragaStokSemuaBatch_()[idBatch] || 0) : getSiragaStokBarang_(idBarang);

    const sheet = getSiragaSheet_(SIRAGA_SHEET.STOCK_OPNAME);
    const id = generateIdSiraga_(sheet, 'OPN', 'ID_OPNAME');
    const now = new Date();
    siragaTambahBaris_(SIRAGA_SHEET.STOCK_OPNAME, {
      ID_OPNAME: id, TANGGAL: formatTanggal(now), ID_BARANG: idBarang, NAMA_BARANG: barang.NAMA_BARANG, ID_BATCH: idBatch,
      STOK_SISTEM: stokSistem, STOK_FISIK: '', SELISIH: '', STATUS: 'DRAFT',
      ID_PETUGAS: akses.idPetugas, NAMA_PETUGAS: akses.namaPetugas, KETERANGAN: sanitize(body.keterangan), ID_TRANSAKSI_PENYESUAIAN: '',
      DIBUAT_PADA: now, DISELESAIKAN_PADA: ''
    });
    catatLogSiraga_('STOCK_OPNAME', 'STOCK_OPNAME', id, akses.idPetugas, { idBarang: idBarang, stokSistem: stokSistem });

    return { id: id, idBarang: idBarang, namaBarang: barang.NAMA_BARANG, stokSistem: stokSistem, satuan: barang.SATUAN };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Langkah 4-5 (Â§20): user masukkan stok fisik -> sistem hitung selisih
 * (Â§21: user TIDAK BOLEH mengetik selisih, hanya stok fisik). Opname
 * MASIH DRAFT setelah ini -- baru berpengaruh ke stok saat
 * selesaikanSiragaOpname dipanggil (langkah review -> selesaikan).
 */
function isiStokFisikSiragaOpname(body) {
  requireSiragaAccess_(body.token, true);
  const id = sanitize(body.id);
  const stokFisik = Number(body.stokFisik);
  if (isNaN(stokFisik) || stokFisik < 0) throw new Error('Stok fisik harus angka >= 0.');

  const lock = LockService.getScriptLock(); // P2 -- cek status DRAFT lalu tulis
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSiragaSheet_(SIRAGA_SHEET.STOCK_OPNAME);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_OPNAME]) === id) {
        if (String(data[i][idx.STATUS]) !== 'DRAFT') throw new Error('Opname ini sudah diselesaikan/dibatalkan.');
        const stokSistem = Number(data[i][idx.STOK_SISTEM]) || 0;
        const selisih = stokFisik - stokSistem; // Â§21 -- SELISIH = STOK_FISIK - STOK_SISTEM, dihitung sistem, bukan diketik user
        sheet.getRange(i + 1, idx.STOK_FISIK + 1).setValue(stokFisik);
        sheet.getRange(i + 1, idx.SELISIH + 1).setValue(selisih);
        _invalidasiCacheSiraga_(SIRAGA_SHEET.STOCK_OPNAME);
        return { id: id, stokSistem: stokSistem, stokFisik: stokFisik, selisih: selisih };
      }
    }
    throw new Error('Data opname tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Langkah 6-7 (Â§20/Â§21): SELESAIKAN opname -- INI yang benar-benar
 * mengubah stok, lewat transaksi PENYESUAIAN yang dibuat OTOMATIS.
 * Kalau selisih = 0, TIDAK ada transaksi penyesuaian yang dibuat (Â§21:
 * "100 -> 100 tidak perlu membuat penyesuaian").
 */
function selesaikanSiragaOpname(body) {
  const akses = requireSiragaAccess_(body.token, true);
  const id = sanitize(body.id);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const sheet = getSiragaSheet_(SIRAGA_SHEET.STOCK_OPNAME);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_OPNAME]) === id) {
        if (String(data[i][idx.STATUS]) !== 'DRAFT') throw new Error('Opname ini sudah diselesaikan/dibatalkan.');
        const stokFisikRaw = data[i][idx.STOK_FISIK];
        if (stokFisikRaw === '' || stokFisikRaw === undefined) throw new Error('Stok fisik belum diisi.');

        const idBarang = String(data[i][idx.ID_BARANG]);
        const idBatch = String(data[i][idx.ID_BATCH] || '');
        const selisih = Number(data[i][idx.SELISIH]) || 0;
        const now = new Date();
        let idTransaksiPenyesuaian = '';

        if (selisih !== 0) {
          // Buat transaksi PENYESUAIAN OTOMATIS -- SATU-SATUNYA jalan
          // masuk jenis PENYESUAIAN (tidak lewat buatSiragaTransaksi_
          // langsung, sesuai Â§11/Â§21).
          const sheetTransaksi = getSiragaSheet_(SIRAGA_SHEET.TRANSAKSI);
          idTransaksiPenyesuaian = generateIdSiraga_(sheetTransaksi, 'TRX', 'ID_TRANSAKSI');
          const nomorTransaksi = generateSiragaNomorTransaksi_(sheetTransaksi, 'PENYESUAIAN');
          siragaTambahBaris_(SIRAGA_SHEET.TRANSAKSI, {
            ID_TRANSAKSI: idTransaksiPenyesuaian, NOMOR_TRANSAKSI: nomorTransaksi, TANGGAL: formatTanggal(now), JENIS_TRANSAKSI: 'PENYESUAIAN', STATUS: 'SELESAI',
            ID_PETUGAS: akses.idPetugas, NAMA_PETUGAS: akses.namaPetugas, KETERANGAN: 'Otomatis dari Stock Opname ' + id,
            DIBUAT_PADA: now, DIUBAH_PADA: now, DISELESAIKAN_PADA: now
          });
          const barang = getSiragaRows_(SIRAGA_SHEET.BARANG).find(b => b.ID_BARANG === idBarang);
          const sheetDetail = getSiragaSheet_(SIRAGA_SHEET.TRANSAKSI_DETAIL);
          siragaTambahBaris_(SIRAGA_SHEET.TRANSAKSI_DETAIL, {
            ID_DETAIL: generateIdSiraga_(sheetDetail, 'DTL', 'ID_DETAIL'), ID_TRANSAKSI: idTransaksiPenyesuaian, NOMOR_TRANSAKSI: nomorTransaksi, ID_BARANG: idBarang,
            NAMA_BARANG: barang ? barang.NAMA_BARANG : '', SATUAN: barang ? barang.SATUAN : '', ID_BATCH: idBatch, QTY: selisih
          });
          catatLogSiraga_('PENYESUAIAN', 'TRANSAKSI', idTransaksiPenyesuaian, akses.idPetugas, { dariOpname: id, selisih: selisih });
        }

        sheet.getRange(i + 1, idx.STATUS + 1).setValue('SELESAI');
        sheet.getRange(i + 1, idx.ID_TRANSAKSI_PENYESUAIAN + 1).setValue(idTransaksiPenyesuaian);
        sheet.getRange(i + 1, idx.DISELESAIKAN_PADA + 1).setValue(now);
        _invalidasiCacheSiraga_();
        catatLogSiraga_('SELESAIKAN_OPNAME', 'STOCK_OPNAME', id, akses.idPetugas, { selisih: selisih, idTransaksiPenyesuaian: idTransaksiPenyesuaian });

        return { success: true, selisih: selisih, idTransaksiPenyesuaian: idTransaksiPenyesuaian || null };
      }
    }
    throw new Error('Data opname tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

function batalkanSiragaOpname(body) {
  const akses = requireSiragaAccess_(body.token, true);
  const id = sanitize(body.id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSiragaSheet_(SIRAGA_SHEET.STOCK_OPNAME);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_OPNAME]) === id) {
        if (String(data[i][idx.STATUS]) !== 'DRAFT') throw new Error('Hanya opname berstatus DRAFT yang bisa dibatalkan.');
        sheet.getRange(i + 1, idx.STATUS + 1).setValue('DIBATALKAN');
        _invalidasiCacheSiraga_(SIRAGA_SHEET.STOCK_OPNAME);
        catatLogSiraga_('BATALKAN_OPNAME', 'STOCK_OPNAME', id, akses.idPetugas, {});
        return { success: true };
      }
    }
    throw new Error('Data opname tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

function getSiragaOpnameList(body) {
  requireSiragaAccess_(body.token);
  let list = getSiragaRows_(SIRAGA_SHEET.STOCK_OPNAME);
  if (body.status) list = list.filter(o => o.STATUS === body.status);
  return list
    .sort((a, b) => (b.DIBUAT_PADA instanceof Date ? b.DIBUAT_PADA.getTime() : 0) - (a.DIBUAT_PADA instanceof Date ? a.DIBUAT_PADA.getTime() : 0))
    .map(o => ({
      id: o.ID_OPNAME, tanggal: o.TANGGAL, idBarang: o.ID_BARANG, namaBarang: o.NAMA_BARANG,
      stokSistem: Number(o.STOK_SISTEM) || 0, stokFisik: o.STOK_FISIK, selisih: o.SELISIH,
      status: o.STATUS, namaPetugas: o.NAMA_PETUGAS, keterangan: o.KETERANGAN
    }));
}


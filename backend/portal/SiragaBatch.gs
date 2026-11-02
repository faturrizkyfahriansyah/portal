/**
 * SPPG JEUNGJING — SIRAGA v2 — SiragaBatch.gs
 * Batch (§18) + status kedaluwarsa turunan (§19). Batch DIBUAT otomatis
 * saat MASUK (lihat buatSiragaTransaksi_, SiragaStok.gs) -- file ini
 * berisi fungsi BACA/dropdown-dependent & perhitungan status expired.
 */

/** §19 -- status turunan, TIDAK disimpan. Batas "Akan Kedaluwarsa" dari CONFIG. */
function hitungStatusExpiredSiraga_(tanggalExpiredDMY) {
  if (!tanggalExpiredDMY) return null;
  const [d, m, y] = String(tanggalExpiredDMY).split('/').map(Number);
  const tglExpired = new Date(y, m - 1, d);
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  const selisihHari = Math.floor((tglExpired - hariIni) / (1000 * 60 * 60 * 24));

  if (selisihHari < 0) return 'KEDALUWARSA';
  const batasHari = Number(getSiragaConfig_('BATAS_PERINGATAN_EXPIRED_HARI', 30));
  if (selisihHari <= batasHari) return 'AKAN KEDALUWARSA';
  return 'AMAN';
}

/**
 * §18 -- DEPENDENT DROPDOWN: batch HANYA utk 1 barang tertentu (tidak
 * pernah menampilkan batch barang lain). Hanya batch yang STOKNYA MASIH
 * ADA (>0) yang ditampilkan -- tidak ada gunanya memilih batch yang
 * sudah habis saat mencatat KELUAR/TRANSFER/PEMUSNAHAN.
 */
function getSiragaBatchList(body) {
  requireSiragaAccess_(body.token);
  const idBarang = sanitize(body.idBarang);
  if (!idBarang) throw new Error('Barang wajib dipilih.');

  const stokPerBatch = getSiragaStokSemuaBatch_();
  return getSiragaRows_(SIRAGA_SHEET.BATCH)
    .filter(b => b.ID_BARANG === idBarang && statusAktifSiraga_(b.STATUS))
    .map(b => ({
      id: b.ID_BATCH, nomorBatch: b.NOMOR_BATCH, tanggalProduksi: b.TANGGAL_PRODUKSI, tanggalExpired: b.TANGGAL_EXPIRED,
      statusExpired: hitungStatusExpiredSiraga_(b.TANGGAL_EXPIRED),
      stok: stokPerBatch[b.ID_BATCH] || 0
    }))
    .filter(b => b.stok > 0)
    .sort((a, b) => (a.tanggalExpired || '').localeCompare(b.tanggalExpired || '')); // FEFO -- batch expired terdekat duluan
}

/** Admin -- semua batch termasuk yang stoknya sudah 0, utk halaman "Batch & Kedaluwarsa". */
function getSiragaBatchListAdmin(body) {
  requireSiragaAccess_(body.token);
  const namaBarangMap = {};
  getSiragaRows_(SIRAGA_SHEET.BARANG).forEach(b => { namaBarangMap[b.ID_BARANG] = b.NAMA_BARANG; });
  const stokPerBatch = getSiragaStokSemuaBatch_();

  let list = getSiragaRows_(SIRAGA_SHEET.BATCH);
  if (body.idBarang) list = list.filter(b => b.ID_BARANG === body.idBarang);
  if (body.statusExpired) list = list.filter(b => hitungStatusExpiredSiraga_(b.TANGGAL_EXPIRED) === body.statusExpired);

  return list.map(b => ({
    id: b.ID_BATCH, idBarang: b.ID_BARANG, namaBarang: namaBarangMap[b.ID_BARANG] || '-',
    nomorBatch: b.NOMOR_BATCH, tanggalProduksi: b.TANGGAL_PRODUKSI, tanggalExpired: b.TANGGAL_EXPIRED,
    statusExpired: hitungStatusExpiredSiraga_(b.TANGGAL_EXPIRED), stok: stokPerBatch[b.ID_BATCH] || 0
  })).sort((a, b) => (a.tanggalExpired || '9999').localeCompare(b.tanggalExpired || '9999'));
}

/** Stok per BATCH (bukan per barang total) -- dihitung dari TRANSAKSI_DETAIL yg py ID_BATCH terisi, transaksi SELESAI saja. */
function getSiragaStokSemuaBatch_() {
  const transaksiSelesai = new Set(getSiragaRows_(SIRAGA_SHEET.TRANSAKSI).filter(t => t.STATUS === 'SELESAI').map(t => t.ID_TRANSAKSI));
  const jenisById = {};
  getSiragaRows_(SIRAGA_SHEET.TRANSAKSI).forEach(t => { jenisById[t.ID_TRANSAKSI] = t.JENIS_TRANSAKSI; });

  const stok = {};
  getSiragaRows_(SIRAGA_SHEET.TRANSAKSI_DETAIL).forEach(d => {
    if (!d.ID_BATCH || !transaksiSelesai.has(d.ID_TRANSAKSI)) return;
    const jenis = jenisById[d.ID_TRANSAKSI];
    const arah = arahStokSiraga_(jenis);
    const qty = Number(d.QTY) || 0;
    const efek = arah === null ? qty : arah * Math.abs(qty);
    stok[d.ID_BATCH] = (stok[d.ID_BATCH] || 0) + efek;
  });
  return stok;
}

/** §26 Dashboard -- ringkasan Akan Kedaluwarsa / Kedaluwarsa (dipanggil dari SiragaDashboard.gs). */
function hitungRingkasanExpiredSiraga_() {
  const stokPerBatch = getSiragaStokSemuaBatch_();
  let akanExpired = 0, expired = 0;
  getSiragaRows_(SIRAGA_SHEET.BATCH).forEach(b => {
    if ((stokPerBatch[b.ID_BATCH] || 0) <= 0) return; // batch yg stoknya sudah habis tidak dihitung
    const status = hitungStatusExpiredSiraga_(b.TANGGAL_EXPIRED);
    if (status === 'AKAN KEDALUWARSA') akanExpired++;
    else if (status === 'KEDALUWARSA') expired++;
  });
  return { akanExpired: akanExpired, expired: expired };
}


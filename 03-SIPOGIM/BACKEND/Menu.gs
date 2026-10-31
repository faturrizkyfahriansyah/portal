/**
 * SIPOGIM — Menu.gs
 * Endpoint baca utk layar Menu per Periode & Detail Menu Harian, plus
 * catatSalin (pelacak tombol "Salin ke PoP").
 */

function getPeriodeList(body) {
  const semua = sheetToObjectsSipogim_(getSheetSipogim_('MENU_HARIAN'));
  semua.forEach(m => { m.TANGGAL = normalisasiTanggalSipogim_(m.TANGGAL); }); // lihat catatan di Utils.gs
  const set = {};
  semua.forEach(m => { if (!m.HILANG_DI_SUMBER) set[m.PERIODE] = true; });
  return Object.keys(set).sort((a, b) => {
    // Urutkan berdasarkan tanggal PALING AWAL yg dimiliki tiap periode (bukan abjad).
    const tglA = semua.find(m => m.PERIODE === a);
    const tglB = semua.find(m => m.PERIODE === b);
    return (tglA ? new Date(tglA.TANGGAL.split('/').reverse().join('-')) : 0) -
           (tglB ? new Date(tglB.TANGGAL.split('/').reverse().join('-')) : 0);
  });
}

function getMenuPeriode(body) {
  const periode = sanitizeSipogim_(body.periode);
  if (!periode) throw new Error('Periode wajib diisi.');
  const semua = sheetToObjectsSipogim_(getSheetSipogim_('MENU_HARIAN')).filter(m => m.PERIODE === periode && !m.HILANG_DI_SUMBER);
  semua.forEach(m => { m.TANGGAL = normalisasiTanggalSipogim_(m.TANGGAL); }); // lihat catatan di Utils.gs
  const perTanggal = {};
  semua.forEach(m => {
    if (!perTanggal[m.TANGGAL]) perTanggal[m.TANGGAL] = [];
    perTanggal[m.TANGGAL].push(m);
  });
  return Object.keys(perTanggal)
    .sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')))
    .map(tanggal => ({
      tanggal: tanggal,
      jumlahKomponen: perTanggal[tanggal].length
      // totalBesar/totalKecil/status menyusul di Tahap 3
    }));
}

function getMenuHarian(body) {
  const tanggal = sanitizeSipogim_(body.tanggal);
  if (!tanggal) throw new Error('Tanggal wajib diisi.');
  const semuaMenuHarian = sheetToObjectsSipogim_(getSheetSipogim_('MENU_HARIAN'));
  semuaMenuHarian.forEach(m => { m.TANGGAL = normalisasiTanggalSipogim_(m.TANGGAL); }); // lihat catatan di Utils.gs -- WAJIB sebelum filter, krn filter membandingkan string
  const komponen = semuaMenuHarian.filter(m => m.TANGGAL === tanggal && !m.HILANG_DI_SUMBER);
  const semuaPadanan = sheetToObjectsSipogim_(getSheetSipogim_('PADANAN_NAMA'));

  const daftarKomponen = komponen.map(m => {
    const padanan = semuaPadanan.find(p => p.NAMA_NORM === m.NAMA_NORM);
    const statusPadanan = padanan ? padanan.STATUS : 'belum_ada_resep';
    const item = { kategori: m.KATEGORI, namaMentah: m.NAMA_MENTAH, statusPadanan: statusPadanan, resepId: padanan ? padanan.RESEP_ID : null };
    if (statusPadanan === 'terkonfirmasi' && padanan.RESEP_ID) {
      item.giziBesar = hitungGiziResep_(padanan.RESEP_ID, 'besar');
      item.giziKecil = hitungGiziResep_(padanan.RESEP_ID, 'kecil');
    }
    return item;
  });

  return {
    tanggal: tanggal,
    komponen: daftarKomponen,
    totalHariBesar: hitungGiziHari_(tanggal, 'besar'),
    totalHariKecil: hitungGiziHari_(tanggal, 'kecil'),
    perubahanSejakSalin: {
      besar: cekBerubahSejakDisalin_(tanggal, 'besar'),
      kecil: cekBerubahSejakDisalin_(tanggal, 'kecil')
    }
  };
}

/**
 * Uji terima #11: kalau sudah PERNAH disalin ke PoP (ada baris di
 * LOG_SALIN utk tanggal+porsi ini) DAN angka yg sekarang terhitung
 * BEDA dari yg tercatat saat disalin -- kembalikan selisihnya
 * (angka lama dari log, angka baru hasil hitung sekarang). null kalau
 * belum pernah disalin, atau sudah disalin tapi angkanya masih sama.
 */
function cekBerubahSejakDisalin_(tanggal, porsi) {
  const semuaLogMentah = sheetToObjectsSipogim_(getSheetSipogim_('LOG_SALIN'));
  semuaLogMentah.forEach(l => { l.TANGGAL = normalisasiTanggalSipogim_(l.TANGGAL); }); // lihat catatan di Utils.gs
  const semuaLog = semuaLogMentah
    .filter(l => l.TANGGAL === tanggal && l.PORSI === porsi)
    .sort((a, b) => new Date(b.WAKTU) - new Date(a.WAKTU));
  if (!semuaLog.length) return null;
  const terakhir = semuaLog[0];
  if (terakhir.ENERGI_KKAL === '') return null; // disalin saat "belum lengkap", tidak ada angka lama utk dibandingkan

  const sekarang = hitungGiziHari_(tanggal, porsi);
  if (!sekarang.lengkap) return { berubah: true, alasan: 'Sekarang malah jadi belum lengkap (sebelumnya lengkap saat disalin).', lama: angkaLogSalin_(terakhir) };

  const lama = angkaLogSalin_(terakhir);
  const baru = sekarang.gizi;
  const berubah = ['energiKkal', 'proteinG', 'lemakG', 'karbohidratG', 'seratG'].some(z => Math.abs((lama[z] || 0) - (baru[z] || 0)) > 0.005);
  if (!berubah) return null;
  return { berubah: true, waktuSalin: terakhir.WAKTU, lama: lama, baru: baru };
}
function angkaLogSalin_(l) {
  return { energiKkal: Number(l.ENERGI_KKAL), proteinG: Number(l.PROTEIN_G), lemakG: Number(l.LEMAK_G), karbohidratG: Number(l.KARBOHIDRAT_G), seratG: Number(l.SERAT_G) };
}

/** Catat kejadian "Salin ke PoP" -- dipakai Riwayat/Log_Salin, tidak mengubah data gizi apa pun, murni pencatatan. */
function catatSalin(body) {
  const namaAktor = wajibNamaSaya_(body);
  const tanggal = sanitizeSipogim_(body.tanggal);
  const porsi = sanitizeSipogim_(body.porsi); // 'besar' atau 'kecil'
  if (!tanggal || (porsi !== 'besar' && porsi !== 'kecil')) throw new Error('Tanggal dan jenis porsi wajib diisi.');

  const hasil = hitungGiziHari_(tanggal, porsi);
  const sheet = getSheetSipogim_('LOG_SALIN');
  const id = generateIdSipogim_('LS', sheet);
  const barisBaru = sheet.getLastRow() + 1;
  sheet.appendRow([
    id, sekarangSipogim_(), namaAktor, tanggal, porsi,
    hasil.lengkap ? hasil.gizi.energiKkal : '', hasil.lengkap ? hasil.gizi.proteinG : '',
    hasil.lengkap ? hasil.gizi.lemakG : '', hasil.lengkap ? hasil.gizi.karbohidratG : '', hasil.lengkap ? hasil.gizi.seratG : '',
    hasil.lengkap ? hasil.status : 'tidak_lengkap'
  ]);
  // Kolom TANGGAL (ke-4) dipaksa teks SETELAH ditulis -- lihat catatan
  // lengkap di Utils.gs (normalisasiTanggalSipogim_) & Sinkron.gs.
  paksaKolomTeks_(sheet, barisBaru, 4);
  sheet.getRange(barisBaru, 4).setValue(tanggal);
  return { ok: true };
}


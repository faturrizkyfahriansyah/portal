/**
 * SIPOGIM — Hitung.gs
 * Mesin hitung gizi + penurunan status. Dipakai oleh Resep.gs dan
 * Menu.gs. Aturan PERSIS dari spesifikasi bagian 6 -- rumus, syarat
 * "lengkap", dan status turunan TIDAK disederhanakan, karena ini
 * jantung kebenaran SIPOGIM (nilai kosong tidak boleh dianggap 0).
 */

const URUTAN_STATUS_SIPOGIM = { perlu_dicek: 0, draf: 1, sudah_dicek: 2 };
const ZAT_GIZI_SIPOGIM = ['ENERGI_KKAL', 'PROTEIN_G', 'LEMAK_G', 'KARBOHIDRAT_G', 'SERAT_G'];

/** Status PALING RENDAH di antara daftar status (perlu_dicek < draf < sudah_dicek). */
function statusTerendahSipogim_(daftarStatus) {
  if (!daftarStatus.length) return 'perlu_dicek';
  return daftarStatus.reduce((rendah, s) =>
    (URUTAN_STATUS_SIPOGIM[s] ?? 0) < (URUTAN_STATUS_SIPOGIM[rendah] ?? 0) ? s : rendah
  );
}

/** Bahan lengkap bila KELIMA nilai gizinya terisi (0 yang disengaja dihitung terisi, NULL tidak). */
function apakahBahanLengkapSipogim_(bahan) {
  return ZAT_GIZI_SIPOGIM.every(z => bahan[z] !== null && bahan[z] !== '' && bahan[z] !== undefined);
}

/**
 * Hitung gizi satu resep utk satu jenis porsi ('besar' atau 'kecil').
 * Mengembalikan:
 *  { lengkap:true, gizi:{...5 zat}, status } ATAU
 *  { lengkap:false, penyebab:[teks,...], status }
 * TIDAK PERNAH mengembalikan total sebagian -- kalau ada satu saja
 * penyebab tidak lengkap, gizi = null sepenuhnya (sesuai spesifikasi
 * butir 3: "tidak menampilkan total sebagian").
 */
function hitungGiziResep_(resepId, jenisPorsi) {
  const resep = sheetToObjectsSipogim_(getSheetSipogim_('RESEP')).find(r => r.ID === resepId);
  if (!resep) throw new Error('Resep tidak ditemukan: ' + resepId);

  const kolomGram = jenisPorsi === 'besar' ? 'GRAM_BESAR' : 'GRAM_KECIL';
  const baris = sheetToObjectsSipogim_(getSheetSipogim_('RESEP_BAHAN')).filter(rb => rb.RESEP_ID === resepId);
  const semuaBahan = sheetToObjectsSipogim_(getSheetSipogim_('BAHAN'));

  if (!baris.length) return { lengkap: false, penyebab: ['Resep belum punya bahan sama sekali.'], status: resep.STATUS };

  const penyebab = [];
  const statusTerlibat = [resep.STATUS];
  const totalPerZat = { ENERGI_KKAL: 0, PROTEIN_G: 0, LEMAK_G: 0, KARBOHIDRAT_G: 0, SERAT_G: 0 };

  baris.forEach(rb => {
    const bahan = semuaBahan.find(b => b.ID === rb.BAHAN_ID);
    if (!bahan) { penyebab.push('Baris bahan "' + rb.BAHAN_ID + '" tidak ditemukan di master Bahan.'); return; }

    const gram = angkaAtauNullSipogim_(rb[kolomGram]);
    if (gram === null) { penyebab.push('"' + bahan.NAMA + '": gram porsi ' + jenisPorsi + ' belum diisi.'); return; }

    if (!apakahBahanLengkapSipogim_(bahan)) {
      const kosong = ZAT_GIZI_SIPOGIM.filter(z => bahan[z] === null || bahan[z] === '' || bahan[z] === undefined);
      penyebab.push('"' + bahan.NAMA + '": ' + kosong.map(z => z.replace('_KKAL', '').replace('_G', '')).join(', ') + ' kosong.');
      return;
    }

    statusTerlibat.push(bahan.STATUS);
    const takaran = Number(bahan.TAKARAN_G) || 100;
    ZAT_GIZI_SIPOGIM.forEach(z => { totalPerZat[z] += (gram * Number(bahan[z])) / takaran; });
  });

  const status = statusTerendahSipogim_(statusTerlibat);
  if (penyebab.length) return { lengkap: false, penyebab: penyebab, status: status };

  return {
    lengkap: true,
    gizi: {
      energiKkal: bulatkanSipogim_(totalPerZat.ENERGI_KKAL),
      proteinG: bulatkanSipogim_(totalPerZat.PROTEIN_G),
      lemakG: bulatkanSipogim_(totalPerZat.LEMAK_G),
      karbohidratG: bulatkanSipogim_(totalPerZat.KARBOHIDRAT_G),
      seratG: bulatkanSipogim_(totalPerZat.SERAT_G)
    },
    status: status
  };
}

function bulatkanSipogim_(n) { return Math.round(n * 100) / 100; }

/**
 * Total gizi SATU HARI utk satu jenis porsi -- jumlah semua komponen
 * menu hari itu. Hanya tampil (lengkap:true) kalau SETIAP komponen:
 * punya padanan terkonfirmasi & resepnya lengkap, ATAU komponen itu
 * diabaikan (lihat spesifikasi butir 4-5).
 */
function hitungGiziHari_(tanggal, jenisPorsi) {
  const semuaMenuHarian_ = sheetToObjectsSipogim_(getSheetSipogim_('MENU_HARIAN'));
  semuaMenuHarian_.forEach(m => { m.TANGGAL = normalisasiTanggalSipogim_(m.TANGGAL); }); // lihat catatan di Utils.gs
  const komponen = semuaMenuHarian_.filter(m => m.TANGGAL === tanggal && !m.HILANG_DI_SUMBER);
  const semuaPadanan = sheetToObjectsSipogim_(getSheetSipogim_('PADANAN_NAMA'));

  const penyebab = [];
  const statusTerlibat = [];
  const totalPerZat = { energiKkal: 0, proteinG: 0, lemakG: 0, karbohidratG: 0, seratG: 0 };

  komponen.forEach(k => {
    const padanan = semuaPadanan.find(p => p.NAMA_NORM === k.NAMA_NORM);
    if (!padanan || padanan.STATUS === 'belum_ada_resep') {
      penyebab.push(k.KATEGORI + ' ("' + k.NAMA_MENTAH + '"): belum ada resep.');
      return;
    }
    if (padanan.STATUS === 'diabaikan') return; // tidak dihitung, tidak menghalangi total
    if (padanan.STATUS === 'usulan') {
      penyebab.push(k.KATEGORI + ' ("' + k.NAMA_MENTAH + '"): padanan masih usulan, belum dikonfirmasi.');
      return;
    }

    const hasil = hitungGiziResep_(padanan.RESEP_ID, jenisPorsi);
    if (!hasil.lengkap) {
      penyebab.push(k.KATEGORI + ' ("' + k.NAMA_MENTAH + '"): ' + hasil.penyebab.join(' '));
      return;
    }
    statusTerlibat.push(hasil.status);
    // hasil.gizi dan totalPerZat pakai penamaan kunci yang SAMA (energiKkal, proteinG, dst) -- tidak perlu konversi apa pun.
    Object.keys(totalPerZat).forEach(z => { totalPerZat[z] = bulatkanSipogim_(totalPerZat[z] + hasil.gizi[z]); });
  });

  if (penyebab.length) return { lengkap: false, penyebab: penyebab };
  return { lengkap: true, gizi: totalPerZat, status: statusTerendahSipogim_(statusTerlibat) };
}


/**
 * SIPOGIM — KalkulatorBebas.gs
 * Hitung gizi dari daftar bahan+gram BEBAS (tidak perlu resep
 * tersimpan) -- utk coba-coba cepat. Aturan "lengkap" & rumus SAMA
 * PERSIS dengan hitungGiziResep_ (Hitung.gs), cuma sumber datanya
 * daftar yg dikirim langsung dari body, bukan baca RESEP_BAHAN.
 */
function hitungBebas(body) {
  const daftar = Array.isArray(body.bahan) ? body.bahan : [];
  if (!daftar.length) throw new Error('Tambahkan minimal 1 bahan.');

  const semuaBahan = sheetToObjectsSipogim_(getSheetSipogim_('BAHAN'));
  const penyebab = [];
  const total = { ENERGI_KKAL: 0, PROTEIN_G: 0, LEMAK_G: 0, KARBOHIDRAT_G: 0, SERAT_G: 0 };

  daftar.forEach(item => {
    const bahan = semuaBahan.find(b => b.ID === item.bahanId);
    if (!bahan) { penyebab.push('Bahan tidak ditemukan.'); return; }
    const gram = angkaAtauNullSipogim_(item.gram);
    if (gram === null) { penyebab.push('"' + bahan.NAMA + '": gram belum diisi.'); return; }
    if (!apakahBahanLengkapSipogim_(bahan)) {
      const kosong = ZAT_GIZI_SIPOGIM.filter(z => bahan[z] === null || bahan[z] === '' || bahan[z] === undefined);
      penyebab.push('"' + bahan.NAMA + '": ' + kosong.map(z => z.replace('_KKAL', '').replace('_G', '')).join(', ') + ' kosong.');
      return;
    }
    const takaran = Number(bahan.TAKARAN_G) || 100;
    ZAT_GIZI_SIPOGIM.forEach(z => { total[z] += (gram * Number(bahan[z])) / takaran; });
  });

  if (penyebab.length) return { lengkap: false, penyebab: penyebab };
  return {
    lengkap: true,
    gizi: {
      energiKkal: bulatkanSipogim_(total.ENERGI_KKAL), proteinG: bulatkanSipogim_(total.PROTEIN_G),
      lemakG: bulatkanSipogim_(total.LEMAK_G), karbohidratG: bulatkanSipogim_(total.KARBOHIDRAT_G), seratG: bulatkanSipogim_(total.SERAT_G)
    }
  };
}


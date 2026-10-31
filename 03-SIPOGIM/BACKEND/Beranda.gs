/**
 * SIPOGIM — Beranda.gs
 * Antrian "perlu perhatian". Spesifikasi menyebut 6 jenis butir; 3 di
 * antaranya (bahan bernilai kosong, resep Draf/Perlu dicek, "Berubah
 * sejak disalin") baru bisa dibangun setelah Bahan/Resep/log_salin ada
 * di Tahap 3 -- di sini CUMA yang sudah bisa: menu tanpa resep, usulan
 * padanan menunggu, dan sinkron gagal/sel galat.
 */

function getBeranda(body) {
  const menuHarian = sheetToObjectsSipogim_(getSheetSipogim_('MENU_HARIAN')).filter(m => !m.HILANG_DI_SUMBER);
  menuHarian.forEach(m => { m.TANGGAL = normalisasiTanggalSipogim_(m.TANGGAL); }); // lihat catatan di Utils.gs
  const padanan = sheetToObjectsSipogim_(getSheetSipogim_('PADANAN_NAMA'));
  const hariIni = sekarangSipogim_();
  const batas14Hari = new Date(hariIni.getTime() + 14 * 86400000);

  const parseTgl = (s) => new Date(s.split('/').reverse().join('-'));

  // 1. Menu tanpa resep, tanggal dalam 14 hari ke depan.
  const namaNormTanpaResep = new Set(
    padanan.filter(p => p.STATUS === 'belum_ada_resep').map(p => p.NAMA_NORM)
  );
  const menuTanpaResep = [];
  const sudahDitambah = new Set();
  menuHarian.forEach(m => {
    const tgl = parseTgl(m.TANGGAL);
    if (tgl < hariIni || tgl > batas14Hari) return;
    if (!namaNormTanpaResep.has(m.NAMA_NORM)) return;
    const kunci = m.NAMA_NORM;
    if (sudahDitambah.has(kunci)) return;
    sudahDitambah.add(kunci);
    menuTanpaResep.push({ namaMentah: m.NAMA_MENTAH, namaNorm: m.NAMA_NORM, tanggalContoh: m.TANGGAL });
  });

  // 2. Usulan padanan menunggu konfirmasi.
  const usulanMenunggu = padanan.filter(p => p.STATUS === 'usulan')
    .map(p => ({ namaContoh: p.NAMA_CONTOH, namaNorm: p.NAMA_NORM, resepId: p.RESEP_ID, skor: p.SKOR }));

  // 6. Sinkron gagal / sel galat terbaru.
  const sinkronLog = sheetToObjectsSipogim_(getSheetSipogim_('SINKRON_LOG'));
  const sinkronTerakhir = sinkronLog.sort((a, b) => new Date(b.SELESAI) - new Date(a.SELESAI))[0] || null;
  const sinkronBermasalah = sinkronTerakhir && (sinkronTerakhir.HASIL === 'gagal' || sinkronTerakhir.HASIL === 'sebagian')
    ? { hasil: sinkronTerakhir.HASIL, pesan: sinkronTerakhir.PESAN, selesai: sinkronTerakhir.SELESAI }
    : null;

  return {
    menuTanpaResep: menuTanpaResep,
    usulanMenunggu: usulanMenunggu,
    sinkronBermasalah: sinkronBermasalah,
    sinkronTerakhir: sinkronTerakhir ? { hasil: sinkronTerakhir.HASIL, selesai: sinkronTerakhir.SELESAI } : null,
    // Poin 3 (bahan kosong), 4 (resep draf/perlu dicek), 5 (berubah sejak disalin) menyusul Tahap 3.
  };
}


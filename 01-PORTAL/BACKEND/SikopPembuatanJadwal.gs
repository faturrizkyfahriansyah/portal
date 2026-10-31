function kalenderRelevanUntukJadwal_(idPeriode) {
  const semua = getKalenderRows_();
  const idPeriodeAktif = new Set(getPeriodeRows_().filter(p => String(p.STATUS).toUpperCase() === 'AKTIF').map(p => p.ID_PERIODE));
  const hanyaPeriodeAktif = semua.filter(k => idPeriodeAktif.has(k.ID_PERIODE));
  if (idPeriode) return hanyaPeriodeAktif.filter(k => k.ID_PERIODE === idPeriode);
  const BATAS_HARI_KE_DEPAN = 60;
  const hariIniIso = Utilities.formatDate(new Date(), ZONA_WAKTU, 'yyyy-MM-dd');
  const batasAkhirIso = Utilities.formatDate(new Date(Date.now() + BATAS_HARI_KE_DEPAN * 86400000), ZONA_WAKTU, 'yyyy-MM-dd');
  return hanyaPeriodeAktif.filter(k => {
    const iso = tanggalSheetKeIso_(k.TANGGAL_OPERASIONAL);
    return iso && iso >= hariIniIso && iso <= batasAkhirIso;
  });
}

function semuaDivisiUntukJadwal_() {
  return getDivisiList();
}

/**
 * SEMENTARA (darurat, 24 Okt 2026) -- LANGKAH TERAKHIR: generate bersih
 * utk periode PRD005 (sheet sudah dibersihkan di langkah sebelumnya).
 */
function pratinjauPembuatanJadwal(body) {
  const TOKEN_ADMIN_DARURAT = 'd9ffbadf-a494-46ca-8b68-aa3dae14a707';
  const idPeriode = 'PRD005';
  const akses = requireAuth(TOKEN_ADMIN_DARURAT);

  const kalender = getKalenderRows_().filter(k => k.ID_PERIODE === idPeriode);
  let totalDibuat = 0;
  kalender.forEach(k => {
    const hasil = buatRosterUntukOperasional_(k.ID_OPERASIONAL, akses);
    if (hasil && typeof hasil.dibuat === 'number') totalDibuat += hasil.dibuat;
  });

  Logger.log('SELESAI GENERATE: ' + totalDibuat + ' baris baru dibuat untuk ' + kalender.length + ' tanggal operasional.');
  return { dibuat: totalDibuat, totalTanggal: kalender.length };
}

function bentukJadwal(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'JADWAL_PENUGASAN', 'CREATE');
  const idPeriode = sanitize(body.idPeriode);
  const daftarDivisi = (Array.isArray(body.daftarDivisi) && body.daftarDivisi.length)
    ? body.daftarDivisi.map(d => sanitize(d)).filter(Boolean)
    : semuaDivisiUntukJadwal_();

  const kalenderRelevan = kalenderRelevanUntukJadwal_(idPeriode);
  if (!kalenderRelevan.length) throw new Error('Tidak ada tanggal operasional yang bisa diproses.');

  const kunciTerproteksi = new Set();
  const periodeUnik = Array.from(new Set(kalenderRelevan.map(k => k.ID_PERIODE)));
  periodeUnik.forEach(idP => {
    daftarDivisi.forEach(namaDivisi => {
      if (getStatusPenetapanDivisi_(idP, namaDivisi).STATUS === 'DITETAPKAN') kunciTerproteksi.add(idP + '|' + namaDivisi);
    });
  });

  let totalDibuat = 0, totalSudahAda = 0, totalDilewatiResmi = 0;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Sistem sedang sibuk. Coba lagi beberapa detik.');
  try {
    kalenderRelevan.forEach(k => {
      const divisiTidakDiproteksi = daftarDivisi.filter(d => !kunciTerproteksi.has(k.ID_PERIODE + '|' + d));
      if (!divisiTidakDiproteksi.length) { totalDilewatiResmi++; return; }
      const hasil = buatRosterUntukOperasional_(k.ID_OPERASIONAL, akses);
      if (hasil && typeof hasil.dibuat === 'number') { totalDibuat += hasil.dibuat; totalSudahAda += (hasil.sudahAdaSebelumnya || 0); }
    });
  } finally {
    lock.releaseLock();
  }
  logAudit_('BENTUK_JADWAL', 'JADWAL_PENUGASAN', (idPeriode || 'SEMUA_PERIODE') + '/' + daftarDivisi.join(','), akses, { daftarDivisi, totalDibuat, totalSudahAda, totalDilewatiResmi });
  return { success: true, totalDibuat, totalSudahAda, totalDilewatiResmi };
}

function bentukUlangJadwal(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'JADWAL_PENUGASAN', 'EDIT');
  const idPeriode = sanitize(body.idPeriode);
  const daftarDivisi = (Array.isArray(body.daftarDivisi) && body.daftarDivisi.length)
    ? body.daftarDivisi.map(d => sanitize(d)).filter(Boolean)
    : semuaDivisiUntukJadwal_();

  const kalenderRelevan = kalenderRelevanUntukJadwal_(idPeriode);
  if (!kalenderRelevan.length) throw new Error('Tidak ada tanggal operasional yang bisa diproses.');

  const kunciTerproteksi = new Set();
  const periodeUnik = Array.from(new Set(kalenderRelevan.map(k => k.ID_PERIODE)));
  periodeUnik.forEach(idP => {
    daftarDivisi.forEach(namaDivisi => {
      if (getStatusPenetapanDivisi_(idP, namaDivisi).STATUS === 'DITETAPKAN') kunciTerproteksi.add(idP + '|' + namaDivisi);
    });
  });

  const idOperasionalRelevan = new Map();
  kalenderRelevan.forEach(k => idOperasionalRelevan.set(k.ID_OPERASIONAL, k.ID_PERIODE));

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Sistem sedang sibuk. Coba lagi beberapa detik.');
  try {
    const sheet = getRosterSheetV2_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idx = {}; headers.forEach((h, i) => { idx[h] = i; });

    let totalDihapus = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      const idOp = data[i][idx.ID_OPERASIONAL];
      const divisi = data[i][idx.DIVISI];
      const idPeriodeBaris = idOperasionalRelevan.get(idOp);
      if (!idPeriodeBaris || daftarDivisi.indexOf(divisi) === -1) continue;
      if (kunciTerproteksi.has(idPeriodeBaris + '|' + divisi)) continue;
      const statusMasuk = String(data[i][idx.STATUS_MASUK] || 'BELUM');
      const statusKehadiran = String(data[i][idx.STATUS_KEHADIRAN] || 'BELUM ABSEN');
      if (statusMasuk !== 'BELUM' || statusKehadiran !== 'BELUM ABSEN') continue;
      sheet.deleteRow(i + 1);
      totalDihapus++;
    }
    _invalidasiCacheRosterV2_();

    let totalDibuat = 0;
    kalenderRelevan.forEach(k => {
      const divisiTidakDiproteksi = daftarDivisi.filter(d => !kunciTerproteksi.has(k.ID_PERIODE + '|' + d));
      if (!divisiTidakDiproteksi.length) return;
      const hasil = buatRosterUntukOperasional_(k.ID_OPERASIONAL, akses);
      if (hasil && typeof hasil.dibuat === 'number') totalDibuat += hasil.dibuat;
    });

    logAudit_('BENTUK_ULANG_JADWAL', 'JADWAL_PENUGASAN', (idPeriode || 'SEMUA_PERIODE') + '/' + daftarDivisi.join(','), akses, { daftarDivisi, totalDihapus, totalDibuat });
    return { success: true, totalDihapus, totalDibuat };
  } finally {
    lock.releaseLock();
  }
}


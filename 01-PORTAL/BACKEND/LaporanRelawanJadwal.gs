/**
 * LaporanRelawanJadwal.gs — Laporan Relawan & Laporan Jadwal/Penugasan
 * (P3C, Prompt Implementasi Gabungan). Dibangun SETELAH memastikan tidak
 * tumpang tindih dgn fitur yg sudah ada (lihat laporan akhir): Laporan
 * Jadwal di sini adalah RINGKASAN SEMUA RELAWAN dalam 1 tabel per
 * periode -- Pemeriksaan Jadwal Individu tetap satu-satunya tempat utk
 * detail HARIAN per satu relawan. Keduanya saling melengkapi, bukan
 * duplikat.
 */

/** Laporan Relawan -- rekap jumlah per divisi & status, plus daftar lengkap. */
function getLaporanRelawan(body) {
  const aktor = requireAuth(body.token, true);
  requireIzinModulBaru_(aktor, 'LAPORAN', 'VIEW');
  const semua = getRelawanList(null, true); // semua=true -> termasuk nonaktif, utk laporan butuh gambaran lengkap

  const perDivisi = {};
  semua.forEach(r => {
    const div = r.divisi || '(Tanpa Divisi)';
    if (!perDivisi[div]) perDivisi[div] = { divisi: div, aktif: 0, nonaktif: 0 };
    if (String(r.status).toUpperCase() === 'AKTIF') perDivisi[div].aktif++;
    else perDivisi[div].nonaktif++;
  });

  const ringkasanDivisi = Object.values(perDivisi).sort((a, b) => a.divisi.localeCompare(b.divisi));
  const totalAktif = semua.filter(r => String(r.status).toUpperCase() === 'AKTIF').length;

  return {
    totalRelawan: semua.length,
    totalAktif: totalAktif,
    totalNonaktif: semua.length - totalAktif,
    ringkasanDivisi: ringkasanDivisi,
    daftar: semua.map(r => ({ id: r.id, nama: r.nama, divisi: r.divisi, status: r.status })) // nomorRekening SENGAJA tidak ikut di laporan ini (lihat P1 -- bukan kebutuhan laporan ini)
  };
}

/**
 * Laporan Jadwal & Penugasan -- SEMUA relawan dalam 1 periode, 1 tabel
 * (Target vs Terjadwal vs Status). Melengkapi Pemeriksaan Jadwal
 * Individu (yg cuma 1 relawan per layar, tapi detail harian lengkap).
 *
 * CATATAN PENTING UTK PEMELIHARAAN: logika "apakah tanggal ini target
 * kerja relawan X" di bawah SENGAJA meniru persis logika yg sama di
 * getJadwalIndividuRelawan (JadwalIndividu.gs) -- BUKAN dipanggil
 * langsung dari sana, supaya fungsi yg sudah teruji itu tidak perlu
 * diubah/di-refactor (risiko regresi) hanya demi laporan baru ini. Kalau
 * logika eligibilitas (resolveShiftUntukRelawan_ / DIVISI_KHUSUS) nanti
 * diubah, KEDUA tempat ini perlu disinkronkan manual.
 */
function getLaporanJadwalPenugasan(body) {
  const aktor = requireAuth(body.token, true);
  requireIzinModulBaru_(aktor, 'LAPORAN', 'VIEW');
  const idPeriode = sanitize(body.idPeriode);
  const divisiFilter = sanitize(body.divisi);
  if (!idPeriode) throw new Error('Periode wajib dipilih.');

  const kalenderPeriode = getKalenderRows_().filter(k => k.ID_PERIODE === idPeriode)
    .sort((a, b) => dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL)));
  if (!kalenderPeriode.length) throw new Error('Periode ini belum punya Kalender Operasional.');
  const idOperasionalDalamPeriode = new Set(kalenderPeriode.map(k => k.ID_OPERASIONAL));

  const semuaRelawan = getRelawanList(divisiFilter || null, false); // hanya AKTIF -- relawan nonaktif tidak relevan utk penjadwalan
  const rosterByRelawan = {};
  getRosterV2Rows_()
    .filter(r => r.ID_ABSENSI && idOperasionalDalamPeriode.has(r.ID_OPERASIONAL))
    .forEach(r => {
      if (!rosterByRelawan[r.ID_RELAWAN]) rosterByRelawan[r.ID_RELAWAN] = {};
      rosterByRelawan[r.ID_RELAWAN][r.ID_OPERASIONAL] = true;
    });

  const data = semuaRelawan.map(r => {
    let target = 0, terjadwal = 0;
    const rosterRelawanIni = rosterByRelawan[r.id] || {};
    kalenderPeriode.forEach(k => {
      const shiftSeharusnya = resolveShiftUntukRelawan_(r.id, k.ID_OPERASIONAL);
      let eligible = !!(shiftSeharusnya && shiftSeharusnya.jamMasuk);
      if (eligible && k.DIVISI_KHUSUS) {
        const daftarDivisiKhusus = String(k.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean);
        if (daftarDivisiKhusus.length && daftarDivisiKhusus.indexOf(r.divisi) === -1) eligible = false;
      }
      if (eligible) target++;
      if (rosterRelawanIni[k.ID_OPERASIONAL]) terjadwal++;
    });
    let status;
    if (terjadwal === target) status = 'sesuai';
    else if (terjadwal < target) status = 'kurang';
    else status = 'berlebih';
    return { id: r.id, nama: r.nama, divisi: r.divisi, target: target, terjadwal: terjadwal, status: status };
  });

  return { idPeriode: idPeriode, jumlahRelawan: data.length, data: data };
}


/**
 * SPPG JEUNGJING — ROSTER-FIRST ATTENDANCE (SIPRES FINAL REFACTOR)
 * RekapV2.gs — rekap yang membaca LANGSUNG dari 03_DATA_ABSENSI_V2
 * (sumber tunggal, §U/§AT: "tidak boleh menghasilkan angka berbeda").
 * TIDAK menyentuh getRekapHarian/getRekapDuaMinggu/getRekapBulanan lama
 * (Absensi.gs) -- itu tetap membaca 03_DATA_ABSENSI lama seperti biasa.
 */

/** §U -- rekap harian per TANGGAL_OPERASIONAL, dibaca langsung (bukan disimpan ulang ke sheet terpisah -- read-model on demand, sesuai saran instruksi "jika lebih baik jadi read-model yang diregenerasi, lakukan demikian"). */
function getRekapHarianV2(tanggalOperasional, token) {
  requireAuth(token, true);
  const tanggal = sanitize(tanggalOperasional) || formatTanggal(new Date());
  const baris = getRosterV2Rows_().filter(r => r.TANGGAL_OPERASIONAL === tanggal);

  return {
    tanggalOperasional: tanggal,
    totalRoster: baris.length,
    belumAbsen: baris.filter(r => r.STATUS_KEHADIRAN === 'BELUM ABSEN').length,
    hadir: baris.filter(r => r.STATUS_KEHADIRAN === 'HADIR' || r.STATUS_KEHADIRAN === 'HADIR LENGKAP').length,
    terlambat: baris.filter(r => r.STATUS_KEHADIRAN === 'TERLAMBAT').length,
    izin: baris.filter(r => r.STATUS_KEHADIRAN === 'IZIN').length,
    sakit: baris.filter(r => r.STATUS_KEHADIRAN === 'SAKIT').length,
    cuti: baris.filter(r => r.STATUS_KEHADIRAN === 'CUTI').length,
    detail: baris
      .sort((a, b) => (a.DIVISI || '').localeCompare(b.DIVISI || '') || (a.JAM_JADWAL_MASUK || '').localeCompare(b.JAM_JADWAL_MASUK || '') || a.ID_RELAWAN.localeCompare(b.ID_RELAWAN))
      .map(r => ({
        idAbsensi: r.ID_ABSENSI, idRelawan: r.ID_RELAWAN, namaRelawan: r.NAMA_RELAWAN, divisi: r.DIVISI,
        namaShift: r.NAMA_SHIFT, jamJadwalMasuk: r.JAM_JADWAL_MASUK, jamJadwalPulang: r.JAM_JADWAL_PULANG,
        jamMasuk: r.JAM_MASUK || null, jamPulang: r.JAM_PULANG || null,
        statusKehadiran: r.STATUS_KEHADIRAN, keterlambatanMenit: Number(r.KETERLAMBATAN_MENIT) || 0
      }))
  };
}

/** §AR -- riwayat relawan berbasis ID_PERIODE/ID_OPERASIONAL/TANGGAL_OPERASIONAL, bukan sekadar timestamp. */
function getRiwayatAbsensiRelawanV2(token) {
  const idRelawan = requireAuthRelawan(token);
  const baris = getRosterV2Rows_().filter(r => r.ID_RELAWAN === idRelawan);
  return baris
    .sort((a, b) => dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL)))
    .map(r => ({
      idAbsensi: r.ID_ABSENSI, idPeriode: r.ID_PERIODE, idOperasional: r.ID_OPERASIONAL,
      tanggalOperasional: r.TANGGAL_OPERASIONAL, hariOperasional: r.HARI_OPERASIONAL,
      namaShift: r.NAMA_SHIFT, jamJadwalMasuk: r.JAM_JADWAL_MASUK, jamJadwalPulang: r.JAM_JADWAL_PULANG,
      jamMasuk: r.JAM_MASUK || null, jamPulang: r.JAM_PULANG || null,
      statusKehadiran: r.STATUS_KEHADIRAN, keterlambatanMenit: Number(r.KETERLAMBATAN_MENIT) || 0,
      keterangan: r.KETERANGAN || ''
    }));
}

/**
 * §W -- rekap 2 minggu berbasis ID_PERIODE, sumber TUNGGAL
 * 03_DATA_ABSENSI_V2 (§AT: konsisten dgn data utama karena memang
 * dihitung langsung dari situ, bukan perhitungan independen).
 * TOTAL_JADWAL = jumlah baris roster relawan itu pada periode ini
 * (brp kali dia ditugaskan) -- BEDA dari sistem lama yang menghitung
 * "hari kerja" dari histori absensi siapa pun; di sini langsung dari
 * roster (siapa yang MEMANG ditugaskan), lebih akurat sesuai §I.
 */
function getRekapDuaMingguV2(idPeriode, token) {
  requireAuth(token, true);
  if (!idPeriode) throw new Error('ID_PERIODE wajib diisi.');

  const periode = getPeriodeById_(idPeriode);
  if (!periode) throw new Error('Periode tidak ditemukan.');

  const baris = getRosterV2Rows_().filter(r => r.ID_PERIODE === idPeriode);
  const perRelawan = {};
  baris.forEach(r => {
    if (!perRelawan[r.ID_RELAWAN]) {
      perRelawan[r.ID_RELAWAN] = {
        idRelawan: r.ID_RELAWAN, namaRelawan: r.NAMA_RELAWAN, divisi: r.DIVISI,
        totalJadwal: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, tidakHadir: 0, totalMenitTerlambat: 0
      };
    }
    const p = perRelawan[r.ID_RELAWAN];
    p.totalJadwal++;
    const st = r.STATUS_KEHADIRAN;
    if (st === 'HADIR' || st === 'HADIR LENGKAP') p.hadir++;
    else if (st === 'TERLAMBAT') { p.terlambat++; p.totalMenitTerlambat += Number(r.KETERLAMBATAN_MENIT) || 0; }
    else if (st === 'IZIN') p.izin++;
    else if (st === 'SAKIT') p.sakit++;
    else if (st === 'CUTI') p.cuti++;
    else if (st === 'BELUM ABSEN') p.tidakHadir++; // roster ada, tapi tidak direalisasikan sama sekali
  });

  return {
    idPeriode: idPeriode,
    namaPeriode: periode.nama,
    tanggalMulai: periode.tanggalMulai,
    tanggalSelesai: periode.tanggalSelesai,
    data: Object.values(perRelawan).sort((a, b) => a.divisi.localeCompare(b.divisi) || a.namaRelawan.localeCompare(b.namaRelawan))
  };
}


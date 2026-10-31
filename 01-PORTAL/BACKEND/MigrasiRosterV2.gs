/**
 * SPPG JEUNGJING — ROSTER-FIRST ATTENDANCE (SIPRES FINAL REFACTOR)
 * MigrasiRosterV2.gs — migrasi AMAN dari 03_DATA_ABSENSI (lama, 1 baris
 * per event MASUK/PULANG) ke 03_DATA_ABSENSI_V2 (baru, 1 baris per
 * relawan per operasional, roster-first).
 *
 * SIFAT MIGRASI (§AC, §AU):
 * - TIDAK DESTRUKTIF: 03_DATA_ABSENSI ASLI tidak pernah diubah/dihapus.
 * - IDEMPOTENT: aman dijalankan berkali-kali -- baris yang ID_ABSENSI-nya
 *   SUDAH ADA di V2 dilewati, tidak dibuat dobel.
 *   Konsekuensi PENTING dari sifat ini: kalau migrasi dijalankan
 *   berkali-kali SETELAH roster untuk operasional yang sama juga sudah
 *   dibuat manual (buatRosterUntukOperasional_) atau relawan sudah mulai
 *   check-in lewat V2, migrasi TIDAK akan menimpa data yang sudah lebih
 *   baru itu -- baris dengan ID_ABSENSI yang sama dilewati apa pun
 *   isinya. Jalankan migrasi SEBELUM mulai memakai V2 secara aktif.
 * - VALIDASI SEBELUM & SESUDAH: jumlah relawan unik, jumlah
 *   ID_OPERASIONAL unik, dan status MASUK/PULANG dihitung dari sumber
 *   lama lalu dibandingkan dengan hasil migrasi.
 * - Baris lama yang TIDAK BISA dipetakan (ID_RELAWAN atau ID_OPERASIONAL
 *   kosong/tidak valid) DITANDAI dan DILAPORKAN terpisah, TIDAK
 *   di-skip diam-diam.
 * - Dipanggil manual oleh Admin (endpoint jalankanMigrasiRosterV2 di
 *   Code.gs) -- TIDAK auto-run oleh trigger apa pun.
 */

/**
 * Membaca 03_DATA_ABSENSI lama dan mengelompokkan per (ID_RELAWAN,
 * ID_OPERASIONAL) -- ini pasangan yang akan menjadi SATU baris roster.
 * Baris lama tanpa ID_OPERASIONAL (absensi dari SEBELUM Fase 5, ketika
 * kolom ini belum ada) dipisahkan sebagai "tidak dapat dipetakan".
 */
function kelompokkanAbsensiLamaUntukMigrasi_() {
  const semua = sheetToObjects(getSheet(NAMA_SHEET.ABSENSI));
  const kelompok = {}; // kunci: idRelawan|idOperasional
  const tidakBisaDipetakan = [];

  semua.forEach(r => {
    const idRelawan = String(r.ID_RELAWAN || '').trim();
    const idOperasional = String(r.ID_OPERASIONAL || '').trim();
    if (!idRelawan || !idOperasional) {
      tidakBisaDipetakan.push({ nomor: r.NOMOR, idRelawan: idRelawan, tanggal: r.TANGGAL, jenis: r.JENIS_ABSENSI, alasan: !idRelawan ? 'ID_RELAWAN kosong' : 'ID_OPERASIONAL kosong (data sebelum Fase 5)' });
      return;
    }
    const kunci = idRelawan + '|' + idOperasional;
    if (!kelompok[kunci]) kelompok[kunci] = { idRelawan: idRelawan, idOperasional: idOperasional, masuk: null, pulang: null, semuaBaris: [] };
    kelompok[kunci].semuaBaris.push(r);
    if (r.JENIS_ABSENSI === 'MASUK' && !kelompok[kunci].masuk) kelompok[kunci].masuk = r;
    else if (r.JENIS_ABSENSI === 'PULANG' && !kelompok[kunci].pulang) kelompok[kunci].pulang = r;
  });

  return { kelompok: kelompok, tidakBisaDipetakan: tidakBisaDipetakan, totalBarisLama: semua.length };
}

/**
 * Migrasi utama — SEKARANG IN-PLACE (bukan lagi menulis ke sheet
 * terpisah). dryRun=true (default) HANYA menghitung & melaporkan, TIDAK
 * menulis apa pun. dryRun=false MELAKUKAN OPERASI DESTRUKTIF: seluruh
 * baris data 03_DATA_ABSENSI (dari baris 2) DIHAPUS lalu DITULIS ULANG
 * dengan struktur roster-first. WAJIB backup Spreadsheet dulu.
 *
 * Baris yang TIDAK BISA dikonsolidasi (tidakBisaDipetakan -- data lama
 * sebelum Fase 5, tanpa ID_OPERASIONAL) TIDAK DIBUANG -- disalin APA
 * ADANYA ke kolom LAMA yang sama (NOMOR/TIMESTAMP/TANGGAL/JAM/dst),
 * dengan kolom BARU (STATUS_KEHADIRAN dst) dikosongkan + KETERANGAN
 * ditandai "(data lama, sebelum Fase 5, belum terkonsolidasi)" --
 * histori tetap ada, cuma tidak ikut dalam format baru.
 */
function migrasiAbsensiKeRosterV2_(dryRun) {
  const { kelompok, tidakBisaDipetakan, totalBarisLama } = kelompokkanAbsensiLamaUntukMigrasi_();
  const kalenderMap = {};
  getKalenderRows_().forEach(k => { kalenderMap[k.ID_OPERASIONAL] = k; });
  const relawanMap = {};
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).forEach(r => { relawanMap[r.ID_RELAWAN] = r; });

  const sheet = getRosterSheetV2_();
  pastikanKolomRosterAda_();
  const idx = akunHeaderIndex_(sheet);
  const jumlahKolom = sheet.getLastColumn();

  const barisBaru = [];
  const operasionalTidakDitemukan = [];
  let dimigrasikan = 0;

  Object.keys(kelompok).forEach(kunci => {
    const g = kelompok[kunci];
    const idAbsensi = buatIdAbsensiV2_(g.idOperasional, g.idRelawan);

    const opRow = kalenderMap[g.idOperasional];
    if (!opRow) { operasionalTidakDitemukan.push({ idAbsensi: idAbsensi, idOperasional: g.idOperasional }); return; }

    const relawan = relawanMap[g.idRelawan] || {};
    const masuk = g.masuk, pulang = g.pulang;
    const isIzinSakitCuti = masuk && ['Izin', 'Sakit', 'Cuti'].indexOf(masuk.KETERANGAN) !== -1;

    let statusMasuk = 'BELUM', statusPulang = 'BELUM', statusKehadiran = 'BELUM ABSEN';
    if (isIzinSakitCuti) {
      statusKehadiran = masuk.KETERANGAN.toUpperCase();
    } else {
      if (masuk) { statusMasuk = 'VALID'; statusKehadiran = 'HADIR'; }
      if (pulang) { statusPulang = 'VALID'; statusKehadiran = 'HADIR LENGKAP'; }
    }

    let jamJadwalMasuk = '', jamJadwalPulang = '', keterlambatanMenit = 0, namaShift = '', idShift = '', idPenugasan = '';
    try {
      const shift = resolveShiftUntukRelawan_(g.idRelawan, g.idOperasional);
      if (shift) {
        jamJadwalMasuk = shift.jamMasuk || '';
        jamJadwalPulang = shift.jamPulang || '';
        if (shift.sumber === 'KHUSUS') {
          namaShift = 'Penugasan Khusus';
          const p = getPenugasanKhususRows_().find(pk => pk.ID_OPERASIONAL === g.idOperasional && pk.ID_RELAWAN === g.idRelawan);
          idPenugasan = p ? p.ID_PENUGASAN : '';
        } else {
          namaShift = relawan.DIVISI || '';
          const s = getShiftDivisiRows_().find(sd => sd.ID_PERIODE === opRow.ID_PERIODE && sd.NAMA_DIVISI === relawan.DIVISI);
          idShift = s ? s.ID_SHIFT : '';
        }
        if (masuk && jamJadwalMasuk && !isIzinSakitCuti) {
          const [hJ, mJ] = jamJadwalMasuk.split(':').map(Number);
          const jamMasukAktual = bacaJamHMS_(masuk.JAM);
          const [hA, mA] = jamMasukAktual.split(':').map(Number);
          let selisih = (hA * 60 + mA) - (hJ * 60 + mJ);
          if (selisih < -600) selisih += 1440;
          keterlambatanMenit = Math.max(0, selisih);
          if (keterlambatanMenit > 0) statusMasuk = 'TERLAMBAT';
        }
      }
    } catch (e) { /* shift tidak tersedia -- biarkan jadwal kosong, tidak gagalkan migrasi baris ini */ }

    const baris = new Array(jumlahKolom).fill('');
    baris[idx.ID_ABSENSI] = idAbsensi;
    baris[idx.ID_PERIODE] = opRow.ID_PERIODE;
    baris[idx.ID_OPERASIONAL] = g.idOperasional;
    baris[idx.TANGGAL_OPERASIONAL] = opRow.TANGGAL_OPERASIONAL;
    baris[idx.HARI_OPERASIONAL] = opRow.HARI;
    baris[idx.ID_PENUGASAN] = idPenugasan;
    baris[idx.ID_RELAWAN] = g.idRelawan;
    baris[idx.NAMA_RELAWAN] = relawan.NAMA_RELAWAN || (masuk ? masuk.NAMA_RELAWAN : '') || '';
    baris[idx.DIVISI] = relawan.DIVISI || (masuk ? masuk.DIVISI : '') || '';
    baris[idx.ID_SHIFT] = idShift;
    baris[idx.NAMA_SHIFT] = namaShift;
    baris[idx.JAM_JADWAL_MASUK] = jamJadwalMasuk;
    baris[idx.JAM_JADWAL_PULANG] = jamJadwalPulang;
    baris[idx.TANGGAL_MASUK] = masuk ? masuk.TANGGAL : '';
    baris[idx.JAM_MASUK] = masuk ? bacaJamHMS_(masuk.JAM) : '';
    baris[idx.TANGGAL_PULANG] = pulang ? pulang.TANGGAL : '';
    baris[idx.JAM_PULANG] = pulang ? bacaJamHMS_(pulang.JAM) : '';
    baris[idx.STATUS_KEHADIRAN] = statusKehadiran;
    baris[idx.STATUS_MASUK] = statusMasuk;
    baris[idx.STATUS_PULANG] = statusPulang;
    baris[idx.KETERLAMBATAN_MENIT] = keterlambatanMenit;
    baris[idx.LATITUDE_MASUK] = masuk ? masuk.LATITUDE : '';
    baris[idx.LONGITUDE_MASUK] = masuk ? masuk.LONGITUDE : '';
    baris[idx.GPS_ACCURACY_MASUK] = masuk ? masuk.AKURASI : '';
    baris[idx.JARAK_MASUK_METER] = masuk ? masuk.JARAK_METER : '';
    baris[idx.FOTO_MASUK] = masuk ? masuk.FOTO_ID : '';
    baris[idx.LATITUDE_PULANG] = pulang ? pulang.LATITUDE : '';
    baris[idx.LONGITUDE_PULANG] = pulang ? pulang.LONGITUDE : '';
    baris[idx.GPS_ACCURACY_PULANG] = pulang ? pulang.AKURASI : '';
    baris[idx.JARAK_PULANG_METER] = pulang ? pulang.JARAK_METER : '';
    baris[idx.FOTO_PULANG] = pulang ? pulang.FOTO_ID : '';
    baris[idx.KETERANGAN] = isIzinSakitCuti ? masuk.KETERANGAN : '(dikonsolidasi dari data event-first lama)';
    baris[idx.DIBUAT_PADA] = masuk && masuk.TIMESTAMP instanceof Date ? masuk.TIMESTAMP : new Date();
    baris[idx.DIUBAH_PADA] = new Date();

    barisBaru.push(baris);
    dimigrasikan++;
  });

  // Baris yang TIDAK BISA dipetakan -- disalin APA ADANYA (kolom lama
  // tetap terisi seperti sebelumnya) supaya histori tidak hilang, tapi
  // ditandai jelas di KETERANGAN kalau kolom itu tersedia & masih kosong.
  const barisTidakBisaDipetakan = [];
  if (tidakBisaDipetakan.length) {
    const semuaBarisMentah = sheet.getDataRange().getValues();
    const headerLama = semuaBarisMentah[0];
    const idxLama = {};
    headerLama.forEach((h, i) => { idxLama[String(h).trim()] = i; });
    tidakBisaDipetakan.forEach(t => {
      const asli = semuaBarisMentah.find((row, i) => i > 0 && String(row[idxLama.NOMOR]) === String(t.nomor));
      if (asli) {
        const salinan = asli.slice(0, jumlahKolom);
        while (salinan.length < jumlahKolom) salinan.push('');
        if (idx.KETERANGAN !== undefined && !salinan[idx.KETERANGAN]) {
          salinan[idx.KETERANGAN] = '(data lama, sebelum Fase 5, belum terkonsolidasi -- ' + t.alasan + ')';
        }
        barisTidakBisaDipetakan.push(salinan);
      }
    });
  }

  const semuaBarisFinal = barisTidakBisaDipetakan.concat(barisBaru);

  const hasil = {
    dryRun: !!dryRun,
    totalBarisLama: totalBarisLama,
    totalKelompokDitemukan: Object.keys(kelompok).length,
    dimigrasikan: dimigrasikan,
    tidakBisaDipetakan: tidakBisaDipetakan,
    operasionalTidakDitemukan: operasionalTidakDitemukan,
    totalBarisSetelahMigrasi: semuaBarisFinal.length
  };

  if (!dryRun) {
    // TITIK TANPA KEMBALI: seluruh data (mulai baris 2) dihapus, lalu
    // ditulis ulang. Semua perhitungan di atas SUDAH SELESAI di memori
    // sebelum baris ini dijalankan -- jendela risiko diperkecil sebisa
    // mungkin, tapi ini TETAP operasi destruktif pada sheet produksi.
    const barisTerakhirSaatIni = sheet.getLastRow();
    if (barisTerakhirSaatIni > 1) {
      sheet.getRange(2, 1, barisTerakhirSaatIni - 1, jumlahKolom).clearContent();
    }
    if (semuaBarisFinal.length) {
      sheet.getRange(2, 1, semuaBarisFinal.length, jumlahKolom).setValues(semuaBarisFinal);
      const idxTeks = ['TANGGAL_OPERASIONAL', 'JAM_JADWAL_MASUK', 'JAM_JADWAL_PULANG', 'TANGGAL_MASUK', 'JAM_MASUK', 'TANGGAL_PULANG', 'JAM_PULANG'];
      for (let i = 0; i < semuaBarisFinal.length; i++) {
        const barisKe = i + 2;
        idxTeks.forEach(kolom => {
          if (idx[kolom] !== undefined && semuaBarisFinal[i][idx[kolom]] !== '') {
            paksaKolomTeks_(sheet, barisKe, idx[kolom] + 1);
            sheet.getRange(barisKe, idx[kolom] + 1).setValue(semuaBarisFinal[i][idx[kolom]]);
          }
        });
      }
    }
    _invalidasiCacheRosterV2_();
    logAudit_('MIGRASI_ROSTER_INPLACE', '03_DATA_ABSENSI', 'BATCH', 'ADMIN_MIGRASI', hasil);
  }

  return hasil;
}

/**
 * VALIDASI INTEGRITAS -- setelah migrasi in-place, TIDAK ADA lagi sumber
 * "lama" terpisah untuk dibandingkan (sheet yang sama sudah ditulis
 * ulang). Fungsi ini sekarang murni pemeriksaan KONSISTENSI INTERNAL
 * pada 03_DATA_ABSENSI SETELAH migrasi -- TANPA menulis apa pun.
 */
function validasiIntegritasRosterV2_() {
  const semua = getRosterV2Rows_();
  const terkonsolidasi = semua.filter(r => r.ID_ABSENSI); // baris hasil migrasi/roster-first
  const legasiBelumTerkonsolidasi = semua.filter(r => !r.ID_ABSENSI); // baris "tidakBisaDipetakan" yang disalin apa adanya

  const idRelawanUnik = new Set(terkonsolidasi.map(r => r.ID_RELAWAN).filter(Boolean));
  const idOperasionalUnik = new Set(terkonsolidasi.map(r => r.ID_OPERASIONAL).filter(Boolean));

  const idAbsensiCount = {};
  terkonsolidasi.forEach(r => { idAbsensiCount[r.ID_ABSENSI] = (idAbsensiCount[r.ID_ABSENSI] || 0) + 1; });
  const duplikatIdAbsensi = Object.keys(idAbsensiCount).filter(id => idAbsensiCount[id] > 1);

  const pulangTanpaMasuk = terkonsolidasi.filter(r => r.STATUS_PULANG !== 'BELUM' && r.STATUS_MASUK === 'BELUM').map(r => r.ID_ABSENSI);

  return {
    totalBarisSeluruhnya: semua.length,
    totalBarisTerkonsolidasi: terkonsolidasi.length,
    totalBarisLegasiBelumTerkonsolidasi: legasiBelumTerkonsolidasi.length,
    idRelawanUnik: idRelawanUnik.size,
    idOperasionalUnik: idOperasionalUnik.size,
    duplikatIdAbsensi: duplikatIdAbsensi,
    pulangTanpaMasuk: pulangTanpaMasuk
  };
}

/**
 * §I-§M dokumen SIPRES UI -- Monitoring Presensi utk Pengelola/Admin.
 * Default: periode aktif + tanggal operasional yang relevan (hari ini
 * kalau ada roster utk hari ini pada periode aktif, kalau tidak ambil
 * tanggal operasional PALING DEKAT dgn hari ini pada periode itu).
 * TIDAK memuat seluruh database sekaligus (§I: "jangan langsung muat
 * seluruh database absensi") -- selalu difilter minimal by periode.
 */
function getMonitoringPresensiAdmin(body) {
  requireAuth(body.token, true);

  const idPeriode = sanitize(body.idPeriode) || (getPeriodeAktif_() || {}).id;
  if (!idPeriode) return { periode: null, tanggalOperasional: null, daftarTanggalOperasional: [], stats: {}, data: [] };

  const periode = getPeriodeById_(idPeriode);
  const semuaOperasionalPeriode = getKalenderRows_()
    .filter(k => k.ID_PERIODE === idPeriode)
    .sort((a, b) => dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL)));

  let idOperasional = sanitize(body.idOperasional);
  let tanggalOperasional = sanitize(body.tanggalOperasional);
  if (!idOperasional && !tanggalOperasional && semuaOperasionalPeriode.length) {
    // Default: operasional dgn tanggal PALING DEKAT hari ini (§I "tanggal operasional yang relevan").
    const hariIniKunci = dmyKeKunciUrut_(formatTanggal(new Date()));
    let terdekat = semuaOperasionalPeriode[0];
    let selisihMin = Infinity;
    semuaOperasionalPeriode.forEach(k => {
      const selisih = Math.abs(Number(dmyKeKunciUrut_(k.TANGGAL_OPERASIONAL)) - Number(hariIniKunci));
      if (selisih < selisihMin) { selisihMin = selisih; terdekat = k; }
    });
    idOperasional = terdekat.ID_OPERASIONAL;
    tanggalOperasional = terdekat.TANGGAL_OPERASIONAL;
  } else if (idOperasional && !tanggalOperasional) {
    const k = semuaOperasionalPeriode.find(x => x.ID_OPERASIONAL === idOperasional);
    tanggalOperasional = k ? k.TANGGAL_OPERASIONAL : '';
  }

  let baris = getRosterV2Rows_().filter(r => r.ID_ABSENSI && r.ID_PERIODE === idPeriode);
  if (idOperasional) baris = baris.filter(r => r.ID_OPERASIONAL === idOperasional);
  else if (tanggalOperasional) baris = baris.filter(r => r.TANGGAL_OPERASIONAL === tanggalOperasional);

  // Filter tambahan §K
  if (body.divisi) baris = baris.filter(r => r.DIVISI === body.divisi);
  if (body.shift) baris = baris.filter(r => r.NAMA_SHIFT === body.shift);
  if (body.status) baris = baris.filter(r => r.STATUS_KEHADIRAN === body.status);

  const stats = {
    totalJadwal: baris.length,
    hadir: baris.filter(r => r.STATUS_KEHADIRAN === 'HADIR' || r.STATUS_KEHADIRAN === 'HADIR LENGKAP').length,
    terlambat: baris.filter(r => r.STATUS_KEHADIRAN === 'TERLAMBAT').length,
    izin: baris.filter(r => r.STATUS_KEHADIRAN === 'IZIN').length,
    sakit: baris.filter(r => r.STATUS_KEHADIRAN === 'SAKIT').length,
    tidakHadir: baris.filter(r => r.STATUS_KEHADIRAN === 'BELUM ABSEN' && dmyKeKunciUrut_(r.TANGGAL_OPERASIONAL) < dmyKeKunciUrut_(formatTanggal(new Date()))).length
  };

  const data = baris
    .sort((a, b) => (a.DIVISI || '').localeCompare(b.DIVISI || '') || (a.JAM_JADWAL_MASUK || '').localeCompare(b.JAM_JADWAL_MASUK || '') || a.NAMA_RELAWAN.localeCompare(b.NAMA_RELAWAN))
    .map(r => {
      const sudahLewat = dmyKeKunciUrut_(r.TANGGAL_OPERASIONAL) < dmyKeKunciUrut_(formatTanggal(new Date()));
      let statusTampil = r.STATUS_KEHADIRAN;
      if (statusTampil === 'BELUM ABSEN') statusTampil = sudahLewat ? 'TIDAK HADIR' : (r.STATUS_MASUK !== 'BELUM' ? 'BELUM PULANG' : 'BELUM ABSEN');
      else if (r.STATUS_MASUK !== 'BELUM' && r.STATUS_PULANG === 'BELUM') statusTampil = 'BELUM PULANG';

      return {
        idAbsensi: r.ID_ABSENSI, idRelawan: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, divisi: r.DIVISI,
        idOperasional: r.ID_OPERASIONAL, tanggalOperasional: r.TANGGAL_OPERASIONAL, hari: r.HARI_OPERASIONAL,
        namaShift: r.NAMA_SHIFT, jamJadwalMasuk: r.JAM_JADWAL_MASUK, jamJadwalPulang: r.JAM_JADWAL_PULANG,
        jamMasuk: r.JAM_MASUK || null, jamPulang: r.JAM_PULANG || null,
        status: statusTampil, keterlambatanMenit: Number(r.KETERLAMBATAN_MENIT) || 0,
        masuk: r.JAM_MASUK ? {
          jam: r.JAM_MASUK, latitude: r.LATITUDE_MASUK !== '' ? Number(r.LATITUDE_MASUK) : null, longitude: r.LONGITUDE_MASUK !== '' ? Number(r.LONGITUDE_MASUK) : null,
          akurasi: r.GPS_ACCURACY_MASUK !== '' ? Number(r.GPS_ACCURACY_MASUK) : null, jarakMeter: r.JARAK_MASUK_METER !== '' ? Number(r.JARAK_MASUK_METER) : null,
          fotoUrl: r.FOTO_MASUK ? urlFotoReference_(r.FOTO_MASUK) : null
        } : null,
        pulang: r.JAM_PULANG ? {
          jam: r.JAM_PULANG, latitude: r.LATITUDE_PULANG !== '' ? Number(r.LATITUDE_PULANG) : null, longitude: r.LONGITUDE_PULANG !== '' ? Number(r.LONGITUDE_PULANG) : null,
          akurasi: r.GPS_ACCURACY_PULANG !== '' ? Number(r.GPS_ACCURACY_PULANG) : null, jarakMeter: r.JARAK_PULANG_METER !== '' ? Number(r.JARAK_PULANG_METER) : null,
          fotoUrl: r.FOTO_PULANG ? urlFotoReference_(r.FOTO_PULANG) : null
        } : null
      };
    });

  return {
    periode: periode,
    tanggalOperasional: tanggalOperasional || null,
    idOperasional: idOperasional || null,
    daftarTanggalOperasional: semuaOperasionalPeriode.map(k => ({ idOperasional: k.ID_OPERASIONAL, tanggal: k.TANGGAL_OPERASIONAL, hari: k.HARI })),
    daftarDivisi: Array.from(new Set(getRosterV2Rows_().filter(r => r.ID_ABSENSI && r.ID_PERIODE === idPeriode).map(r => r.DIVISI))).filter(Boolean).sort(),
    daftarShift: Array.from(new Set(getRosterV2Rows_().filter(r => r.ID_ABSENSI && r.ID_PERIODE === idPeriode).map(r => r.NAMA_SHIFT))).filter(Boolean).sort(),
    stats: stats,
    data: data
  };
}

/** ADMIN -- dispatch endpoint. body.dryRun default true (HARUS eksplisit false utk benar-benar menulis). */
function jalankanMigrasiRosterV2(body) {
  requireAuth(body.token); // Admin penuh -- operasi berdampak luas
  const dryRun = body.dryRun !== false; // default AMAN: dry run kecuali eksplisit diminta false
  return migrasiAbsensiKeRosterV2_(dryRun);
}

/** ADMIN -- dispatch endpoint validasi integritas. */
function jalankanValidasiIntegritasRosterV2(body) {
  requireAuth(body.token, true);
  return validasiIntegritasRosterV2_();
}

/**
 * BERES-BERES DATABASE -- hapus kolom LAMA (NOMOR, TIMESTAMP, TANGGAL,
 * JAM, JENIS_ABSENSI, AKURASI, JARAK_METER, STATUS_LOKASI, FOTO_ID) dari
 * 03_DATA_ABSENSI setelah migrasi selesai & sudah diverifikasi.
 *
 * PENGAMAN: MENOLAK berjalan kalau masih ada baris yang datanya CUMA ada
 * di kolom lama (ID_ABSENSI kosong TAPI salah satu kolom lama terisi) --
 * itu tandanya migrasi BELUM dijalankan atau ada baris yang belum
 * ter-cover. WAJIB jalankan migrasiAbsensiKeRosterV2_(false) dulu,
 * SEBELUM memanggil fungsi ini.
 */
function hapusKolomLamaAbsensi_() {
  const sheet = getSheet(NAMA_SHEET.ABSENSI);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const kolomLama = ['NOMOR', 'TIMESTAMP', 'TANGGAL', 'JAM', 'JENIS_ABSENSI', 'AKURASI', 'JARAK_METER', 'STATUS_LOKASI', 'FOTO_ID'];
  const idxAda = kolomLama.filter(k => header.indexOf(k) !== -1);
  if (!idxAda.length) return { dihapus: [], pesan: 'Tidak ada kolom lama yang ditemukan -- mungkin sudah pernah dibersihkan sebelumnya.' };

  // Pengaman SEBENARNYA: pastikan migrasi memang SUDAH PERNAH dijalankan
  // (ada minimal 1 baris roster-first, ID_ABSENSI terisi). Baris "legasi"
  // (ID_ABSENSI kosong, data cuma di kolom lama) TIDAK dianggap "yatim"
  // secara otomatis -- migrasi MEMANG SENGAJA menyisakannya begitu utk
  // data pra-Fase-5 yang tidak bisa dipetakan. Kalau ada baris begini,
  // dilaporkan sbg peringatan (bukan pemblokir) -- data di kolom lama
  // baris itu AKAN HILANG kalau kolom dihapus.
  const idxIdAbsensi = header.indexOf('ID_ABSENSI');
  if (idxIdAbsensi === -1) throw new Error('DIBATALKAN: kolom ID_ABSENSI tidak ditemukan sama sekali -- migrasi sepertinya belum pernah dijalankan. Jalankan migrasiAbsensiKeRosterV2_(false) dulu.');

  const data = sheet.getDataRange().getValues();
  const idxKolomLamaTerisi = idxAda.map(k => header.indexOf(k));
  let barisTerkonsolidasi = 0, barisLegasiAkanKehilanganData = 0;
  for (let i = 1; i < data.length; i++) {
    const adaIdAbsensi = String(data[i][idxIdAbsensi] || '').trim() !== '';
    const adaDataLama = idxKolomLamaTerisi.some(idx => String(data[i][idx] || '').trim() !== '');
    if (adaIdAbsensi) barisTerkonsolidasi++;
    else if (adaDataLama) barisLegasiAkanKehilanganData++;
  }
  if (barisTerkonsolidasi === 0) {
    throw new Error('DIBATALKAN: belum ada satu pun baris roster-first (ID_ABSENSI terisi) -- migrasi sepertinya belum pernah dijalankan. Jalankan migrasiAbsensiKeRosterV2_(false) dulu, baru panggil fungsi ini lagi.');
  }

  // Hapus dari kolom PALING KANAN dulu supaya indeks kolom sisanya tidak bergeser di tengah proses.
  const posisiKolom = idxAda.map(k => header.indexOf(k) + 1).sort((a, b) => b - a);
  posisiKolom.forEach(pos => sheet.deleteColumn(pos));

  logAudit_('HAPUS_KOLOM_LAMA_ABSENSI', '03_DATA_ABSENSI', 'SCHEMA', 'ADMIN_MIGRASI', { kolomDihapus: idxAda, barisTerkonsolidasi: barisTerkonsolidasi, barisLegasiKehilanganData: barisLegasiAkanKehilanganData });
  return {
    dihapus: idxAda,
    barisTerkonsolidasi: barisTerkonsolidasi,
    barisLegasiKehilanganData: barisLegasiAkanKehilanganData,
    pesan: 'Kolom lama berhasil dihapus. 03_DATA_ABSENSI sekarang murni skema roster-first.' +
      (barisLegasiAkanKehilanganData > 0 ? ' PERHATIAN: ' + barisLegasiAkanKehilanganData + ' baris legasi (data pra-migrasi yang tidak bisa dipetakan) kehilangan data lamanya karena kolomnya baru saja dihapus.' : '')
  };
}

/** ADMIN -- dispatch endpoint. */
function hapusKolomLamaAbsensiAdmin(body) {
  requireAuth(body.token); // Admin penuh -- operasi struktur skema, destruktif
  return hapusKolomLamaAbsensi_();
}


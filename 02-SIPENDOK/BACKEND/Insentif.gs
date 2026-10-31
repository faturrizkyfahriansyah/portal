/**
 * Insentif.gs — BARU 25 Okt 2026 (dokumen Master Instruction SIPENDOK
 * §M, DISETUJUI & DIKONFIRMASI Admin). Insentif PIC Sekolah & Posyandu.
 *
 * KEPUTUSAN YANG SUDAH DIKONFIRMASI ADMIN (jangan diubah tanpa
 * persetujuan baru):
 * - Tepat 100 siswa masuk kelompok "100-500" (Rp30.000/hari), BUKAN
 *   kelompok "<100".
 * - "Hari yang memenuhi ketentuan" = hari BAST berhasil terbit (ada
 *   baris 06_BAST berstatus AKTIF utk PM & tanggal itu) -- BUKAN hari
 *   PM beroperasi secara umum, BUKAN hari ada transaksi Penerimaan
 *   semata (dokumen Penerimaan BISA ada tanpa BAST pernah terbit,
 *   itu TIDAK dihitung).
 *
 * TIDAK MENULIS APA PUN ke 06_BAST/01_PM -- modul ini HANYA MEMBACA &
 * MENGHITUNG (read-only), sesuai dokumen §M.4 "Perhitungan, verifikasi,
 * atau ekspor tidak otomatis mengubah status pembayaran".
 */
var Insentif = (function () {
  // Kelompok tarif PIC Sekolah (dokumen §M.2). min INKLUSIF, max INKLUSIF.
  // Batas 100 siswa DIKONFIRMASI masuk kelompok ke-2 (bukan ke-1).
  var TIER_SEKOLAH = [
    { min: 0, max: 99, tarif: 20000, label: 'Kurang dari 100' },
    { min: 100, max: 500, tarif: 30000, label: '100–500' },
    { min: 501, max: 750, tarif: 50000, label: '501–750' },
    { min: 751, max: 1000, tarif: 60000, label: '751–1.000' },
    { min: 1001, max: 2000, tarif: 100000, label: '1.001–2.000' },
    { min: 2001, max: 3000, tarif: 200000, label: '2.001–3.000' },
    { min: 3001, max: Infinity, tarif: null, label: 'Lebih dari 3.000' } // tarif null = BELUM DITETAPKAN, dokumen §M.2 poin 6: "jangan mengarang nominal"
  ];
  var TARIF_POSYANDU_PER_PORSI = 1000;

  function kelompokSekolah_(jumlahSiswa) {
    for (var i = 0; i < TIER_SEKOLAH.length; i++) {
      var t = TIER_SEKOLAH[i];
      if (jumlahSiswa >= t.min && jumlahSiswa <= t.max) return t;
    }
    return null;
  }

  /** BAST AKTIF milik idPm, dalam rentang tanggal [awal,akhir] (ISO), dikelompokkan per-TANGGAL (hindari hitung ganda kalau ada >1 baris per tanggal). */
  function bastAktifDalamRentang_(bastRows, idPm, awalIso, akhirIso) {
    var perTanggal = {};
    bastRows.forEach(function (b) {
      if (b.ID_PM !== idPm) return;
      if (String(b.STATUS).toUpperCase() !== 'AKTIF') return;
      var t = b.TANGGAL;
      if (t < awalIso || t > akhirIso) return;
      if (!perTanggal[t]) perTanggal[t] = [];
      perTanggal[t].push(b);
    });
    return perTanggal;
  }

  function hitungSekolah_(pm, bastRows, awalIso, akhirIso) {
    var jumlahSiswaRaw = pm.ACUAN_JUMLAH_SISWA;
    if (jumlahSiswaRaw === '' || jumlahSiswaRaw === undefined || jumlahSiswaRaw === null) {
      return { idPm: pm.ID_PM, namaPm: pm.NAMA_PM, status: 'PERLU_DATA_SISWA', pesan: 'Jumlah siswa acuan belum diisi -- isi dulu di Data Acuan PM.', totalInsentif: 0 };
    }
    var jumlahSiswa = Number(jumlahSiswaRaw);
    var kelompok = kelompokSekolah_(jumlahSiswa);
    if (!kelompok || kelompok.tarif === null) {
      return { idPm: pm.ID_PM, namaPm: pm.NAMA_PM, jumlahSiswa: jumlahSiswa, status: 'TARIF_BELUM_DITETAPKAN', pesan: 'Lebih dari 3.000 siswa -- tarif belum ditetapkan pihak berwenang. TIDAK dihitung (bukan 0, tapi "belum bisa dihitung").', totalInsentif: null };
    }
    var perTanggal = bastAktifDalamRentang_(bastRows, pm.ID_PM, awalIso, akhirIso);
    var hariMemenuhi = Object.keys(perTanggal).length;
    return {
      idPm: pm.ID_PM, namaPm: pm.NAMA_PM, jumlahSiswa: jumlahSiswa, kelompok: kelompok.label,
      tarifPerHari: kelompok.tarif, hariMemenuhi: hariMemenuhi, totalInsentif: hariMemenuhi * kelompok.tarif, status: 'OK'
    };
  }

  function hitungPosyandu_(pm, bastRows, awalIso, akhirIso) {
    var perTanggal = bastAktifDalamRentang_(bastRows, pm.ID_PM, awalIso, akhirIso);
    var totalPorsi = 0;
    Object.keys(perTanggal).forEach(function (t) {
      perTanggal[t].forEach(function (b) { totalPorsi += U.num(b.TOTAL_PAKET); });
    });
    return {
      idPm: pm.ID_PM, namaPm: pm.NAMA_PM, totalPorsi: totalPorsi,
      tarifPerPorsi: TARIF_POSYANDU_PER_PORSI, totalInsentif: totalPorsi * TARIF_POSYANDU_PER_PORSI, status: 'OK'
    };
  }

  /**
   * Rekap Insentif PIC utk 1 periode, dipecah 2 skema (Sekolah &
   * Posyandu) sesuai dokumen §M.1 "Keduanya mempunyai rumus berbeda,
   * tetapi totalnya dapat diringkas bersama." PIC diambil dari
   * relasi ID_PM->PIC (Master.gs Pic.untukPm yg SUDAH ADA), BUKAN
   * dicocokkan dari nama.
   */
  function rekapPeriode(idPeriode) {
    // Otentikasi SUDAH ditangani otomatis oleh dispatcher Api.gs sebelum
    // fn ini dipanggil (Auth.verify(req.token), lihat Api.gs ~baris 133)
    // -- TIDAK perlu & TIDAK ADA fungsi requireAuth terpisah di SIPENDOK
    // (beda dari Portal utama). Diperbaiki 27 Okt 2026 (bug: "requireAuth
    // is not defined", salah asumsi pola otentikasi Portal berlaku sama di sini).
    var periode = Bast.periodeById(idPeriode);
    if (!periode) throw new AppError('Periode tidak ditemukan.', 'TIDAK_ADA');

    var pms = Db.readAll('PM'), bastRows = Db.readAll('BAST'), pics = Db.readAll('PIC');
    function picUntuk(idPm) {
      var p = Pic.untukPm(idPm, pics, null);
      return p ? { nama: p.NAMA_PIC, idPic: p.ID_PIC } : { nama: '', idPic: '' };
    }

    var sekolah = [], posyandu = [];
    pms.forEach(function (pm) {
      if (String(pm.STATUS) !== 'Aktif') return; // dokumen tidak eksplisit soal PM nonaktif -- diasumsikan sama dgn aturan umum §E.3 (hanya PM aktif diproses), lihat catatan W
      var pic = picUntuk(pm.ID_PM);
      if (pm.JENIS_PM === 'SEKOLAH') {
        var h = hitungSekolah_(pm, bastRows, periode.tanggalMulai, periode.tanggalSelesai);
        h.pic = pic.nama; sekolah.push(h);
      } else if (pm.JENIS_PM === 'POSYANDU') {
        var hp = hitungPosyandu_(pm, bastRows, periode.tanggalMulai, periode.tanggalSelesai);
        hp.pic = pic.nama; posyandu.push(hp);
      }
    });

    var totalSekolah = sekolah.reduce(function (a, r) { return a + (r.totalInsentif || 0); }, 0);
    var totalPosyandu = posyandu.reduce(function (a, r) { return a + (r.totalInsentif || 0); }, 0);
    var perluData = sekolah.filter(function (r) { return r.status === 'PERLU_DATA_SISWA'; }).length;
    var tarifBelumAda = sekolah.filter(function (r) { return r.status === 'TARIF_BELUM_DITETAPKAN'; }).length;

    return {
      periode: periode, sekolah: sekolah, posyandu: posyandu,
      ringkasan: { totalSekolah: totalSekolah, totalPosyandu: totalPosyandu, totalGabungan: totalSekolah + totalPosyandu, perluData: perluData, tarifBelumAda: tarifBelumAda }
    };
  }

  return { rekapPeriode: rekapPeriode };
})();


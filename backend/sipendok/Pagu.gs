/** Pagu.gs — Perhitungan pagu/budget dari 03_PENERIMAAN dan 04_TARIF. */

var Pagu = {
  /** Kelompokkan kategori detail menjadi Porsi Kecil / Porsi Besar (sesuai Cfg.TARIF_MAP). */
  kelompok: function (r) {
    var k = 0, b = 0;
    Cfg.KATEGORI_SEMUA.forEach(function (kat) {
      var n = U.num(r[kat]);
      if (Cfg.TARIF_MAP[kat] === 'Porsi Kecil') k += n; else b += n;
    });
    return { kecil: k, besar: b };
  },

  hitung: function (kecil, besar, tarif) {
    var pk = tarif['Porsi Kecil'], pb = tarif['Porsi Besar'];
    var bahan = kecil * pk.BAHAN_BAKU + besar * pb.BAHAN_BAKU;
    var mitra = kecil * pk.MITRA_FASILITAS + besar * pb.MITRA_FASILITAS;
    var ops = kecil * pk.OPERASIONAL + besar * pb.OPERASIONAL;
    return { porsiKecil: kecil, porsiBesar: besar, totalPaket: kecil + besar, bahanBaku: bahan, mitraFasilitas: mitra, operasional: ops, totalPagu: bahan + mitra + ops };
  },

  /** Agregasi per tanggal: {tgl: {kecil, besar, pm}} dari baris penerimaan. */
  perTanggal: function (trxRows) {
    var m = {};
    trxRows.forEach(function (r) {
      var g = Pagu.kelompok(r), t = r.TANGGAL;
      if (!m[t]) m[t] = { kecil: 0, besar: 0, pm: 0 };
      m[t].kecil += g.kecil; m[t].besar += g.besar;
      if (U.num(r.TOTAL) > 0) m[t].pm += 1;
    });
    return m;
  },

  /** Tulis ulang 05_PERHITUNGAN_HARIAN (data turunan; selalu konsisten dengan 03 & 04). */
  bangunUlang: function () {
    var tarif = Db.tarif(), agg = Pagu.perTanggal(Db.readAll('PENERIMAAN'));
    var rows = Object.keys(agg).sort().map(function (t) {
      var h = Pagu.hitung(agg[t].kecil, agg[t].besar, tarif);
      return { TANGGAL: t, PORSI_KECIL: h.porsiKecil, PORSI_BESAR: h.porsiBesar, BAHAN_BAKU: h.bahanBaku,
        MITRA_FASILITAS: h.mitraFasilitas, OPERASIONAL: h.operasional, TOTAL_PAGU: h.totalPagu };
    });
    Db.writeAll('HARIAN', rows);
    return rows.length;
  },

  /**
   * Rekap harian (per hari dalam sebulan) / periode (per hari dalam 1
   * Periode Operasional). DISEDERHANAKAN 27 Okt 2026 (DIMINTA Admin):
   * mode 'bulanan'/'tahunan' DIHAPUS dari sini (dinilai terlalu berat
   * dihitung & jarang dipakai) -- kalau suatu saat dibutuhkan lagi,
   * audit histori Pagu.gs versi sebelum tanggal ini utk kode aslinya,
   * JANGAN ditulis ulang dari ingatan.
   */
  rekap: function (d) {
    var mode = d.mode, tarif = Db.tarif(), trx = Db.readAll('PENERIMAAN');
    var groups = {}, order = [];
    function add(key, label, r) {
      if (!groups[key]) { groups[key] = { periode: key, label: label, kecil: 0, besar: 0, hari: {} }; order.push(key); }
      var g = Pagu.kelompok(r);
      groups[key].kecil += g.kecil; groups[key].besar += g.besar;
      if (U.num(r.TOTAL) > 0) groups[key].hari[r.TANGGAL] = true;
    }

    var tahun = '', bulan = '', idPeriode = '', periodeInfo = null;
    if (mode === 'harian') {
      tahun = String(d.tahun || U.today().substring(0, 4)); bulan = U.pad(Number(d.bulan || 1), 2);
      trx.forEach(function (r) {
        var ym = r.TANGGAL.substring(0, 7);
        if (ym === tahun + '-' + bulan) add(r.TANGGAL, U.hariIndo(r.TANGGAL).charAt(0) + U.hariIndo(r.TANGGAL).substring(1).toLowerCase() + ', ' + U.tanggalIndo(r.TANGGAL), r);
      });
    } else if (mode === 'periode') {
      idPeriode = U.str(d.idPeriode);
      if (!idPeriode) throw new AppError('Periode wajib dipilih.', 'VALIDASI');
      periodeInfo = Bast.periodeById(idPeriode);
      if (!periodeInfo) throw new AppError('Periode tidak ditemukan.', 'TIDAK_ADA');
      trx.forEach(function (r) {
        if (r.TANGGAL < periodeInfo.tanggalMulai || r.TANGGAL > periodeInfo.tanggalSelesai) return;
        add(r.TANGGAL, U.hariIndo(r.TANGGAL).charAt(0) + U.hariIndo(r.TANGGAL).substring(1).toLowerCase() + ', ' + U.tanggalIndo(r.TANGGAL), r);
      });
    } else {
      throw new AppError('Mode rekap tidak dikenal (harus "harian" atau "periode").', 'VALIDASI');
    }

    order.sort();
    var total = { kecil: 0, besar: 0 };
    var rows = order.map(function (k) {
      var g = groups[k], h = Pagu.hitung(g.kecil, g.besar, tarif);
      total.kecil += g.kecil; total.besar += g.besar;
      h.periode = g.periode; h.label = g.label; h.hariAktif = Object.keys(g.hari).length;
      return h;
    });
    var ringkasan = Pagu.hitung(total.kecil, total.besar, tarif);
    ringkasan.hariAktif = rows.reduce(function (a, r) { return a + r.hariAktif; }, 0);
    return { mode: mode, tahun: tahun, bulan: bulan, periodeInfo: periodeInfo, rows: rows, ringkasan: ringkasan, tarif: tarif, mapping: Cfg.TARIF_MAP };
  },

  dashboard: function (tgl) {
    U.mustDate(tgl);
    var tarif = Db.tarif(), trx = Db.readAll('PENERIMAAN').filter(function (r) { return r.TANGGAL === tgl; });
    var pmAktif = Db.readAll('PM').filter(function (p) { return p.STATUS === 'Aktif'; });
    var kecil = 0, besar = 0, terisi = 0, kat = {};
    Cfg.KATEGORI_SEMUA.forEach(function (k) { kat[k] = 0; });
    trx.forEach(function (r) {
      var g = Pagu.kelompok(r); kecil += g.kecil; besar += g.besar; if (U.num(r.TOTAL) > 0) terisi++;
      Cfg.KATEGORI_SEMUA.forEach(function (k) { kat[k] += U.num(r[k]); });
    });
    var h = Pagu.hitung(kecil, besar, tarif);
    var dok = Dok.statusTanggal(tgl, trx);
    return {
      tanggal: tgl, hari: U.hariIndo(tgl), tanggalIndo: U.tanggalIndo(tgl),
      jumlahPmAktif: pmAktif.length, jumlahPmTerisi: terisi, sudahDiinput: trx.length,
      hitung: h, kategori: kat, dokumen: dok.aktif ? Dok.keluar(dok.aktif) : null, perluRevisi: dok.perluRevisi
    };
  }
};


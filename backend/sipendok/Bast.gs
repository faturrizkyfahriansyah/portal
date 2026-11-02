/**
 * Bast.gs — Penomoran BAST & Surat Jalan otomatis.
 *
 * DIROMBAK 23 Okt 2026 (DISETUJUI Admin, dokumen Pembaruan SIPENDOK
 * §13.C): format LAMA "001/BAST/SPPG-JJ/X/2026" (reset per bulan)
 * DIGANTI format BARU sesuai dokumen & template "Rancangan BAST dan
 * Surat Jalan SPPG Jeungjing Cisoka" yang diunggah Admin:
 *
 *   BAST : {KODE_SPPG}/BAST/P{periode}-{urut}/{tgl}-{bulan_romawi}-{thn2digit}
 *   SJ   : {KODE_SPPG}/SJ/P{periode}-{urut}/{tgl}-{bulan_romawi}-{thn2digit}
 *   contoh: SPPG-JC/BAST/P01-017/23-X-26
 *
 * BAST & Surat Jalan pada 1 PM/kegiatan distribusi yang SAMA memakai
 * periode+urut+tanggal yang SAMA PERSIS (cuma segmen jenis beda) --
 * sesuai dokumen §13.C "BAST dan Surat Jalan pada kegiatan yang sama
 * menggunakan periode, urutan, dan tanggal yang konsisten".
 *
 * Urutan (017) reset per PERIODE OPERASIONAL (bukan per bulan lagi,
 * lihat setelan RESET_NOMOR_BAST di Config.gs) -- 1 PM yg diproses
 * dalam 1 generate = 1 "kegiatan distribusi" = 1 nomor urut.
 *
 * KODE PERIODE (P01 dst) DITURUNKAN dari ID_PERIODE Portal Pengelola
 * utama (format "PRD001" dst, lihat Periode.gs di proyek Apps Script
 * UTAMA) -- SIPENDOK membaca sheet 14_PERIODE_KERJA LANGSUNG (DISETUJUI
 * Admin: SIPENDOK & Portal utama memakai 1 spreadsheet Google yang
 * sama, beda proyek Apps Script saja). Nomor urut PRD001 -> kode "P01".
 * TIDAK membuat sheet/konsep Periode baru di SIPENDOK sendiri (sesuai
 * larangan dokumen "jangan membuat periode baru sendiri").
 *
 * Dipanggil hanya di dalam LockService (lihat Dok.generate) agar tidak
 * ada nomor ganda saat permintaan generate bersamaan.
 */
var Bast = {
  /**
   * Cari periode operasional (dari Portal utama) yang mencakup tgl
   * (ISO yyyy-MM-dd). Null kalau tidak ada periode yang cocok --
   * PEMANGGIL WAJIB menolak generate & tampilkan alasan (dokumen §13.B
   * "Periksa: tanggal dan periode operasional"), BUKAN menebak/pakai
   * periode lain.
   */
  _ssPortalCache: null, // DITAMBAHKAN 27 Okt 2026 -- perbaiki bug "ssPortal_ is not defined": fungsi ssPortal_ dipanggil di 3 tempat tapi tidak pernah ditulis. Dipindah jadi method dalam objek Bast (bukan fungsi top-level terpisah) supaya jelas scope & cache-nya.
  _ssPortal: function () {
    if (Bast._ssPortalCache) return Bast._ssPortalCache;
    var id = U.str(Db.settings().PORTAL_SPREADSHEET_ID);
    if (!id) throw new AppError('PORTAL_SPREADSHEET_ID belum diisi di Pengaturan SIPENDOK.', 'PORTAL_ID_KOSONG');
    var ss;
    try { ss = SpreadsheetApp.openById(id); }
    catch (e) { throw new AppError('Tidak bisa membuka spreadsheet Portal Pengelola (PORTAL_SPREADSHEET_ID salah atau tidak ada izin akses).', 'PORTAL_GAGAL_BUKA'); }
    Bast._ssPortalCache = ss;
    return ss;
  },

  periodeUntukTanggal: function (tglIso) {
    var sh;
    try { sh = Bast._ssPortal().getSheetByName('14_PERIODE_KERJA'); }
    catch (e) { throw new AppError('Tidak bisa membaca Periode Kerja dari Portal utama -- periksa PORTAL_SPREADSHEET_ID di Pengaturan SIPENDOK.', 'PERIODE_GAGAL_BACA'); }
    if (!sh) throw new AppError('Sheet 14_PERIODE_KERJA tidak ditemukan. Pastikan SIPENDOK memakai spreadsheet yang sama dengan Portal Pengelola utama.', 'PERIODE_SHEET_TIDAK_ADA');
    var data = sh.getDataRange().getValues(), head = data[0], idx = {};
    head.forEach(function (h, i) { idx[String(h).trim()] = i; });
    U.mustDate(tglIso); // validasi format saja; perbandingan di bawah pakai STRING ISO langsung
    // (yyyy-MM-dd terurut benar secara leksikografis -- TIDAK perlu
    // parse ke angka/Date utk membandingkan, U.parseDate TIDAK py field
    // .iso, cuma {y,m,d,dow}).
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var mulaiIso = Bast._tglKeIso(r[idx.TANGGAL_MULAI]);
      var selesaiIso = Bast._tglKeIso(r[idx.TANGGAL_SELESAI]);
      if (!U.parseDate(mulaiIso) || !U.parseDate(selesaiIso)) continue;
      if (tglIso >= mulaiIso && tglIso <= selesaiIso) {
        var idPeriode = String(r[idx.ID_PERIODE] || '');
        return { idPeriode: idPeriode, nama: String(r[idx.NAMA_PERIODE] || ''), status: String(r[idx.STATUS] || ''), kode: Bast._kodePeriode(idPeriode) };
      }
    }
    return null;
  },

  /**
   * BARU 25 Okt 2026 (dipakai Insentif.gs) -- ambil detail 1 periode
   * LANGSUNG by ID (bukan cari "periode utk tanggal X" spt
   * periodeUntukTanggal). Sumber & pola baca SAMA (14_PERIODE_KERJA,
   * spreadsheet Portal utama yg sama).
   */
  periodeById: function (idPeriode) {
    var sh = Bast._ssPortal().getSheetByName('14_PERIODE_KERJA');
    if (!sh) throw new AppError('Sheet 14_PERIODE_KERJA tidak ditemukan.', 'PERIODE_SHEET_TIDAK_ADA');
    var data = sh.getDataRange().getValues(), head = data[0], idx = {};
    head.forEach(function (h, i) { idx[String(h).trim()] = i; });
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_PERIODE]) === idPeriode) {
        return {
          idPeriode: idPeriode, nama: String(data[i][idx.NAMA_PERIODE] || ''),
          tanggalMulai: Bast._tglKeIso(data[i][idx.TANGGAL_MULAI]), tanggalSelesai: Bast._tglKeIso(data[i][idx.TANGGAL_SELESAI]),
          status: String(data[i][idx.STATUS] || ''), kode: Bast._kodePeriode(idPeriode)
        };
      }
    }
    return null;
  },

  /**
   * BARU 25 Okt 2026 (dipakai dropdown pilih Periode di halaman
   * Insentif PIC & halaman lain yg butuh). Daftar SEMUA periode
   * (bukan hanya aktif) dari 14_PERIODE_KERJA, terbaru dulu.
   */
  daftarPeriode: function () {
    var sh = Bast._ssPortal().getSheetByName('14_PERIODE_KERJA');
    if (!sh) return [];
    var data = sh.getDataRange().getValues(), head = data[0], idx = {};
    head.forEach(function (h, i) { idx[String(h).trim()] = i; });
    var out = [];
    for (var i = 1; i < data.length; i++) {
      var idP = String(data[i][idx.ID_PERIODE] || '');
      if (!idP) continue;
      out.push({
        idPeriode: idP, nama: String(data[i][idx.NAMA_PERIODE] || ''),
        tanggalMulai: Bast._tglKeIso(data[i][idx.TANGGAL_MULAI]), tanggalSelesai: Bast._tglKeIso(data[i][idx.TANGGAL_SELESAI]),
        status: String(data[i][idx.STATUS] || ''), kode: Bast._kodePeriode(idP)
      });
    }
    out.sort(function (a, b) { return b.tanggalMulai < a.tanggalMulai ? -1 : 1; });
    return out;
  },

  /** "PRD001" / tanggal Date / string lain -> "01", "02", dst (2 digit). */
  _kodePeriode: function (idPeriode) {
    var m = /(\d+)/.exec(String(idPeriode));
    var n = m ? parseInt(m[1], 10) : 0;
    return U.pad(n, 2);
  },

  /** Terima Date object ATAU string "dd/MM/yyyy" (format Portal utama) -> "yyyy-MM-dd". */
  _tglKeIso: function (v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd');
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim());
    if (m) return m[3] + '-' + U.pad(+m[2], 2) + '-' + U.pad(+m[1], 2);
    return String(v).trim();
  },

  format: function (jenis, seq, kodePeriode, tgl, kodeSppg) {
    var p = U.mustDate(tgl);
    var tahun2 = String(p.y).slice(-2);
    return kodeSppg + '/' + jenis + '/P' + kodePeriode + '-' + U.pad(seq, 3) + '/' + U.pad(p.d, 2) + '-' + Cfg.ROMAWI[p.m - 1] + '-' + tahun2;
  },

  parseSeq: function (nomor) {
    var m = /-(\d{3})\/\d{1,2}-[IVX]+-\d{2}$/.exec(U.str(nomor));
    return m ? +m[1] : 0;
  },

  /**
   * Alokasikan nomor BAST + Surat Jalan untuk daftar PM pada satu
   * tanggal (tanpa menulis ke database). PM yang sudah punya nomor
   * pada tanggal itu MEMPERTAHANKAN nomornya (aman untuk generate
   * ulang/retry). WAJIB dipanggil di dalam LockService oleh pemanggil.
   * @return {Object} idPm -> {nomorBast, nomorSj, idBast, baru, existing}
   */
  alokasi: function (tgl, idPmList, bastRows, kodePeriode, kodeSppg) {
    var byPm = {}, max = 0, used = {};
    bastRows.forEach(function (r) {
      used[r.NOMOR_BAST] = true;
      if (r.TANGGAL === tgl) byPm[r.ID_PM] = r;
      // reset PER PERIODE (bukan per bulan) -- bandingkan via kolom
      // KODE_PERIODE eksplisit (BARU, lihat migrasiKolomPeriodeBast_
      // di Setup.gs), BUKAN parsing ulang teks NOMOR_BAST -- tahan
      // kalau format nomor berubah lagi suatu saat.
      if (String(r.KODE_PERIODE || '') === kodePeriode) {
        var s = Bast.parseSeq(r.NOMOR_BAST); if (s > max) max = s;
      }
    });
    var out = {};
    idPmList.forEach(function (id) {
      if (byPm[id]) {
        out[id] = { nomorBast: byPm[id].NOMOR_BAST, nomorSj: byPm[id].NOMOR_SJ, idBast: byPm[id].ID_BAST, baru: false, existing: byPm[id] };
        return;
      }
      var nomorBast, nomorSj;
      do { max++; nomorBast = Bast.format('BAST', max, kodePeriode, tgl, kodeSppg); } while (used[nomorBast]);
      used[nomorBast] = true;
      nomorSj = Bast.format('SJ', max, kodePeriode, tgl, kodeSppg);
      out[id] = { nomorBast: nomorBast, nomorSj: nomorSj, idBast: 'BAST-P' + kodePeriode + '-' + U.pad(max, 3), baru: true, existing: null, kodePeriode: kodePeriode };
    });
    return out;
  }
};


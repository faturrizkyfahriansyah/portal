/** Master.gs — Master Penerima Manfaat (01_PM) & PIC (02_PIC). */

var Pm = {
  daftar: function () { return Db.readAll('PM'); },

  simpan: function (d, user) {
    var nama = U.clean(d.NAMA_PM, 120);
    if (!nama) throw new AppError('Nama PM wajib diisi.', 'VALIDASI');
    // DIKEMBALIKAN 27 Okt 2026 (DISETUJUI Admin, membatalkan sebagian
    // perubahan 23 Okt 2026 di atas): JENIS_PM DIMINTA LAGI ke pengguna
    // -- pembedaan Sekolah/Posyandu kini RELEVAN lagi krn template
    // BAST+SJ baru (2 lembar) & Data Acuan BERBEDA per jenis (Porsi
    // Kecil/Besar utk Sekolah, Balita/Bumil/Busui utk Posyandu). Default
    // 'SEKOLAH' kalau benar2 tidak dikirim (jaga kompatibilitas pemanggil
    // lama), TAPI form baru WAJIB mengirim ini skrg.
    var jenis = null;
    if (d.JENIS_PM) Cfg.JENIS.forEach(function (j) { if (U.eq(j, d.JENIS_PM)) jenis = j; });
    if (!jenis) jenis = 'SEKOLAH';
    var status = null;
    Cfg.STATUS.forEach(function (s) { if (U.eq(s, d.STATUS)) status = s; });
    if (!status) status = 'Aktif';

    // BARU 23 Okt 2026 -- Data Acuan (Porsi Kecil/Besar/No. Kendaraan),
    // dipakai Penerimaan.gs utk auto-isi (lihat Terima.get). Opsional --
    // boleh kosong (PM baru yg belum tahu porsinya), TIDAK 0 secara default
    // spy "belum diisi" beda dari "memang 0".
    var acuanPorsiKecil = U.str(d.ACUAN_PORSI_KECIL) === '' ? '' : U.intNonNeg(d.ACUAN_PORSI_KECIL, 'Porsi Kecil acuan');
    var acuanPorsiBesar = U.str(d.ACUAN_PORSI_BESAR) === '' ? '' : U.intNonNeg(d.ACUAN_PORSI_BESAR, 'Porsi Besar acuan');
    var acuanKendaraan = Terima.kendaraan(d.ACUAN_NO_KENDARAAN); // reuse validasi SAMA dgn Penerimaan Harian
    // BARU 25 Okt 2026 (dokumen Master Instruction SIPENDOK §M.2) --
    // jumlah siswa acuan, TERPISAH dari porsi, SENGAJA tidak dihitung
    // otomatis dari apa pun (Admin isi manual dari data resmi sekolah).
    var acuanJumlahSiswa = U.str(d.ACUAN_JUMLAH_SISWA) === '' ? '' : U.intNonNeg(d.ACUAN_JUMLAH_SISWA, 'Jumlah siswa acuan');
    // BARU 27 Okt 2026 (DISETUJUI Admin) -- Data Acuan Posyandu, SEJAJAR
    // konsepnya dgn Porsi Kecil/Besar utk Sekolah. Opsional, boleh kosong.
    var acuanBalita = U.str(d.ACUAN_BALITA) === '' ? '' : U.intNonNeg(d.ACUAN_BALITA, 'Balita acuan');
    var acuanBumil = U.str(d.ACUAN_BUMIL) === '' ? '' : U.intNonNeg(d.ACUAN_BUMIL, 'Bumil acuan');
    var acuanBusui = U.str(d.ACUAN_BUSUI) === '' ? '' : U.intNonNeg(d.ACUAN_BUSUI, 'Busui acuan');

    var rows = Db.readAll('PM'), self = null;
    rows.forEach(function (r) { if (d.ID_PM && r.ID_PM === d.ID_PM) self = r; });
    if (d.ID_PM && !self) throw new AppError('PM tidak ditemukan.', 'TIDAK_ADA');
    rows.forEach(function (r) {
      if (U.eq(r.NAMA_PM, nama) && (!self || r.ID_PM !== self.ID_PM)) {
        throw new AppError('Nama PM "' + nama + '" sudah ada (' + r.ID_PM + ').', 'DUPLIKAT');
      }
    });

    var obj = {
      ID_PM: self ? self.ID_PM : U.nextId('PM', rows.map(function (r) { return r.ID_PM; }), 3),
      NAMA_PM: nama, JENIS_PM: jenis, ALAMAT: U.clean(d.ALAMAT, 250), STATUS: status,
      KETERANGAN: U.clean(d.KETERANGAN, 250),
      ACUAN_PORSI_KECIL: acuanPorsiKecil, ACUAN_PORSI_BESAR: acuanPorsiBesar, ACUAN_NO_KENDARAAN: acuanKendaraan,
      ACUAN_JUMLAH_SISWA: acuanJumlahSiswa,
      ACUAN_BALITA: acuanBalita, ACUAN_BUMIL: acuanBumil, ACUAN_BUSUI: acuanBusui
    };
    if (self) {
      if (self.JENIS_PM !== jenis) {
        var dipakai = SipanduPm.terpadu().some(function (t) { return t.ID_PM === self.ID_PM; });
        if (dipakai) throw new AppError('Jenis PM tidak dapat diubah karena sudah memiliki riwayat penerimaan. Buat PM baru bila perlu.', 'JENIS_TERKUNCI');
      }
      Db.updateRow('PM', self._row, obj);
      Db.log(user.nama, 'Ubah PM', 'PM', obj.ID_PM, obj.NAMA_PM);
    } else {
      Db.appendMany('PM', [obj]);
      Db.log(user.nama, 'Tambah PM', 'PM', obj.ID_PM, obj.NAMA_PM);
    }
    return obj;
  },

  /**
   * BARU 23 Okt 2026 (dokumen Pembaruan SIPENDOK §6.C) -- hapus PM.
   * HANYA diizinkan kalau PM ini BELUM PERNAH dipakai di 03_PENERIMAAN
   * sama sekali (tidak ada baris riwayat) -- kalau sudah pernah,
   * TOLAK dan arahkan ke Nonaktifkan (soft delete), supaya riwayat &
   * dokumen lama tidak pernah kehilangan rujukan PM-nya.
   */
  hapus: function (d, user) {
    var idPm = U.str(d.ID_PM);
    if (!idPm) throw new AppError('ID PM wajib diisi.', 'VALIDASI');
    var rows = Db.readAll('PM'), self = null;
    rows.forEach(function (r) { if (r.ID_PM === idPm) self = r; });
    if (!self) throw new AppError('PM tidak ditemukan.', 'TIDAK_ADA');

    var dipakai = SipanduPm.terpadu().some(function (t) { return t.ID_PM === idPm; });
    if (dipakai) {
      throw new AppError('PM "' + self.NAMA_PM + '" sudah memiliki riwayat penerimaan/dokumen -- tidak bisa dihapus permanen. Gunakan "Nonaktifkan" supaya riwayat tetap aman.', 'PUNYA_RIWAYAT');
    }
    Db.deleteRow('PM', self._row);
    Db.log(user.nama, 'Hapus PM', 'PM', idPm, self.NAMA_PM);
    return { ID_PM: idPm, dihapus: true };
  },

  /**
   * BARU 25 Okt 2026, DIPERBARUI 27 Okt 2026 (dipakai pm.ringkasRelawan/
   * pm.ringkasPublik di Api.gs -- Portal utama PenerimaManfaat.gs).
   * Sumber PK/PB = ACUAN_PORSI_KECIL/BESAR (Sekolah); Sumber
   * Balita/Bumil/Busui = ACUAN_BALITA/BUMIL/BUSUI (Posyandu) -- field
   * ini SEKARANG ADA (lihat Config.gs/Setup.gs migrasi 27 Okt 2026,
   * MENGGANTIKAN keputusan 25 Okt 2026 yg sebelumnya menampilkan 0 krn
   * field acuan utk Posyandu belum tersedia saat itu). HANYA PM
   * berstatus Aktif.
   * @param {boolean} sertakanPic true utk jalur Relawan (boleh lihat
   *   nama PIC), false utk Publik (TIDAK PERNAH menyertakan PIC).
   */
  /** 'yyyy-MM-dd' -> '5 November 2026' ('' bila kosong). */
  tglIndo_: function (iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    var bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return Number(m[3]) + ' ' + bulan[Number(m[2]) - 1] + ' ' + m[1];
  },

  ringkasUmum_: function (sertakanPic) {
    // REVISI 4 Nov 2026 (Admin): ringkasan membaca PM HARIAN (penerimaan terpadu: SIPANDU baru + 03_PENERIMAAN lama), BUKAN acuan.
    // Tanggal = data PM harian TERBARU yang <= hari ini (TANGGAL_DATA). Instansi tanpa data pada tanggal itu = 0.
    var pms = Db.readAll('PM').filter(function (p) { return p.STATUS === 'Aktif'; });
    var pics = sertakanPic ? Db.readAll('PIC') : null;
    var hariIni = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var trx = SipanduPm.terpadu().filter(function (r) { return r.TANGGAL <= hariIni; });
    var tanggal = ''; trx.forEach(function (r) { if (r.TANGGAL > tanggal) tanggal = r.TANGGAL; });
    var perPm = {}; trx.forEach(function (r) { if (r.TANGGAL === tanggal) perPm[r.ID_PM] = r; });
    var daftar = pms.map(function (pm) { return { ID_PM: pm.ID_PM, JENIS_PM: pm.JENIS_PM, NAMA_PM: pm.NAMA_PM }; });
    var dikenal = {}; daftar.forEach(function (d) { dikenal[d.ID_PM] = true; });
    Object.keys(perPm).forEach(function (id) {   // instansi baru di SIPANDU yang belum ada di 01_PM tetap ikut tampil
      var r = perPm[id];
      if (!dikenal[id] && r._sumber === 'SIPANDU_V2') daftar.push({ ID_PM: id, JENIS_PM: r._JENIS_PM, NAMA_PM: r.NAMA_PM });
    });
    return daftar.map(function (pm) {
      var t = perPm[pm.ID_PM];
      var pk = t ? U.num(t.PORSI_KECIL) : 0, pb = t ? U.num(t.PORSI_BESAR) + U.num(t.TENAGA_PENDIDIK) : 0;
      var bumil = t ? U.num(t.BUMIL) : 0, busui = t ? U.num(t.BUSUI) : 0, balita = t ? U.num(t.BALITA) : 0;
      var out = {
        ID_PM: pm.ID_PM, JENIS_PM: pm.JENIS_PM, NAMA_PM: pm.NAMA_PM,
        PK: pk, PB: pb, BUMIL: bumil, BUSUI: busui, BALITA: balita,
        JUMLAH: pk + pb + bumil + busui + balita, TANGGAL_DATA: tanggal, tanggalDataIndo: Pm.tglIndo_(tanggal)
      };
      if (sertakanPic) {
        var p = Pic.untukPm(pm.ID_PM, pics, null);
        out.namaPic = t && t.NAMA_PIC ? t.NAMA_PIC : (p ? p.NAMA_PIC : '');
      }
      return out;
    });
  },

  /**
   * BARU 25 Okt 2026 (dipakai pm.ringkasHariIniAsn -- dasbor Monitoring
   * ASN/Kepala SPPG, FITUR BARU, belum ada bentuk baku dikonfirmasi
   * Admin). BEDA dari ringkasUmum_ di atas -- ini soal status HARI INI
   * SUNGGUHAN (bukan Acuan): berapa PM yg transaksi Penerimaannya
   * sudah tercatat hari ini, berapa yg BAST-nya sudah terbit hari ini.
   * Kalau bentuk ini ternyata tidak sesuai kebutuhan dasbor, PERLU
   * disesuaikan -- ini interpretasi wajar dari nama fungsi, bukan
   * spesifikasi yg sudah dikonfirmasi.
   */
  ringkasHariIniAsn_: function () {
    var hariIni = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var pmAktif = Db.readAll('PM').filter(function (p) { return p.STATUS === 'Aktif'; });
    var trxHariIni = SipanduPm.terpadu().filter(function (r) { return r.TANGGAL === hariIni; });
    var bastHariIni = Db.readAll('BAST').filter(function (b) { return b.TANGGAL === hariIni && String(b.STATUS).toUpperCase() === 'AKTIF'; });
    return {
      tanggal: hariIni,
      totalPmAktif: pmAktif.length,
      totalPmSekolah: pmAktif.filter(function (p) { return p.JENIS_PM === 'SEKOLAH'; }).length,
      totalPmPosyandu: pmAktif.filter(function (p) { return p.JENIS_PM === 'POSYANDU'; }).length,
      penerimaanTercatatHariIni: trxHariIni.length,
      bastTerbitHariIni: bastHariIni.length,
      belumAdaPenerimaan: pmAktif.length - trxHariIni.length
    };
  }
};

var Pic = {
  daftar: function () { return Db.readAll('PIC'); },

  /** PIC aktif milik PM; jika tidak ada, pakai PIC yang tercatat pada transaksi (riwayat). */
  untukPm: function (idPm, pics, trx) {
    var hit = null;
    pics.forEach(function (p) { if (!hit && p.ID_PM === idPm && p.STATUS === 'Aktif') hit = p; });
    if (!hit && trx && trx.ID_PIC) pics.forEach(function (p) { if (p.ID_PIC === trx.ID_PIC) hit = p; });
    return hit;
  },

  simpan: function (d, user) {
    var nama = U.clean(d.NAMA_PIC, 100);
    if (!nama) throw new AppError('Nama PIC wajib diisi.', 'VALIDASI');
    var pmRows = Db.readAll('PM');
    var pm = pmRows.filter(function (p) { return p.ID_PM === d.ID_PM; })[0];
    if (!pm) throw new AppError('PM tidak valid.', 'VALIDASI');
    var status = null;
    Cfg.STATUS.forEach(function (s) { if (U.eq(s, d.STATUS)) status = s; });
    if (!status) status = 'Aktif';
    var rek = U.str(d.NOMOR_REKENING).replace(/\s+/g, '');
    var hp = U.str(d.NOMOR_HP);
    if (!/^[0-9\-]{0,30}$/.test(rek)) throw new AppError('Nomor rekening hanya boleh berisi angka.', 'VALIDASI');
    if (!/^[0-9+\-\s]{0,25}$/.test(hp)) throw new AppError('Nomor HP hanya boleh berisi angka, spasi, + dan -.', 'VALIDASI');

    var rows = Db.readAll('PIC'), self = null;
    rows.forEach(function (r) { if (d.ID_PIC && r.ID_PIC === d.ID_PIC) self = r; });
    if (d.ID_PIC && !self) throw new AppError('PIC tidak ditemukan.', 'TIDAK_ADA');
    if (status === 'Aktif') {
      rows.forEach(function (r) {
        if (r.ID_PM === d.ID_PM && r.STATUS === 'Aktif' && (!self || r.ID_PIC !== self.ID_PIC)) {
          throw new AppError('PM ini sudah memiliki PIC aktif (' + r.NAMA_PIC + '). Nonaktifkan PIC tersebut terlebih dahulu.', 'PIC_GANDA');
        }
      });
    }
    var obj = {
      ID_PIC: self ? self.ID_PIC : U.nextId('PIC', rows.map(function (r) { return r.ID_PIC; }), 3),
      ID_PM: d.ID_PM, NAMA_PIC: nama, JABATAN: U.clean(d.JABATAN, 60),
      NOMOR_REKENING: rek, NOMOR_HP: hp, STATUS: status
    };
    if (self) {
      Db.updateRow('PIC', self._row, obj);
      Db.log(user.nama, 'Ubah PIC', 'PIC', obj.ID_PIC, nama + ' / ' + pm.NAMA_PM);
    } else {
      Db.appendMany('PIC', [obj]);
      Db.log(user.nama, 'Tambah PIC', 'PIC', obj.ID_PIC, nama + ' / ' + pm.NAMA_PM);
    }
    return obj;
  }
};


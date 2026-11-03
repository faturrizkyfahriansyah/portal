/**
 * SipanduTarifV2.gs — MASTER TARIF (non-relawan) di database SIPANDU baru + perhitungan PAGU. BARU 4 Nov 2026.
 * Permintaan Admin 4 Nov: menu Master Tarif memuat 6 tarif -> (1) insentif relawan per hari [tetap di Portal: MasterTarif.gs],
 * (2) PIC Posyandu, (3) PIC Sekolah, (4) sewa fasilitas, (5) pagu bahan baku, (6) operasional. Nomor 2-6 ada di sini.
 *
 * Semua tarif BERTANGGAL BERLAKU: tarif pada tanggal T = baris dengan TANGGAL_BERLAKU terbesar <= T untuk (KATEGORI, KUNCI).
 * TARIF kosong = BELUM DITETAPKAN (tidak pernah dikarang; perhitungan menandainya).
 * Memakai fungsi bantu SipanduV2.gs (v2Baca_, v2Tambah_, v2Kunci_, v2Iso_, ...). Aturan pagu mengikuti SIPENDOK (Cfg.TARIF_MAP):
 *   Porsi Kecil = PK + Balita ; Porsi Besar = PB + Ibu Hamil + Ibu Menyusui.
 */
var TARIF_LAIN = {
  KATEGORI: {
    PORSI_BAHAN_BAKU:     { nama: 'Pagu bahan baku', satuan: 'PER_PORSI', kunci: ['KECIL', 'BESAR'], maks: 1000000 },
    PORSI_SEWA_FASILITAS: { nama: 'Sewa fasilitas (mitra)', satuan: 'PER_PORSI', kunci: ['KECIL', 'BESAR'], maks: 1000000 },
    PORSI_OPERASIONAL:    { nama: 'Operasional', satuan: 'PER_PORSI', kunci: ['KECIL', 'BESAR'], maks: 1000000 },
    PIC_POSYANDU:         { nama: 'Insentif PIC Posyandu', satuan: 'PER_PORSI', kunci: ['PER_PORSI'], maks: 100000 },
    PIC_SEKOLAH:          { nama: 'Insentif PIC Sekolah', satuan: 'PER_HARI', kunci: null, maks: 2000000, jenjang: true }
  }
};

function v2SeninIso_(iso) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }

/** { 'KATEGORI|KUNCI': [ {mulai, tarif|null, min, maks, idTarif, keterangan, oleh} ... ] } terurut naik menurut tanggal berlaku. */
function v2TarifKumpul_() {
  var peta = {};
  v2Baca_('TARIF').baris.forEach(function (r) {
    var mulai = v2Iso_(r.TANGGAL_BERLAKU);
    if (!r.KATEGORI || !r.KUNCI || !mulai) return;
    var k = r.KATEGORI + '|' + r.KUNCI;
    (peta[k] = peta[k] || []).push({ mulai: mulai, tarif: v2Nilai_(r.TARIF), min: v2Nilai_(r.BATAS_MIN), maks: v2Nilai_(r.BATAS_MAKS), idTarif: r.ID_TARIF, keterangan: v2Str_(r.KETERANGAN), oleh: v2Str_(r.DIBUAT_OLEH), _row: r._row });
  });
  Object.keys(peta).forEach(function (k) { peta[k].sort(function (a, b) { return a.mulai < b.mulai ? -1 : (a.mulai > b.mulai ? 1 : 0); }); });
  return peta;
}
function v2TarifPada_(peta, kategori, kunci, iso) {
  var hasil = null;
  (peta[kategori + '|' + kunci] || []).forEach(function (e) { if (e.mulai <= iso) hasil = e; });
  return hasil;
}

/** Jenjang PIC Sekolah harus rapat: mulai 0, tiap batas atas + 1 = batas bawah berikutnya, yang terakhir tanpa batas atas. */
function v2CekJenjang_(tiers) {
  var t = tiers.slice().sort(function (a, b) { return a.min - b.min; });
  if (!t.length) throw new Error('Jenjang PIC Sekolah tidak boleh kosong.');
  if (t[0].min !== 0) throw new Error('Jenjang pertama harus mulai dari 0 siswa.');
  for (var i = 0; i < t.length; i++) {
    var last = i === t.length - 1;
    if (last) { if (t[i].maks !== null) throw new Error('Jenjang terakhir harus tanpa batas atas (kosongkan "sampai").'); }
    else {
      if (t[i].maks === null) throw new Error('Hanya jenjang terakhir yang boleh tanpa batas atas.');
      if (t[i].maks < t[i].min) throw new Error('Batas atas jenjang ' + t[i].kunci + ' lebih kecil dari batas bawah.');
      if (t[i + 1].min !== t[i].maks + 1) throw new Error('Jenjang tidak rapat: setelah ' + t[i].maks + ' siswa harus langsung ' + (t[i].maks + 1) + ' (ditemukan ' + t[i + 1].min + ').');
    }
  }
  return true;
}

/** Tarif yang berlaku pada body.tanggal (default hari ini) untuk semua kategori, lengkap dengan tarif mendatang. */
function getMasterTarifLainV2(body) {
  v2Cek_(body, 'VIEW');
  var iso = v2Str_(body.tanggal) || v2HariIniIso_();
  if (!v2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  var peta = v2TarifKumpul_(), kat = {};
  Object.keys(TARIF_LAIN.KATEGORI).forEach(function (nama) {
    var def = TARIF_LAIN.KATEGORI[nama], kunci = def.kunci;
    if (!kunci) { kunci = []; Object.keys(peta).forEach(function (k) { if (k.indexOf(nama + '|') === 0) kunci.push(k.split('|')[1]); }); kunci.sort(function (a, b) { return Number(a.slice(1)) - Number(b.slice(1)); }); }
    kat[nama] = { nama: def.nama, satuan: def.satuan, jenjang: !!def.jenjang, maks: def.maks, baris: kunci.map(function (kc) {
      var daftar = peta[nama + '|' + kc] || [], e = v2TarifPada_(peta, nama, kc, iso), depan = daftar.filter(function (x) { return x.mulai > iso; })[0] || null;
      return { kunci: kc, batasMin: e ? e.min : null, batasMaks: e ? e.maks : null, tarif: e ? e.tarif : null, ada: !!e, berlakuSejak: e ? e.mulai : '', tarifMendatang: depan ? { tarif: depan.tarif, tanggal: depan.mulai } : null };
    }).filter(function (b) { return b.ada || !def.jenjang; }) };
  });
  return { tanggal: iso, kategori: kat };
}

function getRiwayatTarifLainV2(body) {
  v2Cek_(body, 'VIEW');
  var kat = v2Str_(body.kategori), kunci = v2Str_(body.kunci);
  if (!TARIF_LAIN.KATEGORI[kat]) throw new Error('Kategori tarif tidak dikenal.');
  var daftar = (v2TarifKumpul_()[kat + '|' + kunci] || []).slice().reverse();
  return { kategori: kat, kunci: kunci, riwayat: daftar.map(function (e) { return { tanggalBerlaku: e.mulai, tarif: e.tarif, batasMin: e.min, batasMaks: e.maks, keterangan: e.keterangan, dibuatOleh: e.oleh }; }) };
}

/**
 * Simpan tarif satu kategori dengan tanggal berlaku. body: { token, kategori, tanggalBerlaku, keterangan?, konfirmasiSurut?, items:[{kunci, tarif, batasMin?, batasMaks?}] }
 * tarif '' = BELUM DITETAPKAN (hanya diizinkan untuk PIC_SEKOLAH). Tanggal berlaku sebelum Senin minggu ini = SURUT -> wajib konfirmasiSurut.
 */
function simpanTarifLainV2(body) {
  var aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'SIPANDU', 'EDIT');
  var kat = v2Str_(body.kategori), def = TARIF_LAIN.KATEGORI[kat];
  if (!def) throw new Error('Kategori tarif tidak dikenal.');
  var iso = v2Str_(body.tanggalBerlaku);
  if (!v2IsoValid_(iso)) throw new Error('Tanggal berlaku tidak valid.');
  if (!Array.isArray(body.items) || !body.items.length) throw new Error('Tidak ada tarif yang dikirim.');
  if (iso < v2SeninIso_(v2HariIniIso_()) && body.konfirmasiSurut !== true) {
    throw new Error('BERLAKU_SURUT: tanggal berlaku ' + iso + ' sudah lewat dan akan MENGUBAH perhitungan tanggal-tanggal yang sudah berjalan. Konfirmasi dulu bila memang disengaja.');
  }
  var items = [], lihat = {};
  body.items.forEach(function (it) {
    var kc = v2Str_(it.kunci).toUpperCase();
    if (!kc) throw new Error('Ada tarif tanpa jenis/jenjang.');
    if (def.kunci && def.kunci.indexOf(kc) < 0) throw new Error('Jenis "' + kc + '" tidak dikenal untuk ' + def.nama + '. Pilihan: ' + def.kunci.join(', ') + '.');
    if (!def.kunci && !/^T\d{1,2}$/.test(kc)) throw new Error('Kode jenjang harus berbentuk T1, T2, ... (ditemukan "' + kc + '").');
    if (lihat[kc]) throw new Error('Jenis ' + kc + ' muncul lebih dari sekali.');
    lihat[kc] = true;
    var sTarif = (it.tarif === null || it.tarif === undefined) ? '' : String(it.tarif).trim(), tarif = null;
    if (sTarif === '') { if (!def.jenjang) throw new Error('Tarif ' + def.nama + ' (' + kc + ') wajib diisi.'); }
    else {
      if (!/^\d+$/.test(sTarif)) throw new Error('Tarif ' + kc + ' harus berupa angka bulat rupiah (tanpa titik/koma).');
      tarif = Number(sTarif);
      if (tarif > def.maks) throw new Error('Tarif ' + kc + ' (Rp' + tarif + ') terlalu besar. Maksimal Rp' + def.maks + '.');
    }
    var o = { kunci: kc, tarif: tarif, min: null, maks: null };
    if (def.jenjang) {
      o.min = v2Angka_(it.batasMin, 'Batas bawah ' + kc); o.maks = v2Angka_(it.batasMaks, 'Batas atas ' + kc);
      if (o.min === null) throw new Error('Batas bawah jenjang ' + kc + ' wajib diisi.');
    }
    items.push(o);
  });
  return v2Kunci_(function () {
    var t = v2Baca_('TARIF'), peta = v2TarifKumpul_();
    if (def.jenjang) {   // periksa jenjang HASIL (yang berlaku pada tanggal itu setelah perubahan) rapat & tanpa celah
      var hasil = {};
      Object.keys(peta).forEach(function (k) { if (k.indexOf(kat + '|') === 0) { var e = v2TarifPada_(peta, kat, k.split('|')[1], iso); if (e) hasil[k.split('|')[1]] = { kunci: k.split('|')[1], min: e.min, maks: e.maks }; } });
      items.forEach(function (it) { hasil[it.kunci] = { kunci: it.kunci, min: it.min, maks: it.maks }; });
      v2CekJenjang_(Object.keys(hasil).map(function (k) { return hasil[k]; }));
    }
    var sekarang = new Date(), ket = v2Str_(body.keterangan), baru = 0, diperbarui = 0, dilewati = 0, nomor = 0;
    t.baris.forEach(function (r) { var m = /^TL-(\d+)$/.exec(String(r.ID_TARIF || '')); if (m) nomor = Math.max(nomor, Number(m[1])); });
    items.forEach(function (it) {
      var ada = t.baris.filter(function (r) { return r.KATEGORI === kat && r.KUNCI === it.kunci && v2Iso_(r.TANGGAL_BERLAKU) === iso; })[0];
      var nilai = { TARIF: it.tarif === null ? '' : it.tarif, BATAS_MIN: it.min === null ? '' : it.min, BATAS_MAKS: it.maks === null ? '' : it.maks, KETERANGAN: ket };
      if (ada) {
        if (v2Nilai_(ada.TARIF) === it.tarif && v2Nilai_(ada.BATAS_MIN) === it.min && v2Nilai_(ada.BATAS_MAKS) === it.maks) { dilewati++; return; }
        nilai.DIUBAH_PADA = sekarang; nilai.DIUBAH_OLEH = aktor; v2Ubah_('TARIF', ada, nilai, t.header); diperbarui++; return;
      }
      var berlaku = v2TarifPada_(peta, kat, it.kunci, iso);
      if (berlaku && berlaku.tarif === it.tarif && berlaku.min === it.min && berlaku.maks === it.maks) { dilewati++; return; }   // sudah sama dengan yang berlaku
      nomor++;
      nilai.ID_TARIF = 'TL-' + ('0000' + nomor).slice(-4); nilai.KATEGORI = kat; nilai.KUNCI = it.kunci; nilai.SATUAN = def.satuan; nilai.TANGGAL_BERLAKU = v2Tgl_(iso); nilai.DIBUAT_PADA = sekarang; nilai.DIBUAT_OLEH = aktor;
      v2Tambah_('TARIF', nilai, t.header); baru++;
    });
    v2Audit_(aktor, 'UBAH_TARIF_LAIN_V2', 'MASTER_TARIF', kat, { tanggalBerlaku: iso, baru: baru, diperbarui: diperbarui, dilewati: dilewati, keterangan: ket, surut: iso < v2SeninIso_(v2HariIniIso_()) });
    return { kategori: kat, tanggalBerlaku: iso, baru: baru, diperbarui: diperbarui, dilewati: dilewati };
  });
}

/**
 * REKAP PAGU per tanggal dari PM_HARIAN (TERVERIFIKASI) x tarif yang berlaku pada tanggal itu.
 * Porsi Kecil = PK + Balita; Porsi Besar = PB + Ibu Hamil + Ibu Menyusui (aturan SIPENDOK Cfg.TARIF_MAP).
 * Tarif belum ditetapkan -> dihitung 0 dan tanggalnya ditandai tarifLengkap:false.
 */
function getRekapPaguV2(body) {
  v2Cek_(body, 'VIEW');
  return v2HitungPagu_(v2Str_(body.tanggalAwal), v2Str_(body.tanggalAkhir));
}

/** Perhitungan pagu murni (tanpa RBAC) -- dipakai getRekapPaguV2 dan getRekapBiayaV2. */
function v2HitungPagu_(awal, akhir) {
  if (!v2IsoValid_(awal) || !v2IsoValid_(akhir) || awal > akhir) throw new Error('Rentang tanggal tidak valid.');
  if (v2Tgl_(v2HariKe_(awal, 92)) < v2Tgl_(akhir)) throw new Error('Rentang maksimal 93 hari.');
  var peta = v2TarifKumpul_(), n = function (v) { var x = v2Nilai_(v); return x === null ? 0 : x; };
  var hdr = v2Baca_('PM_HARIAN').baris.filter(function (h) { var t = v2Iso_(h.TANGGAL); return t >= awal && t <= akhir && v2Str_(h.STATUS) === 'TERVERIFIKASI'; });
  var det = v2Baca_('DETAIL').baris, perHdr = {};
  det.forEach(function (d) { (perHdr[d.ID_PM_HARIAN] = perHdr[d.ID_PM_HARIAN] || []).push(d); });
  var baris = [], tot = { porsiKecil: 0, porsiBesar: 0, bahanBaku: 0, sewaFasilitas: 0, operasional: 0, totalPagu: 0 };
  hdr.sort(function (a, b) { return v2Iso_(a.TANGGAL) < v2Iso_(b.TANGGAL) ? -1 : 1; }).forEach(function (h) {
    var iso = v2Iso_(h.TANGGAL), kecil = 0, besar = 0, inst = 0;
    (perHdr[h.ID_PM_HARIAN] || []).forEach(function (d) { var k = n(d.PK) + n(d.BALITA), b = n(d.PB) + n(d.BUMIL) + n(d.BUSUI); kecil += k; besar += b; if (k + b > 0) inst++; });
    var kurang = [], nilai = function (kat, kunci) { var e = v2TarifPada_(peta, kat, kunci, iso); if (!e || e.tarif === null) { kurang.push(kat + ' ' + kunci); return 0; } return e.tarif; };
    var bahan = kecil * nilai('PORSI_BAHAN_BAKU', 'KECIL') + besar * nilai('PORSI_BAHAN_BAKU', 'BESAR');
    var sewa = kecil * nilai('PORSI_SEWA_FASILITAS', 'KECIL') + besar * nilai('PORSI_SEWA_FASILITAS', 'BESAR');
    var ops = kecil * nilai('PORSI_OPERASIONAL', 'KECIL') + besar * nilai('PORSI_OPERASIONAL', 'BESAR');
    baris.push({ tanggal: iso, jumlahInstansi: inst, porsiKecil: kecil, porsiBesar: besar, totalPaket: kecil + besar, bahanBaku: bahan, sewaFasilitas: sewa, operasional: ops, totalPagu: bahan + sewa + ops, tarifLengkap: kurang.length === 0, tarifKurang: kurang });
    tot.porsiKecil += kecil; tot.porsiBesar += besar; tot.bahanBaku += bahan; tot.sewaFasilitas += sewa; tot.operasional += ops; tot.totalPagu += bahan + sewa + ops;
  });
  return { tanggalAwal: awal, tanggalAkhir: akhir, baris: baris, total: tot, jumlahTanggalTarifKurang: baris.filter(function (b) { return !b.tarifLengkap; }).length };
}

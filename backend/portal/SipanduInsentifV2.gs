/**
 * SipanduInsentifV2.gs — INSENTIF PIC + REKAP BIAYA di SIPANDU (BARU 4 Nov 2026; pindahan dari SIPENDOK sesuai Master Blueprint §10.5).
 *
 * SUMBER = PM HARIAN (REVISI Admin 4 Nov 2026: sebelumnya dari BAST SIPENDOK; kini cukup PM Harian yang sudah ada di SIPANDU, jadi TIDAK ada
 * lagi sambungan ke spreadsheet SIPENDOK). Semua data ada di database SIPANDU: PM_HARIAN (TERVERIFIKASI), MASTER_TARIF (bertanggal berlaku),
 * MASTER_INSTANSI (jumlah siswa), MASTER_PIC dan PIC_INSTANSI (PIC & rekening).
 *
 * RUMUS (turunan Insentif.gs SIPENDOK yang dikonfirmasi Admin 25 Okt 2026; hanya SUMBER hari/porsi yang berubah, dari BAST menjadi PM Harian):
 *  - "Hari yang memenuhi" = tanggal yang punya PM Harian TERVERIFIKASI dengan total porsi > 0 untuk instansi itu.
 *  - SEKOLAH  : total = jumlah hari memenuhi x tarif per hari jenjang jumlah siswa (tepat 100 siswa masuk jenjang 100-500).
 *  - POSYANDU : total = total porsi (semua kategori) pada PM Harian x tarif per porsi.
 *  - Jumlah siswa kosong -> PERLU_DATA_SISWA (Rp0, ditandai). Jenjang tanpa tarif -> TARIF_BELUM_DITETAPKAN (tidak dikarang).
 * Tarif dipilih menurut TANGGAL PM Harian (Master Tarif bertanggal berlaku); insentif dikaitkan ke PIC yang bertugas pada tanggal itu.
 */

/** PM Harian TERVERIFIKASI per instansi pada [awal, akhir] dengan total > 0 -> [{tanggal, idPm, namaPm, totalPaket}]. */
function v2BacaPmInsentif_(awal, akhir) {
  var n = function (v) { var x = v2Nilai_(v); return x === null ? 0 : x; };
  var hdr = {}; v2Baca_('PM_HARIAN').baris.forEach(function (h) { var t = v2Iso_(h.TANGGAL); if (t >= awal && t <= akhir && v2Str_(h.STATUS) === 'TERVERIFIKASI') hdr[h.ID_PM_HARIAN] = t; });
  var nama = {}; v2Baca_('INSTANSI').baris.forEach(function (i) { nama[i.ID_INSTANSI] = i.NAMA_INSTANSI; });
  var hasil = [];
  v2Baca_('DETAIL').baris.forEach(function (d) {
    var t = hdr[d.ID_PM_HARIAN]; if (!t) return;
    var total = n(d.PK) + n(d.PB) + n(d.BUMIL) + n(d.BUSUI) + n(d.BALITA);
    if (total > 0) hasil.push({ tanggal: t, idPm: String(d.ID_INSTANSI).trim(), namaPm: nama[d.ID_INSTANSI] || '', totalPaket: total });
  });
  return hasil;
}

function v2CekRentangFin_(awal, akhir) {
  if (!v2IsoValid_(awal) || !v2IsoValid_(akhir) || awal > akhir) throw new Error('Rentang tanggal tidak valid.');
  if (v2Tgl_(v2HariKe_(awal, 92)) < v2Tgl_(akhir)) throw new Error('Rentang maksimal 93 hari.');
}
/** Jenjang PIC Sekolah yang berlaku pada tanggal iso untuk jumlah siswa tertentu: {kunci, tarif|null, min, maks} atau null. */
function v2JenjangPada_(peta, siswa, iso) {
  var kunci = [];
  Object.keys(peta).forEach(function (k) { if (k.indexOf('PIC_SEKOLAH|') === 0) kunci.push(k.split('|')[1]); });
  kunci.sort(function (a, b) { return Number(a.slice(1)) - Number(b.slice(1)); });
  for (var i = 0; i < kunci.length; i++) {
    var e = v2TarifPada_(peta, 'PIC_SEKOLAH', kunci[i], iso);
    if (e && e.min !== null && siswa >= e.min && (e.maks === null || siswa <= e.maks)) return { kunci: kunci[i], tarif: e.tarif, min: e.min, maks: e.maks };
  }
  return null;
}
/** PIC yang bertugas untuk instansi pada tanggal iso (penugasan dengan TANGGAL_MULAI terbaru yang masih berlaku). */
function v2PicPada_(penugasan, picMap, idInstansi, iso) {
  var terbaik = null;
  penugasan.forEach(function (p) {
    if (String(p.ID_INSTANSI) !== String(idInstansi)) return;
    var mulai = v2Iso_(p.TANGGAL_MULAI), akhir = v2Iso_(p.TANGGAL_AKHIR);
    if (mulai && mulai > iso) return;
    if (akhir && akhir < iso) return;
    if (!terbaik || (mulai || '') > (v2Iso_(terbaik.TANGGAL_MULAI) || '')) terbaik = p;
  });
  if (!terbaik) return { idPic: '', nama: '(belum ada PIC)', jabatan: '', rekening: '', hp: '' };
  var m = picMap[terbaik.ID_PIC] || {};
  return { idPic: String(terbaik.ID_PIC), nama: v2Str_(m.NAMA_PIC) || String(terbaik.ID_PIC), jabatan: v2Str_(m.JABATAN), rekening: v2Str_(m.NOMOR_REKENING), hp: v2Str_(m.NOMOR_HP) };
}

function v2HitungInsentif_(awal, akhir) {
  v2CekRentangFin_(awal, akhir);
  var pmRows = v2BacaPmInsentif_(awal, akhir), peta = v2TarifKumpul_();
  var ins = v2Baca_('INSTANSI').baris, picMap = {}, penugasan = v2Baca_('PIC_INSTANSI').baris, pmPer = {}, dikenal = {};
  v2Baca_('PIC').baris.forEach(function (p) { picMap[p.ID_PIC] = p; });
  pmRows.forEach(function (b) { (pmPer[b.idPm] = pmPer[b.idPm] || []).push(b); });
  var sekolah = [], posyandu = [], peringatan = [], perPic = {};
  function ke(perPicKey, pic, skema, nilai, namaInstansi) {
    var o = perPic[perPicKey] = perPic[perPicKey] || { idPic: pic.idPic, nama: pic.nama, jabatan: pic.jabatan, rekening: pic.rekening, hp: pic.hp, sekolah: 0, posyandu: 0, total: 0, instansi: [] };
    o[skema] += nilai; o.total += nilai; if (o.instansi.indexOf(namaInstansi) < 0) o.instansi.push(namaInstansi);
  }
  ins.forEach(function (i) {
    dikenal[i.ID_INSTANSI] = true;
    var aktif = v2Str_(i.STATUS).toUpperCase() === 'AKTIF', rows = pmPer[i.ID_INSTANSI] || [];
    if (!aktif && !rows.length) return;
    var jenis = v2Str_(i.JENIS_INSTANSI).toUpperCase();
    if (jenis !== 'SEKOLAH' && jenis !== 'POSYANDU') { if (rows.length) peringatan.push('Instansi ' + i.NAMA_INSTANSI + ' berjenis "' + jenis + '": tidak ada skema insentif PIC untuk jenis ini, ' + rows.length + ' baris PM harian diabaikan.'); return; }
    var o = { idInstansi: i.ID_INSTANSI, nama: i.NAMA_INSTANSI, jenis: jenis, nonaktif: !aktif, jumlahSiswa: null, jenjang: '', hariPm: 0, totalPorsi: 0, tarifRingkas: '', total: 0, hariTanpaTarif: 0, status: 'OK', pesan: '', pic: [] };
    var picDiInstansi = {}, tarifDipakai = {};
    function catatPic(pic, nilai, skema) { ke(pic.idPic || '-', pic, skema, nilai, i.NAMA_INSTANSI); var x = picDiInstansi[pic.idPic || '-'] = picDiInstansi[pic.idPic || '-'] || { idPic: pic.idPic, nama: pic.nama, rekening: pic.rekening, total: 0 }; x.total += nilai; }
    if (jenis === 'SEKOLAH') {
      var siswa = v2Nilai_(i.JUMLAH_SISWA); o.jumlahSiswa = siswa;
      var tanggal = {}; rows.forEach(function (b) { tanggal[b.tanggal] = true; });
      var hari = Object.keys(tanggal).sort(); o.hariPm = hari.length;
      if (siswa === null) { o.status = 'PERLU_DATA_SISWA'; o.pesan = 'Jumlah siswa belum diisi di Master Instansi.'; }
      else hari.forEach(function (d) {
        var j = v2JenjangPada_(peta, siswa, d);
        if (!j) { o.hariTanpaTarif++; return; }
        o.jenjang = j.kunci + ' (' + j.min + '–' + (j.maks === null ? 'dst' : j.maks) + ')';
        if (j.tarif === null) { o.hariTanpaTarif++; return; }
        o.total += j.tarif; tarifDipakai[j.tarif] = true; catatPic(v2PicPada_(penugasan, picMap, i.ID_INSTANSI, d), j.tarif, 'sekolah');
      });
      if (siswa !== null && o.hariTanpaTarif > 0) { o.status = 'TARIF_BELUM_DITETAPKAN'; o.pesan = 'Tarif jenjang ' + (o.jenjang || 'untuk ' + siswa + ' siswa') + ' belum ditetapkan di Master Tarif (' + o.hariTanpaTarif + ' hari tidak dihitung).'; }
    } else {
      rows.forEach(function (b) {
        o.totalPorsi += b.totalPaket;
        var e = v2TarifPada_(peta, 'PIC_POSYANDU', 'PER_PORSI', b.tanggal);
        if (!e || e.tarif === null) { o.hariTanpaTarif++; return; }
        var nilai = b.totalPaket * e.tarif; o.total += nilai; tarifDipakai[e.tarif] = true; catatPic(v2PicPada_(penugasan, picMap, i.ID_INSTANSI, b.tanggal), nilai, 'posyandu');
      });
      var tg = {}; rows.forEach(function (b) { tg[b.tanggal] = true; }); o.hariPm = Object.keys(tg).length;
      if (o.hariTanpaTarif > 0) { o.status = 'TARIF_BELUM_DITETAPKAN'; o.pesan = 'Tarif PIC Posyandu belum ditetapkan pada ' + o.hariTanpaTarif + ' tanggal.'; }
    }
    if (o.status === 'OK' && o.hariPm === 0) { o.status = 'TIDAK_ADA_PM'; o.pesan = 'Tidak ada PM harian terverifikasi pada rentang ini.'; }
    var tarifList = Object.keys(tarifDipakai).map(Number).sort(function (a, b) { return a - b; });
    o.tarifRingkas = tarifList.length === 0 ? '' : (tarifList.length === 1 ? String(tarifList[0]) : tarifList[0] + '–' + tarifList[tarifList.length - 1]);
    o.pic = Object.keys(picDiInstansi).map(function (k) { return picDiInstansi[k]; });
    (jenis === 'SEKOLAH' ? sekolah : posyandu).push(o);
  });
  Object.keys(pmPer).forEach(function (id) { if (!dikenal[id]) peringatan.push('Ada ' + pmPer[id].length + ' PM harian untuk instansi "' + id + '" yang tidak ada di Master Instansi (tidak dihitung).'); });
  var perluSiswa = sekolah.filter(function (r) { return r.status === 'PERLU_DATA_SISWA'; }), tanpaTarif = sekolah.concat(posyandu).filter(function (r) { return r.status === 'TARIF_BELUM_DITETAPKAN'; });
  if (perluSiswa.length) peringatan.unshift(perluSiswa.length + ' instansi sekolah belum punya jumlah siswa, insentifnya Rp0: ' + perluSiswa.map(function (r) { return r.nama; }).join(', ') + '. Isi di Master Instansi.');
  if (tanpaTarif.length) peringatan.unshift(tanpaTarif.length + ' instansi memakai tarif yang belum ditetapkan di Master Tarif: ' + tanpaTarif.map(function (r) { return r.nama; }).join(', ') + '.');
  var sum = function (a) { return a.reduce(function (x, r) { return x + r.total; }, 0); };
  var picList = Object.keys(perPic).map(function (k) { return perPic[k]; }).sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });
  return { tanggalAwal: awal, tanggalAkhir: akhir, jumlahBaris: pmRows.length, sekolah: sekolah, posyandu: posyandu, perPic: picList,
           total: { sekolah: sum(sekolah), posyandu: sum(posyandu), gabungan: sum(sekolah) + sum(posyandu) }, peringatan: peringatan };
}

/** Insentif PIC (Sekolah + Posyandu) per rentang. body: { token, tanggalAwal, tanggalAkhir } */
function getRekapInsentifPicV2(body) {
  v2Cek_(body, 'VIEW');
  return v2HitungInsentif_(v2Str_(body.tanggalAwal), v2Str_(body.tanggalAkhir));
}

/** REKAP BIAYA = Pagu (bahan baku + sewa fasilitas + operasional) + Insentif PIC (sekolah + posyandu), keduanya dari PM Harian. */
function getRekapBiayaV2(body) {
  v2Cek_(body, 'VIEW');
  var awal = v2Str_(body.tanggalAwal), akhir = v2Str_(body.tanggalAkhir);
  var pagu = v2HitungPagu_(awal, akhir), insentif = v2HitungInsentif_(awal, akhir), tp = pagu.total, ti = insentif.total;
  return { tanggalAwal: awal, tanggalAkhir: akhir, pagu: pagu, insentif: insentif,
           total: { bahanBaku: tp.bahanBaku, sewaFasilitas: tp.sewaFasilitas, operasional: tp.operasional, pagu: tp.totalPagu, insentifSekolah: ti.sekolah, insentifPosyandu: ti.posyandu, insentif: ti.gabungan, semua: tp.totalPagu + ti.gabungan } };
}

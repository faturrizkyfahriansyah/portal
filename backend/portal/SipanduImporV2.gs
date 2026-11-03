/**
 * SipanduImporV2.gs — IMPOR RIWAYAT PENERIMAAN SIPENDOK -> PM HARIAN SIPANDU (BARU 4 Nov 2026).
 *
 * Pagu, Rekap Biaya, Insentif PIC, kalender, dan dashboard kini membaca HANYA PM Harian, sedangkan database SIPANDU baru dimulai kosong.
 * Tanpa impor, semua tanggal SEBELUM peralihan tampil Rp0 di sana. Fungsi ini membaca tab `_IMPOR_PENERIMAAN` (salinan 03_PENERIMAAN
 * SIPENDOK, dikirim sebagai IMPOR_RIWAYAT_PENERIMAAN.xlsx) di database SIPANDU dan membuat PM_HARIAN + DETAIL_PM_HARIAN berstatus TERVERIFIKASI.
 *
 * ATURAN: (1) tanggal yang SUDAH punya PM_HARIAN di SIPANDU DILEWATI, tidak pernah ditimpa; (2) semua-atau-tidak-sama-sekali: satu masalah
 * (instansi tak dikenal, tanggal/angka rusak) membatalkan seluruh impor; (3) idempoten; (4) PB = PORSI_BESAR + TENAGA_PENDIDIK (sama dgn pagu
 * SIPENDOK); (5) ID_TRANSAKSI lama disimpan di ID_TRANSAKSI_LAMA, ID header/detail memakai pola yang sama dengan input biasa.
 */
var IMPOR_SHEET = '_IMPOR_PENERIMAAN';
var IMPOR_WAJIB = ['ID_TRANSAKSI', 'TANGGAL', 'ID_PM', 'PORSI_KECIL', 'PORSI_BESAR', 'BALITA', 'BUMIL', 'BUSUI'];

function v2BacaImpor_() {
  var sh = v2Spreadsheet_().getSheetByName(IMPOR_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  var data = sh.getDataRange().getValues(), h = data[0].map(function (x) { return String(x).trim(); });
  var kurang = IMPOR_WAJIB.filter(function (k) { return h.indexOf(k) < 0; });
  if (kurang.length) throw new Error('Kolom wajib tab ' + IMPOR_SHEET + ' tidak ada: ' + kurang.join(', ') + '.');
  var baris = [];
  for (var i = 1; i < data.length; i++) { if (!data[i].some(function (c) { return c !== '' && c !== null; })) continue; var o = { _no: i + 1 }; h.forEach(function (k, j) { o[k] = data[i][j]; }); baris.push(o); }
  return baris;
}
/** Rencana impor (tanpa menulis). */
function v2RencanaImpor_() {
  var sumber = v2BacaImpor_();
  if (!sumber) throw new Error('IMPOR_BELUM_ADA: tab ' + IMPOR_SHEET + ' belum ada di database SIPANDU (impor IMPOR_RIWAYAT_PENERIMAAN.xlsx sebagai sheet baru).');
  var sudah = {}; v2Baca_('PM_HARIAN').baris.forEach(function (h) { var t = v2Iso_(h.TANGGAL); if (t) sudah[t] = true; });
  var instansi = {}; v2Baca_('INSTANSI').baris.forEach(function (i) { instansi[String(i.ID_INSTANSI).trim()] = true; });
  var pic = {}; v2Baca_('PIC').baris.forEach(function (p) { pic[String(p.ID_PIC).trim()] = true; });
  var n = function (v, nama, no, masalah) {
    if (v === '' || v === null || v === undefined) return 0;
    var x = Number(v); if (isNaN(x) || x < 0 || x !== Math.floor(x)) { masalah.push('Baris ' + no + ': ' + nama + ' bukan bilangan bulat >= 0 ("' + v + '").'); return 0; } return x;
  };
  var masalah = [], perTgl = {}, dilewati = {}, kembar = {};
  sumber.forEach(function (r) {
    var iso = v2Iso_(r.TANGGAL), idPm = String(r.ID_PM).trim();
    if (!iso) { masalah.push('Baris ' + r._no + ': tanggal tidak valid ("' + r.TANGGAL + '").'); return; }
    if (!instansi[idPm]) { masalah.push('Baris ' + r._no + ': instansi "' + idPm + '" tidak ada di Master Instansi SIPANDU.'); return; }
    var kk = iso + '|' + idPm; if (kembar[kk]) { masalah.push('Baris ' + r._no + ': tanggal ' + iso + ' dan instansi ' + idPm + ' muncul lebih dari sekali.'); return; } kembar[kk] = true;
    var pk = n(r.PORSI_KECIL, 'PORSI_KECIL', r._no, masalah), pb = n(r.PORSI_BESAR, 'PORSI_BESAR', r._no, masalah) + n(r.TENAGA_PENDIDIK, 'TENAGA_PENDIDIK', r._no, masalah);
    var bumil = n(r.BUMIL, 'BUMIL', r._no, masalah), busui = n(r.BUSUI, 'BUSUI', r._no, masalah), balita = n(r.BALITA, 'BALITA', r._no, masalah), kend = v2Str_(r.NO_KENDARAAN);
    if (sudah[iso]) { dilewati[iso] = (dilewati[iso] || 0) + 1; return; }
    if (pk + pb + bumil + busui + balita === 0 && kend === '') return;                                  // baris kosong: tidak diimpor
    (perTgl[iso] = perTgl[iso] || []).push({ idTransaksi: v2Str_(r.ID_TRANSAKSI), idInstansi: idPm, PK: pk, PB: pb, BUMIL: bumil, BUSUI: busui, BALITA: balita, idPic: pic[String(r.ID_PIC).trim()] ? String(r.ID_PIC).trim() : '', noKendaraan: kend, user: v2Str_(r.USER_INPUT), waktu: r.WAKTU_INPUT });
  });
  var tanggal = Object.keys(perTgl).sort().map(function (t) { var b = perTgl[t]; return { tanggal: t, baris: b.length, porsi: b.reduce(function (s, x) { return s + x.PK + x.PB + x.BUMIL + x.BUSUI + x.BALITA; }, 0), _data: b }; });
  return { tanggalBaru: tanggal, tanggalDilewati: Object.keys(dilewati).sort(), masalah: masalah, totalBaris: tanggal.reduce(function (s, t) { return s + t.baris; }, 0), totalPorsi: tanggal.reduce(function (s, t) { return s + t.porsi; }, 0) };
}
function getRencanaImporRiwayatV2(body) {
  v2Cek_(body, 'VIEW');
  try {
    var r = v2RencanaImpor_();
    return { tersedia: true, tanggalBaru: r.tanggalBaru.map(function (t) { return { tanggal: t.tanggal, baris: t.baris, porsi: t.porsi }; }), tanggalDilewati: r.tanggalDilewati, masalah: r.masalah, totalBaris: r.totalBaris, totalPorsi: r.totalPorsi };
  } catch (e) { if (String(e.message).indexOf('IMPOR_BELUM_ADA') === 0) return { tersedia: false, pesan: String(e.message).replace('IMPOR_BELUM_ADA: ', '') }; throw e; }
}
/** Jalankan impor. body: { token, konfirmasi:true } */
function jalankanImporRiwayatV2(body) {
  var aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'SIPANDU', 'EDIT');
  if (body.konfirmasi !== true) throw new Error('Konfirmasi diperlukan sebelum mengimpor riwayat Penerimaan.');
  return v2Kunci_(function () {
    var r = v2RencanaImpor_();
    if (r.masalah.length) throw new Error('Impor DIBATALKAN, tidak ada yang ditulis. ' + r.masalah.length + ' masalah, mis.: ' + r.masalah.slice(0, 3).join(' '));
    var hdr = v2Baca_('PM_HARIAN'), det = v2Baca_('DETAIL'), sekarang = new Date(), tulisDetail = 0;
    r.tanggalBaru.forEach(function (t) {
      var kode = t.tanggal.replace(/-/g, ''), idH = 'PMH-' + kode, waktu = null;
      t._data.forEach(function (x) { var w = x.waktu instanceof Date ? x.waktu : (x.waktu ? new Date(String(x.waktu).replace(' ', 'T')) : null); if (w && !isNaN(w.getTime()) && (!waktu || w > waktu)) waktu = w; });
      v2Tambah_('PM_HARIAN', { ID_PM_HARIAN: idH, TANGGAL: v2Tgl_(t.tanggal), STATUS: 'TERVERIFIKASI', DIKONFIRMASI_OLEH: 'IMPOR SIPENDOK', DIKONFIRMASI_PADA: waktu || sekarang, CATATAN: 'Diimpor dari 03_PENERIMAAN SIPENDOK', DIBUAT_PADA: sekarang, DIBUAT_OLEH: aktor }, hdr.header);
      t._data.forEach(function (x) {
        v2Tambah_('DETAIL', { ID_DETAIL: 'DTL-' + kode + '-' + x.idInstansi, ID_PM_HARIAN: idH, ID_INSTANSI: x.idInstansi, PK: x.PK, PB: x.PB, BUMIL: x.BUMIL, BUSUI: x.BUSUI, BALITA: x.BALITA, ID_PIC: x.idPic, NO_KENDARAAN: x.noKendaraan, ID_TRANSAKSI_LAMA: x.idTransaksi, DIBUAT_PADA: sekarang, DIBUAT_OLEH: aktor }, det.header);
        tulisDetail++;
      });
    });
    v2Audit_(aktor, 'IMPOR_RIWAYAT_PENERIMAAN_V2', 'PM_HARIAN', IMPOR_SHEET, { tanggal: r.tanggalBaru.length, baris: tulisDetail, porsi: r.totalPorsi, dilewati: r.tanggalDilewati.length });
    return { tanggalDiimpor: r.tanggalBaru.length, barisDiimpor: tulisDetail, totalPorsi: r.totalPorsi, tanggalDilewati: r.tanggalDilewati };
  });
}
/** Editor: lihat rencana (log) / jalankan. */
function simulasiImporRiwayat() {
  var r = v2RencanaImpor_(); try { Logger.log('Impor: ' + r.tanggalBaru.length + ' tanggal baru, ' + r.totalBaris + ' baris, ' + r.totalPorsi + ' porsi; dilewati (sudah ada): ' + r.tanggalDilewati.join(', ') + '; masalah: ' + r.masalah.length + (r.masalah.length ? ' -> ' + r.masalah.slice(0, 5).join(' | ') : '')); } catch (e) { /* abaikan */ }
}

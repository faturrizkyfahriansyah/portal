/**
 * SipanduPmHarian.gs — SIPENDOK membaca PM HARIAN dari database SIPANDU baru (BARU 4 Nov 2026).
 *
 * KEPUTUSAN ADMIN (4 Nov 2026): kolom ACUAN tetap ada di master PM (nilai awal pengisian), tetapi laporan dan modul lain
 * membaca PM HARIAN, bukan acuan. Untuk SIPENDOK ini berarti: dokumen (Surat Jalan/BAST), pagu, insentif, dan ringkasan PM
 * memakai SipanduPm.terpadu() = PM_HARIAN SIPANDU (TERVERIFIKASI) untuk tanggal yang ada di sana + 03_PENERIMAAN lama untuk
 * tanggal yang BELUM ada di SIPANDU (riwayat tetap utuh, tautan BAST lama tetap berlaku).
 *
 * Bila database SIPANDU belum tersambung / strukturnya rusak -> terpadu() = 03_PENERIMAAN lama persis (tidak ada yang berubah).
 * Hubungkan SEKALI: ganti ID pada fungsi hubungkanSipanduPmHarian di bawah, Run, lihat Execution log.
 * Halaman Penerimaan SIPENDOK (input lama) sebaiknya tidak dipakai lagi: input PM harian sekarang di SIPANDU > Manajemen PM.
 */
var SipanduPm = {
  PROP: 'SIPANDU_V2_SPREADSHEET_ID',
  WAJIB: {
    PM_HARIAN: ['ID_PM_HARIAN', 'TANGGAL', 'STATUS', 'DIKONFIRMASI_OLEH', 'DIKONFIRMASI_PADA'],
    DETAIL_PM_HARIAN: ['ID_DETAIL', 'ID_PM_HARIAN', 'ID_INSTANSI', 'PK', 'PB', 'BUMIL', 'BUSUI', 'BALITA', 'ID_PIC', 'NO_KENDARAAN'],
    MASTER_INSTANSI: ['ID_INSTANSI', 'NAMA_INSTANSI', 'JENIS_INSTANSI'],
    MASTER_PIC: ['ID_PIC', 'NAMA_PIC']
  },
  _v2: undefined,   // cache selama satu eksekusi: array baris | null

  ss_: function () {
    var id = PropertiesService.getScriptProperties().getProperty(SipanduPm.PROP);
    if (!id) return null;
    try { return SpreadsheetApp.openById(id); } catch (e) { return null; }
  },
  iso_: function (v) {
    if (v === null || v === undefined || v === '') return '';
    if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  },
  /** { header, baris:[obj] } atau null bila sheet/kolom wajib tidak lengkap. */
  tabel_: function (ss, nama) {
    var sh = ss.getSheetByName(nama);
    if (!sh || !sh.getLastColumn()) return null;
    var semua = sh.getDataRange().getValues(), header = (semua[0] || []).map(function (h) { return String(h).trim(); });
    if (!SipanduPm.WAJIB[nama].every(function (k) { return header.indexOf(k) >= 0; })) return null;
    var baris = [];
    for (var i = 1; i < semua.length; i++) {
      if (!semua[i].some(function (c) { return c !== '' && c !== null; })) continue;
      var o = {}; header.forEach(function (h, j) { if (h) o[h] = semua[i][j]; });
      baris.push(o);
    }
    return { header: header, baris: baris };
  },
  num_: function (v) { var n = Number(v); return (v === '' || v === null || v === undefined || isNaN(n)) ? 0 : n; },

  /** Baris bergaya 03_PENERIMAAN dari semua tanggal PM_HARIAN TERVERIFIKASI; null bila tidak tersambung / struktur rusak. */
  barisV2: function () {
    if (SipanduPm._v2 !== undefined) return SipanduPm._v2;
    var hasil = null;
    try {
      var ss = SipanduPm.ss_();
      if (ss) {
        var hdr = SipanduPm.tabel_(ss, 'PM_HARIAN'), det = SipanduPm.tabel_(ss, 'DETAIL_PM_HARIAN'), ins = SipanduPm.tabel_(ss, 'MASTER_INSTANSI'), pic = SipanduPm.tabel_(ss, 'MASTER_PIC');
        if (hdr && det && ins && pic) {
          var insMap = {}, picMap = {}, tglMap = {};
          ins.baris.forEach(function (r) { insMap[r.ID_INSTANSI] = r; });
          pic.baris.forEach(function (r) { picMap[r.ID_PIC] = r; });
          hdr.baris.forEach(function (h) { if (String(h.STATUS).trim() === 'TERVERIFIKASI') tglMap[h.ID_PM_HARIAN] = h; });
          hasil = [];
          det.baris.forEach(function (d) {
            var h = tglMap[d.ID_PM_HARIAN]; if (!h) return;
            var iso = SipanduPm.iso_(h.TANGGAL); if (!iso) return;
            var pk = SipanduPm.num_(d.PK), pb = SipanduPm.num_(d.PB), bumil = SipanduPm.num_(d.BUMIL), busui = SipanduPm.num_(d.BUSUI), balita = SipanduPm.num_(d.BALITA);
            var kendaraan = String(d.NO_KENDARAAN === null || d.NO_KENDARAAN === undefined ? '' : d.NO_KENDARAAN).trim();
            if (pk + pb + bumil + busui + balita === 0 && kendaraan === '' && (d.PK === '' && d.PB === '' && d.BUMIL === '' && d.BUSUI === '' && d.BALITA === '')) return;   // baris kosong
            var i = insMap[d.ID_INSTANSI] || {}, p = picMap[d.ID_PIC] || {}, idPm = String(d.ID_INSTANSI);
            hasil.push({
              _row: -1, _sumber: 'SIPANDU_V2', _JENIS_PM: String(i.JENIS_INSTANSI || '').trim().toUpperCase(),
              ID_TRANSAKSI: 'TRX-' + iso.replace(/-/g, '') + '-' + idPm.replace(/-/g, ''), TANGGAL: iso, ID_PM: idPm, NAMA_PM: i.NAMA_INSTANSI || '',
              PORSI_KECIL: pk, PORSI_BESAR: pb, TENAGA_PENDIDIK: 0, BALITA: balita, BUMIL: bumil, BUSUI: busui, TOTAL: pk + pb + bumil + busui + balita,
              ID_PIC: d.ID_PIC || '', NAMA_PIC: p.NAMA_PIC || '', NO_KENDARAAN: kendaraan,
              WAKTU_INPUT: h.DIKONFIRMASI_PADA ? Utilities.formatDate(new Date(h.DIKONFIRMASI_PADA), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '', USER_INPUT: String(h.DIKONFIRMASI_OLEH || '')
            });
          });
        }
      }
    } catch (e) { hasil = null; }
    SipanduPm._v2 = hasil;
    return hasil;
  },

  /** Penerimaan harian terpadu. Tanggal yang ada di PM_HARIAN SIPANDU memakai SIPANDU (baris lama tanggal itu dilewati). */
  terpadu: function () {
    var lama = Db.readAll('PENERIMAAN'), baru = SipanduPm.barisV2();
    if (!baru) return lama;
    var tglBaru = {}; baru.forEach(function (r) { tglBaru[r.TANGGAL] = true; });
    return lama.filter(function (r) { return !tglBaru[r.TANGGAL]; }).concat(baru);
  }
};

/** Hubungkan (sekali): ganti GANTI_DENGAN_ID_SPREADSHEET dengan ID spreadsheet SIPANDU baru, lalu Run. Hasil di Execution log. */
function hubungkanSipanduPmHarian() {
  var ID = 'GANTI_DENGAN_ID_SPREADSHEET', log = function (t) { try { Logger.log(t); } catch (e) { /* abaikan */ } return t; };
  if (ID === 'GANTI_DENGAN_ID_SPREADSHEET') return log('BELUM DIISI: ganti teks GANTI_DENGAN_ID_SPREADSHEET pada fungsi hubungkanSipanduPmHarian dengan ID spreadsheet, lalu Run lagi.');
  try {
    var ss = SpreadsheetApp.openById(ID), masalah = Object.keys(SipanduPm.WAJIB).filter(function (n) { return !SipanduPm.tabel_(ss, n); });
    if (masalah.length) return log('GAGAL: sheet/kolom belum sesuai: ' + masalah.join(', '));
    PropertiesService.getScriptProperties().setProperty(SipanduPm.PROP, ID);
    return log('Tersambung ke "' + ss.getName() + '". SIPENDOK kini membaca PM Harian dari SIPANDU.');
  } catch (e) { return log('GAGAL: ' + e.message); }
}
function periksaSipanduPmHarian() { SipanduPm._v2 = undefined; var b = SipanduPm.barisV2(); try { Logger.log(b === null ? 'TIDAK TERSAMBUNG (atau struktur belum sesuai): SIPENDOK memakai 03_PENERIMAAN lama.' : 'TERSAMBUNG: ' + b.length + ' baris PM harian terverifikasi terbaca.'); } catch (e) { /* abaikan */ } }

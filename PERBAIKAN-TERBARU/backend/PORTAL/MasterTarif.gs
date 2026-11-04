/**
 * MasterTarif.gs — TARIF RELAWAN DENGAN TANGGAL BERLAKU (ditulis ulang 4 Nov 2026).
 *
 * KEPUTUSAN ADMIN (3 Nov 2026): penggajian MINGGUAN. Tarif = tarif HARIAN yang "berlaku mulai tanggal tertentu"
 * dan dikali jumlah hari hadir dalam rentang rekap (satu minggu, bukan satu periode). Periode tidak lagi dipakai.
 *
 * SUMBER TARIF (digabung, tidak ada data yang dibuang):
 *   - 26_MASTER_TARIF  : tarif bertanggal (MASTER). Dibuat/diubah lewat menu Master Tarif. Kolom:
 *                        ID_TARIF | ID_RELAWAN | JABATAN | TARIF_HARIAN | TANGGAL_BERLAKU | KETERANGAN | DIBUAT_PADA | DIBUAT_OLEH
 *                        (baris lama tanpa TANGGAL_BERLAKU = berlaku sejak awal).
 *   - 31_MASTER_TARIF  : riwayat tarif per periode (Okt 2026). Hanya DIBACA; tanggal berlakunya = tanggal mulai periodenya.
 *                        Bila periode sudah dihapus, baris itu tidak terbaca -> jalankan jalankanMigrasiTarifPeriodeKeMaster() dulu.
 * ATURAN: tarif relawan X pada tanggal T = tarif dengan tanggal berlaku TERBESAR yang <= T. Bila dua sumber punya
 * tanggal sama, MASTER menang. Tarif tidak ada = "belum diatur" (insentif 0 + ditandai).
 * Rentang rekap dipecah di setiap tanggal berlaku tarif, sehingga tiap HARI memakai tarif yang benar.
 */
var TARIF_RELAWAN = {
  SHEET: '26_MASTER_TARIF', SHEET_LAMA: '31_MASTER_TARIF', AWAL: '0000-01-01', MIN: 10000, MAKS: 1000000,
  KOLOM: ['ID_TARIF', 'ID_RELAWAN', 'JABATAN', 'TARIF_HARIAN', 'TANGGAL_BERLAKU', 'KETERANGAN', 'DIBUAT_PADA', 'DIBUAT_OLEH']
};

/** Sheet 26_ dengan kolom lengkap. Bila sheet lama hanya 4 kolom, kolom baru DITAMBAHKAN di kanan (data tidak berubah). */
function getSheetMasterTarif_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TARIF_RELAWAN.SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(TARIF_RELAWAN.SHEET);
    sheet.getRange(1, 1, 1, TARIF_RELAWAN.KOLOM.length).setValues([TARIF_RELAWAN.KOLOM]);
    return sheet;
  }
  const header = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  const kurang = TARIF_RELAWAN.KOLOM.filter(function (k) { return header.indexOf(k) < 0; });
  if (kurang.length) sheet.getRange(1, header.length + 1, 1, kurang.length).setValues([kurang]);
  return sheet;
}

/** Angka tarif dari sel: angka biasa, atau teks lama seperti "Rp 120.000" / "120.000" (titik/koma = pemisah ribuan). Selain itu 0. */
function tarifAngka_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (/^(rp\.?\s*)?\d{1,3}([.,]\d{3})+$/i.test(s) || /^(rp\.?\s*)?\d+$/i.test(s)) return Number(s.replace(/[^\d]/g, ''));
  return 0;
}
function tarifHariIniIso_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd'); }
function tarifSeninIso_(iso) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function tarifIsoValid_(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return false;
  const d = new Date(iso + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso && Number(m[1]) >= 2020 && Number(m[1]) <= 2100;
}
/** Nilai sel (Date atau teks) -> 'yyyy-MM-dd' atau ''. */
function tarifIsoSel_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}
function tambahHariIso_(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function awalPeriodePerId_() {
  const peta = {};
  getPeriodeRows_().forEach(function (p) {
    const iso = tanggalSheetKeIso_(bacaTanggalDMY_(p.TANGGAL_MULAI));
    if (p.ID_PERIODE && iso) peta[p.ID_PERIODE] = iso;
  });
  return peta;
}

/** Semua tarif per relawan: { idRelawan: [ {mulai, tarif, sumber, idTarif, jabatan, keterangan, dibuatOleh} ... ] } terurut naik. */
function kumpulkanTarif_() {
  const hasil = {};
  const tambah = function (id, e) { (hasil[id] = hasil[id] || []).push(e); };
  sheetToObjects(getSheetMasterTarif_()).forEach(function (r) {
    const t = tarifAngka_(r.TARIF_HARIAN);
    if (!r.ID_RELAWAN || !(t > 0)) return;
    tambah(String(r.ID_RELAWAN), { mulai: tarifIsoSel_(r.TANGGAL_BERLAKU) || TARIF_RELAWAN.AWAL, tarif: t, sumber: 'MASTER', idTarif: r.ID_TARIF, jabatan: r.JABATAN || '', keterangan: r.KETERANGAN || '', dibuatOleh: r.DIBUAT_OLEH || '' });
  });
  const sh31 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARIF_RELAWAN.SHEET_LAMA);
  if (sh31) {
    const awalPeriode = awalPeriodePerId_();
    sheetToObjects(sh31).forEach(function (r) {
      const t = tarifAngka_(r.TARIF_HARIAN), mulai = awalPeriode[r.ID_PERIODE], status = String(r.STATUS || 'AKTIF').toUpperCase();
      if (!r.ID_RELAWAN || !(t > 0) || !mulai || status === 'NONAKTIF') return;
      tambah(String(r.ID_RELAWAN), { mulai: mulai, tarif: t, sumber: 'RIWAYAT_PERIODE', idTarif: r.ID_TARIF || '', jabatan: '', keterangan: r.NAMA_PERIODE || '', dibuatOleh: '' });
    });
  }
  Object.keys(hasil).forEach(function (id) {
    hasil[id].sort(function (a, b) {
      if (a.mulai !== b.mulai) return a.mulai < b.mulai ? -1 : 1;
      return (a.sumber === b.sumber) ? 0 : (a.sumber === 'RIWAYAT_PERIODE' ? -1 : 1);   // seri: MASTER terakhir = menang
    });
  });
  return hasil;
}
function tarifBerlakuDi_(daftar, iso) {
  let hasil = null;
  (daftar || []).forEach(function (e) { if (e.mulai <= iso) hasil = e; });
  return hasil;
}
/** { cari(idRelawan, iso) -> angka|null, tanggalBerlaku:[iso...] terurut } */
function bangunPencariTarif_() {
  const semua = kumpulkanTarif_(), tgl = {};
  Object.keys(semua).forEach(function (id) { semua[id].forEach(function (e) { if (e.mulai !== TARIF_RELAWAN.AWAL) tgl[e.mulai] = true; }); });
  return {
    cari: function (idRelawan, iso) { const e = tarifBerlakuDi_(semua[String(idRelawan)], iso); return e ? e.tarif : null; },
    tanggalBerlaku: Object.keys(tgl).sort(),
    semua: semua
  };
}

// ======================= MASTER TARIF (layar) =======================
/** Tarif yang berlaku pada body.tanggal (default hari ini) untuk SEMUA relawan, + tarif mendatang bila sudah dijadwalkan. */
function getMasterTarifAdmin(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'SIPRES', 'VIEW');
  const iso = sanitize(body.tanggal) || tarifHariIniIso_();
  if (!tarifIsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  const semua = kumpulkanTarif_();
  const data = getRelawanList(null, false).map(function (r) {
    const daftar = semua[String(r.id)] || [], e = tarifBerlakuDi_(daftar, iso);
    const depan = daftar.filter(function (x) { return x.mulai > iso; })[0] || null;
    return { idRelawan: r.id, namaRelawan: r.nama, divisi: r.divisi,
             idTarif: e && e.sumber === 'MASTER' ? e.idTarif : null, jabatan: e ? e.jabatan : '',
             tarifHarian: e ? e.tarif : null, berlakuSejak: e && e.mulai !== TARIF_RELAWAN.AWAL ? e.mulai : '', sumber: e ? e.sumber : '',
             tarifMendatang: depan ? { tarif: depan.tarif, tanggal: depan.mulai } : null };
  });
  return { tanggal: iso, data: data, jumlahTanpaTarif: data.filter(function (d) { return d.tarifHarian === null; }).length };
}
/** Kompatibilitas: pemanggil lama (token saja) -> daftar tarif yang berlaku HARI INI. */
function getMasterTarifStandingAdmin(token) { return getMasterTarifAdmin({ token: token }).data; }

function getRiwayatTarifAdmin(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'SIPRES', 'VIEW');
  const id = sanitize(body.idRelawan);
  if (!id) throw new Error('ID relawan wajib diisi.');
  const daftar = (kumpulkanTarif_()[id] || []).slice().reverse();
  return { idRelawan: id, riwayat: daftar.map(function (e) { return { tanggalBerlaku: e.mulai === TARIF_RELAWAN.AWAL ? '' : e.mulai, tarifHarian: e.tarif, sumber: e.sumber, jabatan: e.jabatan, keterangan: e.keterangan, dibuatOleh: e.dibuatOleh }; }) };
}

/**
 * Simpan tarif harian dengan tanggal berlaku, untuk SATU atau BANYAK relawan sekaligus.
 * body: { token, tanggalBerlaku:'yyyy-MM-dd', keterangan?, konfirmasiSurut?, items:[{idRelawan, tarifHarian, jabatan?}] }
 * - Tanggal berlaku SEBELUM Senin minggu ini = berlaku SURUT (mengubah rekap minggu yang sudah lewat) -> wajib konfirmasiSurut:true.
 * - Baris (relawan, tanggal) yang sama diperbarui, bukan digandakan. Item yang tarifnya sudah sama dengan yang berlaku dilewati.
 */
function simpanTarifBerlakuAdmin(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'SIPRES', 'EDIT');
  const iso = sanitize(body.tanggalBerlaku);
  if (!tarifIsoValid_(iso)) throw new Error('Tanggal berlaku tidak valid.');
  if (!Array.isArray(body.items) || !body.items.length) throw new Error('Tidak ada tarif yang dikirim.');
  const hariIni = tarifHariIniIso_();
  if (iso < tarifSeninIso_(hariIni) && body.konfirmasiSurut !== true) {
    throw new Error('BERLAKU_SURUT: tanggal berlaku ' + iso + ' sudah lewat dan akan MENGUBAH rekap minggu yang sudah berjalan. Konfirmasi dulu bila memang disengaja.');
  }
  const items = [], lihat = {};
  body.items.forEach(function (it) {
    const id = sanitize(it.idRelawan);
    if (!id) throw new Error('Ada tarif tanpa relawan.');
    if (lihat[id]) throw new Error('Relawan ' + id + ' muncul lebih dari sekali.');
    lihat[id] = true;
    const s = String(it.tarifHarian === null || it.tarifHarian === undefined ? '' : it.tarifHarian).trim();
    if (!/^\d+$/.test(s)) throw new Error('Tarif ' + id + ' harus berupa angka bulat rupiah (tanpa titik/koma).');
    const t = Number(s);
    if (t < TARIF_RELAWAN.MIN) throw new Error('Tarif ' + id + ' (Rp' + t + ') terlalu kecil. Minimal Rp' + TARIF_RELAWAN.MIN + ' per hari (periksa jumlah nolnya).');
    if (t > TARIF_RELAWAN.MAKS) throw new Error('Tarif ' + id + ' (Rp' + t + ') terlalu besar. Maksimal Rp' + TARIF_RELAWAN.MAKS + ' per hari.');
    items.push({ id: id, tarif: t, jabatan: sanitize(it.jabatan) });
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ada = {}; getRelawanList(null, true).forEach(function (r) { ada[String(r.id)] = true; });
    items.forEach(function (it) { if (!ada[it.id]) throw new Error('Relawan ' + it.id + ' tidak ditemukan.'); });
    const sheet = getSheetMasterTarif_();
    const semua = sheet.getDataRange().getValues();
    const header = semua[0].map(function (h) { return String(h).trim(); });
    const kol = function (n) { return header.indexOf(n); };
    const tarifSekarang = kumpulkanTarif_();
    const sekarang = new Date(), ket = sanitize(body.keterangan);
    let baru = 0, diperbarui = 0, dilewati = 0, nomor = 0;
    semua.slice(1).forEach(function (r) { const m = /^TRF-(\d+)$/.exec(String(r[kol('ID_TARIF')] || '')); if (m) nomor = Math.max(nomor, Number(m[1])); });
    items.forEach(function (it) {
      let barisAda = -1;
      for (let i = 1; i < semua.length; i++) {
        if (String(semua[i][kol('ID_RELAWAN')]) === it.id && (tarifIsoSel_(semua[i][kol('TANGGAL_BERLAKU')]) || TARIF_RELAWAN.AWAL) === iso) { barisAda = i; break; }
      }
      if (barisAda >= 0) {
        const rowNo = barisAda + 1, lama = Number(semua[barisAda][kol('TARIF_HARIAN')]);
        if (lama === it.tarif && (!it.jabatan || it.jabatan === String(semua[barisAda][kol('JABATAN')] || ''))) { dilewati++; return; }
        sheet.getRange(rowNo, kol('JABATAN') + 1, 1, 2).setValues([[it.jabatan || semua[barisAda][kol('JABATAN')] || '', it.tarif]]);
        if (ket) sheet.getRange(rowNo, kol('KETERANGAN') + 1).setValue(ket);
        diperbarui++; return;
      }
      const berlaku = tarifBerlakuDi_(tarifSekarang[it.id], iso);
      if (berlaku && berlaku.tarif === it.tarif && !it.jabatan) { dilewati++; return; }    // sudah sama dengan yang berlaku: tidak perlu baris baru
      nomor++;
      const baris = header.map(function () { return ''; });
      baris[kol('ID_TARIF')] = 'TRF-' + ('00000' + nomor).slice(-5); baris[kol('ID_RELAWAN')] = it.id; baris[kol('JABATAN')] = it.jabatan;
      baris[kol('TARIF_HARIAN')] = it.tarif; baris[kol('TANGGAL_BERLAKU')] = new Date(iso + 'T00:00:00'); baris[kol('KETERANGAN')] = ket;
      baris[kol('DIBUAT_PADA')] = sekarang; baris[kol('DIBUAT_OLEH')] = aktor;
      sheet.appendRow(baris); baru++;
    });
    try { logAudit_('UBAH_TARIF_BERLAKU', 'SIPRES', items.length + ' relawan', aktor, { tanggalBerlaku: iso, baru: baru, diperbarui: diperbarui, dilewati: dilewati, surut: iso < tarifSeninIso_(hariIni), keterangan: ket }); } catch (e) { /* audit tidak boleh menggagalkan */ }
    return { tanggalBerlaku: iso, baru: baru, diperbarui: diperbarui, dilewati: dilewati };
  } finally { lock.releaseLock(); }
}

/** Kompatibilitas: pemanggil lama (1 relawan, tanpa tanggal) -> tarif berlaku MULAI HARI INI (tidak surut). */
function updateTarifRelawanAdmin(body) {
  const hasil = simpanTarifBerlakuAdmin({ token: body.token, tanggalBerlaku: sanitize(body.tanggalBerlaku) || tarifHariIniIso_(), keterangan: body.keterangan,
                                          items: [{ idRelawan: body.idRelawan, tarifHarian: body.tarifHarian, jabatan: body.jabatan }] });
  return { idTarif: null, idRelawan: sanitize(body.idRelawan), jabatan: sanitize(body.jabatan), tarifHarian: Number(body.tarifHarian), tanggalBerlaku: hasil.tanggalBerlaku };
}

/**
 * MIGRASI (jalankan MANUAL dari editor, SEBELUM 14_PERIODE_KERJA dihapus): salin riwayat tarif 31_MASTER_TARIF ke
 * 26_MASTER_TARIF sebagai tarif bertanggal (tanggal berlaku = awal periode). Hanya perubahan tarif yang disalin (tarif sama
 * berturut-turut digabung). Tarif < Rp10.000 (mis. salah ketik Rp200) dan baris yang periodenya tidak ada DILEWATI & dilaporkan.
 * Aman diulang (baris yang sudah ada tidak digandakan). Default = SIMULASI; panggil jalankanMigrasiTarifPeriodeKeMaster(true) untuk menulis.
 */
function jalankanMigrasiTarifPeriodeKeMaster(terapkan) {
  const lama = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARIF_RELAWAN.SHEET_LAMA);
  if (!lama) return { pesan: 'Sheet 31_MASTER_TARIF tidak ada; tidak ada yang dimigrasikan.' };
  const awalPeriode = awalPeriodePerId_(), perRelawan = {}, laporan = { periodeHilang: 0, tidakWajar: [], dilewatiSudahAda: 0, baru: 0, simulasi: terapkan !== true };
  sheetToObjects(lama).forEach(function (r) {
    const t = tarifAngka_(r.TARIF_HARIAN);
    if (!r.ID_RELAWAN || !(t > 0)) return;
    if (!awalPeriode[r.ID_PERIODE]) { laporan.periodeHilang++; return; }
    if (t < TARIF_RELAWAN.MIN) { laporan.tidakWajar.push(r.ID_RELAWAN + ' ' + (r.NAMA_PERIODE || r.ID_PERIODE) + ' Rp' + t); return; }
    (perRelawan[String(r.ID_RELAWAN)] = perRelawan[String(r.ID_RELAWAN)] || []).push({ mulai: awalPeriode[r.ID_PERIODE], tarif: t, periode: r.NAMA_PERIODE || r.ID_PERIODE });
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sheet = getSheetMasterTarif_(), semua = sheet.getDataRange().getValues(), header = semua[0].map(function (h) { return String(h).trim(); });
    const kol = function (n) { return header.indexOf(n); };
    const sudah = {}; let nomor = 0;
    semua.slice(1).forEach(function (r) {
      sudah[String(r[kol('ID_RELAWAN')]) + '|' + (tarifIsoSel_(r[kol('TANGGAL_BERLAKU')]) || TARIF_RELAWAN.AWAL)] = true;
      const m = /^TRF-(\d+)$/.exec(String(r[kol('ID_TARIF')] || '')); if (m) nomor = Math.max(nomor, Number(m[1]));
    });
    Object.keys(perRelawan).forEach(function (id) {
      const urut = perRelawan[id].sort(function (a, b) { return a.mulai < b.mulai ? -1 : 1; });
      let sebelumnya = null;
      urut.forEach(function (e) {
        if (sebelumnya !== null && e.tarif === sebelumnya) return;     // tarif tidak berubah: tidak perlu baris baru
        sebelumnya = e.tarif;
        if (sudah[id + '|' + e.mulai]) { laporan.dilewatiSudahAda++; return; }
        laporan.baru++;
        if (terapkan === true) {
          nomor++;
          const baris = header.map(function () { return ''; });
          baris[kol('ID_TARIF')] = 'TRF-' + ('00000' + nomor).slice(-5); baris[kol('ID_RELAWAN')] = id; baris[kol('TARIF_HARIAN')] = e.tarif;
          baris[kol('TANGGAL_BERLAKU')] = new Date(e.mulai + 'T00:00:00'); baris[kol('KETERANGAN')] = 'Migrasi dari 31_MASTER_TARIF (' + e.periode + ')';
          baris[kol('DIBUAT_PADA')] = new Date(); baris[kol('DIBUAT_OLEH')] = 'MIGRASI';
          sheet.appendRow(baris);
        }
      });
    });
  } finally { lock.releaseLock(); }
  return laporan;
}

/** Dari editor Apps Script: SIMULASI migrasi (tidak menulis apa pun). Hasil di Execution log. */
function simulasiMigrasiTarif() { const h = jalankanMigrasiTarifPeriodeKeMaster(false); try { Logger.log(JSON.stringify(h)); } catch (e) { /* abaikan */ } return h; }
/** Dari editor Apps Script: TERAPKAN migrasi (menulis ke 26_MASTER_TARIF). Jalankan simulasi dulu. Hasil di Execution log. */
function terapkanMigrasiTarif() { const h = jalankanMigrasiTarifPeriodeKeMaster(true); try { Logger.log(JSON.stringify(h)); } catch (e) { /* abaikan */ } return h; }

/** Rekap kehadiran + insentif utk rentang tanggal ISO. Dipakai Rekap Mingguan DAN Per Periode (lama). */
function hitungRekapInsentifRentang_(awalIso, akhirIso, token) {
  const pencari = bangunPencariTarif_(), cariTarif = pencari.cari;
  const rekening = {};   // utk transfer gaji; endpoint ini admin-only (requireAuth di pemanggil)
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).forEach(function (r) { rekening[String(r.ID_RELAWAN)] = (r.NOMOR_REKENING === null || r.NOMOR_REKENING === undefined) ? '' : String(r.NOMOR_REKENING); });
  // Pecah rentang di SETIAP tanggal berlaku tarif yang jatuh di dalamnya, supaya tiap hari memakai tarif yang benar.
  const batas = pencari.tanggalBerlaku.filter(function (d) { return d > awalIso && d <= akhirIso; });
  const titik = [awalIso].concat(batas);

  const agregat = {};
  const urutan = [];
  for (let i = 0; i < titik.length; i++) {
    const a = titik[i];
    const b = (i + 1 < titik.length) ? tambahHariIso_(titik[i + 1], -1) : akhirIso;
    const rek = getRekapDuaMinggu(a, b, token); // Absensi.gs: OBJEK {data:[...]}
    rek.data.forEach(function (r) {
      let x = agregat[r.id];
      if (!x) { x = agregat[r.id] = { harian: {}, id: r.id, namaRelawan: r.nama, divisi: r.divisi, hadir: 0, terlambat: 0, izin: 0, sakit: 0, tidakHadir: 0, totalHariKerja: 0, totalInsentif: 0, tarifTerakhir: null, tarifPakai: [], tarifKurang: false }; urutan.push(r.id); }
      Object.keys(r.harian || {}).forEach(function (k) { x.harian[k] = r.harian[k]; });
      x.hadir += r.hadir; x.terlambat += r.terlambat; x.izin += r.izin; x.sakit += r.sakit; x.tidakHadir += r.tidakHadir; x.totalHariKerja += r.totalHariKerja;
      const tarif = cariTarif(r.id, a);
      const hariBayar = r.hadir + r.terlambat;
      if (tarif) {
        x.tarifTerakhir = tarif; x.totalInsentif += tarif * hariBayar;
        if (hariBayar > 0 && x.tarifPakai.indexOf(tarif) < 0) x.tarifPakai.push(tarif);   // tarif yg BENAR2 dipakai utk hari dibayar
      }
      else if (hariBayar > 0) { x.tarifKurang = true; }
    });
  }
  return urutan.map(function (id) {
    const x = agregat[id];
    // tarifHarian: tarif yg dipakai utk hari dibayar; kalau berganti di tengah rentang -> null + tarifBervariasi.
    // Tanpa hari dibayar: tarif terakhir yg berlaku (info saja).
    const bervariasi = x.tarifPakai.length > 1;
    const tarifTampil = bervariasi ? null : (x.tarifPakai.length === 1 ? x.tarifPakai[0] : x.tarifTerakhir);
    return { id: x.id, namaRelawan: x.namaRelawan, divisi: x.divisi, nomorRekening: rekening[x.id] || '', hadir: x.hadir, terlambat: x.terlambat, izin: x.izin, sakit: x.sakit,
             tidakHadir: x.tidakHadir, totalHariKerja: x.totalHariKerja, tarifHarian: tarifTampil, tarifBervariasi: bervariasi,
             tarifLengkap: (x.tarifTerakhir !== null) && !x.tarifKurang, totalInsentif: x.totalInsentif, harian: x.harian };
  });
}

/**
 * Rekap kehadiran + gaji 1 PERIODE. Bentuk data sama dgn sebelumnya (+ tarifHarian).
 */
function getRekapPenggajianAdmin(body) {
  requireAuth(body.token);
  const idPeriode = sanitize(body.idPeriode);
  if (!idPeriode) throw new Error('Periode wajib dipilih.');
  const periode = getPeriodeById_(idPeriode);
  if (!periode) throw new Error('Periode tidak ditemukan.');
  const awalIso = tanggalSheetKeIso_(periode.tanggalMulai);
  const akhirIso = tanggalSheetKeIso_(periode.tanggalSelesai);
  if (!awalIso || !akhirIso) throw new Error('Tanggal periode tidak valid.');
  const data = hitungRekapInsentifRentang_(awalIso, akhirIso, body.token);
  return { data: data, jumlahBelumLengkap: data.filter(function (r) { return !r.tarifLengkap; }).length };
}

/**
 * Rekap Per MINGGU (SIPRES) -- rentang tanggal bebas (default di UI: Senin-Minggu).
 * Tidak memaksa durasi 7 hari. Rumus & tarif sama persis dgn Rekap Per Periode.
 */
function getRekapMingguanAdmin(body) {
  requireAuth(body.token);
  const tanggalAwal = sanitize(body.tanggalAwal);
  const tanggalAkhir = sanitize(body.tanggalAkhir);
  if (!tanggalAwal || !tanggalAkhir) throw new Error('Tanggal awal dan akhir wajib diisi.');
  if (tanggalAwal > tanggalAkhir) throw new Error('Tanggal awal tidak boleh setelah tanggal akhir.');
  const data = hitungRekapInsentifRentang_(tanggalAwal, tanggalAkhir, body.token);
  // 4 Nov 2026: daftar hari + status kalender, untuk kolom hari pada tampilan matriks (Sen..Min + tanggal). Rentang > 93 hari atau gagal -> daftar KOSONG (tampilan memakai rentang saja, bukan kolom separuh).
  let hari = [];
  try {
    const peta = kal2Peta_();
    if (kal2Geser_(tanggalAwal, 92) >= tanggalAkhir) for (let iso = tanggalAwal; iso <= tanggalAkhir; iso = kal2Geser_(iso, 1)) hari.push({ tanggal: iso, namaHari: KAL2_NAMA_HARI[kal2HariIndeks_(iso)], status: kal2StatusUi_(kal2Pilih_(peta[iso])) });
  } catch (e) { hari = []; }
  return { data: data, hari: hari, hariIni: (typeof kal2HariIni_ === 'function' ? kal2HariIni_() : ''), jumlahBelumLengkap: data.filter(function (r) { return !r.tarifLengkap; }).length, tanggalAwal: tanggalAwal, tanggalAkhir: tanggalAkhir };
}

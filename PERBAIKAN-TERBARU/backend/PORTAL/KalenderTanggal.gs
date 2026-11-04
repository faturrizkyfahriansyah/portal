/**
 * SPPG JEUNGJING — PORTAL
 * KalenderTanggal.gs — KALENDER OPERASIONAL PER TANGGAL, TANPA MEMILIH PERIODE (BARU 4 Nov 2026, permintaan Admin).
 *
 * Staff/Admin melihat dan mengisi status per TANGGAL: Operasional / Libur / Operasional Khusus (+divisi). Tidak ada konsep
 * "pilih periode" di layar. Data disimpan di sheet yang SAMA (15_KALENDER_OPERASIONAL) dengan format yang SAMA persis dengan
 * Kalender.gs, jadi semua pembaca lama (Roster, Jadwal, Absensi, SIKOP, ...) tetap bekerja. ID_PERIODE diisi OTOMATIS bila
 * tanggalnya jatuh di sebuah periode (tersembunyi dari layar), dan getKalenderRows_ mencocokkannya belakangan bila periodenya
 * dibuat kemudian.
 *
 * AKSES (mengikuti Kalender.gs lama, yang hanya memakai requireAuth): LIHAT = semua akun Pengelola termasuk Staff;
 * UBAH = Admin (bukan Staff). TIDAK memakai requireIzinModulBaru_ karena modul SIKOP belum punya baris izin dan
 * cekIzinModul_ menolak semua orang (termasuk Super Admin) untuk modul tanpa baris izin.
 * Status HANYA diisi manual (keputusan Admin): tidak ada tanggal yang otomatis operasional.
 */
const KAL2_MAKS_HARI = 93;
const KAL2_STATUS_UI = ['OPERASIONAL', 'LIBUR', 'OPERASIONAL_KHUSUS'];
const KAL2_NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function kal2IsoValid_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function kal2Geser_(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function kal2HariIndeks_(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
function kal2HariIni_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function kal2Dmy_(iso) { const p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

/** Periode yang memuat tanggal iso (null bila di luar semua periode). */
function kal2PeriodeMemuat_(daftarPeriode, iso) {
  if (!iso) return null;
  for (let i = 0; i < daftarPeriode.length; i++) {
    const mulai = tanggalSheetKeIso_(daftarPeriode[i].TANGGAL_MULAI), selesai = tanggalSheetKeIso_(daftarPeriode[i].TANGGAL_SELESAI);
    if (mulai && selesai && iso >= mulai && iso <= selesai) return daftarPeriode[i];
  }
  return null;
}
/** { 'yyyy-MM-dd': [baris,...] } dari 15_KALENDER_OPERASIONAL. */
function kal2Peta_() {
  const peta = {};
  getKalenderRows_().forEach(r => { const iso = tanggalSheetKeIso_(r.TANGGAL_OPERASIONAL); if (iso) (peta[iso] = peta[iso] || []).push(r); });
  return peta;
}
/** Bila satu tanggal punya >1 baris (mis. dari periode berbeda): pilih yang punya periode, lalu yang terakhir. */
function kal2Pilih_(daftar) {
  if (!daftar || !daftar.length) return null;
  const berperiode = daftar.filter(r => r.ID_PERIODE);
  return (berperiode.length ? berperiode : daftar)[(berperiode.length ? berperiode : daftar).length - 1];
}
function kal2DivisiArray_(r) { return r && r.DIVISI_KHUSUS ? String(r.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean) : []; }
function kal2StatusUi_(r) {
  if (!r) return 'BELUM_DIATUR';
  const st = String(r.STATUS || '').toUpperCase();
  if (st === 'LIBUR') return 'LIBUR';
  if (st === 'DIBATALKAN') return 'DIBATALKAN';
  return kal2DivisiArray_(r).length ? 'OPERASIONAL_KHUSUS' : 'OPERASIONAL';
}
function kal2CekRentang_(awal, akhir) {
  if (!kal2IsoValid_(awal) || !kal2IsoValid_(akhir) || awal > akhir) throw new Error('Rentang tanggal tidak valid.');
  if (kal2Geser_(awal, KAL2_MAKS_HARI - 1) < akhir) throw new Error('Rentang maksimal ' + KAL2_MAKS_HARI + ' hari.');
}

/** PM harian terverifikasi & menu per tanggal (kosong bila database SIPANDU baru belum tersambung). Membaca ringkas, tanpa RBAC SIPANDU. */
function kal2Tambahan_(awal, akhir) {
  const hasil = { pm: {}, menu: {}, tersambung: false };
  try {
    if (typeof v2Tersambung_ !== 'function' || !v2Tersambung_()) return hasil;
    hasil.tersambung = true;
    const n = v => { const x = v2Nilai_(v); return x === null ? 0 : x; };
    const hdr = v2Baca_('PM_HARIAN').baris.filter(h => { const t = v2Iso_(h.TANGGAL); return t >= awal && t <= akhir && v2Str_(h.STATUS) === 'TERVERIFIKASI'; });
    const perHdr = {}; v2Baca_('DETAIL').baris.forEach(d => { (perHdr[d.ID_PM_HARIAN] = perHdr[d.ID_PM_HARIAN] || []).push(d); });
    const aktifSet = {}; v2Baca_('INSTANSI').baris.forEach(i => { if (v2Str_(i.STATUS).toUpperCase() === 'AKTIF') aktifSet[i.ID_INSTANSI] = true; });   // instansi nonaktif tidak dihitung (Admin 4 Nov)
    hdr.forEach(h => {
      let total = 0, inst = 0;
      (perHdr[h.ID_PM_HARIAN] || []).filter(d => aktifSet[d.ID_INSTANSI]).forEach(d => { const t = n(d.PK) + n(d.PB) + n(d.BUMIL) + n(d.BUSUI) + n(d.BALITA); total += t; if (t > 0) inst++; });
      hasil.pm[v2Iso_(h.TANGGAL)] = { total: total, instansi: inst };
    });
    v2Baca_('MENU').baris.forEach(m => { const t = v2Iso_(m.TANGGAL); if (t >= awal && t <= akhir) hasil.menu[t] = v2Str_(m.STATUS); });
  } catch (e) { hasil.tersambung = false; hasil.pm = {}; hasil.menu = {}; }
  return hasil;
}

/** Status tiap tanggal pada rentang [tanggalAwal, tanggalAkhir] (maks 93 hari), plus total PM harian & status menu. */
function getKalenderRentangV2(body) {
  requireAuth(body.token, true);   // Staff boleh melihat
  const awal = sanitize(body.tanggalAwal), akhir = sanitize(body.tanggalAkhir);
  kal2CekRentang_(awal, akhir);
  const peta = kal2Peta_(), periode = getPeriodeRows_(), tambahan = kal2Tambahan_(awal, akhir), hari = [];
  for (let iso = awal; iso <= akhir; iso = kal2Geser_(iso, 1)) {
    const daftar = peta[iso] || [], r = kal2Pilih_(daftar), p = kal2PeriodeMemuat_(periode, iso);
    hari.push({
      tanggal: iso, hari: KAL2_NAMA_HARI[kal2HariIndeks_(iso)], status: kal2StatusUi_(r), keterangan: r ? String(r.KETERANGAN || '') : '',
      divisiKhusus: kal2DivisiArray_(r), idOperasional: r ? r.ID_OPERASIONAL : '', idPeriode: r ? (r.ID_PERIODE || '') : '',
      adaPeriode: !!p, duplikat: daftar.length > 1,
      pm: tambahan.pm[iso] || null, menu: tambahan.menu[iso] || null
    });
  }
  return { tanggalAwal: awal, tanggalAkhir: akhir, hariIni: kal2HariIni_(), pmTersambung: tambahan.tersambung, hari: hari,
           ringkasan: { operasional: hari.filter(h => h.status === 'OPERASIONAL').length, khusus: hari.filter(h => h.status === 'OPERASIONAL_KHUSUS').length,
                        libur: hari.filter(h => h.status === 'LIBUR').length, belumDiatur: hari.filter(h => h.status === 'BELUM_DIATUR').length } };
}

/** Nilai kolom sheet dari status UI. */
function kal2NilaiSheet_(status, divisi) {
  if (status === 'LIBUR') return { STATUS: 'LIBUR', DIVISI_KHUSUS: '' };
  if (status === 'OPERASIONAL_KHUSUS') return { STATUS: 'AKTIF', DIVISI_KHUSUS: divisi.join(', ') };
  return { STATUS: 'AKTIF', DIVISI_KHUSUS: '' };
}
function kal2CekStatus_(body) {
  const status = sanitize(body.status).toUpperCase();
  if (KAL2_STATUS_UI.indexOf(status) < 0) throw new Error('Status tidak valid. Pilihan: Operasional, Libur, atau Operasional Khusus.');
  const divisi = Array.isArray(body.divisiKhusus) ? body.divisiKhusus.map(d => sanitize(d)).filter(Boolean) : [];
  if (status === 'OPERASIONAL_KHUSUS') {
    if (!divisi.length) throw new Error('Operasional Khusus wajib memilih minimal satu divisi yang beroperasi.');
    // Pembaca lama (Roster, JadwalIndividu, Absensi, ...) mencocokkan DIVISI_KHUSUS PERSIS dengan relawan.divisi, yang
    // tersimpan HURUF KAPITAL ("SECURITY"). Validasi tanpa membedakan besar/kecil, simpan dalam KAPITAL.
    const valid = getDivisiList().map(d => String(typeof d === 'string' ? d : (d && (d.nama || d.NAMA)) || '').toUpperCase());
    divisi.forEach(d => { if (valid.indexOf(d.toUpperCase()) < 0) throw new Error('Divisi "' + d + '" tidak dikenal.'); });
  }
  const ket = sanitize(body.keterangan);
  if (ket.length > 200) throw new Error('Keterangan maksimal 200 karakter.');
  return { status: status, divisi: status === 'OPERASIONAL_KHUSUS' ? divisi.map(d => d.toUpperCase()).filter((d, i, arr) => arr.indexOf(d) === i) : [], keterangan: ket };
}
/** Tanggal yang sudah punya PM harian terverifikasi (kalau DB SIPANDU tersambung) -- perubahan jadi LIBUR/hapus butuh konfirmasi. */
function kal2TanggalBerPm_(daftarIso) {
  if (!daftarIso.length) return [];
  const t = kal2Tambahan_(daftarIso[0], daftarIso[daftarIso.length - 1]);
  return daftarIso.filter(i => t.pm[i] && t.pm[i].total > 0);
}
function kal2TambahBaris_(sheet, iso, nilai, ket) {
  tambahKolomJikaBelumAda_(NAMA_SHEET.KALENDER, ['DIVISI_KHUSUS']);
  const idx = akunHeaderIndex_(sheet), dmy = kal2Dmy_(iso);
  let p = kal2PeriodeMemuat_(getPeriodeRows_(), iso);
  if (!p && nilai.STATUS === 'AKTIF') p = kal2PastikanPeriode_(iso);   // tanggal operasional di luar semua periode -> periode dibuat otomatis (tersembunyi)
  const id = generateIdOperasional_(sheet), baris = new Array(sheet.getLastColumn()).fill('');
  baris[idx.ID_OPERASIONAL] = id; baris[idx.ID_PERIODE] = p ? p.ID_PERIODE : ''; baris[idx.TANGGAL_OPERASIONAL] = dmy; baris[idx.HARI] = KAL2_NAMA_HARI[kal2HariIndeks_(iso)];
  baris[idx.STATUS] = nilai.STATUS; baris[idx.KETERANGAN] = ket; baris[idx.DIVISI_KHUSUS] = nilai.DIVISI_KHUSUS;
  sheet.appendRow(baris);
  const bt = sheet.getLastRow();
  paksaKolomTeks_(sheet, bt, idx.TANGGAL_OPERASIONAL + 1);
  sheet.getRange(bt, idx.TANGGAL_OPERASIONAL + 1).setValue(dmy);
  _invalidasiCacheKalender_();
  if (p) { try { buatRosterUntukOperasional_(id, 'ADMIN'); } catch (e) { /* roster opsional, jangan gagalkan aksi utama (sama seperti Kalender.gs) */ } }
  return { id: id, idPeriode: p ? p.ID_PERIODE : '' };
}
function kal2UbahBaris_(sheet, r, nilai, ket) {
  const idx = akunHeaderIndex_(sheet), data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_OPERASIONAL]) !== String(r.ID_OPERASIONAL)) continue;
    tambahKolomJikaBelumAda_(NAMA_SHEET.KALENDER, ['DIVISI_KHUSUS']);
    const idx2 = akunHeaderIndex_(sheet), iso = tanggalSheetKeIso_(r.TANGGAL_OPERASIONAL);
    let p = kal2PeriodeMemuat_(getPeriodeRows_(), iso);
    if (!p && nilai.STATUS === 'AKTIF') p = kal2PastikanPeriode_(iso);
    sheet.getRange(i + 1, idx2.STATUS + 1).setValue(nilai.STATUS);
    sheet.getRange(i + 1, idx2.KETERANGAN + 1).setValue(ket);
    sheet.getRange(i + 1, idx2.DIVISI_KHUSUS + 1).setValue(nilai.DIVISI_KHUSUS);
    if (!data[i][idx2.ID_PERIODE] && p) sheet.getRange(i + 1, idx2.ID_PERIODE + 1).setValue(p.ID_PERIODE);
    _invalidasiCacheKalender_();
    if (nilai.STATUS === 'AKTIF' && String(r.STATUS).toUpperCase() !== 'AKTIF' && p) { try { buatRosterUntukOperasional_(r.ID_OPERASIONAL, 'ADMIN'); } catch (e) { /* opsional */ } }
    return true;
  }
  throw new Error('Baris kalender tidak ditemukan (mungkin baru saja diubah orang lain). Muat ulang.');
}

/** Isi/ubah status SATU tanggal. body: { token, tanggal, status, divisiKhusus?, keterangan?, konfirmasi? } */
function simpanKalenderTanggalV2(body) {
  const aktor = requireAuth(body.token);
  const iso = sanitize(body.tanggal);
  if (!kal2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  const cek = kal2CekStatus_(body), nilai = kal2NilaiSheet_(cek.status, cek.divisi);
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    _invalidasiCacheKalender_();
    const r = kal2Pilih_(kal2Peta_()[iso]);
    if (cek.status === 'LIBUR' && kal2TanggalBerPm_([iso]).length && body.konfirmasi !== true) {
      throw new Error('DAMPAK: tanggal ' + kal2Dmy_(iso) + ' sudah punya PM harian terverifikasi. Menjadikannya Libur membuat datanya janggal. Konfirmasi dulu bila memang disengaja.');
    }
    const sheet = getKalenderSheet();
    let hasil;
    if (r) { kal2UbahBaris_(sheet, r, nilai, cek.keterangan); hasil = { id: r.ID_OPERASIONAL, baru: false }; }
    else { const b = kal2TambahBaris_(sheet, iso, nilai, cek.keterangan); hasil = { id: b.id, baru: true }; }
    logAudit_(r ? 'UBAH_KALENDER_TANGGAL' : 'TAMBAH_KALENDER_TANGGAL', 'KALENDER', hasil.id, aktor, { tanggal: iso, status: cek.status, divisi: cek.divisi, sebelumnya: kal2StatusUi_(r) });
    return { tanggal: iso, status: cek.status, id: hasil.id, baru: hasil.baru };
  } finally { lock.releaseLock(); }
}

/** Kosongkan status satu tanggal (kembali "Belum diatur"). body: { token, tanggal, konfirmasi? } */
function hapusKalenderTanggalV2(body) {
  const aktor = requireAuth(body.token);
  const iso = sanitize(body.tanggal);
  if (!kal2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    _invalidasiCacheKalender_();
    const daftar = kal2Peta_()[iso] || [];
    if (!daftar.length) throw new Error('Tanggal ini memang belum diatur.');
    if (kal2TanggalBerPm_([iso]).length && body.konfirmasi !== true) throw new Error('DAMPAK: tanggal ' + kal2Dmy_(iso) + ' sudah punya PM harian terverifikasi. Konfirmasi dulu bila memang disengaja.');
    const sheet = getKalenderSheet(), idx = akunHeaderIndex_(sheet), data = sheet.getDataRange().getValues(), idHapus = daftar.map(x => String(x.ID_OPERASIONAL));
    let dihapus = 0;
    for (let i = data.length - 1; i >= 1; i--) { if (idHapus.indexOf(String(data[i][idx.ID_OPERASIONAL])) >= 0) { sheet.deleteRow(i + 1); dihapus++; } }
    _invalidasiCacheKalender_();
    logAudit_('HAPUS_KALENDER_TANGGAL', 'KALENDER', idHapus.join(','), aktor, { tanggal: iso, sebelumnya: kal2StatusUi_(kal2Pilih_(daftar)) });
    return { tanggal: iso, dihapus: dihapus };
  } finally { lock.releaseLock(); }
}

/**
 * Isi status banyak tanggal sekaligus (NYICIL per bulan, tetap dipilih Admin -- BUKAN otomatis).
 * body: { token, tanggalAwal, tanggalAkhir, hari:[0..6] (0=Minggu), status, divisiKhusus?, keterangan?, timpa?, pratinjau?, konfirmasi? }
 * Tanggal yang sudah punya status dilewati kecuali timpa:true. pratinjau:true hanya menghitung.
 */
function simpanKalenderMassalV2(body) {
  const aktor = requireAuth(body.token);
  const awal = sanitize(body.tanggalAwal), akhir = sanitize(body.tanggalAkhir);
  kal2CekRentang_(awal, akhir);
  const hari = Array.isArray(body.hari) ? body.hari.map(Number).filter(h => h >= 0 && h <= 6) : [];
  if (!hari.length) throw new Error('Pilih minimal satu hari dalam seminggu.');
  const cek = kal2CekStatus_(body), nilai = kal2NilaiSheet_(cek.status, cek.divisi), timpa = body.timpa === true, pratinjau = body.pratinjau === true;
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    _invalidasiCacheKalender_();
    const peta = kal2Peta_(), baru = [], ubah = [], lewati = [];
    for (let iso = awal; iso <= akhir; iso = kal2Geser_(iso, 1)) {
      if (hari.indexOf(kal2HariIndeks_(iso)) < 0) continue;
      const r = kal2Pilih_(peta[iso]);
      if (!r) baru.push(iso); else if (timpa) ubah.push(iso); else lewati.push(iso);
    }
    const bermasalah = cek.status === 'LIBUR' ? kal2TanggalBerPm_(ubah) : [];
    if (bermasalah.length && !pratinjau && body.konfirmasi !== true) throw new Error('DAMPAK: ' + bermasalah.length + ' tanggal (mis. ' + kal2Dmy_(bermasalah[0]) + ') sudah punya PM harian terverifikasi. Konfirmasi dulu bila memang disengaja.');
    const ringkas = { dibuat: baru.length, diperbarui: ubah.length, dilewati: lewati.length, tanggalBaru: baru, tanggalDiperbarui: ubah, tanggalDilewati: lewati, bermasalahPm: bermasalah, pratinjau: pratinjau };
    if (pratinjau) return ringkas;
    const sheet = getKalenderSheet();
    baru.forEach(iso => kal2TambahBaris_(sheet, iso, nilai, cek.keterangan));
    ubah.forEach(iso => { _invalidasiCacheKalender_(); kal2UbahBaris_(sheet, kal2Pilih_(kal2Peta_()[iso]), nilai, cek.keterangan); });
    logAudit_('KALENDER_MASSAL', 'KALENDER', awal + '..' + akhir, aktor, { status: cek.status, hari: hari, dibuat: baru.length, diperbarui: ubah.length, dilewati: lewati.length, timpa: timpa });
    return ringkas;
  } finally { lock.releaseLock(); }
}

// ================= PERIODE OTOMATIS (menu Periode Kerja disembunyikan; kendali ada di Kalender Operasional) =================
const KAL2_BULAN3 = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
function kal2NamaPeriode_(mulai, selesai) {
  const f = iso => iso.slice(8, 10) + ' ' + KAL2_BULAN3[Number(iso.slice(5, 7)) - 1];
  return mulai === selesai ? f(mulai) + ' ' + mulai.slice(0, 4) : f(mulai) + ' - ' + f(selesai) + ' ' + selesai.slice(0, 4);
}
function kal2BuatPeriode_(mulai, selesai) {
  const sheet = getPeriodeSheet(), id = generateIdPeriode_(sheet), dm = kal2Dmy_(mulai), ds = kal2Dmy_(selesai);
  sheet.appendRow([id, kal2NamaPeriode_(mulai, selesai), dm, ds, 'DRAFT', 'Dibuat otomatis dari Kalender Operasional']);
  const baris = sheet.getLastRow();
  paksaKolomTeks_(sheet, baris, 3); sheet.getRange(baris, 3).setValue(dm);
  paksaKolomTeks_(sheet, baris, 4); sheet.getRange(baris, 4).setValue(ds);
  if (typeof _cachePeriodeRows !== 'undefined') _cachePeriodeRows = null;
  _invalidasiCacheKalender_();
  logAudit_('BUAT_PERIODE_OTOMATIS', 'PERIODE', id, 'SISTEM', { mulai: mulai, selesai: selesai });
  return id;
}
/**
 * Pastikan ada periode yang memuat tanggal operasional iso; bila tidak, buat otomatis (status DRAFT) mengikuti POLA yang sudah dipakai Admin:
 * blok 13 hari Minggu-Jumat yang berurutan (Sabtu minggu ke-2 menjadi pemisah). Tanggal di luar pola (Sabtu pemisah, atau di sela periode
 * yang sudah ada) mendapat periode 1 hari. Membuat paling banyak 30 blok ke depan. Mengembalikan baris periode yang memuat iso.
 */
function kal2PastikanPeriode_(iso) {
  const ada = kal2PeriodeMemuat_(getPeriodeRows_(), iso);
  if (ada) return ada;
  let akhirTerakhir = '';
  getPeriodeRows_().forEach(p => { const s = tanggalSheetKeIso_(p.TANGGAL_SELESAI); if (s && s > akhirTerakhir) akhirTerakhir = s; });
  if (!akhirTerakhir || iso <= akhirTerakhir) { kal2BuatPeriode_(iso, iso); }                  // di sela periode / sebelum semua periode
  else {
    let mulai = kal2Geser_(akhirTerakhir, 7 - ((kal2HariIndeks_(akhirTerakhir) + 7) % 7) || 7);   // Minggu berikutnya setelah periode terakhir
    if (kal2HariIndeks_(mulai) !== 0) mulai = kal2Geser_(mulai, (7 - kal2HariIndeks_(mulai)) % 7);
    for (let n = 0; n < 30; n++) {
      const akhir = kal2Geser_(mulai, 12);
      if (iso < mulai) { kal2BuatPeriode_(iso, iso); break; }                                     // Sabtu pemisah sebelum blok berikutnya
      if (iso <= akhir) { kal2BuatPeriode_(mulai, akhir); break; }
      kal2BuatPeriode_(mulai, akhir); mulai = kal2Geser_(mulai, 14);
    }
  }
  return kal2PeriodeMemuat_(getPeriodeRows_(), iso);
}
let _kal2SinkronSudah = '';
/**
 * Status periode mengikuti TANGGAL (tanpa menunggu menu Periode, yang disembunyikan): periode yang memuat HARI INI menjadi AKTIF, dan
 * periode berstatus AKTIF yang sudah lewat menjadi SELESAI. Tidak menyentuh DITUTUP/SELESAI. Bila hari ini jatuh di sela periode
 * (mis. Sabtu pemisah) tidak ada yang diubah, sehingga perilaku lama (periode AKTIF terakhir) tetap berlaku.
 * Dipanggil oleh getPeriodeAktif_ dan dashboard admin; idempoten dan hanya menulis saat ada perubahan.
 */
function sinkronStatusPeriodeOtomatis_() {
  try {
    const hariIni = kal2HariIni_();
    if (_kal2SinkronSudah === hariIni) return false;
    const sheet = getPeriodeSheet(), data = sheet.getDataRange().getValues(), h = data[0].map(String);
    const iM = h.indexOf('TANGGAL_MULAI'), iS = h.indexOf('TANGGAL_SELESAI'), iSt = h.indexOf('STATUS');
    if (iM < 0 || iS < 0 || iSt < 0) return false;
    const iso = v => tanggalSheetKeIso_(bacaTanggalDMY_(v)), st = r => String(data[r][iSt] || '').toUpperCase();
    let hariIniIdx = -1;
    for (let i = 1; i < data.length; i++) { const m = iso(data[i][iM]), e = iso(data[i][iS]); if (m && e && hariIni >= m && hariIni <= e && st(i) !== 'DITUTUP' && st(i) !== 'SELESAI') hariIniIdx = i; }
    _kal2SinkronSudah = hariIni;
    if (hariIniIdx < 0) return false;
    let ubah = false;
    if (st(hariIniIdx) !== 'AKTIF') { sheet.getRange(hariIniIdx + 1, iSt + 1).setValue('AKTIF'); ubah = true; }
    for (let i = 1; i < data.length; i++) {
      if (i === hariIniIdx || st(i) !== 'AKTIF') continue;
      const e = iso(data[i][iS]);
      if (e && e < hariIni) { sheet.getRange(i + 1, iSt + 1).setValue('SELESAI'); ubah = true; }
    }
    if (ubah) { if (typeof _cachePeriodeRows !== 'undefined') _cachePeriodeRows = null; logAudit_('SINKRON_STATUS_PERIODE', 'PERIODE', '-', 'SISTEM', { hariIni: hariIni }); }
    return ubah;
  } catch (e) { return false; }
}


/**
 * DETAIL PM satu tanggal untuk Kalender (BARU 4 Nov 2026): tiap instansi dengan kategori yang RELEVAN menurut jenisnya (Sekolah: PK & PB;
 * Posyandu: Ibu Hamil, Ibu Menyusui, Balita), total per instansi, kendaraan, PIC, serta menu. Instansi nonaktif tidak dihitung (jumlahnya dilaporkan).
 * Staff boleh melihat (data operasional, tanpa nominal uang). body: { token, tanggal }
 */
function getKalenderDetailPmV2(body) {
  requireAuth(body.token, true);
  const iso = sanitize(body.tanggal);
  if (!kal2IsoValid_(iso)) throw new Error('Tanggal tidak valid.');
  if (typeof v2Tersambung_ !== 'function' || !v2Tersambung_()) return { tersedia: false, tanggal: iso, pesan: 'Database SIPANDU belum disambungkan.' };
  const n = v => { const x = v2Nilai_(v); return x === null ? null : x; };
  // Bentuk SAMA dgn kartu dashboard (getRingkasanPmDashboard / getMenuHariIniDashboard) agar Kalender menampilkan rincian PERSIS seperti dashboard (Admin 4 Nov).
  const dashboard = v2RingkasanPmDashboard_(iso, true), menuDashboard = v2MenuTanggalDashboard_(iso);
  const header = v2Baca_('PM_HARIAN').baris.filter(h => v2Iso_(h.TANGGAL) === iso && v2Str_(h.STATUS) === 'TERVERIFIKASI')[0] || null;
  const menuRow = v2Baca_('MENU').baris.filter(m => v2Iso_(m.TANGGAL) === iso)[0] || null;
  const menu = menuRow ? { status: v2Str_(menuRow.STATUS), karbohidrat: v2Str_(menuRow.KARBOHIDRAT), laukHewani: v2Str_(menuRow.LAUK_HEWANI), laukNabati: v2Str_(menuRow.LAUK_NABATI), sayur: v2Str_(menuRow.SAYUR), buah: v2Str_(menuRow.BUAH), perlengkapan: v2Str_(menuRow.PERLENGKAPAN) } : null;
  if (!header) return { tersedia: true, tanggal: iso, header: null, instansi: [], total: { pk: 0, pb: 0, bumil: 0, busui: 0, balita: 0, porsi: 0, instansi: 0 }, nonaktifTersembunyi: { instansi: 0, porsi: 0 }, menu: menu, dashboard: dashboard, menuDashboard: menuDashboard };
  const ins = {}; v2Baca_('INSTANSI').baris.forEach(i => { ins[i.ID_INSTANSI] = i; });
  const pic = {}; v2Baca_('PIC').baris.forEach(p => { pic[p.ID_PIC] = p; });
  const tot = { pk: 0, pb: 0, bumil: 0, busui: 0, balita: 0, porsi: 0, instansi: 0 }, tersembunyi = { instansi: 0, porsi: 0 }, baris = [];
  v2Baca_('DETAIL').baris.filter(d => d.ID_PM_HARIAN === header.ID_PM_HARIAN).forEach(d => {
    const i = ins[d.ID_INSTANSI]; if (!i) return;
    const nilai = { pk: n(d.PK), pb: n(d.PB), bumil: n(d.BUMIL), busui: n(d.BUSUI), balita: n(d.BALITA) };
    const jumlah = ['pk', 'pb', 'bumil', 'busui', 'balita'].reduce((s, k) => s + (nilai[k] || 0), 0), ada = ['pk', 'pb', 'bumil', 'busui', 'balita'].some(k => nilai[k] !== null);
    if (v2Str_(i.STATUS).toUpperCase() !== 'AKTIF') { if (ada) { tersembunyi.instansi++; tersembunyi.porsi += jumlah; } return; }
    if (!ada && !v2Str_(d.NO_KENDARAAN)) return;
    let relevan = v2KategoriJenis_(i.JENIS_INSTANSI).map(k => k.toLowerCase());
    ['pk', 'pb', 'bumil', 'busui', 'balita'].forEach(k => { if (relevan.indexOf(k) < 0 && nilai[k] !== null && nilai[k] > 0) relevan.push(k); });   // di luar jenis hanya bila BERISI (>0)
    ['pk', 'pb', 'bumil', 'busui', 'balita'].forEach(k => { tot[k] += nilai[k] || 0; });
    tot.porsi += jumlah; if (jumlah > 0) tot.instansi++;
    baris.push({ idInstansi: i.ID_INSTANSI, nama: i.NAMA_INSTANSI, jenis: v2Str_(i.JENIS_INSTANSI).toUpperCase(), urutan: v2Nilai_(i.URUTAN_TAMPIL), kategori: ['pk', 'pb', 'bumil', 'busui', 'balita'].filter(k => relevan.indexOf(k) >= 0), nilai: nilai, total: jumlah,
                 noKendaraan: v2Str_(d.NO_KENDARAAN), namaPic: d.ID_PIC && pic[d.ID_PIC] ? v2Str_(pic[d.ID_PIC].NAMA_PIC) : '' });
  });
  baris.sort((a, b) => ((a.urutan === null ? 9999 : a.urutan) - (b.urutan === null ? 9999 : b.urutan)) || String(a.nama).localeCompare(String(b.nama)));
  return { tersedia: true, tanggal: iso, header: { status: v2Str_(header.STATUS), dikonfirmasiOleh: v2Str_(header.DIKONFIRMASI_OLEH), dikonfirmasiPada: header.DIKONFIRMASI_PADA ? Utilities.formatDate(new Date(header.DIKONFIRMASI_PADA), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '' },
           instansi: baris, total: tot, nonaktifTersembunyi: tersembunyi, menu: menu, dashboard: dashboard, menuDashboard: menuDashboard };
}

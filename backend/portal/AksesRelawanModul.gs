/**
 * SPPG JEUNGJING — PORTAL
 * AksesRelawanModul.gs — AKSES PER RELAWAN untuk SIPENDOK, SIPOGIM, dan SIPRES QR (BARU 4 Nov 2026, permintaan Admin).
 *
 * Ketiga aplikasi ini dibuka TANPA LOGIN. Hak aksesnya diatur di Manajemen Hak Akses: tombolnya TAMPIL di portal semua relawan, tetapi hanya
 * relawan yang diberi akses di sini yang bisa membukanya (yang lain melihat gembok). Data: sheet 35_AKSES_RELAWAN_MODUL, satu baris = satu
 * pemberian akses (ID_RELAWAN, KODE_MODUL). Dibaca getAksesModulSaya (ManajemenHakAkses.gs) untuk menentukan gembok.
 *
 * CATATAN KEAMANAN (jujur): karena aplikasinya sendiri tanpa login, ini mengendalikan TOMBOL/PINTU di portal, bukan menutup aplikasi bagi orang
 * yang sudah tahu alamat langsungnya.
 */
const MODUL_AKSES_RELAWAN = [
  { kode: 'SIPENDOK', nama: 'SIPENDOK — Dokumen Penerimaan', deskripsi: 'Generate dokumen Surat Jalan/BAST dan arsip.', tautan: 'sipendok/index.html' },
  { kode: 'SIPOGIM', nama: 'SIPOGIM — Gizi & Menu', deskripsi: 'Bahan, resep, kalkulator gizi, dan riwayat menu.', tautan: 'sipogim/beranda.html' },
  { kode: 'SIPRES_QR', nama: 'SIPRES QR — Absensi QR', deskripsi: 'Pemindaian QR kehadiran.', tautan: 'absensi-qr.html' }
];
const AKSES_RELAWAN_SHEET_NAME = '35_AKSES_RELAWAN_MODUL';
const AKSES_RELAWAN_HEADER = ['ID_RELAWAN', 'KODE_MODUL', 'DIBERIKAN_PADA', 'DIBERIKAN_OLEH'];

function aksesRelawanKodeValid_(kode) { return MODUL_AKSES_RELAWAN.some(m => m.kode === kode); }
/** Sheet pemberian akses; dibuat otomatis bila belum ada (hanya dipanggil dari jalur TULIS). */
function getAksesRelawanSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(AKSES_RELAWAN_SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(AKSES_RELAWAN_SHEET_NAME); sh.getRange(1, 1, 1, AKSES_RELAWAN_HEADER.length).setValues([AKSES_RELAWAN_HEADER]); }
  return sh;
}
/** { 'idRelawan|KODE': true } -- tanpa membuat sheet bila belum ada. */
function aksesRelawanPeta_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AKSES_RELAWAN_SHEET_NAME), peta = {};
  if (!sh || sh.getLastRow() < 2) return peta;
  sh.getDataRange().getValues().slice(1).forEach(r => { if (r[0] && r[1]) peta[String(r[0]).trim() + '|' + String(r[1]).trim()] = true; });
  return peta;
}
/** Modul (di antara ketiganya) yang boleh dibuka relawan ini: { SIPENDOK: true, ... } */
function aksesRelawanSet_(idRelawan) {
  const peta = aksesRelawanPeta_(), hasil = {};
  MODUL_AKSES_RELAWAN.forEach(m => { hasil[m.kode] = !!peta[String(idRelawan).trim() + '|' + m.kode]; });
  return hasil;
}

/** Matriks relawan AKTIF x 3 modul. body: { token } */
function getAksesRelawanModul(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'MANAJEMEN_PENGGUNA', 'VIEW');
  const peta = aksesRelawanPeta_(), relawan = getRelawanList(null, false);
  const baris = relawan.map(r => { const akses = {}; MODUL_AKSES_RELAWAN.forEach(m => { akses[m.kode] = !!peta[String(r.id) + '|' + m.kode]; }); return { id: r.id, nama: r.nama, divisi: r.divisi, akses: akses }; })
    .sort((a, b) => String(a.divisi).localeCompare(String(b.divisi)) || String(a.nama).localeCompare(String(b.nama)));
  const divisi = []; baris.forEach(b => { if (b.divisi && divisi.indexOf(b.divisi) < 0) divisi.push(b.divisi); });
  return {
    modul: MODUL_AKSES_RELAWAN.map(m => ({ kode: m.kode, nama: m.nama, deskripsi: m.deskripsi, tautan: m.tautan, jumlah: baris.filter(b => b.akses[m.kode]).length })),
    relawan: baris, divisi: divisi, jumlahRelawan: baris.length
  };
}

/** Beri/cabut akses. body: { token, kodeModul, beri:[idRelawan], cabut:[idRelawan] } (maks 500 id per panggilan). Idempoten. */
function simpanAksesRelawanModul(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'MANAJEMEN_PENGGUNA', 'EDIT');
  const kode = sanitize(body.kodeModul);
  if (!aksesRelawanKodeValid_(kode)) throw new Error('Modul tidak dikenal. Pilihan: ' + MODUL_AKSES_RELAWAN.map(m => m.kode).join(', ') + '.');
  const beri = Array.isArray(body.beri) ? body.beri.map(x => sanitize(x)).filter(Boolean) : [], cabut = Array.isArray(body.cabut) ? body.cabut.map(x => sanitize(x)).filter(Boolean) : [];
  if (!beri.length && !cabut.length) throw new Error('Tidak ada perubahan yang dikirim.');
  if (beri.length > 500 || cabut.length > 500) throw new Error('Maksimal 500 relawan per penyimpanan.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const aktif = {}; getRelawanList(null, false).forEach(r => { aktif[String(r.id)] = true; });
    beri.forEach(id => { if (!aktif[id]) throw new Error('Relawan "' + id + '" tidak ditemukan atau tidak aktif.'); });
    const sh = getAksesRelawanSheet_(), data = sh.getDataRange().getValues(), ada = {};
    for (let i = 1; i < data.length; i++) if (String(data[i][1]).trim() === kode) ada[String(data[i][0]).trim()] = true;
    let diberi = 0, dicabut = 0, dilewati = 0;
    const sekarang = new Date();
    beri.filter((id, i, a) => a.indexOf(id) === i).forEach(id => { if (ada[id]) { dilewati++; return; } sh.appendRow([id, kode, sekarang, aktor]); ada[id] = true; diberi++; });
    if (cabut.length) {
      const hapus = {}; cabut.forEach(id => { hapus[id] = true; });
      const dataBaru = sh.getDataRange().getValues();
      for (let i = dataBaru.length - 1; i >= 1; i--) { if (String(dataBaru[i][1]).trim() === kode && hapus[String(dataBaru[i][0]).trim()]) { sh.deleteRow(i + 1); dicabut++; } }
    }
    logAudit_('UBAH_AKSES_RELAWAN_MODUL', 'HAK_AKSES', kode, aktor, { diberi: diberi, dicabut: dicabut });
    return { kodeModul: kode, diberi: diberi, dicabut: dicabut, dilewati: dilewati };
  } finally { lock.releaseLock(); }
}

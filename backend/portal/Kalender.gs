/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Kalender.gs — Kalender Operasional (fondasi data, Fase 3)
 *
 * Modul berdiri sendiri, sheet baru (15_KALENDER_OPERASIONAL) — tidak
 * menyentuh sheet/fungsi lain. ID_OPERASIONAL yang dibuat di sini BELUM
 * dipakai oleh Absensi.gs/submitAbsensi() pada tahap ini — itu pekerjaan
 * fase integrasi berikutnya (§6 dokumen pengembangan), sesudah Anda
 * konfirmasi. Menambahkan modul ini sendirian tidak mengubah perilaku
 * absensi yang sudah berjalan sama sekali.
 *
 * Kolom 15_KALENDER_OPERASIONAL:
 *   ID_OPERASIONAL | ID_PERIODE | TANGGAL_OPERASIONAL | HARI | STATUS | KETERANGAN
 *   STATUS: AKTIF | DIBATALKAN
 *
 * hitungNamaHari_() dipakai ulang dari Jadwal.gs (fungsi global dalam
 * satu proyek Apps Script yang sama) — tidak didefinisikan ulang di sini.
 */

// Diperluas 18 Okt 2026 (SIKOP, Kalender 4-status) -- LIBUR &
// TANGGAL_MERAH BARU, status lama (AKTIF/DIBATALKAN) TIDAK diubah.
// Sebelum ini, "Libur" cuma ada secara TERSIRAT (tidak ada entri AKTIF
// = dianggap Libur) -- sekarang bisa disimpan EKSPLISIT, membedakan
// "memang libur rutin" dari "tanggal merah/hari besar", sesuai
// permintaan. Tanggal yg TIDAK punya entri sama sekali TETAP dianggap
// Libur scr tersirat (perilaku lama dipertahankan, tidak memaksa Admin
// mengisi SEMUA tanggal libur secara eksplisit).
// Dikoreksi 21 Okt 2026 (dokumen SIKOP terbaru, DISETUJUI Admin --
// membalik keputusan Tanggal Merah sbg status terpisah yg sempat
// dibangun 18 Okt): dokumen BARU eksplisit "gunakan TEPAT TIGA status"
// dan "jangan buat status Tanggal Merah terpisah -- otomatis jadi
// Libur". TANGGAL_MERAH dihapus dari sini -- tanggal yg tadinya
// ditandai begitu sekarang otomatis tampil sbg LIBUR (lewat
// getStatusOperasionalHariIni di bawah, tanpa perlu migrasi data: baris
// lama yg masih berstatus TANGGAL_MERAH di sheet akan tetap dibaca
// sbg Libur oleh kode baru, lihat fallback di bawah).
const STATUS_OPERASIONAL_VALID = ['AKTIF', 'DIBATALKAN', 'LIBUR'];

function getKalenderSheet() {
  return getSheet(NAMA_SHEET.KALENDER);
}

/** Semua baris Kalender dengan TANGGAL_OPERASIONAL sudah diseragamkan jadi teks "dd/MM/yyyy". */
/**
 * DIMEMOISASI PER EKSEKUSI SCRIPT (bukan CacheService lintas-request --
 * tidak ada risiko data basi, karena variabel ini otomatis kosong lagi
 * di eksekusi berikutnya). Sebelumnya fungsi ini terpanggil sampai 3x
 * membaca Spreadsheet yang SAMA dalam SATU request Dashboard (dari
 * getStatusOperasionalHariIni, tentukanOperasionalAktifHariIni_,
 * resolveShiftUntukRelawan_) -- sekarang cukup 1x baca per request.
 */
let _cacheKalenderRows = null;
function getKalenderRows_() {
  if (_cacheKalenderRows) return _cacheKalenderRows;
  const rows = sheetToObjects(getKalenderSheet());
  rows.forEach(r => { if (r.TANGGAL_OPERASIONAL) r.TANGGAL_OPERASIONAL = bacaTanggalDMY_(r.TANGGAL_OPERASIONAL); });
  // 4 Nov 2026 (Kalender per tanggal, KalenderTanggal.gs): baris yang dibuat TANPA periode (ID_PERIODE kosong) dicocokkan ke
  // periode yang memuat tanggalnya, supaya 13 berkas lama yang menyaring menurut ID_PERIODE tetap melihatnya -- termasuk bila
  // periodenya baru dibuat BELAKANGAN. Tanggal di luar semua periode tetap kosong (tidak ada jadwal yang memerlukannya).
  const tanpaPeriode = rows.filter(r => !r.ID_PERIODE && r.TANGGAL_OPERASIONAL);
  if (tanpaPeriode.length) {
    const daftarPeriode = getPeriodeRows_();
    tanpaPeriode.forEach(r => { const p = kal2PeriodeMemuat_(daftarPeriode, tanggalSheetKeIso_(r.TANGGAL_OPERASIONAL)); if (p) r.ID_PERIODE = p.ID_PERIODE; });
  }
  _cacheKalenderRows = rows;
  return rows;
}
function _invalidasiCacheKalender_() { _cacheKalenderRows = null; }

function generateIdOperasional_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^OP(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'OP' + String(max + 1).padStart(3, '0');
}

/**
 * Untuk Admin — semua tanggal operasional, dengan nama periode sudah
 * dicocokkan. @param {string} [idPeriode] filter opsional per periode.
 */
function getKalenderListAdmin(idPeriode) {
  const semua = getKalenderRows_();
  const periodeList = sheetToObjects(getPeriodeSheet());
  const namaPeriodeById = {};
  periodeList.forEach(p => { namaPeriodeById[p.ID_PERIODE] = p.NAMA_PERIODE; });

  return semua
    .filter(k => !idPeriode || k.ID_PERIODE === idPeriode)
    .map(k => ({
      id: k.ID_OPERASIONAL,
      idPeriode: k.ID_PERIODE,
      namaPeriode: namaPeriodeById[k.ID_PERIODE] || k.ID_PERIODE,
      tanggal: k.TANGGAL_OPERASIONAL,
      hari: k.HARI,
      status: k.STATUS,
      keterangan: k.KETERANGAN,
      // BARU: array nama divisi (kosong = berlaku semua divisi, seperti sebelumnya).
      divisiKhusus: k.DIVISI_KHUSUS ? String(k.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean) : []
    }))
    .sort((a, b) => {
      const isoA = tanggalSheetKeIso_(a.tanggal) || '';
      const isoB = tanggalSheetKeIso_(b.tanggal) || '';
      return isoA.localeCompare(isoB);
    });
}

/** Cek apakah tanggal (format dd/MM/yyyy) sudah ada untuk periode tsb — cegah entri ganda pada tanggal yang sama. */
function operasionalSudahAda_(sheet, idPeriode, tanggalDMY) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === idPeriode && bacaTanggalDMY_(data[i][2]) === tanggalDMY) return true;
  }
  return false;
}

function addOperasional(body) {
  const idPeriode = sanitize(body.idPeriode);
  const tanggalIso = sanitize(body.tanggal);
  const keterangan = sanitize(body.keterangan);
  // BARU: kalau diisi, tanggal operasional ini HANYA berlaku untuk divisi
  // yang dipilih -- divisi lain dianggap TIDAK punya operasional pada
  // tanggal itu (bukan sekadar catatan/label). Kosong/tidak diisi =
  // berlaku untuk SEMUA divisi seperti sebelumnya (perilaku default,
  // tidak berubah untuk tanggal yang sudah ada maupun tanggal baru yang
  // tidak memilih divisi apa pun).
  const divisiKhususList = Array.isArray(body.divisiKhusus) ? body.divisiKhusus.map(d => sanitize(d)).filter(Boolean) : [];
  // BARU (18 Okt 2026, Kalender 4-status): status eksplisit, default
  // 'AKTIF' kalau tidak dikirim -- SAMA PERSIS perilaku lama utk
  // pemanggil yg belum tahu field ini. DIVISI_KHUSUS TIDAK relevan
  // kalau status bukan AKTIF (libur/tanggal merah tidak punya "divisi
  // yg diizinkan", itu konsep KHUSUS utk hari operasional).
  const statusBaris = sanitize(body.status) ? sanitize(body.status).toUpperCase() : 'AKTIF';
  if (STATUS_OPERASIONAL_VALID.indexOf(statusBaris) === -1) throw new Error('Status tidak valid.');

  if (!idPeriode) throw new Error('Periode wajib dipilih.');
  if (!tanggalIso) throw new Error('Tanggal operasional wajib diisi.');

  const periode = getPeriodeById_(idPeriode);
  if (!periode) throw new Error('Periode tidak ditemukan.');

  const tanggalDMY = isoKeDmy_(tanggalIso);
  const hari = hitungNamaHari_(tanggalDMY);

  const sheet = getKalenderSheet();
  if (operasionalSudahAda_(sheet, idPeriode, tanggalDMY)) {
    throw new Error('Tanggal operasional ini sudah ada dalam periode tersebut.');
  }

  // Pastikan kolom DIVISI_KHUSUS ada (fungsi ini aman dipanggil berkali-
  // kali -- cuma menambah kalau memang belum ada, tidak menyentuh kolom
  // lain sama sekali).
  tambahKolomJikaBelumAda_(NAMA_SHEET.KALENDER, ['DIVISI_KHUSUS']);

  const id = generateIdOperasional_(sheet);
  const idx = akunHeaderIndex_(sheet); // fungsi generik (baca header apa pun), bukan cuma utk sheet Akun -- namanya kebetulan begitu
  const baris = new Array(sheet.getLastColumn()).fill('');
  baris[idx.ID_OPERASIONAL] = id;
  baris[idx.ID_PERIODE] = idPeriode;
  baris[idx.TANGGAL_OPERASIONAL] = tanggalDMY;
  baris[idx.HARI] = hari;
  baris[idx.STATUS] = statusBaris;
  baris[idx.KETERANGAN] = keterangan;
  baris[idx.DIVISI_KHUSUS] = statusBaris === 'AKTIF' ? divisiKhususList.join(', ') : '';

  sheet.appendRow(baris);
  const barisTerakhir = sheet.getLastRow();
  paksaKolomTeks_(sheet, barisTerakhir, idx.TANGGAL_OPERASIONAL + 1);
  sheet.getRange(barisTerakhir, idx.TANGGAL_OPERASIONAL + 1).setValue(tanggalDMY);
  _invalidasiCacheKalender_();

  // ROSTER-FIRST (SIPRES FINAL REFACTOR, §I): begitu tanggal operasional
  // dibuat, langsung coba bentuk roster -- kalau Shift Divisi/Penugasan
  // Khusus belum diatur utk periode ini, hasilnya 0 baris (wajar, aman,
  // idempotent -- akan terisi begitu addShiftDivisi/addPenugasanKhusus
  // dipanggil belakangan, lihat hook di Shift.gs). Dibungkus try/catch
  // supaya kegagalan di sini TIDAK PERNAH menggagalkan pembuatan tanggal
  // operasional itu sendiri (aksi utama Admin).
  try { buatRosterUntukOperasional_(id, 'ADMIN'); } catch (e) { /* roster V2 opsional, jangan gagalkan §AX */ }

  return { id: id, tanggal: tanggalDMY, hari: hari, divisiKhusus: divisiKhususList };
}

/**
 * Buat banyak tanggal operasional sekaligus untuk satu periode, berdasarkan
 * hari-dalam-minggu yang dipilih Admin (mis. Senin–Jumat, atau Minggu–Jumat).
 * TIDAK mengasumsikan pola kerja REGULER/SECURITY dari dokumen Anda secara
 * otomatis — Admin yang memilih sendiri hari mana yang aktif, supaya tidak
 * mengarang pola kerja divisi mana pun (§20 dokumen: pola kerja hanya
 * referensi, bukan aturan mengikat semua divisi).
 *
 * @param {string} body.idPeriode
 * @param {number[]} body.hariAktif  0=Minggu .. 6=Sabtu (konvensi Date.getDay())
 * @param {string} [body.keterangan]
 */
function addOperasionalBulk(body) {
  const idPeriode = sanitize(body.idPeriode);
  const hariAktif = Array.isArray(body.hariAktif) ? body.hariAktif.map(Number) : [];
  const keterangan = sanitize(body.keterangan);

  if (!idPeriode) throw new Error('Periode wajib dipilih.');
  if (!hariAktif.length) throw new Error('Pilih minimal satu hari dalam minggu.');

  const periode = getPeriodeById_(idPeriode);
  if (!periode) throw new Error('Periode tidak ditemukan.');

  // PERBAIKAN: sebelumnya langsung .split('/') pada periode.tanggalMulai/
  // tanggalSelesai -- error nyata terjadi ("...split is not a function")
  // yang berarti nilai itu BUKAN string murni (kemungkinan Date mentah)
  // pada saat fungsi ini dijalankan. bacaTanggalDMY_ (sudah dipakai aman
  // di Kalender.gs/Periode.gs lain) menjamin hasilnya SELALU string
  // "dd/MM/yyyy" apa pun bentuk aslinya (Date ATAU string) -- dipanggil
  // di sini juga supaya baris ini aman terlepas dari apa yang
  // dikembalikan getPeriodeById_.
  const tanggalMulaiStr = bacaTanggalDMY_(periode.tanggalMulai);
  const tanggalSelesaiStr = bacaTanggalDMY_(periode.tanggalSelesai);
  const [ddM, mmM, yyyyM] = tanggalMulaiStr.split('/');
  const [ddS, mmS, yyyyS] = tanggalSelesaiStr.split('/');
  const mulai = new Date(Number(yyyyM), Number(mmM) - 1, Number(ddM));
  const selesai = new Date(Number(yyyyS), Number(mmS) - 1, Number(ddS));

  const sheet = getKalenderSheet();
  // Nomor urut ID dihitung SEKALI di awal (bukan per-baris via generateIdOperasional_),
  // karena appendRow belum terjadi di tengah loop — sheet belum "melihat" baris baru.
  let nomorBerikutnya = parseInt(generateIdOperasional_(sheet).replace('OP', ''), 10);
  const rowsBaru = [];
  let dilewati = 0;

  for (let d = new Date(mulai); d <= selesai; d.setDate(d.getDate() + 1)) {
    if (hariAktif.indexOf(d.getDay()) === -1) continue;
    const tanggalDMY = formatTanggal(d);
    if (operasionalSudahAda_(sheet, idPeriode, tanggalDMY) ||
        rowsBaru.some(r => r[2] === tanggalDMY)) {
      dilewati++;
      continue;
    }
    const id = 'OP' + String(nomorBerikutnya).padStart(3, '0');
    nomorBerikutnya++;
    rowsBaru.push([id, idPeriode, tanggalDMY, hitungNamaHari_(tanggalDMY), 'AKTIF', keterangan]);
  }

  if (rowsBaru.length) {
    const barisAwal = sheet.getLastRow() + 1;
    paksaKolomTeks_(sheet, barisAwal, 3, rowsBaru.length); // kolom TANGGAL_OPERASIONAL jadi teks dulu, SEBELUM ditulis
    sheet.getRange(barisAwal, 1, rowsBaru.length, 6).setValues(rowsBaru);
    _invalidasiCacheKalender_();
    // ROSTER-FIRST (§I) -- sama seperti addOperasional tunggal, coba
    // bentuk roster utk tiap tanggal baru. try/catch PER-BARIS supaya 1
    // tanggal gagal tidak menggagalkan sisanya.
    rowsBaru.forEach(r => {
      try { buatRosterUntukOperasional_(r[0], 'ADMIN'); } catch (e) { /* jangan gagalkan §AX */ }
    });
  }

  return { ditambahkan: rowsBaru.length, dilewati: dilewati };
}

function updateStatusOperasional(body) {
  const id = sanitize(body.id);
  const status = sanitize(body.status).toUpperCase();
  if (!id) throw new Error('ID operasional wajib diisi.');
  if (STATUS_OPERASIONAL_VALID.indexOf(status) === -1) throw new Error('Status operasional tidak valid.');

  const sheet = getKalenderSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 5).setValue(status);
      return { success: true, status: status };
    }
  }
  throw new Error('Tanggal operasional tidak ditemukan.');
}

/** Spec mengizinkan Kalender dihapus selama belum dipakai Absensi (belum ada dependency saat ini). */
function deleteOperasional(body) {
  const id = sanitize(body.id);
  const sheet = getKalenderSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Tanggal operasional tidak ditemukan.');
}

/** Hapus SEMUA tanggal operasional milik satu periode sekaligus — berguna untuk membersihkan
 * hasil "Buat Massal" yang keliru (mis. akibat bug/salah pilih hari) lalu generate ulang. */
function hapusSemuaOperasionalPeriode(body) {
  const idPeriode = sanitize(body.idPeriode);
  if (!idPeriode) throw new Error('Periode wajib dipilih.');

  const sheet = getKalenderSheet();
  const data = sheet.getDataRange().getValues();
  let dihapus = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === idPeriode) {
      sheet.deleteRow(i + 1);
      dihapus++;
    }
  }
  return { dihapus: dihapus };
}

/**
 * Status Operasional 3-tingkat untuk Dashboard: OPERASIONAL / LIBUR /
 * OPERASIONAL_TERBATAS. Kalender Operasional (sheet yang sudah ada) jadi
 * SUMBER UTAMA -- override default Senin-Jumat=operasional, Sabtu-Minggu
 * =libur. TIDAK menambah kolom baru: "Terbatas" dideteksi dari kata kunci
 * di KETERANGAN yang sudah ada (kolom bebas teks), bukan kolom baru.
 */
function getStatusOperasionalHariIni() {
  const now = new Date();
  const hariIniStr = formatTanggal(now);
  const hariMinggu = now.getDay(); // 0=Minggu, 6=Sabtu (pakai timezone server, konsisten dgn formatTanggal di file ini)

  const entriHariIni = getKalenderRows_().find(k => k.TANGGAL_OPERASIONAL === hariIniStr);

  if (entriHariIni) {
    const statusEntri = String(entriHariIni.STATUS).toUpperCase();
    if (statusEntri === 'DIBATALKAN' || statusEntri === 'LIBUR') {
      return { status: 'LIBUR', label: '🔴 LIBUR', keterangan: entriHariIni.KETERANGAN || '' };
    }
    // Dibalik 21 Okt 2026 (dokumen SIKOP terbaru) -- TANGGAL_MERAH TIDAK
    // lagi status terpisah. Baris LAMA yg kebetulan masih bertuliskan
    // TANGGAL_MERAH di sheet (dari jendela singkat fitur itu aktif)
    // TETAP ditangani dgn baik di sini -- jatuh ke Libur, BUKAN error
    // atau status tak dikenal -- supaya data lama tidak perlu dibersihkan
    // manual dulu.
    if (statusEntri === 'TANGGAL_MERAH') {
      return { status: 'LIBUR', label: '🔴 LIBUR', keterangan: entriHariIni.KETERANGAN || '' };
    }
    const ketLower = String(entriHariIni.KETERANGAN || '').toLowerCase();
    if (ketLower.indexOf('terbatas') !== -1) {
      return { status: 'OPERASIONAL_TERBATAS', label: '🟡 OPERASIONAL TERBATAS', keterangan: entriHariIni.KETERANGAN };
    }
    return { status: 'OPERASIONAL', label: '🟢 OPERASIONAL', keterangan: entriHariIni.KETERANGAN || '' };
  }

  // Tidak ada entri Kalender untuk hari ini -- fallback ke default mingguan.
  const isWeekend = (hariMinggu === 0 || hariMinggu === 6);
  return isWeekend
    ? { status: 'LIBUR', label: '🔴 LIBUR', keterangan: '' }
    : { status: 'OPERASIONAL', label: '🟢 OPERASIONAL', keterangan: '' };
}


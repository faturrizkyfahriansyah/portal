/**
 * SPPG JEUNGJING — PENGAJUAN KETIDAKHADIRAN (ALUR PERSETUJUAN)
 *
 * BEDA dari ajukanIzinSakit() lama (Absensi.gs): fungsi lama LANGSUNG
 * menulis status Izin/Sakit/Cuti ke absensi tanpa alur persetujuan sama
 * sekali. Modul ini adalah sistem BARU dengan status MENUNGGU ->
 * DISETUJUI/DITOLAK, sesuai §A ("Riwayat Presensi bukan pengganti
 * Pengajuan Ketidakhadiran, JANGAN dicampur") dan §G dokumen konsep UI.
 *
 * ajukanIzinSakit() LAMA TIDAK dihapus/diubah -- masih ada, masih bisa
 * dipanggil, tapi TIDAK dipakai lagi oleh alur "Pengajuan Ketidakhadiran"
 * yang baru (menu relawan yang baru memanggil ajukanKetidakhadiran() di
 * bawah, bukan ajukanIzinSakit()).
 *
 * KETIKA DISETUJUI: status kehadiran diperbarui pada ROSTER V2
 * (03_DATA_ABSENSI_V2, lihat Roster.gs/AbsensiV2.gs dari paket
 * sebelumnya) -- BUKAN 03_DATA_ABSENSI lama. Alasan: "BELUM ABSEN" —
 * yang harus bisa diubah jadi IZIN/SAKIT/CUTI — HANYA ada sebagai baris
 * nyata di sistem roster-first V2 (sistem lama tidak punya baris utk
 * hari yang belum diapa-apakan sama sekali, jadi tidak ada yang bisa
 * "diperbarui"). Kalau roster V2 belum dibuat utk tanggal tertentu
 * (mis. Shift Divisi/Penugasan Khusus belum diatur Admin), tanggal itu
 * DILAPORKAN terpisah sbg "tidak dapat diperbarui" -- BUKAN diam-diam
 * dilewati (§AP: server wajib validasi, jangan buat asumsi diam-diam).
 */

const NAMA_SHEET_PENGAJUAN_KETIDAKHADIRAN = '32_PENGAJUAN_KETIDAKHADIRAN';
const JENIS_PENGAJUAN_VALID = ['IZIN', 'SAKIT', 'CUTI'];
const STATUS_PENGAJUAN_VALID = ['MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN'];

/**
 * Upload dokumen pendukung (foto ATAU PDF -- beda dari uploadSelfieKeDrive_
 * yang selalu image/jpeg) ke folder Drive terpisah. Reuse getOrCreateFolder_
 * yang sudah ada (Absensi.gs) -- tidak menulis ulang mekanisme folder.
 */
function uploadDokumenPengajuanKeDrive_(dokumenBase64, idRelawan, jenis) {
  try {
    const cocok = String(dokumenBase64).match(/^data:([^;]+);base64,(.+)$/);
    const mime = cocok ? cocok[1] : 'application/octet-stream';
    const base64Bersih = cocok ? cocok[2] : String(dokumenBase64);
    const bytes = Utilities.base64Decode(base64Bersih);
    const ekstensi = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'jpg');
    const blob = Utilities.newBlob(bytes, mime);

    const now = new Date();
    const root = getOrCreateFolder_(DriveApp.getRootFolder(), 'PENGAJUAN_KETIDAKHADIRAN_DOKUMEN');
    const folderTahun = getOrCreateFolder_(root, Utilities.formatDate(now, ZONA_WAKTU, 'yyyy'));
    const stempel = Utilities.formatDate(now, ZONA_WAKTU, 'yyyyMMdd_HHmmss');
    blob.setName(idRelawan + '_' + jenis + '_' + stempel + '.' + ekstensi);

    const file = folderTahun.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getId();
  } catch (err) {
    console.error('[uploadDokumenPengajuanKeDrive_]', err.message);
    throw new Error('Gagal mengunggah dokumen. Silakan coba lagi.');
  }
}

function getPengajuanKetidakhadiranSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(NAMA_SHEET_PENGAJUAN_KETIDAKHADIRAN);
  if (!sheet) {
    sheet = ss.insertSheet(NAMA_SHEET_PENGAJUAN_KETIDAKHADIRAN);
    sheet.getRange(1, 1, 1, 15).setValues([[
      'ID_PENGAJUAN', 'ID_RELAWAN', 'NAMA_RELAWAN', 'DIVISI', 'JENIS',
      'TANGGAL_MULAI', 'TANGGAL_SELESAI', 'ALASAN', 'DOKUMEN_ID',
      'STATUS', 'CATATAN_PENGELOLA', 'ID_PENGELOLA_PROSES',
      'DIBUAT_PADA', 'DIPROSES_PADA', 'TANGGAL_TIDAK_TERUPDATE'
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

let _cachePengajuanKetidakhadiranRows = null;
function getPengajuanKetidakhadiranRows_() {
  if (_cachePengajuanKetidakhadiranRows) return _cachePengajuanKetidakhadiranRows;
  _cachePengajuanKetidakhadiranRows = sheetToObjects(getPengajuanKetidakhadiranSheet_());
  return _cachePengajuanKetidakhadiranRows;
}
function _invalidasiCachePengajuanKetidakhadiran_() { _cachePengajuanKetidakhadiranRows = null; }

function generateIdPengajuanKetidakhadiran_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0] || '').match(/^PKH(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return 'PKH' + String(max + 1).padStart(4, '0');
}

/** Semua tanggal DD/MM/YYYY dari rentang [mulai, selesai] inklusif, sesuai kalender (bukan tanggal operasional -- itu urusan pencarian roster di bawah). */
function daftarTanggalDalamRentang_(tanggalMulaiDMY, tanggalSelesaiDMY) {
  const [dM, mM, yM] = tanggalMulaiDMY.split('/').map(Number);
  const [dS, mS, yS] = tanggalSelesaiDMY.split('/').map(Number);
  const mulai = new Date(yM, mM - 1, dM);
  const selesai = new Date(yS, mS - 1, dS);
  const hasil = [];
  for (let d = new Date(mulai); d <= selesai; d.setDate(d.getDate() + 1)) {
    hasil.push(formatTanggal(d));
  }
  return hasil;
}

/**
 * RELAWAN -- ajukan ketidakhadiran baru. TIDAK langsung mengubah status
 * kehadiran apa pun (§G: hanya masuk MENUNGGU, menunggu diproses Admin).
 */
function ajukanKetidakhadiran(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const relawan = getRelawanById(idRelawan);
  if (!relawan || String(relawan.status).toUpperCase() !== 'AKTIF') {
    throw new Error('Data relawan tidak aktif. Hubungi admin.');
  }

  const jenis = sanitize(body.jenis).toUpperCase();
  if (JENIS_PENGAJUAN_VALID.indexOf(jenis) === -1) throw new Error('Jenis pengajuan tidak valid -- harus IZIN, SAKIT, atau CUTI.');

  const tanggalMulaiIso = sanitize(body.tanggalMulai);
  const tanggalSelesaiIso = sanitize(body.tanggalSelesai);
  if (!tanggalMulaiIso || !tanggalSelesaiIso) throw new Error('Tanggal mulai dan tanggal selesai wajib diisi.');
  if (tanggalMulaiIso > tanggalSelesaiIso) throw new Error('Tanggal mulai tidak boleh setelah tanggal selesai.');

  const alasan = sanitize(body.alasan);
  if (!alasan) throw new Error('Alasan wajib diisi.');

  // Dokumen pendukung -- opsional di server (§F: "jika jenis pengajuan
  // membutuhkan dokumen SESUAI ATURAN SISTEM" -- sistem ini belum
  // mendefinisikan jenis mana yg WAJIB dokumen, jadi tidak dipaksa di
  // sini; kalau ke depan perlu wajib utk SAKIT misalnya, validasi bisa
  // ditambah tanpa mengubah struktur).
  let dokumenId = '';
  if (body.dokumenBase64) {
    try { dokumenId = uploadDokumenPengajuanKeDrive_(body.dokumenBase64, idRelawan, jenis); }
    catch (e) { throw new Error('Gagal mengunggah dokumen pendukung. Coba lagi.'); }
  }

  const tanggalMulaiDMY = isoKeDmy_(tanggalMulaiIso);
  const tanggalSelesaiDMY = isoKeDmy_(tanggalSelesaiIso);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const sheet = getPengajuanKetidakhadiranSheet_();
    const idx = akunHeaderIndex_(sheet);
    const id = generateIdPengajuanKetidakhadiran_(sheet);
    const now = new Date();

    const baris = new Array(sheet.getLastColumn()).fill('');
    baris[idx.ID_PENGAJUAN] = id;
    baris[idx.ID_RELAWAN] = idRelawan;
    baris[idx.NAMA_RELAWAN] = relawan.nama;
    baris[idx.DIVISI] = relawan.divisi;
    baris[idx.JENIS] = jenis;
    baris[idx.TANGGAL_MULAI] = tanggalMulaiDMY;
    baris[idx.TANGGAL_SELESAI] = tanggalSelesaiDMY;
    baris[idx.ALASAN] = alasan;
    baris[idx.DOKUMEN_ID] = dokumenId;
    baris[idx.STATUS] = 'MENUNGGU';
    baris[idx.DIBUAT_PADA] = now;

    sheet.appendRow(baris);
    const barisTerakhir = sheet.getLastRow();
    [idx.TANGGAL_MULAI, idx.TANGGAL_SELESAI].forEach(i => {
      paksaKolomTeks_(sheet, barisTerakhir, i + 1);
      sheet.getRange(barisTerakhir, i + 1).setValue(i === idx.TANGGAL_MULAI ? tanggalMulaiDMY : tanggalSelesaiDMY);
    });

    _invalidasiCachePengajuanKetidakhadiran_();
    logAudit_('AJUKAN_KETIDAKHADIRAN', 'PENGAJUAN_KETIDAKHADIRAN', id, idRelawan, { jenis: jenis, tanggalMulai: tanggalMulaiDMY, tanggalSelesai: tanggalSelesaiDMY });

    return { success: true, id: id, status: 'MENUNGGU' };
  } finally {
    lock.releaseLock();
  }
}

/** RELAWAN -- riwayat pengajuannya SENDIRI (§H, terpisah dari Riwayat Presensi). */
function getPengajuanKetidakhadiranRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  return getPengajuanKetidakhadiranRows_()
    .filter(r => r.ID_RELAWAN === idRelawan)
    .sort((a, b) => (b.DIBUAT_PADA instanceof Date ? b.DIBUAT_PADA.getTime() : 0) - (a.DIBUAT_PADA instanceof Date ? a.DIBUAT_PADA.getTime() : 0))
    .map(r => ({
      id: r.ID_PENGAJUAN, jenis: r.JENIS, tanggalMulai: r.TANGGAL_MULAI, tanggalSelesai: r.TANGGAL_SELESAI,
      alasan: r.ALASAN, dokumenUrl: r.DOKUMEN_ID ? urlFotoReference_(r.DOKUMEN_ID) : null,
      status: r.STATUS, catatanPengelola: r.CATATAN_PENGELOLA || '',
      dibuatPada: r.DIBUAT_PADA, diprosesPada: r.DIPROSES_PADA || null
    }));
}

/** RELAWAN -- batalkan pengajuan SENDIRI, HANYA kalau masih MENUNGGU. */
function batalkanPengajuanKetidakhadiran(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const id = sanitize(body.id);
  const lock = LockService.getScriptLock(); // P2 -- sama spt setujui/tolak: cek status lalu tulis
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getPengajuanKetidakhadiranSheet_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_PENGAJUAN]) === id) {
        if (String(data[i][idx.ID_RELAWAN]) !== idRelawan) throw new Error('Anda tidak dapat membatalkan pengajuan relawan lain.');
        if (String(data[i][idx.STATUS]) !== 'MENUNGGU') throw new Error('Hanya pengajuan berstatus MENUNGGU yang dapat dibatalkan.');
        sheet.getRange(i + 1, idx.STATUS + 1).setValue('DIBATALKAN');
        sheet.getRange(i + 1, idx.DIPROSES_PADA + 1).setValue(new Date());
        _invalidasiCachePengajuanKetidakhadiran_();
        logAudit_('BATALKAN_PENGAJUAN_KETIDAKHADIRAN', 'PENGAJUAN_KETIDAKHADIRAN', id, idRelawan, {});
        return { success: true };
      }
    }
    throw new Error('Pengajuan tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * ADMIN -- daftar pengajuan dengan filter (§O). Default status=MENUNGGU
 * kalau tidak diisi -- TAPI keputusan default itu ada di FRONTEND (kirim
 * status:'MENUNGGU' eksplisit), fungsi ini sendiri netral: kosong = semua status.
 */
function getPengajuanKetidakhadiranAdmin(body) {
  requireAuth(body.token, true);
  let list = getPengajuanKetidakhadiranRows_();
  if (body.status) list = list.filter(r => r.STATUS === body.status);
  if (body.jenis) list = list.filter(r => r.JENIS === body.jenis);
  if (body.divisi) list = list.filter(r => r.DIVISI === body.divisi);
  if (body.tanggal) {
    // Tampilkan pengajuan yang RENTANG tanggalnya mencakup tanggal filter
    // ini (bukan hanya cocok tanggal mulai) -- dibandingkan dalam bentuk
    // yyyyMMdd supaya urutan string = urutan tanggal sungguhan (DD/MM/YYYY
    // asli TIDAK bisa dibandingkan langsung sbg string).
    const keKunci = (dmy) => { const [d, m, y] = dmy.split('/'); return y + m.padStart(2, '0') + d.padStart(2, '0'); };
    const kunciFilter = keKunci(sanitize(body.tanggal));
    list = list.filter(r => kunciFilter >= keKunci(r.TANGGAL_MULAI) && kunciFilter <= keKunci(r.TANGGAL_SELESAI));
  }
  return list
    .sort((a, b) => (b.DIBUAT_PADA instanceof Date ? b.DIBUAT_PADA.getTime() : 0) - (a.DIBUAT_PADA instanceof Date ? a.DIBUAT_PADA.getTime() : 0))
    .map(r => ({
      id: r.ID_PENGAJUAN, idRelawan: r.ID_RELAWAN, namaRelawan: r.NAMA_RELAWAN, divisi: r.DIVISI,
      jenis: r.JENIS, tanggalMulai: r.TANGGAL_MULAI, tanggalSelesai: r.TANGGAL_SELESAI,
      alasan: r.ALASAN, dokumenUrl: r.DOKUMEN_ID ? urlFotoReference_(r.DOKUMEN_ID) : null,
      status: r.STATUS, catatanPengelola: r.CATATAN_PENGELOLA || '',
      dibuatPada: r.DIBUAT_PADA, diprosesPada: r.DIPROSES_PADA || null
    }));
}

/** ADMIN -- ringkasan jumlah per status (§N, untuk grid 2 kolom di UI). */
function getRingkasanPengajuanKetidakhadiranAdmin(token) {
  requireAuth(token, true);
  const semua = getPengajuanKetidakhadiranRows_();
  return {
    menunggu: semua.filter(r => r.STATUS === 'MENUNGGU').length,
    disetujui: semua.filter(r => r.STATUS === 'DISETUJUI').length,
    ditolak: semua.filter(r => r.STATUS === 'DITOLAK').length
  };
}

/**
 * ADMIN -- proses SETUJUI (§R). Untuk SETIAP tanggal kalender dalam
 * rentang [TANGGAL_MULAI, TANGGAL_SELESAI], cari baris ROSTER V2 milik
 * relawan ini yang TANGGAL_OPERASIONAL cocok, lalu update
 * STATUS_KEHADIRAN jadi IZIN/SAKIT/CUTI (via mekanisme yang SAMA dgn
 * koreksiRosterV2 -- langsung update kolom, TIDAK membuat baris baru,
 * TIDAK mengubah ID_ABSENSI). Tanggal yang TIDAK ketemu roster-nya
 * (mis. Shift Divisi/Penugasan Khusus belum diatur Admin utk tanggal
 * itu) DICATAT di TANGGAL_TIDAK_TERUPDATE -- Admin diberi tahu, bukan
 * gagal diam-diam.
 */
function setujuiPengajuanKetidakhadiran(body) {
  const akses = requireAuth(body.token);
  const id = sanitize(body.id);
  const catatan = sanitize(body.catatan);

  // P2 (Audit Lanjutan §4) -- kunci dipasang SEBELUM pengecekan status
  // 'MENUNGGU', bukan hanya sebelum menulis. Pola "cek status lalu tulis"
  // ini klasik rawan diproses DOBEL: tanpa kunci, 2 admin yg klik
  // "Setujui" nyaris bersamaan bisa lolos dua-duanya (masing2 melihat
  // status masih MENUNGGU sebelum yg lain sempat menyimpan DISETUJUI),
  // mengakibatkan roster ditimpa 2x & notifikasi terkirim 2x.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada persetujuan lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  let idRelawan, jenis, tanggalMulai, tanggalSelesai, tanggalTerupdate, tanggalTidakKetemu;
  try {
    const sheet = getPengajuanKetidakhadiranSheet_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    let baris = -1, pengajuan = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_PENGAJUAN]) === id) { baris = i + 1; pengajuan = data[i]; break; }
    }
    if (baris === -1) throw new Error('Pengajuan tidak ditemukan.');
    if (String(pengajuan[idx.STATUS]) !== 'MENUNGGU') throw new Error('Pengajuan ini sudah diproses sebelumnya.');

    idRelawan = String(pengajuan[idx.ID_RELAWAN]);
    jenis = String(pengajuan[idx.JENIS]);
    tanggalMulai = String(pengajuan[idx.TANGGAL_MULAI]);
    tanggalSelesai = String(pengajuan[idx.TANGGAL_SELESAI]);
    const daftarTanggal = daftarTanggalDalamRentang_(tanggalMulai, tanggalSelesai);

    // Update roster V2 utk tiap tanggal dalam rentang -- pakai sheet Roster
    // V2 langsung (bukan lewat koreksiRosterV2 satu-satu, supaya bisa 1
    // batch baca + tulis per baris yang cocok, lebih ringan utk rentang
    // multi-hari sesuai §Y "batch, jangan loop request satu-satu").
    const sheetRoster = getRosterSheetV2_();
    const idxRoster = akunHeaderIndex_(sheetRoster);
    const dataRoster = sheetRoster.getDataRange().getValues();
    tanggalTerupdate = [];
    tanggalTidakKetemu = [];

    daftarTanggal.forEach(tgl => {
      let ketemu = false;
      for (let i = 1; i < dataRoster.length; i++) {
        if (String(dataRoster[i][idxRoster.ID_RELAWAN]) === idRelawan && String(dataRoster[i][idxRoster.TANGGAL_OPERASIONAL]) === tgl) {
          sheetRoster.getRange(i + 1, idxRoster.STATUS_KEHADIRAN + 1).setValue(jenis);
          sheetRoster.getRange(i + 1, idxRoster.KETERANGAN + 1).setValue('Disetujui lewat Pengajuan Ketidakhadiran ' + id);
          sheetRoster.getRange(i + 1, idxRoster.DIUBAH_PADA + 1).setValue(new Date());
          ketemu = true;
          tanggalTerupdate.push(tgl);
          break;
        }
      }
      if (!ketemu) tanggalTidakKetemu.push(tgl);
    });
    _invalidasiCacheRosterV2_();

    sheet.getRange(baris, idx.STATUS + 1).setValue('DISETUJUI');
    if (catatan) sheet.getRange(baris, idx.CATATAN_PENGELOLA + 1).setValue(catatan);
    sheet.getRange(baris, idx.ID_PENGELOLA_PROSES + 1).setValue(akses);
    sheet.getRange(baris, idx.DIPROSES_PADA + 1).setValue(new Date());
    if (tanggalTidakKetemu.length) sheet.getRange(baris, idx.TANGGAL_TIDAK_TERUPDATE + 1).setValue(tanggalTidakKetemu.join(', '));
    _invalidasiCachePengajuanKetidakhadiran_();

    logAudit_('SETUJUI_PENGAJUAN_KETIDAKHADIRAN', 'PENGAJUAN_KETIDAKHADIRAN', id, akses, { jenis: jenis, tanggalTerupdate: tanggalTerupdate.length, tanggalTidakKetemu: tanggalTidakKetemu });
  } finally {
    lock.releaseLock();
  }

  // Notifikasi SENGAJA di LUAR lock (bisa lambat, tidak perlu menahan kunci tulis).
  try {
    const isi = 'Pengajuan ' + jenis + ' tanggal ' + tanggalMulai + (tanggalMulai !== tanggalSelesai ? ' s/d ' + tanggalSelesai : '') + ' telah disetujui.';
    catatNotifikasi_('Pengajuan', 'Pengajuan Ketidakhadiran Disetujui', isi, idRelawan);
    kirimPushNotifikasi_(idRelawan, 'Pengajuan Ketidakhadiran Disetujui', isi, { link: '/pengajuan.html' });
  } catch (e) { /* notifikasi gagal -- jangan gagalkan persetujuan yang sudah tersimpan */ }

  return { success: true, tanggalTerupdate: tanggalTerupdate, tanggalTidakKetemu: tanggalTidakKetemu };
}

/** ADMIN -- proses TOLAK (§S). Status kehadiran TIDAK diubah sama sekali. */
function tolakPengajuanKetidakhadiran(body) {
  const akses = requireAuth(body.token);
  const id = sanitize(body.id);
  const catatan = sanitize(body.catatan);
  if (!catatan) throw new Error('Catatan penolakan wajib diisi.');

  const lock = LockService.getScriptLock(); // P2 -- sama spt setujui: cek status MENUNGGU lalu tulis
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada perubahan lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getPengajuanKetidakhadiranSheet_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_PENGAJUAN]) === id) {
        if (String(data[i][idx.STATUS]) !== 'MENUNGGU') throw new Error('Pengajuan ini sudah diproses sebelumnya.');
        const baris = i + 1;
        const idRelawan = String(data[i][idx.ID_RELAWAN]);
        const jenis = String(data[i][idx.JENIS]);
        const tanggalMulai = String(data[i][idx.TANGGAL_MULAI]);
        const tanggalSelesai = String(data[i][idx.TANGGAL_SELESAI]);

        sheet.getRange(baris, idx.STATUS + 1).setValue('DITOLAK');
        sheet.getRange(baris, idx.CATATAN_PENGELOLA + 1).setValue(catatan);
        sheet.getRange(baris, idx.ID_PENGELOLA_PROSES + 1).setValue(akses);
        sheet.getRange(baris, idx.DIPROSES_PADA + 1).setValue(new Date());
        _invalidasiCachePengajuanKetidakhadiran_();

        logAudit_('TOLAK_PENGAJUAN_KETIDAKHADIRAN', 'PENGAJUAN_KETIDAKHADIRAN', id, akses, { catatan: catatan });

        try {
          const isi = 'Pengajuan ' + jenis + ' tanggal ' + tanggalMulai + (tanggalMulai !== tanggalSelesai ? ' s/d ' + tanggalSelesai : '') + ' tidak disetujui.\n\nCatatan: ' + catatan;
          catatNotifikasi_('Pengajuan', 'Pengajuan Ketidakhadiran Ditolak', isi, idRelawan);
          kirimPushNotifikasi_(idRelawan, 'Pengajuan Ketidakhadiran Ditolak', isi, { link: '/pengajuan.html' });
        } catch (e) { /* jangan gagalkan penolakan yang sudah tersimpan */ }

        return { success: true };
      }
    }
    throw new Error('Pengajuan tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}


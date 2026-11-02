/**
 * SPPG JEUNGJING — ROSTER-FIRST ATTENDANCE (SIPRES FINAL REFACTOR)
 * Roster.gs — pembuatan roster ("BELUM ABSEN" sebelum orang absen),
 * ditulis LANGSUNG ke 03_DATA_ABSENSI (TIDAK membuat sheet terpisah,
 * sesuai instruksi terbaru: "ga usah buat database baru buat SIPRES").
 *
 * ============================================================
 * KEPUTUSAN DIPERBARUI (menggantikan versi paralel sebelumnya):
 * ============================================================
 * Skema 03_DATA_ABSENSI DIPERLUAS di tempat (kolom baru ditambahkan lewat
 * tambahKolomJikaBelumAda_ -- aditif, tidak menghapus kolom lama). Data
 * LAMA (baris MASUK/PULANG terpisah, format event-first) HARUS
 * dikonsolidasi jadi 1 baris per (relawan, operasional) lewat
 * MIGRASI SEKALI JALAN yang MENULIS ULANG isi sheet ini (lihat
 * MigrasiRosterV2.gs) -- INI OPERASI DESTRUKTIF pada sheet produksi.
 * WAJIB backup Spreadsheet dulu sebelum menjalankan migrasi.
 *
 * submitAbsensi()/getRekapHarian()/getRekapDuaMinggu()/
 * getRiwayatAbsensiRelawan()/ajukanIzinSakit() LAMA (versi event-first)
 * SUDAH DIGANTI di Absensi.gs dengan versi roster-first -- TIDAK ada lagi
 * 2 versi berdampingan. Nama fungsi & endpoint dipertahankan SAMA supaya
 * frontend existing tidak perlu diubah.
 */

function getRosterSheetV2_() { return getSheet(NAMA_SHEET.ABSENSI); } // '03_DATA_ABSENSI' -- SAMA PERSIS, tidak ada sheet terpisah lagi

/** Kolom BARU yang belum ada di 03_DATA_ABSENSI lama -- ditambahkan aditif di akhir header, kolom lama TIDAK dihapus/digeser. */
function pastikanKolomRosterAda_() {
  tambahKolomJikaBelumAda_(NAMA_SHEET.ABSENSI, [
    'ID_ABSENSI', 'ID_PERIODE', 'ID_OPERASIONAL', 'TANGGAL_OPERASIONAL', 'HARI_OPERASIONAL',
    'ID_PENUGASAN', 'ID_RELAWAN', 'NAMA_RELAWAN', 'DIVISI', 'ID_SHIFT', 'NAMA_SHIFT',
    'JAM_JADWAL_MASUK', 'JAM_JADWAL_PULANG',
    'TANGGAL_MASUK', 'JAM_MASUK', 'TANGGAL_PULANG', 'JAM_PULANG',
    'STATUS_KEHADIRAN', 'STATUS_MASUK', 'STATUS_PULANG', 'KETERLAMBATAN_MENIT',
    'LATITUDE_MASUK', 'LONGITUDE_MASUK', 'GPS_ACCURACY_MASUK', 'JARAK_MASUK_METER', 'FOTO_MASUK',
    'LATITUDE_PULANG', 'LONGITUDE_PULANG', 'GPS_ACCURACY_PULANG', 'JARAK_PULANG_METER', 'FOTO_PULANG',
    'KETERANGAN', 'DIBUAT_PADA', 'DIUBAH_PADA'
  ]);
  // Catatan: kolom LAMA (NOMOR, TIMESTAMP, TANGGAL, JAM, JENIS_ABSENSI,
  // AKURASI, JARAK_METER, STATUS_LOKASI, FOTO_ID) TETAP ADA di sheet
  // setelah migrasi -- dibiarkan apa adanya sbg arsip historis mentah,
  // TIDAK dipakai lagi oleh fungsi baru manapun (semua fungsi baru
  // membaca/menulis kolom BARU di atas).
}

/** Dimemoisasi per-eksekusi -- pola yang sama seperti getAbsensiRows_/getKalenderRows_ (modul lain). */
let _cacheRosterV2Rows = null;
function getRosterV2Rows_() {
  if (_cacheRosterV2Rows) return _cacheRosterV2Rows;
  pastikanKolomRosterAda_();
  const rows = sheetToObjects(getRosterSheetV2_());
  rows.forEach(r => {
    if (r.TANGGAL_OPERASIONAL) r.TANGGAL_OPERASIONAL = bacaTanggalDMY_(r.TANGGAL_OPERASIONAL);
    if (r.TANGGAL_MASUK) r.TANGGAL_MASUK = bacaTanggalDMY_(r.TANGGAL_MASUK);
    if (r.TANGGAL_PULANG) r.TANGGAL_PULANG = bacaTanggalDMY_(r.TANGGAL_PULANG);
  });
  _cacheRosterV2Rows = rows;
  return rows;
}
function _invalidasiCacheRosterV2_() { _cacheRosterV2Rows = null; }

/**
 * ID_ABSENSI stabil & unik per (operasional, relawan) -- sesuai §K & §J
 * ("1 relawan + 1 tanggal operasional + 1 penugasan = 1 record presensi").
 * Format: ABS-<ID_OPERASIONAL>-<ID_RELAWAN>, mis. ABS-OP006-R-PRS-001.
 * Deterministik (bukan random) -- dipilih SENGAJA supaya check-in/
 * check-out bisa langsung mencari baris lewat kunci ini tanpa perlu
 * pencarian ganda, dan supaya idempotent (dipanggil ulang menghasilkan
 * ID yang SAMA, bukan duplikat).
 */
function buatIdAbsensiV2_(idOperasional, idRelawan) {
  return 'ABS-' + idOperasional + '-' + idRelawan;
}

/**
 * Relawan yang berhak masuk roster utk 1 ID_OPERASIONAL. REUSE PERSIS
 * logika yang sudah terbukti benar di isiAbsensiHadirMassal (Absensi.gs,
 * dipakai produksi): AKTIF + menghormati DIVISI_KHUSUS Kalender + hanya
 * yang shift-nya bisa di-resolve lewat resolveShiftUntukRelawan_ (yang
 * SUDAH mengimplementasikan prioritas §H: Penugasan Khusus > Shift
 * Divisi > tidak ada). TIDAK membuat mekanisme eligibilitas kedua --
 * sesuai §G "jangan membuat sistem shift kedua" & §I "roster hanya utk
 * relawan yang memang ditugaskan, BUKAN semua relawan aktif".
 */
function getRelawanRosterUntukOperasional_(idOperasional) {
  const entriKalender = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasional);
  if (!entriKalender) return [];

  const daftarDivisiKhusus = entriKalender.DIVISI_KHUSUS
    ? String(entriKalender.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean)
    : [];

  let relawanList = getRelawanList(null, false); // hanya AKTIF
  if (daftarDivisiKhusus.length) {
    relawanList = relawanList.filter(r => daftarDivisiKhusus.indexOf(r.divisi) !== -1);
  }

  return relawanList
    .map(r => ({ relawan: r, shift: resolveShiftUntukRelawan_(r.id, idOperasional) }))
    .filter(x => x.shift && x.shift.jamMasuk);
}

/**
 * Membuat baris "BELUM ABSEN" utk SEMUA relawan yang ditugaskan pada 1
 * ID_OPERASIONAL. IDEMPOTENT -- aman dipanggil berkali-kali: relawan
 * yang SUDAH punya baris roster (apa pun statusnya, termasuk yang
 * sudah check-in/out) DILEWATI, tidak pernah ditimpa.
 *
 * KETERBATASAN YANG DIDOKUMENTASIKAN (bukan bug, keputusan sadar):
 * kalau Admin mengubah jam Shift Divisi SETELAH roster untuk periode
 * itu sudah dibuat, baris "BELUM ABSEN" yang SUDAH ADA TIDAK ikut
 * ter-update ke jam baru secara otomatis (fungsi ini hanya MENAMBAH
 * baris yang belum ada, tidak MENGUBAH baris yang sudah ada). Alasan:
 * mengubah baris yang berpotensi sudah dalam proses check-in relawan
 * lain berisiko race condition. Mitigasi: Admin dapat memakai fitur
 * Koreksi (§AA) untuk kasus per-baris, atau menjalankan ulang
 * buatRosterUntukOperasional_ tidak akan merugikan (idempotent) --
 * baris LAMA tetap dengan jam lama, relawan yang BELUM py baris (mis.
 * baru ditambahkan ke divisi) akan mendapat baris baru dengan jam
 * TERBARU. Didaftarkan sebagai "Known Limitation" di laporan MD.
 */
function buatRosterUntukOperasional_(idOperasional, aktor) {
  const entriKalender = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasional);
  if (!entriKalender) throw new Error('ID_OPERASIONAL tidak ditemukan: ' + idOperasional);

  // Perbaikan 18 Okt 2026 (ditemukan saat audit Kalender 4-status,
  // SIKOP): fungsi ini SEBELUMNYA tidak pernah cek STATUS kalender sama
  // sekali -- aman selama SEMUA entri kalender selalu 'AKTIF' (satu-
  // satunya nilai yg pernah ditulis sampai sekarang). Begitu status
  // LIBUR/TANGGAL_MERAH mulai bisa disimpan eksplisit, ini WAJIB
  // dicegah di sini -- SATU tempat, dipakai SEMUA pemanggil (termasuk
  // pemanggilan massal di Shift.gs yg loop seluruh kalender periode
  // tanpa filter) -- supaya tidak ada roster yg salah terbentuk di
  // tanggal libur.
  const statusKalender = String(entriKalender.STATUS || 'AKTIF').toUpperCase();
  if (statusKalender !== 'AKTIF') {
    return { dibuat: 0, sudahAdaSebelumnya: 0, dilewati: 'Tanggal berstatus ' + statusKalender + ', bukan operasional.' };
  }

  // Diperbaiki 23 Okt 2026 (dilaporkan Admin: roster terbentuk utk
  // periode yg masih Draft, PADAHAL Admin tidak pernah menekan
  // "Perbarui Jadwal Sekarang" -- ternyata roster terbentuk OTOMATIS
  // lewat pemanggil LAIN, mis. saat menyimpan Kalender/Pola Shift,
  // SEMUANYA memanggil fungsi INI). Pemeriksaan status Periode yg
  // sempat ditaruh HANYA di SikopPembuatanJadwal.gs (22 Okt) TERBUKTI
  // tidak cukup -- ada >5 titik pemanggil lain yg melewatinya sama
  // sekali. Diperbaiki benar kali ini: ditaruh di SINI, titik pusat
  // yg dipakai SEMUA pemanggil (sama prinsipnya dgn guard status
  // Kalender di atas) -- supaya TIDAK ADA LAGI jalur yg bisa
  // melewatinya, dari mana pun roster coba dibentuk.
  const periodeEntri = getPeriodeRows_().find(p => p.ID_PERIODE === entriKalender.ID_PERIODE);
  const statusPeriode = periodeEntri ? String(periodeEntri.STATUS || '').toUpperCase() : '';
  if (statusPeriode !== 'AKTIF') {
    return { dibuat: 0, sudahAdaSebelumnya: 0, dilewati: 'Periode berstatus ' + (statusPeriode || 'TIDAK DIKETAHUI') + ', bukan Aktif -- roster tidak dibentuk sampai periode ini diaktifkan.' };
  }

  const daftarEligible = getRelawanRosterUntukOperasional_(idOperasional);
  const rosterAda = getRosterV2Rows_().filter(r => r.ID_OPERASIONAL === idOperasional);
  const idRelawanSudahAda = new Set(rosterAda.map(r => r.ID_RELAWAN));

  const sheet = getRosterSheetV2_();
  const idx = akunHeaderIndex_(sheet); // helper generik baca header, sudah dipakai aman di modul lain
  const now = new Date();
  const barisBaru = [];
  const kolomTeks = ['TANGGAL_OPERASIONAL', 'JAM_JADWAL_MASUK', 'JAM_JADWAL_PULANG'];

  daftarEligible.forEach(({ relawan, shift }) => {
    if (idRelawanSudahAda.has(relawan.id)) return; // sudah ada -- lewati (idempotent)

    // ID_PENUGASAN & ID_SHIFT/NAMA_SHIFT -- diambil dari sumber yang
    // MENANG (Penugasan Khusus mengalahkan Shift Divisi, sesuai §H).
    let idPenugasan = '', idShift = '', namaShift = '';
    if (shift.sumber === 'KHUSUS') {
      const p = getPenugasanKhususRows_().find(pk => pk.ID_OPERASIONAL === idOperasional && pk.ID_RELAWAN === relawan.id);
      idPenugasan = p ? p.ID_PENUGASAN : '';
      namaShift = 'Penugasan Khusus';
    } else {
      const s = getShiftDivisiRows_().find(sd => sd.ID_PERIODE === entriKalender.ID_PERIODE && sd.NAMA_DIVISI === relawan.divisi);
      idShift = s ? s.ID_SHIFT : '';
      namaShift = relawan.divisi;
    }

    // BARU 22 Okt 2026 (diminta Admin: "aturan Hadir dihitung dari jam
    // masuk atau di hari berikutnya... tiap divisi bisa pilih") --
    // kalau divisi ini diatur 'HARI_BERIKUTNYA' DAN shift-nya lintas
    // tengah malam, TANGGAL_OPERASIONAL yg ditulis (dipakai
    // laporan/rekap) digeser +1 hari kalender dari tanggal shift
    // dimulai. ID_OPERASIONAL (dipakai pencocokan QR SIPRES) SENGAJA
    // TIDAK ikut berubah -- shift ini TETAP "milik" roster tanggal
    // asalnya utk keperluan absensi, cuma TAMPILAN tanggalnya di
    // laporan yg menyesuaikan pilihan Admin.
    let tanggalOperasionalDitulis = entriKalender.TANGGAL_OPERASIONAL;
    if (shift.aturanTanggalAcuan === 'HARI_BERIKUTNYA' && shift.lintasTengahMalam) {
      const [d, m, y] = String(entriKalender.TANGGAL_OPERASIONAL).split('/').map(Number);
      const dtBerikutnya = new Date(y, m - 1, d + 1);
      tanggalOperasionalDitulis = String(dtBerikutnya.getDate()).padStart(2, '0') + '/' + String(dtBerikutnya.getMonth() + 1).padStart(2, '0') + '/' + dtBerikutnya.getFullYear();
    }

    const baris = new Array(sheet.getLastColumn()).fill('');
    baris[idx.ID_ABSENSI] = buatIdAbsensiV2_(idOperasional, relawan.id);
    baris[idx.ID_PERIODE] = entriKalender.ID_PERIODE;
    baris[idx.ID_OPERASIONAL] = idOperasional;
    baris[idx.TANGGAL_OPERASIONAL] = tanggalOperasionalDitulis;
    baris[idx.HARI_OPERASIONAL] = entriKalender.HARI;
    baris[idx.ID_PENUGASAN] = idPenugasan;
    baris[idx.ID_RELAWAN] = relawan.id;
    baris[idx.NAMA_RELAWAN] = relawan.nama;
    baris[idx.DIVISI] = relawan.divisi;
    baris[idx.ID_SHIFT] = idShift;
    baris[idx.NAMA_SHIFT] = namaShift;
    baris[idx.JAM_JADWAL_MASUK] = shift.jamMasuk;
    baris[idx.JAM_JADWAL_PULANG] = shift.jamPulang || '';
    baris[idx.STATUS_KEHADIRAN] = 'BELUM ABSEN';
    baris[idx.STATUS_MASUK] = 'BELUM';
    baris[idx.STATUS_PULANG] = 'BELUM';
    baris[idx.DIBUAT_PADA] = now;
    baris[idx.DIUBAH_PADA] = now;
    barisBaru.push(baris);
  });

  if (barisBaru.length) {
    const barisMulai = sheet.getLastRow() + 1;
    sheet.getRange(barisMulai, 1, barisBaru.length, sheet.getLastColumn()).setValues(barisBaru);
    for (let i = 0; i < barisBaru.length; i++) {
      const barisKe = barisMulai + i;
      kolomTeks.forEach(kolom => {
        if (barisBaru[i][idx[kolom]] !== '') {
          paksaKolomTeks_(sheet, barisKe, idx[kolom] + 1);
          sheet.getRange(barisKe, idx[kolom] + 1).setValue(barisBaru[i][idx[kolom]]);
        }
      });
    }
    _invalidasiCacheRosterV2_();
  }

  logAudit_('BUAT_ROSTER', 'ROSTER_V2', idOperasional, aktor || 'SYSTEM', { dibuat: barisBaru.length, sudahAdaSebelumnya: rosterAda.length });
  return { idOperasional: idOperasional, dibuat: barisBaru.length, sudahAdaSebelumnya: rosterAda.length, totalEligible: daftarEligible.length };
}

/**
 * ADMIN -- endpoint dispatch untuk membuat roster manual (mis. tombol
 * "Buat Roster" di panel Admin, terpisah dari hook otomatis di
 * addOperasional/addShiftDivisi/addPenugasanKhusus). Berguna utk
 * regenerasi roster atas tanggal yang sudah ada sebelum hook otomatis
 * dipasang, atau debugging.
 */
function buatRosterUntukOperasionalAdmin(body) {
  const akses = requireAuth(body.token);
  const idOperasional = sanitize(body.idOperasional);
  if (!idOperasional) throw new Error('ID_OPERASIONAL wajib diisi.');
  return buatRosterUntukOperasional_(idOperasional, akses);
}

/** ADMIN -- lihat roster 1 ID_OPERASIONAL (dipakai panel verifikasi & debugging). */
function getRosterUntukOperasionalAdmin(body) {
  requireAuth(body.token, true);
  const idOperasional = sanitize(body.idOperasional);
  return getRosterV2Rows_().filter(r => r.ID_OPERASIONAL === idOperasional);
}

/**
 * KOREKSI (§AA) -- Admin dapat mengoreksi jam masuk/pulang, status, dan
 * keterangan pada 1 baris roster. TIDAK PERNAH mengubah ID_ABSENSI (§AA:
 * "jangan membuat fungsi koreksi yang merusak ID_ABSENSI") -- baris
 * dicari & diperbarui di tempat yang sama. Field yang tidak dikirim
 * (undefined) tidak diubah. Setiap koreksi WAJIB tercatat di audit log
 * (dites di TEST 23).
 */
function koreksiRosterV2(body) {
  const akses = requireAuth(body.token);
  const idAbsensi = sanitize(body.idAbsensi);
  if (!idAbsensi) throw new Error('ID_ABSENSI wajib diisi.');

  const sheet = getRosterSheetV2_();
  const idx = akunHeaderIndex_(sheet);
  const data = sheet.getDataRange().getValues();
  let baris = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_ABSENSI]) === idAbsensi) { baris = i + 1; break; }
  }
  if (baris === -1) throw new Error('Data presensi tidak ditemukan.');

  const perubahan = {};
  if (body.jamMasuk !== undefined) {
    const jm = sanitize(body.jamMasuk);
    if (jm && !/^\d{2}:\d{2}$/.test(jm)) throw new Error('Jam masuk wajib format HH:mm.');
    sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jm);
    if (jm) { paksaKolomTeks_(sheet, baris, idx.JAM_MASUK + 1); sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jm); }
    perubahan.jamMasuk = jm;
  }
  if (body.jamPulang !== undefined) {
    const jp = sanitize(body.jamPulang);
    if (jp && !/^\d{2}:\d{2}$/.test(jp)) throw new Error('Jam pulang wajib format HH:mm.');
    sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jp);
    if (jp) { paksaKolomTeks_(sheet, baris, idx.JAM_PULANG + 1); sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jp); }
    perubahan.jamPulang = jp;
  }
  if (body.statusKehadiran !== undefined) {
    const st = sanitize(body.statusKehadiran).toUpperCase();
    const valid = ['BELUM ABSEN', 'HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'CUTI', 'TIDAK HADIR', 'HADIR LENGKAP'];
    if (valid.indexOf(st) === -1) throw new Error('Status kehadiran tidak valid.');
    sheet.getRange(baris, idx.STATUS_KEHADIRAN + 1).setValue(st);
    perubahan.statusKehadiran = st;
  }
  if (body.keterangan !== undefined) {
    sheet.getRange(baris, idx.KETERANGAN + 1).setValue(sanitize(body.keterangan));
    perubahan.keterangan = sanitize(body.keterangan);
  }
  if (!Object.keys(perubahan).length) throw new Error('Tidak ada perubahan yang dikirim.');

  sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(new Date());
  _invalidasiCacheRosterV2_();
  logAudit_('KOREKSI_ROSTER_V2', 'ROSTER_V2', idAbsensi, akses, perubahan);
  return { success: true, idAbsensi: idAbsensi, perubahan: perubahan };
}


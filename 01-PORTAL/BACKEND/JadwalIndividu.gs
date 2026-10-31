/**
 * JadwalIndividu.gs — Pemeriksaan & Pengeditan Jadwal Individu
 * (PENGEMBANGAN PORTAL PENGELOLA/RELAWAN, poin 4-5)
 *
 * SENGAJA TIDAK membuat aturan "target hari kerja" baru -- target
 * dihitung ulang memakai fungsi YANG SUDAH ADA (resolveShiftUntukRelawan_,
 * DIVISI_KHUSUS di Kalender Operasional) PERSIS logika yang dipakai
 * buatRosterUntukOperasional_ sendiri utk memutuskan siapa berhak dapat
 * shift di tanggal mana. Kalau logika itu berubah di masa depan,
 * pemeriksaan ini otomatis ikut benar -- tidak ada rumus duplikat.
 */

/**
 * Pemeriksaan: seluruh jadwal 1 relawan dalam 1 periode, dibandingkan
 * dengan target (dihitung, bukan kolom tersimpan).
 */
function getJadwalIndividuRelawan(body) {
  requireAuth(body.token, true); // true = Staff boleh BACA (kebijakan: Staff akses sama seperti Admin, tapi hanya lihat)
  const idPeriode = sanitize(body.idPeriode);
  const idRelawan = sanitize(body.idRelawan);
  if (!idPeriode) throw new Error('Periode wajib dipilih.');
  if (!idRelawan) throw new Error('Relawan wajib dipilih.');

  const relawan = getRelawanById(idRelawan);
  if (!relawan) throw new Error('Relawan tidak ditemukan.');

  const kalenderPeriode = getKalenderRows_().filter(k => k.ID_PERIODE === idPeriode)
    .sort((a, b) => dmyKeKunciUrut_(a.TANGGAL_OPERASIONAL).localeCompare(dmyKeKunciUrut_(b.TANGGAL_OPERASIONAL)));
  if (!kalenderPeriode.length) throw new Error('Periode ini belum punya Kalender Operasional.');
  const idOperasionalDalamPeriode = new Set(kalenderPeriode.map(k => k.ID_OPERASIONAL));

  // Perbaikan 3/4/5/6 (Prompt Final): "sudah lewat" dihitung di SERVER,
  // dibandingkan terhadap tanggal operasional SIPRES (bukan dibandingkan
  // di browser Admin -- jam/tanggal perangkat bisa salah/beda zona).
  // Dipakai frontend utk menentukan Edit (belum lewat) vs Koreksi Absen
  // (sudah lewat) -- BUKAN lagi berdasarkan status BELUM ABSEN/tidak.
  const hariIniIso = tanggalSheetKeIso_(formatTanggal(new Date()));

  // PERBAIKAN: sebelumnya filter ini JUGA mensyaratkan r.ID_PERIODE ===
  // idPeriode -- tapi buatJadwalIndividu (fungsi "cegah jadwal ganda")
  // TIDAK memfilter berdasarkan periode, cuma relawan+ID_OPERASIONAL.
  // Kalau ADA baris roster yg ID_PERIODE tersimpannya tidak konsisten
  // dgn periode ID_OPERASIONAL yg sebenarnya, dua fungsi ini bisa saling
  // TIDAK SEPAKAT -- di sini bilang "belum ada", di buatJadwalIndividu
  // bilang "sudah ada" (persis gejala yg dilaporkan: "Belum Dibuat" tapi
  // pas dibuat ternyata sudah ada). ID_OPERASIONAL sendiri SUDAH unik
  // per tanggal per periode, jadi filter ID_PERIODE di sini sebenarnya
  // berlebihan -- diganti cocokkan ke idOperasionalDalamPeriode supaya
  // KEDUA fungsi selalu sepakat.
  const rosterRelawan = getRosterV2Rows_().filter(r => r.ID_ABSENSI && r.ID_RELAWAN === idRelawan && idOperasionalDalamPeriode.has(r.ID_OPERASIONAL));
  const rosterByOperasional = {};
  rosterRelawan.forEach(r => { rosterByOperasional[r.ID_OPERASIONAL] = r; });

  let targetHariKerja = 0, terjadwal = 0;
  const daftarTanggal = kalenderPeriode.map(k => {
    const roster = rosterByOperasional[k.ID_OPERASIONAL];

    // Eligibilitas dihitung PERSIS seperti generator roster asli:
    // resolveShiftUntukRelawan_ (Penugasan Khusus lalu Shift Divisi),
    // DIVISI_KHUSUS tanggal itu dicek terpisah krn resolveShiftUntukRelawan_
    // sendiri tidak mengeceknya (itu baru dicek di
    // getRelawanRosterUntukOperasional_, yg bekerja utk SEMUA relawan
    // sekaligus -- di sini kita cuma perlu utk SATU relawan).
    const shiftSeharusnya = resolveShiftUntukRelawan_(idRelawan, k.ID_OPERASIONAL);
    let eligible = !!(shiftSeharusnya && shiftSeharusnya.jamMasuk);
    if (eligible && k.DIVISI_KHUSUS) {
      const daftarDivisiKhusus = String(k.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean);
      if (daftarDivisiKhusus.length && daftarDivisiKhusus.indexOf(relawan.divisi) === -1) eligible = false;
    }
    if (eligible) targetHariKerja++;
    if (roster) terjadwal++;

    return {
      idOperasional: k.ID_OPERASIONAL, tanggal: k.TANGGAL_OPERASIONAL, hari: k.HARI,
      adaJadwal: !!roster,
      idAbsensi: roster ? roster.ID_ABSENSI : null,
      divisi: roster ? roster.DIVISI : (eligible ? relawan.divisi : null),
      jenisPenugasan: roster ? roster.NAMA_SHIFT : null,
      jamMasuk: roster ? roster.JAM_JADWAL_MASUK : (eligible ? shiftSeharusnya.jamMasuk : null),
      jamPulang: roster ? roster.JAM_JADWAL_PULANG : (eligible && shiftSeharusnya.jamPulang ? shiftSeharusnya.jamPulang : null),
      catatan: roster ? (roster.KETERANGAN || '') : '',
      statusKehadiran: roster ? roster.STATUS_KEHADIRAN : null,
      statusMasuk: roster ? roster.STATUS_MASUK : null, // 'BELUM' = belum pernah absen sama sekali -> tombol Edit/Hapus; selain itu -> tombol Koreksi Absen
      jamMasukAktual: roster ? (roster.JAM_MASUK || '') : '', // jam SCAN sungguhan (beda dari jamMasuk di atas, yg itu jadwal/rencana) -- dipakai mengisi form Koreksi Absen
      jamPulangAktual: roster ? (roster.JAM_PULANG || '') : '',
      // true = tanggal ini relawan SEHARUSNYA kerja (target) tapi BELUM ada baris jadwal -- ini yg Admin perlu "Buat Jadwal".
      perluDibuat: eligible && !roster,
      // Perbaikan 3/4/5/6: true kalau tanggal operasional ini SUDAH lewat
      // (dibanding tanggal server, lihat hariIniIso di atas) -- dipakai
      // frontend menentukan Edit vs Koreksi Absen, LEPAS dari status
      // presensinya (beda dari logika lama yg berdasar status BELUM ABSEN).
      sudahLewat: !!(tanggalSheetKeIso_(k.TANGGAL_OPERASIONAL) && tanggalSheetKeIso_(k.TANGGAL_OPERASIONAL) < hariIniIso)
    };
  });

  // Catatan: krn rosterRelawan SEKARANG sudah difilter pakai
  // idOperasionalDalamPeriode (lihat di atas), baris anomali jenis ini
  // tidak akan pernah lagi muncul di sini -- dipertahankan sbg pengaman
  // kalau nanti ada perubahan lain yg melewatkan filter itu.
  const jumlahAnomali = rosterRelawan.filter(r => !idOperasionalDalamPeriode.has(r.ID_OPERASIONAL)).length;

  let status;
  if (jumlahAnomali) status = 'perlu_diperiksa';
  else if (terjadwal === targetHariKerja) status = 'sesuai';
  else if (terjadwal < targetHariKerja) status = 'kurang';
  else status = 'berlebih';

  return {
    relawan: { id: relawan.id, nama: relawan.nama, divisi: relawan.divisi },
    idPeriode: idPeriode,
    targetHariKerja: targetHariKerja, terjadwal: terjadwal, status: status,
    daftarTanggal: daftarTanggal, jumlahAnomali: jumlahAnomali
  };
}

/** Daftar relawan utk pencarian/pemilihan nama (dipakai dropdown pencarian). */
function getDaftarRelawanUntukJadwalIndividu(body) {
  requireAuth(body.token, true); // true = Staff boleh BACA
  return getRelawanList(null, false).map(r => ({ id: r.id, nama: r.nama, divisi: r.divisi }));
}

/**
 * Buat jadwal utk tanggal yg BELUM ada baris sama sekali. Reuse PENUH
 * addPenugasanKhusus (Shift.gs) -- bukan logika baru -- supaya tetap
 * konsisten dgn jalur Penugasan Khusus yg sudah ada (termasuk
 * notifikasi & propagasi roster). Satu tambahan: cegah eksplisit kalau
 * ternyata SUDAH ada baris (poin "cegah jadwal ganda").
 */
function buatJadwalIndividu(body) {
  const aktorBaru = requireAuth(body.token); // cek otorisasi LANGSUNG di sini -- jangan andalkan addPenugasanKhusus saja, supaya baca data (pengecekan dobel di bawah) juga tidak berjalan sebelum izin tervalidasi
  requireIzinModulBaru_(aktorBaru, 'JADWAL_PENUGASAN', 'CREATE');
  const idRelawan = sanitize(body.idRelawan);
  const idOperasional = sanitize(body.idOperasional);
  const sudahAda = getRosterV2Rows_().some(r => r.ID_ABSENSI && r.ID_RELAWAN === idRelawan && r.ID_OPERASIONAL === idOperasional);
  if (sudahAda) throw new Error('Relawan ini sudah punya jadwal di tanggal ini -- gunakan Edit Jadwal, bukan Buat Jadwal.');
  return addPenugasanKhusus(body);
}

/**
 * Ubah jadwal yg SUDAH ADA -- mengedit baris roster LANGSUNG (jam
 * jadwal masuk/pulang, catatan). BUKAN mengedit jam ABSENSI SUNGGUHAN
 * (JAM_MASUK/JAM_PULANG hasil scan) -- itu kolom terpisah, tidak
 * disentuh sama sekali di sini, sesuai larangan "jangan mengubah data
 * kehadiran aktual hanya karena jadwal berubah".
 * Jam pulang BOLEH lebih kecil dari jam masuk (shift lintas tengah
 * malam, mis. 23:00-07:00) -- itu pola valid yg sudah didukung sistem,
 * tidak divalidasi sbg error di sini.
 */
function ubahJadwalIndividu(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'EDIT');
  const idAbsensi = sanitize(body.idAbsensi);
  if (!idAbsensi) throw new Error('ID jadwal wajib diisi.');
  const jamMasuk = sanitize(body.jamMasuk);
  const jamPulang = sanitize(body.jamPulang);
  if (!/^\d{2}:\d{2}$/.test(jamMasuk)) throw new Error('Jam masuk wajib format HH:mm.');
  if (jamPulang && !/^\d{2}:\d{2}$/.test(jamPulang)) throw new Error('Jam pulang wajib format HH:mm.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada perubahan jadwal lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getRosterSheetV2_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_ABSENSI]) !== idAbsensi) continue;
      const baris = i + 1;
      const sebelum = {
        JAM_JADWAL_MASUK: data[i][idx.JAM_JADWAL_MASUK], JAM_JADWAL_PULANG: data[i][idx.JAM_JADWAL_PULANG],
        KETERANGAN: data[i][idx.KETERANGAN]
      };

      sheet.getRange(baris, idx.JAM_JADWAL_MASUK + 1).setValue(jamMasuk);
      paksaKolomTeks_(sheet, baris, idx.JAM_JADWAL_MASUK + 1);
      sheet.getRange(baris, idx.JAM_JADWAL_MASUK + 1).setValue(jamMasuk);

      sheet.getRange(baris, idx.JAM_JADWAL_PULANG + 1).setValue(jamPulang);
      if (jamPulang) {
        paksaKolomTeks_(sheet, baris, idx.JAM_JADWAL_PULANG + 1);
        sheet.getRange(baris, idx.JAM_JADWAL_PULANG + 1).setValue(jamPulang);
      }

      const catatanBaru = sanitize(body.catatan);
      sheet.getRange(baris, idx.KETERANGAN + 1).setValue(catatanBaru);
      sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(new Date());

      _invalidasiCacheRosterV2_();
      logAudit_('UBAH_JADWAL_INDIVIDU', 'ROSTER_V2', idAbsensi, aktor, {
        sebelum: sebelum, sesudah: { JAM_JADWAL_MASUK: jamMasuk, JAM_JADWAL_PULANG: jamPulang, KETERANGAN: catatanBaru }
      });
      return { idAbsensi: idAbsensi, jamMasuk: jamMasuk, jamPulang: jamPulang, catatan: catatanBaru };
    }
    throw new Error('Jadwal tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hapus 1 baris jadwal (roster) sepenuhnya. SENGAJA HANYA bisa dipakai
 * selama STATUS_MASUK relawan itu masih 'BELUM' (belum pernah absen sama
 * sekali di baris ini) -- sesuai larangan eksplisit "jangan mengubah
 * riwayat presensi/kehadiran tanpa prosedur jelas". Kalau sudah ada
 * absensi sungguhan tercatat, tombol ini ditolak backend -- gunakan
 * prosedur Koreksi Tanggal yang sudah ada kalau baris itu memang perlu
 * dibetulkan, bukan dihapus begitu saja.
 *
 * Dipakai khususnya utk membersihkan baris "nyasar" -- mis. baris lama
 * yang dibuat SEBELUM DIVISI_KHUSUS diisi di tanggal itu (lihat
 * keterbatasan terdokumentasi di buatRosterUntukOperasional_, Roster.gs)
 * -- relawan yg seharusnya tidak lagi berhak di tanggal itu, tapi
 * barisnya masih tertinggal krn sistem tidak retroaktif menghapusnya.
 */
function hapusJadwalIndividu(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'DELETE');
  const idAbsensi = sanitize(body.idAbsensi);
  if (!idAbsensi) throw new Error('ID jadwal wajib diisi.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada perubahan jadwal lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getRosterSheetV2_();
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_ABSENSI]) !== idAbsensi) continue;
      // Dicek DUA kolom: STATUS_MASUK (jam scan Masuk sungguhan) DAN
      // STATUS_KEHADIRAN (krn Koreksi Absen bisa mengubah baris jadi
      // IZIN/SAKIT/CUTI dengan STATUS_MASUK dikembalikan ke 'BELUM' --
      // baris begitu TETAP tidak boleh dihapus diam-diam, krn itu catatan
      // Izin/Sakit/Cuti yg sah, bukan baris kosong).
      if (String(data[i][idx.STATUS_MASUK]) !== 'BELUM' || String(data[i][idx.STATUS_KEHADIRAN]) !== 'BELUM ABSEN') {
        throw new Error('Baris ini sudah punya catatan kehadiran (Masuk, atau status Izin/Sakit/Cuti) -- tidak bisa dihapus. Gunakan Koreksi Absen kalau perlu dibetulkan.');
      }
      const dataSebelum = { TANGGAL_OPERASIONAL: data[i][idx.TANGGAL_OPERASIONAL], DIVISI: data[i][idx.DIVISI], NAMA_SHIFT: data[i][idx.NAMA_SHIFT] };
      sheet.deleteRow(i + 1);
      _invalidasiCacheRosterV2_();
      logAudit_('HAPUS_JADWAL_INDIVIDU', 'ROSTER_V2', idAbsensi, aktor, { sebelum: dataSebelum });
      return { idAbsensi: idAbsensi };
    }
    throw new Error('Jadwal tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

const STATUS_KOREKSI_ABSEN_VALID = ['HADIR', 'IZIN', 'SAKIT', 'CUTI', 'ALFA'];

/**
 * Koreksi Absen -- BEDA dari Koreksi Tanggal (yang cuma memindahkan baris
 * ke ID_OPERASIONAL lain, tidak pernah menyentuh jam) dan BEDA dari
 * Tandai Hadir Manual (yang cuma jalan kalau STATUS_MASUK masih 'BELUM').
 * Ini KHUSUS utk baris yang SUDAH punya catatan Masuk sungguhan tapi
 * datanya SALAH -- bisa jadi jam-nya salah scan, atau ternyata harusnya
 * bukan Hadir sama sekali (mis. relawan sebenarnya Izin/Sakit/Cuti, atau
 * sama sekali tidak masuk/Alfa tapi tercatat absen krn kesalahan).
 *
 * statusBaru salah satu dari STATUS_KOREKSI_ABSEN_VALID:
 * - 'HADIR'  -> wajib jamMasuk & jamPulang, kolom gizi/kehadiran diisi
 *   lengkap (STATUS_KEHADIRAN = 'HADIR LENGKAP'), SAMA persis pola
 *   tandaiHadirManual_ di Shift.gs.
 * - 'IZIN' / 'SAKIT' / 'CUTI' -> kosakata & kolom yg disentuh (cuma
 *   STATUS_KEHADIRAN + KETERANGAN) PERSIS meniru approveKetidakhadiran_
 *   di PengajuanKetidakhadiran.gs, supaya rekap tetap konsisten dgn
 *   jalur Pengajuan Ketidakhadiran yg sudah ada. Jam & status masuk/
 *   pulang DIKOSONGKAN -- relawan dianggap tidak datang hari itu.
 * - 'ALFA'   -> mengembalikan ke STATUS_KEHADIRAN 'BELUM ABSEN' (nilai
 *   default sistem) -- INI BUKAN status baru, cuma "batalkan kehadiran
 *   yang salah tercatat". Begitu tanggalnya lewat, rekap OTOMATIS
 *   menghitungnya sbg "Tidak Hadir" (lihat getRekapDuaMinggu_,
 *   Absensi.gs: belumAbsen+tanggal lewat = tidakHadir) -- tidak perlu
 *   string status terpisah utk "Alfa".
 *
 * Wajib isi keterangan (sama seperti Tandai Hadir Manual) -- tercatat
 * utk audit krn memengaruhi rekap penggajian.
 */
function koreksiAbsensiAktual(body) {
  const akses = requireAuth(body.token);
  requireIzinModulBaru_(akses, 'SIPRES', 'EDIT'); // koreksi presensi -- masuk modul SIPRES, bukan Jadwal & Penugasan (ini soal DATA ABSENSI, bukan jadwal/penugasannya)
  const idAbsensi = sanitize(body.idAbsensi);
  const keterangan = sanitize(body.keterangan);
  const statusBaru = sanitize(body.statusBaru);
  if (!idAbsensi) throw new Error('ID_ABSENSI wajib diisi.');
  if (!keterangan) throw new Error('Keterangan/alasan koreksi wajib diisi (akan tercatat untuk audit, memengaruhi rekap penggajian).');
  if (STATUS_KOREKSI_ABSEN_VALID.indexOf(statusBaru) === -1) throw new Error('Status baru tidak valid -- harus salah satu dari: ' + STATUS_KOREKSI_ABSEN_VALID.join(', ') + '.');

  let jamMasukBaru = '', jamPulangBaru = '';
  if (statusBaru === 'HADIR') {
    jamMasukBaru = sanitize(body.jamMasuk);
    jamPulangBaru = sanitize(body.jamPulang);
    if (!jamMasukBaru || !/^\d{2}:\d{2}$/.test(jamMasukBaru)) throw new Error('Jam masuk wajib diisi, format HH:mm.');
    if (!jamPulangBaru || !/^\d{2}:\d{2}$/.test(jamPulangBaru)) throw new Error('Jam pulang wajib diisi, format HH:mm.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk, ada koreksi absen lain yang masih diproses. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const idx = akunHeaderIndex_(sheet);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.ID_ABSENSI]) !== idAbsensi) continue;
      const baris = i + 1;
      // Perbaikan 18 Okt 2026 (dilaporkan Admin -- kebutuhan nyata:
      // relawan hadir tapi lupa absen/barcode bermasalah, perlu
      // dikoreksi). SEBELUMNYA baris BELUM ABSEN ditolak di sini,
      // mengarahkan ke "Tandai Hadir Manual" -- tapi tombol itu SUDAH
      // DIHAPUS saat form disatukan jadi "Koreksi Absen" (lihat
      // JadwalIndividu.gs/admin-jadwal-individu.js versi sebelumnya),
      // jadi guard ini jadi JALAN BUNTU: Admin diarahkan ke fitur yg
      // tidak ada. Fungsi ini SUDAH MAMPU menangani baris BELUM ABSEN
      // dgn benar (kode di bawah menulis status/jam apa pun yg diminta,
      // tidak bergantung pada status SEBELUMNYA) -- guard ini dihapus,
      // bukan diganti logika baru.

      const sebelum = {
        JAM_MASUK: data[i][idx.JAM_MASUK], JAM_PULANG: data[i][idx.JAM_PULANG],
        STATUS_MASUK: data[i][idx.STATUS_MASUK], STATUS_PULANG: data[i][idx.STATUS_PULANG], STATUS_KEHADIRAN: data[i][idx.STATUS_KEHADIRAN]
      };
      const now = new Date();
      // Catatan: KETERANGAN sheet diisi teks alasan APA ADANYA (bukan
      // diawali "[Koreksi Absen oleh X, tanggal jam]") -- siapa & kapan
      // SUDAH tercatat independen lewat logAudit_() di bawah (parameter
      // akses + WAKTU otomatis), yg jadi sumber Laporan Koreksi Presensi.
      // Menambah prefix di KETERANGAN cuma bikin kolom Catatan di tabel
      // penuh teks administratif, bukan alasan yg sebenarnya ingin dibaca.

      if (statusBaru === 'HADIR') {
        sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jamMasukBaru);
        paksaKolomTeks_(sheet, baris, idx.JAM_MASUK + 1);
        sheet.getRange(baris, idx.JAM_MASUK + 1).setValue(jamMasukBaru);
        sheet.getRange(baris, idx.STATUS_MASUK + 1).setValue('HADIR');

        sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamPulangBaru);
        paksaKolomTeks_(sheet, baris, idx.JAM_PULANG + 1);
        sheet.getRange(baris, idx.JAM_PULANG + 1).setValue(jamPulangBaru);
        sheet.getRange(baris, idx.STATUS_PULANG + 1).setValue('VALID');

        sheet.getRange(baris, idx.STATUS_KEHADIRAN + 1).setValue('HADIR LENGKAP');
      } else {
        // IZIN / SAKIT / CUTI / ALFA -- relawan dianggap TIDAK datang hari
        // itu, jam & status masuk-pulang dikosongkan supaya tidak ada
        // data setengah-setengah (jam ada tapi status bilang tidak masuk).
        sheet.getRange(baris, idx.JAM_MASUK + 1).setValue('');
        sheet.getRange(baris, idx.JAM_PULANG + 1).setValue('');
        sheet.getRange(baris, idx.STATUS_MASUK + 1).setValue('BELUM');
        sheet.getRange(baris, idx.STATUS_PULANG + 1).setValue('BELUM');
        sheet.getRange(baris, idx.STATUS_KEHADIRAN + 1).setValue(statusBaru === 'ALFA' ? 'BELUM ABSEN' : statusBaru);
      }

      sheet.getRange(baris, idx.KETERANGAN + 1).setValue(keterangan);
      sheet.getRange(baris, idx.DIUBAH_PADA + 1).setValue(now);

      _invalidasiCacheRosterV2_();
      logAudit_('KOREKSI_ABSENSI_AKTUAL', 'ABSENSI', idAbsensi, akses, { sebelum: sebelum, statusBaru: statusBaru, jamMasukBaru: jamMasukBaru, jamPulangBaru: jamPulangBaru, keterangan: keterangan });
      return { idAbsensi: idAbsensi, statusBaru: statusBaru, jamMasuk: jamMasukBaru, jamPulang: jamPulangBaru };
    }
    throw new Error('Baris absensi tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * ===== PENYATUAN KOREKSI TANGGAL + KOREKSI ABSEN =====
 * (Keputusan Final Implementasi, poin 1)
 *
 * Audit sebelum menyatukan menemukan: Koreksi Tanggal (lama, Shift.gs)
 * dan Koreksi Absen (baru, di atas) SEBENARNYA TIDAK saling tumpang
 * tindih -- Koreksi Tanggal memindahkan baris ke ID_OPERASIONAL lain
 * (tanggal), Koreksi Absen mengubah JAM/STATUS. Yang tumpang tindih
 * cuma PENGALAMAN PENGGUNANYA: dua panel terpisah, Admin harus tahu
 * mana yang mana. Makanya BUKAN salah satu backend "menang" dan yang
 * lain dibuang -- keduanya DIPERTAHANKAN APA ADANYA (koreksiTanggalOperasionalAbsensi
 * & tandaiHadirManual, Shift.gs, SUDAH matang & dipakai tempat lain)
 * dan di sini CUMA dibungkus tipis supaya bisa dipanggil dari SATU
 * tempat (Pemeriksaan Jadwal Individu) dgn penamaan yg konsisten.
 * Panel "Koreksi Tanggal" lama di nav SIKOP dihapus -- bukan backend-nya.
 */

/** Bungkus tandaiHadirManual (Shift.gs) -- dipanggil dari tombol "Tandai Hadir" di Pemeriksaan Jadwal Individu. */
function tandaiHadirJadwalIndividu(body) {
  return tandaiHadirManual(body);
}

/** Bungkus koreksiTanggalOperasionalAbsensi (Shift.gs) -- dipanggil dari tombol "Pindah Tanggal". */
function pindahTanggalJadwalIndividu(body) {
  return koreksiTanggalOperasionalAbsensi(body);
}


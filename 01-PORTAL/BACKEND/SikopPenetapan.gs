/**
 * SikopPenetapan.gs — Validasi + Penetapan Jadwal Resmi per Divisi
 * (18 Okt 2026, SIKOP). File BARU, terpisah -- tidak mengubah roster/
 * absensi yang sudah berjalan. Validasi di sini adalah SUBSET dari
 * yang diminta dokumen (§11) -- cuma "shift wajib belum terisi", yang
 * paling kritis & paling bisa dipastikan tanpa menebak aturan lain yg
 * belum sepenuhnya diverifikasi (rotasi, bentrok, dll -- menyusul).
 * DIDOKUMENTASIKAN jujur, bukan diklaim lengkap.
 */

/**
 * Validasi jadwal 1 (periode, divisi) -- dipanggil Pemeriksaan Jadwal
 * DAN sbg gerbang wajib sebelum Tetapkan (§13 "tolak penetapan jika
 * masih ada kesalahan yang menghambat").
 *
 * Kesalahan (menghambat penetapan): relawan AKTIF di divisi ini TIDAK
 * punya baris roster utk 1+ tanggal operasional dalam periode --
 * berarti "shift wajib belum terisi" (dasar: eligibilitas yg SAMA
 * dipakai getRelawanRosterUntukOperasional_, Roster.gs -- relawan yg
 * seharusnya kebagian shift tapi resolveShiftUntukRelawan_ gagal
 * resolve, mis. belum di-assign Kelompok utk divisi yg butuh rotasi).
 */
function validasiJadwalDivisi(body) {
  requireAuth(body.token, true);
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);
  if (!idPeriode || !namaDivisi) throw new Error('Periode dan divisi wajib diisi.');

  const kalenderPeriode = getKalenderRows_().filter(k => k.ID_PERIODE === idPeriode);
  const relawanDivisiAktif = getRelawanList(null, false).filter(r => r.divisi === namaDivisi);
  const rosterSemua = getRosterV2Rows_();

  const kesalahan = [];
  const peringatan = [];

  // Disambungkan 21 Okt 2026 (dokumen Pembaruan SIKOP §D.4) -- baca
  // preferensi Aktif/Nonaktif Admin dari 45_VALIDASI_JADWAL_KONFIG.
  // Aturan WAJIB (shift_wajib_terisi, rotasi_sesuai) TIDAK dicek di
  // sini sama sekali -- SELALU jalan tanpa syarat (ditegakkan di DUA
  // tempat: backend simpanKonfigurasiValidasiJadwal menolak mematikan-
  // nya, DAN kode pemeriksaan di bawah tidak membaca togglenya).
  const aturanAktif = {};
  sheetToObjects(getValidasiJadwalKonfigSheet_()).forEach(v => { aturanAktif[v.ID_ATURAN] = !!v.AKTIF; });

  // Divisi ini pakai Multi-Shift? (35_SHIFT_DIVISI_DETAIL ada isinya
  // utk periode+divisi ini) -- kalau ya, 2 pemeriksaan TAMBAHAN berlaku
  // (rotasi & Jumat); kalau tidak, divisi ini tetap cuma dicek
  // kelengkapan shift wajib spt sebelumnya (TIDAK dipaksa aturan
  // Multi-Shift yg tidak relevan utk divisi 1-shift biasa).
  const detailMultiShift = sheetToObjects(getShiftDivisiDetailSheet_()).filter(d => d.ID_PERIODE === idPeriode && d.NAMA_DIVISI === namaDivisi);
  const pakaiMultiShift = detailMultiShift.length > 0;
  const hariKhususConfig = detailMultiShift.find(d => d.HARI_KHUSUS);

  kalenderPeriode.forEach(k => {
    const daftarDivisiKhusus = k.DIVISI_KHUSUS ? String(k.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean) : [];
    if (daftarDivisiKhusus.length && daftarDivisiKhusus.indexOf(namaDivisi) === -1) return; // divisi ini memang tidak operasional tanggal ini -- bukan kesalahan

    const namaHariIni = String(k.HARI || '').toUpperCase();
    const iniHariKhusus = hariKhususConfig && String(hariKhususConfig.HARI_KHUSUS).toUpperCase() === namaHariIni;

    relawanDivisiAktif.forEach(r => {
      const rosterBaris = rosterSemua.find(rr => rr.ID_OPERASIONAL === k.ID_OPERASIONAL && rr.ID_RELAWAN === r.id);
      if (!rosterBaris) {
        kesalahan.push({
          tingkat: 'KESALAHAN', judul: 'Shift wajib belum terisi',
          penjelasan: `${r.nama} (${namaDivisi}) tidak punya penugasan pada ${k.TANGGAL_OPERASIONAL} (${k.HARI}) -- kemungkinan belum di-assign Kelompok Rotasi kalau divisi ini pakai Multi-Shift.`,
          tanggal: k.TANGGAL_OPERASIONAL, idRelawan: r.id, nama: r.nama
        });
        return;
      }

      // BARU (21 Okt 2026, §D.4 -- aturan opsional "jam_tidak_kosong").
      if (aturanAktif.jam_tidak_kosong !== false && !String(rosterBaris.JAM_JADWAL_MASUK || '').trim()) {
        kesalahan.push({
          tingkat: 'KESALAHAN', judul: 'Jam masuk kosong',
          penjelasan: `${r.nama} punya baris roster pada ${k.TANGGAL_OPERASIONAL} (${k.HARI}) tapi jam masuknya kosong.`,
          tanggal: k.TANGGAL_OPERASIONAL, idRelawan: r.id, nama: r.nama
        });
      }

      // Pemeriksaan TAMBAHAN khusus divisi Multi-Shift (§11.9 rotasi,
      // §11.10 pola Jumat) -- re-resolve shift YANG SEHARUSNYA berlaku
      // (resolveMultiShiftUntukRelawan_, sumber kebenaran yg SAMA
      // dipakai saat roster dibuat) lalu bandingkan dgn yg TERSIMPAN di
      // roster. Beda berarti data basi (mis. roster dibuat SEBELUM
      // Kelompok di-assign, atau diubah manual keliru).
      if (pakaiMultiShift) {
        const seharusnya = resolveMultiShiftUntukRelawan_(r.id, k.ID_OPERASIONAL);
        if (seharusnya && seharusnya.jamMasuk !== String(rosterBaris.JAM_JADWAL_MASUK || '')) {
          if (iniHariKhusus) {
            kesalahan.push({
              tingkat: 'KESALAHAN', judul: 'Pola hari khusus belum sesuai',
              penjelasan: `${r.nama} pada ${k.TANGGAL_OPERASIONAL} (${k.HARI}) seharusnya masuk jam ${seharusnya.jamMasuk} (hari khusus/masuk bersama) tapi roster tercatat ${rosterBaris.JAM_JADWAL_MASUK || '-'} -- kemungkinan roster dibuat sebelum pola hari khusus diatur, perlu dibuat ulang jadwalnya.`,
              tanggal: k.TANGGAL_OPERASIONAL, idRelawan: r.id, nama: r.nama
            });
          } else {
            kesalahan.push({
              tingkat: 'KESALAHAN', judul: 'Rotasi shift belum sesuai',
              penjelasan: `${r.nama} pada ${k.TANGGAL_OPERASIONAL} (${k.HARI}) seharusnya shift jam ${seharusnya.jamMasuk} sesuai rotasi Kelompok, tapi roster tercatat ${rosterBaris.JAM_JADWAL_MASUK || '-'} -- kemungkinan roster dibuat sebelum Kelompok Rotasi diatur/diubah, perlu dibuat ulang jadwalnya.`,
              tanggal: k.TANGGAL_OPERASIONAL, idRelawan: r.id, nama: r.nama
            });
          }
        }
      }
    });

    // §11.10: pada hari khusus (mis. Jumat Pengolahan), SELURUH anggota
    // divisi aktif WAJIB tercakup dgn jam yg SAMA (masuk bersama) --
    // dicek terpisah dari loop per-relawan di atas supaya pesannya
    // SATU per tanggal (bukan berulang per orang kalau banyak yg hilang).
    if (iniHariKhusus && pakaiMultiShift && aturanAktif.hari_khusus_seragam !== false) {
      const rosterHariKhususIni = rosterSemua.filter(rr => rr.ID_OPERASIONAL === k.ID_OPERASIONAL && rr.DIVISI === namaDivisi);
      const jamBerbeda = new Set(rosterHariKhususIni.map(rr => rr.JAM_JADWAL_MASUK));
      if (jamBerbeda.size > 1) {
        peringatan.push({
          tingkat: 'PERINGATAN', judul: 'Pola hari khusus belum seragam',
          penjelasan: `Pada ${k.TANGGAL_OPERASIONAL} (${k.HARI}), ditemukan ${jamBerbeda.size} jam masuk berbeda di divisi ${namaDivisi} -- seharusnya SATU jam yang sama untuk semua (masuk bersama).`,
          tanggal: k.TANGGAL_OPERASIONAL
        });
      }
    }
  });

  // BARU (21 Okt 2026, §D.4 -- aturan opsional "tidak_ada_penugasan_ganda").
  // Lintas-tanggal, jadi dicek SETELAH loop utama -- cari relawan yg
  // punya LEBIH dari 1 baris roster di ID_OPERASIONAL yg SAMA.
  if (aturanAktif.tidak_ada_penugasan_ganda !== false) {
    const idOperasionalPeriode = new Set(kalenderPeriode.map(k => k.ID_OPERASIONAL));
    const hitung = {};
    rosterSemua.forEach(rr => {
      if (!idOperasionalPeriode.has(rr.ID_OPERASIONAL) || rr.DIVISI !== namaDivisi) return;
      const kunci = rr.ID_OPERASIONAL + '|' + rr.ID_RELAWAN;
      hitung[kunci] = (hitung[kunci] || 0) + 1;
    });
    Object.keys(hitung).forEach(kunci => {
      if (hitung[kunci] <= 1) return;
      const [idOp, idRelawan] = kunci.split('|');
      const k = kalenderPeriode.find(kk => kk.ID_OPERASIONAL === idOp);
      const r = relawanDivisiAktif.find(rr => rr.id === idRelawan);
      kesalahan.push({
        tingkat: 'KESALAHAN', judul: 'Penugasan ganda',
        penjelasan: `${r ? r.nama : idRelawan} punya ${hitung[kunci]} baris roster pada ${k ? k.TANGGAL_OPERASIONAL : idOp} -- seharusnya cuma 1. Gunakan Diagnostik Duplikat Roster untuk memperbaiki.`,
        tanggal: k ? k.TANGGAL_OPERASIONAL : '', idRelawan: idRelawan, nama: r ? r.nama : idRelawan
      });
    });
  }

  // BARU (22 Okt 2026, §D.4 -- 3 aturan opsional lagi): cek integritas
  // data roster yg SUDAH TERSIMPAN thd kalender & data relawan SAAT
  // INI -- berguna kalau kalender/divisi relawan berubah SETELAH
  // roster dibuat (data jadi basi), bukan cuma validasi saat pembuatan.
  const idOperasionalPeriodeIni = new Set(kalenderPeriode.map(k => k.ID_OPERASIONAL));
  const rosterDivisiIni = rosterSemua.filter(rr => idOperasionalPeriodeIni.has(rr.ID_OPERASIONAL) && rr.DIVISI === namaDivisi);
  rosterDivisiIni.forEach(rr => {
    const k = kalenderPeriode.find(kk => kk.ID_OPERASIONAL === rr.ID_OPERASIONAL);
    if (!k) return;

    if (aturanAktif.tidak_jadwal_di_libur !== false && String(k.STATUS || 'AKTIF').toUpperCase() !== 'AKTIF') {
      kesalahan.push({
        tingkat: 'KESALAHAN', judul: 'Jadwal di tanggal Libur',
        penjelasan: `${rr.NAMA_RELAWAN} punya penugasan pada ${k.TANGGAL_OPERASIONAL}, padahal tanggal itu berstatus Libur di Kalender Operasional.`,
        tanggal: k.TANGGAL_OPERASIONAL, idRelawan: rr.ID_RELAWAN, nama: rr.NAMA_RELAWAN
      });
    }

    if (aturanAktif.divisi_sesuai_cakupan_khusus !== false) {
      const daftarDivisiKhususIni = k.DIVISI_KHUSUS ? String(k.DIVISI_KHUSUS).split(',').map(d => d.trim()).filter(Boolean) : [];
      if (daftarDivisiKhususIni.length && daftarDivisiKhususIni.indexOf(namaDivisi) === -1) {
        kesalahan.push({
          tingkat: 'KESALAHAN', judul: 'Divisi di luar cakupan Operasional Khusus',
          penjelasan: `${rr.NAMA_RELAWAN} (${namaDivisi}) punya penugasan pada ${k.TANGGAL_OPERASIONAL}, tapi tanggal itu Operasional Khusus dan divisi ini TIDAK termasuk cakupan yang diizinkan.`,
          tanggal: k.TANGGAL_OPERASIONAL, idRelawan: rr.ID_RELAWAN, nama: rr.NAMA_RELAWAN
        });
      }
    }

    if (aturanAktif.divisi_anggota_sesuai !== false) {
      const relawanSaatIni = getRelawanById(rr.ID_RELAWAN);
      if (relawanSaatIni && relawanSaatIni.divisi !== namaDivisi) {
        peringatan.push({
          tingkat: 'PERINGATAN', judul: 'Divisi anggota tidak sesuai',
          penjelasan: `${rr.NAMA_RELAWAN} tercatat di roster divisi ${namaDivisi} pada ${k.TANGGAL_OPERASIONAL}, tapi data relawan saat ini menunjukkan divisinya adalah ${relawanSaatIni.divisi} -- kemungkinan relawan dipindah divisi setelah jadwal ini dibuat.`,
          tanggal: k.TANGGAL_OPERASIONAL, idRelawan: rr.ID_RELAWAN, nama: rr.NAMA_RELAWAN
        });
      }
    }
  });

  return {
    valid: kesalahan.length === 0,
    jumlahKesalahan: kesalahan.length,
    jumlahPeringatan: peringatan.length,
    kesalahan: kesalahan,
    peringatan: peringatan,
    catatan: pakaiMultiShift
      ? 'Validasi mencakup kelengkapan shift wajib, kesesuaian rotasi mingguan, dan pola hari khusus (masuk bersama). Pemeriksaan bentrok jam lintas-divisi belum tercakup.'
      : 'Validasi mencakup kelengkapan shift wajib (divisi ini belum dikonfigurasi Multi-Shift).'
  };
}

/**
 * Ringkasan pemeriksaan LINTAS SEMUA DIVISI dalam 1 periode -- utk
 * kartu ringkasan Pemeriksaan Jadwal (§11 "Total divisi, Divisi siap,
 * dst", SEMUA dihitung aktual, tidak di-hardcode).
 */
/**
 * Diperluas 18 Okt 2026 (UI sebelumnya tidak sesuai wireframe dokumen --
 * halaman Pemeriksaan Jadwal butuh 3 kartu Valid/Peringatan/Kesalahan +
 * DAFTAR TEMUAN lintas-divisi, bukan cuma angka per divisi). Sekarang
 * SEKALIAN mengembalikan seluruh temuan (kesalahan+peringatan) dari
 * SEMUA divisi, masing-masing ditandai nama divisinya -- cukup 1
 * panggilan utk mengisi 3 kartu DAN daftar temuan, sesuai wireframe
 * "[Valid][Peringatan][Kesalahan]" + "[Daftar Temuan]".
 */
function getRingkasanPemeriksaanPeriode(body) {
  requireAuth(body.token, true);
  const idPeriode = sanitize(body.idPeriode);
  if (!idPeriode) throw new Error('Periode wajib dipilih.');

  const daftarDivisi = getDivisiList(); // fungsi lama, sudah ada -- daftar divisi aktual, bukan dikarang
  const semuaTemuan = [];
  const hasil = daftarDivisi.map(d => {
    const v = validasiJadwalDivisi({ token: body.token, idPeriode: idPeriode, namaDivisi: d });
    v.kesalahan.forEach(k => semuaTemuan.push(Object.assign({ divisi: d }, k)));
    v.peringatan.forEach(p => semuaTemuan.push(Object.assign({ divisi: d }, p)));
    return { divisi: d, valid: v.valid, jumlahKesalahan: v.jumlahKesalahan, jumlahPeringatan: v.jumlahPeringatan };
  });

  const totalKesalahan = hasil.reduce((a, h) => a + h.jumlahKesalahan, 0);
  const totalPeringatan = hasil.reduce((a, h) => a + h.jumlahPeringatan, 0);

  return {
    // 3 kartu sesuai wireframe dokumen: Valid (lolos tanpa temuan sama
    // sekali) / Peringatan / Kesalahan -- BEDA dari "Divisi Siap" (itu
    // hitungan divisi, ini hitungan PEMERIKSAAN/temuan).
    valid: hasil.filter(h => h.jumlahKesalahan === 0 && h.jumlahPeringatan === 0).length,
    peringatan: totalPeringatan,
    kesalahan: totalKesalahan,
    totalDivisi: hasil.length,
    divisiSiap: hasil.filter(h => h.valid).length,
    divisiBermasalah: hasil.filter(h => !h.valid).length,
    perDivisi: hasil,
    daftarTemuan: semuaTemuan
  };
}

/**
 * Daftar status penetapan SEMUA divisi dalam 1 periode -- utk tabel
 * sesuai wireframe dokumen "[ Divisi | Status | Versi | Sinkronisasi ]"
 * (sebelumnya UI mengharuskan pilih 1 divisi dulu, tidak sesuai).
 */
function getDaftarPenetapanPeriode(body) {
  requireAuth(body.token, true);
  const idPeriode = sanitize(body.idPeriode);
  if (!idPeriode) throw new Error('Periode wajib dipilih.');

  const daftarDivisi = getDivisiList();
  const statusRows = sheetToObjects(getStatusPenetapanSheet_()).filter(s => s.ID_PERIODE === idPeriode);
  const statusByDivisi = {};
  statusRows.forEach(s => { statusByDivisi[s.NAMA_DIVISI] = s; });

  return daftarDivisi.map(d => {
    const tersimpan = statusByDivisi[d];
    let statusTampil = 'DRAFT';
    if (tersimpan && tersimpan.STATUS === 'DITETAPKAN') {
      statusTampil = 'DITETAPKAN';
    } else {
      const v = validasiJadwalDivisi({ token: body.token, idPeriode: idPeriode, namaDivisi: d });
      statusTampil = v.valid ? 'SIAP_DITETAPKAN' : (v.jumlahKesalahan > 0 ? 'PERLU_PERBAIKAN' : 'DRAFT');
    }
    return {
      divisi: d, status: statusTampil,
      versi: tersimpan ? Number(tersimpan.VERSI_AKTIF) || 0 : 0,
      statusSinkronisasi: tersimpan ? (tersimpan.STATUS_SINKRONISASI || '') : ''
    };
  });
}

/** Baca status penetapan 1 (periode, divisi) -- dibuat DRAFT otomatis kalau belum ada baris. */
function getStatusPenetapanDivisi_(idPeriode, namaDivisi) {
  const sheet = getStatusPenetapanSheet_();
  const rows = sheetToObjects(sheet);
  const existing = rows.find(r => r.ID_PERIODE === idPeriode && r.NAMA_DIVISI === namaDivisi);
  if (existing) return existing;
  return { ID_STATUS: '', ID_PERIODE: idPeriode, NAMA_DIVISI: namaDivisi, STATUS: 'DRAFT', VERSI_AKTIF: 0, STATUS_SINKRONISASI: '' };
}

function getStatusPenetapanAdmin(body) {
  requireAuth(body.token, true);
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);
  const status = getStatusPenetapanDivisi_(idPeriode, namaDivisi);
  const validasi = validasiJadwalDivisi(body);
  // Status Draft/Perlu Perbaikan/Siap Ditetapkan DIHITUNG LIVE dari
  // hasil validasi (bukan field statis) -- cuma "DITETAPKAN" yg
  // tersimpan permanen (perubahan jadwal SETELAH ditetapkan tidak
  // otomatis menurunkan status, perlu alur revisi eksplisit, §13/§14).
  let statusTampil = status.STATUS;
  if (statusTampil !== 'DITETAPKAN') {
    statusTampil = validasi.valid ? 'SIAP_DITETAPKAN' : (validasi.jumlahKesalahan > 0 ? 'PERLU_PERBAIKAN' : 'DRAFT');
  }
  return { status: statusTampil, versiAktif: Number(status.VERSI_AKTIF) || 0, statusSinkronisasi: status.STATUS_SINKRONISASI || '', validasi: validasi };
}

/**
 * TETAPKAN JADWAL DIVISI -- tombol utama (§13). Alur: validasi final
 * server (TOLAK kalau masih ada kesalahan) -> snapshot SUNGGUHAN ke
 * 39_VERSI_RESMI_JADWAL -> tandai ID_VERSI_RESMI di tiap baris roster
 * terkait (INI yg berperan sbg "sinkronisasi", krn roster MEMANG
 * sumber yg sama dipakai SIPRES -- lihat audit arsitektur sebelumnya)
 * -> update status jadi DITETAPKAN -> catat riwayat (log audit yg
 * sudah ada).
 *
 * Kegagalan penyimpanan snapshot: status TIDAK berubah, error jelas
 * dilempar, jadwal (roster) tetap utuh tidak tersentuh (§13 "pertahankan
 * rancangan jadwal").
 */
function tetapkanJadwalDivisi(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'APPROVE'); // Tetapkan = tindakan APPROVE, beda dari sekadar EDIT
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);
  const alasanRevisi = sanitize(body.alasanRevisi);
  if (!idPeriode || !namaDivisi) throw new Error('Periode dan divisi wajib diisi.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    // 1) Validasi final SERVER (bukan percaya validasi frontend) --
    // TOLAK kalau masih ada kesalahan.
    const validasi = validasiJadwalDivisi({ token: body.token, idPeriode, namaDivisi });
    if (!validasi.valid) {
      throw new Error('Penetapan ditolak: masih ada ' + validasi.jumlahKesalahan + ' kesalahan yang menghambat. Perbaiki dulu lewat Pemeriksaan Jadwal.');
    }

    // 2) Kumpulkan SELURUH baris roster (periode, divisi) utk snapshot.
    const kalenderPeriode = getKalenderRows_().filter(k => k.ID_PERIODE === idPeriode);
    const idOperasionalSet = new Set(kalenderPeriode.map(k => k.ID_OPERASIONAL));
    const rosterTerkait = getRosterV2Rows_().filter(r => idOperasionalSet.has(r.ID_OPERASIONAL) && r.DIVISI === namaDivisi);
    if (!rosterTerkait.length) throw new Error('Tidak ada jadwal untuk divisi ini pada periode tersebut -- tidak ada yang bisa ditetapkan.');

    const snapshotData = rosterTerkait.map(r => ({
      idAbsensi: r.ID_ABSENSI, tanggal: r.TANGGAL_OPERASIONAL, hari: r.HARI_OPERASIONAL,
      idRelawan: r.ID_RELAWAN, namaRelawan: r.NAMA_RELAWAN, namaShift: r.NAMA_SHIFT,
      jamMasuk: r.JAM_JADWAL_MASUK, jamPulang: r.JAM_JADWAL_PULANG
    }));

    // 3) Simpan snapshot SUNGGUHAN (sesuai keputusan Admin -- bukan penanda).
    const statusSekarang = getStatusPenetapanDivisi_(idPeriode, namaDivisi);
    const nomorVersiBaru = (Number(statusSekarang.VERSI_AKTIF) || 0) + 1;
    const sheetVersi = getVersiResmiSheet_();
    const idVersi = 'VR' + String(sheetVersi.getLastRow()).padStart(5, '0');
    sheetVersi.appendRow([idVersi, idPeriode, namaDivisi, nomorVersiBaru, JSON.stringify(snapshotData), snapshotData.length, aktor, new Date(), alasanRevisi || '']);

    // 4) "Sinkronisasi" -- tandai ID_VERSI_RESMI di tiap baris roster
    // terkait (kolom BARU, additif -- sheet roster lama TIDAK diubah
    // strukturnya selain menambah 1 kolom). Ini LANGKAH YANG BISA
    // GAGAL SEBAGIAN (mis. timeout di tengah loop utk periode besar) --
    // makanya statusnya dipisah dari status DITETAPKAN (§13).
    let statusSinkron = 'TERSINKRON';
    try {
      tambahKolomJikaBelumAda_(NAMA_SHEET.ABSENSI, ['ID_VERSI_RESMI']);
      const sheetRoster = getRosterSheetV2_();
      const dataRoster = sheetRoster.getDataRange().getValues();
      const headerRoster = dataRoster[0].map(h => String(h).trim());
      const idxIdAbsensi = headerRoster.indexOf('ID_ABSENSI');
      const idxVersiResmi = headerRoster.indexOf('ID_VERSI_RESMI');
      const idAbsensiSet = new Set(snapshotData.map(s => s.idAbsensi));
      for (let i = 1; i < dataRoster.length; i++) {
        if (idAbsensiSet.has(dataRoster[i][idxIdAbsensi])) {
          sheetRoster.getRange(i + 1, idxVersiResmi + 1).setValue(idVersi);
        }
      }
      _invalidasiCacheRosterV2_();
    } catch (eSync) {
      statusSinkron = 'GAGAL'; // snapshot & status DITETAPKAN tetap sah -- cuma penanda sinkronisasi yg gagal, bisa dicoba ulang
    }

    // 5) Update status jadi DITETAPKAN (HANYA setelah snapshot berhasil tersimpan).
    const sheetStatus = getStatusPenetapanSheet_();
    const dataStatus = sheetStatus.getDataRange().getValues();
    const headerStatus = dataStatus[0].map(h => String(h).trim());
    const idxS = {}; headerStatus.forEach((h, i) => { idxS[h] = i; });
    let barisDitemukan = -1;
    for (let i = 1; i < dataStatus.length; i++) {
      if (dataStatus[i][idxS.ID_PERIODE] === idPeriode && dataStatus[i][idxS.NAMA_DIVISI] === namaDivisi) { barisDitemukan = i; break; }
    }
    if (barisDitemukan === -1) {
      sheetStatus.appendRow(['ST' + String(dataStatus.length).padStart(4, '0'), idPeriode, namaDivisi, 'DITETAPKAN', nomorVersiBaru, statusSinkron, new Date()]);
    } else {
      sheetStatus.getRange(barisDitemukan + 1, idxS.STATUS + 1, 1, 4).setValues([['DITETAPKAN', nomorVersiBaru, statusSinkron, new Date()]]);
    }

    // 6) Riwayat -- log audit yg SUDAH ADA (tidak bikin sheet riwayat baru lagi).
    logAudit_('TETAPKAN_JADWAL_DIVISI', 'JADWAL_PENUGASAN', idPeriode + '/' + namaDivisi, aktor, {
      versi: nomorVersiBaru, jumlahBaris: snapshotData.length, statusSinkronisasi: statusSinkron, alasanRevisi: alasanRevisi || '(tidak ada, penetapan pertama)'
    });

    return { success: true, versi: nomorVersiBaru, statusSinkronisasi: statusSinkron, jumlahBaris: snapshotData.length };
  } finally {
    lock.releaseLock();
  }
}

/** Coba sinkronisasi ulang kalau statusnya GAGAL -- tidak membuat snapshot baru, cuma menandai ulang baris roster yg sama. */
function cobaSinkronisasiUlang(body) {
  const aktor = requireAuth(body.token);
  requireIzinModulBaru_(aktor, 'JADWAL_PENUGASAN', 'APPROVE');
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);

  const status = getStatusPenetapanDivisi_(idPeriode, namaDivisi);
  if (status.STATUS !== 'DITETAPKAN') throw new Error('Divisi ini belum ditetapkan -- tidak ada yang perlu disinkronkan.');

  const versiRows = sheetToObjects(getVersiResmiSheet_()).filter(v => v.ID_PERIODE === idPeriode && v.NAMA_DIVISI === namaDivisi && Number(v.NOMOR_VERSI) === Number(status.VERSI_AKTIF));
  if (!versiRows.length) throw new Error('Versi resmi tidak ditemukan.');
  const snapshotData = JSON.parse(versiRows[0].DATA_JADWAL_JSON);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Sistem sedang sibuk. Coba lagi beberapa detik.');
  try {
    let statusSinkron = 'TERSINKRON';
    try {
      tambahKolomJikaBelumAda_(NAMA_SHEET.ABSENSI, ['ID_VERSI_RESMI']);
      const sheetRoster = getRosterSheetV2_();
      const dataRoster = sheetRoster.getDataRange().getValues();
      const headerRoster = dataRoster[0].map(h => String(h).trim());
      const idxIdAbsensi = headerRoster.indexOf('ID_ABSENSI');
      const idxVersiResmi = headerRoster.indexOf('ID_VERSI_RESMI');
      const idVersi = versiRows[0].ID_VERSI;
      const idAbsensiSet = new Set(snapshotData.map(s => s.idAbsensi));
      let ditemukan = 0;
      for (let i = 1; i < dataRoster.length; i++) {
        if (idAbsensiSet.has(dataRoster[i][idxIdAbsensi])) {
          sheetRoster.getRange(i + 1, idxVersiResmi + 1).setValue(idVersi);
          ditemukan++;
        }
      }
      _invalidasiCacheRosterV2_();
      // Percobaan ulang TIDAK membuat duplikat -- ini SETVALUE (menimpa
      // di tempat), bukan appendRow, jadi aman dijalankan berkali-kali.
      if (ditemukan < snapshotData.length) statusSinkron = 'GAGAL'; // sebagian baris roster aslinya sudah tidak ada (dihapus/diubah) -- perlu ditinjau manual, bukan dipaksa
    } catch (e) {
      statusSinkron = 'GAGAL';
    }

    const sheetStatus = getStatusPenetapanSheet_();
    const dataStatus = sheetStatus.getDataRange().getValues();
    const headerStatus = dataStatus[0].map(h => String(h).trim());
    const idxS = {}; headerStatus.forEach((h, i) => { idxS[h] = i; });
    for (let i = 1; i < dataStatus.length; i++) {
      if (dataStatus[i][idxS.ID_PERIODE] === idPeriode && dataStatus[i][idxS.NAMA_DIVISI] === namaDivisi) {
        sheetStatus.getRange(i + 1, idxS.STATUS_SINKRONISASI + 1).setValue(statusSinkron);
        sheetStatus.getRange(i + 1, idxS.DIUBAH_PADA + 1).setValue(new Date());
        break;
      }
    }
    logAudit_('SINKRONISASI_ULANG_JADWAL', 'JADWAL_PENUGASAN', idPeriode + '/' + namaDivisi, aktor, { statusSinkronisasi: statusSinkron });
    return { success: true, statusSinkronisasi: statusSinkron };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// JADWAL ANGGOTA UNTUK KOORDINATOR (18 Okt 2026, diminta Admin) --
// relawan dengan ROLE_BARU='KOORDINATOR_OPERASIONAL' bisa lihat jadwal
// HARIAN anggota divisinya sendiri (bukan semua divisi). Portal
// Relawan, BUKAN Portal Pengelola -- requireAuthRelawan, bukan
// requireAuth.
// ============================================================

/**
 * Cek role_baru seorang relawan (BEDA dari requireRole_ di Role.gs --
 * itu cek field ROLE lama, cuma kenal ASN/KEPALA_SPPG. Role baru
 * (7 role SIKOP/Manajemen Hak Akses) tersimpan di kolom ROLE_BARU
 * terpisah, lihat Relawan.gs: roleBaru: relawan.ROLE_BARU || ''.
 */
function requireRoleBaru_(token, allowedRoles) {
  const idRelawan = requireAuthRelawan(token);
  const relawan = getRelawanById(idRelawan);
  const roleBaru = relawan ? (relawan.roleBaru || 'RELAWAN') : 'RELAWAN';
  if (allowedRoles.indexOf(roleBaru) === -1) {
    throw new Error('Anda tidak memiliki izin untuk mengakses halaman ini.');
  }
  return { idRelawan: idRelawan, roleBaru: roleBaru, divisi: relawan ? relawan.divisi : '' };
}

/**
 * Jadwal anggota divisi Koordinator, utk 1 tanggal (default hari ini).
 * HANYA anggota divisi yg SAMA dgn divisi Koordinator sendiri -- bukan
 * lintas divisi (sesuai permintaan "anggota masing-masing").
 */
function getJadwalAnggotaKoordinator(body) {
  const akses = requireRoleBaru_(body.token, ['KOORDINATOR_OPERASIONAL']);
  if (!akses.divisi) throw new Error('Divisi Anda belum diatur -- hubungi Admin.');

  const tanggalDMY = sanitize(body.tanggal) || formatTanggal(new Date());
  const rosterHariIni = getRosterV2Rows_().filter(r =>
    r.ID_ABSENSI && r.TANGGAL_OPERASIONAL === tanggalDMY && r.DIVISI === akses.divisi
  );

  // Diperluas 21 Okt 2026 (diminta Admin, dokumen Fitur Koordinator) --
  // ID + info keterlambatan ditambahkan, dipakai BERSAMA oleh 2 halaman
  // (Jadwal Relawan & Monitoring Kehadiran) -- sumber data SAMA (roster
  // resmi + absensi aktual SIPRES), BUKAN sistem absensi baru.
  const hasil = rosterHariIni.map(r => {
    let menitTerlambat = null;
    if (r.JAM_MASUK && r.JAM_JADWAL_MASUK) {
      const [jA, mA] = String(r.JAM_MASUK).split(':').map(Number);
      const [jJ, mJ] = String(r.JAM_JADWAL_MASUK).split(':').map(Number);
      if (!isNaN(jA) && !isNaN(jJ)) {
        const selisih = (jA * 60 + mA) - (jJ * 60 + mJ);
        if (selisih > 0) menitTerlambat = selisih;
      }
    }
    return {
      idRelawan: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, namaShift: r.NAMA_SHIFT || '',
      jamMasukJadwal: r.JAM_JADWAL_MASUK || '', jamPulangJadwal: r.JAM_JADWAL_PULANG || '',
      status: r.STATUS_KEHADIRAN || 'BELUM ABSEN',
      jamMasukAktual: r.JAM_MASUK || '', jamPulangAktual: r.JAM_PULANG || '',
      menitTerlambat: menitTerlambat
    };
  }).sort((a, b) => a.nama.localeCompare(b.nama));

  return { divisi: akses.divisi, tanggal: tanggalDMY, jumlahAnggota: hasil.length, data: hasil, waktuDimuat: new Date().toISOString() };
}

/** Riwayat penetapan & revisi 1 divisi -- pakai log audit yg sudah ada, disaring. */
function getRiwayatPenetapanDivisi(body) {
  requireAuth(body.token, true);
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);
  const target = idPeriode + '/' + namaDivisi;
  const semua = getAuditLogListAdmin(body.token);
  return semua
    .filter(r => r.modul === 'JADWAL_PENUGASAN' && r.idTerkait === target && (r.aksi === 'TETAPKAN_JADWAL_DIVISI' || r.aksi === 'SINKRONISASI_ULANG_JADWAL'))
    .map(r => {
      let detail = {};
      try { detail = typeof r.detail === 'string' ? JSON.parse(r.detail) : (r.detail || {}); } catch (e) {}
      return { waktu: r.waktu, aksi: r.aksi, pelaku: r.aktor, detail: detail };
    });
}


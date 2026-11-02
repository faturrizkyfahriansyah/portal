/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * Role.gs — Fondasi Role ASN & Kepala SPPG (Fase 1, BARU)
 *
 * TIDAK mengubah Akun.gs / Admin.gs sama sekali. Relawan, ASN, dan Kepala
 * SPPG semua tetap login lewat jalur RELAWAN yang sama (loginRelawan,
 * requireAuthRelawan) — yang membedakan cuma kolom BARU "ROLE" di sheet
 * 07_AKUN_RELAWAN. Ini konsisten dengan pola ROLE_STOK yang sudah ada
 * (izin tambahan lewat kolom, bukan sistem login terpisah).
 *
 * ==================================================================
 * WAJIB DISIAPKAN MANUAL:
 * ==================================================================
 * Tambah kolom baru "ROLE" di 07_AKUN_RELAWAN (kolom baru di kanan,
 * boleh setelah ROLE_STOK kalau sudah ada). Nilai yang dikenali:
 *   - (kosong)      -> RELAWAN biasa (default, TIDAK PERLU diisi manual
 *                       untuk relawan yang sudah ada -- kosong = aman)
 *   - "ASN"         -> akses baca lebih luas (§7 dokumen: kehadiran,
 *                       operasional, persediaan, laporan, dokumen -- SEMUA
 *                       read-only, tidak bisa tambah/ubah/hapus apa pun)
 *   - "KEPALA_SPPG" -> akses baca + laporan + monitoring
 *
 * ==================================================================
 * PENTING soal cakupan pekerjaan ini (baca supaya ekspektasi jelas):
 * ==================================================================
 * Ini FONDASI role — validasi role di backend (requireRole_) sudah bisa
 * dipakai kapan saja untuk endpoint baru mana pun. Yang SUDAH dibuat
 * konkret di file ini cuma SATU endpoint contoh (getRingkasanMonitoring)
 * + 1 halaman frontend (monitoring.html) sebagai bukti kerja end-to-end.
 *
 * BELUM dikerjakan (ini scope Fase 5/6/8, menunggu source code halaman
 * lama yang terkini -- Informasi.gs, Jadwal.gs, Dokumen.gs, Admin.gs,
 * dst -- supaya tidak menebak-nebak dari salinan yang mungkin basi):
 *   - Membuat SEMUA endpoint admin lama bisa diakses read-only oleh
 *     ASN/Kepala SPPG (Rekap Harian/Bulanan, Informasi, Jadwal, Dokumen)
 *   - Dashboard berbeda tampilan penuh per role sesuai §8
 *   - Halaman login/redirect otomatis berdasar role setelah login
 */

// ------------------------------------------------------------
// PENGECEKAN ROLE
// ------------------------------------------------------------

/** Ambil role relawan dari 01_DATA_RELAWAN (dipindah dari 07_AKUN_RELAWAN -- lihat catatan pembagian kolom). Return 'RELAWAN' kalau kosong/kolom belum ada/tidak dikenali. */
function getRoleRelawan_(idRelawan) {
  const relawan = getRelawanById(idRelawan); // dari Relawan.gs
  if (!relawan) return 'RELAWAN';
  const nilai = String(relawan.role || '').toUpperCase().trim();
  return (nilai === 'ASN' || nilai === 'KEPALA_SPPG') ? nilai : 'RELAWAN';
}

/**
 * Validasi sesi relawan DAN pastikan role-nya termasuk salah satu yang
 * diizinkan. Pakai ini di setiap endpoint baru yang perlu dibatasi role.
 * Return { idRelawan, role }. Throw kalau sesi tidak valid ATAU role
 * tidak termasuk allowedRoles.
 */
function requireRole_(token, allowedRoles) {
  const idRelawan = requireAuthRelawan(token); // dari Akun.gs, tidak diubah
  const role = getRoleRelawan_(idRelawan);
  if (allowedRoles.indexOf(role) === -1) {
    throw new Error('Akun Anda tidak memiliki akses ke fitur ini.');
  }
  return { idRelawan: idRelawan, role: role };
}

/**
 * Dipakai FRONTEND supaya tahu role sendiri (buat atur menu/redirect
 * setelah login). BUKAN satu-satunya lapisan keamanan -- tiap endpoint
 * baru tetap WAJIB validasi ulang lewat requireRole_ di backend, jangan
 * cuma percaya role yang "diingat" di frontend.
 */
function getProfilRoleSaya(token) {
  const idRelawan = requireAuthRelawan(token);
  return { idRelawan: idRelawan, role: getRoleRelawan_(idRelawan) };
}

// ------------------------------------------------------------
// CONTOH ENDPOINT READ-ONLY UNTUK ASN & KEPALA SPPG
// Ringkasan lintas-modul, murni BACA, tidak ada create/update/delete di
// sini sama sekali. Sengaja SATU endpoint gabungan dulu (bukan bongkar
// tiap endpoint admin lama satu-satu) supaya resikonya kecil & jelas.
// ------------------------------------------------------------

function getRingkasanMonitoring(token) {
  requireRole_(token, ['ASN', 'KEPALA_SPPG']);

  const relawanAktif = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN))
    .filter(r => String(r.STATUS).toUpperCase() === 'AKTIF');
  const hariIni = formatTanggal(new Date());
  const sudahAbsenHariIni = getRosterV2Rows_()
    .filter(a => a.ID_ABSENSI && a.TANGGAL_OPERASIONAL === hariIni && a.STATUS_MASUK && a.STATUS_MASUK !== 'BELUM').length;

  let stok = null;
  try {
    const barang = sheetToObjects(getStokBarangSheet()).filter(b => String(b.AKTIF).toUpperCase() !== 'NONAKTIF');
    let aman = 0, menipis = 0, habis = 0;
    barang.forEach(b => {
      const s = statusStokBarang_(Number(b.STOK_SAAT_INI) || 0, Number(b.STOK_MINIMUM) || 0);
      if (s === 'AMAN') aman++; else if (s === 'MENIPIS') menipis++; else habis++;
    });
    stok = { totalJenisBarang: barang.length, aman: aman, menipis: menipis, habis: habis };
  } catch (e) {
    // Modul Stok belum disiapkan di proyek ini -- tampilkan kosong, jangan gagalkan seluruh ringkasan.
  }

  // SIPANDU -- database TERPISAH, tapi sejak digabung 1 proyek, tinggal
  // baca langsung lewat getSipanduSheet() (tidak perlu bridge lagi).
  let sipandu = null;
  try {
    const semuaWo = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS));
    const perStatus = { DRAFT: 0, DATA_LENGKAP: 0, READY: 0, POP_FILLED: 0, COMPLETED: 0 };
    semuaWo.forEach(wo => {
      const s = String(wo.STATUS || '').toUpperCase();
      if (perStatus[s] !== undefined) perStatus[s]++;
    });
    sipandu = { totalWo: semuaWo.length, perStatus: perStatus };
  } catch (e) {
    // Script Property SIPANDU_SPREADSHEET_ID belum diisi, atau sheet belum siap -- diamkan.
  }

  // Penerima Manfaat hari ini -- SIPENDOK, proyek TERPISAH, dipanggil lewat
  // panggilSipendok_ yg SUDAH ADA (PenerimaManfaat.gs). Dibungkus try/catch
  // sendiri spt stok & SIPANDU di atas -- kalau SIPENDOK sedang tidak bisa
  // dihubungi (jaringan/URL berubah/dll), ringkasan lain TETAP tampil.
  let penerimaManfaat = null;
  try {
    penerimaManfaat = ringkasPenerimaManfaatHariIni_();
  } catch (e) {
    // SIPENDOK tidak dapat dihubungi -- diamkan, jangan gagalkan seluruh ringkasan.
  }

  // Menu Hari Ini -- dibaca langsung dari spreadsheet siklus menu
  // eksternal (SiklusMenu.gs). Try/catch sendiri spt sumber lain --
  // paling mungkin gagal krn izin akses sheet belum diatur (lihat
  // komentar prasyarat di SiklusMenu.gs), bukan alasan menjatuhkan
  // seluruh ringkasan.
  let menuHariIni = null;
  try {
    menuHariIni = getMenuHariIniSiklus_();
  } catch (e) {
    // Sheet siklus menu belum bisa diakses (izin/ID berubah) -- diamkan.
  }

  return {
    totalRelawanAktif: relawanAktif.length,
    sudahAbsenHariIni: sudahAbsenHariIni,
    belumAbsenHariIni: Math.max(0, relawanAktif.length - sudahAbsenHariIni),
    stok: stok,
    sipandu: sipandu,
    penerimaManfaat: penerimaManfaat,
    menuHariIni: menuHariIni
  };
}

// ------------------------------------------------------------
// KELOLA ROLE (Hak Akses) -- dipulihkan, sempat hilang saat rilis
// sebelumnya tidak lengkap terpasang (dipanggil dari Code.gs tapi
// fungsinya belum ada).
// ------------------------------------------------------------

function getDaftarRelawanUntukRoleAdmin(token) {
  requireAuth(token);
  const namaMap = {};
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN))
    .filter(r => String(r.STATUS).toUpperCase() === 'AKTIF')
    .forEach(r => { namaMap[r.ID_RELAWAN] = r.NAMA_RELAWAN; });

  return sheetToObjects(getAkunSheet())
    .filter(a => namaMap[a.ID_RELAWAN])
    .map(a => ({ idRelawan: a.ID_RELAWAN, nama: namaMap[a.ID_RELAWAN], role: getRoleRelawan_(a.ID_RELAWAN) }));
}

/**
 * Manajemen Hak Akses Terpadu (16 Okt 2026, diminta Admin) -- SATU
 * tabel berisi SEMUA relawan dgn Role (ASN/Kepala SPPG) & Petugas Stok
 * (SIRAGA) sekaligus, drpd getDaftarRelawanUntukRoleAdmin (cuma Role)
 * yg dipanggil N kali getRoleRelawan_ (N pembacaan sheet Relawan
 * terpisah -- lambat utk daftar panjang). Di sini sheet Relawan &
 * Akun masing2 DIBACA SEKALI, digabung di memori -- jauh lebih efisien
 * utk daftar SEMUA relawan drpd 1 orang.
 */
function getDaftarHakAksesAdmin(token) {
  requireAuth(token);
  const akunMap = {};
  sheetToObjects(getAkunSheet()).forEach(a => { akunMap[a.ID_RELAWAN] = true; });

  return sheetToObjects(getSheet(NAMA_SHEET.RELAWAN))
    .filter(r => String(r.STATUS).toUpperCase() === 'AKTIF' && akunMap[r.ID_RELAWAN])
    .map(r => {
      const roleNilai = String(r.ROLE || '').toUpperCase().trim();
      return {
        idRelawan: r.ID_RELAWAN,
        nama: r.NAMA_RELAWAN,
        divisi: r.DIVISI || '',
        role: (roleNilai === 'ASN' || roleNilai === 'KEPALA_SPPG') ? roleNilai : 'RELAWAN',
        petugasStok: String(r.ROLE_STOK || '').toUpperCase() === 'PETUGAS'
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

function setRoleRelawan(body) {
  const usernameAdmin = requireAuth(body.token);
  const idRelawan = sanitize(body.idRelawan);
  const role = sanitize(body.role);
  if (!idRelawan) throw new Error('Relawan wajib dipilih.');
  if (role && role !== 'ASN' && role !== 'KEPALA_SPPG') throw new Error('Role tidak dikenali.');

  const lock = LockService.getScriptLock(); // P2 -- cegah 2 perubahan role bersamaan saling menimpa
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi dalam beberapa detik.');
  try {
    const sheet = getAkunSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idxId = headers.indexOf('ID_RELAWAN');
    const idxRole = headers.indexOf('ROLE');
    if (idxRole === -1) {
      throw new Error('Kolom ROLE belum ditambahkan di sheet 07_AKUN_RELAWAN. Tambahkan dulu kolom ini secara manual sebelum mengatur Hak Akses.');
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxId]) === idRelawan) {
        sheet.getRange(i + 1, idxRole + 1).setValue(role);
        logAudit_('SET_ROLE_RELAWAN', 'ROLE', idRelawan, usernameAdmin, { role: role || 'RELAWAN' });
        return { success: true };
      }
    }
    throw new Error('Akun relawan tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}


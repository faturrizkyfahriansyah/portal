/**
 * SIPANDU — SipanduAuth.gs
 * Otorisasi role/permission SIPANDU.
 *
 * ==================================================================
 * DISEDERHANAKAN setelah SIPANDU digabung ke proyek Apps Script Portal:
 * validasi SESI sekarang cukup pakai requireAuthRelawan (Akun.gs Portal)
 * -- PERSIS mekanisme yang sama dipakai SIRAGA/SIPRES/Monitoring. Tidak
 * ada lagi validasi token manual lewat sheet lintas-proyek, karena
 * proyeknya sudah 1, CacheService-nya sudah otomatis sama.
 *
 * Yang TETAP jadi tanggung jawab file ini: OTORISASI (role & permission)
 * SIPANDU, yang datanya (sheet USERS/ROLE_PERMISSIONS) tetap di database
 * SIPANDU terpisah -- diakses lewat getSipanduSheet() yang sudah
 * disesuaikan di SipanduUtils.gs.
 * ==================================================================
 */

/**
 * Ambil profil SIPANDU (role) untuk seorang relawan. Return null kalau
 * relawan itu belum terdaftar di sheet USERS SIPANDU sama sekali.
 */
function getSipanduUserProfile_(idRelawan) {
  const users = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.USERS));
  const row = users.find(u => String(u.ID_USER) === idRelawan);
  if (!row || String(row.AKTIF).toUpperCase() === 'NONAKTIF') return null;
  return { idUser: row.ID_USER, nama: row.NAMA, role: row.ROLE_SIPANDU };
}

/**
 * Validasi token DAN permission tertentu sekaligus. Dipakai di HAMPIR
 * SEMUA endpoint SIPANDU yang menyentuh data (permission diperiksa di
 * backend, bukan cuma tampilan frontend).
 *
 * ==================================================================
 * BYPASS UNTUK ADMIN: token Admin Portal dan token Relawan itu 2 sistem
 * sesi yang SEPENUHNYA BERBEDA (requireAuth vs requireAuthRelawan) --
 * jadi Admin TIDAK BISA otomatis lolos requireAuthRelawan di bawah.
 * Di sini, token DICEK DULU apakah itu token Admin yang valid -- kalau
 * ya, LANGSUNG lolos penuh tanpa perlu profil/role SIPANDU sama sekali
 * (Admin sudah otoritas tertinggi di seluruh Portal, tidak ada risiko
 * keamanan tambahan). Kalau bukan token Admin, jalur RELAWAN biasa
 * (role & permission SIPANDU) tetap berlaku seperti sebelumnya.
 * ==================================================================
 */
function requireSipanduPermission_(token, permCode) {
  try {
    const usernameAdmin = requireAuth(token); // Admin PENUH -- selalu lolos, akses apa pun
    return { idUser: 'ADMIN:' + usernameAdmin, nama: usernameAdmin, role: 'ADMIN', viaAdmin: true };
  } catch (eAdmin) {
    // Bukan token Admin -- cek dulu apakah ini sesi Staff yang valid
    // SEBELUM lanjut ke jalur relawan, supaya Staff yang mencoba aksi
    // tulis dapat pesan yang jelas, bukan pesan membingungkan seolah
    // sesinya tidak valid. Staff HANYA lolos untuk kode izin yang
    // berakhiran ".view" (lihat-lihat saja) -- kode SIPANDU sudah
    // konsisten membedakan .view (baca) dari .edit/.create/.fill/
    // .validate dst (tulis), jadi dipakai langsung tanpa daftar terpisah.
    let usernameStaff = null;
    try { usernameStaff = requireAuth(token, true); } catch (eStaff) { /* bukan sesi Admin Portal sama sekali -- lanjut jalur relawan di bawah */ }
    if (usernameStaff) {
      if (!/\.view$/.test(permCode)) {
        throw new Error('Akun Staff hanya bisa melihat data SIPANDU, tidak bisa mengubah -- khusus Admin.');
      }
      return { idUser: 'STAFF:' + usernameStaff, nama: usernameStaff, role: 'STAFF', viaAdmin: true };
    }
  }

  const idRelawan = requireAuthRelawan(token); // dari Akun.gs Portal -- sesi SAMA seperti modul lain
  const profil = getSipanduUserProfile_(idRelawan);

  if (!profil) {
    throw new Error('Akun Anda belum terdaftar di SIPANDU. Hubungi Admin SIPANDU untuk didaftarkan.');
  }

  const rolePerms = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.ROLE_PERMISSIONS));
  const punyaAkses = rolePerms.some(rp => rp.KODE_ROLE === profil.role && rp.KODE_PERMISSION === permCode);

  if (!punyaAkses) {
    throw new Error('Anda tidak memiliki izin (' + permCode + ') untuk melakukan aksi ini.');
  }

  return { idUser: idRelawan, nama: profil.nama, role: profil.role };
}

/** Dipakai FRONTEND setelah login supaya tahu role & bisa atur menu. */
function getSipanduProfilSaya(token) {
  const idRelawan = requireAuthRelawan(token);
  const profil = getSipanduUserProfile_(idRelawan);
  if (!profil) {
    throw new Error('Akun Anda belum terdaftar di SIPANDU. Hubungi Admin SIPANDU untuk didaftarkan.');
  }
  return profil;
}


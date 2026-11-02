/**
 * SPPG JEUNGJING — SetupKolomProfil.gs
 *
 * Fungsi SEKALI-JALAN untuk menambahkan kolom-kolom baru yang dibutuhkan
 * Modul Profil & Pengaturan Akun -- supaya tidak perlu ketik manual satu-
 * satu di Spreadsheet.
 *
 * AMAN dijalankan berkali-kali (idempotent): fungsi ini CUMA MENAMBAH
 * kolom yang BELUM ADA di ujung kanan header masing-masing sheet. Kolom
 * yang sudah ada TIDAK disentuh sama sekali, dan TIDAK ADA data existing
 * yang dihapus/diubah.
 *
 * CARA PAKAI:
 * 1. Buka Apps Script Portal (script.google.com project PORTAL RELAWAN)
 * 2. Pastikan file ini sudah ditambahkan (SetupKolomProfil.gs)
 * 3. Di dropdown pilihan fungsi (atas, sebelah tombol Run/Debug),
 *    pilih "setupSemuaKolomProfil"
 * 4. Klik Run (▶)
 * 5. Kalau diminta izin akses, klik Allow/Izinkan
 * 6. Buka tab "Execution log" (Ctrl+Enter atau View > Logs) untuk lihat
 *    ringkasan kolom apa saja yang ditambahkan
 * 7. Selesai -- fungsi ini boleh dihapus setelah dijalankan, atau
 *    dibiarkan saja (tidak mengganggu apa pun kalau tidak dipanggil lagi)
 */
function setupSemuaKolomProfil() {
  const hasilRelawan = tambahKolomJikaBelumAda_(NAMA_SHEET.RELAWAN, [
    'NO_HP', 'EMAIL', 'TANGGAL_LAHIR', 'JENIS_KELAMIN', 'ALAMAT', 'FOTO_PROFIL',
    'ROLE', 'ROLE_STOK', 'NIK', 'KONTAK_DARURAT_NAMA', 'KONTAK_DARURAT_HUBUNGAN',
    'KONTAK_DARURAT_NO_HP', 'LAST_EMERGENCY_CONTACT_CHANGE', 'TANGGAL_BERGABUNG',
    'NOMOR_REKENING' // Rekap Per Periode -- utk kolom Nomor Rekening di tabel insentif
  ]);

  const hasilAkun = tambahKolomJikaBelumAda_(NAMA_SHEET.AKUN_RELAWAN, [
    'LAST_PHONE_CHANGE', 'LAST_EMAIL_CHANGE', 'LAST_BIRTH_DATE_CHANGE',
    'LAST_GENDER_CHANGE', 'LAST_ADDRESS_CHANGE', 'LAST_PROFILE_PHOTO_CHANGE',
    // Pengingat Jadwal Harian otomatis -- kolom pelacak TERPISAH dari
    // TERAKHIR_DIINGATKAN (itu dipakai pengingat "belum absen", BEDA
    // keperluan -- kalau dipakai bareng, keduanya saling menimpa status
    // "sudah dikirim hari ini").
    'TERAKHIR_DIINGATKAN_JADWAL'
  ]);

  Logger.log('=== SETUP KOLOM PROFIL SELESAI ===');
  Logger.log('01_DATA_RELAWAN -- ditambahkan: ' + (hasilRelawan.ditambahkan.join(', ') || '(tidak ada, semua sudah ada)'));
  Logger.log('01_DATA_RELAWAN -- sudah ada sebelumnya: ' + (hasilRelawan.sudahAda.join(', ') || '(tidak ada)'));
  Logger.log('07_AKUN_RELAWAN -- ditambahkan: ' + (hasilAkun.ditambahkan.join(', ') || '(tidak ada, semua sudah ada)'));
  Logger.log('07_AKUN_RELAWAN -- sudah ada sebelumnya: ' + (hasilAkun.sudahAda.join(', ') || '(tidak ada)'));
  Logger.log('Total kolom baru ditambahkan: ' + (hasilRelawan.ditambahkan.length + hasilAkun.ditambahkan.length));
}

/**
 * Helper: tambahkan daftar nama kolom ke UJUNG KANAN header sheet, HANYA
 * untuk yang belum ada. Tidak pernah menghapus/menggeser kolom existing.
 */
function tambahKolomJikaBelumAda_(namaSheet, daftarKolomBaru) {
  const sheet = getSheet(namaSheet);
  const headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1));
  const headerSekarang = headerRange.getValues()[0].map(h => String(h).trim()).filter(h => h !== '');

  const sudahAda = [];
  const perluDitambah = [];
  daftarKolomBaru.forEach(nama => {
    if (headerSekarang.indexOf(nama) !== -1) sudahAda.push(nama);
    else perluDitambah.push(nama);
  });

  if (perluDitambah.length > 0) {
    const kolomMulai = headerSekarang.length + 1;
    sheet.getRange(1, kolomMulai, 1, perluDitambah.length).setValues([perluDitambah]);
  }

  return { ditambahkan: perluDitambah, sudahAda: sudahAda };
}


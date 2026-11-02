/**
 * SATU FUNGSI SAJA -- langsung MENGATUR kata sandi baru DAN memastikan
 * berhasil tersimpan, dalam satu langkah. Tidak perlu fungsi terpisah
 * lagi untuk menguji.
 */
function jalankanSetSandiBaru() {
  const sandiBaru = 'Sppgjj123'; // <-- GANTI teks ini dengan kata sandi pilihan Anda

  setPengaturan_('HASH_KATA_SANDI', hashRahasia_(sandiBaru));

  // Langsung baca ULANG dari PENGATURAN (bukan dari variabel di atas) --
  // supaya benar-benar memastikan yang TERSIMPAN itu cocok, bukan cuma
  // percaya proses setValue() tidak gagal diam-diam.
  const hashTersimpanSekarang = getPengaturan_('HASH_KATA_SANDI', '');
  const cocok = hashRahasia_(sandiBaru) === hashTersimpanSekarang;

  Logger.log('Kata sandi baru yang diset: "' + sandiBaru + '"');
  Logger.log(cocok ? 'âœ… BERHASIL -- kata sandi ini sudah aktif, langsung bisa dipakai login.' : 'âŒ GAGAL TERSIMPAN -- coba jalankan ulang fungsi ini sekali lagi.');
}


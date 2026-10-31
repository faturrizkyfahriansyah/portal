/**
 * SIPOGIM — Pengaturan.gs
 * Baca/ubah PENGATURAN. PENTING: HASH_KATA_SANDI dan HASH_PIN TIDAK
 * PERNAH dikirim ke frontend lewat sini (ganti kata sandi/PIN punya
 * jalur sendiri di Auth.gs dgn verifikasi kata sandi/PIN lama) --
 * daftar KUNCI_PENGATURAN_TERLIHAT di bawah adalah DAFTAR PUTIH,
 * bukan daftar hitam, supaya pengaturan sensitif baru di masa depan
 * otomatis TIDAK terekspos kecuali sengaja ditambahkan ke daftar ini.
 */
const KUNCI_PENGATURAN_TERLIHAT = [
  'USERNAME', 'JUMLAH_DESIMAL_TAMPIL', 'INTERVAL_SINKRON_MENIT', 'ID_SPREADSHEET_MENU', 'KATEGORI_KOLOM'
];
const KUNCI_PENGATURAN_BOLEH_DIUBAH = [
  'JUMLAH_DESIMAL_TAMPIL', 'INTERVAL_SINKRON_MENIT', 'ID_SPREADSHEET_MENU', 'KATEGORI_KOLOM'
]; // USERNAME sengaja TIDAK bisa diubah lewat sini -- risiko terkunci dari akun sendiri kalau salah ketik

function getPengaturanSemua(body) {
  const sheet = getSheetSipogim_('PENGATURAN');
  const semua = sheetToObjectsSipogim_(sheet);
  const hasil = {};
  semua.forEach(p => { if (KUNCI_PENGATURAN_TERLIHAT.indexOf(p.KUNCI) !== -1) hasil[p.KUNCI] = p.NILAI; });
  return hasil;
}

function ubahPengaturan(body) {
  const namaAktor = wajibNamaSaya_(body);
  const kunci = sanitizeSipogim_(body.kunci);
  if (KUNCI_PENGATURAN_BOLEH_DIUBAH.indexOf(kunci) === -1) throw new Error('Pengaturan ini tidak bisa diubah lewat sini.');

  const nilaiLama = getPengaturan_(kunci, '');
  setPengaturan_(kunci, sanitizeSipogim_(body.nilai));
  catatRiwayatSipogim_(namaAktor, 'pengaturan', kunci, 'ubah', { nilai: nilaiLama }, { nilai: body.nilai },
    namaAktor + ' mengubah pengaturan "' + kunci + '".');
  return { ok: true };
}


/**
 * SPPG JEUNGJING — DiagnosaDataRelawan.gs
 *
 * SEKALI-PAKAI untuk mendiagnosis kenapa relawan tidak muncul di
 * "Manajemen Relawan → Akun Relawan" setelah ID diubah massal.
 *
 * CARA PAKAI:
 * 1. Tambahkan file ini ke Apps Script
 * 2. Pilih fungsi "diagnosaDataRelawan" di dropdown (sebelah tombol Run)
 * 3. Klik Run
 * 4. Buka View > Logs (atau Ctrl+Enter) untuk lihat hasilnya
 * 5. File ini boleh dihapus setelah selesai dipakai
 */
function diagnosaDataRelawan() {
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxId = headers.indexOf('ID_RELAWAN');
  const idxNama = headers.indexOf('NAMA_RELAWAN');
  const idxStatus = headers.indexOf('STATUS');

  Logger.log('=== DIAGNOSA 01_DATA_RELAWAN ===');
  Logger.log('Header kolom: ' + headers.join(' | '));
  Logger.log('Posisi kolom -- ID_RELAWAN: ' + idxId + ', NAMA_RELAWAN: ' + idxNama + ', STATUS: ' + idxStatus);
  Logger.log('Total baris data (tanpa header): ' + (data.length - 1));
  Logger.log('');

  if (idxId === -1 || idxNama === -1 || idxStatus === -1) {
    Logger.log('❌ MASALAH DITEMUKAN: ada kolom wajib yang hilang dari header baris 1!');
    Logger.log('   Header harus persis: ID_RELAWAN, NAMA_RELAWAN, ..., STATUS, ...');
    return;
  }

  let kosong = 0, statusAktif = 0, statusLain = {};
  const idTerpakai = {};
  const idDuplikat = [];
  const idKosong = [];

  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][idxId] || '').trim();
    const nama = String(data[i][idxNama] || '').trim();
    const status = String(data[i][idxStatus] || '').trim();

    if (!id && !nama) { kosong++; continue; } // baris benar-benar kosong, lewati

    if (!id) idKosong.push('Baris ' + (i + 1) + ' (nama: ' + (nama || '-') + ')');
    else {
      if (idTerpakai[id]) idDuplikat.push(id + ' (baris ' + (i + 1) + ' & ' + idTerpakai[id] + ')');
      idTerpakai[id] = i + 1;
    }

    const statusUpper = status.toUpperCase();
    if (statusUpper === 'AKTIF') statusAktif++;
    else statusLain[status || '(KOSONG)'] = (statusLain[status || '(KOSONG)'] || 0) + 1;

    // Tampilkan 10 baris pertama sebagai contoh konkret
    if (i <= 10) Logger.log('Baris ' + (i + 1) + ': ID="' + id + '" | Nama="' + nama + '" | Status="' + status + '"');
  }

  Logger.log('');
  Logger.log('=== RINGKASAN ===');
  Logger.log('Baris kosong total (dilewati): ' + kosong);
  Logger.log('Relawan dengan STATUS persis "AKTIF": ' + statusAktif + '  <-- INI YANG MUNCUL DI ADMIN');
  Logger.log('Relawan dengan status LAIN/kosong: ' + JSON.stringify(statusLain));
  Logger.log('Baris dengan ID_RELAWAN KOSONG: ' + (idKosong.length ? idKosong.join('; ') : 'tidak ada'));
  Logger.log('ID_RELAWAN DUPLIKAT: ' + (idDuplikat.length ? idDuplikat.join('; ') : 'tidak ada'));

  Logger.log('');
  if (statusAktif === 0) {
    Logger.log('❌ KESIMPULAN: Tidak ada satupun baris dengan STATUS="AKTIF" persis --');
    Logger.log('   inilah kenapa daftar di Admin kosong. Kemungkinan besar kolom STATUS');
    Logger.log('   ikut berubah/kosong saat proses ubah ID massal (mis. karena sort/paste');
    Logger.log('   yang menggeser kolom, atau STATUS memang belum diisi ulang).');
    Logger.log('   PERBAIKAN: isi ulang kolom STATUS jadi persis "AKTIF" (huruf besar semua,');
    Logger.log('   tanpa spasi) untuk relawan yang aktif.');
  } else if (idKosong.length > 0) {
    Logger.log('⚠️ ADA baris dengan ID_RELAWAN kosong -- baris ini tidak akan muncul dengan benar.');
  } else if (idDuplikat.length > 0) {
    Logger.log('⚠️ ADA ID_RELAWAN yang dipakai lebih dari 1 relawan -- ini bisa membuat data saling menimpa.');
  } else {
    Logger.log('✅ Data terlihat sehat (' + statusAktif + ' relawan aktif dengan ID unik).');
    Logger.log('   Kalau tetap tidak muncul di Admin, masalahnya ada di tempat lain --');
    Logger.log('   kabari saya dengan hasil log ini.');
  }
}


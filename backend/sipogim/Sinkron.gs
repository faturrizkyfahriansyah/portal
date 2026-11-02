/**
 * SIPOGIM — Sinkron.gs
 * Orkestrasi satu kali sinkron, sesuai langkah di spesifikasi bagian 7:
 * baca -> normalisasi -> upsert menu_harian -> tandai hilang_di_sumber
 * -> pencocokan utk nama baru -> tulis sinkron_log.
 *
 * Hanya SATU sinkron boleh berjalan bersamaan (LockService). Tarik ulang
 * manual dibatasi 1x/menit (lewat PropertiesService).
 */

function sinkronSekarang(body) {
  wajibNamaSaya_(body); // "Tarik ulang" adalah aksi yg dipicu pengguna, dicatat siapa yg memicu

  const terakhirTarik = Number(PropertiesService.getScriptProperties().getProperty('tarik_ulang_terakhir') || 0);
  if (Date.now() - terakhirTarik < 60000) {
    throw new Error('Tarik ulang baru saja dijalankan. Tunggu sebentar sebelum mencoba lagi.');
  }

  return jalankanSatuSinkron_('manual');
}

/** Dipanggil oleh trigger terjadwal (lihat buatTriggerSinkronSipogim di bawah). */
function jalankanSinkronTerjadwalSipogim() {
  jalankanSatuSinkron_('jadwal');
}

function jalankanSatuSinkron_(pemicu) {
  const lock = LockService.getScriptLock();
  const dapatKunci = lock.tryLock(5000);
  if (!dapatKunci) {
    throw new Error('Sinkron lain sedang berjalan. Coba lagi sebentar.');
  }

  PropertiesService.getScriptProperties().setProperty('tarik_ulang_terakhir', String(Date.now()));

  const mulai = sekarangSipogim_();
  const log = { barisDibaca: 0, barisBaru: 0, barisBerubah: 0, barisGalat: 0, pesan: '' };

  try {
    let bacaan;
    try {
      bacaan = bacaMasterMenu_();
    } catch (e) {
      // Sumber tidak bisa dibaca sama sekali -> hasil "gagal", data lama tetap tampil (lihat getSinkronStatus).
      tulisSinkronLog_(mulai, 'gagal', 0, 0, 0, 0, e.message);
      throw e;
    }

    log.barisDibaca = bacaan.baris.length;
    log.barisGalat = bacaan.galat.length;

    const sheetMenu = getSheetSipogim_('MENU_HARIAN');
    const menuSekarang = sheetToObjectsSipogim_(sheetMenu);
    menuSekarang.forEach(m => { m.TANGGAL = normalisasiTanggalSipogim_(m.TANGGAL); }); // lihat catatan di Utils.gs
    // Kunci (tanggal, kategori) -> baris yg sudah ada, utk upsert cepat.
    const petaMenu = {};
    menuSekarang.forEach(m => { petaMenu[kunciMenuSipogim_(m.TANGGAL, m.KATEGORI)] = m; });

    const sinkronId = Utilities.getUuid();
    const kunciTerlihatKali = {}; // (tanggal,kategori) yg muncul di pembacaan kali ini -- sisanya nanti ditandai hilang
    const namaNormBaru = new Set();

    bacaan.baris.forEach(b => {
      const tanggalTeks = formatTanggalSipogim_(b.tanggal);
      const namaNorm = normalisasiNamaSipogim_(b.namaMentah);
      const kunci = kunciMenuSipogim_(tanggalTeks, b.kategori);
      kunciTerlihatKali[kunci] = true;

      const existing = petaMenu[kunci];
      if (existing) {
        if (existing.NAMA_MENTAH !== b.namaMentah || existing.HILANG_DI_SUMBER === true) {
          // Kolom TANGGAL (ke-3) DIPAKSA format teks SEBELUM ditulis -- kalau
          // tidak, Sheets kadang otomatis mengubahnya jadi tipe Tanggal asli,
          // menyebabkan .split('/') gagal di tempat lain saat dibaca lagi.
          paksaKolomTeks_(sheetMenu, existing.__baris, 3);
          sheetMenu.getRange(existing.__baris, 1, 1, 9).setValues([[
            existing.ID, b.periode, tanggalTeks, b.kategori, b.namaMentah, namaNorm, b.refSumber, false, sinkronId
          ]]);
          log.barisBerubah++;
        }
      } else {
        const id = generateIdSipogim_('MN', sheetMenu);
        const barisBaru = sheetMenu.getLastRow() + 1;
        sheetMenu.appendRow([id, b.periode, tanggalTeks, b.kategori, b.namaMentah, namaNorm, b.refSumber, false, sinkronId]);
        paksaKolomTeks_(sheetMenu, barisBaru, 3);
        sheetMenu.getRange(barisBaru, 3).setValue(tanggalTeks); // tulis ulang SETELAH format teks dipaksa, supaya tidak keburu dikonversi
        log.barisBaru++;
      }

      if (!cariPadananExisting_(namaNorm)) namaNormBaru.add(JSON.stringify([namaNorm, b.namaMentah]));
    });

    // Baris lama yg TIDAK muncul lagi di pembacaan kali ini -> tandai hilang_di_sumber, JANGAN hapus.
    menuSekarang.forEach(m => {
      const kunci = kunciMenuSipogim_(m.TANGGAL, m.KATEGORI);
      if (!kunciTerlihatKali[kunci] && m.HILANG_DI_SUMBER !== true) {
        sheetMenu.getRange(m.__baris, 8).setValue(true); // kolom HILANG_DI_SUMBER
      }
    });

    // Pencocokan utk tiap nama_norm yg benar-benar baru (belum pernah ada baris padanan_nama).
    namaNormBaru.forEach(json => {
      const [namaNorm, namaContoh] = JSON.parse(json);
      jalankanPencocokan_(namaNorm, namaContoh);
    });

    const hasil = log.barisGalat > 0 ? 'sebagian' : 'ok';
    tulisSinkronLog_(mulai, hasil, log.barisDibaca, log.barisBaru, log.barisBerubah, log.barisGalat,
      bacaan.galat.map(g => g.refSumber + ': ' + g.pesan).join('; '));
    setPengaturan_('SINKRON_TERAKHIR', sekarangSipogim_().toISOString());

    return Object.assign({ hasil: hasil }, log);
  } finally {
    lock.releaseLock();
  }
}

function kunciMenuSipogim_(tanggal, kategori) { return tanggal + '||' + kategori; }

function tulisSinkronLog_(mulai, hasil, dibaca, baru, berubah, galat, pesan) {
  const sheet = getSheetSipogim_('SINKRON_LOG');
  const id = generateIdSipogim_('SL', sheet);
  sheet.appendRow([id, mulai, sekarangSipogim_(), 'manual-atau-jadwal', hasil, dibaca, baru, berubah, galat, pesan]);
}

function getSinkronStatus(body) {
  const sheet = getSheetSipogim_('SINKRON_LOG');
  const semua = sheetToObjectsSipogim_(sheet);
  const terakhir = semua.sort((a, b) => new Date(b.SELESAI) - new Date(a.SELESAI))[0] || null;
  return {
    terakhir: terakhir ? {
      selesai: terakhir.SELESAI, hasil: terakhir.HASIL, pesan: terakhir.PESAN,
      barisBaru: terakhir.BARIS_BARU, barisBerubah: terakhir.BARIS_BERUBAH, barisGalat: terakhir.BARIS_GALAT
    } : null
  };
}

/**
 * PENTING: nama TANPA garis bawah di akhir (lihat catatan serupa di
 * Setup.gs) -- fungsi ini harus dijalankan manual oleh manusia lewat
 * dropdown editor, dan Apps Script menyembunyikan fungsi berakhiran "_"
 * dari dropdown itu.
 *
 * Jalankan SEKALI secara manual lewat editor Apps Script utk memasang
 * trigger terjadwal (interval mengikuti INTERVAL_SINKRON_MENIT di
 * sheet PENGATURAN, default 30 menit). Aman dijalankan ulang -- trigger
 * lama dgn fungsi yg sama dihapus dulu, supaya tidak dobel.
 */
function buatTriggerSinkronSipogim() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'jalankanSinkronTerjadwalSipogim') ScriptApp.deleteTrigger(t);
  });
  // PENTING: ScriptApp.everyMinutes() HANYA menerima 1, 5, 10, 15, atau 30 --
  // nilai lain akan error saat trigger dibuat. Nilai di PENGATURAN dibulatkan
  // ke pilihan terdekat yang valid.
  const pilihanValid = [1, 5, 10, 15, 30];
  const diminta = Number(getPengaturan_('INTERVAL_SINKRON_MENIT', '30')) || 30;
  const interval = pilihanValid.reduce((terdekat, v) => Math.abs(v - diminta) < Math.abs(terdekat - diminta) ? v : terdekat);
  ScriptApp.newTrigger('jalankanSinkronTerjadwalSipogim').timeBased().everyMinutes(interval).create();
  Logger.log('Trigger sinkron terjadwal terpasang, tiap ' + interval + ' menit' + (interval !== diminta ? ' (diminta ' + diminta + ', dibulatkan ke pilihan valid terdekat)' : '') + '.');
}


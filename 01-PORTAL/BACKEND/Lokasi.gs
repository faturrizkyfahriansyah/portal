/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Lokasi.gs — Master Lokasi SPPG (fondasi validasi GPS, Fase 4)
 *
 * Modul berdiri sendiri, sheet baru (16_MASTER_LOKASI_SPPG) — tidak
 * menyentuh sheet/fungsi lain. BELUM dipakai oleh submitAbsensi() pada
 * tahap ini — itu pekerjaan Fase 5 (rombak alur Absensi: selfie + GPS),
 * yang akan dijelaskan rencananya sebelum ditulis kodenya (fungsi
 * terproteksi).
 *
 * Kolom 16_MASTER_LOKASI_SPPG (persis §J dokumen pengembangan):
 *   ID_LOKASI | NAMA_LOKASI | LATITUDE | LONGITUDE | RADIUS_TOLERANSI_METER | STATUS_AKTIF
 *   STATUS_AKTIF: AKTIF | NONAKTIF
 *
 * PRINSIP: hanya SATU lokasi yang boleh berstatus AKTIF pada satu waktu
 * (itulah titik referensi tunggal untuk validasi jarak absensi). Sistem
 * TIDAK mengisi koordinat produksi apa pun secara otomatis — Admin yang
 * memasukkan titik resmi sendiri (idealnya berdiri langsung di lokasi,
 * pakai tombol "Gunakan Lokasi Saya Sekarang" di Dashboard Admin).
 */

function getLokasiSheet() {
  return getSheet(NAMA_SHEET.LOKASI);
}

function generateIdLokasi_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^LOK(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'LOK' + String(max + 1).padStart(3, '0');
}

function getLokasiListAdmin() {
  return sheetToObjects(getLokasiSheet()).map(l => ({
    id: l.ID_LOKASI,
    nama: l.NAMA_LOKASI,
    latitude: Number(l.LATITUDE),
    longitude: Number(l.LONGITUDE),
    radiusMeter: Number(l.RADIUS_TOLERANSI_METER),
    statusAktif: l.STATUS_AKTIF
  }));
}

/**
 * Dipakai internal oleh Absensi.gs (Fase 5) sebagai titik referensi
 * validasi jarak. Return null jika belum ada lokasi aktif sama sekali
 * (Absensi.gs wajib menangani ini dengan pesan yang jelas, BUKAN error mentah).
 */
function getLokasiAktif_() {
  // Lokasi hampir tidak pernah berubah -- di-cache 10 menit (pola sama
  // seperti cache_divisi_list di Relawan.gs) supaya tidak baca ulang
  // Spreadsheet SETIAP KALI ada relawan absen (fungsi ini dipanggil di
  // submitAbsensi, jadi frekuensinya sangat tinggi). Cache dihapus
  // otomatis begitu Admin ubah lokasi (lihat addLokasi/updateLokasi/
  // updateStatusLokasiAktif di bawah).
  const cache = CacheService.getScriptCache();
  const tersimpan = cache.get('cache_lokasi_aktif');
  if (tersimpan) return JSON.parse(tersimpan);

  const semua = sheetToObjects(getLokasiSheet());
  const aktif = semua.find(l => l.STATUS_AKTIF === 'AKTIF');
  const hasil = !aktif ? null : {
    id: aktif.ID_LOKASI,
    nama: aktif.NAMA_LOKASI,
    latitude: Number(aktif.LATITUDE),
    longitude: Number(aktif.LONGITUDE),
    radiusMeter: Number(aktif.RADIUS_TOLERANSI_METER)
  };
  cache.put('cache_lokasi_aktif', JSON.stringify(hasil), 600); // 10 menit
  return hasil;
}

/** Formula Haversine — jarak antara 2 titik GPS dalam meter. */
function hitungJarakMeter_(lat1, lng1, lat2, lng2) {
  const R = 6371000; // radius bumi, meter
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function validasiKoordinat_(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    throw new Error('Koordinat tidak valid.');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Koordinat di luar rentang yang wajar.');
  }
}

function addLokasi(body) {
  const nama = sanitize(body.nama);
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const radius = Number(body.radiusMeter);

  if (!nama) throw new Error('Nama lokasi wajib diisi.');
  validasiKoordinat_(lat, lng);
  if (!radius || radius <= 0) throw new Error('Radius toleransi wajib diisi dan lebih dari 0 meter.');

  const sheet = getLokasiSheet();
  const id = generateIdLokasi_(sheet);
  const jadikanAktif = !!body.jadikanAktif;

  if (jadikanAktif) nonaktifkanSemuaLokasi_(sheet);

  sheet.appendRow([id, nama, lat, lng, radius, jadikanAktif ? 'AKTIF' : 'NONAKTIF']);
  if (jadikanAktif) CacheService.getScriptCache().remove('cache_lokasi_aktif');
  return { id: id, nama: nama };
}

function updateLokasi(body) {
  const id = sanitize(body.id);
  const nama = sanitize(body.nama);
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const radius = Number(body.radiusMeter);

  if (!id) throw new Error('ID lokasi wajib diisi.');
  if (!nama) throw new Error('Nama lokasi wajib diisi.');
  validasiKoordinat_(lat, lng);
  if (!radius || radius <= 0) throw new Error('Radius toleransi wajib diisi dan lebih dari 0 meter.');

  const sheet = getLokasiSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      const statusSaatIni = String(data[i][5]);
      sheet.getRange(i + 1, 1, 1, 6).setValues([[id, nama, lat, lng, radius, statusSaatIni]]);
      CacheService.getScriptCache().remove('cache_lokasi_aktif');
      return { success: true };
    }
  }
  throw new Error('Lokasi tidak ditemukan.');
}

function nonaktifkanSemuaLokasi_(sheet) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][5]) === 'AKTIF') sheet.getRange(i + 1, 6).setValue('NONAKTIF');
  }
}

/** Menjadikan satu lokasi AKTIF — otomatis menonaktifkan semua lokasi lain (hanya 1 titik aktif). */
function updateStatusLokasiAktif(body) {
  const id = sanitize(body.id);
  if (!id) throw new Error('ID lokasi wajib diisi.');

  const sheet = getLokasiSheet();
  const data = sheet.getDataRange().getValues();
  let ditemukan = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) ditemukan = true;
  }
  if (!ditemukan) throw new Error('Lokasi tidak ditemukan.');

  nonaktifkanSemuaLokasi_(sheet);
  const data2 = sheet.getDataRange().getValues();
  for (let i = 1; i < data2.length; i++) {
    if (String(data2[i][0]) === id) {
      sheet.getRange(i + 1, 6).setValue('AKTIF');
      break;
    }
  }
  CacheService.getScriptCache().remove('cache_lokasi_aktif');
  return { success: true };
}

function deleteLokasi(body) {
  const id = sanitize(body.id);
  const sheet = getLokasiSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      if (String(data[i][5]) === 'AKTIF') {
        throw new Error('Tidak dapat menghapus lokasi yang sedang aktif. Aktifkan lokasi lain terlebih dahulu.');
      }
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Lokasi tidak ditemukan.');
}


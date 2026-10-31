/**
 * LaporanSipika.gs — Menu Laporan (SIPIKA), Keputusan Final Implementasi #2
 *
 * Laporan pertama yang dibangun: KOREKSI PRESENSI. Dipilih duluan krn
 * dari 5 konsep yang diminta, ini SATU-SATUNYA yang TIDAK tumpang
 * tindih dgn fitur yg sudah ada (Rekap Harian & Rekap Per Periode
 * SUDAH menjawab kebutuhan "Laporan Presensi"; "Laporan Jadwal" sebagian
 * besar sudah terjawab Pemeriksaan Jadwal Individu) -- dan datanya
 * SUDAH ADA & SIAP PAKAI: backend logAudit_()/getAuditLogListAdmin
 * (Utils.gs) sudah mencatat SETIAP koreksi presensi sejak awal, tapi
 * TIDAK PERNAH ada layar untuk membacanya kembali. Ini murni membuka
 * jendela baru ke data yg sudah terkumpul -- BUKAN logika/pencatatan baru.
 *
 * Laporan lain (Relawan, Jadwal&Penugasan ringkas semua-relawan, Stok)
 * SENGAJA belum dibangun di tahap ini -- lihat laporan akhir soal
 * alasannya per jenis, bukan diam-diam dilewati.
 */

const AKSI_KOREKSI_PRESENSI = [
  'UBAH_JADWAL_INDIVIDU', 'HAPUS_JADWAL_INDIVIDU', 'KOREKSI_ABSENSI_AKTUAL',
  'KOREKSI_OPERASIONAL_ABSENSI', 'TANDAI_HADIR_MANUAL', 'HAPUS_ABSENSI'
];

/**
 * Laporan Koreksi Presensi -- filter 24_AUDIT_LOG ke 6 jenis aksi yg
 * benar-benar berarti "koreksi presensi" (lihat AKSI_KOREKSI_PRESENSI).
 * Beda dari getAuditLogListAdmin (yg generik, dibatasi 200 baris
 * TERBARU apa pun jenisnya) -- di sini dibatasi RENTANG TANGGAL (utk
 * laporan periode tertentu), bukan dibatasi jumlah baris.
 */
function getLaporanKoreksiPresensi(body) {
  const aktor = requireAuth(body.token, true); // Staff boleh lihat laporan (hanya Admin yg boleh MENGOREKSI)
  requireIzinModulBaru_(aktor, 'LAPORAN', 'VIEW');
  const dariIso = sanitize(body.dari);
  const sampaiIso = sanitize(body.sampai);
  if (!dariIso || !sampaiIso) throw new Error('Rentang tanggal wajib diisi.');

  const dari = new Date(dariIso + 'T00:00:00');
  const sampai = new Date(sampaiIso + 'T23:59:59');
  if (sampai < dari) throw new Error('Tanggal "sampai" tidak boleh sebelum tanggal "dari".');

  const semua = sheetToObjects(getSheet(NAMA_SHEET.AUDIT_LOG));
  const hasil = semua
    .filter(r => AKSI_KOREKSI_PRESENSI.indexOf(r.AKSI) !== -1)
    .filter(r => { const w = new Date(r.WAKTU); return w >= dari && w <= sampai; })
    .sort((a, b) => new Date(b.WAKTU) - new Date(a.WAKTU))
    .map(r => {
      let detail = {};
      try { detail = JSON.parse(r.DETAIL || '{}'); } catch (e) { /* biarkan kosong kalau rusak */ }
      return {
        waktu: r.WAKTU, aksi: r.AKSI, petugas: r.AKTOR, idTerkait: r.ID_TERKAIT,
        keterangan: detail.keterangan || '', ringkasan: ringkasDetailKoreksi_(r.AKSI, detail)
      };
    });

  return { jumlah: hasil.length, data: hasil };
}

/** Ubah objek "detail" (JSON mentah dari logAudit_) jadi 1 kalimat ringkas yg mudah dibaca di tabel laporan -- bukan menampilkan JSON mentah ke Admin. */
function ringkasDetailKoreksi_(aksi, d) {
  switch (aksi) {
    case 'UBAH_JADWAL_INDIVIDU':
      return 'Jam diubah jadi ' + (d.sesudah ? d.sesudah.JAM_JADWAL_MASUK + '–' + d.sesudah.JAM_JADWAL_PULANG : '-');
    case 'HAPUS_JADWAL_INDIVIDU':
      return 'Jadwal dihapus (tanggal ' + (d.sebelum ? d.sebelum.TANGGAL_OPERASIONAL : '-') + ')';
    case 'KOREKSI_ABSENSI_AKTUAL':
      return 'Status diubah jadi ' + (d.statusBaru || '-') + (d.jamMasukBaru ? ', jam ' + d.jamMasukBaru + '–' + d.jamPulangBaru : '');
    case 'KOREKSI_OPERASIONAL_ABSENSI':
      return 'Tanggal dipindah ke operasional baru (' + (d.idOperasionalBaru || '-') + ')';
    case 'TANDAI_HADIR_MANUAL':
      return 'Ditandai Hadir manual (tanggal ' + (d.tanggalOperasional || '-') + ')';
    case 'HAPUS_ABSENSI':
      return 'Baris presensi dihapus';
    default:
      return '-';
  }
}


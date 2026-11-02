/**
 * SipanduAutoFillPOP.gs — Auto-Fill POP (BGN)
 *
 * KEJUJURAN TEKNIS (penting dibaca sebelum pakai):
 * SIPANDU TIDAK PERNAH melihat HTML form POP asli (sistem eksternal milik
 * BGN, bukan bagian dari proyek ini). Field mapping di bawah berasal dari
 * ANALISIS TEKS LABEL di Manual Book Operation POP v1.3 (bukan karangan),
 * tapi CSS selector/ID input yang sebenarnya TETAP TIDAK DIKETAHUI sampai
 * seseorang benar-benar membuka form POP dan memeriksanya.
 *
 * Solusinya: bookmarklet ini mencari input berdasarkan TEKS LABEL yang
 * berdekatan (pencocokan generik) -- BUKAN berdasarkan ID/name yang
 * dikarang. Kalau pencocokan generik gagal untuk field tertentu, PETA_LABEL
 * di bawah bisa diperbarui (tambah variasi teks label) tanpa bongkar kode.
 */

const PETA_LABEL_POP = {
  wo_nomor: ['Nomor Work Order', 'Nomor WO', 'No. WO'],
  wo_tanggal: ['Tanggal Work Order', 'Tanggal WO'],
  wo_jumlah_porsi: ['Jumlah Porsi Target', 'Jumlah Porsi'],
  wo_menu: ['Menu', 'Nama Menu'],
  persiapan_mulai: ['Tanggal & Jam Mulai Persiapan Memasak', 'Jam Mulai Persiapan'],
  persiapan_selesai: ['Tanggal & Jam Selesai Persiapan Memasak', 'Jam Selesai Persiapan'],
  memasak_mulai: ['Tanggal & Jam Mulai Memasak', 'Jam Mulai Memasak'],
  memasak_selesai: ['Tanggal & Waktu Selesai Memasak', 'Jam Selesai Memasak'],
  pemorsian_mulai: ['Tanggal & Jam Mulai Pemorsian', 'Jam Mulai Pemorsian'],
  pemorsian_jumlah_porsi: ['Jumlah porsi aktual hasil pemorsian', 'Jumlah Porsi Aktual']
};

/**
 * Ambil & rangkum SEMUA data WO yang relevan untuk POP, dari sumber yang
 * SUDAH ADA (Work Order, Persiapan, Pengolahan, Pemorsian) -- tidak
 * mengarang data, cuma menyusun ulang.
 */
function generateAutoFillPOP(body) {
  requireSipanduPermission_(body.token, 'wo.view');
  const idWo = sipanduSanitize(body.idWo);
  const wo = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.WORK_ORDERS)).find(w => w.ID_WO === idWo);
  if (!wo) throw new Error('Work Order tidak ditemukan.');

  const menu = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.MENU)).find(m => m.ID_MENU === wo.ID_MENU);
  const persiapan = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PREPARATION)).filter(p => p.ID_WO === idWo);
  const pengolahan = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PROCESSING)).filter(p => p.ID_WO === idWo);
  const pemorsian = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.PORTIONING)).filter(p => p.ID_WO === idWo);

  const waktuPersiapan = persiapan.map(p => p.WAKTU).filter(Boolean).sort();
  const waktuPengolahan = pengolahan.map(p => p.WAKTU).filter(Boolean).sort();
  const sesiPemorsianPertama = pemorsian[0] || {};

  const hasil = {
    wo_nomor: wo.NOMOR_WO || '',
    wo_tanggal: wo.TANGGAL || '',
    wo_jumlah_porsi: String(wo.JUMLAH_PORSI || ''),
    wo_menu: menu ? menu.NAMA_MENU : '',
    // Pendekatan MIN/MAX dari waktu per-bahan -- lihat catatan FM001/FM002
    // di analisis manual: POP minta 1 waktu per tahap, SIPANDU catat per bahan.
    persiapan_mulai: waktuPersiapan[0] || '',
    persiapan_selesai: waktuPersiapan[waktuPersiapan.length - 1] || '',
    memasak_mulai: waktuPengolahan[0] || '',
    memasak_selesai: waktuPengolahan[waktuPengolahan.length - 1] || '',
    pemorsian_mulai: sesiPemorsianPertama.WAKTU_MULAI || '',
    pemorsian_jumlah_porsi: String(sesiPemorsianPertama.JUMLAH_SELESAI || '')
  };

  return {
    data: hasil,
    // Field yang SIPANDU memang belum punya (butuh diisi manual di POP --
    // bukan bug, tapi memang belum ada fitur upload foto pemorsian).
    belumTersedia: ['Foto Ompreng Terbuka', 'Foto Ompreng Berlabel'],
    petaLabel: PETA_LABEL_POP
  };
}


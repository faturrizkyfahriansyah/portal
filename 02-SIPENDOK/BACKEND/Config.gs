/**
 * Config.gs — Konstanta & skema SIPENDOK.
 * Tidak ada credential / ID sensitif di sini. ID spreadsheet, secret & akun
 * disimpan di Script Properties (lihat Setup.gs).
 */
var Cfg = {
  APP: 'SIPENDOK',
  VERSION: '1.1.0',
  TZ: 'Asia/Jakarta',
  SESSION_HARI: 14,

  SHEET: {
    PM: '01_PM',
    PIC: '02_PIC',
    PENERIMAAN: '03_PENERIMAAN',
    TARIF: '04_TARIF',
    HARIAN: '05_PERHITUNGAN_HARIAN',
    BAST: '06_BAST',
    DOKUMEN: '07_DOKUMEN_PENERIMAAN',
    PENGATURAN: '08_PENGATURAN',
    LOG: '09_LOG_AKTIVITAS'
  },

  HEAD: {
    // Diperluas 23 Okt 2026 (diaudit & DISETUJUI Admin -- lihat
    // Master.gs). DISEDERHANAKAN sesuai arahan terbaru Admin: Data
    // Acuan PM HANYA Porsi Kecil + Porsi Besar + No. Kendaraan -- TIDAK
    // ada lagi pembedaan Sekolah/Posyandu di fitur BARU ini (Tenaga
    // Pendidik/Balita/Bumil/Busui SENGAJA tidak dibawa ke sini).
    // Kolom LAMA (ID_PM..KETERANGAN, termasuk JENIS_PM) TIDAK diubah/
    // dihapus -- murni tambahan di akhir, data & fitur SEKOLAH/
    // POSYANDU yg SUDAH ADA di 01_PM & 03_PENERIMAAN tetap utuh apa
    // adanya (sesuai larangan dokumen "jangan hapus field yg sudah
    // dipakai") -- cuma TIDAK lagi ditonjolkan di alur/forum BARU ini.
    // Diperluas 25 Okt 2026 (DISETUJUI Admin -- dokumen Master Instruction
    // SIPENDOK §M.2, "jumlah siswa acuan" utk klasifikasi tarif Insentif
    // PIC Sekolah). SENGAJA field TERPISAH dari ACUAN_PORSI_KECIL/BESAR
    // -- dokumen tegas "Jangan otomatis mengganti jumlah siswa terdaftar
    // dengan jumlah porsi aktual", jadi TIDAK BOLEH dihitung dari porsi.
    // Kosong = belum diisi (bukan 0), relevan HANYA utk JENIS_PM=SEKOLAH.
    // Diperluas 27 Okt 2026 (DISETUJUI Admin -- kembalikan pembedaan
    // Sekolah/Posyandu utk template BAST+SJ baru yg 2 lembar, lihat
    // keputusan terkait template "_1"). ACUAN_BALITA/BUMIL/BUSUI khusus
    // Posyandu, SEJAJAR konsepnya dgn ACUAN_PORSI_KECIL/BESAR utk Sekolah
    // -- field TERPISAH per jenis, TIDAK saling menimpa.
    // Diperbaiki 28 Okt 2026 (bug ditemukan: ensureSheet menolak sheet
    // 01_PM nyata dgn pesan "Header tidak sesuai skema"). Akar masalah:
    // urutan kolom J-M di sini HARUS PERSIS sama dgn sheet sungguhan.
    // Dicek LANGSUNG dari screenshot sheet aktual (bukan tebakan):
    // I=ACUAN_NO_KENDARAAN, J=ACUAN_BUMIL, K=ACUAN_BUSUI, L=ACUAN_BALITA,
    // M=ACUAN_JUMLAH_SISWA -- urutan ini BEDA dari dugaan sebelumnya,
    // diperbaiki SEKALI LAGI supaya benar2 cocok. ensureSheet mencocokkan
    // POSISI persis; array di sini WAJIB ikut kenyataan sheet.
    PM: ['ID_PM', 'NAMA_PM', 'JENIS_PM', 'ALAMAT', 'STATUS', 'KETERANGAN',
      'ACUAN_PORSI_KECIL', 'ACUAN_PORSI_BESAR', 'ACUAN_NO_KENDARAAN',
      'ACUAN_BUMIL', 'ACUAN_BUSUI', 'ACUAN_BALITA', 'ACUAN_JUMLAH_SISWA'],
    PIC: ['ID_PIC', 'ID_PM', 'NAMA_PIC', 'JABATAN', 'NOMOR_REKENING', 'NOMOR_HP', 'STATUS'],
    PENERIMAAN: ['ID_TRANSAKSI', 'TANGGAL', 'ID_PM', 'NAMA_PM', 'PORSI_KECIL', 'PORSI_BESAR', 'TENAGA_PENDIDIK',
      'BALITA', 'BUMIL', 'BUSUI', 'TOTAL', 'ID_PIC', 'NAMA_PIC', 'NO_KENDARAAN', 'WAKTU_INPUT', 'USER_INPUT'],
    TARIF: ['JENIS_PORSI', 'TOTAL', 'BAHAN_BAKU', 'MITRA_FASILITAS', 'OPERASIONAL'],
    HARIAN: ['TANGGAL', 'PORSI_KECIL', 'PORSI_BESAR', 'BAHAN_BAKU', 'MITRA_FASILITAS', 'OPERASIONAL', 'TOTAL_PAGU'],
    // Diperluas 23 Okt 2026 (DISETUJUI Admin -- format nomor baru, lihat
    // Bast.gs) -- 2 kolom BARU di akhir: NOMOR_SJ (Surat Jalan berbagi
    // periode+urut+tanggal dgn BAST pasangannya, tapi nomornya beda
    // segmen jenis) & KODE_PERIODE (dipakai utk cari nomor urut
    // berikutnya PER PERIODE, bukan parsing ulang dari teks nomor tiap
    // kali -- lebih tegas & tahan kalau format nomor berubah lagi nanti).
    BAST: ['ID_BAST', 'TANGGAL', 'NOMOR_BAST', 'ID_PM', 'NAMA_PM', 'TOTAL_PAKET', 'ID_TRANSAKSI', 'FILE_DOKUMEN', 'STATUS', 'NOMOR_SJ', 'KODE_PERIODE'],
    DOKUMEN: ['ID_DOKUMEN', 'TANGGAL', 'JUMLAH_PM', 'TOTAL_PAKET', 'FILE_WORD', 'FILE_PDF', 'FOLDER_DRIVE', 'STATUS',
      'WAKTU_GENERATE', 'USER_GENERATE'],
    PENGATURAN: ['KUNCI', 'NILAI', 'KETERANGAN'],
    LOG: ['WAKTU', 'USER', 'AKTIVITAS', 'MODUL', 'ID_DATA', 'KETERANGAN']
  },

  /** Kolom yang harus berformat teks (agar tanggal/nomor HP/rekening tidak diubah Sheets). */
  TEXT_COLS: {
    PM: ['ID_PM', 'NAMA_PM', 'ALAMAT', 'KETERANGAN'],
    PIC: ['ID_PIC', 'ID_PM', 'NAMA_PIC', 'JABATAN', 'NOMOR_REKENING', 'NOMOR_HP'],
    PENERIMAAN: ['ID_TRANSAKSI', 'TANGGAL', 'ID_PM', 'NAMA_PM', 'ID_PIC', 'NAMA_PIC', 'NO_KENDARAAN', 'WAKTU_INPUT', 'USER_INPUT'],
    HARIAN: ['TANGGAL'],
    BAST: ['ID_BAST', 'TANGGAL', 'NOMOR_BAST', 'ID_PM', 'NAMA_PM', 'ID_TRANSAKSI'],
    DOKUMEN: ['ID_DOKUMEN', 'TANGGAL', 'WAKTU_GENERATE'],
    PENGATURAN: ['KUNCI', 'NILAI'],
    LOG: ['WAKTU', 'ID_DATA']
  },

  JENIS: ['SEKOLAH', 'POSYANDU'],
  STATUS: ['Aktif', 'Tidak Aktif'],

  /** Kategori yang berlaku per jenis PM. */
  KATEGORI: {
    SEKOLAH: ['PORSI_KECIL', 'PORSI_BESAR', 'TENAGA_PENDIDIK'],
    POSYANDU: ['BALITA', 'BUMIL', 'BUSUI']
  },
  KATEGORI_SEMUA: ['PORSI_KECIL', 'PORSI_BESAR', 'TENAGA_PENDIDIK', 'BALITA', 'BUMIL', 'BUSUI'],

  /** Mapping kategori detail -> jenis tarif (perhitungan saja; data detail tetap disimpan). */
  TARIF_MAP: {
    PORSI_KECIL: 'Porsi Kecil',
    BALITA: 'Porsi Kecil',
    PORSI_BESAR: 'Porsi Besar',
    TENAGA_PENDIDIK: 'Porsi Besar',
    BUMIL: 'Porsi Besar',
    BUSUI: 'Porsi Besar'
  },

  DEFAULT_TARIF: [
    ['Porsi Kecil', 13000, 8000, 2000, 3000],
    ['Porsi Besar', 15000, 10000, 2000, 3000]
  ],

  // Diperbarui 23 Okt 2026 (DISETUJUI Admin -- format nomor BAST/SJ baru,
  // lihat Bast.gs): KODE_SPPG defaultnya diganti 'SPPG-JC' (Jeungjing
  // Cisoka, sesuai dokumen & template BAST/SJ yg diunggah) -- KALAU
  // Admin SUDAH PERNAH mengubah nilai ini secara manual di Pengaturan
  // SIPENDOK sebelumnya, nilai tersimpan itu TETAP DIPAKAI (baris
  // DEFAULT_PENGATURAN ini cuma dipakai saat setup() PERTAMA KALI,
  // tidak pernah menimpa pengaturan yg sudah ada -- lihat Setup.gs).
  // RESET_NOMOR_BAST diganti 'PER_PERIODE' (dari 'BULANAN') sesuai
  // format baru yg menyertakan kode periode (P01 dst) di nomornya.
  // TEMPLATE_BAST_SJ: BARU -- file ID template gabungan BAST+Surat
  // Jalan (1 file, lihat Dok.BastSj.gs), TERPISAH dari TEMPLATE_DOKUMEN
  // lama (dokumen penerimaan harian per-PM, SEKOLAH/POSYANDU -- modul
  // BERBEDA, TIDAK disatukan, sesuai larangan dokumen "jangan merusak
  // modul Dokumen yg sudah berjalan").
  DEFAULT_PENGATURAN: [
    ['KODE_SPPG', 'SPPG-JC', 'Dipakai pada nomor BAST & Surat Jalan'],
    ['NAMA_SPPG', 'SPPG Jeungjing Cisoka', ''],
    ['TAHUN_AKTIF', '2026', 'Tahun default untuk rekap & arsip'],
    ['RESET_NOMOR_BAST', 'PER_PERIODE', 'Nomor BAST/SJ dimulai dari 001 setiap periode operasional baru'],
    ['TEMPLATE_DOKUMEN', '', 'Google Drive File ID template Word Dokumen Penerimaan harian (berisi lembar SEKOLAH + lembar POSYANDU)'],
    ['TEMPLATE_BAST_SJ', '', 'Google Drive File ID template gabungan BAST + Surat Jalan (1 file, format sesuai Rancangan BAST dan Surat Jalan SPPG Jeungjing Cisoka)'],
    // BARU 27 Okt 2026 (perbaikan bug: Bast.gs sebelumnya salah baca
    // 14_PERIODE_KERJA dari Db.ss() -- spreadsheet SIPENDOK sendiri,
    // bukan spreadsheet Portal Pengelola tempat sheet itu SUNGGUHAN
    // berada). ID default diambil dari identifikasi spreadsheet "DATABASE
    // PORTAL SPPG JEUNGJING" yg sudah dipastikan sebelumnya -- bisa
    // diubah di sini kalau Portal pernah pindah spreadsheet.
    ['PORTAL_SPREADSHEET_ID', '1zMPP49ec963RuN7scvAqWYcZlxtalJMi7EVwU_xe3Io', 'ID Spreadsheet Portal Pengelola -- tempat sheet 14_PERIODE_KERJA sungguhan berada (BEDA dari spreadsheet SIPENDOK sendiri)'],
    ['FOLDER_DOKUMEN', '', 'Google Drive Folder ID root "SIPENDOK"'],
    ['BUAT_PDF', 'YA', 'YA / TIDAK — buat PDF otomatis saat generate']
  ],

  BULAN: ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'],
  ROMAWI: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'],
  HARI: ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'],

  /** Header 03_PENERIMAAN versi 1.0 (tanpa NO_KENDARAAN) — untuk migrasi. */
  HEAD_PENERIMAAN_V1: ['ID_TRANSAKSI', 'TANGGAL', 'ID_PM', 'NAMA_PM', 'PORSI_KECIL', 'PORSI_BESAR', 'TENAGA_PENDIDIK',
    'BALITA', 'BUMIL', 'BUSUI', 'TOTAL', 'ID_PIC', 'NAMA_PIC', 'WAKTU_INPUT', 'USER_INPUT'],

  MAX_JUMLAH: 100000,
  MAX_KENDARAAN: 20,
  MAX_HARI_KE_DEPAN: 7
};


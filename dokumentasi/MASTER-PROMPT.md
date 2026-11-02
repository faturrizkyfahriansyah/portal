# MASTER PROMPT — Pengembangan Ekosistem Digital Portal SPPG Jeungjing

**Versi**: 2 (diperbarui penuh) · **Tanggal**: 30 Oktober 2026
**Status**: Dokumen acuan TUNGGAL — merangkum SELURUH keputusan, temuan, kode yang sudah dibangun, dan sisa pekerjaan. Ditulis supaya bisa dipakai lanjut oleh siapa pun/tools AI mana pun TANPA perlu membaca ulang riwayat percakapan.

---

## 1. KONTEKS

SPPG Jeungjing (Desa Jeungjing, Kec. Cisoka, Kab. Tangerang, Banten) menjalankan program Makan Bergizi Gratis (MBG). Ekosistem digitalnya berkembang organik lewat banyak sesi pengembangan terpisah (termasuk dgn AI berbeda) tanpa visibilitas penuh antarsesi — mengakibatkan duplikasi kode, fungsi dibangun ulang tanpa sadar sudah ada, dan struktur yang perlu dirapikan.

**Tujuan utama**: satu ekosistem PORTAL terintegrasi, satu identitas pengguna, satu kali login, database tetap Google Sheets dirapikan (BUKAN dipindah ke PostgreSQL untuk saat ini), tanpa kehilangan fitur yang sudah berjalan.

**Sumber dokumen acuan** (semua sudah dibaca & diselaraskan):
1. "Draft Final — Konsep Penataan Ekosistem" (roadmap 10 Tahap, struktur navigasi, pembagian modul)
2. "Master Instruction — Audit, Redesain, Normalisasi, Database" (FASE A-H khusus database, TETAP Google Sheets, standar Data Dictionary/BCNF)
3. Prompt-prompt audit awal (database 6 workbook, kode Apps Script)

---

## 2. ARSITEKTUR NYATA (Hasil Audit Langsung, Diverifikasi — Bukan Asumsi)

| Proyek Apps Script | Isi | Status |
|---|---|---|
| **PORTAL** (1 proyek) | 65+ file backend, termasuk **SIPANDU** (12 file) dan **SIKOP** (3 file) TERGABUNG di proyek yang sama | Sehat setelah perbaikan besar (Bagian 5) |
| **SIPENDOK** | 19 file, proyek TERPISAH, dipanggil via HTTP (`UrlFetchApp`) | Sehat, 0 masalah struktural |
| **SIPOGIM** | 18 file, proyek TERPISAH | Sehat struktur, TAPI model "1 akun bersama tim" tidak kompatibel dgn login per-orang |
| **SIRAGA** | Spreadsheet **TERPISAH SEPENUHNYA** (`SIRAGA_SPREADSHEET_ID`, Script Property) — bukan cuma sheet beda di workbook sama. Kode (`SiragaDb.gs` dkk) ADA di proyek Portal, tapi DATA-nya di spreadsheet lain | **Dikonfirmasi Admin: sistem AKTIF** yang benar-benar dipakai petugas gudang |
| **stok.gs** (modul stok lama, sheet 17-23 di Portal) | Tetap tersambung ke Code.gs, TIDAK diputus (165 baris riwayat transaksi historis) | **LEGACY/ARCHIVE CANDIDATE** (dikonfirmasi Admin 30 Okt) |

Frontend: 134 file (GitHub Pages), termasuk subfolder `sipendok/` dan `sipogim/`.

---

## 3. KEPUTUSAN YANG SUDAH DISEPAKATI (JANGAN DIUBAH TANPA PERSETUJUAN BARU)

1. **Database tetap Google Spreadsheet**. PostgreSQL/MySQL/dll **TIDAK** dipakai sekarang.
2. **`DIVISI` vs `JABATAN`** di `01_DATA_RELAWAN`:
   - **DIVISI** (12 nilai final, kategori RELAWAN, prefiks ID `R-`): Persiapan (PRS), Pengolahan (PGL), Pemorsian (PMS), Cuci Ompreng (CMO), Driver (DRV), Asisten Driver (ASD), Admin (ADM), Security (SEC), Cleaning Service (CS), Asisten Lapangan (ASL), Petugas Logistik (LOG), Head Chef (HC).
   - **JABATAN/PERAN** (3 nilai, kategori STAFF, prefiks ID `S-`): KA SPPG (KAS), Pengawas Gizi (GIZ), Pengawas Keuangan (KEU).
3. **`06_ADMIN` digabung TOTAL** ke `01_DATA_RELAWAN` + `07_AKUN_RELAWAN` — satu identitas penuh.
4. **Mekanisme login admin TIDAK diubah sekarang** — digantikan total di Tahap 3, SIPANDU nanti diakses langsung lewat sesi Portal.
5. **SIPIKA adalah NAMA BARU**, bukan modul baru — pengelompokan ulang Informasi/Pengumuman/Notifikasi/Penerima Manfaat/Dokumen yang SUDAH ADA.
6. **SIKOP** = file yang SUDAH ADA di Portal (SikopMultiShift.gs dkk) — bukan proyek baru.
7. **Dashboard TIDAK dirombak** pada Tahap 4.
8. **SIRAGA & SIPANDU**: tetap di proyek Portal untuk sekarang, jadi proyek terpisah SETELAH audit masing-masing.
9. **SIRAGA = sistem stok AKTIF** (dikonfirmasi Admin), `stok.gs` = legacy (ditandai di kode, TIDAK dihapus/diputus — data historis dipertahankan).

---

## 4. ATURAN WAJIB (Konsolidasi dari SEMUA dokumen perencanaan)

1. Jangan menghapus fitur yang masih dipakai tanpa persetujuan eksplisit.
2. Jangan membuat database/tabel baru untuk data yang sudah punya pemilik jelas.
3. Jangan menggandakan master data — satu entitas, satu sumber kebenaran.
4. Jangan mengubah ID lama tanpa strategi migrasi & pemetaan jelas.
5. Backup dulu sebelum migrasi berisiko; migrasi harus idempoten.
6. **Jangan mengarang struktur/kode yang belum diperiksa langsung** — audit dulu, baru putuskan (lihat Bagian 6, pelajaran dari 2 insiden nyata).
7. Setiap perubahan database butuh pemeriksaan KODE yang membacanya, bukan cuma ubah sheet.
8. Validasi & keamanan WAJIB di backend, frontend cuma tampilan.
9. Setiap sheet dikategorikan: MASTER/TRANSAKSI/DETAIL/REFERENSI/KONFIGURASI/REKAP/AUDIT LOG/HISTORI/SEMENTARA/SISTEM, dan berstatus: ACTIVE/INACTIVE/LEGACY/DUPLICATE/NEEDS REVIEW/ARCHIVE CANDIDATE — jangan menghapus/gabung sheet hanya berdasar dugaan.
10. Normalisasi (1NF-BCNF) dibuktikan lewat analisis ketergantungan fungsional nyata, bukan diklaim dari bentuk tabel saja.
11. Jangan menyimpan password/token/rahasia di kode/repository — pakai Script Properties.

---

## 5. ROADMAP 10 TAHAP & STATUS LENGKAP

| Tahap | Isi | Status | Detail |
|---|---|---|---|
| 1 | Audit & Pemetaan Sistem | ✅ Selesai | Portal (65 file backend+134 frontend), SIPENDOK, SIPOGIM, database 6 workbook/103 sheet |
| 2 | SIMSDM & Hak Akses Terpusat | ✅ Selesai | `MigrasiSIMSDM.gs` dibangun & diuji simulasi penuh (idempoten), `Relawan.gs` (generator ID diperbaiki total) |
| 3 | Autentikasi Terpusat | 🟨 Sebagian | Jembatan token Portal↔SIPENDOK selesai & teruji (`AuthTerpusat.gs`+`VerifikasiTokenPortal.gs`). **Belum**: adminLogin belum disambung; SIPOGIM butuh redesain akun-per-orang dulu |
| 4 | Penataan Navigasi PORTAL | ✅ Selesai | `NavigasiTerpusat.js` + 24 halaman HTML terintegrasi langsung (bukan instruksi manual). Lihat Bagian 6 utk cerita koreksi desain |
| 5 | SIKOP & SIPRES | 🟨 Lapisan mekanis selesai | Semua fungsi SUDAH tersambung (bagian dari perbaikan Tahap 1). Penyelarasan desain (satu sumber periode, dll) belum diaudit mendalam |
| 6 | SIRAGA | ✅ Pertanyaan utama terjawab | SIRAGA dikonfirmasi aktif, `stok.gs` ditandai legacy di kode (tidak diputus) |
| 7 | Integrasi SIPIKA | 🟨 Sebagian besar tercakup Tahap 4 | Pengelompokan sudah ada di `NavigasiTerpusat.js`. Belum: baris RBAC eksplisit di `34_KONFIGURASI_HAK_AKSES` khusus kelompok ini |
| 8 | Evaluasi & Pengembangan SIPANDU | ⬜ Sengaja ditunda | Database mayoritas kosong (14/20 sheet). Roadmap sendiri: prioritas belakangan. **Butuh jawaban Admin**: SIPANDU dipakai aktif di lapangan atau belum? |
| 9 | Integrasi SIPENDOK & SIPOGIM | 🟨 Audit selesai, integrasi sebagian | SIPENDOK terhubung Tahap 3. SIPOGIM perlu keputusan arsitektur akun-per-orang dulu |
| 10 | Pengujian & Peluncuran | ⬜ Belum relevan | Bergantung Tahap 5,8,9 yang masih berisi keputusan terbuka. Checklist dasar sudah ada di `PANDUAN_DEPLOY.md` |

---

## 6. PELAJARAN KRITIS — WAJIB DIPAHAMI SEBELUM LANJUT

**Pola masalah #1 — Fungsi duplikat**: 17 fungsi dibangun ulang (sesi lalu) tanpa sadar sudah ada di file lain, diam-diam MENIMPA versi asli (JS: fungsi dobel tidak error, yang dimuat belakangan menang). **Diperbaiki**.

**Pola masalah #2 — Fungsi tak terdaftar**: 130 aksi API dipanggil frontend tapi tidak terdaftar di router `Code.gs` — fungsinya lengkap, cuma tidak tersambung. **Diperbaiki**.

**Pola masalah #3 — Menebak struktur tanpa verifikasi** (2 insiden nyata, Tahap 4):
- Percobaan pertama: anchor link `#panel-relawan` (dgn tanda hubung) — **SALAH**, pola asli `data-panel="panelRelawan"` (camelCase). Ditemukan & diperbaiki SEBELUM dikirim final.
- Rencana awal: ganti SELURUH sidebar dgn tampilan baru — **nyaris merusak** tombol Keluar & Ciutkan Menu yang sudah tersambung terpisah di 23 halaman, dan sistem tab canggih `admin.html` (`<button data-panel>`, lazy-load). Desain dirombak jadi "perkaya elemen yang sudah ada" (lebih aman) SETELAH dicek langsung ke HTML asli.

**Prinsip wajib ke depan**: SELALU verifikasi struktur nyata (grep/cek langsung) SEBELUM menulis kode yang bergantung padanya. Kalau ragu, cek dulu — jangan asumsikan nama elemen/kolom/ID.

---

## 7. FILE/KODE YANG SUDAH DIBANGUN & TERUJI (Siap Deploy)

Paket terkini: **`PAKET_LENGKAP_TAHAP_2_SAMPAI_6.zip`** (40 file + panduan) — pakai ini, abaikan paket-paket sebelumnya.

**Portal Backend** (baru): `MigrasiSIMSDM.gs`, `AuthTerpusat.gs`
**Portal Backend** (ditimpa): `Code.gs`, `Relawan.gs`, `Akun.gs`, `ManajemenHakAkses.gs`, `stok.gs`
**SIPENDOK Backend** (baru, proyek terpisah): `VerifikasiTokenPortal.gs`
**Portal Frontend**: `NavigasiTerpusat.js` (baru) + `admin.js` + 23 halaman HTML relawan (semua ditimpa, sudah terintegrasi langsung — TIDAK perlu pasang manual)

Panduan deploy 3-langkah lengkap ada di `PANDUAN_DEPLOY.md` di dalam paket.

---

## 8. STANDAR DATABASE (Dari Master Instruction Khusus Database — Belum Diterapkan Penuh, Acuan utk Lanjutan)

Kategori sheet yang WAJIB dipakai saat audit/dokumentasi lanjutan: MASTER DATA, TRANSACTION DATA, TRANSACTION DETAIL, REFERENCE DATA, CONFIGURATION DATA, RECAPITULATION DATA, AUDIT LOG, HISTORY DATA, TEMPORARY DATA, SYSTEM DATA.

Status yang WAJIB dipakai per sheet: ACTIVE, INACTIVE, LEGACY, DUPLICATE, NEEDS REVIEW, ARCHIVE CANDIDATE.

Dokumen yang perlu disusun bertahap (belum semua dikerjakan): DATABASE_INVENTORY, MASTER_DATA_DICTIONARY, FUNCTIONAL_DEPENDENCY_ANALYSIS, NORMALIZATION_REPORT, ERD_PER_DATABASE — sejauh ini baru dikerjakan utk domain SIMSDM (Tahap 2, ada di tab "Fase B - Analisis SIMSDM" dokumen kerja).

---

## 9. PERTANYAAN TERBUKA (Perlu Keputusan Admin)

1. **Status pemakaian SIPANDU** sesungguhnya di lapangan — penentu apakah Tahap 8 layak dikerjakan sekarang.
2. **Lokasi kode SIPOGIM relatif ke GitHub** — apakah backend (.gs) sudah di-`clasp push` ke repo atau hanya hidup di Apps Script editor.
3. **`admin-audit.js`** (fitur Log Audit, frontend) — lengkap tapi tidak terintegrasi ke admin.html. Disambungkan atau ditunda?
4. **Panel stok.gs di UI** — tetap ditampilkan admin (akses legacy/riwayat) atau disembunyikan dari sidebar?

---

## 10. CARA MELANJUTKAN (Untuk Sesi/AI Berikutnya)

1. Baca dokumen ini SELURUHNYA dulu.
2. **JANGAN asumsikan struktur HTML/kode "pasti begini"** — selalu verifikasi dulu (lihat Bagian 6, pola masalah #3, sudah terjadi 2x).
3. Tahap 5 (audit mendalam SIKOP+SIPRES) dan jawaban Bagian 9 adalah titik lanjutan paling logis.
4. Proyek Apps Script Portal/SIPENDOK/SIPOGIM masing-masing punya Script ID sendiri — kalau butuh kode terbaru, export ulang (`script.google.com/feeds/download/export?id=<ID>&format=json`) utk pastikan kerja dari versi TERKINI.
5. Paket kode terkini: `PAKET_LENGKAP_TAHAP_2_SAMPAI_6.zip`. Dokumen kerja detail (Data Dictionary, ERD, dll): tab "Laporan Audit Database", "Audit Kode & Arsitektur", "Fase B - Analisis SIMSDM" di dokumen Claude yang menyertai sesi ini.

# Audit Menyeluruh & Rekomendasi Pengembangan — Portal SPPG Jeungjing

**Status:** Audit murni. **Tidak ada kode, data, konfigurasi, atau deployment yang diubah dalam penyusunan laporan ini.**
**Catatan metodologi:** Sebagian temuan di laporan ini berasal dari audit kode langsung sesi ini; sebagian lain (ditandai jelas) berasal dari pekerjaan implementasi yang SUDAH disetujui dan dikerjakan pada sesi-sesi sebelumnya — di bagian itu saya laporkan **kondisi SETELAH perbaikan**, bukan kondisi sebelum, karena itulah kondisi aktual kode saat ini.

---

## 1. Ringkasan Eksekutif

Portal SPPG Jeungjing adalah sistem multi-aplikasi berbasis Google Apps Script + Google Sheets, terdiri dari: Website Publik, Portal Pengelola, Portal Relawan (ketiganya satu repositori GitHub Pages + satu backend Apps Script bersama), ditambah **tiga aplikasi terpisah** dengan backend & database sendiri-sendiri (SIPENDOK, SIPOGIM, dan modul SIPANDU yang sebagian berjalan sebagai proyek Apps Script berbeda yang "menjembatani" data ke Portal utama).

**Kondisi keseluruhan: fungsional dan sudah melalui beberapa putaran perbaikan terarah.** Arsitekturnya konsisten (pola penamaan fungsi, struktur file, mekanisme otorisasi seragam di hampir semua modul). Sejumlah masalah signifikan yang ditemukan pada audit-audit sebelumnya **sudah diperbaiki dan terverifikasi lewat pemeriksaan kode ulang** pada sesi ini: proteksi penulisan bersamaan (LockService) pada modul Jadwal/Shift/Tarif, akses baca Staff pada Jadwal Individu, 1 ketidaksesuaian pasangan API, dan kebocoran pesan error teknis ke pengguna pada lapisan pusat.

**Risiko tertinggi yang MASIH terbuka**: cakupan LockService belum menyeluruh ke SEMUA modul tulis di luar yang sudah diperiksa (lihat §6), dan audit bahasa/UX baru menyentuh lapisan pusat, belum per-halaman (lihat §9).

**Rekomendasi umum**: lanjutkan Tahap 1 (stabilitas) yang sudah berjalan sampai benar-benar tuntas sebelum mengerjakan fitur besar baru — fondasinya sudah kuat, tinggal menuntaskan cakupannya.

---

## 2. Peta Arsitektur

```
┌─────────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│  Website Publik   │────▶│   Portal Pengelola    │     │  Portal Relawan    │
│  (GitHub Pages,   │     │   (admin.html+.js)    │     │  (dashboard.html+  │
│  statis)          │     │                        │     │  .js)              │
└─────────────────┘     └──────────┬────────────┘     └─────────┬──────────┘
                                     │                              │
                                     ▼                              ▼
                         ┌─────────────────────────────────────────────┐
                         │   Apps Script Backend (Code.gs + ~50 file)    │
                         │   doGet/doPost dispatcher, 1 Web App URL      │
                         └──────────────────┬────────────────────────────┘
                                             ▼
                         ┌─────────────────────────────────────────────┐
                         │   Google Sheets "DATABASE PORTAL SPPG"        │
                         │   (01_DATA_RELAWAN, 03_DATA_ABSENSI,          │
                         │   24_AUDIT_LOG, dst — puluhan sheet)          │
                         └─────────────────────────────────────────────┘

┌─────────────────┐     ┌──────────────────────┐
│     SIPENDOK      │     │       SIPOGIM          │   ← Proyek Apps Script TERPISAH,
│  (backend+        │     │   (backend+frontend    │     spreadsheet sendiri-sendiri.
│   frontend         │     │    sendiri)            │     Portal Pengelola memanggil
│   sendiri)         │     │                        │     via UrlFetchApp (SIPENDOK)
└─────────────────┘     └──────────────────────┘     atau murni tautan (SIPOGIM).

SIPANDU: campuran — sebagian fungsi ADA di backend Portal utama (SipanduAuth.gs dkk),
sebagian lain (role management) "menjembatani" lewat penulisan ke sheet Portal dari
proyek terpisah (lihat logAudit_ 'JEMBATAN_SIPANDU'). Arsitekturnya HYBRID, bukan
murni terpisah seperti SIPENDOK/SIPOGIM.
```

**Komponen eksternal yang DISEBUTKAN di scope (POP-BGN, SIPHR, Kurir MBG):** tidak ditemukan satu pun jejak kode (URL, nama fungsi, variabel) yang merujuk ke sistem-sistem ini di seluruh backend maupun frontend yang dapat saya akses. **Status: belum terverifikasi — kemungkinan proses manual di luar sistem ini, atau sistem yang benar-benar tidak terhubung secara teknis ke Portal.**

---

## 3. Inventaris Fitur (Ringkas — Lengkap di §4)

| Status | Jumlah Area | Contoh |
|---|---|---|
| ✅ Aktif & terverifikasi berjalan | Mayoritas modul inti | SIPRES (presensi, rekap), SIKOP (jadwal, shift), Pemeriksaan Jadwal Individu, Koreksi Presensi (terpadu) |
| 🟡 Parsial / sebagian fungsi | 2 area | Laporan SIPIKA (1 dari 5 kategori dibangun), Standardisasi bahasa (lapisan pusat saja) |
| ❌ Ditemukan non-fungsional sebelumnya, SUDAH diperbaiki | 1 | Panel "Laporan" (dulu form kosong tanpa fungsi — sekarang kategori Koreksi Presensi sudah nyata) |
| ⬜ Belum dapat diverifikasi | 3 | POP-BGN/SIPHR/Kurir MBG, cakupan penuh fitur offline di HP relawan, dokumentasi arsitektur formal |

---

## 4. Temuan Audit (Didukung Bukti)

### 4.1 Nama & Kepanjangan Modul

| Modul | Status | Sumber |
|---|---|---|
| SIRAGA | ✅ Terverifikasi | Tertulis eksplisit di panel: "Sistem Informasi Persediaan & Gudang" |
| SIPANDU | ✅ Terverifikasi | Tertulis eksplisit di panel: "Sistem Informasi Pengelolaan Data & Operasional SPPG" |
| SIPOGIM | ✅ Terverifikasi | Tertulis di `login.html` SIPOGIM sendiri: "Sistem Informasi Gizi & Menu" |
| SIMSDM, SIPRES, SIKOP, SIPIKA | 🟡 Usulan, bukan resmi | Tidak pernah dijabarkan di kode manapun — usulan disepakati sesi sebelumnya, belum ada sumber resmi tertulis |
| SIPENDOK | 🟡 Usulan | Sama seperti di atas |

### 4.2 Navigasi — Ditemukan & Sudah Diperbaiki

**Temuan asli (sebelum perbaikan)**: SIPENDOK dan SIPOGIM — dua aplikasi terpisah dengan backend sendiri — tercampur di dalam grup navigasi SIPIKA bersama Notifikasi/Informasi/Pengumuman/Dokumen, tanpa pembeda visual bahwa keduanya BUKAN bagian dari SIPIKA.

**Status sekarang**: dipisah ke grup "Aplikasi Terhubung" tersendiri. Deskripsi singkat ditambahkan di bawah 6 modul yang kepanjangannya terverifikasi/disepakati, di kedua portal.

**Yang BELUM diverifikasi ulang**: konsistensi navigasi ini terhadap perubahan-perubahan BARU yang ditambahkan setelahnya (Pemeriksaan Jadwal Individu, Laporan, QR Kios) — apakah penempatannya masih logis sekarang bahwa jumlah item di SIKOP bertambah. Perlu audit visual langsung di browser, bukan cuma baca kode.

### 4.3 Panel "Laporan" (SIPIKA)

**Temuan asli**: form dengan dropdown, filter tanggal, tombol "Tampilkan" dan "Export Data" — **tidak ada satu pun `addEventListener` tersambung**. Selamanya menampilkan "Belum ada data laporan".

**Status sekarang**: kategori **Koreksi Presensi** sudah fungsional — membaca `24_AUDIT_LOG` (sheet yang SUDAH lama mencatat setiap koreksi lewat `logAudit_()`, tapi sebelumnya **tidak pernah ada layar untuk membacanya**), difilter ke 6 jenis aksi koreksi presensi, dengan ekspor CSV.

**Yang masih kosong**: 4 kategori lain (Laporan Relawan, Laporan Jadwal & Penugasan ringkas, Laporan Operasional/Stok) — belum dibangun. Keputusan sebelumnya: Laporan Presensi & Laporan Jadwal TIDAK dibangun karena berpotensi tumpang tindih dengan Rekap Harian/Rekap Per Periode dan Pemeriksaan Jadwal Individu yang sudah ada — **ini keputusan desain yang perlu Anda konfirmasi ulang**, bukan sekadar belum sempat dikerjakan.

### 4.4 Koreksi Tanggal + Koreksi Absen

**Temuan asli**: dua implementasi backend terpisah (`koreksiTanggalOperasionalAbsensi`/`tandaiHadirManual` di `Shift.gs` — lama; `koreksiAbsensiAktual` di `JadwalIndividu.gs` — baru), dua panel UI berbeda, berpotensi membingungkan Admin soal mana yang dipakai untuk kasus apa.

**Status sekarang**: disatukan secara PENGALAMAN PENGGUNA — satu panel (Pemeriksaan Jadwal Individu) dengan aksi lengkap per kondisi baris (Buat/Edit/Tandai Hadir/Pindah Tanggal/Koreksi Absen/Hapus). **Backend TIDAK digabung jadi satu fungsi** — fungsi lama dipertahankan apa adanya dan dipanggil lewat pembungkus tipis, sesuai prinsip "jangan hapus sebelum ketergantungan diperiksa". Subtab lama ("Koreksi Tanggal" di panel Shift) disembunyikan dari alur normal (diganti tombol pengalih ke lokasi baru), kodenya tidak dihapus.

### 4.5 QR Kios

**Temuan**: `absensi-qr.html` adalah halaman presensi QR yang SUDAH berjalan (bagian dari repositori GitHub Pages yang sama, bukan aplikasi terpisah), **tanpa login** (memang dirancang untuk dipasang di titik distribusi, discan oleh kartu relawan). **Tidak ditemukan mekanisme "QR untuk login otomatis ke Portal"** di kode manapun — hanya ada QR presensi.

**Status sekarang**: ditambahkan tombol pintasan langsung dari panel Kartu QR (SIPRES) di Portal Pengelola — membuka halaman yang SAMA (bukan aplikasi baru) di tab baru. Penamaan sengaja dibedakan ("Kios Presensi QR") dari istilah "akses portal" untuk menghindari kerancuan yang diwanti-wanti.

---

## 5. Temuan Keamanan & Integritas Data

### 5.1 Otorisasi (`requireAuth`)

**Terverifikasi**: `requireAuth(token, izinkanStaff)` — bukan sekadar cek token valid, tapi JUGA menegakkan role (Staff diblokir dari fungsi tulis kecuali `izinkanStaff=true` eksplisit diberikan) **di level server**, bukan cuma menyembunyikan tombol di UI. Ini pola yang konsisten dipakai di hampir seluruh backend.

**Temuan spesifik (sudah diperbaiki)**: Fungsi BACA pada `JadwalIndividu.gs` (`getJadwalIndividuRelawan`, `getDaftarRelawanUntukJadwalIndividu`) awalnya memanggil `requireAuth(token)` TANPA parameter kedua — secara tidak sengaja memblokir Staff bahkan dari MELIHAT data, bertentangan dengan kebijakan "Staff = akses lihat, bukan tulis" yang berlaku di modul lain. **Sudah diperbaiki** (parameter `true` ditambahkan di 2 fungsi baca; fungsi tulis sengaja dibiarkan tanpa parameter itu, tetap Admin-only).

**Belum diverifikasi ulang secara sistematis**: apakah pola yang SAMA (lupa `izinkanStaff` pada fungsi baca) ada di modul-modul LAIN yang belum saya audit kembali pada sesi ini (SIRAGA, SIPANDU, Dokumen, dll). Temuan di atas ditemukan KARENA kebetulan sedang mengerjakan modul itu — bukan dari sapuan sistematis ke semua endpoint.

### 5.2 LockService (Penulisan Bersamaan)

**Temuan asli**: dari seluruh backend (~50 file), hanya `AbsensiQr.gs` dan `AbsensiV2.gs` yang memakai `LockService`. `Shift.gs` (25 operasi tulis: Shift Divisi, Penugasan Khusus, Koreksi Tanggal, Tandai Hadir Manual, Hapus Absensi) dan `MasterTarif.gs` (update tarif, salin tarif antar-periode) — **nol proteksi**.

**Status sekarang**: `LockService` (pola `tryLock(10000)` + `try/finally`) sudah ditambahkan ke **8 fungsi tulis** di `Shift.gs`, **2 fungsi** di `MasterTarif.gs`, dan **3 fungsi** di `JadwalIndividu.gs` (modul baru) — total 13 fungsi. Diverifikasi lewat pembacaan kode (bukan pengujian beban sungguhan dengan banyak pengguna bersamaan — itu di luar kemampuan audit kode statis).

**Yang BELUM diperiksa**: modul penulisan lain di luar yang disebutkan di atas — `Akun.gs`, `Role.gs`, `PengajuanKetidakhadiran.gs`, seluruh modul SIRAGA (`SiragaStok.gs`, `SiragaOpname.gs`, dll), `WebsitePublik.gs`, `PenerimaManfaat.gs`, dan seluruh backend SIPANDU/SIPENDOK/SIPOGIM — **belum ada pemetaan serupa ke modul-modul ini**. Mengingat SIRAGA mencatat transaksi stok yang menurut deskripsi proyek "sangat sering" terjadi, ini kandidat kuat untuk diperiksa berikutnya.

### 5.3 Kebocoran Pesan Teknis ke Pengguna

**Temuan**: dispatcher utama backend (`catch (err) { return gagal(err.message...) }`) meneruskan pesan `err.message` APA ADANYA ke pengguna untuk SEMUA jenis galat — termasuk galat JavaScript mentah yang tidak disengaja (`TypeError: Cannot read properties of undefined...`), bukan hanya pesan validasi yang sengaja ditulis ramah.

Di lapisan frontend (`common.js`), ditemukan pula 4 pesan error yang menyisipkan **cuplikan respons mentah server** langsung ke tampilan pengguna (`Cuplikan: "..."`).

**Status sekarang**: ditambahkan satu fungsi penyaring terpusat (`pesanAmanUntukPengguna_`) di dispatcher utama — mendeteksi pola galat teknis mentah via regex dan menggantinya dengan pesan ramah, SAMBIL tetap mencatat pesan asli ke `Logger` untuk diagnosis developer. Diuji dengan 8 contoh pesan (4 ramah, 4 teknis) — seluruhnya diklasifikasi benar. 4 kebocoran cuplikan di `common.js` dihapus dari pesan pengguna (tetap tercatat via `logDebug_`).

**PENTING — batas temuan ini**: perbaikan ini HANYA di lapisan terpusat (1 fungsi di backend, 1 file bersama di frontend). **Belum ada audit per-halaman** terhadap 98 file frontend untuk istilah teknis lain yang mungkin muncul langsung di kode masing-masing halaman (bukan lewat lapisan pusat) — sesuai §9 di bawah.

### 5.4 Validasi Input Sisi Server

**Terverifikasi secara sampling** (bukan 100% file): fungsi-fungsi yang diperiksa langsung (Jadwal Individu, Shift, Master Tarif) SEMUA melakukan validasi di SISI SERVER (format jam, field wajib, rentang nilai) — bukan cuma mengandalkan validasi HTML di frontend. Pola ini konsisten di modul-modul yang diperiksa.

**Belum diverifikasi**: cakupan ini ke SELURUH endpoint tulis di 50 file backend — audit ini baru menyentuh modul yang menjadi fokus pengembangan terkini.

---

## 6. Temuan UX & Navigasi

Lihat §4.2–4.5 di atas untuk temuan spesifik yang sudah ditindaklanjuti.

**Belum diperiksa pada audit ini**: pengalaman pengguna detail per-halaman (formulir yang membingungkan, tabel sulit dipakai di ponsel, indikator loading yang tidak jelas, dll) sesuai cakupan §4B/§4C/§9 pada prompt Anda — audit sebelumnya baru menyentuh STRUKTUR navigasi, belum PERILAKU/kejelasan tiap komponen individual.

---

## 7. Temuan Performa & Stabilitas

**Dashboard Kehadiran (ditemukan masalah serius pada audit performa sebelumnya, SUDAH diperbaiki)**:

Temuan asli: `initDashboard()` menunggu 12 sumber data via `Promise.allSettled` dan baru merender SEMUANYA setelah SELURUHNYA selesai — Kehadiran (prioritas tertinggi menurut spesifikasi proyek sendiri) ikut tertahan Rekap Per Periode (yang berpotensi paling berat). Backend `getDashboardPengelola` menggabungkan 6 komputasi tak berkaitan jadi satu response/satu eksekusi.

**Status terverifikasi sekarang (dicek ulang langsung di kode, BUKAN sekadar menerima klaim)**: frontend SEKARANG merender tiap sumber SEGERA saat resolve masing-masing (bukan menunggu batch), backend SUDAH dipecah (`getDashboardPengelolaRingan` — ringan, terpisah dari `getRekapDuaMingguDashboard`). **Ini perbaikan yang SUDAH ada sebelum sesi-sesi terkini — bukan klaim tanpa bukti, saya baca langsung kodenya.**

**Catatan penting soal metodologi**: Temuan performa di atas murni dari **analisis kode** (pola async/await, struktur fungsi) — BUKAN dari pengukuran waktu muat sungguhan di browser/jaringan nyata. Saya tidak memiliki akses untuk mengukur waktu muat aktual di kondisi jaringan pengguna sesungguhnya.

**API — Konsistensi `doGet`/`doPost`**: diaudit menyeluruh — 98 file frontend, 266 aksi terdaftar backend (88 di `doGet`, 178 di `doPost`), dicocokkan satu-satu secara terprogram. Ditemukan 1 ketidaksesuaian nyata (`siraga.js` — halaman Portal Relawan untuk Stok — memanggil `getDaftarPetugasStok` lewat POST padahal hanya terdaftar di `doGet`; identik dengan bug yang sudah diperbaiki sebelumnya di `admin-stok.js` sisi Pengelola, tapi tidak pernah ikut diperbaiki di sisi Relawan). **Sudah diperbaiki.**

**Versi Cache Aset**: ditemukan 1 kasus konkret — isi `admin.js` berubah berkali-kali namun referensinya sendiri di `admin.html` (`<script src="admin.js?v=...">`) sempat tidak ikut dinaikkan, berisiko pengguna tetap memuat versi lama dari cache browser. **Sudah diperbaiki untuk kasus ini.** **Belum ada audit sistematis ke SELURUH pasangan file+referensi di semua halaman** — temuan ini berasal dari kebetulan sedang mengerjakan file itu, bukan sapuan menyeluruh.

---

## 8. Daftar Rekomendasi Prioritas

### P0 — Kritis
*Tidak ditemukan bukti kondisi P0 (kehilangan data, akses tidak sah yang terbukti) pada audit ini.*

### P1 — Tinggi

**R1 — Perluas cakupan LockService ke modul penulisan yang belum diperiksa**
- **Masalah**: SIRAGA, Akun, Role, Pengajuan Ketidakhadiran, WebsitePublik, dan backend SIPANDU/SIPENDOK/SIPOGIM belum dipetakan untuk proteksi penulisan bersamaan — pola yang SAMA dengan yang terbukti berisiko di Shift.gs/MasterTarif.gs sebelum diperbaiki.
- **Bukti**: Tidak ditemukan `LockService` di file-file tersebut (pencarian `grep` langsung).
- **Solusi**: Petakan seluruh fungsi tulis per modul (pola yang sama persis dipakai utk Shift.gs/MasterTarif.gs), tambahkan proteksi ke yang benar-benar berisiko ditulis bersamaan (bukan sekadar menambah ke semua fungsi tanpa pertimbangan).
- **Kompleksitas**: Sedang. **Cakupan**: Sedang–Besar (banyak file, pola berulang per file).
- **Kriteria berhasil**: Setiap fungsi tulis pada sheet yang berpotensi diakses >1 pengguna bersamaan terbungkus `LockService`, diverifikasi tanpa merusak perilaku fungsi yang ada.

**R2 — Audit otorisasi `requireAuth(token, true)` secara sistematis ke seluruh endpoint baca**
- **Masalah**: Pola "lupa mengizinkan Staff membaca" terbukti pernah terjadi (Jadwal Individu) — ditemukan secara kebetulan, bukan sapuan sistematis.
- **Solusi**: Daftar SEMUA fungsi `requireAuth()` di backend, verifikasi satu-satu apakah fungsi itu seharusnya Admin-only atau boleh dibaca Staff, sesuai kebijakan akses yang berlaku.
- **Kompleksitas**: Rendah per-fungsi, tapi jumlahnya besar (puluhan pemanggilan).

### P2 — Sedang

**R3 — Audit bahasa/UX per-halaman (bukan cuma lapisan pusat)**
- **Masalah**: Perbaikan bahasa baru di 2 titik terpusat (`common.js`, dispatcher backend) — 96+ file frontend individual belum diperiksa untuk istilah teknis yang ditulis LANGSUNG di kode halaman masing-masing (bukan lewat lapisan bersama).
- **Solusi**: Audit bertahap per-modul (bisa dimulai dari halaman yang paling sering dipakai relawan/admin), mencari pola serupa (`undefined`, pesan Inggris, `JSON.stringify` yg ditampilkan ke user, dll).
- **Kompleksitas**: Rendah per-halaman, **cakupan besar** (banyak halaman).

**R4 — Keputusan eksplisit soal 4 kategori Laporan SIPIKA yang belum dibangun**
- **Masalah**: Laporan Presensi/Jadwal sengaja TIDAK dibangun krn dinilai tumpang tindih dgn fitur lain — ini keputusan sepihak saya yang perlu dikonfirmasi, bukan diasumsikan benar.
- **Solusi**: Anda memutuskan: setuju ditunda (dan Laporan tetap menampilkan status jujur bahwa kategori itu "belum tersedia", BUKAN form kosong seperti sebelumnya — ini SUDAH berjalan: hanya kategori yg nyata yg ditampilkan sbg pilihan), atau minta dibangun juga dengan sudut pandang yang beda dari fitur existing.

### P3 — Rendah

**R5 — Dokumentasi arsitektur formal**
- `RINGKASAN_PORTAL_SPPG_JEUNGJING.md` yang ada **sudah usang** (belum menyebut SIPOGIM, Pemeriksaan Jadwal Individu, Laporan Koreksi Presensi, dll — fitur-fitur yang justru paling baru dikerjakan). Perlu diperbarui atau dibuat ulang, idealnya dari skema data otomatis supaya tidak usang lagi.

---

## 9. Rekomendasi Fitur Baru

*Tidak ada fitur baru besar yang direkomendasikan pada audit ini* — sesuai instruksi Anda untuk fokus pada stabilitas dulu, dan karena belum ada kebutuhan operasional baru yang teridentifikasi dari audit yang BELUM terjawab oleh fitur yang sudah dibangun (Pemeriksaan Jadwal Individu + Koreksi Presensi Terpadu + Laporan Koreksi Presensi mencakup kebutuhan inti yang sebelumnya kosong).

---

## 10. Roadmap

**Tahap 1 — Stabilitas & Keamanan (SEBAGIAN SUDAH BERJALAN)**
R1 (perluas LockService) dan R2 (audit otorisasi baca) — melanjutkan pola yang sama yang sudah terbukti berhasil di modul Jadwal/Shift/Tarif. Dependensi: tidak ada, bisa langsung dikerjakan per-modul.

**Tahap 2 — Penyempurnaan Operasional**
R4 (keputusan Laporan) — perlu arahan Anda dulu sebelum dikerjakan.

**Tahap 3 — Pengalaman Pengguna & Dokumentasi**
R3 (bahasa per-halaman), R5 (dokumentasi). Bisa berjalan paralel dengan Tahap 1/2 karena tidak saling bergantung.

**Tahap 4 — Pengembangan Lanjutan**
Belum ada item teridentifikasi — akan muncul dari kebutuhan operasional nyata setelah Tahap 1-3, bukan ditentukan di muka.

---

## 11. Dependensi & Risiko

- R1 (LockService ke SIRAGA) berisiko REGRESI kalau tidak hati-hati — SIRAGA mencatat transaksi "sangat sering" (disebut eksplisit di brief proyek), penguncian yang terlalu agresif bisa memperlambat/menggagalkan transaksi sah, bukan cuma mencegah tabrakan. Perlu uji konkurensi, bukan cuma baca kode.
- R2 (audit requireAuth) berisiko men-downgrade akses yang SEHARUSNYA Admin-only kalau salah menilai kebijakan per-fungsi — perlu konfirmasi kebijakan akses per-modul sebelum mengubah, bukan asumsi.

---

## 12. Hal yang Belum Dapat Diverifikasi

- **POP-BGN, SIPHR, Kurir MBG** — nihil bukti kode, tidak bisa dipastikan integrasi/tidaknya tanpa info tambahan dari Anda.
- **Performa aktual di jaringan/perangkat pengguna sungguhan** — semua temuan performa berbasis analisis kode statis, bukan pengukuran langsung.
- **Cakupan fitur offline di presensi HP relawan** (beda dari kios QR yang terverifikasi punya antrean offline solid) — belum diperiksa terpisah.
- **Dokumentasi yang benar-benar dibutuhkan developer berikutnya** — belum ada gambaran dari sisi "siapa yang akan maintain ini ke depan" untuk menentukan kedalaman dokumentasi yang pas.

---

## 13. Rencana Pengujian (Untuk Rekomendasi di Atas, Bila Dikerjakan)

- **R1**: uji dengan 2 sesi Admin berbeda mencoba menulis ke sheet yang sama (mis. 2 tab browser) hampir bersamaan — pastikan salah satu tertunda rapi (pesan "sistem sedang sibuk"), bukan data korup/tertimpa diam-diam.
- **R2**: untuk tiap fungsi yang diubah, uji login sebagai Staff DAN sebagai Admin — pastikan Staff bisa baca tapi tetap diblokir dari aksi yang BUKAN haknya.
- **R3**: skenario sengaja memicu tiap jenis galat umum (jaringan putus, sesi habis, input salah) per halaman, pastikan pesannya sesuai §9 brief Anda — bukan cuma 1 kalimat generik untuk semua kasus.

---

## 14. Keputusan yang Diperlukan Dari Anda

1. **Laporan SIPIKA**: setuju 4 kategori lain tetap ditunda (dengan status jujur, bukan form kosong), atau minta salah satu dibangun dengan sudut pandang berbeda dari fitur yang sudah ada?
2. **Urutan R1 vs R2**: mana yang mau didahulukan — perluasan LockService (lebih berisiko, lebih krusial) atau audit otorisasi baca (lebih ringan, lebih cepat selesai)?
3. **POP-BGN/SIPHR/Kurir MBG**: apakah integrasi ini memang pernah direncanakan secara teknis, atau murni proses manual di luar sistem — supaya saya tidak terus menandainya "belum terverifikasi" tanpa kepastian?

---

### Tabel Ringkas: Jenis Temuan

| Jenis | Jumlah pada laporan ini |
|---|---|
| Temuan terbukti (dengan bukti kode langsung) | §4, §5, §7 — mayoritas isi laporan |
| Temuan perlu verifikasi lanjut | §12 (4 item) |
| Rekomendasi perbaikan (bukan fitur baru) | R1, R2, R3, R5 |
| Usulan fitur baru | Tidak ada pada audit ini |

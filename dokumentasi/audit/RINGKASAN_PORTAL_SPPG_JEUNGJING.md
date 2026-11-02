# Ringkasan & Dokumentasi Teknis — Portal SPPG Jeungjing

_Diperbarui: berdasarkan implementasi aktual per rilis gabungan P1+P2+P3 (Oktober 2026)._
_Setiap bagian menandai dengan jelas: **✅ Terverifikasi** (dibaca langsung dari kode), **🟡 Sebagian** (dicek sampel, bukan menyeluruh), atau **⬜ Belum terverifikasi**. Tidak ada struktur/endpoint yang dikarang di dokumen ini — bagian yang belum sempat dicek menyeluruh ditandai jujur, bukan ditebak._

Domain: `portal.sppgjeungjing.my.id` — GitHub Pages (frontend) + Google Apps Script (backend) + Google Spreadsheet (database).

---

## 1. Arsitektur & Daftar Modul ✅

```
Website Publik (tanpa login)
        │
        ▼
   Gerbang Portal ──┬──> Portal Relawan (login relawan — token terpisah)
                     └──> Portal Pengelola (login admin/staff)

   + Kios Presensi QR (absensi-qr.html, tanpa login, dipasang di titik distribusi)
   + SIPENDOK (proyek Apps Script TERPISAH, backend+spreadsheet sendiri, ditautkan)
   + SIPOGIM (proyek Apps Script TERPISAH, backend+spreadsheet sendiri, ditautkan)
   + SIPANDU (HYBRID — sebagian fungsi di backend Portal utama, sebagian "menjembatani"
     tulis ke sheet Portal dari mekanisme terpisah)
```

Semua Portal Pengelola, Portal Relawan, dan Kios QR berbagi **satu** backend Apps Script (`Code.gs` + ~55 file `.gs`) dan **satu** Google Spreadsheet ("DATABASE PORTAL SPPG"). SIPENDOK dan SIPOGIM masing-masing proyek Apps Script + spreadsheet sendiri.

### Daftar Modul Terverifikasi

| Modul | Kepanjangan | Status Verifikasi |
|---|---|---|
| SIRAGA | Sistem Informasi Persediaan & Gudang | ✅ Tertulis eksplisit di kode |
| SIPANDU | Sistem Informasi Pengelolaan Data & Operasional SPPG | ✅ Tertulis eksplisit di kode |
| SIPOGIM | Sistem Informasi Gizi & Menu | ✅ Tertulis eksplisit di `login.html` SIPOGIM |
| SIMSDM, SIPRES, SIKOP, SIPIKA, SIPENDOK | — | 🟡 Usulan disepakati, belum ada sumber resmi tertulis di kode |

---

## 2. Peran & Matriks Otorisasi

### 2.1 Mekanisme Otorisasi — **8 pola berbeda ditemukan** ✅

Proyek ini TIDAK memakai satu fungsi otorisasi tunggal. Developer berikutnya WAJIB tahu ini sebelum menilai suatu fungsi "tidak terlindungi" — cek dulu apakah fungsi dilindungi lewat salah satu pola ini, langsung di badan fungsi ATAU di dispatcher (`Code.gs`) tepat sebelum fungsi dipanggil:

| Fungsi | Dipakai Untuk |
|---|---|
| `requireAuth(token, izinkanStaff)` | Admin/Staff Portal Pengelola. `izinkanStaff=true` → Staff boleh baca; tanpa itu → Admin-only |
| `requireAuthRelawan(token)` | Sesi Relawan, Portal Relawan |
| `requireRole_(token, [daftarRole])` | Role spesifik (ASN, Kepala SPPG) |
| `requireSiragaAccess_(token, aksiTulis)` | SIRAGA — baca vs tulis dibedakan |
| `requireSiragaAdmin_(token)` | SIRAGA — khusus Admin |
| `requireStokAccess_` / `requireStokAdmin_` | Pola lama SIRAGA (2-role: Admin/Petugas Stok), dipertahankan sebelum migrasi ke role global |
| `requireSipanduPermission_(token, true/false)` | SIPANDU |

**Peringatan metodologi** (ditemukan sendiri selama audit sesi ini): pemeriksaan OTOMATIS murni (regex/script) TERBUKTI bisa salah — kurung bersarang membuat pencarian "requireAuth di dalam fungsi" salah potong badan fungsi, sempat menghasilkan 9 positif-palsu sebelum diverifikasi manual satu-satu. **Jangan percaya hasil pencarian otomatis tanpa verifikasi manual** untuk keputusan keamanan.

### 2.2 Peran

| Peran | Login | Bisa Apa |
|---|---|---|
| **Admin** | Portal Pengelola | Akses penuh |
| **Staff** | Portal Pengelola | Sama seperti Admin tapi **hanya lihat** — diblokir di level SERVER (bukan cuma UI) dari fungsi tulis |
| **Relawan biasa** | Portal Relawan | Presensi, jadwal, pengajuan izin milik sendiri |
| **Relawan + Petugas Stok** | Portal Relawan | + transaksi SIRAGA |
| **Relawan + ASN/Kepala SPPG** | Portal Relawan | Klasifikasi tambahan laporan/pengawasan |
| **Petugas Kios QR** | Tanpa login | Hanya scan Masuk/Pulang |

### 2.3 Temuan Keamanan P1 (Diperbaiki Rilis Ini) ✅

4 aksi baca (`getDivisi`, `getRelawan`, `getAbsensi`, `getRekapBulanan`) sebelumnya **tanpa otorisasi sama sekali** di `Code.gs` — termasuk `getRelawan` yang mengembalikan `nomorRekening` (nomor rekening bank). Sudah diperbaiki: `requireAuth(token, true)` ditambahkan ke keempatnya. Field TIDAK dipotong (tetap sesuai kebutuhan panel "Kelola Relawan" yang sah) — perbaikannya di gerbang otorisasi, bukan di memotong data.

**Audit lanjutan ke SELURUH endpoint** (bukan cuma 4 ini) masih 🟡 sebagian — lihat §12.

---

## 3. Struktur Sheet — 🟡 Sebagian Terverifikasi

Sheet yang **langsung diverifikasi** sesi ini (dibaca kolomnya dari kode):

| Sheet | Fungsi | Kolom kunci yang terverifikasi |
|---|---|---|
| `07_AKUN_RELAWAN` | Akun login Relawan + ROLE | ID_RELAWAN, USERNAME, PASSWORD_HASH, SALT, STATUS_AKUN, ROLE |
| `24_AUDIT_LOG` | Log aktivitas terpusat | AKSI, MODUL, ID_TERKAIT, AKTOR, WAKTU, DETAIL (JSON) |
| `27_DATA_PENERIMAAN` (Website Publik) | Data penerimaan tampil di web publik | ID, KATEGORI, JUMLAH, KETERANGAN, AKTIF, URUTAN |
| Sheet Relawan (nama konstan `NAMA_SHEET.RELAWAN`) | Data pribadi relawan | ID_RELAWAN, NAMA_RELAWAN, DIVISI, STATUS, NOMOR_REKENING, NIK, dll |
| Roster V2 (`getRosterSheetV2_()`) | Jadwal + presensi harian | ID_ABSENSI, ID_RELAWAN, ID_OPERASIONAL, STATUS_KEHADIRAN, STATUS_MASUK, JAM_JADWAL_MASUK/PULANG, JAM_MASUK/PULANG (aktual) |
| Sheet Pengajuan Ketidakhadiran | Pengajuan izin/sakit/cuti | ID_PENGAJUAN, ID_RELAWAN, JENIS, STATUS, TANGGAL_MULAI/SELESAI |

**Sheet SIRAGA** (BARANG, KATEGORI, SUPPLIER, TRANSAKSI, STOCK_OPNAME, dll) — strukturnya ADA dan dipakai konsisten di kode, tapi kolom lengkapnya **belum didokumentasikan satu-satu di sini** (⬜).

**Sheet lain** (Shift/Penugasan Khusus, Master Tarif, Kalender Operasional, Periode, dll) — ADA dan berfungsi (terbukti dari seluruh pekerjaan Kelompok A/B sebelumnya), kolom lengkapnya juga ⬜ belum didokumentasikan di sini.

---

## 4. Daftar Endpoint & Kontrak API — 🟡 Sebagian

**Total 266 aksi terdaftar** di `Code.gs` (88 di `doGet`, 178 di `doPost`), diverifikasi dengan pencocokan otomatis terhadap seluruh 98+ file frontend — **0 ketidaksesuaian GET/POST tersisa** per audit sesi ini (1 bug ditemukan & diperbaiki: `siraga.js` memanggil `getDaftarPetugasStok` lewat POST padahal cuma terdaftar di GET).

**Sumber kebenaran untuk daftar lengkap endpoint**: `Code.gs`, fungsi `doGet(e)` dan `doPost(e)` — setiap `case` adalah satu aksi. Mendokumentasikan parameter+respons lengkap untuk 266 aksi di luar cakupan realistis dokumen ini; kalau dibutuhkan referensi API lengkap, itu pekerjaan terpisah yang cukup besar.

**Endpoint yang ditambah/diubah rilis ini** (didokumentasikan lengkap karena baru):
- `getLaporanKoreksiPresensi(body: {token, dari, sampai})` → filter 24_AUDIT_LOG ke 6 jenis aksi koreksi presensi
- `getLaporanRelawan(body: {token})` → ringkasan + daftar relawan
- `getLaporanJadwalPenugasan(body: {token, idPeriode, divisi?})` → tabel semua relawan 1 periode
- `tandaiHadirJadwalIndividu(body)` / `pindahTanggalJadwalIndividu(body)` → pembungkus tipis ke `tandaiHadirManual`/`koreksiTanggalOperasionalAbsensi` (Shift.gs)

---

## 5. Hubungan Antarmodul ✅

- **SIPRES ↔ SIKOP**: presensi (Roster V2) SELALU terhubung ke shift/penugasan — tidak ada presensi "lepas" dari jadwal.
- **SIRAGA**: sistem 2-role sendiri (Admin/Petugas Stok) masih berjalan paralel, BELUM dimigrasikan ke role global (ROLE kolom di 07_AKUN_RELAWAN) — ini genuine technical debt yang didokumentasikan, bukan bug.
- **Koreksi Presensi**: dulu 2 jalur terpisah (Koreksi Tanggal lama vs Koreksi Absen baru), **sudah disatukan secara pengalaman pengguna** (1 panel: Pemeriksaan Jadwal Individu) — backend TIDAK digabung, pembungkus tipis di atas fungsi lama yang sudah teruji.
- **Laporan SIPIKA**: 3 kategori aktif (Koreksi Presensi, Relawan, Jadwal & Penugasan). Laporan Presensi dan Laporan Operasional/Stok **sengaja tidak dibuat** — sudah terjawab Rekap Harian/Per Periode dan dasbor SIRAGA (`getSiragaDashboardV2`), membuat laporan terpisah akan duplikat tanpa nilai tambah.
- **SIPANDU, SIPENDOK, SIPOGIM**: masing-masing relatif independen dari modul inti SIPRES/SIKOP — kegagalan salah satu tidak menjatuhkan yang lain (arsitektur terpisah).

---

## 6. Backup & Pemulihan — ⬜ Belum Ada Prosedur Formal

Mekanisme yang TERSEDIA (bawaan platform, bukan dibangun khusus): Google Sheets **Version History** bawaan (File → Version history) mencatat setiap perubahan secara otomatis, bisa dipulihkan ke versi sebelumnya kapan saja oleh siapa pun yang punya akses Edit ke spreadsheet. Apps Script juga punya riwayat versi deployment sendiri (Deploy → Manage deployments).

**Belum ada**: jadwal backup terjadwal/eksternal, prosedur pemulihan tertulis langkah-demi-langkah, atau pengujian pemulihan yang pernah dilakukan. Ini murni mengandalkan fitur bawaan Google — cukup untuk recovery dari kesalahan manusia biasa, TIDAK setara dengan strategi backup terjadwal/offsite.

---

## 7. Konfigurasi Deployment

**Backend (Apps Script)**: Deploy → Manage deployments → New version, setiap kali `.gs` berubah. **Satu Web App URL** dipakai bersama oleh Portal Pengelola, Portal Relawan, dan Kios QR.

**Frontend (GitHub Pages)**: commit & push ke repository — otomatis live dalam beberapa menit, tidak perlu langkah "deploy" terpisah.

**SIPENDOK, SIPOGIM**: proyek Apps Script TERPISAH, masing-masing dengan langkah Deploy sendiri — **tidak satu tombol untuk semuanya**, 3 siklus deploy independen kalau ketiganya berubah bersamaan.

Tidak ada kredensial/token/API key dicatat di dokumen ini (sesuai kebijakan).

---

## 8. Versioning Aset & Strategi Cache ✅

Setiap file `.js`/`.css` dirujuk dengan `?v=YYYYMMDDx` di tag `<script>`/`<link>` pemanggilnya. **ATURAN WAJIB bagi siapa pun yang mengedit file bersama** (`common.js`, `admin.js`, dll): setiap kali ISI file berubah, SEMUA halaman yang merujuknya harus ikut dinaikkan nomor versinya — termasuk referensi file ITU SENDIRI di tag `<script>`-nya.

**Ditemukan 2 kali dalam proyek ini** bahwa aturan ini terlewat (admin.js, lalu common.js) — isi berubah, versi lupa dinaikkan, berisiko pengguna tetap memuat kode lama dari cache browser. Service worker (`service-worker.js`, dipakai Kios QR terutama) memakai strategi *stale-while-revalidate* dengan kunci cache PER-URL LENGKAP termasuk `?v=` — artinya menaikkan versi string SELALU efektif memaksa ambil kode baru, tidak perlu menyentuh `CACHE_NAME` service worker itu sendiri untuk perubahan per-file.

---

## 9. Langkah Pengujian Sebelum Rilis

**Yang BISA dan SUDAH dilakukan** untuk setiap perubahan kode sesi ini: verifikasi sintaks (`node --check`) per file, verifikasi keseimbangan tag HTML, pencocokan pasangan GET/POST otomatis ke seluruh frontend, verifikasi manual jalur pemanggil (caller) sebelum mengubah fungsi yang dipakai di banyak tempat, pengujian logika deteksi (regex galat teknis) dengan kasus uji nyata.

**Yang TIDAK bisa dilakukan di lingkungan ini** (keterbatasan nyata, bukan diabaikan): menjalankan kode Apps Script sungguhan, mengakses Spreadsheet produksi, menguji konkurensi sungguhan dengan banyak pengguna simultan, mengukur waktu muat aktual di jaringan nyata. Semua temuan performa/konkurensi di seluruh dokumentasi proyek ini adalah hasil **analisis kode statis**, bukan hasil pengujian langsung.

---

## 10. Prosedur Deployment & Rollback

**Deployment** (urutan yang aman untuk rilis gabungan P1+P2+P3):
1. Backend Apps Script Portal (`Code.gs` + seluruh `.gs` yang berubah) → Deploy → New version.
2. Frontend GitHub Pages (`admin.html`, `admin.js`, `admin-laporan.js`, `common.js`, dll) → commit & push.
3. Verifikasi login Admin & Relawan berhasil, buka 1-2 panel yang berubah, cek tidak ada error di console browser.

**Rollback** jika bermasalah:
- Backend: Apps Script → Deploy → Manage deployments → pilih versi sebelumnya, set sebagai aktif.
- Frontend: `git revert` komit terakhir, push ulang.
- Keduanya INDEPENDEN — rollback backend tidak otomatis rollback frontend dan sebaliknya; kalau API berubah bentuk, rollback satu sisi saja bisa memperparah, bukan memperbaiki.

---

## 11. Status Integrasi Eksternal — ⬜ Belum Terverifikasi

**POP-BGN, SIPHR, Kurir MBG** — diperiksa berulang kali di seluruh sesi audit (pencarian string ke seluruh backend+frontend) — **nihil jejak kode**. Status tetap belum terverifikasi: tidak bisa dipastikan apakah integrasi pernah direncanakan secara teknis atau murni proses manual di luar sistem, tanpa informasi tambahan dari pemilik proyek.

---

## 12. Batasan & Pekerjaan Belum Selesai (Jujur, Bukan Disembunyikan)

- **LockService**: Portal utama + SIRAGA penuh terlindungi untuk modul yang diaudit (Akun, Role, Pengajuan Ketidakhadiran, Website Publik, Penerima Manfaat, seluruh SIRAGA). **SIPENDOK, SIPOGIM** TIDAK disentuh sesi ini — ambiguitas provenans paket source ditemukan saat audit, 2 fungsi tulis yang ada dinilai risiko rendah (migrasi skema sekali-jalan, update pengaturan jarang).
- **Audit otorisasi**: baru 4 aksi (getDivisi/getRelawan/getAbsensi/getRekapBulanan) yang diverifikasi PENUH dan diperbaiki. Inventarisasi SISTEMATIS ke SELURUH 266 aksi belum dilakukan.
- **Bahasa/UX per halaman**: perbaikan baru di 2 lapisan TERPUSAT (`common.js`, dispatcher backend). 96+ file individual belum diperiksa satu-satu untuk istilah teknis yang ditulis LANGSUNG di masing-masing halaman.
- **Struktur sheet & endpoint**: terdokumentasi untuk yang langsung dikerjakan sesi ini, BELUM untuk seluruh ~30+ sheet dan 266 endpoint.
- **Pengujian runtime nyata**: belum pernah, murni analisis kode statis sepanjang seluruh proyek ini (lihat §9).

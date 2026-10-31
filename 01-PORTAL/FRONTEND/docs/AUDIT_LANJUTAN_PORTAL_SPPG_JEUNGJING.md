# Audit Lanjutan — Portal SPPG Jeungjing

**Status:** Audit murni. Tidak ada kode, data, konfigurasi, atau deployment yang diubah dalam penyusunan laporan ini — termasuk temuan tentang pekerjaan saya sendiri di sesi sebelumnya.

---

## 1. Ringkasan Hasil Audit

Audit lanjutan ini memverifikasi ulang kondisi kode TERBARU (bukan mengandalkan laporan sebelumnya) dengan metode terprogram (pencocokan pola di seluruh file, bukan sampel). Ditemukan **1 celah keamanan nyata dan cukup serius** (data rekening bank terekspos tanpa otorisasi), **1 kesalahan metodologi di audit saya sendiri** (regex gagal menangani kurung bersarang, sempat memberi 8+ positif palsu sebelum diverifikasi manual), dan **1 temuan baru tentang pekerjaan saya sendiri** (perbaikan `common.js` sesi lalu berisiko belum sampai ke pengguna karena versi cache tidak dinaikkan).

---

## 2. File & Komponen yang Benar-Benar Diperiksa

- **52 file backend** (`.gs`) — seluruh isi Portal Pengelola/Relawan utama, termasuk SIRAGA (5 file), SIPANDU (auth+hak akses), tidak termasuk backend SIPENDOK/SIPOGIM secara langsung di pemeriksaan pola ini (diperiksa terpisah, lihat §4).
- **99 file frontend** (`.js`/`.html`).
- Backend SIPENDOK (17 file) dan SIPOGIM (17 file) — diperiksa HANYA untuk cakupan LockService, tidak untuk otorisasi mendalam (di luar cakupan permintaan Anda kali ini).

**Metode**: pencocokan pola terprogram (regex/Python) di seluruh file sekaligus, BUKAN sampel manual. Setiap temuan yang terlihat mencurigakan dari pencocokan pola diverifikasi ULANG secara manual (baca kode lengkapnya) sebelum dimasukkan ke laporan — karena metode pencocokan pola TERBUKTI bisa salah (lihat §3, catatan metodologi).

---

## 3. Matriks Otorisasi — Catatan Metodologi Penting

Proyek ini memakai **8 fungsi pemeriksa otorisasi berbeda**, bukan cuma satu:
`requireAuth`, `requireAuthRelawan`, `requireRole_`, `requireSipanduPermission_`, `requireSiragaAccess_`, `requireSiragaAdmin_`, `requireStokAccess_`, `requireStokAdmin_` — tersebar di 3 pola penempatan: (a) dicek di dalam fungsi itu sendiri, (b) dicek inline di dispatcher (`Code.gs`) sebelum fungsi dipanggil, (c) didelegasikan ke fungsi lain yang baru mengecek di sana.

**Kombinasi 3 pola ini membuat pemeriksaan otomatis murni TIDAK CUKUP** — percobaan pertama saya (regex pencari fungsi+kurung penutup) salah memotong badan fungsi pada file dengan kurung bersarang kompleks (`SiragaStok.gs` khususnya), sempat keliru menandai **9 fungsi sebagai "tanpa otorisasi"** padahal SEMUANYA ternyata terlindungi (termasuk 5 fungsi transaksi stok SIRAGA — `siragaBarangMasuk/Keluar/Transfer/Pemusnahan`, `selesaikanSiragaTransaksi`). Saya perbaiki metodenya (baca per-baris dgn batas pasti, bukan kurung), verifikasi ulang manual, baru masuk ke tabel final di bawah.

### 3.1 Aksi yang TERKONFIRMASI Tanpa Otorisasi Sama Sekali (setelah verifikasi manual)

| Aksi/Fungsi | File | Data yang Terekspos | Dampak | Status |
|---|---|---|---|---|
| `getRelawanList` | Relawan.gs:115 | id, nama, divisi, status, **nomorRekening** | 🔴 **Tinggi — data rekening bank siapa pun bisa diakses tanpa login, lewat aksi `getRelawan`** | **Berpotensi bermasalah — perlu perbaikan** |
| `getRekapBulanan` | Absensi.gs:547 | Rekap presensi 1 bulan penuh seluruh relawan (memanggil `getRelawanList` di dalamnya, turut mewarisi masalah di atas) | 🟠 Sedang — data presensi personal | Berpotensi bermasalah |
| `getAbsensiList` | Absensi.gs:453 | Data presensi per tanggal/divisi/nama | 🟠 Sedang | Berpotensi bermasalah |
| `getDivisiList` | Relawan.gs:89 | Hanya nama divisi (referensi, bukan data personal) | 🟢 Rendah | Berpotensi bermasalah, tapi dampak minim |

**4 lainnya (`ajukanIzinSakit`, fungsi-fungsi "...Publik", QR Kios, login/logout)**: terverifikasi **sengaja publik** (fitur publik-by-design, atau fungsi mati pengganti fitur lama) — bukan temuan.

### 3.2 Pertanyaan Konfirmasi (Kebijakan, Bukan Teknis)

Sesuai instruksi Anda, berikut yang TIDAK saya putuskan sendiri:
- **Apakah `getRelawanList` MEMANG dipakai di halaman yang tidak memerlukan login** (misalnya untuk dropdown di suatu formulir publik)? Kalau tidak, ini wajib ditambahkan otorisasi secepatnya — bukan soal "sebaiknya", ini data rekening bank.
- Kalau YA dipakai di konteks publik, apakah field `nomorRekening` MEMANG perlu ikut terbawa di situ, atau itu kelebihan data yang tidak sengaja?

---

## 4. Matriks LockService (Modul yang Diminta)

| File | Operasi Tulis | LockService | Catatan |
|---|---|---|---|
| `Akun.gs` | 34 | **0** | Account relawan (buat akun, reset password, update profil/kontak) — risiko konflik RENDAH secara alami (1 admin mengelola 1 akun pada satu waktu umumnya), tapi tetap 0% tercakup |
| `Role.gs` | 1 | 0 | Volume rendah, risiko rendah |
| `PengajuanKetidakhadiran.gs` | 16 | 1 | Sebagian kecil tercakup |
| `SiragaStok.gs` | 6 | 2 | `selesaikanSiragaTransaksi` (transaksi yg benar2 mengubah stok) SUDAH terlindungi |
| `SiragaOpname.gs` | 6 | 1 | Sebagian tercakup |
| `SiragaMasterData.gs` | 20 | 3 | Sebagian tercakup |
| `SiragaBatch.gs`, `SiragaDb.gs` | 0–1 | 0 | Volume minim |
| `WebsitePublik.gs` | 26 | **0** | Menu harian publik, konten publik — **0% tercakup**, tapi diedit oleh Admin saja (bukan multi-relawan serentak), risiko konflik lebih rendah dari Shift/Tarif |
| `PenerimaManfaat.gs` | 17 | **0** | Sama — 0% tercakup |
| **SIPENDOK** (17 file terpisah) | — | 5 dari 17 file | Cakupan parsial, proyek terpisah |
| **SIPOGIM** (17 file terpisah) | — | Bahan.gs & Padanan.gs: penuh; Resep.gs: 5/6; Menu.gs (`catatSalin`): 0/1 | Hampir lengkap, 1 fungsi volume-rendah terlewat |

**Rekomendasi teknis** (bukan keputusan, murni evaluasi risiko): SIRAGA (transaksi stok "sangat sering" menurut deskripsi proyek Anda sendiri) dan Akun.gs (reset password/buat akun) adalah prioritas PALING masuk akal untuk diperluas duluan — WebsitePublik/PenerimaManfaat risikonya lebih rendah karena pola pemakaiannya (1 admin, jarang serentak), bukan berarti tidak perlu, tapi lebih rendah urgensinya.

---

## 5. Temuan Bahasa & UX — **Temuan Baru Tentang Pekerjaan Saya Sendiri**

**Penting**: saat memverifikasi cache (§6), saya temukan bahwa perbaikan bahasa yang saya kerjakan sesi lalu (menghapus 4 kebocoran "cuplikan" respons mentah di `common.js`) **berisiko belum benar-benar sampai ke pengguna** — lihat §6 untuk detail teknisnya. Ini membuat status perbaikan itu perlu diturunkan dari "selesai" menjadi **"kode sudah benar, efektivitasnya di produksi belum bisa dipastikan"**.

Audit per-halaman menyeluruh (96+ file individual) **masih belum dikerjakan** pada sesi ini juga — cakupan permintaan Anda untuk ini sangat besar (17 titik pemeriksaan × seluruh halaman), realistisnya perlu sesi/putaran tersendiri yang fokus HANYA pada ini, bukan digabung dengan prioritas keamanan di atas.

---

## 6. Temuan Cache & Referensi Aset — **Temuan Konkret**

Diperiksa SEMUA referensi `?v=` di 3 halaman pintu masuk utama (`admin.html`, `dashboard.html`, `absensi-qr.html`).

**Temuan nyata**: `common.js` (SATU file fisik, dipakai oleh ketiga halaman) direferensikan dengan **3 nomor versi yang BERBEDA dan independen** di tiap halaman (`20260903c`, `20260903b`, `20260929a`) — **tidak satu pun yang dinaikkan** sejak isi `common.js` terakhir diubah (sesi lalu, perbaikan kebocoran cuplikan). Artinya browser pengguna yang pernah membuka halaman ini SEBELUM perubahan itu mungkin masih menyajikan versi `common.js` yang LAMA dari cache, sampai mereka melakukan hard-refresh atau cache browser mereka kedaluwarsa sendiri.

**Pola serupa ditemukan sebelumnya** pada `admin.js` (sudah diperbaiki sesi lalu) — ini **bukan kasus pertama**, menunjukkan perlunya kebiasaan/checklist SETIAP kali mengedit file bersama, bukan sekadar ingat satu per satu saat kebetulan ketahuan.

**Belum diperiksa**: pasangan aset di luar 3 halaman pintu masuk ini (halaman-halaman modul individual seperti `siraga.html`, dll.) — cakupan penuh butuh pemeriksaan sistematis ke seluruh ~99 file.

---

## 7. Status Dokumentasi Arsitektur

`RINGKASAN_PORTAL_SPPG_JEUNGJING.md` — **dikonfirmasi usang** (dicek ulang, bukan asumsi): tidak menyebut SIPOGIM, Pemeriksaan Jadwal Individu, Laporan Koreksi Presensi, QR Kios, atau penyatuan Koreksi Tanggal+Absen sama sekali — padahal semua ini sudah berjalan di kode aktual. Dokumen ini masih mencerminkan kondisi proyek dari BEBERAPA iterasi yang lalu.

Tidak ditemukan dokumen terpisah untuk: struktur sheet/kolom lengkap, kontrak API/daftar endpoint, hak akses per peran dalam bentuk tertulis (hanya tersebar di kode), prosedur backup/pemulihan, atau panduan deployment per-proyek (SIPENDOK/SIPOGIM punya `PANDUAN-DEPLOY.md` masing-masing — Portal utama tidak).

---

## 8. Status Kategori Laporan SIPIKA (Per Kategori, Terpisah)

| Kategori | Status | Sumber Data | Tumpang Tindih? |
|---|---|---|---|
| **Koreksi Presensi** | ✅ Berjalan | `24_AUDIT_LOG` (sudah ada sejak lama, baru dibuka tampilannya) | Tidak — satu-satunya yang murni baru |
| **Laporan Presensi** | ⬜ Belum dibangun | Akan tersedia dari roster/absensi yang sama dgn Rekap Harian/Per Periode | 🟡 **Berpotensi tinggi** — perlu Anda putuskan sudut pandang apa yang BEDA dari Rekap yang sudah ada, kalau memang dibutuhkan |
| **Laporan Relawan** | ⬜ Belum dibangun | Tersedia (`Relawan.gs`, `Akun.gs`) | 🟢 Rendah — belum ada fitur serupa |
| **Laporan Jadwal & Penugasan** | ⬜ Belum dibangun | Tersedia (sama dgn data Pemeriksaan Jadwal Individu) | 🟡 Sedang — Pemeriksaan Jadwal Individu sudah menjawab utk 1 relawan; versi "semua relawan sekaligus dalam 1 tabel" belum ada dan BEDA kegunaannya |
| **Laporan Operasional/Stok** | ⬜ Belum dibangun | SIRAGA kemungkinan sudah punya dasbor/rekap sendiri — **belum saya verifikasi langsung** | ⬜ Belum terverifikasi |

**Tidak ada kategori yang saya putuskan "tidak dibutuhkan"** — status di atas murni kondisi faktual + potensi tumpang tindih untuk ANDA pertimbangkan, sesuai instruksi.

---

## 9. Status Integrasi Eksternal

**POP-BGN, SIPHR, Kurir MBG**: diperiksa ULANG pada sesi ini (pencarian string menyeluruh ke seluruh 52 file backend + 99 file frontend + nama domain/URL) — **tetap nihil hasil**. Status: **belum terverifikasi**, bukan "tidak ada integrasi" — saya tidak punya cara memastikan tanpa informasi tambahan dari Anda (misalnya: nama variabel/endpoint yang pernah dipakai, atau konfirmasi bahwa prosesnya memang manual di luar sistem).

**Informasi minimum yang akan membantu**: apakah pernah ada rencana teknis (bukan cuma operasional) untuk sistem-sistem ini terhubung ke Portal — kalau YA, nama/istilah apa yang mungkin dipakai di kode (supaya saya bisa cari lebih tepat sasaran).

---

## 10. Daftar Risiko & Dampak

| Risiko | Dampak | Bukti |
|---|---|---|
| `getRelawanList` tanpa otorisasi, termasuk nomor rekening | **Tinggi** — kebocoran data finansial personal | §3.1 |
| Perbaikan bahasa `common.js` sesi lalu belum tentu efektif di pengguna aktif | Sedang — mengurangi manfaat perbaikan yang SUDAH dikerjakan | §6 |
| LockService 0% di Akun.gs, WebsitePublik.gs, PenerimaManfaat.gs | Sedang (lebih rendah dari Shift/Tarif krn pola pemakaian 1-admin) | §4 |
| Dokumentasi usang bisa menyesatkan developer berikutnya | Sedang, bertambah seiring waktu kalau tidak diperbarui | §7 |

---

## 11. Rekomendasi Berdasarkan Prioritas

**P1 — Tinggi**
- Tambahkan otorisasi ke `getRelawanList`/`getRekapBulanan`/`getAbsensiList` (§3.1) — SETELAH Anda konfirmasi pertanyaan di §3.2, supaya tidak merusak pemakaian publik yang sah kalau memang disengaja.
- Naikkan versi cache `common.js` di 3 halaman (§6) — perbaikan berisiko kecil, dampak langsung memastikan perbaikan bahasa sesi lalu benar-benar aktif.

**P2 — Sedang**
- Perluas LockService ke Akun.gs dan SIRAGA (sisa fungsi yang belum tercakup) — SIRAGA didahulukan sesuai volume transaksi yang disebut tinggi di deskripsi proyek Anda.
- Audit cache menyeluruh ke SEMUA 99 file (bukan cuma 3 halaman pintu masuk).

**P3 — Rendah**
- Perbarui `RINGKASAN_PORTAL_SPPG_JEUNGJING.md`.
- Audit bahasa per-halaman menyeluruh (cakupan besar, realistis sebagai proyek tersendiri).
- LockService untuk WebsitePublik.gs/PenerimaManfaat.gs (risiko lebih rendah).

---

## 12. Rencana Pengujian (Untuk Tahap Implementasi Nanti)

- **`getRelawanList`**: setelah ditambah otorisasi, uji akses tanpa login (harus ditolak) DAN akses dari halaman yang SAH memakainya (harus tetap berfungsi) — supaya tidak ada regresi ke fitur yang sah bergantung padanya.
- **Cache `common.js`**: setelah versi dinaikkan, buka halaman di browser yang PERNAH mengakses versi lama, pastikan hard-refresh tidak diperlukan (otomatis ambil versi baru).

---

## 13. Hal yang Membutuhkan Keputusan Anda

1. Apakah `getRelawanList` memang dipakai di konteks publik (tanpa login)? Kalau ya, apakah `nomorRekening` seharusnya ikut, atau itu kelebihan data?
2. Urutan: perbaiki `getRelawanList` (P1 keamanan) duluan, atau naikkan cache `common.js` duluan (lebih cepat, risiko lebih kecil)?
3. Laporan SIPIKA: dari 4 kategori kosong, mana (kalau ada) yang mau diprioritaskan dulu?

---

## 14. Belum Dapat Diverifikasi

- POP-BGN/SIPHR/Kurir MBG (§9).
- Audit bahasa per-halaman penuh (§5) — baru dasar metodologi+temuan sampel, bukan keseluruhan 96+ file.
- Status dasbor/laporan SIRAGA yang sudah ada (relevan utk §8, kategori Laporan Operasional) — belum saya telusuri langsung.
- Efektivitas NYATA perbaikan cache setelah nanti diperbaiki — baru bisa dipastikan lewat pengujian di browser sungguhan, bukan pembacaan kode.

---

### Tabel Ringkas Jenis Temuan

| Jenis | Isi |
|---|---|
| Terbukti (bukti kode langsung, diverifikasi manual) | §3.1 (4 fungsi), §4 (matriks lengkap), §6 (cache), §7 (dokumentasi usang) |
| Perlu verifikasi lanjut | §9 (integrasi eksternal), status dasbor SIRAGA (§8) |
| Rekomendasi perbaikan | §11 (P1–P3) |
| Usulan fitur baru | Tidak ada pada audit ini |

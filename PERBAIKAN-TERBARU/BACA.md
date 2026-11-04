# DEPLOY ULANG (timpa semua) + CEK — perbaikan 4 Nov 2026, versi 2026-11-04g
Urutan: A (Apps Script) → B (GitHub) → C (cek). Aman diulang berapa kali pun.
Jumlah berkas banyak karena ikon/emoji dihapus dari banyak halaman; itu normal. Cukup ikuti B (satu perintah menimpa semuanya).

## A. Apps Script (tempel, timpa)
Untuk tiap berkas: buka berkas bernama sama di editor Apps Script → Ctrl+A → tempel isi berkas dari zip → Ctrl+S.
- Proyek **PORTAL RELAWAN**, folder `backend/PORTAL` (18 berkas): Absensi, AbsensiQr, AdminDashboard, Akun, Code, Informasi, Kalender, KalenderTanggal, MasterTarif, Notifikasi, PmSipendok, PushNotifikasi, SipanduInsentifV2, SipanduPemorsianDistribusiCuci, SipanduTarifV2, SipanduV2, SipanduWorkOrder, shift.
- Proyek **SIPENDOK**, folder `backend/SIPENDOK` (2 berkas): Config, SipanduPmHarian.
- Lalu di KEDUA proyek: **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy**.
SIPOGIM dan database: tidak berubah. Tidak ada fungsi yang dijalankan.

## B. GitHub lewat Codespace (timpa) — ketik satu per satu
Seret PERBAIKAN-TERBARU.zip ke panel Explorer, lalu di Terminal:
`mv PERBAIKAN-TERBARU.zip /tmp`
`unzip -qo /tmp/PERBAIKAN-TERBARU.zip -d /tmp/pt`
`cd /workspaces/portal`
`cp -r /tmp/pt/PERBAIKAN-TERBARU/frontend/. .`
`git add -A`
`git commit -m "perbaikan"`
`git push`
(`cp ... frontend/. .` menaruh ISI folder frontend di akar repo dan menimpa berkas lama; tidak ada folder pembungkus.)
Opsional, agar salinan Apps Script di repo ikut sama:
`cp /tmp/pt/PERBAIKAN-TERBARU/backend/PORTAL/*.gs backend/portal/`
`cp /tmp/pt/PERBAIKAN-TERBARU/backend/SIPENDOK/*.gs backend/sipendok/`

## C. CEK apakah sudah ada dan tayang
Tunggu 1–2 menit setelah `git push`, lalu (masih di /workspaces/portal):
`bash /tmp/pt/PERBAIKAN-TERBARU/cek.sh`
Skrip hanya menampilkan berkas yang bermasalah (LAMA = belum tertimpa di repo; TIADA = tidak ada; BEDA = situs masih isi lain; 404 = belum tayang/posisi salah), status git, dan versi Apps Script yang aktif (PORTAL dan SIPENDOK harus 2026-11-04g). Tambahkan `-v` untuk menampilkan semua berkas.
Hasil yang benar: `=== SEMUA BERES ... ===`. Terakhir di portal tekan **Ctrl+Shift+R**: pojok kiri bawah menu bertuliskan **Versi build: 2026-11-04g**.

## Isi perbaikan ini
1. Kalender: klik tanggal menampilkan kartu yang sama dengan dashboard (Menu, lalu Penerima Manfaat: total, PK/PB/3B, rincian Balita/Ibu Menyusui/Ibu Hamil, tabel per instansi) + tombol ke Manajemen PM.
2. Manajemen PM: kartu Total, Instansi Terisi, PK, PB, 3B dan rincian 3B seperti dashboard.
3. Dashboard & website: PM "hari ini" kini berganti ke hari berikutnya pukul 15.00 WIB, sama dengan menu.
4. Tanpa ikon/emoji di seluruh aplikasi (penanda terkunci pada menu aplikasi kini berupa teks "Terkunci"). Ikon garis (SVG) pada menu samping dan kepala halaman tidak diubah.
5. Sebelumnya (sudah ada di zip): Rekap Mingguan matriks, semua ekspor Excel, jumlah siswa otomatis, instansi nonaktif dianggap 0, menu Siklus di Manajemen Menu.

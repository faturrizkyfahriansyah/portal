# SPPG Jeungjing — Portal, SIPENDOK, SIPOGIM

Situs dilayani GitHub Pages **dari root repo** (`portal.sppgjeungjing.my.id`).
Rincian lengkap: `dokumentasi/STRUKTUR-REPOSITORY.md`.

```
/                      halaman HTML Portal (alamat web tidak berubah), CNAME, manifest, service worker
├── core/              kode bersama (common, config, auth, app-shell, navigasi)
├── modules/           JavaScript per fitur (admin, absensi, jadwal, sipandu, siraga, ...)
├── services/firebase/ konfigurasi Firebase
├── styles/            semua CSS
├── assets/            gambar & ikon
├── sipendok/          aplikasi SIPENDOK (frontend, modular sendiri)
├── sipogim/           aplikasi SIPOGIM (frontend; js/ dan css/ di dalamnya)
├── backend/           kode Google Apps Script per proyek: portal/, sipendok/, sipogim/
└── dokumentasi/       master prompt, audit, arsip penataan
```
Backend (`backend/`) TIDAK dijalankan oleh GitHub Pages; ditempel/di-push ke proyek Apps Script masing-masing.

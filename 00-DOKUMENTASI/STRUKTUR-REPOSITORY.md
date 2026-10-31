# Struktur Repository SPPG Jeungjing

Setiap proyek memiliki dua folder utama:

```text
01-PORTAL/
├── BACKEND/
│   ├── Code.gs
│   ├── Auth.gs
│   └── file-backend-lainnya.gs
├── FRONTEND/
│   ├── modules/
│   ├── core/
│   ├── styles/
│   ├── assets/
│   └── file HTML dan JavaScript
└── README.md
```

Pola yang sama berlaku untuk `02-SIPENDOK` dan `03-SIPOGIM`.

## Aturan penempatan
- Semua `.gs` dan `appsscript.json` (jika tersedia) masuk langsung ke `BACKEND/`.
- Tidak ada subfolder tambahan di dalam `BACKEND/`.
- HTML, JavaScript frontend, CSS, aset, manifest web, service worker, serta folder modul berada di `FRONTEND/`.
- Database dan Script ID masing-masing proyek tidak digabung.

Pemetaan database:
- PORTAL → DATABASE PORTAL
- SIPENDOK → DATABASE SIPENDOK
- SIPOGIM → DATABASE SIPOGIM

Catatan: untuk deployment Google Apps Script/clasp, sesuaikan konfigurasi root directory dan Script ID per proyek. Jangan menjalankan push dari root repository gabungan.

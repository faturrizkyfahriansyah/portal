# Struktur Repository SPPG Jeungjing

Di dalam setiap proyek, struktur dibagi berdasarkan jenis file:

- File frontend tetap dikelompokkan dalam folder modul, `core`, `styles`, `assets`, dan folder pendukung sesuai struktur proyek.
- Seluruh file backend Google Apps Script (`.gs`) diletakkan langsung di direktori utama proyek. Tidak ada folder `backend/` atau subfolder khusus backend.
- `appsscript.json` juga diletakkan langsung di direktori utama proyek jika tersedia pada sumber.

Contoh:

```text
01-PORTAL/
├── modules/
├── core/
├── styles/
├── assets/
├── *.html
├── *.js
├── *.gs
└── appsscript.json (jika tersedia)
```

Pemisahan proyek tetap dijaga:
- PORTAL -> DATABASE PORTAL
- SIPENDOK -> DATABASE SIPENDOK
- SIPOGIM -> DATABASE SIPOGIM

Catatan: pengelompokan di GitHub tidak otomatis menentukan struktur proyek Apps Script. Jika menggunakan clasp, setiap proyek perlu konfigurasi root dan Script ID sendiri. Jangan push dari root repository gabungan.

# Arsitektur Frontend SPPG Jeungjing

## Pemisahan proyek
PORTAL, SIPENDOK, dan SIPOGIM adalah tiga aplikasi frontend terpisah. Masing-masing tetap berkomunikasi dengan backend Apps Script dan database domainnya sendiri.

## Batas pekerjaan
Refactoring ini hanya menata frontend. Seluruh folder backend dan file `.gs` dikeluarkan dari paket frontend ini dan tidak dimodifikasi.

## Prinsip struktur
- `core/`: fungsi dasar frontend yang digunakan lintas halaman.
- `modules/`: kode JavaScript berdasarkan fitur.
- `styles/` atau `css/`: stylesheet.
- Halaman HTML utama dipertahankan pada lokasi semula bila pemindahan berisiko mengubah URL halaman dan navigasi.
- `assets/`, manifest, service worker, dan konfigurasi PWA dipertahankan sesuai kebutuhan scope aplikasi.
- Jangan mengubah URL API atau kontrak payload backend dalam pekerjaan penataan folder.

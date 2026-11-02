# Catatan Refactoring

Paket ini mempertahankan halaman HTML di root masing-masing aplikasi untuk menjaga URL halaman dan tautan navigasi yang sudah ada. File JavaScript dan CSS PORTAL dikelompokkan berdasarkan fitur dan fungsi. SIPENDOK mempertahankan struktur `js/pages` yang sudah modular dan digunakan oleh ES module serta service worker. SIPOGIM memisahkan JavaScript dan CSS ke folder khusus dengan pembaruan referensi HTML.

File `.gs` yang ditemukan di folder frontend PORTAL tidak disalin ke paket frontend karena termasuk kode Google Apps Script/backend dan harus dikelola pada proyek Apps Script terpisah. Daftarnya dicatat dalam `DAFTAR-FILE-GS-DIKECUALIKAN.md`.

Sebelum deployment produksi, lakukan uji browser pada setiap halaman, uji PWA/service worker, uji API, dan uji seluruh alur pengguna. Pemeriksaan statis tidak dapat membuktikan seluruh fungsi aplikasi berjalan.

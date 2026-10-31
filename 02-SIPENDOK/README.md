# 02-SIPENDOK

Struktur proyek:

- `BACKEND/` — seluruh file Google Apps Script (`.gs`) dan `appsscript.json` jika tersedia. Semua file backend berada langsung di folder ini, tanpa subfolder modul backend.
- `FRONTEND/` — seluruh HTML, JavaScript frontend, CSS, aset, manifest web, service worker, serta folder modul dan folder pendukung frontend.

Backend dan frontend tetap satu proyek aplikasi, tetapi sumber kodenya dipisahkan berdasarkan fungsi.
Database dan Script ID tetap mengikuti proyek Apps Script masing-masing.

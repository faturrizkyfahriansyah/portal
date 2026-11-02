# Struktur Repository (berlaku sejak penataan 1 Nov 2026)

## Aturan dasar GitHub Pages yang membentuk struktur ini
1. Pages hanya menayangkan dari **root** (atau `/docs`). Maka halaman HTML Portal dan file yang HARUS berada di root tetap di root.
2. **Jangan memberi nama folder/file berawalan `_` atau `.`** (kecuali `.nojekyll`). Tanpa `.nojekyll`, Jekyll membuang entri berawalan `_` secara diam-diam. `.nojekyll` sudah ada di root.
3. GitHub Pages peka huruf besar/kecil: `NavigasiTerpusat.js` ≠ `navigasiterpusat.js`.

## Yang HARUS di root
| File | Alasan |
|---|---|
| `*.html` (38 halaman) | alamat web publik, bookmark, kode QR, tautan notifikasi tidak boleh berubah |
| `CNAME` | domain kustom |
| `service-worker.js`, `firebase-messaging-sw.js` | cakupan (scope) service worker = folder tempatnya berada. Kalau dipindah ke subfolder, PWA/notifikasi hanya berlaku untuk subfolder itu |
| `manifest.json`, `manifest-sipres.json` | PWA |
| `.nojekyll`, `README.md`, `CHANGELOG.md` | |

## Yang di dalam folder
| Folder | Isi | Aturan |
|---|---|---|
| `core/` | kode yang dipakai hampir semua halaman | jangan dihapus/diganti nama tanpa memeriksa semua halaman |
| `modules/<fitur>/` | JS per fitur; `modules/admin/` = semua panel admin | file baru ditaruh di folder fitur yang sesuai |
| `services/firebase/` | konfigurasi Firebase | |
| `styles/` | CSS | `url()` di CSS relatif terhadap folder `styles/` (mis. `../assets/...`) |
| `assets/` | gambar/ikon | |
| `sipendok/` | aplikasi SIPENDOK | tidak diubah penataannya |
| `sipogim/` | aplikasi SIPOGIM, `js/` & `css/` di dalamnya | |
| `backend/` | `.gs` per proyek Apps Script | database & Script ID masing-masing proyek TIDAK digabung |

## Cara menambah file baru
- JS baru untuk halaman admin → `modules/admin/nama.js`, lalu muat dengan `<script src="modules/admin/nama.js">` (atau daftarkan di `MODUL_LAZY` pada `modules/admin/admin.js`).
- Pemuatan lazy memakai jalur **relatif terhadap halaman** (root), bukan terhadap file JS.
- Setiap kali memindahkan file: cari semua rujukan ke namanya (HTML, JS, CSS) sebelum commit.

Pemetaan backend → database: Portal → DATABASE PORTAL; SIPENDOK → DATABASE SIPENDOK; SIPOGIM → DATABASE SIPOGIM. Kode SIRAGA dan SIPANDU saat ini berada di `backend/portal/`.

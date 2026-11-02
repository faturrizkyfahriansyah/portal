# Arsitektur Repository SPPG Jeungjing

Repository ini mengelola tiga proyek secara terpisah:

- `01-PORTAL`
- `02-SIPENDOK`
- `03-SIPOGIM`

Setiap proyek dapat berisi:
- Frontend: HTML, JavaScript, CSS, dan aset.
- Backend: kode Google Apps Script milik proyek tersebut.

## Pemisahan wajib

| Proyek | Backend Apps Script | Database |
|---|---|---|
| PORTAL | `01-PORTAL/backend/` | DATABASE PORTAL |
| SIPENDOK | `02-SIPENDOK/backend/` | DATABASE SIPENDOK |
| SIPOGIM | `03-SIPOGIM/backend/` | DATABASE SIPOGIM |

Backend tidak digabung. Script ID, deployment, konfigurasi, dan database setiap proyek harus tetap independen.

## Catatan Apps Script dan GitHub

Folder backend di GitHub adalah pengelompokan repository. Google Apps Script tidak otomatis menggunakan folder GitHub sebagai folder proyek. Jika menggunakan `clasp`, masing-masing proyek harus memiliki konfigurasi deployment/root directory sendiri. Jangan melakukan `clasp push` dari root repository gabungan.

## Batas perubahan

Frontend berasal dari paket refactoring frontend sebelumnya. Backend disalin dari ZIP sumber proyek tanpa mengubah isi logika. Database spreadsheet tidak disertakan dalam repository ini.

## Manifest

Manifest `appsscript.json` disertakan hanya jika tersedia di arsip sumber. Jika tidak ada, jangan membuat manifest pengganti berdasarkan tebakan. Ambil konfigurasi resmi dari proyek Apps Script yang bersangkutan sebelum deployment.

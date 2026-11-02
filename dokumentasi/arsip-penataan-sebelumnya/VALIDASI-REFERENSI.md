# Validasi Referensi Frontend

Ditemukan 6 referensi lokal yang tidak ditemukan saat pemeriksaan statis. Referensi ini berasal dari sumber ZIP atau perlu ditinjau manual.

- **01-PORTAL** — `kartu-id-relawan-template.html` → `assets/batik-ornamen.png`
- **01-PORTAL** — `kartu-id-relawan-template.html` → `assets/batik-ornamen.png`
- **01-PORTAL** — `kartu-id-relawan-template.html` → `assets/batik-ornamen.png`
- **01-PORTAL** — `kartu-id-relawan-template.html` → `assets/batik-ornamen.png`

## Catatan khusus

- `kontak.html` menggunakan atribut `data-konten-href="instagram"` dan `data-konten-href="tiktok"` sebagai kunci konten dinamis, bukan URL lokal. Keduanya tidak dihitung sebagai file yang hilang.
- `assets/batik-ornamen.png` dirujuk empat kali oleh template kartu identitas, tetapi aset tersebut tidak tersedia di ZIP sumber. File tidak dibuat atau diganti secara otomatis; perlu ditambahkan dari aset asli jika memang digunakan.

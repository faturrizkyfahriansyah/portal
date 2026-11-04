#!/bin/bash
# cek.sh — memeriksa APAKAH perbaikan sudah: (1) ada di repo, (2) di-commit & di-push, (3) TAYANG di situs, (4) aktif di Apps Script.
# Pakai di Codespace:  cd /workspaces/portal   lalu   bash /tmp/pt/PERBAIKAN-TERBARU/cek.sh      (boleh: bash cek.sh /jalur/repo ; tambahkan -v untuk menampilkan SEMUA berkas)
REPO="$PWD"; TAMPIL_SEMUA=0; for a in "$@"; do if [ "$a" = "-v" ]; then TAMPIL_SEMUA=1; else REPO="$a"; fi; done
AKAR="$(cd "$(dirname "$0")" && pwd)"; VERSI="2026-11-04g"
SITUS="${SITUS:-https://portal.sppgjeungjing.my.id}"
BERKAS=(
  absensi.html
  admin.html
  bantuan.html
  beranda.html
  core/NavigasiTerpusat.js
  core/ringkasan-pm.js
  core/script.js
  core/xlsx-mini.js
  dashboard.html
  id-card-saya.html
  index.html
  kontak.html
  menu-hari-ini.html
  modules/absensi/absensi-qr.js
  modules/absensi/offline-absensi.js
  modules/admin/admin-export.js
  modules/admin/admin-import.js
  modules/admin/admin-jadwal-individu.js
  modules/admin/admin-kalender-operasional.js
  modules/admin/admin-kalender-pm.js
  modules/admin/admin-kartu-qr.js
  modules/admin/admin-laporan.js
  modules/admin/admin-manajemen-hak-akses.js
  modules/admin/admin-master-tarif.js
  modules/admin/admin-menu-hari-ini.js
  modules/admin/admin-migrasi-roster-v2.js
  modules/admin/admin-penerima-manfaat-ops.js
  modules/admin/admin-pengajuan-kebutuhan.js
  modules/admin/admin-pengaturan.js
  modules/admin/admin-profil-relawan.js
  modules/admin/admin-rekap-mingguan.js
  modules/admin/admin-retur-barang.js
  modules/admin/admin-shift.js
  modules/admin/admin-sipandu-biaya.js
  modules/admin/admin-sipandu-master.js
  modules/admin/admin-sipandu-menu.js
  modules/admin/admin-sipandu-pagu.js
  modules/admin/admin-sipandu-pm.js
  modules/admin/admin-stok.js
  modules/admin/admin-website-publik.js
  modules/admin/admin.js
  modules/dashboard-monitoring/dashboard.js
  modules/jadwal/jadwal-anggota.js
  modules/kartu-identitas/id-card-saya.js
  modules/koordinator/laporan-kendala-koordinator.js
  modules/koordinator/monitoring-kehadiran-koordinator.js
  modules/koordinator/pembagian-tugas-koordinator.js
  modules/koordinator/pengajuan-kebutuhan-koordinator.js
  modules/koordinator/retur-barang-koordinator.js
  modules/pengaturan/pengaturan.js
  modules/sipandu/sipandu.js
  modules/siraga/siraga.js
  modules/siraga/stok-relawan.js
  modules/website-publik/public-dashboard-data.js
  monitoring-kehadiran-koordinator.html
  monitoring.html
  pengaturan.html
  profil.html
  qr-label-ompreng.html
  qrcode.html
  sipandu.html
  sipogim/bahan.html
  sipogim/beranda.html
  sipogim/js/sipogim-common.js
  sipogim/kalkulator.html
  sipogim/lainnya.html
  sipogim/menu.html
  sipogim/padanan.html
  sipogim/pengaturan.html
  sipogim/resep.html
  siraga.html
  stok-relawan.html
  styles/admin.css
)
cd "$REPO" 2>/dev/null || { echo "Folder repo tidak ditemukan: $REPO"; exit 2; }
[ -f admin.html ] || { echo "Ini bukan akar repo portal (admin.html tidak ada di $REPO)."; exit 2; }
sha() { sha256sum "$1" 2>/dev/null | cut -d' ' -f1; }
tmp="$(mktemp)"; masalah=0; salah_tempat=0; n=${#BERKAS[@]}; ok_repo=0; ok_live=0
echo "=== 1) BERKAS PERBAIKAN ($n berkas): di repo dan tayang di $SITUS ==="
for f in "${BERKAS[@]}"; do
  if [ ! -f "$f" ]; then rs="TIADA"; elif [ -f "$AKAR/frontend/$f" ] && [ "$(sha "$f")" != "$(sha "$AKAR/frontend/$f")" ]; then rs="LAMA"; else rs="OK"; fi
  code=$(curl -sL --max-time 25 -o "$tmp" -w '%{http_code}' "$SITUS/$f?cb=$RANDOM$RANDOM" 2>/dev/null); [ -z "$code" ] && code=000
  if [ "$code" != "200" ]; then ls_="$code"; elif [ -f "$f" ] && [ "$(sha "$tmp")" = "$(sha "$f")" ]; then ls_="OK"; else ls_="BEDA"; fi
  [ "$rs" = "OK" ] && ok_repo=$((ok_repo+1)); [ "$ls_" = "OK" ] && ok_live=$((ok_live+1))
  if [ "$rs" != "OK" ] || [ "$ls_" != "OK" ]; then masalah=$((masalah+1)); printf "  [repo: %-5s] [situs: %-4s] %s\n" "$rs" "$ls_" "$f"
  elif [ "$TAMPIL_SEMUA" = "1" ]; then printf "  [repo: OK   ] [situs: OK  ] %s\n" "$f"; fi
done
echo "  di repo sama dengan perbaikan: $ok_repo dari $n  |  tayang sama dengan repo: $ok_live dari $n"
{ [ -d frontend ] || [ -f PERBAIKAN-TERBARU/frontend/admin.html ]; } && { echo; echo "!! Ada folder 'frontend' / 'PERBAIKAN-TERBARU' DI DALAM repo: yang terupload folder pembungkusnya. Pindahkan ISInya ke akar repo, lalu hapus folder itu."; salah_tempat=1; }
echo; echo "=== 2) GIT ==="
nc=$(git status --porcelain 2>/dev/null | wc -l); if [ "$nc" -gt 0 ]; then echo "  $nc berkas BELUM di-commit  ->  git add -A ; git commit -m \"perbaikan\" ; git push"; masalah=$((masalah+1)); else echo "  semua sudah di-commit"; fi
np=$(git rev-list --count '@{u}..HEAD' 2>/dev/null); if [ -z "$np" ]; then echo "  (tidak bisa membandingkan dengan GitHub)"; elif [ "$np" -gt 0 ]; then echo "  $np commit BELUM di-push  ->  git push"; masalah=$((masalah+1)); else echo "  semua sudah di-push"; fi
echo; echo "=== 3) APPS SCRIPT yang aktif (harus $VERSI) ==="
URL_PORTAL="${URL_PORTAL:-$(grep -oE 'https://script.google.com/macros/s/[A-Za-z0-9_-]+/exec' core/config.js 2>/dev/null | head -1)}"
URL_SIPENDOK="${URL_SIPENDOK:-$(grep -oE 'https://script.google.com/macros/s/[A-Za-z0-9_-]+/exec' sipendok/config.js 2>/dev/null | head -1)}"
cekv() { nama="$1"; hasil=$(curl -sL --max-time 40 "$2" 2>/dev/null | grep -oE '"versi" *: *"[^"]*"' | head -1 | sed 's/.*: *"//; s/"//'); if [ "$hasil" = "$VERSI" ]; then echo "  $nama: OK ($hasil)"; elif [ -z "$hasil" ]; then echo "  $nama: TIDAK ADA jawaban versi  ->  kode baru belum ditempel / belum Deploy > New version"; masalah=$((masalah+1)); else echo "  $nama: BELUM ($hasil, seharusnya $VERSI)  ->  tempel berkas lalu Deploy > Manage deployments > pensil > New version > Deploy"; masalah=$((masalah+1)); fi; }
cekv "PORTAL  " "$URL_PORTAL?action=versiBackend"; cekv "SIPENDOK" "$URL_SIPENDOK"
rm -f "$tmp"; echo
if [ "$masalah" -eq 0 ] && [ "$salah_tempat" -eq 0 ]; then echo "=== SEMUA BERES: berkas ada di repo, sudah di-push, tayang di situs, Apps Script versi $VERSI. Tekan Ctrl+Shift+R di portal. ==="; exit 0
else echo "=== ADA $masalah MASALAH (lihat baris bertanda LAMA / TIADA / BEDA / 404 / BELUM di atas) ==="
  echo "Arti: LAMA = berkas di repo belum diganti dgn perbaikan (timpa lagi) | TIADA = berkas tidak ada | 404 = belum tayang/posisi salah | BEDA = situs masih menayangkan isi lain (tunggu 1-2 menit, cek tab Actions di GitHub, lalu jalankan lagi)"; exit 1; fi

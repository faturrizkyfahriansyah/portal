// ============================================================
// SPPG JEUNGJING — LOGIC DASHBOARD RELAWAN (dashboard.html)
// Struktur: Hero, Status Operasional, Jadwal Saya, Ringkasan SIPRES
// (Kehadiran Hari Ini + Detail Presensi + Ringkasan Kehadiran),
// Informasi Penting.
//
// AUDIT PERFORMANCE (disetujui): dipecah jadi 2 permintaan independen,
// bukan lagi satu getDashboardLengkapRelawan yang menahan seluruh render.
// getDashboardRelawanP0 = Identitas/Status Operasional/Jadwal/Presensi
// Hari Ini (dibutuhkan segera, dirender lebih dulu). getDashboardRelawanP1
// = Ringkasan Kehadiran + Informasi Penting (menyusul, tidak menahan P0).
// Backend endpoint LAMA (getDashboardLengkapRelawan) TIDAK dihapus --
// dipertahankan utuh untuk rollback aman, cuma tidak dipanggil di sini lagi.
// ============================================================

let _leafletDimuat = false;
function pastikanLeafletTermuat_() {
  if (_leafletDimuat) return Promise.resolve();
  return new Promise((resolve) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => { _leafletDimuat = true; resolve(); };
    script.onerror = () => resolve(); // gagal muat peta -- jangan hentikan seluruh Dashboard
    document.head.appendChild(script);
  });
}

function tampilkanPeta_(idWadah, lat, lng) {
  const wadah = document.getElementById(idWadah);
  if (lat == null || lng == null) {
    wadah.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#8a93a3;">Lokasi belum tersedia</div>';
    return;
  }
  if (!window.L) { wadah.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#8a93a3;">Peta gagal dimuat</div>'; return; }

  const peta = L.map(idWadah, { zoomControl: false, attributionControl: false }).setView([lat, lng], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(peta);
  L.marker([lat, lng]).addTo(peta);
  setTimeout(() => peta.invalidateSize(), 200); // wadah baru muncul dari is-hidden -- ukurannya perlu dihitung ulang
}

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) { window.location.href = 'login.html'; return; }

  const main = document.getElementById('dashboardMain');

  // ---- MENU UTAMA: tombol "Lainnya" -- dipasang PALING AWAL, TIDAK
  // bergantung pada berhasil/gagalnya pemuatan data Dashboard di bawah.
  const btnLainnya = document.getElementById('btnMenuLainnya');
  if (btnLainnya) {
    btnLainnya.addEventListener('click', () => {
      const burger = document.querySelector('.shell-topbar-burger');
      if (burger) burger.click();
    });
  }

  // ============================================================
  // MENU HARI INI & RINGKASAN PENERIMA MANFAAT (BARU, 15 Okt 2026) --
  // independen, TIDAK menahan P0/P1 (pola sama: fetch terpisah, render
  // begitu siap). Tanpa token krn aksinya memang tanpa gerbang role
  // (lihat komentar di Code.gs) -- data agregat operasional, bukan
  // data pribadi relawan.
  // ============================================================
  (async function muatMenuDanPmDashboard_() {
    try {
      const m = await apiGet('getMenuHariIniDashboard', {});
      const el = document.getElementById('dbMenuIsi');
      if (!m) { el.innerHTML = '<p style="margin:0;font-size:12.5px;color:#8a93a3;">Menu hari ini belum tersedia.</p>'; return; }
      el.innerHTML = `
        <p style="margin:0 0 10px;font-size:12px;color:#55606f;">${escapeHtml(m.hari)}, ${escapeHtml(m.tanggal)}${m.tema ? ' · ' + escapeHtml(m.tema) : ''}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;">
          <div><b>Karbohidrat</b><br>${escapeHtml(m.karbohidrat || '-')}</div>
          <div><b>Lauk Hewani</b><br>${escapeHtml(m.laukHewani || '-')}</div>
          <div><b>Lauk Nabati</b><br>${escapeHtml(m.laukNabati || '-')}</div>
          <div><b>Sayur</b><br>${escapeHtml(m.sayur || '-')}</div>
          <div><b>Buah</b><br>${escapeHtml(m.buah || '-')}</div>
          <div><b>Pelengkap</b><br>${escapeHtml(m.pelengkap || '-')}</div>
        </div>`;
    } catch (e) {
      document.getElementById('dbMenuWrap').style.display = 'none'; // gagal diam-diam -- bagian lain Dashboard tetap jalan normal
    }
  })();

  (async function muatPmDashboard_() {
    try {
      const pm = await apiGet('getRingkasanPmDashboard', {});
      const el = document.getElementById('dbPmIsi');
      if (!pm) { el.innerHTML = '<p style="margin:0;font-size:12.5px;color:#8a93a3;">Data Penerima Manfaat belum tersedia.</p>'; return; }
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center;margin-bottom:10px;">
          <div><p style="margin:0;font-size:11px;color:#55606f;">PM Hari Ini</p><p style="margin:2px 0 0;font-size:18px;font-weight:800;color:#2e7d32;">${pm.jumlahPmHariIni}</p></div>
          <div><p style="margin:0;font-size:11px;color:#55606f;">PM Libur</p><p style="margin:2px 0 0;font-size:18px;font-weight:800;color:#8a93a3;">${pm.jumlahPmLibur}</p></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;font-size:12px;border-top:1px solid #e8ebef;padding-top:10px;">
          <div><b>${pm.totalPK}</b><br>PK</div>
          <div><b>${pm.totalPB}</b><br>PB</div>
          <div><b>${pm.total3B}</b><br>3B</div>
        </div>`;
    } catch (e) {
      document.getElementById('dbPmWrap').style.display = 'none';
    }
  })();

  // ============================================================
  // AUDIT PERFORMANCE (disetujui) — P0 dan P1 SEKARANG DUA PERMINTAAN
  // INDEPENDEN (sebelumnya SATU getDashboardLengkapRelawan yang menahan
  // seluruh render sampai semuanya siap). P0 = Identitas/Status
  // Operasional/Jadwal/Presensi Hari Ini -- yang relawan BUTUH segera.
  // P1 = Ringkasan Kehadiran + Informasi Penting -- boleh menyusul.
  // Pola fetch-independen + render-per-bagian ini SAMA PERSIS dengan
  // yang sudah terbukti jalan di admin.js (SUMBER_DASHBOARD).
  // ============================================================

  let tglFormatDariP0 = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  try {
    showLoading('Memuat dashboard...');
    const d = await apiGet('getDashboardRelawanP0', { token: sesi.token });
    hideLoading();

    // ---- HERO ----
    document.getElementById('heroNamaRelawan').textContent = d.identitas.nama || '–';
    const statusAkunEl = document.getElementById('heroStatusAkun');
    const aktif = d.identitas.statusAkun !== 'NONAKTIF';
    statusAkunEl.textContent = aktif ? '● AKUN AKTIF' : '● AKUN NONAKTIF';
    statusAkunEl.style.background = aktif ? 'rgba(255,255,255,.15)' : 'rgba(178,58,58,.35)';
    document.getElementById('heroIdDivisi').textContent = (d.identitas.id || '–') + ' • ' + (d.identitas.divisi || '–');

    // ---- KOTAK INFORMASI OPERASIONAL ----
    let namaHari;
    if (d.statusOperasional.tanggal && d.statusOperasional.hari) {
      namaHari = d.statusOperasional.hari;
      const bagianTgl = String(d.statusOperasional.tanggal).split('/'); // DD/MM/YYYY
      const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      tglFormatDariP0 = bagianTgl.length === 3
        ? (parseInt(bagianTgl[0], 10) + ' ' + namaBulan[parseInt(bagianTgl[1], 10) - 1] + ' ' + bagianTgl[2])
        : d.statusOperasional.tanggal;
    } else {
      namaHari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
    }
    document.getElementById('infoOperasionalTanggal').textContent = '📅 ' + namaHari + ', ' + tglFormatDariP0;
    document.getElementById('infoOperasionalStatus').textContent = d.statusOperasional.label;

    // ---- JADWAL SAYA ----
    const jadwalWrap = document.getElementById('jadwalSayaHariIni');
    if (d.jadwalHariIni) {
      const j = d.jadwalHariIni;
      jadwalWrap.innerHTML = `
        <div class="card-item" style="padding:14px 16px;">
          <p style="margin:0;font-size:14px;font-weight:800;">${escapeHtml(j.waktu || 'Sepanjang hari')}</p>
          <p style="margin:3px 0 0;font-size:13px;color:#55606f;">${escapeHtml(j.penugasan || '–')}</p>
          <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:#eef0f3;">${escapeHtml(j.status || 'Terjadwal')}</span>
        </div>`;
    } else {
      jadwalWrap.innerHTML = '<p class="empty-state">Tidak ada jadwal khusus hari ini.</p>';
    }

    // ---- KEHADIRAN HARI INI ----
    const p = d.presensiHariIni;
    document.getElementById('ringkasJamMasuk').textContent = (p.masuk && p.masuk.sudah) ? p.masuk.jam : '–';
    document.getElementById('ringkasJamPulang').textContent = (p.pulang && p.pulang.sudah) ? p.pulang.jam : '–';
    let statusHariIni = 'Belum Absen';
    if (p.masuk && p.masuk.sudah && p.masuk.isIzinSakit) statusHariIni = p.masuk.keterangan;
    else if (p.masuk && p.masuk.sudah && p.pulang && p.pulang.sudah) statusHariIni = 'Selesai';
    else if (p.masuk && p.masuk.sudah) statusHariIni = 'Sedang Bertugas';
    document.getElementById('ringkasStatusHariIni').textContent = statusHariIni;

    // ---- DETAIL PRESENSI (toggle) ----
    document.getElementById('detailTanggal').textContent = p.operasional && p.operasional.tanggal ? p.operasional.tanggal : tglFormatDariP0;
    document.getElementById('detailJamMasuk').textContent = (p.masuk && p.masuk.sudah) ? p.masuk.jam : '–';
    document.getElementById('detailJamPulang').textContent = (p.pulang && p.pulang.sudah) ? p.pulang.jam : '—';
    document.getElementById('detailDurasi').textContent = p.durasi || '–';

    const radiusTeks = p.lokasiSppg ? ('Radius Presensi ' + p.lokasiSppg.radiusMeter + ' meter') : 'Radius Presensi –';
    document.getElementById('radiusLokasiMasuk').textContent = radiusTeks;
    document.getElementById('radiusLokasiPulang').textContent = radiusTeks;

    const patokanWrap = document.getElementById('patokanRadiusInfo');
    if (p.lokasiSppg) {
      const radiusDiizinkan = p.lokasiSppg.radiusMeter;
      const jarakMasuk = (p.masuk && p.masuk.sudah && p.masuk.jarakMeter != null) ? Math.round(p.masuk.jarakMeter) : null;
      let html = `<p style="margin:0;">Radius Diizinkan: <strong>${radiusDiizinkan} m</strong></p>`;
      if (jarakMasuk != null) {
        const valid = jarakMasuk <= radiusDiizinkan;
        html += `<p style="margin:2px 0 0;">Jarak Aktual (saat Masuk): <strong>${jarakMasuk} m</strong></p>`;
        html += `<p style="margin:2px 0 0;color:${valid ? '#1a7a4c' : '#b23a3a'};">${jarakMasuk} m ${valid ? '≤' : '>'} ${radiusDiizinkan} m — presensi ${valid ? 'valid' : 'di luar radius'}</p>`;
      }
      patokanWrap.innerHTML = html;
    } else {
      patokanWrap.innerHTML = '<p style="margin:0;">Data lokasi acuan belum diatur Admin.</p>';
    }

    if (p.masuk && p.masuk.sudah && p.masuk.fotoUrl) {
      document.getElementById('swafotoMasukWrap').innerHTML = `<img src="${p.masuk.fotoUrl}" alt="Swafoto masuk" style="width:100%;height:100%;object-fit:cover;">`;
    }
    if (p.pulang && p.pulang.sudah && p.pulang.fotoUrl) {
      document.getElementById('swafotoPulangWrap').innerHTML = `<img src="${p.pulang.fotoUrl}" alt="Swafoto pulang" style="width:100%;height:100%;object-fit:cover;">`;
    }

    let petaSudahDimuat = false;
    document.getElementById('btnToggleDetailPresensi').addEventListener('click', async function () {
      const wrap = document.getElementById('detailPresensiWrap');
      const sedangTerbuka = !wrap.classList.contains('is-hidden');
      if (sedangTerbuka) {
        wrap.classList.add('is-hidden');
        this.textContent = 'Detail Presensi ▾';
        return;
      }
      wrap.classList.remove('is-hidden');
      this.textContent = 'Detail Presensi ▴';

      if (!petaSudahDimuat) {
        petaSudahDimuat = true;
        await pastikanLeafletTermuat_();
        tampilkanPeta_('petaLokasiMasuk', p.masuk && p.masuk.sudah ? p.masuk.latitude : null, p.masuk && p.masuk.sudah ? p.masuk.longitude : null);
        tampilkanPeta_('petaLokasiPulang', p.pulang && p.pulang.sudah ? p.pulang.latitude : null, p.pulang && p.pulang.sudah ? p.pulang.longitude : null);
      }
    });

    // P0 selesai — tampilkan Dashboard SEKARANG. Ringkasan Kehadiran &
    // Informasi Penting (P1) masih menunjukkan placeholder "…"/"Memuat
    // informasi..." sampai fetch P1 di bawah selesai — TIDAK menahan P0.
    main.style.display = 'block';
  } catch (err) {
    hideLoading();
    if (typeof apakahErrorSesiTidakValid === 'function' && apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat dashboard.');
    main.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;text-align:center;">
        <p style="margin:0 0 12px;font-size:14px;color:#55606f;">Data belum dapat dimuat. Periksa koneksi internet Anda.</p>
        <button type="button" id="btnCobaLagiDashboard" class="btn-outline">↻ Coba Lagi</button>
      </div>`;
    main.style.display = 'block';
    const btnCobaLagi = document.getElementById('btnCobaLagiDashboard');
    if (btnCobaLagi) btnCobaLagi.addEventListener('click', () => window.location.reload());
    return; // P0 gagal -- jangan lanjut fetch P1, tidak ada gunanya tanpa P0
  }

  // ---- P1: Ringkasan Kehadiran + Informasi Penting (independen dari P0,
  // TIDAK di-await sebelum P0 tampil -- lihat main.style.display di atas
  // yang SUDAH jalan sebelum baris ini dieksekusi). Kegagalan P1 TIDAK
  // menyembunyikan/merusak P0 yang sudah tampil (§3/§5 dokumen audit). ----
  try {
    const d1 = await apiGet('getDashboardRelawanP1', { token: sesi.token });

    document.getElementById('totalHadirPeriode').textContent = d1.ringkasanKehadiran.totalHadir;
    document.getElementById('totalTerlambatPeriode').textContent = d1.ringkasanKehadiran.terlambat;
    document.getElementById('totalIzinSakitPeriode').textContent = d1.ringkasanKehadiran.izinSakit;
    document.getElementById('totalTidakHadirPeriode').textContent = d1.ringkasanKehadiran.tidakHadir;

    const infoWrap = document.getElementById('infoPentingList');
    if (d1.informasiPenting && d1.informasiPenting.length) {
      infoWrap.innerHTML = d1.informasiPenting.map(i => `
        <div class="info-card">
          <h3 class="info-card-title">${escapeHtml(i.judul)}</h3>
          <p class="info-card-body">${escapeHtml(i.isi)}</p>
        </div>`).join('');
    } else {
      infoWrap.innerHTML = '<p class="empty-state">Belum ada informasi penting saat ini.</p>';
    }
  } catch (err) {
    // P1 gagal -- ganti placeholder "…" jadi status gagal yang JELAS
    // (bukan diam menampilkan "…" selamanya, dan BUKAN dianggap 0/kosong).
    ['totalHadirPeriode', 'totalTerlambatPeriode', 'totalIzinSakitPeriode', 'totalTidakHadirPeriode'].forEach(id => {
      document.getElementById(id).textContent = '–';
    });
    document.getElementById('infoPentingList').innerHTML = '<p class="empty-state">Ringkasan &amp; Informasi belum dapat dimuat. <button type="button" id="btnCobaLagiP1" style="background:none;border:none;color:#3b7dd8;font-weight:700;cursor:pointer;padding:0;">Coba Lagi</button></p>';
    const btnCobaLagiP1 = document.getElementById('btnCobaLagiP1');
    if (btnCobaLagiP1) btnCobaLagiP1.addEventListener('click', () => window.location.reload());
  }
});

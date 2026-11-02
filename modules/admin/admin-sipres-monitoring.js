// SPPG JEUNGJING — ADMIN: MONITORING PRESENSI & PENGAJUAN KETIDAKHADIRAN
// File TERPISAH dari admin.js (2107 baris) -- ditambahkan secara aditif,
// hook ke tombol tab yang SUDAH ADA (.admin-tab-btn[data-panel=...]),
// tidak mengubah admin.js sama sekali. Menggunakan common.js (apiGet/
// apiPost) & auth-admin.js (ambilSesiAdmin).

(function () {
  const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  function parseTanggalDMY(s) { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); }
  function badgeClass(status) {
    const peta = {
      'HADIR': 'hadir', 'HADIR LENGKAP': 'hadir', 'TERLAMBAT': 'terlambat',
      'IZIN': 'izin', 'SAKIT': 'sakit', 'CUTI': 'cuti',
      'TIDAK HADIR': 'tidak-hadir', 'BELUM ABSEN': 'belum-absen', 'BELUM PULANG': 'terlambat',
      'MENUNGGU': 'terlambat', 'DISETUJUI': 'hadir', 'DITOLAK': 'sakit', 'DIBATALKAN': 'tidak-hadir'
    };
    return peta[status] || 'belum-absen';
  }
  function baris_(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `<div class="detail-row"><span class="detail-row-label">${label}</span><span class="detail-row-value">${value}</span></div>`;
  }

  // ============================================================
  // MONITORING PRESENSI
  // ============================================================
  let monDataTerkini = [];

  function renderMonitoringList(data) {
    const list = document.getElementById('monitoringList');
    const kosong = document.getElementById('monitoringKosong');
    if (!data.length) { list.innerHTML = ''; kosong.style.display = 'block'; return; }
    kosong.style.display = 'none';
    list.innerHTML = data.map((r, i) => `
      <button type="button" class="riwayat-item is-${badgeClass(r.status)}" data-idx="${i}">
        <div class="riwayat-item-detail">
          <div class="riwayat-item-top">
            <strong class="riwayat-item-shift">${escapeHtml(r.nama)}</strong>
            <span class="riwayat-badge ${badgeClass(r.status)}">${r.status}</span>
          </div>
          <div class="riwayat-item-jam">${escapeHtml(r.divisi)} · ${escapeHtml(r.namaShift || '')}</div>
          <div class="riwayat-item-jam">Jadwal ${r.jamJadwalMasuk || '–'}${r.jamJadwalPulang ? ' – ' + r.jamJadwalPulang : ''} · Masuk ${r.jamMasuk ? r.jamMasuk.slice(0,5) : '—'} · Pulang ${r.jamPulang ? r.jamPulang.slice(0,5) : '—'}</div>
        </div>
      </button>`).join('');
    list.querySelectorAll('.riwayat-item').forEach(el => {
      el.addEventListener('click', () => bukaMonDetail(data[Number(el.dataset.idx)]));
    });
  }

  function bukaMonDetail(r) {
    let html = `
      <div class="detail-sheet-head">
        <span class="riwayat-badge ${badgeClass(r.status)}">${r.status}</span>
        <h2>${escapeHtml(r.nama)}</h2>
      </div>
      <div class="detail-section">
        ${baris_('Divisi', escapeHtml(r.divisi))}
        ${baris_('Tanggal Operasional', r.tanggalOperasional)}
        ${baris_('Hari', r.hari)}
        ${baris_('Jadwal', (r.jamJadwalMasuk || '–') + (r.jamJadwalPulang ? ' – ' + r.jamJadwalPulang : ''))}
        ${baris_('Jam Masuk', r.jamMasuk ? r.jamMasuk.slice(0,5) : '—')}
        ${baris_('Jam Pulang', r.jamPulang ? r.jamPulang.slice(0,5) : '—')}
        ${r.keterlambatanMenit > 0 ? baris_('Keterlambatan', r.keterlambatanMenit + ' menit') : ''}
      </div>`;
    if (r.masuk) {
      html += `<p class="detail-section-title">Validasi Masuk</p><div class="detail-section">
        ${baris_('Waktu', r.masuk.jam ? r.masuk.jam.slice(0,5) : '-')}
        ${r.masuk.akurasi !== null ? baris_('Akurasi GPS', '±' + Math.round(r.masuk.akurasi) + ' m') : ''}
        ${r.masuk.jarakMeter !== null ? baris_('Jarak dari Lokasi', '±' + r.masuk.jarakMeter + ' m') : ''}
        ${r.masuk.fotoUrl ? `<a href="${r.masuk.fotoUrl}" target="_blank" rel="noopener" class="detail-foto-link">Lihat Foto Masuk →</a>` : ''}
      </div>`;
    }
    if (r.pulang) {
      html += `<p class="detail-section-title">Validasi Pulang</p><div class="detail-section">
        ${baris_('Waktu', r.pulang.jam ? r.pulang.jam.slice(0,5) : '-')}
        ${r.pulang.akurasi !== null ? baris_('Akurasi GPS', '±' + Math.round(r.pulang.akurasi) + ' m') : ''}
        ${r.pulang.jarakMeter !== null ? baris_('Jarak dari Lokasi', '±' + r.pulang.jarakMeter + ' m') : ''}
        ${r.pulang.fotoUrl ? `<a href="${r.pulang.fotoUrl}" target="_blank" rel="noopener" class="detail-foto-link">Lihat Foto Pulang →</a>` : ''}
      </div>`;
    }
    document.getElementById('monDetailBody').innerHTML = html;
    document.getElementById('monDetailOverlay').classList.remove('is-hidden');
  }

  async function muatMonitoring(idOperasional) {
    const sesi = ambilSesiAdmin();
    if (!sesi || !sesi.token) return;
    try {
      showLoading('Memuat monitoring presensi...');
      const payload = { token: sesi.token };
      if (idOperasional) payload.idOperasional = idOperasional;
      const div = document.getElementById('monFilterDivisi').value;
      const shift = document.getElementById('monFilterShift').value;
      const status = document.getElementById('monFilterStatus').value;
      if (div) payload.divisi = div;
      if (shift) payload.shift = shift;
      if (status) payload.status = status;

      const hasil = await apiPost('getMonitoringPresensiAdmin', payload);
      hideLoading();

      document.getElementById('monitoringSub').textContent = hasil.periode
        ? `${hasil.periode.nama} (${hasil.periode.tanggalMulai} – ${hasil.periode.tanggalSelesai})` + (hasil.tanggalOperasional ? ' · Tanggal Operasional ' + hasil.tanggalOperasional : '')
        : 'Belum ada periode aktif.';

      const s = hasil.stats || {};
      document.getElementById('monTotalJadwal').textContent = s.totalJadwal || 0;
      document.getElementById('monHadir').textContent = s.hadir || 0;
      document.getElementById('monTerlambat').textContent = s.terlambat || 0;
      document.getElementById('monIzin').textContent = s.izin || 0;
      document.getElementById('monSakit').textContent = s.sakit || 0;
      document.getElementById('monTidakHadir').textContent = s.tidakHadir || 0;

      // Isi dropdown tanggal operasional (sekali saja per periode -- cek apakah sudah terisi)
      const selTgl = document.getElementById('monFilterTanggalOperasional');
      if (hasil.daftarTanggalOperasional && selTgl.dataset.filled !== hasil.periode.id) {
        selTgl.innerHTML = hasil.daftarTanggalOperasional.map(o =>
          `<option value="${o.idOperasional}">${o.hari}, ${o.tanggal}</option>`).join('');
        selTgl.dataset.filled = hasil.periode.id;
        if (hasil.idOperasional) selTgl.value = hasil.idOperasional;
      }
      // Isi dropdown divisi/shift (sekali saja)
      const selDiv = document.getElementById('monFilterDivisi');
      if (hasil.daftarDivisi && selDiv.dataset.filled !== '1') {
        hasil.daftarDivisi.forEach(d => selDiv.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`));
        selDiv.dataset.filled = '1';
      }
      const selShift = document.getElementById('monFilterShift');
      if (hasil.daftarShift && selShift.dataset.filled !== '1') {
        hasil.daftarShift.forEach(s2 => selShift.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(s2)}">${escapeHtml(s2)}</option>`));
        selShift.dataset.filled = '1';
      }

      monDataTerkini = hasil.data || [];
      renderMonitoringList(monDataTerkini);
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal memuat monitoring presensi.');
    }
  }

  // ============================================================
  // PENGAJUAN KETIDAKHADIRAN — ADMIN
  // ============================================================
  let pkDataTerkini = [];

  function renderPengajuanAdminList(data) {
    const list = document.getElementById('pengajuanAdminList');
    const kosong = document.getElementById('pengajuanAdminKosong');
    if (!data.length) { list.innerHTML = ''; kosong.style.display = 'block'; return; }
    kosong.style.display = 'none';
    list.innerHTML = data.map((p, i) => `
      <button type="button" class="riwayat-item is-${badgeClass(p.status)}" data-idx="${i}">
        <div class="riwayat-item-detail">
          <div class="riwayat-item-top">
            <strong class="riwayat-item-shift">${escapeHtml(p.namaRelawan)}</strong>
            <span class="riwayat-badge ${badgeClass(p.status)}">${p.status}</span>
          </div>
          <div class="riwayat-item-jam">${escapeHtml(p.divisi)} · ${p.jenis}</div>
          <div class="riwayat-item-jam">${p.tanggalMulai}${p.tanggalMulai !== p.tanggalSelesai ? ' – ' + p.tanggalSelesai : ''}</div>
        </div>
      </button>`).join('');
    list.querySelectorAll('.riwayat-item').forEach(el => {
      el.addEventListener('click', () => bukaPkDetail(data[Number(el.dataset.idx)]));
    });
  }

  function bukaPkDetail(p) {
    let html = `
      <div class="detail-sheet-head">
        <span class="riwayat-badge ${badgeClass(p.status)}">${p.status}</span>
        <h2>${escapeHtml(p.namaRelawan)}</h2>
      </div>
      <div class="detail-section">
        ${baris_('Divisi', escapeHtml(p.divisi))}
        ${baris_('Jenis Pengajuan', p.jenis)}
        ${baris_('Tanggal Mulai', p.tanggalMulai)}
        ${baris_('Tanggal Selesai', p.tanggalSelesai)}
        ${baris_('Alasan', escapeHtml(p.alasan))}
        ${p.dokumenUrl ? `<div class="detail-row"><span class="detail-row-label">Dokumen</span><a href="${p.dokumenUrl}" target="_blank" rel="noopener" class="detail-row-value" style="color:var(--color-sky-deep);">Lihat →</a></div>` : ''}
        ${baris_('Waktu Pengajuan', p.dibuatPada ? new Date(p.dibuatPada).toLocaleString('id-ID') : '-')}
      </div>`;
    if (p.status !== 'MENUNGGU' && p.catatanPengelola) {
      html += `<p class="detail-section-title">Catatan Pengelola</p><div class="detail-section"><div class="detail-row" style="display:block;padding:10px 0;">${escapeHtml(p.catatanPengelola)}</div></div>`;
    }
    if (p.status === 'MENUNGGU') {
      html += `
      <div style="display:flex;gap:10px;margin-top:18px;">
        <button type="button" class="btn-outline" id="btnTolakPkIni" style="flex:1;" data-id="${p.id}">Tolak</button>
        <button type="button" class="btn-submit" id="btnSetujuiPkIni" style="flex:1;margin-top:0;" data-id="${p.id}" data-jenis="${p.jenis}" data-mulai="${p.tanggalMulai}" data-selesai="${p.tanggalSelesai}">Setujui</button>
      </div>`;
    }

    document.getElementById('pkDetailBody').innerHTML = html;
    document.getElementById('pkDetailOverlay').classList.remove('is-hidden');

    const btnSetujui = document.getElementById('btnSetujuiPkIni');
    if (btnSetujui) btnSetujui.addEventListener('click', () => setujuiPengajuan(btnSetujui.dataset));
    const btnTolak = document.getElementById('btnTolakPkIni');
    if (btnTolak) btnTolak.addEventListener('click', () => bukaFormTolak(btnTolak.dataset.id));
  }

  async function setujuiPengajuan(data) {
    if (!confirm(`Setujui pengajuan ${data.jenis} tanggal ${data.mulai}${data.mulai !== data.selesai ? ' s/d ' + data.selesai : ''} ini?\n\nSetelah disetujui, status kehadiran pada tanggal terkait akan diperbarui sesuai jenis pengajuan.`)) return;
    const sesi = ambilSesiAdmin();
    try {
      showLoading('Memproses persetujuan...');
      const hasil = await apiPost('setujuiPengajuanKetidakhadiran', { token: sesi.token, id: data.id });
      hideLoading();
      document.getElementById('pkDetailOverlay').classList.add('is-hidden');
      if (hasil.tanggalTidakKetemu && hasil.tanggalTidakKetemu.length) {
        showError('Disetujui, tapi ' + hasil.tanggalTidakKetemu.length + ' tanggal belum punya roster (Shift/Penugasan belum diatur): ' + hasil.tanggalTidakKetemu.join(', '));
      }
      await muatRingkasanPk();
      await muatPengajuanAdmin();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal menyetujui pengajuan.');
    }
  }

  let idPkAkanDitolak = null;
  function bukaFormTolak(id) {
    idPkAkanDitolak = id;
    document.getElementById('pkCatatanTolak').value = '';
    document.getElementById('pkTolakOverlay').classList.remove('is-hidden');
  }

  async function konfirmasiTolak() {
    const catatan = document.getElementById('pkCatatanTolak').value.trim();
    if (!catatan) { showError('Catatan penolakan wajib diisi.'); return; }
    const sesi = ambilSesiAdmin();
    try {
      showLoading('Memproses penolakan...');
      await apiPost('tolakPengajuanKetidakhadiran', { token: sesi.token, id: idPkAkanDitolak, catatan: catatan });
      hideLoading();
      document.getElementById('pkTolakOverlay').classList.add('is-hidden');
      document.getElementById('pkDetailOverlay').classList.add('is-hidden');
      await muatRingkasanPk();
      await muatPengajuanAdmin();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal menolak pengajuan.');
    }
  }

  async function muatRingkasanPk() {
    const sesi = ambilSesiAdmin();
    if (!sesi || !sesi.token) return;
    try {
      const hasil = await apiGet('getRingkasanPengajuanKetidakhadiranAdmin', { token: sesi.token });
      document.getElementById('pkMenunggu').textContent = hasil.menunggu || 0;
      document.getElementById('pkDisetujui').textContent = hasil.disetujui || 0;
      document.getElementById('pkDitolak').textContent = hasil.ditolak || 0;
    } catch (err) { /* ringkasan gagal -- diamkan, panel utama tetap bisa jalan */ }
  }

  async function muatPengajuanAdmin() {
    const sesi = ambilSesiAdmin();
    if (!sesi || !sesi.token) return;
    try {
      showLoading('Memuat pengajuan ketidakhadiran...');
      const payload = { token: sesi.token };
      const status = document.getElementById('pkFilterStatus').value;
      const jenis = document.getElementById('pkFilterJenis').value;
      const divisi = document.getElementById('pkFilterDivisi').value;
      if (status) payload.status = status;
      if (jenis) payload.jenis = jenis;
      if (divisi) payload.divisi = divisi;

      const hasil = await apiPost('getPengajuanKetidakhadiranAdmin', payload);
      hideLoading();

      const selDiv = document.getElementById('pkFilterDivisi');
      if (selDiv.dataset.filled !== '1') {
        const divisiUnik = Array.from(new Set(hasil.map(p => p.divisi))).filter(Boolean).sort();
        divisiUnik.forEach(d => selDiv.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`));
        selDiv.dataset.filled = '1';
      }

      pkDataTerkini = hasil || [];
      renderPengajuanAdminList(pkDataTerkini);
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal memuat pengajuan ketidakhadiran.');
    }
  }

  // ============================================================
  // WIRING
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnMuatMonitoring').addEventListener('click', () => {
      const idOp = document.getElementById('monFilterTanggalOperasional').value;
      muatMonitoring(idOp);
    });
    document.getElementById('btnTutupMonDetail').addEventListener('click', () => document.getElementById('monDetailOverlay').classList.add('is-hidden'));
    document.getElementById('monDetailOverlay').addEventListener('click', (e) => { if (e.target.id === 'monDetailOverlay') e.target.classList.add('is-hidden'); });

    document.getElementById('btnMuatPengajuanAdmin').addEventListener('click', muatPengajuanAdmin);
    document.getElementById('btnTutupPkDetail').addEventListener('click', () => document.getElementById('pkDetailOverlay').classList.add('is-hidden'));
    document.getElementById('pkDetailOverlay').addEventListener('click', (e) => { if (e.target.id === 'pkDetailOverlay') e.target.classList.add('is-hidden'); });
    document.getElementById('btnBatalTolakPk').addEventListener('click', () => document.getElementById('pkTolakOverlay').classList.add('is-hidden'));
    document.getElementById('btnKonfirmasiTolakPk').addEventListener('click', konfirmasiTolak);

    // Muat data OTOMATIS begitu tab-nya pertama kali dibuka (bukan langsung
    // saat halaman admin dimuat -- §I "jangan langsung muat seluruh
    // database", cukup saat panelnya benar-benar dilihat).
    const tabMonitoring = document.querySelector('[data-panel="panelMonitoringPresensi"]');
    if (tabMonitoring) {
      let sudahDimuat = false;
      tabMonitoring.addEventListener('click', () => { if (!sudahDimuat) { sudahDimuat = true; muatMonitoring(); } });
    }
    const tabPengajuan = document.querySelector('[data-panel="panelPengajuanKetidakhadiranAdmin"]');
    if (tabPengajuan) {
      let sudahDimuat = false;
      tabPengajuan.addEventListener('click', () => { if (!sudahDimuat) { sudahDimuat = true; muatRingkasanPk(); muatPengajuanAdmin(); } });
    }
  });
})();

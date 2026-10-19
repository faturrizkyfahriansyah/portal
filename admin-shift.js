// ============================================================
// SPPG JEUNGJING — MODUL SHIFT & KOREKSI (Dashboard Admin)
// File BARU, terpisah dari admin.js. Memakai window.sppgAdminToken
// (hook yang sama dipakai admin-stok.js) dan fungsi bersama common.js.
// ============================================================

(function () {
  'use strict';

  const el = {
    tabBtn: document.querySelector('.admin-tab-btn[data-panel="panelShift"]'),
    subtabs: document.querySelectorAll('.shift-subtab'),
    subs: document.querySelectorAll('.shift-sub'),

    formShiftDivisi: document.getElementById('formShiftDivisi'),
    shiftDivisiPeriode: document.getElementById('shiftDivisiPeriode'),
    shiftDivisiNama: document.getElementById('shiftDivisiNama'),
    shiftDivisiJamMasuk: document.getElementById('shiftDivisiJamMasuk'),
    shiftDivisiJamPulang: document.getElementById('shiftDivisiJamPulang'),
    shiftDivisiKeterangan: document.getElementById('shiftDivisiKeterangan'),
    tbodyShiftDivisi: document.getElementById('tbodyShiftDivisi'),

    formPenugasanKhusus: document.getElementById('formPenugasanKhusus'),
    khususOperasional: document.getElementById('khususOperasional'),
    khususPeriode: document.getElementById('khususPeriode'),
    khususMingguKeterangan: document.getElementById('khususMingguKeterangan'),
    khususModeTanggalHari: document.getElementById('khususModeTanggalHari'),
    khususModeTanggalPeriode: document.getElementById('khususModeTanggalPeriode'),
    khususRelawan: document.getElementById('khususRelawan'),
    khususDivisi: document.getElementById('khususDivisi'),
    khususModeRelawanIndividu: document.getElementById('khususModeRelawanIndividu'),
    khususModeRelawanDivisi: document.getElementById('khususModeRelawanDivisi'),
    khususJamMasuk: document.getElementById('khususJamMasuk'),
    khususJamPulang: document.getElementById('khususJamPulang'),
    khususCatatan: document.getElementById('khususCatatan'),
    tbodyPenugasanKhusus: document.getElementById('tbodyPenugasanKhusus'),

    koreksiRelawan: document.getElementById('koreksiRelawan'),
    koreksiTanggalPresensi: document.getElementById('koreksiTanggalPresensi'),
    btnCariKoreksi: document.getElementById('btnCariKoreksi'),
    koreksiHasil: document.getElementById('koreksiHasil')
  };

  if (!el.tabBtn) return;

  const cache = { periode: [], kalender: [], relawan: [], divisi: [] };
  let sudahInit = false;

  function token() { return window.sppgAdminToken; }

  // --------------------------------------------------------
  // SUB-TAB
  // --------------------------------------------------------
  el.subtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      el.subtabs.forEach(b => b.classList.remove('active'));
      el.subs.forEach(s => { s.style.display = 'none'; });
      btn.classList.add('active');
      const target = document.getElementById('shiftSub' + btn.dataset.sub.charAt(0).toUpperCase() + btn.dataset.sub.slice(1));
      if (target) target.style.display = 'block';
    });
  });
  el.subtabs[0].classList.add('active');

  window.addEventListener('sppg-admin-ready', () => { if (!sudahInit) { sudahInit = true; initShift(); } });
  if (window.sppgAdminToken && !sudahInit) { sudahInit = true; initShift(); }

  async function initShift() {
    try {
      const [periode, divisi, relawan, kalender] = await Promise.all([
        apiGet('getPeriodeListAdmin', { token: token() }),
        apiGetCached('getDivisi', { token: token() }, 600000),
        apiGet('getRelawan', { semua: 1, token: token() }),
        apiGet('getKalenderListAdmin', { token: token() })
      ]);
      cache.periode = periode;
      cache.divisi = divisi;
      cache.relawan = relawan;
      cache.kalender = kalender;

      el.shiftDivisiPeriode.innerHTML = '<option value="">Pilih Periode...</option>' +
        periode.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nama)}</option>`).join('');
      el.shiftDivisiNama.innerHTML = '<option value="">Pilih Divisi...</option>' +
        divisi.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
      el.khususRelawan.innerHTML = '<option value="">Pilih Relawan...</option>' +
        relawan.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');
      el.khususDivisi.innerHTML = '<option value="">Pilih Divisi...</option>' +
        divisi.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
      // Multi-Shift (18 Okt 2026, SIKOP) -- pakai ulang data periode/divisi/relawan yg SAMA, tidak ada panggilan API baru.
      document.getElementById('msPeriode').innerHTML = '<option value="">Pilih Periode...</option>' +
        periode.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nama)}</option>`).join('');
      document.getElementById('msDivisi').innerHTML = '<option value="">Pilih Divisi...</option>' +
        divisi.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
      document.getElementById('krRelawan').innerHTML = '<option value="">Pilih Relawan...</option>' +
        relawan.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');
      // Pemeriksaan & Penetapan -- dropdown periode/divisi, pakai ulang data yg sama.
      document.getElementById('ptpPeriode').innerHTML = '<option value="">Pilih Periode...</option>' +
        periode.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nama)}</option>`).join('');
      document.getElementById('ptpDivisi').innerHTML = '<option value="">Pilih Divisi untuk Lihat Detail...</option>' +
        divisi.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
      // PERUBAHAN: khususPeriode sekarang <input type="date"> (pilih 1 minggu,
      // bukan lagi dropdown Periode) -- tidak perlu diisi dari daftar periode lagi.
      el.koreksiRelawan.innerHTML = '<option value="">Pilih Relawan...</option>' +
        relawan.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');
      el.khususOperasional.innerHTML = '<option value="">Pilih Tanggal Operasional...</option>' +
        kalender.map(k => `<option value="${escapeHtml(k.id)}">${escapeHtml(k.tanggal)} (${escapeHtml(k.namaPeriode)})</option>`).join('');
    } catch (err) {
      // diam-diam di init awal, pesan error akan muncul saat user benar-benar interaksi
    }
  }

  // --------------------------------------------------------
  // PENUGASAN KHUSUS -- TOGGLE MODE (Satu Hari/Periode, Individu/Divisi)
  // --------------------------------------------------------
  let modeTanggal = 'hari';   // 'hari' | 'periode'
  let modeRelawan = 'individu'; // 'individu' | 'divisi'

  el.khususModeTanggalHari.addEventListener('click', () => {
    modeTanggal = 'hari';
    el.khususModeTanggalHari.classList.add('primary');
    el.khususModeTanggalPeriode.classList.remove('primary');
    el.khususOperasional.style.display = '';
    el.khususPeriode.style.display = 'none';
    muatPenugasanKhusus();
  });
  el.khususModeTanggalPeriode.addEventListener('click', () => {
    modeTanggal = 'periode';
    el.khususModeTanggalPeriode.classList.add('primary');
    el.khususModeTanggalHari.classList.remove('primary');
    el.khususOperasional.style.display = 'none';
    el.khususPeriode.style.display = '';
    el.khususMingguKeterangan.style.display = '';
    el.tbodyPenugasanKhusus.innerHTML = '<tr><td colspan="5"><div class="empty-state">Daftar di bawah menampilkan penugasan per hari. Pilih "Satu Hari" untuk melihat daftarnya, atau lanjutkan di sini untuk membuat penugasan ke 1 minggu (7 hari) sekaligus.</div></td></tr>';
  });
  // PERUBAHAN: dulu "Satu Periode Penuh" (bisa 2+ minggu sekaligus), sekarang
  // dibatasi 1 minggu (7 hari) dari tanggal yang dipilih -- supaya cakupan
  // bulk-assign tidak terlalu luas/berisiko secara tidak sengaja.
  el.khususPeriode.addEventListener('change', () => {
    if (!el.khususPeriode.value) { el.khususMingguKeterangan.textContent = ''; return; }
    const mulai = new Date(el.khususPeriode.value + 'T00:00:00');
    const akhir = new Date(mulai.getTime() + 6 * 86400000);
    const fmt = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    el.khususMingguKeterangan.textContent = `Mencakup: ${fmt(mulai)} s/d ${fmt(akhir)} (7 hari)`;
  });
  el.khususModeRelawanIndividu.addEventListener('click', () => {
    modeRelawan = 'individu';
    el.khususModeRelawanIndividu.classList.add('primary');
    el.khususModeRelawanDivisi.classList.remove('primary');
    el.khususRelawan.style.display = '';
    el.khususDivisi.style.display = 'none';
  });
  el.khususModeRelawanDivisi.addEventListener('click', () => {
    modeRelawan = 'divisi';
    el.khususModeRelawanDivisi.classList.add('primary');
    el.khususModeRelawanIndividu.classList.remove('primary');
    el.khususRelawan.style.display = 'none';
    el.khususDivisi.style.display = '';
  });

  // --------------------------------------------------------
  // SHIFT DIVISI
  // --------------------------------------------------------
  el.shiftDivisiPeriode.addEventListener('change', muatShiftDivisi);

  async function muatShiftDivisi() {
    const idPeriode = el.shiftDivisiPeriode.value;
    if (!idPeriode) { el.tbodyShiftDivisi.innerHTML = '<tr><td colspan="5"><div class="empty-state">Pilih periode di atas dulu.</div></td></tr>'; return; }
    el.tbodyShiftDivisi.innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const list = await apiGet('getShiftDivisiListAdmin', { token: token(), idPeriode });
      if (!list.length) { el.tbodyShiftDivisi.innerHTML = '<tr><td colspan="5"><div class="empty-state">Belum ada Shift Divisi untuk periode ini.</div></td></tr>'; return; }
      const namaPeriode = (cache.periode.find(p => p.id === idPeriode) || {}).nama || idPeriode;
      el.tbodyShiftDivisi.innerHTML = list.map(s => `
        <tr>
          <td>${escapeHtml(namaPeriode)}</td>
          <td>${escapeHtml(s.namaDivisi)}</td>
          <td>${escapeHtml(s.jamMasuk)}</td>
          <td>${escapeHtml(s.jamPulang || '-')}</td>
          <td><button type="button" class="btn-mini" data-hapus-shift="${escapeHtml(s.id)}">Hapus</button></td>
        </tr>`).join('');
      el.tbodyShiftDivisi.querySelectorAll('[data-hapus-shift]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('deleteShiftDivisi', { token: token(), id: btn.dataset.hapusShift });
            showSuccess('Shift Divisi dihapus.');
            muatShiftDivisi();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      showError(err.message);
    }
  }

  el.formShiftDivisi.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('addShiftDivisi', {
        token: token(),
        idPeriode: el.shiftDivisiPeriode.value,
        namaDivisi: el.shiftDivisiNama.value,
        jamMasuk: el.shiftDivisiJamMasuk.value,
        jamPulang: el.shiftDivisiJamPulang.value,
        keterangan: el.shiftDivisiKeterangan.value.trim()
      });
      showSuccess('Shift Divisi tersimpan.');
      el.shiftDivisiJamMasuk.value = ''; el.shiftDivisiJamPulang.value = ''; el.shiftDivisiKeterangan.value = '';
      muatShiftDivisi();
    } catch (err) {
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // PENUGASAN KHUSUS
  // --------------------------------------------------------
  el.khususOperasional.addEventListener('change', muatPenugasanKhusus);

  async function muatPenugasanKhusus() {
    const idOperasional = el.khususOperasional.value;
    if (!idOperasional) { el.tbodyPenugasanKhusus.innerHTML = '<tr><td colspan="5"><div class="empty-state">Pilih tanggal operasional di atas dulu.</div></td></tr>'; return; }
    el.tbodyPenugasanKhusus.innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const list = await apiGet('getPenugasanKhususListAdmin', { token: token(), idOperasional });
      if (!list.length) { el.tbodyPenugasanKhusus.innerHTML = '<tr><td colspan="5"><div class="empty-state">Belum ada penugasan khusus untuk tanggal ini.</div></td></tr>'; return; }
      el.tbodyPenugasanKhusus.innerHTML = list.map(p => `
        <tr>
          <td>${escapeHtml(p.namaRelawan)}</td>
          <td>${escapeHtml(p.jamMasuk)}</td>
          <td>${escapeHtml(p.jamPulang || '-')}</td>
          <td>${escapeHtml(p.catatan || '-')}</td>
          <td><button type="button" class="btn-mini" data-hapus-khusus="${escapeHtml(p.id)}">Hapus</button></td>
        </tr>`).join('');
      el.tbodyPenugasanKhusus.querySelectorAll('[data-hapus-khusus]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('deletePenugasanKhusus', { token: token(), id: btn.dataset.hapusKhusus });
            showSuccess('Penugasan khusus dihapus.');
            muatPenugasanKhusus();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      showError(err.message);
    }
  }

  el.formPenugasanKhusus.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      token: token(),
      jamMasuk: el.khususJamMasuk.value,
      jamPulang: el.khususJamPulang.value,
      catatan: el.khususCatatan.value.trim()
    };

    if (modeTanggal === 'periode') {
      if (!el.khususPeriode.value) { showError('Pilih tanggal mulai minggu dulu.'); return; }
      payload.tanggalMulaiMinggu = el.khususPeriode.value;
    } else {
      if (!el.khususOperasional.value) { showError('Pilih Tanggal Operasional dulu.'); return; }
      payload.idOperasional = el.khususOperasional.value;
    }

    if (modeRelawan === 'divisi') {
      if (!el.khususDivisi.value) { showError('Pilih Divisi dulu.'); return; }
      payload.namaDivisi = el.khususDivisi.value;
    } else {
      if (!el.khususRelawan.value) { showError('Pilih Relawan dulu.'); return; }
      payload.idRelawan = el.khususRelawan.value;
    }

    // Konfirmasi kalau salah satu (atau keduanya) mode bulk aktif -- supaya
    // tidak ada yang tidak sengaja menugaskan seluruh divisi/periode.
    if (modeTanggal === 'periode' || modeRelawan === 'divisi') {
      const keterangan = [
        modeTanggal === 'periode' ? `1 minggu (7 hari) mulai ${el.khususPeriode.value}` : 'tanggal yang dipilih',
        modeRelawan === 'divisi' ? `seluruh relawan aktif di divisi "${el.khususDivisi.value}"` : 'relawan yang dipilih'
      ];
      if (!confirm(`Ini akan membuat/memperbarui penugasan khusus untuk ${keterangan[1]}, pada ${keterangan[0]}. Lanjutkan?`)) return;
    }

    try {
      const hasil = await apiPost('addPenugasanKhususBulk', payload);
      if (hasil.jumlah === 1) {
        showSuccess('Penugasan khusus tersimpan.');
      } else {
        showSuccess(`Penugasan khusus tersimpan untuk ${hasil.jumlah} kombinasi relawan/hari (${hasil.jumlahBaru} baru, ${hasil.jumlahDiperbarui} diperbarui).`);
      }
      el.khususJamMasuk.value = ''; el.khususJamPulang.value = ''; el.khususCatatan.value = '';
      if (modeTanggal === 'hari') muatPenugasanKhusus();
    } catch (err) {
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // KOREKSI TANGGAL OPERASIONAL
  // --------------------------------------------------------
  function keTanggalDMY_(inputDateValue) {
    // input[type=date] value = "yyyy-mm-dd" -> ubah ke "dd/MM/yyyy"
    if (!inputDateValue) return '';
    const [y, m, d] = inputDateValue.split('-');
    return d + '/' + m + '/' + y;
  }

  el.btnCariKoreksi.addEventListener('click', async () => {
    const idRelawan = el.koreksiRelawan.value;
    const tanggalPresensi = keTanggalDMY_(el.koreksiTanggalPresensi.value);
    if (!idRelawan || !tanggalPresensi) { showError('Pilih relawan dan tanggal presensi dulu.'); return; }

    el.koreksiHasil.innerHTML = '<div class="empty-state">Mencari...</div>';
    try {
      const hasil = await apiGet('cariAbsensiUntukKoreksi', { token: token(), idRelawan, tanggalPresensi });
      if (!hasil.length) { el.koreksiHasil.innerHTML = '<div class="empty-state">Tidak ada absensi ditemukan untuk relawan & tanggal ini.</div>'; return; }

      const opsiTujuan = '<option value="">Pilih tanggal operasional yang benar...</option>' +
        cache.kalender.map(k => `<option value="${escapeHtml(k.id)}">${escapeHtml(k.tanggal)} (${escapeHtml(k.namaPeriode)}) — ${escapeHtml(k.hari)}</option>`).join('');

      // PERBAIKAN: cariAbsensiUntukKoreksi (backend, desain roster-first --
      // satu baris = seluruh presensi 1 relawan utk 1 operasional) mengirim
      // field idAbsensi/jamMasuk/jamPulang/status -- BUKAN jenis/jam/
      // tanggalTercatatSaatIni yang dipakai kode lama ini. Akibatnya Jenis &
      // Jam selalu tampil kosong, DAN kedua tombol aksi tidak pernah
      // mengirim idAbsensi (padahal itu yang dicari backend) -- selalu
      // gagal "Data koreksi tidak lengkap." Diperbaiki memakai nama field
      // yang SUNGGUHAN dikembalikan backend.
      el.koreksiHasil.innerHTML = hasil.map((h, i) => `
        <div class="shift-koreksi-row">
          <div class="profile-identity-list">
            <div class="profile-identity-row"><span>Jam Masuk</span><span>${h.jamMasuk ? escapeHtml(h.jamMasuk) : '(belum absen masuk)'}</span></div>
            <div class="profile-identity-row"><span>Jam Pulang</span><span>${h.jamPulang ? escapeHtml(h.jamPulang) : '(belum absen pulang)'}</span></div>
            <div class="profile-identity-row"><span>Status</span><span>${escapeHtml(h.status || '-')}</span></div>
            <div class="profile-identity-row"><span>Tanggal Operasional Saat Ini</span><span>${escapeHtml(h.tanggalOperasionalSaatIni)}</span></div>
          </div>
          <select id="koreksiTujuan${i}">${opsiTujuan}</select>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-mini primary" style="margin-top:8px;" data-aksi-koreksi="${escapeHtml(h.idAbsensi)}" data-koreksi-tujuan-idx="${i}">Koreksi ke Tanggal Ini</button>
            ${!h.jamMasuk ? `<button type="button" class="btn-mini" style="margin-top:8px;color:#1a7a3c;" data-aksi-tandai-hadir="${escapeHtml(h.idAbsensi)}">✓ Tandai Hadir Manual</button>` : ''}
            <button type="button" class="btn-mini" style="margin-top:8px;color:#b23a3a;" data-aksi-hapus="${escapeHtml(h.idAbsensi)}">🗑️ Hapus Baris Ini</button>
          </div>
        </div>`).join('');

      el.koreksiHasil.querySelectorAll('[data-aksi-tandai-hadir]').forEach(btn => {
        btn.addEventListener('click', async () => {
          // Keterangan WAJIB -- ini memengaruhi rekap penggajian (lihat
          // catatan di tandaiHadirManual, Shift.gs), harus ada jejak audit.
          const keterangan = prompt('Alasan relawan ditandai Hadir manual (wajib diisi, akan tercatat untuk audit & memengaruhi rekap penggajian):');
          if (keterangan === null) return; // batal
          if (!keterangan.trim()) { showError('Alasan wajib diisi.'); return; }
          if (!confirm('Tandai relawan ini Hadir untuk tanggal operasional ini? Jam Masuk/Pulang akan diisi sesuai jadwal shift-nya.')) return;
          try {
            const hasilTandai = await apiPost('tandaiHadirManual', { token: token(), idAbsensi: btn.dataset.aksiTandaiHadir, keterangan: keterangan.trim() });
            showSuccess('Berhasil ditandai Hadir untuk operasional ' + hasilTandai.tanggalOperasional + '.');
            el.btnCariKoreksi.click();
          } catch (err) {
            showError(err.message);
          }
        });
      });

      el.koreksiHasil.querySelectorAll('[data-aksi-koreksi]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idOperasionalBaru = document.getElementById('koreksiTujuan' + btn.dataset.koreksiTujuanIdx).value;
          if (!idOperasionalBaru) { showError('Pilih tanggal operasional tujuan dulu.'); return; }
          if (!confirm('Yakin pindahkan baris absensi ini ke tanggal operasional yang dipilih? Jam/timestamp asli tidak berubah.')) return;
          try {
            const hasilKoreksi = await apiPost('koreksiTanggalOperasionalAbsensi', {
              token: token(), idAbsensi: btn.dataset.aksiKoreksi, idOperasionalBaru
            });
            showSuccess('Berhasil dikoreksi ke ' + hasilKoreksi.tanggalBaru + '.');
            el.btnCariKoreksi.click();
          } catch (err) {
            showError(err.message);
          }
        });
      });

      el.koreksiHasil.querySelectorAll('[data-aksi-hapus]').forEach(btn => {
        btn.addEventListener('click', async () => {
          // PERINGATAN GANDA (bukan cuma 1 confirm) -- ini penghapusan
          // permanen, dipakai antara lain untuk membuang data test yang
          // menempati slot operasional relawan asli (lihat error "Anda
          // sudah melakukan absensi masuk pada operasional ini.").
          if (!confirm('HAPUS PERMANEN baris absensi ini? Tindakan ini tidak bisa dibatalkan.')) return;
          if (!confirm('Konfirmasi sekali lagi: baris ini akan hilang selamanya dari 03_DATA_ABSENSI. Lanjutkan?')) return;
          try {
            await apiPost('hapusAbsensi', { token: token(), idAbsensi: btn.dataset.aksiHapus });
            showSuccess('Baris absensi berhasil dihapus.');
            el.btnCariKoreksi.click();
          } catch (err) {
            showError(err.message);
          }
        });
      });
    } catch (err) {
      el.koreksiHasil.innerHTML = '';
      showError(err.message);
    }
  });

  // ---- Isi Absen Massal (BARU) ----
  const btnIsiMassal = document.getElementById('btnIsiMassal');
  const isiMassalTanggal = document.getElementById('isiMassalTanggal');
  const isiMassalHasil = document.getElementById('isiMassalHasil');
  if (btnIsiMassal) {
    btnIsiMassal.addEventListener('click', async () => {
      if (!isiMassalTanggal.value) { showError('Pilih tanggal dulu.'); return; }
      const [y, m, d] = isiMassalTanggal.value.split('-');
      const tanggalIndo = `${d}/${m}/${y}`;
      if (!confirm(`Tandai SEMUA relawan aktif "Hadir" untuk tanggal ${tanggalIndo}?\n\nRelawan yang sudah punya data tidak akan ditimpa. Jam diambil otomatis dari shift masing-masing.`)) return;

      btnIsiMassal.disabled = true;
      isiMassalHasil.innerHTML = '<div class="empty-state">Memproses...</div>';
      try {
        const hasil = await apiPost('isiAbsensiHadirMassal', { token: token(), tanggal: tanggalIndo });
        let html = `<p style="font-size:13px;color:#1a7a4c;font-weight:700;margin:0 0 8px;">✅ ${hasil.jumlahDitambahkan} relawan berhasil diisi Hadir.</p>`;
        if (hasil.jumlahDilewatiSudahAda) {
          html += `<p style="font-size:12.5px;color:var(--color-text-muted);margin:0 0 4px;">⏭️ ${hasil.jumlahDilewatiSudahAda} dilewati (sudah ada data): ${escapeHtml(hasil.dilewatiSudahAda.join(', '))}</p>`;
        }
        if (hasil.jumlahDilewatiTanpaShift) {
          html += `<p style="font-size:12.5px;color:#b9852f;margin:0;">⚠️ ${hasil.jumlahDilewatiTanpaShift} dilewati (belum ada jadwal shift, perlu dicek manual): ${escapeHtml(hasil.dilewatiTanpaShift.join(', '))}</p>`;
        }
        isiMassalHasil.innerHTML = html;
        showSuccess('Selesai mengisi absen massal.');
      } catch (err) {
        isiMassalHasil.innerHTML = '';
        showError(err.message);
      } finally {
        btnIsiMassal.disabled = false;
      }
    });
  }

  // ============================================================
  // MULTI-SHIFT (18 Okt 2026, SIKOP) -- Security/Pengolahan/Persiapan
  // ============================================================
  const msPeriodeEl = document.getElementById('msPeriode');
  const msDivisiEl = document.getElementById('msDivisi');
  const msIsiEl = document.getElementById('msIsi');

  async function muatMultiShift_() {
    const idPeriode = msPeriodeEl.value, namaDivisi = msDivisiEl.value;
    if (!idPeriode || !namaDivisi) { msIsiEl.style.display = 'none'; return; }
    msIsiEl.style.display = 'block';
    try {
      const cfg = await apiPost('getKonfigurasiMultiShiftDivisi', { token: token(), idPeriode, namaDivisi });
      renderMsDetail_(cfg.detail);
      renderMsKelompok_(cfg.kelompok);
      renderMsOverride_(cfg.override);
    } catch (err) {
      showError(err.message || 'Gagal memuat konfigurasi multi-shift.');
    }
  }
  msPeriodeEl.addEventListener('change', muatMultiShift_);
  msDivisiEl.addEventListener('change', muatMultiShift_);

  function renderMsDetail_(list) {
    const tbody = document.getElementById('msTbodyDetail');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Belum ada pola shift.</div></td></tr>'; return; }
    tbody.innerHTML = list.map(d => `
      <tr>
        <td>Shift ${d.NOMOR_SHIFT}</td>
        <td>${escapeHtml(d.JAM_MASUK)}${d.JAM_PULANG ? ' - ' + escapeHtml(d.JAM_PULANG) : ''}</td>
        <td>${d.LINTAS_TENGAH_MALAM === true || d.LINTAS_TENGAH_MALAM === 'TRUE' ? 'Ya' : '-'}</td>
        <td>${d.POLA_ROTASI === 'MINGGUAN' ? 'Bertukar/minggu' : 'Tetap'}</td>
        <td>${d.HARI_KHUSUS ? escapeHtml(d.HARI_KHUSUS) + ' (' + escapeHtml(d.JAM_MASUK_HARI_KHUSUS || '-') + ')' : '-'}</td>
      </tr>`).join('');
  }

  function renderMsKelompok_(list) {
    const tbody = document.getElementById('msTbodyKelompok');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada relawan di-assign.</div></td></tr>'; return; }
    tbody.innerHTML = list.map(k => {
      const relawanObj = (cache.relawan || []).find(r => r.id === k.ID_RELAWAN);
      const shiftM1 = Number(k.SHIFT_MINGGU_1);
      const shiftM2 = shiftM1 === 1 ? 2 : 1;
      return `<tr>
        <td>${escapeHtml(relawanObj ? relawanObj.nama : k.ID_RELAWAN)}</td>
        <td>Kelompok ${escapeHtml(k.KELOMPOK)}</td>
        <td>Shift ${shiftM1}</td>
        <td>Shift ${shiftM2}</td>
      </tr>`;
    }).join('');
  }

  function renderMsOverride_(list) {
    const tbody = document.getElementById('msTbodyOverride');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada override.</div></td></tr>'; return; }
    tbody.innerHTML = list.map(o => `
      <tr>
        <td>${escapeHtml(o.TANGGAL_DMY)}</td>
        <td>Shift ${o.NOMOR_SHIFT}</td>
        <td>${escapeHtml(o.JAM_MASUK)}${o.JAM_PULANG ? ' - ' + escapeHtml(o.JAM_PULANG) : ''}</td>
        <td>${escapeHtml(o.KETERANGAN || '-')}</td>
      </tr>`).join('');
  }

  document.getElementById('formShiftDetail').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!msPeriodeEl.value || !msDivisiEl.value) { showError('Pilih periode dan divisi dulu.'); return; }
    showLoading('Menyimpan pola shift...');
    try {
      await apiPost('simpanShiftDivisiDetail', {
        token: token(), idPeriode: msPeriodeEl.value, namaDivisi: msDivisiEl.value,
        nomorShift: document.getElementById('msdNomorShift').value,
        jamMasuk: document.getElementById('msdJamMasuk').value,
        jamPulang: document.getElementById('msdJamPulang').value,
        lintasTengahMalam: document.getElementById('msdLintasTengahMalam').checked,
        polaRotasi: document.getElementById('msdPolaRotasi').value,
        hariKhusus: document.getElementById('msdHariKhusus').value.trim(),
        jamMasukHariKhusus: document.getElementById('msdJamMasukKhusus').value,
        jamPulangHariKhusus: document.getElementById('msdJamPulangKhusus').value
      });
      hideLoading();
      showSuccess('Pola shift tersimpan.');
      document.getElementById('formShiftDetail').reset();
      muatMultiShift_();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal menyimpan pola shift.');
    }
  });

  document.getElementById('formKelompokRotasi').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!msPeriodeEl.value || !msDivisiEl.value) { showError('Pilih periode dan divisi dulu.'); return; }
    showLoading('Menyimpan kelompok...');
    try {
      await apiPost('simpanKelompokRotasi', {
        token: token(), idPeriode: msPeriodeEl.value, namaDivisi: msDivisiEl.value,
        idRelawan: document.getElementById('krRelawan').value,
        kelompok: document.getElementById('krKelompok').value,
        shiftMinggu1: document.getElementById('krShiftMinggu1').value
      });
      hideLoading();
      showSuccess('Kelompok tersimpan.');
      document.getElementById('formKelompokRotasi').reset();
      muatMultiShift_();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal menyimpan kelompok.');
    }
  });

  document.getElementById('formOverrideTanggal').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!msPeriodeEl.value || !msDivisiEl.value) { showError('Pilih periode dan divisi dulu.'); return; }
    const tanggalIso = document.getElementById('ovtTanggal').value;
    if (!tanggalIso) { showError('Tanggal wajib diisi.'); return; }
    const bagian = tanggalIso.split('-');
    const tanggalDMY = bagian[2] + '/' + bagian[1] + '/' + bagian[0];
    showLoading('Menyimpan override...');
    try {
      await apiPost('simpanOverrideShiftTanggal', {
        token: token(), idPeriode: msPeriodeEl.value, namaDivisi: msDivisiEl.value,
        tanggalDMY: tanggalDMY,
        nomorShift: document.getElementById('ovtNomorShift').value,
        jamMasuk: document.getElementById('ovtJamMasuk').value,
        jamPulang: document.getElementById('ovtJamPulang').value,
        keterangan: document.getElementById('ovtKeterangan').value.trim()
      });
      hideLoading();
      showSuccess('Override tersimpan.');
      document.getElementById('formOverrideTanggal').reset();
      muatMultiShift_();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal menyimpan override.');
    }
  });

  // ============================================================
  // PEMERIKSAAN & PENETAPAN (18 Okt 2026, SIKOP)
  // ============================================================
  const ptpPeriodeEl = document.getElementById('ptpPeriode');
  const ptpDivisiEl = document.getElementById('ptpDivisi');

  async function muatRingkasanPemeriksaan_() {
    const idPeriode = ptpPeriodeEl.value;
    const el = document.getElementById('ptpRingkasan');
    if (!idPeriode) { el.innerHTML = ''; return; }
    el.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const r = await apiPost('getRingkasanPemeriksaanPeriode', { token: token(), idPeriode });
      el.innerHTML = `
        <div class="admin-stat-grid" style="grid-template-columns:repeat(4,1fr);">
          <div class="admin-stat-card"><div class="admin-stat-value">${r.totalDivisi}</div><div class="admin-stat-label">Total Divisi</div></div>
          <div class="admin-stat-card accent-success"><div class="admin-stat-value">${r.divisiSiap}</div><div class="admin-stat-label">Divisi Siap</div></div>
          <div class="admin-stat-card accent-warning"><div class="admin-stat-value">${r.divisiBermasalah}</div><div class="admin-stat-label">Divisi Bermasalah</div></div>
          <div class="admin-stat-card accent-danger"><div class="admin-stat-value">${r.totalKesalahan}</div><div class="admin-stat-label">Total Kesalahan</div></div>
        </div>
        <p style="font-size:11px;color:var(--color-text-muted);margin-top:8px;">Mencakup kelengkapan shift wajib, kesesuaian rotasi mingguan, dan pola hari khusus (masuk bersama) untuk divisi Multi-Shift. Bentrok jam lintas-divisi belum tercakup.</p>`;
    } catch (err) {
      el.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }
  ptpPeriodeEl.addEventListener('change', () => { muatRingkasanPemeriksaan_(); muatDetailPenetapan_(); });
  ptpDivisiEl.addEventListener('change', muatDetailPenetapan_);

  async function muatDetailPenetapan_() {
    const idPeriode = ptpPeriodeEl.value, namaDivisi = ptpDivisiEl.value;
    const el = document.getElementById('ptpDetail');
    if (!idPeriode || !namaDivisi) { el.innerHTML = ''; return; }
    el.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const s = await apiPost('getStatusPenetapanAdmin', { token: token(), idPeriode, namaDivisi });
      const warnaBadge = { DRAFT: 'nonaktif', PERLU_PERBAIKAN: 'tidak-hadir', SIAP_DITETAPKAN: 'aktif', DITETAPKAN: 'aktif' }[s.status] || 'nonaktif';
      const labelStatus = { DRAFT: 'Draft', PERLU_PERBAIKAN: 'Perlu Perbaikan', SIAP_DITETAPKAN: 'Siap Ditetapkan', DITETAPKAN: 'Ditetapkan' }[s.status] || s.status;

      let html = `
        <div class="panel-block">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            <div><b>${escapeHtml(namaDivisi)}</b> — <span class="badge ${warnaBadge}">${labelStatus}</span>${s.versiAktif ? ' · Versi ' + s.versiAktif : ''}</div>
            ${s.statusSinkronisasi ? `<span style="font-size:12px;color:var(--color-text-muted);">Sinkronisasi: ${s.statusSinkronisasi === 'TERSINKRON' ? '✅ Tersinkron' : s.statusSinkronisasi === 'GAGAL' ? '⚠️ Gagal' : s.statusSinkronisasi}</span>` : ''}
          </div>`;

      if (s.validasi.jumlahKesalahan > 0) {
        html += `<div style="background:#fdecea;border-radius:8px;padding:10px 12px;margin-bottom:12px;">
          <p style="margin:0 0 6px;font-weight:700;color:#b3261e;">⚠ ${s.validasi.jumlahKesalahan} Kesalahan</p>
          ${s.validasi.kesalahan.slice(0, 10).map(k => `<p style="margin:3px 0;font-size:12.5px;">${escapeHtml(k.penjelasan)}</p>`).join('')}
          ${s.validasi.kesalahan.length > 10 ? `<p style="margin:4px 0 0;font-size:11px;color:var(--color-text-muted);">...dan ${s.validasi.kesalahan.length - 10} lainnya</p>` : ''}
        </div>`;
      }

      html += `<div style="display:flex;gap:8px;flex-wrap:wrap;">`;
      if (s.status === 'SIAP_DITETAPKAN' || (s.status === 'DITETAPKAN' && confirm)) {
        html += `<button type="button" class="btn-mini primary" id="ptpBtnTetapkan" ${s.validasi.valid ? '' : 'disabled'}>${s.status === 'DITETAPKAN' ? 'Tetapkan Ulang (Revisi)' : 'Tetapkan Jadwal Divisi'}</button>`;
      }
      if (s.statusSinkronisasi === 'GAGAL') {
        html += `<button type="button" class="btn-mini" id="ptpBtnSinkronUlang">🔄 Coba Sinkronisasi Ulang</button>`;
      }
      html += `</div><div id="ptpRiwayat" style="margin-top:14px;"></div></div>`;
      el.innerHTML = html;

      const btnTetapkan = document.getElementById('ptpBtnTetapkan');
      if (btnTetapkan) btnTetapkan.addEventListener('click', async () => {
        let alasan = '';
        if (s.status === 'DITETAPKAN') {
          alasan = prompt('Ini akan membuat versi resmi BARU (revisi). Alasan revisi:') || '';
          if (!alasan) { showError('Alasan revisi wajib diisi untuk penetapan ulang.'); return; }
        }
        if (!confirm(`Tetapkan jadwal ${namaDivisi} untuk periode ini sebagai versi resmi?`)) return;
        showLoading('Menetapkan jadwal...');
        try {
          const hasil = await apiPost('tetapkanJadwalDivisi', { token: token(), idPeriode, namaDivisi, alasanRevisi: alasan });
          hideLoading();
          showSuccess(`Jadwal ditetapkan sebagai Versi ${hasil.versi} (${hasil.jumlahBaris} baris). Sinkronisasi: ${hasil.statusSinkronisasi}.`);
          muatDetailPenetapan_();
          muatRingkasanPemeriksaan_();
        } catch (err) {
          hideLoading();
          showError(err.message || 'Gagal menetapkan jadwal.');
        }
      });

      const btnSinkronUlang = document.getElementById('ptpBtnSinkronUlang');
      if (btnSinkronUlang) btnSinkronUlang.addEventListener('click', async () => {
        showLoading('Mencoba sinkronisasi ulang...');
        try {
          const hasil = await apiPost('cobaSinkronisasiUlang', { token: token(), idPeriode, namaDivisi });
          hideLoading();
          showSuccess('Status sinkronisasi: ' + hasil.statusSinkronisasi);
          muatDetailPenetapan_();
        } catch (err) {
          hideLoading();
          showError(err.message || 'Gagal sinkronisasi ulang.');
        }
      });

      // Riwayat
      const riwayat = await apiPost('getRiwayatPenetapanDivisi', { token: token(), idPeriode, namaDivisi });
      const elRiwayat = document.getElementById('ptpRiwayat');
      if (riwayat.length) {
        elRiwayat.innerHTML = '<p style="font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;margin:0 0 6px;">Riwayat</p>' +
          riwayat.map(r => `<p style="font-size:12px;margin:3px 0;">${new Date(r.waktu).toLocaleString('id-ID')} — ${r.aksi === 'TETAPKAN_JADWAL_DIVISI' ? 'Ditetapkan Versi ' + r.detail.versi : 'Sinkronisasi ulang'} oleh ${escapeHtml(r.pelaku)}</p>`).join('');
      }
    } catch (err) {
      el.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }
})();

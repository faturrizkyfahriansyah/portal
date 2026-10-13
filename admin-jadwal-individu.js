// admin-jadwal-individu.js — Pemeriksaan & Pengeditan Jadwal Individu
// (Pengembangan Portal Pengelola, poin 4-5). Lazy-loaded via MODUL_LAZY
// (admin.js) saat panelJadwalIndividu dibuka -- pola sama dgn
// admin-shift.js/admin-stok.js di file ini.
(function () {
  function token() { return window.sppgAdminToken; } // pola sama persis dgn admin-shift.js/admin-stok.js -- tiap modul lazy-load mendefinisikan sendiri

  const el = {
    periode: document.getElementById('jiPeriode'),
    pilihRelawan: document.getElementById('jiPilihRelawan'),
    hasil: document.getElementById('jiHasil'),
    namaRelawan: document.getElementById('jiNamaRelawan'),
    divisiRelawan: document.getElementById('jiDivisiRelawan'),
    target: document.getElementById('jiTarget'),
    terjadwal: document.getElementById('jiTerjadwal'),
    statusBadge: document.getElementById('jiStatusBadge'),
    anomali: document.getElementById('jiAnomaliPeringatan'),
    tbody: document.getElementById('jiTbody'),
    kartuForm: document.getElementById('jiKartuForm'),
    judulForm: document.getElementById('jiJudulForm'),
    subjudulForm: document.getElementById('jiSubjudulForm'),
    blokStatus: document.getElementById('jiBlokStatus'),
    statusBaru: document.getElementById('jiStatusBaru'),
    blokJam: document.getElementById('jiBlokJam'),
    jamMasuk: document.getElementById('jiJamMasuk'),
    jamPulang: document.getElementById('jiJamPulang'),
    catatan: document.getElementById('jiCatatan'),
    btnSimpan: document.getElementById('jiBtnSimpan'),
    btnBatal: document.getElementById('jiBtnBatal')
  };

  const LABEL_STATUS = { sesuai: 'Sesuai Target', kurang: 'Kurang dari Target', berlebih: 'Lebih dari Target', perlu_diperiksa: 'Perlu Diperiksa' };
  const KELAS_STATUS = { sesuai: 'aktif', kurang: 'nonaktif', berlebih: 'nonaktif', perlu_diperiksa: 'nonaktif' };

  let daftarRelawanSemua = [];
  let relawanTerpilih = null;
  let idOperasionalSedangDiedit = null; // dipakai saat Buat Jadwal (tanggal kosong)
  let idAbsensiSedangDiedit = null;     // dipakai saat Edit Jadwal (sudah ada baris, belum absen)
  let idKoreksiSedangDiedit = null;     // dipakai saat Koreksi Absen (sudah ada baris, SUDAH absen)

  async function muatPeriode() {
    try {
      const daftar = await apiGet('getPeriodeListAdmin', { token: token() });
      el.periode.innerHTML = '<option value="">Pilih periode...</option>' +
        daftar.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nama)} (${escapeHtml(p.tanggalMulai)} - ${escapeHtml(p.tanggalSelesai)})</option>`).join('');
      const aktif = daftar.find(p => String(p.status).toUpperCase() === 'AKTIF');
      if (aktif) el.periode.value = aktif.id;
    } catch (err) { showError(err.message); }
  }

  async function muatDaftarRelawan() {
    try {
      daftarRelawanSemua = await apiPost('getDaftarRelawanUntukJadwalIndividu', { token: token() });
      const terurut = [...daftarRelawanSemua].sort((a, b) => a.nama.localeCompare(b.nama));
      el.pilihRelawan.innerHTML = '<option value="">Pilih relawan...</option>' +
        terurut.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)} — ${escapeHtml(r.divisi)}</option>`).join('');
    } catch (err) { showError(err.message); }
  }

  el.pilihRelawan.addEventListener('change', () => {
    relawanTerpilih = daftarRelawanSemua.find(r => r.id === el.pilihRelawan.value) || null;
    if (relawanTerpilih) muatPemeriksaan();
    else el.hasil.style.display = 'none';
  });

  el.periode.addEventListener('change', () => { if (relawanTerpilih) muatPemeriksaan(); });

  async function muatPemeriksaan() {
    if (!el.periode.value || !relawanTerpilih) return;
    el.hasil.style.display = 'block';
    el.tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const d = await apiPost('getJadwalIndividuRelawan', { token: token(), idPeriode: el.periode.value, idRelawan: relawanTerpilih.id });
      el.namaRelawan.textContent = d.relawan.nama;
      el.divisiRelawan.textContent = d.relawan.divisi;
      el.target.textContent = d.targetHariKerja;
      el.terjadwal.textContent = d.terjadwal;
      el.statusBadge.textContent = LABEL_STATUS[d.status] || d.status;
      el.statusBadge.className = 'badge ' + (KELAS_STATUS[d.status] || '');
      if (d.jumlahAnomali) {
        el.anomali.style.display = 'block';
        el.anomali.textContent = '⚠️ ' + d.jumlahAnomali + ' baris jadwal relawan ini tercatat di luar Kalender Operasional periode ini -- perlu diperiksa manual.';
      } else { el.anomali.style.display = 'none'; }

      el.tbody.innerHTML = d.daftarTanggal.map(t => {
        const statusSel = t.adaJadwal
          ? `<span class="badge aktif">${escapeHtml(t.statusKehadiran || '-')}</span>`
          : (t.perluDibuat ? '<span class="badge nonaktif">Belum Dibuat</span>' : '<span style="color:var(--color-text-muted);">-</span>');
        // Pakai statusKehadiran (bukan statusMasuk) -- krn Koreksi Absen bisa
        // mengubah baris jadi IZIN/SAKIT/CUTI dgn statusMasuk kembali ke
        // 'BELUM', tapi baris itu TETAP sudah "terisi" & harus tetap
        // tampil Koreksi Absen, bukan balik ke Edit/Hapus.
        const sudahAbsen = t.adaJadwal && t.statusKehadiran && t.statusKehadiran !== 'BELUM ABSEN';
        const tombol = sudahAbsen
          ? `<button type="button" class="btn-mini" data-koreksi="${escapeHtml(t.idAbsensi)}">Koreksi Absen</button>`
          : t.adaJadwal
          ? `<button type="button" class="btn-mini" data-edit="${escapeHtml(t.idAbsensi)}">Edit</button> <button type="button" class="btn-mini" style="color:var(--color-danger);" data-hapus="${escapeHtml(t.idAbsensi)}">Hapus</button>`
          : (t.perluDibuat ? `<button type="button" class="btn-mini primary" data-buat="${escapeHtml(t.idOperasional)}" data-tanggal="${escapeHtml(t.tanggal)}">Buat Jadwal</button>` : '');
        return `<tr${t.perluDibuat ? ' style="background:#fdf1de;"' : ''}>
          <td>${escapeHtml(t.tanggal)}</td><td>${escapeHtml(t.hari || '-')}</td>
          <td>${escapeHtml(t.divisi || '-')}</td><td>${escapeHtml(t.jenisPenugasan || '-')}</td>
          <td>${escapeHtml(t.jamMasuk || '-')}</td><td>${escapeHtml(t.jamPulang || '-')}</td>
          <td>${escapeHtml(t.catatan || '-')}</td><td>${statusSel}</td><td>${tombol}</td>
        </tr>`;
      }).join('');

      el.tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => bukaFormEdit(btn.dataset.edit, d.daftarTanggal)));
      el.tbody.querySelectorAll('[data-buat]').forEach(btn => btn.addEventListener('click', () => bukaFormBuat(btn.dataset.buat, btn.dataset.tanggal)));
      el.tbody.querySelectorAll('[data-hapus]').forEach(btn => btn.addEventListener('click', () => hapusJadwal(btn.dataset.hapus)));
      el.tbody.querySelectorAll('[data-koreksi]').forEach(btn => btn.addEventListener('click', () => bukaFormKoreksi(btn.dataset.koreksi, d.daftarTanggal)));
    } catch (err) {
      el.tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">❌ ${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  function bukaFormBuat(idOperasional, tanggal) {
    idOperasionalSedangDiedit = idOperasional;
    idAbsensiSedangDiedit = null;
    idKoreksiSedangDiedit = null;
    el.judulForm.textContent = 'Buat Jadwal';
    el.subjudulForm.textContent = relawanTerpilih.nama + ' · ' + tanggal;
    el.blokStatus.style.display = 'none';
    el.blokJam.style.display = 'flex';
    el.jamMasuk.value = ''; el.jamPulang.value = ''; el.catatan.value = '';
    el.catatan.placeholder = 'Catatan penugasan (opsional)';
    el.kartuForm.style.display = 'block';
    el.kartuForm.scrollIntoView({ behavior: 'smooth' });
  }

  function bukaFormEdit(idAbsensi, daftarTanggal) {
    const baris = daftarTanggal.find(t => t.idAbsensi === idAbsensi);
    if (!baris) return;
    idAbsensiSedangDiedit = idAbsensi;
    idOperasionalSedangDiedit = null;
    idKoreksiSedangDiedit = null;
    el.judulForm.textContent = 'Edit Jadwal';
    el.subjudulForm.textContent = relawanTerpilih.nama + ' · ' + baris.tanggal;
    el.blokStatus.style.display = 'none';
    el.blokJam.style.display = 'flex';
    el.jamMasuk.value = baris.jamMasuk || '';
    el.jamPulang.value = baris.jamPulang || '';
    el.catatan.value = baris.catatan || '';
    el.catatan.placeholder = 'Catatan penugasan (opsional)';
    el.kartuForm.style.display = 'block';
    el.kartuForm.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Koreksi Absen -- BEDA dari Edit Jadwal: ini membetulkan jam yg SUDAH
   * TERCATAT hasil scan sungguhan (jamMasukAktual/jamPulangAktual), bukan
   * jam rencana. Keterangan WAJIB diisi (dipakai sbg textarea catatan yg
   * sama, tapi labelnya diganti supaya jelas ini wajib & akan tercatat
   * audit -- lihat koreksiAbsensiAktual di backend).
   */
  function perbaruiTampilanBlokJam() {
    el.blokJam.style.display = el.statusBaru.value === 'HADIR' ? 'flex' : 'none';
  }

  function bukaFormKoreksi(idAbsensi, daftarTanggal) {
    const baris = daftarTanggal.find(t => t.idAbsensi === idAbsensi);
    if (!baris) return;
    idKoreksiSedangDiedit = idAbsensi;
    idAbsensiSedangDiedit = null;
    idOperasionalSedangDiedit = null;
    el.judulForm.textContent = 'Koreksi Absen';
    el.subjudulForm.textContent = relawanTerpilih.nama + ' · ' + baris.tanggal;
    el.blokStatus.style.display = 'block';
    el.statusBaru.value = 'HADIR';
    perbaruiTampilanBlokJam();
    el.jamMasuk.value = baris.jamMasukAktual || '';
    el.jamPulang.value = baris.jamPulangAktual || '';
    el.catatan.value = '';
    el.catatan.placeholder = 'Alasan koreksi (WAJIB diisi -- tercatat untuk audit & rekap penggajian)';
    el.kartuForm.style.display = 'block';
    el.kartuForm.scrollIntoView({ behavior: 'smooth' });
  }
  el.statusBaru.addEventListener('change', perbaruiTampilanBlokJam);

  async function hapusJadwal(idAbsensi) {
    if (!confirm('Hapus jadwal ini sepenuhnya? Tindakan ini tidak bisa dibatalkan.\n\nCatatan: hanya bisa dihapus kalau relawan belum pernah absen di tanggal ini -- kalau sudah ada absensi sungguhan, sistem akan menolak.')) return;
    try {
      await apiPost('hapusJadwalIndividu', { token: token(), idAbsensi });
      showSuccess('Jadwal berhasil dihapus.');
      muatPemeriksaan(); // muat ulang -- Target/Terjadwal otomatis ikut terkoreksi
    } catch (err) { showError(err.message); }
  }

  el.btnBatal.addEventListener('click', () => { el.kartuForm.style.display = 'none'; });

  el.btnSimpan.addEventListener('click', async () => {
    if (idKoreksiSedangDiedit) {
      if (!el.catatan.value.trim()) { showError('Alasan koreksi wajib diisi (tercatat utk audit & rekap penggajian).'); return; }
      if (el.statusBaru.value === 'HADIR') {
        if (!el.jamMasuk.value || !el.jamPulang.value) { showError('Jam masuk & jam pulang wajib diisi utk status Hadir.'); return; }
      }
    } else {
      if (!el.jamMasuk.value) { showError('Jam masuk wajib diisi.'); return; }
    }
    const label = { HADIR: 'Hadir', IZIN: 'Izin', SAKIT: 'Sakit', CUTI: 'Cuti', ALFA: 'Alfa' }[el.statusBaru.value] || '';
    const konfirmasi = idKoreksiSedangDiedit
      ? 'Ubah status kehadiran jadi "' + label + '"? Perubahan ini memengaruhi data kehadiran & rekap penggajian, dan akan tercatat di riwayat audit.'
      : idAbsensiSedangDiedit
      ? 'Simpan perubahan jadwal ini? Jam absensi yang SUDAH tercatat (kalau ada) tidak akan berubah -- ini hanya mengubah jadwal rencananya.'
      : 'Buat jadwal baru untuk relawan ini di tanggal tersebut?';
    if (!confirm(konfirmasi)) return;

    try {
      if (idKoreksiSedangDiedit) {
        await apiPost('koreksiAbsensiAktual', { token: token(), idAbsensi: idKoreksiSedangDiedit, statusBaru: el.statusBaru.value, jamMasuk: el.jamMasuk.value, jamPulang: el.jamPulang.value, keterangan: el.catatan.value });
      } else if (idAbsensiSedangDiedit) {
        await apiPost('ubahJadwalIndividu', { token: token(), idAbsensi: idAbsensiSedangDiedit, jamMasuk: el.jamMasuk.value, jamPulang: el.jamPulang.value, catatan: el.catatan.value });
      } else {
        await apiPost('buatJadwalIndividu', { token: token(), idOperasional: idOperasionalSedangDiedit, idRelawan: relawanTerpilih.id, jamMasuk: el.jamMasuk.value, jamPulang: el.jamPulang.value, catatan: el.catatan.value });
      }
      showSuccess(idKoreksiSedangDiedit ? 'Absen berhasil dikoreksi.' : 'Jadwal berhasil disimpan.');
      el.kartuForm.style.display = 'none';
      muatPemeriksaan(); // muat ulang -- otomatis mencerminkan data tersimpan terbaru, termasuk target/terjadwal/status
    } catch (err) { showError(err.message); }
  });

  muatPeriode();
  muatDaftarRelawan();
})();

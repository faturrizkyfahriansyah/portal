// admin-jadwal-individu.js — Pemeriksaan & Pengeditan Jadwal Individu
// (Pengembangan Portal Pengelola, poin 4-5). Lazy-loaded via MODUL_LAZY
// (admin.js) saat panelJadwalIndividu dibuka -- pola sama dgn
// admin-shift.js/admin-stok.js di file ini.
(function () {
  function token() { return window.sppgAdminToken; } // pola sama persis dgn admin-shift.js/admin-stok.js -- tiap modul lazy-load mendefinisikan sendiri

  const el = {
    periode: document.getElementById('jiPeriode'),
    cariRelawan: document.getElementById('jiCariRelawan'),
    daftarCari: document.getElementById('jiDaftarRelawanCari'),
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
  let idAbsensiSedangDiedit = null;     // dipakai saat Edit Jadwal (sudah ada baris)

  async function muatPeriode() {
    try {
      const daftar = await apiPost('getPeriodeListAdmin', { token: token() });
      el.periode.innerHTML = '<option value="">Pilih periode...</option>' +
        daftar.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nama)} (${escapeHtml(p.tanggalMulai)} - ${escapeHtml(p.tanggalSelesai)})</option>`).join('');
      const aktif = daftar.find(p => String(p.status).toUpperCase() === 'AKTIF');
      if (aktif) el.periode.value = aktif.id;
    } catch (err) { showError(err.message); }
  }

  async function muatDaftarRelawan() {
    if (daftarRelawanSemua.length) return;
    try { daftarRelawanSemua = await apiPost('getDaftarRelawanUntukJadwalIndividu', { token: token() }); }
    catch (err) { showError(err.message); }
  }

  el.cariRelawan.addEventListener('input', async () => {
    await muatDaftarRelawan();
    const q = el.cariRelawan.value.trim().toLowerCase();
    if (!q) { el.daftarCari.style.display = 'none'; return; }
    const cocok = daftarRelawanSemua.filter(r => r.nama.toLowerCase().includes(q)).slice(0, 15);
    if (!cocok.length) { el.daftarCari.innerHTML = '<div class="empty-state">Tidak ada relawan yang cocok.</div>'; el.daftarCari.style.display = 'block'; return; }
    el.daftarCari.innerHTML = '<table><tbody>' + cocok.map(r =>
      `<tr style="cursor:pointer;" data-id="${escapeHtml(r.id)}"><td>${escapeHtml(r.nama)}</td><td style="color:var(--color-text-muted);">${escapeHtml(r.divisi)}</td></tr>`
    ).join('') + '</tbody></table>';
    el.daftarCari.style.display = 'block';
    el.daftarCari.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        relawanTerpilih = daftarRelawanSemua.find(r => r.id === tr.dataset.id);
        el.cariRelawan.value = relawanTerpilih.nama;
        el.daftarCari.style.display = 'none';
        muatPemeriksaan();
      });
    });
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
        const tombol = t.adaJadwal
          ? `<button type="button" class="btn-mini" data-edit="${escapeHtml(t.idAbsensi)}">Edit</button>`
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
    } catch (err) {
      el.tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">❌ ${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  function bukaFormBuat(idOperasional, tanggal) {
    idOperasionalSedangDiedit = idOperasional;
    idAbsensiSedangDiedit = null;
    el.judulForm.textContent = 'Buat Jadwal';
    el.subjudulForm.textContent = relawanTerpilih.nama + ' · ' + tanggal;
    el.jamMasuk.value = ''; el.jamPulang.value = ''; el.catatan.value = '';
    el.kartuForm.style.display = 'block';
    el.kartuForm.scrollIntoView({ behavior: 'smooth' });
  }

  function bukaFormEdit(idAbsensi, daftarTanggal) {
    const baris = daftarTanggal.find(t => t.idAbsensi === idAbsensi);
    if (!baris) return;
    idAbsensiSedangDiedit = idAbsensi;
    idOperasionalSedangDiedit = null;
    el.judulForm.textContent = 'Edit Jadwal';
    el.subjudulForm.textContent = relawanTerpilih.nama + ' · ' + baris.tanggal;
    el.jamMasuk.value = baris.jamMasuk || '';
    el.jamPulang.value = baris.jamPulang || '';
    el.catatan.value = baris.catatan || '';
    el.kartuForm.style.display = 'block';
    el.kartuForm.scrollIntoView({ behavior: 'smooth' });
  }

  el.btnBatal.addEventListener('click', () => { el.kartuForm.style.display = 'none'; });

  el.btnSimpan.addEventListener('click', async () => {
    if (!el.jamMasuk.value) { showError('Jam masuk wajib diisi.'); return; }
    const konfirmasi = idAbsensiSedangDiedit
      ? 'Simpan perubahan jadwal ini? Jam absensi yang SUDAH tercatat (kalau ada) tidak akan berubah -- ini hanya mengubah jadwal rencananya.'
      : 'Buat jadwal baru untuk relawan ini di tanggal tersebut?';
    if (!confirm(konfirmasi)) return;

    try {
      if (idAbsensiSedangDiedit) {
        await apiPost('ubahJadwalIndividu', { token: token(), idAbsensi: idAbsensiSedangDiedit, jamMasuk: el.jamMasuk.value, jamPulang: el.jamPulang.value, catatan: el.catatan.value });
      } else {
        await apiPost('buatJadwalIndividu', { token: token(), idOperasional: idOperasionalSedangDiedit, idRelawan: relawanTerpilih.id, jamMasuk: el.jamMasuk.value, jamPulang: el.jamPulang.value, catatan: el.catatan.value });
      }
      showSuccess('Jadwal berhasil disimpan.');
      el.kartuForm.style.display = 'none';
      muatPemeriksaan(); // muat ulang -- otomatis mencerminkan data tersimpan terbaru, termasuk target/terjadwal/status
    } catch (err) { showError(err.message); }
  });

  muatPeriode();
})();

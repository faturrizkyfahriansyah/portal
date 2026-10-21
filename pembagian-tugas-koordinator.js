// pembagian-tugas-koordinator.js — Pembagian Tugas Harian (21 Okt
// 2026, dokumen Fitur Koordinator §6). TIDAK mengubah jadwal/shift
// resmi -- murni catatan pembagian kerja harian, terpisah dari roster.
document.addEventListener('DOMContentLoaded', () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) { window.location.href = 'login.html'; return; }
  const TOKEN = sesi.token;

  function tanggalKeDMY_(iso) { const b = iso.split('-'); return b[2] + '/' + b[1] + '/' + b[0]; }
  function dmyKeIso_(dmy) { const b = dmy.split('/'); return b[2] + '-' + b[1] + '-' + b[0]; }
  function hariIniDMY_() { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }

  const elTanggal = document.getElementById('ptTanggal');
  const elIsi = document.getElementById('ptIsi');
  const elBelum = document.getElementById('ptBelumDitugaskan');
  const elRelawan = document.getElementById('ptRelawan');
  let idTugasSedangDiedit = '';

  async function muat() {
    const tanggalDMY = elTanggal.value ? tanggalKeDMY_(elTanggal.value) : hariIniDMY_();
    if (!elTanggal.value) elTanggal.value = dmyKeIso_(tanggalDMY);
    elIsi.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const hasil = await apiPost('getTugasHarianKoordinator', { token: TOKEN, tanggalDMY });

      elRelawan.innerHTML = '<option value="">Pilih Relawan...</option>' + hasil.belumDitugaskan.map(r => `<option value="${r.id}">${escapeHtml(r.nama)}</option>`).join('');

      if (hasil.belumDitugaskan.length) {
        elBelum.innerHTML = `<div style="background:#FFF3E0;border-radius:8px;padding:10px 12px;">
          <p style="margin:0;font-size:12.5px;"><b>${hasil.belumDitugaskan.length} relawan belum dapat tugas:</b> ${hasil.belumDitugaskan.map(r => escapeHtml(r.nama)).join(', ')}</p>
        </div>`;
      } else {
        elBelum.innerHTML = '';
      }

      if (!hasil.tugas.length) {
        elIsi.innerHTML = '<div class="empty-state">Belum ada tugas dibagikan untuk tanggal ini.</div>';
        return;
      }
      elIsi.innerHTML = `
        <p style="font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;margin:0 0 8px;">Tugas Tanggal Ini</p>
        ${hasil.tugas.map(t => `
          <div class="panel-block" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div>
                <p style="margin:0;font-weight:700;">${escapeHtml(t.NAMA_RELAWAN)}</p>
                <p style="margin:4px 0 0;font-size:13.5px;">${escapeHtml(t.TUGAS)}</p>
                ${t.LOKASI_POS ? `<p style="margin:4px 0 0;font-size:12px;color:var(--color-text-muted);">📍 ${escapeHtml(t.LOKASI_POS)}</p>` : ''}
                ${t.CATATAN_INSTRUKSI ? `<p style="margin:4px 0 0;font-size:12px;color:var(--color-text-muted);">${escapeHtml(t.CATATAN_INSTRUKSI)}</p>` : ''}
              </div>
              <button type="button" class="btn-mini btn-edit-tugas" data-id="${escapeHtml(t.ID_TUGAS)}" data-tugas="${escapeHtml(t.TUGAS)}" data-lokasi="${escapeHtml(t.LOKASI_POS || '')}" data-catatan="${escapeHtml(t.CATATAN_INSTRUKSI || '')}" data-relawan="${escapeHtml(t.ID_RELAWAN)}" style="flex-shrink:0;">Ubah</button>
            </div>
          </div>`).join('')}`;

      elIsi.querySelectorAll('.btn-edit-tugas').forEach(btn => {
        btn.addEventListener('click', () => {
          idTugasSedangDiedit = btn.dataset.id;
          document.getElementById('ptTugas').value = btn.dataset.tugas;
          document.getElementById('ptLokasi').value = btn.dataset.lokasi;
          document.getElementById('ptCatatan').value = btn.dataset.catatan;
          // relawan yg SUDAH bertugas tidak ada di dropdown (cuma yg belum) -- tambahkan sementara spy bisa diubah.
          if (!elRelawan.querySelector(`option[value="${btn.dataset.relawan}"]`)) {
            const opt = document.createElement('option'); opt.value = btn.dataset.relawan; opt.textContent = '(sedang diubah)'; opt.selected = true;
            elRelawan.prepend(opt);
          }
          elRelawan.value = btn.dataset.relawan;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    } catch (err) {
      elIsi.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  elTanggal.addEventListener('change', muat);
  document.getElementById('ptBtnHariIni').addEventListener('click', () => { elTanggal.value = dmyKeIso_(hariIniDMY_()); muat(); });

  document.getElementById('formTugas').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tanggalDMY = tanggalKeDMY_(elTanggal.value);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      await apiPost('simpanTugasHarian', {
        token: TOKEN, idTugas: idTugasSedangDiedit, tanggalDMY, idRelawan: elRelawan.value,
        tugas: document.getElementById('ptTugas').value.trim(),
        lokasiPos: document.getElementById('ptLokasi').value.trim(),
        catatanInstruksi: document.getElementById('ptCatatan').value.trim()
      });
      showSuccess('Tugas tersimpan.');
      idTugasSedangDiedit = '';
      e.target.reset();
      muat();
    } catch (err) {
      showError(err.message || 'Gagal menyimpan tugas.');
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan Tugas';
    }
  });

  muat();
});

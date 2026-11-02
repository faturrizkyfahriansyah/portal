// admin-master-tarif.js — Master Tarif (BARU, 23 Okt 2026, diminta
// Admin). Standing per relawan -- TIDAK ADA LAGI pilih periode,
// "Siapkan Master Tarif", atau "Salin dari periode lain". Nama & Divisi
// SELALU dibaca langsung dari SIM SDM (getMasterTarifStandingAdmin,
// MasterTarif.gs) -- bukan disalin manual. Simpan sekali -> jadi aturan
// yang berlaku terus; tombol berubah jadi "Ubah" setelah baris tersimpan.
(function () {
  const T = window.sppgAdminToken;
  const JABATAN_OPSI = ['RELAWAN', 'KOORDINATOR', 'ASISTEN', 'DRIVER'];
  let daftarTarif = [];

  function formatRupiah_(angka) {
    if (angka === null || angka === undefined) return '';
    return Number(angka).toLocaleString('id-ID');
  }

  function renderBaris_(t) {
    const idBaris = 'mt-' + t.idRelawan;
    return `
      <tr>
        <td>${escapeHtml(t.namaRelawan)}</td>
        <td>${escapeHtml(t.divisi)}</td>
        <td>
          <select id="${idBaris}-jabatan" class="mini-select">
            <option value="">-</option>
            ${JABATAN_OPSI.map(j => `<option value="${j}" ${t.jabatan === j ? 'selected' : ''}>${j}</option>`).join('')}
          </select>
        </td>
        <td><input type="number" min="0" step="1000" id="${idBaris}-nominal" style="width:120px;" value="${t.tarifHarian === null ? '' : t.tarifHarian}" placeholder="Belum diisi"></td>
        <td><button type="button" class="btn-mini primary" data-idrelawan="${escapeHtml(t.idRelawan)}" data-idtarif="${escapeHtml(t.idTarif)}">${t.idTarif ? 'Ubah' : 'Simpan'}</button></td>
      </tr>`;
  }

  function renderTabel_() {
    const kataCari = (document.getElementById('mtCari').value || '').toLowerCase();
    const daftarTampil = kataCari ? daftarTarif.filter(t => t.namaRelawan.toLowerCase().includes(kataCari)) : daftarTarif;
    const tbody = document.getElementById('tbodyMasterTarif');
    if (!daftarTampil.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Tidak ada relawan yang cocok.</div></td></tr>'; return; }
    tbody.innerHTML = daftarTampil.map(renderBaris_).join('');

    tbody.querySelectorAll('button[data-idrelawan]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idRelawan = btn.dataset.idrelawan;
        const idTarif = btn.dataset.idtarif;
        const idBaris = 'mt-' + idRelawan;
        const jabatan = document.getElementById(idBaris + '-jabatan').value;
        const tarifHarian = document.getElementById(idBaris + '-nominal').value;
        if (!jabatan) { showError('Pilih Jabatan dulu.'); return; }
        if (tarifHarian === '') { showError('Isi Tarif Harian dulu.'); return; }
        btn.disabled = true;
        try {
          const hasil = await apiPost('updateTarifRelawanAdmin', { token: T, idTarif, idRelawan, jabatan, tarifHarian });
          showSuccess('Tarif tersimpan -- berlaku terus sampai diubah lagi.');
          // Perbarui cache lokal + tombol jadi "Ubah" tanpa perlu muat ulang semua data.
          const item = daftarTarif.find(t => t.idRelawan === idRelawan);
          if (item) { item.idTarif = hasil.idTarif; item.jabatan = jabatan; item.tarifHarian = Number(tarifHarian); }
          btn.dataset.idtarif = hasil.idTarif;
          btn.textContent = 'Ubah';
        } catch (err) {
          showError(err.message || 'Gagal menyimpan tarif.');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  async function muat_() {
    const tbody = document.getElementById('tbodyMasterTarif');
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      daftarTarif = await apiPost('getMasterTarifStandingAdmin', { token: T });
      renderTabel_();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">❌ ${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  document.getElementById('mtCari').addEventListener('input', renderTabel_);
  muat_();
})();

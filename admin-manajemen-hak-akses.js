// admin-manajemen-hak-akses.js — Manajemen Hak Akses Terpadu (16 Okt
// 2026, diminta Admin). SATU tabel, SEMUA relawan, Role + Petugas Stok
// sekaligus -- setiap sel langsung tersimpan saat diubah (tidak ada
// tombol "simpan semua"), memanggil aksi backend yg SUDAH ADA
// (setRoleRelawan, setRoleStok) -- tidak ada logika baru di backend
// utk MENYIMPAN, cuma pintu MELIHAT (getDaftarHakAksesAdmin) yg baru.
(function () {
  let daftarCache = [];

  async function muat() {
    const tbody = document.getElementById('tbodyManajemenHakAkses');
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      daftarCache = await apiGet('getDaftarHakAksesAdmin', { token: window.sppgAdminToken });
      render(daftarCache);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">❌ ${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  function render(list) {
    const tbody = document.getElementById('tbodyManajemenHakAkses');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Tidak ada relawan yang cocok.</div></td></tr>';
      return;
    }
    tbody.innerHTML = list.map(r => `
      <tr data-id="${escapeHtml(r.idRelawan)}">
        <td>${escapeHtml(r.nama)}</td>
        <td>${escapeHtml(r.divisi)}</td>
        <td>${escapeHtml(r.idRelawan)}</td>
        <td>
          <select class="mha-select-role" style="font-size:12.5px;padding:5px 7px;border-radius:6px;border:1.5px solid var(--color-border);width:100%;">
            <option value="" ${r.role === 'RELAWAN' ? 'selected' : ''}>Relawan Biasa</option>
            <option value="ASN" ${r.role === 'ASN' ? 'selected' : ''}>ASN</option>
            <option value="KEPALA_SPPG" ${r.role === 'KEPALA_SPPG' ? 'selected' : ''}>Kepala SPPG</option>
          </select>
        </td>
        <td style="text-align:center;">
          <input type="checkbox" class="mha-check-stok" ${r.petugasStok ? 'checked' : ''} style="width:17px;height:17px;cursor:pointer;">
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('.mha-select-role').forEach(sel => {
      sel.addEventListener('change', async () => {
        const tr = sel.closest('tr');
        const idRelawan = tr.dataset.id;
        sel.disabled = true;
        try {
          await apiPost('setRoleRelawan', { token: window.sppgAdminToken, idRelawan, role: sel.value });
          showSuccess('Role diperbarui.');
        } catch (err) {
          showError(err.message || 'Gagal mengubah role.');
          await muat(); // kembalikan ke nilai sebenarnya kalau gagal
        } finally {
          sel.disabled = false;
        }
      });
    });

    tbody.querySelectorAll('.mha-check-stok').forEach(chk => {
      chk.addEventListener('change', async () => {
        const tr = chk.closest('tr');
        const idRelawan = tr.dataset.id;
        chk.disabled = true;
        try {
          await apiPost('setRoleStok', { token: window.sppgAdminToken, idRelawan, jadikanPetugas: chk.checked });
          showSuccess(chk.checked ? 'Ditandai sebagai Petugas Stok.' : 'Status Petugas Stok dicabut.');
        } catch (err) {
          showError(err.message || 'Gagal mengubah status Petugas Stok.');
          chk.checked = !chk.checked; // kembalikan tampilan kalau gagal
        } finally {
          chk.disabled = false;
        }
      });
    });
  }

  document.getElementById('mhaCari').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const hasil = q ? daftarCache.filter(r => r.nama.toLowerCase().includes(q) || r.idRelawan.toLowerCase().includes(q)) : daftarCache;
    render(hasil);
  });

  muat();
})();

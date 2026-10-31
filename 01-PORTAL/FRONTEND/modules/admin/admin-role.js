// ============================================================
// SPPG JEUNGJING — ROLE ASN & KEPALA SPPG (Dashboard Admin)
// File BARU, terpisah dari admin.js. Memakai window.sppgAdminToken
// (hook yang sama dipakai admin-stok.js/admin-shift.js).
// ============================================================

(function () {
  'use strict';

  const el = {
    tabBtn: document.querySelector('.admin-tab-btn[data-panel="panelRoleAkses"]'),
    tbody: document.getElementById('tbodyRoleAkses')
  };

  if (!el.tabBtn) return;

  function token() { return window.sppgAdminToken; }

  el.tabBtn.addEventListener('click', muatDaftarRole);
  window.addEventListener('sppg-admin-ready', () => {
    if (document.getElementById('panelRoleAkses').classList.contains('active')) muatDaftarRole();
  });

  async function muatDaftarRole() {
    el.tbody.innerHTML = '<tr><td colspan="2"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const daftar = await apiGet('getDaftarRelawanUntukRoleAdmin', { token: token() });
      if (!daftar.length) { el.tbody.innerHTML = '<tr><td colspan="2"><div class="empty-state">Tidak ada relawan aktif ditemukan.</div></td></tr>'; return; }

      el.tbody.innerHTML = daftar.map(r => `
        <tr data-id="${escapeHtml(r.idRelawan)}">
          <td>${escapeHtml(r.nama)}</td>
          <td>
            <select class="select-role-relawan">
              <option value="">Relawan biasa</option>
              <option value="ASN">ASN</option>
              <option value="KEPALA_SPPG">Kepala SPPG</option>
            </select>
          </td>
        </tr>`).join('');

      el.tbody.querySelectorAll('tr').forEach(row => {
        const id = row.dataset.id;
        const data = daftar.find(r => r.idRelawan === id);
        const select = row.querySelector('.select-role-relawan');
        select.value = data.role === 'RELAWAN' ? '' : data.role;

        select.addEventListener('change', async () => {
          try {
            await apiPost('setRoleRelawan', { token: token(), idRelawan: id, role: select.value });
            showSuccess('Role ' + data.nama + ' diperbarui.');
          } catch (err) {
            showError(err.message);
            muatDaftarRole();
          }
        });
      });
    } catch (err) {
      el.tbody.innerHTML = '';
      showError(err.message);
    }
  }
})();

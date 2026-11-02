// ============================================================
// admin-sipandu-akses.js — Hak Akses SIPANDU
// File BARU, mandiri. Dikelola dari Admin Panel PORTAL (bukan dari
// dalam SIPANDU) -- supaya Admin SELALU bisa kelola akses SIPANDU,
// tidak bergantung pada status akses SIPANDU-nya sendiri.
// ============================================================

(function () {
  'use strict';

  function token() { return window.sppgAdminToken; }

  async function muatDaftarRelawan_() {
    const sel = document.getElementById('selectRelawanAksesSipandu');
    try {
      const daftar = await apiGet('getDaftarRelawanUntukHakAkses', { token: token() });
      sel.innerHTML = '<option value="">Pilih relawan...</option>' +
        daftar.map(r => `<option value="${r.id}" data-nama="${escapeHtml(r.nama)}">${escapeHtml(r.nama)} (${r.id})</option>`).join('');
      return daftar;
    } catch (err) {
      sel.innerHTML = '<option value="">Gagal memuat</option>';
      throw err;
    }
  }

  async function muatDaftarRole_() {
    const sel = document.getElementById('selectRoleSipandu');
    try {
      const daftar = await apiGet('getDaftarRoleSipandu', { token: token() });
      sel.innerHTML = '<option value="">Pilih role...</option>' +
        daftar.map(r => `<option value="${escapeHtml(r.kode)}">${escapeHtml(r.nama)}</option>`).join('');
    } catch (err) {
      sel.innerHTML = '<option value="">Gagal memuat</option>';
    }
  }

  async function muatTabelHakAkses_() {
    const tbody = document.getElementById('tbodyHakAksesSipandu');
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const daftar = await apiGet('getDaftarRelawanUntukHakAkses', { token: token() });
      const terdaftar = daftar.filter(r => r.terdaftar);
      if (!terdaftar.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada relawan dengan akses SIPANDU.</div></td></tr>';
        return;
      }
      tbody.innerHTML = terdaftar.map(r => `
        <tr>
          <td>${escapeHtml(r.nama)}</td>
          <td>${escapeHtml(r.roleSipandu || '-')}</td>
          <td>${r.aktifDiSipandu ? '<span style="color:#1a7a4c;font-weight:700;">Aktif</span>' : '<span style="color:#b23a3a;">Nonaktif</span>'}</td>
          <td>${r.aktifDiSipandu ? `<button type="button" class="btn-mini" data-cabut="${r.id}">Cabut Akses</button>` : '-'}</td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-cabut]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Cabut akses SIPANDU untuk relawan ini?')) return;
          try {
            await apiPost('cabutSipanduUserRole', { token: token(), idRelawan: btn.dataset.cabut });
            showSuccess('Akses SIPANDU dicabut.');
            muatTabelHakAkses_();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="color:#b23a3a;">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    let percobaan = 0;
    const interval = setInterval(() => {
      const panel = document.getElementById('panelHakAksesSipandu');
      percobaan++;
      if (panel || percobaan > 20) clearInterval(interval);
      if (!panel) return;

      let sudahDimuat = false;
      window.addEventListener('sipandu-hakakses-dibuka', () => {
        if (sudahDimuat) return;
        sudahDimuat = true;
        muatDaftarRelawan_();
        muatDaftarRole_();
        muatTabelHakAkses_();
      });

      document.getElementById('btnTambahAksesSipandu').addEventListener('click', async () => {
        const selRelawan = document.getElementById('selectRelawanAksesSipandu');
        const selRole = document.getElementById('selectRoleSipandu');
        const idRelawan = selRelawan.value;
        const role = selRole.value;
        const nama = selRelawan.selectedOptions[0]?.dataset.nama || '';

        if (!idRelawan) { showError('Pilih relawan dulu.'); return; }
        if (!role) { showError('Pilih role dulu.'); return; }

        try {
          await apiPost('setSipanduUserRole', { token: token(), idRelawan, nama, role, aktif: true });
          showSuccess('Akses SIPANDU berhasil diberikan.');
          selRelawan.value = ''; selRole.value = '';
          muatTabelHakAkses_();
        } catch (err) { showError(err.message); }
      });
    }, 300);
  });
})();

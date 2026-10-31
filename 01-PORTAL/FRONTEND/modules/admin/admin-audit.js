// ============================================================
// SPPG JEUNGJING — AUDIT LOG (Dashboard Admin, Fase 9)
// ============================================================

(function () {
  'use strict';

  const btn = document.getElementById('btnMuatAuditLog');
  const tbody = document.getElementById('tbodyAuditLog');
  if (!btn) return;

  function token() { return window.sppgAdminToken; }

  btn.addEventListener('click', async () => {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const list = await apiGet('getAuditLogListAdmin', { token: token() });
      if (!list.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Belum ada catatan audit.</div></td></tr>'; return; }

      tbody.innerHTML = list.map(r => {
        let ringkas = '';
        try { ringkas = Object.entries(JSON.parse(r.detail || '{}')).map(([k, v]) => `${k}: ${v}`).join(', '); } catch (e) { ringkas = ''; }
        return `<tr>
          <td style="white-space:nowrap;font-size:12px;">${escapeHtml(String(r.waktu))}</td>
          <td>${escapeHtml(r.aksi)}</td>
          <td>${escapeHtml(r.modul)}</td>
          <td>${escapeHtml(r.idTerkait || '-')}</td>
          <td>${escapeHtml(r.aktor || '-')}</td>
          <td style="font-size:12px;color:var(--color-text-muted);">${escapeHtml(ringkas)}</td>
        </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = '';
      showError(err.message);
    }
  });
})();

// ============================================================
// admin-pengelola-sppg.js — Kelola akun Pengelola/Admin DENGAN JABATAN (ditulis ulang 4 Nov 2026).
// Jabatan (Kepala SPPG, Pengawas Gizi, Pengawas Keuangan, ...) menentukan role akses; hak aksesnya sendiri diatur di
// Manajemen Hak Akses. Backend: PengelolaSPPG.gs (kolom 06_ADMIN ditambah otomatis; pengaman akses penuh).
// ============================================================
(function () {
  'use strict';
  const JABATAN = [['PENGELOLA', 'Pengelola (akses penuh)'], ['KEPALA_SPPG', 'Kepala SPPG'], ['PENGAWAS_GIZI', 'Pengawas Gizi / Ahli Gizi'], ['PENGAWAS_KEUANGAN', 'Pengawas Keuangan'], ['ADMIN_OPERASIONAL', 'Admin Operasional'], ['KOORDINATOR', 'Koordinator Operasional']];
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const $ = function (id) { return document.getElementById(id); };
  const token = function () { return ambilSesiAdmin().token; };
  let daftar = [];

  function opsiJabatan(terpilih) { return JABATAN.map(function (j) { return '<option value="' + j[0] + '"' + (j[0] === terpilih ? ' selected' : '') + '>' + esc(j[1]) + '</option>'; }).join(''); }
  function pesan(t, galat) { const el = $('pengelolaPesan'); if (el) { el.textContent = t || ''; el.style.color = galat ? '#c0392b' : '#2e7d32'; } }

  async function muatTabel_() {
    const tbody = $('tbodyPengelolaSppg');
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      daftar = await apiGet('getDaftarPengelola', { token: token() });
      if (!daftar.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Belum ada akun Pengelola.</div></td></tr>'; return; }
      const saya = (window.sppgAdminUsername || '').toLowerCase();
      tbody.innerHTML = daftar.map(function (p) {
        const penuh = p.roleBaru === 'SUPER_ADMIN';
        return '<tr><td>' + esc(p.username) + '</td><td>' + esc(p.nama || '-') + '</td>' +
          '<td>' + esc(p.namaJabatan) + '<div style="font-size:11px;color:' + (penuh ? '#e65100' : 'var(--color-text-muted,#55606f)') + ';">' + (penuh ? 'akses penuh' : 'role: ' + esc(p.roleBaru)) + '</div></td>' +
          '<td>' + esc(p.role || 'ADMIN') + '</td>' +
          '<td>' + (p.status === 'AKTIF' ? '<span style="color:#1a7a4c;font-weight:700;">Aktif</span>' : '<span style="color:#b23a3a;">Nonaktif</span>') + '</td>' +
          '<td style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn-mini" data-edit="' + esc(p.username) + '">Ubah</button>' +
          (p.username.toLowerCase() === saya ? '<span style="color:var(--color-text-muted);font-size:12px;">Akun Anda</span>' :
            '<button type="button" class="btn-mini" data-status="' + esc(p.username) + '" data-aktif="' + (p.status === 'AKTIF' ? '0' : '1') + '">' + (p.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan') + '</button>') + '</td></tr>';
      }).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="color:#b23a3a;">' + esc(err.message) + '</div></td></tr>';
    }
  }

  function formUbah(username) {
    const p = daftar.filter(function (x) { return x.username === username; })[0]; if (!p) return;
    const box = $('pengelolaFormUbah');
    box.innerHTML = '<div class="admin-stat-card" style="padding:14px;text-align:left;margin:12px 0;"><b>Ubah ' + esc(p.username) + '</b>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:10px 0;">' +
      '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Nama<input id="ubNama" value="' + esc(p.nama) + '" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;"></label>' +
      '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Jabatan<select id="ubJabatan" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;">' + opsiJabatan(p.jabatan || 'PENGELOLA') + '</select></label>' +
      '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Role<select id="ubRole" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;"><option value="ADMIN"' + (p.role === 'ADMIN' ? ' selected' : '') + '>Admin</option><option value="STAFF"' + (p.role === 'STAFF' ? ' selected' : '') + '>Staff</option></select></label></div>' +
      '<div style="font-size:12px;color:var(--color-text-muted,#55606f);margin-bottom:8px;">Mengubah jabatan mengubah role akses akun ini. Hak akses tiap role diatur di Manajemen Hak Akses.</div>' +
      '<button class="btn-mini primary" id="ubSimpan" type="button">Simpan</button> <button class="btn-mini" id="ubBatal" type="button">Batal</button></div>';
    $('ubBatal').addEventListener('click', function () { box.innerHTML = ''; });
    $('ubSimpan').addEventListener('click', async function () {
      try {
        pesan('Menyimpan…');
        await apiPost('updatePengelola', { token: token(), username: p.username, nama: $('ubNama').value, jabatan: $('ubJabatan').value, role: $('ubRole').value });
        box.innerHTML = ''; await muatTabel_(); pesan('Data Pengelola diperbarui.');
      } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
    });
  }

  function pasangForm_() {
    // jabatan pada formulir tambah (dibuat sekali bila belum ada di HTML)
    if (!$('inputJabatanPengelola') && $('inputRolePengelola')) {
      const sel = document.createElement('select'); sel.id = 'inputJabatanPengelola'; sel.innerHTML = opsiJabatan('PENGELOLA');
      $('inputRolePengelola').parentNode.insertBefore(sel, $('inputRolePengelola'));
    }
    if ($('inputPasswordPengelola')) $('inputPasswordPengelola').placeholder = 'Password (min. 8 karakter)';
    if (!$('pengelolaPesan')) { const d = document.createElement('div'); d.id = 'pengelolaPesan'; d.style.cssText = 'font-size:13px;margin:8px 0;'; $('btnTambahPengelola').parentNode.parentNode.insertBefore(d, $('btnTambahPengelola').parentNode.nextSibling); }
    if (!$('pengelolaFormUbah')) { const d = document.createElement('div'); d.id = 'pengelolaFormUbah'; $('tbodyPengelolaSppg').closest('.table-wrap').parentNode.insertBefore(d, $('tbodyPengelolaSppg').closest('.table-wrap')); }
  }

  let sudahDimuat = false;
  const btnTab = document.querySelector('[data-panel="panelPengelolaSppg"]');
  if (btnTab) btnTab.addEventListener('click', function () { if (sudahDimuat) return; sudahDimuat = true; pasangForm_(); muatTabel_(); });

  document.addEventListener('click', async function (e) {
    const tbody = $('tbodyPengelolaSppg');
    if (tbody && tbody.contains(e.target)) {
      const be = e.target.closest('[data-edit]'); if (be) { formUbah(be.dataset.edit); return; }
      const bs = e.target.closest('[data-status]');
      if (bs) {
        const aktifkan = bs.dataset.aktif === '1';
        if (!confirm((aktifkan ? 'Aktifkan' : 'Nonaktifkan') + ' akun "' + bs.dataset.status + '"?')) return;
        try { await apiPost('setStatusPengelola', { token: token(), username: bs.dataset.status, aktif: aktifkan }); await muatTabel_(); pesan('Status akun diperbarui.'); }
        catch (err) { pesan(err.message || 'Gagal.', true); }
      }
    }
  });

  const btnTambah = $('btnTambahPengelola');
  if (btnTambah) btnTambah.addEventListener('click', async function () {
    const u = $('inputUsernamePengelola'), n = $('inputNamaPengelola'), pw = $('inputPasswordPengelola'), r = $('inputRolePengelola'), j = $('inputJabatanPengelola');
    if (!u.value.trim()) { pesan('Username wajib diisi.', true); return; }
    if (!pw.value || pw.value.length < 8) { pesan('Password minimal 8 karakter.', true); return; }
    if (j && j.value === 'PENGELOLA' && !confirm('Jabatan "Pengelola" memberi AKSES PENUH (Super Admin). Lanjutkan?')) return;
    try {
      pesan('Menyimpan…');
      const h = await apiPost('addPengelola', { token: token(), username: u.value.trim(), nama: n.value.trim(), password: pw.value, role: r.value, jabatan: j ? j.value : 'PENGELOLA' });
      u.value = ''; n.value = ''; pw.value = '';
      await muatTabel_(); pesan('Akun ' + h.username + ' ditambahkan dengan role ' + h.roleBaru + '.');
    } catch (err) { pesan(err.message || 'Gagal menambah akun.', true); }
  });
})();

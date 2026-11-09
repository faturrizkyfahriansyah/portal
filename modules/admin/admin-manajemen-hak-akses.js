// admin-manajemen-hak-akses.js — Manajemen Hak Akses (16-18 Okt 2026)
// Dibangun sesuai dokumen prompt + wireframe yang dikirim Admin (proyek
// besar, disetujui setelah audit). 3 tab: Pengguna & Role, Konfigurasi
// Hak Akses, Riwayat Perubahan. Backend: ManajemenHakAkses.gs (BARU,
// terpisah dari kode lama).
(function () {
  const T = window.sppgAdminToken;
  let daftarPenggunaCache = [];
  let daftarRoleCache = [];
  let daftarModulCache = [];
  let penggunaSedangDiedit = null; // { tipe, id, nama, jabatan, divisi, roleBaru }

  // ---------- INIT ----------
  async function muatSemua() {
    try {
      const stat = await apiGet('getStatistikHakAkses', { token: T });
      document.getElementById('mhaStatPengguna').textContent = stat.totalPengguna;
      document.getElementById('mhaStatRole').textContent = stat.totalRole;
      document.getElementById('mhaStatModul').textContent = stat.totalModul;
      // Kalau role/modul 0, berarti migrasi/bootstrap belum pernah jalan.
      if (stat.totalRole === 0) document.getElementById('mhaBannerMigrasi').style.display = 'block';
    } catch (err) {
      showError(err.message || 'Gagal memuat statistik.');
    }

    try {
      const rm = await apiGet('getDaftarRoleDanModulHakAkses', { token: T });
      daftarRoleCache = rm.role; daftarModulCache = rm.modul;
      isiDropdownRole_();
    } catch (err) { /* banner migrasi sudah menjelaskan kalau ini kosong */ }

    muatPengguna_();
  }

  function isiDropdownRole_() {
    const opsi = daftarRoleCache.map(r => `<option value="${r.kode}">${escapeHtml(r.nama)}</option>`).join('');
    document.getElementById('mhaFilterRole').innerHTML = '<option value="">Semua Role</option>' + opsi;
    document.getElementById('mhaKonfigRole').innerHTML = opsi;
    // Diganti dari <select> ke checkbox multi-pilih (18 Okt 2026, diminta Admin).
    document.getElementById('mhaKonfigModulCheckbox').innerHTML = daftarModulCache.map(m => `
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;padding:6px 10px;border:1px solid var(--color-border);border-radius:8px;cursor:pointer;">
        <input type="checkbox" class="mha-modul-checkbox" value="${m.kode}" style="width:16px;height:16px;"> ${escapeHtml(m.nama)}
      </label>`).join('');
    document.querySelectorAll('.mha-modul-checkbox').forEach(cb => cb.addEventListener('change', muatKonfigurasi_));
  }

  // ---------- TAB SWITCHING ----------
  document.querySelectorAll('.mha-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mha-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.mha-tab-content').forEach(c => c.style.display = 'none');
      btn.classList.add('active');
      const nama = btn.dataset.mhaTab;
      document.getElementById('mhaTab' + nama.charAt(0).toUpperCase() + nama.slice(1)).style.display = 'block';
      if (nama === 'konfigurasi' && !document.getElementById('mhaKonfigRole').value) {
        // belum pernah dipilih -- biarkan placeholder, jangan auto-load sembarangan
      }
      if (nama === 'riwayat') muatRiwayat_();
    });
  });

  // ---------- MIGRASI ----------
  document.getElementById('btnJalankanMigrasiHakAkses').addEventListener('click', async () => {
    if (!confirm('Jalankan migrasi role sekarang? Ini akan memetakan role lama ke 7 role baru dan membuat konfigurasi izin default (VIEW-saja). Aman dijalankan ulang.')) return;
    showLoading('Menjalankan migrasi...');
    try {
      const hasil = await apiPost('jalankanMigrasiRoleBaru', { token: T });
      hideLoading();
      showSuccess(`Migrasi selesai — Admin: ${hasil.admin.diproses} diproses, Relawan: ${hasil.relawan.diproses} diproses, Konfigurasi: ${hasil.konfigurasi.jumlah} baris.`);
      document.getElementById('mhaBannerMigrasi').style.display = 'none';
      muatSemua();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Gagal menjalankan migrasi.');
    }
  });

  // ---------- TAB 1: PENGGUNA & ROLE ----------
  async function muatPengguna_() {
    const tbody = document.getElementById('mhaTbodyPengguna');
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      daftarPenggunaCache = await apiGet('getDaftarPenggunaHakAkses', { token: T });
      renderPengguna_();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  function namaRole_(kode) {
    const r = daftarRoleCache.find(x => x.kode === kode);
    return r ? r.nama : (kode || '(belum dimigrasi)');
  }

  function renderPengguna_() {
    const cari = document.getElementById('mhaCariPengguna').value.trim().toLowerCase();
    const filterRole = document.getElementById('mhaFilterRole').value;
    let list = daftarPenggunaCache;
    if (cari) list = list.filter(p => p.nama.toLowerCase().includes(cari) || p.id.toLowerCase().includes(cari));
    if (filterRole) list = list.filter(p => p.roleBaru === filterRole);

    const tbody = document.getElementById('mhaTbodyPengguna');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Tidak ada pengguna yang cocok.</div></td></tr>'; return; }

    tbody.innerHTML = list.map(p => `
      <tr data-id="${escapeHtml(p.id)}">
        <td data-label="Nama"><b>${escapeHtml(p.nama)}</b>${p.status === 'AKTIF' ? '' : ' <span style="font-size:11px;color:var(--color-text-muted);">· nonaktif</span>'}</td>
        <td data-label="ID">${escapeHtml(p.id)}</td>
        <td data-label="Jabatan">${p.jabatan ? escapeHtml(p.jabatan) : '<span style="color:var(--color-text-muted);">Belum ditetapkan</span>'}</td>
        <td data-label="Role"><span class="badge aktif">${escapeHtml(namaRole_(p.roleBaru))}</span></td>
        <td data-label="Divisi">${escapeHtml(p.divisi)}</td>
        <td data-label="Aksi"><button type="button" class="btn-mini mha-btn-ubah-role" style="background:#0B2D6B;color:#fff;border-color:#0B2D6B;">Ubah Role</button></td>
      </tr>`).join('');

    tbody.querySelectorAll('.mha-btn-ubah-role').forEach(btn => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        const p = daftarPenggunaCache.find(x => x.id === tr.dataset.id);
        if (p) bukaModalUbahRole_(p);
      });
    });
  }

  document.getElementById('mhaCariPengguna').addEventListener('input', renderPengguna_);
  document.getElementById('mhaFilterRole').addEventListener('change', renderPengguna_);

  // ---------- MODAL UBAH ROLE ----------
  function bukaModalUbahRole_(p) {
    penggunaSedangDiedit = p;
    document.getElementById('mhaModalNama').textContent = p.nama;
    document.getElementById('mhaModalJabatanDivisi').textContent = `Jabatan: ${p.jabatan} · Divisi: ${p.divisi}`;
    document.getElementById('mhaModalRoleSaatIni').textContent = namaRole_(p.roleBaru);
    document.getElementById('mhaModalPilihanRole').innerHTML = daftarRoleCache.map(r => `
      <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:6px;cursor:pointer;">
        <input type="radio" name="mhaRoleBaru" value="${r.kode}" ${r.kode === p.roleBaru ? 'checked' : ''}> ${escapeHtml(r.nama)}
      </label>`).join('');
    document.getElementById('mhaModalAlasan').value = '';
    document.getElementById('mhaModalUbahRole').style.display = 'flex';
  }
  document.getElementById('mhaBtnTutupModal').addEventListener('click', () => document.getElementById('mhaModalUbahRole').style.display = 'none');
  document.getElementById('mhaBtnBatalModal').addEventListener('click', () => document.getElementById('mhaModalUbahRole').style.display = 'none');

  document.getElementById('mhaBtnSimpanRole').addEventListener('click', async () => {
    const dipilih = document.querySelector('input[name="mhaRoleBaru"]:checked');
    if (!dipilih) { showError('Pilih role baru dulu.'); return; }
    const btn = document.getElementById('mhaBtnSimpanRole');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      await apiPost('ubahRoleBaruPengguna', {
        token: T, tipe: penggunaSedangDiedit.tipe, id: penggunaSedangDiedit.id,
        roleBaru: dipilih.value, alasan: document.getElementById('mhaModalAlasan').value.trim()
      });
      document.getElementById('mhaModalUbahRole').style.display = 'none';
      showSuccess('Role berhasil diubah.');
      muatPengguna_();
    } catch (err) {
      showError(err.message || 'Gagal mengubah role.');
    } finally {
      btn.disabled = false; btn.textContent = 'Tinjau & Konfirmasi';
    }
  });

  // ---------- TAB 2: KONFIGURASI HAK AKSES ----------
  // Diperluas 18 Okt 2026 (diminta Admin): bisa centang BEBERAPA modul
  // sekaligus. 1 modul dicentang -> tampilkan konfigurasi modul itu yg
  // SUDAH tersimpan (spt sebelumnya). >1 modul dicentang -> form KOSONG
  // (karena tiap modul bisa saja berbeda konfigurasinya saat ini, jadi
  // tidak jujur menampilkan salah satu sbg "mewakili" semuanya) --
  // simpan akan MENERAPKAN pengaturan yg sama ke SEMUA modul tercentang.
  const IZIN_LABEL = { VIEW: 'Lihat data', CREATE: 'Tambah data', EDIT: 'Ubah data', DELETE: 'Hapus data', VALIDATE: 'Validasi', APPROVE: 'Setujui transaksi', EXPORT: 'Ekspor data' };

  const IZIN_INFO = {
    VIEW: ['Melihat daftar dan rincian data.', 'Pengguna melihat data sesuai batas datanya.', 'Tidak bisa membuka halaman data.', 'Pengawas Keuangan melihat rekap biaya.'],
    CREATE: ['Membuat catatan baru.', 'Tombol dan layanan "tambah" aktif.', 'Tidak bisa membuat catatan baru.', 'Admin menambah relawan.'],
    EDIT: ['Mengubah catatan yang sudah ada.', 'Boleh mengubah (tercatat di audit).', 'Data hanya bisa dilihat.', 'Koordinator mengoreksi isian divisinya.'],
    DELETE: ['Menghapus catatan.', 'Boleh menghapus (tidak selalu bisa dibatalkan).', 'Tidak bisa menghapus.', 'Menghapus penugasan yang salah.'],
    VALIDATE: ['Menandai data sah/diperiksa.', 'Pengguna dapat memvalidasi.', 'Data tetap berstatus belum divalidasi.', 'Pengawas Gizi memvalidasi menu.'],
    APPROVE: ['Memberi persetujuan akhir.', 'Persetujuan dapat diberikan.', 'Transaksi menunggu pihak lain.', 'Kepala SPPG menyetujui pengajuan kebutuhan.'],
    EXPORT: ['Mengunduh data (Excel).', 'Tombol ekspor tampil dan berfungsi.', 'Data tidak bisa diunduh.', 'Pengawas Keuangan mengunduh rekap.']
  };
  let pasanganRbac = null;   // izin yang BENAR-BENAR diperiksa server (dari getStatusRbac); null = belum diketahui
  const diterapkan_ = (daftarModul, izin) => !pasanganRbac || daftarModul.every(m => pasanganRbac.some(p => p.modul === m && p.izin === izin && !p.khusus) || pasanganRbac.some(p => p.modul === m && p.izin === izin));
  function infoIzinHtml_(k) {
    const i = IZIN_INFO[k]; if (!i) return '';
    return `<button type="button" class="mha-info" data-info="${k}" aria-label="Penjelasan ${IZIN_LABEL[k]}" aria-expanded="false" style="margin-left:6px;width:18px;height:18px;border-radius:50%;border:1px solid #9aa7b8;background:#fff;color:#55606f;font-size:11px;font-weight:700;line-height:16px;padding:0;cursor:pointer;">i</button>` +
      `<span class="mha-info-isi" data-isi="${k}" style="display:none;flex-basis:100%;font-size:11.5px;color:#55606f;background:#f6f8fb;border-radius:8px;padding:8px 10px;margin-top:4px;line-height:1.45;"><b>Fungsi:</b> ${i[0]}<br><b>Jika aktif:</b> ${i[1]}<br><b>Jika nonaktif:</b> ${i[2]}<br><b>Contoh:</b> ${i[3]}</span>`;
  }

  function modulTercentang_() {
    return Array.from(document.querySelectorAll('.mha-modul-checkbox:checked')).map(cb => cb.value);
  }

  async function muatKonfigurasi_() {
    const roleKode = document.getElementById('mhaKonfigRole').value;
    const modulTerpilih = modulTercentang_();
    const el = document.getElementById('mhaKonfigIsi');
    if (!roleKode || !modulTerpilih.length) { el.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Pilih role dan minimal 1 modul untuk mulai mengatur izin.</p>'; return; }

    if (modulTerpilih.length === 1) {
      // 1 modul -> tampilkan konfigurasi yg SUDAH ADA (spt sebelumnya).
      const modulKode = modulTerpilih[0];
      el.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
      try {
        const cfg = await apiPost('getKonfigurasiHakAksesSatu', { token: T, roleKode, modulKode });
        renderFormKonfigurasi_(el, modulTerpilih, cfg);
      } catch (err) {
        el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
      }
    } else {
      // >1 modul -> form kosong, diterapkan ke SEMUA saat disimpan.
      renderFormKonfigurasi_(el, modulTerpilih, null);
    }
  }

  function renderFormKonfigurasi_(el, daftarModulKode, cfg) {
    const namaModulGabung = daftarModulKode.map(k => { const m = daftarModulCache.find(x => x.kode === k); return m ? m.nama : k; }).join(', ');
    el.innerHTML = `
      <p style="font-weight:700;color:#0B2D6B;margin:0 0 4px;">Modul: ${escapeHtml(namaModulGabung)}</p>
      ${daftarModulKode.length > 1 ? '<p style="font-size:11.5px;color:#8a5a12;margin:0 0 10px;">Pengaturan di bawah akan diterapkan SAMA ke semua modul yang dicentang.</p>' : ''}
      <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin:12px 0 16px;cursor:pointer;">
        <input type="checkbox" id="mhaCfgAksesModul" ${cfg && cfg.aksesModul ? 'checked' : ''} style="width:17px;height:17px;"> Akses modul
      </label>
      <p style="font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;margin:0 0 8px;">Izin tindakan</p>
      <div class="mha-izin-grid" id="mhaCfgIzinGrid">
        ${Object.keys(IZIN_LABEL).map(k => `
          <label class="mha-izin-item" style="flex-wrap:wrap;${diterapkan_(daftarModulKode, k) ? '' : 'opacity:.6;'}"><input type="checkbox" data-izin="${k}" ${cfg && cfg.izin[k] ? 'checked' : ''} ${diterapkan_(daftarModulKode, k) ? '' : 'disabled'}> ${IZIN_LABEL[k]}${diterapkan_(daftarModulKode, k) ? '' : ' <span style="font-size:10.5px;color:#8a5a12;">(belum diterapkan di server)</span>'}${infoIzinHtml_(k)}</label>`).join('')}
      </div>
      <p style="font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;margin:16px 0 6px;">Batas data</p>
      <select id="mhaCfgScope" class="mini-select" style="width:100%;margin-bottom:16px;">
        <option value="SEMUA" ${!cfg || cfg.scope === 'SEMUA' ? 'selected' : ''}>Seluruh data operasional</option>
        <option value="DIVISI" ${cfg && cfg.scope === 'DIVISI' ? 'selected' : ''}>Data sesuai divisi/penugasan</option>
        <option value="SENDIRI" ${cfg && cfg.scope === 'SENDIRI' ? 'selected' : ''}>Data milik sendiri</option>
      </select>
      ${cfg && cfg.diubahOleh ? `<p style="font-size:11px;color:var(--color-text-muted);margin-bottom:12px;">Terakhir diubah oleh ${escapeHtml(cfg.diubahOleh)}</p>` : ''}
      <p id="mhaDirty" style="display:none;font-size:12px;color:#b26a00;margin:0 0 8px;text-align:right;">Ada perubahan yang belum disimpan</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-mini" id="mhaCfgBatal">Batal</button>
        <button type="button" class="btn-mini primary" id="mhaCfgSimpan" style="background:#F58220;border-color:#F58220;">Simpan Konfigurasi${daftarModulKode.length > 1 ? ' (' + daftarModulKode.length + ' modul)' : ''}</button>
      </div>`;
    el.querySelectorAll('.mha-info').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); const isi = el.querySelector('.mha-info-isi[data-isi="' + b.dataset.info + '"]'), buka = isi.style.display === 'none'; isi.style.display = buka ? 'block' : 'none'; b.setAttribute('aria-expanded', buka ? 'true' : 'false'); }));
    el.querySelectorAll('input, select').forEach(i => i.addEventListener('change', () => { const d = document.getElementById('mhaDirty'); if (d) d.style.display = 'block'; }));
    document.getElementById('mhaCfgBatal').addEventListener('click', muatKonfigurasi_);
    document.getElementById('mhaCfgSimpan').addEventListener('click', () => simpanKonfigurasi_(document.getElementById('mhaKonfigRole').value, daftarModulKode));
  }

  document.getElementById('mhaKonfigRole').addEventListener('change', muatKonfigurasi_);

  async function simpanKonfigurasi_(roleKode, daftarModulKode) {
    const btn = document.getElementById('mhaCfgSimpan');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const izin = {};
    document.querySelectorAll('#mhaCfgIzinGrid input[data-izin]').forEach(c => { izin[c.dataset.izin] = c.checked; });
    const aksesModul = document.getElementById('mhaCfgAksesModul').checked;
    const scope = document.getElementById('mhaCfgScope').value;
    if (!aksesModul && !confirm('Akses modul akan DIMATIKAN untuk role ini. Seluruh pengguna berole ini kehilangan modul tersebut. Lanjutkan?')) { btn.disabled = false; btn.textContent = 'Simpan Konfigurasi' + (daftarModulKode.length > 1 ? ' (' + daftarModulKode.length + ' modul)' : ''); return; }
    try {
      // Diterapkan ke SEMUA modul tercentang -- berurutan (bukan
      // Promise.all) supaya kalau ada yg gagal di tengah, pesan error
      // jelas menyebut modul mana, dan modul2 SEBELUMNYA yg sudah
      // berhasil tidak batal/ganda kalau diulang.
      for (const modulKode of daftarModulKode) {
        await apiPost('simpanKonfigurasiHakAkses', { token: T, roleKode, modulKode, aksesModul, izin, scope });
      }
      showSuccess(daftarModulKode.length > 1 ? `Konfigurasi disimpan untuk ${daftarModulKode.length} modul.` : 'Konfigurasi hak akses disimpan.');
      muatKonfigurasi_();
    } catch (err) {
      showError(err.message || 'Gagal menyimpan konfigurasi.');
      btn.disabled = false; btn.textContent = 'Simpan Konfigurasi' + (daftarModulKode.length > 1 ? ' (' + daftarModulKode.length + ' modul)' : '');
    }
  }

  // ---------- TAB 3: RIWAYAT ----------
  async function muatRiwayat_() {
    const el = document.getElementById('mhaRiwayatIsi');
    el.innerHTML = '<p style="font-size:13px;color:var(--color-text-muted);">Memuat...</p>';
    try {
      const cari = document.getElementById('mhaCariRiwayat').value.trim();
      const jenis = document.getElementById('mhaFilterJenisRiwayat').value;
      const riwayat = await apiPost('getRiwayatPerubahanHakAkses', { token: T, cari, jenis });
      if (!riwayat.length) { el.innerHTML = '<div class="empty-state">Belum ada riwayat perubahan.</div>'; return; }
      el.innerHTML = riwayat.map(r => {
        let isiDetail = '';
        if (r.aksi === 'UBAH_ROLE_BARU') isiDetail = `${escapeHtml(namaRole_(r.detail.roleLama))} → ${escapeHtml(namaRole_(r.detail.roleBaru))}${r.detail.alasan ? ' · ' + escapeHtml(r.detail.alasan) : ''}`;
        else if (r.aksi === 'UBAH_KONFIGURASI_HAK_AKSES') isiDetail = escapeHtml(r.target);
        else if (r.aksi === 'UBAH_PETUGAS_STOK') isiDetail = r.detail.sesudah ? 'Dijadikan Petugas Stok' : 'Status Petugas Stok dicabut';
        return `<div class="mha-riwayat-item">
          <div class="waktu">${r.waktu ? new Date(r.waktu).toLocaleString('id-ID') : '-'}</div>
          <div class="judul">${escapeHtml(r.labelAksi)}</div>
          <div style="font-size:13px;">${isiDetail}</div>
          <div class="pelaku">Pelaku: ${escapeHtml(r.pelaku)}</div>
        </div>`;
      }).join('');
    } catch (err) {
      el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    }
  }
  document.getElementById('mhaCariRiwayat').addEventListener('input', () => { clearTimeout(window._mhaRiwayatTimeout); window._mhaRiwayatTimeout = setTimeout(muatRiwayat_, 300); });
  document.getElementById('mhaFilterJenisRiwayat').addEventListener('change', muatRiwayat_);

  muatSemua();

  // ---------- STATUS RBAC & EVALUASI (Tahap 2 Hak Akses) ----------
  // Mode ditampilkan saja; DIUBAH hanya oleh Admin lewat Script Properties (tidak ada tombol ubah mode). TEGAK menunggu persetujuan laporan evaluasi.
  (function kartuRbac_() {
    const panel = document.getElementById('panelManajemenHakAkses'); if (!panel) return;
    const kartu = document.createElement('div'); kartu.id = 'mhaRbacKartu'; kartu.className = 'admin-stat-card'; kartu.style.cssText = 'padding:12px 14px;text-align:left;margin:0 0 14px;font-size:13px;';
    const kepala = panel.querySelector('.shell-page-head'); if (kepala) kepala.after(kartu); else panel.prepend(kartu);
    const LABEL_MODE = { OFF: 'OFF — sistem lama berlaku, mesin baru tidak aktif', BAYANGAN: 'BAYANGAN — sistem lama berlaku; mesin baru hanya mencatat selisih', TEGAK: 'TEGAK — mesin baru menentukan akses' };
    const kelompok = (arr, f) => { const o = {}; arr.forEach(x => { const k = f(x); o[k] = (o[k] || 0) + 1; }); return Object.keys(o).sort().map(k => `<li>${escapeHtml(k)}: <b>${o[k]}</b></li>`).join(''); };
    async function muat() {
      try {
        const s = await apiPost('getStatusRbac', { token: T }); pasanganRbac = s.pasangan || null;
        kartu.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">Mesin akses baru (RBAC)</div><div>Mode: <b>${escapeHtml(LABEL_MODE[s.mode] || s.mode)}</b></div>
          <div style="color:var(--color-text-muted);font-size:12px;margin:4px 0 8px;">Konfigurasi sumber: ${s.sumberKonfigurasi === 'SHEET' ? 'sheet 34_KONFIGURASI_HAK_AKSES' : 'draf (belum diterapkan ke sheet)'} · ${s.jumlahPemeriksaan} pemeriksaan di server · selisih BAYANGAN tercatat: ${s.selisihBayanganTercatat}</div>
          <button type="button" class="btn-mini" id="btnEvaluasiRbac">Lihat evaluasi</button> <span id="mhaEvalPesan" style="margin-left:8px;"></span><div id="mhaEvalIsi" style="margin-top:10px;"></div>`;
        document.getElementById('btnEvaluasiRbac').addEventListener('click', evaluasi);
      } catch (err) { kartu.innerHTML = '<span style="color:#c0392b;">' + escapeHtml(err.message || 'Gagal memuat status RBAC.') + '</span> <button type="button" class="btn-mini" id="btnRbacLagi">Coba lagi</button>'; const b = document.getElementById('btnRbacLagi'); if (b) b.addEventListener('click', muat); }
    }
    async function evaluasi() {
      const pesan = document.getElementById('mhaEvalPesan'), isi = document.getElementById('mhaEvalIsi'); pesan.textContent = 'Menghitung…'; isi.innerHTML = '';
      try {
        const r = await apiPost('evaluasiBayanganRbac', { token: T }); pesan.textContent = '';
        isi.innerHTML = `<div>${r.jumlahPengguna} pengguna × ${r.jumlahPemeriksaan} pemeriksaan = ${r.jumlahKeputusan} keputusan: <b>${r.sama}</b> sama · <b style="color:#c0392b;">${r.akanDitolak.length}</b> akan DITOLAK · <b style="color:#2e7d32;">${r.akanDibuka.length}</b> akan DIBUKA · <b style="color:#c0392b;">${r.potensiTerkunci.length}</b> potensi terkunci</div>
          ${r.catatan.length ? '<ul style="margin:6px 0 0 18px;color:#8a5a12;">' + r.catatan.map(c => '<li>' + escapeHtml(c) + '</li>').join('') + '</ul>' : ''}
          <details style="margin-top:6px;"><summary style="cursor:pointer;">Akan dibuka (${r.akanDibuka.length})</summary><ul style="margin:4px 0 0 18px;">${kelompok(r.akanDibuka, x => x.role + ' · ' + x.modul + ' · ' + (x.khusus || x.izin))}</ul></details>
          <details><summary style="cursor:pointer;">Akan ditolak (${r.akanDitolak.length})</summary><ul style="margin:4px 0 0 18px;">${kelompok(r.akanDitolak, x => x.role + ' · ' + x.modul + ' · ' + (x.khusus || x.izin))}</ul></details>
          <details><summary style="cursor:pointer;">Potensi terkunci (${r.potensiTerkunci.length})</summary><ul style="margin:4px 0 0 18px;">${r.potensiTerkunci.map(t => '<li>' + escapeHtml(t.nama + ' (' + t.role + ') — ' + t.modul) + '</li>').join('') || '<li>Tidak ada</li>'}</ul></details>
          <p style="font-size:11.5px;color:var(--color-text-muted);margin:6px 0 0;">${escapeHtml(r.peringatan)}</p>`;
      } catch (err) { pesan.style.color = '#c0392b'; pesan.textContent = err.message || 'Gagal membuat evaluasi.'; }
    }
    muat();
  })();
})();

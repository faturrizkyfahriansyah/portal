// SPPG JEUNGJING — SIPANDU (Work Order)
// Backend (Role.gs SipanduAuth -> requireSipanduPermission_) yang
// menentukan boleh/tidaknya akses, bukan halaman ini.

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }
  const token = sesi.token;

  const el = {
    ditolak: document.getElementById('sipanduAksesDitolak'),
    konten: document.getElementById('sipanduKontenUtama'),
    tabs: document.querySelectorAll('#sipanduTabs .chip-tab'),
    subs: document.querySelectorAll('.sipandu-sub'),

    dashWoHariIni: document.getElementById('dashWoHariIni'),
    dashTotalPorsi: document.getElementById('dashTotalPorsi'),
    dashWoReady: document.getElementById('dashWoReady'),
    dashOperasional: document.getElementById('dashOperasional'),
    dashPopReady: document.getElementById('dashPopReady'),
    dashPopStale: document.getElementById('dashPopStale'),
    dashPopFilled: document.getElementById('dashPopFilled'),
    dashCompleted: document.getElementById('dashCompleted'),

    woFilterStatus: document.getElementById('woFilterStatus'),
    btnFilterWo: document.getElementById('btnFilterWo'),
    btnBukaTambahWo: document.getElementById('btnBukaTambahWo'),
    woListWrap: document.getElementById('woListWrap'),

    modalTambahWo: document.getElementById('modalTambahWo'),
    formTambahWo: document.getElementById('formTambahWo'),
    woTanggal: document.getElementById('woTanggal'),
    woMenu: document.getElementById('woMenu'),
    woJumlahPorsi: document.getElementById('woJumlahPorsi'),
    woCatatan: document.getElementById('woCatatan'),
    btnBatalTambahWo: document.getElementById('btnBatalTambahWo'),

    modalDetailWo: document.getElementById('modalDetailWo'),
    detailWoNomor: document.getElementById('detailWoNomor'),
    detailWoStatus: document.getElementById('detailWoStatus'),
    detailWoTanggal: document.getElementById('detailWoTanggal'),
    detailWoMenu: document.getElementById('detailWoMenu'),
    detailWoJumlahPorsi: document.getElementById('detailWoJumlahPorsi'),
    detailWoTotalPenerima: document.getElementById('detailWoTotalPenerima'),
    detailWoCatatan: document.getElementById('detailWoCatatan'),
    detailWoAksiStatus: document.getElementById('detailWoAksiStatus'),
    btnTutupDetailWo: document.getElementById('btnTutupDetailWo'),

    formTambahBeneficiary: document.getElementById('formTambahBeneficiary'),
    bnfLokasi: document.getElementById('bnfLokasi'),
    bnfPb: document.getElementById('bnfPb'),
    bnfPk: document.getElementById('bnfPk'),
    bnfBumil: document.getElementById('bnfBumil'),
    bnfBusui: document.getElementById('bnfBusui'),
    bnfBalita: document.getElementById('bnfBalita')
  };

  let idWoTerbuka = null;
  let cacheMenu = [];
  let cacheRoleList = [];
  let profilSaya = null;

  // --------------------------------------------------------
  // Cek akses dulu lewat dashboard -- kalau ditolak, hentikan semua.
  // --------------------------------------------------------
  try {
    showLoading('Memeriksa akses SIPANDU...');
    profilSaya = await sipanduApiGet('getSipanduProfilSaya', { token });
    await muatDashboard();
    hideLoading();
    el.konten.style.display = 'block';

    if (profilSaya && profilSaya.role === 'ADMIN') {
      document.getElementById('tabHakAkses').classList.remove('is-hidden');
    }
  } catch (err) {
    hideLoading();
    // TAMPILKAN PESAN ERROR ASLI -- sebelumnya SEMUA kegagalan (apa pun
    // penyebabnya: belum terdaftar di SIPANDU, Script Property belum
    // diisi, sheet SIPANDU tidak ketemu, dll) ditampilkan sebagai
    // "Akses Ditolak" generik yang sama, menyesatkan kalau penyebabnya
    // sebenarnya bukan soal akses/pendaftaran.
    document.getElementById('sipanduPesanErrorAsli').textContent = err.message || 'Terjadi kesalahan tidak diketahui.';
    el.ditolak.style.display = 'block';
    return;
  }

  // --------------------------------------------------------
  // SUB-TAB
  // --------------------------------------------------------
  el.tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      el.tabs.forEach(b => b.classList.remove('active'));
      el.subs.forEach(s => { s.style.display = 'none'; });
      btn.classList.add('active');
      const target = document.getElementById('sipanduSub' + btn.dataset.sub.charAt(0).toUpperCase() + btn.dataset.sub.slice(1));
      if (target) target.style.display = 'block';

      if (btn.dataset.sub === 'dashboard') muatDashboard();
      else if (btn.dataset.sub === 'wo') muatDaftarWo();
      else if (btn.dataset.sub === 'hakakses') muatHakAkses();
    });
  });

  // --------------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------------
  async function muatDashboard() {
    const d = await sipanduApiGet('getSipanduDashboard', { token });
    el.dashWoHariIni.textContent = d.woHariIni;
    el.dashTotalPorsi.textContent = d.totalPorsiHariIni;
    el.dashWoReady.textContent = d.woReady;
    el.dashOperasional.textContent = d.operasionalBerjalan;
    el.dashPopReady.textContent = d.popReady;
    el.dashPopStale.textContent = d.popStale;
    el.dashPopFilled.textContent = d.popFilled;
    el.dashCompleted.textContent = d.completed;
  }

  // --------------------------------------------------------
  // DAFTAR WORK ORDER
  // --------------------------------------------------------
  function labelStatus_(status) {
    const label = { DRAFT: 'Draft', DATA_LENGKAP: 'Data Lengkap', READY: 'Ready', POP_FILLED: 'POP Filled', COMPLETED: 'Completed' };
    return label[status] || status;
  }
  function kelasStatus_(status) { return 'status-' + String(status).toLowerCase(); }

  async function muatDaftarWo() {
    el.woListWrap.innerHTML = '<div class="empty-state">Memuat data...</div>';
    try {
      const list = await sipanduApiGet('getWorkOrderList', { token, status: el.woFilterStatus.value });
      if (!list.length) { el.woListWrap.innerHTML = '<div class="empty-state">Belum ada Work Order. Tap "+ Buat Work Order" untuk mulai.</div>'; return; }

      el.woListWrap.innerHTML = list.map(w => `
        <div class="sipandu-wo-card" data-id="${escapeHtml(w.id)}">
          <div class="sipandu-wo-card-top">
            <strong>${escapeHtml(w.nomorWO)}</strong>
            <span class="sipandu-status-badge ${kelasStatus_(w.status)}">${labelStatus_(w.status)}</span>
          </div>
          <p>${escapeHtml(w.tanggal)} · ${escapeHtml(w.namaMenu)} · ${w.jumlahPorsi} porsi</p>
        </div>`).join('');

      el.woListWrap.querySelectorAll('.sipandu-wo-card').forEach(card => {
        card.addEventListener('click', () => bukaDetailWo(card.dataset.id));
      });
    } catch (err) {
      el.woListWrap.innerHTML = '';
      showError(err.message);
    }
  }
  el.btnFilterWo.addEventListener('click', muatDaftarWo);

  // --------------------------------------------------------
  // TAMBAH WORK ORDER
  // --------------------------------------------------------
  async function pastikanMenuTermuat_() {
    if (!cacheMenu.length) {
      try {
        cacheMenu = await sipanduApiGet('getMenuList', { token });
        el.woMenu.innerHTML = '<option value="">Pilih Menu</option>' +
          cacheMenu.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.nama)}</option>`).join('');
      } catch (err) { showError(err.message); }
    }
  }

  el.btnBukaTambahWo.addEventListener('click', async () => {
    await pastikanMenuTermuat_();
    el.formTambahWo.reset();
    el.modalTambahWo.classList.remove('is-hidden');
  });
  el.btnBatalTambahWo.addEventListener('click', () => el.modalTambahWo.classList.add('is-hidden'));
  el.modalTambahWo.addEventListener('click', (e) => { if (e.target === el.modalTambahWo) el.modalTambahWo.classList.add('is-hidden'); });

  el.formTambahWo.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      showLoading('Menyimpan Work Order...');
      const hasil = await sipanduApiPost('addWorkOrder', {
        token, tanggal: el.woTanggal.value, idMenu: el.woMenu.value,
        jumlahPorsi: Number(el.woJumlahPorsi.value || 0), catatan: el.woCatatan.value.trim()
      });
      hideLoading();
      showSuccess('Work Order ' + hasil.nomorWO + ' berhasil dibuat.');
      el.modalTambahWo.classList.add('is-hidden');
      await muatDaftarWo();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // DETAIL WORK ORDER + TRANSISI STATUS + PENERIMA MANFAAT
  // --------------------------------------------------------
  const URUTAN_STATUS = { DRAFT: 'DATA_LENGKAP', DATA_LENGKAP: 'READY', READY: 'POP_FILLED', POP_FILLED: 'COMPLETED' };
  const LABEL_TOMBOL_STATUS = {
    DRAFT: 'Tandai Data Lengkap',
    DATA_LENGKAP: 'Tandai Ready (butuh Validasi)',
    READY: 'Tandai POP Filled (butuh Snapshot POP)',
    POP_FILLED: 'Tandai Completed'
  };

  async function bukaDetailWo(idWo) {
    idWoTerbuka = idWo;
    el.modalDetailWo.classList.remove('is-hidden');
    try {
      const d = await sipanduApiGet('getWorkOrderDetail', { token, id: idWo });
      el.detailWoNomor.textContent = d.nomorWO;
      el.detailWoStatus.textContent = labelStatus_(d.status);
      el.detailWoStatus.className = 'sipandu-status-badge ' + kelasStatus_(d.status);
      el.detailWoTanggal.textContent = d.tanggal;
      el.detailWoMenu.textContent = d.namaMenu;
      el.detailWoJumlahPorsi.textContent = d.jumlahPorsi;
      el.detailWoTotalPenerima.textContent = d.totalPenerimaManfaat + ' (' + d.jumlahLokasiPenerima + ' lokasi)';
      el.detailWoCatatan.textContent = d.catatan || '-';

      const targetStatus = URUTAN_STATUS[d.status];
      if (d.status === 'DATA_LENGKAP') {
        await tampilkanChecklistValidasi(idWo);
      } else if (d.status === 'READY') {
        await tampilkanGeneratePOP(idWo);
      } else if (targetStatus) {
        el.detailWoAksiStatus.innerHTML = `<button type="button" class="btn-submit" id="btnAdvanceStatus" style="width:100%;">${LABEL_TOMBOL_STATUS[d.status]}</button>`;
        document.getElementById('btnAdvanceStatus').addEventListener('click', () => advanceStatus(idWo, targetStatus));
      } else {
        el.detailWoAksiStatus.innerHTML = '<p style="font-size:12.5px;color:var(--color-text-muted);">Work Order sudah selesai (Completed).</p>';
      }
    } catch (err) {
      showError(err.message);
    }
  }

  async function tampilkanGeneratePOP(idWo) {
    try {
      const snap = await sipanduApiGet('getLatestSnapshot', { token, idWo });

      if (!snap) {
        el.detailWoAksiStatus.innerHTML = `<button type="button" class="btn-submit" id="btnGeneratePop" style="width:100%;">⚡ Generate POP</button>`;
        document.getElementById('btnGeneratePop').addEventListener('click', () => jalankanGeneratePOP(idWo));
        return;
      }

      if (snap.isStale) {
        el.detailWoAksiStatus.innerHTML = `
          <div class="stok-perhatian-row" style="margin-bottom:10px;">
            <div><p>⚠️ POP Perlu Diperbarui</p><small>Data SIPANDU berubah setelah POP dibuat (versi ${snap.versi}).</small></div>
          </div>
          <button type="button" class="btn-submit" id="btnGeneratePop" style="width:100%;">⚡ Generate Ulang POP</button>`;
        document.getElementById('btnGeneratePop').addEventListener('click', () => jalankanGeneratePOP(idWo));
        return;
      }

      el.detailWoAksiStatus.innerHTML = `
        <div class="stok-perhatian-row" style="margin-bottom:10px;background:#e8f6ee;">
          <div><p>✓ POP Siap (Snapshot v${snap.versi})</p><small>Dibuat oleh ${escapeHtml(snap.dibuatOleh)} · Data siap dipakai isi form POP resmi (manual, lihat Field Mapping).</small></div>
        </div>
        <button type="button" class="btn-outline" id="btnLihatSnapshot" style="width:100%;margin-bottom:8px;">Lihat Detail Data POP</button>
        <button type="button" class="btn-submit" id="btnAdvanceStatus" style="width:100%;">Tandai POP Filled</button>`;
      document.getElementById('btnAdvanceStatus').addEventListener('click', () => advanceStatus(idWo, 'POP_FILLED'));
      document.getElementById('btnLihatSnapshot').addEventListener('click', () => {
        alert(JSON.stringify(snap.data, null, 2));
      });
    } catch (err) {
      showError(err.message);
    }
  }

  async function jalankanGeneratePOP(idWo) {
    try {
      showLoading('Membuat snapshot POP...');
      const hasil = await sipanduApiPost('generatePOP', { token, idWo });
      hideLoading();
      showSuccess('Snapshot POP versi ' + hasil.versi + ' berhasil dibuat.');
      await bukaDetailWo(idWo);
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  }

  const LABEL_CHECKLIST = {
    wo: 'Work Order dibuat', tanggal: 'Tanggal operasional terisi', menu: 'Menu dipilih',
    jumlah_porsi: 'Jumlah porsi > 0', beneficiaries: 'Penerima manfaat terisi',
    preparation: 'Data Persiapan ada', processing: 'Data Pengolahan ada',
    portioning: 'Data Pemorsian ada', distribution: 'Data Distribusi ada'
  };

  async function tampilkanChecklistValidasi(idWo) {
    try {
      const v = await sipanduApiGet('getValidationStatus', { token, idWo });
      const checklist = v.checklistTersimpan || v.checklistOtomatis;

      const baris = Object.keys(LABEL_CHECKLIST).map(k => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;">
          <input type="checkbox" class="chk-validasi" data-key="${k}" ${checklist[k] ? 'checked' : ''}>
          ${LABEL_CHECKLIST[k]} ${v.checklistOtomatis[k] ? '<span style="color:#1a7a4c;font-size:11px;">(otomatis: sudah ada)</span>' : '<span style="color:#b23a3a;font-size:11px;">(otomatis: belum ada)</span>'}
        </label>`).join('');

      el.detailWoAksiStatus.innerHTML = `
        <p style="font-size:12.5px;color:var(--color-text-muted);margin-bottom:8px;">Centang tanda "otomatis" cuma saran dari data yang ada — konfirmasi manual tetap wajib sebelum Ready.</p>
        <div id="checklistValidasiWrap">${baris}</div>
        <button type="button" class="btn-submit" id="btnSimpanValidasi" style="width:100%;margin-top:10px;">Simpan &amp; Tandai Ready</button>
      `;

      document.getElementById('btnSimpanValidasi').addEventListener('click', async () => {
        const checklistBaru = {};
        document.querySelectorAll('.chk-validasi').forEach(c => { checklistBaru[c.dataset.key] = c.checked; });
        try {
          showLoading('Menyimpan validasi...');
          await sipanduApiPost('setValidationChecklist', { token, idWo, checklist: checklistBaru, isReady: true });
          await sipanduApiPost('advanceWorkOrderStatus', { token, id: idWo, targetStatus: 'READY' });
          hideLoading();
          showSuccess('Work Order ditandai Ready.');
          await bukaDetailWo(idWo);
          await muatDaftarWo();
        } catch (err) {
          hideLoading();
          showError(err.message);
        }
      });
    } catch (err) {
      showError(err.message);
    }
  }

  async function advanceStatus(idWo, targetStatus) {
    if (!confirm('Yakin ubah status Work Order ini ke ' + labelStatus_(targetStatus) + '?')) return;
    try {
      showLoading('Memproses transisi status...');
      await sipanduApiPost('advanceWorkOrderStatus', { token, id: idWo, targetStatus });
      hideLoading();
      showSuccess('Status berhasil diubah ke ' + labelStatus_(targetStatus) + '.');
      await bukaDetailWo(idWo);
      await muatDaftarWo();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  }

  el.btnTutupDetailWo.addEventListener('click', () => { el.modalDetailWo.classList.add('is-hidden'); muatDaftarWo(); });
  el.modalDetailWo.addEventListener('click', (e) => { if (e.target === el.modalDetailWo) { el.modalDetailWo.classList.add('is-hidden'); muatDaftarWo(); } });

  el.formTambahBeneficiary.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!idWoTerbuka) return;
    try {
      showLoading('Menyimpan Penerima Manfaat...');
      await sipanduApiPost('addBeneficiary', {
        token, idWo: idWoTerbuka, lokasi: el.bnfLokasi.value.trim(),
        pb: Number(el.bnfPb.value || 0), pk: Number(el.bnfPk.value || 0),
        bumil: Number(el.bnfBumil.value || 0), busui: Number(el.bnfBusui.value || 0), balita: Number(el.bnfBalita.value || 0)
      });
      hideLoading();
      showSuccess('Penerima manfaat ditambahkan.');
      el.formTambahBeneficiary.reset();
      await bukaDetailWo(idWoTerbuka);
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // HAK AKSES (khusus role ADMIN)
  // --------------------------------------------------------
  async function pastikanRoleListTermuat_() {
    if (!cacheRoleList.length) {
      cacheRoleList = await sipanduApiGet('getDaftarRoleSipandu', { token });
    }
  }

  async function muatHakAkses() {
    const wrap = document.getElementById('hakAksesListWrap');
    wrap.innerHTML = '<div class="empty-state">Memuat data...</div>';
    try {
      await pastikanRoleListTermuat_();
      const opsiRole = '<option value="">Belum diberi akses</option>' +
        cacheRoleList.map(r => `<option value="${escapeHtml(r.kode)}">${escapeHtml(r.nama)}</option>`).join('');

      const daftar = await sipanduApiGet('getDaftarRelawanUntukHakAkses', { token });
      if (!daftar.length) { wrap.innerHTML = '<div class="empty-state">Tidak ada relawan aktif ditemukan.</div>'; return; }

      wrap.innerHTML = daftar.map(r => `
        <div class="sipandu-hakakses-row" data-id="${escapeHtml(r.id)}">
          <span class="nama">${escapeHtml(r.nama)}</span>
          <select class="select-role-hakakses">${opsiRole}</select>
        </div>`).join('');

      wrap.querySelectorAll('.sipandu-hakakses-row').forEach(row => {
        const id = row.dataset.id;
        const data = daftar.find(r => r.id === id);
        const select = row.querySelector('.select-role-hakakses');
        select.value = data.aktifDiSipandu ? data.roleSipandu : '';

        select.addEventListener('change', async () => {
          try {
            if (!select.value) {
              await sipanduApiPost('cabutSipanduUserRole', { token, idRelawan: id });
              showSuccess('Akses ' + data.nama + ' dicabut dari SIPANDU.');
            } else {
              await sipanduApiPost('setSipanduUserRole', { token, idRelawan: id, nama: data.nama, role: select.value, aktif: true });
              showSuccess('Role ' + data.nama + ' diatur jadi ' + select.value + '.');
            }
          } catch (err) {
            showError(err.message);
            await muatHakAkses();
          }
        });
      });
    } catch (err) {
      wrap.innerHTML = '';
      showError(err.message);
    }
  }
});

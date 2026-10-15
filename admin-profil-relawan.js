// admin-profil-relawan.js — Halaman Detail Profil Relawan (Bagian B,
// Redesain Terintegrasi). Lazy-loaded via MODUL_LAZY (admin.js) saat
// panelProfilRelawan dibuka. Dibuka programatik lewat window.bukaProfilRelawan(id)
// -- dipanggil dari panel Relawan (tombol "Lihat Profil") dan Pencarian
// Global (lihat admin.js).
(function () {
  function token() { return window.sppgAdminToken; }
  const kontenUtama = document.getElementById('prKontenUtama');
  let profilSaatIni = null;
  let modeEdit = false;

  const LABEL_JK = { L: 'Laki-laki', P: 'Perempuan' };

  function inisial_(nama) {
    const kata = (nama || '').trim().split(/\s+/);
    return ((kata[0] || '')[0] || '?').toUpperCase() + ((kata[1] || '')[0] || '').toUpperCase();
  }

  function samarkanRekening_(no) {
    if (!no) return '';
    const s = String(no);
    if (s.length <= 4) return s;
    return '•'.repeat(s.length - 4) + s.slice(-4);
  }

  function badgeStatus_(status) {
    const aktif = String(status).toUpperCase() === 'AKTIF';
    return `<span class="badge ${aktif ? 'aktif' : 'nonaktif'}">${escapeHtml(status)}</span>`;
  }

  function baris_(label, nilai, kosongLabel) {
    return `<div style="padding:7px 0;border-bottom:1px solid var(--color-border);">
      <div style="font-size:11px;color:var(--color-text-muted);font-weight:600;">${escapeHtml(label)}</div>
      <div style="font-size:13.5px;margin-top:2px;">${nilai ? escapeHtml(String(nilai)) : '<span style="color:var(--color-text-muted);">' + (kosongLabel || '—') + '</span>'}</div>
    </div>`;
  }

  async function muatProfil(idRelawan) {
    kontenUtama.innerHTML = '<div class="empty-state">Memuat profil...</div>';
    try {
      profilSaatIni = await apiPost('getProfilRelawanAdmin', { token: token(), idRelawan });
      modeEdit = false;
      render();
    } catch (err) {
      kontenUtama.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  function render() {
    const p = profilSaatIni;
    if (!p) return;

    kontenUtama.innerHTML = `
      <!-- HEADER -->
      <div class="panel-block" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn-mini" id="prBtnKembali">← Kembali</button>
          <button type="button" class="btn-mini primary" id="prBtnEdit">${modeEdit ? 'Batal Edit' : '✎ Edit Profil'}</button>
        </div>
        <div style="display:flex;gap:16px;align-items:center;margin-top:14px;flex-wrap:wrap;">
          ${p.fotoProfilUrl
            ? `<img src="${escapeHtml(p.fotoProfilUrl)}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
            : `<div style="width:64px;height:64px;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex-shrink:0;">${escapeHtml(inisial_(p.nama))}</div>`}
          <div style="min-width:0;">
            <div style="font-size:19px;font-weight:800;color:var(--color-navy);">${escapeHtml(p.nama)}</div>
            <div style="font-size:12.5px;color:var(--color-text-muted);margin-top:2px;">${escapeHtml(p.id)} · ${escapeHtml(p.divisi || '-')}${p.jabatan ? ' · ' + escapeHtml(p.jabatan) : ''}</div>
            <div style="margin-top:6px;">${badgeStatus_(p.status)}</div>
          </div>
        </div>
      </div>

      <!-- KELENGKAPAN PROFIL -->
      <div class="panel-block" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <p class="panel-block-title" style="margin:0;">Kelengkapan Profil</p>
          <span style="font-weight:800;font-size:15px;color:${p.kelengkapan.persen === 100 ? 'var(--color-success)' : 'var(--color-navy)'};">${p.kelengkapan.persen}%</span>
        </div>
        <div style="background:var(--color-border);border-radius:8px;height:8px;overflow:hidden;">
          <div style="background:${p.kelengkapan.persen === 100 ? 'var(--color-success)' : 'var(--color-primary)'};height:100%;width:${p.kelengkapan.persen}%;transition:width 0.3s;"></div>
        </div>
        <p style="font-size:12px;color:var(--color-text-muted);margin:8px 0 0;">
          ${p.kelengkapan.persen === 100
            ? '✓ Profil sudah lengkap.'
            : (p.kelengkapan.total - p.kelengkapan.terisi) + ' dari ' + p.kelengkapan.total + ' data inti belum diisi: ' + p.kelengkapan.belumLengkap.map(escapeHtml).join(', ') + '.'}
        </p>
      </div>

      <div id="prGridBagian" style="display:grid;grid-template-columns:1fr;gap:14px;">
        <!-- DATA PRIBADI -->
        <div class="panel-block">
          <p class="panel-block-title">Data Pribadi</p>
          <div id="prBagianPribadi"></div>
        </div>

        <!-- DIVISI & PENUGASAN (read-only, bersumber sama dgn panel Relawan) -->
        <div class="panel-block">
          <p class="panel-block-title">Divisi &amp; Penugasan</p>
          ${baris_('Divisi', p.divisi)}
          ${baris_('Jabatan', p.jabatan)}
          ${baris_('Status Relawan', p.status)}
          ${baris_('Tanggal Bergabung', p.tanggalBergabung)}
        </div>

        <!-- KONTAK -->
        <div class="panel-block">
          <p class="panel-block-title">Kontak</p>
          <div id="prBagianKontak"></div>
        </div>

        <!-- KONTAK DARURAT -->
        <div class="panel-block">
          <p class="panel-block-title">Kontak Darurat</p>
          <div id="prBagianDarurat"></div>
        </div>

        <!-- REKENING -->
        <div class="panel-block">
          <p class="panel-block-title">Informasi Rekening</p>
          ${!modeEdit ? `
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:11px;color:var(--color-text-muted);font-weight:600;">Nomor Rekening</div>
              <div id="prNomorRekening" style="font-size:15px;font-weight:700;margin-top:2px;font-family:monospace;">${p.nomorRekening ? escapeHtml(samarkanRekening_(p.nomorRekening)) : '<span style="color:var(--color-text-muted);font-family:var(--font-main);font-weight:400;">Belum diisi</span>'}</div>
            </div>
            ${p.nomorRekening ? '<button type="button" class="btn-mini" id="prBtnTampilRekening">👁 Tampilkan</button>' : ''}
          </div>` : fieldEdit_('Nomor Rekening', 'prRekening', p.nomorRekening, 'text', 'Hanya angka')}
          <p style="font-size:11px;color:var(--color-text-muted);margin:8px 0 0;">Tersamarkan secara default. Nama bank &amp; nama pemilik rekening belum menjadi bagian dari data sistem saat ini — hanya nomor rekening yang tersimpan.</p>
        </div>

        <!-- HAK AKSES (read-only, murni informasi) -->
        <div class="panel-block">
          <p class="panel-block-title">Hak Akses</p>
          ${baris_('Username', p.username)}
          ${baris_('Role', p.akses.role)}
          ${baris_('Hak Akses Tambahan', p.akses.hakAkses)}
          ${baris_('Status Akun', p.akses.statusAkun)}
          ${baris_('Wajib Ganti Password', p.akses.wajibGantiPassword ? 'Ya' : 'Tidak')}
          ${baris_('Login Terakhir', p.akses.terakhirLogin ? new Date(p.akses.terakhirLogin).toLocaleString('id-ID') : null, 'Belum pernah login')}
          <p style="font-size:11px;color:var(--color-text-muted);margin:8px 0 0;">Bagian ini murni informasi — perubahan role/status akun dilakukan lewat menu Akun Relawan atau Role ASN &amp; Kepala SPPG, bukan dari sini.</p>
        </div>
      </div>

      <div id="prAksiSimpan" style="display:${modeEdit ? 'flex' : 'none'};gap:8px;margin-top:14px;position:sticky;bottom:12px;">
        <button type="button" class="btn-mini primary" id="prBtnSimpan" style="flex:1;padding:12px;">💾 Simpan Perubahan</button>
      </div>
    `;

    renderBagianPribadi_(p);
    renderBagianKontak_(p);
    renderBagianDarurat_(p);
    pasangListener_();
  }

  function renderBagianPribadi_(p) {
    const el = document.getElementById('prBagianPribadi');
    if (!modeEdit) {
      el.innerHTML = baris_('NIK', p.nik) + baris_('Tempat, Tanggal Lahir', [p.tempatLahir, p.tanggalLahir].filter(Boolean).join(', ')) +
        baris_('Jenis Kelamin', LABEL_JK[p.jenisKelamin] || p.jenisKelamin) + baris_('Status Pernikahan', p.statusPernikahan) + baris_('Agama', p.agama);
      return;
    }
    el.innerHTML = `
      ${fieldEdit_('NIK', 'prNik', p.nik, 'text')}
      ${fieldEdit_('Tempat Lahir', 'prTempatLahir', p.tempatLahir, 'text')}
      ${fieldEdit_('Tanggal Lahir', 'prTanggalLahir', p.tanggalLahir, 'text', 'DD/MM/YYYY')}
      <label style="font-size:11px;font-weight:600;display:block;margin:8px 0 3px;">Jenis Kelamin</label>
      <select id="prJenisKelamin" class="input" style="width:100%;padding:7px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:8px;">
        <option value="">-</option><option value="L" ${p.jenisKelamin === 'L' ? 'selected' : ''}>Laki-laki</option><option value="P" ${p.jenisKelamin === 'P' ? 'selected' : ''}>Perempuan</option>
      </select>
      ${fieldEdit_('Status Pernikahan', 'prStatusPernikahan', p.statusPernikahan, 'text')}
      ${fieldEdit_('Agama', 'prAgama', p.agama, 'text')}
    `;
  }

  function renderBagianKontak_(p) {
    const el = document.getElementById('prBagianKontak');
    if (!modeEdit) {
      el.innerHTML = baris_('Nomor HP', p.noHp) + baris_('Email', p.email) + baris_('Alamat', p.alamat);
      return;
    }
    el.innerHTML = fieldEdit_('Nomor HP', 'prNoHp', p.noHp, 'tel') + fieldEdit_('Email', 'prEmail', p.email, 'email') +
      `<label style="font-size:11px;font-weight:600;display:block;margin:8px 0 3px;">Alamat</label><textarea id="prAlamat" class="input" style="width:100%;padding:7px;border:1px solid var(--color-border);border-radius:8px;min-height:60px;font-family:var(--font-main);">${escapeHtml(p.alamat || '')}</textarea>`;
  }

  function renderBagianDarurat_(p) {
    const el = document.getElementById('prBagianDarurat');
    if (!modeEdit) {
      el.innerHTML = baris_('Nama', p.kontakDarurat.nama) + baris_('Hubungan', p.kontakDarurat.hubungan === 'Lainnya' ? p.kontakDarurat.hubunganLainnya : p.kontakDarurat.hubungan) + baris_('Nomor HP', p.kontakDarurat.noHp);
      return;
    }
    el.innerHTML = fieldEdit_('Nama', 'prKdNama', p.kontakDarurat.nama, 'text') + fieldEdit_('Hubungan', 'prKdHubungan', p.kontakDarurat.hubungan, 'text') + fieldEdit_('Nomor HP', 'prKdNoHp', p.kontakDarurat.noHp, 'tel');
  }

  function fieldEdit_(label, id, nilai, tipe, placeholder) {
    return `<label style="font-size:11px;font-weight:600;display:block;margin:8px 0 3px;">${escapeHtml(label)}</label>
      <input type="${tipe}" id="${id}" class="input" value="${escapeHtml(nilai || '')}" ${placeholder ? 'placeholder="' + escapeHtml(placeholder) + '"' : ''} style="width:100%;padding:7px;border:1px solid var(--color-border);border-radius:8px;">`;
  }

  function pasangListener_() {
    document.getElementById('prBtnKembali').addEventListener('click', () => {
      const tombolRelawan = document.querySelector('.admin-tab-btn[data-panel="panelRelawan"]');
      if (tombolRelawan) tombolRelawan.click();
    });
    document.getElementById('prBtnEdit').addEventListener('click', () => { modeEdit = !modeEdit; render(); });
    const btnRekening = document.getElementById('prBtnTampilRekening');
    if (btnRekening) btnRekening.addEventListener('click', () => {
      const el = document.getElementById('prNomorRekening');
      const ditampilkan = btnRekening.textContent.indexOf('Sembunyikan') !== -1;
      el.textContent = ditampilkan ? samarkanRekening_(profilSaatIni.nomorRekening) : profilSaatIni.nomorRekening;
      btnRekening.innerHTML = ditampilkan ? '👁 Tampilkan' : '🙈 Sembunyikan';
    });
    const btnSimpan = document.getElementById('prBtnSimpan');
    if (btnSimpan) btnSimpan.addEventListener('click', simpanPerubahan_);
  }

  async function simpanPerubahan_() {
    const btn = document.getElementById('prBtnSimpan');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      // Nomor Rekening lewat updateRelawan yg SUDAH ADA (Relawan.gs) --
      // bukan duplikasi logika sanitasi-digit yg sudah benar di sana.
      // Dipisah jadi 2 panggilan (bukan digabung 1) krn memang 2 fungsi
      // backend yg BEDA tanggung jawabnya (lihat komentar updateProfilRelawanAdmin).
      const rekeningInput = document.getElementById('prRekening');
      if (rekeningInput) {
        await apiPost('updateRelawan', { token: token(), id: profilSaatIni.id, nomorRekening: rekeningInput.value.trim() });
      }
      await apiPost('updateProfilRelawanAdmin', {
        token: token(), idRelawan: profilSaatIni.id,
        nik: document.getElementById('prNik').value.trim(),
        tempatLahir: document.getElementById('prTempatLahir').value.trim(),
        tanggalLahir: document.getElementById('prTanggalLahir').value.trim(),
        jenisKelamin: document.getElementById('prJenisKelamin').value,
        statusPernikahan: document.getElementById('prStatusPernikahan').value.trim(),
        agama: document.getElementById('prAgama').value.trim(),
        noHp: document.getElementById('prNoHp').value.trim(),
        email: document.getElementById('prEmail').value.trim(),
        alamat: document.getElementById('prAlamat').value.trim(),
        kontakDaruratNama: document.getElementById('prKdNama').value.trim(),
        kontakDaruratHubungan: document.getElementById('prKdHubungan').value.trim(),
        kontakDaruratNoHp: document.getElementById('prKdNoHp').value.trim()
      });
      showSuccess('Profil berhasil disimpan.');
      await muatProfil(profilSaatIni.id); // muat ulang -- kelengkapan % & tampilan otomatis ikut data terbaru
    } catch (err) {
      showError(err.message);
      btn.disabled = false; btn.textContent = '💾 Simpan Perubahan';
    }
  }

  // Diekspos supaya ORKESTRASI pembukaan panel (lihat bukaProfilRelawan
  // di admin.js -- fungsi itu ADA SEJAK AWAL, tidak lazy, jadi selalu
  // bisa dipanggil) bisa memuat ulang profil TANPA perlu memuat ulang
  // skrip ini kalau modul sudah pernah dimuat sebelumnya.
  window.muatProfilRelawanLangsung = muatProfil;

  // Pemuatan PERTAMA KALI: admin.js sudah set window.idRelawanDibukaProfil
  // SEBELUM memicu lazy-load (lihat bukaProfilRelawan), jadi begitu skrip
  // ini selesai dimuat, langsung render profil yg diminta -- tidak nunggu
  // panggilan kedua.
  if (window.idRelawanDibukaProfil) muatProfil(window.idRelawanDibukaProfil);
})();

// ============================================================
// admin-pengaturan.js — Pengaturan Portal fungsional (BARU)
// File mandiri, pola sama seperti modul admin-* lainnya.
// ============================================================

(function () {
  'use strict';

  function token() { return window.sppgAdminToken; }
  let sudahMuatForm = false;
  let sudahMuatLog = false;

  async function muatFormPengaturan_() {
    try {
      const p = await apiGet('getPengaturanPortal', { token: token() });
      document.getElementById('inputNamaPortal').value = p.NAMA_PORTAL || '';
      document.getElementById('inputTemplateNotif').value = p.TEMPLATE_NOTIFIKASI_DEFAULT || '';
      const selTz = document.getElementById('inputTimezone');
      if (p.TIMEZONE_SISTEM) selTz.value = p.TIMEZONE_SISTEM;

      // Isi dropdown Target Default dengan daftar Divisi (reuse cache yang sudah dimuat Dashboard)
      const selTarget = document.getElementById('inputTargetDefaultNotif');
      try {
        const divisi = await apiGetCached('getDivisi', { token: token() }, 600000);
        selTarget.innerHTML = '<option value="SEMUA">Semua Relawan</option>' +
          divisi.map(d => `<option value="DIVISI:${escapeHtml(d.nama)}">Divisi: ${escapeHtml(d.nama)}</option>`).join('');
      } catch (e) { /* biarkan cuma "Semua Relawan" kalau divisi gagal dimuat */ }
      selTarget.value = p.TARGET_DEFAULT_NOTIF || 'SEMUA';
      window.sppgTargetDefault = p.TARGET_DEFAULT_NOTIF || 'SEMUA'; // dipakai admin-target-widget.js
    } catch (err) {
      showError('Gagal memuat pengaturan: ' + err.message);
    }
  }

  async function simpan_(payload, pesanSukses) {
    try {
      await apiPost('setPengaturanPortal', Object.assign({ token: token() }, payload));
      showSuccess(pesanSukses);
    } catch (err) { showError(err.message); }
  }

  async function muatLogAktivitas_() {
    const tbody = document.getElementById('tbodyLogAktivitas');
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const log = await apiGet('getLogAktivitas', { token: token() });
      if (!log.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada aktivitas tercatat.</div></td></tr>';
        return;
      }
      tbody.innerHTML = log.map(l => `
        <tr>
          <td style="white-space:nowrap;">${escapeHtml(formatTanggalWaktuIndoShell(l.waktu))}</td>
          <td>${escapeHtml(l.aktor || '-')}</td>
          <td>${escapeHtml(l.aksi || '-')}</td>
          <td>${escapeHtml(l.modul || '-')}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="color:#b23a3a;">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  // FASE 2: panelPengaturan dikonfirmasi HTML statis -- disederhanakan jadi langsung sinkron.
  const btnTab = document.querySelector('[data-panel="panelPengaturan"]');
  if (btnTab) {
    btnTab.addEventListener('click', () => {
      if (!sudahMuatForm) { sudahMuatForm = true; muatFormPengaturan_(); }
    });
  }

  // Log Aktivitas dimuat saat kategori 6 dibuka (details/summary), bukan
  // langsung saat panel Pengaturan dibuka -- supaya tidak ada request
  // yang tidak perlu kalau admin cuma mau lihat kategori lain.
  const detailsLog = document.querySelectorAll('#panelPengaturan details')[5];
  if (detailsLog) {
    detailsLog.addEventListener('toggle', () => {
      if (detailsLog.open && !sudahMuatLog) { sudahMuatLog = true; muatLogAktivitas_(); }
    });
  }

  const btnSimpanPortal = document.getElementById('btnSimpanPortal');
  if (btnSimpanPortal) {
    btnSimpanPortal.addEventListener('click', () => {
      simpan_({ NAMA_PORTAL: document.getElementById('inputNamaPortal').value.trim() }, 'Nama Portal disimpan.');
    });
  }
  const btnSimpanNotif = document.getElementById('btnSimpanNotif');
  if (btnSimpanNotif) {
    btnSimpanNotif.addEventListener('click', () => {
      const target = document.getElementById('inputTargetDefaultNotif').value;
      simpan_({ TEMPLATE_NOTIFIKASI_DEFAULT: document.getElementById('inputTemplateNotif').value, TARGET_DEFAULT_NOTIF: target }, 'Template & target notifikasi disimpan.');
      window.sppgTargetDefault = target;
    });
  }
  const btnSimpanSistem = document.getElementById('btnSimpanSistem');
  if (btnSimpanSistem) {
    btnSimpanSistem.addEventListener('click', () => {
      simpan_({ TIMEZONE_SISTEM: document.getElementById('inputTimezone').value }, 'Zona waktu disimpan.');
    });
  }

  // ==========================================================
  // 7. PEMULIHAN ID RELAWAN
  // ==========================================================
  const LABEL_STATUS_PEMETAAN = {
    cocok: '✅ Cocok otomatis (cek sekali lagi sebelum diterapkan)',
    mirip: '🟡 Nama MIRIP tapi tidak persis sama (mungkin beda ejaan/typo) — WAJIB dicek manual, jangan langsung percaya',
    ambigu: '⚠️ Ada lebih dari 1 nama sama/mirip — pilih manual',
    tidak_ketemu: '❌ Nama tidak ditemukan di data relawan saat ini — pilih manual atau lewati',
    tanpa_nama: '❌ Tidak ada riwayat presensi sama sekali — pilih manual atau lewati'
  };

  function opsiRelawanUntukDropdown_(daftarRelawan, terpilihSaatIni) {
    return '<option value="">— Lewati (tidak diterapkan) —</option>' +
      daftarRelawan.map(r => `<option value="${escapeHtml(r.id)}" ${r.id === terpilihSaatIni ? 'selected' : ''}>${escapeHtml(r.nama)} (${escapeHtml(r.id)}${r.divisi ? ' — ' + escapeHtml(r.divisi) : ''})</option>`).join('');
  }

  const btnMuatPemetaanId = document.getElementById('btnMuatPemetaanId');
  if (btnMuatPemetaanId) {
    btnMuatPemetaanId.addEventListener('click', async () => {
      const wadah = document.getElementById('hasilPemetaanId');
      wadah.innerHTML = '<div class="empty-state">Memeriksa data...</div>';
      try {
        const [usulan, daftarRelawan] = await Promise.all([
          apiGet('usulkanPemetaanIdRelawan', { token: token() }),
          apiGet('getRelawan', { semua: 1, token: token() })
        ]);

        if (!usulan.length) {
          wadah.innerHTML = '<div class="empty-state">Tidak ditemukan ID lama yang perlu dipetakan — semua ID_RELAWAN yang dirujuk sheet lain masih cocok dengan 01_DATA_RELAWAN saat ini.</div>';
          return;
        }

        wadah.innerHTML = `
          <p style="font-size:12.5px;color:var(--color-text-muted);margin:0 0 10px;">Ditemukan ${usulan.length} ID lama yang perlu ditinjau. Baris dengan tanda 🔑 punya akun login — paling mendesak diperbaiki dulu.</p>
          <div id="daftarPemetaanId" style="display:flex;flex-direction:column;gap:10px;"></div>
          <button type="button" class="btn-mini primary" id="btnTerapkanPemetaanId" style="margin-top:14px;">Terapkan Pemetaan yang Dipilih</button>
        `;

        const daftarEl = document.getElementById('daftarPemetaanId');
        daftarEl.innerHTML = usulan.map((u, i) => `
          <div class="panel-block" style="padding:12px;${u.status !== 'cocok' ? 'border-left:4px solid #b9852f;' : ''}">
            <p style="margin:0 0 6px;font-size:13px;"><strong>${u.adaAkunLogin ? '🔑 ' : ''}${escapeHtml(u.idLama)}</strong> — ${escapeHtml(u.nama || '(tidak ada nama di riwayat)')} ${u.jumlahAbsensi ? `<span style="color:var(--color-text-muted);">(${u.jumlahAbsensi} riwayat presensi)</span>` : ''}</p>
            <p style="margin:0 0 8px;font-size:12px;color:var(--color-text-muted);">${LABEL_STATUS_PEMETAAN[u.status] || u.status}</p>
            <select id="pemetaanPilihan${i}" data-id-lama="${escapeHtml(u.idLama)}">${opsiRelawanUntukDropdown_(daftarRelawan, u.idBaruUsulan)}</select>
          </div>
        `).join('');

        document.getElementById('btnTerapkanPemetaanId').addEventListener('click', async () => {
          const pemetaan = [];
          usulan.forEach((u, i) => {
            const idBaru = document.getElementById('pemetaanPilihan' + i).value;
            if (idBaru) pemetaan.push({ idLama: u.idLama, idBaru: idBaru });
          });
          if (!pemetaan.length) { showError('Tidak ada pemetaan yang dipilih untuk diterapkan.'); return; }

          const ringkasanKonfirmasi = pemetaan.map(p => p.idLama + ' → ' + p.idBaru).join('\n');
          if (!confirm('Terapkan ' + pemetaan.length + ' pemetaan ID berikut?\n\n' + ringkasanKonfirmasi + '\n\nIni akan mengubah data di 07_AKUN_RELAWAN, 03_DATA_ABSENSI, 22_PENUGASAN_KHUSUS, dan 12_NOTIFIKASI. Pastikan sudah benar sebelum melanjutkan.')) return;
          if (!confirm('Konfirmasi SEKALI LAGI — tindakan ini menulis ke banyak sheet sekaligus dan tidak ada tombol "batalkan otomatis". Lanjutkan?')) return;

          try {
            const hasil = await apiPost('terapkanPemetaanIdRelawan', { token: token(), pemetaan: pemetaan });
            showSuccess(`Berhasil: ${hasil.ringkasan.akun} akun, ${hasil.ringkasan.absensi} baris absensi, ${hasil.ringkasan.penugasanKhusus} penugasan khusus, ${hasil.ringkasan.notifikasi} notifikasi diperbarui.`);
            btnMuatPemetaanId.click(); // muat ulang -- baris yang sudah diperbaiki akan hilang dari daftar
          } catch (err) {
            showError(err.message);
          }
        });
      } catch (err) {
        wadah.innerHTML = '';
        showError(err.message);
      }
    });
  }
})();

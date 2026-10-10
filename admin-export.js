// ============================================================
// admin-export.js — Export Laporan Kehadiran (CSV + PDF)
// File BARU, mandiri -- tidak mengubah admin.js. Menambahkan 1 bagian
// "Export Laporan" di panel Rekap 2 Minggu (kalau elemen wadahnya ada
// di admin.html) dengan pilihan periode bebas + pilihan format.
// ============================================================

(function () {
  'use strict';

  function token() { return window.sppgAdminToken; }

  function bikinWadahExport_() {
    const panel = document.getElementById('panelDuaMinggu');
    if (!panel) return null;
    if (document.getElementById('wadahExportLaporan')) return document.getElementById('wadahExportLaporan');

    const wadah = document.createElement('section');
    wadah.className = 'panel-block';
    wadah.id = 'wadahExportLaporan';
    wadah.style.marginTop = '16px';
    wadah.innerHTML = `
      <p class="section-title">Export Laporan Kehadiran</p>
      <div class="inline-form-relawan" style="flex-wrap:wrap;">
        <input type="date" id="exportTanggalAwal">
        <input type="date" id="exportTanggalAkhir">
        <button type="button" class="btn-outline" id="btnExportCsvLaporan">⬇️ Export CSV</button>
        <button type="button" class="btn-outline" id="btnExportPdfLaporan">📄 Export PDF</button>
      </div>
      <p id="statusExportLaporan" style="font-size:12px;color:var(--color-text-muted);margin:8px 0 0;"></p>
    `;
    panel.appendChild(wadah);
    return wadah;
  }

  async function ambilDataExport_() {
    const awal = document.getElementById('exportTanggalAwal').value;
    const akhir = document.getElementById('exportTanggalAkhir').value;
    if (!awal || !akhir) throw new Error('Pilih tanggal awal dan akhir dulu.');
    return apiGet('getRekapDetailUntukExport', { token: token(), periodeAwal: awal, periodeAkhir: akhir });
  }

  function keCsv_(hasil) {
    const baris = [['Nama', 'Divisi', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status']];
    hasil.data.forEach(r => baris.push([r.nama, r.divisi, r.tanggal, r.jamMasuk, r.jamPulang, r.status]));
    return baris.map(b => b.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
  }

  function unduhFile_(nama, isi, tipe) {
    const url = URL.createObjectURL(new Blob([isi], { type: tipe }));
    const a = document.createElement('a');
    a.href = url; a.download = nama; a.click();
    URL.revokeObjectURL(url);
  }

  function pastikanJsPdfTermuat_() {
    return new Promise((resolve, reject) => {
      if (window.jspdf) { resolve(); return; }
      const s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js';
        s2.onload = resolve;
        s2.onerror = () => reject(new Error('Gagal memuat pustaka PDF. Periksa koneksi internet.'));
        document.head.appendChild(s2);
      };
      s1.onerror = () => reject(new Error('Gagal memuat pustaka PDF. Periksa koneksi internet.'));
      document.head.appendChild(s1);
    });
  }

  async function buatPdf_(hasil) {
    await pastikanJsPdfTermuat_();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text('Laporan Kehadiran — SPPG Jeungjing', 14, 16);
    doc.setFontSize(10);
    doc.text('Periode: ' + hasil.periodeAwal + ' s/d ' + hasil.periodeAkhir, 14, 23);

    doc.autoTable({
      startY: 28,
      head: [['Nama', 'Divisi', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status']],
      body: hasil.data.map(r => [r.nama, r.divisi, r.tanggal, r.jamMasuk, r.jamPulang, r.status]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [18, 41, 77] }
    });

    doc.save('laporan-kehadiran-' + hasil.periodeAwal + '-sd-' + hasil.periodeAkhir + '.pdf');
  }

  // FASE 2: panelDuaMinggu dikonfirmasi HTML statis (selalu ada begitu
  // skrip ini jalan, baik dimuat statis di akhir <body> maupun lazy saat
  // tab diklik) -- polling/DOMContentLoaded sebelumnya tidak diperlukan,
  // disederhanakan jadi langsung sinkron seperti admin-role.js.
  const wadah = bikinWadahExport_();
  if (wadah) {
    document.getElementById('btnExportCsvLaporan').addEventListener('click', async () => {
      const status = document.getElementById('statusExportLaporan');
      try {
        status.textContent = 'Menyiapkan CSV...';
        const hasil = await ambilDataExport_();
        unduhFile_('laporan-kehadiran-' + hasil.periodeAwal + '-sd-' + hasil.periodeAkhir + '.csv', '\ufeff' + keCsv_(hasil), 'text/csv;charset=utf-8;');
        status.textContent = 'CSV berhasil diunduh.';
      } catch (err) { status.textContent = '❌ ' + err.message; }
    });

    document.getElementById('btnExportPdfLaporan').addEventListener('click', async () => {
      const status = document.getElementById('statusExportLaporan');
      try {
        status.textContent = 'Menyiapkan PDF...';
        const hasil = await ambilDataExport_();
        await buatPdf_(hasil);
        status.textContent = 'PDF berhasil diunduh.';
      } catch (err) { status.textContent = '❌ ' + err.message; }
    });
  }

  // ============================================================
  // INSENTIF & PENGGAJIAN -- bagian BARU, tab tambahan di panel yang
  // sama (sesuai permintaan: jangan bikin menu sendiri). Backend-nya
  // SUDAH ADA sepenuhnya sejak awal (MasterTarif.gs) -- bagian ini
  // HANYA tampilan, tidak menulis ulang logika hitung gaji apa pun.
  // ============================================================
  const JABATAN_TARIF_OPSI = ['RELAWAN', 'KOORDINATOR', 'ASISTEN', 'DRIVER'];

  function bikinWadahInsentif_() {
    const panel = document.getElementById('panelDuaMinggu');
    if (!panel) return null;
    if (document.getElementById('wadahInsentif')) return document.getElementById('wadahInsentif');

    const wadah = document.createElement('section');
    wadah.className = 'panel-block';
    wadah.id = 'wadahInsentif';
    wadah.style.marginTop = '16px';
    wadah.innerHTML = `
      <p class="section-title">Insentif & Penggajian</p>
      <div class="inline-form-relawan" style="flex-wrap:wrap;">
        <select id="insentifPeriode"><option value="">Pilih periode...</option></select>
        <button type="button" class="btn-outline" id="btnSiapkanTarif">Siapkan Master Tarif</button>
        <select id="insentifPeriodeSumber"><option value="">Salin dari periode...</option></select>
        <button type="button" class="btn-outline" id="btnSalinTarif">Salin</button>
        <button type="button" class="btn-mini primary" id="btnMuatTarif">Muat Data Tarif</button>
      </div>
      <p id="statusInsentif" style="font-size:12px;color:var(--color-text-muted);margin:8px 0;"></p>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Nama</th><th>Divisi</th><th>Jabatan</th><th>Tarif Harian (Rp)</th><th></th></tr></thead>
          <tbody id="tbodyInsentifTarif"><tr><td colspan="5"><div class="empty-state">Pilih periode lalu klik Muat Data Tarif.</div></td></tr></tbody>
        </table>
      </div>

      <p class="section-title" style="margin-top:18px;">Rekap Penggajian</p>
      <button type="button" class="btn-mini primary" id="btnMuatRekapGaji">Hitung Rekap Penggajian</button>
      <div class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>Nama</th><th>Divisi</th><th>Jabatan</th><th>Hadir</th><th>Terlambat</th><th>Hari Dibayar</th><th>Tarif/Hari</th><th>Total Gaji</th></tr></thead>
          <tbody id="tbodyRekapGaji"><tr><td colspan="8"><div class="empty-state">Klik Hitung Rekap Penggajian.</div></td></tr></tbody>
        </table>
      </div>
    `;
    panel.appendChild(wadah);
    return wadah;
  }

  function formatRupiah_(n) {
    if (n === null || n === undefined) return '-';
    return 'Rp' + Number(n).toLocaleString('id-ID');
  }

  async function muatDaftarPeriodeInsentif_() {
    const daftar = await apiGet('getPeriodeListAdmin', { token: token() });
    const opsi = daftar.map(p => `<option value="${p.id}">${escapeHtml(p.nama)} (${escapeHtml(p.tanggalMulai)} - ${escapeHtml(p.tanggalSelesai)})</option>`).join('');
    document.getElementById('insentifPeriode').innerHTML = '<option value="">Pilih periode...</option>' + opsi;
    document.getElementById('insentifPeriodeSumber').innerHTML = '<option value="">Salin dari periode...</option>' + opsi;
  }

  async function muatTabelTarif_() {
    const idPeriode = document.getElementById('insentifPeriode').value;
    const status = document.getElementById('statusInsentif');
    const tbody = document.getElementById('tbodyInsentifTarif');
    if (!idPeriode) { status.textContent = '⚠️ Pilih periode dulu.'; return; }
    status.textContent = 'Memuat...';
    try {
      const data = await apiGet('getMasterTarifUntukPeriodeAdmin', { token: token(), idPeriode });
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Belum ada data -- klik "Siapkan Master Tarif" dulu.</div></td></tr>'; status.textContent = ''; return; }
      tbody.innerHTML = data.map(t => `
        <tr>
          <td>${escapeHtml(t.NAMA_RELAWAN)}</td>
          <td>${escapeHtml(t.DIVISI)}</td>
          <td><select data-tarif-jabatan="${escapeHtml(t.ID_TARIF)}">
            <option value="">-</option>
            ${JABATAN_TARIF_OPSI.map(j => `<option value="${j}" ${t.JABATAN === j ? 'selected' : ''}>${j}</option>`).join('')}
          </select></td>
          <td><input type="number" min="0" step="1000" style="width:110px;" data-tarif-nominal="${escapeHtml(t.ID_TARIF)}" value="${t.TARIF_HARIAN || ''}" placeholder="Belum diisi"></td>
          <td><button type="button" class="btn-mini primary" data-simpan-tarif="${escapeHtml(t.ID_TARIF)}">Simpan</button></td>
        </tr>`).join('');
      status.textContent = data.length + ' relawan dimuat.';

      tbody.querySelectorAll('[data-simpan-tarif]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idTarif = btn.dataset.simpanTarif;
          const jabatan = tbody.querySelector(`[data-tarif-jabatan="${idTarif}"]`).value;
          const tarifHarian = tbody.querySelector(`[data-tarif-nominal="${idTarif}"]`).value;
          if (!jabatan) { showError('Pilih Jabatan dulu.'); return; }
          if (tarifHarian === '') { showError('Isi Tarif Harian dulu.'); return; }
          try {
            await apiPost('updateTarifRelawanAdmin', { token: token(), idTarif, jabatan, tarifHarian });
            showSuccess('Tarif tersimpan.');
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) { status.textContent = '❌ ' + err.message; }
  }

  async function muatRekapGaji_() {
    const idPeriode = document.getElementById('insentifPeriode').value;
    const tbody = document.getElementById('tbodyRekapGaji');
    if (!idPeriode) { showError('Pilih periode dulu.'); return; }
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">Menghitung...</div></td></tr>';
    try {
      const hasil = await apiGet('getRekapPenggajianAdmin', { token: token(), idPeriode });
      if (!hasil.data.length) { tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">Tidak ada data.</div></td></tr>'; return; }
      tbody.innerHTML = hasil.data.map(r => `
        <tr style="${r.tarifLengkap ? '' : 'background:#fdf1de;'}">
          <td>${escapeHtml(r.namaRelawan)}</td>
          <td>${escapeHtml(r.divisi)}</td>
          <td>${escapeHtml(r.jabatan || '-')}</td>
          <td>${r.hadir}</td>
          <td>${r.terlambat}</td>
          <td>${r.hariDibayar}</td>
          <td>${formatRupiah_(r.tarifHarian)}</td>
          <td>${r.tarifLengkap ? formatRupiah_(r.totalGaji) : '<span style="color:#8a5a12;">⚠️ Tarif belum lengkap</span>'}</td>
        </tr>`).join('');
      if (hasil.jumlahBelumLengkap) showError(hasil.jumlahBelumLengkap + ' relawan belum lengkap tarifnya -- cek tabel di atas (baris oranye).');
    } catch (err) { tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">❌ ' + escapeHtml(err.message) + '</div></td></tr>'; }
  }

  const wadahInsentif = bikinWadahInsentif_();
  if (wadahInsentif) {
    muatDaftarPeriodeInsentif_().catch(() => {});

    document.getElementById('btnSiapkanTarif').addEventListener('click', async () => {
      const idPeriode = document.getElementById('insentifPeriode').value;
      const status = document.getElementById('statusInsentif');
      if (!idPeriode) { showError('Pilih periode dulu.'); return; }
      status.textContent = 'Menyiapkan...';
      try {
        const hasil = await apiPost('siapkanMasterTarifUntukPeriodeAdmin', { token: token(), idPeriode });
        status.textContent = `Siap: ${hasil.dibuat} baris baru dibuat, ${hasil.sudahAdaSebelumnya} sudah ada sebelumnya.`;
        muatTabelTarif_();
      } catch (err) { status.textContent = '❌ ' + err.message; }
    });

    document.getElementById('btnSalinTarif').addEventListener('click', async () => {
      const idPeriodeTarget = document.getElementById('insentifPeriode').value;
      const idPeriodeSumber = document.getElementById('insentifPeriodeSumber').value;
      const status = document.getElementById('statusInsentif');
      if (!idPeriodeTarget) { showError('Pilih periode (tujuan) dulu.'); return; }
      if (!idPeriodeSumber) { showError('Pilih periode sumber (yang mau disalin datanya) dulu.'); return; }
      if (!confirm('Salin Jabatan & Tarif Harian dari periode sumber ke periode ini? Hanya mengisi relawan yang tarifnya masih kosong -- yang sudah diisi TIDAK akan ditimpa.')) return;
      status.textContent = 'Menyalin...';
      try {
        const hasil = await apiPost('salinTarifDariPeriodeSebelumnyaAdmin', { token: token(), idPeriodeTarget, idPeriodeSumber });
        status.textContent = `Selesai: ${hasil.disalin} disalin, ${hasil.dilewatiSudahTerisi} dilewati (sudah terisi sebelumnya).`;
        muatTabelTarif_();
      } catch (err) { status.textContent = '❌ ' + err.message; }
    });

    document.getElementById('btnMuatTarif').addEventListener('click', muatTabelTarif_);
    document.getElementById('btnMuatRekapGaji').addEventListener('click', muatRekapGaji_);
  }
})();

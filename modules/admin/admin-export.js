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

  // Dihapus 23 Okt 2026 (diminta Admin): "Atur Tarif per Relawan" (dulu
  // fungsi bikinWadahInsentif_ di sini, DITAMPILKAN di dalam panel
  // "Rekap Per Periode") DIPINDAH jadi halaman mandiri "Master Tarif"
  // di bawah SIPRES (lihat admin-master-tarif.js), dan modelnya
  // DIROMBAK dari per-periode (perlu "Siapkan"/"Salin") jadi STANDING
  // (1 tarif per relawan, berlaku terus sampai diubah).
})();

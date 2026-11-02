// ============================================================
// admin-import.js — Import Relawan Massal (CSV)
// File BARU, mandiri. Alur: Upload -> Baca -> Validasi header -> Preview
// (backend validasi ulang + cek duplikasi) -> Konfirmasi Admin -> Import.
// Parsing CSV manual sederhana (bukan library) -- cukup untuk format
// 2 kolom (nama, divisi) tanpa karakter koma di dalam nilai.
// ============================================================

(function () {
  'use strict';

  function token() { return window.sppgAdminToken; }
  const HEADER_WAJIB = ['nama', 'divisi'];

  function bikinWadahImport_() {
    const panel = document.getElementById('panelRelawan');
    if (!panel) return null;
    if (document.getElementById('wadahImportRelawan')) return document.getElementById('wadahImportRelawan');

    const wadah = document.createElement('section');
    wadah.className = 'panel-block';
    wadah.id = 'wadahImportRelawan';
    wadah.style.marginTop = '16px';
    wadah.innerHTML = `
      <p class="section-title">Import Relawan Massal (CSV)</p>
      <p style="font-size:12px;color:var(--color-text-muted);margin:0 0 10px;line-height:1.6;">
        Format CSV: 2 kolom dengan header persis <code>nama,divisi</code>. Divisi harus sudah terdaftar di Kelola Divisi.
      </p>
      <input type="file" id="inputCsvImport" accept=".csv" style="font-size:12.5px;margin-bottom:10px;">
      <div id="hasilPreviewImport"></div>
    `;
    panel.appendChild(wadah);
    return wadah;
  }

  /** Parser CSV sederhana -- cukup untuk 2 kolom tanpa koma di dalam nilai. */
  function parseCsvSederhana_(teks) {
    const baris = teks.split(/\r?\n/).filter(b => b.trim());
    if (!baris.length) return { header: [], rows: [] };
    const header = baris[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const rows = baris.slice(1).map(b => {
      const kolom = b.split(',').map(k => k.trim().replace(/^"|"$/g, ''));
      const obj = {};
      header.forEach((h, i) => { obj[h] = kolom[i] || ''; });
      return obj;
    });
    return { header, rows };
  }

  let dataValidUntukImport = [];

  async function prosesFile_(file) {
    const wadahHasil = document.getElementById('hasilPreviewImport');
    wadahHasil.innerHTML = '<div class="empty-state">Membaca file...</div>';

    const teks = await file.text();
    const { header, rows } = parseCsvSederhana_(teks);

    const headerHilang = HEADER_WAJIB.filter(h => !header.includes(h));
    if (headerHilang.length) {
      wadahHasil.innerHTML = `<p style="color:#b23a3a;font-size:13px;">❌ Header CSV tidak sesuai. Kolom wajib: ${HEADER_WAJIB.join(', ')}. Kolom hilang: ${headerHilang.join(', ')}.</p>`;
      return;
    }
    if (!rows.length) {
      wadahHasil.innerHTML = '<p style="color:#b23a3a;font-size:13px;">❌ File CSV kosong (tidak ada baris data setelah header).</p>';
      return;
    }

    wadahHasil.innerHTML = '<div class="empty-state">Memvalidasi ke server...</div>';
    try {
      const preview = await apiPost('importRelawanMassal', { token: token(), rows: rows, konfirmasi: false });
      dataValidUntukImport = preview.valid;

      let html = `
        <div class="stok-summary-grid" style="margin:10px 0;">
          <div class="stok-summary-card stok-card-aman"><span>${preview.jumlahValid}</span><p>Valid</p></div>
          <div class="stok-summary-card"><span>${preview.jumlahTidakValid}</span><p>Tidak Valid</p></div>
          <div class="stok-summary-card stok-card-menipis"><span>${preview.jumlahDuplikat}</span><p>Duplikat</p></div>
        </div>`;

      if (preview.tidakValid.length || preview.duplikat.length) {
        html += '<p class="section-title">Ditolak (tidak akan diimpor)</p><div class="table-wrap"><table><thead><tr><th>Baris</th><th>Nama</th><th>Alasan</th></tr></thead><tbody>';
        [...preview.tidakValid, ...preview.duplikat].forEach(r => {
          html += `<tr><td>${r.baris}</td><td>${escapeHtml(r.nama)}</td><td>${escapeHtml(r.alasan)}</td></tr>`;
        });
        html += '</tbody></table></div>';
      }

      if (preview.jumlahValid > 0) {
        html += `<button type="button" class="btn-submit" id="btnKonfirmasiImport" style="width:100%;margin-top:12px;">✅ Impor ${preview.jumlahValid} Relawan yang Valid</button>`;
      } else {
        html += '<p style="font-size:13px;color:var(--color-text-muted);margin-top:10px;">Tidak ada data valid untuk diimpor.</p>';
      }

      wadahHasil.innerHTML = html;

      const btnKonfirmasi = document.getElementById('btnKonfirmasiImport');
      if (btnKonfirmasi) {
        btnKonfirmasi.addEventListener('click', async () => {
          btnKonfirmasi.disabled = true;
          btnKonfirmasi.textContent = 'Mengimpor...';
          try {
            const hasil = await apiPost('importRelawanMassal', { token: token(), rows: dataValidUntukImport, konfirmasi: true });
            wadahHasil.innerHTML = `<p style="color:#1a7a4c;font-size:13.5px;font-weight:700;">✅ Berhasil mengimpor ${hasil.jumlahBerhasil} relawan baru.</p>`;
            showSuccess(hasil.jumlahBerhasil + ' relawan berhasil diimpor.');
            document.getElementById('inputCsvImport').value = '';
          } catch (err) {
            showError(err.message);
            btnKonfirmasi.disabled = false;
            btnKonfirmasi.textContent = '✅ Coba Impor Lagi';
          }
        });
      }
    } catch (err) {
      wadahHasil.innerHTML = `<p style="color:#b23a3a;font-size:13px;">❌ ${escapeHtml(err.message)}</p>`;
    }
  }

  // FASE 2: panelRelawan dikonfirmasi HTML statis -- disederhanakan jadi
  // langsung sinkron, sama seperti admin-export.js.
  const wadah = bikinWadahImport_();
  if (wadah) {
    document.getElementById('inputCsvImport').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) prosesFile_(file);
    });
  }
})();

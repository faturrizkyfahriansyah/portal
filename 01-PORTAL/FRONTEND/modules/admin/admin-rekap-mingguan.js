// SPPG JEUNGJING — ADMIN: Rekap Per Minggu (SIPRES)
// BARU 30 Okt 2026. File TERPISAH dari admin.js -- pola ADITIF yang
// SAMA dgn admin-sipres-monitoring.js & admin-migrasi-roster-v2.js:
// suntik HTML lewat JS ke #panelDuaMinggu yang SUDAH ADA (tidak
// mengubah admin.html), tidak sentuh admin.js sama sekali.
//
// Konsep & rumus SAMA PERSIS dgn "Rekap Per Periode" (panel yang sama,
// kartu baru di bawahnya) -- bedanya rentang tanggal dipilih bebas
// (2 date picker) alih-alih dropdown Periode, karena tidak ada objek
// "Periode Mingguan" tersimpan di sistem.
(function () {
  const panel = document.getElementById('panelDuaMinggu');
  if (!panel) return;

  function escHtml_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function rupiah_(n) { return n === null || n === undefined ? '-' : 'Rp' + Number(n).toLocaleString('id-ID'); }
  function isoHariIni_() { return new Date().toISOString().slice(0, 10); }
  function isoMundur_(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

  const kartu = document.createElement('div');
  kartu.className = 'admin-card';
  kartu.style.marginTop = '16px';
  kartu.innerHTML = `
    <div style="padding:14px;">
      <h3 style="margin:0 0 4px;font-size:15px;color:var(--color-navy);">📅 Rekap Per Minggu</h3>
      <p style="font-size:12.5px;color:var(--color-text-muted);margin:0 0 10px;">Rekap kehadiran dan insentif relawan untuk rentang tanggal bebas (tidak harus 7 hari persis).</p>
      <div class="filter-bar" style="margin-bottom:10px;">
        <label style="font-size:12.5px;">Dari <input type="date" id="rmgAwal" value="${isoMundur_(6)}" style="margin-left:4px;"></label>
        <label style="font-size:12.5px;">Sampai <input type="date" id="rmgAkhir" value="${isoHariIni_()}" style="margin-left:4px;"></label>
        <button class="btn-mini primary" id="btnMuatRekapMingguan">Tampilkan</button>
      </div>
      <div id="rmgRingkasan" style="font-size:13px;margin-bottom:10px;"></div>
      <div style="overflow-x:auto;">
        <table class="admin-table" style="width:100%;font-size:12.5px;">
          <thead><tr>
            <th>Nama</th><th>Divisi</th><th>Hadir</th><th>Terlambat</th><th>Izin</th><th>Sakit</th><th>Alfa</th><th>Hari Kerja</th><th>Insentif</th>
          </tr></thead>
          <tbody id="rmgTbody"><tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);">Pilih rentang tanggal, lalu klik Tampilkan.</td></tr></tbody>
        </table>
      </div>
    </div>
  `;
  panel.appendChild(kartu);

  document.getElementById('btnMuatRekapMingguan').addEventListener('click', async () => {
    const tanggalAwal = document.getElementById('rmgAwal').value;
    const tanggalAkhir = document.getElementById('rmgAkhir').value;
    const tbody = document.getElementById('rmgTbody');
    const ringkasan = document.getElementById('rmgRingkasan');
    if (!tanggalAwal || !tanggalAkhir) { alert('Pilih kedua tanggal dulu.'); return; }
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Memuat...</td></tr>';
    ringkasan.innerHTML = '';
    try {
      const sesi = ambilSesiAdmin();
      const hasil = await apiPost('getRekapMingguanAdmin', { token: sesi.token, tanggalAwal, tanggalAkhir });
      if (!hasil.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);">Tidak ada data presensi di rentang ini.</td></tr>';
        return;
      }
      let totalInsentif = 0;
      tbody.innerHTML = hasil.data.map(r => {
        totalInsentif += r.totalInsentif;
        return `<tr>
          <td>${escHtml_(r.namaRelawan)}</td><td>${escHtml_(r.divisi)}</td>
          <td>${r.hadir}</td><td>${r.terlambat}</td><td>${r.izin}</td><td>${r.sakit}</td><td>${r.tidakHadir}</td>
          <td>${r.totalHariKerja}</td>
          <td>${r.tarifLengkap ? rupiah_(r.totalInsentif) : '<span style="color:#c0392b;">Tarif belum diatur</span>'}</td>
        </tr>`;
      }).join('');
      ringkasan.innerHTML = `<b>Total Insentif Minggu Ini: ${rupiah_(totalInsentif)}</b>` +
        (hasil.jumlahBelumLengkap ? ` &nbsp;·&nbsp; <span style="color:#c0392b;">${hasil.jumlahBelumLengkap} relawan belum ada Master Tarif-nya</span>` : '');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#c0392b;">${escHtml_(err.message)}</td></tr>`;
    }
  });
})();

// SPPG JEUNGJING — ADMIN: SIPANDU › Pagu & Perhitungan (panelSipanduPagu). BARU 4 Nov 2026 (Blueprint §10.5).
// Pagu per tanggal = PM Harian (terverifikasi) x tarif yang berlaku pada tanggal itu (Master Tarif). Rumus sama dengan SIPENDOK:
// Porsi Kecil = PK + Balita; Porsi Besar = PB + Ibu Hamil + Ibu Menyusui. Backend: SipanduTarifV2.gs (getRekapPaguV2).
(function () {
  const panel = document.getElementById('panelSipanduPagu'); if (!panel) return;
  const root = document.getElementById('spgRoot');
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const rp = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const tglIndo = function (iso) { return iso.split('-').reverse().join('/'); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  let hasil = null, sudah = false;

  function kerangka() {
    const d = new Date(), awal = isoLokal(new Date(d.getFullYear(), d.getMonth(), 1)), akhir = isoLokal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    root.innerHTML =
      '<div class="filter-bar"><label style="font-size:12px;">Dari <input type="date" id="spgAwal"></label><label style="font-size:12px;">Sampai <input type="date" id="spgAkhir"></label>' +
      '<button class="btn-mini primary" id="spgTampil" type="button">Tampilkan</button><button class="btn-mini export" id="spgCsv" type="button">Export CSV</button><span style="font-size:12px;color:var(--color-text-muted,#55606f);">maks. 93 hari</span></div>' +
      '<div id="spgPesan" style="font-size:13px;margin:6px 0;"></div>' +
      '<div class="admin-stat-grid"><div class="admin-stat-card"><div class="admin-stat-value" id="spgTotal">–</div><div class="admin-stat-label">Total Pagu</div></div>' +
      '<div class="admin-stat-card accent-success"><div class="admin-stat-value" id="spgBahan">–</div><div class="admin-stat-label">Bahan Baku</div></div>' +
      '<div class="admin-stat-card accent-info"><div class="admin-stat-value" id="spgSewa">–</div><div class="admin-stat-label">Sewa Fasilitas</div></div>' +
      '<div class="admin-stat-card accent-warning"><div class="admin-stat-value" id="spgOps">–</div><div class="admin-stat-label">Operasional</div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Instansi</th><th>Porsi Kecil</th><th>Porsi Besar</th><th>Total Paket</th><th>Bahan Baku</th><th>Sewa Fasilitas</th><th>Operasional</th><th>Total Pagu</th></tr></thead><tbody id="spgTbody"><tr><td colspan="9"><div class="empty-state">Pilih rentang lalu klik Tampilkan.</div></td></tr></tbody></table></div>';
    $('spgAwal').value = awal; $('spgAkhir').value = akhir;
    $('spgTampil').addEventListener('click', muat); $('spgCsv').addEventListener('click', csv);
  }
  async function muat() {
    const aw = $('spgAwal').value, ak = $('spgAkhir').value; $('spgPesan').textContent = '';
    if (!aw || !ak) { $('spgPesan').style.color = '#c0392b'; $('spgPesan').textContent = 'Pilih kedua tanggal.'; return; }
    try {
      hasil = await api('getRekapPaguV2', { tanggalAwal: aw, tanggalAkhir: ak });
      const t = hasil.total; $('spgTotal').textContent = rp(t.totalPagu); $('spgBahan').textContent = rp(t.bahanBaku); $('spgSewa').textContent = rp(t.sewaFasilitas); $('spgOps').textContent = rp(t.operasional);
      $('spgTbody').innerHTML = hasil.baris.length ? hasil.baris.map(function (b) {
        return '<tr><td>' + tglIndo(b.tanggal) + (b.tarifLengkap ? '' : ' <span style="color:#c0392b;" title="Tarif belum ditetapkan: ' + esc(b.tarifKurang.join(', ')) + '">⚠</span>') + '</td><td>' + b.jumlahInstansi + '</td><td>' + f(b.porsiKecil) + '</td><td>' + f(b.porsiBesar) + '</td><td>' + f(b.totalPaket) + '</td><td>' + rp(b.bahanBaku) + '</td><td>' + rp(b.sewaFasilitas) + '</td><td>' + rp(b.operasional) + '</td><td><b>' + rp(b.totalPagu) + '</b></td></tr>';
      }).join('') + '<tr style="background:var(--color-surface,#f6f8fb);font-weight:700;"><td colspan="2">TOTAL</td><td>' + f(t.porsiKecil) + '</td><td>' + f(t.porsiBesar) + '</td><td>' + f(t.porsiKecil + t.porsiBesar) + '</td><td>' + rp(t.bahanBaku) + '</td><td>' + rp(t.sewaFasilitas) + '</td><td>' + rp(t.operasional) + '</td><td>' + rp(t.totalPagu) + '</td></tr>'
        : '<tr><td colspan="9"><div class="empty-state">Tidak ada PM harian terverifikasi pada rentang ini.</div></td></tr>';
      if (hasil.jumlahTanggalTarifKurang) { $('spgPesan').style.color = '#c0392b'; $('spgPesan').textContent = hasil.jumlahTanggalTarifKurang + ' tanggal memakai tarif yang belum ditetapkan (dihitung Rp0, ditandai ⚠) — lengkapi di Master Tarif.'; }
    } catch (err) { hasil = null; $('spgTbody').innerHTML = '<tr><td colspan="9"><div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div></td></tr>'; }
  }
  function csv() {
    if (!hasil || !hasil.baris.length) { alert('Belum ada data. Klik Tampilkan dulu.'); return; }
    const kepala = ['Tanggal', 'Instansi', 'Porsi Kecil', 'Porsi Besar', 'Total Paket', 'Bahan Baku', 'Sewa Fasilitas', 'Operasional', 'Total Pagu', 'Tarif Lengkap'];
    const isi = hasil.baris.map(function (b) { return [b.tanggal, b.jumlahInstansi, b.porsiKecil, b.porsiBesar, b.totalPaket, b.bahanBaku, b.sewaFasilitas, b.operasional, b.totalPagu, b.tarifLengkap ? 'ya' : 'tidak'].join(','); });
    const blob = new Blob(['\uFEFF' + kepala.join(',') + '\r\n' + isi.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pagu-' + hasil.tanggalAwal + '-sd-' + hasil.tanggalAkhir + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  async function mulaiPanel() {
    try {
      const st = await api('getStatusSipanduV2');
      if (!st.terhubung) { root.innerHTML = '<div class="admin-stat-card accent-warning" style="padding:16px;text-align:left;"><b>Database SIPANDU baru belum disambungkan</b><div style="font-size:13px;margin-top:6px;">Sambungkan lewat menu Master Instansi &amp; PIC, lalu muat ulang.</div></div>'; return; }
      kerangka();
    } catch (err) { root.innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div>'; }
  }
  const tombol = document.querySelector('[data-panel="panelSipanduPagu"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudah) { sudah = true; mulaiPanel(); } });
})();

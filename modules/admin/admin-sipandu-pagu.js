// SPPG JEUNGJING — ADMIN: SIPANDU › Pagu & Perhitungan (panelSipanduPagu). BARU 4 Nov 2026 (Blueprint §10.5).
// Pagu per tanggal = PM Harian (terverifikasi) x tarif yang berlaku pada tanggal itu (Master Tarif). Rumus sama dengan SIPENDOK:
// Porsi Kecil = PK + Balita; Porsi Besar = PB + Ibu Hamil + Ibu Menyusui. Backend: SipanduTarifV2.gs (getRekapPaguV2).
// 17 Nov 2026: periode dipilih menurut SKEMA 1 / 7 / 14 hari + tanggal mulai (sama dengan Rekap Biaya & Insentif); tanggal akhir dihitung di sini.
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
  let hasil = null, sudah = false, skema = 1, mulai = isoLokal(new Date());
  const hariKe = function (iso, n) { const p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2] + n); return isoLokal(d); };

  function kerangka() {
    root.innerHTML =
      '<div class="filter-bar" id="spgKontrol" style="flex-wrap:wrap;align-items:center;"></div>' +
      '<div id="spgPesan" style="font-size:13px;margin:6px 0;"></div>' +
      '<div class="admin-stat-grid"><div class="admin-stat-card"><div class="admin-stat-value" id="spgTotal">–</div><div class="admin-stat-label">Total Pagu</div></div>' +
      '<div class="admin-stat-card accent-success"><div class="admin-stat-value" id="spgBahan">–</div><div class="admin-stat-label">Bahan Baku</div></div>' +
      '<div class="admin-stat-card accent-info"><div class="admin-stat-value" id="spgSewa">–</div><div class="admin-stat-label">Sewa Fasilitas</div></div>' +
      '<div class="admin-stat-card accent-warning"><div class="admin-stat-value" id="spgOps">–</div><div class="admin-stat-label">Operasional</div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Instansi</th><th>Porsi Kecil</th><th>Porsi Besar</th><th>Total Paket</th><th>Bahan Baku</th><th>Sewa Fasilitas</th><th>Operasional</th><th>Total Pagu</th></tr></thead><tbody id="spgTbody"><tr><td colspan="9"><div class="empty-state">Pilih rentang lalu klik Tampilkan.</div></td></tr></tbody></table></div>';
    gambarKontrol();
    root.addEventListener('click', function (e) {
      const sk = e.target.closest('button[data-skema]'); if (sk) { skema = Number(sk.dataset.skema); gambarKontrol(); return; }
      if (e.target.id === 'spgTampil') muat(); else if (e.target.id === 'spgCsv') csv();
    });
    root.addEventListener('change', function (e) { if (e.target.id === 'spgMulai') mulai = e.target.value || mulai; });
    muat();   // langsung tampil: 1 hari, mulai hari ini
  }
  function gambarKontrol() {
    $('spgKontrol').innerHTML = [1, 7, 14].map(function (n) { return '<button class="btn-mini' + (skema === n ? ' primary' : '') + '" data-skema="' + n + '" type="button">' + n + ' hari</button>'; }).join('') +
      '<label style="font-size:12px;">Mulai tanggal <input type="date" id="spgMulai" value="' + esc(mulai) + '"></label>' +
      '<button class="btn-mini primary" id="spgTampil" type="button">Tampilkan</button><button class="btn-mini export" id="spgCsv" type="button">Export Excel</button>';
  }
  async function muat() {
    $('spgPesan').textContent = '';
    if (!mulai) { $('spgPesan').style.color = '#c0392b'; $('spgPesan').textContent = 'Pilih tanggal mulai.'; return; }
    const aw = mulai, ak = hariKe(mulai, skema - 1);
    try {
      hasil = await api('getRekapPaguV2', { tanggalAwal: aw, tanggalAkhir: ak });
      const t = hasil.total; $('spgTotal').textContent = rp(t.totalPagu); $('spgBahan').textContent = rp(t.bahanBaku); $('spgSewa').textContent = rp(t.sewaFasilitas); $('spgOps').textContent = rp(t.operasional);
      $('spgTbody').innerHTML = hasil.baris.length ? hasil.baris.map(function (b) {
        return '<tr><td>' + tglIndo(b.tanggal) + (b.tarifLengkap ? '' : ' <span style="color:#c0392b;" title="Tarif belum ditetapkan: ' + esc(b.tarifKurang.join(', ')) + '">(!)</span>') + '</td><td>' + b.jumlahInstansi + '</td><td>' + f(b.porsiKecil) + '</td><td>' + f(b.porsiBesar) + '</td><td>' + f(b.totalPaket) + '</td><td>' + rp(b.bahanBaku) + '</td><td>' + rp(b.sewaFasilitas) + '</td><td>' + rp(b.operasional) + '</td><td><b>' + rp(b.totalPagu) + '</b></td></tr>';
      }).join('') + '<tr style="background:var(--color-surface,#f6f8fb);font-weight:700;"><td colspan="2">TOTAL</td><td>' + f(t.porsiKecil) + '</td><td>' + f(t.porsiBesar) + '</td><td>' + f(t.porsiKecil + t.porsiBesar) + '</td><td>' + rp(t.bahanBaku) + '</td><td>' + rp(t.sewaFasilitas) + '</td><td>' + rp(t.operasional) + '</td><td>' + rp(t.totalPagu) + '</td></tr>'
        : '<tr><td colspan="9"><div class="empty-state">Tidak ada PM harian terverifikasi pada rentang ini.</div></td></tr>';
      if (hasil.jumlahTanggalTarifKurang) { $('spgPesan').style.color = '#c0392b'; $('spgPesan').textContent = hasil.jumlahTanggalTarifKurang + ' tanggal memakai tarif yang belum ditetapkan (dihitung Rp0, ditandai) — lengkapi di Master Tarif.'; }
    } catch (err) { hasil = null; $('spgTbody').innerHTML = '<tr><td colspan="9"><div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div></td></tr>'; }
  }
  function csv() {   // nama fungsi lama dipertahankan; kini mengekspor Excel (.xlsx) asli -- CSV berpemisah koma berantakan di Excel berbahasa Indonesia
    if (!hasil || !hasil.baris.length) { alert('Belum ada data. Klik Tampilkan dulu.'); return; }
    const t = hasil.total;
    Xlsx.unduhTabel('pagu-' + hasil.tanggalAwal + '-sd-' + hasil.tanggalAkhir + '.xlsx', { nama: 'Pagu', judul: 'PAGU & PERHITUNGAN  ' + tglIndo(hasil.tanggalAwal) + ' s.d. ' + tglIndo(hasil.tanggalAkhir),
      kolom: [{ judul: 'TANGGAL', lebar: 13, tipe: 'tengah' }, { judul: 'INSTANSI', lebar: 10, tipe: 'angka' }, { judul: 'PORSI KECIL', lebar: 12, tipe: 'angka' }, { judul: 'PORSI BESAR', lebar: 12, tipe: 'angka' }, { judul: 'TOTAL PAKET', lebar: 12, tipe: 'angka' }, { judul: 'BAHAN BAKU', lebar: 16, tipe: 'rp' }, { judul: 'SEWA FASILITAS', lebar: 16, tipe: 'rp' }, { judul: 'OPERASIONAL', lebar: 16, tipe: 'rp' }, { judul: 'TOTAL PAGU', lebar: 17, tipe: 'rp' }],
      baris: hasil.baris.map(function (b) { return [tglIndo(b.tanggal), b.jumlahInstansi, b.porsiKecil, b.porsiBesar, b.totalPaket, b.bahanBaku, b.sewaFasilitas, b.operasional, b.totalPagu]; }),
      total: ['TOTAL', '', t.porsiKecil, t.porsiBesar, t.porsiKecil + t.porsiBesar, t.bahanBaku, t.sewaFasilitas, t.operasional, t.totalPagu] });
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

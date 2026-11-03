// SPPG JEUNGJING — ADMIN: SIPANDU › Rekap Biaya & Insentif (panelSipanduBiaya). BARU 4 Nov 2026 (Blueprint §10.5; pindahan dari SIPENDOK).
// Rekap Biaya = Pagu (PM Harian x Master Tarif) + Insentif PIC (PM Harian x tarif jenjang/porsi; REVISI 4 Nov: sumber PM Harian, bukan BAST).
// Backend: SipanduInsentifV2.gs (getRekapBiayaV2).
(function () {
  const panel = document.getElementById('panelSipanduBiaya'); if (!panel) return;
  const root = document.getElementById('sbiRoot');
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const rp = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const tglIndo = function (iso) { return iso.split('-').reverse().join('/'); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const STATUS = { OK: ['', ''], PERLU_DATA_SISWA: ['Perlu jumlah siswa', '#c0392b'], TARIF_BELUM_DITETAPKAN: ['Tarif belum ditetapkan', '#c0392b'], TIDAK_ADA_PM: ['Tidak ada PM', '#757575'] };
  let hasil = null, tab = 'pic', sudah = false;

  function kerangka() {
    const d = new Date(), awal = isoLokal(new Date(d.getFullYear(), d.getMonth(), 1)), akhir = isoLokal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    root.innerHTML =
      '<div class="filter-bar" style="flex-wrap:wrap;"><label style="font-size:12px;">Dari <input type="date" id="sbiAwal"></label><label style="font-size:12px;">Sampai <input type="date" id="sbiAkhir"></label>' +
      '<button class="btn-mini" data-cepat="7" type="button">7 hari</button><button class="btn-mini" data-cepat="14" type="button">14 hari</button><button class="btn-mini" data-cepat="bulan" type="button">Bulan ini</button><button class="btn-mini" data-cepat="lalu" type="button">Bulan lalu</button>' +
      '<button class="btn-mini primary" id="sbiTampil" type="button">Tampilkan</button><span style="font-size:12px;color:var(--color-text-muted,#55606f);">maks. 93 hari</span></div>' +
      '<div id="sbiPesan" style="font-size:13px;margin:6px 0;"></div><div id="sbiIsi"></div>';
    $('sbiAwal').value = awal; $('sbiAkhir').value = akhir;
    $('sbiTampil').addEventListener('click', muat);
    root.addEventListener('click', function (e) {
      const c = e.target.closest('button[data-cepat]');
      if (c) { const n = new Date(), v = c.dataset.cepat; let a, b;
        if (v === 'bulan') { a = new Date(n.getFullYear(), n.getMonth(), 1); b = new Date(n.getFullYear(), n.getMonth() + 1, 0); }
        else if (v === 'lalu') { a = new Date(n.getFullYear(), n.getMonth() - 1, 1); b = new Date(n.getFullYear(), n.getMonth(), 0); }
        else { b = new Date(n.getFullYear(), n.getMonth(), n.getDate()); a = new Date(b); a.setDate(b.getDate() - (Number(v) - 1)); }
        $('sbiAwal').value = isoLokal(a); $('sbiAkhir').value = isoLokal(b); muat(); return; }
      const t = e.target.closest('button[data-tab]'); if (t) { tab = t.dataset.tab; gambar(); }
      if (e.target.id === 'sbiCsv') csv();
    });
  }
  function pesan(t, g) { const el = $('sbiPesan'); if (el) { el.textContent = t || ''; el.style.color = g ? '#c0392b' : '#2e7d32'; } }

  async function muat() {
    const aw = $('sbiAwal').value, ak = $('sbiAkhir').value; pesan('');
    if (!aw || !ak) { pesan('Pilih kedua tanggal.', true); return; }
    $('sbiIsi').innerHTML = '<div class="empty-state">Menghitung…</div>';
    try { hasil = await api('getRekapBiayaV2', { tanggalAwal: aw, tanggalAkhir: ak }); gambar(); }
    catch (err) { hasil = null; $('sbiIsi').innerHTML = ''; pesan(err.message || 'Gagal memuat.', true); }
  }
  const kartu = function (judul, nilai, kelas) { return '<div class="admin-stat-card ' + (kelas || '') + '"><div class="admin-stat-value" style="font-size:19px;">' + nilai + '</div><div class="admin-stat-label">' + judul + '</div></div>'; };

  function gambar() {
    if (!hasil) return;
    const t = hasil.total, ins = hasil.insentif;
    let html = '<div class="admin-stat-grid">' + kartu('Total Biaya', rp(t.semua), '') + kartu('Pagu (bahan + sewa + operasional)', rp(t.pagu), 'accent-info') + kartu('Insentif PIC', rp(t.insentif), 'accent-success') + '</div>' +
      '<div style="font-size:12px;color:var(--color-text-muted,#55606f);margin:6px 0 10px;">Bahan baku ' + rp(t.bahanBaku) + ' · Sewa fasilitas ' + rp(t.sewaFasilitas) + ' · Operasional ' + rp(t.operasional) + ' · Insentif Sekolah ' + rp(t.insentifSekolah) + ' · Insentif Posyandu ' + rp(t.insentifPosyandu) + '</div>';
    if (ins.peringatan.length) {
      html += '<div class="admin-stat-card accent-warning" style="padding:12px;text-align:left;margin-bottom:10px;font-size:13px;"><b>Perlu perhatian</b><ul style="margin:6px 0 0 18px;padding:0;">' + ins.peringatan.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
    }
    if (hasil.pagu.jumlahTanggalTarifKurang) html += '<div style="font-size:12.5px;color:#c0392b;margin-bottom:8px;">' + hasil.pagu.jumlahTanggalTarifKurang + ' tanggal pagu memakai tarif yang belum ditetapkan (dihitung Rp0) — lengkapi di Master Tarif.</div>';
    const tabs = [['pic', 'Per PIC (pembayaran)'], ['sekolah', 'Insentif Sekolah'], ['posyandu', 'Insentif Posyandu'], ['pagu', 'Pagu per Tanggal']];
    html += '<div class="filter-bar" style="flex-wrap:wrap;">' + tabs.map(function (x) { return '<button class="btn-mini' + (x[0] === tab ? ' primary' : '') + '" data-tab="' + x[0] + '" type="button">' + x[1] + '</button>'; }).join('') + '<button class="btn-mini export" id="sbiCsv" type="button">Export CSV</button></div>' +
      '<div class="table-wrap">' + tabel() + '</div>';
    $('sbiIsi').innerHTML = html;
  }
  function badge(s) { const x = STATUS[s] || ['', '']; return x[0] ? '<span style="color:' + x[1] + ';font-size:11.5px;font-weight:700;">' + x[0] + '</span>' : ''; }
  function picTeks(r) { return r.pic.length ? r.pic.map(function (p) { return esc(p.nama); }).join(', ') : '<span style="color:#c0392b;">belum ada PIC</span>'; }
  function tabel() {
    const ins = hasil.insentif;
    if (tab === 'pagu') {
      const b = hasil.pagu.baris;
      return '<table><thead><tr><th>Tanggal</th><th>Instansi</th><th>Porsi Kecil</th><th>Porsi Besar</th><th>Bahan Baku</th><th>Sewa Fasilitas</th><th>Operasional</th><th>Total Pagu</th></tr></thead><tbody>' + (b.length ? b.map(function (x) { return '<tr><td>' + tglIndo(x.tanggal) + (x.tarifLengkap ? '' : ' <span style="color:#c0392b;" title="Tarif belum ditetapkan">⚠</span>') + '</td><td>' + x.jumlahInstansi + '</td><td>' + f(x.porsiKecil) + '</td><td>' + f(x.porsiBesar) + '</td><td>' + rp(x.bahanBaku) + '</td><td>' + rp(x.sewaFasilitas) + '</td><td>' + rp(x.operasional) + '</td><td><b>' + rp(x.totalPagu) + '</b></td></tr>'; }).join('') : '<tr><td colspan="8"><div class="empty-state">Tidak ada PM harian terverifikasi pada rentang ini.</div></td></tr>') + '</tbody></table>';
    }
    if (tab === 'pic') {
      return '<table id="sbiTabelPic"><thead><tr><th>Nama PIC</th><th>Jabatan</th><th>No. Rekening</th><th>Instansi</th><th>Sekolah</th><th>Posyandu</th><th>Total</th></tr></thead><tbody>' +
        (ins.perPic.length ? ins.perPic.map(function (p) { return '<tr><td>' + esc(p.nama) + '</td><td>' + esc(p.jabatan || '—') + '</td><td>' + (p.rekening ? esc(p.rekening) : '<span style="color:#c0392b;">kosong</span>') + '</td><td style="font-size:12px;">' + esc(p.instansi.join(', ')) + '</td><td>' + rp(p.sekolah) + '</td><td>' + rp(p.posyandu) + '</td><td><b>' + rp(p.total) + '</b></td></tr>'; }).join('') +
          '<tr style="background:var(--color-surface,#f6f8fb);font-weight:700;"><td colspan="4">TOTAL</td><td>' + rp(ins.total.sekolah) + '</td><td>' + rp(ins.total.posyandu) + '</td><td>' + rp(ins.total.gabungan) + '</td></tr>' : '<tr><td colspan="7"><div class="empty-state">Tidak ada insentif pada rentang ini.</div></td></tr>') + '</tbody></table>';
    }
    if (tab === 'sekolah') {
      return '<table><thead><tr><th>Instansi</th><th>Siswa</th><th>Jenjang</th><th>Tarif/hari</th><th>Hari PM</th><th>Total</th><th>PIC</th><th>Status</th></tr></thead><tbody>' + ins.sekolah.map(function (r) {
        return '<tr><td>' + esc(r.nama) + (r.nonaktif ? ' <i style="color:#757575;">(nonaktif)</i>' : '') + '</td><td>' + (r.jumlahSiswa === null ? '<span style="color:#c0392b;">kosong</span>' : f(r.jumlahSiswa)) + '</td><td>' + esc(r.jenjang || '—') + '</td><td>' + (r.tarifRingkas ? (r.tarifRingkas.indexOf('–') > 0 ? r.tarifRingkas.split('–').map(function (v) { return rp(v); }).join('–') : rp(r.tarifRingkas)) : '—') + '</td><td>' + r.hariPm + '</td><td><b>' + rp(r.total) + '</b></td><td style="font-size:12px;">' + picTeks(r) + '</td><td>' + badge(r.status) + '</td></tr>'; }).join('') +
        '<tr style="background:var(--color-surface,#f6f8fb);font-weight:700;"><td colspan="5">TOTAL SEKOLAH</td><td>' + rp(ins.total.sekolah) + '</td><td colspan="2"></td></tr></tbody></table>';
    }
    return '<table><thead><tr><th>Instansi</th><th>Total porsi</th><th>Tarif/porsi</th><th>Hari PM</th><th>Total</th><th>PIC</th><th>Status</th></tr></thead><tbody>' + ins.posyandu.map(function (r) {
      return '<tr><td>' + esc(r.nama) + (r.nonaktif ? ' <i style="color:#757575;">(nonaktif)</i>' : '') + '</td><td>' + f(r.totalPorsi) + '</td><td>' + (r.tarifRingkas ? rp(r.tarifRingkas.split('–')[0]) + (r.tarifRingkas.indexOf('–') > 0 ? '–' + rp(r.tarifRingkas.split('–')[1]) : '') : '—') + '</td><td>' + r.hariPm + '</td><td><b>' + rp(r.total) + '</b></td><td style="font-size:12px;">' + picTeks(r) + '</td><td>' + badge(r.status) + '</td></tr>'; }).join('') +
      '<tr style="background:var(--color-surface,#f6f8fb);font-weight:700;"><td colspan="4">TOTAL POSYANDU</td><td>' + rp(ins.total.posyandu) + '</td><td colspan="2"></td></tr></tbody></table>';
  }
  function csv() {
    if (!hasil) { alert('Belum ada data. Klik Tampilkan dulu.'); return; }
    const ins = hasil.insentif; let kepala, baris;
    if (tab === 'pagu') { kepala = ['Tanggal', 'Instansi', 'Porsi Kecil', 'Porsi Besar', 'Bahan Baku', 'Sewa Fasilitas', 'Operasional', 'Total Pagu']; baris = hasil.pagu.baris.map(function (x) { return [x.tanggal, x.jumlahInstansi, x.porsiKecil, x.porsiBesar, x.bahanBaku, x.sewaFasilitas, x.operasional, x.totalPagu]; }); }
    else if (!ins) { alert('Insentif belum tersedia (BAST belum dihubungkan).'); return; }
    else if (tab === 'pic') { kepala = ['Nama PIC', 'Jabatan', 'No Rekening', 'Instansi', 'Sekolah', 'Posyandu', 'Total']; baris = ins.perPic.map(function (p) { return [p.nama, p.jabatan, p.rekening, p.instansi.join(' / '), p.sekolah, p.posyandu, p.total]; }); }
    else if (tab === 'sekolah') { kepala = ['Instansi', 'Jumlah Siswa', 'Jenjang', 'Tarif per Hari', 'Hari PM', 'Total', 'PIC', 'Status']; baris = ins.sekolah.map(function (r) { return [r.nama, r.jumlahSiswa === null ? '' : r.jumlahSiswa, r.jenjang, r.tarifRingkas, r.hariPm, r.total, r.pic.map(function (p) { return p.nama; }).join(' / '), r.status]; }); }
    else { kepala = ['Instansi', 'Total Porsi', 'Tarif per Porsi', 'Hari PM', 'Total', 'PIC', 'Status']; baris = ins.posyandu.map(function (r) { return [r.nama, r.totalPorsi, r.tarifRingkas, r.hariPm, r.total, r.pic.map(function (p) { return p.nama; }).join(' / '), r.status]; }); }
    const q = function (v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const blob = new Blob(['\uFEFF' + [kepala].concat(baris).map(function (r) { return r.map(q).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8;' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'biaya-' + tab + '-' + hasil.tanggalAwal + '-sd-' + hasil.tanggalAkhir + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  async function mulaiPanel() {
    try {
      const st = await api('getStatusSipanduV2');
      if (!st.terhubung) { root.innerHTML = '<div class="admin-stat-card accent-warning" style="padding:16px;text-align:left;"><b>Database SIPANDU baru belum disambungkan</b><div style="font-size:13px;margin-top:6px;">Sambungkan lewat menu Master Instansi &amp; PIC, lalu muat ulang.</div></div>'; return; }
      kerangka();
    } catch (err) { root.innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div>'; }
  }
  const tombol = document.querySelector('[data-panel="panelSipanduBiaya"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudah) { sudah = true; mulaiPanel(); } });
})();

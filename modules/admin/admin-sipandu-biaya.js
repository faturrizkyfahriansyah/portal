// SPPG JEUNGJING — ADMIN: SIPANDU › Rekap Biaya & Insentif (panelSipanduBiaya). BARU 4 Nov 2026 (Blueprint §10.5); DIRANCANG ULANG 17 Nov 2026 (permintaan Admin).
// Rekap dipilih menurut SKEMA 1 / 7 / 14 hari + tanggal mulai (tanggal akhir dihitung server). Setiap rekap yang ditampilkan TERSIMPAN OTOMATIS ke arsip; daftar arsip + rekap bulanan ada di bagian bawah halaman.
// Total Biaya = Bahan baku + Sewa fasilitas + Operasional (Pagu & Perhitungan). Operasional memuat Insentif PIC (Satuan Pendidikan + Posyandu), Insentif Relawan, dan Sisa Operasional.
// Backend: SipanduInsentifV2.gs (getRekapBiayaV2 [+arsip otomatis], getDaftarArsipBiayaV2, getArsipBiayaV2).
(function () {
  const panel = document.getElementById('panelSipanduBiaya'); if (!panel) return;
  const root = document.getElementById('sbiRoot');
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const rp = function (n) { const v = Math.round(Number(n) || 0); return (v < 0 ? '-' : '') + 'Rp' + Math.abs(v).toLocaleString('id-ID'); };
  const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const tglIndo = function (iso) { return iso ? iso.split('-').reverse().join('/') : ''; };
  const waktuIndo = function (iso) { if (!iso) return ''; const p = String(iso).split('T'); return tglIndo(p[0]) + (p[1] ? ' ' + p[1].slice(0, 5) : ''); };
  const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const STATUS = { OK: ['', ''], PERLU_DATA_SISWA: ['Perlu jumlah siswa', '#c0392b'], TARIF_BELUM_DITETAPKAN: ['Tarif belum ditetapkan', '#c0392b'], TIDAK_ADA_PM: ['Tidak ada PM', '#757575'] };
  const JENIS_ARSIP = { HARIAN: '1 hari', MINGGUAN: '7 hari', DUA_MINGGUAN: '14 hari', BULANAN: 'Bulanan', RENTANG: 'Rentang' };
  const TABS = [['pic', 'Insentif PIC'], ['sekolah', 'Satuan Pendidikan'], ['posyandu', 'Posyandu'], ['relawan', 'Insentif Relawan'], ['tanggal', 'Per Tanggal']];
  const st = { skema: 1, mulai: isoLokal(new Date()), bulan: isoLokal(new Date()).slice(0, 7), hasil: null, tab: 'pic', arsip: null, bulanan: false, daftar: null };
  let sudah = false, nomorMuat = 0;

  function pesan(t, g) { const el = $('sbiPesan'); if (el) { el.textContent = t || ''; el.style.color = g ? '#c0392b' : '#2e7d32'; } }
  const kartu = function (judul, nilai, kelas, sub) { return '<div class="admin-stat-card ' + (kelas || '') + '"><div class="admin-stat-value" style="font-size:19px;">' + nilai + '</div><div class="admin-stat-label">' + judul + '</div>' + (sub ? '<div style="font-size:11.5px;color:var(--color-text-muted,#55606f);margin-top:3px;">' + sub + '</div>' : '') + '</div>'; };

  // ---------- kerangka & kontrol ----------
  function kerangka() {
    root.innerHTML = '<div id="sbiKontrol"></div><div id="sbiPesan" style="font-size:13px;margin:6px 0;"></div><div id="sbiIsi"></div>' +
      '<div id="sbiArsipBox" style="margin-top:22px;border-top:1px solid var(--color-border,#d5dbe3);padding-top:12px;"></div>';
    root.addEventListener('click', function (e) {
      const sk = e.target.closest('button[data-skema]'); if (sk) { st.skema = Number(sk.dataset.skema); gambarKontrol(); return; }
      const t = e.target.closest('button[data-tab]'); if (t) { st.tab = t.dataset.tab; gambar(); return; }
      const b = e.target.closest('button[data-buka]'); if (b) { bukaArsip(b.dataset.buka); return; }
      if (e.target.id === 'sbiTampil') { muat(false); return; }
      if (e.target.id === 'sbiPerbaruiArsip') { muat(true); return; }
      if (e.target.id === 'sbiTampilBulan') { muatBulanan(); return; }
      if (e.target.id === 'sbiKembali') { muat(false); return; }
      if (e.target.id === 'sbiCsv') excel(); if (e.target.id === 'sbiCsvRingkasan') excel('ringkasan');
    });
    root.addEventListener('change', function (e) { if (e.target.id === 'sbiMulai') st.mulai = e.target.value || st.mulai; if (e.target.id === 'sbiBulan') st.bulan = e.target.value || st.bulan; });
    gambarKontrol(); gambarArsipBox(); muat(false); muatDaftar();
  }
  function gambarKontrol() {
    $('sbiKontrol').innerHTML = '<div class="filter-bar" style="flex-wrap:wrap;align-items:center;">' +
      [1, 7, 14].map(function (n) { return '<button class="btn-mini' + (st.skema === n ? ' primary' : '') + '" data-skema="' + n + '" type="button">' + n + ' hari</button>'; }).join('') +
      '<label style="font-size:12px;">Mulai tanggal <input type="date" id="sbiMulai" value="' + esc(st.mulai) + '"></label>' +
      '<button class="btn-mini primary" id="sbiTampil" type="button">Tampilkan</button></div>';
  }
  function gambarArsipBox() {
    $('sbiArsipBox').innerHTML = '<details id="sbiArsipLipat"><summary style="font-size:14px;font-weight:700;cursor:pointer;padding:4px 0;">Arsip rekap</summary><div style="margin-top:8px;">' +
      '<div class="filter-bar" style="flex-wrap:wrap;align-items:center;margin-bottom:8px;"><label style="font-size:12px;">Bulan <input type="month" id="sbiBulan" value="' + esc(st.bulan) + '"></label><button class="btn-mini" id="sbiTampilBulan" type="button">Tampilkan bulan</button></div>' +
      '<div id="sbiDaftar"></div></div></details>';
    gambarDaftar();
  }

  // ---------- memuat ----------
  function infoArsip(a) {
    if (!a) return '';
    if (a.status === 'BARU' || a.status === 'DIPERBARUI') return 'Tersimpan ke arsip (' + a.idArsip + ').';
    if (a.status === 'FINAL') return 'Arsip sudah final.';
    if (a.status === 'TIDAK_DISIMPAN') return '';
    return a.pesan || 'Arsip gagal disimpan.';
  }
  async function muat(perbarui) {
    if (!st.mulai) { pesan('Pilih tanggal mulai.', true); return; }
    const my = ++nomorMuat; pesan(''); st.arsip = null; st.bulanan = false;
    $('sbiIsi').innerHTML = '<div class="empty-state">Menghitung…</div>';
    try {
      const h = await api('getRekapBiayaV2', Object.assign({ skema: st.skema, tanggalMulai: st.mulai }, perbarui ? { perbaruiArsip: true } : {}));
      if (my !== nomorMuat) return; st.hasil = h; gambar();
      const a = h.arsip; if (a) { pesan(infoArsip(a), a.status === 'GAGAL'); if (a.status === 'FINAL') tombolPerbarui(); muatDaftar(); }
    } catch (err) { if (my !== nomorMuat) return; st.hasil = null; $('sbiIsi').innerHTML = ''; pesan(err.message || 'Gagal memuat.', true); }
  }
  function tombolPerbarui() { const el = $('sbiPesan'); if (el) el.insertAdjacentHTML('beforeend', ' <button class="btn-mini" id="sbiPerbaruiArsip" type="button">Perbarui arsip dengan hasil ini</button>'); }
  async function muatBulanan() {
    const b = st.bulan; if (!/^\d{4}-\d{2}$/.test(b || '')) { pesan('Pilih bulan.', true); return; }
    const th = Number(b.slice(0, 4)), bl = Number(b.slice(5, 7)), awal = b + '-01', akhir = isoLokal(new Date(th, bl, 0));
    const my = ++nomorMuat; pesan(''); st.arsip = null; st.bulanan = true;
    $('sbiIsi').innerHTML = '<div class="empty-state">Menghitung…</div>';
    try {
      const h = await api('getRekapBiayaV2', { tanggalAwal: awal, tanggalAkhir: akhir }); if (my !== nomorMuat) return; st.hasil = h; gambar(); $('sbiIsi').scrollIntoView({ behavior: 'smooth', block: 'start' });
      const a = h.arsip; if (a) { pesan(infoArsip(a), a.status === 'GAGAL'); muatDaftar(); }
    } catch (err) { if (my !== nomorMuat) return; st.hasil = null; $('sbiIsi').innerHTML = ''; pesan(err.message || 'Gagal memuat.', true); }
  }
  async function muatDaftar() {
    try { const h = await api('getDaftarArsipBiayaV2'); st.daftar = h.arsip; gambarDaftar(); }
    catch (err) { if ($('sbiDaftar')) $('sbiDaftar').innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat arsip.') + '</div>'; }
  }
  function gambarDaftar() {
    const el = $('sbiDaftar'); if (!el) return;
    const d = st.daftar; if (!d) { el.innerHTML = '<div class="empty-state">Memuat arsip…</div>'; return; }
    el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Rentang</th><th>Jenis</th><th>Total Biaya</th><th>Terakhir disimpan</th><th>Oleh</th><th></th></tr></thead><tbody>' +
      (d.length ? d.map(function (a) { return '<tr><td>' + tglIndo(a.tanggalAwal) + (a.tanggalAwal !== a.tanggalAkhir ? ' – ' + tglIndo(a.tanggalAkhir) : '') + '</td><td>' + esc(JENIS_ARSIP[a.jenis] || a.jenis) + '</td><td><b>' + rp(a.totalBiaya) + '</b></td><td>' + esc(waktuIndo(a.dibuatPada)) + '</td><td style="font-size:12px;">' + esc(a.dibuatOleh) + '</td><td><button class="btn-mini" data-buka="' + esc(a.idArsip) + '" type="button">Buka</button></td></tr>'; }).join('') : '<tr><td colspan="6"><div class="empty-state">Belum ada arsip.</div></td></tr>') + '</tbody></table></div>';
  }
  async function bukaArsip(id) {
    const my = ++nomorMuat; pesan(''); $('sbiIsi').innerHTML = '<div class="empty-state">Membuka arsip…</div>';
    try { const h = await api('getArsipBiayaV2', { idArsip: id }); if (my !== nomorMuat) return; st.hasil = h; st.arsip = h.arsip; st.bulanan = false; gambar(); $('sbiIsi').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (err) { if (my !== nomorMuat) return; $('sbiIsi').innerHTML = ''; pesan(err.message || 'Gagal membuka arsip.', true); }
  }

  // ---------- tampilan hasil ----------
  function judulHasil(h) {
    if (st.arsip) return '<div class="admin-stat-card accent-info" style="padding:10px 12px;text-align:left;margin-bottom:10px;font-size:13px;"><b>ARSIP ' + esc(st.arsip.idArsip) + '</b> · ' + esc(JENIS_ARSIP[st.arsip.jenis] || st.arsip.jenis) + ' · ' + tglIndo(h.tanggalAwal) + (h.tanggalAwal !== h.tanggalAkhir ? ' – ' + tglIndo(h.tanggalAkhir) : '') + ' · disimpan ' + esc(waktuIndo(st.arsip.dibuatPada)) + ' <button class="btn-mini" id="sbiKembali" type="button">Kembali ke rekap</button></div>';
    const teks = h.skema ? 'Rekap ' + h.skema + ' hari' : 'Rekap bulan ' + NAMA_BULAN[Number(h.tanggalAwal.slice(5, 7)) - 1] + ' ' + h.tanggalAwal.slice(0, 4);
    return '<div style="font-size:14px;font-weight:700;margin-bottom:8px;">' + teks + ' · ' + tglIndo(h.tanggalAwal) + (h.jumlahHari > 1 ? ' – ' + tglIndo(h.tanggalAkhir) : '') + '</div>';
  }
  function gambar() {
    const h = st.hasil; if (!h) return;
    const t = h.total, ins = h.insentif, rel = h.relawan;
    let html = judulHasil(h) + ringkasanKartu(h);
    const per = [];
    if (!rel.tersedia) per.push(rel.pesan || 'Insentif relawan tidak tersedia.');
    if (rel.tanpaTarif) per.push(rel.tanpaTarif + ' relawan punya hari hadir tetapi belum ada tarif di Master Tarif (insentifnya Rp0).');
    if (t.sisaOperasional < 0) per.push('Insentif PIC + relawan melebihi uang operasional pada rentang ini sebesar ' + rp(-t.sisaOperasional) + '.');
    (ins.peringatan || []).forEach(function (p) { per.push(p); });
    if (per.length) html += '<details id="sbiPerhatian" class="admin-stat-card accent-warning" style="padding:10px 14px;text-align:left;margin:10px 0;font-size:13px;"><summary style="cursor:pointer;font-weight:700;">Perlu perhatian (' + per.length + ' catatan)</summary><ul style="margin:8px 0 0 18px;padding:0;">' + per.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></details>';
    if (h.pagu.jumlahTanggalTarifKurang) html += '<div style="font-size:12.5px;color:#c0392b;margin-bottom:8px;">' + h.pagu.jumlahTanggalTarifKurang + ' tanggal pagu memakai tarif yang belum ditetapkan (dihitung Rp0) — lengkapi di Master Tarif.</div>';
    html += '<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' + TABS.map(function (x) { return '<button class="btn-mini' + (x[0] === st.tab ? ' primary' : '') + '" data-tab="' + x[0] + '" type="button">' + x[1] + '</button>'; }).join('') +
      '<button class="btn-mini export" id="sbiCsv" type="button" style="margin-left:auto;">Export Excel</button></div>' +
      '<div class="table-wrap" style="margin-top:8px;">' + tabel() + '</div>';
    $('sbiIsi').innerHTML = html;
      }
  // 18 Nov 2026 (c): ringkasan = SATU kartu (daftar baris), bukan 7 kartu + tabel Komponen yang mengulang angka yang sama.
  function ringkasanKartu(h) {
    const t = h.total, rel = h.relawan, tp = h.pagu.total, abu = 'color:var(--color-text-muted,#55606f);';
    const garis = 'border-top:1px solid var(--color-border,#e3e8ef);';
    const utama = function (label, nilai) { return '<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;' + garis + 'font-size:14px;"><span>' + label + '</span><b>' + rp(nilai) + '</b></div>'; };
    const anak = function (label, nilai, sub, merah) { return '<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0 6px 14px;font-size:13px;' + (merah ? 'color:#c0392b;' : '') + '"><span>' + label + (sub ? '<span style="display:block;font-size:11.5px;' + abu + '">' + sub + '</span>' : '') + '</span><span style="white-space:nowrap;">' + rp(nilai) + '</span></div>'; };
    return '<div class="admin-stat-card" id="sbiRingkasan" style="padding:14px 16px;text-align:left;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;"><div><div style="font-size:12.5px;' + abu + '">Total Biaya</div><div style="font-size:26px;font-weight:800;color:var(--color-navy,#1b2a49);line-height:1.2;">' + rp(t.totalBiaya) + '</div></div>' +
      '<button class="btn-mini export" id="sbiCsvRingkasan" type="button">Export Excel</button></div>' +
      '<div style="margin-top:8px;">' + utama('Bahan Baku', t.bahanBaku) + utama('Sewa Fasilitas', t.sewaFasilitas) + utama('Operasional', t.operasional) +
      '<div style="margin-bottom:2px;">' + anak('Insentif PIC', t.insentifPic, 'Satuan Pendidikan ' + rp(t.insentifSekolah) + ' · Posyandu ' + rp(t.insentifPosyandu)) +
      anak('Insentif Relawan', t.insentifRelawan, rel.tersedia ? f(rel.jumlahOrang) + ' orang · ' + f(rel.hariBayar) + ' hari dibayar' : 'tidak tersedia') +
      anak(t.sisaOperasional < 0 ? 'Operasional Kurang' : 'Sisa Operasional', t.sisaOperasional, '', t.sisaOperasional < 0) + '</div></div>' +
      '<div style="' + garis + 'padding-top:8px;font-size:12px;' + abu + '">Porsi kecil ' + f(tp.porsiKecil) + ' · Porsi besar ' + f(tp.porsiBesar) + '</div></div>';
  }
  function badge(s) { const x = STATUS[s] || ['', '']; return x[0] ? '<span style="color:' + x[1] + ';font-size:11.5px;font-weight:700;">' + x[0] + '</span>' : ''; }
  function picTeks(r) { return r.pic.length ? r.pic.map(function (p) { return esc(p.nama); }).join(', ') : '<span style="color:#c0392b;">belum ada PIC</span>'; }
  // 18 Nov 2026: tabel instansi = Instansi | PM | Jenjang | Tarif per Hari | Hari Operasional | Total | PIC (tanpa kolom Status dan Total porsi)
  function rentangRp(a, b) { return (a === undefined || a === null) ? '—' : (a === b ? rp(a) : rp(a) + '–' + rp(b)); }
  function rentangAngka(a, b) { return (a === undefined || a === null) ? '—' : (a === b ? f(a) : f(a) + '–' + f(b)); }
  function tarifInstansi(r) { if (!r.tarifRingkas) return '—'; const v = String(r.tarifRingkas).split('–'); return v.length > 1 ? rp(v[0]) + '–' + rp(v[1]) : rp(v[0]); }
  function tandaMasalah(r) { return (r.status === 'TARIF_BELUM_DITETAPKAN' || r.status === 'PERLU_DATA_SISWA') ? '<div style="font-size:11px;color:#c0392b;">' + (r.status === 'PERLU_DATA_SISWA' ? 'jumlah siswa kosong' : 'tarif belum ditetapkan') + '</div>' : ''; }
  function barisInstansi(r, pmTeks) {
    return '<tr><td>' + esc(r.nama) + (r.nonaktif ? ' <i style="color:#757575;">(nonaktif)</i>' : '') + tandaMasalah(r) + '</td><td>' + pmTeks + '</td><td style="font-size:12px;">' + esc(r.jenjang || '—') + '</td><td>' + tarifInstansi(r) + '</td><td>' + r.hariPm + '</td><td><b>' + rp(r.total) + '</b></td><td style="font-size:12px;">' + picTeks(r) + '</td></tr>';
  }
  const KEPALA_INSTANSI = '<thead><tr><th>Instansi</th><th>PM</th><th>Jenjang</th><th>Tarif per Hari</th><th>Hari Operasional</th><th>Total</th><th>PIC</th></tr></thead>';
  const TOTAL = 'style="background:var(--color-surface,#f6f8fb);font-weight:700;"';

  function ringkasanBaris(h) {
    const t = h.total, rel = h.relawan;
    return [['Bahan baku', t.bahanBaku, 0], ['Sewa fasilitas', t.sewaFasilitas, 0], ['Operasional', t.operasional, 0], ['Insentif PIC Satuan Pendidikan', t.insentifSekolah, 1], ['Insentif PIC Posyandu', t.insentifPosyandu, 1], ['Insentif Relawan', t.insentifRelawan, 1], [t.sisaOperasional < 0 ? 'Operasional kurang' : 'Sisa operasional', t.sisaOperasional, 1], ['TOTAL BIAYA', t.totalBiaya, 2]];
  }
  function tarifRelawan(o) { return o.tarifBervariasi ? 'bervariasi' : (o.tarif === null || o.tarif === undefined || !o.tarifLengkap ? '<span style="color:#c0392b;">belum ada tarif</span>' : rp(o.tarif)); }
  function relawanBaris(o) { return '<tr><td>' + esc(o.nama) + '</td><td>' + esc(o.divisi) + '</td><td>' + tarifRelawan(o) + '</td><td>' + f(o.kehadiran) + ' hari</td><td><b>' + rp(o.total) + '</b></td></tr>'; }
  function tarifRelawanX(o) { return o.tarifBervariasi ? 'bervariasi' : (o.tarif === null || o.tarif === undefined ? '' : rp(o.tarif)); }
  function tabel() {
    const h = st.hasil, ins = h.insentif, tab = st.tab;
    if (tab === 'tanggal') {
      const b = h.pagu.baris;
      return '<table><thead><tr><th>Tanggal</th><th>Instansi</th><th>Porsi Kecil</th><th>Porsi Besar</th><th>Bahan Baku</th><th>Sewa Fasilitas</th><th>Operasional</th><th>Total</th></tr></thead><tbody>' + (b.length ? b.map(function (x) { return '<tr><td>' + tglIndo(x.tanggal) + (x.tarifLengkap ? '' : ' <span style="color:#c0392b;" title="Tarif belum ditetapkan">(!)</span>') + '</td><td>' + x.jumlahInstansi + '</td><td>' + f(x.porsiKecil) + '</td><td>' + f(x.porsiBesar) + '</td><td>' + rp(x.bahanBaku) + '</td><td>' + rp(x.sewaFasilitas) + '</td><td>' + rp(x.operasional) + '</td><td><b>' + rp(x.totalPagu) + '</b></td></tr>'; }).join('') : '<tr><td colspan="8"><div class="empty-state">Tidak ada PM harian terverifikasi pada rentang ini.</div></td></tr>') + '</tbody></table>';
    }
    if (tab === 'pic') {
      return '<table id="sbiTabelPic"><thead><tr><th>Nama PIC</th><th>Jabatan</th><th>No. Rekening</th><th>Instansi</th><th>Hari Operasional</th><th>Tarif per Hari</th><th>Total</th></tr></thead><tbody>' +
        (ins.perPic.length ? ins.perPic.map(function (p) { const rinci = (p.rincianHari || []).map(function (x) { return x.instansi + ': ' + x.hari + ' hari'; }).join('\n'); return '<tr><td>' + esc(p.nama) + '</td><td>' + esc(p.jabatan || '—') + '</td><td>' + (p.rekening ? esc(p.rekening) : '<span style="color:#c0392b;">kosong</span>') + '</td><td style="font-size:12px;">' + esc(p.instansi.join(', ')) + '</td><td title="' + esc(rinci) + '"><b>' + f(p.hariPm) + '</b>' + ((p.rincianHari || []).length > 1 ? '<div style="font-size:11px;color:var(--color-text-muted,#55606f);">' + p.rincianHari.map(function (x) { return esc(x.instansi) + ' ' + x.hari; }).join(' · ') + '</div>' : '') + '</td><td>' + rentangRp(p.tarifMin, p.tarifMax) + '</td><td><b>' + rp(p.total) + '</b></td></tr>'; }).join('') +
          '<tr ' + TOTAL + '><td colspan="6">TOTAL INSENTIF PIC</td><td>' + rp(ins.total.gabungan) + '</td></tr>' : '<tr><td colspan="7"><div class="empty-state">Tidak ada insentif pada rentang ini.</div></td></tr>') + '</tbody></table>';
    }
    if (tab === 'sekolah') {
      return '<table>' + KEPALA_INSTANSI + '<tbody>' + ins.sekolah.map(function (r) { return barisInstansi(r, r.jumlahSiswa === null ? '<span style="color:#c0392b;">kosong</span>' : f(r.jumlahSiswa)); }).join('') +
        '<tr ' + TOTAL + '><td colspan="5">TOTAL SATUAN PENDIDIKAN</td><td>' + rp(ins.total.sekolah) + '</td><td></td></tr></tbody></table>';
    }
    if (tab === 'relawan') {
      const rel = h.relawan;
      if (!rel.tersedia) return '<div class="empty-state" style="color:#c0392b;">' + esc(rel.pesan) + '</div>';
      if (!rel.perOrang) {   // arsip lama (sebelum 18 Nov) hanya punya ringkasan per divisi
        return '<table><thead><tr><th>Divisi</th><th>Relawan dibayar</th><th>Hari dibayar</th><th>Total insentif</th></tr></thead><tbody>' + (rel.perDivisi.length ? rel.perDivisi.map(function (d) { return '<tr><td>' + esc(d.divisi) + '</td><td>' + f(d.orang) + '</td><td>' + f(d.hari) + '</td><td><b>' + rp(d.total) + '</b></td></tr>'; }).join('') : '<tr><td colspan="4"><div class="empty-state">Tidak ada data kehadiran relawan pada rentang ini.</div></td></tr>') +
          '<tr ' + TOTAL + '><td>TOTAL</td><td>' + f(rel.jumlahOrang) + '</td><td>' + f(rel.hariBayar) + '</td><td>' + rp(rel.total) + '</td></tr></tbody></table>';
      }
      return '<table><thead><tr><th>Nama</th><th>Divisi</th><th>Tarif per Hari</th><th>Total Kehadiran</th><th>Total Insentif</th></tr></thead><tbody>' + (rel.perOrang.length ? rel.perOrang.map(relawanBaris).join('') : '<tr><td colspan="5"><div class="empty-state">Tidak ada data kehadiran relawan pada rentang ini.</div></td></tr>') +
        '<tr ' + TOTAL + '><td colspan="3">TOTAL (' + f(rel.jumlahOrang) + ' orang)</td><td>' + f(rel.hariBayar) + ' hari</td><td>' + rp(rel.total) + '</td></tr></tbody></table>';
    }
    // posyandu: jenjang per posyandu menurut PM 3B-nya sendiri
    const rinci = [];
    ins.posyandu.forEach(function (r) { (r.rincian || []).forEach(function (x) { rinci.push({ tanggal: x.tanggal, nama: r.nama, pm3B: x.pm3B, jenjang: x.jenjang, tarif: x.tarif }); }); });
    rinci.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : (a.tanggal > b.tanggal ? 1 : (a.nama < b.nama ? -1 : 1)); });
    return '<table>' + KEPALA_INSTANSI + '<tbody>' + ins.posyandu.map(function (r) { return barisInstansi(r, rentangAngka(r.pmMin, r.pmMax)); }).join('') +
      '<tr ' + TOTAL + '><td colspan="5">TOTAL POSYANDU</td><td>' + rp(ins.total.posyandu) + '</td><td></td></tr></tbody></table>' +
      (h.jumlahHari > 1 && rinci.length ? '<h3 style="font-size:13.5px;margin:14px 0 6px;">Rincian per tanggal</h3><table><thead><tr><th>Tanggal</th><th>Posyandu</th><th>PM 3B</th><th>Jenjang</th><th>Tarif</th></tr></thead><tbody>' + rinci.map(function (x) { return '<tr><td>' + tglIndo(x.tanggal) + '</td><td>' + esc(x.nama) + '</td><td>' + f(x.pm3B) + '</td><td>' + esc(x.jenjang) + '</td><td>' + rp(x.tarif) + '</td></tr>'; }).join('') + '</tbody></table>' : '');
  }

  // ---------- Excel ----------
  function excel(kunci) {
    const h = st.hasil; if (!h) { alert('Belum ada data. Klik Tampilkan dulu.'); return; }
    const ins = h.insentif, rentang = tglIndo(h.tanggalAwal) + ' s.d. ' + tglIndo(h.tanggalAkhir), tab = kunci || st.tab, nama = 'biaya-' + tab + '-' + h.tanggalAwal + '-sd-' + h.tanggalAkhir + '.xlsx';
    const picTeksX = function (r) { return r.pic.map(function (p) { return p.nama; }).join(' / '); };
    if (tab === 'ringkasan') {
      const b = ringkasanBaris(h);
      Xlsx.unduhTabel(nama, { nama: 'Ringkasan', judul: 'RINGKASAN BIAYA & INSENTIF  ' + rentang, kolom: [{ judul: 'KOMPONEN', lebar: 34 }, { judul: 'NILAI', lebar: 20, tipe: 'rp' }], baris: b.slice(0, b.length - 1).map(function (r) { return [(r[2] === 1 ? '   ' : '') + r[0], r[1]]; }), total: ['TOTAL BIAYA', h.total.totalBiaya] });
    } else if (tab === 'tanggal') {
      const t = h.pagu.total;
      Xlsx.unduhTabel(nama, { nama: 'Per Tanggal', judul: 'BIAYA PER TANGGAL  ' + rentang, kolom: [{ judul: 'TANGGAL', lebar: 13, tipe: 'tengah' }, { judul: 'INSTANSI', lebar: 10, tipe: 'angka' }, { judul: 'PORSI KECIL', lebar: 12, tipe: 'angka' }, { judul: 'PORSI BESAR', lebar: 12, tipe: 'angka' }, { judul: 'BAHAN BAKU', lebar: 16, tipe: 'rp' }, { judul: 'SEWA FASILITAS', lebar: 16, tipe: 'rp' }, { judul: 'OPERASIONAL', lebar: 16, tipe: 'rp' }, { judul: 'TOTAL', lebar: 17, tipe: 'rp' }],
        baris: h.pagu.baris.map(function (x) { return [tglIndo(x.tanggal), x.jumlahInstansi, x.porsiKecil, x.porsiBesar, x.bahanBaku, x.sewaFasilitas, x.operasional, x.totalPagu]; }), total: ['TOTAL', '', t.porsiKecil, t.porsiBesar, t.bahanBaku, t.sewaFasilitas, t.operasional, t.totalPagu] });
    } else if (tab === 'pic') {
      Xlsx.unduhTabel(nama, { nama: 'Insentif PIC', judul: 'INSENTIF PIC  ' + rentang, kolom: [{ judul: 'NAMA PIC', lebar: 28 }, { judul: 'JABATAN', lebar: 16 }, { judul: 'NO. REKENING', lebar: 18 }, { judul: 'INSTANSI', lebar: 44 }, { judul: 'HARI OPERASIONAL', lebar: 18, tipe: 'angka' }, { judul: 'TARIF PER HARI', lebar: 22, tipe: 'tengah' }, { judul: 'TOTAL', lebar: 17, tipe: 'rp' }],
        baris: ins.perPic.map(function (p) { return [p.nama, p.jabatan || '', p.rekening ? String(p.rekening) : '', p.instansi.join(' / '), p.hariPm, rentangRp(p.tarifMin, p.tarifMax), p.total]; }), total: ['TOTAL INSENTIF PIC', '', '', '', '', '', ins.total.gabungan] });
    } else if (tab === 'sekolah') {
      Xlsx.unduhTabel(nama, { nama: 'Satuan Pendidikan', judul: 'INSENTIF PIC SATUAN PENDIDIKAN  ' + rentang, kolom: [{ judul: 'INSTANSI', lebar: 36 }, { judul: 'PM (JUMLAH SISWA)', lebar: 18, tipe: 'angka' }, { judul: 'JENJANG', lebar: 20 }, { judul: 'TARIF PER HARI', lebar: 20, tipe: 'tengah' }, { judul: 'HARI OPERASIONAL', lebar: 18, tipe: 'angka' }, { judul: 'TOTAL', lebar: 16, tipe: 'rp' }, { judul: 'PIC', lebar: 28 }],
        baris: ins.sekolah.map(function (r) { return [r.nama, r.jumlahSiswa === null ? '' : r.jumlahSiswa, r.jenjang, tarifInstansi(r), r.hariPm, r.total, picTeksX(r)]; }), total: ['TOTAL SATUAN PENDIDIKAN', '', '', '', '', ins.total.sekolah, ''] });
    } else if (tab === 'relawan') {
      const rel = h.relawan; if (!rel.tersedia) { alert(rel.pesan); return; }
      if (!rel.perOrang) { Xlsx.unduhTabel(nama, { nama: 'Relawan', judul: 'INSENTIF RELAWAN PER DIVISI  ' + rentang, kolom: [{ judul: 'DIVISI', lebar: 30 }, { judul: 'RELAWAN DIBAYAR', lebar: 16, tipe: 'angka' }, { judul: 'HARI DIBAYAR', lebar: 14, tipe: 'angka' }, { judul: 'TOTAL INSENTIF', lebar: 18, tipe: 'rp' }], baris: rel.perDivisi.map(function (d) { return [d.divisi, d.orang, d.hari, d.total]; }), total: ['TOTAL', rel.jumlahOrang, rel.hariBayar, rel.total] }); return; }
      Xlsx.unduhTabel(nama, { nama: 'Relawan', judul: 'INSENTIF RELAWAN  ' + rentang, kolom: [{ judul: 'NAMA', lebar: 30 }, { judul: 'DIVISI', lebar: 22 }, { judul: 'TARIF PER HARI', lebar: 18, tipe: 'tengah' }, { judul: 'TOTAL KEHADIRAN (HARI)', lebar: 22, tipe: 'angka' }, { judul: 'TOTAL INSENTIF', lebar: 18, tipe: 'rp' }],
        baris: rel.perOrang.map(function (o) { return [o.nama, o.divisi, tarifRelawanX(o), o.kehadiran, o.total]; }), total: ['TOTAL', '', '', rel.hariBayar, rel.total] });
    } else {
      Xlsx.unduhTabel(nama, { nama: 'Posyandu', judul: 'INSENTIF PIC POSYANDU (KADER/TPK 3B)  ' + rentang, kolom: [{ judul: 'INSTANSI', lebar: 36 }, { judul: 'PM 3B PER HARI', lebar: 16, tipe: 'tengah' }, { judul: 'JENJANG', lebar: 30 }, { judul: 'TARIF PER HARI', lebar: 20, tipe: 'tengah' }, { judul: 'HARI OPERASIONAL', lebar: 18, tipe: 'angka' }, { judul: 'TOTAL', lebar: 16, tipe: 'rp' }, { judul: 'PIC', lebar: 28 }],
        baris: ins.posyandu.map(function (r) { return [r.nama, rentangAngka(r.pmMin, r.pmMax), r.jenjang || '', tarifInstansi(r), r.hariPm, r.total, picTeksX(r)]; }), total: ['TOTAL POSYANDU', '', '', '', '', ins.total.posyandu, ''] });
    }
  }

  // ---------- mulai ----------
  async function mulaiPanel() {
    try {
      const status = await api('getStatusSipanduV2');
      if (!status.terhubung) { root.innerHTML = '<div class="admin-stat-card accent-warning" style="padding:16px;text-align:left;"><b>Database SIPANDU baru belum disambungkan</b><div style="font-size:13px;margin-top:6px;">Sambungkan lewat menu Master Instansi &amp; PIC, lalu muat ulang.</div></div>'; return; }
      kerangka();
    } catch (err) { root.innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div>'; }
  }
  const tombol = document.querySelector('[data-panel="panelSipanduBiaya"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudah) { sudah = true; mulaiPanel(); } });
})();

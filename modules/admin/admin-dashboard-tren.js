// SPPG JEUNGJING — ADMIN: Dashboard Pengelola — ikhtisar, tren, dan pemantauan (25 Nov 2026, permintaan Admin).
// Hanya MEMBACA: getDashboardTren (Staff boleh) dan getDashboardPemantauan (khusus Pengelola). Tiap bagian gagal sendiri-sendiri; tidak ada data yang diubah.
// Grafik berupa SVG biasa (tanpa pustaka luar) dengan tabel angka pada "Lihat angka" agar bisa dibaca tanpa warna.
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const rp = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const ang = function (n) { return Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const dm = function (iso) { const a = String(iso || '').split('-'); return a.length === 3 ? a[2] + '/' + a[1] : ''; };
  const dmy = function (iso) { return String(iso || '').split('-').reverse().join('/'); };
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const WARNA = { navy: '#14304F', biru: '#127CB4', hijau: '#1E8E5A', kuning: '#B7791F', merah: '#C6403F', abu: '#98A2B3', garis: '#E1E8F0' };
  function bukaPanel(panel) { const t = document.querySelector('[data-panel="' + panel + '"]'); if (t) t.click(); }
  const api = function (aksi) { return apiGet(aksi, { token: window.sppgAdminToken }); };

  const gaya = document.createElement('style');
  gaya.textContent = '.dt-ik{background:linear-gradient(180deg,rgba(10,29,51,.55) 0%,rgba(10,29,51,.82) 100%),url(assets/ilustrasi-gedung-sppg-web.png) center 30%/cover no-repeat,#0A1D33;color:#fff;border-radius:16px;padding:16px 18px;margin:0 0 16px}.dt-ik h2{margin:0 0 4px;font-size:19px}.dt-ik .tg{font-size:14px;opacity:.92;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}'
    + '.dt-kb{border-radius:999px;padding:2px 12px;background:#fff;font-weight:700;font-size:13px;color:#1E8E5A}.dt-kb.libur{color:#C6403F}.dt-kb.operasional_khusus{color:#0A5C8C}.dt-kb.belum_diatur{color:#8A5A00}'
    + '.dt-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}.dt-kpi button{all:unset;box-sizing:border-box;cursor:pointer;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:12px;padding:10px 12px;display:block}.dt-kpi button:focus-visible{outline:3px solid #9fd0ea}'
    + '.dt-kpi b{display:block;font-size:24px;line-height:1.15}.dt-kpi span{font-size:12.5px;opacity:.9}'
    + '.dt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin:0 0 16px}.dt-grid>section{margin:0!important}'
    + '.dt-sub{font-size:12.5px;color:var(--color-text-muted,#667085);margin:2px 0 8px}.dt-svg{width:100%;height:auto;display:block}.dt-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;margin:4px 0 0}.dt-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}'
    + '.dt-hb{display:grid;grid-template-columns:minmax(80px,32%) 1fr 44px;gap:8px;align-items:center;font-size:13px;margin:0 0 6px}.dt-hb .t{height:10px;background:#E8EEF5;border-radius:6px;overflow:hidden}.dt-hb .t i{display:block;height:100%;border-radius:6px}.dt-hb .n{text-align:right;font-weight:700}.dt-hb .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.dt-top{display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:13px;margin:0 0 4px}.dt-top small{color:var(--color-text-muted,#667085)}.dt-kosong{font-size:13px;color:var(--color-text-muted,#667085);margin:0}'
    + '.dt-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}.dt-chip{background:#F2F6FA;border:1px solid #E1E8F0;border-radius:10px;padding:8px 12px;font-size:12.5px}.dt-chip b{display:block;font-size:17px;color:#14304F}'
    + '.dt-menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.dt-menu>div{border:1px solid #E1E8F0;border-radius:10px;padding:8px 10px;font-size:13px}.dt-menu b{display:block;margin-bottom:2px}.dt-menu .x{color:var(--color-text-muted,#667085)}'
    + '.dt-sepi{padding-top:8px!important;padding-bottom:8px!important}.dt-sepi .panel-block-title{margin-bottom:2px!important}.dt-det{margin-top:8px;font-size:12.5px}.dt-det summary{cursor:pointer;color:var(--color-text-muted,#667085)}.dt-det table{width:100%;border-collapse:collapse;margin-top:6px}.dt-det th,.dt-det td{border-top:1px solid #E1E8F0;padding:4px 6px;text-align:right}.dt-det th:first-child,.dt-det td:first-child{text-align:left}';
  document.head.appendChild(gaya);

  /* ---------- grafik SVG ---------- */
  function garis(seri, opsi) {   // seri: [{x:'24/11', y:96, tebal:false}] y 0..100
    const W = 560, H = 190, kiri = 34, kanan = 12, atas = 12, bawah = 28, w = W - kiri - kanan, h = H - atas - bawah, n = seri.length;
    const X = function (i) { return kiri + (n === 1 ? w / 2 : (w * i) / (n - 1)); }, Y = function (v) { return atas + h - (h * Math.max(0, Math.min(100, v))) / 100; };
    let s = '<svg class="dt-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opsi.judul) + '">';
    [0, 50, 100].forEach(function (g) { s += '<line x1="' + kiri + '" x2="' + (W - kanan) + '" y1="' + Y(g) + '" y2="' + Y(g) + '" stroke="' + WARNA.garis + '"/><text x="' + (kiri - 6) + '" y="' + (Y(g) + 4) + '" font-size="11" text-anchor="end" fill="#667085">' + g + '%</text>'; });
    if (n > 1) { s += '<polygon points="' + X(0) + ',' + Y(0) + ' ' + seri.map(function (p, i) { return X(i) + ',' + Y(p.y); }).join(' ') + ' ' + X(n - 1) + ',' + Y(0) + '" fill="' + WARNA.biru + '" opacity=".12"/>';
      s += '<polyline fill="none" stroke="' + WARNA.biru + '" stroke-width="2.5" stroke-linejoin="round" points="' + seri.map(function (p, i) { return X(i) + ',' + Y(p.y); }).join(' ') + '"/>'; }
    seri.forEach(function (p, i) {
      s += '<circle cx="' + X(i) + '" cy="' + Y(p.y) + '" r="4" fill="' + (p.berjalan ? '#fff' : WARNA.biru) + '" stroke="' + WARNA.biru + '" stroke-width="2"><title>' + esc(p.x + ': ' + p.y + '%') + '</title></circle>';
      if (n <= 8 || i % 2 === 0 || i === n - 1) s += '<text x="' + X(i) + '" y="' + (H - 8) + '" font-size="11" text-anchor="middle" fill="#667085">' + esc(p.x) + '</text>';
    });
    return s + '</svg>';
  }
  function batang(seri, opsi) {   // seri: [{x, a, b}] tumpuk a (bawah) + b (atas)
    const W = 560, H = 190, kiri = 40, kanan = 8, atas = 12, bawah = 28, w = W - kiri - kanan, h = H - atas - bawah, n = seri.length, maks = Math.max(1, Math.max.apply(null, seri.map(function (p) { return p.a + p.b; })));
    const lebar = Math.min(34, w / Math.max(n, 1) * 0.65), Y = function (v) { return atas + h - (h * v) / maks; };
    let s = '<svg class="dt-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opsi.judul) + '">';
    [0, 0.5, 1].forEach(function (g) { const v = Math.round(maks * g); s += '<line x1="' + kiri + '" x2="' + (W - kanan) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + WARNA.garis + '"/><text x="' + (kiri - 6) + '" y="' + (Y(v) + 4) + '" font-size="11" text-anchor="end" fill="#667085">' + ang(v) + '</text>'; });
    seri.forEach(function (p, i) {
      const cx = kiri + (w * (i + 0.5)) / n, ya = Y(p.a), yb = Y(p.a + p.b);
      s += '<rect x="' + (cx - lebar / 2) + '" y="' + ya + '" width="' + lebar + '" height="' + Math.max(0, Y(0) - ya) + '" fill="' + WARNA.biru + '"><title>' + esc(p.x + ': ' + ang(p.a) + ' ' + opsi.a) + '</title></rect>';
      if (p.b > 0) s += '<rect x="' + (cx - lebar / 2) + '" y="' + yb + '" width="' + lebar + '" height="' + Math.max(0, ya - yb) + '" fill="' + WARNA.kuning + '"><title>' + esc(p.x + ': ' + ang(p.b) + ' ' + opsi.b) + '</title></rect>';
      if (n <= 8 || i % 2 === 0 || i === n - 1) s += '<text x="' + cx + '" y="' + (H - 8) + '" font-size="11" text-anchor="middle" fill="#667085">' + esc(p.x) + '</text>';
    });
    return s + '</svg>';
  }
  function hbar(label, persen, warna, teksKanan) { return '<div class="dt-hb"><span class="l" title="' + esc(label) + '">' + esc(label) + '</span><span class="t"><i style="width:' + Math.max(2, Math.min(100, persen)) + '%;background:' + warna + '"></i></span><span class="n">' + esc(teksKanan == null ? persen + '%' : teksKanan) + '</span></div>'; }
  function tabelAngka(judul, kepala, baris) { return '<details class="dt-det"><summary>Lihat angka</summary><table aria-label="' + esc(judul) + '"><thead><tr>' + kepala.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('') + '</tr></thead><tbody>' + baris.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></details>'; }
  const warnaPersen = function (p) { return p >= 90 ? WARNA.hijau : (p >= 75 ? WARNA.kuning : WARNA.merah); };
  const kartu = function (judul, isi, sub, aksi) { return '<section class="panel-block" style="margin-bottom:16px;"><p class="panel-block-title">' + esc(judul) + '</p>' + (sub ? '<p class="dt-sub">' + sub + '</p>' : '') + isi + (aksi || '') + '</section>'; };

  /* ---------- ikhtisar ---------- */
  let tren = null, pantau = null;
  function sapa() { const j = new Date().getHours(); return j < 11 ? 'Selamat pagi' : (j < 15 ? 'Selamat siang' : (j < 18 ? 'Selamat sore' : 'Selamat malam')); }
  function hitungTindakan() {
    let n = $('dpPerhatianIsi') ? $('dpPerhatianIsi').querySelectorAll('.dp-item').length : 0;
    if (pantau && pantau.pengaduan) n += pantau.pengaduan.baru || 0;
    const el = $('dtKpiTindakan'); if (el) el.textContent = String(n);
  }
  function renderIkhtisar() {
    const el = $('dtIkhtisar'); if (!el) return;
    const t = tren, d = t ? new Date(t.hariIni + 'T00:00:00') : new Date(), tgl = (t ? t.hari : '') + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
    const k = t && t.kalender, kp = t ? t.kpi : null;
    el.innerHTML = '<h2>' + sapa() + ', Pengelola</h2><div class="tg"><span>' + esc(tgl) + '</span>' + (k ? '<span class="dt-kb ' + esc(String(k.status).toLowerCase()) + '">' + esc(k.label) + '</span>' + (k.keterangan ? '<span>' + esc(k.keterangan) + '</span>' : '') : '') + '</div>'
      + '<div class="dt-kpi">'
      + '<button type="button" data-ke="panelHarian"><b>' + (kp ? ang(kp.hadir) + ' / ' + ang(kp.terjadwal) : '–') + '</b><span>Relawan hadir hari ini</span></button>'
      + '<button type="button" data-ke="panelSipanduPm"><b>' + (kp && kp.pmHariIni != null ? ang(kp.pmHariIni) : '–') + '</b><span>PM hari ini</span></button>'
      + '<button type="button" data-ke="panelStok"><b>' + (kp && kp.stokBawahBatas != null ? ang(kp.stokBawahBatas) : '–') + '</b><span>Barang stok di bawah batas</span></button>'
      + '<button type="button" data-ke="dpPerhatianCard"><b id="dtKpiTindakan">–</b><span>Perlu tindakan</span></button></div>';
    el.querySelectorAll('[data-ke]').forEach(function (b) { b.addEventListener('click', function () { const p = b.dataset.ke; if (p === 'dpPerhatianCard') { const c = $(p); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else bukaPanel(p); }); });
    hitungTindakan();
  }

  /* ---------- tren ---------- */
  function renderTren() {
    const el = $('dtTren'); if (!el) return;
    if (!tren) { el.innerHTML = ''; return; }
    const t = tren, kh = t.kehadiran, pm = t.pm;
    let a = '';
    if (kh.length) {
      const seri = kh.map(function (x) { return { x: dm(x.tanggal), y: x.persen, berjalan: x.berjalan }; });
      a = garis(seri, { judul: 'Tren kehadiran relawan 14 hari terakhir' }) + '<p class="dt-sub" style="margin:4px 0 0">Persen relawan hadir dari yang terjadwal. Titik kosong = hari ini (masih berjalan). Libur pergiliran tidak dihitung.</p>'
        + tabelAngka('Kehadiran per hari', ['Tanggal', 'Terjadwal', 'Hadir', 'Terlambat', 'Izin/sakit/cuti', 'Tidak hadir'], kh.map(function (x) { return [dmy(x.tanggal), x.terjadwal, x.hadir, x.terlambat, x.izinSakitCuti, x.alfa]; }));
    } else a = '<p class="dt-kosong">Belum ada data kehadiran pada 14 hari terakhir.</p>';
    let b = '';
    if (pm.length) {
      const seri = pm.map(function (x) { return { x: dm(x.tanggal), a: x.tiga, b: x.lain }; });
      b = batang(seri, { judul: 'Tren penerima manfaat harian', a: 'PM Posyandu (3B)', b: 'porsi satuan pendidikan' }) + '<div class="dt-leg"><span><i style="background:' + WARNA.biru + '"></i>Posyandu (balita, ibu hamil, ibu menyusui)</span><span><i style="background:' + WARNA.kuning + '"></i>Satuan Pendidikan (porsi kecil dan besar)</span></div>'
        + tabelAngka('PM per hari', ['Tanggal', 'Posyandu', 'Satuan Pendidikan', 'Total'], pm.map(function (x) { return [dmy(x.tanggal), ang(x.tiga), ang(x.lain), ang(x.total)]; }));
    } else b = '<p class="dt-kosong">Belum ada PM harian terverifikasi pada 14 hari terakhir.</p>';
    let c = t.divisiPekan.length ? t.divisiPekan.map(function (x) { return hbar(x.divisi, x.persen, warnaPersen(x.persen), x.persen + '%'); }).join('') : '<p class="dt-kosong">Belum ada data pekan ini.</p>';
    const top = function (arr, kata) { return arr.length ? arr.map(function (x) { return '<div class="dt-top"><span>' + esc(x.nama) + '<br><small>' + esc(x.divisi) + '</small></span><b>' + x.jumlah + ' ' + kata + '</b></div>'; }).join('') : '<p class="dt-kosong">Tidak ada.</p>'; };
    el.innerHTML = '<div class="dt-grid">' + kartu('Tren kehadiran', a, '14 hari terakhir') + kartu('Tren penerima manfaat', b, '14 hari terakhir, dari PM harian yang sudah terverifikasi') + '</div>'
      + '<div class="dt-grid">' + kartu('Kehadiran per divisi', c, 'Pekan ini (' + dmy(t.pekan.awal) + ' sampai hari ini), dari yang terendah')
      + kartu('Terlambat dan tidak hadir terbanyak', '<p class="dt-sub" style="margin:0 0 4px"><b>Terlambat</b></p>' + top(t.terlambatTop, 'kali') + '<p class="dt-sub" style="margin:10px 0 4px"><b>Tidak hadir (alfa)</b></p>' + top(t.alfaTop, 'hari'), 'Pekan ini, 5 teratas') + '</div>';
  }

  /* ---------- pemantauan ---------- */
  function renderPantau() {
    const el = $('dtPantau'); if (!el) return;
    if (!pantau) { el.innerHTML = ''; return; }
    const p = pantau; let html = '';
    if (p.bnba) {
      const b = p.bnba.total, rendah = p.bnba.tempat.filter(function (x) { return x.persen !== null; }).slice(0, 6);
      const isi = '<div class="dt-chips"><div class="dt-chip"><b>' + b.persen + '%</b>terisi dari target</div><div class="dt-chip"><b>' + b.lengkap + ' / ' + b.tempat + '</b>tempat lengkap</div><div class="dt-chip"><b>' + b.belumMulai + '</b>belum mulai</div>' + (b.tanpaTarget ? '<div class="dt-chip"><b>' + b.tanpaTarget + '</b>belum ada target</div>' : '') + '</div>'
        + (rendah.length ? '<p class="dt-sub" style="margin:6px 0 4px">Paling rendah:</p>' + rendah.map(function (x) { return hbar(x.nama, x.persen, warnaPersen(x.persen), ang(x.terisi) + '/' + ang(x.target)); }).join('') : '');
      html += '<div class="dt-grid">' + kartu('Pendataan BNBA', isi, 'Posyandu dan satuan pendidikan', '<button type="button" class="btn-mini" style="margin-top:8px" data-ke="panelPendataan3B">Buka Pendataan BNBA</button>');
      const pm = '<div class="dt-chips"><div class="dt-chip"><b>' + ang(b.perluDiperbarui) + '</b>data perlu diperbarui</div><div class="dt-chip"><b>' + b.tempatPerlu + '</b>tempat terkait</div><div class="dt-chip"><b>' + (b.putaranAktif ? 'Aktif' : 'Tidak ada') + '</b>putaran pemutakhiran</div></div>';
      html += kartu('Pemutakhiran data', pm, 'Data yang sudah lewat batas dan belum dikonfirmasi PIC', '<button type="button" class="btn-mini" data-ke="panelPendataan3B">Atur putaran</button>') + '</div>';
    }
    let kanan = '';
    if (p.biaya) {
      const x = p.biaya, pakai = x.operasional > 0 ? Math.round((x.insentifPic + x.insentifRelawan) * 100 / x.operasional) : 0;
      const isi = '<div class="dt-chips"><div class="dt-chip"><b>' + rp(x.pagu) + '</b>pagu sampai hari ini</div><div class="dt-chip"><b>' + rp(x.insentifPic) + '</b>insentif PIC</div><div class="dt-chip"><b>' + rp(x.insentifRelawan) + '</b>insentif relawan</div><div class="dt-chip"><b>' + rp(x.sisaOperasional) + '</b>sisa operasional</div></div>'
        + hbar('Insentif dari dana operasional', pakai, pakai > 100 ? WARNA.merah : (pakai > 85 ? WARNA.kuning : WARNA.hijau), pakai + '%') + (x.peringatan ? '<p class="dt-sub" style="margin:6px 0 0;color:#8A5A00">' + x.peringatan + ' catatan perlu dicek di Rekap Biaya.</p>' : '');
      kanan += kartu('Biaya dan insentif periode berjalan', isi, esc(x.periode || 'Periode') + ': ' + dmy(x.awal) + ' sampai ' + dmy(x.akhir) + ' (dihitung sampai ' + dmy(x.sampai) + ')', '<button type="button" class="btn-mini" style="margin-top:8px" data-ke="panelSipanduBiaya">Buka Rekap Biaya</button>');
    }
    if (p.pengaduan) {
      const g = p.pengaduan, isi = '<div class="dt-chips"><div class="dt-chip"><b>' + g.baru + '</b>baru</div><div class="dt-chip"><b>' + g.diproses + '</b>sedang diproses</div></div>'
        + (g.terbaru.length ? g.terbaru.map(function (x) { return '<div class="dt-top"><span>' + esc(x.kategoriLabel) + '<br><small>' + esc([x.namaPic, x.namaInstansi].filter(Boolean).join(' · ')) + '</small></span><small>' + esc(String(x.dibuat || '').slice(0, 10).split('-').reverse().join('/')) + '</small></div>'; }).join('') : '<p class="dt-kosong">Tidak ada pengaduan baru.</p>');
      kanan += kartu('Pengaduan dari PIC', isi, 'Insentif, jumlah PM, data tempat, kritik dan saran', '<button type="button" class="btn-mini primary" style="margin-top:8px" data-ke="pengaduan">Buka pengaduan</button>');
    }
    if (kanan) html += '<div class="dt-grid">' + kanan + '</div>';
    let bawah = '';
    if (p.menu && p.menu.length) {
      bawah += kartu('Menu 3 hari ke depan', '<div class="dt-menu">' + p.menu.map(function (m, i) { return '<div><b>' + (i === 0 ? 'Hari ini' : m.hari) + ' · ' + dm(m.tanggal) + '</b>' + (m.ada ? '<span class="x">' + esc([m.menu.karbohidrat, m.menu.lauk, m.menu.sayur, m.menu.buah].filter(Boolean).join(', ')) + '</span>' : '<span class="x">Belum ditetapkan</span>') + '</div>'; }).join('') + '</div>', null, '<button type="button" class="btn-mini" style="margin-top:8px" data-ke="panelSipanduMenu">Buka Manajemen Menu</button>');
      const w = $('ovMenuWrap'); if (w) w.style.display = 'none';   // digantikan kartu 3 hari (sudah memuat menu hari ini)
    }
    if (p.stok && p.stok.daftar.length) {
      bawah += kartu('Barang di bawah batas', p.stok.daftar.map(function (b) { return hbar(b.nama, b.minimum > 0 ? Math.min(100, Math.round(b.stok * 100 / b.minimum)) : 0, b.status === 'MENIPIS' ? WARNA.kuning : WARNA.merah, ang(b.stok) + '/' + ang(b.minimum)); }).join(''), p.stok.bawahBatas + ' dari ' + p.stok.total + ' barang. Angka = stok / batas minimum.', '<button type="button" class="btn-mini" style="margin-top:8px" data-ke="panelStok">Buka SIRAGA</button>');
    }
    el.innerHTML = html + (bawah ? '<div class="dt-grid">' + bawah + '</div>' : '');
    el.querySelectorAll('[data-ke]').forEach(function (b) { b.addEventListener('click', function () {
      const k = b.dataset.ke; if (k === 'pengaduan') { bukaPanel('panelPendataan3B'); setTimeout(function () { const t = document.querySelector('[data-bn="peng"]'); if (t) t.click(); }, 400); } else bukaPanel(k); }); });
    hitungTindakan();
  }

  /* ---------- merapikan bagian yang kosong ---------- */
  function rapikan() {
    // Grafik lama "Tren Kehadiran (7 Hari)" digantikan tren 14 hari yang baru: disembunyikan (tidak dihapus) bila yang baru sudah tampil.
    const lama = $('grafikTrenKehadiran');
    if (lama && $('dtTren') && $('dtTren').querySelector('svg')) {
      lama.style.display = 'none';
      const jd = lama.previousElementSibling; if (jd && /Tren Kehadiran/i.test(jd.textContent)) jd.style.display = 'none';
    }
    ['ovPmWrap', 'ovMenuWrap'].forEach(function (id) {
      const w = $(id); if (!w || w.style.display === 'none') return;
      const t = w.textContent.replace(/\s+/g, ' ').trim();
      w.classList.toggle('dt-sepi', t.length < 90 && /belum|tidak ada|kosong|gagal/i.test(t));
    });
  }

  let sedang = false, terakhir = 0;
  async function muat(paksa) {
    if (sedang || !window.sppgAdminToken) return;
    if (!paksa && Date.now() - terakhir < 30000) return;
    sedang = true; terakhir = Date.now();
    try {
      const r = await Promise.allSettled([api('getDashboardTren'), api('getDashboardPemantauan')]);
      tren = r[0].status === 'fulfilled' ? r[0].value : null; pantau = r[1].status === 'fulfilled' ? r[1].value : null;   // Staff: Pemantauan ditolak -> bagian itu tidak tampil
      // Jawaban yang bentuknya tidak lengkap dianggap tidak ada (jangan sampai merusak halaman).
      if (tren && !(Array.isArray(tren.kehadiran) && Array.isArray(tren.pm) && tren.kpi)) tren = null;
      if (pantau && !(pantau.bnba && pantau.stok && Array.isArray(pantau.menu) && pantau.pengaduan)) pantau = null;
      renderIkhtisar(); renderTren(); renderPantau(); rapikan();
    } finally { sedang = false; }
  }
  let sudah = false;
  function init() {
    if (sudah || !window.sppgAdminToken) return; sudah = true;
    const menu = document.querySelector('[data-panel="panelOverview"]'); if (menu) menu.addEventListener('click', function () { muat(false); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && $('panelOverview') && $('panelOverview').classList.contains('active')) muat(false); });
    setInterval(function () { if (!document.hidden && $('panelOverview') && $('panelOverview').classList.contains('active')) muat(true); }, 5 * 60 * 1000);
    const pe = $('dpPerhatianIsi'); if (pe && window.MutationObserver) new MutationObserver(hitungTindakan).observe(pe, { childList: true, subtree: true });
    const po = $('panelOverview'); if (po && window.MutationObserver) { let tm = 0; new MutationObserver(function () { clearTimeout(tm); tm = setTimeout(rapikan, 250); }).observe(po, { childList: true, subtree: true }); }
    renderIkhtisar(); muat(true);
    setTimeout(rapikan, 4000); setTimeout(rapikan, 10000);
  }
  window.addEventListener('sppg-admin-ready', init);
  if (window.sppgAdminToken) init();
})();

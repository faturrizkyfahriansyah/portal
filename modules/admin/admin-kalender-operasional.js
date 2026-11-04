// SPPG JEUNGJING — ADMIN: SIKOP › Kalender Operasional PER TANGGAL (panelKalenderOperasional). BARU 4 Nov 2026.
// REVISI 4 Nov 2026 (Admin): tampilan seperti Rekap Biaya — Hari ini / 7 hari / 14 hari (dimulai dari HARI INI di kiri) / Bulan, digeser dengan panah.
// Angka PM ditampilkan PENUH (2.610, bukan "2,6rb"); klik tanggal = PM lengkap per instansi (kategori sesuai jenis) + tombol ubah di Manajemen PM.
// Tampilan bulan (Senin–Minggu) TANPA memilih periode. Setiap tanggal: status Operasional / Libur / Operasional Khusus / Belum diatur,
// total PM harian (dari PM HARIAN, bukan acuan) dan penanda menu. Staff boleh melihat; hanya Admin yang boleh mengubah.
// Backend: KalenderTanggal.gs (getKalenderRentangV2, simpanKalenderTanggalV2, hapusKalenderTanggalV2, simpanKalenderMassalV2).
(function () {
  const panel = document.getElementById('panelKalenderOperasional'); if (!panel) return;
  const root = document.getElementById('kcRoot');
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const dariIso = function (iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const geser = function (iso, n) { const d = dariIso(iso); d.setDate(d.getDate() + n); return isoLokal(d); };
  const tglIndo = function (iso) { return iso.split('-').reverse().join('/'); };
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const STYLE = {
    OPERASIONAL: ['Operasional', '#e8f6ee', '#1a7a4c'], OPERASIONAL_KHUSUS: ['Operasional Khusus', '#fff4e5', '#8a5a12'], LIBUR: ['Libur', '#f1f2f4', '#6b7280'],
    DIBATALKAN: ['Dibatalkan', '#fdecea', '#b23a3a'], BELUM_DIATUR: ['Belum diatur', '#ffffff', '#9aa3b0']
  };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const staff = function () { return window.sppgAdminRole === 'STAFF'; };
  const singkat = function (n) { return n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'rb' : String(n); };
  const fmt = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  const KATEGORI = [['pk', 'PK'], ['pb', 'PB'], ['bumil', 'Ibu Hamil'], ['busui', 'Ibu Menyusui'], ['balita', 'Balita']];
  const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  let urutMuat = 0;   // penjaga: jawaban lama dari rentang sebelumnya TIDAK boleh menimpa tampilan terbaru (tombol ditekan cepat)
  let hariIni = isoLokal(new Date()), mode = '7', mulai = hariIni, terpilih = hariIni, peta = {}, divisi = [], sudah = false, ringkasan = null;
  const tahun = function () { return dariIso(mulai).getFullYear(); }, bulan = function () { return dariIso(mulai).getMonth(); };

  function pesan(t, g) { const el = $('kcPesan'); if (el) { el.textContent = t || ''; el.style.color = g ? '#c0392b' : '#2e7d32'; } }
  const badge = function (k) { const b = STYLE[k.status] || STYLE.BELUM_DIATUR; return '<span style="background:' + b[2] + ';color:#fff;border-radius:10px;padding:2px 8px;font-size:11px;white-space:nowrap;">' + b[0] + '</span>'; };

  function kerangka() {
    const tombol = function (m, teks) { return '<button class="btn-mini" data-mode="' + m + '" type="button">' + teks + '</button>'; };
    root.innerHTML =
      '<div class="filter-bar" style="flex-wrap:wrap;">' + tombol('hari', 'Hari ini') + tombol('7', '7 hari') + tombol('14', '14 hari') + tombol('bulan', 'Bulan ini') +
      '<span style="width:10px;"></span><button class="btn-mini" id="kcMundur" type="button" aria-label="Sebelumnya">◀</button><b id="kcJudul" style="min-width:170px;text-align:center;font-size:14.5px;"></b><button class="btn-mini" id="kcMaju" type="button" aria-label="Berikutnya">▶</button></div>' +
      '<div id="kcRingkas" style="font-size:12px;color:var(--color-text-muted,#55606f);margin:2px 0 6px;"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0;font-size:11.5px;">' + ['OPERASIONAL', 'OPERASIONAL_KHUSUS', 'LIBUR', 'BELUM_DIATUR'].map(function (k) { return '<span style="display:inline-flex;align-items:center;gap:4px;"><i style="width:12px;height:12px;border-radius:3px;background:' + STYLE[k][1] + ';border:1px solid ' + STYLE[k][2] + ';"></i>' + STYLE[k][0] + '</span>'; }).join('') + '<span style="color:var(--color-text-muted,#55606f);">angka = total PM harian · ● = ada menu</span></div>' +
      '<div id="kcKepala" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:11px;font-weight:700;color:var(--color-text-muted,#55606f);text-align:center;margin-bottom:4px;">' + HARI.map(function (h) { return '<div>' + h.slice(0, 3) + '</div>'; }).join('') + '</div>' +
      '<div id="kcGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;"></div>' +
      '<div id="kcPesan" style="font-size:13px;margin:8px 0;"></div><div id="kcDetail"></div><div id="kcMassal"></div>';
    root.querySelectorAll('button[data-mode]').forEach(function (b) { b.addEventListener('click', function () { pilihMode(b.dataset.mode); }); });
    $('kcMundur').addEventListener('click', function () { geserRentang(-1); });
    $('kcMaju').addEventListener('click', function () { geserRentang(1); });
    $('kcGrid').addEventListener('click', function (e) { const b = e.target.closest('button[data-t]'); if (b) { terpilih = b.dataset.t; gambarGrid(); gambarDetail(); } });
  }
  function pilihMode(m) {
    mode = m;
    if (m === 'bulan') { const d = dariIso(hariIni); mulai = isoLokal(new Date(d.getFullYear(), d.getMonth(), 1)); terpilih = hariIni; }
    else { mulai = hariIni; terpilih = hariIni; }
    muat();
  }
  function geserRentang(arah) {
    if (mode === 'hari') mulai = geser(mulai, arah);
    else if (mode === '7') mulai = geser(mulai, 7 * arah);
    else if (mode === '14') mulai = geser(mulai, 14 * arah);
    else { const d = new Date(tahun(), bulan() + arah, 1); mulai = isoLokal(d); }
    terpilih = mulai; muat();
  }
  function rentang() {
    if (mode === 'hari') return [mulai, mulai];
    if (mode === '7') return [mulai, geser(mulai, 6)];
    if (mode === '14') return [mulai, geser(mulai, 13)];
    const awalBulan = new Date(tahun(), bulan(), 1), akhirBulan = new Date(tahun(), bulan() + 1, 0);
    const a = new Date(awalBulan); a.setDate(1 - ((awalBulan.getDay() + 6) % 7));
    const b = new Date(akhirBulan); b.setDate(akhirBulan.getDate() + (6 - ((akhirBulan.getDay() + 6) % 7)));
    return [isoLokal(a), isoLokal(b)];
  }
  function judul() {
    const d = dariIso(mulai);
    if (mode === 'bulan') return BULAN[d.getMonth()] + ' ' + d.getFullYear();
    if (mode === 'hari') return HARI[(d.getDay() + 6) % 7] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
    const e = dariIso(geser(mulai, mode === '7' ? 6 : 13));
    return d.getDate() + ' ' + BULAN_PENDEK[d.getMonth()] + ' – ' + e.getDate() + ' ' + BULAN_PENDEK[e.getMonth()] + ' ' + e.getFullYear();
  }
  async function muat() {
    $('kcJudul').textContent = judul(); pesan('');
    root.querySelectorAll('button[data-mode]').forEach(function (b) { b.classList.toggle('primary', b.dataset.mode === mode); });
    $('kcKepala').style.display = mode === 'hari' ? 'none' : 'grid'; $('kcGrid').style.display = mode === 'hari' ? 'none' : 'grid';
    const r = rentang(), giliran = ++urutMuat;
    try {
      const d = await api('getKalenderRentangV2', { tanggalAwal: r[0], tanggalAkhir: r[1] });
      if (giliran !== urutMuat) return;      // sudah ada permintaan yang lebih baru
      peta = {}; d.hari.forEach(function (h) { peta[h.tanggal] = h; }); hariIni = d.hariIni || hariIni;
      if (!peta[terpilih]) terpilih = mulai;
      const dalam = d.hari.filter(function (h) { return mode !== 'bulan' || dariIso(h.tanggal).getMonth() === bulan(); });
      const hit = function (st) { return dalam.filter(function (h) { return h.status === st; }).length; };
      ringkasan = { op: hit('OPERASIONAL'), kh: hit('OPERASIONAL_KHUSUS'), li: hit('LIBUR'), bd: hit('BELUM_DIATUR') };
      $('kcRingkas').textContent = ringkasan.op + ' operasional · ' + ringkasan.kh + ' khusus · ' + ringkasan.li + ' libur · ' + ringkasan.bd + ' belum diatur';
      gambarGrid(); gambarDetail();
    } catch (err) { if (giliran !== urutMuat) return; $('kcGrid').innerHTML = ''; pesan(err.message || 'Gagal memuat kalender.', true); }
  }
  function gambarGrid() {
    if (mode === 'hari') { $('kcGrid').innerHTML = ''; return; }
    const r = rentang(); let html = '';
    for (let iso = r[0]; iso <= r[1]; iso = geser(iso, 1)) {
      const h = peta[iso] || { status: 'BELUM_DIATUR' }, s = STYLE[h.status] || STYLE.BELUM_DIATUR, dipilih = iso === terpilih, ini = iso === hariIni, d = dariIso(iso), luar = mode === 'bulan' && d.getMonth() !== bulan();
      const gaya = 'padding:5px 2px;border-radius:8px;cursor:pointer;background:' + s[1] + ';color:' + s[2] + ';border:' + (dipilih ? '2px solid #0B2D6B' : (h.status === 'BELUM_DIATUR' ? '1px dashed #c3cad4' : '1px solid var(--color-border,#d5dbe3)')) + ';opacity:' + (luar ? '.5' : '1') + ';' + (ini ? 'box-shadow:0 0 0 2px #e65100 inset;' : '');
      const pm = h.pm ? '<span class="kc-pm" style="display:block;font-size:10.5px;font-weight:700;line-height:1.15;">' + fmt(h.pm.total) + '</span>' : '';
      const menu = h.menu ? '<span class="kc-menu" style="display:block;font-size:9px;line-height:1;color:' + (h.menu === 'DISETUJUI' ? '#2e7d32' : '#e65100') + ';">●</span>' : '';
      if (mode === 'bulan') html += '<button type="button" data-t="' + iso + '" data-status="' + h.status + '" title="' + esc(s[0] + (h.pm ? ' · PM ' + fmt(h.pm.total) + ' porsi' : '')) + '" style="min-height:58px;font-size:13px;font-weight:' + (ini ? '800' : '600') + ';' + gaya + '">' + d.getDate() + pm + menu + '</button>';
      else html += '<button type="button" data-t="' + iso + '" data-status="' + h.status + '" title="' + esc(s[0]) + '" style="min-height:96px;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;' + gaya + '">' +
        '<span style="font-size:11px;font-weight:700;">' + HARI_PENDEK[d.getDay()] + '</span><span style="font-size:15px;font-weight:' + (ini ? '800' : '700') + ';">' + d.getDate() + ' ' + BULAN_PENDEK[d.getMonth()] + '</span>' +
        '<span style="font-size:10px;font-weight:600;">' + s[0] + (h.divisiKhusus && h.divisiKhusus.length ? '<br>' + esc(h.divisiKhusus.join(', ')) : '') + '</span>' +
        (h.pm ? '<span class="kc-pm" style="font-size:13px;font-weight:800;">' + fmt(h.pm.total) + ' <small style="font-weight:600;font-size:10px;">PM</small></span>' : '<span style="font-size:10px;opacity:.7;">belum ada PM</span>') + (h.menu ? '<span class="kc-menu" style="font-size:10px;color:' + (h.menu === 'DISETUJUI' ? '#2e7d32' : '#e65100') + ';">● menu</span>' : '') + '</button>';
    }
    $('kcGrid').innerHTML = html;
  }

  async function gambarDetail() {
    const h = peta[terpilih]; if (!h) { $('kcDetail').innerHTML = ''; return; }
    const s = STYLE[h.status] || STYLE.BELUM_DIATUR, d = dariIso(terpilih), boleh = !staff();
    const nama = HARI[(d.getDay() + 6) % 7] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
    const pilih = h.status === 'BELUM_DIATUR' || h.status === 'DIBATALKAN' ? 'OPERASIONAL' : h.status;
    $('kcDetail').innerHTML = '<div class="admin-stat-card" style="padding:14px;text-align:left;margin:10px 0;"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;"><b style="font-size:15px;">' + esc(nama) + '</b>' +
      '<span id="kcBadge" style="background:' + s[2] + ';color:#fff;border-radius:10px;padding:2px 10px;font-size:12px;">' + s[0] + '</span></div>' +
      (h.divisiKhusus.length ? '<div style="font-size:12.5px;margin-top:6px;">Divisi yang beroperasi: <b>' + esc(h.divisiKhusus.join(', ')) + '</b></div>' : '') +
      (h.keterangan ? '<div style="font-size:12.5px;margin-top:4px;">' + esc(h.keterangan) + '</div>' : '') +
      '<div id="kcPm" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border,#e8ebef);"><span style="font-size:12.5px;color:var(--color-text-muted,#55606f);">Memuat data PM…</span></div>' +
      (boleh ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border,#e8ebef);"><div style="font-size:11.5px;font-weight:700;margin-bottom:6px;">Status tanggal</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;"><select id="kcStatus" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;">' +
        [['OPERASIONAL', 'Operasional'], ['LIBUR', 'Libur'], ['OPERASIONAL_KHUSUS', 'Operasional Khusus']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === pilih ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select><input id="kcKet" maxlength="200" placeholder="Keterangan (opsional)" value="' + esc(h.keterangan) + '" style="flex:1;min-width:180px;padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;"></div>' +
        '<div id="kcDivisiWrap" style="display:' + (pilih === 'OPERASIONAL_KHUSUS' ? 'block' : 'none') + ';margin-bottom:8px;"><div style="font-size:11.5px;font-weight:700;margin-bottom:4px;">Divisi yang beroperasi</div><div id="kcDivisi" style="display:flex;flex-wrap:wrap;gap:6px;">' +
        divisi.map(function (v) { const ada = h.divisiKhusus.some(function (x) { return x.toUpperCase() === String(v).toUpperCase(); }); return '<label style="display:flex;align-items:center;gap:4px;font-size:12.5px;padding:4px 8px;border:1px solid var(--color-border,#d5dbe3);border-radius:6px;cursor:pointer;"><input type="checkbox" class="kc-cb" value="' + esc(v) + '"' + (ada ? ' checked' : '') + '> ' + esc(v) + '</label>'; }).join('') + '</div></div>' +
        '<button class="btn-mini primary" id="kcSimpan" type="button">Simpan</button> ' + (h.status !== 'BELUM_DIATUR' ? '<button class="btn-mini" id="kcHapus" type="button" style="color:#c0392b;">Kosongkan</button>' : '') + '</div>'
        : '<div style="font-size:11.5px;color:var(--color-text-muted,#55606f);margin-top:8px;">Anda login sebagai Staff: hanya dapat melihat.</div>') + '</div>';
    if (boleh) {
      $('kcStatus').addEventListener('change', function () { $('kcDivisiWrap').style.display = $('kcStatus').value === 'OPERASIONAL_KHUSUS' ? 'block' : 'none'; });
      $('kcSimpan').addEventListener('click', simpan); if ($('kcHapus')) $('kcHapus').addEventListener('click', hapus);
    }
    muatPm(terpilih, h);
  }
  /**
   * Rincian satu tanggal PERSIS seperti dashboard (permintaan Admin 4 Nov): kartu "Menu" (isiMenuHariIni) lalu "Penerima Manfaat" (isiRingkasanPm):
   * total porsi, PK / PB / 3B, rincian Balita / Ibu Menyusui / Ibu Hamil, dan tabel per instansi (langsung terbuka). Penyaji dipakai BERSAMA dgn dashboard (core/ringkasan-pm.js).
   */
  async function muatPm(iso, h) {
    const kotak = $('kcPm'); if (!kotak) return;
    const tombolUbah = function (teks) { return staff() ? '' : ' <button class="btn-mini" id="kcBukaPm" type="button">' + teks + '</button>'; };
    const judul = function (t) { return '<div style="font-weight:700;font-size:13.5px;margin:0 0 8px;">' + t + '</div>'; };
    const pasang = function () { const b = $('kcBukaPm'); if (b) b.addEventListener('click', function () { if (window.sppgBukaPmTanggal) window.sppgBukaPmTanggal(iso); }); };
    try {
      const p = await api('getKalenderDetailPmV2', { tanggal: iso });
      if (!document.body.contains(kotak) || terpilih !== iso) return;
      if (!p.tersedia) { kotak.innerHTML = '<span style="font-size:12.5px;color:var(--color-text-muted,#55606f);">Data PM belum tersedia (database SIPANDU belum disambungkan).</span>'; return; }
      const ada = p.dashboard && !p.dashboard.belumAdaData;
      kotak.innerHTML =
        '<div style="margin-bottom:14px;">' + judul('Menu') + '<div id="kcMenuIsi"></div></div>' +
        '<div><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;"><b style="font-size:13.5px;">Penerima Manfaat</b>' +
          (ada ? tombolUbah('Lihat / ubah di Manajemen PM') : (h.status === 'LIBUR' ? '' : tombolUbah('Isi di Manajemen PM'))) + '</div><div id="kcPmIsi"></div>' +
          (ada && p.nonaktifTersembunyi && p.nonaktifTersembunyi.instansi ? '<div style="font-size:11px;color:var(--color-text-muted,#55606f);margin-top:8px;">' + p.nonaktifTersembunyi.instansi + ' instansi nonaktif (' + fmt(p.nonaktifTersembunyi.porsi) + ' porsi) tidak dihitung.</div>' : '') + '</div>';
      isiMenuHariIni($('kcMenuIsi'), p.menuDashboard, 'Menu belum ada untuk tanggal ini.');
      if (ada) isiRingkasanPm($('kcPmIsi'), p.dashboard, { terbuka: true, judulTotal: 'Total Porsi PM' });
      else $('kcPmIsi').innerHTML = '<p style="margin:0;font-size:12.5px;color:var(--color-text-muted,#55606f);">' + (h.status === 'LIBUR' ? 'Libur — tidak ada PM.' : 'Belum ada PM harian terverifikasi untuk tanggal ini.') + '</p>';
      pasang();
    } catch (err) { kotak.innerHTML = '<span style="font-size:12.5px;color:var(--color-text-muted,#55606f);">Data PM tidak tersedia.</span>'; }
  }
  async function kirimDenganDampak(aksi, payload) {
    try { return await api(aksi, payload); }
    catch (err) {
      if (String(err.message || '').indexOf('DAMPAK:') !== 0) throw err;
      if (!confirm(String(err.message).replace('DAMPAK: ', '') + '\n\nLanjutkan?')) return null;
      return api(aksi, Object.assign({}, payload, { konfirmasi: true }));
    }
  }
  async function simpan() {
    const status = $('kcStatus').value, pilih = Array.prototype.map.call(document.querySelectorAll('.kc-cb:checked'), function (c) { return c.value; });
    if (status === 'OPERASIONAL_KHUSUS' && !pilih.length) { pesan('Pilih minimal satu divisi yang beroperasi.', true); return; }
    try {
      pesan('Menyimpan…'); const h = await kirimDenganDampak('simpanKalenderTanggalV2', { tanggal: terpilih, status: status, keterangan: $('kcKet').value, divisiKhusus: status === 'OPERASIONAL_KHUSUS' ? pilih : [] });
      if (!h) { pesan('Dibatalkan.'); return; }
      await muat(); pesan('Tersimpan: ' + tglIndo(terpilih) + ' → ' + STYLE[status][0] + '.');
    } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
  }
  async function hapus() {
    if (!confirm('Kosongkan status ' + tglIndo(terpilih) + ' (kembali "Belum diatur")?')) return;
    try { pesan('Menghapus…'); const h = await kirimDenganDampak('hapusKalenderTanggalV2', { tanggal: terpilih }); if (!h) { pesan('Dibatalkan.'); return; } await muat(); pesan('Status ' + tglIndo(terpilih) + ' dikosongkan.'); }
    catch (err) { pesan(err.message || 'Gagal menghapus.', true); }
  }

  // ---- isi banyak tanggal sekaligus (nyicil per bulan) ----
  function gambarMassal() {
    if (staff()) { $('kcMassal').innerHTML = ''; return; }
    const awal = isoLokal(new Date(tahun(), bulan(), 1)), akhir = isoLokal(new Date(tahun(), bulan() + 1, 0));
    const terbuka = !!($('kcMassal').querySelector('details') && $('kcMassal').querySelector('details').open);   // tetap terbuka setelah dirender ulang
    const simpanForm = $('kmAwal') ? { awal: $('kmAwal').value, akhir: $('kmAkhir').value, status: $('kmStatus').value, ket: $('kmKet').value, timpa: $('kmTimpa').checked, hari: Array.prototype.map.call(document.querySelectorAll('.km-hari:checked'), function (c) { return c.value; }) } : null;   // isian dipertahankan
    $('kcMassal').innerHTML = '<details' + (terbuka ? ' open' : '') + ' style="margin:10px 0;"><summary style="cursor:pointer;font-weight:700;font-size:13px;">Isi banyak tanggal sekaligus</summary><div class="admin-stat-card" style="padding:14px;text-align:left;margin-top:8px;">' +
      '<div style="font-size:12px;color:var(--color-text-muted,#55606f);margin-bottom:8px;">Anda yang memilih rentang, hari, dan statusnya — tidak ada yang diisi otomatis. Tanggal yang sudah punya status dilewati kecuali "timpa" dicentang.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;"><label style="font-size:12px;">Dari <input type="date" id="kmAwal" value="' + awal + '"></label><label style="font-size:12px;">Sampai <input type="date" id="kmAkhir" value="' + akhir + '"></label>' +
      '<label style="font-size:12px;">Status <select id="kmStatus"><option value="OPERASIONAL">Operasional</option><option value="LIBUR">Libur</option></select></label>' +
      '<input id="kmKet" maxlength="200" placeholder="Keterangan (opsional)" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;"></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;">' + [[1, 'Sen'], [2, 'Sel'], [3, 'Rab'], [4, 'Kam'], [5, 'Jum'], [6, 'Sab'], [0, 'Min']].map(function (x) { return '<label style="display:flex;align-items:center;gap:3px;font-size:12.5px;padding:4px 8px;border:1px solid var(--color-border,#d5dbe3);border-radius:6px;cursor:pointer;"><input type="checkbox" class="km-hari" value="' + x[0] + '"' + (x[0] >= 1 && x[0] <= 5 ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') +
      '<label style="display:flex;align-items:center;gap:3px;font-size:12.5px;margin-left:8px;"><input type="checkbox" id="kmTimpa"> timpa yang sudah ada</label></div>' +
      '<button class="btn-mini" id="kmPratinjau" type="button">Pratinjau</button> <button class="btn-mini primary" id="kmTerapkan" type="button" disabled>Terapkan</button> <span id="kmHasil" style="font-size:12.5px;margin-left:6px;"></span></div></details>';
    if (simpanForm) {
      $('kmAwal').value = simpanForm.awal; $('kmAkhir').value = simpanForm.akhir; $('kmStatus').value = simpanForm.status; $('kmKet').value = simpanForm.ket; $('kmTimpa').checked = simpanForm.timpa;
      document.querySelectorAll('.km-hari').forEach(function (c) { c.checked = simpanForm.hari.indexOf(c.value) >= 0; });
    }
    $('kmPratinjau').addEventListener('click', function () { massal(true); });
    $('kmTerapkan').addEventListener('click', function () { massal(false); });
    $('kcMassal').addEventListener('input', function () { $('kmTerapkan').disabled = true; $('kmHasil').textContent = ''; });
  }
  function muatanMassal(pratinjau) {
    return { tanggalAwal: $('kmAwal').value, tanggalAkhir: $('kmAkhir').value, status: $('kmStatus').value, keterangan: $('kmKet').value, timpa: $('kmTimpa').checked, pratinjau: pratinjau,
             hari: Array.prototype.map.call(document.querySelectorAll('.km-hari:checked'), function (c) { return Number(c.value); }) };
  }
  async function massal(pratinjau) {
    try {
      const h = pratinjau ? await api('simpanKalenderMassalV2', muatanMassal(true)) : await kirimDenganDampak('simpanKalenderMassalV2', muatanMassal(false));
      if (!h) { pesan('Dibatalkan.'); return; }
      if (pratinjau) { $('kmHasil').textContent = h.dibuat + ' tanggal baru, ' + h.diperbarui + ' diperbarui, ' + h.dilewati + ' dilewati (sudah ada status).'; $('kmTerapkan').disabled = (h.dibuat + h.diperbarui) === 0; return; }
      await muat(); gambarMassal(); pesan('Selesai: ' + h.dibuat + ' tanggal dibuat, ' + h.diperbarui + ' diperbarui, ' + h.dilewati + ' dilewati.');
    } catch (err) { pesan(err.message || 'Gagal.', true); }
  }


  async function mulaiPanel() {
    hariIni = isoLokal(new Date()); mode = '7'; mulai = hariIni; terpilih = hariIni;
    root.innerHTML = '<div class="empty-state">Memuat…</div>';
    kerangka();
    try { divisi = await apiGet('getDivisi', { token: ambilSesiAdmin().token }); if (!Array.isArray(divisi)) divisi = []; } catch (e) { divisi = []; }
    await muat(); gambarMassal();
  }
  const tombol = document.querySelector('[data-panel="panelKalenderOperasional"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudah) { sudah = true; mulaiPanel(); } else { muat(); } });
})();

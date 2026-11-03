// SPPG JEUNGJING — ADMIN: SIKOP › Kalender Operasional PER TANGGAL (panelKalenderOperasional). BARU 4 Nov 2026.
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
  let hariIni = isoLokal(new Date()), tahun, bulan, terpilih = hariIni, peta = {}, divisi = [], sudah = false, ringkasan = null;

  function pesan(t, g) { const el = $('kcPesan'); if (el) { el.textContent = t || ''; el.style.color = g ? '#c0392b' : '#2e7d32'; } }

  function kerangka() {
    root.innerHTML =
      '<div class="filter-bar" style="flex-wrap:wrap;"><button class="btn-mini" id="kcMundur" type="button">◀</button><b id="kcJudul" style="min-width:140px;text-align:center;font-size:15px;"></b><button class="btn-mini" id="kcMaju" type="button">▶</button>' +
      '<button class="btn-mini" id="kcHariIni" type="button">Hari ini</button><span id="kcRingkas" style="font-size:12px;color:var(--color-text-muted,#55606f);"></span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;font-size:11.5px;">' + ['OPERASIONAL', 'OPERASIONAL_KHUSUS', 'LIBUR', 'BELUM_DIATUR'].map(function (k) { return '<span style="display:inline-flex;align-items:center;gap:4px;"><i style="width:12px;height:12px;border-radius:3px;background:' + STYLE[k][1] + ';border:1px solid ' + STYLE[k][2] + ';"></i>' + STYLE[k][0] + '</span>'; }).join('') + '<span style="color:var(--color-text-muted,#55606f);">angka kecil = total PM harian · titik = ada menu</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:11px;font-weight:700;color:var(--color-text-muted,#55606f);text-align:center;margin-bottom:4px;">' + HARI.map(function (h) { return '<div>' + h.slice(0, 3) + '</div>'; }).join('') + '</div>' +
      '<div id="kcGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;"></div>' +
      '<div id="kcPesan" style="font-size:13px;margin:8px 0;"></div><div id="kcDetail"></div><div id="kcMassal"></div>';
    $('kcMundur').addEventListener('click', function () { geserBulan(-1); });
    $('kcMaju').addEventListener('click', function () { geserBulan(1); });
    $('kcHariIni').addEventListener('click', function () { const d = dariIso(hariIni); tahun = d.getFullYear(); bulan = d.getMonth(); terpilih = hariIni; muat(); });
    $('kcGrid').addEventListener('click', function (e) { const b = e.target.closest('button[data-t]'); if (b) { terpilih = b.dataset.t; gambarGrid(); gambarDetail(); } });
  }
  function geserBulan(n) { const d = new Date(tahun, bulan + n, 1); tahun = d.getFullYear(); bulan = d.getMonth(); terpilih = isoLokal(d); muat(); }
  function rentangGrid() {
    const awalBulan = new Date(tahun, bulan, 1), akhirBulan = new Date(tahun, bulan + 1, 0);
    const mulai = new Date(awalBulan); mulai.setDate(1 - ((awalBulan.getDay() + 6) % 7));
    const selesai = new Date(akhirBulan); selesai.setDate(akhirBulan.getDate() + (6 - ((akhirBulan.getDay() + 6) % 7)));
    return [isoLokal(mulai), isoLokal(selesai)];
  }
  async function muat() {
    $('kcJudul').textContent = BULAN[bulan] + ' ' + tahun; pesan('');
    const r = rentangGrid();
    try {
      const d = await api('getKalenderRentangV2', { tanggalAwal: r[0], tanggalAkhir: r[1] });
      peta = {}; d.hari.forEach(function (h) { peta[h.tanggal] = h; }); hariIni = d.hariIni || hariIni;
      const bulanIni = d.hari.filter(function (h) { return dariIso(h.tanggal).getMonth() === bulan; });
      ringkasan = { op: bulanIni.filter(function (h) { return h.status === 'OPERASIONAL'; }).length, kh: bulanIni.filter(function (h) { return h.status === 'OPERASIONAL_KHUSUS'; }).length, li: bulanIni.filter(function (h) { return h.status === 'LIBUR'; }).length, bd: bulanIni.filter(function (h) { return h.status === 'BELUM_DIATUR'; }).length };
      $('kcRingkas').textContent = ringkasan.op + ' operasional · ' + ringkasan.kh + ' khusus · ' + ringkasan.li + ' libur · ' + ringkasan.bd + ' belum diatur';
      gambarGrid(); gambarDetail();
    } catch (err) { $('kcGrid').innerHTML = ''; pesan(err.message || 'Gagal memuat kalender.', true); }
  }
  function gambarGrid() {
    const r = rentangGrid(); let html = '';
    for (let iso = r[0]; iso <= r[1]; iso = geser(iso, 1)) {
      const h = peta[iso] || { status: 'BELUM_DIATUR' }, s = STYLE[h.status] || STYLE.BELUM_DIATUR, luar = dariIso(iso).getMonth() !== bulan, dipilih = iso === terpilih, ini = iso === hariIni;
      html += '<button type="button" data-t="' + iso + '" data-status="' + h.status + '" title="' + esc(s[0] + (h.pm ? ' · PM ' + h.pm.total : '')) + '" style="min-height:56px;padding:4px 2px;border-radius:8px;cursor:pointer;background:' + s[1] + ';color:' + s[2] + ';border:' + (dipilih ? '2px solid #0B2D6B' : (h.status === 'BELUM_DIATUR' ? '1px dashed #c3cad4' : '1px solid var(--color-border,#d5dbe3)')) + ';opacity:' + (luar ? '.5' : '1') + ';font-size:13px;font-weight:' + (ini ? '800' : '600') + ';' + (ini ? 'box-shadow:0 0 0 2px #e65100 inset;' : '') + '">' +
        dariIso(iso).getDate() + (h.pm ? '<span class="kc-pm" style="display:block;font-size:10px;font-weight:600;line-height:1.1;">' + singkat(h.pm.total) + '</span>' : '') + (h.menu ? '<span class="kc-menu" style="display:block;font-size:9px;line-height:1;color:' + (h.menu === 'DISETUJUI' ? '#2e7d32' : '#e65100') + ';">●</span>' : '') + '</button>';
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
      '<div id="kcInfo" style="font-size:12.5px;margin-top:8px;padding-top:8px;border-top:1px solid var(--color-border,#e8ebef);">' +
      (h.pm ? 'PM harian: <b>' + Number(h.pm.total).toLocaleString('id-ID') + '</b> porsi · ' + h.pm.instansi + ' instansi' : '<span style="color:var(--color-text-muted,#55606f);">' + (h.status === 'LIBUR' ? 'Libur — tidak ada PM.' : 'Belum ada PM harian terverifikasi.') + '</span>') +
      '<div>Menu: ' + (h.menu ? (h.menu === 'DISETUJUI' ? '<span style="color:#2e7d32;">disetujui</span>' : '<span style="color:#e65100;">draf</span>') : '<span style="color:var(--color-text-muted,#55606f);">belum ada</span>') + '</div></div>' +
      (!h.adaPeriode ? '' : '') +
      (boleh ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border,#e8ebef);"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;"><select id="kcStatus" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;">' +
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
    const awal = isoLokal(new Date(tahun, bulan, 1)), akhir = isoLokal(new Date(tahun, bulan + 1, 0));
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
    const d = dariIso(hariIni); tahun = d.getFullYear(); bulan = d.getMonth(); terpilih = hariIni;
    root.innerHTML = '<div class="empty-state">Memuat…</div>';
    kerangka();
    try { divisi = await apiGet('getDivisi', { token: ambilSesiAdmin().token }); if (!Array.isArray(divisi)) divisi = []; } catch (e) { divisi = []; }
    await muat(); gambarMassal();
  }
  const tombol = document.querySelector('[data-panel="panelKalenderOperasional"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudah) { sudah = true; mulaiPanel(); } else { muat(); } });
})();

// SPPG JEUNGJING — ADMIN: SIPANDU › Manajemen Menu (panelSipanduMenu). BARU 4 Nov 2026 (Blueprint §10.4).
// Menu harian per TANGGAL (6 komponen) + "Lihat Menu Satu Minggu". Hari libur ditampilkan sebagai libur, bukan menu kosong.
// Hanya menu DISETUJUI yang tampil di dashboard & website. Backend: SipanduV2.gs (getMenuMingguV2, getMenuHarianV2, simpanMenuHarianV2).
(function () {
  const panel = document.getElementById('panelSipanduMenu'); if (!panel) return;
  const root = document.getElementById('smmRoot');
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const geser = function (iso, n) { const p = iso.split('-').map(Number); return isoLokal(new Date(p[0], p[1] - 1, p[2] + n)); };
  const tglIndo = function (iso) { return iso.split('-').reverse().join('/'); };
  const senin = function () { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoLokal(d); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const KOMP = [['karbohidrat', 'Karbohidrat'], ['laukHewani', 'Lauk Hewani'], ['laukNabati', 'Lauk Nabati'], ['sayur', 'Sayur'], ['buah', 'Buah'], ['perlengkapan', 'Perlengkapan / Finishing']];
  const BADGE = { OPERASIONAL: ['Operasional', '#2e7d32'], LIBUR: ['Libur', '#ef6c00'], OPERASIONAL_KHUSUS: ['Operasional Khusus', '#1565c0'], BELUM_DIATUR: ['Belum diatur', '#757575'] };
  let mulai = senin(), terpilih = '', saran = {}, sudah = false;

  function pesan(t, g) { const el = $('smmPesan'); if (el) { el.textContent = t || ''; el.style.color = g ? '#c0392b' : '#2e7d32'; } }
  const badge = function (k) { const b = BADGE[k.status] || BADGE.BELUM_DIATUR; return '<span style="background:' + b[1] + ';color:#fff;border-radius:10px;padding:2px 8px;font-size:11px;white-space:nowrap;">' + b[0] + '</span>' + (k.divisiKhusus ? ' <span style="font-size:11px;color:#1565c0;">' + esc(k.divisiKhusus) + '</span>' : ''); };

  function kerangka() {
    root.innerHTML =
      '<div class="filter-bar"><button class="btn-mini" id="smmMundur" type="button">◀ Minggu lalu</button><label style="font-size:12px;">Mulai <input type="date" id="smmMulai"></label>' +
      '<button class="btn-mini" id="smmMaju" type="button">Minggu depan ▶</button><button class="btn-mini primary" id="smmTampil" type="button">Tampilkan</button><span id="smmRentang" style="font-size:12px;color:var(--color-text-muted,#55606f);"></span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Kalender</th><th>Menu</th><th>Status menu</th><th></th></tr></thead><tbody id="smmMinggu"></tbody></table></div>' +
      '<div id="smmForm"></div><div id="smmPesan" style="font-size:13px;margin:8px 0;"></div>' +
      '<datalist id="smmDlKarbohidrat"></datalist><datalist id="smmDlLaukHewani"></datalist><datalist id="smmDlLaukNabati"></datalist><datalist id="smmDlSayur"></datalist><datalist id="smmDlBuah"></datalist><datalist id="smmDlPerlengkapan"></datalist>';
    $('smmMulai').value = mulai;
    $('smmTampil').addEventListener('click', function () { mulai = $('smmMulai').value; muatMinggu(); });
    $('smmMundur').addEventListener('click', function () { mulai = geser($('smmMulai').value || mulai, -7); $('smmMulai').value = mulai; muatMinggu(); });
    $('smmMaju').addEventListener('click', function () { mulai = geser($('smmMulai').value || mulai, 7); $('smmMulai').value = mulai; muatMinggu(); });
    $('smmMinggu').addEventListener('click', function (e) { const b = e.target.closest('button[data-t]'); if (b) bukaHari(b.dataset.t); });
  }

  async function muatMinggu() {
    try {
      const m = await api('getMenuMingguV2', { tanggalMulai: mulai });
      $('smmRentang').textContent = tglIndo(m.tanggalMulai) + ' – ' + tglIndo(m.tanggalAkhir) + ' (7 hari kalender)';
      $('smmMinggu').innerHTML = m.hari.map(function (h) {
        const libur = h.kalender.status === 'LIBUR';
        const isi = h.menu ? KOMP.map(function (k) { return h.menu[k[0]]; }).filter(Boolean).join(', ') : '';
        return '<tr' + (h.tanggal === terpilih ? ' style="background:var(--color-surface,#f6f8fb);"' : '') + '><td><b>' + esc(h.hari) + '</b><div style="font-size:11px;color:var(--color-text-muted,#55606f);">' + tglIndo(h.tanggal) + '</div></td><td>' + badge(h.kalender) + (h.kalender.keterangan ? '<div style="font-size:11px;">' + esc(h.kalender.keterangan) + '</div>' : '') + '</td>' +
          '<td style="font-size:12.5px;">' + (isi ? esc(isi) : (libur ? '<i style="color:#ef6c00;">Libur — tidak perlu menu</i>' : '<span style="color:var(--color-text-muted,#55606f);">belum ada menu</span>')) + '</td>' +
          '<td>' + (h.menu ? (h.menu.status === 'DISETUJUI' ? '<span style="color:#2e7d32;font-weight:700;">Disetujui</span>' : '<span style="color:#ef6c00;">Draf</span>') : '—') + '</td>' +
          '<td><button class="btn-mini" data-t="' + h.tanggal + '" type="button">' + (h.menu ? 'Ubah' : 'Buat') + '</button></td></tr>';
      }).join('');
    } catch (err) { pesan(err.message || 'Gagal memuat menu.', true); }
  }

  async function bukaHari(iso) {
    terpilih = iso; await muatMinggu();
    try {
      const d = await api('getMenuHarianV2', { tanggal: iso });
      const m = d.menu || { status: 'DRAFT', keterangan: '' };
      const field = function (k) {
        return '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">' + k[1] + '<input id="smm_' + k[0] + '" list="smmDl' + k[0].charAt(0).toUpperCase() + k[0].slice(1) + '" maxlength="120" value="' + esc(m[k[0]] || '') + '" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;"></label>';
      };
      $('smmForm').innerHTML = '<div class="admin-stat-card" style="padding:14px;text-align:left;margin:12px 0;"><b>' + esc(d.hari) + ', ' + tglIndo(iso) + '</b> ' + badge(d.kalender) +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:12px 0;">' + KOMP.map(field).join('') + '</div>' +
        '<label style="font-size:12px;display:block;margin-bottom:10px;">Keterangan (opsional)<input id="smm_keterangan" maxlength="200" value="' + esc(m.keterangan || '') + '" style="width:100%;padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;"></label>' +
        (d.menu && d.menu.status === 'DISETUJUI' ? '<div style="font-size:12px;color:#2e7d32;margin-bottom:8px;">Disetujui oleh ' + esc(d.menu.disetujuiOleh) + ' pada ' + esc(d.menu.disetujuiPada) + '. Menyimpan sebagai Draf akan mencabut persetujuan.</div>' : '') +
        '<button class="btn-mini" id="smmDraf" type="button">Simpan sebagai Draf</button> <button class="btn-mini primary" id="smmSetuju" type="button">Simpan &amp; Setujui</button> <button class="btn-mini" id="smmBatal" type="button">Tutup</button></div>';
      Object.keys(saran).forEach(function (k) { const dl = $('smmDl' + k.charAt(0).toUpperCase() + k.slice(1)); if (dl) dl.innerHTML = saran[k].map(function (v) { return '<option value="' + esc(v) + '">'; }).join(''); });
      $('smmBatal').addEventListener('click', function () { terpilih = ''; $('smmForm').innerHTML = ''; muatMinggu(); });
      $('smmDraf').addEventListener('click', function () { simpan(iso, 'DRAFT'); }); $('smmSetuju').addEventListener('click', function () { simpan(iso, 'DISETUJUI'); });
      pesan('');
    } catch (err) { pesan(err.message || 'Gagal membuka menu.', true); }
  }
  async function simpan(iso, status) {
    const payload = { tanggal: iso, status: status, keterangan: $('smm_keterangan').value };
    KOMP.forEach(function (k) { payload[k[0]] = $('smm_' + k[0]).value; });
    try {
      pesan('Menyimpan…'); const h = await api('simpanMenuHarianV2', payload);
      await muatMinggu(); await bukaHari(iso);
      pesan((status === 'DISETUJUI' ? 'Menu disetujui dan tampil di dashboard & website.' : 'Draf tersimpan.') + (h.peringatan ? ' Perhatian: ' + h.peringatan : ''), false);
    } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
  }

  async function mulaiPanel() {
    try {
      root.innerHTML = '<div class="empty-state">Memuat…</div>';
      const st = await api('getStatusSipanduV2');
      if (!st.terhubung) { root.innerHTML = '<div class="admin-stat-card accent-warning" style="padding:16px;text-align:left;"><b>Database SIPANDU baru belum disambungkan</b><div style="font-size:13px;margin-top:6px;">' + esc(st.pesan || '') + ' Sambungkan lewat menu Master Instansi &amp; PIC (panduan langkahnya ada di sana), lalu muat ulang.</div></div>'; return; }
      kerangka(); try { saran = await api('getSaranMenuV2'); } catch (e) { saran = {}; } await muatMinggu();
    } catch (err) { root.innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div>'; }
  }
  const tombol = document.querySelector('[data-panel="panelSipanduMenu"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudah) { sudah = true; mulaiPanel(); } });
})();

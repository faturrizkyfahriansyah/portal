// SPPG JEUNGJING — SIPIKA: Pemutakhiran Data (Admin, 28 Nov 2026, paket 28c).
// Dulu bagian dari halaman Pendataan BNBA; kini menu sendiri. Mengatur putaran pemutakhiran dan batas otomatis, dan menunjukkan
// posyandu mana yang datanya belum diperbarui PIC. Memakai endpoint yang sama (getPosyandu3BAdmin, simpanPengaturan3BAdmin).
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const panel = $('panelPemutakhiran'); if (!panel) return;
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: window.sppgAdminToken }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  const dmy = function (iso) { const s = String(iso || '').slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : ''; };
  const angka = function (n) { return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  let data = null;

  if (!$('pmGaya')) { const st = document.createElement('style'); st.id = 'pmGaya'; st.textContent =
    '.pm-atas{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:0 0 14px}'
    + '.pm-kartu{border:1px solid var(--color-border,#d5dbe3);border-radius:14px;padding:16px 18px;margin:0 0 14px;background:var(--color-surface-raised,#fff)}'
    + '.pm-kartu h3{margin:0;font-size:15px}.pm-kartu .pm-d{font-size:13px;color:var(--color-text-muted,#55606f);margin:3px 0 0;max-width:70ch}'
    + '.pm-form{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}.pm-form input[type=text]{flex:1;min-width:220px;padding:9px 11px;border:1px solid var(--color-border,#d5dbe3);border-radius:10px}'
    + '.pm-form input[type=number]{width:84px;padding:9px 11px;border:1px solid var(--color-border,#d5dbe3);border-radius:10px}'
    + '.pm-daftar{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-top:12px}'
    + '.pm-p{border:1px solid var(--color-border,#d5dbe3);border-radius:12px;padding:12px 14px;background:var(--color-surface,#f6f8fb)}.pm-p>b{display:block}.pm-p small{color:var(--color-text-muted,#55606f)}'
    + '.pm-bar{height:8px;border-radius:99px;background:#E8EEF4;overflow:hidden;margin:8px 0 4px}.pm-bar i{display:block;height:100%;background:#1E8E5A}.pm-bar.kurang i{background:#D9822B}'
    + '.pm-kosong{border:1px dashed var(--color-border,#d5dbe3);border-radius:12px;padding:18px;text-align:center;color:var(--color-text-muted,#55606f);margin-top:12px}';
    document.head.appendChild(st); }

  panel.innerHTML = '<div class="shell-page-head"><div><h2 class="shell-page-title">Pemutakhiran Data</h2><p class="shell-page-sub">Minta PIC memperbarui data penerima manfaat secara berkala. Data yang belum diperbarui ditandai di layar PIC.</p></div></div>'
    + '<div class="pm-atas" id="pmAtas"></div><div id="pmIsi"><p class="pg-sub">Memuat…</p></div>';

  async function muat() {
    try { data = await api('getPosyandu3BAdmin'); } catch (e) { $('pmIsi').innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    gambar();
  }
  function kotak(judul, nilai, sub) { return '<div class="pg-kotak"><div class="pg-kotak-j">' + judul + '</div><div class="pg-kotak-n">' + nilai + '</div>' + (sub ? '<div class="pg-kotak-s">' + sub + '</div>' : '') + '</div>'; }
  function gambar() {
    const p = data.pengaturan, aktif = data.posyandu.filter(function (x) { return x.aktif; });
    const perlu = aktif.reduce(function (a, x) { return a + x.jumlah.perluDiperbarui; }, 0), total = aktif.reduce(function (a, x) { return a + x.jumlah.total; }, 0);
    const tempat = aktif.filter(function (x) { return x.jumlah.perluDiperbarui > 0; });
    $('pmAtas').innerHTML = kotak('Putaran', p.putaranTanggal ? 'Aktif' : 'Tidak ada', p.putaranTanggal ? 'sejak ' + dmy(p.putaranTanggal) : 'belum dimulai')
      + kotak('Perlu diperbarui', angka(perlu), 'dari ' + angka(total) + ' data')
      + kotak('Posyandu terkait', tempat.length, 'dari ' + aktif.length + ' posyandu aktif')
      + kotak('Batas otomatis', p.batasBulan > 0 ? p.batasBulan + ' bulan' : 'Tidak dipakai', 'data lebih lama ditandai');
    let h = '<div class="pm-kartu"><h3>Putaran pemutakhiran</h3><p class="pm-d">'
      + (p.putaranTanggal ? '<b>Putaran AKTIF</b> sejak ' + dmy(p.putaranTanggal) + (p.putaranCatatan ? ': “' + esc(p.putaranCatatan) + '”' : '') + '. Data yang belum diperbarui sejak tanggal itu ditandai “perlu diperbarui” di layar PIC.'
        : 'Tidak ada putaran aktif. Tekan “Mulai putaran” agar semua PIC memperbarui data. Data yang belum disentuh sejak hari ini akan ditandai.') + '</p>'
      + '<div class="pm-form"><input type="text" id="pmCat" maxlength="200" placeholder="Catatan untuk PIC (mis. batas waktu)"><button type="button" class="btn-mini primary" id="pmMulai">Mulai putaran</button>' + (p.putaranTanggal ? '<button type="button" class="btn-mini" id="pmAkhiri">Akhiri putaran</button>' : '') + '</div></div>';
    h += '<div class="pm-kartu"><h3>Batas otomatis</h3><p class="pm-d">Data yang tidak diperbarui lebih lama dari batas ini ditandai “perlu diperbarui” tanpa menunggu putaran. Isi 0 bila tidak dipakai.</p>'
      + '<div class="pm-form"><input type="number" id="pmBln" min="0" max="36" value="' + esc(p.batasBulan) + '"><span>bulan</span><button type="button" class="btn-mini primary" id="pmSimpanBln">Simpan</button></div></div>';
    h += '<div class="pm-kartu"><h3>Posyandu yang perlu diperbarui</h3><p class="pm-d">Berlaku untuk Posyandu (ibu hamil, ibu menyusui, balita). Satuan pendidikan belum memakai putaran.</p>';
    if (!tempat.length) h += '<div class="pm-kosong">' + (total ? 'Semua data posyandu sudah terbarui.' : 'Belum ada data posyandu.') + '</div>';
    else {
      h += '<div class="pm-daftar">' + tempat.slice().sort(function (a, b) { return b.jumlah.perluDiperbarui - a.jumlah.perluDiperbarui; }).map(function (x) {
        const j = x.jumlah, pr = j.total ? Math.round((j.total - j.perluDiperbarui) * 100 / j.total) : 0;
        return '<div class="pm-p"><b>' + esc(x.nama) + '</b><small>' + (x.pic.length ? esc(x.pic.map(function (c) { return c.nama; }).join(', ')) : 'Belum ada PIC') + '</small>'
          + '<div class="pm-bar kurang"><i style="width:' + pr + '%"></i></div><small><b>' + j.perluDiperbarui + '</b> dari ' + j.total + ' data perlu diperbarui · ' + pr + '% terbarui</small></div>';
      }).join('') + '</div>';
    }
    h += '<div class="pm-form"><button type="button" class="btn-mini" id="pmBuka">Buka Pendataan BNBA</button></div></div>';
    $('pmIsi').innerHTML = h;
    $('pmMulai').addEventListener('click', async function () {
      if (!confirm('Mulai putaran pemutakhiran? Semua data yang belum diperbarui sejak hari ini akan ditandai di layar PIC.')) return;
      try { await api('simpanPengaturan3BAdmin', { mulaiPutaran: true, catatan: $('pmCat').value }); info('Putaran dimulai.'); } catch (e) { lapor(e.message); } muat(); });
    if ($('pmAkhiri')) $('pmAkhiri').addEventListener('click', async function () { try { await api('simpanPengaturan3BAdmin', { akhiriPutaran: true }); info('Putaran diakhiri.'); } catch (e) { lapor(e.message); } muat(); });
    $('pmSimpanBln').addEventListener('click', async function () { try { await api('simpanPengaturan3BAdmin', { batasBulan: Number($('pmBln').value) }); info('Disimpan.'); } catch (e) { lapor(e.message); } muat(); });
    $('pmBuka').addEventListener('click', function () { const t = document.querySelector('[data-panel="panelPendataan3B"]'); if (t) t.click(); });
  }
  muat();
  // muat ulang saat menu dibuka lagi (angka berubah setelah PIC memperbarui)
  const tb = document.querySelector('[data-panel="panelPemutakhiran"]'); if (tb) tb.addEventListener('click', function () { if (data) muat(); });
})();

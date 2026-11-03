// SPPG JEUNGJING — ADMIN: Kalender Operasional › data PM HARIAN (BARU 4 Nov 2026, Blueprint §11.1).
// Kalender menampilkan total PM per tanggal dan, saat tanggal diklik, rincian PM + menu. Sumber = PM HARIAN (SIPANDU baru),
// BUKAN kolom acuan. Dipanggil dari admin.js lewat dua pengait (window.sppgKalenderIsiTotalPm / sppgKalenderTambahPm).
// Bila database SIPANDU belum tersambung, kalender tampil seperti biasa tanpa angka PM (tidak ada galat).
(function () {
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  const dmyIso = function (d) { const p = d.split('/'); return p[2] + '-' + p[1] + '-' + p[0]; };
  const singkat = function (n) { return n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'rb' : String(n); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  let cache = { kunci: '', waktu: 0, peta: {} }, mati = false;   // mati = SIPANDU belum tersambung: berhenti bertanya

  window.sppgKalenderIsiTotalPm = async function (listDmy) {
    if (mati || !listDmy || !listDmy.length) return;
    try {
      const iso = listDmy.map(dmyIso).sort(), kunci = iso[0] + '|' + iso[iso.length - 1];
      if (cache.kunci !== kunci || Date.now() - cache.waktu > 60000) {
        const r = await api('getRingkasanPmV2', { tanggalAwal: iso[0], tanggalAkhir: iso[iso.length - 1] });
        const peta = {}; r.ringkasan.forEach(function (x) { peta[x.tanggal] = x; });
        cache = { kunci: kunci, waktu: Date.now(), peta: peta };
      }
      document.querySelectorAll('.kal-sel-tanggal').forEach(function (btn) {
        const x = cache.peta[dmyIso(btn.dataset.dmy)];
        if (!x || btn.querySelector('.kal-pm')) return;
        btn.insertAdjacentHTML('beforeend', '<span class="kal-pm" title="Total PM ' + f(x.total) + ' porsi · ' + x.jumlahInstansi + ' instansi" style="display:block;font-size:9.5px;line-height:1;margin-top:2px;font-weight:600;">' + singkat(x.total) + '</span>');
      });
    } catch (err) { if (/SIPANDU_V2_BELUM_DISAMBUNGKAN|belum disambungkan/i.test(String(err.message))) mati = true; }
  };

  window.sppgKalenderTambahPm = async function (dmy, elDetail) {
    if (mati || !elDetail) return;
    const iso = dmyIso(dmy), kotak = document.createElement('div');
    kotak.dataset.pmTanggal = iso; kotak.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid var(--color-border,#e8ebef);font-size:12.5px;';
    kotak.innerHTML = '<span style="color:var(--color-text-muted,#55606f);">Memuat data PM…</span>';
    elDetail.appendChild(kotak);
    try {
      const [pm, menu] = await Promise.all([api('getPmHarianV2', { tanggal: iso }), api('getMenuHarianV2', { tanggal: iso }).catch(function () { return null; })]);
      if (!document.body.contains(kotak)) return;   // pengguna sudah berpindah tanggal
      let html = '<div style="font-weight:700;margin-bottom:6px;">Penerima Manfaat (PM Harian)</div>';
      if (!pm.header) html += '<div style="color:var(--color-text-muted,#55606f);">Belum ada PM harian terverifikasi untuk tanggal ini.</div>';
      else {
        const t = pm.total, terisi = pm.baris.filter(function (b) { return b.total !== null; });
        html += '<div><b>' + f(t.porsi) + '</b> porsi · ' + t.instansiTerisi + ' instansi</div>' +
          '<div style="margin:4px 0;">PK ' + f(t.pk) + ' · PB ' + f(t.pb) + ' · Ibu Hamil ' + f(t.bumil) + ' · Ibu Menyusui ' + f(t.busui) + ' · Balita ' + f(t.balita) + '</div>' +
          '<details style="margin-top:4px;"><summary style="cursor:pointer;">Daftar instansi (' + terisi.length + ')</summary><div style="margin-top:4px;">' +
          terisi.map(function (b) { return '<div style="display:flex;justify-content:space-between;gap:8px;"><span>' + esc(b.nama) + '</span><b>' + f(b.total) + '</b></div>'; }).join('') + '</div></details>' +
          '<div style="font-size:11px;color:var(--color-text-muted,#55606f);margin-top:4px;">Dikonfirmasi oleh ' + esc(pm.header.dikonfirmasiOleh || '—') + (pm.header.dikonfirmasiPada ? ' · ' + esc(pm.header.dikonfirmasiPada) : '') + '</div>';
      }
      if (menu && menu.menu) {
        const m = menu.menu, isi = [m.karbohidrat, m.laukHewani, m.laukNabati, m.sayur, m.buah, m.perlengkapan].filter(Boolean).join(', ');
        html += '<div style="font-weight:700;margin:10px 0 4px;">Menu</div><div>' + esc(isi) + ' <span style="font-size:11px;color:' + (m.status === 'DISETUJUI' ? '#2e7d32' : '#e65100') + ';">(' + (m.status === 'DISETUJUI' ? 'disetujui' : 'draf') + ')</span></div>';
      }
      kotak.innerHTML = html;
    } catch (err) {
      if (/SIPANDU_V2_BELUM_DISAMBUNGKAN|belum disambungkan/i.test(String(err.message))) { mati = true; kotak.remove(); }
      else kotak.innerHTML = '<span style="color:var(--color-text-muted,#55606f);">Data PM tidak tersedia.</span>';
    }
  };
})();

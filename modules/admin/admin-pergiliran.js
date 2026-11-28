// SPPG JEUNGJING — SIMSDM: Kebutuhan Tenaga dan Pergiliran (22 Nov 2026, Tahap 3).
// TAHAP 1 dari alur dua tahap kewenangan: SIMSDM menyusun kebutuhan, menganalisis PM, membuat rekomendasi, dan MENGAJUKAN. Penetapan resmi oleh SIKOP (menu "Penetapan Pergiliran").
// Layar ini TIDAK mengubah jadwal/roster. Semua aturan keselamatan (minimum, jabatan wajib, shift) ditegakkan SERVER.
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const dmy = function (iso) { return String(iso || '').split('-').reverse().join('/'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dari = function (iso) { const p = iso.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); };
  const minggu = function (iso) { const d = dari(iso); d.setDate(d.getDate() - d.getDay()); return isoLokal(d); };
  const rp = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
  const angka = function (n) { return n === null || n === undefined || n === '' ? '–' : Number(n).toLocaleString('id-ID'); };
  const panel = $('panelPergiliran'); if (!panel) return;
  const tok = function () { return window.sppgAdminToken; };
  const S = { awal: isoLokal(new Date()), n: 1, buka: {}, hasil: null, daftar: [], batch: null, masalah: [], validasi: null, keb: null };
  const geserIso = function (iso, n) { const d = dari(iso); d.setDate(d.getDate() + n); return isoLokal(d); };
  const namaHari = function (iso) { return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dari(iso).getDay()]; };
  const kunci = function (d) { return d.tanggal + '|' + d.idRelawan; };
  const TAB = [['rencana', 'Rencana'], ['riwayat', 'Riwayat'], ['kebutuhan', 'Pengaturan']];
  if (!document.getElementById('pgGaya')) { const st = document.createElement('style'); st.id = 'pgGaya'; st.textContent =
    '.pg-atas{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0 12px}'
    + '.pg-kartu{border:1px solid var(--color-border,#d5dbe3);border-radius:12px;padding:14px 16px;margin:0 0 12px;background:var(--color-surface-raised,#fff)}'
    + '.pg-kartu-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}'
    + '.pg-kartu-j{font-size:15px;font-weight:700;margin:0}.pg-kartu-d{font-size:12.5px;color:var(--color-text-muted,#55606f);margin:2px 0 0;max-width:62ch}'
    + '.pg-kartu-b{margin-top:10px}.pg-sakelar{display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer}.pg-sakelar input{width:20px;height:20px}'
    + '.pg-langkah{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 10px}.pg-langkah span{border:1px solid var(--color-border,#d5dbe3);border-radius:999px;padding:2px 10px;font-size:12.5px;color:var(--color-text-muted,#55606f)}'
    + '.pg-lencana{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}.pg-lencana.ok{background:#e6f4ea;color:#1e6b34}.pg-lencana.err{background:#fde8e6;color:#b3261e}.pg-lencana.wait{background:#fff4e0;color:#8a5a00}'
    + '.pg-kosong{border:1px dashed var(--color-border,#d5dbe3);border-radius:12px;padding:18px;text-align:center;color:var(--color-text-muted,#55606f)}';
    document.head.appendChild(st); }

  panel.innerHTML = '<div class="shell-page-head"><div><h2 class="shell-page-title">Pergiliran</h2><p class="shell-page-sub">Hitung siapa libur bergilir, lalu ajukan ke SIKOP. Jadwal berubah setelah SIKOP menetapkan.</p></div></div>'
    + '<div class="pg-atas" id="pgAtas"></div>'
    + '<div class="pg-tabs">' + TAB.map(function (t, i) { return '<button type="button" class="btn-mini' + (i === 0 ? ' primary' : '') + '" data-pg="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>'
    + TAB.map(function (t, i) { return '<div id="pg_' + t[0] + '" class="panel-block"' + (i ? ' style="display:none"' : '') + '></div>'; }).join('');
  panel.querySelectorAll('[data-pg]').forEach(function (b) { b.addEventListener('click', function () {
    panel.querySelectorAll('[data-pg]').forEach(function (x) { x.classList.toggle('primary', x === b); });
    TAB.forEach(function (t) { $('pg_' + t[0]).style.display = t[0] === b.dataset.pg ? '' : 'none'; });
    ({ kebutuhan: muatKebutuhan, rencana: muatRencana, riwayat: muatRiwayat })[b.dataset.pg](); muatAtas();
  }); });
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: tok() }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  const sibuk = async function (teks, fn) { try { if (typeof showLoading === 'function') showLoading(teks); return await fn(); } finally { if (typeof hideLoading === 'function') hideLoading(); } };
  const kotakAtas = function (judul, nilai, sub) { return '<div class="pg-kotak"><div class="pg-kotak-j">' + judul + '</div><div class="pg-kotak-n">' + nilai + '</div>' + (sub ? '<div class="pg-kotak-s">' + sub + '</div>' : '') + '</div>'; };

  /* ---------------- RINGKASAN DI ATAS (pengaturan yang berlaku + antrean) ---------------- */
  async function muatAtas() {
    const el = $('pgAtas'); if (!el) return;
    const [k, s, r] = await Promise.all([api('getKebutuhanTenagaAdmin').catch(function () { return null; }), api('getStandarPitaAdmin').catch(function () { return null; }), api('getRiwayatPergiliran', {}).catch(function () { return null; })]);
    const ag = (k && k.anggaran) || null, kot = [];
    if (s && s.saklar) kot.push(kotakAtas('Standar pita PM', s.saklar.pergiliran ? 'Nyala' : 'Mati', s.sumber === 'SHEET' ? 'tabel diubah Admin' : 'tabel bawaan'));
    if (ag) kot.push(kotakAtas('Dana per PM', rp(ag.danaPerPm), 'dana harian = PM × ini'), kotakAtas('Koordinator', ag.koordLibur === true ? 'Boleh libur' : 'Tetap masuk', ''), kotakAtas('Ratakan upah', ag.adilGeser > 0 ? 'maks. ' + ag.adilGeser + ' orang' : 'Mati', 'per divisi per hari'));
    if (r && r.ringkas) kot.push(kotakAtas('Menunggu SIKOP', r.ringkas.DIAJUKAN + r.ringkas.REKOMENDASI, 'libur diajukan'), kotakAtas('Sudah ditetapkan', r.ringkas.DITETAPKAN, 'libur'));
    el.innerHTML = kot.join('');
  }

  /* ---------------- PENGATURAN: lima kartu (standar, dana, koordinator, ratakan upah, kalkulator) ---------------- */
  async function muatKebutuhan() {
    const el = $('pg_kebutuhan'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let k; try { k = await api('getKebutuhanTenagaAdmin'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    S.keb = k;
    const ag = k.anggaran || { danaPerPm: 3000, kebOpsHarian: 1000000, kebOpsMinimum: 750000, tanpaBatas: true, asDriverPm: 1500, aktif: false };
    const kartu = function (judul, desk, kanan, isi, id) { return '<div class="pg-kartu"' + (id ? ' id="' + id + '"' : '') + '><div class="pg-kartu-h"><div><h4 class="pg-kartu-j">' + judul + '</h4><div class="pg-kartu-d">' + desk + '</div></div>' + (kanan || '') + '</div>' + (isi ? '<div class="pg-kartu-b">' + isi + '</div>' : '') + '</div>'; };
    el.innerHTML = '<div class="pg-kartu" id="pgStandar"></div>'
      + kartu('Dana per PM', 'Dana harian = PM × angka ini. Dipakai untuk menghitung sisa operasional.', '',
        '<div class="pg-form"><label>Dana per PM (Rp) <input type="number" min="1" inputmode="numeric" id="pgAgPm" value="' + esc(ag.danaPerPm) + '"></label><div style="align-self:end"><button type="button" class="btn-mini primary" id="pgAgSimpan">Simpan</button></div></div>'
        + '<details id="pgAgBox" style="margin-top:8px"><summary>Batas operasional <span class="pg-sub">(dipakai bila Standar pita PM mati)</span></summary><div class="pg-form" style="margin-top:8px">'
        + '<label>Operasional aman per hari (Rp) <input type="number" min="0" inputmode="numeric" id="pgAgOps" value="' + esc(ag.kebOpsHarian) + '"></label>'
        + '<label>Operasional minimum per hari (Rp) <input type="number" min="0" inputmode="numeric" id="pgAgMin" value="' + esc(ag.kebOpsMinimum) + '"></label>'
        + '<label>Asisten Driver libur bila PM di bawah (0 = mati) <input type="number" min="0" inputmode="numeric" id="pgAgAsd" value="' + esc(ag.asDriverPm) + '"></label></div></details>', 'pgKartuDana')
      + kartu('Koordinator tetap masuk', 'Koordinator tidak ikut libur bergilir. Matikan bila koordinator juga boleh bergilir.',
        '<label class="pg-sakelar"><input type="checkbox" id="pgAdilKoord"' + (ag.koordLibur === true ? '' : ' checked') + '> <span id="pgAdilKoordTeks">' + (ag.koordLibur === true ? 'Boleh libur' : 'Tetap masuk') + '</span></label>', '', 'pgKartuKoord')
      + kartu('Ratakan upah antar divisi', 'Divisi yang liburnya lebih sedikit diberi lebih banyak libur supaya upah antar divisi rata. Isi 0 untuk mematikan (maksimal 5 orang per divisi per hari).', '',
        '<div class="pg-form" id="pgAdilBox"><label>Geser maksimal (orang per hari) <input type="number" min="0" max="5" inputmode="numeric" id="pgAdilGeser" value="' + esc(ag.adilGeser === undefined ? 3 : ag.adilGeser) + '"></label><div style="align-self:end"><button type="button" class="btn-mini primary" id="pgAdilSimpan">Simpan</button></div></div>', 'pgKartuAdil')
      + kartu('Kalkulator PM', 'Coba satu angka PM: berapa orang masuk, biaya relawan, dan sisa operasional.', '',
        '<div class="pg-bar"><label>PM <input type="number" min="1" id="pgStdPm" placeholder="mis. 1900"></label><label>Insentif PIC hari itu (Rp, kosongkan = perkiraan) <input type="number" min="0" id="pgStdPic"></label><button type="button" class="btn-mini primary" id="pgStdGo">Hitung</button></div><div id="pgStdHasil"></div>', 'pgStdHitung');
    muatStandar(); muatAtas();
    const simpanAdil = function (koordLibur, geser) { return sibuk('Menyimpan…', function () { return api('simpanPengaturanAdilPergiliran', { koordinatorLibur: koordLibur, adilGeser: geser }); }); };
    $('pgAdilKoord').addEventListener('change', async function () {
      const kotak = this, v = kotak.checked;
      try { await simpanAdil(!v, ag.adilGeser === undefined ? 3 : ag.adilGeser); info(v ? 'Koordinator tetap masuk.' : 'Koordinator boleh ikut libur bergilir.'); muatKebutuhan(); } catch (e) { kotak.checked = !v; lapor(e.message); }
    });
    $('pgAdilSimpan').addEventListener('click', async function () {
      try { await simpanAdil(!$('pgAdilKoord').checked, $('pgAdilGeser').value); info('Tersimpan. Hitung ulang rekomendasi agar berlaku.'); muatKebutuhan(); } catch (e) { lapor(e.message); }
    });
    $('pgAgSimpan').addEventListener('click', async function () {
      try { await sibuk('Menyimpan…', function () { return api('simpanPengaturanAnggaranPergiliran', { danaPerPm: $('pgAgPm').value, kebOpsHarian: $('pgAgOps').value, kebOpsMinimum: $('pgAgMin').value, tanpaBatas: true, pmAsistenDriverLibur: $('pgAgAsd').value }); }); info('Tersimpan.'); muatKebutuhan(); } catch (e) { lapor(e.message); }
    });
    $('pgStdGo').addEventListener('click', async function () {
      const out = $('pgStdHasil'), pm = $('pgStdPm').value.trim(), pic = $('pgStdPic').value.trim();
      if (!/^\d+$/.test(pm)) { out.innerHTML = '<p class="pg-err">Isi PM dengan angka bulat.</p>'; return; }
      let d; try { d = await sibuk('Menghitung…', function () { return api('hitungStandarPmAdmin', { pm: Number(pm), pic: pic === '' ? '' : Number(pic) }); }); } catch (e) { out.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
      if (!d.tersedia) { out.innerHTML = '<div class="pg-warn">' + esc(d.pesan) + '</div>'; return; }
      const stt = { AMAN: ['Aman', 'pg-ok'], WASPADA: ['Waspada', 'pg-wait'], MERAH: ['Merah (di bawah minimum)', 'pg-err'] }[d.status];
      out.innerHTML = '<div class="dp-chips" style="margin:8px 0"><span class="dp-chip"><b>' + esc(d.pita) + '</b>pita PM</span><span class="dp-chip"><b>' + String(d.persen).replace('.', ',') + '%</b>tarif dari Master</span><span class="dp-chip"><b>' + d.masuk + '</b>masuk</span><span class="dp-chip"><b>' + d.libur + '</b>libur</span></div>'
        + '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Divisi bergilir</th><th>Terdaftar</th><th>Standar masuk</th><th>Libur</th><th>Biaya</th></tr></thead><tbody>' + d.perDivisi.map(function (x) { return '<tr><td>' + esc(x.divisi) + '</td><td>' + x.terdaftar + '</td><td>' + x.standar + '</td><td>' + x.libur + '</td><td>' + rp(x.biaya) + '</td></tr>'; }).join('') + '</tbody></table></div>'
        + '<p class="pg-sub">Divisi tetap: ' + d.divisiTetap + ' orang' + (d.asistenDriverLibur ? ' (Asisten Driver libur ' + d.asistenDriverLibur + ')' : '') + '.</p>'
        + '<p>Dana ' + rp(d.dana) + ' − gaji relawan ' + rp(d.biayaRelawan) + ' − PIC ' + rp(d.pic) + (d.picPerkiraan ? ' <span class="pg-sub">(perkiraan)</span>' : '') + ' = <b>sisa operasional ' + rp(d.sisaOps) + '</b> · garis aman ' + rp(d.aman) + ', minimum ' + rp(d.minimum) + ' → <span class="pg-status ' + stt[1] + '">' + stt[0] + '</span></p>'
        + (d.kelas.length ? '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Tarif Master</th><th>Tarif hari itu</th><th>Orang</th></tr></thead><tbody>' + d.kelas.map(function (c) { return '<tr><td>' + rp(c.master) + (c.flat ? ' <span class="pg-sub">(tetap)</span>' : '') + '</td><td><b>' + rp(c.tarif) + '</b></td><td>' + c.orang + '</td></tr>'; }).join('') + '</tbody></table></div>' : '')
        + (d.tarifMasterDariRekomendasi ? '<p class="pg-sub">Tarif Master = tarif sekarang ÷ 83,3% (persen tarif belum dinyalakan).</p>' : '');
    });
  }
  /* ---------------- STANDAR PITA PM (25p): saklar dan tabel ---------------- */
  const PD = [['P', 'Pemorsian'], ['G', 'Pengolahan'], ['C', 'Cuci Ompreng'], ['S', 'Persiapan']];
  const pitaTeks = function (b) { return b.pitaMaks === null ? angka(b.pitaMin) + ' ke atas' : angka(b.pitaMin) + '–' + angka(b.pitaMaks); };
  let STD = null;
  async function muatStandar() {
    const el = $('pgStandar'); if (!el) return;
    try { STD = await api('getStandarPitaAdmin'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    if (!STD || !STD.saklar || !Array.isArray(STD.baris)) { el.innerHTML = '<p class="pg-sub">StandarPita.gs belum terpasang di Apps Script.</p>'; return; }
    const on = !!STD.saklar.pergiliran;
    el.innerHTML = '<div class="pg-kartu-h"><div><h4 class="pg-kartu-j">Standar pita PM ' + (on ? '<span class="pg-status pg-ok">Nyala</span>' : '<span class="pg-status pg-wait">Mati</span>') + '</h4><div class="pg-kartu-d">Jumlah relawan yang masuk tiap divisi mengikuti tabel menurut besar PM hari itu.' + (STD.anggaranAktif ? '' : ' Menyalakan ini otomatis mengaktifkan perhitungan dana.') + '</div></div>'
      + '<label class="pg-sakelar"><input type="checkbox" id="pgStdOn"' + (on ? ' checked' : '') + '> <span>Pakai standar</span></label></div>'
      + '<details id="pgStdTabel" class="pg-kartu-b"><summary><b>Tabel standar</b> (' + (STD.sumber === 'SHEET' ? 'diubah Admin' : 'bawaan') + ')</summary>'
      + '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>PM dari</th><th>sampai</th>' + PD.map(function (d) { return '<th>' + d[1] + ' masuk<br><span class="pg-sub">aktif ' + (STD.divisi.filter(function (x) { return x.kode === d[0]; })[0] || {}).relawanAktif + '</span></th>'; }).join('') + '<th>Tarif (% Master)</th><th>Operasional aman</th><th>Operasional minimum</th></tr></thead><tbody>'
      + STD.baris.map(function (b, i) { const n = function (k, v, w) { return '<td><input type="number" min="0" data-i="' + i + '" data-k="' + k + '" value="' + v + '" style="width:' + (w || 62) + 'px"></td>'; };
        return '<tr><td><b>' + angka(b.pitaMin) + '</b></td><td>' + (b.pitaMaks === null ? 'ke atas' : angka(b.pitaMaks)) + '</td>' + PD.map(function (d) { return n('m' + d[0], b.masuk[d[0]]); }).join('') + '<td><input type="number" min="1" max="100" step="0.1" data-i="' + i + '" data-k="persen" value="' + b.persen + '" style="width:70px"></td>' + n('aman', b.aman, 100) + n('minimum', b.minimum, 100) + '</tr>'; }).join('')
      + '</tbody></table></div><div class="pg-aksi"><button type="button" class="btn-mini primary" id="pgStdSimpan">Simpan tabel</button><button type="button" class="btn-mini" id="pgStdBawaan"' + (STD.sumber === 'SHEET' ? '' : ' disabled') + '>Kembalikan ke bawaan</button></div>'
      + '</details>';
    $('pgStdOn').addEventListener('change', async function () {
      const v = this.checked, kotak = this;
      try { await sibuk('Menyimpan…', function () { return api('simpanPengaturanStandarAdmin', { pergiliran: v }); }); info(v ? 'Standar pita PM dipakai.' : 'Standar pita PM dimatikan.'); muatKebutuhan(); }
      catch (e) { kotak.checked = !v; lapor(e.message); }
    });
    $('pgStdSimpan').addEventListener('click', async function () {
      const baris = STD.baris.map(function (b) { return { pitaMin: b.pitaMin, pitaMaks: b.pitaMaks, catatan: b.catatan || '', masuk: {}, persen: 0, aman: 0, minimum: 0 }; });
      el.querySelectorAll('input[data-k]').forEach(function (x) { const b = baris[Number(x.dataset.i)], k = x.dataset.k; if (k.charAt(0) === 'm' && k.length === 2) b.masuk[k.charAt(1)] = x.value; else b[k] = x.value; });
      try { await sibuk('Menyimpan tabel…', function () { return api('simpanStandarPitaAdmin', { baris: baris }); }); info('Tabel standar tersimpan.'); await muatStandar(); $('pgStdTabel').open = true; } catch (e) { lapor(e.message); }
    });
    $('pgStdBawaan').addEventListener('click', async function () {
      if (!confirm('Kembalikan tabel standar ke angka bawaan? Perubahan Anda akan hilang.')) return;
      try { await sibuk('Mengembalikan…', function () { return api('kembalikanStandarPitaAdmin', {}); }); info('Tabel kembali ke bawaan.'); muatStandar(); } catch (e) { lapor(e.message); }
    });
  }
  /* ---------------- RENCANA PERGILIRAN ---------------- */
  /** Ringkasan dana satu hari; ikut berubah bila Admin menambah/menghapus libur secara manual. */
  function badgeJadwal(hr) {
    const j = hr.jadwal; if (!hr.operasional || !j) return '';
    if (!j.dibuat) return '<div class="pg-warn">Jadwal hari ini belum dibuat. Buat dulu di Jadwal dan Penugasan, lalu Hitung lagi.</div>';
    return '<div class="pg-sub">' + j.terjadwal + ' terjadwal' + (j.sudahLibur ? ' · ' + j.sudahLibur + ' sudah libur' : '') + (j.sudahAbsen ? ' · ' + j.sudahAbsen + ' sudah absen' : '') + '</div>';
  }
  /** Angka dana satu hari (ikut berubah saat Admin menambah/menghapus libur). null bila tidak dapat dihitung. */
  function hitungAg(hr) {
    const a = hr.anggaran; if (!hr.operasional || !a || hr.tanggal < isoLokal(new Date())) return null;
    const dipilih = S.daftar.filter(function (d) { return d.tanggal === hr.tanggal; });
    let hemat = 0; dipilih.forEach(function (d) { const dv = hr.divisi.filter(function (x) { return x.divisi === d.divisi; })[0], o = dv && dv.daftar.filter(function (x) { return x.id === d.idRelawan; })[0]; hemat += o ? o.tarif : 0; });
    const biaya = a.biayaSebelumLibur - hemat, sisaOps = a.dana - a.insentifPic - biaya, mn = a.kebOpsMin === undefined ? a.kebOps : a.kebOpsMin;
    return { a: a, dipilih: dipilih, biaya: biaya, sisaOps: sisaOps, mn: mn, st: sisaOps >= a.kebOps ? 'AMAN' : (sisaOps >= mn ? 'WASPADA' : 'KURANG') };
  }
  const NAMA_ST = { AMAN: 'Aman', WASPADA: 'Waspada', KURANG: 'KURANG' };
  const WARNA_ST = { AMAN: '#2e7d32', WASPADA: '#e65100', KURANG: '#c0392b' };
  const hariSingkat = function (hr) { return hr.nama.slice(0, 3) + ' ' + dmy(hr.tanggal).slice(0, 5); };
  function stripAnggaran(hr) {
    const g = hitungAg(hr);
    if (!g) return hr.operasional && !hr.anggaran && hr.tanggal >= isoLokal(new Date()) && hr.divisi.some(function (d) { return d.status === 'TAK_TERHITUNG'; }) && S.hasil && S.hasil.hari.some(function (x) { return x.anggaran; }) ? '<div class="pg-warn">PM hari ini belum tersedia: dana tidak dapat dihitung.</div>' : '';
    const a = g.a, dipilih = g.dipilih, biaya = g.biaya, sisaOps = g.sisaOps, mn = g.mn, stOps = g.st;
    return '<div class="pg-ag ' + (stOps === 'KURANG' ? 'minus' : 'aman') + '"><div>Dana ' + rp(a.dana) + ' (PM ' + angka(a.pm) + ' × ' + rp(a.danaPerPm) + ') − PIC ' + rp(a.insentifPic) + ' − operasional aman ' + rp(a.kebOps) + ' = <b>jatah relawan ' + rp(a.jatahRelawan) + '</b></div>'
      + '<div>Biaya relawan bila semua masuk ' + rp(a.biayaSebelumLibur) + (dipilih.length ? ' → ' + rp(biaya) + ' setelah ' + dipilih.length + ' libur' : '') + ' · <b>operasional tersisa ' + rp(sisaOps) + '</b> (' + (stOps === 'AMAN' ? 'aman' : (stOps === 'WASPADA' ? 'di atas minimum ' + rp(mn) + ', di bawah target ' + rp(a.kebOps) : 'KURANG ' + rp(mn - sisaOps) + ' dari minimum ' + rp(mn))) + ')</div>'
      + (a.standar ? '<div class="pg-sub">Standar pita PM <b>' + esc(a.standar.pita) + '</b> · tarif ' + String(a.standar.persen).replace('.', ',') + '%' + (a.standar.tarifPersenAktif ? ' (dipakai)' : ' (belum dipakai di tarif)') + ' · operasional aman ' + rp(a.standar.aman) + ', minimum ' + rp(a.standar.minimum) + (a.standar.bisaDitambah ? ' · dana cukup menambah ' + a.standar.bisaDitambah + ' orang tanpa turun dari garis aman' : '') + '</div>' : '')
      + (hr.pmSumber === 'PEKAN_SEBELUMNYA' ? '<div class="pg-sub">PM belum diisi; memakai PM hari yang sama pekan lalu.</div>' : '')
      + (a.dapatDipulihkan ? '<div class="pg-sub">Dana cukup memanggil kembali ' + a.dapatDipulihkan + ' relawan yang sudah libur.</div>' : '')
      + (stOps !== 'AMAN' && a.pesan ? '<div class="pg-warn">' + esc(a.pesan) + '</div>' : '') + (a.tanpaTarif ? '<div class="pg-warn">' + a.tanpaTarif + ' relawan belum punya tarif di Master Tarif (dihitung Rp0).</div>' : '') + '</div>';
  }
  /** Ringkasan atas untuk seluruh periode: masuk, libur, dana, PIC, gaji relawan, operasional, status. */
  function ringkasanAtas(h) {
    const ops = h.hari.filter(function (x) { return x.operasional; });
    let terjadwal = 0, libur = 0, dana = 0, pic = 0, biaya = 0, sisa = 0, adaDana = 0, urut = ['AMAN', 'WASPADA', 'KURANG'], terburuk = 'AMAN', tanpaJadwal = 0, tanpaDana = 0;
    ops.forEach(function (hr) {
      const jml = hr.jadwal && hr.jadwal.dibuat ? hr.jadwal.terjadwal : 0; if (!jml) tanpaJadwal++;
      terjadwal += jml; libur += S.daftar.filter(function (d) { return d.tanggal === hr.tanggal; }).length;
      const g = hitungAg(hr); if (g) { adaDana++; dana += g.a.dana; pic += g.a.insentifPic; biaya += g.biaya; sisa += g.sisaOps; if (urut.indexOf(g.st) > urut.indexOf(terburuk)) terburuk = g.st; } else if (hr.operasional && hr.tanggal >= isoLokal(new Date())) tanpaDana++;
    });
    const n = ops.length, kotak = function (judul, nilai, sub, warna) { return '<div class="pg-kotak"><div class="pg-kotak-j">' + judul + '</div><div class="pg-kotak-n"' + (warna ? ' style="color:' + warna + '"' : '') + '>' + nilai + '</div>' + (sub ? '<div class="pg-kotak-s">' + sub + '</div>' : '') + '</div>'; };
    let html = '<div class="pg-ringkas">' + kotak('Masuk', terjadwal - libur, n > 1 ? 'orang-hari, ' + n + ' hari kerja' : 'orang') + kotak('Libur bergilir', libur, n > 1 ? 'orang-hari' : 'orang');
    if (adaDana) html += kotak('Dana' + (n > 1 ? ' total' : ''), rp(dana), 'PM × Rp3.000') + kotak('Insentif PIC', rp(pic), '') + kotak('Gaji relawan', rp(biaya), 'setelah libur') + kotak('Operasional tersisa', rp(sisa), '') + kotak('Status', NAMA_ST[terburuk], n > 1 ? 'terburuk dari ' + adaDana + ' hari' : '', WARNA_ST[terburuk]);
    html += '</div>';
    if (tanpaJadwal) html += '<div class="pg-warn">' + tanpaJadwal + ' hari kerja jadwalnya belum dibuat: belum ada nama yang bisa direkomendasikan. Buat jadwal di Jadwal dan Penugasan lalu hitung lagi.</div>';
    if (!adaDana && ops.length && tanpaDana) html += '<div class="pg-warn">Dana belum dapat dihitung (PM belum tersedia atau perhitungan dana belum dipakai).</div>';
    return html;
  }
  /** Satu baris ringkas per hari yang bisa dibuka (rincian nama dan dana). */
  function barisHari(hr, terbuka) {
    const jml = hr.jadwal && hr.jadwal.dibuat ? hr.jadwal.terjadwal : 0, lib = S.daftar.filter(function (d) { return d.tanggal === hr.tanggal; }).length, g = hitungAg(hr);
    const judul = hr.operasional ? '<b>' + esc(hr.nama) + ' ' + dmy(hr.tanggal) + '</b> · ' + (hr.pm !== null ? 'PM ' + angka(hr.pm) + (hr.pmSumber === 'PEKAN_SEBELUMNYA' ? ' (acuan)' : '') : 'PM belum ada') + (jml ? ' · masuk <b>' + (jml - lib) + '</b> · libur <b>' + lib + '</b>' : ' · <span style="color:#c0392b">jadwal belum dibuat</span>') + (g ? ' · ops ' + rp(g.sisaOps) + ' <b style="color:' + WARNA_ST[g.st] + '">' + NAMA_ST[g.st] + '</b>' : '')
      : '<b>' + esc(hr.nama) + ' ' + dmy(hr.tanggal) + '</b> · <i>tidak beroperasi (Kalender)</i>';
    if (!hr.operasional) return '<div class="pg-hari pg-hari-libur">' + judul + '</div>';
    let html = '<details class="pg-hari" data-tgl="' + esc(hr.tanggal) + '"' + (terbuka ? ' open' : '') + '><summary class="pg-hari-judul" style="cursor:pointer">' + judul + '</summary>' + badgeJadwal(hr) + stripAnggaran(hr);
    hr.divisi.forEach(function (dv) {
      const terpilih = S.daftar.filter(function (d) { return d.tanggal === hr.tanggal && d.divisi === dv.divisi; }), sisa = dv.tersedia - terpilih.length;
      const kls = dv.min !== null && sisa < dv.min ? 'merah' : (dv.ideal !== null && sisa < dv.ideal ? 'kuning' : '');
      html += '<div class="pg-div ' + kls + '"><div class="pg-div-head"><b>' + esc(dv.divisi) + '</b> <span>tersedia ' + dv.tersedia + ' · min ' + (dv.min === null ? '–' : dv.min) + ' · ideal ' + (dv.ideal === null ? '–' : dv.ideal) + ' · kuota ' + dv.kuota + ' · sisa ' + sisa + '</span></div>';
      html += terpilih.map(function (d) { return '<span class="pg-chip" title="' + esc(d.alasan) + '">' + esc(d.nama) + (d.sumber === 'MANUAL' ? ' (manual)' : '') + ' <a href="#" data-hapus="' + esc(kunci(d)) + '">✕</a>' + '</span>'; }).join('');
      const kand = dv.daftar.filter(function (x) { return x.status === 'BELUM ABSEN' && !terpilih.some(function (d) { return d.idRelawan === x.id; }); });
      if (kand.length) html += '<select data-tambah="' + esc(hr.tanggal + '|' + dv.divisi) + '"><option value="">+ tambah manual…</option>' + kand.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.nama) + '</option>'; }).join('') + '</select>';
      dv.peringatan.forEach(function (p) { html += '<div class="pg-warn">' + esc(p) + '</div>'; });
      html += '</div>';
    });
    return html + '</details>';
  }
  function renderRencana() {
    const el = $('pg_rencana'), h = S.hasil;
    const akhir = geserIso(S.awal, S.n - 1);
    let html = '<div id="pgBerjalan"></div><div class="pg-bar"><label>Periode <select id="pgN"><option value="1"' + (S.n === 1 ? ' selected' : '') + '>1 hari</option><option value="3"' + (S.n === 3 ? ' selected' : '') + '>3 hari</option><option value="7"' + (S.n === 7 ? ' selected' : '') + '>7 hari</option></select></label>'
      + '<label>' + (S.n === 1 ? 'Tanggal' : 'Mulai tanggal') + ' <input type="date" id="pgAwal" value="' + esc(S.awal) + '"></label><button type="button" class="btn-mini primary" id="pgHitung">Hitung Rekomendasi</button>'
      + '</div><div class="pg-langkah"><span>1 · Hitung rekomendasi</span><span>2 · Periksa atau ubah nama</span><span>3 · Ajukan ke SIKOP</span></div>'
      + '<p class="pg-sub" style="margin:2px 0 8px">' + (S.n === 1 ? namaHari(S.awal) + ' ' + dmy(S.awal) : namaHari(S.awal) + ' ' + dmy(S.awal) + ' – ' + namaHari(akhir) + ' ' + dmy(akhir)) + '</p>';
    S.masalah.forEach(function (m) { html += '<div class="pg-alert">' + esc(m) + '</div>'; });
    if (!h) { el.innerHTML = html; ikatRencana(); muatBerjalan(); return; }
    const total = S.daftar.length;
    html += ringkasanAtas(h);
    html += '<h4 style="margin:12px 0 6px">Rekomendasi libur bergilir' + (h.hari.length > 1 ? ' per hari' : '') + '</h4>';
    h.hari.forEach(function (hr, i) { html += barisHari(hr, h.hari.length === 1 || !!S.buka[hr.tanggal]); });
    html += '<div class="pg-aksi"><button type="button" class="btn-mini primary" id="pgAjukan"' + (total ? '' : ' disabled') + '>Ajukan ke SIKOP</button></div>';
    el.innerHTML = html; ikatRencana(); muatBerjalan();
  }
  function ikatRencana() {
    const el = $('pg_rencana');
    const ulang = function () { S.hasil = null; S.daftar = []; S.masalah = []; S.buka = {}; renderRencana(); };
    $('pgAwal').addEventListener('change', function (e) { if (e.target.value && e.target.value !== S.awal) { S.awal = e.target.value; ulang(); } });
    $('pgN').addEventListener('change', function (e) { S.n = Number(e.target.value) || 1; ulang(); });
    el.querySelectorAll('details.pg-hari').forEach(function (d) { d.addEventListener('toggle', function () { S.buka[d.dataset.tgl] = d.open; }); });
    $('pgHitung').addEventListener('click', hitung);
    el.querySelectorAll('[data-hapus]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); S.daftar = S.daftar.filter(function (d) { return kunci(d) !== a.dataset.hapus; }); renderRencana(); }); });
    el.querySelectorAll('select[data-tambah]').forEach(function (s) { s.addEventListener('change', function () {
      if (!s.value) return; const p = s.dataset.tambah.split('|'), dv = S.hasil.hari.filter(function (h) { return h.tanggal === p[0]; })[0].divisi.filter(function (x) { return x.divisi === p[1]; })[0], orang = dv.daftar.filter(function (x) { return x.id === s.value; })[0];
      S.daftar.push({ tanggal: p[0], idRelawan: s.value, nama: orang.nama, divisi: p[1], sumber: 'MANUAL', alasan: 'Ditambahkan manual oleh SIMSDM' }); renderRencana(); }); });
    const aj = $('pgAjukan'); if (aj) aj.addEventListener('click', ajukan);
  }
  async function muatRencana() { renderRencana(); }
  async function hitung() {
    try {
      const d = await sibuk('Menghitung rekomendasi…', function () { return api('hitungRekomendasiPergiliran', { tanggalMulai: S.awal, hari: S.n }); });
      S.hasil = d.hasil; S.masalah = d.masalahData || []; S.daftar = [];
      d.hasil.hari.forEach(function (h) { h.divisi.forEach(function (dv) { dv.libur.forEach(function (l) { S.daftar.push({ tanggal: h.tanggal, idRelawan: l.id, nama: l.nama, divisi: dv.divisi, sumber: 'OTOMATIS', alasan: l.alasan }); }); }); });
    } catch (e) { lapor(e.message || 'Gagal menghitung.'); }
    renderRencana();
  }
  const kirimDaftar = function () { return S.daftar.map(function (d) { return { tanggal: d.tanggal, idRelawan: d.idRelawan, sumber: d.sumber, alasan: d.alasan }; }); };
  async function ajukan() {
    if (!S.daftar.length) return;
    if (!confirm('Ajukan ' + S.daftar.length + ' libur ke SIKOP?')) return;
    const aj = $('pgAjukan'); if (aj) aj.disabled = true;
    try { const r = await sibuk('Mengajukan…', function () { return api('ajukanLangsungPergiliran', { tanggalMulai: S.awal, hari: S.n, daftar: kirimDaftar() }); }); info('Diajukan ke SIKOP: ' + r.diajukan + ' libur.'); muatAtas(); S.hasil = null; S.daftar = []; S.masalah = []; S.buka = {}; }
    catch (e) { lapor(e.message); }
    renderRencana();
  }
  async function tarik(idBatch) {
    const a = prompt('Alasan menarik (wajib):'); if (!a || !a.trim()) return;
    try { await api('tarikPengajuanPergiliran', { idBatch: idBatch, alasan: a.trim() }); info('Ditarik.'); muatAtas(); } catch (e) { lapor(e.message); }
  }
  /** Draf dan pengajuan yang sedang berjalan (belum ditetapkan SIKOP). */
  async function muatBerjalan() {
    const el = $('pgBerjalan'); if (!el) return;
    let d; try { d = await api('getRiwayatPergiliran', {}); } catch (e) { return; }
    const per = {}; d.items.filter(function (x) { return x.STATUS === 'REKOMENDASI' || x.STATUS === 'DIAJUKAN'; }).forEach(function (x) { (per[x.ID_BATCH] = per[x.ID_BATCH] || []).push(x); });
    const ids = Object.keys(per); if (!ids.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="pg-valid"><b>Menunggu SIKOP</b>' + ids.map(function (id) { const r = per[id], ajukanSudah = r[0].STATUS === 'DIAJUKAN';
      return '<div style="margin:6px 0">' + esc(id) + ' · ' + r.length + ' libur · <b>' + (ajukanSudah ? 'menunggu SIKOP' : 'draf lama, belum diajukan') + '</b> · ' + esc(r.map(function (x) { return dmy(x.TANGGAL); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '))
        + ' <button type="button" class="btn-mini" data-ajukan="' + esc(id) + '"' + (ajukanSudah ? ' style="display:none"' : '') + '>Ajukan ke SIKOP</button> <button type="button" class="btn-mini" data-tarik="' + esc(id) + '">Tarik</button></div>'; }).join('') + '</div>';
    el.querySelectorAll('[data-ajukan]').forEach(function (b) { b.addEventListener('click', async function () { try { const r = await api('ajukanPergiliran', { idBatch: b.dataset.ajukan }); info('Diajukan: ' + r.diajukan + ' libur.'); muatAtas(); } catch (e) { lapor(e.message); } muatBerjalan(); }); });
    el.querySelectorAll('[data-tarik]').forEach(function (b) { b.addEventListener('click', function () { tarik(b.dataset.tarik).then(muatBerjalan); }); });
  }

  /* ---------------- RIWAYAT ---------------- */
  async function muatRiwayat() {
    const el = $('pg_riwayat'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    try {
      const d = await api('getRiwayatPergiliran', {}), r = d.ringkas, rp = function (n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
      el.innerHTML = '<div class="dp-chips" style="margin-bottom:8px"><span class="dp-chip"><b>' + r.DITETAPKAN + '</b>ditetapkan</span><span class="dp-chip"><b>' + r.DIAJUKAN + '</b>diajukan</span><span class="dp-chip"><b>' + r.REKOMENDASI + '</b>draf</span><span class="dp-chip"><b>' + r.DIBATALKAN + '</b>dibatalkan</span><span class="dp-chip"><b>' + r.DITOLAK + '</b>ditolak</span><span class="dp-chip"><b>' + rp(r.dampakInsentifDitetapkan) + '</b>insentif tidak dibayar (ditetapkan)</span></div>'
        + '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Tanggal</th><th>Relawan</th><th>Divisi</th><th>Status</th><th>Sumber</th><th>Tersedia/Min/Ideal</th><th>Diajukan</th><th>Diputuskan SIKOP</th></tr></thead><tbody>'
        + (d.items.map(function (x) { return '<tr><td>' + dmy(x.TANGGAL) + '</td><td>' + esc(x.NAMA_RELAWAN) + '</td><td>' + esc(x.DIVISI) + '</td><td><b>' + esc(x.STATUS) + '</b></td><td>' + esc(x.SUMBER) + '</td><td>' + esc(x.TERSEDIA) + '/' + esc(x.KEB_MIN) + '/' + esc(x.KEB_IDEAL) + '</td><td>' + esc(x.DIAJUKAN_OLEH || '') + '</td><td>' + esc(x.DITETAPKAN_OLEH || x.DIBATALKAN_OLEH || '') + (x.ALASAN_BATAL ? ' · ' + esc(x.ALASAN_BATAL) : '') + '</td></tr>'; }).join('') || '<tr><td colspan="8">Belum ada riwayat.</td></tr>') + '</tbody></table></div>';
    } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; }
  }
  muatRencana(); muatAtas();
})();

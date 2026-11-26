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
  const TAB = [['struktur', 'Struktur dan Penempatan'], ['kebutuhan', 'Kebutuhan Tenaga'], ['rencana', 'Rencana Pergiliran'], ['riwayat', 'Riwayat']];

  panel.innerHTML = '<div class="shell-page-head"><div><h2 class="shell-page-title">Kebutuhan Tenaga dan Pergiliran</h2><p class="shell-page-sub">SIMSDM menyusun kebutuhan tenaga dari PM, membuat rekomendasi libur, lalu <b>mengajukan</b> ke SIKOP. Jadwal baru berubah setelah SIKOP menetapkan. Libur pergiliran bukan alfa dan tidak dibayar.</p></div></div>'
    + '<div class="pg-tabs">' + TAB.map(function (t, i) { return '<button type="button" class="btn-mini' + (i === 0 ? ' primary' : '') + '" data-pg="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>'
    + TAB.map(function (t, i) { return '<div id="pg_' + t[0] + '" class="panel-block"' + (i ? ' style="display:none"' : '') + '></div>'; }).join('');
  panel.querySelectorAll('[data-pg]').forEach(function (b) { b.addEventListener('click', function () {
    panel.querySelectorAll('[data-pg]').forEach(function (x) { x.classList.toggle('primary', x === b); });
    TAB.forEach(function (t) { $('pg_' + t[0]).style.display = t[0] === b.dataset.pg ? '' : 'none'; });
    ({ struktur: muatStruktur, kebutuhan: muatKebutuhan, rencana: muatRencana, riwayat: muatRiwayat })[b.dataset.pg]();
  }); });
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: tok() }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  const sibuk = async function (teks, fn) { try { if (typeof showLoading === 'function') showLoading(teks); return await fn(); } finally { if (typeof hideLoading === 'function') hideLoading(); } };

  /* ---------------- STRUKTUR DAN PENEMPATAN (baca Data Relawan) ---------------- */
  async function muatStruktur() {
    const el = $('pg_struktur'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let d; try { d = await api('getStrukturPenempatan'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    const lbl = { DISAHKAN: 'Kebutuhan disahkan', DRAF: 'Kebutuhan masih DRAF', BELUM_DIISI: 'Kebutuhan belum diisi' };
    el.innerHTML = '<p class="pg-sub">Dibaca dari <b>Data Relawan</b> (divisi dan jabatan, relawan aktif). Tidak ada data jabatan baru yang dibuat di sini; ubah data di menu Data Relawan. Total aktif: <b>' + d.totalAktif + '</b>.</p>'
      + d.divisi.map(function (dv) {
        return '<details class="pg-div"><summary><b>' + esc(dv.divisi) + '</b> <span class="pg-sub">' + dv.aktif + ' relawan aktif · ' + (lbl[dv.statusKebutuhan] || '') + '</span></summary>'
          + dv.jabatan.map(function (j) { return '<div style="margin:6px 0 2px 14px"><b>' + esc(j.jabatan) + '</b> <span class="pg-sub">(' + j.jumlah + ')</span><div>' + j.anggota.map(function (a) { return '<span class="pg-chip" style="background:#eef1f6;color:#344054">' + esc(a.nama) + '</span>'; }).join('') + '</div></div>'; }).join('') + '</details>';
      }).join('');
  }

  /* ---------------- KEBUTUHAN DAN SIMULASI (disederhanakan, 25l) ---------------- */
  const LBL_STATUS = { DISAHKAN: ['Disahkan', 'pg-ok'], DRAF: ['Menunggu disahkan', 'pg-wait'], BELUM: ['Belum diisi', 'pg-kosong'] };
  const kunciDiv = function (s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); };
  async function muatKebutuhan() {
    const el = $('pg_kebutuhan'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    try { S.keb = await api('getKebutuhanTenagaAdmin'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    const k = S.keb, baris = {}; k.kebutuhan.forEach(function (b) { baris[kunciDiv(b.divisi)] = b; });
    const bagian = k.referensi.map(function (r) {
      const b = baris[kunciDiv(r.divisi)] || null, st = b ? LBL_STATUS[b.status] || LBL_STATUS.DRAF : LBL_STATUS.BELUM, tetap = !b || b.mode === 'TETAP';
      if (!r.bisaBergilir) return '<tr><td data-l="Divisi"><b>' + esc(r.divisi) + '</b></td><td data-l="Relawan aktif">' + r.relawanAktif + '</td><td data-l="Batas bawah"><span class="pg-sub">Tetap: selalu masuk semua</span></td><td data-l="Status"><span class="pg-status pg-kosong">Tidak bergilir</span></td><td></td></tr>';
      const isi = tetap ? '<input type="number" min="0" inputmode="numeric" class="pg-min" data-div="' + esc(r.divisi) + '" data-awal="' + (b && b.minTetap !== null ? b.minTetap : '') + '" data-acuan="' + (r.acuanMin || '') + '" value="' + (b && b.minTetap !== null ? b.minTetap : '') + '" placeholder="' + (r.acuanMin ? 'acuan ' + r.acuanMin : 'isi angka') + '">'
        : '<span class="pg-sub">Mengikuti jumlah PM</span>';
      return '<tr><td data-l="Divisi"><b>' + esc(r.divisi) + '</b></td><td data-l="Relawan aktif">' + r.relawanAktif + '</td><td data-l="Batas bawah (pengaman)">' + isi + '</td><td data-l="Status"><span class="pg-status ' + st[1] + '">' + st[0] + '</span></td><td><button type="button" class="btn-mini" data-lanjut="' + esc(r.divisi) + '">Pengaturan lain</button></td></tr>';
    }).join('');
    const adaDraf = k.kebutuhan.some(function (b) { return b.status !== 'DISAHKAN'; });
    const ag = k.anggaran || { danaPerPm: 3000, kebOpsHarian: 2000000, kebOpsMinimum: 1500000, tanpaBatas: true, asDriverPm: 1500, aktif: false };
    el.innerHTML = '<div class="pg-valid" style="margin-bottom:12px"><b>Cara kerjanya</b><ol style="margin:6px 0 0 18px;padding:0">'
      + '<li>Dana hari itu = <b>PM × Rp' + Number(ag.danaPerPm).toLocaleString('id-ID') + '</b>. Dikurangi <b>insentif PIC</b> hari itu dan <b>operasional yang harus diamankan</b> (minimum Rp' + Number(ag.kebOpsMinimum).toLocaleString('id-ID') + ', target aman Rp' + Number(ag.kebOpsHarian).toLocaleString('id-ID') + '), sisanya adalah <b>jatah insentif relawan</b>. Operasional bukan angka kunci: ia adalah sisa dana, dan sistem menjaganya tidak turun di bawah target aman bila masih bisa.</li>'
      + '<li>Bila biaya relawan yang masuk (tarif tiap orang di Master Tarif) <b>melebihi jatah</b>, sistem <b>menyarankan siapa yang libur bergilir</b> supaya tidak minus. Hanya Persiapan, Pengolahan, Pemorsian, dan Cuci Ompreng yang bisa bergilir; divisi lain tetap. Koordinator dan Kepala tidak diliburkan. Bila PM di bawah ' + Number(ag.asDriverPm).toLocaleString('id-ID') + ', <b>Asisten Driver libur</b> otomatis.</li>'
      + '<li>Buka tab <b>Rencana Pergiliran</b>, pilih pekan, tekan <b>Hitung Rekomendasi</b>. Anda tidak perlu mengisi jumlah orang per PM.</li></ol></div>'
      + '<h4 style="margin:4px 0 6px">Dana dan kebutuhan operasional ' + (ag.aktif ? '<span class="pg-status pg-ok">Aktif</span>' : '<span class="pg-status pg-wait">Belum dipakai</span>') + '</h4>'
      + '<div class="pg-form" style="margin-bottom:6px"><label>Dana operasional per PM (Rp) <input type="number" min="1" inputmode="numeric" id="pgAgPm" value="' + esc(ag.danaPerPm) + '"></label>'
      + '<label>Operasional target aman per hari (Rp) <input type="number" min="0" inputmode="numeric" id="pgAgOps" value="' + esc(ag.kebOpsHarian) + '"></label>'
      + '<label>Operasional minimum per hari (Rp) <input type="number" min="0" inputmode="numeric" id="pgAgMin" value="' + esc(ag.kebOpsMinimum) + '"></label>'
      + '<label>Asisten Driver libur bila PM di bawah (0 = dimatikan) <input type="number" min="0" inputmode="numeric" id="pgAgAsd" value="' + esc(ag.asDriverPm) + '"></label>'
      + '<label style="grid-column:1/-1;display:flex;gap:8px;align-items:center"><input type="checkbox" id="pgAgBebas"' + (ag.tanpaBatas ? ' checked' : '') + '> <span><b>Tanpa batas bawah jumlah orang</b>: jumlah yang libur murni mengikuti dana (Koordinator dan Kepala tetap tidak diliburkan).</span></label>'
      + '<div style="align-self:end"><button type="button" class="btn-mini primary" id="pgAgSimpan">' + (ag.aktif ? 'Simpan' : 'Simpan dan pakai') + '</button></div></div>'
      + '<p class="pg-sub">Insentif PIC dan tarif relawan diambil otomatis dari Master PIC dan Master Tarif; PM dari data PM harian yang terverifikasi.' + (ag.aktif ? '' : ' Selama belum dipakai, rekomendasi masih memakai cara lama (angka kebutuhan yang disahkan).') + '</p>'
      + '<div id="pgStandar" style="margin-top:14px"></div>'
      + '<h4 style="margin:14px 0 6px">Divisi yang bisa bergilir libur</h4>'
      + '<p class="pg-sub">' + (ag.tanpaBatas ? '<b>Saat ini batas bawah TIDAK dipakai</b> (kotak "Tanpa batas bawah jumlah orang" dicentang di atas): divisi di bawah ini bergilir bebas sesuai dana. Angka di tabel baru berlaku bila kotak itu dimatikan. ' : '') + 'Batas bawah = jumlah orang paling sedikit yang tetap masuk di divisi itu, sebagai pengaman. Dikosongkan = sistem memakai acuan sementara. Ubah hanya bila ada dasarnya.</p>'
      + (k.referensi.length ? '<div class="table-wrap"><table class="rmg-tabel pg-keb"><thead><tr><th>Divisi</th><th>Relawan aktif</th><th>Batas bawah orang masuk (pengaman)</th><th>Status</th><th></th></tr></thead><tbody>' + bagian + '</tbody></table></div>'
        : '<p class="pg-sub">Belum ada relawan aktif di Data Relawan, jadi belum ada divisi untuk diisi.</p>')
      + '<div class="pg-aksi"><button type="button" class="btn-mini primary" id="pgSimpanSemua">Simpan</button><button type="button" class="btn-mini" id="pgSahkanSemua"' + (adaDraf ? '' : ' disabled') + '>Sahkan semua</button><button type="button" class="btn-mini" id="pgIsiAcuan">Isi kotak kosong dengan acuan sementara</button></div>'
      + '<p class="pg-sub">Angka tidak terisi sendiri: Anda yang menentukan. Acuan sementara (Persiapan 7, Pengolahan 7, Pemorsian 8, Cuci Ompreng 9, Distribusi 4) hanya contoh bukan standar resmi; setelah diisi tetap tekan Simpan. Mengubah angka yang sudah disahkan membuatnya menunggu disahkan lagi.</p>'
      + '<details id="pgSimBox" style="margin-top:14px"><summary><b>Coba hitung (tidak wajib)</b>: berapa tenaga yang dibutuhkan bila PM sekian?</summary>'
      + '<p class="pg-sub">Memakai PM terverifikasi dari SIPANDU (rata-rata sampai 30 hari operasional terakhir). Hanya untuk melihat gambaran; tidak mengubah apa pun.</p>'
      + '<div class="pg-bar"><label>PM yang ingin dicoba (boleh dikosongkan) <input type="text" id="pgPmTambah" placeholder="mis. 1500, 2000"></label><button type="button" class="btn-mini primary" id="pgSimulasi">Hitung</button></div><div id="pgSimHasil"></div></details>'
      + '<details id="pgLanjutan" style="margin-top:14px"><summary><b>Pengaturan lain (jarang dipakai)</b>: ikut jumlah PM, jabatan wajib, batas libur</summary><div class="pg-form" style="margin-top:8px"><label>Divisi <select id="pgfDivisi">' + k.referensi.map(function (r) { return '<option value="' + esc(r.divisi) + '">' + esc(r.divisi) + ' (aktif ' + r.relawanAktif + ')</option>'; }).join('') + '</select></label>'
      + '<label>Cara menghitung <select id="pgfMode"><option value="TETAP">Angka tetap</option><option value="PM_PROPORSIONAL">Mengikuti jumlah PM</option><option value="CAMPURAN">Angka tetap dan mengikuti PM</option></select></label>'
      + '<label>Minimal tenaga per hari <input type="number" min="0" id="pgfMin"></label><label>Tenaga ideal per hari <input type="number" min="0" id="pgfIdeal"></label>'
      + '<label>Satu tenaga melayani paling banyak … PM <input type="number" min="0" id="pgfPmMaks"></label><label>Satu tenaga melayani idealnya … PM <input type="number" min="0" id="pgfPmIdeal"></label>'
      + '<label>Minimal per shift <input type="number" min="0" id="pgfShift" placeholder="1"></label><label>Maks libur per orang per pekan <input type="number" min="0" id="pgfMaks" placeholder="kosong = bebas"></label><label>Larang libur berturut-turut <select id="pgfLarang"><option>TIDAK</option><option>YA</option></select></label>'
      + '<label style="grid-column:1/-1">Jabatan yang harus selalu ada (contoh: Kepala Pemorsian:1; Koordinator:1) <input type="text" id="pgfJab"></label><label>Divisi ini boleh libur <select id="pgfBoleh"><option>YA</option><option>TIDAK</option></select></label><label style="grid-column:1/-1">Catatan <input type="text" id="pgfCat"></label>'
      + '<div style="grid-column:1/-1"><button type="button" class="btn-mini primary" id="pgfSimpan">Simpan pengaturan ini</button></div></div></details>';
    $('pgSimulasi').addEventListener('click', simulasi);
    muatStandar();
    $('pgAgSimpan').addEventListener('click', async function () {
      try { await sibuk('Menyimpan…', function () { return api('simpanPengaturanAnggaranPergiliran', { danaPerPm: $('pgAgPm').value, kebOpsHarian: $('pgAgOps').value, kebOpsMinimum: $('pgAgMin').value, tanpaBatas: $('pgAgBebas').checked, pmAsistenDriverLibur: $('pgAgAsd').value }); }); info('Tersimpan. Rekomendasi sekarang dihitung dari dana.'); muatKebutuhan(); } catch (e) { lapor(e.message); }
    });
    const isiForm = function (dv) {
      const x = baris[kunciDiv(dv)]; $('pgfDivisi').value = dv; $('pgLanjutan').open = true;
      $('pgfMode').value = x ? x.mode : 'TETAP'; $('pgfMin').value = x && x.minTetap !== null ? x.minTetap : ''; $('pgfIdeal').value = x && x.idealTetap !== null ? x.idealTetap : '';
      $('pgfPmMaks').value = x && x.pmMaks ? x.pmMaks : ''; $('pgfPmIdeal').value = x && x.pmIdeal ? x.pmIdeal : ''; $('pgfShift').value = x ? x.minPerShift : '';
      $('pgfMaks').value = x && x.maksLiburMinggu < 99 ? x.maksLiburMinggu : ''; $('pgfLarang').value = x && x.larangBeruntun ? 'YA' : 'TIDAK'; $('pgfJab').value = x ? x.jabatanWajibTeks : ''; $('pgfBoleh').value = x && !x.bolehLibur ? 'TIDAK' : 'YA'; $('pgfCat').value = x ? (x.catatan || '') : '';
      $('pgfMin').scrollIntoView({ block: 'center' });
    };
    el.querySelectorAll('[data-lanjut]').forEach(function (b) { b.addEventListener('click', function () { isiForm(b.dataset.lanjut); }); });
    $('pgIsiAcuan').addEventListener('click', function () { let n = 0; el.querySelectorAll('.pg-min').forEach(function (i) { if (i.value === '' && i.dataset.acuan) { i.value = i.dataset.acuan; n++; } }); if (!n) info('Tidak ada kotak kosong yang punya acuan sementara.'); else info(n + ' kotak terisi. Tekan Simpan bila sudah sesuai.'); });
    $('pgSimpanSemua').addEventListener('click', async function () {
      const ubah = Array.prototype.filter.call(el.querySelectorAll('.pg-min'), function (i) { return i.value !== '' && i.value !== i.dataset.awal; });
      if (!ubah.length) { info('Belum ada angka yang berubah.'); return; }
      let ok = 0; const gagal = [];
      for (const i of ubah) {
        const x = baris[kunciDiv(i.dataset.div)], v = Number(i.value);
        if (!(v >= 0) || !Number.isInteger(v)) { gagal.push(i.dataset.div + ': harus bilangan bulat 0 atau lebih'); continue; }
        try {
          await sibuk('Menyimpan ' + i.dataset.div + '…', function () { return api('simpanKebutuhanTenaga', { divisi: i.dataset.div, mode: 'TETAP', minTetap: v, idealTetap: x && x.idealTetap !== null && x.idealTetap >= v ? x.idealTetap : v,
            pmPerTenagaMaks: x && x.pmMaks || '', pmPerTenagaIdeal: x && x.pmIdeal || '', minPerShift: x ? x.minPerShift : '', maksLiburMinggu: x && x.maksLiburMinggu < 99 ? x.maksLiburMinggu : '', larangBeruntun: x && x.larangBeruntun ? 'YA' : 'TIDAK', jabatanWajib: x ? x.jabatanWajibTeks : '', bolehLibur: x && !x.bolehLibur ? 'TIDAK' : 'YA', catatan: x ? (x.catatan || '') : '' }); });
          ok++;
        } catch (e) { gagal.push(i.dataset.div + ': ' + e.message); }
      }
      if (ok) info(ok + ' divisi tersimpan. Tekan "Sahkan semua" agar angkanya dipakai.');
      if (gagal.length) lapor(gagal.join('\n'));
      muatKebutuhan();
    });
    $('pgSahkanSemua').addEventListener('click', async function () {
      const antre = k.kebutuhan.filter(function (b) { return b.status !== 'DISAHKAN'; }); if (!antre.length) return;
      if (!confirm('Sahkan angka ' + antre.length + ' divisi? Sistem rekomendasi akan memakai angka ini.')) return;
      let ok = 0, sebab = '';
      for (const b of antre) { try { await sibuk('Mengesahkan ' + b.divisi + '…', function () { return api('sahkanKebutuhanTenaga', { divisi: b.divisi }); }); ok++; } catch (e) { sebab = e.message; if (/izin/i.test(sebab)) break; } }
      if (ok) info(ok + ' divisi disahkan.');
      if (sebab) lapor(/izin/i.test(sebab) ? 'Akun ini tidak berhak mengesahkan. Minta SIKOP mengesahkannya di menu Penetapan Pergiliran.' : sebab);
      muatKebutuhan();
    });
    $('pgfSimpan').addEventListener('click', async function () { try { await api('simpanKebutuhanTenaga', { divisi: $('pgfDivisi').value, mode: $('pgfMode').value, minTetap: $('pgfMin').value, idealTetap: $('pgfIdeal').value, pmPerTenagaMaks: $('pgfPmMaks').value, pmPerTenagaIdeal: $('pgfPmIdeal').value, minPerShift: $('pgfShift').value, maksLiburMinggu: $('pgfMaks').value, larangBeruntun: $('pgfLarang').value, jabatanWajib: $('pgfJab').value, bolehLibur: $('pgfBoleh').value, catatan: $('pgfCat').value }); info('Tersimpan. Tekan "Sahkan semua" agar dipakai.'); muatKebutuhan(); } catch (e) { lapor(e.message); } });
  }
  /* ---------------- STANDAR PITA PM (25p): saklar, tabel, kalkulator ---------------- */
  const PD = [['P', 'Pemorsian'], ['G', 'Pengolahan'], ['C', 'Cuci Ompreng'], ['S', 'Persiapan']];
  const pitaTeks = function (b) { return b.pitaMaks === null ? angka(b.pitaMin) + ' ke atas' : angka(b.pitaMin) + '–' + angka(b.pitaMaks); };
  let STD = null;
  async function muatStandar() {
    const el = $('pgStandar'); if (!el) return;
    try { STD = await api('getStandarPitaAdmin'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    if (!STD || !STD.saklar || !Array.isArray(STD.baris)) { el.innerHTML = '<p class="pg-sub">Standar pita PM belum tersedia di server ini. Pasang berkas StandarPita.gs di Apps Script lalu muat ulang.</p>'; return; }
    const on = !!STD.saklar.pergiliran;
    el.innerHTML = '<h4 style="margin:0 0 6px">Standar pita PM ' + (on ? '<span class="pg-status pg-ok">Dipakai</span>' : '<span class="pg-status pg-wait">Tidak dipakai</span>') + '</h4>'
      + '<p class="pg-sub">Tabel standar: untuk setiap rentang PM, berapa orang yang masuk di tiap divisi bergilir, persen tarif, serta batas operasional aman dan minimum. Bila <b>dipakai</b>, rekomendasi libur mengikuti tabel ini (Koordinator dan Kepala tetap tidak diliburkan). Bila <b>tidak dipakai</b>, cara lama di atas yang berjalan. PM di bawah 1.000 tidak punya standar.</p>'
      + '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="pgStdOn"' + (on ? ' checked' : '') + '> <span><b>Pakai rekomendasi standar pita PM</b> pada Hitung Rekomendasi' + (STD.anggaranAktif ? '' : ' (otomatis ikut mengaktifkan perhitungan dana)') + '</span></label>'
      + '<details id="pgStdTabel"><summary><b>Lihat / ubah tabel standar</b> (' + (STD.sumber === 'SHEET' ? 'sudah diubah Admin' : 'bawaan') + ')</summary>'
      + '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>PM dari</th><th>sampai</th>' + PD.map(function (d) { return '<th>' + d[1] + ' masuk<br><span class="pg-sub">aktif ' + (STD.divisi.filter(function (x) { return x.kode === d[0]; })[0] || {}).relawanAktif + '</span></th>'; }).join('') + '<th>Tarif (% Master)</th><th>Operasional aman</th><th>Operasional minimum</th></tr></thead><tbody>'
      + STD.baris.map(function (b, i) { const n = function (k, v, w) { return '<td><input type="number" min="0" data-i="' + i + '" data-k="' + k + '" value="' + v + '" style="width:' + (w || 62) + 'px"></td>'; };
        return '<tr><td><b>' + angka(b.pitaMin) + '</b></td><td>' + (b.pitaMaks === null ? 'ke atas' : angka(b.pitaMaks)) + '</td>' + PD.map(function (d) { return n('m' + d[0], b.masuk[d[0]]); }).join('') + '<td><input type="number" min="1" max="100" step="0.1" data-i="' + i + '" data-k="persen" value="' + b.persen + '" style="width:70px"></td>' + n('aman', b.aman, 100) + n('minimum', b.minimum, 100) + '</tr>'; }).join('')
      + '</tbody></table></div><div class="pg-aksi"><button type="button" class="btn-mini primary" id="pgStdSimpan">Simpan tabel</button><button type="button" class="btn-mini" id="pgStdBawaan"' + (STD.sumber === 'SHEET' ? '' : ' disabled') + '>Kembalikan ke bawaan</button></div>'
      + '<p class="pg-sub">Pita harus rapat (batas atas + 1 = batas bawah berikutnya), pita terakhir tanpa batas atas, dan minimum tidak boleh melebihi aman. Persen tarif baru dipakai di rekap bila Admin menyalakannya di Master Tarif.</p></details>'
      + '<details id="pgStdHitung" style="margin-top:8px"><summary><b>Rekomendasi untuk PM tertentu</b> (kalkulator, tidak mengubah apa pun)</summary><div class="pg-bar"><label>PM <input type="number" min="1" id="pgStdPm" placeholder="mis. 1900"></label><label>Insentif PIC hari itu (Rp, kosongkan = perkiraan) <input type="number" min="0" id="pgStdPic"></label><button type="button" class="btn-mini primary" id="pgStdGo">Hitung</button></div><div id="pgStdHasil"></div></details>';
    $('pgStdOn').addEventListener('change', async function () {
      const v = this.checked, kotak = this;
      try { await sibuk('Menyimpan…', function () { return api('simpanPengaturanStandarAdmin', { pergiliran: v }); }); info(v ? 'Rekomendasi sekarang memakai standar pita PM.' : 'Standar pita PM tidak dipakai; kembali ke cara lama.'); muatKebutuhan(); }
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
        + (d.tarifMasterDariRekomendasi ? '<p class="pg-sub">Tarif Master di sini diambil dari rekomendasi (tarif sekarang ÷ 83,3%) karena persen tarif belum dinyalakan di Master Tarif.</p>' : '');
    });
  }
  const NAMA_STATUS = { CUKUP: 'Cukup', DI_BAWAH_IDEAL: 'Di bawah ideal', KURANG_TENAGA: 'KURANG tenaga', BELUM_DIISI: 'Master belum diisi', TAK_TERHITUNG: 'Tak terhitung' };
  const NAMA_ACUAN = { DALAM_ACUAN: 'dalam acuan', DI_BAWAH_ACUAN: 'di bawah acuan', DI_ATAS_ACUAN: 'di atas acuan', TANPA_ACUAN: 'tanpa acuan' };
  async function simulasi() {
    const el = $('pgSimHasil'), tambah = String($('pgPmTambah').value || '').split(/[,;\s]+/).filter(Boolean).map(Number).filter(function (n) { return n > 0; });
    let d; try { d = await sibuk('Menghitung simulasi…', function () { return api('simulasiKebutuhanTenaga', { pmTambahan: tambah }); }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    const p = d.pm;
    let html = '<div class="dp-chips" style="margin:8px 0"><span class="dp-chip"><b>' + p.hariValid + '/' + p.target + '</b>hari operasional valid</span><span class="dp-chip"><b>' + angka(p.rata) + '</b>PM rata-rata</span><span class="dp-chip"><b>' + angka(p.terendah) + '</b>PM terendah</span><span class="dp-chip"><b>' + angka(p.tertinggi) + '</b>PM tertinggi</span></div>';
    p.keterbatasan.forEach(function (m) { html += '<div class="pg-alert">' + esc(m) + '</div>'; });
    if (!d.tingkat.length) html += '<p class="pg-sub">Belum ada data PM terverifikasi. Ketik PM yang ingin dicoba di kotak di atas, lalu tekan Hitung.</p>';
    else {
      html += '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Divisi</th><th>Kapasitas (aktif)</th><th>Acuan sementara</th>' + d.tingkat.map(function (t) { return '<th>' + esc(t.label) + '<br>PM ' + angka(t.pm) + '</th>'; }).join('') + '</tr></thead><tbody>';
      html += d.divisi.map(function (dv) {
        return '<tr><td><b>' + esc(dv.divisi) + '</b><br><span class="pg-sub">' + (dv.statusKebutuhan === 'BELUM_DIISI' ? 'master belum diisi' : 'master ' + esc(dv.statusKebutuhan)) + '</span></td><td>' + dv.kapasitas + '</td><td>' + (dv.acuan ? dv.acuan.min + (dv.acuan.maks !== dv.acuan.min ? '–' + dv.acuan.maks : '') + '<br><span class="pg-sub">' + NAMA_ACUAN[dv.statusAcuan] + '</span>' : '–') + '</td>'
          + dv.perTingkat.map(function (x) { return '<td class="' + (x.status === 'KURANG_TENAGA' ? 'pg-err' : '') + '">' + (x.min === null ? '<span class="pg-sub">' + esc(NAMA_STATUS[x.status] || '') + '</span>' : 'min <b>' + x.min + '</b> · ideal <b>' + x.ideal + '</b><br>libur maks ' + x.ruangLibur + '<br><span class="pg-sub">' + esc(NAMA_STATUS[x.status]) + '</span>') + '</td>'; }).join('') + '</tr>';
      }).join('');
      html += '</tbody></table></div>';
    }
    const g = d.anggaran;
    if (g && g.tersedia) {
      html += '<h4 style="margin:14px 0 6px">Simulasi dana ' + (g.aktif ? '' : '<span class="pg-status pg-wait">belum dipakai</span>') + '</h4><div class="dp-chips" style="margin:8px 0"><span class="dp-chip"><b>' + rp(g.biayaRelawanPenuh) + '</b>biaya relawan bila semua masuk</span><span class="dp-chip"><b>' + rp(g.insentifPic) + '</b>insentif PIC' + (g.picDiketahui ? ' (hari PM terakhir)' : ' (belum diketahui)') + '</span><span class="dp-chip"><b>' + rp(g.kebOpsHarian) + '</b>operasional target aman (minimum ' + rp(g.kebOpsMinimum) + ')</span><span class="dp-chip"><b>' + angka(g.pmImpas) + '</b>PM impas (semua masuk)</span><span class="dp-chip"><b>' + angka(g.pmImpasTerendah) + '</b>PM impas terendah (dengan bergilir)</span><span class="dp-chip"><b>' + angka(g.pmImpasMinimum) + '</b>PM terendah yang masih di atas minimum operasional</span></div>';
      html += g.tingkat.length ? '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Tingkat PM</th><th>Dana (PM × ' + rp(g.danaPerPm) + ')</th><th>Jatah relawan</th><th>Sisa bila semua masuk</th><th>Hasil</th></tr></thead><tbody>' + g.tingkat.map(function (t) {
        const hasil = t.status === 'AMAN' ? 'Aman, tidak perlu libur' : (t.status === 'PERLU_BERGILIR' ? 'Perlu bergilir, sekitar ' + t.perkiraanLibur + ' orang libur' : (t.status === 'TIPIS' ? 'Tipis: bergilir sampai batas bawah, operasional tersisa di antara minimum dan target aman' : '<span class="pg-err">Dana tidak cukup walau bergilir sampai batas bawah</span>'));
        return '<tr><td>' + esc(t.label) + '<br>PM ' + angka(t.pm) + '</td><td>' + rp(t.dana) + '</td><td>' + rp(t.jatahRelawan) + '</td><td class="' + (t.sisa < 0 ? 'pg-err' : '') + '">' + (t.sisa < 0 ? 'kurang ' + rp(-t.sisa) : rp(t.sisa)) + '</td><td>' + hasil + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="pg-sub">Belum ada tingkat PM.</p>';
    }
    d.catatan.forEach(function (c) { html += '<p class="pg-sub">• ' + esc(c) + '</p>'; });
    el.innerHTML = html;
  }

  /* ---------------- RENCANA PERGILIRAN ---------------- */
  /** Ringkasan dana satu hari; ikut berubah bila Admin menambah/menghapus libur secara manual. */
  function badgeJadwal(hr) {
    const j = hr.jadwal; if (!hr.operasional || !j) return '';
    if (!j.dibuat) return '<div class="pg-warn">Jadwal hari ini <b>belum dibuat</b> di Jadwal dan Penugasan, jadi belum ada nama yang bisa direkomendasikan. Buat jadwalnya dulu, lalu tekan Hitung Rekomendasi lagi.</div>';
    return '<div class="pg-sub">Jadwal sudah dibuat: <b>' + j.terjadwal + '</b> relawan terjadwal' + (j.sudahLibur ? ' · <b>' + j.sudahLibur + '</b> sudah ditetapkan Libur Pergiliran (tampil "L" di jadwal)' : '') + (j.sudahAbsen ? ' · ' + j.sudahAbsen + ' sudah absen/berstatus (tidak bisa diliburkan lagi)' : '') + '. Bila jadwal diubah setelah ini, tekan Hitung Rekomendasi lagi.</div>';
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
      + (hr.pmSumber === 'PEKAN_SEBELUMNYA' ? '<div class="pg-sub">PM hari ini belum diisi di Manajemen PM, jadi dihitung dari hari yang sama pekan lalu. Bila PM turun atau ada sekolah/posyandu libur, isi PM hari itu dulu lalu tekan Hitung Rekomendasi lagi; insentif PIC ikut menyesuaikan.</div>' : '')
      + (a.dapatDipulihkan ? '<div class="pg-sub">Dana cukup untuk memanggil kembali ' + a.dapatDipulihkan + ' relawan yang sudah ditetapkan libur (opsional; batalkan di Penetapan Pergiliran).</div>' : '')
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
      html += terpilih.map(function (d) { return '<span class="pg-chip" title="' + esc(d.alasan) + '">' + esc(d.nama) + (d.sumber === 'MANUAL' ? ' (manual)' : '') + (S.batch ? '' : ' <a href="#" data-hapus="' + esc(kunci(d)) + '">✕</a>') + '</span>'; }).join('');
      const kand = dv.daftar.filter(function (x) { return x.status === 'BELUM ABSEN' && !terpilih.some(function (d) { return d.idRelawan === x.id; }); });
      if (!S.batch && kand.length) html += '<select data-tambah="' + esc(hr.tanggal + '|' + dv.divisi) + '"><option value="">+ tambah manual…</option>' + kand.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.nama) + '</option>'; }).join('') + '</select>';
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
      + (S.batch ? '<span class="pg-badge">Draf tersimpan: ' + esc(S.batch.id) + '</span>' : '') + '</div>'
      + '<p class="pg-sub" style="margin:2px 0 8px">' + (S.n === 1 ? 'Dihitung untuk <b>' + namaHari(S.awal) + ' ' + dmy(S.awal) + '</b>.' : 'Dihitung otomatis <b>' + S.n + ' hari</b>: ' + namaHari(S.awal) + ' ' + dmy(S.awal) + ' sampai ' + namaHari(akhir) + ' ' + dmy(akhir) + '.') + '</p>';
    S.masalah.forEach(function (m) { html += '<div class="pg-alert">' + esc(m) + '</div>'; });
    if (!h) { el.innerHTML = html + '<p class="pg-sub">Pilih periode (1, 3, atau 7 hari) dan tanggalnya, lalu tekan "Hitung Rekomendasi". Sistem hanya merekomendasikan libur bila tenaga tetap memenuhi minimum, posisi wajib, dan shift. Hasilnya berupa pengajuan ke SIKOP; jadwal belum berubah.</p>'; ikatRencana(); muatBerjalan(); return; }
    const total = S.daftar.length;
    html += ringkasanAtas(h);
    html += '<h4 style="margin:12px 0 6px">Rekomendasi libur bergilir' + (h.hari.length > 1 ? ' per hari' : '') + '</h4>';
    h.hari.forEach(function (hr, i) { html += barisHari(hr, h.hari.length === 1 || !!S.buka[hr.tanggal]); });
    if (S.validasi) html += '<div class="pg-valid">' + (S.validasi.valid ? '<b>✓ Valid.</b>' : '<b>✕ Tidak valid:</b>') + S.validasi.kesalahan.map(function (k) { return '<div class="pg-err">' + esc(k.pesan) + '</div>'; }).join('') + S.validasi.peringatan.map(function (k) { return '<div class="pg-warn">' + esc(k.pesan) + '</div>'; }).join('') + '</div>';
    html += '<div class="pg-aksi">' + (S.batch ? '<button type="button" class="btn-mini primary" id="pgAjukan">Ajukan ke SIKOP</button><button type="button" class="btn-mini" id="pgTarik">Tarik Draf</button>'
      : '<button type="button" class="btn-mini" id="pgValidasi">Validasi</button><button type="button" class="btn-mini primary" id="pgSimpan"' + (total ? '' : ' disabled') + '>Simpan Draf</button>') + '</div>'
      + '<p class="pg-sub">Mengajukan <b>tidak</b> mengubah jadwal. Relawan yang dipilih baru berstatus Libur Pergiliran setelah SIKOP menetapkan.</p>';
    el.innerHTML = html; ikatRencana(); muatBerjalan();
  }
  function ikatRencana() {
    const el = $('pg_rencana');
    const ulang = function () { S.hasil = null; S.daftar = []; S.batch = null; S.validasi = null; S.masalah = []; S.buka = {}; renderRencana(); };
    $('pgAwal').addEventListener('change', function (e) { if (e.target.value && e.target.value !== S.awal) { S.awal = e.target.value; ulang(); } });
    $('pgN').addEventListener('change', function (e) { S.n = Number(e.target.value) || 1; ulang(); });
    el.querySelectorAll('details.pg-hari').forEach(function (d) { d.addEventListener('toggle', function () { S.buka[d.dataset.tgl] = d.open; }); });
    $('pgHitung').addEventListener('click', hitung);
    el.querySelectorAll('[data-hapus]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); S.daftar = S.daftar.filter(function (d) { return kunci(d) !== a.dataset.hapus; }); S.validasi = null; renderRencana(); }); });
    el.querySelectorAll('select[data-tambah]').forEach(function (s) { s.addEventListener('change', function () {
      if (!s.value) return; const p = s.dataset.tambah.split('|'), dv = S.hasil.hari.filter(function (h) { return h.tanggal === p[0]; })[0].divisi.filter(function (x) { return x.divisi === p[1]; })[0], orang = dv.daftar.filter(function (x) { return x.id === s.value; })[0];
      S.daftar.push({ tanggal: p[0], idRelawan: s.value, nama: orang.nama, divisi: p[1], sumber: 'MANUAL', alasan: 'Ditambahkan manual oleh SIMSDM' }); S.validasi = null; renderRencana(); }); });
    const v = $('pgValidasi'); if (v) v.addEventListener('click', validasi);
    const sv = $('pgSimpan'); if (sv) sv.addEventListener('click', simpan);
    const aj = $('pgAjukan'); if (aj) aj.addEventListener('click', ajukan);
    const tr = $('pgTarik'); if (tr) tr.addEventListener('click', function () { tarik(S.batch.id, true); });
  }
  async function muatRencana() { renderRencana(); }
  async function hitung() {
    try {
      const d = await sibuk('Menghitung rekomendasi…', function () { return api('hitungRekomendasiPergiliran', { tanggalMulai: S.awal, hari: S.n }); });
      S.hasil = d.hasil; S.masalah = d.masalahData || []; S.batch = null; S.validasi = null; S.daftar = [];
      d.hasil.hari.forEach(function (h) { h.divisi.forEach(function (dv) { dv.libur.forEach(function (l) { S.daftar.push({ tanggal: h.tanggal, idRelawan: l.id, nama: l.nama, divisi: dv.divisi, sumber: 'OTOMATIS', alasan: l.alasan }); }); }); });
    } catch (e) { lapor(e.message || 'Gagal menghitung.'); }
    renderRencana();
  }
  const kirimDaftar = function () { return S.daftar.map(function (d) { return { tanggal: d.tanggal, idRelawan: d.idRelawan, sumber: d.sumber, alasan: d.alasan }; }); };
  async function validasi() { try { S.validasi = await api('validasiPergiliran', { tanggalMulai: S.awal, hari: S.n, daftar: kirimDaftar() }); } catch (e) { lapor(e.message); } renderRencana(); }
  async function simpan() {
    try { const r = await api('simpanDrafPergiliran', { tanggalMulai: S.awal, hari: S.n, daftar: kirimDaftar() }); S.batch = { id: r.idBatch }; S.validasi = { valid: true, kesalahan: [], peringatan: r.peringatan || [] }; info('Draf tersimpan (' + r.jumlah + ' libur). Belum diajukan dan belum mengubah jadwal.'); }
    catch (e) { lapor(e.message); } renderRencana();
  }
  async function ajukan() {
    if (!confirm('Ajukan ' + S.daftar.length + ' libur pergiliran ke SIKOP? Jadwal belum berubah sampai SIKOP menetapkan.')) return;
    try { const r = await api('ajukanPergiliran', { idBatch: S.batch.id }); info('Diajukan ke SIKOP: ' + r.diajukan + ' libur. Menunggu penetapan.'); S.hasil = null; S.daftar = []; S.batch = null; S.validasi = null; }
    catch (e) { lapor(e.message); } renderRencana();
  }
  async function tarik(idBatch, dariDraf) {
    const a = prompt('Alasan menarik (wajib):'); if (!a || !a.trim()) return;
    try { await api('tarikPengajuanPergiliran', { idBatch: idBatch, alasan: a.trim() }); info('Ditarik.'); if (dariDraf) { S.batch = null; S.hasil = null; S.daftar = []; } } catch (e) { lapor(e.message); }
    renderRencana();
  }
  /** Draf dan pengajuan yang sedang berjalan (belum ditetapkan SIKOP). */
  async function muatBerjalan() {
    const el = $('pgBerjalan'); if (!el) return;
    let d; try { d = await api('getRiwayatPergiliran', {}); } catch (e) { return; }
    const per = {}; d.items.filter(function (x) { return x.STATUS === 'REKOMENDASI' || x.STATUS === 'DIAJUKAN'; }).forEach(function (x) { (per[x.ID_BATCH] = per[x.ID_BATCH] || []).push(x); });
    const ids = Object.keys(per); if (!ids.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="pg-valid"><b>Draf dan pengajuan berjalan</b>' + ids.map(function (id) { const r = per[id], ajukanSudah = r[0].STATUS === 'DIAJUKAN';
      return '<div style="margin:6px 0">' + esc(id) + ' · ' + r.length + ' libur · <b>' + (ajukanSudah ? 'MENUNGGU PENETAPAN SIKOP' : 'DRAF (belum diajukan)') + '</b> · ' + esc(r.map(function (x) { return dmy(x.TANGGAL); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '))
        + ' <button type="button" class="btn-mini" data-ajukan="' + esc(id) + '"' + (ajukanSudah ? ' style="display:none"' : '') + '>Ajukan ke SIKOP</button> <button type="button" class="btn-mini" data-tarik="' + esc(id) + '">Tarik</button></div>'; }).join('') + '</div>';
    el.querySelectorAll('[data-ajukan]').forEach(function (b) { b.addEventListener('click', async function () { try { const r = await api('ajukanPergiliran', { idBatch: b.dataset.ajukan }); info('Diajukan: ' + r.diajukan + ' libur.'); } catch (e) { lapor(e.message); } muatBerjalan(); }); });
    el.querySelectorAll('[data-tarik]').forEach(function (b) { b.addEventListener('click', function () { tarik(b.dataset.tarik, false).then(muatBerjalan); }); });
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
  muatStruktur();
})();

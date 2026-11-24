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
  const angka = function (n) { return n === null || n === undefined || n === '' ? '–' : Number(n).toLocaleString('id-ID'); };
  const panel = $('panelPergiliran'); if (!panel) return;
  const tok = function () { return window.sppgAdminToken; };
  const S = { awal: minggu(isoLokal(new Date())), hasil: null, daftar: [], batch: null, masalah: [], validasi: null, keb: null };
  const kunci = function (d) { return d.tanggal + '|' + d.idRelawan; };
  const TAB = [['struktur', 'Struktur dan Penempatan'], ['kebutuhan', 'Kebutuhan dan Simulasi'], ['rencana', 'Rencana Pergiliran'], ['riwayat', 'Riwayat']];

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

  /* ---------------- KEBUTUHAN DAN SIMULASI ---------------- */
  async function muatKebutuhan() {
    const el = $('pg_kebutuhan'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    try { S.keb = await api('getKebutuhanTenagaAdmin'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    const k = S.keb;
    let html = '<h4 style="margin:4px 0 6px">Simulasi kebutuhan tenaga berdasarkan PM</h4><p class="pg-sub">Memakai PM terverifikasi dari SIPANDU (rata-rata sampai 30 hari operasional terakhir). Angka acuan 7–9, 7–9, 8–9, 9–11, 4 hanya <b>data simulasi sementara</b>, bukan standar resmi.</p>'
      + '<div class="pg-bar"><label>PM simulasi tambahan (pisahkan koma) <input type="text" id="pgPmTambah" placeholder="mis. 1500, 2000"></label><button type="button" class="btn-mini primary" id="pgSimulasi">Jalankan Simulasi</button></div><div id="pgSimHasil"></div>';
    html += '<h4 style="margin:16px 0 6px">Master kebutuhan tenaga per divisi</h4><p class="pg-sub">Angka <b>tidak punya nilai bawaan</b>: SIMSDM mengisi, <b>SIKOP mengesahkan</b>. Hanya yang DISAHKAN dipakai mesin. Mengubah baris yang sudah disahkan mengembalikannya ke DRAF.</p>';
    html += '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Divisi</th><th>Mode</th><th>Min</th><th>Ideal</th><th>PM/tenaga maks</th><th>PM/tenaga ideal</th><th>Min/shift</th><th>Jabatan wajib</th><th>Maks libur/pekan</th><th>Larang beruntun</th><th>Boleh libur</th><th>Status</th><th></th></tr></thead><tbody>';
    html += k.kebutuhan.map(function (b) { return '<tr><td>' + esc(b.divisi) + '</td><td>' + esc(b.mode) + '</td><td>' + angka(b.minTetap) + '</td><td>' + angka(b.idealTetap) + '</td><td>' + angka(b.pmMaks) + '</td><td>' + angka(b.pmIdeal) + '</td><td>' + b.minPerShift + '</td><td>' + esc(b.jabatanWajibTeks || '–') + '</td><td>' + (b.maksLiburMinggu >= 99 ? 'bebas' : b.maksLiburMinggu) + '</td><td>' + (b.larangBeruntun ? 'Ya' : 'Tidak') + '</td><td>' + (b.bolehLibur ? 'Ya' : 'Tidak') + '</td><td><b>' + esc(b.status) + '</b></td><td><button type="button" class="btn-mini" data-ubah="' + esc(b.divisi) + '">Ubah</button></td></tr>'; }).join('') || '<tr><td colspan="13">Belum ada kebutuhan yang diisi.</td></tr>';
    html += '</tbody></table></div>';
    html += '<h4 style="margin:14px 0 6px">Isi / ubah kebutuhan</h4><div class="pg-form"><label>Divisi <select id="pgfDivisi">' + k.referensi.map(function (r) { return '<option value="' + esc(r.divisi) + '">' + esc(r.divisi) + ' (aktif ' + r.relawanAktif + ', berjabatan ' + r.berJabatan + ')</option>'; }).join('') + '</select></label>'
      + '<label>Mode <select id="pgfMode">' + k.mode.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></label>'
      + '<label>Minimum tetap <input type="number" min="0" id="pgfMin"></label><label>Ideal tetap <input type="number" min="0" id="pgfIdeal"></label>'
      + '<label>PM per tenaga (maks) <input type="number" min="0" id="pgfPmMaks"></label><label>PM per tenaga (ideal) <input type="number" min="0" id="pgfPmIdeal"></label>'
      + '<label>Minimum per shift <input type="number" min="0" id="pgfShift" placeholder="1"></label><label>Maks libur per orang/pekan <input type="number" min="0" id="pgfMaks" placeholder="kosong = bebas"></label><label>Larang libur beruntun <select id="pgfLarang"><option>TIDAK</option><option>YA</option></select></label>'
      + '<label style="grid-column:1/-1">Jabatan wajib (format: Nama:jumlah;Nama2:jumlah) <input type="text" id="pgfJab"></label><label>Boleh libur <select id="pgfBoleh"><option>YA</option><option>TIDAK</option></select></label><label style="grid-column:1/-1">Catatan <input type="text" id="pgfCat"></label>'
      + '<div style="grid-column:1/-1"><button type="button" class="btn-mini primary" id="pgfSimpan">Simpan (DRAF)</button></div></div>';
    el.innerHTML = html;
    $('pgSimulasi').addEventListener('click', simulasi);
    el.querySelectorAll('[data-ubah]').forEach(function (b) { b.addEventListener('click', function () { const x = k.kebutuhan.filter(function (r) { return r.divisi === b.dataset.ubah; })[0]; $('pgfDivisi').value = x.divisi; $('pgfMode').value = x.mode; $('pgfMin').value = x.minTetap === null ? '' : x.minTetap; $('pgfIdeal').value = x.idealTetap === null ? '' : x.idealTetap; $('pgfPmMaks').value = x.pmMaks || ''; $('pgfPmIdeal').value = x.pmIdeal || ''; $('pgfShift').value = x.minPerShift; $('pgfMaks').value = x.maksLiburMinggu >= 99 ? '' : x.maksLiburMinggu; $('pgfLarang').value = x.larangBeruntun ? 'YA' : 'TIDAK'; $('pgfJab').value = x.jabatanWajibTeks; $('pgfBoleh').value = x.bolehLibur ? 'YA' : 'TIDAK'; $('pgfCat').value = x.catatan || ''; $('pgfMin').scrollIntoView({ block: 'center' }); }); });
    $('pgfSimpan').addEventListener('click', async function () { try { await api('simpanKebutuhanTenaga', { divisi: $('pgfDivisi').value, mode: $('pgfMode').value, minTetap: $('pgfMin').value, idealTetap: $('pgfIdeal').value, pmPerTenagaMaks: $('pgfPmMaks').value, pmPerTenagaIdeal: $('pgfPmIdeal').value, minPerShift: $('pgfShift').value, maksLiburMinggu: $('pgfMaks').value, larangBeruntun: $('pgfLarang').value, jabatanWajib: $('pgfJab').value, bolehLibur: $('pgfBoleh').value, catatan: $('pgfCat').value }); info('Tersimpan sebagai DRAF. SIKOP perlu mengesahkan agar dipakai.'); } catch (e) { lapor(e.message); } muatKebutuhan(); });
  }
  const NAMA_STATUS = { CUKUP: 'Cukup', DI_BAWAH_IDEAL: 'Di bawah ideal', KURANG_TENAGA: 'KURANG tenaga', BELUM_DIISI: 'Master belum diisi', TAK_TERHITUNG: 'Tak terhitung' };
  const NAMA_ACUAN = { DALAM_ACUAN: 'dalam acuan', DI_BAWAH_ACUAN: 'di bawah acuan', DI_ATAS_ACUAN: 'di atas acuan', TANPA_ACUAN: 'tanpa acuan' };
  async function simulasi() {
    const el = $('pgSimHasil'), tambah = String($('pgPmTambah').value || '').split(/[,;\s]+/).filter(Boolean).map(Number).filter(function (n) { return n > 0; });
    let d; try { d = await sibuk('Menghitung simulasi…', function () { return api('simulasiKebutuhanTenaga', { pmTambahan: tambah }); }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    const p = d.pm;
    let html = '<div class="dp-chips" style="margin:8px 0"><span class="dp-chip"><b>' + p.hariValid + '/' + p.target + '</b>hari operasional valid</span><span class="dp-chip"><b>' + angka(p.rata) + '</b>PM rata-rata</span><span class="dp-chip"><b>' + angka(p.terendah) + '</b>PM terendah</span><span class="dp-chip"><b>' + angka(p.tertinggi) + '</b>PM tertinggi</span></div>';
    p.keterbatasan.forEach(function (m) { html += '<div class="pg-alert">' + esc(m) + '</div>'; });
    if (!d.tingkat.length) html += '<p class="pg-sub">Belum ada tingkat PM untuk disimulasikan. Isi PM simulasi tambahan di atas.</p>';
    else {
      html += '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Divisi</th><th>Kapasitas (aktif)</th><th>Acuan sementara</th>' + d.tingkat.map(function (t) { return '<th>' + esc(t.label) + '<br>PM ' + angka(t.pm) + '</th>'; }).join('') + '</tr></thead><tbody>';
      html += d.divisi.map(function (dv) {
        return '<tr><td><b>' + esc(dv.divisi) + '</b><br><span class="pg-sub">' + (dv.statusKebutuhan === 'BELUM_DIISI' ? 'master belum diisi' : 'master ' + esc(dv.statusKebutuhan)) + '</span></td><td>' + dv.kapasitas + '</td><td>' + (dv.acuan ? dv.acuan.min + (dv.acuan.maks !== dv.acuan.min ? '–' + dv.acuan.maks : '') + '<br><span class="pg-sub">' + NAMA_ACUAN[dv.statusAcuan] + '</span>' : '–') + '</td>'
          + dv.perTingkat.map(function (x) { return '<td class="' + (x.status === 'KURANG_TENAGA' ? 'pg-err' : '') + '">' + (x.min === null ? '<span class="pg-sub">' + esc(NAMA_STATUS[x.status] || '') + '</span>' : 'min <b>' + x.min + '</b> · ideal <b>' + x.ideal + '</b><br>libur maks ' + x.ruangLibur + '<br><span class="pg-sub">' + esc(NAMA_STATUS[x.status]) + '</span>') + '</td>'; }).join('') + '</tr>';
      }).join('');
      html += '</tbody></table></div>';
    }
    d.catatan.forEach(function (c) { html += '<p class="pg-sub">• ' + esc(c) + '</p>'; });
    el.innerHTML = html;
  }

  /* ---------------- RENCANA PERGILIRAN ---------------- */
  function renderRencana() {
    const el = $('pg_rencana'), h = S.hasil;
    let html = '<div id="pgBerjalan"></div><div class="pg-bar"><label>Pekan (Minggu–Jumat) <input type="date" id="pgAwal" value="' + esc(S.awal) + '"></label><button type="button" class="btn-mini primary" id="pgHitung">Hitung Rekomendasi</button>'
      + (S.batch ? '<span class="pg-badge">Draf tersimpan: ' + esc(S.batch.id) + '</span>' : '') + '</div>';
    S.masalah.forEach(function (m) { html += '<div class="pg-alert">' + esc(m) + '</div>'; });
    if (!h) { el.innerHTML = html + '<p class="pg-sub">Pilih pekan lalu tekan "Hitung Rekomendasi". Sistem hanya merekomendasikan libur bila tenaga tetap memenuhi minimum, posisi wajib, dan shift. Hasilnya berupa pengajuan ke SIKOP; jadwal belum berubah.</p>'; ikatRencana(); muatBerjalan(); return; }
    const r = h.ringkas, total = S.daftar.length;
    html += '<div class="dp-chips" style="margin:8px 0"><span class="dp-chip"><b>' + total + '</b>libur dipilih</span><span class="dp-chip"><b>' + r.pemerataan.relawanMendapatLibur + '</b>relawan mendapat giliran</span><span class="dp-chip"><b>' + r.pemerataan.terbanyak + '</b>maks libur/orang</span><span class="dp-chip"><b>' + r.jumlahPeringatan + '</b>peringatan</span></div>';
    h.hari.forEach(function (hr) {
      html += '<div class="pg-hari"><div class="pg-hari-judul">' + esc(hr.nama) + ' ' + dmy(hr.tanggal) + (hr.operasional ? (hr.pm !== null ? ' · PM ' + angka(hr.pm) + (hr.pmSumber === 'PEKAN_SEBELUMNYA' ? ' (acuan pekan lalu)' : '') : ' · PM belum tersedia') : ' · <i>tidak beroperasi (Kalender)</i>') + '</div>';
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
      html += '</div>';
    });
    if (S.validasi) html += '<div class="pg-valid">' + (S.validasi.valid ? '<b>✓ Valid.</b>' : '<b>✕ Tidak valid:</b>') + S.validasi.kesalahan.map(function (k) { return '<div class="pg-err">' + esc(k.pesan) + '</div>'; }).join('') + S.validasi.peringatan.map(function (k) { return '<div class="pg-warn">' + esc(k.pesan) + '</div>'; }).join('') + '</div>';
    html += '<div class="pg-aksi">' + (S.batch ? '<button type="button" class="btn-mini primary" id="pgAjukan">Ajukan ke SIKOP</button><button type="button" class="btn-mini" id="pgTarik">Tarik Draf</button>'
      : '<button type="button" class="btn-mini" id="pgValidasi">Validasi</button><button type="button" class="btn-mini primary" id="pgSimpan"' + (total ? '' : ' disabled') + '>Simpan Draf</button>') + '</div>'
      + '<p class="pg-sub">Mengajukan <b>tidak</b> mengubah jadwal. Relawan yang dipilih baru berstatus Libur Pergiliran setelah SIKOP menetapkan.</p>';
    el.innerHTML = html; ikatRencana(); muatBerjalan();
  }
  function ikatRencana() {
    const el = $('pg_rencana');
    $('pgAwal').addEventListener('change', function (e) { if (e.target.value) { S.awal = minggu(e.target.value); e.target.value = S.awal; } });
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
      const d = await sibuk('Menghitung rekomendasi…', function () { return api('hitungRekomendasiPergiliran', { tanggalMulai: S.awal, hari: 6 }); });
      S.hasil = d.hasil; S.masalah = d.masalahData || []; S.batch = null; S.validasi = null; S.daftar = [];
      d.hasil.hari.forEach(function (h) { h.divisi.forEach(function (dv) { dv.libur.forEach(function (l) { S.daftar.push({ tanggal: h.tanggal, idRelawan: l.id, nama: l.nama, divisi: dv.divisi, sumber: 'OTOMATIS', alasan: l.alasan }); }); }); });
    } catch (e) { lapor(e.message || 'Gagal menghitung.'); }
    renderRencana();
  }
  const kirimDaftar = function () { return S.daftar.map(function (d) { return { tanggal: d.tanggal, idRelawan: d.idRelawan, sumber: d.sumber, alasan: d.alasan }; }); };
  async function validasi() { try { S.validasi = await api('validasiPergiliran', { tanggalMulai: S.awal, hari: 6, daftar: kirimDaftar() }); } catch (e) { lapor(e.message); } renderRencana(); }
  async function simpan() {
    try { const r = await api('simpanDrafPergiliran', { tanggalMulai: S.awal, hari: 6, daftar: kirimDaftar() }); S.batch = { id: r.idBatch }; S.validasi = { valid: true, kesalahan: [], peringatan: r.peringatan || [] }; info('Draf tersimpan (' + r.jumlah + ' libur). Belum diajukan dan belum mengubah jadwal.'); }
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

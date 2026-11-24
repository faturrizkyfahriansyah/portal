// SPPG JEUNGJING — Pendataan satuan pendidikan (halaman PIC sekolah, 25 Nov 2026).
// PIC mengisi lewat formulir ramah-HP (atau menempel dari Excel); hasilnya diunduh Admin sebagai file Excel berformat contoh (DARUL UMMAH).
// Validasi memakai CoreSekolah (identik dengan server; server tetap memeriksa ulang). NISN/NIK tersamar di daftar.
// Dimuat SEBELUM pendataan-3b.js; memakai alat bantu window.P3BKit dan navigasi window.PortalPic.
(function () {
  var C = window.CoreSekolah;
  var Q = { idi: '', nama: '', ring: null, items: [], filter: 'Semua', cari: '', form: null, tempel: null, memuat: false, busy: false };
  var POS = { '1': { nama: 'Siswa', ikon: 'siswa', sub: 'Isi NISN 10 angka' }, '2': { nama: 'Guru', ikon: 'guru', sub: 'Isi NIK 16 angka' }, '3': { nama: 'Tendik', ikon: 'tendik', sub: 'Tenaga kependidikan, NIK 16 angka' } };
  var FIELDS = ['posisi', 'nomor', 'nama', 'tgl', 'gender', 'ortu', 'status'];
  function K() { return window.P3BKit; }
  function h() { return K().h.apply(null, arguments); }
  function app() { return document.getElementById('app'); }
  function rerender() { K().render(); }
  function ke(view) { K().S.view = view; rerender(); window.scrollTo(0, 0); }
  function dialog(judul, isi, tombol) {
    var m = document.getElementById('modal'), acts = h('div', { class: 'acts' });
    tombol.forEach(function (b) { acts.appendChild(h('button', { class: 'btn ' + (b.cls || ''), text: b.label, onclick: function () { m.textContent = ''; if (b.fn) b.fn(); } })); });
    m.textContent = ''; m.appendChild(h('div', { class: 'ov' }, h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true' }, h('h3', { text: judul }), h('div', { text: isi }), acts)));
  }
  function api(aksi, p) { return K().api(aksi, Object.assign({ idInstansi: Q.idi }, p || {})); }
  function tampilNav(formulir) { var P = window.PortalPic; if (P && P.nav) { app().appendChild(P.nav(formulir)); document.body.classList.add(formulir ? 'ada-nav-desk' : 'ada-nav'); } }   // formulir: sidebar hanya di komputer
  function topbar(judul, kecil, kembali) {
    var S = K().S;
    return h('header', { class: 'top' }, h('div', { class: 'in' },
      kembali ? h('button', { class: 'back', onclick: kembali.fn }, K().ikon('kiri', 18), kembali.label) : null,
      h('small', { text: kecil || ('Pendataan • ' + (S.pic ? S.pic.nama : '')) }), h('h1', { text: judul })));
  }
  function nomorTersamar(n) { return n || ''; }

  /* ---------- muat ---------- */
  async function muat() {
    Q.memuat = true; rerender();
    try {
      var r = await Promise.all([api('getRingkasanSekolah3B'), api('getDaftarSekolah3B')]);
      Q.ring = r[0].jumlah; Q.items = r[1].items;
    } catch (e) { K().toast(e.message); }
    Q.memuat = false; rerender();
  }
  function buka(id, nama) {
    var S = K().S; Q.idi = id; Q.nama = nama; Q.ring = null; Q.items = []; Q.filter = 'Semua'; Q.cari = ''; Q.form = null; Q.tempel = null;
    S.idi = id; S.nmPos = nama; S.view = 'sekolah'; K().simpanSesi(); muat(); window.scrollTo(0, 0);
  }

  /* ---------- daftar ---------- */
  function kartu(x) {
    var st = POS[x.posisi] || POS['1'], meta = [x.tgl, x.gender === 'L' ? 'Laki-laki' : 'Perempuan', 'No. ' + nomorTersamar(x.nomor)];
    var c = h('div', { class: 'item sekolah p' + x.posisi, 'data-id': x.id },
      h('span', { class: 'tag pos', text: st.nama }), !x.status ? h('span', { class: 'tag stale', text: 'Tidak menerima' }) : null, x.perluKonfirmasi ? h('span', { class: 'tag cat', text: 'Periksa NISN' }) : null,
      h('div', { class: 'nm', text: x.nama }), h('div', { class: 'meta', text: meta.join(' • ') }), x.posisi === 1 && x.ortu && x.ortu !== '-' ? h('div', { class: 'meta', text: 'Orang tua/wali: ' + x.ortu }) : null);
    var acts = h('div', { class: 'acts' });
    if (x.perluKonfirmasi) acts.appendChild(h('button', { class: 'btn sm', text: 'Sudah benar', onclick: function () { konfirmasi([x.id]); } }));
    acts.appendChild(h('button', { class: 'btn sm sec', text: 'Ubah', onclick: function () { bukaForm(x.posisi, x.id); } }));
    acts.appendChild(h('button', { class: 'btn sm del', text: 'Hapus', onclick: function () {
      dialog('Hapus data ini?', x.nama + ' akan dihapus dari daftar dan tidak ikut diunduh.', [{ label: 'Batal', cls: 'sec' }, { label: 'Ya, hapus', cls: 'del', fn: function () { hapus(x.id); } }]);
    } }));
    c.appendChild(acts); return c;
  }
  async function hapus(id) {
    try { await api('hapusSekolah3B', { idRekam: id }); K().toast('Dihapus.'); } catch (e) { K().toast(e.message); }
    muat();
  }
  async function konfirmasi(ids) {
    Q.busy = true; rerender();
    try { var r = await api('konfirmasiSekolah3B', { ids: ids }); K().toast(r.dikonfirmasi + ' data ditandai sudah benar.'); } catch (e) { K().toast(e.message); }
    Q.busy = false; muat();
  }
  function renderDaftar() {
    var r = Q.ring || { siswa: 0, guru: 0, tendik: 0, total: 0, perluKonfirmasi: 0, tidakMenerima: 0 }, a = app();
    a.appendChild(topbar(Q.nama, null, { label: 'Beranda', fn: function () { var S = K().S; if (window.PortalPic) window.PortalPic.segar(); S.view = 'beranda'; S.idi = ''; S.nmPos = ''; K().simpanSesi(); rerender(); window.scrollTo(0, 0); } }));
    var wrap = h('div', { class: 'wrap', id: 'sekolahDaftar' });
    var P = window.PortalPic;
    if (P && P.kartuKemajuan) {
      var rt = P.ringkasanTempat(Q.idi), sw = r.siswa || 0;
      wrap.appendChild(P.kartuKemajuan(rt ? Object.assign({}, rt, { terisi: sw, kurang: Math.max(0, (rt.target || 0) - sw), persen: rt.target > 0 ? Math.min(100, Math.round(sw * 100 / rt.target)) : 0, status: rt.target > 0 ? (sw >= rt.target ? 'LENGKAP' : (sw > 0 ? 'SEBAGIAN' : 'BELUM')) : (sw > 0 ? 'TANPA_TARGET' : 'BELUM') }) : null));
    }
    wrap.appendChild(h('div', { class: 'tip', style: 'margin-top:0', text: 'Isi data siswa, guru, dan tenaga kependidikan yang menerima makan bergizi.' }));
    if (r.perluKonfirmasi) {
      wrap.appendChild(h('div', { class: 'ban', role: 'status' }, h('b', { text: r.perluKonfirmasi + ' NISN perlu diperiksa' }),
        h('span', { text: 'Angka 0 di depan NISN hilang saat disalin dari Excel, jadi dilengkapi otomatis. Periksa NISN-nya, lalu ketuk "Sudah benar". Data ini belum ikut diunduh Admin.' }),
        h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn sm', disabled: Q.busy, text: 'Semua sudah benar (' + r.perluKonfirmasi + ')', onclick: function () {
          dialog('Semua NISN sudah benar?', 'Pastikan sudah memeriksa NISN yang ditandai "Periksa NISN". Setelah ini data siap diunduh Admin.', [{ label: 'Batal', cls: 'sec' }, { label: 'Ya, sudah benar', fn: function () { konfirmasi(Q.items.filter(function (x) { return x.perluKonfirmasi; }).map(function (x) { return x.id; })); } }]);
        } }))));
    }
    wrap.appendChild(h('h2', { text: 'Siapa yang mau didata?' }));
    var kats = h('div', { class: 'kats' });
    ['1', '2', '3'].forEach(function (p) {
      var st = POS[p], n = p === '1' ? r.siswa : p === '2' ? r.guru : r.tendik;
      kats.appendChild(h('button', { class: 'kat pos', 'data-pos': p, onclick: function () { bukaForm(Number(p)); } }, h('div', { class: 'ic' }, K().ikon(st.ikon)), h('div', null, h('b', { text: st.nama }), h('span', { class: 's', text: st.sub })), h('div', { class: 'n', text: String(n || 0) })));
    });
    wrap.appendChild(kats);
    wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnTempel', style: 'margin-top:12px', onclick: function () { bukaTempel(); } }, K().ikon('tempel', 20), 'Tempel banyak data dari Excel'));
    wrap.appendChild(h('h2', { text: 'Data yang sudah masuk (' + (r.total || 0) + ')' }));
    var chips = h('div', { class: 'chips' });
    ['Semua', 'Siswa', 'Guru', 'Tendik'].concat(r.perluKonfirmasi ? ['Periksa NISN'] : []).forEach(function (k) {
      chips.appendChild(h('button', { class: 'chip', 'aria-pressed': String(Q.filter === k), text: k, onclick: function () { Q.filter = k; rerender(); } }));
    });
    wrap.appendChild(chips);
    var cari = h('input', { type: 'text', id: 'cariSekolah', placeholder: 'Cari nama…', autocomplete: 'off', style: 'width:100%;border:2px solid var(--line);border-radius:12px;padding:10px 14px;font-size:17px;min-height:48px;margin-bottom:12px' });
    cari.value = Q.cari; wrap.appendChild(cari);
    var daftar = h('div', { id: 'sekolahItems' }); wrap.appendChild(daftar);
    function isiDaftar() {
      daftar.textContent = '';
      var q = C.normNama(Q.cari), list = Q.items.filter(function (x) {
        if (Q.filter === 'Siswa' && x.posisi !== 1 || Q.filter === 'Guru' && x.posisi !== 2 || Q.filter === 'Tendik' && x.posisi !== 3 || Q.filter === 'Periksa NISN' && !x.perluKonfirmasi) return false;
        return !q || x.nama.indexOf(q) >= 0;
      });
      if (Q.memuat && !Q.items.length) daftar.appendChild(h('div', { class: 'empty', text: 'Memuat data…' }));
      else if (!list.length) daftar.appendChild(h('div', { class: 'empty', text: Q.items.length ? 'Tidak ada yang cocok.' : 'Belum ada data. Pilih Siswa, Guru, atau Tendik di atas untuk mulai.' }));
      list.slice(0, 300).forEach(function (x) { daftar.appendChild(kartu(x)); });
      if (list.length > 300) daftar.appendChild(h('div', { class: 'tip', text: 'Menampilkan 300 pertama. Pakai kolom cari untuk menemukan yang lain.' }));
    }
    cari.addEventListener('input', function () { Q.cari = cari.value; isiDaftar(); });
    isiDaftar();
    a.appendChild(wrap); tampilNav();
  }

  /* ---------- formulir ---------- */
  function formBaru(posisi, v) { return { id: null, v: Object.assign({ posisi: String(posisi || 1), nomor: '', nama: '', tgl: '', gender: '', ortu: '', status: 'true' }, v || {}), touched: {}, submitted: false, nodes: {}, srv: {} }; }
  async function bukaForm(posisi, id) {
    if (!id) { Q.form = formBaru(posisi); ke('sekolahForm'); return; }
    try {
      var d = await api('getSekolah3B', { idRekam: id });
      Q.form = formBaru(d.posisi, { nomor: d.nomor, nama: d.nama, tgl: d.tgl, gender: d.gender, ortu: d.ortu === '-' ? '' : d.ortu, status: d.status ? 'true' : 'false' }); Q.form.id = id; ke('sekolahForm');
    } catch (e) { K().toast(e.message); }
  }
  function periksa() { return C.validate(Q.form.v, C.todayUTC(), {}); }
  function tampilkanGalat() {
    var f = Q.form, res = periksa();
    FIELDS.forEach(function (k) {
      var n = f.nodes[k]; if (!n) return;
      var m = f.srv[k] || ((f.touched[k] || f.submitted) ? res.errors[k] : ''), baik = !res.errors[k] && f.v[k] !== '' && (f.touched[k] || f.submitted);
      n.msg.textContent = m || ''; n.fld.className = 'fld' + (m ? ' bad' : baik ? ' good' : '');
    });
    var tip = f.nodes.nomor && f.nodes.nomor.tip;
    if (tip) { var tgt = f.v.posisi === '1' ? 10 : 16, len = f.v.nomor.replace(/\s/g, '').length; tip.textContent = len + ' angka' + (len === tgt ? ' (sudah sesuai)' : ' (perlu ' + tgt + ')'); }
    var tt = f.nodes.tgl && f.nodes.tgl.tip; if (tt) tt.textContent = f.v.tgl.length ? '' : 'Ketik angkanya saja, garis miring otomatis. Contoh: 17082015';
    return res;
  }
  function field(k, label, hint, input) {
    var msg = h('div', { class: 'msg err', 'aria-live': 'polite' }), tip = h('div', { class: 'tip', style: 'display:none' }), fld = h('div', { class: 'fld', 'data-f': k }, h('label', { for: 'f_' + k, text: label }), h('div', { class: 'hint', text: hint || '' }), input, msg);
    Q.form.nodes[k] = { fld: fld, msg: msg, tip: null }; return fld;
  }
  function inputTeks(k, o) {
    var f = Q.form, el = h('input', Object.assign({ type: 'text', id: 'f_' + k, autocomplete: 'off', autocapitalize: 'characters' }, o || {}));
    el.value = f.v[k] || '';
    el.addEventListener('input', function () {
      var v = el.value;
      if (k === 'nomor') v = v.replace(/\D/g, '').slice(0, 20);
      else if (k === 'tgl') v = C.maskDate(v);
      else v = v.toUpperCase();
      if (v !== el.value) el.value = v;
      f.v[k] = v; delete f.srv[k]; if (k === 'nomor' || k === 'posisi') delete f.srv.nomor; tampilkanGalat();
    });
    el.addEventListener('blur', function () { f.touched[k] = true; tampilkanGalat(); });
    return el;
  }
  function segmen(k, pilihan, onUbah) {
    var f = Q.form, box = h('div', { class: 'seg', role: 'group', style: pilihan.length === 3 ? 'grid-template-columns:repeat(3,1fr)' : '' });
    pilihan.forEach(function (p) {
      var b = h('button', { type: 'button', 'aria-pressed': String(f.v[k] === p[0]), 'data-v': p[0], text: p[1], onclick: function () {
        f.v[k] = p[0]; f.touched[k] = true; delete f.srv[k]; Array.prototype.forEach.call(box.children, function (x) { x.setAttribute('aria-pressed', String(x.dataset.v === p[0])); }); if (onUbah) onUbah(); tampilkanGalat();
      } }); box.appendChild(b);
    });
    return box;
  }
  function renderForm() {
    var f = Q.form, a = app(), edit = !!f.id, S = K().S;
    a.appendChild(topbar(edit ? 'Ubah data' : 'Tambah data', null, { label: 'Daftar', fn: function () { Q.form = null; ke('sekolah'); } }));
    var wrap = h('div', { class: 'wrap', id: 'sekolahForm' });
    f.nodes = {};
    var ortuHint = h('div', { class: 'hint' }), ortuLabel;
    function sesuaikan() {
      var sis = f.v.posisi === '1';
      ortuHint.textContent = sis ? 'Nama ayah/ibu/wali. Wajib untuk siswa.' : 'Boleh dikosongkan (otomatis diisi tanda -).';
      var nm = f.nodes.nomor; if (nm) { nm.fld.querySelector('label').textContent = sis ? 'NISN (10 angka)' : 'NIK (16 angka)'; nm.fld.querySelector('.hint').textContent = sis ? 'Nomor Induk Siswa Nasional. Ketik juga angka 0 di depan bila ada.' : 'Nomor Induk Kependudukan di KTP.'; }
      var og = f.nodes.ortu; if (og) og.fld.querySelector('label').textContent = sis ? 'Nama orang tua / wali' : 'Nama orang tua / wali (boleh kosong)';
    }
    wrap.appendChild(h('h2', { text: 'Yang didata', style: 'margin-top:4px' }));
    var fp = h('div', { class: 'fld', 'data-f': 'posisi' }); f.nodes.posisi = { fld: fp, msg: h('div', { class: 'msg err' }), tip: null };
    fp.appendChild(segmen('posisi', [['1', 'Siswa'], ['2', 'Guru'], ['3', 'Tendik']], function () { delete f.srv.nomor; sesuaikan(); })); fp.appendChild(f.nodes.posisi.msg); wrap.appendChild(fp);
    var nomor = inputTeks('nomor', { inputmode: 'numeric', maxlength: '20', placeholder: 'angka saja' });
    var fn = field('nomor', 'NISN (10 angka)', '', nomor); var tipN = h('div', { class: 'meta', style: 'font-size:14px;color:var(--mut);margin-top:4px' }); fn.insertBefore(tipN, fn.lastChild); f.nodes.nomor.tip = tipN; wrap.appendChild(fn);
    wrap.appendChild(field('nama', 'Nama lengkap', 'Sesuai ijazah/KTP. Huruf besar otomatis.', inputTeks('nama', { maxlength: '100', class: 'up', placeholder: 'NAMA LENGKAP' })));
    var tg = field('tgl', 'Tanggal lahir', 'Format hari/bulan/tahun.', inputTeks('tgl', { inputmode: 'numeric', maxlength: '10', placeholder: 'DD/MM/TTTT' })); var tipT = h('div', { class: 'meta', style: 'font-size:14px;color:var(--mut);margin-top:4px' }); tg.insertBefore(tipT, tg.lastChild); f.nodes.tgl.tip = tipT; wrap.appendChild(tg);
    wrap.appendChild(field('gender', 'Jenis kelamin', '', segmen('gender', [['L', 'Laki-laki'], ['P', 'Perempuan']])));
    var og = field('ortu', 'Nama orang tua / wali', '', inputTeks('ortu', { maxlength: '100', class: 'up', placeholder: 'NAMA ORANG TUA' })); wrap.appendChild(og);
    wrap.appendChild(field('status', 'Status menerima makan', 'Pilih "Tidak menerima" bila yang bersangkutan tidak ikut program.', segmen('status', [['true', 'Menerima'], ['false', 'Tidak menerima']])));
    var bar = h('div', { class: 'bar sekbar' }, h('div', { class: 'in' },
      h('button', { class: 'btn sec', id: 'btnSimpanLagi', disabled: Q.busy || edit, style: edit ? 'display:none' : '', text: 'Simpan & tambah lagi', onclick: function () { kirim(true); } }),
      h('button', { class: 'btn', id: 'btnSimpanSekolah', disabled: Q.busy, text: Q.busy ? 'Menyimpan…' : 'Simpan', onclick: function () { kirim(false); } })));
    a.appendChild(wrap); a.appendChild(bar); tampilNav(true); sesuaikan(); tampilkanGalat();
    ['nomor'].forEach(function () {});
  }
  async function kirim(lagi) {
    var f = Q.form; f.submitted = true; var res = tampilkanGalat(), bad = Object.keys(res.errors);
    if (bad.length) { var k0 = FIELDS.filter(function (k) { return res.errors[k]; })[0]; f.nodes[k0].fld.scrollIntoView({ block: 'center', behavior: 'smooth' }); K().toast('Ada ' + bad.length + ' isian yang perlu diperbaiki'); return; }
    Q.busy = true; document.getElementById('btnSimpanSekolah').disabled = true;
    try {
      var d = res.data, r = await api('simpanSekolah3B', { idRekam: f.id || '', posisi: d.posisi, nomor: d.nomor, nama: d.nama, tgl: d.tgl, gender: d.gender, ortu: d.ortu === '-' ? '' : d.ortu, status: d.status });
      Q.busy = false;
      if (!r.ok) { f.srv = r.errors || {}; rerender(); var s0 = FIELDS.filter(function (k) { return f.srv[k]; })[0]; if (s0 && Q.form.nodes[s0]) Q.form.nodes[s0].fld.scrollIntoView({ block: 'center', behavior: 'smooth' }); K().toast('Server menolak: periksa isian yang bertanda merah'); return; }
      K().toast('Tersimpan');
      if (lagi) { Q.form = formBaru(d.posisi, { status: 'true' }); rerender(); window.scrollTo(0, 0); muatDiam(); }
      else { Q.form = null; K().S.view = 'sekolah'; muat(); window.scrollTo(0, 0); }
    } catch (e) { Q.busy = false; K().toast(e.message); if (Q.form) rerender(); }
  }
  async function muatDiam() { try { var r = await Promise.all([api('getRingkasanSekolah3B'), api('getDaftarSekolah3B')]); Q.ring = r[0].jumlah; Q.items = r[1].items; } catch (e) { /* diamkan */ } }

  /* ---------- tempel dari Excel ---------- */
  function bukaTempel() { Q.tempel = { teks: '', posisi: '1', hasil: null, baris: null, busy: false }; ke('sekolahTempel'); }
  function renderTempel() {
    var T = Q.tempel, a = app();
    a.appendChild(topbar('Tempel dari Excel', null, { label: 'Daftar', fn: function () { Q.tempel = null; ke('sekolah'); } }));
    var wrap = h('div', { class: 'wrap', id: 'sekolahTempel' });
    wrap.appendChild(h('div', { class: 'tip', style: 'margin-top:0' }, h('b', { text: 'Cara: ' }), 'di Excel, blok kolom NISN/NIK sampai Status Menerima (tanpa baris judul bila bisa), salin (Ctrl+C), lalu tempel di kotak di bawah. Urutan kolom: NISN/NIK, Nama, Tanggal Lahir, Jenis Kelamin (L/P atau 392/64), Nama Orang Tua, Posisi (1/2/3), Status (true/false). Kolom Posisi dan Status boleh tidak ada.'));
    wrap.appendChild(h('div', { class: 'fld', style: 'margin-top:12px' }, h('label', { text: 'Bila kolom Posisi tidak ada, semua baris ini adalah:' }),
      (function () { var box = h('div', { class: 'seg', style: 'grid-template-columns:repeat(3,1fr)' }); [['1', 'Siswa'], ['2', 'Guru'], ['3', 'Tendik']].forEach(function (p) { box.appendChild(h('button', { type: 'button', 'data-v': p[0], 'aria-pressed': String(T.posisi === p[0]), text: p[1], onclick: function () { T.posisi = p[0]; T.hasil = null; rerender(); } })); }); return box; })()));
    var ta = h('textarea', { id: 'tempelTeks', rows: '8', placeholder: 'Tempel di sini…', spellcheck: 'false', style: 'width:100%;border:2px solid var(--line);border-radius:12px;padding:12px;font-size:15px;font-family:ui-monospace,Menlo,monospace;min-height:160px' });
    ta.value = T.teks; ta.addEventListener('input', function () { T.teks = ta.value; T.hasil = null; var b = document.getElementById('btnPeriksa'); if (b) b.disabled = !ta.value.trim(); var h2 = document.getElementById('hasilTempel'); if (h2) h2.textContent = ''; });
    wrap.appendChild(ta);
    var msg = h('div', { class: 'msg err', id: 'msgTempel', role: 'alert' }); wrap.appendChild(msg);
    wrap.appendChild(h('button', { class: 'btn block', id: 'btnPeriksa', style: 'margin-top:10px', disabled: T.busy || !T.teks.trim(), text: T.busy ? 'Memeriksa…' : 'Periksa data', onclick: periksaTempel }));
    var hasil = h('div', { id: 'hasilTempel' }); wrap.appendChild(hasil);
    if (T.hasil) gambarHasil(hasil);
    a.appendChild(wrap); tampilNav();
  }
  async function periksaTempel() {
    var T = Q.tempel, msg = document.getElementById('msgTempel'); msg.textContent = '';
    var baris = C.parseTempelan(T.teks, T.posisi);
    if (!baris.length) { msg.textContent = 'Tidak ada baris data yang terbaca. Pastikan Anda menyalin dari Excel (kolom terpisah tab).'; return; }
    if (baris.length > C.SEK.MAKS_TEMPEL) { msg.textContent = 'Terlalu banyak: ' + baris.length + ' baris. Maksimal ' + C.SEK.MAKS_TEMPEL + ' baris sekali tempel. Bagi menjadi beberapa bagian.'; return; }
    T.busy = true; rerender();
    try { var r = await api('simpanBanyakSekolah3B', { baris: baris, pratinjau: true }); T.baris = baris; T.hasil = r; }
    catch (e) { T.busy = false; rerender(); var m2 = document.getElementById('msgTempel'); if (m2) m2.textContent = e.message; return; }
    T.busy = false; rerender();
  }
  function gambarHasil(el) {
    var T = Q.tempel, r = T.hasil, j = r.jumlah, simpan = j.valid;
    el.appendChild(h('h2', { text: 'Hasil pemeriksaan' }));
    var ring = h('div', { class: 'ringkas-tempel' });
    [['Siap disimpan', j.valid, 'ok'], ['Sudah ada (dilewati)', j.dilewati, 'wrn'], ['Perlu dibetulkan', j.galat, 'err']].forEach(function (b) { ring.appendChild(h('div', { class: 'rk ' + b[2] }, h('b', { text: String(b[1]) }), h('span', { text: b[0] }))); });
    el.appendChild(ring);
    if (j.perluKonfirmasi) el.appendChild(h('div', { class: 'ban' }, h('b', { text: j.perluKonfirmasi + ' NISN dilengkapi angka 0 otomatis' }), h('span', { text: 'NISN 8-9 angka dilengkapi sampai 10 angka (angka 0 di depan hilang di Excel). Setelah disimpan, periksa lalu ketuk "Sudah benar".' })));
    var bermasalah = r.hasil.filter(function (x) { return !x.ok && !x.dilewati; });
    if (bermasalah.length) {
      el.appendChild(h('h2', { text: 'Baris yang perlu dibetulkan' }));
      bermasalah.slice(0, 50).forEach(function (x) {
        el.appendChild(h('div', { class: 'item galat', 'data-no': String(x.no) }, h('div', { class: 'nm', text: 'Baris ' + x.no + (x.nama ? ': ' + x.nama : '') }), h('div', { class: 'meta', style: 'color:var(--red)', text: Object.keys(x.errors).map(function (k) { return x.errors[k]; }).join(' ') })));
      });
      if (bermasalah.length > 50) el.appendChild(h('div', { class: 'tip', text: '…dan ' + (bermasalah.length - 50) + ' baris lain. Betulkan dulu di Excel, lalu tempel lagi.' }));
      el.appendChild(h('div', { class: 'tip', text: 'Anda boleh menyimpan yang sudah benar sekarang, lalu membetulkan sisanya di Excel dan menempelkannya lagi (yang sudah tersimpan otomatis dilewati).' }));
    }
    el.appendChild(h('button', { class: 'btn block', id: 'btnSimpanTempel', style: 'margin-top:12px', disabled: !simpan || T.busy, text: simpan ? 'Simpan ' + simpan + ' data yang benar' : 'Belum ada data yang bisa disimpan', onclick: function () {
      dialog('Simpan ' + simpan + ' data?', 'Data yang benar akan disimpan ke daftar. Baris yang masih bermasalah tidak ikut disimpan.', [{ label: 'Batal', cls: 'sec' }, { label: 'Ya, simpan', fn: simpanTempel }]);
    } }));
  }
  async function simpanTempel() {
    var T = Q.tempel; T.busy = true; rerender();
    try {
      var r = await api('simpanBanyakSekolah3B', { baris: T.baris, pratinjau: false });
      K().toast(r.tersimpan + ' data tersimpan.'); Q.tempel = null; K().S.view = 'sekolah'; T.busy = false; muat(); window.scrollTo(0, 0);
    } catch (e) { T.busy = false; K().toast(e.message); rerender(); }
  }

  window.PendataanSekolah = {
    buka: buka,
    tampil: function (v) { return v === 'sekolah' || v === 'sekolahForm' || v === 'sekolahTempel'; },
    render: function () {
      var v = K().S.view;
      if (v === 'sekolahForm' && Q.form) renderForm(); else if (v === 'sekolahTempel' && Q.tempel) renderTempel(); else renderDaftar();
    }
  };
})();

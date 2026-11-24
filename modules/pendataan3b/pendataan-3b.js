// SPPG JEUNGJING — Pendataan Penerima Manfaat 3B (halaman PIC Posyandu, 24 Nov 2026).
// PIC masuk dengan nomor HP + PIN (diatur Admin). Data disimpan di server (spreadsheet 3B terpisah); NIK di daftar disamarkan.
// Validasi memakai Core3B (sama dengan server). Server tetap memeriksa ulang semua aturan.
(function () {
  var C = window.Core3B, app = document.getElementById('app');
  var KSTYLE = {
    'Ibu Hamil':    { cls: 'hamil',  icon: 'hamil',  sub: 'Isi data ibu dan HPHT' },
    'Ibu Menyusui': { cls: 'busui',  icon: 'busui',  sub: 'Isi data ibu dan data bayinya' },
    'Balita':       { cls: 'balita', icon: 'balita', sub: 'Isi data balita dan data ibunya' }
  };
  var KATS = ['Ibu Hamil', 'Ibu Menyusui', 'Balita'];
  var KEY = 'p3b.sesi.v1', MODE_PIC = window.P3B_MODE === 'pic';
  var JENIS = { POSYANDU: 'Posyandu', SEKOLAH: 'Satuan pendidikan' };
  var S = { view: 'login', token: '', pic: null, instansi: [], posyandu: [], idi: '', nmPos: '', ring: null, peng: {}, items: [], filter: 'Semua', form: null, busy: false, memuat: false };

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k]; else if (k === 'class') el.className = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c === null || c === undefined || c === false) continue; el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return el;
  }
  /* Ikon garis (SVG, mengikuti warna teks): pengganti emoji agar tampilan resmi. Semua string di bawah adalah konstanta. */
  var IKON = {
    beranda: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    menu: 'M4 11h16a8 8 0 0 1-16 0zM9 3.5c0 2 2 2 2 4M14 3.5c0 2 2 2 2 4',
    pendataan: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M8 12h8M8 16h6',
    profil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
    bantuan: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01',
    hamil: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    busui: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
    balita: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2M9 9.5h.01M15 9.5h.01',
    posyandu: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-5h4v5',
    sekolah: 'M3 10l9-5 9 5-9 5-9-5zM7 12.5V17c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.5M21 10v6',
    siswa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
    guru: 'M3 4h18v11H3zM12 15v5M8 20h8',
    tendik: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
    lokasi: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    tempel: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M12 11v6M9 14l3 3 3-3',
    kiri: 'M15 5l-7 7 7 7'
  };
  function ikon(nama, ukuran) {
    var w = document.createElement('span'); w.className = 'svgi'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<svg viewBox="0 0 24 24" width="' + (ukuran || 24) + '" height="' + (ukuran || 24) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + (IKON[nama] || '') + '"/></svg>';
    return w;
  }
  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 3200); }
  function dialog(title, body, buttons) {
    var m = document.getElementById('modal'), acts = h('div', { class: 'acts' });
    buttons.forEach(function (b) { acts.appendChild(h('button', { class: 'btn ' + (b.cls || ''), text: b.label, onclick: function () { m.textContent = ''; if (b.fn) b.fn(); } })); });
    m.textContent = ''; m.appendChild(h('div', { class: 'ov' }, h('div', { class: 'dlg', role: 'dialog' }, h('h3', { text: title }), h('div', { text: body }), acts)));
  }
  function dmy(s) { s = String(s || '').slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : ''; }

  /* ---------- API & sesi ---------- */
  function simpanSesi() { try { sessionStorage.setItem(KEY, JSON.stringify({ token: S.token, pic: S.pic, instansi: S.instansi, posyandu: S.posyandu, idi: S.idi, nmPos: S.nmPos, view: S.view === 'home' ? 'home' : '' })); } catch (e) {} }
  function hapusSesi() { try { sessionStorage.removeItem(KEY); } catch (e) {} }
  function api(aksi, p) {
    return apiPost(aksi, Object.assign({ token: S.token, idInstansi: S.idi }, p || {})).catch(function (e) {
      if (/Sesi telah berakhir|Sesi tidak valid/.test(e.message || '')) { keluar(true); throw new Error('Sesi berakhir. Silakan masuk lagi.'); }
      throw e;
    });
  }
  function keluar(diam) {
    if (S.token) { try { apiPost('logoutPic3B', { token: S.token }, 8000); } catch (e) {} }
    S.token = ''; S.pic = null; S.view = 'login'; S.items = []; S.ring = null; S.idi = ''; hapusSesi(); if (window.PortalPic) window.PortalPic.reset(); render();
    if (!diam) toast('Anda sudah keluar.');
  }

  /* ---------- muat data ---------- */
  async function muat() {
    S.memuat = true; render();
    try {
      var r = await Promise.all([api('getRingkasan3B'), api('getDaftarPenerima3B')]);
      var p = r[0].posyandu.filter(function (x) { return x.id === S.idi; })[0];
      S.ring = p ? p.jumlah : { 'Ibu Hamil': 0, 'Ibu Menyusui': 0, 'Balita': 0, total: 0, perluDiperbarui: 0 };
      S.peng = r[0].pengaturan; S.items = r[1].items;
    } catch (e) { toast(e.message); }
    S.memuat = false; render();
  }

  /* ---------- layar masuk ---------- */
  function renderLogin() {
    var hp = h('input', { type: 'tel', id: 'hp', inputmode: 'tel', autocomplete: 'tel', placeholder: '08xxxxxxxxxx' });
    var pin = h('input', { type: 'password', id: 'pin', inputmode: 'numeric', maxlength: '6', autocomplete: 'current-password', placeholder: '6 angka' });
    var msg = h('div', { class: 'msg err', 'aria-live': 'polite' });
    var btn = h('button', { class: 'btn block', text: 'Masuk', onclick: go });
    async function go() {
      msg.textContent = ''; var nomor = hp.value.trim(), p = pin.value.trim();
      if (!nomor || !/^\d{6}$/.test(p)) { msg.textContent = 'Isi nomor HP dan PIN 6 angka.'; return; }
      btn.disabled = true; btn.textContent = 'Memeriksa…';
      try {
        var d = await apiPost('loginPic3B', { nomorHp: nomor, pin: p });
        S.token = d.token; S.pic = d.pic; S.instansi = d.instansi || d.posyandu; S.posyandu = d.posyandu; S.peng = d.pengaturan || {};
        if (MODE_PIC && window.PortalPic) { window.PortalPic.reset(); S.idi = ''; S.nmPos = ''; S.view = 'beranda'; simpanSesi(); render(); return; }   // Portal PIC terpadu (25 Nov 2026): semua PIC masuk ke Beranda
        if (S.instansi.length === 1 && d.posyandu.length === 1) { S.idi = d.posyandu[0].id; S.nmPos = d.posyandu[0].nama; S.view = 'home'; simpanSesi(); muat(); }
        else { S.idi = ''; S.view = 'pilih'; simpanSesi(); render(); }
      } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Masuk'; pin.value = ''; }
    }
    pin.addEventListener('input', function () { pin.value = pin.value.replace(/\D/g, '').slice(0, 6); });
    pin.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
    app.appendChild(h('header', { class: 'top' }, h('div', { class: 'in' }, h('small', { text: 'Portal SPPG • PIC' }), h('h1', { text: MODE_PIC ? 'Portal PIC' : 'Pendataan Penerima Manfaat 3B' }), h('p', { text: MODE_PIC ? 'Masuk sebagai PIC Posyandu atau satuan pendidikan' : 'Masuk sebagai PIC Posyandu' }))));
    app.appendChild(h('div', { class: 'wrap' },
      h('div', { class: 'note', text: 'Halaman ini berisi data pribadi (NIK). Jangan berikan PIN Anda kepada orang lain.' }),
      h('div', { class: 'fld' }, h('label', { for: 'hp', text: 'Nomor HP' }), h('div', { class: 'hint', text: 'Nomor HP yang terdaftar sebagai PIC di SPPG.' }), hp),
      h('div', { class: 'fld' }, h('label', { for: 'pin', text: 'PIN' }), h('div', { class: 'hint', text: 'PIN 6 angka dari Admin SPPG. Lupa PIN? Minta Admin mengatur ulang.' }), pin),
      msg, btn,
      h('p', { id: 'linkOtpPic', style: 'display:none;text-align:center;margin-top:18px;font-size:16px;font-weight:700' }, h('a', { href: 'verifikasi.html?jenis=pic&mode=lupa', text: 'Belum punya PIN atau lupa PIN? Minta kode lewat WhatsApp' })),
      h('p', { style: 'text-align:center;margin-top:18px;font-size:14px' }, h('a', { href: 'masuk.html', text: 'Bukan akun PIC? Pilih jenis akun lain' }))));
    apiPost('getStatusOtp', {}).then(function (r) { var e = document.getElementById('linkOtpPic'); if (e && r && r.aktif) e.style.display = ''; }).catch(function () { /* tautan tetap tersembunyi */ });
  }
  function renderPilih() {
    var wrap = h('div', { class: 'wrap' }, h('h2', { text: 'Tanggung jawab Anda' }));
    var kats = h('div', { class: 'kats' });
    S.instansi.forEach(function (p) {
      var pos = p.jenis === 'POSYANDU';
      var el = h('button', { class: 'kat pos', disabled: !pos, style: pos ? '' : 'opacity:.6;cursor:default', onclick: function () { if (!pos) return; S.idi = p.id; S.nmPos = p.nama; S.view = 'home'; S.filter = 'Semua'; simpanSesi(); muat(); } },
        h('div', { class: 'ic' }, ikon(pos ? 'posyandu' : 'sekolah')), h('div', null, h('b', { text: p.nama }), h('span', { class: 's', text: pos ? 'Posyandu • Pendataan Penerima Manfaat 3B' : (JENIS[p.jenis] || 'Instansi') + ' • segera hadir' })));
      kats.appendChild(el);
    });
    wrap.appendChild(kats);
    if (!S.posyandu.length) wrap.appendChild(h('div', { class: 'note', text: 'Fitur untuk satuan pendidikan sedang disiapkan. Saat ini yang tersedia: Pendataan 3B untuk Posyandu.' }));
    app.appendChild(h('header', { class: 'top' }, h('div', { class: 'in' }, h('button', { class: 'keluar', text: 'Keluar', onclick: function () { keluar(); } }), h('small', { text: 'Halo, ' + (S.pic ? S.pic.nama : '') }), h('h1', { text: MODE_PIC ? 'Portal PIC' : 'Pendataan 3B' }))));
    app.appendChild(wrap);
  }

  /* ---------- layar Posyandu ---------- */
  function renderHome() {
    var r = S.ring || { 'Ibu Hamil': 0, 'Ibu Menyusui': 0, 'Balita': 0, total: 0, perluDiperbarui: 0 };
    var top = h('header', { class: 'top' }, h('div', { class: 'in' },
      h('button', { class: 'keluar', text: 'Keluar', onclick: function () { keluar(); } }),
      (MODE_PIC && window.PortalPic) ? h('button', { class: 'back', onclick: function () { S.view = 'beranda'; S.idi = ''; S.items = []; S.ring = null; simpanSesi(); render(); window.scrollTo(0, 0); } }, ikon('kiri', 18), 'Beranda')
        : S.instansi.length > 1 ? h('button', { class: 'back', onclick: function () { S.view = 'pilih'; S.idi = ''; simpanSesi(); render(); } }, ikon('kiri', 18), 'Kembali ke daftar') : null,
      h('small', { text: 'Posyandu • ' + (S.pic ? S.pic.nama : '') }), h('h1', { text: S.nmPos })));
    var wrap = h('div', { class: 'wrap' });
    if (S.peng && S.peng.putaranTanggal) {
      wrap.appendChild(h('div', { class: 'ban' }, h('b', { text: 'Admin meminta data diperbarui (sejak ' + dmy(S.peng.putaranTanggal) + ')' }),
        h('span', { text: (S.peng.putaranCatatan ? S.peng.putaranCatatan + ' ' : '') + (r.perluDiperbarui ? 'Masih ' + r.perluDiperbarui + ' data yang belum diperbarui.' : 'Semua data sudah diperbarui. Terima kasih.') })));
    } else if (r.perluDiperbarui) {
      wrap.appendChild(h('div', { class: 'ban' }, h('b', { text: r.perluDiperbarui + ' data perlu diperbarui' }), h('span', { text: 'Periksa datanya. Bila tidak ada perubahan, ketuk "Masih sesuai".' })));
    }
    wrap.appendChild(h('h2', { text: 'Siapa yang mau didata?' }));
    var kats = h('div', { class: 'kats' });
    KATS.forEach(function (k) {
      var st = KSTYLE[k];
      kats.appendChild(h('button', { class: 'kat ' + st.cls, onclick: function () { bukaForm(k); } }, h('div', { class: 'ic' }, ikon(st.icon)), h('div', null, h('b', { text: k }), h('span', { class: 's', text: st.sub })), h('div', { class: 'n', text: String(r[k] || 0) })));
    });
    wrap.appendChild(kats);
    wrap.appendChild(h('h2', { text: 'Data yang sudah masuk (' + (r.total || 0) + ')' }));
    var chips = h('div', { class: 'chips' });
    ['Semua'].concat(KATS).concat(r.perluDiperbarui ? ['Perlu diperbarui'] : []).forEach(function (k) {
      chips.appendChild(h('button', { class: 'chip', 'aria-pressed': String(S.filter === k), text: k, onclick: function () { S.filter = k; render(); } }));
    });
    wrap.appendChild(chips);
    var list = S.items.filter(function (x) { return S.filter === 'Semua' || (S.filter === 'Perlu diperbarui' ? x.perluDiperbarui : x.kategori === S.filter); });
    if (S.memuat && !S.items.length) wrap.appendChild(h('div', { class: 'empty', text: 'Memuat data…' }));
    else if (!list.length) wrap.appendChild(h('div', { class: 'empty', text: 'Belum ada data. Pilih salah satu tombol di atas untuk mulai.' }));
    list.forEach(function (x) { wrap.appendChild(kartu(x)); });
    app.appendChild(top); app.appendChild(wrap);
    if (r.perluDiperbarui) {
      app.appendChild(h('div', { class: 'bar' }, h('div', { class: 'in' }, h('button', { class: 'btn', disabled: S.busy, text: 'Semua yang belum diperbarui masih sesuai (' + r.perluDiperbarui + ')', onclick: function () {
        dialog('Konfirmasi semua?', 'Hanya untuk data yang memang tidak ada perubahan. Data yang sudah lewat batas usia tidak ikut. ' + r.perluDiperbarui + ' data akan ditandai masih sesuai.', [
          { label: 'Batal', cls: 'sec' }, { label: 'Ya, masih sesuai', fn: function () { konfirmasi({ semuaPerluDiperbarui: true }); } }]);
      } }))));
    }
    if (MODE_PIC && window.PortalPic) { app.appendChild(window.PortalPic.nav()); document.body.classList.add('ada-nav'); }   // navigasi Portal PIC tetap ada di layar Pendataan 3B
  }
  async function konfirmasi(p) {
    S.busy = true; render();
    try { var r = await api('konfirmasiPenerima3B', p); toast(r.dikonfirmasi + ' data ditandai masih sesuai' + (r.dilewatiMelampauiBatasUsia ? '. ' + r.dilewatiMelampauiBatasUsia + ' data harus diperiksa/diubah dulu (lewat batas usia).' : '.')); }
    catch (e) { toast(e.message); }
    S.busy = false; muat();
  }
  function kartu(x) {
    var st = KSTYLE[x.kategori], meta;
    if (x.kategori === 'Ibu Hamil') meta = 'HPHT ' + x.hpht;
    else if (x.kategori === 'Ibu Menyusui') meta = 'Anak: ' + C.normNama(x.anak_nama) + ' (lahir ' + x.anak_tgl + ')';
    else meta = (x.gender === 'L' ? 'Laki-laki' : 'Perempuan') + ' • Ibu: ' + C.normNama(x.ibu_nama);
    return h('div', { class: 'item ' + st.cls },
      h('span', { class: 'tag ' + st.cls, text: x.kategori }), x.perluDiperbarui ? h('span', { class: 'tag stale', text: 'Perlu diperbarui' }) : null, x.catatan ? h('span', { class: 'tag cat', text: 'Cek usia' }) : null,
      h('div', { class: 'nm', text: C.normNama(x.nama) }),
      h('div', { class: 'meta', text: 'Lahir ' + x.tgl + ' • NIK ' + x.nik }),
      h('div', { class: 'meta', text: meta }),
      x.catatan ? h('div', { class: 'meta', style: 'color:var(--red)', text: x.catatan + ' Ubah datanya atau hubungi Admin.' }) : null,
      h('div', { class: 'meta', text: 'Terakhir diperbarui ' + dmy(x.diperbaruiPada) }),
      h('div', { class: 'acts' },
        h('button', { class: 'btn sec sm', text: 'Ubah', onclick: function () { bukaForm(x.kategori, x.id); } }),
        x.perluDiperbarui && !x.catatan ? h('button', { class: 'btn sec sm', text: 'Masih sesuai', onclick: function () { konfirmasi({ ids: [x.id] }); } }) : null,
        h('button', { class: 'btn del sm', text: 'Hapus', onclick: function () {
          dialog('Hapus data ini?', C.normNama(x.nama) + ' (' + x.kategori + ') akan dihapus dari daftar.', [{ label: 'Batal', cls: 'sec' }, { label: 'Hapus', cls: 'del', fn: async function () {
            try { await api('hapusPenerima3B', { id: x.id }); toast('Data dihapus'); muat(); } catch (e) { toast(e.message); } } }]);
        } })));
  }

  /* ---------- formulir ---------- */
  var FDEF = { nama: { type: 'text', up: true }, tgl: { type: 'date' }, gender: { type: 'gender' }, nik: { type: 'nik' }, hpht: { type: 'date' }, anak_nama: { type: 'text', up: true }, anak_tgl: { type: 'date' }, anak_nik: { type: 'nik' }, ibu_nama: { type: 'text', up: true }, ibu_nik: { type: 'nik' } };
  var LABEL = {
    'Ibu Hamil': { _s1: 'Data ibu hamil', nama: ['Nama ibu', 'Tulis sesuai KTP, huruf besar. Tanpa titik atau angka.'], tgl: ['Tanggal lahir ibu', 'Contoh: 01/01/1995. Ketik angkanya saja, garis miring muncul sendiri.'], nik: ['NIK ibu', '16 angka sesuai KTP.'], hpht: ['HPHT (Hari Pertama Haid Terakhir)', 'Tanya ibu, atau lihat buku KIA. Contoh: 02/06/2026. Paling lama 11 bulan lalu.'] },
    'Ibu Menyusui': { _s1: 'Data ibu menyusui', _s2: 'Data anak (bayi)', nama: ['Nama ibu', 'Tulis sesuai KTP, huruf besar. Tanpa titik atau angka.'], tgl: ['Tanggal lahir ibu', 'Contoh: 01/01/1995.'], nik: ['NIK ibu', '16 angka sesuai KTP.'], anak_nama: ['Nama anak', 'Huruf besar. Contoh: NAOMI.'], anak_tgl: ['Tanggal lahir anak', 'Contoh: 01/01/2026. Anak maksimal 2 tahun.'], anak_nik: ['NIK anak', '16 angka sesuai KK atau akta lahir.'] },
    'Balita': { _s1: 'Data balita', _s2: 'Data ibu dari balita', nama: ['Nama balita', 'Huruf besar. Tanpa titik atau angka.'], tgl: ['Tanggal lahir balita', 'Contoh: 15/03/2025. Usia 6 sampai 59 bulan.'], gender: ['Jenis kelamin balita', ''], nik: ['NIK balita', '16 angka sesuai KK atau akta lahir.'], ibu_nama: ['Nama ibu', 'Huruf besar. Tanpa titik atau angka.'], ibu_nik: ['NIK ibu', '16 angka sesuai KTP ibu.'] }
  };
  async function bukaForm(kat, id) {
    var v = {}; C.FIELDS[kat].forEach(function (k) { v[k] = ''; });
    if (id) { try { var d = await api('getPenerima3B', { id: id }); C.FIELDS[kat].forEach(function (k) { v[k] = d[k] || ''; }); } catch (e) { toast(e.message); return; } }
    S.form = { kat: kat, id: id || null, v: v, touched: {}, submitted: false, nodes: {}, srv: {} }; S.view = 'form'; render(); window.scrollTo(0, 0);
  }
  function refresh() {
    var f = S.form, res = C.validate(f.kat, f.v, C.todayUTC(), []);
    C.FIELDS[f.kat].forEach(function (k) {
      var n = f.nodes[k]; if (!n) return;
      var show = f.touched[k] || f.submitted, val = f.v[k], err = res.errors[k] || (f.srv[k] || ''), wrn = res.warnings[k], filled = val && String(val).length;
      n.fld.classList.toggle('bad', !!(show && err)); n.fld.classList.toggle('good', !!(show && !err && filled));
      n.msg.className = 'msg';
      if (show && err) { n.msg.classList.add('err'); n.msg.textContent = err; }
      else if (show && wrn) { n.msg.classList.add('wrn'); n.msg.textContent = wrn; }
      else if (show && !err && filled) { n.msg.classList.add('ok'); n.msg.textContent = 'Sudah benar'; } else n.msg.textContent = '';
      if (n.tip) {
        var tip = '', tgl = C.parseDMY(f.v.tgl), g = f.kat === 'Balita' ? f.v.gender : 'P';
        if (k === 'nik' && tgl && (g === 'L' || g === 'P') && !res.errors.tgl) tip = 'Angka ke-7 sampai ke-12 NIK harus: ' + C.nikSegment(tgl, g) + '. Contoh: 317101' + C.nikSegment(tgl, g) + '0001.';
        n.tip.textContent = tip; n.tip.style.display = tip ? '' : 'none';
      }
    });
    return res;
  }
  function renderForm() {
    var f = S.form, kat = f.kat, L = LABEL[kat];
    var top = h('header', { class: 'top' }, h('div', { class: 'in' }, h('button', { class: 'back', onclick: kembali }, ikon('kiri', 18), 'Kembali'), h('small', { text: S.nmPos }), h('h1', { text: (f.id ? 'Ubah data ' : 'Tambah data ') + kat })));
    var wrap = h('div', { class: 'wrap' }), split = { 'Ibu Hamil': null, 'Ibu Menyusui': 'anak_nama', 'Balita': 'ibu_nama' }[kat];
    wrap.appendChild(h('div', { class: 'sec-h', text: L._s1 }));
    C.FIELDS[kat].forEach(function (k) { if (k === split) wrap.appendChild(h('div', { class: 'sec-h', text: L._s2 })); wrap.appendChild(fieldNode(k, L[k])); });
    var bar = h('div', { class: 'bar' }, h('div', { class: 'in' }, f.id ? null : h('button', { class: 'btn sec', text: 'Simpan & tambah lagi', disabled: S.busy, onclick: function () { kirim(true); } }), h('button', { class: 'btn', text: 'Simpan', disabled: S.busy, onclick: function () { kirim(false); } })));
    app.appendChild(top); app.appendChild(wrap); app.appendChild(bar);
    if (MODE_PIC && window.PortalPic) { app.appendChild(window.PortalPic.nav(true)); document.body.classList.add('ada-nav-desk'); }   // sidebar hanya di komputer
    refresh();
  }
  function fieldNode(k, lab) {
    var f = S.form, def = FDEF[k], fld = h('div', { class: 'fld' }), msg = h('div', { class: 'msg', 'aria-live': 'polite' }), tip = null, id = 'f_' + k;
    fld.appendChild(h('label', { for: id, text: lab[0] })); if (lab[1]) fld.appendChild(h('div', { class: 'hint', text: lab[1] }));
    if (def.type === 'gender') {
      var seg = h('div', { class: 'seg', role: 'group', 'aria-label': lab[0] });
      [['L', 'Laki-laki'], ['P', 'Perempuan']].forEach(function (g) {
        var b = h('button', { type: 'button', 'aria-pressed': String(f.v.gender === g[0]), text: g[1], onclick: function () { f.v.gender = g[0]; f.touched.gender = true; f.srv.gender = ''; Array.prototype.forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); }); refresh(); } });
        seg.appendChild(b);
      });
      fld.appendChild(seg);
    } else {
      var inp = h('input', { type: 'text', id: id, class: def.up ? 'up' : '', autocomplete: 'off', autocapitalize: def.up ? 'characters' : 'off', spellcheck: 'false' });
      if (def.type === 'date') { inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('placeholder', 'DD/MM/YYYY'); inp.setAttribute('maxlength', '10'); }
      if (def.type === 'nik') { inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('placeholder', '16 angka'); inp.setAttribute('maxlength', '16'); }
      inp.value = f.v[k] || '';
      inp.addEventListener('input', function () {
        var val = inp.value;
        if (def.type === 'date') { val = C.maskDate(val); inp.value = val; } else if (def.type === 'nik') { val = val.replace(/\D/g, '').slice(0, 16); inp.value = val; }
        f.v[k] = val; f.srv[k] = '';
        if ((def.type === 'nik' && val.length === 16) || (def.type === 'date' && val.length === 10)) f.touched[k] = true;
        refresh();
      });
      inp.addEventListener('blur', function () { f.touched[k] = true; refresh(); });
      fld.appendChild(inp);
      if (def.type === 'nik') {
        var count = h('div', { class: 'hint', style: 'margin:4px 0 0' }); inp.addEventListener('input', function () { count.textContent = inp.value.length + ' dari 16 angka'; }); count.textContent = inp.value.length + ' dari 16 angka'; fld.appendChild(count);
        if (k === 'nik') { tip = h('div', { class: 'tip', style: 'display:none' }); fld.appendChild(tip); }
      }
    }
    fld.appendChild(msg); f.nodes[k] = { fld: fld, msg: msg, tip: tip }; return fld;
  }
  function kembali() { S.view = 'home'; S.form = null; render(); window.scrollTo(0, 0); }
  async function kirim(lagi) {
    var f = S.form; f.submitted = true; var res = refresh(), bad = Object.keys(res.errors);
    if (bad.length) { var first = C.FIELDS[f.kat].filter(function (k) { return res.errors[k]; })[0]; f.nodes[first].fld.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Ada ' + bad.length + ' isian yang perlu diperbaiki'); return; }
    var body = { id: f.id || '', kategori: f.kat }; C.FIELDS[f.kat].forEach(function (k) { body[k] = /nama$/.test(k) ? C.normNama(f.v[k]) : f.v[k]; });
    S.busy = true;
    try {
      var r = await api('simpanPenerima3B', body); S.busy = false;
      if (!r.ok) { f.srv = r.errors || {}; var k0 = C.FIELDS[f.kat].filter(function (k) { return f.srv[k]; })[0]; render(); if (k0 && S.form.nodes[k0]) S.form.nodes[k0].fld.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Server menolak: periksa isian yang bertanda merah'); return; }
      toast('Tersimpan'); if (lagi) { await bukaForm(f.kat); } else { kembali(); muat(); }
      if (lagi) muat();
    } catch (e) { S.busy = false; toast(e.message); if (S.form) render(); }
  }

  function render() {
    app.textContent = ''; document.body.classList.remove('ada-nav', 'ada-nav-desk');
    if (S.view === 'login' || !S.token) renderLogin(); else if (MODE_PIC && window.PortalPic && window.PortalPic.tampil(S.view)) window.PortalPic.render(); else if (MODE_PIC && window.PendataanSekolah && window.PendataanSekolah.tampil(S.view)) window.PendataanSekolah.render(); else if (S.view === 'pilih') renderPilih(); else if (S.view === 'form' && S.form) renderForm(); else renderHome();
  }

  /* ---------- alat bantu untuk Portal PIC (portal-pic.js) ---------- */
  window.P3BKit = { h: h, ikon: ikon, toast: toast, S: S, api: api, keluar: keluar, simpanSesi: simpanSesi, render: render,
    bukaPendataan: function (id, nama) { S.idi = id; S.nmPos = nama; S.view = 'home'; S.filter = 'Semua'; S.items = []; S.ring = null; simpanSesi(); muat(); } };

  /* ---------- awal ---------- */
  (async function init() {
    try { var raw = sessionStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); if (o && o.token) { S.token = o.token; S.pic = o.pic; S.instansi = o.instansi || o.posyandu || []; S.posyandu = o.posyandu || []; S.idi = o.idi || ''; S.nmPos = o.nmPos || ''; S.view = S.idi ? 'home' : 'pilih'; if (MODE_PIC && window.PortalPic && !(o.view === 'home' && S.idi)) { S.idi = ''; S.view = 'beranda'; } } } } catch (e) {}
    if (S.token && S.idi) { render(); muat(); return; }
    if (S.token && MODE_PIC && window.PortalPic) { render(); return; }
    render();
    try { var st = await apiPost('getStatusModul3B', {}); if (!st.siap) toast('Modul belum disiapkan Admin.'); } catch (e) { /* diamkan */ }
  })();
})();

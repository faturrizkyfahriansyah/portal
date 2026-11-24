// SPPG JEUNGJING — Portal PIC terpadu (25 Nov 2026): layar Beranda, Menu Hari Ini, Pendataan, Profil PIC, Data Instansi, Bantuan.
// Berlaku untuk PIC Posyandu DAN PIC satuan pendidikan. Dimuat SEBELUM pendataan-3b.js; memakai alat bantu yang dibuka pendataan-3b.js (window.P3BKit).
// Pendataan 3B (khusus Posyandu) tetap di pendataan-3b.js; pendataan satuan pendidikan di pendataan-sekolah.js. Keduanya dibuka dari kartu di Beranda ATAU dari menu Pendataan (bilah bawah di HP, sidebar kiri di komputer).
(function () {
  var P = { tab: 'beranda', beranda: null, menu: null, profil: null, idi: '', data: null, memuat: false, galat: '', gantiPin: false, form: null };
  var WA_ADMIN = 'https://wa.me/6285694765370?text=' + encodeURIComponent('Halo Admin, saya PIC dan butuh bantuan di Portal PIC SPPG Jeungjing.');
  function waktu(s) { s = String(s || ''); return s.length >= 16 ? dmy(s) + ' ' + s.slice(11, 16) : (s || '-'); }
  function K() { return window.P3BKit; }
  function h() { return K().h.apply(null, arguments); }
  function dmy(s) { s = String(s || '').slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : ''; }

  function reset() { P.beranda = null; P.menu = null; P.profil = null; P.data = null; P.idi = ''; P.gantiPin = false; P.form = null; P.galat = ''; P.tab = 'beranda'; }
  function pindah(tab) {
    P.tab = tab; P.galat = ''; if (tab === 'beranda') P.beranda = null;   // ringkasan selalu segar
    if (tab !== 'instansi') { P.idi = ''; P.data = null; P.form = null; }
    var S = K().S; S.idi = ''; S.nmPos = ''; S.items = []; S.ring = null;
    if (tab === 'pendataan' && (S.instansi || []).length === 1) { bukaPendataanInstansi(S.instansi[0]); return; }   // satu instansi: langsung ke pendataannya
    S.view = tab; K().simpanSesi(); K().render(); window.scrollTo(0, 0);
  }
  function adalahPosyandu(x) { return x.posyandu === true || String(x.jenis || '').toUpperCase() === 'POSYANDU'; }
  /** Buka pendataan yang sesuai: Posyandu -> Pendataan 3B, satuan pendidikan -> pendataan siswa/guru/tendik. */
  function bukaPendataanInstansi(x) {
    if (adalahPosyandu(x)) K().bukaPendataan(x.id, x.nama);
    else if (window.PendataanSekolah) window.PendataanSekolah.buka(x.id, x.nama);
    else K().toast('Pendataan sekolah belum tersedia.');
  }

  async function muat(kunci, aksi, params, simpan) {
    if (P.memuat) return; P.memuat = true; P.galat = '';   // dipanggil dari dalam render: tidak render ulang di sini (agar tidak tergambar dua kali)
    try { simpan(await K().api(aksi, params)); } catch (e) { P.galat = e.message || 'Gagal memuat.'; }
    P.memuat = false; if (K().S.token) K().render();
  }

  /* ---------- kerangka ---------- */
  function topbar(judul, sub) {
    var S = K().S;
    return h('header', { class: 'top' }, h('div', { class: 'in' },
      h('button', { class: 'keluar', text: 'Keluar', onclick: function () { K().keluar(); } }),
      h('small', { text: sub || ('Halo, ' + (S.pic ? S.pic.nama : '')) }), h('h1', { text: judul })));
  }
  function navbawah() {
    var tabs = [['beranda', 'beranda', 'Beranda'], ['menu', 'menu', 'Menu'], ['pendataan', 'pendataan', 'Pendataan'], ['profil', 'profil', 'Profil'], ['bantuan', 'bantuan', 'Bantuan']];
    var v = K().S.view, aktif = (v === 'home' || v === 'sekolah' || v === 'pendataan') ? 'pendataan' : (P.tab === 'instansi' ? 'beranda' : P.tab);
    var nav = h('nav', { class: 'tabbar', id: 'navUtama', 'aria-label': 'Menu utama' });
    tabs.forEach(function (t) {
      nav.appendChild(h('button', { class: 'tab', 'data-tab': t[0], 'aria-current': aktif === t[0] ? 'page' : null, onclick: function () { pindah(t[0]); } }, h('span', { class: 'ti' }, K().ikon(t[1], 24)), h('span', { text: t[2] })));
    });
    return nav;
  }
  function pasang(top, wrap) { var app = document.getElementById('app'); app.appendChild(top); app.appendChild(wrap); app.appendChild(navbawah()); document.body.classList.add('ada-nav'); }
  function status(wrap) {
    if (P.memuat) wrap.appendChild(h('div', { class: 'empty', text: 'Memuat…' }));
    if (P.galat) wrap.appendChild(h('div', { class: 'note warn', role: 'alert' }, h('b', { text: 'Belum bisa dimuat. ' }), P.galat, h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn sm sec', text: 'Coba lagi', onclick: function () { P.galat = ''; P.beranda = P.menu = P.profil = null; P.data = null; K().render(); } }))));
  }

  /* ---------- menu makan ---------- */
  var BARIS_MENU = [['karbohidrat', 'Karbohidrat'], ['laukHewani', 'Lauk hewani'], ['laukNabati', 'Lauk nabati'], ['sayur', 'Sayur'], ['buah', 'Buah'], ['pelengkap', 'Pelengkap']];
  function kartuMenu(m, judul) {
    var c = h('div', { class: 'item menu' }, h('div', { class: 'nm', text: judul || ((m.hari || '') + ', ' + dmy(m.tanggal)) }));
    BARIS_MENU.forEach(function (b) { if (m[b[0]]) c.appendChild(h('div', { class: 'mrow' }, h('span', { class: 'ml', text: b[1] }), h('span', { text: m[b[0]] }))); });
    return c;
  }

  /* ---------- Beranda ---------- */
  function renderBeranda() {
    var S = K().S, B = P.beranda;
    if (!B && !P.memuat && !P.galat) muat('beranda', 'getBerandaPic3B', { idInstansi: '' }, function (d) { P.beranda = d; });
    var wrap = h('div', { class: 'wrap', id: 'berandaPic' });
    status(wrap);
    if (B) {
      (B.pengingat || []).forEach(function (p) {
        wrap.appendChild(h('div', { class: 'ban', role: 'status' }, h('b', { text: p.jenis === 'PROFIL' ? 'Data belum lengkap' : 'Perlu perhatian' }), h('span', { text: p.teks }),
          p.jenis === 'PROFIL' ? h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn sm', text: 'Lengkapi sekarang', onclick: function () { bukaInstansi(p.idInstansi); } })) : null));
      });
      wrap.appendChild(h('h2', { text: (B.instansi || []).length > 1 ? 'Tanggung jawab Anda' : 'Instansi Anda' }));
      var kats = h('div', { class: 'kats' });
      (B.instansi || []).forEach(function (x) {
        var kartu = h('div', { class: 'inst', 'data-id': x.id },
          h('div', { class: 'inst-h' }, h('div', { class: 'ic' }, K().ikon(x.posyandu ? 'posyandu' : 'sekolah')), h('div', null, h('b', { text: x.nama }), h('span', { class: 's', text: x.jenisLabel + (x.profilLengkap ? ' • data lengkap' : ' • data belum lengkap') }))),
          x.pendataan ? h('div', { class: 'meta ringkas', style: 'margin-top:8px;color:var(--mut);font-size:14px', text: 'Terdata: ' + x.pendataan.siswa + ' siswa · ' + x.pendataan.guru + ' guru · ' + x.pendataan.tendik + ' tendik' + (x.pendataan.perluKonfirmasi ? ' · ' + x.pendataan.perluKonfirmasi + ' perlu dikonfirmasi' : '') }) : null,
          h('div', { class: 'acts' },
            h('button', { class: 'btn sm', 'data-aksi': 'pendataan', text: x.posyandu ? 'Pendataan 3B' : 'Pendataan siswa & guru', onclick: function () { bukaPendataanInstansi(x); } }),
            h('button', { class: 'btn sm sec', text: 'Data instansi', onclick: function () { bukaInstansi(x.id); } })));
        kats.appendChild(kartu);
      });
      wrap.appendChild(kats);
      wrap.appendChild(h('h2', { text: 'Menu hari ini' }));
      if (B.menu && B.menu.hariIni) wrap.appendChild(kartuMenu(B.menu.hariIni));
      else wrap.appendChild(h('div', { class: 'empty', text: 'Menu belum ditetapkan. Cek lagi nanti.' }));
    }
    pasang(topbar('Portal PIC'), wrap);
  }

  /* ---------- Menu ---------- */
  function renderMenu() {
    var M = P.menu;
    if (!M && !P.memuat && !P.galat) muat('menu', 'getMenuPic3B', { idInstansi: '' }, function (d) { P.menu = d; });
    var wrap = h('div', { class: 'wrap', id: 'menuPic' });
    status(wrap);
    if (M) {
      wrap.appendChild(h('h2', { text: 'Menu hari ini' }));
      wrap.appendChild(M.hariIni ? kartuMenu(M.hariIni) : h('div', { class: 'empty', text: 'Menu hari ini belum ditetapkan.' }));
      wrap.appendChild(h('div', { class: 'tip', text: 'Ini menu hari operasional hari ini. Menu bisa berubah; menu resmi ditetapkan Admin SPPG.' }));
    }
    pasang(topbar('Menu hari ini'), wrap);
  }

  /* ---------- Pendataan (pilih instansi bila lebih dari satu) ---------- */
  function renderPendataan() {
    var wrap = h('div', { class: 'wrap', id: 'pendataanPic' });
    wrap.appendChild(h('h2', { text: 'Pilih yang mau didata' }));
    var kats = h('div', { class: 'kats' });
    (K().S.instansi || []).forEach(function (x) {
      var pos = adalahPosyandu(x);
      kats.appendChild(h('button', { class: 'kat pos', 'data-id': x.id, onclick: function () { bukaPendataanInstansi(x); } },
        h('div', { class: 'ic' }, K().ikon(pos ? 'posyandu' : 'sekolah')), h('div', null, h('b', { text: x.nama }), h('span', { class: 's', text: pos ? 'Pendataan 3B: ibu hamil, ibu menyusui, balita' : 'Pendataan siswa, guru, dan tenaga kependidikan' }))));
    });
    wrap.appendChild(kats);
    pasang(topbar('Pendataan'), wrap);
  }

  /* ---------- Profil ---------- */
  function renderProfil() {
    var R = P.profil;
    if (!R && !P.memuat && !P.galat) muat('profil', 'getProfilPic3B', { idInstansi: '' }, function (d) { P.profil = d; });
    var wrap = h('div', { class: 'wrap', id: 'profilPic' });
    status(wrap);
    if (R) {
      var kartu = h('div', { class: 'item' }, h('div', { class: 'nm', text: R.nama }));
      [['Jabatan', R.jabatan || '-'], ['Nomor HP', R.nomorHp || '-'], ['Rekening', R.rekening || '-'], ['PIN diatur', waktu(R.pinDiaturPada)], ['Terakhir masuk', waktu(R.terakhirMasuk)]].forEach(function (b) {
        kartu.appendChild(h('div', { class: 'mrow' }, h('span', { class: 'ml', text: b[0] }), h('span', { text: b[1] })));
      });
      wrap.appendChild(kartu);
      wrap.appendChild(h('div', { class: 'tip', text: R.catatan }));
      wrap.appendChild(h('h2', { text: 'Tanggung jawab' }));
      (R.instansi || []).forEach(function (x) { wrap.appendChild(h('div', { class: 'item' }, h('div', { class: 'nm', text: x.nama }), h('div', { class: 'meta', text: x.jenisLabel }))); });
      wrap.appendChild(h('h2', { text: 'Keamanan' }));
      if (!P.gantiPin) wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnGantiPin', text: 'Ganti PIN', onclick: function () { P.gantiPin = true; K().render(); } }));
      else wrap.appendChild(formPin());
    }
    pasang(topbar('Profil PIC'), wrap);
  }
  function inputPin(id, label, hint) {
    var el = h('input', { type: 'password', id: id, inputmode: 'numeric', maxlength: '6', autocomplete: id === 'pinLama' ? 'current-password' : 'new-password', placeholder: '6 angka' });
    el.addEventListener('input', function () { el.value = el.value.replace(/\D/g, '').slice(0, 6); });
    return { el: el, blok: h('div', { class: 'fld' }, h('label', { for: id, text: label }), hint ? h('div', { class: 'hint', text: hint }) : null, el) };
  }
  function formPin() {
    var a = inputPin('pinLama', 'PIN lama'), b = inputPin('pinBaru', 'PIN baru', '6 angka. Jangan 123456 atau angka kembar.'), c = inputPin('pinUlang', 'Ulangi PIN baru');
    var msg = h('div', { class: 'msg err', role: 'alert', 'aria-live': 'polite' }), btn = h('button', { class: 'btn block', id: 'btnSimpanPin', text: 'Simpan PIN baru' });
    btn.addEventListener('click', async function () {
      msg.textContent = '';
      if (!/^\d{6}$/.test(a.el.value) || !/^\d{6}$/.test(b.el.value)) { msg.textContent = 'PIN lama dan PIN baru harus 6 angka.'; return; }
      if (b.el.value !== c.el.value) { msg.textContent = 'PIN baru dan ulangannya tidak sama.'; return; }
      btn.disabled = true; btn.textContent = 'Menyimpan…';
      try {
        var d = await K().api('gantiPinPic3B', { idInstansi: '', pinLama: a.el.value, pinBaru: b.el.value });
        K().S.token = d.token; K().simpanSesi(); P.gantiPin = false; P.profil = null; K().toast('PIN berhasil diganti.'); K().render();
      } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Simpan PIN baru'; }
    });
    return h('div', { class: 'item' }, a.blok, b.blok, c.blok, msg, btn, h('button', { class: 'btn sec block', style: 'margin-top:10px', text: 'Batal', onclick: function () { P.gantiPin = false; K().render(); } }));
  }

  /* ---------- Data instansi ---------- */
  function bukaInstansi(id) { P.idi = id; P.data = null; P.form = null; P.tab = 'instansi'; K().S.view = 'instansi'; K().simpanSesi(); K().render(); window.scrollTo(0, 0); }
  function fld(id, label, hint, attrs, nilai) {
    var el = h('input', Object.assign({ type: 'text', id: id, autocomplete: 'off', value: nilai || '' }, attrs || {}));
    el.value = nilai || '';
    return { el: el, blok: h('div', { class: 'fld' }, h('label', { for: id, text: label }), hint ? h('div', { class: 'hint', text: hint }) : null, el) };
  }
  function ambilLokasi(el, msg) {
    if (!navigator.geolocation) { msg.textContent = 'Perangkat ini tidak mendukung lokasi. Tempel tautan Google Maps saja.'; return; }
    msg.textContent = 'Mencari lokasi…'; msg.className = 'msg wrn';
    navigator.geolocation.getCurrentPosition(function (pos) {
      el.value = pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6); el.dispatchEvent(new Event('input'));
      msg.textContent = 'Lokasi terisi. Ketuk "Simpan data" untuk menyimpan.'; msg.className = 'msg ok';
    }, function () { msg.textContent = 'Lokasi tidak bisa diambil (izin lokasi ditolak atau sinyal lemah). Tempel tautan Google Maps sebagai gantinya.'; msg.className = 'msg err'; }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function tautanPeta(v) {
    v = String(v || '').trim(); if (!v) return '';
    if (/^https:\/\//.test(v)) return v;
    var m = /^(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(v); return m ? 'https://www.google.com/maps?q=' + m[1] + ',' + m[2] : '';
  }
  function renderInstansi() {
    var D = P.data;
    if (!D && !P.memuat && !P.galat) muat('data', 'getDataInstansiPic3B', { idInstansi: P.idi }, function (d) { P.data = d; });
    var wrap = h('div', { class: 'wrap', id: 'instansiPic' });
    wrap.appendChild(h('button', { class: 'btn sm sec bk', onclick: function () { pindah('beranda'); } }, K().ikon('kiri', 16), 'Beranda'));
    status(wrap);
    if (D) {
      var d = D.dasar, p = D.profil;
      wrap.appendChild(h('div', { class: 'tip', style: 'margin-top:12px' }, 'Isi data di bawah supaya pengantaran makanan lancar. Nama dan alamat resmi dikelola Admin SPPG. ', h('a', { href: WA_ADMIN, target: '_blank', rel: 'noopener', text: 'Hubungi Admin' }), ' bila ada yang salah.'));
      var f = {
        kontakHp: fld('kontakHp', 'Nomor HP PIC yang bisa dihubungi', 'Untuk koordinasi pengantaran makanan.', { type: 'tel', inputmode: 'tel', placeholder: '08xxxxxxxxxx' }, p.kontakHp),
        email: fld('email', d.posyandu ? 'Email (boleh kosong)' : 'Email sekolah (boleh kosong)', 'Contoh: sdn1@sekolah.sch.id', { type: 'email', inputmode: 'email', placeholder: 'nama@contoh.id', maxlength: '80' }, p.email),
        jam: fld('jamTerimaMakan', 'Jam terima makanan', 'Contoh: 09:30', { inputmode: 'numeric', placeholder: 'JJ:MM', maxlength: '5' }, p.jamTerimaMakan),
        titik: fld('titikAntar', 'Titik antar', d.posyandu ? 'Contoh: teras rumah Ibu Kader / balai RW.' : 'Contoh: gerbang depan / ruang guru / pos satpam.', { maxlength: '120' }, p.titikAntar),
        lokasi: fld('lokasi', 'Lokasi di peta (boleh kosong)', 'Ketuk "Pakai lokasi saya" saat berada di titik antar, atau tempel tautan Google Maps.', { maxlength: '200', placeholder: '-6.917500, 107.619100' }, p.lokasi),
        cadN: fld('picCadanganNama', 'Nama PIC cadangan (boleh kosong)', 'Orang yang menerima bila Anda berhalangan.', { maxlength: '60' }, p.picCadanganNama),
        cadH: fld('picCadanganHp', 'Nomor HP PIC cadangan', null, { type: 'tel', inputmode: 'tel', placeholder: '08xxxxxxxxxx' }, p.picCadanganHp),
        cat: fld('catatan', 'Catatan khusus (boleh kosong)', d.posyandu ? 'Contoh: hari buka posyandu.' : 'Contoh: istirahat pukul 09:45, ada siswa alergi.', { maxlength: '200' }, p.catatan)
      };
      ['kontakHp', 'email', 'jam', 'titik'].forEach(function (k) { wrap.appendChild(f[k].blok); });
      var lokMsg = h('div', { class: 'msg', 'aria-live': 'polite' }), peta = h('a', { id: 'petaLink', target: '_blank', rel: 'noopener', style: 'display:none;margin-left:10px;font-size:15px', text: 'Lihat di Google Maps' });
      function segarPeta() { var u = tautanPeta(f.lokasi.el.value); if (u) { peta.href = u; peta.style.display = 'inline'; } else peta.style.display = 'none'; }
      f.lokasi.el.addEventListener('input', segarPeta);
      f.lokasi.blok.appendChild(h('div', { style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn sm sec', id: 'btnLokasi', onclick: function () { ambilLokasi(f.lokasi.el, lokMsg); } }, K().ikon('lokasi', 18), 'Pakai lokasi saya'), peta));
      f.lokasi.blok.appendChild(lokMsg); segarPeta();
      wrap.appendChild(f.lokasi.blok);
      wrap.appendChild(h('div', { class: 'sec-h', text: 'PIC cadangan' }));
      ['cadN', 'cadH', 'cat'].forEach(function (k) { wrap.appendChild(f[k].blok); });
      var msg = h('div', { class: 'msg err', role: 'alert', 'aria-live': 'polite' }), btn = h('button', { class: 'btn block', id: 'btnSimpanInstansi', text: 'Simpan data' });
      btn.addEventListener('click', async function () {
        msg.textContent = ''; btn.disabled = true; btn.textContent = 'Menyimpan…';
        try {
          var r = await K().api('simpanDataInstansiPic3B', { idInstansi: P.idi, kontakHp: f.kontakHp.el.value, email: f.email.el.value, jamTerimaMakan: f.jam.el.value, titikAntar: f.titik.el.value, lokasi: f.lokasi.el.value, picCadanganNama: f.cadN.el.value, picCadanganHp: f.cadH.el.value, catatan: f.cat.el.value });
          P.data = Object.assign({}, D, { profil: r.profil, lengkap: r.lengkap }); P.beranda = null; K().toast(r.berubah ? 'Data tersimpan.' : 'Tidak ada yang berubah.'); K().render();
        } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = 'Simpan data'; }
      });
      wrap.appendChild(msg); wrap.appendChild(btn);
      if (p.diubahPada) wrap.appendChild(h('div', { class: 'meta', style: 'margin-top:10px;color:var(--mut);font-size:14px', text: 'Terakhir disimpan: ' + waktu(p.diubahPada) }));
    }
    pasang(topbar('Data instansi', D ? D.dasar.nama : ' '), wrap);
  }

  /* ---------- Bantuan ---------- */
  var FAQ = [
    ['Lupa PIN?', 'Di layar masuk, ketuk "Belum punya PIN atau lupa PIN?" untuk meminta kode lewat WhatsApp. Bila tidak bisa, hubungi Admin SPPG untuk mengatur ulang PIN.'],
    ['Mau ganti PIN?', 'Buka tab Profil, lalu ketuk "Ganti PIN". Anda perlu PIN yang lama.'],
    ['Nama atau alamat instansi salah?', 'Data resmi instansi dikelola Admin SPPG. Hubungi Admin lewat tombol di bawah, sebutkan nama instansi dan bagian yang salah.'],
    ['Bagaimana mengisi data siswa, guru, atau tendik?', 'Buka menu Pendataan. Isi lewat formulir, atau salin dari Excel lalu tempel di "Tempel dari Excel". Ketik NISN lengkap 10 angka, termasuk angka 0 di depan.'],
    ['Kapan menu berubah?', 'Menu hari ini berganti ke menu besok mulai sore hari. Menu resmi ditetapkan Admin SPPG.'],
    ['Apakah data saya aman?', 'Hanya Anda dan Admin SPPG yang bisa melihat data instansi Anda. Jangan berikan PIN kepada siapa pun.']
  ];
  function renderBantuan() {
    var wrap = h('div', { class: 'wrap', id: 'bantuanPic' });
    wrap.appendChild(h('h2', { text: 'Pertanyaan yang sering muncul' }));
    FAQ.forEach(function (q) { wrap.appendChild(h('details', { class: 'faq' }, h('summary', { text: q[0] }), h('p', { text: q[1] }))); });
    wrap.appendChild(h('h2', { text: 'Butuh bantuan?' }));
    wrap.appendChild(h('a', { class: 'btn block', href: WA_ADMIN, target: '_blank', rel: 'noopener', style: 'display:block;text-align:center;text-decoration:none;line-height:1.9', text: 'Hubungi Admin lewat WhatsApp' }));
    pasang(topbar('Bantuan'), wrap);
  }

  window.PortalPic = {
    reset: reset,
    render: function () {
      var v = K().S.view; if (v === 'pilih') v = 'beranda';
      P.tab = v;
      if (v === 'menu') renderMenu(); else if (v === 'pendataan') renderPendataan(); else if (v === 'profil') renderProfil(); else if (v === 'instansi') renderInstansi(); else if (v === 'bantuan') renderBantuan(); else renderBeranda();
    },
    tampil: function (v) { return ['beranda', 'pilih', 'menu', 'pendataan', 'profil', 'instansi', 'bantuan'].indexOf(v) >= 0; },
    bukaInstansi: bukaInstansi,
    segar: function () { P.beranda = null; },
    nav: function (formulir) { var n = navbawah(); if (formulir) n.classList.add('formnav'); return n; },   // dipakai layar pendataan (3B & sekolah) agar navigasi tetap ada
    adalahPosyandu: adalahPosyandu
  };
})();

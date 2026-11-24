// SPPG JEUNGJING — Portal PIC terpadu (25 Nov 2026): Beranda, Menu, Pendataan, Profil, Pemberitahuan, Data tempat, Bantuan.
// Berlaku untuk PIC Posyandu DAN PIC satuan pendidikan. Dimuat SEBELUM pendataan-3b.js; memakai alat bantu yang dibuka pendataan-3b.js (window.P3BKit).
// Pendataan Posyandu (ibu hamil, ibu menyusui, balita) ada di pendataan-3b.js; pendataan satuan pendidikan di pendataan-sekolah.js.
(function () {
  var P = { tab: 'beranda', beranda: null, menu: null, profil: null, notif: null, notifMemuat: false, pemut: null, foto: null, fotoMemuat: false, peng: null, pengForm: null, idi: '', data: null, memuat: false, galat: '', gantiPin: false, form: null, formDiri: null };
  var WA_ADMIN = 'https://wa.me/6285694765370?text=' + encodeURIComponent('Halo Admin, saya PIC dan butuh bantuan di Portal PIC SPPG Jeungjing.');
  var KEY_BACA = 'pic.notif.dibaca.v1';
  function waktu(s) { s = String(s || ''); return s.length >= 16 ? dmy(s) + ' ' + s.slice(11, 16) : (s || '-'); }
  function K() { return window.P3BKit; }
  function h() { return K().h.apply(null, arguments); }
  function dmy(s) { s = String(s || '').slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : ''; }
  function angka(n) { return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  /** Nama enak dibaca: Posyandu diberi awalan "Posyandu" bila belum ada. */
  function namaTempat(x) { var n = String(x.nama || ''); return (adalahPosyandu(x) && !/posyandu/i.test(n)) ? 'Posyandu ' + n : n; }
  function sebutData(x) { return adalahPosyandu(x) ? 'data Posyandu' : 'data satuan pendidikan'; }

  /** Kata pertama nama untuk sapaan; sebutan seperti Ibu/Bapak/Hj. dilewati ("Ibu Usnia" -> "Usnia"). */
  function namaSapa(n) {
    var k = String(n || '').trim().split(/\s+/).filter(Boolean);
    while (k.length > 1 && /^(ibu|bu|bapak|pak|bpk|hj\.?|h\.?|haji|hajjah|dr\.?|drs\.?|ust\.?|ustadz|ustadzah|kak)$/i.test(k[0])) k.shift();
    return k[0] || '';
  }
  function reset() { P.beranda = null; P.menu = null; P.profil = null; P.notif = null; P.notifMemuat = false; P.pemut = null; P.foto = null; P.fotoMemuat = false; P.peng = null; P.pengForm = null; P.data = null; P.idi = ''; P.gantiPin = false; P.form = null; P.formDiri = null; P.insentif = null; P.galat = ''; P.tab = 'beranda'; }
  function pindah(tab) {
    P.tab = tab; P.galat = ''; if (tab === 'beranda') P.beranda = null;   // ringkasan selalu segar
    if (tab === 'profil') { P.profil = null; P.formDiri = null; }
    if (tab === 'pemutakhiran') P.pemut = null;
    if (tab === 'pengaduan') P.peng = null;
    if (tab !== 'instansi') { P.idi = ''; P.data = null; P.form = null; }
    var S = K().S; S.idi = ''; S.nmPos = ''; S.items = []; S.ring = null;
    if (tab === 'pendataan' && (S.instansi || []).length === 1) { bukaPendataanInstansi(S.instansi[0]); return; }   // satu tempat: langsung ke pendataannya
    S.view = tab; K().simpanSesi(); K().render(); window.scrollTo(0, 0);
  }
  function adalahPosyandu(x) { return x.posyandu === true || String(x.jenis || '').toUpperCase() === 'POSYANDU'; }
  /** Buka pendataan yang sesuai: Posyandu -> ibu hamil/menyusui/balita, satuan pendidikan -> siswa/guru/tendik. */
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

  /* ---------- pemberitahuan dari pengelola ---------- */
  function sudahDibaca() { try { return JSON.parse(localStorage.getItem(KEY_BACA) || '[]'); } catch (e) { return []; } }
  function tandaiDibaca() {
    if (!P.notif) return;
    try { localStorage.setItem(KEY_BACA, JSON.stringify(P.notif.items.map(function (x) { return x.id; }).slice(0, 100))); } catch (e) { /* tanpa penyimpanan: lencana muncul lagi, tidak fatal */ }
    segarLencana();
  }
  function belumDibaca() { if (!P.notif) return 0; var b = sudahDibaca(); return P.notif.items.filter(function (x) { return b.indexOf(x.id) < 0; }).length; }
  function segarLencana() {
    var el = document.getElementById('dotNotif'); if (!el) return;
    var n = belumDibaca(); el.textContent = n > 9 ? '9+' : String(n); el.style.display = n ? 'grid' : 'none';
  }
  async function muatNotif() {
    if (P.notifMemuat || P.notif) return; P.notifMemuat = true;
    try { P.notif = await K().api('getNotifikasiPic3B', { idInstansi: '' }); } catch (e) { P.notif = null; }
    P.notifMemuat = false; segarLencana();
    if (P.notif && K().S.view === 'notifikasi') K().render();
  }

  /* ---------- kerangka: header seperti portal (logo, nama, lonceng, profil) ---------- */
  function inisial() {
    var S = K().S, n = (P.profil && (P.profil.panggilan || P.profil.nama)) || (P.beranda && P.beranda.pic && (P.beranda.pic.panggilan || P.beranda.pic.nama)) || (S.pic && S.pic.nama) || '?';
    return (n === (P.profil && P.profil.panggilan) ? String(n) : namaSapa(n)).trim().charAt(0).toUpperCase() || '?';
  }
  function merek() {
    var bell = h('button', { class: 'ib', id: 'btnLonceng', 'aria-label': 'Pemberitahuan', title: 'Pemberitahuan', onclick: function () { pindah('notifikasi'); } }, K().ikon('lonceng', 20), h('span', { class: 'dot', id: 'dotNotif', style: 'display:none' }));
    var bantu = h('button', { class: 'ib', id: 'btnBantuanHeader', 'aria-label': 'Bantuan', title: 'Bantuan', onclick: function () { pindah('bantuan'); } }, K().ikon('bantuan', 20));
    var av = h('button', { class: 'ib av', id: 'btnAvatar', 'aria-label': 'Profil saya', title: 'Profil saya', text: inisial(), onclick: function () { pindah('profil'); } });
    var el = h('div', { class: 'brand', id: 'merekPic' }, h('div', { class: 'brand-in' },
      h('div', { class: 'brand-mid' }, h('img', { src: 'assets/logo-bgn.png', alt: 'Logo Badan Gizi Nasional' }), h('img', { src: 'assets/logo.png', alt: 'Logo SPPG Jeungjing' }),
        h('div', { class: 'brand-text' }, h('strong', { text: 'SPPG JEUNGJING' }), h('span', { text: 'Portal PIC' }))),
      h('div', { class: 'brand-right' }, bell, bantu, av)));
    return el;
  }
  /** Dipanggil setiap layar PIC selesai digambar: pasang header di paling atas. */
  function sisipMerek(app) {
    if (!app || document.getElementById('merekPic')) return;
    app.insertBefore(merek(), app.firstChild); segarLencana(); muatNotif(); muatFoto();
  }
  /** Judul halaman (strip terang di bawah header). */
  function topbar(judul, sub) {
    return h('header', { class: 'top' }, h('div', { class: 'in' }, sub ? h('small', { text: sub }) : null, h('h1', { text: judul })));
  }
  function navbawah() {
    var tabs = [['beranda', 'beranda', 'Beranda'], ['pendataan', 'pendataan', 'Pendataan'], ['harian', 'harian', 'Menu & PM'], ['insentif', 'insentif', 'Insentif'], ['profil', 'profil', 'Profil']];
    var v = K().S.view, aktif = (v === 'home' || v === 'sekolah' || v === 'pendataan') ? 'pendataan' : (P.tab === 'instansi' ? 'beranda' : (P.tab === 'notifikasi' || P.tab === 'menu' ? '' : (P.tab === 'pengaduan' || P.tab === 'bantuan' || P.tab === 'pengaturan' ? 'profil' : (P.tab === 'pemutakhiran' ? 'pendataan' : P.tab))));
    var nav = h('nav', { class: 'tabbar', id: 'navUtama', 'aria-label': 'Menu utama' });
    tabs.forEach(function (t) {
      nav.appendChild(h('button', { class: 'tab', 'data-tab': t[0], 'aria-current': aktif === t[0] ? 'page' : null, onclick: function () { pindah(t[0]); } }, h('span', { class: 'ti' }, K().ikon(t[1], 24)), h('span', { text: t[2] })));
    });
    return nav;
  }
  function pasang(top, wrap) { var app = document.getElementById('app'); if (top) app.appendChild(top); app.appendChild(wrap); app.appendChild(navbawah()); document.body.classList.add('ada-nav'); }
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

  /* ---------- gambar kecil: batang kemajuan dan grafik ---------- */
  function batang(persen, selesai) { return h('div', { class: 'prog' + (selesai ? ' ok' : ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(persen) }, h('i', { style: 'width:' + Math.max(0, Math.min(100, persen)) + '%' })); }
  var LABEL_STATUS = { BELUM: 'Belum mulai', SEBAGIAN: 'Sebagian', LENGKAP: 'Lengkap', TANPA_TARGET: 'Sudah ada data' };
  function chipStatus(st) { return h('span', { class: 'cs ' + String(st || '').toLowerCase().replace('_', '-'), text: LABEL_STATUS[st] || '' }); }
  /** Grafik batang mendatar: [[label, jumlah, kelas]]. */
  function grafik(baris) {
    var maks = Math.max.apply(null, baris.map(function (b) { return b[1]; }).concat([1])), g = h('div', { class: 'graf' });
    baris.forEach(function (b) {
      g.appendChild(h('div', { class: 'gr' }, h('span', { class: 'gl', text: b[0] }), h('span', { class: 'gb' }, h('i', { class: b[2] || '', style: 'width:' + Math.round(b[1] * 100 / maks) + '%' })), h('b', { class: 'gn', text: angka(b[1]) })));
    });
    return g;
  }
  /** Kartu kemajuan untuk satu tempat (dipakai di layar pendataan Posyandu dan sekolah). x = baris dari getBerandaPic3B. */
  function kartuKemajuan(x, rincian) {
    var c = h('div', { class: 'card kemajuan', id: 'kemajuan' });
    if (!x) { c.appendChild(h('div', { class: 'meta', text: 'Memuat ringkasan…' })); return c; }
    var kepala = x.target > 0 ? [h('span', { class: 'angka', text: angka(x.terisi) }), h('span', { class: 'dari', text: ' dari ' + angka(x.target) + (adalahPosyandu(x) ? ' penerima manfaat' : ' siswa') })] : [h('span', { class: 'angka', text: angka(x.terisi) }), h('span', { class: 'dari', text: adalahPosyandu(x) ? ' penerima manfaat sudah diisi' : ' siswa sudah diisi' })];
    c.appendChild(h('div', { class: 'kep' }, kepala[0], kepala[1], chipStatus(x.status)));
    if (x.target > 0) { c.appendChild(batang(x.persen, x.status === 'LENGKAP')); c.appendChild(h('div', { class: 'meta', text: x.status === 'LENGKAP' ? 'Jumlah sudah sesuai target. Terima kasih.' : 'Masih kurang ' + angka(x.kurang) + ' lagi.' })); }
    else c.appendChild(h('div', { class: 'meta', text: 'Jumlah yang harus diisi belum ditetapkan pengelola.' }));
    if (rincian) c.appendChild(rincian);
    return c;
  }
  function ambilBeranda(id) { var B = P.beranda; if (!B) return null; return (B.instansi || []).filter(function (x) { return x.id === id; })[0] || null; }
  /** Dipakai layar pendataan: ringkasan tempat; bila belum dimuat, dimuat diam-diam lalu layar digambar ulang. */
  function ringkasanTempat(id) {
    var x = ambilBeranda(id);
    if (!x && !P.berandaDiam) {
      P.berandaDiam = true;
      K().api('getBerandaPic3B', { idInstansi: '' }).then(function (d) { P.beranda = d; P.berandaDiam = false; if (K().S.idi === id) K().render(); }).catch(function () { P.berandaDiam = false; });
    }
    return x;
  }
  function segar() { P.beranda = null; }

  /* ---------- Beranda ---------- */
  function sapaan(B) {
    var S = K().S, nama = (B && B.pic && (B.pic.panggilan || namaSapa(B.pic.nama))) || (S.pic && namaSapa(S.pic.nama)) || '';
    var tempat = (B && B.instansi) || S.instansi || [], teks;
    if (!tempat.length) teks = 'Penanggung jawab';
    else if (tempat.length === 1) teks = 'Penanggung jawab ' + namaTempat(tempat[0]);
    else if (tempat.length === 2) teks = 'Penanggung jawab ' + namaTempat(tempat[0]) + ' dan ' + namaTempat(tempat[1]);
    else teks = 'Penanggung jawab ' + tempat.length + ' tempat';
    var kal = B && B.kalender, hari = null;
    if (kal) hari = h('div', { class: 'hari', id: 'hariIni' }, h('span', { class: 'tgl', text: 'Hari ini, ' + tglPanjang(kal.tanggal) }), h('span', { class: 'kb ' + String(kal.status || '').toLowerCase().replace(/_/g, '-'), text: kal.label }), kal.keterangan ? h('span', { class: 'ket', text: kal.keterangan }) : null);
    return h('div', { class: 'hero', id: 'sapaPic' }, h('small', { text: 'Selamat datang' }), h('h1', { text: 'Halo, ' + nama }), h('p', { text: teks }), hari);
  }
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function tglPanjang(iso) { var a = String(iso || '').split('-'); if (a.length !== 3) return ''; var d = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2])); return HARI[d.getUTCDay()] + ', ' + a[2] + '/' + a[1] + '/' + a[0]; }
  function kotak(label, nilai, kelas) { return h('div', { class: 'pmk ' + (kelas || '') }, h('b', { text: angka(nilai) }), h('span', { text: label })); }
  /** Jumlah penerima manfaat (PM) hari ini untuk satu tempat: hanya milik tempat itu. Posyandu: balita, busui, bumil. Satuan pendidikan: porsi kecil dan besar. */
  function kartuPm(x) {
    var pos = adalahPosyandu(x), pm = x.pm, t = pm && pm.terbaru, c = h('div', { class: 'card pm', 'data-id': x.id });
    c.appendChild(h('div', { class: 'kep' }, h('b', { text: namaTempat(x) })));
    if (!t) { c.appendChild(h('div', { class: 'meta', text: 'Belum ada data penerima manfaat yang dicatat.' })); return c; }
    c.appendChild(h('div', { class: 'meta', style: 'margin:0 0 8px', text: pm.hariIni ? 'Hari ini, ' + tglPanjang(t.tanggal) : 'Data terakhir ' + tglPanjang(t.tanggal) + '. Data hari ini belum dicatat.' }));
    var g = h('div', { class: 'pmg' });
    if (pos) { g.appendChild(kotak('Balita', t.balita, 'balita')); g.appendChild(kotak('Ibu menyusui', t.busui, 'busui')); g.appendChild(kotak('Ibu hamil', t.bumil, 'hamil')); }
    else { g.appendChild(kotak('Porsi kecil', t.pk, 'balita')); g.appendChild(kotak('Porsi besar', t.pb, 'busui')); }
    c.appendChild(g);
    c.appendChild(h('div', { class: 'meta', style: 'margin-top:8px', text: 'Total ' + angka(t.total) + (pos ? ' penerima manfaat' : ' porsi') }));
    if ((pm.riwayat || []).length > 1) {
      var tb = h('table', { class: 'tb' }), kep = h('tr'); ['Tanggal'].concat(pos ? ['Balita', 'Busui', 'Bumil'] : ['Kecil', 'Besar']).concat(['Total']).forEach(function (k) { kep.appendChild(h('th', { text: k })); }); tb.appendChild(h('thead', null, kep));
      var body = h('tbody'); pm.riwayat.forEach(function (r) { var tr = h('tr'); [dmy(r.tanggal)].concat(pos ? [r.balita, r.busui, r.bumil] : [r.pk, r.pb]).concat([r.total]).forEach(function (v, i) { tr.appendChild(h('td', { text: i === 0 ? v : angka(v) })); }); body.appendChild(tr); });
      tb.appendChild(body); c.appendChild(h('details', { class: 'faq', style: 'margin:10px 0 0' }, h('summary', { text: 'Tujuh data terakhir' }), h('div', { class: 'table-scroll', style: 'margin-bottom:10px' }, tb)));
    }
    return c;
  }
  function rupiah(n) { return 'Rp ' + angka(n); }
  /** Insentif bulan ini, dihitung lambat: kartu diisi setelah Beranda tampil. */
  function tglPendek(iso) { var a = String(iso || '').split('-'); return a.length === 3 ? Number(a[2]) + '/' + Number(a[1]) + '/' + a[0] : ''; }
  /** Insentif per 2 minggu (sama dengan rekap di portal pengelola): total, per tempat, dan tanggal yang tercatat. Hanya milik PIC ini. */
  function isiInsentif(ringkas) {
    var el = document.getElementById('kartuInsentif'); if (!el) return;
    function gambarI(d) {
      var e = document.getElementById('kartuInsentif'); if (!e) return; e.textContent = '';
      if (ringkas) {
        if (!d || !d.tersedia) { e.appendChild(h('div', { class: 'meta', style: 'margin:0 0 10px', text: (d && d.pesan) || 'Insentif belum bisa ditampilkan.' })); }
        else { e.appendChild(h('div', { class: 'meta', style: 'margin:0 0 6px', id: 'periodeInsentif', text: 'Periode ' + tglPendek(d.awal) + ' sampai ' + tglPendek(d.akhir) })); e.appendChild(h('div', { class: 'kep' }, h('span', { class: 'angka', id: 'totalInsentif', text: rupiah(d.total) }), h('span', { class: 'dari', text: ' periode ini' }))); }
        e.appendChild(h('button', { class: 'btn sm sec', id: 'btnKeInsentif', style: 'margin-top:8px', text: 'Lihat rincian', onclick: function () { pindah('insentif'); } }));
        return;
      }
      if (!d || !d.tersedia) { e.appendChild(h('div', { class: 'meta', style: 'margin:0', text: (d && d.pesan) || 'Insentif belum bisa ditampilkan.' })); if (d && d.pilihan) pilihPeriode(e, d); return; }
      pilihPeriode(e, d);
      e.appendChild(h('div', { class: 'meta', style: 'margin:0 0 6px', id: 'periodeInsentif', text: 'Periode ' + tglPendek(d.awal) + ' sampai ' + tglPendek(d.akhir) + (d.berjalan ? ' (sedang berjalan, dihitung sampai ' + tglPendek(d.sampai) + ')' : '') }));
      e.appendChild(h('div', { class: 'kep' }, h('span', { class: 'angka', id: 'totalInsentif', text: rupiah(d.total) }), h('span', { class: 'dari', text: ' total periode ini' })));
      e.appendChild(h('div', { class: 'meta', style: 'margin:0 0 8px', text: angka(d.hariPm) + ' hari tercatat' }));
      (d.tempat || []).forEach(function (t) {
        e.appendChild(h('div', { class: 'mrow' }, h('span', { class: 'ml', style: 'width:auto;flex:1;color:var(--ink);font-size:15px', text: t.nama + ' · ' + angka(t.hari) + ' hari' }), h('span', { text: t.tarifBelumAda ? 'Tarif belum ditetapkan' : rupiah(t.total) })));
      });
      if ((d.rincian || []).length) {
        var det = h('details', { class: 'faq', id: 'rincianInsentif' }, h('summary', { text: 'Lihat per tanggal' }));
        var tb = h('table', { class: 'tb' }, h('thead', null, h('tr', null, h('th', { text: 'Tanggal' }), h('th', { text: 'Tempat' }), h('th', { text: 'Insentif', style: 'text-align:right' }))));
        var tbd = h('tbody'); d.rincian.forEach(function (r) { tbd.appendChild(h('tr', null, h('td', { text: tglPendek(r.tanggal) }), h('td', { text: r.tempat.join(', ') }), h('td', { text: rupiah(r.nilai), style: 'text-align:right' }))); });
        tb.appendChild(tbd); det.appendChild(h('div', { class: 'table-scroll', style: 'margin-bottom:10px' }, tb)); e.appendChild(det);
      } else e.appendChild(h('div', { class: 'meta', text: 'Belum ada tanggal yang tercatat pada periode ini.' }));
      if (d.catatan) e.appendChild(h('div', { class: 'meta', text: d.catatan }));
      e.appendChild(h('button', { class: 'btn sm sec', id: 'btnPengInsentif', style: 'margin-top:8px', text: 'Insentif kurang tepat?', onclick: function () { bukaPengaduan({ kat: 'INSENTIF' }); } }));
    }
    function pilihPeriode(e, d) {
      if (!d.pilihan || d.pilihan.length < 2) return;
      var sel = h('select', { id: 'pilihPeriodeInsentif', class: 'sel', 'aria-label': 'Pilih periode', onchange: function () { muatI(sel.value); } });
      d.pilihan.forEach(function (p) { var o = h('option', { value: p.id, text: tglPendek(p.awal) + ' – ' + tglPendek(p.akhir) + (p.berjalan ? ' (berjalan)' : '') }); if (p.id === d.idPeriode) o.selected = true; sel.appendChild(o); });
      e.appendChild(h('div', { style: 'margin-bottom:10px' }, sel));
    }
    function muatI(idPeriode) {
      var e = document.getElementById('kartuInsentif'); if (e) { e.textContent = ''; e.appendChild(h('div', { class: 'meta', style: 'margin:0', text: 'Menghitung…' })); }
      K().api('getInsentifPic3B', { idPeriode: idPeriode || '' }).then(function (d) { P.insentif = d; gambarI(d); }).catch(function (er) { gambarI({ tersedia: false, pesan: er.message }); });
    }
    if (P.insentif) { gambarI(P.insentif); return; }
    muatI('');
  }
  function renderBeranda() {
    var B = P.beranda;
    if (!B && !P.memuat && !P.galat) muat('beranda', 'getBerandaPic3B', { idInstansi: '' }, function (d) { P.beranda = d; });
    var wrap = h('div', { class: 'wrap', id: 'berandaPic' });
    wrap.appendChild(sapaan(B));
    status(wrap);
    if (B) {
      (B.pengingat || []).forEach(function (p) {
        var tombol = null;
        if (p.jenis === 'PROFIL') tombol = h('button', { class: 'btn sm', text: 'Lengkapi sekarang', onclick: function () { bukaInstansi(p.idInstansi); } });
        else if (p.jenis === 'PROFIL_DIRI') tombol = h('button', { class: 'btn sm', text: 'Lengkapi profil', onclick: function () { pindah('profil'); } });
        wrap.appendChild(h('div', { class: 'ban', role: 'status' }, h('b', { text: p.jenis === 'PROFIL' || p.jenis === 'PROFIL_DIRI' ? 'Data belum lengkap' : 'Perlu perhatian' }), h('span', { text: p.teks }), tombol ? h('div', { style: 'margin-top:8px' }, tombol) : null));
      });
      var R = B.ringkasan || {}, adaPos = (B.instansi || []).some(adalahPosyandu), adaSek = (B.instansi || []).some(function (x) { return !adalahPosyandu(x); });
      wrap.appendChild(h('h2', { text: 'Penerima manfaat hari ini' }));
      (B.instansi || []).forEach(function (x) { wrap.appendChild(kartuPm(x)); });
      wrap.appendChild(h('h2', { text: 'Menu makan hari ini' }));
      if (B.menu && B.menu.hariIni) wrap.appendChild(kartuMenu(B.menu.hariIni));
      else wrap.appendChild(h('div', { class: 'empty', text: 'Menu belum ditetapkan. Cek lagi nanti.' }));
      wrap.appendChild(h('h2', { text: 'Pendataan penerima manfaat' }));
      var rinci = [];
      if (adaPos) rinci.push(['Ibu hamil', R.hamil || 0, 'hamil'], ['Ibu menyusui', R.busui || 0, 'busui'], ['Balita', R.balita || 0, 'balita']);
      if (adaSek) rinci.push(['Siswa', R.siswa || 0, 'balita'], ['Guru', R.guru || 0, 'busui'], ['Tendik', R.tendik || 0, 'hamil']);
      var induk = { terisi: R.terisi || 0, target: R.target || 0, persen: R.persen || 0, kurang: Math.max(0, (R.target || 0) - (R.terisi || 0)), status: picStatusGabung(R), posyandu: adaPos && !adaSek };
      var ck = kartuKemajuan(induk, grafik(rinci));
      if (R.perluKonfirmasi) ck.appendChild(h('div', { class: 'meta', style: 'color:var(--amb)', text: R.perluKonfirmasi + ' NISN perlu diperiksa.' }));
      wrap.appendChild(ck);
      wrap.appendChild(h('h2', { text: 'Tempat Anda' }));
      var kats = h('div', { class: 'kats' });
      (B.instansi || []).forEach(function (x) {
        var pos = adalahPosyandu(x);
        var kartu = h('div', { class: 'inst', 'data-id': x.id },
          h('div', { class: 'inst-h' }, h('div', { class: 'ic' }, K().ikon(pos ? 'posyandu' : 'sekolah')), h('div', { style: 'min-width:0;flex:1' }, h('b', { text: namaTempat(x) }), h('span', { class: 's', text: x.jenisLabel + (x.profilLengkap ? '' : ' • data belum lengkap') })), chipStatus(x.status)),
          h('div', { style: 'margin-top:12px' }, x.target > 0 ? batang(x.persen, x.status === 'LENGKAP') : null),
          h('div', { class: 'meta ringkas', style: 'margin-top:6px;color:var(--mut);font-size:14px', text: ringkasTempat(x) }),
          h('div', { class: 'acts' },
            h('button', { class: 'btn sm', 'data-aksi': 'pendataan', text: 'Pendataan', onclick: function () { bukaPendataanInstansi(x); } }),
            h('button', { class: 'btn sm sec', 'data-aksi': 'data', text: x.profilLengkap ? 'Data tempat' : 'Lengkapi data tempat', onclick: function () { bukaInstansi(x.id); } })));
        kats.appendChild(kartu);
      });
      wrap.appendChild(kats);
      var perlu = (R.perluDiperbarui || 0) + (R.perluKonfirmasi || 0), aktifPut = !!(B.pemutakhiran && B.pemutakhiran.aktif);
      if (perlu || aktifPut) {   // hanya tampil bila ada yang perlu dikerjakan
        wrap.appendChild(h('h2', { text: 'Pemutakhiran data' }));
        wrap.appendChild(h('div', { class: 'card', id: 'kartuPemutakhiran' },
          h('div', { class: 'meta', style: 'margin:0 0 10px', text: perlu ? angka(perlu) + ' data perlu diperiksa atau diperbarui.' : 'Pengelola meminta data diperbarui.' }),
          h('button', { class: 'btn sm', id: 'btnKePemutakhiran', text: 'Periksa sekarang', onclick: function () { pindah('pemutakhiran'); } })));
      }
      wrap.appendChild(h('h2', { text: 'Insentif saya' }));
      wrap.appendChild(h('div', { class: 'card', id: 'kartuInsentif' }));
      var nb = (B.pengaduan && B.pengaduan.belumDibaca) || 0;
      wrap.appendChild(h('h2', { text: 'Pengaduan dan saran' }));
      wrap.appendChild(h('div', { class: 'card', id: 'kartuPengBeranda' },
        h('div', { class: 'meta', style: 'margin:0 0 10px', text: nb ? nb + ' tanggapan baru dari Admin.' : 'Ada yang kurang tepat, atau punya saran? Sampaikan di sini.' }),
        h('div', { class: 'acts' },
          h('button', { class: 'btn sm', id: 'btnPengBeranda', text: nb ? 'Lihat tanggapan' : 'Sampaikan', onclick: function () { bukaPengaduan(null); } }))));
    }
    pasang(null, wrap);
    if (B) isiInsentif(true);
  }

  /* ---------- Menu & PM ---------- */
  function renderHarian() {
    var B = P.beranda;
    if (!B && !P.memuat && !P.galat) muat('beranda', 'getBerandaPic3B', { idInstansi: '' }, function (d) { P.beranda = d; });
    var wrap = h('div', { class: 'wrap', id: 'harianPic' });
    status(wrap);
    if (B) {
      wrap.appendChild(h('h2', { text: 'Menu makan hari ini' }));
      if (B.menu && B.menu.hariIni) wrap.appendChild(kartuMenu(B.menu.hariIni));
      else wrap.appendChild(h('div', { class: 'empty', text: 'Menu belum ditetapkan. Cek lagi nanti.' }));
      wrap.appendChild(h('h2', { text: 'Penerima manfaat' }));
      (B.instansi || []).forEach(function (x) { wrap.appendChild(kartuPm(x)); });
      wrap.appendChild(h('button', { class: 'btn sm sec', id: 'btnPengPm', text: 'Jumlah PM perlu diubah?', onclick: function () { bukaPengaduan({ kat: 'PM_TAMBAH' }); } }));
    }
    pasang(topbar('Menu dan PM'), wrap);
  }
  /* ---------- Insentif ---------- */
  function renderInsentif() {
    var wrap = h('div', { class: 'wrap', id: 'insentifPic' });
    wrap.appendChild(h('div', { class: 'card', id: 'kartuInsentif' }));
    pasang(topbar('Insentif saya'), wrap);
    isiInsentif(false);
  }

  /* ---------- Pemutakhiran data ---------- */
  function renderPemutakhiran() {
    var D = P.pemut;
    if (!D && !P.memuat && !P.galat) muat('pemut', 'getPemutakhiranPic3B', {}, function (d) { P.pemut = d; });
    var wrap = h('div', { class: 'wrap', id: 'pemutakhiranPic' });
    status(wrap);
    if (D) {
      var pt = D.putaran;
      wrap.appendChild(h('div', { class: 'card', id: 'infoPemutakhiran' },
        h('b', { text: pt && pt.aktif ? 'Pengelola meminta data diperbarui' : 'Perbarui data bila ada perubahan' }),
        h('p', { class: 'meta', style: 'margin:6px 0 0', text: pt && pt.aktif ? ((pt.catatan ? pt.catatan + ' ' : '') + 'Mulai ' + dmy(pt.sejak) + '. Periksa tiap data, ubah yang berbeda, lalu ketuk "Masih sesuai" bila tidak ada perubahan.') : 'Bila ada yang pindah, melahirkan, pindah sekolah, atau data yang salah, ubah datanya. Data yang tidak ada lagi bisa dihapus.' })));
      wrap.appendChild(h('h2', { text: 'Per tempat' }));
      var kats = h('div', { class: 'kats' });
      (D.tempat || []).forEach(function (t) {
        var kata = t.posyandu ? (t.perlu ? t.perlu + ' data perlu diperbarui' : 'Semua data sudah diperbarui') : (t.perlu ? t.perlu + ' NISN perlu diperiksa' : 'Data sudah diperiksa');
        var tb = h('div', { class: 'acts' }, h('button', { class: 'btn sm', 'data-aksi': 'periksa', text: t.perlu ? 'Periksa sekarang' : 'Lihat data', onclick: function () {
          if (t.posyandu) K().bukaPendataan(t.id, t.nama, t.perlu ? 'Perlu diperbarui' : 'Semua'); else bukaPendataanInstansi({ id: t.id, nama: t.nama, posyandu: false });
        } }));
        kats.appendChild(h('div', { class: 'inst', 'data-id': t.id },
          h('div', { class: 'inst-h' }, h('div', { class: 'ic' }, K().ikon(t.posyandu ? 'posyandu' : 'sekolah')), h('div', { style: 'min-width:0;flex:1' }, h('b', { text: namaTempat({ nama: t.nama, posyandu: t.posyandu }) }), h('span', { class: 's', text: angka(t.total) + ' data tersimpan' + (t.terakhir ? ' · terakhir ' + waktu(t.terakhir) : '') }))),
          h('div', { class: 'meta', style: 'margin:8px 0 0;color:' + (t.perlu ? 'var(--amb)' : 'var(--mut)'), text: kata }), tb));
      });
      wrap.appendChild(kats);
      wrap.appendChild(h('h2', { text: 'Cara memperbarui' }));
      [['Ada perubahan', 'Ketuk nama dalam daftar, ubah isinya, lalu Simpan.'], ['Tidak ada perubahan', 'Ketuk "Masih sesuai" pada data itu. Tanggalnya ikut diperbarui.'], ['Orangnya sudah tidak ada', 'Buka datanya, lalu ketuk Hapus.'], ['Ada yang baru', 'Ketuk Pendataan, lalu tambah data baru.']].forEach(function (c) {
        wrap.appendChild(h('details', { class: 'faq' }, h('summary', { text: c[0] }), h('p', { text: c[1] })));
      });
    }
    pasang(topbar('Pemutakhiran data'), wrap);
  }
  function picStatusGabung(R) { var t = R.target || 0, s = R.terisi || 0; if (!(t > 0)) return s > 0 ? 'TANPA_TARGET' : 'BELUM'; return s >= t ? 'LENGKAP' : (s > 0 ? 'SEBAGIAN' : 'BELUM'); }
  function ringkasTempat(x) {
    var j = x.pendataan || {}, baris;
    if (adalahPosyandu(x)) baris = x.target > 0 ? 'Terisi ' + angka(x.terisi) + ' dari ' + angka(x.target) : 'Terisi ' + angka(x.terisi);
    else baris = (x.target > 0 ? 'Siswa terisi ' + angka(x.terisi) + ' dari ' + angka(x.target) : 'Siswa ' + angka(j.siswa || 0)) + ' · Guru ' + angka(j.guru || 0) + ' · Tendik ' + angka(j.tendik || 0);
    if (x.target > 0 && x.kurang > 0) baris += ' · kurang ' + angka(x.kurang);
    if (adalahPosyandu(x) && x.terakhir) baris += ' · disimpan terakhir ' + waktu(x.terakhir);
    if (!adalahPosyandu(x) && j.perluKonfirmasi) baris += ' · ' + j.perluKonfirmasi + ' NISN perlu diperiksa';
    return baris;
  }

  /* ---------- Menu ---------- */
  function renderMenu() {
    var M = P.menu;
    if (!M && !P.memuat && !P.galat) muat('menu', 'getMenuPic3B', { idInstansi: '' }, function (d) { P.menu = d; });
    var wrap = h('div', { class: 'wrap', id: 'menuPic' });
    status(wrap);
    if (M) {
      wrap.appendChild(h('h2', { text: 'Menu makan hari ini' }));
      wrap.appendChild(M.hariIni ? kartuMenu(M.hariIni) : h('div', { class: 'empty', text: 'Menu hari ini belum ditetapkan.' }));
    }
    pasang(topbar('Menu makan'), wrap);
  }

  /* ---------- Pendataan (pilih tempat bila lebih dari satu) ---------- */
  function renderPendataan() {
    if (!P.beranda && !P.memuat && !P.galat) muat('beranda', 'getBerandaPic3B', { idInstansi: '' }, function (d) { P.beranda = d; });
    var wrap = h('div', { class: 'wrap', id: 'pendataanPic' });
    wrap.appendChild(h('h2', { text: 'Pilih yang mau didata' }));
    var kats = h('div', { class: 'kats' });
    (K().S.instansi || []).forEach(function (x) {
      var pos = adalahPosyandu(x), b = ambilBeranda(x.id);
      kats.appendChild(h('button', { class: 'kat pos', 'data-id': x.id, onclick: function () { bukaPendataanInstansi(x); } },
        h('div', { class: 'ic' }, K().ikon(pos ? 'posyandu' : 'sekolah')), h('div', { style: 'min-width:0;flex:1' }, h('b', { text: namaTempat(x) }), h('span', { class: 's', text: pos ? 'Ibu hamil, ibu menyusui, balita' : 'Siswa, guru, dan tenaga kependidikan' }),
          b && b.target > 0 ? h('span', { class: 's', text: 'Terisi ' + angka(b.terisi) + ' dari ' + angka(b.target) }) : null), b ? chipStatus(b.status) : null));
    });
    wrap.appendChild(kats);
    wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnPemutakhiranLink', style: 'margin-top:14px', text: 'Pemutakhiran data', onclick: function () { pindah('pemutakhiran'); } }));
    pasang(topbar('Pendataan', 'Isi data penerima manfaat'), wrap);
  }

  /* ---------- Pemberitahuan ---------- */
  function renderNotifikasi() {
    var wrap = h('div', { class: 'wrap', id: 'notifPic' });
    if (!P.notif) { wrap.appendChild(h('div', { class: 'empty', text: 'Memuat…' })); muatNotif(); }
    else {
      if (!P.notif.items.length) wrap.appendChild(h('div', { class: 'empty', text: 'Belum ada pemberitahuan dari pengelola.' }));
      var baca = sudahDibaca();
      P.notif.items.forEach(function (x) {
        wrap.appendChild(h('div', { class: 'item notif' + (baca.indexOf(x.id) < 0 ? ' baru' : '') }, h('div', { class: 'nm', text: x.judul }), h('div', { class: 'meta', text: waktu(x.waktu) }), h('p', { class: 'isi', text: x.isi })));
      });
      tandaiDibaca();
    }
    pasang(topbar('Pemberitahuan', 'Dari pengelola SPPG'), wrap);
  }

  /* ---------- foto profil dan latar (milik PIC sendiri) ---------- */
  function terapkanFoto() {
    var F = P.foto || {};
    function pasangBg(el, url) { if (!el) return; if (url) { el.style.backgroundImage = 'url("' + url + '")'; el.classList.add('berfoto'); } else { el.style.backgroundImage = ''; el.classList.remove('berfoto'); } }
    pasangBg(document.getElementById('btnAvatar'), F.profil); pasangBg(document.querySelector('#pbanner .pav'), F.profil);
    var h1 = document.getElementById('btnHapusProfil'); if (h1) h1.style.display = F.profil ? '' : 'none';
  }
  async function muatFoto() {
    if (P.foto) { terapkanFoto(); return; } if (P.fotoMemuat) return; P.fotoMemuat = true;
    try { P.foto = await K().api('getFotoPic3B', {}); } catch (e) { P.foto = { profil: '', latar: '' }; }   // gagal: tampilan huruf/warna tetap dipakai
    P.fotoMemuat = false; terapkanFoto();
  }
  /** Kecilkan di peramban: profil = kotak 320 px, latar = 900x300 px, JPEG. Pemotongan dari tengah. */
  function kecilkan(file, jenis) {
    return new Promise(function (ok, gagal) {
      if (!/^image\//.test(file.type)) { gagal(new Error('Pilih berkas gambar (foto).')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var W = jenis === 'profil' ? 320 : 900, H = jenis === 'profil' ? 320 : 300, c = document.createElement('canvas'); c.width = W; c.height = H;
        var rasio = Math.max(W / img.width, H / img.height), w = img.width * rasio, hh = img.height * rasio, g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, (W - w) / 2, (H - hh) / 2, w, hh); URL.revokeObjectURL(url);
        var d = c.toDataURL('image/jpeg', 0.8); if (d.length > 380000) d = c.toDataURL('image/jpeg', 0.6); ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); gagal(new Error('Foto tidak bisa dibuka. Coba foto lain.')); };
      img.src = url;
    });
  }
  function barisFoto() {
    var pesan = h('div', { class: 'msg', id: 'pesanFoto', 'aria-live': 'polite' });
    function pilih(jenis) {
      var inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async function () {
        var f = inp.files && inp.files[0]; if (!f) return; pesan.className = 'msg'; pesan.textContent = 'Menyimpan foto…';
        try { var d = await kecilkan(f, jenis); await K().api('simpanFotoPic3B', { jenis: jenis, dataUrl: d }); P.foto = P.foto || {}; P.foto[jenis] = d; terapkanFoto(); pesan.className = 'msg ok'; pesan.textContent = 'Foto tersimpan.'; }
        catch (e) { pesan.className = 'msg err'; pesan.textContent = e.message || 'Foto gagal disimpan.'; }
      } });
      document.body.appendChild(inp); inp.click(); setTimeout(function () { if (inp.parentNode) inp.parentNode.removeChild(inp); }, 60000);
    }
    function hapus(jenis) {
      pesan.className = 'msg'; pesan.textContent = 'Menghapus…';
      K().api('hapusFotoPic3B', { jenis: jenis }).then(function () { if (P.foto) P.foto[jenis] = ''; terapkanFoto(); pesan.className = 'msg ok'; pesan.textContent = 'Foto dihapus.'; }).catch(function (e) { pesan.className = 'msg err'; pesan.textContent = e.message; });
    }
    return h('div', { class: 'fotoaksi', id: 'fotoAksi' },
      h('button', { class: 'btn sm sec', id: 'btnFotoProfil', text: 'Ganti foto profil', onclick: function () { pilih('profil'); } }),
      h('button', { class: 'btn sm sec', id: 'btnHapusProfil', style: 'display:none', text: 'Hapus foto profil', onclick: function () { hapus('profil'); } }),
      pesan);
  }

  /* ---------- Profil ---------- */
  function renderProfil() {
    var R = P.profil;
    if (!R && !P.memuat && !P.galat) muat('profil', 'getProfilPic3B', { idInstansi: '' }, function (d) { P.profil = d; });
    var wrap = h('div', { class: 'wrap', id: 'profilPic' });
    status(wrap);
    if (R) {
      var tempat = (R.instansi || []).map(function (x) { return namaTempat(x); }).join(', ');
      wrap.appendChild(h('div', { class: 'pbanner', id: 'pbanner' }, h('div', { class: 'pav', text: namaSapa(R.nama).trim().charAt(0).toUpperCase() || '?' })));
      wrap.appendChild(h('div', { class: 'pnama' }, h('b', { text: R.nama }), h('span', { text: [R.jabatan, tempat ? 'Penanggung jawab ' + tempat : ''].filter(Boolean).join(' • ') || 'Penanggung jawab' })));
      wrap.appendChild(barisFoto()); terapkanFoto();
      if (!R.lengkap) wrap.appendChild(h('div', { class: 'ban' }, h('b', { text: 'Profil belum lengkap' }), h('span', { text: 'Lengkapi data diri di bawah ini.' })));
      wrap.appendChild(h('h2', { text: 'Data diri' }));
      wrap.appendChild(formDiri(R));
      wrap.appendChild(h('h2', { text: 'Akun dan kontak' }));
      wrap.appendChild(formAkun(R));
      wrap.appendChild(h('h2', { text: 'Data dari pengelola' }));
      var kartu = h('div', { class: 'item' });
      [['Nama lengkap', R.nama], ['Jabatan', R.jabatan || '-'], ['Terakhir masuk', waktu(R.terakhirMasuk)]].forEach(function (b) {
        kartu.appendChild(h('div', { class: 'mrow' }, h('span', { class: 'ml', text: b[0] }), h('span', { text: b[1] })));
      });
      wrap.appendChild(kartu);
      wrap.appendChild(h('div', { class: 'tip', text: R.catatan }));
      wrap.appendChild(h('h2', { text: 'Lainnya' }));
      wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnPengaturan', text: 'Pengaturan', onclick: function () { pindah('pengaturan'); } }));
      wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnBantuan', style: 'margin-top:8px', text: 'Bantuan dan pertanyaan', onclick: function () { pindah('bantuan'); } }));
      wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnPengProfil', style: 'margin-top:8px', text: 'Pengaduan dan saran', onclick: function () { bukaPengaduan(null); } }));
      wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnPemutakhiranProfil', style: 'margin-top:8px', text: 'Pemutakhiran data', onclick: function () { pindah('pemutakhiran'); } }));
      wrap.appendChild(h('h2', { text: 'Keamanan' }));
      if (!P.gantiPin) wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnGantiPin', text: 'Ganti password', onclick: function () { P.gantiPin = true; K().render(); } }));
      else wrap.appendChild(formPin());
      wrap.appendChild(h('button', { class: 'btn del block', id: 'btnKeluar', style: 'margin-top:14px', text: 'Keluar', onclick: function () { K().keluar(); } }));
    }
    pasang(topbar('Profil saya'), wrap);
  }
  /* Tombol simpan memberi tahu prosesnya DI TOMBOL ITU SENDIRI (permintaan Admin 25 Nov 2026): Menyimpan… -> Tersimpan (centang) atau Gagal + pesan tepat di bawahnya. */
  var IKON_CENTANG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-4px;margin-right:6px"><path d="M4 12.5l5 5L20 6.5"/></svg>';
  function mulai(btn) { btn.className = btn.className.replace(/\s*\b(ok|gagal|proses)\b/g, '') + ' proses'; btn.disabled = true; btn.textContent = 'Menyimpan…'; btn.setAttribute('aria-live', 'polite'); }
  function ok(btn, teks, lanjut) {
    btn.className = btn.className.replace(/\s*\bproses\b/g, '') + ' ok'; btn.disabled = true; btn.innerHTML = IKON_CENTANG; btn.appendChild(document.createTextNode(teks));
    setTimeout(function () { if (lanjut) lanjut(); }, 600);
  }
  function gagal(btn, msg, e, teksAsli) {
    btn.className = btn.className.replace(/\s*\b(proses|ok)\b/g, '') + ' gagal'; btn.disabled = false; btn.textContent = 'Belum tersimpan. Ketuk untuk coba lagi';
    msg.textContent = (e && e.message) || 'Belum tersimpan. Periksa sambungan internet.';
    try { msg.scrollIntoView({ block: 'nearest' }); } catch (x) { /* abaikan */ }
  }
  /** Formulir data diri yang boleh dilengkapi PIC sendiri. */
  function formDiri(R) {
    var F = P.formDiri = P.formDiri || { jk: R.jenisKelamin || '' };
    var nik = fld('dNik', 'NIK (wajib)', '16 angka sesuai KTP.', { maxlength: '16', inputmode: 'numeric', autocomplete: 'off' }, R.nik);
    var tmp = fld('dTempat', 'Tempat lahir', null, { maxlength: '60' }, R.tempatLahir);
    var tgl = fld('dTanggal', 'Tanggal lahir', null, { type: 'date' }, R.tanggalLahir); tgl.el.value = R.tanggalLahir || '';
    var alm = h('textarea', { id: 'dAlamat', rows: '3', maxlength: '300', autocomplete: 'off', placeholder: 'Contoh: Kp. Kecok RT 04 RW 02' }); alm.value = R.alamat || '';
    var wadahWil = h('div', { id: 'dWilayah' }), wil = window.SPPGWilayah ? window.SPPGWilayah.pasang(wadahWil, { desa: R.desa, kecamatan: R.kecamatan, kabupaten: R.kabupaten, provinsi: R.provinsi }, { awalan: 'dw' }) : null;
    var seg = h('div', { class: 'seg', id: 'dJk' });
    ['Laki-laki', 'Perempuan'].forEach(function (j) {
      seg.appendChild(h('button', { type: 'button', 'aria-pressed': String(F.jk === j), text: j, onclick: function () { F.jk = j; Array.prototype.forEach.call(seg.children, function (b) { b.setAttribute('aria-pressed', String(b.textContent === j)); }); } }));
    });
    var msg = h('div', { class: 'msg err', role: 'alert', 'aria-live': 'polite' }), btn = h('button', { class: 'btn block', id: 'btnSimpanDiri', text: 'Simpan data diri' });
    btn.addEventListener('click', async function () {
      msg.textContent = '';
      if (!/^\d{16}$/.test(String(nik.el.value || '').replace(/[\s.\-]/g, ''))) { msg.textContent = 'NIK wajib diisi: 16 angka sesuai KTP.'; nik.el.focus(); return; }
      if (wil && wil.pesanKurang()) { msg.textContent = wil.pesanKurang(); return; }
      mulai(btn);
      try {
        var w = wil ? wil.ambil() : {};
        await K().api('simpanProfilPic3B', { idInstansi: '', nik: nik.el.value, tempatLahir: tmp.el.value, tanggalLahir: tgl.el.value, jenisKelamin: F.jk, alamat: alm.value, desa: w.desa || '', kecamatan: w.kecamatan || '', kabupaten: w.kabupaten || '', provinsi: w.provinsi || '' });
        ok(btn, 'Data diri tersimpan', function () { P.profil = null; P.formDiri = null; P.beranda = null; K().render(); });
      } catch (e) { gagal(btn, msg, e, 'Simpan data diri'); }
    });
    return h('div', { class: 'item', id: 'formDiri' }, nik.blok, tmp.blok, tgl.blok, h('div', { class: 'fld' }, h('label', { text: 'Jenis kelamin' }), seg), wil ? wadahWil : null, h('div', { class: 'fld' }, h('label', { for: 'dAlamat', text: wil ? 'Alamat (jalan, RT/RW, kampung)' : 'Alamat' }), alm), btn, msg);
  }
  /** Username login, nomor HP, dan rekening. Yang sudah tersimpan hanya bisa diubah dengan password dan dibatasi 30 hari sekali. */
  function formAkun(R) {
    var usr = fld('aUsername', 'Username untuk masuk', 'Huruf kecil, angka, titik atau garis bawah (4-30). Bisa dipakai masuk bersama password.', { maxlength: '30', autocapitalize: 'none', autocomplete: 'off' }, R.username);
    var hp = fld('aHp', 'Nomor HP', R.sisaHariHp > 0 ? 'Nomor HP bisa diubah lagi ' + R.sisaHariHp + ' hari lagi.' : 'Dipakai untuk masuk dan menerima kode WhatsApp.', { type: 'tel', maxlength: '16', inputmode: 'tel', autocomplete: 'off' }, R.nomorHp);
    var nr = fld('aNamaRek', 'Nama pemilik rekening', null, { maxlength: '80', autocomplete: 'off' }, R.namaRekening);
    var rek = fld('aRek', 'Nomor rekening', R.rekeningTerisi ? 'Tersimpan: ' + R.rekening + (R.sisaHariRek > 0 ? '. Bisa diubah lagi ' + R.sisaHariRek + ' hari lagi.' : '. Ketik nomor baru bila ingin mengubah.') : 'Belum diisi. Isi bila perlu.', { inputmode: 'numeric', maxlength: '25', autocomplete: 'off' }, '');
    var pw = inputPin('aPassword', 'Password Anda', 'Hanya diperlukan untuk mengubah nomor HP atau rekening yang sudah tersimpan.');
    var msg = h('div', { class: 'msg err', role: 'alert', 'aria-live': 'polite' }), btn = h('button', { class: 'btn block', id: 'btnSimpanAkun', text: 'Simpan akun dan kontak' });
    btn.addEventListener('click', async function () {
      msg.textContent = '';
      var isi = { username: usr.el.value.trim() };
      if (hp.el.value.trim() && hp.el.value.trim() !== String(R.nomorHp || '').trim()) isi.nomorHp = hp.el.value.trim();
      if (rek.el.value.trim()) { isi.nomorRekening = rek.el.value.trim(); isi.namaRekening = nr.el.value.trim(); }
      if (pw.el.value) isi.password = pw.el.value;
      mulai(btn);
      try {
        await K().api('simpanAkunPic3B', Object.assign({ idInstansi: '' }, isi));
        ok(btn, 'Tersimpan', function () { P.profil = null; K().render(); });
      } catch (e) { gagal(btn, msg, e, 'Simpan akun dan kontak'); }
    });
    return h('div', { class: 'item', id: 'formAkun' }, usr.blok, hp.blok, nr.blok, rek.blok, pw.blok, btn, msg);
  }
  /* Kolom password + ikon mata (gambar garis, bukan emoji). */
  function kolomSandi(el) {
    var btn = h('button', { type: 'button', style: 'position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;padding:8px;min-width:44px;min-height:44px;line-height:0;color:#55606f;cursor:pointer' });
    function ikon(tampil) {
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/>' + (tampil ? '<path d="M3 3l18 18"/>' : '') + '</svg>';
      var t = tampil ? 'Sembunyikan password' : 'Tampilkan password'; btn.setAttribute('aria-label', t); btn.setAttribute('title', t);
    }
    ikon(false); el.style.paddingRight = '54px';
    btn.addEventListener('click', function () { var t = el.type === 'password'; el.type = t ? 'text' : 'password'; ikon(t); });
    return h('div', { style: 'position:relative' }, el, btn);
  }
  function inputPin(id, label, hint) {
    var el = h('input', { type: 'password', id: id, maxlength: '72', autocomplete: id === 'pinLama' ? 'current-password' : 'new-password' });
    return { el: el, blok: h('div', { class: 'fld' }, h('label', { for: id, text: label }), hint ? h('div', { class: 'hint', text: hint }) : null, kolomSandi(el)) };
  }
  function formPin() {
    var a = inputPin('pinLama', 'Password lama'), b = inputPin('pinBaru', 'Password baru', 'Minimal 8 karakter.'), c = inputPin('pinUlang', 'Ulangi password baru');
    var msg = h('div', { class: 'msg err', role: 'alert', 'aria-live': 'polite' }), btn = h('button', { class: 'btn block', id: 'btnSimpanPin', text: 'Simpan password baru' });
    btn.addEventListener('click', async function () {
      msg.textContent = '';
      if (!a.el.value) { msg.textContent = 'Isi password lama.'; return; }
      if (b.el.value.length < 8) { msg.textContent = 'Password baru minimal 8 karakter.'; return; }
      if (b.el.value !== c.el.value) { msg.textContent = 'Password baru dan ulangannya tidak sama.'; return; }
      mulai(btn);
      try {
        var d = await K().api('gantiPinPic3B', { idInstansi: '', passwordLama: a.el.value, passwordBaru: b.el.value });
        K().S.token = d.token; K().simpanSesi(); ok(btn, 'Password berhasil diganti', function () { P.gantiPin = false; P.profil = null; K().render(); });
      } catch (e) { gagal(btn, msg, e, 'Simpan password baru'); }
    });
    return h('div', { class: 'item' }, a.blok, b.blok, c.blok, btn, msg, h('button', { class: 'btn sec block', style: 'margin-top:10px', text: 'Batal', onclick: function () { P.gantiPin = false; K().render(); } }));
  }

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
            var koord = (d.lintang !== '' && d.lintang !== undefined && d.bujur !== '' && d.bujur !== undefined) ? d.lintang + ', ' + d.bujur : '';
      var kunci = h('div', { class: 'item', id: 'dataResmi', style: 'margin-top:12px' },
        h('div', { class: 'sec-h', style: 'margin:0 0 8px', text: 'Data tempat' }),
        h('div', { class: 'mrow' }, h('span', { class: 'ml', text: 'Nama' }), h('span', { text: namaTempat(d) })),
        h('div', { class: 'mrow' }, h('span', { class: 'ml', text: 'Koordinat' }), h('span', null, koord ? koord + ' ' : 'Belum diisi pengelola', koord ? h('a', { href: tautanPeta(koord), target: '_blank', rel: 'noopener', text: 'Lihat peta' }) : null)),
        h('button', { class: 'btn sm sec', id: 'btnLaporDataTempat', style: 'margin-top:8px', text: 'Nama atau koordinat salah? Laporkan', onclick: function () { bukaPengaduan({ kat: 'DATA_TEMPAT', idi: P.idi }); } }));
      wrap.appendChild(kunci);
      /* Alamat resmi: diisi PIC sendiri (keputusan Admin 25 Nov 2026). */
      var almAwal = P.formAlamat || { alamat: d.alamat || '', desa: d.desa || '', kecamatan: d.kecamatan || '', kabupaten: d.kabupaten || '', provinsi: d.provinsi || '' };
      var wadahA = h('div', { id: 'aWilayah' }), wilA = window.SPPGWilayah ? window.SPPGWilayah.pasang(wadahA, { desa: almAwal.desa, kecamatan: almAwal.kecamatan, kabupaten: almAwal.kabupaten, provinsi: almAwal.provinsi }, { awalan: 'aw' }) : null;
      var almJalan = h('textarea', { id: 'aAlamat', rows: '3', maxlength: '300', autocomplete: 'off', placeholder: 'Contoh: Kp. Kecok RT 04 RW 02' }); almJalan.value = almAwal.alamat;
      var almMsg = h('div', { class: 'msg err', role: 'alert', 'aria-live': 'polite' }), almBtn = h('button', { class: 'btn block', id: 'btnSimpanAlamatTempat', text: 'Simpan alamat resmi' });
      almBtn.addEventListener('click', async function () {
        almMsg.textContent = '';
        if (wilA && wilA.pesanKurang()) { almMsg.textContent = wilA.pesanKurang(); return; }
        mulai(almBtn);
        try {
          var w = wilA ? wilA.ambil() : {};
          var r = await K().api('simpanAlamatTempatPic3B', { idInstansi: P.idi, alamat: almJalan.value, desa: w.desa || '', kecamatan: w.kecamatan || '', kabupaten: w.kabupaten || '', provinsi: w.provinsi || '' });
          ok(almBtn, r.berubah ? 'Alamat resmi tersimpan' : 'Tidak ada yang berubah', function () { P.data = Object.assign({}, D, { dasar: r.dasar || d }); P.formAlamat = null; P.beranda = null; K().render(); });
        } catch (e) { gagal(almBtn, almMsg, e, 'Simpan alamat resmi'); }
      });
      wrap.appendChild(h('div', { class: 'item', id: 'formAlamatTempat', style: 'margin-top:12px' },
        h('div', { class: 'sec-h', style: 'margin:0 0 8px', text: 'Alamat resmi tempat' }),
        h('div', { class: 'hint', text: 'Diisi oleh PIC. Alamat ini dipakai untuk pengantaran makanan.' }),
        wilA ? wadahA : null, h('div', { class: 'fld' }, h('label', { for: 'aAlamat', text: wilA ? 'Alamat (jalan, RT/RW, kampung)' : 'Alamat' }), almJalan), almBtn, almMsg));
      wrap.appendChild(h('div', { class: 'tip', style: 'margin-top:12px', text: 'Isi data di bawah supaya pengantaran makanan lancar.' }));
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
        msg.textContent = ''; mulai(btn);
        try {
          var r = await K().api('simpanDataInstansiPic3B', { idInstansi: P.idi, kontakHp: f.kontakHp.el.value, email: f.email.el.value, jamTerimaMakan: f.jam.el.value, titikAntar: f.titik.el.value, lokasi: f.lokasi.el.value, picCadanganNama: f.cadN.el.value, picCadanganHp: f.cadH.el.value, catatan: f.cat.el.value });
          ok(btn, r.berubah ? 'Data tersimpan' : 'Tidak ada yang berubah', function () { P.data = Object.assign({}, D, { profil: r.profil, lengkap: r.lengkap }); P.beranda = null; K().render(); });
        } catch (e) { gagal(btn, msg, e, 'Simpan data'); }
      });
      wrap.appendChild(btn); wrap.appendChild(msg);
      if (p.diubahPada) wrap.appendChild(h('div', { class: 'meta', style: 'margin-top:10px;color:var(--mut);font-size:14px', text: 'Terakhir disimpan: ' + waktu(p.diubahPada) }));
    }
    pasang(topbar(D ? (D.dasar.posyandu ? 'Data Posyandu' : 'Data satuan pendidikan') : 'Data', D ? namaTempat(D.dasar) : ' '), wrap);
  }

  /* ---------- Pengaduan dan saran ---------- */
  var KAT_PENG = [['INSENTIF', 'Insentif saya kurang tepat'], ['PM_TAMBAH', 'Jumlah PM perlu ditambah'], ['PM_KURANG', 'Jumlah PM perlu dikurangi'], ['DATA_TEMPAT', 'Data tempat saya perlu diperbaiki'], ['MAKANAN', 'Makanan atau pengantaran'], ['SARAN', 'Kritik dan saran'], ['LAINNYA', 'Lainnya']];
  var STATUS_PENG = { BARU: 'Menunggu', DIPROSES: 'Sedang diproses', SELESAI: 'Selesai', DITOLAK: 'Tidak dapat dipenuhi', DITARIK: 'Ditarik' };
  /** Buka formulir; kat/idi/tgl bisa diisi dari tautan di Beranda (mis. "Insentif kurang tepat?"). */
  function bukaPengaduan(pra) { P.pengForm = { kat: (pra && pra.kat) || '', idi: (pra && pra.idi) || '', tgl: (pra && pra.tgl) || '', jml: '', pesan: '', selesai: null }; pindah('pengaduan'); }
  function ringkasWa(F, kata) { return 'Halo Admin, saya PIC. Saya baru mengirim pengaduan di Portal PIC (' + kata + '). Mohon dicek. Terima kasih.'; }
  function renderPengaduan() {
    if (!P.peng && !P.memuat && !P.galat) muat('peng', 'getPengaduanPic3B', { tandaiDibaca: true }, function (d) { P.peng = d; if (P.beranda && P.beranda.pengaduan) P.beranda.pengaduan.belumDibaca = 0; });
    var F = P.pengForm = P.pengForm || { kat: '', idi: '', tgl: '', jml: '', pesan: '', selesai: null }, wrap = h('div', { class: 'wrap', id: 'pengaduanPic' });
    status(wrap);
    var tempat = (K().S.instansi || []);
    if (!F.idi && tempat.length === 1) F.idi = tempat[0].id;
    if (F.selesai) {
      wrap.appendChild(h('div', { class: 'card', id: 'pengTerkirim' }, h('b', { text: 'Pengaduan terkirim' }), h('p', { class: 'meta', style: 'margin:6px 0 10px', text: 'Admin akan menanggapi. Tanggapan muncul di bawah ini dan ditandai "Baru". Bila mendesak, kabari Admin lewat WhatsApp.' }),
        h('a', { class: 'btn sec', href: 'https://wa.me/6285694765370?text=' + encodeURIComponent(ringkasWa(F, F.selesai)), target: '_blank', rel: 'noopener', style: 'display:block;text-align:center;text-decoration:none;line-height:1.9', text: 'Kabari Admin lewat WhatsApp' }),
        h('button', { class: 'btn sm', style: 'margin-top:10px', id: 'btnPengBaru', text: 'Buat pengaduan lain', onclick: function () { P.pengForm = null; K().render(); } })));
    } else {
      wrap.appendChild(h('h2', { text: 'Apa yang ingin disampaikan?' }));
      var kats = h('div', { class: 'seg', id: 'pengKat', style: 'grid-template-columns:1fr' });
      KAT_PENG.forEach(function (k) { kats.appendChild(h('button', { type: 'button', 'data-kat': k[0], 'aria-pressed': String(F.kat === k[0]), text: k[1], onclick: function () { F.kat = k[0]; K().render(); } })); });
      wrap.appendChild(kats);
      if (F.kat) {
        var pm = F.kat === 'PM_TAMBAH' || F.kat === 'PM_KURANG', perluTempat = pm || F.kat === 'DATA_TEMPAT', adaTgl = pm || F.kat === 'INSENTIF', box = h('div', { class: 'item', id: 'pengForm', style: 'margin-top:14px' });
        var sel = null;
        if (tempat.length > 1 || perluTempat) {
          sel = h('select', { id: 'pengTempat', class: 'sel', 'aria-label': 'Tempat' }); sel.appendChild(h('option', { value: '', text: perluTempat ? 'Pilih tempat' : 'Semua tempat saya' }));
          tempat.forEach(function (x) { var o = h('option', { value: x.id, text: namaTempat(x) }); if (x.id === F.idi) o.selected = true; sel.appendChild(o); });
          box.appendChild(h('div', { class: 'fld' }, h('label', { for: 'pengTempat', text: 'Tempat' }), sel));
        }
        var tgl = adaTgl ? fld('pengTgl', pm ? 'Mulai tanggal' : 'Tanggal yang dimaksud (boleh dikosongkan)', null, { type: 'date' }, F.tgl) : null; if (tgl) { tgl.el.value = F.tgl || ''; box.appendChild(tgl.blok); }
        var jml = pm ? fld('pengJml', F.kat === 'PM_TAMBAH' ? 'Ditambah berapa PM?' : 'Dikurangi berapa PM?', 'Isi angka saja.', { inputmode: 'numeric', maxlength: '4' }, F.jml) : null; if (jml) box.appendChild(jml.blok);
        var contoh = { INSENTIF: 'Contoh: insentif tanggal 23 belum masuk atau jumlahnya berbeda.', PM_TAMBAH: 'Contoh: ada 5 ibu hamil baru yang ikut.', PM_KURANG: 'Contoh: 3 balita sudah pindah.', DATA_TEMPAT: 'Contoh: alamat atau nama tempat salah.', MAKANAN: 'Contoh: makanan terlambat datang.', SARAN: 'Tulis kritik atau saran Anda.', LAINNYA: 'Tulis yang ingin disampaikan.' }[F.kat];
        var ps = h('textarea', { id: 'pengPesan', rows: '4', maxlength: '600', placeholder: contoh, autocomplete: 'off' }); ps.value = F.pesan || '';
        /* Simpan isian saat diketik supaya tidak hilang bila halaman digambar ulang (mis. daftar pengaduan baru selesai dimuat). */
        ps.addEventListener('input', function () { F.pesan = ps.value; });
        if (sel) sel.addEventListener('change', function () { F.idi = sel.value; });
        if (tgl) tgl.el.addEventListener('input', function () { F.tgl = tgl.el.value; });
        if (jml) jml.el.addEventListener('input', function () { F.jml = jml.el.value; });
        box.appendChild(h('div', { class: 'fld' }, h('label', { for: 'pengPesan', text: 'Pesan' }), ps));
        var msg = h('div', { class: 'msg err', role: 'alert', 'aria-live': 'polite' }), btn = h('button', { class: 'btn block', id: 'btnKirimPeng', text: 'Kirim' });
        btn.addEventListener('click', async function () {
          msg.textContent = ''; mulai(btn); btn.textContent = 'Mengirim…';
          try {
            F.pesan = ps.value; await K().api('kirimPengaduanPic3B', { kategori: F.kat, idInstansi: sel ? sel.value : (F.idi || ''), tanggal: tgl ? tgl.el.value : '', jumlah: jml ? jml.el.value : '', pesan: ps.value });
            var kata = (KAT_PENG.filter(function (k) { return k[0] === F.kat; })[0] || [0, ''])[1]; F.selesai = kata; ok(btn, 'Terkirim', function () { P.peng = null; K().render(); });
          } catch (e) { gagal(btn, msg, e, 'Kirim'); btn.textContent = 'Belum terkirim. Ketuk untuk coba lagi'; }
        });
        box.appendChild(btn); box.appendChild(msg); wrap.appendChild(box);
      }
    }
    wrap.appendChild(h('h2', { text: 'Pengaduan saya' }));
    var D = P.peng;
    if (D) {
      if (!D.items.length) wrap.appendChild(h('div', { class: 'empty', text: 'Belum ada pengaduan.' }));
      D.items.forEach(function (x) {
        var kartu = h('div', { class: 'item peng ' + String(x.status).toLowerCase(), 'data-id': x.id },
          h('div', { class: 'nm', text: x.kategoriLabel }),
          h('div', { class: 'meta', text: [x.namaInstansi, x.tanggal ? dmy(x.tanggal) : '', x.jumlah ? angka(x.jumlah) + ' PM' : '', waktu(x.dibuat)].filter(Boolean).join(' · ') }),
          h('p', { style: 'margin:6px 0', text: x.pesan }),
          h('div', null, h('span', { class: 'cs ' + (x.status === 'SELESAI' ? 'lengkap' : (x.status === 'DIPROSES' ? 'sebagian' : 'belum')), text: STATUS_PENG[x.status] || x.status })));
        if (x.balasan) kartu.appendChild(h('div', { class: 'ban', style: 'margin:8px 0 0;background:#E6F3FB;color:#0A1D33' }, h('b', { text: 'Tanggapan Admin' }), h('span', { text: x.balasan })));
        if (x.status === 'BARU') kartu.appendChild(h('button', { class: 'btn sm sec', style: 'margin-top:8px', 'data-aksi': 'tarik', text: 'Tarik pengaduan', onclick: function () {
          K().api('tarikPengaduanPic3B', { id: x.id }).then(function () { P.peng = null; K().render(); }).catch(function (e) { K().toast(e.message); }); } }));
        wrap.appendChild(kartu);
      });
    }
    pasang(topbar('Pengaduan dan saran'), wrap);
  }

  /* ---------- Bantuan ---------- */
  var FAQ = [
    ['Lupa password?', 'Di layar masuk, ketuk "Lupa password?". Kode dikirim lewat WhatsApp.'],
    ['Mau ganti password?', 'Buka Profil, lalu ketuk "Ganti password". Atau lewat Pengaturan.'],
    ['Mau mengubah alamat tempat?', 'Buka Beranda, ketuk "Data tempat" pada tempat Anda, lalu isi "Alamat resmi tempat" dan ketuk Simpan.'],
    ['Nama atau koordinat tempat salah?', 'Nama dan koordinat diatur pengelola. Di Data tempat, ketuk "Nama atau koordinat salah? Laporkan".'],
    ['Bagaimana mengisi data penerima manfaat?', 'Buka Pendataan, pilih tempat, isi formulir, lalu Simpan.'],
    ['Bisa ditempel dari Excel?', 'Bisa. Di Pendataan, ketuk "Tempel banyak data dari Excel". Tulis NISN lengkap 10 angka.'],
    ['Di mana melihat menu dan jumlah PM harian?', 'Buka tab "Menu & PM". Menu dan jumlah penerima manfaat per hari tampil di sana.'],
    ['Insentif saya kurang tepat?', 'Buka tab Insentif untuk melihat perhitungannya. Bila masih keliru, ketuk "Sampaikan pengaduan atau saran" di halaman ini.'],
    ['Cara mengganti foto profil?', 'Buka Profil, lalu ketuk "Ganti foto profil".'],
    ['Apakah data saya aman?', 'Hanya Anda dan pengelola yang bisa melihat data tempat Anda. Jangan berikan password kepada siapa pun.']
  ];
  function renderBantuan() {
    var wrap = h('div', { class: 'wrap', id: 'bantuanPic' });
    wrap.appendChild(h('div', { class: 'card', id: 'kartuPengaduan' }, h('b', { text: 'Ada kendala atau saran?' }),
      h('p', { class: 'meta', style: 'margin:6px 0 10px', text: 'Insentif kurang tepat, jumlah PM perlu ditambah atau dikurangi, data tempat salah, atau kritik dan saran. Tulis di sini, Admin akan menanggapi.' }),
      h('button', { class: 'btn', id: 'btnKePengaduan', text: 'Sampaikan pengaduan atau saran', onclick: function () { bukaPengaduan(null); } })));
    wrap.appendChild(h('h2', { text: 'Pertanyaan yang sering muncul' }));
    FAQ.forEach(function (q) { wrap.appendChild(h('details', { class: 'faq' }, h('summary', { text: q[0] }), h('p', { text: q[1] }))); });
    wrap.appendChild(h('h2', { text: 'Butuh bantuan?' }));
    wrap.appendChild(h('a', { class: 'btn block', href: WA_ADMIN, target: '_blank', rel: 'noopener', style: 'display:block;text-align:center;text-decoration:none;line-height:1.9', text: 'Hubungi Admin lewat WhatsApp' }));
    pasang(topbar('Bantuan'), wrap);
  }

  /* ---------- Pengaturan ---------- */
  var KEY_UKURAN = 'pic.ukuranTeks.v1';
  function ukuranTeks() { try { return localStorage.getItem(KEY_UKURAN) === 'besar' ? 'besar' : 'normal'; } catch (e) { return 'normal'; } }
  function terapkanUkuran() { try { document.documentElement.style.zoom = ukuranTeks() === 'besar' ? '1.12' : ''; } catch (e) { /* abaikan */ } }
  function renderPengaturan() {
    var wrap = h('div', { class: 'wrap', id: 'pengaturanPic' });
    wrap.appendChild(h('h2', { text: 'Tampilan' }));
    var seg = h('div', { class: 'seg', id: 'segUkuran', role: 'group', 'aria-label': 'Ukuran tulisan' });
    [['normal', 'Normal'], ['besar', 'Besar']].forEach(function (u) {
      seg.appendChild(h('button', { type: 'button', 'data-u': u[0], 'aria-pressed': String(ukuranTeks() === u[0]), text: u[1], onclick: function () {
        try { localStorage.setItem(KEY_UKURAN, u[0]); } catch (e) { /* tanpa penyimpanan: berlaku untuk sesi ini saja */ }
        terapkanUkuran(); Array.prototype.forEach.call(seg.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-u') === u[0])); });
      } }));
    });
    wrap.appendChild(h('div', { class: 'item' }, h('div', { class: 'nm', text: 'Ukuran tulisan' }), h('div', { class: 'meta', style: 'margin:4px 0 10px', text: 'Pilih Besar bila tulisan terasa kecil.' }), seg));
    wrap.appendChild(h('h2', { text: 'Keamanan' }));
    wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnPengGantiPassword', text: 'Ganti password', onclick: function () { P.gantiPin = true; pindah('profil'); } }));
    wrap.appendChild(h('h2', { text: 'Pemberitahuan' }));
    wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnPengNotif', text: 'Lihat pemberitahuan dari pengelola', onclick: function () { pindah('notifikasi'); } }));
    wrap.appendChild(h('h2', { text: 'Bantuan' }));
    wrap.appendChild(h('button', { class: 'btn sec block', id: 'btnPengBantuan', text: 'Bantuan dan pertanyaan', onclick: function () { pindah('bantuan'); } }));
    wrap.appendChild(h('a', { class: 'btn sec block', id: 'btnPengWa', href: WA_ADMIN, target: '_blank', rel: 'noopener', style: 'display:block;text-align:center;text-decoration:none;line-height:1.9;margin-top:8px', text: 'Hubungi Admin lewat WhatsApp' }));
    wrap.appendChild(h('div', { class: 'item', style: 'margin-top:16px' }, h('div', { class: 'meta', text: 'Portal PIC SPPG Jeungjing. Data Anda hanya bisa dilihat Anda dan pengelola.' })));
    wrap.appendChild(h('button', { class: 'btn del block', id: 'btnPengKeluar', style: 'margin-top:14px', text: 'Keluar', onclick: function () { K().keluar(); } }));
    pasang(topbar('Pengaturan'), wrap);
  }

  window.PortalPic = {
    reset: reset,
    render: function () {
      terapkanUkuran(); var v = K().S.view; if (v === 'pilih') v = 'beranda';
      P.tab = v;
      if (v === 'menu') renderMenu(); else if (v === 'pendataan') renderPendataan(); else if (v === 'profil') renderProfil(); else if (v === 'pengaturan') renderPengaturan(); else if (v === 'instansi') renderInstansi(); else if (v === 'pemutakhiran') renderPemutakhiran(); else if (v === 'pengaduan') renderPengaduan(); else if (v === 'harian') renderHarian(); else if (v === 'insentif') renderInsentif(); else if (v === 'bantuan') renderBantuan(); else if (v === 'notifikasi') renderNotifikasi(); else renderBeranda();
    },
    tampil: function (v) { return ['beranda', 'pilih', 'menu', 'harian', 'insentif', 'pendataan', 'pemutakhiran', 'pengaduan', 'profil', 'instansi', 'bantuan', 'pengaturan', 'notifikasi'].indexOf(v) >= 0; },
    bukaInstansi: bukaInstansi,
    bukaPengaduan: bukaPengaduan,
    segar: segar,
    nav: function (formulir) { var n = navbawah(); if (formulir) n.classList.add('formnav'); return n; },   // dipakai layar pendataan (Posyandu & sekolah) agar navigasi tetap ada
    adalahPosyandu: adalahPosyandu,
    sisipMerek: sisipMerek,
    kartuKemajuan: kartuKemajuan,
    ringkasanTempat: ringkasanTempat,
    grafik: grafik
  };
})();

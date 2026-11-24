// ============================================================
// public-situs.js — Website Publik SPPG Jeungjing (25 Nov 2026).
// SATU panggilan ke server (getSitusPublik: publik, tanpa login) lalu mengisi bagian-bagian halaman
// sesuai data-halaman-publik. Semua isi berasal dari portal (Data Relawan, PM per hari, Menu, Master Lokasi,
// isian Admin, Kabar). Tidak ada angka atau nama yang ditulis tetap di halaman.
// Bagian yang datanya kosong disembunyikan (tidak menampilkan tanda "—" atau data contoh).
// Semua teks dimasukkan lewat textContent (aman dari penyisipan HTML).
// ============================================================
(function () {
  'use strict';
  var HALAMAN = document.body.getAttribute('data-halaman-publik') || '';
  var ALAMAT_BAWAAN = 'Kp. Kecok, RT.004, Desa Jeungjing, Kecamatan Cisoka, Kabupaten Tangerang, Banten 15730';
  var TEKS_BAWAAN = {
    tentang_bgn: 'Badan Gizi Nasional (BGN) adalah lembaga pemerintah yang bertanggung jawab atas penyelenggaraan pemenuhan gizi nasional, termasuk Program Makanan Bergizi Gratis (MBG), agar anak-anak, ibu hamil, ibu menyusui, dan balita mendapat makanan yang bergizi.',
    tentang_sppg: 'Satuan Pelayanan Pemenuhan Gizi (SPPG) adalah unit pelaksana di lapangan yang menyiapkan dan mendistribusikan makanan bergizi kepada penerima manfaat Program MBG di wilayah layanannya.',
    tentang_jeungjing: 'SPPG Jeungjing berlokasi di Desa Jeungjing, Kecamatan Cisoka, Kabupaten Tangerang, Banten. Pada setiap hari operasional, SPPG Jeungjing menyiapkan makanan bergizi bersama para relawan, lalu menyalurkannya ke satuan pendidikan dan kelompok penerima manfaat di wilayah layanan.'
  };
  var FAQ = [
    ['Apa itu SPPG?', function () { return TEKS_BAWAAN.tentang_sppg; }],
    ['Siapa yang menerima makanan bergizi dari SPPG Jeungjing?', function () { return 'Peserta didik pada satuan pendidikan yang dilayani, serta ibu hamil, ibu menyusui, dan balita yang terdaftar di posyandu wilayah layanan. Daftar dan jumlahnya dapat dilihat di halaman Penerima Manfaat.'; }],
    ['Di mana dan kapan SPPG Jeungjing beroperasi?', function (d) { var j = d.konten.jam_operasional; return 'SPPG Jeungjing berada di ' + (d.konten.alamat || ALAMAT_BAWAAN) + '. ' + (j ? 'Jam operasional: ' + j + '.' : 'Untuk jam operasional, silakan hubungi kontak resmi kami.'); }],
    ['Kapan makanan diantar?', function (d) { var j = d.konten.jam_pengantaran; return j ? 'Jam pengantaran: ' + j + '. Jam tepatnya dapat berbeda untuk tiap tempat; PIC masing-masing tempat menerima informasinya dari SPPG.' : 'Jadwal pengantaran diatur untuk tiap tempat. Silakan hubungi kontak resmi atau PIC tempat Anda.'; }],
    ['Di mana saya bisa melihat menu hari ini?', function () { return 'Menu hari ini ditampilkan di halaman Menu Hari Ini dan di Beranda, dan diperbarui otomatis sesuai menu yang ditetapkan SPPG.'; }],
    ['Bagaimana cara menghubungi SPPG Jeungjing?', function (d) { var p = []; if (d.konten.telepon) p.push('telepon atau WhatsApp ' + d.konten.telepon); if (d.konten.email) p.push('email ' + d.konten.email); return p.length ? 'Anda dapat menghubungi kami lewat ' + p.join(' atau ') + '. Informasi lengkap ada di halaman Kontak.' : 'Informasi kontak resmi tersedia di halaman Kontak.'; }]
  ];
  var BULAN_KATEGORI = { PENGUMUMAN: 'Pengumuman', KEGIATAN: 'Kegiatan', LAYANAN: 'Layanan' };

  function q(s, r) { return (r || document).querySelector(s); }
  function el(tag, atr, kids) {
    var e = document.createElement(tag);
    if (atr) Object.keys(atr).forEach(function (k) { if (k === 'text') e.textContent = atr[k]; else if (k === 'class') e.className = atr[k]; else e.setAttribute(k, atr[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function kosongkan(e) { while (e && e.firstChild) e.removeChild(e.firstChild); return e; }
  function sembunyi(e, s) { if (e) e.hidden = !!s; }
  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function tglIndo(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? (Number(m[3]) + ' ' + NAMA_BULAN[Number(m[2]) - 1] + ' ' + m[1]) : String(s || ''); }
  function angka(n) { return Number(n || 0).toLocaleString('id-ID'); }
  function teks(d, kunci) { return (d.konten && d.konten[kunci]) || TEKS_BAWAAN[kunci] || ''; }
  function nomorWa(t) { var s = String(t || '').replace(/\D/g, ''); if (!s) return ''; if (s.indexOf('0') === 0) s = '62' + s.slice(1); else if (s.indexOf('8') === 0) s = '62' + s; return /^62\d{8,13}$/.test(s) ? s : ''; }
  function tautanAman(u) { return /^https:\/\//i.test(String(u || '')) ? u : ''; }
  function petaEmbed(l) { return 'https://www.google.com/maps?q=' + l.latitude + ',' + l.longitude + '&z=17&output=embed'; }
  function petaTautan(l) { return 'https://www.google.com/maps/search/?api=1&query=' + l.latitude + ',' + l.longitude; }

  function muat() {
    return new Promise(function (resolve) {
      try { var c = JSON.parse(sessionStorage.getItem('situs_publik_v1') || 'null'); if (c && Date.now() - c.t < 60000) return resolve(c.d); } catch (e) { /* tanpa cache */ }
      if (typeof GOOGLE_APPS_SCRIPT_WEB_APP_URL === 'undefined') return resolve(null);
      fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL + '?action=getSitusPublik').then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.success || !j.data) return resolve(null);
        try { sessionStorage.setItem('situs_publik_v1', JSON.stringify({ t: Date.now(), d: j.data })); } catch (e) { /* abaikan */ }
        resolve(j.data);
      }).catch(function () { resolve(null); });
    });
  }

  /* ---------- bagian bersama ---------- */
  function isiPeta(wadah, d) {
    if (!wadah) return;
    kosongkan(wadah);
    if (d.lokasi) {
      var f = el('iframe', { src: petaEmbed(d.lokasi), title: 'Peta lokasi ' + (d.lokasi.nama || 'SPPG Jeungjing'), width: '100%', height: '100%', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade', style: 'border:0;' });
      wadah.appendChild(f);
    } else { wadah.appendChild(el('p', { class: 'pub-menu-kosong', text: 'Peta lokasi belum tersedia.' })); }
    var tautan = q('[data-situs="tautan-peta"]');
    if (tautan) { if (d.lokasi) { tautan.href = petaTautan(d.lokasi); sembunyi(tautan, false); } else sembunyi(tautan, true); }
  }
  function isiFooter(d) {
    var a = q('#footAlamat'); if (a) a.textContent = d.konten.alamat || ALAMAT_BAWAAN;
    var k = q('#footKontak'); if (!k) return; kosongkan(k);
    if (d.konten.email) k.appendChild(el('a', { href: 'mailto:' + d.konten.email, text: d.konten.email }));
    var wa = nomorWa(d.konten.telepon);
    if (d.konten.telepon) k.appendChild(el('a', { href: wa ? 'https://wa.me/' + wa : 'tel:' + d.konten.telepon.replace(/\s/g, ''), text: d.konten.telepon }));
    [['instagram', 'instagram_username', 'Instagram'], ['tiktok', 'tiktok_username', 'TikTok'], ['facebook', '', 'Facebook']].forEach(function (s) {
      var u = tautanAman(d.konten[s[0]]); if (u) k.appendChild(el('a', { href: u, target: '_blank', rel: 'noopener', text: (s[1] && d.konten[s[1]]) || s[2] }));
    });
  }
  function isiStatus(d) {
    var b = q('#statusHariIni'); if (!b) return;
    if (!d.statusHariIni) { sembunyi(b, true); return; }
    b.textContent = d.statusHariIni.label + (d.statusHariIni.status === 'LIBUR' && d.statusHariIni.keterangan ? ' · ' + d.statusHariIni.keterangan : '');
    b.className = 'pub-status ' + (d.statusHariIni.status === 'LIBUR' ? 'libur' : 'buka'); sembunyi(b, false);
  }
  function kartu(angkaTeks, label, catatan) { return el('div', { class: 'pub-benef-card' }, [el('b', { text: angkaTeks }), el('span', { text: label }), catatan ? el('em', { class: 'pub-catat', text: catatan }) : null]); }

  /* ---------- menu ---------- */
  var KAT_MENU = [['karbohidrat', 'Karbohidrat'], ['laukHewani', 'Lauk hewani'], ['laukNabati', 'Lauk nabati'], ['sayur', 'Sayur'], ['buah', 'Buah'], ['pelengkap', 'Pelengkap']];
  function isiMenu(wadah, d) {
    if (!wadah) return; kosongkan(wadah);
    var m = d.menu, n = 0;
    if (m) KAT_MENU.forEach(function (k) { if (m[k[0]]) { n++; wadah.appendChild(el('div', { class: 'pub-menu-item' }, [el('div', { class: 'label', text: m[k[0]] }), el('div', { class: 'val', text: k[1] })])); } });
    if (!n) wadah.appendChild(el('p', { class: 'pub-menu-kosong', text: 'Menu hari ini belum ditetapkan. Silakan cek kembali nanti.' }));
    return m;
  }

  /* ---------- halaman ---------- */
  var HALAMAN_ISI = {
    beranda: function (d) {
      isiStatus(d);
      var g = q('#ringkasanGrid'); kosongkan(g); var r = d.ringkasan || {}, pm = r.pm, n = 0;
      function tambah(a, l, c) { g.appendChild(kartu(a, l, c)); n++; }
      if (pm) { tambah(angka(pm.total), 'Penerima manfaat', pm.tanggalIndo ? (pm.bukanHariIni ? 'Data terakhir: ' : 'Data: ') + pm.tanggalIndo : ''); if (pm.jumlahSekolah) tambah(angka(pm.jumlahSekolah), 'Satuan pendidikan dilayani'); if (pm.jumlahPosyandu) tambah(angka(pm.jumlahPosyandu), 'Posyandu dilayani'); }
      if (r.relawanAktif) tambah(angka(r.relawanAktif), 'Relawan aktif');
      sembunyi(q('#ringkasanSection'), !n);
      var m = isiMenu(q('#menuGrid'), d); var mt = q('#menuTanggal'); if (mt) mt.textContent = m && m.hari ? (m.hari + (m.tanggal ? ', ' + tglIndo(m.tanggal) : '')) : '';
      var bg = q('#benefGrid'); kosongkan(bg);
      if (pm) { [['pesertaDidik', 'Peserta didik'], ['ibuHamil', 'Ibu hamil'], ['ibuMenyusui', 'Ibu menyusui'], ['balita', 'Balita']].forEach(function (x) { bg.appendChild(kartu(angka(pm[x[0]]), x[1])); }); } else bg.appendChild(el('p', { class: 'pub-menu-kosong', text: 'Data penerima manfaat belum tersedia.' }));
      var kb = q('#kabarList'); kosongkan(kb); var daftar = (d.kabar || []).slice(0, 3);
      daftar.forEach(function (k) { kb.appendChild(el('div', { class: 'pub-info-row' }, [el('time', { text: k.tanggalIndo || k.tanggal }), el('div', null, [el('h3', { text: k.judul }), el('p', { text: k.isi })])])); });
      sembunyi(q('#kabarSection'), !daftar.length);
      var la = q('#lokasiAlamat'); if (la) la.textContent = d.konten.alamat || ALAMAT_BAWAAN; isiPeta(q('#lokasiPeta'), d);
    },
    profil: function (d) {
      [['bgn', 'tentang_bgn'], ['sppg', 'tentang_sppg'], ['jeungjing', 'tentang_jeungjing']].forEach(function (x) { var e = q('#tentang-' + x[0]); if (e) e.textContent = teks(d, x[1]); });
      var w = q('#strukturWadah'); kosongkan(w); var tingkat = (d.struktur && d.struktur.tingkat) || [];
      tingkat.forEach(function (t, i) {
        if (i > 0) w.appendChild(el('p', { class: 'pub-struktur-divider', 'aria-hidden': 'true', text: '↓' }));
        if (t.judul) w.appendChild(el('p', { class: 'pub-struktur-subhead', text: t.judul }));
        var baris = el('div', { class: 'pub-struktur-tier' });
        t.kelompok.forEach(function (g) {
          var kd = el('div', { class: 'pub-struktur-card' + (g.divisi ? ' divisi' : '') + (g.kunci === 'ksppg' ? ' pimpinan' : '') });
          kd.appendChild(el('p', { class: 'peran' }, [g.peran, g.divisi ? el('span', { class: 'jumlah', text: g.anggota.length + ' orang' }) : null]));
          if (g.divisi || g.anggota.length > 1) { var ol = el('ol'); g.anggota.forEach(function (a) { ol.appendChild(el('li', null, [a.nama, a.koordinator ? el('span', { class: 'pub-koor', text: ' (Koordinator)' }) : null])); }); kd.appendChild(ol); }
          else kd.appendChild(el('p', { class: 'nama-utama', text: g.anggota[0].nama }));
          baris.appendChild(kd);
        });
        w.appendChild(baris);
      });
      sembunyi(q('#strukturSection'), !tingkat.length);
      var k = d.konten, ya = q('#naunganYayasan'), mi = q('#naunganMitra');
      function isiKotak(e, judulK, nama, ket, ketua) { sembunyi(e, !nama); if (!nama) return; kosongkan(e); e.appendChild(el('h3', { text: judulK })); e.appendChild(el('p', { class: 'pub-naungan-nama', text: nama })); if (ketua) e.appendChild(el('p', { class: 'pub-catat', text: 'Ketua: ' + ketua })); if (ket) e.appendChild(el('p', { text: ket })); }
      isiKotak(ya, 'Yayasan', k.yayasan_nama, k.yayasan_keterangan, k.yayasan_ketua); isiKotak(mi, 'Mitra', k.mitra_nama, k.mitra_keterangan, '');
      sembunyi(q('#naunganSection'), !k.yayasan_nama && !k.mitra_nama);
    },
    penerima: function (d) {
      var pm = d.ringkasan && d.ringkasan.pm, ket = q('#pmKet'), ring = q('#pmRingkas'), daftar = q('#pmSekolah'), kosong = q('#pmKosong');
      if (!pm) { sembunyi(kosong, false); sembunyi(q('#pmIsi'), true); return; }
      sembunyi(kosong, true); sembunyi(q('#pmIsi'), false);
      if (ket) ket.textContent = (pm.bukanHariIni ? 'Data terakhir: ' : 'Data hari ini: ') + (pm.tanggalIndo || '');
      q('#pmTotal').textContent = angka(pm.total);
      kosongkan(ring); [['pesertaDidik', 'Peserta didik'], ['ibuHamil', 'Ibu hamil'], ['ibuMenyusui', 'Ibu menyusui'], ['balita', 'Balita']].forEach(function (x) { ring.appendChild(kartu(angka(pm[x[0]]), x[1])); });
      kosongkan(daftar);
      (pm.sekolah || []).forEach(function (s) { daftar.appendChild(el('div', { class: 'pub-info-row' }, [el('time', { text: angka(s.jumlah) + ' porsi' }), el('div', null, [el('h3', { text: s.nama }), el('p', { text: 'Porsi kecil ' + angka(s.pk) + ' · Porsi besar ' + angka(s.pb) })])])); });
      sembunyi(q('#pmSekolahSection'), !(pm.sekolah || []).length);
      var po = q('#pmPosyandu'); if (po) { po.textContent = pm.jumlahPosyandu ? (angka(pm.jumlahPosyandu) + ' posyandu dilayani. Rincian posyandu tidak ditampilkan untuk menjaga privasi ibu dan balita; yang tampil hanya jumlah keseluruhan.') : ''; sembunyi(q('#pmPosyanduSection'), !pm.jumlahPosyandu); }
    },
    menu: function (d) {
      var m = isiMenu(q('#menuGrid'), d), h = q('#menuHari'), t = q('#menuTema');
      if (h) h.textContent = m && m.hari ? (m.hari + (m.tanggal ? ', ' + tglIndo(m.tanggal) : '')) : '';
      if (t) { t.textContent = m && m.tema ? m.tema : ''; sembunyi(t, !(m && m.tema)); }
    },
    informasi: function (d) {
      var k = d.konten, l = q('#layananList'); kosongkan(l); var n = 0;
      function baris(judul, isi, tautan) { if (!isi) return; n++; l.appendChild(el('div', { class: 'pub-info-row' }, [el('time', { text: judul }), el('div', null, [tautan ? el('p', null, [el('a', { href: tautan, target: '_blank', rel: 'noopener', text: isi })]) : el('p', { text: isi })])])); }
      baris('Lokasi', k.alamat || ALAMAT_BAWAAN, d.lokasi ? petaTautan(d.lokasi) : '');
      baris('Jam operasional', k.jam_operasional); baris('Jam pengantaran', k.jam_pengantaran);
      var wa = nomorWa(k.telepon); baris('Telepon', k.telepon, wa ? 'https://wa.me/' + wa : ''); baris('Email', k.email, k.email ? 'mailto:' + k.email : '');
      var kb = q('#kabarSemua'); kosongkan(kb);
      (d.kabar || []).forEach(function (x) { kb.appendChild(el('div', { class: 'pub-info-row' }, [el('time', { text: x.tanggalIndo || x.tanggal }), el('div', null, [el('span', { class: 'pub-tag', text: BULAN_KATEGORI[x.kategori] || 'Pengumuman' }), el('h3', { text: x.judul }), el('p', { text: x.isi })])])); });
      sembunyi(q('#kabarSection'), !(d.kabar || []).length);
      var fq = q('#faqList'); kosongkan(fq);
      FAQ.forEach(function (f) { fq.appendChild(el('details', { class: 'pub-faq' }, [el('summary', { text: f[0] }), el('p', { text: f[1](d) })])); });
    },
    kontak: function (d) {
      var k = d.konten, l = q('#kontakList'); kosongkan(l);
      function item(label, isi, tautan) { if (!isi) return; l.appendChild(el('div', { class: 'pub-contact-item' }, [el('div', null, [el('small', { class: 'pub-catat', text: label }), tautan ? el('a', { href: tautan, text: isi }) : el('span', { text: isi })])])); }
      item('Alamat', k.alamat || ALAMAT_BAWAAN); item('Telepon', k.telepon, k.telepon ? 'tel:' + k.telepon.replace(/\s/g, '') : '');
      var wa = nomorWa(k.telepon); if (wa) item('WhatsApp', 'Kirim pesan WhatsApp', 'https://wa.me/' + wa);
      item('Email', k.email, k.email ? 'mailto:' + k.email : ''); item('Jam operasional', k.jam_operasional); item('Jam pengantaran', k.jam_pengantaran);
      var s = q('#sosialRow'); kosongkan(s); var ada = 0;
      [['instagram', 'instagram_username', 'Instagram'], ['tiktok', 'tiktok_username', 'TikTok'], ['facebook', '', 'Facebook']].forEach(function (x) { var u = tautanAman(k[x[0]]); if (u) { ada++; s.appendChild(el('a', { href: u, target: '_blank', rel: 'noopener', class: 'pub-social-pill', text: (x[1] && k[x[1]]) || x[2] })); } });
      sembunyi(q('#sosialWrap'), !ada); isiPeta(q('#kontakPeta'), d);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    muat().then(function (d) {
      var gagal = q('#situsGagal');
      if (!d) { if (gagal) sembunyi(gagal, false); return; }
      d.konten = d.konten || {};
      sembunyi(gagal, true);
      try { isiFooter(d); } catch (e) { /* bagian lain tetap jalan */ }
      try { if (HALAMAN_ISI[HALAMAN]) HALAMAN_ISI[HALAMAN](d); } catch (e) { if (gagal) sembunyi(gagal, false); }
    });
  });
})();

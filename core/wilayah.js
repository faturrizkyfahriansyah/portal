/**
 * Isian wilayah bertingkat: Provinsi > Kabupaten/Kota > Kecamatan > Desa/Kelurahan.
 * Dipakai di data Relawan, PIC, dan Instansi (Posyandu/sekolah). Berdiri sendiri (tanpa pustaka lain).
 * Provinsi: dropdown (38). Kabupaten/Kota: dropdown untuk Banten, DKI Jakarta, Jawa Barat; provinsi lain ketik sendiri.
 * Kecamatan: dropdown untuk Kabupaten Tangerang; wilayah lain ketik sendiri. Desa/Kelurahan: ketik, dengan saran.
 * Nilai disimpan sebagai teks biasa (mis. "Kabupaten Tangerang"), jadi data lama tetap terbaca.
 *
 *   var w = SPPGWilayah.pasang(wadah, { desa:'', kecamatan:'', kabupaten:'', provinsi:'' }, { awalan:'x', saranDesa:['Jeungjing'], terkunci:false });
 *   w.ambil()  -> { desa, kecamatan, kabupaten, provinsi }
 */
(function () {
  'use strict';
  var LAIN = '__lain';
  var PROVINSI = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung',
    'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
    'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
    'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara',
    'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan'];
  var KABUPATEN = {
    'Banten': ['Kabupaten Pandeglang', 'Kabupaten Lebak', 'Kabupaten Tangerang', 'Kabupaten Serang', 'Kota Tangerang', 'Kota Cilegon', 'Kota Serang', 'Kota Tangerang Selatan'],
    'DKI Jakarta': ['Kota Jakarta Pusat', 'Kota Jakarta Utara', 'Kota Jakarta Barat', 'Kota Jakarta Selatan', 'Kota Jakarta Timur', 'Kabupaten Kepulauan Seribu'],
    'Jawa Barat': ['Kabupaten Bogor', 'Kabupaten Sukabumi', 'Kabupaten Cianjur', 'Kabupaten Bandung', 'Kabupaten Garut', 'Kabupaten Tasikmalaya', 'Kabupaten Ciamis', 'Kabupaten Kuningan',
      'Kabupaten Cirebon', 'Kabupaten Majalengka', 'Kabupaten Sumedang', 'Kabupaten Indramayu', 'Kabupaten Subang', 'Kabupaten Purwakarta', 'Kabupaten Karawang', 'Kabupaten Bekasi',
      'Kabupaten Bandung Barat', 'Kabupaten Pangandaran', 'Kota Bogor', 'Kota Sukabumi', 'Kota Bandung', 'Kota Cirebon', 'Kota Bekasi', 'Kota Depok', 'Kota Cimahi', 'Kota Tasikmalaya', 'Kota Banjar']
  };
  var KECAMATAN = {
    'Kabupaten Tangerang': ['Balaraja', 'Cikupa', 'Cisauk', 'Cisoka', 'Curug', 'Gunung Kaler', 'Jambe', 'Jayanti', 'Kelapa Dua', 'Kemiri', 'Kosambi', 'Kresek', 'Kronjo', 'Legok', 'Mauk',
      'Mekar Baru', 'Pagedangan', 'Pakuhaji', 'Panongan', 'Pasar Kemis', 'Rajeg', 'Sepatan', 'Sepatan Timur', 'Sindang Jaya', 'Solear', 'Sukadiri', 'Sukamulya', 'Teluknaga', 'Tigaraksa']
  };
  var BAWAAN = { provinsi: 'Banten', kabupaten: 'Kabupaten Tangerang' };   // wilayah SPPG; dipilih awal agar tidak perlu mengetik

  function el(tag, attr, anak) {
    var e = document.createElement(tag);
    Object.keys(attr || {}).forEach(function (k) { if (k === 'text') e.textContent = attr[k]; else if (k === 'class') e.className = attr[k]; else e.setAttribute(k, attr[k]); });
    (anak || []).forEach(function (a) { if (a) e.appendChild(a); });
    return e;
  }
  function gaya() {
    if (document.getElementById('wlGaya')) return;
    var s = document.createElement('style'); s.id = 'wlGaya';
    s.textContent = '.wl{display:grid;gap:10px;margin:0 0 6px}.wl .wl-f{display:block}.wl label{display:block;font-size:13px;font-weight:600;margin:0 0 4px;color:inherit}'
      + '.wl select,.wl input{width:100%;box-sizing:border-box;min-height:44px;padding:8px 10px;border:1px solid #c9d3dd;border-radius:10px;font:inherit;background:#fff;color:#14304F}'
      + '.wl input+input,.wl select+input{margin-top:6px}.wl [disabled]{background:#f1f4f7;color:#5b6876}';
    document.head.appendChild(s);
  }
  function opsiSelect(daftar, nilai, kosong) {
    var s = el('select'), o = el('option', { value: '', text: kosong }); s.appendChild(o);
    daftar.forEach(function (d) { s.appendChild(el('option', { value: d, text: d })); });
    s.appendChild(el('option', { value: LAIN, text: 'Lainnya, ketik sendiri' }));
    return s;
  }
  /** Satu tingkat: dropdown bila ada daftar, kalau tidak (atau pilih "Lainnya") kolom ketik. */
  function tingkat(id, label, kosong) {
    var wadah = el('div', { class: 'wl-f' }), lab = el('label', { for: id, text: label }), sel = null, inp = el('input', { type: 'text', id: id + 'Teks', maxlength: '80', autocomplete: 'off', 'aria-label': label });
    wadah.appendChild(lab);
    var T = { wadah: wadah, lab: lab, inp: inp, sel: null, id: id, kosong: kosong,
      pasangDaftar: function (daftar, nilai) {
        if (T.sel && T.sel.parentNode) T.sel.parentNode.removeChild(T.sel);
        T.sel = null;
        if (daftar) {
          T.sel = opsiSelect(daftar, nilai, kosong); T.sel.id = id; lab.setAttribute('for', id);
          wadah.insertBefore(T.sel, inp);
          if (nilai && daftar.indexOf(nilai) >= 0) { T.sel.value = nilai; inp.style.display = 'none'; inp.value = ''; }
          else if (nilai) { T.sel.value = LAIN; inp.style.display = ''; inp.value = nilai; }
          else { T.sel.value = ''; inp.style.display = 'none'; inp.value = ''; }
          T.sel.addEventListener('change', function () { inp.style.display = T.sel.value === LAIN ? '' : 'none'; if (T.sel.value !== LAIN) inp.value = ''; if (T.onUbah) T.onUbah(); });
        } else { inp.style.display = ''; inp.value = nilai || ''; lab.setAttribute('for', id + 'Teks'); }
      },
      nilai: function () { if (T.sel) { var v = T.sel.value; return v === LAIN ? inp.value.trim() : v; } return inp.value.trim(); },
      kunci: function (b) { if (T.sel) T.sel.disabled = !!b; inp.disabled = !!b; }
    };
    inp.addEventListener('input', function () { if (T.onUbah) T.onUbah(); });
    wadah.appendChild(inp);
    return T;
  }
  function pasang(wadah, nilai, opsi) {
    gaya(); opsi = opsi || {}; nilai = nilai || {};
    var aw = opsi.awalan || 'wl' + Math.floor(Math.random() * 1e6);
    var kosong = !(nilai.provinsi || nilai.kabupaten || nilai.kecamatan || nilai.desa);
    var awal = {
      provinsi: nilai.provinsi || (kosong && opsi.bawaan !== false ? BAWAAN.provinsi : ''),
      kabupaten: nilai.kabupaten || (kosong && opsi.bawaan !== false ? BAWAAN.kabupaten : ''),
      kecamatan: nilai.kecamatan || '', desa: nilai.desa || ''
    };
    var prov = tingkat(aw + 'Prov', 'Provinsi', 'Pilih provinsi'), kab = tingkat(aw + 'Kab', 'Kabupaten/Kota', 'Pilih kabupaten/kota'), kec = tingkat(aw + 'Kec', 'Kecamatan', 'Pilih kecamatan');
    var desa = el('div', { class: 'wl-f' }), dl = el('datalist', { id: aw + 'DesaSaran' }), dIn = el('input', { type: 'text', id: aw + 'Desa', maxlength: '80', autocomplete: 'off', list: aw + 'DesaSaran', placeholder: 'Ketik nama desa atau kelurahan' });
    (opsi.saranDesa || []).forEach(function (s) { dl.appendChild(el('option', { value: s })); });
    desa.appendChild(el('label', { for: aw + 'Desa', text: 'Desa/Kelurahan' })); desa.appendChild(dIn); desa.appendChild(dl); dIn.value = awal.desa;
    function isiKab() { kab.pasangDaftar(KABUPATEN[prov.nilai()] || null, awalKab); awalKab = ''; isiKec(); }
    function isiKec() { kec.pasangDaftar(KECAMATAN[kab.nilai()] || null, awalKec); awalKec = ''; }
    var awalKab = awal.kabupaten, awalKec = awal.kecamatan;
    prov.pasangDaftar(PROVINSI, awal.provinsi);
    kab.onUbah = function () { awalKec = kec.nilai(); isiKec(); };
    prov.onUbah = function () { awalKab = ''; awalKec = ''; isiKab(); };
    isiKab();
    var kotak = el('div', { class: 'wl' }, [prov.wadah, kab.wadah, kec.wadah, desa]);
    wadah.textContent = ''; wadah.appendChild(kotak);
    var api = {
      ambil: function () { return { desa: dIn.value.trim(), kecamatan: kec.nilai(), kabupaten: kab.nilai(), provinsi: prov.nilai() }; },
      lengkap: function () { var v = api.ambil(); return !!(v.desa && v.kecamatan && v.kabupaten && v.provinsi); },
      kunci: function (b) { prov.kunci(b); kab.kunci(b); kec.kunci(b); dIn.disabled = !!b; },
      pesanKurang: function () { var v = api.ambil(); return !v.provinsi ? 'Pilih provinsi.' : !v.kabupaten ? 'Pilih kabupaten/kota.' : !v.kecamatan ? 'Pilih kecamatan.' : !v.desa ? 'Isi desa/kelurahan.' : ''; }
    };
    return api;
  }
  /** Satu baris teks alamat lengkap untuk tampilan, mis. "Kp. Kecok RT 4, Desa Jeungjing, Kec. Cisoka, Kabupaten Tangerang, Banten". */
  function teks(v) {
    v = v || {}; var p = [];
    if (v.alamat) p.push(v.alamat);
    if (v.desa) p.push((/^(desa|kelurahan|kel\.|ds\.)/i.test(v.desa) ? '' : 'Desa ') + v.desa);
    if (v.kecamatan) p.push((/^kec/i.test(v.kecamatan) ? '' : 'Kec. ') + v.kecamatan);
    if (v.kabupaten) p.push(v.kabupaten);
    if (v.provinsi) p.push(v.provinsi);
    return p.join(', ');
  }
  window.SPPGWilayah = { pasang: pasang, teks: teks, PROVINSI: PROVINSI, KABUPATEN: KABUPATEN, KECAMATAN: KECAMATAN };
})();

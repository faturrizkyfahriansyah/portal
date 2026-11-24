// SPPG JEUNGJING — LOGIN SATU FORMULIR (masuk.html, 25 Nov 2026).
// Satu isian "Username / No. HP" + "Password" (PIC memakai password yang sama seperti akun lain). Server (loginTerpadu) mengenali jenis akun:
//   RELAWAN   -> sesi relawan (auth-relawan.js) -> dashboard.html   (login pertama: buat password baru di halaman ini)
//   PENGELOLA -> sesi Admin/Staff (auth-admin.js)  -> admin.html
//   PIC       -> sesi PIC (sessionStorage 'p3b.sesi.v1', sama dengan pic.html) -> pic.html
// Kata sandi tidak pernah disimpan; halaman lama (login.html, admin.html, pic.html) tetap berfungsi.
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var kartuMasuk = $('cardMasuk'), kartuGanti = $('cardGantiPassword');
  var sedangMemeriksa = false, sesiSementara = null;

  // Sudah masuk sebagai relawan: langsung ke dashboard (sama seperti login.html).
  var sesiRel = ambilSesiRelawan(); if (sesiRel && sesiRel.token) { window.location.href = 'dashboard.html'; return; }
  var notis = ambilDanHapusNotisLogin(); if (notis) tampilPesan('pesanMasuk', notis);


  function tampilPesan(id, teks) { var e = $(id); e.textContent = teks || ''; e.classList.toggle('is-on', !!teks); }
  // Ikon mata (SVG garis, bukan emoji): mata = sandi tersembunyi, mata dicoret = sandi terlihat.
  function ikonMata(btn, tampil) {
    var g = '<path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/>' + (tampil ? '<path d="M3 3l18 18"/>' : '');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + g + '</svg>';
    var t = tampil ? 'Sembunyikan password' : 'Tampilkan password'; btn.setAttribute('aria-label', t); btn.setAttribute('title', t);
  }
  function pakaiToggle(btnId, inputId) {
    $(btnId).addEventListener('click', function () { var i = $(inputId), t = i.type === 'password'; i.type = t ? 'text' : 'password'; ikonMata(this, t); });
  }
  pakaiToggle('toggleSandi', 'inputSandi'); pakaiToggle('toggleBaru', 'inputBaru');

  $('formMasuk').addEventListener('submit', async function (e) {
    e.preventDefault(); if (sedangMemeriksa) return;
    tampilPesan('pesanMasuk', '');
    var identitas = $('inputIdentitas').value.trim(), sandi = $('inputSandi').value;
    if (!identitas || !sandi) { tampilPesan('pesanMasuk', 'Isi username / No. HP dan password.'); (identitas ? $('inputSandi') : $('inputIdentitas')).focus(); return; }
    sedangMemeriksa = true; $('btnMasuk').disabled = true;
    try {
      showLoading('Memeriksa akun...');
      var r;
      try { r = await apiPost('loginTerpadu', { identitas: identitas, sandi: sandi }); }
      catch (e1) {
        if (!/tidak merespons/i.test(e1.message)) throw e1;                      // login aman diulang sekali bila server baru "bangun"
        showLoading('Koneksi lambat, mencoba sekali lagi...');
        r = await apiPost('loginTerpadu', { identitas: identitas, sandi: sandi }, undefined, 'Koneksi ke server lambat. Periksa internet Anda dan coba masuk lagi.');
      }
      hideLoading();
      var h = r.hasil || {};
      if (r.jenis === 'PENGELOLA') {
        simpanSesiAdmin({ token: h.token, username: h.username, role: h.role || 'ADMIN' });
        window.location.href = 'admin.html'; return;
      }
      if (r.jenis === 'PIC') {
        var ins = h.instansi || h.posyandu || [], pos = h.posyandu || [], satu = ins.length === 1 && pos.length === 1;
        try { sessionStorage.setItem('p3b.sesi.v1', JSON.stringify({ token: h.token, pic: h.pic, instansi: ins, posyandu: pos, idi: satu ? pos[0].id : '', nmPos: satu ? pos[0].nama : '' })); } catch (e2) { /* sessionStorage tidak tersedia */ }
        window.location.href = 'pic.html'; return;
      }
      // RELAWAN
      if (h.wajibGantiPassword) {
        sesiSementara = Object.assign({}, h, { passwordLama: sandi });
        kartuMasuk.classList.add('is-hidden'); kartuGanti.classList.remove('is-hidden'); $('inputBaru').focus();
      } else { simpanSesiRelawan(h); window.location.href = 'dashboard.html'; }
    } catch (err) {
      hideLoading(); tampilPesan('pesanMasuk', err.message); $('inputSandi').value = ''; $('inputSandi').focus();
    } finally { sedangMemeriksa = false; $('btnMasuk').disabled = false; }
  });

  $('formGanti').addEventListener('submit', async function (e) {
    e.preventDefault(); tampilPesan('pesanGanti', '');
    var baru = $('inputBaru').value, ulang = $('inputUlang').value;
    if (baru.length < 6) { tampilPesan('pesanGanti', 'Password baru minimal 6 karakter.'); return; }
    if (baru !== ulang) { tampilPesan('pesanGanti', 'Ulangi password tidak sama dengan password baru.'); return; }
    try {
      showLoading('Menyimpan password baru...');
      await apiPost('gantiPasswordRelawan', { token: sesiSementara.token, passwordLama: sesiSementara.passwordLama, passwordBaru: baru });
      hideLoading();
      simpanSesiRelawan({ token: sesiSementara.token, idRelawan: sesiSementara.idRelawan, nama: sesiSementara.nama, divisi: sesiSementara.divisi, wajibGantiPassword: false, tokenTerpusat: sesiSementara.tokenTerpusat });
      window.location.href = 'dashboard.html';
    } catch (err) { hideLoading(); tampilPesan('pesanGanti', err.message); }
  });
});

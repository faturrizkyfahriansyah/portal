/**
 * SPPG JEUNGJING — STATUS SIMPAN DI TOMBOL (25 Nov 2026) — core/TombolSimpan.js (BARU, aditif)
 * Permintaan Admin: setiap tombol Simpan / Kirim / Perbarui dst. memberi tahu prosesnya DI TOMBOL ITU SENDIRI,
 * bukan lewat pesan di bagian atas layar yang tidak terlihat:
 *     Simpan  ->  Menyimpan… (berputar)  ->  Tersimpan (centang hijau)   atau   Belum tersimpan. Ketuk untuk coba lagi (merah) + alasan tepat di bawahnya.
 * Cara kerja: tombol yang diketuk dan label awalnya berawalan kata kerja simpan di bawah ini; permintaan jaringan (fetch)
 * yang dimulai sesudah ketukan itu dipantau. Tidak mengubah kode halaman. Tombol yang sudah mengurus status sendiri
 * (atribut data-ts-skip) dilewati; tombol dengan data-ts-off tidak dipantau.
 */
(function () {
  'use strict';
  if (window.__tombolSimpanAktif || !window.fetch || !window.MutationObserver) return;
  window.__tombolSimpanAktif = true;
  var KATA = [
    [/^\s*simpan/i, 'Menyimpan…', 'Tersimpan'], [/^\s*perbarui/i, 'Memperbarui…', 'Diperbarui'], [/^\s*kirim/i, 'Mengirim…', 'Terkirim'],
    [/^\s*ajukan/i, 'Mengajukan…', 'Terajukan'], [/^\s*terapkan/i, 'Menerapkan…', 'Diterapkan'], [/^\s*tambahkan/i, 'Menambahkan…', 'Ditambahkan']
  ];
  var CENTANG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path d="M4 12.5l5 5L20 6.5"/></svg>';
  var st = document.createElement('style');
  st.textContent = '.ts-proses{background:#55606f!important;color:#fff!important;border-color:#55606f!important;opacity:1!important;pointer-events:none}' +
    '.ts-proses::before{content:"";display:inline-block;width:13px;height:13px;margin-right:8px;border:2.5px solid #fff;border-top-color:transparent;border-radius:50%;vertical-align:-2px;animation:tsPutar .8s linear infinite}' +
    '@keyframes tsPutar{to{transform:rotate(360deg)}}' +
    '.ts-ok{background:#1f7a3f!important;color:#fff!important;border-color:#1f7a3f!important;opacity:1!important;pointer-events:none}' +
    '.ts-gagal{background:#b23a3a!important;color:#fff!important;border-color:#b23a3a!important}' +
    '.ts-pesan{margin:8px 0 0;font-size:13px;font-weight:600;color:#b23a3a;line-height:1.4}';
  (document.head || document.documentElement).appendChild(st);

  var aktif = null;   // { selesai, btn, t, asli, kata, pending, gagal, pesan, selesaiTimer, html, obs }

  function kataUntuk(btn) {
    var t = (btn.textContent || '').trim(); if (!t || t.length > 48) return null;
    for (var i = 0; i < KATA.length; i++) if (KATA[i][0].test(t)) return KATA[i];
    return null;
  }
  function pesanEl(btn, buat) {
    var el = btn.nextElementSibling;
    if (el && el.classList.contains('ts-pesan')) return el;
    if (!buat) return null;
    el = document.createElement('div'); el.className = 'ts-pesan'; el.setAttribute('role', 'alert'); el.setAttribute('aria-live', 'polite');
    btn.insertAdjacentElement('afterend', el); return el;
  }
  function pasang(a, kelas, html) {
    a.html = html; a.btn.classList.remove('ts-proses', 'ts-ok', 'ts-gagal'); a.btn.classList.add(kelas); a.btn.innerHTML = html;
  }
  function bersihkan(a) {
    if (a.obs) { a.obs.disconnect(); a.obs = null; }
    if (a.btn && a.btn.isConnected) { a.btn.classList.remove('ts-proses', 'ts-ok'); a.btn.disabled = a.disabledAsli; a.btn.innerHTML = a.asli; }
    if (aktif === a) aktif = null;
  }
  function mulai(a) {
    a.mulai = true; a.disabledAsli = a.btn.disabled;
    var p = pesanEl(a.btn, false); if (p) p.textContent = '';
    a.btn.classList.remove('ts-gagal'); a.btn.setAttribute('aria-live', 'polite');
    pasang(a, 'ts-proses', a.kata[1]);
    // kode halaman sering menulis ulang teks tombol sendiri: pertahankan tampilan status selama proses
    a.obs = new MutationObserver(function () { if (a.html !== null && a.btn.innerHTML !== a.html && !a.menulis) { a.menulis = true; a.btn.innerHTML = a.html; a.menulis = false; } });
    a.obs.observe(a.btn, { childList: true, characterData: true, subtree: true });
  }
  function akhir(a) {
    if (a.selesaiTimer) clearTimeout(a.selesaiTimer);
    a.selesaiTimer = setTimeout(function () {
      if (a.pending > 0) return;
      if (!a.btn.isConnected) { bersihkan(a); return; }
      if (a.gagal) {
        if (a.obs) { a.obs.disconnect(); a.obs = null; }
        a.btn.classList.remove('ts-proses'); a.btn.classList.add('ts-gagal'); a.btn.disabled = false; a.btn.textContent = 'Belum tersimpan. Ketuk untuk coba lagi'; a.html = null; a.selesai = true;
        var el = pesanEl(a.btn, true); el.textContent = a.pesan || 'Belum tersimpan. Periksa sambungan internet lalu coba lagi.';
        try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* abaikan */ }
        if (aktif === a) aktif = null;
      } else {
        a.obs && a.obs.disconnect(); a.obs = null; a.menulis = true; pasang(a, 'ts-ok', CENTANG + a.kata[2]); a.menulis = false; a.selesai = true;
        setTimeout(function () { bersihkan(a); }, 1300);
      }
    }, 300);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button, input[type=submit]') : null; if (!btn || btn.disabled || btn.hasAttribute('data-ts-off')) return;
    if (btn.classList.contains('ts-gagal')) { btn.classList.remove('ts-gagal'); var p = pesanEl(btn, false); if (p) p.textContent = ''; if (btn.dataset.tsAsli) btn.innerHTML = btn.dataset.tsAsli; }
    if (aktif && aktif.mulai && !aktif.selesai && aktif.btn !== btn) return;      // satu proses pada satu waktu
    var kata = kataUntuk(btn); if (!kata) return;
    if (aktif && aktif.btn === btn && aktif.mulai && !aktif.selesai) return;
    if (aktif && aktif.selesai) bersihkan(aktif);
    btn.dataset.tsAsli = btn.innerHTML;
    aktif = { btn: btn, t: Date.now(), asli: btn.innerHTML, kata: kata, pending: 0, gagal: false, pesan: '', mulai: false, html: null, selesaiTimer: null, menulis: false };
  }, true);

  var asliFetch = window.fetch;
  window.fetch = function () {
    var a = aktif;
    if (!a || a.btn.hasAttribute('data-ts-skip') || (!a.mulai && Date.now() - a.t > 1500)) return asliFetch.apply(this, arguments);
    if (!a.mulai) { if (!a.btn.isConnected) return asliFetch.apply(this, arguments); mulai(a); }
    a.pending++; if (a.selesaiTimer) { clearTimeout(a.selesaiTimer); a.selesaiTimer = null; }
    var p = asliFetch.apply(this, arguments);
    p.then(function (res) {
      if (!res.ok) { a.gagal = true; a.pesan = a.pesan || ('Server menjawab galat ' + res.status + '.'); return; }
      try { res.clone().json().then(function (j) { if (j && j.success === false) { a.gagal = true; a.pesan = a.pesan || String(j.message || j.error || 'Belum tersimpan.'); } }).catch(function () { /* bukan JSON */ }); } catch (x) { /* abaikan */ }
    }, function () { a.gagal = true; a.pesan = a.pesan || 'Tidak tersambung ke server. Periksa internet lalu coba lagi.'; }).then(function () {
      setTimeout(function () { a.pending--; if (a.pending <= 0) akhir(a); }, 60);
    });
    return p;
  };
})();

/**
 * SPPG JEUNGJING — ADMIN: SIPENDOK di dalam Portal Pengelola (26 Nov 2026, 25k; permintaan Admin).
 * Menanam halaman SIPENDOK yang belum ada di Portal -- Generate Dokumen (BAST + Surat Jalan), Arsip Dokumen, Pengaturan template,
 * dan kartu "Penerimaan Hari Ini" di Beranda -- tanpa membuka aplikasi lain dan tanpa masuk ulang.
 *
 * Cara kerja: mesin pembuat dokumen tetap di server SIPENDOK (nomor BAST dan arsip lama tidak berubah). Berkas ini menukar sesi Portal
 * dengan token SIPENDOK secara otomatis (terbitkanTokenAplikasi, sama seperti halaman SIPENDOK lama), lalu menampilkan halaman SIPENDOK
 * (sipendok/js/pages/*.js) di panel Portal. Gaya SIPENDOK dibatasi di dalam .spd (sipendok/css/app-embed.css) supaya tidak mengubah tampilan Portal.
 * Akses mengikuti Hak Akses modul SIPENDOK (menu terkunci bila belum diberi akses). Akun Staff tidak memakai ini (khusus pengelola yang boleh mengubah).
 */
(function () {
  'use strict';
  if (window.SPPGSipendok) return;

  var PANEL = {
    generate: { panel: 'panelSipendokGenerate', host: 'spdViewGenerate', halaman: 'bastsj' },
    arsip: { panel: 'panelSipendokArsip', host: 'spdViewArsip', halaman: 'arsip' }
  };
  var siapJanji = null, api = null, store = null, ui = null, util = null;
  var seq = {}, paramBerikut = {}, tokenDi = 0, berandaDi = 0;

  function staff() { return window.sppgAdminRole === 'STAFF'; }
  function el(id) { return document.getElementById(id); }
  function absolut(rel) { return new URL(rel, document.baseURI).href; }

  function muatSkrip(src) {
    return new Promise(function (ok, gagal) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { gagal(new Error('Berkas ' + src + ' gagal dimuat. Periksa koneksi.')); };
      document.head.appendChild(s);
    });
  }

  function pasangWadahOverlay() {
    if (el('spdOverlay')) return;
    var w = document.createElement('div'); w.className = 'spd'; w.id = 'spdOverlay';
    w.innerHTML = '<div id="toasts" aria-live="assertive"></div><div id="modal-root"></div>';
    document.body.appendChild(w);
  }

  /** Muat gaya, konfigurasi, dan modul SIPENDOK (sekali). */
  function siapkan() {
    if (siapJanji) return siapJanji;
    siapJanji = (async function () {
      if (!document.getElementById('spdCss')) {
        var l = document.createElement('link'); l.rel = 'stylesheet'; l.id = 'spdCss'; l.href = 'sipendok/css/app-embed.css?v=20261126k'; document.head.appendChild(l);
      }
      pasangWadahOverlay();
      if (!window.SIPENDOK_CONFIG) await muatSkrip('sipendok/config.js?v=20261126k');
      api = await import(absolut('sipendok/js/api.js'));
      store = await import(absolut('sipendok/js/store.js'));
      ui = await import(absolut('sipendok/js/ui.js'));
      util = await import(absolut('sipendok/js/util.js'));
      api.onAuthLost(function () { tokenDi = 0; ui.toast('Sesi SIPENDOK diperbarui. Silakan ulangi.', 'warn'); });
    })().catch(function (e) { siapJanji = null; throw e; });
    return siapJanji;
  }

  /** Tukar sesi Portal dengan token SIPENDOK (sekali per ~4 jam; token berlaku 6 jam, atau 30 menit bila lewat role). */
  async function pastikanToken() {
    await siapkan();
    if (api.session.token && Date.now() - tokenDi < 20 * 60 * 1000) return;
    var url = (typeof GOOGLE_APPS_SCRIPT_WEB_APP_URL !== 'undefined') ? GOOGLE_APPS_SCRIPT_WEB_APP_URL : '';
    var res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', body: JSON.stringify({ action: 'terbitkanTokenAplikasi', token: window.sppgAdminToken, kodeModul: 'SIPENDOK' }) });
    var json = await res.json();
    if (!json.success) throw new Error(json.message || 'Akses ke SIPENDOK ditolak. Hubungi Pengelola utama untuk diberi akses.');
    api.session.set(json.data.token, { username: json.data.nama, nama: json.data.nama });
    tokenDi = Date.now();
    await store.loadBootstrap();
  }

  function pesan(host, teks, kind) {
    host.innerHTML = '';
    var b = document.createElement('div'); b.className = 'spd'; b.innerHTML = '<div class="banner ' + (kind || 'err') + '" role="alert"><div></div></div>';
    b.querySelector('div > div').textContent = teks; host.appendChild(b);
  }

  function bukaPanel(id) { var t = document.querySelector('[data-panel="' + id + '"]'); if (t) t.click(); }

  function bukaDari(path) {
    var p = String(path || '').split('?'), nama = p[0], qs = new URLSearchParams(p[1] || ''), params = {};
    qs.forEach(function (v, k) { params[k] = v; });
    if (nama === 'bastsj') { paramBerikut.generate = params; bukaPanel(PANEL.generate.panel); }
    else if (nama === 'arsip') { paramBerikut.arsip = params; bukaPanel(PANEL.arsip.panel); }
    else if (nama === 'pengaturan') { bukaPanel('panelPengaturan'); var d = el('spdPengaturanBlok'); if (d) { d.open = true; muatPengaturan(); } }
  }

  /** Tampilkan satu halaman SIPENDOK di dalam wadah. */
  async function tampilkan(kunci, hostId, halaman, params) {
    var host = el(hostId); if (!host) return;
    var my = (seq[kunci] = (seq[kunci] || 0) + 1);
    host.innerHTML = '<div class="spd"><div class="stack"><div class="skel"></div><div class="skel"></div></div></div>';
    try {
      await pastikanToken();
      if (my !== seq[kunci]) return;
      var mod = await import(absolut('sipendok/js/pages/' + halaman + '.js'));
      if (my !== seq[kunci]) return;
      var dalam = document.createElement('div'); dalam.className = 'spd'; var isi = document.createElement('div'); isi.className = 'spd-view'; dalam.appendChild(isi);
      host.innerHTML = ''; host.appendChild(dalam);
      await mod.render(isi, { params: params || {}, alive: function () { return my === seq[kunci]; }, go: bukaDari, setGuard: function () { }, withBar: function () { }, embed: true });
    } catch (e) {
      if (my === seq[kunci]) pesan(host, (e && e.message) || 'SIPENDOK tidak dapat dimuat.');
    }
  }

  function muatPanel(kunci) {
    var d = PANEL[kunci], p = paramBerikut[kunci] || {}; paramBerikut[kunci] = null;
    tampilkan(kunci, d.host, d.halaman, p);
  }
  function muatPengaturan() { tampilkan('pengaturan', 'spdViewPengaturan', 'pengaturan', {}); }
  function muatBeranda(paksa) {
    if (!paksa && Date.now() - berandaDi < 60000) return;
    berandaDi = Date.now();
    var host = el('spdViewBeranda'); if (!host) return;
    var sek = el('spdBeranda');
    tampilkan('beranda', 'spdViewBeranda', 'dashboard', {}).then(function () {
      // gagal (mis. belum diberi akses): jangan mengganggu Beranda; sembunyikan kartunya
      if (sek && host.querySelector('.banner.err')) sek.style.display = 'none'; else if (sek) sek.style.display = '';
    });
  }

  var sudahInit = false;
  function init() {
    if (sudahInit || staff()) return;
    sudahInit = true;
    Object.keys(PANEL).forEach(function (k) {
      var t = document.querySelector('[data-panel="' + PANEL[k].panel + '"]');
      if (t) t.addEventListener('click', function () { muatPanel(k); });
    });
    var ov = document.querySelector('[data-panel="panelOverview"]'); if (ov) ov.addEventListener('click', function () { muatBeranda(false); });
    var pg = el('spdPengaturanBlok'); if (pg) pg.addEventListener('toggle', function () { if (pg.open) muatPengaturan(); });
    muatBeranda(true);
  }

  window.SPPGSipendok = { buka: bukaDari, muatBeranda: muatBeranda };
  window.addEventListener('sppg-admin-ready', init);
  if (window.sppgAdminToken && window.sppgAdminRole) init();
})();

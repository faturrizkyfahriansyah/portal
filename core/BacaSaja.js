/**
 * SPPG JEUNGJING — core/BacaSaja.js  (26 Nov 2026, 25j)
 * MODE "HANYA LIHAT" untuk akun Staff (Kepala SPPG, Pengawas Gizi, Pengawas Keuangan) di Portal Admin.
 *
 * Staff boleh MELIHAT data di SIMSDM, SIPRES, SIKOP, SIRAGA, SIPIKA, dan SIPANDU, tetapi tidak boleh mengubahnya.
 * Penjagaan yang sebenarnya ada di SERVER (requireAuth + daftar aksi baca di Admin.gs: aksi tulis tetap ditolak untuk Staff).
 * Berkas ini hanya merapikan TAMPILAN: tombol/form yang gunanya mengubah data disembunyikan, supaya tidak ada tombol yang pasti gagal.
 * Berlaku hanya bila peran = STAFF. Untuk Super Admin/Admin berkas ini tidak melakukan apa pun.
 * Panel "Profil Saya" dan "Bantuan" dikecualikan: Staff tetap boleh mengubah profilnya sendiri.
 */
(function () {
  'use strict';
  if (window.SPPGBacaSaja) return;

  // Kata kerja pada label tombol yang berarti MENGUBAH data (di awal label).
  var POLA_TULIS = /^\s*(\d+\.\s*)?[+✓×✕]?\s*(simpan|tambah|ubah|edit|hapus|nonaktifkan|aktifkan|matikan|berikan|setujui|tolak|sahkan|validasi|tetapkan|jadikan|hidupkan|reset|regenerate|generate|impor|import|kosongkan$|kirim|ajukan|buat|bentuk|mulai|selesaikan|isi |pakai|cabut|ganti|tarik|perbarui|periksa ulang|jalankan|coba sinkronisasi|cari pemetaan|koreksi|tandai|pindah|salin data|terapkan (ke|koreksi|perbaikan)|proses|batalkan|unggah|upload|catat|lepas|gabung|pulihkan|arsipkan|konfirmasi|tinjau (&|&amp;) konfirmasi|buka pemeriksaan jadwal|hitung ulang|sinkron|uji-coba|kembali ke draf|pembuatan jadwal$|gunakan lokasi)/i;
  // Tab Stok & Persediaan yang isinya formulir pencatatan atau pengaturan akses (bukan tampilan data).
  var TAB_STOK_TULIS = ['masuk', 'keluar', 'transfer', 'pemusnahan', 'opname', 'akses', 'diagnosa'];
  // Panel yang tidak disentuh (Staff tetap boleh menyimpan profil sendiri / membaca bantuan).
  var PANEL_KECUALI = ['panelProfilSaya', 'panelBantuan'];

  var terpasang = false, pengamat = null, tunda = null;

  function staff() { return window.sppgAdminRole === 'STAFF'; }

  function labelTombol(el) {
    var t = (el.value && /^(submit|button)$/i.test(el.type || '') ? el.value : el.textContent) || '';
    t = String(t).replace(/\s+/g, ' ').trim();
    if (!t || /^[×✕x]$/i.test(t)) t = String(el.getAttribute('title') || el.getAttribute('aria-label') || t);
    return t;
  }

  function dalamKecuali(el) {
    for (var i = 0; i < PANEL_KECUALI.length; i++) {
      var p = document.getElementById(PANEL_KECUALI[i]);
      if (p && p.contains(el)) return true;
    }
    return false;
  }

  function sembunyi(el) { el.classList.add('bs-sembunyi'); el.setAttribute('data-bs', '1'); }

  function rapikan() {
    if (!staff()) return;
    var akar = document.querySelector('main.shell-content');
    if (!akar) return;
    var tandai = akar.querySelectorAll('[data-staff-hide="1"]');   // bagian (kartu/formulir) yang diberi tanda langsung di markup
    for (var t0 = 0; t0 < tandai.length; t0++) { if (!dalamKecuali(tandai[t0])) sembunyi(tandai[t0]); }
    var tombol = akar.querySelectorAll('button, a.btn-mini, input[type="submit"], input[type="button"]');
    for (var i = 0; i < tombol.length; i++) {
      var b = tombol[i];
      if (b.getAttribute('data-bs') === '1' || b.getAttribute('data-staff-ok') === '1') continue;
      if (b.classList.contains('admin-tab-btn') || b.classList.contains('shell-nav-link')) continue;
      if (dalamKecuali(b)) continue;
      if (b.classList.contains('stok-subtab')) { if (TAB_STOK_TULIS.indexOf(b.getAttribute('data-asub')) >= 0) sembunyi(b); continue; }
      if (b.getAttribute('data-staff-hide') === '1' || POLA_TULIS.test(labelTombol(b))) sembunyi(b);
    }
    // Formulir yang SEMUA tombol kirimnya sudah disembunyikan (tambah/ubah) ikut disembunyikan; formulir penyaring (masih punya tombol) tetap.
    var form = akar.querySelectorAll('form');
    for (var j = 0; j < form.length; j++) {
      var f = form[j];
      if (f.getAttribute('data-bs') === '1' || dalamKecuali(f)) continue;
      var kirim = f.querySelectorAll('button, input[type="submit"]');
      if (!kirim.length) continue;
      var adaTersembunyi = false, adaPenyaring = false;
      for (var k = 0; k < kirim.length; k++) {
        if (kirim[k].getAttribute('data-bs') === '1') { adaTersembunyi = true; continue; }
        if (/^(tampilkan|cari|muat|terapkan|filter|export|unduh|cetak|print|lihat|periksa)/i.test(labelTombol(kirim[k]))) adaPenyaring = true;
      }
      if (adaTersembunyi && !adaPenyaring) {
        sembunyi(f);
        var judul = f.previousElementSibling;   // judul bagian ("Tambah ...") ikut disembunyikan agar tidak tersisa judul kosong
        if (judul && judul.classList.contains('section-title') && /tambah|buat|ubah|atur|tetapkan|input|formulir/i.test(judul.textContent)) sembunyi(judul);
      }
    }
    perbaruiSpanduk();
  }

  function perbaruiSpanduk() {
    var sp = document.getElementById('spandukBacaSaja');
    if (!sp) return;
    var aktif = document.querySelector('main.shell-content .admin-panel.active');
    var id = aktif ? aktif.id : '';
    sp.style.display = (!id || id === 'panelProfilSaya' || id === 'panelBantuan') ? 'none' : '';
  }

  function jadwalkan() {
    if (tunda) return;
    tunda = setTimeout(function () { tunda = null; jalankan(); }, 60);
  }

  function jalankan() {
    if (pengamat) pengamat.disconnect();
    try { rapikan(); } catch (e) { if (window.console) console.warn('BacaSaja: gagal merapikan tampilan', e && e.message); }
    pasangPengamat();
  }

  function pasangPengamat() {
    var akar = document.querySelector('main.shell-content');
    if (!akar || !window.MutationObserver) return;
    if (!pengamat) pengamat = new MutationObserver(jadwalkan);
    pengamat.observe(akar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function pasangSpanduk() {
    var akar = document.querySelector('main.shell-content');
    if (!akar || document.getElementById('spandukBacaSaja')) return;
    var d = document.createElement('div');
    d.id = 'spandukBacaSaja'; d.setAttribute('role', 'note');
    d.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '<span><strong>Hanya lihat.</strong> Akun Staff dapat melihat data di semua modul, tetapi tidak dapat mengubahnya.</span>';
    akar.insertBefore(d, akar.firstChild);
  }

  function pasang() {
    if (!staff()) return;
    document.body.classList.add('staff-baca-saja');
    if (!terpasang) {
      terpasang = true;
      var st = document.createElement('style');
      st.id = 'gayaBacaSaja';
      st.textContent = '.bs-sembunyi{display:none !important;}' +
        '#spandukBacaSaja{display:flex;align-items:center;gap:8px;margin:0 0 14px;padding:9px 12px;border-radius:10px;background:#fff7e6;border:1px solid #f0d9a6;color:#7a5a12;font-size:12.5px;line-height:1.4;}' +
        '#spandukBacaSaja svg{flex:0 0 auto;}';
      document.head.appendChild(st);
    }
    pasangSpanduk();
    jalankan();
  }

  window.SPPGBacaSaja = { pasang: pasang, rapikan: rapikan, aktif: staff };
  window.addEventListener('sppg-admin-ready', pasang);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasang); else pasang();
})();

// public-struktur-rapi.js — 25 Nov 2026: merapikan bagan Struktur Personel di profil-sppg.html.
// Hanya TAMPILAN: kartu/butir yang masih "—" (belum diisi) disembunyikan, tingkatan yang kosong ikut disembunyikan,
// dan jumlah anggota ditampilkan pada kartu divisi. Data tidak diubah. Dijalankan ulang saat isi bagan berubah (konten dimuat dari server).
(function () {
  var wadah = document.querySelector('.pub-struktur-tier') && document.querySelector('.pub-struktur-tier').parentNode;
  if (!wadah) return;
  var kosong = function (t) { t = String(t || '').replace(/\s+/g, ' ').trim(); return !t || t === '—' || t === '-' || t === '–'; };
  var sedang = false;
  function rapikan() {
    if (sedang) return; sedang = true;
    try {
      wadah.querySelectorAll('ol li').forEach(function (li) { if (kosong(li.textContent)) li.hidden = true; else li.hidden = false; });
      wadah.querySelectorAll('.pub-struktur-card').forEach(function (k) {
        var utama = k.querySelector('.nama-utama'), daftar = k.querySelector('ol');
        if (utama && !daftar) k.hidden = kosong(utama.textContent);
        if (daftar) {
          var n = daftar.querySelectorAll('li:not([hidden])').length;
          k.hidden = n === 0;
          if (k.classList.contains('divisi')) {
            var peran = k.querySelector('.peran'), j = peran && peran.querySelector('.jumlah');
            if (peran && !j) { j = document.createElement('span'); j.className = 'jumlah'; peran.appendChild(j); }
            if (j && j.textContent !== n + ' orang') j.textContent = n + ' orang';   // hanya bila berubah (hindari putaran tak berujung dengan pengamat)
          }
        }
      });
      wadah.querySelectorAll('.pub-struktur-tier').forEach(function (t) {
        var ada = Array.prototype.some.call(t.querySelectorAll('.pub-struktur-card'), function (k) { return !k.hidden; });
        t.classList.toggle('is-kosong', !ada);
        var d = t.previousElementSibling; if (d && d.classList.contains('pub-struktur-divider')) d.classList.toggle('is-kosong', !ada);
      });
    } finally { sedang = false; }
  }
  document.addEventListener('DOMContentLoaded', rapikan);
  if (document.readyState !== 'loading') rapikan();
  if (window.MutationObserver) new MutationObserver(function () { rapikan(); }).observe(wadah, { childList: true, characterData: true, subtree: true });
})();

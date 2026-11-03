// SPPG JEUNGJING — ADMIN: SIKOP › Jadwal & Penugasan (panelShift). BARU 4 Nov 2026 (keputusan Admin).
// Jadwal HANYA dari penugasan per relawan (dulu "Penugasan Khusus"); jadwal OTOMATIS per divisi (Shift Divisi, Pola Kerja, Kelompok Rotasi) dihilangkan.
// Modul ini: (1) mengganti istilah di panel, (2) menyembunyikan konfigurasi otomatis, (3) menampilkan status + tombol "matikan jadwal otomatis" yang
// lebih dulu menjadikan setiap jadwal otomatis sebagai penugasan eksplisit (jam SAMA persis) -- lihat MigrasiJadwal.gs.
(function () {
  const panel = document.getElementById('panelShift'); if (!panel) return;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const GANTI = [
    [/Penugasan Khusus \(1 Relawan, Pengecualian dari Jadwal Divisi\)/g, 'Jadwal & Penugasan (per relawan)'],
    [/Override jam untuk relawan pada tanggal operasional tertentu\s*—\s*prioritasnya di atas Pola Kerja\/Shift Divisi\./g, 'Atur jam kerja relawan pada tanggal operasional — inilah satu-satunya sumber jadwal.'],
    [/Jadwal relawan otomatis mengikuti Pengaturan[^.]*\./g, 'Jadwal hanya berasal dari Jadwal & Penugasan per relawan (tidak ada lagi jadwal otomatis per divisi).'],
    [/Jadwal otomatis mengikuti Pengaturan[^.]*\./g, 'Jadwal hanya berasal dari Jadwal & Penugasan per relawan.'],
    [/Penugasan Khusus/g, 'Jadwal & Penugasan']
  ];
  let sedang = false;
  function rapikanTeks() {
    if (sedang) return; sedang = true;
    try {
      const w = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { const p = n.parentNode && n.parentNode.nodeName; return (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
      const daftar = []; while (w.nextNode()) daftar.push(w.currentNode);
      daftar.forEach(function (n) { let t = n.nodeValue, baru = t; GANTI.forEach(function (g) { baru = baru.replace(g[0], g[1]); }); if (baru !== t) n.nodeValue = baru; });
      // Kalimat penjelasan lama yang frasanya terpecah oleh tag tebal ("<b>otomatis mengikuti Pengaturan</b>"): ganti seluruh paragrafnya.
      panel.querySelectorAll('p, div').forEach(function (e) {
        if (e.children.length > 3 || e.querySelector('button, input, select, textarea, table, form') || !/otomatis mengikuti Pengaturan/.test(e.textContent) || e.textContent.length > 600) return;
        if (e.querySelector('p, div')) return;   // hanya elemen paling dalam
        e.textContent = 'Jadwal hanya berasal dari Jadwal & Penugasan per relawan. Tidak ada lagi jadwal otomatis per divisi.';
      });
      panel.querySelectorAll('details').forEach(function (d) { const s = d.querySelector('summary'); if (s && /Jadwal & Penugasan \(per relawan\)/.test(s.textContent) && !d.dataset.dibuka) { d.open = true; d.dataset.dibuka = '1'; } });
      panel.querySelectorAll('button.peng-kartu').forEach(function (b) { if (/Pola Kerja per Divisi|Kelompok dan Rotasi/.test(b.textContent)) b.classList.add('menu-disembunyikan'); });
    } finally { sedang = false; }
  }
  function kartuStatus() {
    const sub = $('shiftSubPembuatanJadwal'); if (!sub || $('jpStatus')) return;
    const k = document.createElement('div'); k.id = 'jpStatus'; k.className = 'admin-stat-card'; k.style.cssText = 'padding:12px 14px;text-align:left;margin:0 0 14px;font-size:13px;';
    k.innerHTML = '<span style="color:var(--color-text-muted,#55606f);">Memeriksa status jadwal…</span>'; sub.insertBefore(k, sub.firstChild);
  }
  async function muatStatus() {
    const k = $('jpStatus'); if (!k) return;
    try {
      const s = await api('getStatusJadwalOtomatis');
      if (s.otomatisAktif) {
        k.style.borderLeft = '4px solid #e65100';
        k.innerHTML = '<b>Jadwal otomatis per divisi masih AKTIF.</b> Keputusan Admin: jadwal hanya dari penugasan per relawan. ' + (s.perluDimigrasi ? '<b>' + s.perluDimigrasi + '</b> jadwal yang sekarang berasal dari pengaturan divisi akan lebih dulu dijadikan penugasan per relawan (jam, shift malam, dan aturan tanggalnya <b>sama persis</b>), lalu jadwal otomatis dimatikan. Tidak ada hari yang berubah.' : 'Tidak ada jadwal yang bergantung padanya, jadi aman dimatikan.') +
          '<div style="margin-top:8px;"><button class="btn-mini primary" id="jpMatikan" type="button">Jadikan penugasan &amp; matikan jadwal otomatis</button> <span id="jpPesan" style="margin-left:8px;"></span></div>';
        $('jpMatikan').addEventListener('click', matikan);
      } else {
        k.style.borderLeft = '4px solid #2e7d32';
        k.innerHTML = '<b>Jadwal hanya dari Jadwal &amp; Penugasan per relawan.</b> Jadwal otomatis per divisi sudah dimatikan. <button class="btn-mini" id="jpHidupkan" type="button" style="margin-left:8px;">Hidupkan kembali (darurat)</button> <span id="jpPesan" style="margin-left:8px;"></span>';
        $('jpHidupkan').addEventListener('click', hidupkan);
      }
    } catch (err) { k.innerHTML = '<span style="color:#c0392b;">' + esc(err.message || 'Gagal memeriksa status jadwal.') + '</span>'; }
  }
  async function matikan() {
    if (!confirm('Matikan jadwal otomatis per divisi?\n\nSetiap jadwal yang sekarang berasal dari pengaturan divisi akan dijadikan penugasan per relawan dengan jam yang sama, sehingga tidak ada hari yang kehilangan jadwal. Setelah itu jadwal baru hanya dibuat lewat Jadwal & Penugasan.')) return;
    const p = $('jpPesan'); p.style.color = ''; p.textContent = 'Memproses…';
    try { const h = await api('matikanJadwalOtomatis', { konfirmasi: true }); await muatStatus(); const q = $('jpPesan'); if (q) { q.style.color = '#2e7d32'; q.textContent = h.sudahMati ? 'Sudah mati sebelumnya.' : 'Selesai: ' + h.dibuat + ' jadwal dijadikan penugasan; jadwal otomatis dimatikan.'; } }
    catch (err) { p.style.color = '#c0392b'; p.textContent = err.message || 'Gagal.'; }
  }
  async function hidupkan() {
    if (!confirm('Hidupkan kembali jadwal otomatis per divisi? (Penugasan hasil migrasi tetap ada.)')) return;
    try { await api('hidupkanJadwalOtomatis'); await muatStatus(); } catch (err) { const p = $('jpPesan'); if (p) { p.style.color = '#c0392b'; p.textContent = err.message || 'Gagal.'; } }
  }
  let mulai = false;
  function init() { if (mulai) return; mulai = true; rapikanTeks(); kartuStatus(); muatStatus(); new MutationObserver(function () { rapikanTeks(); }).observe(panel, { childList: true, subtree: true, characterData: false }); }
  document.querySelectorAll('[data-panel="panelShift"]').forEach(function (t) { t.addEventListener('click', function () { setTimeout(init, 50); }); });
})();

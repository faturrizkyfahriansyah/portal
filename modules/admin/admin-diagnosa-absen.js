// SPPG JEUNGJING — SIPRES › Cek Absen & Hari Shift Malam (Admin, 25 Nov 2026).
// Tab 1 "Cek relawan tidak bisa absen": cari relawan -> penyebab (jadwal belum dibuat / belum dibuka / sudah lewat / jam lama) -> uji-coba & terapkan perbaikan; audit seluruh relawan.
// Tab 2 "Hari Kehadiran Shift Malam": aturan hari (Keamanan = hari masuk, divisi lain = hari pulang), uji-coba koreksi data lama, terapkan, aktifkan.
// Semua tombol yang mengubah data dimulai dari UJI-COBA (tidak menulis). Staff hanya bisa melihat; server menolak penerapan oleh Staff.
(function () {
  const panel = document.getElementById('panelDiagnosaAbsen'); if (!panel) return;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, p || {})); };
  const staff = function () { return window.sppgAdminRole === 'STAFF'; };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  const WARNA = { ok: '#1a7a4c', salah: '#b23a3a', kuning: '#8a5a00', abu: '#55606f' };
  const badge = function (t, w) { return '<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600;background:#eef1f5;color:' + (WARNA[w] || WARNA.abu) + '">' + esc(t) + '</span>'; };
  const KODE_WARNA = { DAPAT_ABSEN: 'ok', SEDANG_BERJALAN: 'ok', BELUM_DIBUKA: 'kuning', LIBUR_PERGILIRAN: 'abu', SELESAI: 'abu', RELAWAN_TIDAK_AKTIF: 'abu', KEDALUWARSA: 'salah', TIDAK_ADA_JADWAL: 'salah' };
  const OBJ = { tampil: 'cek' };
  // Kode dari server ditampilkan dengan bahasa biasa (bukan huruf besar bergaris bawah).
  const LABEL = { DAPAT_ABSEN: 'Bisa absen', SEDANG_BERJALAN: 'Sedang bertugas', BELUM_DIBUKA: 'Absen belum dibuka', LIBUR_PERGILIRAN: 'Libur pergiliran', SELESAI: 'Sudah selesai', RELAWAN_TIDAK_AKTIF: 'Relawan tidak aktif', KEDALUWARSA: 'Jadwal sudah lewat', TIDAK_ADA_JADWAL: 'Jadwal belum dibuat', JAM_LAMA: 'Jam jadwal lama', KALENDER_BUKAN_OPERASIONAL: 'Bukan hari operasional', BARIS_BELUM_DIBENTUK: 'Baris jadwal belum dibentuk', DIVISI_KHUSUS: 'Divisi khusus', PERIODE_TIDAK_AKTIF: 'Di luar masa tugas' };
  const lbl = function (k) { k = String(k || ''); return LABEL[k] || (k ? k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, ' ') : '-'); };

  // Satu menu "Koreksi & Cek Absen": dua tab di atas panel (25 Nov 2026). Tombol menu lama tetap ada (disembunyikan) agar hak akses dan tautan lama tidak berubah.
  function stripGabung(aktif) {
    const ada = function (id) { const b = document.querySelector('.admin-tab-btn[data-panel="' + id + '"]'); return b && b.style.display !== 'none'; };
    const t = function (id, teks) { return ada(id) ? '<button type="button" class="btn-mini' + (aktif === id ? ' primary' : '') + '" data-ke="' + id + '" role="tab" aria-selected="' + (aktif === id) + '">' + teks + '</button>' : ''; };
    return '<div role="tablist" class="tab-gabung" style="display:flex;gap:6px;margin:0 0 12px;flex-wrap:wrap">' + t('panelJadwalIndividu', 'Koreksi Presensi') + t('panelDiagnosaAbsen', 'Cek Absen &amp; Shift Malam') + '</div>';
  }
  // Menu "Koreksi & Cek Absen" tetap tersorot saat tab Cek Absen terbuka (tombol aslinya disembunyikan).
  (function () {
    const cek = document.querySelector('.admin-tab-btn[data-panel="panelDiagnosaAbsen"]'), utama = document.querySelector('.admin-tab-btn[data-panel="panelJadwalIndividu"]');
    if (!cek || !utama || typeof MutationObserver === 'undefined') return;
    const sinkron = function () { if (cek.classList.contains('active') && !utama.classList.contains('active')) utama.classList.add('active'); };
    new MutationObserver(sinkron).observe(cek, { attributes: true, attributeFilter: ['class'] }); sinkron();
  })();
  function pasangStrip() {
    panel.querySelectorAll('.tab-gabung [data-ke]').forEach(function (b) {
      b.addEventListener('click', function () {
        const id = b.getAttribute('data-ke'); if (id === panel.id) return;
        const tujuan = document.querySelector('.admin-tab-btn[data-panel="' + id + '"]'); if (!tujuan) return;
        tujuan.click();
        const utama = document.querySelector('.admin-tab-btn[data-panel="panelJadwalIndividu"]'); if (utama) utama.classList.add('active');   // sorot menu yang terlihat
      });
    });
  }

  panel.innerHTML = stripGabung('panelDiagnosaAbsen') + '<div class="shell-page-head"><div><h2 class="shell-page-title">Cek Absen &amp; Hari Shift Malam</h2><p class="shell-page-sub">Cari tahu kenapa relawan tidak bisa absen, perbaiki jadwalnya, dan rapikan hari kehadiran shift malam.</p></div></div>'
    + '<div role="tablist" style="display:flex;gap:6px;margin:8px 0 12px;flex-wrap:wrap"><button type="button" class="btn-mini primary" data-tab="cek" role="tab">Cek relawan tidak bisa absen</button><button type="button" class="btn-mini" data-tab="malam" role="tab">Hari kehadiran shift malam</button></div>'
    + '<div id="dgCek"></div><div id="dgMalam" style="display:none"></div>';

  pasangStrip();
  panel.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      OBJ.tampil = b.getAttribute('data-tab');
      panel.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('primary', x === b); });
      $('dgCek').style.display = OBJ.tampil === 'cek' ? '' : 'none'; $('dgMalam').style.display = OBJ.tampil === 'malam' ? '' : 'none';
      if (OBJ.tampil === 'malam' && !OBJ.malamDimuat) { OBJ.malamDimuat = true; muatMalam(); }
    });
  });

  /* ============ TAB 1: CEK RELAWAN ============ */
  $('dgCek').innerHTML = '<div class="admin-stat-card" style="padding:12px 14px;text-align:left;margin:0 0 12px">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="dgCari" type="search" placeholder="Nama atau ID relawan" aria-label="Nama atau ID relawan" style="padding:8px;border:1px solid #d5dbe3;border-radius:8px;flex:1;min-width:200px">'
    + '<button type="button" class="btn-mini primary" id="dgCariBtn">Periksa</button><button type="button" class="btn-mini" id="dgAuditBtn">Periksa semua relawan aktif</button></div>'
    + '<p style="font-size:12.5px;color:#55606f;margin:6px 0 0">Pemeriksaan hanya membaca data. Perbaikan selalu diuji-coba dulu sebelum diterapkan.</p></div>'
    + '<div id="dgHasil"></div><div id="dgAudit"></div>';
  $('dgCariBtn').addEventListener('click', function () { cari($('dgCari').value); });
  $('dgCari').addEventListener('keydown', function (e) { if (e.key === 'Enter') cari($('dgCari').value); });
  $('dgAuditBtn').addEventListener('click', audit);

  async function cari(q) {
    q = String(q || '').trim(); if (q.length < 2) { lapor('Ketik minimal 2 huruf nama atau ID relawan.'); return; }
    $('dgHasil').innerHTML = '<p>Memeriksa…</p>';
    let r; try { r = await api('diagnosaAbsenRelawanAdmin', { cari: q }); } catch (e) { $('dgHasil').innerHTML = '<p style="color:#b23a3a">' + esc(e.message) + '</p>'; return; }
    if (!r.relawan.length) { $('dgHasil').innerHTML = '<p style="color:#55606f">Tidak ada relawan yang cocok dengan "' + esc(q) + '".</p>'; return; }
    $('dgHasil').innerHTML = '<p style="font-size:12.5px;color:#55606f;margin:0 0 6px">Waktu pemeriksaan: ' + esc(r.sekarang) + '</p>' + r.relawan.map(kartu).join('');
    $('dgHasil').querySelectorAll('[data-uji]').forEach(function (b) { b.addEventListener('click', function () { perbaiki(b.getAttribute('data-uji'), false, b); }); });
  }
  function kartu(x) {
    const d = x.diagnosa || {}, w = KODE_WARNA[d.kode] || 'abu';
    const grup = {}, urutGrup = []; (d.sebab || []).forEach(function (s) { const k = s.kode + '|' + (s.perbaikan ? 1 : 0); if (!grup[k]) { grup[k] = { kode: s.kode, admin: s.admin, perbaikan: s.perbaikan, tgl: [] }; urutGrup.push(k); } grup[k].tgl.push(s.tanggal); });
    const sebab = urutGrup.map(function (k) { const g = grup[k], t = g.tgl.length > 3 ? g.tgl[0] + ' s.d. ' + g.tgl[g.tgl.length - 1] + ' (' + g.tgl.length + ' hari)' : g.tgl.join(', ');
      return '<li><b>' + esc(t) + '</b> · ' + esc(lbl(g.kode)) + (g.perbaikan ? ' ' + badge('bisa diperbaiki', 'ok') : '') + (g.admin ? '<br><small style="color:#55606f">' + esc(g.admin) + '</small>' : '') + '</li>'; }).join('');
    const basi = (d.jamBasi || []).length ? '<p style="font-size:13px;color:#8a5a00;margin:6px 0 0">' + d.jamBasi.length + ' jadwal masih memakai jam lama (beda dengan jadwal terkini).</p>' : '';
    const bisa = (d.sebab || []).some(function (s) { return s.perbaikan; }) || (d.jamBasi || []).length > 0;
    return '<div class="admin-stat-card" style="padding:12px 14px;text-align:left;margin:0 0 10px" data-rel="' + esc(x.id) + '">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + esc(x.nama) + '</b><span>' + badge(d.judul || d.kode || '-', w) + '</span></div>'
      + '<div style="font-size:13px;color:#55606f;margin:2px 0">' + esc(x.id) + ' · ' + esc(x.divisi) + ' · ' + esc(x.status) + (d.kodeBantuan ? ' · Kode bantuan ' + esc(d.kodeBantuan) : '') + '</div>'
      + '<div style="font-size:14px;margin:6px 0">' + esc(d.pesan || '') + '</div>'
      + (d.bukaPada || d.berakhirPada ? '<div style="font-size:13px;margin:2px 0">Jendela absen: <b>' + esc(d.bukaPada || '-') + '</b> sampai <b>' + esc(d.berakhirPada || '-') + '</b></div>' : '')
      + (d.saranAdmin ? '<div style="font-size:13px;margin:6px 0;padding:8px;background:#f6f8fb;border-radius:8px"><b>Saran untuk Admin:</b> ' + esc(d.saranAdmin) + '</div>' : '')
      + (sebab ? '<ul style="font-size:13px;margin:6px 0 0 18px;padding:0">' + sebab + '</ul>' : '') + basi
      + (bisa ? '<div style="margin-top:8px"><button type="button" class="btn-mini" data-uji="' + esc(x.id) + '">Uji-coba perbaikan jadwal…</button></div>' : '')
      + '<div class="dgRencana" id="dgR-' + esc(x.id) + '"></div></div>';
  }
  async function perbaiki(id, jalankan, tombol) {
    const area = document.getElementById('dgR-' + id); if (!area) return;
    if (jalankan && !confirm('Terapkan perbaikan jadwal untuk relawan ini? Perubahan tercatat di audit.')) return;
    if (tombol) tombol.disabled = true; area.innerHTML = '<p>Memproses…</p>';
    let r; try { r = await api('perbaikiJadwalAbsenAdmin', { idRelawan: id, jalankan: !!jalankan }); } catch (e) { area.innerHTML = '<p style="color:#b23a3a">' + esc(e.message) + '</p>'; if (tombol) tombol.disabled = false; return; }
    if (tombol) tombol.disabled = false;
    const bentuk = (r.bentukBaris || []).map(function (b) { return '<li>Buat baris jadwal ' + esc(b.tanggal) + ' (' + esc(b.jam) + ')' + (b.ikutDiperbaiki && b.ikutDiperbaiki.length ? '<br><small>Ikut terbentuk untuk relawan lain pada tanggal itu: ' + esc(b.ikutDiperbaiki.join(', ')) + '</small>' : '') + '</li>'; }).join('');
    const selaras = (r.selarasJam || []).map(function (s) { return '<li>Selaraskan jam ' + esc(s.tanggal) + ': ' + esc(s.jamTercatat || s.dari || '') + ' &rarr; ' + esc(s.jamTerkini || s.ke || '') + '</li>'; }).join('');
    const gt = {}, ut = []; (r.tidakBisaDiperbaiki || []).forEach(function (t) { const k = t.kode; if (!gt[k]) { gt[k] = { kode: k, penjelasan: t.penjelasan, tgl: [] }; ut.push(k); } gt[k].tgl.push(t.tanggal); });
    const tidak = ut.map(function (k) { const g = gt[k], t = g.tgl.length > 3 ? g.tgl[0] + ' s.d. ' + g.tgl[g.tgl.length - 1] + ' (' + g.tgl.length + ' hari)' : g.tgl.join(', '); return '<li><b>' + esc(t) + '</b> · ' + esc(lbl(g.kode)) + ' — ' + esc(g.penjelasan) + '</li>'; }).join('');
    let html = '<div style="margin-top:10px;padding:10px;border:1px dashed #b8c2d0;border-radius:8px;font-size:13px">'
      + '<b>' + (r.jalankan ? 'Hasil penerapan' : 'Hasil uji-coba (belum ada yang diubah)') + '</b>'
      + (bentuk ? '<ul style="margin:6px 0 0 18px;padding:0">' + bentuk + '</ul>' : '') + (selaras ? '<ul style="margin:6px 0 0 18px;padding:0">' + selaras + '</ul>' : '')
      + (!bentuk && !selaras ? '<p style="margin:6px 0">Tidak ada yang dapat diperbaiki otomatis.</p>' : '')
      + (tidak ? '<p style="margin:8px 0 2px"><b>Tidak bisa diperbaiki dari sini:</b></p><ul style="margin:0 0 0 18px;padding:0">' + tidak + '</ul>' : '');
    if (r.jalankan && r.diagnosaSesudah) html += '<p style="margin:8px 0 0"><b>Kondisi sekarang:</b> ' + esc(r.diagnosaSesudah.judul) + ' — ' + esc(r.diagnosaSesudah.pesan) + '</p>';
    if (!r.jalankan && (bentuk || selaras)) html += '<div style="margin-top:8px">' + (staff() ? '<small>Staff hanya dapat melihat; penerapan oleh Admin.</small>' : '<button type="button" class="btn-mini primary" data-terap="' + esc(id) + '">Terapkan perbaikan</button>') + '</div>';
    area.innerHTML = html + '</div>';
    const t = area.querySelector('[data-terap]'); if (t) t.addEventListener('click', function () { perbaiki(id, true, t); });
    if (jalankan) info('Perbaikan diterapkan.');
  }
  async function audit() {
    $('dgAudit').innerHTML = '<p>Memeriksa semua relawan aktif…</p>';
    let r; try { r = await api('auditKetersediaanAbsenAdmin'); } catch (e) { $('dgAudit').innerHTML = '<p style="color:#b23a3a">' + esc(e.message) + '</p>'; return; }
    const chips = Object.keys(r.ringkasan || {}).map(function (k) { return '<span style="margin:0 6px 6px 0;display:inline-block">' + badge(lbl(k) + ': ' + r.ringkasan[k], KODE_WARNA[k] || 'abu') + '</span>'; }).join('');
    const divisiAda = Array.from(new Set(r.bermasalah.map(function (b) { return b.divisi || ''; }).filter(Boolean))).sort();
    $('dgAudit').innerHTML = '<h4 style="margin:14px 0 6px">Ringkasan seluruh relawan aktif <small style="font-weight:400;color:#55606f">(' + esc(r.sekarang) + ')</small></h4><div>' + chips + '</div>'
      + '<p style="margin:6px 0"><b id="dgJml">' + r.jumlahBermasalah + '</b> relawan perlu tindakan.</p>'
      + (r.bermasalah.length ? '<div style="margin:0 0 8px"><select id="dgDivisi" aria-label="Divisi" style="padding:8px;border:1px solid #d5dbe3;border-radius:8px"><option value="">Semua Divisi</option>' + divisiAda.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('') + '</select></div><div id="dgTabel"></div>'
        : '<p style="color:#1a7a4c">Semua relawan aktif punya jadwal yang dapat dipakai absen.</p>');
    function gambarTabel() {
      const dv = $('dgDivisi') ? $('dgDivisi').value : '', daftar = r.bermasalah.filter(function (b) { return !dv || b.divisi === dv; });
      $('dgJml').textContent = daftar.length;
      $('dgTabel').innerHTML = daftar.length ? '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Nama</th><th>Divisi</th><th>Kondisi</th><th>Penyebab utama</th><th></th></tr></thead><tbody>'
        + daftar.map(function (b) { return '<tr><td>' + esc(b.nama) + '</td><td>' + esc(b.divisi) + '</td><td>' + esc(b.judul) + '</td><td>' + esc(lbl(b.sebabUtama || (b.jamBasi ? 'JAM_LAMA' : ''))) + '</td><td><button type="button" class="btn-mini" data-periksa="' + esc(b.id) + '">Periksa</button></td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p style="color:#1a7a4c">Tidak ada relawan bermasalah di divisi ini.</p>';
      $('dgTabel').querySelectorAll('[data-periksa]').forEach(function (b) { b.addEventListener('click', function () { $('dgCari').value = b.getAttribute('data-periksa'); cari(b.getAttribute('data-periksa')); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
    }
    if ($('dgDivisi')) { $('dgDivisi').addEventListener('change', gambarTabel); gambarTabel(); }
  }

  /* ============ TAB 2: HARI SHIFT MALAM ============ */
  $('dgMalam').innerHTML = '<div id="dgMalamStatus"></div><div id="dgMalamRencana"></div>';
  async function muatMalam() {
    const el = $('dgMalamStatus'); el.innerHTML = '<p>Memuat…</p>';
    let s; try { s = await api('getStatusAturanHariHadirAdmin'); } catch (e) { el.innerHTML = '<p style="color:#b23a3a">' + esc(e.message) + '</p>'; return; }
    const sisa = s.perluUbahTanggal + s.perluPindahScan;
    el.innerHTML = '<div class="admin-stat-card" style="padding:12px 14px;text-align:left;margin:0 0 12px">'
      + '<p style="margin:0 0 6px"><b>Aturan hari kehadiran:</b> kehadiran dihitung pada <b>hari pulang</b> (hari operasional). Pengecualian: divisi <b>' + esc((s.divisiHariMasuk || []).join(', ') || 'Security') + '</b> dihitung pada <b>hari masuk</b> (masuk malam, pulang pagi).</p>'
      + '<table style="font-size:14px;border-collapse:collapse"><tr><td style="padding:3px 10px 3px 0;color:#55606f">Status aturan</td><td>' + badge(s.aktif ? 'AKTIF' : 'BELUM AKTIF', s.aktif ? 'ok' : 'kuning') + '</td></tr>'
      + '<tr><td style="padding:3px 10px 3px 0;color:#55606f">Baris perlu digeser tanggalnya</td><td><b>' + s.perluUbahTanggal + '</b></td></tr>'
      + '<tr><td style="padding:3px 10px 3px 0;color:#55606f">Scan perlu dipindah</td><td><b>' + s.perluPindahScan + '</b></td></tr>'
      + '<tr><td style="padding:3px 10px 3px 0;color:#55606f">Perlu diperiksa manual</td><td><b>' + s.perluPeriksaManual + '</b></td></tr>'
      + '<tr><td style="padding:3px 10px 3px 0;color:#55606f">Keamanan (tidak diubah)</td><td><b>' + s.keamananTidakDiubah + '</b></td></tr></table>'
      + '<p style="font-size:12.5px;color:#55606f;margin:8px 0">Urutan aman: <b>1)</b> Uji-coba koreksi &rarr; <b>2)</b> Terapkan koreksi &rarr; <b>3)</b> Aktifkan aturan &rarr; <b>4)</b> Uji-coba lagi (harus 0 sisa).</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn-mini primary" id="dgUjiMalam">Uji-coba koreksi data lama</button>'
      + '<button type="button" class="btn-mini" id="dgTerapMalam"' + (staff() || !sisa ? ' disabled' : '') + '>Terapkan koreksi</button>'
      + (s.aktif ? '<button type="button" class="btn-mini" id="dgAturMalam"' + (staff() ? ' disabled' : '') + '>Matikan aturan</button>' : '<button type="button" class="btn-mini" id="dgAturMalam"' + (staff() || sisa ? ' disabled' : '') + '>Aktifkan aturan</button>') + '</div>'
      + (staff() ? '<p style="font-size:12.5px;color:#55606f;margin:6px 0 0">Staff hanya dapat melihat.</p>' : (sisa && !s.aktif ? '<p style="font-size:12.5px;color:#8a5a00;margin:6px 0 0">Aturan baru bisa diaktifkan setelah koreksi diterapkan (sisa 0).</p>' : '')) + '</div>';
    $('dgUjiMalam').addEventListener('click', function () { koreksi(false, this); });
    $('dgTerapMalam').addEventListener('click', function () { if (confirm('Terapkan koreksi hari kehadiran shift malam ke data lama? Setiap perubahan tercatat di audit dan bisa ditelusuri.')) koreksi(true, this); });
    $('dgAturMalam').addEventListener('click', async function () {
      const hidup = !s.aktif; if (!confirm(hidup ? 'Aktifkan aturan hari kehadiran? Roster berikutnya mengikuti aturan baru.' : 'Matikan aturan hari kehadiran? Perilaku kembali seperti sebelumnya.')) return;
      this.disabled = true; try { await api('aturAturanHariHadirAdmin', { aktif: hidup }); info(hidup ? 'Aturan diaktifkan.' : 'Aturan dimatikan.'); muatMalam(); } catch (e) { lapor(e.message); this.disabled = false; }
    });
  }
  async function koreksi(jalankan, tombol) {
    const area = $('dgMalamRencana'); tombol.disabled = true; area.innerHTML = '<p>Memproses…</p>';
    let r; try { r = await api('koreksiHariShiftMalamAdmin', { jalankan: !!jalankan }); } catch (e) { area.innerHTML = '<p style="color:#b23a3a">' + esc(e.message) + '</p>'; tombol.disabled = false; return; }
    tombol.disabled = false;
    const t = function (judul, arr, kolom, ambil) { return arr.length ? '<h4 style="margin:14px 0 6px">' + judul + ' (' + arr.length + ')</h4><div class="table-wrap"><table class="rmg-tabel"><thead><tr>' + kolom.map(function (k) { return '<th>' + k + '</th>'; }).join('') + '</tr></thead><tbody>' + arr.map(function (x) { return '<tr>' + ambil(x).map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : ''; };
    area.innerHTML = '<p style="margin:0"><b>' + (r.jalankan ? 'Koreksi diterapkan.' : 'Hasil uji-coba (belum ada data yang diubah).') + '</b> ' + esc(r.catatan || '') + '</p>'
      + (r.hasil ? '<p style="margin:4px 0">Scan dipindah: <b>' + r.hasil.dipindah + '</b> · tanggal digeser: <b>' + r.hasil.tanggalDiubah + '</b></p>' : '')
      + t('Tanggal digeser ke hari pulang', r.ubahTanggal || [], ['Relawan', 'Divisi', 'Jadwal', 'Dari', 'Ke'], function (x) { return [x.nama, x.divisi, x.jadwal, x.dari, x.ke]; })
      + t('Scan dipindah ke baris yang benar', r.pindahScan || [], ['Relawan', 'Divisi', 'Scan masuk', 'Dari baris', 'Ke baris'], function (x) { return [x.nama, x.divisi, x.scanMasuk, x.dariIdAbsensi, x.keIdAbsensi]; })
      + t('Perlu diperiksa manual', r.periksaManual || [], ['Relawan', 'Alasan'], function (x) { return [x.nama, x.alasan]; })
      + (!(r.ubahTanggal || []).length && !(r.pindahScan || []).length && !(r.periksaManual || []).length ? '<p style="color:#1a7a4c">Tidak ada data lama yang perlu dikoreksi.</p>' : '');
    if (r.jalankan) { info('Koreksi diterapkan.'); OBJ.malamDimuat = true; muatMalam(); }
  }

  panel.querySelector('[data-tab="cek"]').classList.add('primary');
})();

// SPPG JEUNGJING — ADMIN: SIPANDU › Manajemen PM (panelSipanduPm)
// BARU 3 Nov 2026 (Blueprint §10.3). Alur: pilih tanggal → semua instansi aktif tampil → isi jumlah per kategori
// (+ kendaraan) → [opsional Salin dari tanggal sebelumnya] → periksa seluruh daftar → SATU centang konfirmasi → Simpan.
// Setelah tersimpan: Ubah (koreksi) wajib alasan, tiap perubahan tercatat di riwayat. Kosong ≠ 0.
(function () {
  const panel = document.getElementById('panelSipanduPm');
  if (!panel) return;
  const root = document.getElementById('spmPmRoot');
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const geser = function (iso, n) { const p = iso.split('-').map(Number); return isoLokal(new Date(p[0], p[1] - 1, p[2] + n)); };
  const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const namaHari = function (iso) { const p = iso.split('-').map(Number); return NAMA_HARI[new Date(p[0], p[1] - 1, p[2]).getDay()]; };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const BELUM = 'SIPANDU_V2_BELUM_DISAMBUNGKAN';
  const KAT = [['pk', 'PK'], ['pb', 'PB'], ['bumil', 'Ibu Hamil'], ['busui', 'Ibu Menyusui'], ['balita', 'Balita']];

  const kotakRingkas = function (id, label, redup) { return '<div style="text-align:center;padding:10px 4px;background:var(--color-surface,#f6f8fb);border-radius:10px;"><div id="' + id + '" style="font-size:18px;font-weight:800;color:' + (redup ? 'var(--color-text-muted,#55606f)' : 'var(--color-navy,#1f3864)') + ';">–</div><div style="font-size:11px;color:var(--color-text-muted,#55606f);margin-top:2px;">' + label + '</div></div>'; };
  let S = { tanggal: isoLokal(new Date()), data: null, mode: 'baru', kotor: false, sertakanNonaktif: false };
  let sudahMuat = false, urutMuat = 0;   // penjaga: jawaban lama (tanggal sebelumnya) tidak boleh menimpa tampilan terbaru

  function pesan(teks, galat) { const el = $('pmPesan'); if (el) { el.textContent = teks || ''; el.style.color = galat ? '#c0392b' : '#2e7d32'; } }
  function kartuBelumTersambung(teks) {
    root.innerHTML = '<div class="admin-stat-card accent-warning" style="padding:16px;text-align:left;"><div style="font-weight:700;margin-bottom:6px;">Database SIPANDU baru belum disambungkan</div>' +
      '<div style="font-size:13px;line-height:1.6;">' + (teks ? esc(teks) + '<br>' : '') + 'Sambungkan dulu lewat menu <b>Master Instansi &amp; PIC</b> (panduan langkahnya ada di sana), lalu muat ulang halaman ini.</div></div>';
  }
  function kerangka() {
    root.innerHTML =
      '<div class="filter-bar"><button class="btn-mini" id="pmMundur" type="button">◀</button><input type="date" id="pmTanggal" aria-label="Tanggal"><button class="btn-mini" id="pmMaju" type="button">▶</button>' +
      '<button class="btn-mini primary" id="pmMuat" type="button">Tampilkan</button><span id="pmHari" style="font-weight:600;"></span></div>' +
      '<div class="filter-bar" id="pmBarisSalin"><span style="font-size:13px;">Salin dari tanggal:</span><input type="date" id="pmSalinDari" aria-label="Salin dari tanggal"><button class="btn-mini" id="pmSalin" type="button">Salin data</button><span style="font-size:13px;margin-left:8px;">atau</span><button class="btn-mini" id="pmAcuan" type="button" title="Isi semua baris dengan nilai acuan tiap instansi (belum tersimpan)">Isi dari Acuan</button></div>' +
      '<div id="pmStatus" style="padding:10px 12px;border-radius:10px;font-size:13px;margin:8px 0;"></div><div id="pmNonaktif" style="font-size:12.5px;margin:0 0 8px;"></div>' +
      '<div class="admin-stat-grid" style="grid-template-columns:repeat(2,1fr);"><div class="admin-stat-card"><div class="admin-stat-value" id="pmTotal">–</div><div class="admin-stat-label">Total Porsi</div></div>' +
      '<div class="admin-stat-card accent-success"><div class="admin-stat-value" id="pmTerisi">–</div><div class="admin-stat-label">Instansi Terisi</div></div></div>' +
      // Rincian SAMA seperti kartu "Penerima Manfaat" di dashboard: PK / PB / 3B, lalu 3B dirinci Balita / Ibu Menyusui / Ibu Hamil (dihitung langsung dari isian).
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 0;">' + kotakRingkas('pmPk', 'PK (Porsi Kecil)') + kotakRingkas('pmPb', 'PB (Porsi Besar)') + kotakRingkas('pm3b', '3B') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 0;">' + kotakRingkas('pmBalita', 'Balita', 1) + kotakRingkas('pmBusui', 'Ibu Menyusui', 1) + kotakRingkas('pmBumil', 'Ibu Hamil', 1) + '</div>' +
      '<div style="font-size:11px;color:var(--color-text-muted,#55606f);text-align:center;margin:4px 0 12px;">3B = Balita + Ibu Menyusui + Ibu Hamil</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Instansi</th><th>PK</th><th>PB</th><th>Ibu Hamil</th><th>Ibu Menyusui</th><th>Balita</th><th>No. Kendaraan</th><th>PIC</th><th>Total</th></tr></thead><tbody id="pmTbody"></tbody></table></div>' +
      '<div id="pmKonfirmasi" style="margin:14px 0;padding:12px;border:1px solid var(--color-border,#d5dbe3);border-radius:10px;"></div>' +
      '<div id="pmPesan" style="font-size:13px;margin:6px 0;"></div>' +
      '<div class="filter-bar"><button class="btn-mini" id="pmRiwayat" type="button">Riwayat koreksi tanggal ini</button></div><div id="pmRiwayatIsi"></div>' +
      '<p class="section-title">Arsip PM (tanggal yang sudah tersimpan)</p><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Status</th><th>Instansi</th><th>Total Porsi</th><th>Dikonfirmasi oleh</th><th></th></tr></thead><tbody id="pmArsip"></tbody></table></div>';
    $('pmTanggal').value = S.tanggal;
    $('pmMuat').addEventListener('click', function () { ganti($('pmTanggal').value); });
    $('pmMundur').addEventListener('click', function () { ganti(geser($('pmTanggal').value || S.tanggal, -1)); });
    $('pmMaju').addEventListener('click', function () { ganti(geser($('pmTanggal').value || S.tanggal, 1)); });
    $('pmSalin').addEventListener('click', function () { salin(); });
    $('pmAcuan').addEventListener('click', function () { S.kotor = false; muat('', true); });
    $('pmRiwayat').addEventListener('click', muatRiwayat);
    $('pmTbody').addEventListener('input', function () { S.kotor = true; hitungUlang(); });
    $('pmArsip').addEventListener('click', function (e) { const b = e.target.closest('button[data-t]'); if (b) ganti(b.dataset.t); });
  }

  async function ganti(tanggal) {
    if (!tanggal) { alert('Pilih tanggal dulu.'); return; }
    if (S.kotor && !confirm('Ada isian yang belum disimpan pada tanggal ini. Tetap pindah tanggal?')) { $('pmTanggal').value = S.tanggal; return; }
    S.tanggal = tanggal; $('pmTanggal').value = tanggal; S.kotor = false; S.sertakanNonaktif = false; $('pmRiwayatIsi').innerHTML = '';
    await muat('');
  }
  async function salin() {
    const asal = $('pmSalinDari').value;
    if (!asal) { alert('Pilih tanggal asal salinan.'); return; }
    if (asal === S.tanggal) { alert('Tanggal asal dan tujuan sama.'); return; }
    S.kotor = false; await muat(asal);
  }
  async function muat(salinDari, dariAcuan) {
    pesan('');
    const giliran = ++urutMuat;
    try {
      const d = await api('getPmHarianV2', { tanggal: S.tanggal, salinDari: salinDari || '', dariAcuan: dariAcuan === true, sertakanNonaktif: S.sertakanNonaktif === true });
      if (giliran !== urutMuat) return;      // sudah ada permintaan yang lebih baru
      S.data = d; S.mode = d.header ? 'tersimpan' : ((d.draftSalinan || d.draftAcuan) ? 'draft' : 'baru');
      if (d.draftSalinan || d.draftAcuan) S.kotor = true;
      render(); if (d.peringatan) pesan(d.peringatan, true);
    } catch (err) { pesan(err.message || 'Gagal memuat.', true); }
  }

  function render() {
    const d = S.data, edit = S.mode !== 'tersimpan';
    $('pmHari').textContent = namaHari(d.tanggal) + ', ' + d.tanggal.split('-').reverse().join('/');
    $('pmSalinDari').value = $('pmSalinDari').value || d.tanggalSebelumnya || '';
    $('pmBarisSalin').style.display = (S.mode === 'tersimpan' || S.mode === 'koreksi') ? 'none' : '';
    const st = $('pmStatus');
    if (S.mode === 'baru') { st.style.background = '#fff8e1'; st.textContent = 'Belum ada data PM untuk tanggal ini. Isi angka (kosongkan bila belum diketahui, isi 0 bila memang nol), lalu centang konfirmasi dan simpan.'; }
    else if (S.mode === 'draft') { st.style.background = '#e3f2fd'; st.textContent = (d.draftAcuan ? 'DRAF dari ACUAN instansi' : 'DRAF salinan dari ' + d.disalinDariTanggal) + ' — BELUM tersimpan. Periksa dan sesuaikan angka serta kendaraan, lalu konfirmasi dan simpan.'; }
    else if (S.mode === 'koreksi') { st.style.background = '#fff3e0'; st.textContent = 'Mode KOREKSI: ubah angka, isi alasan, periksa ulang seluruh daftar, lalu simpan. Setiap perubahan dicatat di riwayat.'; }
    else { st.style.background = '#e8f5e9'; st.textContent = 'Tersimpan & TERVERIFIKASI oleh ' + (d.header.dikonfirmasiOleh || '—') + ' pada ' + (d.header.dikonfirmasiPada || '—') + (d.header.disalinDariTanggal ? ' · disalin dari ' + d.header.disalinDariTanggal : '') + '.'; }
    const cellInput = function (b, k) {
      const v = b[k]; return '<td><input type="number" min="0" step="1" data-id="' + esc(b.idInstansi) + '" data-k="' + k + '" value="' + (v === null ? '' : v) + '" placeholder="' + (b.acuan && b.acuan[k] !== null && b.acuan[k] !== undefined ? 'acuan ' + b.acuan[k] : '') + '"' + (edit ? '' : ' disabled') + ' style="width:70px;padding:5px;border:1px solid var(--color-border,#d5dbe3);border-radius:6px;"></td>';
    };
    // Sel hanya untuk kategori yang RELEVAN menurut jenis instansi (Sekolah: PK & PB; Posyandu: Ibu Hamil, Ibu Menyusui, Balita); lainnya "–" tanpa isian.
    const cell = function (b, k) { return (b.kategori || KAT.map(function (x) { return x[0]; })).indexOf(k) >= 0 ? cellInput(b, k) : '<td style="text-align:center;color:#c3c9d3;background:#fafbfc;">–</td>'; };
    $('pmTbody').innerHTML = d.baris.length ? d.baris.map(function (b) {
      return '<tr><td>' + esc(b.nama) + (b.nonaktif ? ' <span style="font-size:11px;color:#c0392b;">(nonaktif)</span>' : '') + '<div style="font-size:11px;color:var(--color-text-muted,#55606f);">' + esc(b.jenis) + '</div></td>' +
        KAT.map(function (k) { return cell(b, k[0]); }).join('') +
        '<td><input type="text" maxlength="30" data-id="' + esc(b.idInstansi) + '" data-k="noKendaraan" value="' + esc(b.noKendaraan) + '"' + (edit ? '' : ' disabled') + ' style="width:110px;padding:5px;border:1px solid var(--color-border,#d5dbe3);border-radius:6px;text-transform:uppercase;"></td>' +
        '<td style="font-size:12px;">' + esc(b.namaPic || '—') + '</td><td data-total="' + esc(b.idInstansi) + '"><b>' + (b.total === null ? '–' : f(b.total)) + '</b></td></tr>';
    }).join('') : '<tr><td colspan="9"><div class="empty-state">Belum ada instansi aktif. Tambahkan di Master Instansi &amp; PIC.</div></td></tr>';
    const nk = d.nonaktifTersembunyi || { instansi: 0, porsi: 0 }, boxN = $('pmNonaktif');
    if (d.nonaktifDisertakan && d.baris.some(function (b) { return b.nonaktif; })) boxN.innerHTML = '<span style="color:#b26a00;">Menampilkan juga instansi <b>nonaktif</b> yang punya data tanggal ini.</span> <button class="btn-mini" id="pmSembunyiNon" type="button">Sembunyikan</button>';
    else if (nk.instansi > 0) boxN.innerHTML = '<span style="color:var(--color-text-muted,#55606f);">' + nk.instansi + ' instansi nonaktif punya data tanggal ini (' + f(nk.porsi) + ' porsi) — tidak ditampilkan dan tidak dihitung di sini.</span> <button class="btn-mini" id="pmTampilNon" type="button">Tampilkan</button>';
    else boxN.innerHTML = '';
    if ($('pmTampilNon')) $('pmTampilNon').addEventListener('click', function () { S.sertakanNonaktif = true; muat(''); });
    if ($('pmSembunyiNon')) $('pmSembunyiNon').addEventListener('click', function () { S.sertakanNonaktif = false; muat(''); });
    renderKonfirmasi(); hitungUlang();
  }

  function renderKonfirmasi() {
    const box = $('pmKonfirmasi');
    if (S.mode === 'tersimpan') {
      box.innerHTML = '<button class="btn-mini primary" id="pmUbah" type="button">Ubah (koreksi)</button> <span style="font-size:12px;color:var(--color-text-muted,#55606f);">Data tersimpan terkunci agar tidak berubah tanpa alasan.</span>';
      $('pmUbah').addEventListener('click', function () { S.mode = 'koreksi'; render(); });
      return;
    }
    box.innerHTML =
      (S.mode === 'koreksi' ? '<label style="display:block;font-size:12px;margin-bottom:8px;">Alasan koreksi * <input id="pmAlasan" type="text" maxlength="200" style="width:100%;padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;" placeholder="Mis. salah ketik jumlah PK"></label>' : '') +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;"><input type="checkbox" id="pmCek" style="margin-top:3px;"> <span>Saya sudah memeriksa <b>seluruh daftar PM</b> tanggal ini dan datanya benar.</span></label>' +
      '<div style="margin-top:10px;"><button class="btn-mini primary" id="pmSimpan" type="button" disabled>Simpan</button>' + (S.mode === 'koreksi' ? ' <button class="btn-mini" id="pmBatalKoreksi" type="button">Batal koreksi</button>' : '') + '</div>';
    $('pmCek').addEventListener('change', segarkanTombol);
    if ($('pmAlasan')) $('pmAlasan').addEventListener('input', segarkanTombol);
    $('pmSimpan').addEventListener('click', simpan);
    if ($('pmBatalKoreksi')) $('pmBatalKoreksi').addEventListener('click', function () { S.mode = 'tersimpan'; S.kotor = false; muat(''); });
  }
  function segarkanTombol() {
    const btn = $('pmSimpan'); if (!btn) return;
    btn.disabled = !($('pmCek').checked && (S.mode !== 'koreksi' || ($('pmAlasan').value.trim().length >= 3)));
  }

  function bacaBaris() {
    const peta = {};
    $('pmTbody').querySelectorAll('input[data-id]').forEach(function (el) { const o = peta[el.dataset.id] = peta[el.dataset.id] || { idInstansi: el.dataset.id }; o[el.dataset.k] = el.value; });
    return Object.keys(peta).map(function (k) { return peta[k]; });
  }
  function hitungUlang() {
    const tot = { pk: 0, pb: 0, bumil: 0, busui: 0, balita: 0 }; let terisi = 0, porsi = 0;
    bacaBaris().forEach(function (b) {
      let ada = false, t = 0;
      KAT.forEach(function (k) { const v = String(b[k[0]] || '').trim(); if (v !== '' && /^\d+$/.test(v)) { ada = true; t += Number(v); tot[k[0]] += Number(v); } });
      const sel = $('pmTbody').querySelector('td[data-total="' + b.idInstansi + '"]'); if (sel) sel.innerHTML = '<b>' + (ada ? f(t) : '–') + '</b>';
      if (ada) { terisi++; porsi += t; }
    });
    $('pmTotal').textContent = f(porsi); $('pmTerisi').textContent = terisi + ' / ' + (S.data ? S.data.baris.length : 0);
    $('pmPk').textContent = f(tot.pk); $('pmPb').textContent = f(tot.pb); $('pm3b').textContent = f(tot.bumil + tot.busui + tot.balita);
    $('pmBalita').textContent = f(tot.balita); $('pmBusui').textContent = f(tot.busui); $('pmBumil').textContent = f(tot.bumil);
  }

  async function simpan() {
    try {
      pesan('Menyimpan…');
      const d = await api('simpanPmHarianV2', { tanggal: S.tanggal, konfirmasi: $('pmCek').checked, alasan: $('pmAlasan') ? $('pmAlasan').value : '',
                                                 salinDariTanggal: S.data.disalinDariTanggal || '', baris: bacaBaris() });
      S.data = d; S.mode = 'tersimpan'; S.kotor = false; render(); pesan('Tersimpan dan terverifikasi.'); muatArsip();
    } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
  }
  async function muatRiwayat() {
    try {
      const h = await api('getRiwayatPmV2', { tanggal: S.tanggal });
      $('pmRiwayatIsi').innerHTML = h.riwayat.length ?
        '<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Instansi</th><th>Kolom</th><th>Sebelum</th><th>Sesudah</th><th>Alasan</th><th>Oleh</th></tr></thead><tbody>' +
        h.riwayat.map(function (r) { return '<tr><td>' + esc(r.waktu) + '</td><td>' + esc(r.instansi) + '</td><td>' + esc(r.kolom) + '</td><td>' + esc(r.sebelum || '—') + '</td><td>' + esc(r.sesudah || '—') + '</td><td>' + esc(r.alasan) + '</td><td>' + esc(r.oleh) + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : '<div class="empty-state">Belum ada koreksi pada tanggal ini.</div>';
    } catch (err) { pesan(err.message || 'Gagal memuat riwayat.', true); }
  }
  async function muatArsip() {
    try {
      const a = await api('getDaftarTanggalPmV2', { batas: 60 });
      $('pmArsip').innerHTML = a.tanggal.length ? a.tanggal.map(function (r) {
        return '<tr><td>' + esc(namaHari(r.tanggal) + ', ' + r.tanggal.split('-').reverse().join('/')) + '</td><td>' + esc(r.status) + '</td><td>' + r.jumlahInstansi + '</td><td>' + f(r.totalPorsi) + '</td><td>' + esc(r.dikonfirmasiOleh || '—') + '</td><td><button class="btn-mini" data-t="' + esc(r.tanggal) + '" type="button">Buka</button></td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="empty-state">Belum ada tanggal tersimpan.</div></td></tr>';
    } catch (err) { /* arsip tidak kritis */ }
  }

  async function mulai() {
    try {
      root.innerHTML = '<div class="empty-state">Memuat…</div>';
      const st = await api('getStatusSipanduV2');
      if (!st.terhubung) { kartuBelumTersambung(st.pesan); return; }
      kerangka(); await muat(''); muatArsip();
    } catch (err) {
      if (String(err.message || '').indexOf(BELUM) >= 0) kartuBelumTersambung(''); else root.innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div>';
    }
  }
  /** Dipakai Kalender Operasional: buka Manajemen PM langsung di tanggal tertentu (untuk melihat/mengubah PM lengkap). */
  window.sppgBukaPmTanggal = async function (iso) {
    const t = document.querySelector('[data-panel="panelSipanduPm"]');
    if (!sudahMuat) { S.tanggal = iso; if (t) t.click(); return; }      // pemuatan pertama memakai tanggal ini
    if (t) t.click();
    if (!$('pmTanggal')) return;
    S.kotor = false; S.sertakanNonaktif = false; S.tanggal = iso; $('pmTanggal').value = iso; await muat('');
  };
  const tombol = document.querySelector('[data-panel="panelSipanduPm"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudahMuat) { sudahMuat = true; mulai(); } });
})();

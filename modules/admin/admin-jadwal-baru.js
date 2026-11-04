// SPPG JEUNGJING — ADMIN: SIKOP › Jadwal & Penugasan (panelShift). DIBANGUN ULANG 5 Nov 2026 (konsep disetujui Admin), tanpa tab, tanpa periode:
// (1) Buat Jadwal: satu hari / satu minggu dari tanggal mulai; cakupan Individu / Divisi / Kelompok; pratinjau lalu "Buat Jadwal Penugasan";
// (2) Periksa Jadwal: pilih tanggal, lihat yang sudah / belum dijadwalkan, ubah jadwal. Tab lama (Pembuatan, Pemeriksaan, Penetapan) disembunyikan.
// Backend: JadwalBaru.gs (getOpsiJadwalBaru, pratinjauPenugasanBaru, buatPenugasanBaru, getJadwalRentangV2) + ubah/hapus/buatJadwalIndividu.
(function () {
  const panel = document.getElementById('panelShift'); if (!panel) return;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const dari = function (iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const tglPendek = function (iso) { const d = dari(iso); return d.getDate() + ' ' + BULAN[d.getMonth()]; };
  const tglPanjang = function (iso) { const d = dari(iso); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); };
  const hm = function (v) { const m = String(v || '').match(/^(\d{1,2}):(\d{2})/); return m ? z(m[1]) + ':' + m[2] : ''; };
  const f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  let opsi = null, mulai = false, jamDiubah = false, urutPv = 0, urutData = 0, pv = null, data = null, timer = null;

  // ---- sembunyikan konten lama (tab Pembuatan / Multi-Shift / Pemeriksaan / Penetapan) tanpa menghapus, agar skrip lama tetap menemukan elemennya ----
  const kepala = panel.querySelector('.shell-page-head'), lama = document.createElement('div'); lama.id = 'jbLegacy'; lama.style.display = 'none';
  Array.from(panel.children).forEach(function (c) { if (c !== kepala) lama.appendChild(c); });
  panel.appendChild(lama);
  if (kepala) { const p = kepala.querySelector('p'); if (p) p.remove(); }
  const root = document.createElement('div'); root.id = 'jbRoot'; panel.insertBefore(root, lama);
  const inp = 'padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;';
  root.innerHTML =
    '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-bottom:14px;"><div style="font-weight:700;font-size:15px;margin-bottom:10px;">Buat Jadwal</div>' +
    '<div class="filter-bar" style="margin-bottom:8px;"><span style="font-size:12.5px;font-weight:600;">Rentang</span><label class="jb-radio" style="font-size:13px;"><input type="radio" name="jbHari" value="1" checked> Satu hari</label><label class="jb-radio" style="font-size:13px;"><input type="radio" name="jbHari" value="7"> Satu minggu</label><label style="font-size:12px;">Tanggal mulai <input type="date" id="jbAwal"></label></div>' +
    '<div class="filter-bar" style="margin-bottom:8px;"><span style="font-size:12.5px;font-weight:600;">Cakupan</span><label class="jb-radio" style="font-size:13px;"><input type="radio" name="jbCak" value="INDIVIDU" checked> Individu</label><label class="jb-radio" style="font-size:13px;"><input type="radio" name="jbCak" value="DIVISI"> Divisi</label><label class="jb-radio" style="font-size:13px;"><input type="radio" name="jbCak" value="KELOMPOK"> Kelompok</label></div>' +
    '<div class="filter-bar" id="jbPilih" style="margin-bottom:8px;"><select id="jbRelawan" aria-label="Relawan"></select><select id="jbDivisi" aria-label="Divisi" style="display:none;"></select></div>' +
    '<div id="jbKelompok" style="display:none;margin-bottom:8px;font-size:13px;"></div>' +
    '<div class="filter-bar" style="margin-bottom:8px;"><label style="font-size:12px;">Jam masuk <input type="time" id="jbJamMasuk" value="08:00"></label><label style="font-size:12px;">Jam pulang <input type="time" id="jbJamPulang" value="16:00"></label><input id="jbCatatan" maxlength="200" placeholder="Catatan (opsional)" style="' + inp + 'flex:1;min-width:150px;"></div>' +
    '<div id="jbPratinjau" style="font-size:13px;margin:8px 0;line-height:1.5;"></div>' +
    '<div><button class="btn-mini primary" id="jbBuat" type="button" disabled>Buat Jadwal Penugasan</button> <span id="jbPesan" style="margin-left:8px;font-size:13px;"></span></div></div>' +
    '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-bottom:14px;"><div style="font-weight:700;font-size:15px;margin-bottom:10px;">Periksa Jadwal</div>' +
    '<div class="filter-bar"><select id="jpMode" aria-label="Rentang"><option value="1">Harian</option><option value="7">Mingguan</option></select><label style="font-size:12px;">Tanggal <input type="date" id="jpAwal"></label><select id="jpDivisi" aria-label="Divisi"><option value="">Semua Divisi</option></select><select id="jpStatus" aria-label="Status"><option value="">Semua Status</option><option value="SUDAH">Sudah dijadwalkan</option><option value="BELUM">Belum dijadwalkan</option></select></div>' +
    '<div class="rmg-chips" id="jpChips"></div><div id="jpPesan" style="font-size:13px;margin:4px 0;"></div><div class="table-wrap"><table class="rmg-tabel"><thead id="jpThead"></thead><tbody id="jpTbody"></tbody></table></div><div id="jpAksi" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border,#e8ebef);"></div></div>' +
    '<details style="margin-bottom:14px;"><summary style="cursor:pointer;font-size:13px;font-weight:600;">Jadwal otomatis lama</summary><div id="jbOto" class="admin-stat-card" style="padding:12px 14px;text-align:left;margin-top:8px;font-size:13px;">Memuat…</div></details>';

  // ---------------- Buat Jadwal ----------------
  const cak = function () { return document.querySelector('input[name="jbCak"]:checked').value; }, hariPilih = function () { return Number(document.querySelector('input[name="jbHari"]:checked').value); };
  function isiOpsi() {
    $('jbRelawan').innerHTML = '<option value="">Pilih relawan…</option>' + opsi.relawan.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.nama) + ' — ' + esc(r.divisi) + '</option>'; }).join('');
    aturCakupan();
    const d = Array.from(new Set(opsi.divisi.map(function (x) { return x.nama; })));
    $('jpDivisi').innerHTML = '<option value="">Semua Divisi</option>' + d.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
  }
  function aturCakupan() {
    const c = cak(), daftarDivisi = c === 'KELOMPOK' ? opsi.divisi.filter(function (d) { return d.kelompok.length; }) : opsi.divisi, pd = $('jbDivisi').value;
    $('jbRelawan').style.display = c === 'INDIVIDU' ? '' : 'none'; $('jbDivisi').style.display = c === 'INDIVIDU' ? 'none' : '';
    $('jbDivisi').innerHTML = '<option value="">Pilih divisi…</option>' + daftarDivisi.map(function (d) { return '<option value="' + esc(d.nama) + '">' + esc(d.nama) + ' (' + d.jumlah + ')</option>'; }).join('');
    if (daftarDivisi.some(function (d) { return d.nama === pd; })) $('jbDivisi').value = pd;
    aturKelompok(); jadwalkanPratinjau();
  }
  function aturKelompok() {   // kelompok hanya tampil untuk cakupan Kelompok, dan hanya bila divisinya punya kelompok
    const box = $('jbKelompok'), d = opsi.divisi.filter(function (x) { return x.nama === $('jbDivisi').value; })[0];
    if (cak() !== 'KELOMPOK' || !d || !d.kelompok.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = '<span style="font-weight:600;margin-right:8px;">Kelompok</span>' + d.kelompok.map(function (k) { return '<label style="margin-right:12px;"><input type="checkbox" class="jb-kel" value="' + esc(k.nama) + '" checked> ' + esc(k.nama) + ' (' + k.jumlah + ')</label>'; }).join('');
    box.querySelectorAll('.jb-kel').forEach(function (c) { c.addEventListener('change', jadwalkanPratinjau); });
  }
  function bodyBuat() {
    const c = cak(), b = { tanggalMulai: $('jbAwal').value, hari: hariPilih(), cakupan: c, jamMasuk: $('jbJamMasuk').value, jamPulang: $('jbJamPulang').value, catatan: $('jbCatatan').value.trim() };
    if (c === 'INDIVIDU') b.idRelawan = $('jbRelawan').value; else b.namaDivisi = $('jbDivisi').value;
    if (c === 'KELOMPOK') b.kelompok = Array.from(document.querySelectorAll('.jb-kel:checked')).map(function (x) { return x.value; });
    return b;
  }
  function lengkap(b) { return b.tanggalMulai && (b.cakupan === 'INDIVIDU' ? b.idRelawan : (b.namaDivisi && (b.cakupan !== 'KELOMPOK' || b.kelompok.length))); }
  function jadwalkanPratinjau() { clearTimeout(timer); timer = setTimeout(pratinjau, 250); }
  async function pratinjau() {
    const b = bodyBuat(), box = $('jbPratinjau'); pv = null; $('jbBuat').disabled = true;
    if (!lengkap(b)) { box.innerHTML = '<span style="color:var(--color-text-muted);">Pilih tanggal dan ' + (b.cakupan === 'INDIVIDU' ? 'relawan' : (b.cakupan === 'DIVISI' ? 'divisi' : 'divisi dan kelompok')) + '.</span>'; return; }
    const giliran = ++urutPv;
    try {
      const r = await api('pratinjauPenugasanBaru', b); if (giliran !== urutPv) return; pv = r;
      if (!jamDiubah && r.jamSaran) { $('jbJamMasuk').value = hm(r.jamSaran.jamMasuk) || $('jbJamMasuk').value; $('jbJamPulang').value = hm(r.jamSaran.jamPulang) || $('jbJamPulang').value; }
      const dipakai = r.hari.filter(function (h) { return h.dipakai; }), lewat = r.hari.filter(function (h) { return !h.dipakai; });
      box.innerHTML = r.jumlahTarget
        ? '<b>' + f(r.jumlahRelawan) + '</b> relawan (' + esc(r.contoh.join(', ')) + (r.jumlahRelawan > r.contoh.length ? ', …' : '') + ') × <b>' + dipakai.length + '</b> hari = <b>' + f(r.jumlahTarget) + '</b> jadwal (' + f(r.jumlahBaru) + ' baru, ' + f(r.jumlahDiperbarui) + ' diperbarui)' + (r.jumlahSudahAbsen ? '<br><span style="color:#b26a00;">' + f(r.jumlahSudahAbsen) + ' jadwal sudah ada absennya: jam absen tidak diubah.</span>' : '') + (r.dilewatiDivisi ? '<br><span style="color:var(--color-text-muted);">' + f(r.dilewatiDivisi) + ' relawan dilewati karena hari khusus divisi lain.</span>' : '') + (lewat.length ? '<br><span style="color:var(--color-text-muted);">Dilewati: ' + lewat.map(function (h) { return tglPendek(h.iso) + ' (' + esc(h.alasan) + ')'; }).join(', ') + '.</span>' : '')
        : '<span style="color:#c0392b;">Tidak ada tanggal operasional pada rentang ini' + (lewat.length ? ': ' + lewat.map(function (h) { return tglPendek(h.iso) + ' (' + esc(h.alasan) + ')'; }).join(', ') : '') + '. Atur dulu di Kalender Operasional.</span>';
      $('jbBuat').disabled = !r.jumlahTarget;
    } catch (err) { if (giliran !== urutPv) return; box.innerHTML = '<span style="color:#c0392b;">' + esc(err.message || 'Gagal membuat pratinjau.') + '</span>'; }
  }
  async function buat() {
    const b = bodyBuat(); if (!pv || !lengkap(b)) return;
    if (!/^\d{2}:\d{2}$/.test(b.jamMasuk) || !/^\d{2}:\d{2}$/.test(b.jamPulang)) { $('jbPesan').style.color = '#c0392b'; $('jbPesan').textContent = 'Jam masuk dan jam pulang wajib diisi.'; return; }
    if (!confirm('Buat ' + f(pv.jumlahTarget) + ' jadwal (' + f(pv.jumlahBaru) + ' baru, ' + f(pv.jumlahDiperbarui) + ' diperbarui) untuk ' + f(pv.jumlahRelawan) + ' relawan, jam ' + b.jamMasuk + '–' + b.jamPulang + '?\n\nRelawan akan menerima notifikasi penugasan.')) return;
    $('jbBuat').disabled = true; $('jbPesan').style.color = ''; $('jbPesan').textContent = 'Memproses…';
    try { const h = await api('buatPenugasanBaru', Object.assign(b, { konfirmasi: true })); $('jbPesan').style.color = '#2e7d32'; $('jbPesan').textContent = 'Selesai: ' + f(h.jumlah) + ' jadwal (' + f(h.jumlahBaru) + ' baru, ' + f(h.jumlahDiperbarui) + ' diperbarui)' + (h.jadwalHarianDiperbarui ? '; ' + f(h.jadwalHarianDiperbarui) + ' jadwal harian lama diselaraskan' : '') + (h.sudahAbsen ? '; ' + f(h.sudahAbsen) + ' sudah absen (tidak diubah)' : '') + (h.belumTerbentuk ? '; ' + f(h.belumTerbentuk) + ' jadwal harian belum terbentuk' : '') + '.'; await pratinjau(); await muatData(); }
    catch (err) { $('jbPesan').style.color = '#c0392b'; $('jbPesan').textContent = err.message || 'Gagal membuat jadwal.'; $('jbBuat').disabled = false; }
  }

  // ---------------- Periksa Jadwal ----------------
  function barisData() {
    if (!data) return []; const st = $('jpStatus').value;
    return data.relawan.filter(function (r) { const s = Object.keys(r.hari).map(function (k) { return r.hari[k]; }); return !st || (st === 'SUDAH' ? s.some(function (c) { return c.adaJadwal; }) : s.some(function (c) { return c.perluDibuat; })); });
  }
  async function muatData() {
    const awal = $('jpAwal').value; if (!awal) return; const giliran = ++urutData;
    try { const d = await api('getJadwalRentangV2', { tanggalMulai: awal, hari: Number($('jpMode').value), namaDivisi: $('jpDivisi').value }); if (giliran !== urutData) return; data = d; renderData(); }
    catch (err) { if (giliran !== urutData) return; data = null; $('jpTbody').innerHTML = '<tr><td colspan="9"><div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div></td></tr>'; }
  }
  function renderData() {
    const baris = barisData(), hari = data.hari; let sudah = 0, belum = 0;
    baris.forEach(function (r) { hari.forEach(function (h) { const c = r.hari[h.iso]; if (c && c.adaJadwal) sudah++; if (c && c.perluDibuat) belum++; }); });
    $('jpChips').innerHTML = '<span class="rmg-chip"><b>' + f(sudah) + '</b> Sudah dijadwalkan</span><span class="rmg-chip"><b>' + f(belum) + '</b> Belum dijadwalkan</span>';
    $('jpThead').innerHTML = '<tr><th>No</th><th style="text-align:left;">Nama</th><th>Divisi</th>' + hari.map(function (h) { return '<th class="' + (h.status === 'LIBUR' ? 'rmg-libur' : '') + '">' + HARI[dari(h.iso).getDay()] + '<small>' + tglPendek(h.iso) + '</small></th>'; }).join('') + '</tr>';
    $('jpTbody').innerHTML = baris.length ? baris.map(function (r, i) {
      return '<tr><td class="rmg-tengah">' + (i + 1) + '</td><td class="rmg-nama">' + esc(r.nama) + '</td><td class="rmg-div">' + esc(r.divisi) + '</td>' + hari.map(function (h) {
        const c = r.hari[h.iso] || {}, dapat = c.adaJadwal || c.perluDibuat;
        const isi = c.adaJadwal ? hm(c.jamMasuk).slice(0, 5).replace(/^0/, '') + '–' + hm(c.jamPulang).slice(0, 5).replace(/^0/, '') : (c.perluDibuat ? 'Belum' : '');
        return '<td class="' + (h.status === 'LIBUR' && !dapat ? 'rmg-libur' : '') + '" style="text-align:center;white-space:nowrap;font-size:11.5px;' + (c.perluDibuat ? 'color:#c0392b;font-weight:700;' : (c.adaJadwal ? 'font-weight:600;' : '')) + (dapat ? 'cursor:pointer;' : '') + '"' + (dapat ? ' data-pilih="1" data-r="' + esc(r.id) + '" data-t="' + h.iso + '"' : '') + '>' + isi + '</td>';
      }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + (3 + hari.length) + '"><div class="empty-state">Tidak ada relawan sesuai pilihan.</div></td></tr>';
  }
  function bukaAksi(idR, iso) {
    const r = data.relawan.filter(function (x) { return x.id === idR; })[0], c = r.hari[iso], box = $('jpAksi'), ada = c.adaJadwal; box.style.display = 'block';
    box.innerHTML = '<div style="font-weight:700;">' + esc(r.nama) + ' <span style="font-weight:500;color:var(--color-text-muted);">· ' + esc(r.divisi) + ' · ' + tglPanjang(iso) + '</span></div>' +
      (ada && c.statusMasuk && c.statusMasuk !== 'BELUM' ? '<div style="font-size:12px;color:#b26a00;margin-top:4px;">Relawan ini sudah absen pada tanggal itu. Mengubah jadwal tidak mengubah jam absen; gunakan Koreksi Presensi untuk koreksi absen.</div>' : '') +
      '<div class="filter-bar" style="margin-top:8px;"><label style="font-size:12px;">Jam masuk <input type="time" id="jpJamM" value="' + (hm(c.jamMasuk) || '08:00') + '"></label><label style="font-size:12px;">Jam pulang <input type="time" id="jpJamP" value="' + (hm(c.jamPulang) || '16:00') + '"></label><input id="jpCat" maxlength="200" placeholder="Catatan (opsional)" value="' + esc(c.catatan || '') + '" style="' + inp + 'flex:1;min-width:140px;"></div>' +
      '<div><button class="btn-mini primary" id="jpSimpan" type="button">' + (ada ? 'Ubah Jadwal' : 'Buat Jadwal') + '</button> ' + (ada ? '<button class="btn-mini" id="jpHapus" type="button" style="color:var(--color-danger);">Hapus</button> ' : '') + '<button class="btn-mini" id="jpBatal" type="button">Batal</button></div>';
    $('jpBatal').addEventListener('click', function () { box.style.display = 'none'; });
    $('jpSimpan').addEventListener('click', async function () {
      const jm = $('jpJamM').value, jp = $('jpJamP').value, cat = $('jpCat').value.trim(); if (!jm || !jp) { $('jpPesan').style.color = '#c0392b'; $('jpPesan').textContent = 'Jam masuk dan jam pulang wajib diisi.'; return; }
      try { if (ada) await api('ubahJadwalIndividu', { idAbsensi: c.idAbsensi, jamMasuk: jm, jamPulang: jp, catatan: cat }); else await api('buatJadwalIndividu', { idOperasional: c.idOperasional, idRelawan: r.id, jamMasuk: jm, jamPulang: jp, catatan: cat });
        $('jpPesan').style.color = '#2e7d32'; $('jpPesan').textContent = 'Jadwal tersimpan.'; box.style.display = 'none'; await muatData(); } catch (err) { $('jpPesan').style.color = '#c0392b'; $('jpPesan').textContent = err.message || 'Gagal menyimpan.'; }
    });
    if ($('jpHapus')) $('jpHapus').addEventListener('click', async function () {
      if (!confirm('Hapus jadwal ' + r.nama + ' pada ' + tglPanjang(iso) + '?')) return;
      try { await api('hapusJadwalIndividu', { idAbsensi: c.idAbsensi }); $('jpPesan').style.color = '#2e7d32'; $('jpPesan').textContent = 'Jadwal dihapus.'; box.style.display = 'none'; await muatData(); } catch (err) { $('jpPesan').style.color = '#c0392b'; $('jpPesan').textContent = err.message || 'Gagal menghapus.'; }
    });
    box.scrollIntoView({ block: 'nearest' });
  }

  // ---------------- jadwal otomatis lama (satu kali: dijadikan penugasan lalu dimatikan) ----------------
  async function muatOto() {
    const k = $('jbOto');
    try {
      const s = await api('getStatusJadwalOtomatis');
      if (s.otomatisAktif) {
        k.style.borderLeft = '4px solid #e65100';
        k.innerHTML = '<b>Jadwal otomatis per divisi masih AKTIF.</b> Jadwal kini hanya dari penugasan. ' + (s.perluDimigrasi ? '<b>' + s.perluDimigrasi + '</b> jadwal akan dijadikan penugasan per relawan (jam dan aturan tanggal sama persis) lalu jadwal otomatis dimatikan.' : 'Tidak ada jadwal yang bergantung padanya; aman dimatikan.') + '<div style="margin-top:8px;"><button class="btn-mini primary" id="jbOtoMatikan" type="button">Jadikan penugasan &amp; matikan jadwal otomatis</button> <span id="jbOtoPesan" style="margin-left:8px;"></span></div>';
        $('jbOtoMatikan').addEventListener('click', async function () {
          if (!confirm('Matikan jadwal otomatis per divisi?\n\nSetiap jadwal yang sekarang berasal dari pengaturan divisi dijadikan penugasan per relawan dengan jam yang sama.')) return;
          const p = $('jbOtoPesan'); p.textContent = 'Memproses…';
          try { const h = await api('matikanJadwalOtomatis', { konfirmasi: true }); await muatOto(); const q = $('jbOtoPesan'); if (q) { q.style.color = '#2e7d32'; q.textContent = h.sudahMati ? 'Sudah mati sebelumnya.' : 'Selesai: ' + h.dibuat + ' jadwal dijadikan penugasan.'; } } catch (err) { p.style.color = '#c0392b'; p.textContent = err.message || 'Gagal.'; }
        });
      } else {
        k.style.borderLeft = '4px solid #2e7d32';
        k.innerHTML = '<b>Jadwal hanya dari penugasan.</b> Jadwal otomatis per divisi sudah dimatikan. <button class="btn-mini" id="jbOtoHidup" type="button" style="margin-left:8px;">Hidupkan kembali (darurat)</button> <span id="jbOtoPesan" style="margin-left:8px;"></span>';
        $('jbOtoHidup').addEventListener('click', async function () { if (!confirm('Hidupkan kembali jadwal otomatis per divisi?')) return; try { await api('hidupkanJadwalOtomatis'); await muatOto(); } catch (err) { alert(err.message || 'Gagal.'); } });
      }
    } catch (err) { k.innerHTML = '<span style="color:#c0392b;">' + esc(err.message || 'Gagal memeriksa status.') + '</span>'; }
  }

  // ---------------- pemasangan ----------------
  const hariIni = isoLokal(new Date()); $('jbAwal').value = hariIni; $('jpAwal').value = hariIni;
  document.querySelectorAll('input[name="jbHari"]').forEach(function (e) { e.addEventListener('change', jadwalkanPratinjau); });
  document.querySelectorAll('input[name="jbCak"]').forEach(function (e) { e.addEventListener('change', aturCakupan); });
  $('jbAwal').addEventListener('change', jadwalkanPratinjau); $('jbRelawan').addEventListener('change', jadwalkanPratinjau);
  $('jbDivisi').addEventListener('change', function () { aturKelompok(); jadwalkanPratinjau(); });
  ['jbJamMasuk', 'jbJamPulang'].forEach(function (i) { $(i).addEventListener('input', function () { jamDiubah = true; }); });
  $('jbBuat').addEventListener('click', buat);
  ['jpMode', 'jpAwal', 'jpDivisi'].forEach(function (i) { $(i).addEventListener('change', muatData); }); $('jpStatus').addEventListener('change', function () { if (data) renderData(); });
  $('jpTbody').addEventListener('click', function (e) { const c = e.target.closest('td[data-pilih]'); if (c && data) bukaAksi(c.dataset.r, c.dataset.t); });
  async function init() {
    if (mulai) return; mulai = true;
    try { opsi = await api('getOpsiJadwalBaru'); isiOpsi(); } catch (err) { $('jbPratinjau').innerHTML = '<span style="color:#c0392b;">' + esc(err.message || 'Gagal memuat pilihan.') + '</span>'; }
    muatData(); muatOto(); pratinjau();
  }
  document.querySelectorAll('[data-panel="panelShift"]').forEach(function (t) { t.addEventListener('click', function () { setTimeout(init, 50); }); });
})();

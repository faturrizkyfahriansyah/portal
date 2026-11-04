// SPPG JEUNGJING — ADMIN: SIPRES › Koreksi Presensi. DIBANGUN ULANG 5 Nov 2026 (konsep disetujui Admin): tanpa periode.
// Harian / Mingguan + tanggal mulai (langsung termuat); filter Divisi / Relawan / Status; ringkasan terjadwal & hadir; aksi per baris:
// Buat Jadwal, Tandai Hadir / Koreksi Absen (tanggal berjalan atau lampau), Edit jadwal, Hapus. Data: getJadwalRentangV2 (JadwalBaru.gs).
(function () {
  const panel = document.getElementById('panelJadwalIndividu'); if (!panel) return;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const dari = function (iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], HARI_PENUH = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const tglPendek = function (iso) { const d = dari(iso); return d.getDate() + ' ' + BULAN[d.getMonth()]; };
  const tglPanjang = function (iso) { const d = dari(iso); return HARI_PENUH[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); };
  const hm = function (v) { const m = String(v || '').match(/^(\d{1,2}):(\d{2})/); return m ? z(m[1]) + ':' + m[2] : ''; };
  const LABEL = { H: 'Hadir', T: 'Terlambat', I: 'Izin', S: 'Sakit', C: 'Cuti', A: 'Alfa', B: 'Belum absen' };
  const SIMBOL = { H: '✓', T: 'T', I: 'I', S: 'S', C: 'C', A: 'A', B: '·' };
  const STATUS_FORM = { H: 'HADIR', T: 'HADIR', I: 'IZIN', S: 'SAKIT', C: 'CUTI', A: 'ALFA', B: 'HADIR' };
  let data = null, mulai = false, urut = 0, terbuka = null;

  panel.innerHTML =
    '<div class="shell-page-head"><div class="shell-page-head-icon"></div><div><h1 style="font-size:18px;margin:0;color:var(--color-navy);">Koreksi Presensi</h1></div></div>' +
    '<div class="filter-bar" id="kpFilter"><select id="kpMode" aria-label="Rentang"><option value="1">Harian</option><option value="7">Mingguan</option></select>' +
    '<label style="font-size:12px;">Mulai <input type="date" id="kpAwal"></label>' +
    '<select id="kpDivisi" aria-label="Divisi"><option value="">Semua Divisi</option></select><select id="kpRelawan" aria-label="Relawan"><option value="">Semua Relawan</option></select>' +
    '<select id="kpStatus" aria-label="Status"><option value="">Semua Status</option><option value="JADWAL">Terjadwal</option><option value="BELUM">Belum dijadwalkan</option><option value="H">Hadir</option><option value="T">Terlambat</option><option value="I">Izin</option><option value="S">Sakit</option><option value="C">Cuti</option><option value="A">Alfa</option><option value="B">Belum absen</option></select></div>' +
    '<div class="rmg-chips" id="kpChips"></div><div id="kpPesan" style="font-size:13px;margin:4px 0;"></div>' +
    '<div class="table-wrap"><table class="rmg-tabel" id="kpTabel"><thead id="kpThead"></thead><tbody id="kpTbody"></tbody></table></div>' +
    '<div id="kpAksi" class="admin-stat-card" style="display:none;padding:14px;text-align:left;margin-top:12px;"></div>';

  function pesan(t, galat) { const p = $('kpPesan'); p.textContent = t || ''; p.style.color = galat ? '#c0392b' : '#2e7d32'; }
  function bolehTombol(sel) {
    if (sel.perluDibuat) return [['buat', 'Buat Jadwal']];
    if (!sel.adaJadwal) return [];
    const koreksi = [sel.statusKehadiran === 'BELUM ABSEN' ? 'Tandai Hadir' : 'Koreksi Absen'];
    if (sel.sudahLewat) return [['koreksi', koreksi[0]], ['hapus', 'Hapus']];                    // tanggal lampau
    if (sel.sudahBerjalan) return [['koreksi', koreksi[0]], ['edit', 'Edit'], ['hapus', 'Hapus']]; // HARI INI: langsung boleh tandai hadir
    return [['edit', 'Edit'], ['hapus', 'Hapus']];                                                  // tanggal depan
  }
  function baris_() {
    if (!data) return [];
    const dv = $('kpDivisi').value, id = $('kpRelawan').value, st = $('kpStatus').value;
    return data.relawan.filter(function (r) {
      if (dv && r.divisi !== dv) return false; if (id && r.id !== id) return false;
      if (!st) return true;
      const sel = Object.keys(r.hari).map(function (k) { return r.hari[k]; });
      if (st === 'JADWAL') return sel.some(function (c) { return c.adaJadwal; });
      if (st === 'BELUM') return sel.some(function (c) { return c.perluDibuat; });
      return sel.some(function (c) { return c.kode === st || (st === 'H' && c.kode === 'T'); });
    });
  }
  function isiFilter() {
    const dv = $('kpDivisi'), pd = dv.value, unik = Array.from(new Set(data.relawan.map(function (r) { return r.divisi; }).filter(Boolean))).sort();
    dv.innerHTML = '<option value="">Semua Divisi</option>' + unik.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join(''); if (unik.indexOf(pd) >= 0) dv.value = pd;
    isiRelawan();
  }
  function isiRelawan() {
    const sel = $('kpRelawan'), pr = sel.value, dv = $('kpDivisi').value, ls = data.relawan.filter(function (r) { return !dv || r.divisi === dv; });
    sel.innerHTML = '<option value="">Semua Relawan</option>' + ls.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.nama) + '</option>'; }).join(''); if (ls.some(function (r) { return r.id === pr; })) sel.value = pr;
  }
  async function muat() {
    const awal = $('kpAwal').value; if (!awal) return;
    const giliran = ++urut; $('kpTbody').innerHTML = '<tr><td colspan="9"><div class="empty-state">Memuat…</div></td></tr>';
    try {
      const d = await api('getJadwalRentangV2', { tanggalMulai: awal, hari: Number($('kpMode').value) });
      if (giliran !== urut) return; data = d; isiFilter(); render();
    } catch (err) { if (giliran !== urut) return; data = null; $('kpTbody').innerHTML = '<tr><td colspan="9"><div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div></td></tr>'; }
  }
  function render() {
    if (!data) return;
    const baris = baris_(), hari = data.hari, harian = hari.length === 1, f = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
    const hit = { terjadwal: 0, belum: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, alfa: 0, belumAbsen: 0 };
    baris.forEach(function (r) { hari.forEach(function (h) { const c = r.hari[h.iso]; if (!c) return; if (c.adaJadwal) hit.terjadwal++; if (c.perluDibuat) hit.belum++; if (c.kode === 'H') hit.hadir++; else if (c.kode === 'T') { hit.hadir++; hit.terlambat++; } else if (c.kode === 'I') hit.izin++; else if (c.kode === 'S') hit.sakit++; else if (c.kode === 'C') hit.cuti++; else if (c.kode === 'A') hit.alfa++; else if (c.kode === 'B') hit.belumAbsen++; }); });
    const chip = function (n, l, tebal) { return '<span class="rmg-chip"><b>' + f(n) + '</b> ' + l + '</span>'; };
    $('kpChips').innerHTML = chip(hit.terjadwal, 'Terjadwal') + chip(hit.belum, 'Belum dijadwalkan') + chip(hit.hadir, 'Hadir') + chip(hit.terlambat, 'Terlambat') + chip(hit.izin, 'Izin') + chip(hit.sakit, 'Sakit') + chip(hit.cuti, 'Cuti') + chip(hit.alfa, 'Alfa') + chip(hit.belumAbsen, 'Belum absen');
    if (harian) {
      const iso = hari[0].iso;
      $('kpThead').innerHTML = '<tr><th>No</th><th style="text-align:left;">Nama</th><th>Divisi</th><th>Jadwal</th><th>Status</th><th>Aksi</th></tr>';
      $('kpTbody').innerHTML = baris.length ? baris.map(function (r, i) {
        const c = r.hari[iso] || {}, jam = c.adaJadwal ? hm(c.jamMasuk) + '–' + hm(c.jamPulang) : '—';
        const stat = c.adaJadwal ? '<b class="rmg-' + c.kode + '" style="padding:2px 8px;border-radius:6px;">' + (LABEL[c.kode] || esc(c.statusKehadiran)) + '</b>' + (c.jamMasukAktual ? '<div style="font-size:11px;color:var(--color-text-muted);">' + hm(c.jamMasukAktual) + (c.jamPulangAktual ? '–' + hm(c.jamPulangAktual) : '') + '</div>' : '') : (c.perluDibuat ? '<span style="color:#c0392b;">Belum dijadwalkan</span>' : '<span style="color:var(--color-text-muted);">—</span>');
        const tmb = bolehTombol(c).map(function (t) { return '<button type="button" class="btn-mini' + (t[0] === 'hapus' ? '" style="color:var(--color-danger);' : (t[0] === 'buat' ? ' primary' : '')) + '" data-aksi="' + t[0] + '" data-r="' + esc(r.id) + '" data-t="' + iso + '">' + t[1] + '</button>'; }).join(' ');
        return '<tr><td class="rmg-tengah">' + (i + 1) + '</td><td class="rmg-nama">' + esc(r.nama) + '</td><td class="rmg-div">' + esc(r.divisi) + '</td><td class="rmg-tengah">' + jam + '</td><td>' + stat + '</td><td style="white-space:nowrap;">' + tmb + '</td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="empty-state">Tidak ada relawan sesuai pilihan.</div></td></tr>';
    } else {
      $('kpThead').innerHTML = '<tr><th>No</th><th style="text-align:left;">Nama</th><th>Divisi</th>' + hari.map(function (h) { const lb = h.status === 'LIBUR'; return '<th class="' + (lb ? 'rmg-libur' : '') + '" title="' + esc(h.status) + '">' + HARI[dari(h.iso).getDay()] + '<small>' + tglPendek(h.iso) + '</small></th>'; }).join('') + '<th>Jadwal</th><th>Hadir</th></tr>';
      $('kpTbody').innerHTML = baris.length ? baris.map(function (r, i) {
        let nj = 0, nh = 0;
        const sel = hari.map(function (h) {
          const c = r.hari[h.iso] || {}; if (c.adaJadwal) nj++; if (c.kode === 'H' || c.kode === 'T') nh++;
          const dapat = c.adaJadwal || c.perluDibuat, kls = c.kode ? 'rmg-' + c.kode : (h.status === 'LIBUR' ? 'rmg-libur' : ''), isi = c.adaJadwal ? SIMBOL[c.kode] || '•' : (c.perluDibuat ? '+' : '');
          return '<td class="rmg-hari ' + kls + '"' + (dapat ? ' data-pilih="1" data-r="' + esc(r.id) + '" data-t="' + h.iso + '" style="cursor:pointer;' + (c.perluDibuat ? 'color:#c0392b;font-size:15px;' : '') + '" title="' + esc(c.adaJadwal ? (LABEL[c.kode] || c.statusKehadiran) + ' · ' + hm(c.jamMasuk) + '–' + hm(c.jamPulang) : 'Belum dijadwalkan — klik untuk membuat') + '"' : '') + '>' + isi + '</td>';
        }).join('');
        return '<tr><td class="rmg-tengah">' + (i + 1) + '</td><td class="rmg-nama">' + esc(r.nama) + '</td><td class="rmg-div">' + esc(r.divisi) + '</td>' + sel + '<td class="rmg-tengah">' + nj + '</td><td class="rmg-tengah"><b>' + nh + '</b></td></tr>';
      }).join('') : '<tr><td colspan="12"><div class="empty-state">Tidak ada relawan sesuai pilihan.</div></td></tr>';
    }
  }
  // ---------------- aksi ----------------
  function cari(idR, iso) { const r = data.relawan.filter(function (x) { return x.id === idR; })[0]; return r ? { r: r, c: r.hari[iso] || {} } : null; }
  function bukaPilihan(idR, iso) {   // tampilan mingguan: klik sel -> kartu aksi dengan tombol sesuai aturan tanggal
    const x = cari(idR, iso); if (!x) return; const k = $('kpAksi'); k.style.display = 'block'; terbuka = { idR: idR, iso: iso };
    const c = x.c, info = c.adaJadwal ? 'Jadwal ' + hm(c.jamMasuk) + '–' + hm(c.jamPulang) + ' · ' + (LABEL[c.kode] || esc(c.statusKehadiran)) : 'Belum dijadwalkan';
    k.innerHTML = '<div style="font-weight:700;">' + esc(x.r.nama) + ' <span style="font-weight:500;color:var(--color-text-muted);">· ' + esc(x.r.divisi) + '</span></div><div style="font-size:12.5px;color:var(--color-text-muted);margin:2px 0 8px;">' + tglPanjang(iso) + ' · ' + info + '</div><div id="kpTombolPilih">' +
      bolehTombol(c).map(function (t) { return '<button type="button" class="btn-mini' + (t[0] === 'buat' ? ' primary' : '') + '" data-aksi="' + t[0] + '" data-r="' + esc(idR) + '" data-t="' + iso + '">' + t[1] + '</button>'; }).join(' ') + '</div><div id="kpForm"></div>';
    k.scrollIntoView({ block: 'nearest' });
  }
  function bukaForm(jenis, idR, iso) {
    const x = cari(idR, iso); if (!x) return; const c = x.c, k = $('kpAksi');
    if (jenis === 'hapus') { hapus(x, iso); return; }
    if (k.style.display === 'none' || !$('kpForm') || !terbuka || terbuka.idR !== idR || terbuka.iso !== iso) { bukaPilihan(idR, iso); }
    const form = $('kpForm'), judul = { koreksi: c.statusKehadiran === 'BELUM ABSEN' ? 'Tandai Hadir' : 'Koreksi Absen', edit: 'Edit Jadwal', buat: 'Buat Jadwal' }[jenis];
    const jamM = hm(c.jamMasukAktual) || hm(c.jamMasuk) || '08:00', jamP = hm(c.jamPulangAktual) || hm(c.jamPulang) || '16:00';
    const lain = Object.keys(x.r.hari).map(function (q) { return x.r.hari[q]; }).filter(function (q) { return q.adaJadwal; })[0];
    form.innerHTML = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border,#e8ebef);"><b>' + judul + '</b>' +
      (jenis === 'koreksi' ? '<div style="margin:8px 0;"><select id="kpStatusBaru">' + ['HADIR', 'IZIN', 'SAKIT', 'CUTI', 'ALFA'].map(function (s) { return '<option value="' + s + '"' + (STATUS_FORM[c.kode] === s ? ' selected' : '') + '>' + s.charAt(0) + s.slice(1).toLowerCase() + '</option>'; }).join('') + '</select></div>' : '') +
      '<div id="kpBlokJam" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;"><label style="font-size:12px;">Jam masuk <input type="time" id="kpJamMasuk" value="' + (jenis === 'koreksi' ? jamM : (hm(c.jamMasuk) || (lain ? hm(lain.jamMasuk) : '08:00'))) + '"></label><label style="font-size:12px;">Jam pulang <input type="time" id="kpJamPulang" value="' + (jenis === 'koreksi' ? jamP : (hm(c.jamPulang) || (lain ? hm(lain.jamPulang) : '16:00'))) + '"></label></div>' +
      '<input id="kpCatatan" maxlength="200" placeholder="' + (jenis === 'koreksi' ? 'Keterangan / alasan (wajib, tercatat untuk audit)' : 'Catatan (opsional)') + '" value="' + (jenis === 'edit' ? esc(c.catatan) : '') + '" style="width:100%;padding:8px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;box-sizing:border-box;">' +
      '<div style="margin-top:10px;"><button type="button" class="btn-mini primary" id="kpSimpan">Simpan</button> <button type="button" class="btn-mini" id="kpBatal">Batal</button></div></div>';
    const atur = function () { const s = $('kpStatusBaru'); $('kpBlokJam').style.display = (!s || s.value === 'HADIR') ? 'flex' : 'none'; };
    if ($('kpStatusBaru')) $('kpStatusBaru').addEventListener('change', atur); atur();
    $('kpBatal').addEventListener('click', function () { $('kpAksi').style.display = 'none'; terbuka = null; });
    $('kpSimpan').addEventListener('click', function () { simpan(jenis, x, iso); });
  }
  async function simpan(jenis, x, iso) {
    const c = x.c, st = $('kpStatusBaru') ? $('kpStatusBaru').value : '', jm = $('kpJamMasuk').value, jp = $('kpJamPulang').value, cat = $('kpCatatan').value.trim();
    try {
      if (jenis === 'koreksi') {
        if (!cat) { pesan('Keterangan / alasan wajib diisi.', true); return; }
        if (st === 'HADIR' && (!jm || !jp)) { pesan('Jam masuk dan jam pulang wajib diisi untuk status Hadir.', true); return; }
        if (!confirm('Ubah status kehadiran ' + x.r.nama + ' (' + tglPendek(iso) + ') menjadi "' + st.charAt(0) + st.slice(1).toLowerCase() + '"?\n\nPerubahan ini memengaruhi kehadiran dan rekap penggajian, dan tercatat di riwayat audit.')) return;
        await api('koreksiAbsensiAktual', { idAbsensi: c.idAbsensi, statusBaru: st, jamMasuk: jm, jamPulang: jp, keterangan: cat });
      } else if (jenis === 'edit') {
        if (!confirm('Simpan perubahan jadwal ini? Jam absensi yang sudah tercatat tidak berubah.')) return;
        await api('ubahJadwalIndividu', { idAbsensi: c.idAbsensi, jamMasuk: jm, jamPulang: jp, catatan: cat });
      } else {
        await api('buatJadwalIndividu', { idOperasional: c.idOperasional, idRelawan: x.r.id, jamMasuk: jm, jamPulang: jp, catatan: cat });
      }
      pesan(jenis === 'koreksi' ? 'Absen berhasil dikoreksi.' : 'Jadwal berhasil disimpan.'); $('kpAksi').style.display = 'none'; terbuka = null; await muat();
    } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
  }
  async function hapus(x, iso) {
    if (!confirm('Hapus jadwal ' + x.r.nama + ' pada ' + tglPanjang(iso) + '?\n\nAbsensi yang sudah tercatat pada jadwal ini ikut terhapus.')) return;
    try { await api('hapusJadwalIndividu', { idAbsensi: x.c.idAbsensi }); pesan('Jadwal dihapus.'); $('kpAksi').style.display = 'none'; terbuka = null; await muat(); } catch (err) { pesan(err.message || 'Gagal menghapus.', true); }
  }
  // ---------------- pemasangan ----------------
  $('kpAwal').value = isoLokal(new Date());
  ['kpMode', 'kpAwal'].forEach(function (id) { $(id).addEventListener('change', muat); });
  $('kpDivisi').addEventListener('change', function () { if (data) { isiRelawan(); render(); } });
  ['kpRelawan', 'kpStatus'].forEach(function (id) { $(id).addEventListener('change', function () { if (data) render(); }); });
  panel.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-aksi]'); if (b) { bukaForm(b.dataset.aksi, b.dataset.r, b.dataset.t); return; }
    const sel = e.target.closest('td[data-pilih]'); if (sel) bukaPilihan(sel.dataset.r, sel.dataset.t);
  });
  const tombol = document.querySelector('[data-panel="panelJadwalIndividu"]');
  if (tombol) tombol.addEventListener('click', function () { if (!mulai) { mulai = true; muat(); } });
  // modul ini dimuat saat panel pertama dibuka (pemuat malas): bila tombol sudah ditekan sebelum modul siap, langsung muat.
  if (panel.classList.contains('active') || panel.style.display === 'block') { mulai = true; muat(); }
})();

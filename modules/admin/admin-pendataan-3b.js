// SPPG JEUNGJING — SIPIKA: Pendataan BNBA (By Name, By Address) (Admin, 25 Nov 2026). Satu halaman: tab Posyandu, tab Satuan pendidikan, tab Pengumuman PIC.
// Kelola password PIC, kode kelompok MPM, putaran pemutakhiran, lihat/hapus data, dan UNDUH file template MPM (dibuat di browser dari data server).
// Data berisi NIK: hanya Admin (Staff ditolak server). Unduhan dicatat di server (siapa, kapan, berapa baris).
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const panel = $('panelPendataan3B'); if (!panel) return;
  const C = window.Core3B;
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: window.sppgAdminToken }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  const dmy = function (iso) { const s = String(iso || '').slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : ''; };
  const TPL = 'assets/mpm/template-import-penerima-manfaat-posyandu.xlsx';
  let data = null, sibuk = false;

  const angka = function (n) { return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  const batang = function (terisi, target) {
    if (!(target > 0)) return '<small>Jumlah harus diisi: belum diatur</small>';
    const pr = Math.min(100, Math.round(terisi * 100 / target)), ok = terisi >= target;
    return '<div style="height:9px;border-radius:99px;background:#E8EEF4;overflow:hidden;min-width:120px"><div style="height:100%;width:' + pr + '%;background:' + (ok ? '#1E8E5A' : '#127CB4') + '"></div></div><small>' + (ok ? 'Lengkap' : 'Kurang ' + angka(target - terisi)) + ' · ' + pr + '%</small>';
  };
  const gaya = '<style>.bn-tab{display:flex;gap:6px;margin:0 0 12px;flex-wrap:wrap}.bn-kartu{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:0 0 14px}.bn-k{background:#fff;border:1px solid #E1E8F0;border-radius:12px;padding:12px 14px}.bn-k b{display:block;font-size:22px;color:#14304F}.bn-k span{font-size:13px;color:#5B6876}.bn-pw{font-size:30px;letter-spacing:.12em;font-weight:800;text-align:center;padding:14px;margin:12px 0;border:2px dashed #127CB4;border-radius:12px;background:#E6F3FB;color:#14304F;word-break:break-all}.bn-ov{position:fixed;inset:0;background:rgba(10,29,51,.5);display:grid;place-items:center;z-index:9999;padding:16px}.bn-dlg{background:#fff;border-radius:16px;padding:20px;max-width:440px;width:100%}.bb-tab{display:flex;gap:4px;margin:0 0 14px;padding:4px;border:1px solid var(--color-border,#d5dbe3);border-radius:12px;background:var(--color-surface,#f6f8fb);flex-wrap:wrap;width:fit-content;max-width:100%}.bb-tab .btn-mini{border:0;background:transparent;border-radius:9px;padding:8px 14px}.bb-tab .btn-mini.primary{background:var(--color-navy,#14304F);color:#fff}.bb-kartu{border:1px solid var(--color-border,#d5dbe3);border-radius:14px;padding:16px 18px;margin:0 0 14px;background:var(--color-surface-raised,#fff)}.bb-kartu h3{margin:0;font-size:15px}.bb-d{font-size:13px;color:var(--color-text-muted,#55606f);margin:3px 0 0;max-width:72ch}.bb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}.bb-i{border:1px solid var(--color-border,#d5dbe3);border-radius:14px;padding:14px 16px;background:var(--color-surface-raised,#fff);display:flex;flex-direction:column;gap:6px}.bb-i h4{margin:0;font-size:15px}.bb-i small{color:var(--color-text-muted,#55606f)}.bb-bar{height:9px;border-radius:99px;background:#E8EEF4;overflow:hidden}.bb-bar i{display:block;height:100%;background:#127CB4}.bb-bar.ok i{background:#1E8E5A}.bb-cp{display:flex;gap:6px;flex-wrap:wrap}.bb-cp span{border:1px solid var(--color-border,#d5dbe3);border-radius:999px;padding:2px 10px;font-size:12.5px}.bb-aksi{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:6px}.bb-i details{font-size:13px}.bb-i summary{cursor:pointer;color:var(--color-text-muted,#55606f)}.bb-ac{display:grid;grid-template-columns:minmax(180px,1.4fr) 1fr 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--color-border,#e1e8f0)}.bb-ac:first-of-type{border-top:0}.bb-ac b{display:block}.bb-ac small{color:var(--color-text-muted,#55606f)}.bb-ac .bb-arah{font-weight:700;color:#14304F}@media(max-width:700px){.bb-ac{grid-template-columns:1fr 1fr}.bb-ac>:first-child{grid-column:1/-1}}.bb-kosong{border:1px dashed var(--color-border,#d5dbe3);border-radius:12px;padding:18px;text-align:center;color:var(--color-text-muted,#55606f)}</style>';
  panel.innerHTML = gaya + '<div class="shell-page-head"><div><h2 class="shell-page-title">Pendataan BNBA</h2><p class="shell-page-sub">BNBA = By Name, By Address: data penerima manfaat per orang. Posyandu (ibu hamil, ibu menyusui, balita) dan satuan pendidikan (siswa, guru, tendik) diisi PIC lewat Portal PIC. <b>Berisi NIK/NISN: jangan dibagikan.</b></p></div></div>'
    + '<div id="bnRingkas" class="bn-kartu"></div><div id="bnKunci" class="bb-kartu"></div>'
    + '<div class="bb-tab" role="tablist"><button type="button" class="btn-mini primary" data-bn="pos" role="tab">Posyandu</button><button type="button" class="btn-mini" data-bn="sek" role="tab">Satuan pendidikan</button><button type="button" class="btn-mini" data-bn="acu" role="tab">Jadikan acuan</button><button type="button" class="btn-mini" data-bn="info" role="tab">Pengumuman PIC</button><button type="button" class="btn-mini" data-bn="peng" role="tab" id="bnTabPeng">Pengaduan PIC</button></div>'
    + '<div id="bnPos"><div id="p3Info"></div><div id="p3Pos"></div><div id="p3Data"></div>'
    + '<div class="bb-kartu"><h3>Riwayat unduhan</h3><div id="p3Riw" style="margin-top:8px"></div></div></div>'
    + '<div id="bnSek" style="display:none"></div><div id="bnAcu" style="display:none"></div><div id="bnInfo" style="display:none"></div><div id="bnPeng" style="display:none"></div>'
;
  panel.querySelectorAll('[data-bn]').forEach(function (b) {
    b.addEventListener('click', function () {
      panel.querySelectorAll('[data-bn]').forEach(function (x) { x.classList.toggle('primary', x === b); });
      ['pos', 'sek', 'acu', 'info', 'peng'].forEach(function (k) { $('bn' + k.charAt(0).toUpperCase() + k.slice(1)).style.display = k === b.dataset.bn ? '' : 'none'; });
      if (b.dataset.bn === 'acu') muatAcuan();
      if (b.dataset.bn === 'info') muatInfo();
      if (b.dataset.bn === 'peng') muatPeng();
    });
  });
  /** Kunci pendataan (27 Nov 2026): kunci per jenis supaya data yang sudah diunggah ke MPM tidak berubah. */
  async function muatKunci() {
    const el = $('bnKunci'); if (!el) return;
    let k; try { k = await api('getKunciPendataanAdmin'); } catch (e) { el.innerHTML = ''; return; }
    const waktu = function (iso) { return iso ? dmy(iso) + ' ' + String(iso).slice(11, 16) : ''; };
    const baris = function (j, nama) {
      const x = k[j] || {};
      return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 0">'
        + '<b style="min-width:140px">' + nama + '</b>'
        + (x.aktif ? '<span class="pg-status pg-wait">TERKUNCI</span><span style="font-size:13px;color:#5B6876;flex:1;min-width:180px">sejak ' + esc(waktu(x.sejak)) + ' · ' + esc(x.jumlah) + ' data' + (x.catatan ? ' · ' + esc(x.catatan) : '') + '</span>'
          : '<span class="pg-status pg-ok">Terbuka</span><span style="flex:1"></span>')
        + '<button type="button" class="btn-mini ' + (x.aktif ? '' : 'primary') + '" data-kunci="' + j + '" data-aksi="' + (x.aktif ? 'buka' : 'kunci') + '">' + (x.aktif ? 'Buka kunci' : 'Kunci') + '</button></div>';
    };
    el.innerHTML = '<div style="font-weight:700;margin-bottom:2px">Kunci pendataan</div><div style="font-size:13px;color:#5B6876;margin-bottom:4px">Terkunci = PIC dan Admin tidak bisa menambah, mengubah, atau menghapus data. Unduhan tetap bisa.</div>' + baris('POSYANDU', 'Posyandu') + baris('SEKOLAH', 'Satuan pendidikan');
    el.querySelectorAll('[data-kunci]').forEach(function (b) {
      b.addEventListener('click', async function () {
        const j = b.dataset.kunci, nama = j === 'POSYANDU' ? 'Posyandu' : 'Satuan pendidikan', kunci = b.dataset.aksi === 'kunci';
        let catatan = '';
        if (kunci) { if (!confirm('Kunci pendataan ' + nama + '? PIC tidak bisa lagi menambah atau mengubah data sampai kunci dibuka.')) return; catatan = prompt('Catatan (boleh kosong), misalnya "sudah diunggah ke MPM 27/11":', '') || ''; }
        else if (!confirm('Buka kunci pendataan ' + nama + '? PIC bisa mengubah data lagi.')) return;
        b.disabled = true;
        try { await api('aturKunciPendataanAdmin', { jenis: j, kunci: kunci, catatan: catatan }); info(kunci ? 'Terkunci.' : 'Kunci dibuka.'); } catch (e) { lapor(e.message); }
        muatKunci();
      });
    });
  }
  /** Jendela kecil untuk password sementara (ganti alert bawaan browser): ada tombol Salin. */
  function tampilPassword(r) {
    const ov = document.createElement('div'); ov.className = 'bn-ov';
    ov.innerHTML = '<div class="bn-dlg" role="dialog" aria-modal="true"><h3 style="margin:0 0 4px">Password sementara</h3><div style="font-size:14px;color:#5B6876">' + esc(r.nama) + ' · HP ' + esc(r.nomorHp) + '</div><div class="bn-pw" id="bnPw">' + esc(r.pin) + '</div><p style="font-size:14px;margin:0 0 12px">' + esc(r.catatan) + '</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn-mini" id="bnSalin">Salin</button><button type="button" class="btn-mini primary" id="bnTutup">Selesai</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#bnSalin').addEventListener('click', function () { try { navigator.clipboard.writeText(r.pin); info('Password disalin.'); } catch (e) { lapor('Tidak bisa menyalin otomatis. Catat password di layar.'); } });
    ov.querySelector('#bnTutup').addEventListener('click', function () { ov.remove(); });
  }
  window.bnTampilPassword = tampilPassword;
  /** Satu PIC dengan status password dan tombolnya (dipakai tab Posyandu dan tab Satuan pendidikan). */
  window.bnBarisPic = function (c) {
    return '<div style="margin-bottom:4px"><b>' + esc(c.nama) + '</b> · ' + (c.adaHp ? esc(c.hp) : '<span class="pg-err">nomor HP belum diisi di SIPANDU</span>') + '<br><small>Password: ' + (c.pinStatus === 'DIATUR' ? 'sudah dibuat ' + dmy(c.pinDiaturPada) : '<b>belum dibuat</b>') + (c.terkunci ? ' · <b style="color:#b3261e">TERKUNCI</b>' : '') + '</small> '
      + '<button type="button" class="btn-mini" data-pin="' + esc(c.idPic) + '"' + (c.adaHp ? '' : ' disabled') + '>' + (c.pinStatus === 'DIATUR' ? 'Atur ulang password' : 'Buat password') + '</button></div>';
  };
  window.bnPasangPassword = function (el, muatUlang) {
    el.querySelectorAll('[data-pin]').forEach(function (b) { b.addEventListener('click', async function () {
      if (!confirm('Buat password sementara untuk PIC ini? Password lama (bila ada) tidak berlaku lagi dan PIC harus masuk ulang.')) return;
      b.disabled = true; const t = b.textContent; b.textContent = 'Membuat…';
      try { const r = await api('aturPin3BAdmin', { idPic: b.dataset.pin }); tampilPassword(r); } catch (e) { lapor(e.message); }
      b.textContent = t; muatUlang(); }); });
  };
  window.bnRingkasSekolah = function (sekolah) { ringkasSek = sekolah; gambarRingkas(); };
  let ringkasSek = null;
  let jmlPengaduan = null;
  function gambarRingkas() {
    const el = $('bnRingkas'); if (!el || !data) return;
    const kotak = function (j, n, sub) { return '<div class="pg-kotak"><div class="pg-kotak-j">' + j + '</div><div class="pg-kotak-n">' + n + '</div>' + (sub ? '<div class="pg-kotak-s">' + sub + '</div>' : '') + '</div>'; };
    const tp = data.posyandu.filter(function (p) { return p.aktif; }), pT = tp.reduce(function (a, p) { return a + (p.target || 0); }, 0), pI = tp.reduce(function (a, p) { return a + p.jumlah.total; }, 0);
    let h = kotak('Posyandu', angka(pI) + (pT ? ' / ' + angka(pT) : ''), 'penerima manfaat terisi' + (pT ? ' dari target' : ''));
    if (ringkasSek) { const sT = ringkasSek.reduce(function (a, p) { return a + (p.target || 0); }, 0), sI = ringkasSek.reduce(function (a, p) { return a + p.jumlah.siswa; }, 0); h += kotak('Satuan pendidikan', angka(sI) + (sT ? ' / ' + angka(sT) : ''), 'siswa terisi' + (sT ? ' dari target' : '')); }
    const tanpaPw = data.posyandu.reduce(function (a, p) { return a + p.pic.filter(function (c) { return c.pinStatus !== 'DIATUR'; }).length; }, 0) + (ringkasSek ? ringkasSek.reduce(function (a, p) { return a + (p.picDetail || []).filter(function (c) { return c.pinStatus !== 'DIATUR'; }).length; }, 0) : 0);
    h += kotak('PIC tanpa password', tanpaPw, tanpaPw ? 'perlu dibuatkan' : 'semua sudah punya');
    h += kotak('Perlu diperbarui', angka(tp.reduce(function (a, p) { return a + p.jumlah.perluDiperbarui; }, 0)), 'lihat menu Pemutakhiran Data');
    if (jmlPengaduan !== null) h += kotak('Pengaduan baru', jmlPengaduan, 'dari PIC');
    el.innerHTML = h;
  }

  /* ---------- pengumuman untuk PIC (muncul di lonceng Portal PIC) ---------- */
  /* ---------- Pengaduan dari PIC ---------- */
  const ST_PENG = { BARU: 'Baru', DIPROSES: 'Sedang diproses', SELESAI: 'Selesai', DITOLAK: 'Tidak dapat dipenuhi', DITARIK: 'Ditarik PIC' };
  let filterPeng = 'BARU';
  function lencanaPeng(n) { const t = $('bnTabPeng'); if (t) t.textContent = 'Pengaduan PIC' + (n ? ' (' + n + ' baru)' : ''); jmlPengaduan = n || 0; gambarRingkas(); }
  async function muatPeng() {
    const el = $('bnPeng'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let d; try { d = await api('getPengaduanPicAdmin', { status: filterPeng }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    lencanaPeng(d.hitung.BARU);
    const chip = function (k, label) { return '<button type="button" class="btn-mini' + (filterPeng === k ? ' primary' : '') + '" data-fp="' + k + '">' + label + (k !== 'SEMUA' && d.hitung[k] ? ' (' + d.hitung[k] + ')' : '') + '</button>'; };
    el.innerHTML = '<div class="panel-block"><p class="pg-sub" style="margin-top:0">Pengaduan, permintaan, dan saran dari PIC. Permintaan PM ditambah/dikurangi dan insentif kurang tepat <b>hanya tercatat sebagai pesan</b>: ubah datanya sendiri di Manajemen PM / Master Tarif, lalu tulis balasan agar PIC tahu.</p>'
      + '<div class="bn-tab">' + chip('BARU', 'Baru') + chip('DIPROSES', 'Sedang diproses') + chip('SELESAI', 'Selesai') + chip('DITOLAK', 'Tidak dapat dipenuhi') + chip('SEMUA', 'Semua') + '</div>'
      + (d.items.length ? d.items.map(function (x) {
        return '<div class="bn-k" style="margin:0 0 10px" data-id="' + esc(x.id) + '"><b style="font-size:16px">' + esc(x.kategoriLabel) + '</b><span>' + esc([x.namaPic, x.namaInstansi, x.tanggal ? 'tanggal ' + String(x.tanggal).split('-').reverse().join('/') : '', x.jumlah ? x.jumlah + ' PM' : '', String(x.dibuat || '').slice(0, 16)].filter(Boolean).join(' · ')) + '</span>'
          + '<p style="margin:6px 0">' + esc(x.pesan) + '</p><p style="margin:0 0 6px;font-size:13px"><b>' + esc(ST_PENG[x.status] || x.status) + '</b>' + (x.balasan ? ' · Balasan: ' + esc(x.balasan) : '') + '</p>'
          + (x.status === 'DITARIK' ? '' : '<div style="display:flex;gap:6px;flex-wrap:wrap"><input type="text" maxlength="400" placeholder="Balasan singkat untuk PIC" data-bal="' + esc(x.id) + '" style="flex:1;min-width:200px;padding:8px;border:1px solid #d5dbe3;border-radius:8px" value="' + esc(x.balasan || '') + '">'
            + '<button type="button" class="btn-mini" data-st="DIPROSES" data-id="' + esc(x.id) + '">Sedang diproses</button><button type="button" class="btn-mini primary" data-st="SELESAI" data-id="' + esc(x.id) + '">Selesai</button><button type="button" class="btn-mini" data-st="DITOLAK" data-id="' + esc(x.id) + '">Tidak dapat dipenuhi</button></div>') + '</div>';
      }).join('') : '<p class="pg-sub">Tidak ada pengaduan di kelompok ini.</p>') + '</div>';
    el.querySelectorAll('[data-fp]').forEach(function (b) { b.addEventListener('click', function () { filterPeng = b.dataset.fp; muatPeng(); }); });
    el.querySelectorAll('button[data-st]').forEach(function (b) { b.addEventListener('click', async function () {
      const inp = el.querySelector('[data-bal="' + b.dataset.id + '"]'); b.disabled = true;
      try { await api('tanggapiPengaduanPicAdmin', { id: b.dataset.id, status: b.dataset.st, balasan: inp ? inp.value : '' }); info('Tanggapan terkirim ke PIC.'); } catch (e) { lapor(e.message); }
      muatPeng(); }); });
  }
  api('getPengaduanPicAdmin', { status: 'BARU' }).then(function (d) { lencanaPeng(d.hitung.BARU); }).catch(function () { /* hanya lencana: abaikan */ });
  async function muatInfo() {
    const el = $('bnInfo'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let d; try { d = await api('getPengumumanPic3BAdmin'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    el.innerHTML = '<div class="panel-block"><p class="pg-sub" style="margin-top:0">Pesan di sini tampil di ikon lonceng Portal PIC, untuk semua PIC (Posyandu dan satuan pendidikan).</p>'
      + '<div style="display:grid;gap:8px;max-width:560px"><input type="text" id="bnJudul" maxlength="100" placeholder="Judul, misalnya: Batas akhir pendataan" style="padding:10px;border:1px solid #d5dbe3;border-radius:8px"><textarea id="bnIsi" rows="4" maxlength="800" placeholder="Isi pesan untuk PIC" style="padding:10px;border:1px solid #d5dbe3;border-radius:8px;font-family:inherit"></textarea><div><button type="button" class="btn-mini primary" id="bnKirim">Kirim ke semua PIC</button></div></div></div>'
      + '<h4 style="margin:16px 0 6px">Pengumuman yang aktif</h4><div class="panel-block">' + (d.items.length ? d.items.map(function (x) {
        return '<div style="border-bottom:1px solid #E1E8F0;padding:8px 0"><b>' + esc(x.judul) + '</b> <small>· ' + esc(x.waktu) + '</small><div style="white-space:pre-wrap;font-size:14px;margin:4px 0">' + esc(x.isi) + '</div><button type="button" class="btn-mini" data-tarik="' + esc(x.id) + '">Tarik kembali</button></div>'; }).join('') : '<p class="pg-sub">Belum ada pengumuman.</p>') + '</div>';
    $('bnKirim').addEventListener('click', async function () {
      const b = this; b.disabled = true;
      try { await api('kirimPengumumanPic3BAdmin', { judul: $('bnJudul').value, isi: $('bnIsi').value }); info('Terkirim ke semua PIC.'); muatInfo(); } catch (e) { lapor(e.message); b.disabled = false; }
    });
    el.querySelectorAll('[data-tarik]').forEach(function (b) { b.addEventListener('click', async function () { if (!confirm('Tarik pengumuman ini? PIC tidak akan melihatnya lagi.')) return; try { await api('hapusPengumumanPic3BAdmin', { id: b.dataset.tarik }); info('Ditarik.'); } catch (e) { lapor(e.message); } muatInfo(); }); });
  }

  /* ---------- Jadikan acuan (28c): isi acuan di Master Instansi dari data BNBA ---------- */
  async function muatAcuan() {
    const el = $('bnAcu'); el.innerHTML = '<p class="pg-sub">Memuat…</p>';
    let d; try { d = await api('getUsulanAcuanBnbaAdmin'); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    const n = function (v) { return v === null || v === undefined ? '–' : angka(v); };
    const posBeda = d.posyandu.filter(function (x) { return x.jumlahData && !x.sama; }), sekBeda = d.sekolah.filter(function (x) { return x.jumlahData && !x.sama; });
    const status = function (x) { return !x.jumlahData ? '<span class="pg-status pg-kosong">Belum ada data BNBA</span>' : x.sama ? '<span class="pg-status pg-ok">Sudah sama</span>' : '<span class="pg-status pg-wait">Berbeda</span>'; };
    const tombol = function (x) { return '<button type="button" class="btn-mini ' + (x.jumlahData && !x.sama ? 'primary' : '') + '" data-acu="' + esc(x.id) + '"' + (x.jumlahData && !x.sama ? '' : ' disabled') + '>Jadikan acuan</button>'; };
    let h = '<div class="bb-kartu"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><h3>Jadikan acuan dari data BNBA</h3>'
      + '<p class="bb-d">Acuan di Manajemen Instansi diisi dari jumlah data BNBA yang sudah terisi. Angkanya dihitung ulang oleh server saat tombol ditekan. Yang belum punya data BNBA tidak diubah. Acuan tetap bisa diubah manual.</p></div>'
      + '<button type="button" class="btn-mini primary" id="acuSemua"' + (posBeda.length + sekBeda.length ? '' : ' disabled') + '>Jadikan acuan semua yang berbeda (' + (posBeda.length + sekBeda.length) + ')</button></div></div>';
    h += '<div class="bb-kartu"><h3>Posyandu</h3><p class="bb-d">Acuan balita, ibu hamil (bumil), dan ibu menyusui (busui) = jumlah data yang terisi.</p><div style="margin-top:8px">'
      + (d.posyandu.length ? d.posyandu.map(function (x) {
        return '<div class="bb-ac"><div><b>' + esc(x.nama) + '</b>' + status(x) + '</div>'
          + '<div><small>Acuan sekarang</small><br>Balita ' + n(x.sekarang.balita) + ' · Bumil ' + n(x.sekarang.bumil) + ' · Busui ' + n(x.sekarang.busui) + '</div>'
          + '<div><small>Dari data BNBA</small><br><span class="bb-arah">Balita ' + x.usulan.balita + ' · Bumil ' + x.usulan.bumil + ' · Busui ' + x.usulan.busui + '</span></div><div>' + tombol(x) + '</div></div>';
      }).join('') : '<div class="bb-kosong">Belum ada posyandu aktif.</div>') + '</div></div>';
    h += '<div class="bb-kartu"><h3>Satuan pendidikan</h3><p class="bb-d">Aturan: PAUD/TK = porsi kecil. SD/MI kelas 1–3 = porsi kecil, kelas 4–6 = porsi besar. SMP/MTs/SMA/SMK/MA = porsi besar. Guru dan tenaga pendidik = porsi besar. '
      + 'BNBA tidak mencatat kelas, jadi kelas SD/MI <b>diperkirakan dari umur per ' + esc(d.acuanUmurPer) + '</b> (tahun ajaran ' + esc(d.tahunAjaran) + '): umur 9 tahun ke bawah = kelas 1–3.</p><div style="margin-top:8px">'
      + (d.sekolah.length ? d.sekolah.map(function (x) {
        const c = x.rincian, cat = [];
        if (x.jumlahData) { cat.push('Siswa ' + c.siswa + ' · Guru ' + c.guru + ' · Tendik ' + c.tendik); if (c.perkiraan) cat.push('<b>' + c.perkiraan + ' siswa diperkirakan dari umur</b>'); if (c.tanpaTanggal) cat.push('<b class="pg-err">' + c.tanpaTanggal + ' siswa tanpa tanggal lahir tidak dihitung</b>'); if (x.jenjang === 'LAINNYA') cat.push('<b class="pg-err">jenjang tidak dikenali dari nama</b>'); }
        return '<div class="bb-ac"><div><b>' + esc(x.nama) + '</b><small>' + esc(x.jenjangNama) + '</small> ' + status(x) + (cat.length ? '<br><small>' + cat.join(' · ') + '</small>' : '') + '</div>'
          + '<div><small>Acuan sekarang</small><br>Kecil ' + n(x.sekarang.pk) + ' · Besar ' + n(x.sekarang.pb) + '</div>'
          + '<div><small>Dari data BNBA</small><br><span class="bb-arah">Kecil ' + x.usulan.pk + ' · Besar ' + x.usulan.pb + '</span></div><div>' + tombol(x) + '</div></div>';
      }).join('') : '<div class="bb-kosong">Belum ada satuan pendidikan aktif.</div>') + '</div></div>';
    el.innerHTML = h;
    const terapkan = async function (b, ids, semua, teks) {
      if (!confirm(teks)) return; b.disabled = true;
      try { const r = await api('jadikanAcuanBnbaAdmin', semua ? { semua: true } : { ids: ids }); info(r.diubah.length + ' acuan diperbarui' + (r.dilewati.length && semua ? ', ' + r.dilewati.length + ' dilewati.' : '.')); } catch (e) { lapor(e.message); }
      muatAcuan();
    };
    el.querySelectorAll('[data-acu]').forEach(function (b) { b.addEventListener('click', function () { const x = d.posyandu.concat(d.sekolah).filter(function (y) { return y.id === b.dataset.acu; })[0]; terapkan(b, [b.dataset.acu], false, 'Jadikan data BNBA sebagai acuan ' + x.nama + '? Acuan lama diganti.'); }); });
    if ($('acuSemua')) $('acuSemua').addEventListener('click', function () { terapkan(this, [], true, 'Jadikan data BNBA sebagai acuan untuk ' + (posBeda.length + sekBeda.length) + ' tempat yang berbeda? Acuan lama diganti. Yang belum punya data BNBA tidak diubah.'); });
  }

  async function muat() {
    $('p3Pos').innerHTML = '<p class="pg-sub">Memuat…</p>';
    try { data = await api('getPosyandu3BAdmin'); } catch (e) {
      $('p3Pos').innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return;
    }
    gambarPos(); muatRiwayat();
  }
  function gambarPos() {
    const el = $('p3Pos'); let h = '<div class="bb-aksi" style="margin:0 0 10px"><button type="button" class="btn-mini primary" id="p3Semua">Unduh semua Posyandu</button></div><div class="bb-grid">';
    data.posyandu.forEach(function (p) {
      const j = p.jumlah, t = p.target || 0, pr = t > 0 ? Math.min(100, Math.round(j.total * 100 / t)) : 0, lengkap = t > 0 && j.total >= t;
      h += '<div class="bb-i"' + (p.aktif ? '' : ' style="opacity:.55"') + '><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><h4>' + esc(p.nama) + '</h4>'
        + (!p.aktif ? '<span class="pg-status pg-kosong">NONAKTIF</span>' : t <= 0 ? '<span class="pg-status pg-kosong">Target belum diatur</span>' : lengkap ? '<span class="pg-status pg-ok">Lengkap</span>' : '<span class="pg-status pg-wait">Kurang ' + angka(t - j.total) + '</span>') + '</div>'
        + '<div><b style="font-size:20px">' + angka(j.total) + '</b>' + (t ? ' <small>dari ' + angka(t) + ' · ' + pr + '%</small>' : ' <small>penerima manfaat</small>') + '</div>'
        + (t ? '<div class="bb-bar' + (lengkap ? ' ok' : '') + '"><i style="width:' + pr + '%"></i></div>' : '')
        + '<div class="bb-cp"><span>Bumil ' + j['Ibu Hamil'] + '</span><span>Busui ' + j['Ibu Menyusui'] + '</span><span>Balita ' + j['Balita'] + '</span></div>'
        + '<small>' + (j.perluDiperbarui ? '<b>' + j.perluDiperbarui + ' perlu diperbarui</b>' : 'semua terbarui') + ' · Kode MPM: ' + (p.kodeKelompok ? esc(p.kodeKelompok) : 'belum diisi') + '</small>'
        + '<details><summary>PIC dan password (' + p.pic.length + ')</summary><div style="margin-top:6px">' + (p.pic.length ? p.pic.map(window.bnBarisPic).join('') : '<small>Belum ada PIC di SIPANDU.</small>') + '</div></details>'
        + '<div class="bb-aksi"><button type="button" class="btn-mini" data-lihat="' + esc(p.id) + '">Lihat data</button><button type="button" class="btn-mini primary" data-unduh="' + esc(p.id) + '"' + (j.total ? '' : ' disabled') + '>Unduh Excel</button><button type="button" class="btn-mini" data-kode="' + esc(p.id) + '">Ubah kode</button></div></div>';
    });
    el.innerHTML = h + '</div>';
    $('p3Semua').addEventListener('click', function () { unduh(null); });
    el.querySelectorAll('[data-unduh]').forEach(function (b) { b.addEventListener('click', function () { unduh(b.dataset.unduh); }); });
    el.querySelectorAll('[data-lihat]').forEach(function (b) { b.addEventListener('click', function () { lihat(b.dataset.lihat); }); });
    el.querySelectorAll('[data-kode]').forEach(function (b) { b.addEventListener('click', async function () {
      const p = data.posyandu.filter(function (x) { return x.id === b.dataset.kode; })[0], k = prompt('Kode kelompok MPM untuk ' + p.nama + ' (dari layar Kelompok Penerima Manfaat MPM, kolom Kode). Kosongkan untuk menghapus:', p.kodeKelompok || '');
      if (k === null) return; try { await api('simpanKodeKelompok3BAdmin', { idInstansi: p.id, kode: k.trim() }); info('Kode disimpan.'); } catch (e) { lapor(e.message); } muat(); }); });
    window.bnPasangPassword(el, muat);
    gambarRingkas();
  }
  async function lihat(idi) {
    const el = $('p3Data'), p = data.posyandu.filter(function (x) { return x.id === idi; })[0]; el.innerHTML = '<p class="pg-sub">Memuat data…</p>';
    let d; try { d = await api('getDaftarPenerima3B', { idInstansi: idi }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    el.innerHTML = '<div class="bb-kartu"><h3>Data ' + esc(p.nama) + ' (' + d.items.length + ')</h3><div style="margin-top:8px">' + (d.items.length ? '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Kategori</th><th>Nama</th><th>Lahir</th><th>NIK</th><th>Pasangan</th><th>Diperbarui</th><th></th></tr></thead><tbody>' + d.items.map(function (x) {
      const ps = x.kategori === 'Ibu Hamil' ? 'HPHT ' + esc(x.hpht) : x.kategori === 'Ibu Menyusui' ? 'Anak ' + esc(x.anak_nama) + ' · ' + esc(x.anak_nik) : 'Ibu ' + esc(x.ibu_nama) + ' · ' + esc(x.ibu_nik);
      return '<tr><td>' + esc(x.kategori) + '</td><td>' + esc(x.nama) + '</td><td>' + esc(x.tgl) + '</td><td>' + esc(x.nik) + '</td><td>' + ps + '</td><td>' + dmy(x.diperbaruiPada) + (x.perluDiperbarui ? ' <b>(perlu diperbarui)</b>' : '') + (x.catatan ? '<br><small class="pg-err">' + esc(x.catatan) + '</small>' : '') + '</td><td><button type="button" class="btn-mini" data-hapus="' + esc(x.id) + '">Hapus</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="pg-sub">Belum ada data.</p>') + '</div></div>';
    el.querySelectorAll('[data-hapus]').forEach(function (b) { b.addEventListener('click', async function () { if (!confirm('Hapus data ini? (Dihapus dari daftar dan tidak ikut diunduh.)')) return;
      try { await api('hapusPenerima3B', { idInstansi: idi, id: b.dataset.hapus }); info('Dihapus.'); } catch (e) { lapor(e.message); } lihat(idi); muat(); }); });
  }
  async function muatRiwayat() {
    const el = $('p3Riw'); let d; try { d = await api('getRiwayatEkspor3BAdmin', { limit: 50 }); } catch (e) { el.innerHTML = '<p class="pg-err">' + esc(e.message) + '</p>'; return; }
    if (!d.items.length) { el.innerHTML = '<p class="pg-sub">Belum ada unduhan.</p>'; return; }
    el.innerHTML = '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Waktu</th><th>Posyandu</th><th>File</th><th>Jumlah data</th><th>Oleh</th><th>Status unggah ke MPM</th></tr></thead><tbody>' + d.items.map(function (x) {
      return '<tr><td>' + esc(x.dibuatPada) + '</td><td>' + esc(x.posyandu) + '</td><td>' + esc(x.namaFile) + '</td><td>' + x.jumlahBaris + '</td><td>' + esc(x.dibuatOleh) + '</td><td><select data-st="' + esc(x.id) + '">' + ['BELUM', 'SUDAH', 'DITOLAK'].map(function (s) { return '<option' + (s === x.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></div>';
    el.querySelectorAll('[data-st]').forEach(function (s) { s.addEventListener('change', async function () { try { await api('ubahStatusUnggah3BAdmin', { idEkspor: s.dataset.st, status: s.value }); info('Status disimpan.'); } catch (e) { lapor(e.message); muatRiwayat(); } }); });
  }

  /* ---------- unduh ---------- */
  function muatJsZip() {
    if (window.JSZip) return Promise.resolve();
    return new Promise(function (ok, gagal) { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = ok; s.onerror = function () { gagal(new Error('Alat pembuat file Excel gagal dimuat. Periksa koneksi internet.')); }; document.head.appendChild(s); });
  }
  async function buatXlsx(records) {
    const buf = await (await fetch(TPL + '?v=20261124a')).arrayBuffer();
    const zip = await window.JSZip.loadAsync(buf, { createFolders: false });   // tanpa entri folder: urutan & nama entri tetap sama dengan template asli
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string'), sst = await zip.file('xl/sharedStrings.xml').async('string'), wb = await zip.file('xl/workbook.xml').async('string');
    const out = C.buildSheet(sheet, sst, records);
    const op = { createFolders: false };
    zip.file('xl/worksheets/sheet1.xml', out.sheet, op); zip.file('xl/sharedStrings.xml', out.sst, op); zip.file('xl/workbook.xml', C.patchWorkbook(wb), op);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  async function sha(bytes) { try { const h = await crypto.subtle.digest('SHA-256', bytes); return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); } catch (e) { return ''; } }
  function simpanBerkas(nama, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const aman = function (s) { return String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  async function unduh(idi) {
    if (sibuk) return; sibuk = true;
    try {
      await muatJsZip();
      const d = await api('getDataEkspor3BAdmin', idi ? { idInstansi: idi } : {}), tgl = d.tanggal.replace(/-/g, '');
      const berkas = [], kecuali = [];
      for (let i = 0; i < d.posyandu.length; i++) {
        const p = d.posyandu[i]; p.dikecualikan.forEach(function (x) { kecuali.push(p.nama + ': ' + x.nama + ' (' + x.kategori + ') — ' + x.alasan); });
        for (let o = 0, n = 1; o < p.records.length; o += d.maksBaris, n++) {
          const bagian = p.records.slice(o, o + d.maksBaris), bytes = await buatXlsx(bagian);
          const nama = 'Import-3B-' + aman(p.nama) + '-' + tgl + (p.records.length > d.maksBaris ? '-' + n : '') + '.xlsx';
          berkas.push({ idInstansi: p.idInstansi, nama: nama, bytes: bytes, jumlah: bagian.length });
        }
      }
      if (!berkas.length) { lapor('Tidak ada data yang bisa diunduh.' + (kecuali.length ? ' Semua data perlu diperiksa dulu.' : '')); sibuk = false; return; }
      if (berkas.length === 1) simpanBerkas(berkas[0].nama, new Blob([berkas[0].bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      else { const z = new window.JSZip(); berkas.forEach(function (b) { z.file(b.nama, b.bytes); }); simpanBerkas('Import-3B-Semua-Posyandu-' + tgl + '.zip', await z.generateAsync({ type: 'blob', compression: 'STORE' })); }
      for (let i = 0; i < berkas.length; i++) { try { await api('catatEkspor3BAdmin', { idInstansi: berkas[i].idInstansi, namaFile: berkas[i].nama, jumlahBaris: berkas[i].jumlah, checksum: await sha(berkas[i].bytes) }); } catch (e) { /* catatan gagal tidak membatalkan unduhan */ } }
      info(berkas.length + ' file siap.' + (kecuali.length ? ' ' + kecuali.length + ' data TIDAK ikut (lewat batas usia/tidak valid lagi).' : ''));
      if (kecuali.length) alert('Data berikut tidak ikut diunduh karena sudah tidak memenuhi aturan MPM (mis. balita sudah 5 tahun). Minta PIC memeriksa/mengubahnya:\n\n' + kecuali.join('\n'));
      muatRiwayat();
    } catch (e) { lapor(e.message); }
    sibuk = false;
  }
  muat(); muatKunci();
  // Pendataan satuan pendidikan (25 Nov 2026): bagian tambahan di panel yang sama
  (function () { function muatSekolah() { const s = document.createElement('script'); s.src = 'modules/admin/admin-pendataan-sekolah.js?v=20261128c'; document.head.appendChild(s); }
    if (window.CoreSekolah) muatSekolah(); else { const c = document.createElement('script'); c.src = 'core/core-sekolah.js?v=20261125b'; c.onload = muatSekolah; document.head.appendChild(c); } })();
})();

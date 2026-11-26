// ============================================================
// admin-manajemen-staf.js — Menu "Manajemen Staff" (25 Nov 2026, versi 25g).
// Staff inti: Kepala SPPG, Pengawas Gizi, Pengawas Keuangan. Staff BERBEDA dari relawan (tidak tertaut ke Data Relawan).
// Backend: StafBaru.gs (getDaftarStaf, simpanStaf, setStatusStaf, resetPasswordStaf). Akun login tetap di 06_ADMIN.
// Tombol simpan memberi tahu prosesnya di tombol itu sendiri (Menyimpan… → Tersimpan / Belum tersimpan + alasan).
// ============================================================
(function () {
  'use strict';
  const panel = document.getElementById('panelManajemenStaf');
  if (!panel) return;
  const root = document.getElementById('stfRoot');
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const $ = function (id) { return document.getElementById(id); };
  const token = function () { return ambilSesiAdmin().token; };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: token() }, payload || {}), 60000); };
  const JABATAN_BAWAAN = [{ kode: 'KEPALA_SPPG', nama: 'Kepala SPPG' }, { kode: 'PENGAWAS_GIZI', nama: 'Pengawas Gizi' }, { kode: 'PENGAWAS_KEUANGAN', nama: 'Pengawas Keuangan' }];
  const KOTAK = 'padding:8px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;font-size:13px;';
  let data = null, dash = null, riwayat = null, tab = 'ringkasan', sudahMuat = false, sandi = null, filterRiwayat = '';
  const WARNA = { navy: '#14304F', biru: '#127CB4', hijau: '#1E8E5A', kuning: '#B7791F', merah: '#C6403F', abu: '#98A2B3', garis: '#E1E8F0' };

  function ikon(d) { return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  const IKON_CENTANG = ikon('<path d="M5 12l5 5 9-10"/>');

  /** Tombol simpan: Menyimpan… → Tersimpan (centang) / Belum tersimpan + alasan tepat di bawah tombol. */
  async function simpanDiTombol(btn, kerja, lanjut) {
    const asli = btn.dataset.asli || btn.textContent; btn.dataset.asli = asli; btn.setAttribute('data-ts-skip', '1');
    let m = btn.parentElement.querySelector('.stf-pesan'); if (!m) { m = document.createElement('div'); m.className = 'stf-pesan'; m.setAttribute('role', 'alert'); m.style.cssText = 'font-size:13px;font-weight:600;color:#b23a3a;margin-top:8px;'; btn.parentElement.appendChild(m); }
    m.textContent = ''; btn.disabled = true; btn.style.cssText = 'opacity:1;background:#55606f;color:#fff;border-color:#55606f;'; btn.textContent = 'Menyimpan…';
    try {
      const hasil = await kerja();
      btn.style.cssText = 'opacity:1;background:#1f7a3f;color:#fff;border-color:#1f7a3f;'; btn.innerHTML = IKON_CENTANG + ' Tersimpan';
      await new Promise(function (r) { setTimeout(r, 600); });
      if (lanjut) await lanjut(hasil);
    } catch (err) {
      btn.disabled = false; btn.style.cssText = 'background:#b23a3a;color:#fff;border-color:#b23a3a;'; btn.textContent = 'Belum tersimpan. Ketuk untuk coba lagi';
      m.textContent = (err && err.message) || 'Gagal menyimpan.';
    }
  }

  function badge(teks, warna) { return '<span style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:' + warna[0] + ';color:' + warna[1] + ';">' + esc(teks) + '</span>'; }
  const HIJAU = ['#e6f4ec', '#1a7a4c'], MERAH = ['#fdeaea', '#b23a3a'], KUNING = ['#fff4de', '#9a6200'], ABU = ['#eef1f5', '#55606f'];

  const TAB = [['ringkasan', 'Ringkasan'], ['daftar', 'Daftar Staff'], ['tindak', 'Perlu Ditindaklanjuti'], ['riwayat', 'Riwayat'], ['panduan', 'Panduan']];
  function pesanGagal(err, ulang) { return '<div class="empty-state" style="color:#b23a3a;">' + esc((err && err.message) || 'Gagal memuat data.') + ' <button type="button" class="btn-mini" data-ulang="' + ulang + '">Coba lagi</button></div>'; }

  /** Memuat daftar staff (dan membuang ringkasan/riwayat lama supaya angka selalu segar), lalu menggambar ulang. */
  async function muat() {
    dash = null; riwayat = null;
    root.innerHTML = '<div class="empty-state">Memuat data staff…</div>';
    try { data = await apiGet('getDaftarStaf', { token: token() }); render(); }
    catch (err) { root.innerHTML = pesanGagal(err, 'utama'); }
  }

  function kotakSandi() {
    if (!sandi) return '';
    return '<div class="admin-stat-card accent-warning" style="padding:14px;text-align:left;margin-bottom:12px;" role="status">' +
      '<div style="font-weight:700;margin-bottom:4px;">Password sementara untuk ' + esc(sandi.nama || sandi.username) + ' (<code>' + esc(sandi.username) + '</code>)</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;"><code id="stfSandi" style="font-size:20px;letter-spacing:1px;padding:6px 12px;background:#fff;border:1px dashed #b9852f;border-radius:8px;">' + esc(sandi.password) + '</code>' +
      '<button type="button" class="btn-mini" id="stfSalin">Salin</button><button type="button" class="btn-mini" id="stfTutupSandi">Sudah saya catat</button></div>' +
      '<div style="font-size:12px;line-height:1.6;">Password ini <b>hanya tampil sekali</b>. Berikan ke orangnya lewat cara aman. Saat masuk pertama, sistem akan <b>memaksa ia membuat password baru</b>.</div></div>';
  }

  function jumlahTindak() { return (data.akunTanpaProfil || []).length + data.staf.filter(function (s) { return s.status === 'AKTIF' ? (!s.lengkap || s.wajibGanti) : false; }).length; }

  function render() {
    const nTindak = jumlahTindak();
    root.innerHTML = kotakSandi() +
      '<div role="tablist" aria-label="Submenu Manajemen Staff" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">' +
      TAB.map(function (t) { const on = t[0] === tab; return '<button type="button" role="tab" class="btn-mini' + (on ? ' primary' : '') + '" data-tab="' + t[0] + '" aria-selected="' + on + '">' + t[1] + (t[0] === 'tindak' && nTindak ? ' <span style="background:#C6403F;color:#fff;border-radius:999px;padding:0 7px;font-size:11px;margin-left:4px;">' + nTindak + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      '<div id="stfIsi"></div>';
    const s = $('stfSalin'); if (s) s.addEventListener('click', async function () { try { await navigator.clipboard.writeText(sandi.password); s.textContent = 'Tersalin'; } catch (e) { s.textContent = 'Salin manual'; } });
    const t = $('stfTutupSandi'); if (t) t.addEventListener('click', function () { sandi = null; render(); });
    isiTab();
  }

  function isiTab() {
    const w = $('stfIsi'); if (!w) return;
    if (tab === 'daftar') {
      const aktif = data.staf.filter(function (s) { return s.status === 'AKTIF'; }).length;
      w.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;"><button type="button" class="btn-mini primary" id="stfTambah">Tambah staff</button>' +
        '<span style="font-size:12px;color:var(--color-text-muted,#55606f);">' + data.staf.length + ' staff terdaftar, ' + aktif + ' aktif</span></div>' +
        '<div id="stfForm"></div><div id="stfDaftar">' + daftarHtml() + '</div>' + tanpaProfilHtml();
      $('stfTambah').addEventListener('click', function () { bukaForm(null); });
    } else if (tab === 'tindak') { w.innerHTML = tindakHtml(); }
    else if (tab === 'panduan') { w.innerHTML = panduanHtml(); }
    else if (tab === 'riwayat') { muatRiwayat(); }
    else { muatRingkasan(); }
  }

  // ------------------------------------------------------------ RINGKASAN (dashboard + tren)
  async function muatRingkasan() {
    const w = $('stfIsi');
    if (!dash) { w.innerHTML = '<div class="empty-state">Memuat ringkasan…</div>'; try { dash = await apiGet('getDashboardStaf', { token: token() }); } catch (err) { if (tab === 'ringkasan' && $('stfIsi')) $('stfIsi').innerHTML = pesanGagal(err, 'ringkasan'); return; } }
    if (tab !== 'ringkasan' || !$('stfIsi')) return;
    const k = dash.kartu;
    const kpi = [['Total staff', k.total, 'daftar', WARNA.navy], ['Aktif', k.aktif, 'daftar', WARNA.hijau], ['Nonaktif', k.nonaktif, 'daftar', k.nonaktif ? WARNA.merah : WARNA.abu], ['Profil lengkap', k.lengkap, 'tindak', WARNA.hijau], ['Profil belum lengkap', k.belumLengkap, 'tindak', k.belumLengkap ? WARNA.kuning : WARNA.abu], ['Belum ganti password', k.belumGantiPassword, 'tindak', k.belumGantiPassword ? WARNA.kuning : WARNA.abu], ['Akun lama tanpa profil', k.akunTanpaProfil, 'daftar', k.akunTanpaProfil ? WARNA.kuning : WARNA.abu]];
    let h = '';
    if (dash.peringatan && dash.peringatan.length) h += '<div class="admin-stat-card accent-warning" style="padding:12px 14px;text-align:left;margin-bottom:12px;font-size:13px;line-height:1.6;" role="status"><b>Perlu perhatian</b><ul style="margin:4px 0 0 18px;padding:0;">' + dash.peringatan.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;">' + kpi.map(function (x) { return '<button type="button" data-ke="' + x[2] + '" class="admin-stat-card" style="all:unset;box-sizing:border-box;cursor:pointer;padding:12px 14px;border:1px solid ' + WARNA.garis + ';border-radius:12px;background:#fff;"><b style="display:block;font-size:26px;line-height:1.1;color:' + x[3] + ';">' + x[1] + '</b><span style="font-size:12.5px;color:var(--color-text-muted,#55606f);">' + x[0] + '</span></button>'; }).join('') + '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">' +
      kartuGrafik('Staff per jabatan', 'Jumlah staff aktif dan seluruhnya untuk tiap jabatan.', grafikJabatan(dash.jabatan), tabelJabatan(dash.jabatan)) +
      kartuGrafik('Kelengkapan profil', 'Profil lengkap bila nama, NIK, dan nomor HP sudah terisi.', grafikKelengkapan(dash.kelengkapan), tabelKelengkapan(dash.kelengkapan)) +
      kartuGrafik('Tren pendaftaran staff', 'Staff baru per bulan (batang) dan jumlah kumulatif (garis), enam bulan terakhir.', grafikPendaftaran(dash.trenPendaftaran), tabelPendaftaran(dash.trenPendaftaran)) +
      kartuGrafik('Tren aktivitas akun', dash.trenAktivitas.tersedia ? 'Kejadian per minggu, delapan minggu terakhir (dari catatan audit).' : 'Catatan audit belum bisa dibaca, jadi tren aktivitas belum tersedia.', dash.trenAktivitas.tersedia ? grafikAktivitas(dash.trenAktivitas.minggu) : '', dash.trenAktivitas.tersedia ? tabelAktivitas(dash.trenAktivitas.minggu) : '') + '</div>' +
      '<div style="font-size:11px;color:var(--color-text-muted,#55606f);margin-top:10px;">Diperbarui ' + esc(new Date(dash.diperbarui).toLocaleString('id-ID')) + '. Angka dihitung dari data staff dan catatan audit; tidak memuat NIK maupun nomor HP.</div>';
    $('stfIsi').innerHTML = h;
  }
  function kartuGrafik(judul, sub, svg, tabel) {
    return '<section class="admin-stat-card" style="padding:14px;text-align:left;"><div style="font-weight:700;">' + esc(judul) + '</div><div style="font-size:12.5px;color:var(--color-text-muted,#55606f);margin:2px 0 8px;">' + esc(sub) + '</div>' + svg +
      (tabel ? '<details style="margin-top:8px;font-size:12.5px;"><summary style="cursor:pointer;color:' + WARNA.biru + ';">Lihat angka</summary>' + tabel + '</details>' : '') + '</section>';
  }
  const tabelHtml = function (kepala, baris) { return '<div class="table-wrap" style="margin-top:6px;"><table class="data-table" style="width:100%;"><thead><tr>' + kepala.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + baris.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; };
  function legenda(item) { return '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;margin-top:6px;">' + item.map(function (x) { return '<span style="display:inline-flex;align-items:center;gap:5px;"><i style="width:10px;height:10px;border-radius:3px;background:' + x[1] + ';display:inline-block;"></i>' + esc(x[0]) + '</span>'; }).join('') + '</div>'; }

  function grafikJabatan(j) {
    const maks = Math.max(1, Math.max.apply(null, j.map(function (x) { return x.total; })));
    return '<div role="img" aria-label="Jumlah staff per jabatan">' + j.map(function (x) {
      return '<div style="display:grid;grid-template-columns:minmax(90px,34%) 1fr 56px;gap:8px;align-items:center;font-size:13px;margin:0 0 8px;"><span>' + esc(x.nama) + '</span>' +
        '<span style="height:12px;background:#E8EEF5;border-radius:6px;overflow:hidden;position:relative;display:block;"><span style="position:absolute;left:0;top:0;bottom:0;width:' + (x.total / maks * 100) + '%;background:' + WARNA.abu + ';opacity:.55;"></span><span style="position:absolute;left:0;top:0;bottom:0;width:' + (x.aktif / maks * 100) + '%;background:' + WARNA.hijau + ';"></span></span><b style="text-align:right;">' + x.aktif + '/' + x.total + '</b></div>';
    }).join('') + legenda([['Aktif', WARNA.hijau], ['Seluruhnya (termasuk nonaktif)', WARNA.abu]]) + '</div>';
  }
  const tabelJabatan = function (j) { return tabelHtml(['Jabatan', 'Aktif', 'Seluruhnya'], j.map(function (x) { return [x.nama, x.aktif, x.total]; })); };

  function grafikKelengkapan(k) {
    const bagian = [['Lengkap', k.lengkap, WARNA.hijau], ['Kurang NIK', k.nikSaja, WARNA.kuning], ['Kurang nomor HP', k.hpSaja, WARNA.biru], ['Kurang keduanya', k.keduanya, WARNA.merah]], total = bagian.reduce(function (a, x) { return a + x[1]; }, 0);
    if (!total) return '<div style="font-size:13px;color:var(--color-text-muted,#55606f);">Belum ada staff yang terdaftar.</div>';
    return '<div role="img" aria-label="Kelengkapan profil staff"><div style="display:flex;height:22px;border-radius:8px;overflow:hidden;background:#E8EEF5;">' + bagian.filter(function (x) { return x[1] > 0; }).map(function (x) { return '<span title="' + esc(x[0]) + ': ' + x[1] + '" style="width:' + (x[1] / total * 100) + '%;background:' + x[2] + ';"></span>'; }).join('') + '</div>' + legenda(bagian.map(function (x) { return [x[0] + ' (' + x[1] + ')', x[2]]; })) + '</div>';
  }
  const tabelKelengkapan = function (k) { return tabelHtml(['Keadaan', 'Staff'], [['Lengkap', k.lengkap], ['Kurang NIK', k.nikSaja], ['Kurang nomor HP', k.hpSaja], ['Kurang keduanya', k.keduanya]]); };

  /** Rangka grafik batang SVG: nilai[] pada label[]; garis opsional (kumulatif). */
  function batangSvg(label, deret, garis) {
    const W = 320, H = 170, kiri = 28, bawah = 26, atas = 10, lebar = W - kiri - 8, tinggi = H - bawah - atas, n = label.length;
    const total = label.map(function (_, i) { return deret.reduce(function (a, d) { return a + (d.nilai[i] || 0); }, 0); });
    const maksAsli = Math.max.apply(null, total.concat(garis || [0])), maks = Math.max(1, maksAsli), langkah = Math.max(1, Math.ceil(maks / 4)), puncak = langkah * Math.ceil(maks / langkah), band = lebar / n, bw = Math.min(30, band * 0.62);
    let g = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" role="img" aria-hidden="true">';
    for (let v = 0; v <= puncak; v += langkah) { const y = atas + tinggi - v / puncak * tinggi; g += '<line x1="' + kiri + '" x2="' + (W - 8) + '" y1="' + y + '" y2="' + y + '" stroke="' + WARNA.garis + '"/><text x="' + (kiri - 4) + '" y="' + (y + 3) + '" font-size="9" fill="#667085" text-anchor="end">' + v + '</text>'; }
    label.forEach(function (lb, i) {
      let y = atas + tinggi; const cx = kiri + band * i + band / 2;
      deret.forEach(function (d) { const v = d.nilai[i] || 0; if (!v) return; const hh = v / puncak * tinggi; y -= hh; g += '<rect x="' + (cx - bw / 2) + '" y="' + y + '" width="' + bw + '" height="' + hh + '" rx="2" fill="' + d.warna + '"><title>' + esc(d.nama + ' ' + lb + ': ' + v) + '</title></rect>'; });
      g += '<text x="' + cx + '" y="' + (H - 9) + '" font-size="9" fill="#667085" text-anchor="middle">' + esc(lb) + '</text>';
    });
    if (garis) { const titik = garis.map(function (v, i) { return (kiri + band * i + band / 2) + ',' + (atas + tinggi - v / puncak * tinggi); }); g += '<polyline points="' + titik.join(' ') + '" fill="none" stroke="' + WARNA.navy + '" stroke-width="2"/>' + titik.map(function (t, i) { return '<circle cx="' + t.split(',')[0] + '" cy="' + t.split(',')[1] + '" r="3" fill="' + WARNA.navy + '"><title>Kumulatif ' + esc(label[i] + ': ' + garis[i]) + '</title></circle>'; }).join(''); }
    return g + '</svg>';
  }
  function grafikPendaftaran(b) { return batangSvg(b.map(function (x) { return x.label; }), [{ nama: 'Staff baru', warna: WARNA.biru, nilai: b.map(function (x) { return x.baru; }) }], b.map(function (x) { return x.kumulatif; })) + legenda([['Staff baru', WARNA.biru], ['Kumulatif', WARNA.navy]]); }
  const tabelPendaftaran = function (b) { return tabelHtml(['Bulan', 'Staff baru', 'Kumulatif'], b.map(function (x) { return [x.label, x.baru, x.kumulatif]; })); };
  function grafikAktivitas(m) {
    const d = [['Akun dibuat/dilengkapi', 'tambah', WARNA.hijau], ['Password sementara dibuat', 'reset', WARNA.kuning], ['Password diganti pemilik', 'ganti', WARNA.biru], ['Profil diisi staff', 'profil', WARNA.navy]];
    return batangSvg(m.map(function (x) { return x.label; }), d.map(function (x) { return { nama: x[0], warna: x[2], nilai: m.map(function (r) { return r[x[1]]; }) }; })) + legenda(d.map(function (x) { return [x[0], x[2]]; }));
  }
  const tabelAktivitas = function (m) { return tabelHtml(['Minggu mulai', 'Dibuat', 'Reset', 'Ganti password', 'Profil'], m.map(function (x) { return [x.label, x.tambah, x.reset, x.ganti, x.profil]; })); };

  // ------------------------------------------------------------ PERLU DITINDAKLANJUTI
  function tindakHtml() {
    const baris = [];
    data.staf.forEach(function (s) {
      const m = [];
      if (s.status === 'AKTIF') { if (!s.hpAda) m.push('Nomor HP belum diisi'); if (!s.nikAda) m.push('NIK belum diisi'); if (s.wajibGanti) m.push('Belum mengganti password sementara'); } else m.push('Akun nonaktif');
      if (m.length) baris.push({ u: s.username, nama: s.nama, jab: s.namaJabatan, m: m, aksi: s });
    });
    (data.akunTanpaProfil || []).forEach(function (a) { baris.push({ u: a.username, nama: a.nama || a.username, jab: '', m: ['Akun lama belum punya profil staff'], lama: a }); });
    if (!baris.length) return '<div class="empty-state">Semua staff sudah beres: profil lengkap dan password sudah diganti.</div>';
    return '<div style="font-size:13px;color:var(--color-text-muted,#55606f);margin-bottom:10px;line-height:1.6;">Staff di bawah ini masih punya yang perlu dilengkapi. Staff mengisi sendiri di <b>Profil Saya</b>; Admin bisa membantu mengisi nomor HP lewat <b>Ubah</b>.</div>' +
      baris.map(function (r) {
        return '<div class="admin-stat-card" style="padding:12px 14px;text-align:left;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;"><div><b>' + esc(r.nama) + '</b> <span style="font-size:12px;color:var(--color-text-muted,#55606f);">' + esc(r.u) + (r.jab ? ' · ' + esc(r.jab) : '') + '</span>' +
          '<div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">' + r.m.map(function (x) { return badge(x, x === 'Akun nonaktif' ? MERAH : KUNING); }).join('') + '</div></div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + (r.lama ? '<button type="button" class="btn-mini" data-lengkapi-tab="' + esc(r.u) + '">Lengkapi profil</button>' : '<button type="button" class="btn-mini" data-ubah-tab="' + esc(r.u) + '">Ubah</button>' + (data.sayaSuperAdmin && r.aksi.wajibGanti ? '<button type="button" class="btn-mini" data-reset="' + esc(r.u) + '">Buat password sementara</button>' : '')) + '</div></div>';
      }).join('');
  }

  // ------------------------------------------------------------ RIWAYAT
  async function muatRiwayat() {
    const w = $('stfIsi');
    if (!riwayat || riwayat._filter !== filterRiwayat) { w.innerHTML = '<div class="empty-state">Memuat riwayat…</div>'; try { riwayat = await apiGet('getRiwayatStaf', { token: token(), username: filterRiwayat }); riwayat._filter = filterRiwayat; } catch (err) { if (tab === 'riwayat' && $('stfIsi')) $('stfIsi').innerHTML = pesanGagal(err, 'riwayat'); return; } }
    if (tab !== 'riwayat' || !$('stfIsi')) return;
    const opsi = '<option value="">Semua staff</option>' + data.staf.map(function (s) { return '<option value="' + esc(s.username) + '"' + (s.username === filterRiwayat ? ' selected' : '') + '>' + esc(s.nama + ' (' + s.username + ')') + '</option>'; }).join('');
    let h = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;"><label style="font-size:12px;">Tampilkan <select id="stfFilterRiwayat" style="' + KOTAK + '">' + opsi + '</select></label><span style="font-size:12px;color:var(--color-text-muted,#55606f);">Maksimal 100 kejadian terbaru. Tidak memuat NIK, nomor HP, maupun password.</span></div>';
    if (!riwayat.tersedia) h += '<div class="empty-state">Catatan audit belum bisa dibaca.</div>';
    else if (!riwayat.daftar.length) h += '<div class="empty-state">Belum ada kejadian yang tercatat.</div>';
    else h += '<div class="table-wrap"><table class="data-table" style="width:100%;"><thead><tr><th>Waktu</th><th>Kejadian</th><th>Staff</th><th>Dilakukan oleh</th></tr></thead><tbody>' + riwayat.daftar.map(function (r) { return '<tr><td style="white-space:nowrap;">' + esc(r.waktu) + '</td><td>' + esc(r.aksi) + (r.keterangan ? ' <span style="color:var(--color-text-muted,#55606f);">(' + esc(r.keterangan) + ')</span>' : '') + '</td><td>' + esc(r.target) + '</td><td>' + esc(r.aktor) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    $('stfIsi').innerHTML = h;
    $('stfFilterRiwayat').addEventListener('change', function (e) { filterRiwayat = e.target.value; muatRiwayat(); });
  }

  // ------------------------------------------------------------ PANDUAN
  function panduanHtml() {
    const kartuP = function (j, isi) { return '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-bottom:10px;"><div style="font-weight:700;margin-bottom:4px;">' + j + '</div><div style="font-size:13px;line-height:1.7;">' + isi + '</div></div>'; };
    return kartuP('Siapa itu Staff?', 'Staff inti SPPG: <b>Kepala SPPG</b>, <b>Pengawas Gizi</b>, dan <b>Pengawas Keuangan</b>. Staff <b>berbeda dari relawan</b>: akunnya, profilnya, dan statusnya sendiri, tidak terhubung ke Data Relawan. Nama staff aktif tampil di susunan personel website publik.') +
      kartuP('Menambah staff', 'Buka <b>Daftar Staff</b>, ketuk <b>Tambah staff</b>, isi username, nama, jabatan, dan (bila ada) nomor HP. Sistem membuat <b>password sementara</b> yang tampil <b>sekali</b>. Berikan ke orangnya; saat masuk pertama ia wajib membuat password baru. Akun lama dari menu Pengelola SPPG tidak perlu dihapus: ketuk <b>Lengkapi profil</b> agar masuk daftar staff.') +
      kartuP('Staff lupa password', 'Super Admin mengetuk <b>Buat password sementara</b> pada nama staff itu. Password lama langsung tidak berlaku dan staff wajib menggantinya saat masuk. Staff yang masih ingat password bisa menggantinya sendiri di <b>Profil Saya</b>. Bila nomor HP staff sudah terisi dan verifikasi WhatsApp sudah diaktifkan Admin, staff juga bisa memilih <b>Lupa password</b> di halaman masuk dan menerima kode 6 angka lewat WhatsApp. Setelah itu ia wajib membuat password baru.') +
      kartuP('Masuk memakai nomor HP', 'Setelah nomor HP terisi (oleh Admin atau staff sendiri), staff bisa masuk dengan <b>nomor HP + password</b> selain username. Satu nomor hanya boleh dipakai satu akun (staff atau PIC).') +
      kartuP('Tampilan menu', '<b>Staff</b> = dapat melihat menu SIMSDM, SIPRES, SIKOP, SIRAGA, SIPIKA, dan SIPANDU, tetapi <b>hanya lihat</b> (tidak bisa mengubah data apa pun). Akun dan kata sandi, pengelolaan staff, pengaturan, dan website publik tidak tampil untuk Staff. <b>Admin</b> = menu lengkap; hak akses mengikuti jabatan dan diatur di Hak Akses dan Role. Staff tidak bisa mengubah jabatan atau role sendiri.') +
      kartuP('Nonaktif, bukan hapus', 'Staff yang berhenti dinonaktifkan: tidak bisa masuk, namanya hilang dari website, dan riwayatnya tetap tersimpan. Bisa diaktifkan lagi kapan saja.') +
      kartuP('Gaji dan rekening', 'Gaji staff dibayar langsung oleh BGN, tidak lewat portal. Karena itu profil staff <b>tidak memiliki data rekening</b>. Yang dilengkapi: data diri, nomor HP, nomor induk/ID BGN, email, pendidikan terakhir, dan kontak darurat.') +
      kartuP('Keamanan data', 'NIK dan nomor HP tampil tersamar di daftar; nomor lengkap hanya terlihat oleh pemilik akun di <b>Profil Saya</b>. Password tidak pernah tersimpan atau tercatat polos. Semua kejadian tercatat di tab <b>Riwayat</b> tanpa data pribadi.');
  }

  function daftarHtml() {
    if (!data.staf.length) return '<div class="empty-state">Belum ada staff. Ketuk <b>Tambah staff</b> untuk mendaftarkan Kepala SPPG, Pengawas Gizi, atau Pengawas Keuangan.</div>';
    return '<div class="table-wrap"><table class="data-table" style="width:100%;"><thead><tr><th>Nama</th><th>Jabatan</th><th>Nomor HP</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>' +
      data.staf.map(function (s) {
        return '<tr><td><b>' + esc(s.nama) + '</b><div style="font-size:12px;color:var(--color-text-muted,#55606f);">' + esc(s.username) + (s.role ? ' · ' + (s.role === 'STAFF' ? 'menu terbatas' : 'menu admin') : '') + '</div></td>' +
          '<td>' + esc(s.namaJabatan) + (s.keterangan ? '<div style="font-size:12px;color:var(--color-text-muted,#55606f);">' + esc(s.keterangan) + '</div>' : '') + '</td>' +
          '<td>' + (s.hpAda ? esc(s.hpTersamar) : '<span style="color:#9a6200;">belum diisi</span>') + '</td>' +
          '<td>' + (s.status === 'AKTIF' ? badge('Aktif', HIJAU) : badge('Nonaktif', MERAH)) + (s.lengkap ? '' : ' ' + badge('Profil belum lengkap', KUNING)) + (s.wajibGanti ? ' ' + badge('Belum ganti password', ABU) : '') + '</td>' +
          '<td><div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn-mini" data-ubah="' + esc(s.username) + '">Ubah</button>' +
          '<button type="button" class="btn-mini" data-status="' + esc(s.username) + '" data-aktif="' + (s.status === 'AKTIF' ? '0' : '1') + '">' + (s.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
          (data.sayaSuperAdmin ? '<button type="button" class="btn-mini" data-reset="' + esc(s.username) + '">Buat password sementara</button>' : '') + '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function tanpaProfilHtml() {
    if (!data.akunTanpaProfil.length) return '';
    return '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-top:16px;"><b>Akun yang belum punya profil staff</b>' +
      '<div style="font-size:12px;color:var(--color-text-muted,#55606f);margin:4px 0 10px;line-height:1.6;">Akun lama dari menu Pengelola SPPG. Ketuk <b>Lengkapi profil</b> agar ia masuk ke daftar staff di atas dan tidak perlu dibuat ulang.</div>' +
      data.akunTanpaProfil.map(function (a) {
        return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--color-border,#e3e7ee);flex-wrap:wrap;"><div><b>' + esc(a.nama || a.username) + '</b> <span style="font-size:12px;color:var(--color-text-muted,#55606f);">' + esc(a.username) + '</span> ' + (a.status === 'AKTIF' ? '' : badge('Nonaktif', MERAH)) + '</div>' +
          '<button type="button" class="btn-mini" data-lengkapi="' + esc(a.username) + '">Lengkapi profil</button></div>';
      }).join('') + '</div>';
  }

  function isian(id, label, nilai, ekstra, bantu) {
    return '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">' + label + '<input id="' + id + '" value="' + esc(nilai) + '" ' + (ekstra || '') + ' style="' + KOTAK + '">' + (bantu ? '<span style="font-size:11px;color:var(--color-text-muted,#55606f);">' + bantu + '</span>' : '') + '</label>';
  }

  /** s = baris staff (ubah), a = akun lama yang dilengkapi, null = tambah baru */
  function bukaForm(s, a) {
    const baru = !s && !a, tautkan = !!a, nilai = s || a || {};
    const jab = data.jabatan && data.jabatan.length ? data.jabatan : JABATAN_BAWAAN;
    const judul = baru ? 'Tambah staff' : (tautkan ? 'Lengkapi profil ' + esc(nilai.username) : 'Ubah ' + esc(nilai.username));
    const opsiJab = '<option value="">Pilih jabatan</option>' + jab.map(function (j) { return '<option value="' + esc(j.kode) + '"' + (j.kode === nilai.jabatan ? ' selected' : '') + '>' + esc(j.nama) + '</option>'; }).join('');
    $('stfForm').innerHTML = '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-bottom:12px;"><b>' + judul + '</b>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:10px 0;">' +
      isian('stfUser', 'Username untuk masuk', nilai.username || '', (baru ? '' : 'disabled ') + 'maxlength="30" autocapitalize="none" autocomplete="off"', baru ? 'Huruf kecil, angka, titik, atau garis bawah (4-30). Tidak bisa diubah setelah dibuat.' : '') +
      isian('stfNama', 'Nama lengkap', nilai.nama || '', 'maxlength="80" autocomplete="off"') +
      '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Jabatan<select id="stfJabatan" style="' + KOTAK + '">' + opsiJab + '</select></label>' +
      isian('stfKet', 'Keterangan jabatan (tampilan saja)', nilai.keterangan || '', 'maxlength="80" autocomplete="off"', 'Contoh: Kepala SPPG Jeungjing') +
      '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Tampilan menu<select id="stfRole" style="' + KOTAK + '"><option value="STAFF"' + (nilai.role !== 'ADMIN' ? ' selected' : '') + '>Staff (hanya lihat di semua modul)</option><option value="ADMIN"' + (nilai.role === 'ADMIN' ? ' selected' : '') + '>Admin (menu lengkap, hak akses mengikuti jabatan)</option></select></label>' +
      '<div id="stfHpWadah">' + (s && s.hpAda
        ? '<div style="font-size:12px;margin-bottom:3px;">Nomor HP</div><div style="padding:10px 12px;border:1px solid #d5dbe3;border-radius:10px;background:#f3f5f8;font-weight:600;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>' + esc(s.hpTersamar) + '</div><div style="margin-top:6px;"><button type="button" class="btn-mini" id="stfGantiHp">Ganti nomor</button></div><span style="font-size:11px;color:var(--color-text-muted,#55606f);">Tersimpan. Nomor lengkap hanya terlihat oleh pemilik akun di Profil Saya.</span>'
        : isian('stfHp', 'Nomor HP', '', 'type="tel" maxlength="16" inputmode="tel" autocomplete="off" placeholder="081234567890"', 'Dipakai untuk masuk bersama password. Boleh dikosongkan dulu; staff bisa mengisinya sendiri di Profil Saya.')) + '</div>' +
      '</div><div><button type="button" class="btn-mini primary" id="stfSimpan">' + (baru ? 'Buat akun staff' : 'Simpan') + '</button> <button type="button" class="btn-mini" id="stfBatal">Batal</button></div></div>';
    $('stfBatal').addEventListener('click', function () { $('stfForm').innerHTML = ''; });
    if ($('stfGantiHp')) $('stfGantiHp').addEventListener('click', function () { $('stfHpWadah').innerHTML = isian('stfHp', 'Nomor HP baru', '', 'type="tel" maxlength="16" inputmode="tel" autocomplete="off" placeholder="081234567890"', 'Mengganti nomor yang sudah tersimpan dihitung sebagai perubahan oleh admin.'); $('stfHp').focus(); });
    $('stfSimpan').addEventListener('click', function (e) {
      simpanDiTombol(e.currentTarget, function () {
        return api('simpanStaf', { username: nilai.username || $('stfUser').value, nama: $('stfNama').value, jabatan: $('stfJabatan').value, keterangan: $('stfKet').value, role: $('stfRole').value, nomorHp: $('stfHp') ? $('stfHp').value : '', tautkan: tautkan });
      }, async function (h) {
        if (h && h.passwordSementara) sandi = { username: (nilai.username || $('stfUser').value), nama: $('stfNama').value, password: h.passwordSementara };
        await muat();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    $('stfForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  root.addEventListener('click', async function (e) {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; render(); return; }
    const ke = e.target.closest('[data-ke]'); if (ke) { tab = ke.dataset.ke; render(); return; }
    const ul = e.target.closest('[data-ulang]'); if (ul) { if (ul.dataset.ulang === 'utama') muat(); else { dash = ul.dataset.ulang === 'ringkasan' ? null : dash; riwayat = ul.dataset.ulang === 'riwayat' ? null : riwayat; isiTab(); } return; }
    const ut = e.target.closest('[data-ubah-tab]'), lt = e.target.closest('[data-lengkapi-tab]');
    if (ut || lt) { tab = 'daftar'; render(); if (ut) bukaForm(data.staf.filter(function (x) { return x.username === ut.dataset.ubahTab; })[0]); else bukaForm(null, data.akunTanpaProfil.filter(function (x) { return x.username === lt.dataset.lengkapiTab; })[0]); return; }
    const u = e.target.closest('[data-ubah]'), l = e.target.closest('[data-lengkapi]'), st = e.target.closest('[data-status]'), rs = e.target.closest('[data-reset]');
    if (u) { bukaForm(data.staf.filter(function (x) { return x.username === u.dataset.ubah; })[0]); return; }
    if (l) { bukaForm(null, data.akunTanpaProfil.filter(function (x) { return x.username === l.dataset.lengkapi; })[0]); return; }
    if (st) {
      const aktifkan = st.dataset.aktif === '1';
      if (!aktifkan && !window.confirm('Nonaktifkan ' + st.dataset.status + '? Ia tidak bisa masuk sampai diaktifkan lagi, dan namanya tidak tampil di website.')) return;
      st.disabled = true; st.textContent = 'Memproses…';
      try { await api('setStatusStaf', { username: st.dataset.status, aktif: aktifkan }); await muat(); }
      catch (err) { st.disabled = false; st.textContent = 'Gagal: ' + (err.message || 'coba lagi'); }
      return;
    }
    if (rs) {
      const s = data.staf.filter(function (x) { return x.username === rs.dataset.reset; })[0];
      if (!window.confirm('Buat password sementara untuk ' + (s ? s.nama : rs.dataset.reset) + '? Password lama langsung tidak berlaku, dan ia wajib membuat password baru saat masuk.')) return;
      rs.disabled = true; rs.textContent = 'Memproses…';
      try { const h = await api('resetPasswordStaf', { username: rs.dataset.reset }); sandi = { username: rs.dataset.reset, nama: s && s.nama, password: h.passwordSementara }; await muat(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (err) { rs.disabled = false; rs.textContent = 'Gagal: ' + (err.message || 'coba lagi'); }
    }
  });

  const tombolNav = document.querySelector('[data-panel="panelManajemenStaf"]');
  if (tombolNav) tombolNav.addEventListener('click', function () { if (sudahMuat) return; sudahMuat = true; muat(); });
})();

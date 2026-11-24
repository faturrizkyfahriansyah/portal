// SPPG JEUNGJING — SIMSDM: Verifikasi WhatsApp & Antrean Pendaftaran (Admin, 24 Nov 2026).
// Status layanan kode WhatsApp (MPWA), uji kirim, dan antrean pendaftaran mandiri Relawan/Staff yang disetujui atau ditolak Super Admin.
// Kunci MPWA TIDAK pernah tampil di sini; diisi langsung di Script Properties. Staff ditolak server.
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const panel = $('panelVerifikasiWa'); if (!panel) return;
  const api = function (aksi, p) { return apiPost(aksi, Object.assign({ token: window.sppgAdminToken }, p || {})); };
  const lapor = function (m) { if (typeof showError === 'function') showError(m); else alert(m); };
  const info = function (m) { if (typeof showSuccess === 'function') showSuccess(m); else alert(m); };
  let antre = null, sibuk = false;

  panel.innerHTML = '<div class="shell-page-head"><div><h2 class="shell-page-title">Verifikasi WhatsApp &amp; Pendaftaran</h2><p class="shell-page-sub">Kode verifikasi lewat WhatsApp untuk lupa password/PIN dan pendaftaran mandiri. Pendaftaran Relawan dan Staff <b>harus disetujui Super Admin</b>. Akun Admin akses penuh tidak ikut kode WhatsApp.</p></div></div>'
    + '<h4 style="margin:12px 0 6px">Status layanan</h4><div id="vwStatus" class="panel-block"></div>'
    + '<h4 style="margin:16px 0 6px">Antrean pendaftaran <span id="vwJml"></span></h4><div id="vwAntre" class="panel-block"></div>'
    + '<h4 style="margin:16px 0 6px">Riwayat keputusan</h4><div id="vwRiw" class="panel-block"></div>';

  function baris(k, v, ok) { return '<tr><td style="padding:4px 10px 4px 0;color:#55606f">' + k + '</td><td><b style="color:' + (ok === true ? '#1a7a4c' : ok === false ? '#b23a3a' : 'inherit') + '">' + v + '</b></td></tr>'; }

  async function muatStatus() {
    const el = $('vwStatus'); el.innerHTML = '<p>Memuat…</p>';
    let s; try { s = await api('getStatusOtpAdmin'); } catch (e) { el.innerHTML = '<p style="color:#b23a3a">' + esc(e.message) + '</p>'; return; }
    el.innerHTML = '<table style="font-size:14px;border-collapse:collapse">'
      + baris('Layanan kode WhatsApp', s.aktif ? 'HIDUP' : 'MATI', s.aktif)
      + baris('Sakelar OTP_WA_AKTIF', s.saklarHidup ? 'menyala (1)' : 'mati (bukan 1)', s.saklarHidup)
      + baris('Kunci API MPWA', s.kunciTerisi ? 'terisi' : 'KOSONG', s.kunciTerisi)
      + baris('MPWA_SENDER', s.senderTerisi ? esc(s.senderSamar) : 'KOSONG', s.senderTerisi)
      + baris('Alamat MPWA', esc(s.baseUrl))
      + baris('Pesan terkirim hari ini', s.hariIni + ' dari batas ' + s.batasHarian)
      + baris('Modul 3B (untuk PIN PIC)', s.modul3BSiap ? 'siap' : 'belum disiapkan (jalankan siapkan3B)', s.modul3BSiap)
      + '</table>'
      + '<p style="font-size:13px;color:#55606f;margin:8px 0">Kunci dan nomor pengirim diisi langsung di <b>Apps Script &rsaquo; Project Settings &rsaquo; Script Properties</b> (bukan di sini). Mematikan cepat: ubah <b>OTP_WA_AKTIF</b> menjadi 0.</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="vwUji" type="tel" placeholder="Nomor HP Anda untuk uji kirim" style="padding:8px;border:1px solid #d5dbe3;border-radius:8px;min-width:220px"> <button type="button" class="btn-mini primary" id="vwUjiBtn">Uji kirim pesan</button></div>'
      + '<p style="font-size:12px;color:#55606f;margin:4px 0 0">Uji kirim memakai kuota harian dan bisa dipakai walau layanan masih MATI (asal kunci dan pengirim terisi).</p>';
    $('vwUjiBtn').addEventListener('click', async function () {
      const hp = $('vwUji').value.trim(); if (!hp) { lapor('Isi nomor HP untuk uji.'); return; }
      this.disabled = true; try { const r = await api('kirimUjiOtpAdmin', { nomorHp: hp }); info(r.pesan); muatStatus(); } catch (e) { lapor(e.message); this.disabled = false; }
    });
  }

  function dmy(t) { const m = String(t || '').match(/^(\d{4})-(\d\d)-(\d\d)(?: (\d\d:\d\d))?/); return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] : '') : String(t || ''); }
  async function muatAntre() {
    $('vwAntre').innerHTML = '<p>Memuat…</p>';
    try { antre = await api('getAntreanPendaftaranAdmin'); } catch (e) { $('vwAntre').innerHTML = '<p style="color:#b23a3a">' + esc(e.message) + '</p>'; return; }
    const menunggu = antre.daftar.filter(function (x) { return x.status === 'MENUNGGU'; }), selesai = antre.daftar.filter(function (x) { return x.status !== 'MENUNGGU'; });
    $('vwJml').textContent = menunggu.length ? '(' + menunggu.length + ' menunggu)' : '';
    $('vwAntre').innerHTML = menunggu.length ? menunggu.map(kartu).join('') : '<p style="color:#55606f">Tidak ada pendaftaran yang menunggu.</p>';
    $('vwRiw').innerHTML = selesai.length ? '<div class="table-wrap"><table class="rmg-tabel"><thead><tr><th>Waktu</th><th>Jenis</th><th>Nama</th><th>HP</th><th>Username</th><th>Keputusan</th><th>Oleh</th><th>Hasil</th></tr></thead><tbody>'
      + selesai.slice(0, 40).map(function (x) { return '<tr><td>' + esc(dmy(x.waktu)) + '</td><td>' + esc(x.jenis) + '</td><td>' + esc(x.nama) + '</td><td>' + esc(x.nomorHp) + '</td><td>' + esc(x.username) + '</td><td>' + (x.status === 'DISETUJUI' ? '<span style="color:#1a7a4c">Disetujui</span>' : '<span style="color:#b23a3a">Ditolak</span>') + (x.catatanKeputusan ? '<br><small>' + esc(x.catatanKeputusan) + '</small>' : '') + '</td><td>' + esc(x.diputuskanOleh) + '</td><td>' + esc(x.idHasil) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<p style="color:#55606f">Belum ada.</p>';
    panel.querySelectorAll('[data-setuju]').forEach(function (b) { b.addEventListener('click', function () { formSetuju(b.getAttribute('data-setuju')); }); });
    panel.querySelectorAll('[data-tolak]').forEach(function (b) { b.addEventListener('click', function () { putuskan(b.getAttribute('data-tolak'), 'TOLAK'); }); });
  }
  function kartu(x) {
    const rel = x.jenis === 'RELAWAN';
    return '<div class="admin-stat-card" style="padding:12px 14px;text-align:left;margin:0 0 10px" id="vwK-' + esc(x.id) + '"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + esc(x.nama) + '</b><span style="font-size:12px;color:#55606f">' + esc(x.id) + ' · ' + esc(dmy(x.waktu)) + '</span></div>'
      + '<div style="font-size:13px;margin:4px 0">' + (rel ? 'Relawan' : 'Staff') + ' · HP ' + esc(x.nomorHp) + ' <small>(terverifikasi lewat WhatsApp)</small>' + (rel ? ' · Divisi ' + esc(x.divisi) : '') + ' · Username <b>' + esc(x.username) + '</b></div>'
      + (x.catatan ? '<div style="font-size:13px;color:#55606f">Catatan: ' + esc(x.catatan) + '</div>' : '')
      + (rel && x.saran && x.saran.length ? '<div style="font-size:12.5px;margin-top:4px;color:#8a5a00">Mungkin sudah ada di Data Relawan: ' + x.saran.map(function (s) { return esc(s.nama) + ' (' + esc(s.id) + ', ' + esc(s.divisi) + ')'; }).join('; ') + '</div>' : '')
      + '<div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn-mini primary" data-setuju="' + esc(x.id) + '">Setujui…</button><button type="button" class="btn-mini" data-tolak="' + esc(x.id) + '">Tolak</button></div><div id="vwF-' + esc(x.id) + '"></div></div>';
  }
  function formSetuju(id) {
    const x = antre.daftar.filter(function (d) { return d.id === id; })[0]; if (!x) return; const box = $('vwF-' + id);
    if (x.jenis === 'RELAWAN') {
      box.innerHTML = '<div style="margin-top:10px;font-size:14px"><label style="display:block;margin-bottom:6px"><input type="radio" name="vwM' + esc(id) + '" value="baru" checked> Buat relawan BARU di divisi <select id="vwDiv' + esc(id) + '">' + antre.divisi.map(function (d) { return '<option' + (d === x.divisi ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label>'
        + '<label style="display:block;margin-bottom:6px"><input type="radio" name="vwM' + esc(id) + '" value="ada"> Tautkan ke relawan yang SUDAH ada, ID: <input id="vwId' + esc(id) + '" value="' + esc((x.saran && x.saran[0] && x.saran[0].id) || '') + '" placeholder="mis. R-PRS-001" style="padding:6px;border:1px solid #d5dbe3;border-radius:8px;width:150px"></label>'
        + '<input id="vwC' + esc(id) + '" placeholder="Catatan (boleh kosong)" style="padding:6px;border:1px solid #d5dbe3;border-radius:8px;width:100%;max-width:340px;margin-bottom:8px"><br>'
        + '<button type="button" class="btn-mini primary" id="vwOk' + esc(id) + '">Setujui dan buat akun</button></div>';
      $('vwOk' + id).addEventListener('click', function () {
        const m = panel.querySelector('input[name="vwM' + id + '"]:checked').value;
        putuskan(id, 'SETUJU', { catatan: $('vwC' + id).value, divisi: $('vwDiv' + id).value, idRelawan: m === 'ada' ? $('vwId' + id).value.trim() : '' });
      });
    } else {
      box.innerHTML = '<div style="margin-top:10px;font-size:14px"><div style="margin-bottom:6px">Akun dibuat sebagai <b>Staff (Admin Operasional)</b>. Hak akses diatur di Hak Akses dan Role.</div>'
        + '<input id="vwT' + esc(id) + '" placeholder="ID relawan untuk tautan (boleh kosong)" style="padding:6px;border:1px solid #d5dbe3;border-radius:8px;width:100%;max-width:300px;margin-bottom:6px"><br>'
        + '<input id="vwC' + esc(id) + '" placeholder="Catatan (boleh kosong)" style="padding:6px;border:1px solid #d5dbe3;border-radius:8px;width:100%;max-width:300px;margin-bottom:8px"><br>'
        + '<button type="button" class="btn-mini primary" id="vwOk' + esc(id) + '">Setujui dan buat akun Staff</button></div>';
      $('vwOk' + id).addEventListener('click', function () { putuskan(id, 'SETUJU', { catatan: $('vwC' + id).value, idRelawanTerkait: $('vwT' + id).value.trim() }); });
    }
  }
  async function putuskan(id, keputusan, ekstra) {
    if (sibuk) return;
    if (keputusan === 'TOLAK' && !confirm('Tolak pendaftaran ini? Pemohon tidak akan dibuatkan akun.')) return;
    sibuk = true;
    try { const r = await api('putuskanPendaftaranAdmin', Object.assign({ id: id, keputusan: keputusan }, ekstra || {})); info(keputusan === 'SETUJU' ? 'Disetujui. Akun dibuat (' + r.idHasil + '). Beri tahu pemohon agar masuk dengan username dan password pilihannya.' : 'Pendaftaran ditolak.'); await muatAntre(); }
    catch (e) { lapor(e.message); }
    sibuk = false;
  }
  muatStatus(); muatAntre();
})();

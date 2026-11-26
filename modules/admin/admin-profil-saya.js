// ============================================================
// admin-profil-saya.js — "Profil Saya" untuk semua akun Pengelola/Staff (25 Nov 2026, versi 25g).
// Dimuat langsung (bukan lazy) karena harus bekerja sesaat setelah masuk:
//   1) Bila akun memakai password sementara (baru dibuat / direset Super Admin) → layar WAJIB ganti password.
//   2) Bila profil staff belum lengkap (NIK, nomor HP) → pengingat di atas halaman.
// Panel "Profil Saya": data diri, nomor HP, data tambahan (tanpa rekening: gaji staff dari BGN), ganti password, bantuan.
// 25h: data tersimpan tampil + terkunci; tombol "Ubah" membuka isian. 25i: foto profil (bulat) di atas halaman.
// Backend: StafBaru.gs (getProfilStafSaya, simpanProfilStafSaya, gantiPasswordPengelola).
// ============================================================
(function () {
  'use strict';
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const $ = function (id) { return document.getElementById(id); };
  const token = function () { return ambilSesiAdmin().token; };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: token() }, payload || {}), 60000); };
  const KOTAK = 'padding:9px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;font-size:14px;width:100%;box-sizing:border-box;';
  const IKON_CENTANG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  let profil = null, wil = null, jk = '', sudahCek = false, pengingatDitutup = false, foto = null;

  async function simpanDiTombol(btn, kerja, lanjut) {
    const asli = btn.dataset.asli || btn.textContent; btn.dataset.asli = asli; btn.setAttribute('data-ts-skip', '1');
    let m = btn.parentElement.querySelector('.psy-pesan'); if (!m) { m = document.createElement('div'); m.className = 'psy-pesan'; m.setAttribute('role', 'alert'); m.style.cssText = 'font-size:13px;font-weight:600;color:#b23a3a;margin-top:8px;'; btn.parentElement.appendChild(m); }
    m.textContent = ''; btn.disabled = true; btn.style.cssText = 'opacity:1;background:#55606f;color:#fff;border-color:#55606f;'; btn.textContent = 'Menyimpan…';
    try {
      const h = await kerja();
      btn.style.cssText = 'opacity:1;background:#1f7a3f;color:#fff;border-color:#1f7a3f;'; btn.innerHTML = IKON_CENTANG + ' Tersimpan';
      await new Promise(function (r) { setTimeout(r, 600); });
      if (lanjut) await lanjut(h);
      btn.disabled = false; btn.style.cssText = ''; btn.textContent = asli;
    } catch (err) {
      btn.disabled = false; btn.style.cssText = 'background:#b23a3a;color:#fff;border-color:#b23a3a;'; btn.textContent = 'Belum tersimpan. Ketuk untuk coba lagi';
      m.textContent = (err && err.message) || 'Gagal menyimpan.';
    }
  }

  // ---------------------------------------------------------------- pemeriksaan setelah masuk
  async function periksaSetelahMasuk() {
    if (sudahCek) return; sudahCek = true;
    try {
      profil = await apiGet('getProfilStafSaya', { token: token() });
      if (profil.wajibGantiPassword) { layarWajibGanti(); return; }
      pasangPengingat();
    } catch (e) { sudahCek = false; /* gagal membaca: jangan mengunci siapa pun; dicoba lagi saat dibuka */ }
  }

  function layarWajibGanti() {
    if ($('psyWajib')) return;
    const w = document.createElement('div'); w.id = 'psyWajib'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'psyWajibJudul');
    w.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,28,46,.82);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;';
    w.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:420px;width:100%;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.3);">' +
      '<h2 id="psyWajibJudul" style="margin:0 0 6px;font-size:18px;color:#16324f;">Buat password baru</h2>' +
      '<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#55606f;">Anda masuk memakai <b>password sementara</b>. Demi keamanan, buat password baru yang hanya Anda yang tahu sebelum melanjutkan.</p>' +
      '<div style="display:grid;gap:10px;">' +
      '<label style="font-size:12px;">Password sementara (yang baru Anda pakai masuk)<input id="psyWLama" type="password" autocomplete="current-password" style="' + KOTAK + '"></label>' +
      '<label style="font-size:12px;">Password baru (minimal 8 karakter)<input id="psyWBaru" type="password" autocomplete="new-password" style="' + KOTAK + '"></label>' +
      '<label style="font-size:12px;">Ulangi password baru<input id="psyWUlang" type="password" autocomplete="new-password" style="' + KOTAK + '"></label></div>' +
      '<div style="margin-top:14px;"><button type="button" class="btn-mini primary" id="psyWSimpan" style="width:100%;padding:11px;">Simpan password baru</button></div></div>';
    document.body.appendChild(w);
    $('psyWSimpan').addEventListener('click', function (e) {
      simpanDiTombol(e.currentTarget, async function () {
        if ($('psyWBaru').value !== $('psyWUlang').value) throw new Error('Ulangi password baru: kedua isian belum sama.');
        return api('gantiPasswordPengelola', { passwordLama: $('psyWLama').value, passwordBaru: $('psyWBaru').value });
      }, async function () { profil.wajibGantiPassword = false; w.remove(); pasangPengingat(); });
    });
    setTimeout(function () { const f = $('psyWLama'); if (f) f.focus(); }, 50);
  }

  function pasangPengingat() {
    if (!profil || !profil.adaProfil || !profil.perluLengkapi || pengingatDitutup || $('psyPengingat')) return;
    const kepala = document.querySelector('.shell-content') || document.querySelector('main') || $('dashboardWrap'); if (!kepala) return;
    const d = document.createElement('div'); d.id = 'psyPengingat'; d.setAttribute('role', 'status');
    d.style.cssText = 'margin:0 0 12px;padding:10px 14px;border-radius:10px;background:#fff4de;border:1px solid #f0d49a;color:#6b4300;font-size:13px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;';
    d.innerHTML = '<span>Profil Anda belum lengkap. NIK dan nomor HP perlu diisi.</span><span style="display:flex;gap:6px;"><button type="button" class="btn-mini primary" id="psyBuka">Lengkapi sekarang</button><button type="button" class="btn-mini" id="psyNanti">Nanti</button></span>';
    kepala.insertBefore(d, kepala.firstChild);
    $('psyBuka').addEventListener('click', function () { const t = document.querySelector('[data-panel="panelProfilSaya"]'); if (t) t.click(); });
    $('psyNanti').addEventListener('click', function () { pengingatDitutup = true; d.remove(); });
  }

  // ---------------------------------------------------------------- panel Profil Saya
  // 26 Nov 2026 (25h): data yang sudah tersimpan TAMPIL dan TERKUNCI (bukan kotak kosong lagi). Untuk mengubah, ketuk "Ubah".
  const IKON_KUNCI = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  let ubah = { diri: false, hp: false, lain: false };
  function isian(id, label, nilai, ekstra, bantu) {
    return '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">' + label + '<input id="' + id + '" value="' + esc(nilai) + '" ' + (ekstra || '') + ' style="' + KOTAK + '">' + (bantu ? '<span style="font-size:11px;color:var(--color-text-muted,#55606f);">' + bantu + '</span>' : '') + '</label>';
  }
  const kartu = function (judul, isi, bantu, kunci) { return '<div class="admin-stat-card" style="padding:16px;text-align:left;margin-bottom:14px;"><div style="font-weight:700;margin-bottom:' + (bantu ? '2' : '10') + 'px;">' + (kunci ? IKON_KUNCI : '') + judul + '</div>' + (bantu ? '<div style="font-size:12px;color:var(--color-text-muted,#55606f);margin-bottom:10px;line-height:1.5;">' + bantu + '</div>' : '') + isi + '</div>'; };
  function baris(label, nilai) {
    return '<div style="padding:8px 10px;background:var(--color-surface-alt,#f3f5f8);border-radius:8px;min-width:0;"><div style="font-size:11px;color:var(--color-text-muted,#55606f);">' + label + '</div><div style="font-size:14px;font-weight:600;word-break:break-word;">' + (nilai ? esc(nilai) : '<span style="font-weight:400;color:#8a93a0;">Belum diisi</span>') + '</div></div>';
  }
  const kisi = function (isi) { return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;">' + isi + '</div>'; };
  const tombolUbah = function (id) { return '<div style="margin-top:12px;"><button type="button" class="btn-mini" id="' + id + '">Ubah</button></div>'; };
  const tombolSimpan = function (idSimpan, teks, idBatal, bisaBatal) { return '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn-mini primary" id="' + idSimpan + '">' + teks + '</button>' + (bisaBatal ? '<button type="button" class="btn-mini" id="' + idBatal + '">Batal</button>' : '') + '</div>'; };


  // ---------------------------------------------------------------- foto profil (25i)
  function terapkanFoto() {
    const a = $('psyAvatar'); if (!a) return;
    const adaFoto = !!foto;
    if (adaFoto) { a.innerHTML = ''; const im = document.createElement('img'); im.src = foto; im.alt = 'Foto profil'; im.style.cssText = 'width:100%;height:100%;object-fit:cover;'; a.appendChild(im); }
    if ($('psyHapusFoto')) $('psyHapusFoto').style.display = adaFoto ? '' : 'none';
    if ($('psyGantiFoto')) $('psyGantiFoto').textContent = adaFoto ? 'Ganti foto' : 'Tambah foto';
  }
  async function muatFoto() {
    if (foto !== null || !profil || !profil.adaProfil) { terapkanFoto(); return; }
    try { const r = await api('getFotoStafSaya'); foto = (r && r.profil) || ''; } catch (e) { foto = ''; }
    terapkanFoto();
  }
  /** Kecilkan di peramban: kotak 320 px, JPEG, dipotong dari tengah. */
  function kecilkan(file) {
    return new Promise(function (ok, gagal) {
      if (!/^image\//.test(file.type)) { gagal(new Error('Pilih berkas gambar (foto).')); return; }
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        const W = 320, c = document.createElement('canvas'); c.width = W; c.height = W;
        const r = Math.max(W / img.width, W / img.height), w = img.width * r, hh = img.height * r, g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, W); g.drawImage(img, (W - w) / 2, (W - hh) / 2, w, hh); URL.revokeObjectURL(url);
        let d = c.toDataURL('image/jpeg', 0.8); if (d.length > 380000) d = c.toDataURL('image/jpeg', 0.6); ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); gagal(new Error('Foto tidak bisa dibuka. Coba foto lain.')); };
      img.src = url;
    });
  }
  function pesanFoto(teks, galat) { const m = $('psyFotoPesan'); if (!m) return; m.textContent = teks; m.style.color = galat ? '#b23a3a' : '#1f7a3f'; }
  function pasangFoto() {
    if (!$('psyGantiFoto')) return;
    $('psyGantiFoto').addEventListener('click', function () {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'psyBerkasFoto'; inp.style.display = 'none';
      inp.addEventListener('change', async function () {
        const f = inp.files && inp.files[0]; if (!f) return; pesanFoto('Menyimpan foto…', false);
        try { const d = await kecilkan(f); await api('simpanFotoStafSaya', { dataUrl: d }); foto = d; terapkanFoto(); pesanFoto('Foto tersimpan.', false); }
        catch (e) { pesanFoto((e && e.message) || 'Foto gagal disimpan.', true); }
        if (inp.parentNode) inp.parentNode.removeChild(inp);
      });
      document.body.appendChild(inp); inp.click();
    });
    $('psyHapusFoto').addEventListener('click', async function () {
      pesanFoto('Menghapus…', false);
      try { await api('hapusFotoStafSaya'); foto = ''; if ($('psyAvatar')) { const a = $('psyAvatar'); a.textContent = String(profil.nama || profil.username || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0).toUpperCase(); }).join(''); } terapkanFoto(); pesanFoto('Foto dihapus.', false); }
      catch (e) { pesanFoto((e && e.message) || 'Foto gagal dihapus.', true); }
    });
  }

  async function muatPanel() {
    const root = $('psyRoot'); if (!root) return;
    root.innerHTML = '<div class="empty-state">Memuat profil…</div>';
    ubah = { diri: false, hp: false, lain: false };
    try { profil = await apiGet('getProfilStafSaya', { token: token() }); render(); }
    catch (err) { root.innerHTML = '<div class="empty-state" style="color:#b23a3a;">' + esc(err.message || 'Gagal memuat profil.') + ' <button type="button" class="btn-mini" id="psyCoba">Coba lagi</button></div>'; $('psyCoba').addEventListener('click', muatPanel); }
  }

  /** Isi yang dikirim ke server = nilai tersimpan, ditimpa isian yang sedang dibuka. */
  function dasar() {
    const p = profil.profil || {};
    return { nik: '', tempatLahir: p.tempatLahir || '', tanggalLahir: p.tanggalLahir || '', jenisKelamin: p.jenisKelamin || '', alamat: p.alamat || '', desa: p.desa || '', kecamatan: p.kecamatan || '', kabupaten: p.kabupaten || '', provinsi: p.provinsi || '',
      nomorInduk: p.nomorInduk || '', email: p.email || '', pendidikan: p.pendidikan || '', daruratNama: p.daruratNama || '', daruratHp: p.daruratHp || '' };
  }
  const ambilNilai = function (id) { const e = $(id); return e ? e.value : ''; };

  function render() {
    const root = $('psyRoot'), p = profil.profil || {};
    jk = p.jenisKelamin || '';
    const diriTerkunci = !!p.nikTerisi && !ubah.diri, hpTerkunci = !!p.hpTerisi && !ubah.hp;
    const lainAda = !!(p.nomorInduk || p.email || p.pendidikan || p.daruratNama || p.daruratHp), lainTerkunci = lainAda && !ubah.lain;
    const inisial = String(profil.nama || profil.username || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0).toUpperCase(); }).join('');
    let h = '<div class="admin-stat-card" style="padding:16px;text-align:left;margin-bottom:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;">' +
      '<div id="psyAvatar" aria-label="Foto profil" style="width:76px;height:76px;border-radius:50%;overflow:hidden;background:#16324f;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:26px;flex:none;">' + esc(inisial) + '</div>' +
      '<div style="flex:1;min-width:190px;"><div style="font-size:16px;font-weight:700;">' + esc(profil.nama || profil.username) + '</div>' +
      '<div style="font-size:13px;color:var(--color-text-muted,#55606f);margin-top:2px;">Username: <code>' + esc(profil.username) + '</code>' + (profil.namaJabatan ? ' · ' + esc(profil.namaJabatan) : '') + '</div>' +
      (profil.adaProfil ? '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn-mini" id="psyGantiFoto">Ganti foto</button><button type="button" class="btn-mini" id="psyHapusFoto" style="display:none;">Hapus foto</button></div><div id="psyFotoPesan" role="status" aria-live="polite" style="font-size:12px;margin-top:6px;"></div>' : '') +
      (profil.adaProfil && profil.perluLengkapi ? '<div style="margin-top:8px;font-size:13px;color:#9a6200;font-weight:600;">Profil belum lengkap: isi NIK dan nomor HP di bawah.</div>' : '') + '</div></div>';
    if (profil.adaProfil) {
      // ---- Data diri
      if (diriTerkunci) {
        const alamatPenuh = [p.alamat, p.desa && 'Desa/Kel. ' + p.desa, p.kecamatan && 'Kec. ' + p.kecamatan, p.kabupaten, p.provinsi].filter(Boolean).join(', ');
        h += kartu('Data diri',
          kisi(baris('NIK', p.nikAsli) + baris('Tempat lahir', p.tempatLahir) + baris('Tanggal lahir', p.tanggalLahir) + baris('Jenis kelamin', p.jenisKelamin)) +
          '<div style="margin-top:8px;">' + baris('Alamat', alamatPenuh) + '</div>' + tombolUbah('psyUbahDiri'),
          'Tersimpan dan terkunci. Hanya Anda yang melihat nomor lengkapnya.', true);
      } else {
        h += kartu('Data diri',
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' +
          isian('psyNik', 'NIK (wajib)', p.nikAsli || '', 'maxlength="16" inputmode="numeric" autocomplete="off" placeholder="16 angka sesuai KTP"', '16 angka sesuai KTP.') +
          isian('psyTempat', 'Tempat lahir', p.tempatLahir || '', 'maxlength="60" autocomplete="off"') +
          isian('psyTanggal', 'Tanggal lahir', p.tanggalLahir || '', 'type="date"') +
          '<div style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Jenis kelamin<div id="psyJk" style="display:flex;gap:6px;">' +
          ['Laki-laki', 'Perempuan'].map(function (j) { return '<button type="button" class="btn-mini" data-jk="' + j + '" aria-pressed="' + (jk === j) + '" style="flex:1;padding:9px;' + (jk === j ? 'background:#16324f;color:#fff;' : '') + '">' + j + '</button>'; }).join('') + '</div></div></div>' +
          '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;margin-top:10px;">Alamat (jalan, RT/RW)<textarea id="psyAlamat" rows="2" maxlength="300" autocomplete="off" style="' + KOTAK + '">' + esc(p.alamat || '') + '</textarea></label>' +
          '<div id="psyWilayah" style="margin-top:10px;"></div>' + tombolSimpan('psySimpanDiri', 'Simpan data diri', 'psyBatalDiri', !!p.nikTerisi));
      }
      // ---- Nomor HP
      if (hpTerkunci) {
        h += kartu('Nomor HP', kisi(baris('Nomor HP', p.nomorHpAsli)) +
          '<div style="margin-top:8px;font-size:12px;color:var(--color-text-muted,#55606f);">' + (p.sisaHariHp > 0 ? 'Nomor HP bisa diubah lagi ' + p.sisaHariHp + ' hari lagi.' : 'Mengubah nomor yang sudah tersimpan butuh password Anda.') + '</div>' + (p.sisaHariHp > 0 ? '' : tombolUbah('psyUbahHp')),
          'Dipakai untuk masuk bersama password, dan untuk kode lupa password lewat WhatsApp.', true);
      } else {
        h += kartu('Nomor HP',
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' +
          isian('psyHp', 'Nomor HP (WhatsApp aktif)', '', 'type="tel" maxlength="16" inputmode="tel" autocomplete="off" placeholder="081234567890"', p.hpTerisi ? 'Nomor baru menggantikan nomor lama.' : 'Belum diisi. Dengan nomor HP Anda bisa masuk memakai nomor + password dan reset password lewat WhatsApp.') +
          (p.hpTerisi ? '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Password (untuk mengubah nomor)<input id="psyHpSandi" type="password" autocomplete="current-password" style="' + KOTAK + '"></label>' : '') + '</div>' +
          tombolSimpan('psySimpanHp', 'Simpan nomor HP', 'psyBatalHp', !!p.hpTerisi),
          'Dipakai untuk masuk bersama password, dan untuk kode lupa password lewat WhatsApp.');
      }
      // ---- Data tambahan
      if (lainTerkunci) {
        h += kartu('Data tambahan', kisi(baris('Nomor induk / ID BGN', p.nomorInduk) + baris('Email', p.email) + baris('Pendidikan terakhir', p.pendidikan) + baris('Kontak darurat', p.daruratNama) + baris('HP kontak darurat', p.daruratHp)) + tombolUbah('psyUbahLain'),
          'Tersimpan dan terkunci. Gaji staff dibayar langsung oleh BGN, jadi tidak ada data rekening di portal.', true);
      } else {
        h += kartu('Data tambahan',
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' +
          isian('psyInduk', 'Nomor induk / ID BGN', p.nomorInduk || '', 'maxlength="30" autocomplete="off"') +
          isian('psyEmail', 'Email', p.email || '', 'type="email" maxlength="80" autocomplete="off" placeholder="nama@email.com"') +
          isian('psyPend', 'Pendidikan terakhir', p.pendidikan || '', 'maxlength="40" autocomplete="off" placeholder="Contoh: S1 Gizi"') +
          isian('psyDrtNama', 'Nama kontak darurat', p.daruratNama || '', 'maxlength="80" autocomplete="off"') +
          isian('psyDrtHp', 'HP kontak darurat', p.daruratHp || '', 'type="tel" maxlength="16" inputmode="tel" autocomplete="off" placeholder="081234567890"') + '</div>' +
          tombolSimpan('psySimpanLain', 'Simpan data tambahan', 'psyBatalLain', lainAda),
          'Boleh dikosongkan. Gaji staff dibayar langsung oleh BGN, jadi tidak ada data rekening di portal.');
      }
    } else {
      h += '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-bottom:14px;font-size:13px;line-height:1.6;">Akun ini belum memiliki profil staff, jadi data diri dan nomor HP belum bisa diisi di sini. Anda tetap bisa mengganti password di bawah.</div>';
    }
    h += kartu('Ganti password',
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' +
      '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Password lama<input id="psyLama" type="password" autocomplete="current-password" style="' + KOTAK + '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Password baru (minimal 8 karakter)<input id="psyBaru" type="password" autocomplete="new-password" style="' + KOTAK + '"></label>' +
      '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">Ulangi password baru<input id="psyUlang" type="password" autocomplete="new-password" style="' + KOTAK + '"></label></div>' +
      '<div style="margin-top:12px;"><button type="button" class="btn-mini primary" id="psySimpanSandi">Ganti password</button></div>');
    h += kartu('Lupa password?', '<div style="font-size:13px;line-height:1.7;">Di halaman masuk, pilih <b>Lupa password</b>, lalu masukkan <b>nomor HP yang tersimpan di profil ini</b>. Kode 6 angka dikirim lewat WhatsApp (bila fitur WhatsApp sudah diaktifkan Admin). Bila belum aktif atau nomor HP belum diisi, hubungi <b>Super Admin</b> untuk dibuatkan password sementara.</div>');
    root.innerHTML = h;
    pasangAksi(); pasangFoto(); terapkanFoto(); muatFoto();
  }

  function pasangAksi() {
    const p = profil.profil || {}, klik = function (id, fn) { const e = $(id); if (e) e.addEventListener('click', fn); };
    const buka = function (k) { return function () { ubah[k] = true; render(); const f = k === 'diri' ? $('psyNik') : k === 'hp' ? $('psyHp') : $('psyInduk'); if (f) f.focus(); }; };
    const tutup = function (k) { return function () { ubah[k] = false; render(); }; };
    klik('psyUbahDiri', buka('diri')); klik('psyUbahHp', buka('hp')); klik('psyUbahLain', buka('lain'));
    klik('psyBatalDiri', tutup('diri')); klik('psyBatalHp', tutup('hp')); klik('psyBatalLain', tutup('lain'));
    if ($('psyWilayah')) {
      wil = window.SPPGWilayah ? window.SPPGWilayah.pasang($('psyWilayah'), { desa: p.desa, kecamatan: p.kecamatan, kabupaten: p.kabupaten, provinsi: p.provinsi }, { awalan: 'psy' }) : null;
      $('psyJk').addEventListener('click', function (e) { const b = e.target.closest('[data-jk]'); if (!b) return; jk = b.dataset.jk; Array.prototype.forEach.call($('psyJk').children, function (x) { const on = x.dataset.jk === jk; x.setAttribute('aria-pressed', String(on)); x.style.background = on ? '#16324f' : ''; x.style.color = on ? '#fff' : ''; }); });
    }
    klik('psySimpanDiri', function (e) {
      simpanDiTombol(e.currentTarget, async function () {
        const nik = $('psyNik').value.replace(/[\s.\-]/g, '');
        if (!nik) throw new Error('NIK wajib diisi: 16 angka sesuai KTP.');
        if (!/^\d{16}$/.test(nik)) throw new Error('NIK harus 16 angka sesuai KTP.');
        if (wil && wil.pesanKurang()) throw new Error(wil.pesanKurang());
        const w = wil ? wil.ambil() : {};
        return api('simpanProfilStafSaya', Object.assign(dasar(), { nik: nik, tempatLahir: $('psyTempat').value, tanggalLahir: $('psyTanggal').value, jenisKelamin: jk, alamat: $('psyAlamat').value, desa: w.desa || '', kecamatan: w.kecamatan || '', kabupaten: w.kabupaten || '', provinsi: w.provinsi || '' }));
      }, async function () { ubah.diri = false; await segarkan(); });
    });
    klik('psySimpanHp', function (e) {
      simpanDiTombol(e.currentTarget, async function () {
        const hp = $('psyHp').value.trim(); if (!hp) throw new Error('Isi nomor HP dulu.');
        if (!p.nikTerisi) throw new Error('Isi dan simpan NIK dulu di bagian Data diri.');
        return api('simpanProfilStafSaya', Object.assign(dasar(), { nomorHp: hp, password: ambilNilai('psyHpSandi') }));
      }, async function () { ubah.hp = false; await segarkan(); });
    });
    klik('psySimpanLain', function (e) {
      simpanDiTombol(e.currentTarget, async function () {
        if (!p.nikTerisi) throw new Error('Isi dan simpan NIK dulu di bagian Data diri.');
        return api('simpanProfilStafSaya', Object.assign(dasar(), { nomorInduk: $('psyInduk').value, email: $('psyEmail').value, pendidikan: $('psyPend').value, daruratNama: $('psyDrtNama').value, daruratHp: $('psyDrtHp').value }));
      }, async function () { ubah.lain = false; await segarkan(); });
    });
    klik('psySimpanSandi', function (e) {
      simpanDiTombol(e.currentTarget, async function () {
        if ($('psyBaru').value !== $('psyUlang').value) throw new Error('Ulangi password baru: kedua isian belum sama.');
        return api('gantiPasswordPengelola', { passwordLama: $('psyLama').value, passwordBaru: $('psyBaru').value });
      }, async function () { $('psyLama').value = ''; $('psyBaru').value = ''; $('psyUlang').value = ''; });
    });
  }

  async function segarkan() {
    try { profil = await apiGet('getProfilStafSaya', { token: token() }); } catch (e) { /* tetap tampilkan yang ada */ }
    const d = $('psyPengingat'); if (d && !profil.perluLengkapi) d.remove();
    render();
  }

  // ---------------------------------------------------------------- pemicu
  const tab = document.querySelector('[data-panel="panelProfilSaya"]');
  if (tab) tab.addEventListener('click', muatPanel);
  window.addEventListener('sppg-admin-ready', function () { sudahCek = false; setTimeout(periksaSetelahMasuk, 300); });
  if (window.sppgAdminToken) setTimeout(periksaSetelahMasuk, 300);
})();

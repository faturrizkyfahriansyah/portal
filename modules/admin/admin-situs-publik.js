// SPPG JEUNGJING — ADMIN: Website Publik › Isian Website dan Kabar (25 Nov 2026). BARU, aditif (tidak mengubah admin-website-publik.js).
// Isian: Tentang Kami, Yayasan/Mitra, jam, kontak, sosial media (setSitusKonten). Kabar: tambah/ubah/terbitkan/arsipkan (simpanKabar, setStatusKabar).
// Yang tidak diisi tidak tampil di website. Struktur personel, menu, penerima manfaat, dan lokasi diambil otomatis dari portal.
(function () {
  'use strict';
  const panel = document.getElementById('panelWebsitePublik'); if (!panel) return;
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const KAT = [['PENGUMUMAN', 'Pengumuman'], ['KEGIATAN', 'Kegiatan'], ['LAYANAN', 'Layanan']], STAT = [['TERBIT', 'Terbit'], ['DRAFT', 'Draf (belum tampil)'], ['ARSIP', 'Arsip (disembunyikan)']];
  let data = null, sudah = false;
  const inp = 'width:100%;padding:8px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;';

  function kerangka() {
    const w = document.createElement('div'); w.id = 'situsAdmin';
    w.innerHTML = '<details class="panel-block" style="margin-top:14px;" open><summary style="cursor:pointer;font-weight:700;color:var(--color-navy);font-size:14px;">Isian Website: Tentang Kami, jam, kontak, sosial media</summary>' +
      '<div style="font-size:12.5px;color:var(--color-text-muted,#55606f);margin:8px 0;">Yang dikosongkan tidak tampil di website. Struktur personel, menu, penerima manfaat, dan titik peta otomatis dari portal (peta mengikuti koordinat di Master Lokasi).</div>' +
      '<div id="situsField">Memuat…</div></details>' +
      '<details class="panel-block" style="margin-top:14px;"><summary style="cursor:pointer;font-weight:700;color:var(--color-navy);font-size:14px;">Kabar dan pengumuman</summary><div id="situsKabar" style="margin-top:10px;">Memuat…</div></details>';
    const daftar = document.getElementById('wpuDaftarHalaman'); if (daftar && daftar.parentNode) daftar.parentNode.insertBefore(w, daftar); else panel.appendChild(w);
  }
  /* tombol memberi tahu prosesnya di tempat: Menyimpan… -> Tersimpan / Belum tersimpan + alasan di bawahnya */
  async function simpanDiTombol(btn, kerja, teksOk, lanjut) {
    btn.setAttribute('data-ts-skip', '1'); const asli = btn.dataset.asli || btn.textContent; btn.dataset.asli = asli;
    let m = btn.parentElement.querySelector('.sa-pesan'); if (!m) { m = document.createElement('div'); m.className = 'sa-pesan'; m.setAttribute('role', 'alert'); m.style.cssText = 'font-size:13px;font-weight:600;color:#b23a3a;margin-top:6px;'; btn.parentElement.appendChild(m); }
    m.textContent = ''; btn.disabled = true; btn.style.cssText = 'opacity:1;background:#55606f;color:#fff;border-color:#55606f;'; btn.textContent = 'Menyimpan…';
    try {
      await kerja();
      btn.style.cssText = 'opacity:1;background:#1f7a3f;color:#fff;border-color:#1f7a3f;'; btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"><path d="M5 12l5 5 9-10"/></svg>'; btn.appendChild(document.createTextNode(teksOk || 'Tersimpan'));
      await new Promise(function (r) { setTimeout(r, 600); });
      btn.disabled = false; btn.style.cssText = ''; btn.textContent = asli; if (lanjut) await lanjut();
    } catch (e) { btn.disabled = false; btn.style.cssText = 'background:#b23a3a;color:#fff;border-color:#b23a3a;'; btn.textContent = 'Belum tersimpan. Ketuk untuk coba lagi'; m.textContent = e.message || 'Gagal menyimpan.'; }
  }
  function renderField() {
    const per = {}; data.field.forEach(function (f) { (per[f.kelompok] = per[f.kelompok] || []).push(f); });
    $f('situsField').innerHTML = Object.keys(per).map(function (k) {
      return '<div style="font-weight:700;font-size:13px;margin:14px 0 6px;color:var(--color-navy);">' + esc(k) + '</div>' + per[k].map(function (f) {
        const kontrol = f.panjang ? '<textarea data-situs="' + f.kunci + '" rows="3" maxlength="1500" style="' + inp + '">' + esc(f.isi) + '</textarea>' : '<input data-situs="' + f.kunci + '" value="' + esc(f.isi) + '" maxlength="300" style="' + inp + '">';
        return '<div style="margin-bottom:10px;"><label style="font-size:12.5px;font-weight:600;display:block;margin-bottom:3px;">' + esc(f.label) + '</label>' + kontrol +
          '<div style="font-size:11.5px;color:var(--color-text-muted,#55606f);margin-top:2px;">' + esc(f.bantuan) + (f.terisiDariIsianLama ? ' Saat ini memakai isian lama; simpan untuk menetapkannya.' : '') + '</div>' +
          '<div style="margin-top:6px;"><button class="btn-mini primary" type="button" data-simpan="' + f.kunci + '">Simpan</button></div></div>';
      }).join('');
    }).join('');
    $f('situsField').querySelectorAll('button[data-simpan]').forEach(function (b) {
      b.addEventListener('click', function () {
        const kunci = b.dataset.simpan, el = $f('situsField').querySelector('[data-situs="' + kunci + '"]');
        simpanDiTombol(b, function () { return api('setSitusKonten', { kunci: kunci, isi: el.value }); }, 'Tersimpan');
      });
    });
  }
  const $f = function (id) { return document.getElementById(id); };
  function formKabar(k) {
    k = k || { id: '', judul: '', isi: '', tanggal: new Date().toISOString().slice(0, 10), kategori: 'PENGUMUMAN', status: 'TERBIT' };
    const opsi = function (arr, v) { return arr.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); };
    $f('sKabarForm').innerHTML = '<div class="admin-stat-card" style="padding:12px;text-align:left;margin:10px 0;"><b>' + (k.id ? 'Ubah kabar' : 'Kabar baru') + '</b>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:10px 0;">' +
      '<label style="font-size:12px;">Judul *<input id="kbJudul" maxlength="120" value="' + esc(k.judul) + '" style="' + inp + '"></label>' +
      '<label style="font-size:12px;">Tanggal<input id="kbTgl" type="date" value="' + esc(k.tanggal) + '" style="' + inp + '"></label>' +
      '<label style="font-size:12px;">Jenis<select id="kbKat" style="' + inp + '">' + opsi(KAT, k.kategori) + '</select></label>' +
      '<label style="font-size:12px;">Status<select id="kbStat" style="' + inp + '">' + opsi(STAT, k.status) + '</select></label></div>' +
      '<label style="font-size:12px;">Isi<textarea id="kbIsi" rows="4" maxlength="2000" style="' + inp + '">' + esc(k.isi) + '</textarea></label>' +
      '<div style="margin-top:10px;"><button class="btn-mini primary" id="kbSimpan" type="button">Simpan</button> <button class="btn-mini" id="kbBatal" type="button">Batal</button></div></div>';
    $f('kbBatal').addEventListener('click', function () { $f('sKabarForm').innerHTML = ''; });
    $f('kbSimpan').addEventListener('click', function () {
      simpanDiTombol($f('kbSimpan'), function () { return api('simpanKabar', { id: k.id, judul: $f('kbJudul').value, isi: $f('kbIsi').value, tanggal: $f('kbTgl').value, kategori: $f('kbKat').value, status: $f('kbStat').value }); }, 'Kabar tersimpan', muat);
    });
  }
  function renderKabar() {
    $f('situsKabar').innerHTML = '<button class="btn-mini primary" id="kbBaru" type="button">+ Kabar baru</button><div id="sKabarForm"></div>' +
      '<div class="table-wrap" style="margin-top:10px;"><table><thead><tr><th>Tanggal</th><th>Judul</th><th>Jenis</th><th>Status</th><th></th></tr></thead><tbody>' +
      (data.kabar.length ? data.kabar.map(function (k) { return '<tr><td>' + esc(k.tanggal) + '</td><td>' + esc(k.judul) + '</td><td>' + esc(k.kategori) + '</td><td>' + esc(k.status) + '</td><td style="white-space:nowrap;"><button class="btn-mini" data-ubah="' + esc(k.id) + '" type="button">Ubah</button> ' +
        (k.status === 'TERBIT' ? '<button class="btn-mini" data-arsip="' + esc(k.id) + '" type="button">Arsipkan</button>' : '<button class="btn-mini" data-terbit="' + esc(k.id) + '" type="button">Terbitkan</button>') + '</td></tr>'; }).join('')
        : '<tr><td colspan="5"><div class="empty-state">Belum ada kabar. Bagian Kabar di website tampil bila ada yang terbit.</div></td></tr>') + '</tbody></table></div>';
    $f('kbBaru').addEventListener('click', function () { formKabar(null); });
    $f('situsKabar').querySelector('tbody').addEventListener('click', function (e) {
      const b = e.target.closest('button'); if (!b) return;
      const id = b.dataset.ubah || b.dataset.arsip || b.dataset.terbit, k = data.kabar.filter(function (x) { return x.id === id; })[0]; if (!k) return;
      if (b.dataset.ubah) { formKabar(k); return; }
      simpanDiTombol(b, function () { return api('setStatusKabar', { id: id, status: b.dataset.arsip ? 'ARSIP' : 'TERBIT' }); }, b.dataset.arsip ? 'Diarsipkan' : 'Diterbitkan', muat);
    });
  }
  async function muat() {
    try { data = await apiGet('getSitusAdmin', { token: ambilSesiAdmin().token }); renderField(); renderKabar(); }
    catch (e) { const t = '<div class="empty-state" style="color:#c0392b;">' + esc(e.message || 'Gagal memuat.') + '</div>'; $f('situsField').innerHTML = t; $f('situsKabar').innerHTML = t; }
  }
  const tombol = document.querySelector('[data-panel="panelWebsitePublik"]');
  if (tombol) tombol.addEventListener('click', function () { if (sudah) return; sudah = true; kerangka(); muat(); });
})();

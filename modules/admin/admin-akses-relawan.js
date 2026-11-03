// SPPG JEUNGJING — ADMIN: Manajemen Hak Akses › Akses Per Relawan (SIPENDOK, SIPOGIM, SIPRES QR). BARU 4 Nov 2026.
// Ketiga aplikasi dibuka TANPA login. Tombolnya tampil di portal semua relawan; hanya relawan yang diberi akses di sini yang bisa membukanya.
// Backend: AksesRelawanModul.gs (getAksesRelawanModul, simpanAksesRelawanModul). Dibaca getAksesModulSaya untuk gembok di sidebar relawan.
(function () {
  const panel = document.getElementById('panelManajemenHakAkses'); if (!panel) return;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  let data = null, modul = 'SIPENDOK', pending = {}, sudah = false;

  function pesan(t, g) { const el = $('akrPesan'); if (el) { el.textContent = t || ''; el.style.color = g ? '#c0392b' : '#2e7d32'; } }
  function kerangka() {
    const kotak = document.createElement('div'); kotak.id = 'akrRoot'; kotak.className = 'admin-stat-card'; kotak.style.cssText = 'padding:16px;margin-top:18px;text-align:left;';
    kotak.innerHTML = '<h2 style="font-size:15px;margin:0 0 4px;">Akses Per Relawan — SIPENDOK · SIPOGIM · SIPRES QR</h2>' +
      '<p style="font-size:12.5px;margin:0 0 10px;color:var(--color-text-muted,#55606f);">Ketiga aplikasi ini dibuka <b>tanpa login</b>. Tombolnya tampil di portal <b>semua</b> relawan, tetapi hanya relawan yang dicentang di bawah yang bisa membukanya; yang lain melihat gembok. (Ini mengatur pintu di portal, bukan menutup aplikasi bagi yang sudah tahu alamat langsungnya.)</p>' +
      '<div id="akrTab" class="filter-bar" style="flex-wrap:wrap;"></div>' +
      '<div class="filter-bar" style="flex-wrap:wrap;"><select id="akrDivisi" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;"></select><input id="akrCari" placeholder="Cari nama…" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;">' +
      '<button class="btn-mini" id="akrSemua" type="button">Centang semua yang tampil</button><button class="btn-mini" id="akrKosong" type="button">Kosongkan semua yang tampil</button></div>' +
      '<div id="akrInfo" style="font-size:12.5px;margin:6px 0;"></div><div class="table-wrap" style="max-height:420px;overflow:auto;"><table><thead><tr><th style="width:44px;">Akses</th><th>Nama</th><th>Divisi</th><th></th></tr></thead><tbody id="akrTbody"></tbody></table></div>' +
      '<div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><button class="btn-mini primary" id="akrSimpan" type="button" disabled>Simpan perubahan</button><span id="akrPesan" style="font-size:13px;"></span></div>';
    panel.appendChild(kotak);
    $('akrTab').addEventListener('click', function (e) { const b = e.target.closest('button[data-m]'); if (b) { modul = b.dataset.m; gambar(); } });
    $('akrDivisi').addEventListener('change', gambarTabel); $('akrCari').addEventListener('input', gambarTabel);
    $('akrSemua').addEventListener('click', function () { aturTampil(true); }); $('akrKosong').addEventListener('click', function () { aturTampil(false); });
    $('akrTbody').addEventListener('change', function (e) { const c = e.target.closest('input[data-id]'); if (c) { setPending(c.dataset.id, c.checked); gambarInfo(); } });
    $('akrSimpan').addEventListener('click', simpan);
  }
  const awal = function (id) { const r = data.relawan.filter(function (x) { return x.id === id; })[0]; return r ? !!r.akses[modul] : false; };
  function nilai(id) { const p = pending[modul] || {}; return Object.prototype.hasOwnProperty.call(p, id) ? p[id] : awal(id); }
  function setPending(id, v) { pending[modul] = pending[modul] || {}; if (v === awal(id)) delete pending[modul][id]; else pending[modul][id] = v; }
  const jumlahUbah = function (k) { return Object.keys(pending[k] || {}).length; };
  function tampil() {
    const dv = $('akrDivisi').value, q = $('akrCari').value.trim().toLowerCase();
    return data.relawan.filter(function (r) { return (!dv || r.divisi === dv) && (!q || String(r.nama).toLowerCase().indexOf(q) >= 0); });
  }
  function aturTampil(v) { tampil().forEach(function (r) { setPending(r.id, v); }); gambarTabel(); }
  function gambar() {
    $('akrTab').innerHTML = data.modul.map(function (m) { const u = jumlahUbah(m.kode); return '<button class="btn-mini' + (m.kode === modul ? ' primary' : '') + '" data-m="' + m.kode + '" type="button">' + esc(m.nama.split(' — ')[0].replace('SIPRES_QR', 'SIPRES QR')) + ' (' + m.jumlah + ')' + (u ? ' •' : '') + '</button>'; }).join('');
    const cur = $('akrDivisi').value; $('akrDivisi').innerHTML = '<option value="">Semua divisi</option>' + data.divisi.map(function (d) { return '<option value="' + esc(d) + '"' + (d === cur ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('');
    gambarTabel();
  }
  function gambarInfo() {
    const m = data.modul.filter(function (x) { return x.kode === modul; })[0], dipilih = data.relawan.filter(function (r) { return nilai(r.id); }).length, u = jumlahUbah(modul);
    $('akrInfo').innerHTML = '<b>' + esc(m.nama) + '</b> — ' + esc(m.deskripsi) + '<br>' + dipilih + ' dari ' + data.jumlahRelawan + ' relawan aktif punya akses' + (u ? ' · <span style="color:#e65100;">' + u + ' perubahan belum disimpan</span>' : '');
    $('akrSimpan').disabled = u === 0; $('akrSimpan').textContent = u ? 'Simpan ' + u + ' perubahan' : 'Simpan perubahan';
    $('akrTab').innerHTML = data.modul.map(function (x) { const n = jumlahUbah(x.kode); return '<button class="btn-mini' + (x.kode === modul ? ' primary' : '') + '" data-m="' + x.kode + '" type="button">' + esc(x.nama.split(' — ')[0]) + ' (' + x.jumlah + ')' + (n ? ' •' : '') + '</button>'; }).join('');
  }
  function gambarTabel() {
    const list = tampil();
    $('akrTbody').innerHTML = list.length ? list.map(function (r) {
      const ubah = (pending[modul] || {}).hasOwnProperty(r.id);
      return '<tr data-row="' + esc(r.id) + '"><td><input type="checkbox" data-id="' + esc(r.id) + '"' + (nilai(r.id) ? ' checked' : '') + '></td><td>' + esc(r.nama) + '</td><td>' + esc(r.divisi) + '</td><td style="font-size:11.5px;color:#e65100;">' + (ubah ? 'diubah' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="4"><div class="empty-state">Tidak ada relawan yang cocok.</div></td></tr>';
    gambarInfo();
  }
  async function simpan() {
    const p = pending[modul] || {}, beri = Object.keys(p).filter(function (k) { return p[k] === true; }), cabut = Object.keys(p).filter(function (k) { return p[k] === false; });
    if (!beri.length && !cabut.length) return;
    try {
      pesan('Menyimpan…'); const h = await api('simpanAksesRelawanModul', { kodeModul: modul, beri: beri, cabut: cabut });
      delete pending[modul]; data = await api('getAksesRelawanModul'); gambar(); pesan('Tersimpan: ' + h.diberi + ' diberi akses, ' + h.dicabut + ' dicabut.');
    } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
  }
  async function muat() {
    try { kerangka(); data = await api('getAksesRelawanModul'); modul = data.modul[0].kode; gambar(); }
    catch (err) { const r = $('akrRoot'); if (r) r.innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat akses relawan.') + '</div>'; }
  }
  const tombol = document.querySelector('[data-panel="panelManajemenHakAkses"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudah) { sudah = true; muat(); } });
})();

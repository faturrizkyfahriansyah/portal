// admin-master-tarif.js — Master Tarif dengan TANGGAL BERLAKU (ditulis ulang 4 Nov 2026, keputusan Admin 3 Nov).
// Tarif harian berlaku MULAI tanggal tertentu dan dipakai Rekap Mingguan (tarif x hari hadir). Banyak relawan bisa
// diubah sekaligus lalu disimpan sekali. Riwayat tarif (termasuk riwayat per periode lama) bisa dilihat per relawan.
// Backend: MasterTarif.gs (getMasterTarifAdmin, simpanTarifBerlakuAdmin, getRiwayatTarifAdmin).
// 4 Nov 2026: menu ini memuat 6 tarif (tab): Relawan per hari [Portal] + Pagu Bahan Baku, Sewa Fasilitas, Operasional, PIC Posyandu, PIC Sekolah
// [database SIPANDU baru: SipanduTarifV2.gs]. Semua bertanggal berlaku.
(function () {
  const root = document.getElementById('mtRoot');
  if (!root) return;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const rp = function (n) { return n === null || n === undefined ? '' : 'Rp' + Number(n).toLocaleString('id-ID'); };
  const z = function (n) { return String(n).padStart(2, '0'); };
  const isoLokal = function (d) { return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const geser = function (iso, n) { const p = iso.split('-').map(Number); return isoLokal(new Date(p[0], p[1] - 1, p[2] + n)); };
  const tglIndo = function (iso) { return iso ? iso.split('-').reverse().join('/') : ''; };
  const senenDepan = function () { const d = new Date(); d.setDate(d.getDate() + (8 - (d.getDay() || 7))); return isoLokal(d); };   // Senin berikutnya
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  let data = [], tanggalLihat = isoLokal(new Date());

  function kerangka() {
    $('mtIsi').innerHTML =
      '<div class="admin-stat-card" style="padding:12px;text-align:left;margin-bottom:12px;font-size:13px;line-height:1.55;">' +
      'Tarif harian berlaku <b>mulai tanggal yang Anda pilih</b> dan dikali jumlah hari hadir pada <b>Rekap Mingguan</b>. Minggu yang sudah lewat <b>tidak berubah</b> kecuali Anda memilih tanggal berlaku yang sudah lewat (akan diminta konfirmasi).</div>' +
      '<div class="filter-bar"><input id="mtCari" placeholder="Cari nama relawan..." style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;min-width:200px;">' +
      '<select id="mtDivisi"><option value="">Semua Divisi</option></select>' +
      '<label style="font-size:12px;">Tarif yang tampil berlaku pada <input type="date" id="mtLihat"></label></div>' +
      '<div class="filter-bar" style="background:var(--color-surface,#f6f8fb);padding:10px;border-radius:10px;">' +
      '<label style="font-size:13px;font-weight:600;">Tarif BARU berlaku mulai <input type="date" id="mtBerlaku"></label>' +
      '<label style="font-size:12px;">Isi semua yang tampil: <input type="number" id="mtMassal" min="0" step="1000" placeholder="nominal" style="width:110px;"></label>' +
      '<button class="btn-mini" id="mtTerapkan" type="button">Terapkan ke yang tampil</button>' +
      '<input id="mtKet" placeholder="Keterangan (opsional)" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;min-width:170px;"></div>' +
      '<div id="mtPesan" style="font-size:13px;margin:8px 0;"></div>' +
      '<div class="table-wrap"><table class="tabel-kolom-beku-3"><thead><tr><th>Nama</th><th>Divisi</th><th>Tarif saat ini</th><th>Tarif baru (Rp/hari)</th><th></th></tr></thead><tbody id="mtTbody"></tbody></table></div>' +
      '<div style="margin:14px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><button class="btn-mini primary" id="mtSimpan" type="button" disabled>Simpan perubahan</button><span id="mtHitung" style="font-size:13px;"></span></div>';
    $('mtLihat').value = tanggalLihat; $('mtBerlaku').value = senenDepan();
    $('mtCari').addEventListener('input', isiTabel); $('mtDivisi').addEventListener('change', isiTabel);
    $('mtLihat').addEventListener('change', function () { if ($('mtLihat').value) { tanggalLihat = $('mtLihat').value; muat(); } });
    $('mtTerapkan').addEventListener('click', terapkanMassal); $('mtSimpan').addEventListener('click', simpan);
    $('mtTbody').addEventListener('input', hitungPerubahan);
    $('mtTbody').addEventListener('click', function (e) { const b = e.target.closest('button[data-riw]'); if (b) bukaRiwayat(b.dataset.riw, b.closest('tr')); });
  }
  function pesan(t, galat) { const el = $('mtPesan'); if (el) { el.textContent = t || ''; el.style.color = galat ? '#c0392b' : '#2e7d32'; } }

  function terlihat() {
    const kata = $('mtCari').value.toLowerCase(), dv = $('mtDivisi').value;
    return data.filter(function (r) { return (!dv || r.divisi === dv) && (!kata || r.namaRelawan.toLowerCase().indexOf(kata) >= 0); });
  }
  function isiTabel() {
    const baris = terlihat();
    $('mtTbody').innerHTML = baris.length ? baris.map(function (r) {
      const info = r.tarifHarian === null ? '<span style="color:#c0392b;">belum diatur</span>' :
        '<b>' + rp(r.tarifHarian) + '</b><div style="font-size:11px;color:var(--color-text-muted,#55606f);">' + (r.berlakuSejak ? 'sejak ' + tglIndo(r.berlakuSejak) : 'sejak awal') + (r.sumber === 'RIWAYAT_PERIODE' ? ' · riwayat periode' : '') + '</div>';
      const depan = r.tarifMendatang ? '<div style="font-size:11px;color:#e65100;">→ ' + rp(r.tarifMendatang.tarif) + ' mulai ' + tglIndo(r.tarifMendatang.tanggal) + '</div>' : '';
      return '<tr data-id="' + esc(r.idRelawan) + '"><td>' + esc(r.namaRelawan) + '</td><td>' + esc(r.divisi) + '</td><td>' + info + depan + '</td>' +
        '<td><input type="number" min="0" step="1000" data-id="' + esc(r.idRelawan) + '" data-awal="' + (r.tarifHarian === null ? '' : r.tarifHarian) + '" value="" placeholder="' + (r.tarifHarian === null ? 'isi tarif' : 'tetap') + '" style="width:120px;padding:6px;border:1px solid var(--color-border,#d5dbe3);border-radius:6px;"></td>' +
        '<td><button class="btn-mini" data-riw="' + esc(r.idRelawan) + '" type="button">Riwayat</button></td></tr>';
    }).join('') : '<tr><td colspan="5"><div class="empty-state">Tidak ada relawan yang cocok.</div></td></tr>';
    hitungPerubahan();
  }
  function perubahan() {
    const hasil = [];
    $('mtTbody').querySelectorAll('input[data-id]').forEach(function (el) {
      const v = el.value.trim(); if (v === '') return;
      if (v !== el.dataset.awal) hasil.push({ idRelawan: el.dataset.id, tarifHarian: v });
    });
    return hasil;
  }
  function hitungPerubahan() {
    const n = perubahan().length;
    $('mtHitung').textContent = n ? n + ' relawan akan diubah, berlaku mulai ' + tglIndo($('mtBerlaku').value) + '.' : 'Isi kolom "Tarif baru" pada relawan yang berubah.';
    $('mtSimpan').disabled = n === 0;
    $('mtSimpan').textContent = n ? 'Simpan ' + n + ' perubahan' : 'Simpan perubahan';
  }
  function terapkanMassal() {
    const v = $('mtMassal').value.trim();
    if (v === '') { pesan('Isi nominal dulu.', true); return; }
    $('mtTbody').querySelectorAll('input[data-id]').forEach(function (el) { el.value = v; });
    hitungPerubahan(); pesan('Nominal diisi ke ' + terlihat().length + ' relawan yang tampil. Periksa lalu klik Simpan.');
  }
  async function simpan() {
    const items = perubahan(), tgl = $('mtBerlaku').value;
    if (!tgl) { pesan('Pilih tanggal berlaku dulu.', true); return; }
    const kirim = function (surut) { return api('simpanTarifBerlakuAdmin', { tanggalBerlaku: tgl, keterangan: $('mtKet').value, items: items, konfirmasiSurut: surut === true }); };
    try {
      pesan('Menyimpan…'); let h;
      try { h = await kirim(false); }
      catch (err) {
        if (String(err.message || '').indexOf('BERLAKU_SURUT') < 0) throw err;
        if (!confirm(String(err.message).replace('BERLAKU_SURUT: ', '') + '\n\nLanjutkan?')) { pesan('Dibatalkan.'); return; }
        h = await kirim(true);
      }
      await muat(true);
      pesan('Tersimpan: ' + h.baru + ' baru, ' + h.diperbarui + ' diperbarui, ' + h.dilewati + ' dilewati (tarif sudah sama). Berlaku mulai ' + tglIndo(h.tanggalBerlaku) + '.');
    } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
  }
  async function bukaRiwayat(id, tr) {
    const ada = tr.nextElementSibling; if (ada && ada.dataset.riwayatDari === id) { ada.remove(); return; }
    try {
      const h = await api('getRiwayatTarifAdmin', { idRelawan: id });
      const baris = document.createElement('tr'); baris.dataset.riwayatDari = id;
      baris.innerHTML = '<td colspan="5" style="background:var(--color-surface,#f6f8fb);font-size:12px;">' + (h.riwayat.length ? h.riwayat.map(function (r) {
        return '<div>' + (r.tanggalBerlaku ? 'Mulai ' + tglIndo(r.tanggalBerlaku) : 'Sejak awal') + ': <b>' + rp(r.tarifHarian) + '</b> <span style="color:var(--color-text-muted,#55606f);">(' + (r.sumber === 'MASTER' ? 'Master Tarif' : 'riwayat periode ' + esc(r.keterangan)) + (r.keterangan && r.sumber === 'MASTER' ? ' — ' + esc(r.keterangan) : '') + (r.dibuatOleh ? ' · ' + esc(r.dibuatOleh) : '') + ')</span></div>';
      }).join('') : 'Belum ada riwayat tarif.') + '</td>';
      tr.parentNode.insertBefore(baris, tr.nextSibling);
    } catch (err) { pesan(err.message || 'Gagal memuat riwayat.', true); }
  }
  async function muat(diam) {
    try {
      if (!diam) $('mtTbody').innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat data...</div></td></tr>';
      const h = await api('getMasterTarifAdmin', { tanggal: tanggalLihat });
      data = h.data;
      const dv = Array.from(new Set(data.map(function (r) { return r.divisi; }).filter(Boolean))).sort(), pilih = $('mtDivisi').value;
      $('mtDivisi').innerHTML = '<option value="">Semua Divisi</option>' + dv.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('');
      if (dv.indexOf(pilih) >= 0) $('mtDivisi').value = pilih;
      isiTabel();
      if (h.jumlahTanpaTarif) pesan(h.jumlahTanpaTarif + ' relawan aktif belum punya tarif pada tanggal ini.', true);
    } catch (err) { $('mtTbody').innerHTML = '<tr><td colspan="5"><div class="empty-state" style="color:#c0392b;">' + esc(err.message) + '</div></td></tr>'; }
  }

  // ======================= TAB TARIF LAIN (SIPANDU) =======================
  const TAB = [['RELAWAN', 'Relawan (per hari)'], ['PORSI_BAHAN_BAKU', 'Pagu Bahan Baku'], ['PORSI_SEWA_FASILITAS', 'Sewa Fasilitas'], ['PORSI_OPERASIONAL', 'Operasional'], ['PIC_POSYANDU', 'PIC Posyandu'], ['PIC_SEKOLAH', 'PIC Sekolah']];
  const LABEL = { KECIL: 'Porsi Kecil (PK + Balita)', BESAR: 'Porsi Besar (PB + Ibu Hamil + Ibu Menyusui)', PER_PORSI: 'Per porsi' };
  let tabAktif = 'RELAWAN', dataLain = null;
  const st = 'padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;';

  function bentukTab() {
    root.innerHTML = '<div class="filter-bar" id="mtTabs" style="flex-wrap:wrap;">' + TAB.map(function (t) { return '<button class="btn-mini' + (t[0] === tabAktif ? ' primary' : '') + '" data-tab="' + t[0] + '" type="button">' + t[1] + '</button>'; }).join('') + '</div><div id="mtIsi"></div>';
    $('mtTabs').addEventListener('click', function (e) {
      const b = e.target.closest('button[data-tab]'); if (!b) return;
      tabAktif = b.dataset.tab; bentukTab();
      if (tabAktif === 'RELAWAN') { kerangka(); muat(); } else tabLain(tabAktif);
    });
  }
  function kartuBelum(teks) {
    return '<div class="admin-stat-card accent-warning" style="padding:16px;text-align:left;"><b>Database SIPANDU baru belum disambungkan</b><div style="font-size:13px;margin-top:6px;">' + esc(teks || '') +
      ' Tarif ini disimpan di database SIPANDU. Sambungkan lewat menu SIPANDU › Master Instansi &amp; PIC (panduan langkahnya ada di sana), lalu muat ulang.</div></div>';
  }
  async function tabLain(kat) {
    const isi = $('mtIsi'); isi.innerHTML = '<div class="empty-state">Memuat…</div>';
    try {
      const status = await api('getStatusSipanduV2');
      if (!status.terhubung) { isi.innerHTML = kartuBelum(status.pesan); return; }
      dataLain = await api('getMasterTarifLainV2', { tanggal: tanggalLihat });
      renderLain(kat);
    } catch (err) { isi.innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div>'; }
  }
  function totalPerPorsi() {
    const hasil = {};
    ['KECIL', 'BESAR'].forEach(function (kc) {
      let tot = 0, lengkap = true;
      ['PORSI_BAHAN_BAKU', 'PORSI_SEWA_FASILITAS', 'PORSI_OPERASIONAL'].forEach(function (k) { const b = dataLain.kategori[k].baris.filter(function (x) { return x.kunci === kc; })[0]; if (!b || b.tarif === null) lengkap = false; else tot += b.tarif; });
      hasil[kc] = lengkap ? tot : null;
    });
    return hasil;
  }
  function renderLain(kat) {
    const k = dataLain.kategori[kat], sekolah = !!k.jenjang, satuan = k.satuan === 'PER_HARI' ? 'per hari' : 'per porsi';
    const info = (kat.indexOf('PORSI_') === 0)
      ? (function () { const t = totalPerPorsi(); return '<div class="admin-stat-card" style="padding:10px 12px;text-align:left;margin-bottom:10px;font-size:13px;">Total pagu per porsi (bahan baku + sewa fasilitas + operasional) pada ' + tglIndo(dataLain.tanggal) + ': <b>Porsi Kecil ' + (t.KECIL === null ? 'belum lengkap' : rp(t.KECIL)) + '</b> · <b>Porsi Besar ' + (t.BESAR === null ? 'belum lengkap' : rp(t.BESAR)) + '</b></div>'; })()
      : (kat === 'PIC_SEKOLAH' ? '<div class="admin-stat-card" style="padding:10px 12px;text-align:left;margin-bottom:10px;font-size:13px;">Insentif PIC sekolah dihitung <b>per hari</b> menurut <b>jumlah siswa</b> instansi (diisi di Master Instansi). Tepat 100 siswa masuk jenjang 100–500. Jenjang tanpa tarif = <b>belum ditetapkan</b> (tidak dikarang).</div>'
        : '<div class="admin-stat-card" style="padding:10px 12px;text-align:left;margin-bottom:10px;font-size:13px;">Insentif PIC posyandu dihitung <b>per porsi</b> dari paket pada hari BAST terbit.</div>');
    const baris = k.baris.map(function (b) {
      const sekarang = b.tarif === null ? '<span style="color:#c0392b;">belum ditetapkan</span>' : '<b>' + rp(b.tarif) + '</b> <span style="font-size:11px;color:var(--color-text-muted,#55606f);">' + satuan + '</span><div style="font-size:11px;color:var(--color-text-muted,#55606f);">sejak ' + tglIndo(b.berlakuSejak) + '</div>';
      const depan = b.tarifMendatang ? '<div style="font-size:11px;color:#e65100;">→ ' + (b.tarifMendatang.tarif === null ? 'belum ditetapkan' : rp(b.tarifMendatang.tarif)) + ' mulai ' + tglIndo(b.tarifMendatang.tanggal) + '</div>' : '';
      const nama = sekolah ? 'Jenjang ' + esc(b.kunci) : esc(LABEL[b.kunci] || b.kunci);
      const batas = sekolah ? '<td><input type="number" min="0" data-kunci="' + esc(b.kunci) + '" data-f="min" data-awal="' + (b.batasMin === null ? '' : b.batasMin) + '" value="' + (b.batasMin === null ? '' : b.batasMin) + '" style="width:80px;' + st + '"></td><td><input type="number" min="0" data-kunci="' + esc(b.kunci) + '" data-f="maks" data-awal="' + (b.batasMaks === null ? '' : b.batasMaks) + '" value="' + (b.batasMaks === null ? '' : b.batasMaks) + '" placeholder="tanpa batas" style="width:90px;' + st + '"></td>' : '';
      return '<tr data-kunci="' + esc(b.kunci) + '"><td>' + nama + '</td>' + batas + '<td>' + sekarang + depan + '</td>' +
        '<td><input type="number" min="0" step="500" data-kunci="' + esc(b.kunci) + '" data-f="tarif" data-awal="' + (b.tarif === null ? '' : b.tarif) + '" value="" placeholder="' + (b.tarif === null ? 'isi tarif' : 'tetap') + '" style="width:120px;' + st + '"></td>' +
        '<td><button class="btn-mini" data-riw="' + esc(b.kunci) + '" type="button">Riwayat</button></td></tr>';
    }).join('');
    $('mtIsi').innerHTML = info +
      '<div class="filter-bar"><label style="font-size:12px;">Tarif yang tampil berlaku pada <input type="date" id="mlLihat"></label></div>' +
      '<div class="filter-bar" style="background:var(--color-surface,#f6f8fb);padding:10px;border-radius:10px;"><label style="font-size:13px;font-weight:600;">Tarif BARU berlaku mulai <input type="date" id="mlBerlaku"></label>' +
      '<input id="mlKet" placeholder="Keterangan (opsional)" style="' + st + 'min-width:200px;"></div><div id="mlPesan" style="font-size:13px;margin:8px 0;"></div>' +
      '<div class="table-wrap"><table><thead><tr><th>' + (sekolah ? 'Jenjang' : 'Jenis') + '</th>' + (sekolah ? '<th>Siswa dari</th><th>sampai</th>' : '') + '<th>Tarif saat ini</th><th>Tarif baru (Rp ' + satuan + ')</th><th></th></tr></thead><tbody id="mlTbody">' + baris + '</tbody></table></div>' +
      '<div style="margin:14px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><button class="btn-mini primary" id="mlSimpan" type="button" disabled>Simpan perubahan</button><span id="mlHitung" style="font-size:13px;"></span></div>';
    $('mlLihat').value = dataLain.tanggal; $('mlBerlaku').value = senenDepan();
    $('mlLihat').addEventListener('change', function () { if ($('mlLihat').value) { tanggalLihat = $('mlLihat').value; tabLain(kat); } });
    $('mlTbody').addEventListener('input', function () { hitungLain(kat); });
    $('mlBerlaku').addEventListener('change', function () { hitungLain(kat); });
    $('mlSimpan').addEventListener('click', function () { simpanLain(kat); });
    $('mlTbody').addEventListener('click', function (e) { const b = e.target.closest('button[data-riw]'); if (b) riwayatLain(kat, b.dataset.riw, b.closest('tr')); });
    hitungLain(kat);
  }
  function perubahanLain(kat) {
    const k = dataLain.kategori[kat], sekolah = !!k.jenjang, hasil = [];
    k.baris.forEach(function (b) {
      const inp = function (f) { const el = $('mlTbody').querySelector('input[data-kunci="' + b.kunci + '"][data-f="' + f + '"]'); return el ? el.value.trim() : ''; };
      const tarifBaru = inp('tarif'), awalTarif = b.tarif === null ? '' : String(b.tarif);
      const gantiTarif = tarifBaru !== '' && tarifBaru !== awalTarif;
      const gantiBatas = sekolah && (inp('min') !== (b.batasMin === null ? '' : String(b.batasMin)) || inp('maks') !== (b.batasMaks === null ? '' : String(b.batasMaks)));
      if (!gantiTarif && !gantiBatas) return;
      const item = { kunci: b.kunci, tarif: gantiTarif ? tarifBaru : awalTarif };
      if (sekolah) { item.batasMin = inp('min'); item.batasMaks = inp('maks'); }
      hasil.push(item);
    });
    return hasil;
  }
  function hitungLain(kat) {
    const n = perubahanLain(kat).length;
    $('mlHitung').textContent = n ? n + ' baris akan diubah, berlaku mulai ' + tglIndo($('mlBerlaku').value) + '.' : 'Isi kolom "Tarif baru" (atau ubah batas jenjang) pada baris yang berubah.';
    $('mlSimpan').disabled = n === 0; $('mlSimpan').textContent = n ? 'Simpan ' + n + ' perubahan' : 'Simpan perubahan';
  }
  function pesanLain(t, galat) { const el = $('mlPesan'); if (el) { el.textContent = t || ''; el.style.color = galat ? '#c0392b' : '#2e7d32'; } }
  async function simpanLain(kat) {
    const items = perubahanLain(kat), tgl = $('mlBerlaku').value;
    if (!tgl) { pesanLain('Pilih tanggal berlaku dulu.', true); return; }
    const kirim = function (surut) { return api('simpanTarifLainV2', { kategori: kat, tanggalBerlaku: tgl, keterangan: $('mlKet').value, items: items, konfirmasiSurut: surut === true }); };
    try {
      pesanLain('Menyimpan…'); let h;
      try { h = await kirim(false); }
      catch (err) {
        if (String(err.message || '').indexOf('BERLAKU_SURUT') < 0) throw err;
        if (!confirm(String(err.message).replace('BERLAKU_SURUT: ', '') + '\n\nLanjutkan?')) { pesanLain('Dibatalkan.'); return; }
        h = await kirim(true);
      }
      dataLain = await api('getMasterTarifLainV2', { tanggal: tanggalLihat }); renderLain(kat);
      pesanLain('Tersimpan: ' + h.baru + ' baru, ' + h.diperbarui + ' diperbarui, ' + h.dilewati + ' dilewati (sudah sama). Berlaku mulai ' + tglIndo(h.tanggalBerlaku) + '.');
    } catch (err) { pesanLain(err.message || 'Gagal menyimpan.', true); }
  }
  async function riwayatLain(kat, kunci, tr) {
    const ada = tr.nextElementSibling; if (ada && ada.dataset.riwayatDari === kunci) { ada.remove(); return; }
    try {
      const h = await api('getRiwayatTarifLainV2', { kategori: kat, kunci: kunci });
      const baris = document.createElement('tr'); baris.dataset.riwayatDari = kunci;
      baris.innerHTML = '<td colspan="7" style="background:var(--color-surface,#f6f8fb);font-size:12px;">' + (h.riwayat.length ? h.riwayat.map(function (r) {
        return '<div>Mulai ' + tglIndo(r.tanggalBerlaku) + ': <b>' + (r.tarif === null ? 'belum ditetapkan' : rp(r.tarif)) + '</b>' + (r.batasMin !== null ? ' <span style="color:var(--color-text-muted,#55606f);">(siswa ' + r.batasMin + '–' + (r.batasMaks === null ? 'dst' : r.batasMaks) + ')</span>' : '') + (r.keterangan ? ' <span style="color:var(--color-text-muted,#55606f);">— ' + esc(r.keterangan) + '</span>' : '') + (r.dibuatOleh ? ' <span style="color:var(--color-text-muted,#55606f);">· ' + esc(r.dibuatOleh) + '</span>' : '') + '</div>';
      }).join('') : 'Belum ada riwayat.') + '</td>';
      tr.parentNode.insertBefore(baris, tr.nextSibling);
    } catch (err) { pesanLain(err.message || 'Gagal memuat riwayat.', true); }
  }

  bentukTab(); kerangka(); muat();
})();

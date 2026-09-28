// SPPG JEUNGJING — ADMIN: SIRAGA v2 (panelStok)
// Lazy-loaded oleh admin.js saat tab "Stok & Persediaan" pertama kali
// dibuka (lihat admin.js: panelStok: 'admin-stok.js'). Backend sama
// persis dengan siraga.js (relawan) -- SiragaDb.gs dkk, spreadsheet
// terpisah. Halaman ini FULL (Master Data + Hak Akses + Log Aktivitas
// ADA di sini) -- sesuai keputusan: pengaturan SIRAGA hanya di Pengelola.

let sesiAdminStok = null;
let sudahInitAdminStok = false;

function formatRupiahSederhanaAdmin(n) { return Number(n || 0).toLocaleString('id-ID'); }
function tanggalHariIniIsoAdmin() { return new Date().toISOString().slice(0, 10); }
function isoKeDmyTampilanAdmin(iso) { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; }

function badgeClassStatusStokAdmin(status) {
  const peta = { 'AMAN': 'hadir', 'MENDEKATI MINIMUM': 'terlambat', 'DI BAWAH MINIMUM': 'sakit', 'HABIS': 'sakit' };
  return peta[status] || 'belum-absen';
}
function badgeClassStatusExpiredAdmin(status) {
  const peta = { 'AMAN': 'hadir', 'AKAN KEDALUWARSA': 'terlambat', 'KEDALUWARSA': 'sakit' };
  return peta[status] || 'belum-absen';
}
function badgeClassStatusTransaksiAdmin(status) {
  const peta = { 'DRAFT': 'terlambat', 'SELESAI': 'hadir', 'DIBATALKAN': 'tidak-hadir' };
  return peta[status] || 'belum-absen';
}

// ============================================================
// SEARCHABLE DROPDOWN (sama seperti siraga.js relawan)
// ============================================================
function buatSearchableDropdownAdmin(containerId, opts) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <input type="text" class="searchable-dropdown-input" placeholder="${opts.placeholder || 'Cari...'}" autocomplete="off">
    <div class="searchable-dropdown-panel is-hidden"></div>
    <div class="searchable-dropdown-selected is-hidden"></div>
  `;
  const input = container.querySelector('.searchable-dropdown-input');
  const panel = container.querySelector('.searchable-dropdown-panel');
  const selectedBox = container.querySelector('.searchable-dropdown-selected');
  let selectedItem = null;
  let daftarCache = null;

  async function tampilkanPanel(query) {
    if (!daftarCache) { try { daftarCache = await opts.fetchList(''); } catch (e) { panel.innerHTML = `<div class="searchable-dropdown-empty">Gagal memuat data.</div>`; panel.classList.remove('is-hidden'); return; } }
    const q = (query || '').toLowerCase();
    const hasil = daftarCache.filter(it => it.label.toLowerCase().indexOf(q) !== -1);
    if (!hasil.length) {
      panel.innerHTML = `<div class="searchable-dropdown-empty">Tidak ditemukan.</div>`;
    } else {
      panel.innerHTML = hasil.slice(0, 50).map((it, i) => `<button type="button" class="searchable-dropdown-item" data-idx="${i}">${escapeHtml(it.label)}${it.sub ? '<small>' + escapeHtml(it.sub) + '</small>' : ''}</button>`).join('');
      panel.querySelectorAll('.searchable-dropdown-item').forEach((el, i) => { el.addEventListener('click', () => pilihItem(hasil[i])); });
    }
    panel.classList.remove('is-hidden');
  }
  function pilihItem(item) {
    selectedItem = item;
    input.value = '';
    panel.classList.add('is-hidden');
    selectedBox.classList.remove('is-hidden');
    selectedBox.innerHTML = `<span>${escapeHtml(item.label)}</span><button type="button" aria-label="Hapus pilihan">×</button>`;
    selectedBox.querySelector('button').addEventListener('click', () => { selectedItem = null; selectedBox.classList.add('is-hidden'); input.style.display = ''; });
    input.style.display = 'none';
    if (opts.onSelect) opts.onSelect(item);
  }
  input.addEventListener('input', () => tampilkanPanel(input.value));
  input.addEventListener('focus', () => tampilkanPanel(input.value));
  document.addEventListener('click', (e) => { if (!container.contains(e.target)) panel.classList.add('is-hidden'); });

  return {
    getSelected: () => selectedItem,
    reset: () => { selectedItem = null; selectedBox.classList.add('is-hidden'); input.style.display = ''; input.value = ''; },
    invalidateCache: () => { daftarCache = null; }
  };
}

async function fetchBarangUntukDropdownAdmin() {
  const list = await apiPost('getSiragaBarangList', { token: sesiAdminStok.token });
  return list.map(b => ({ id: b.id, label: b.nama, sub: b.kode + ' · Stok: ' + formatRupiahSederhanaAdmin(b.stok) + ' ' + b.satuan, data: b }));
}

// ============================================================
// BARIS ITEM DINAMIS
// ============================================================
let counterBarisItemAdmin = 0;
const registriBarisItemAdmin = {};

function tambahBarisItemAdmin(containerId, jenis) {
  const rowId = 'arow' + (++counterBarisItemAdmin);
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'siraga-item-row';
  div.id = rowId;
  div.innerHTML = `
    <button type="button" class="siraga-item-row-remove" aria-label="Hapus baris">×</button>
    <label class="form-field" style="margin-bottom:8px;"><span class="form-field-label">Barang</span><div class="searchable-dropdown" id="${rowId}-barang"></div></label>
    <div id="${rowId}-batchWrap" style="display:none;margin-bottom:8px;"><label class="form-field"><span class="form-field-label">Batch</span><select id="${rowId}-batch" class="form-field-input"></select></label></div>
    <div id="${rowId}-expiredWrap" style="display:none;">
      <div class="form-field-row" style="margin-bottom:8px;">
        <label class="form-field"><span class="form-field-label">Tanggal Produksi</span><input type="date" id="${rowId}-produksi" class="form-field-input"></label>
        <label class="form-field"><span class="form-field-label">Tanggal Expired</span><input type="date" id="${rowId}-expired" class="form-field-input"></label>
      </div>
    </div>
    <label class="form-field"><span class="form-field-label">Qty</span><input type="number" id="${rowId}-qty" class="form-field-input" min="0.01" step="any"></label>
    <p class="siraga-item-hint" id="${rowId}-hint"></p>
  `;
  container.appendChild(div);
  div.querySelector('.siraga-item-row-remove').addEventListener('click', () => { div.remove(); delete registriBarisItemAdmin[rowId]; });

  const dropdown = buatSearchableDropdownAdmin(rowId + '-barang', {
    placeholder: 'Cari barang...', fetchList: fetchBarangUntukDropdownAdmin,
    onSelect: async (item) => {
      const b = item.data;
      const hint = document.getElementById(rowId + '-hint');
      const batchWrap = document.getElementById(rowId + '-batchWrap');
      const expiredWrap = document.getElementById(rowId + '-expiredWrap');
      if (jenis === 'MASUK') {
        expiredWrap.style.display = b.kelolaBatch || b.kelolaExpired ? 'block' : 'none';
        batchWrap.style.display = 'none';
        hint.textContent = 'Satuan: ' + b.satuan + (b.kelolaBatch || b.kelolaExpired ? ' · Barang ini akan membuat batch baru saat disimpan.' : '');
        hint.className = 'siraga-item-hint';
      } else {
        expiredWrap.style.display = 'none';
        if (b.kelolaBatch) {
          batchWrap.style.display = 'block';
          const selBatch = document.getElementById(rowId + '-batch');
          selBatch.innerHTML = '<option value="">Memuat batch...</option>';
          try {
            const batchList = await apiPost('getSiragaBatchList', { token: sesiAdminStok.token, idBarang: b.id });
            selBatch.innerHTML = !batchList.length ? '<option value="">— Tidak ada batch tersedia —</option>' :
              batchList.map(bt => `<option value="${bt.id}">${bt.nomorBatch} (Exp: ${bt.tanggalExpired || '-'}, Stok: ${formatRupiahSederhanaAdmin(bt.stok)}) ${bt.statusExpired === 'KEDALUWARSA' ? '⚠️ KEDALUWARSA' : bt.statusExpired === 'AKAN KEDALUWARSA' ? '⚠️ Akan Exp' : ''}</option>`).join('');
          } catch (e) { selBatch.innerHTML = '<option value="">Gagal memuat batch</option>'; }
        } else { batchWrap.style.display = 'none'; }
        const warnStok = b.stok <= 0 ? ' ⚠️ STOK HABIS' : (b.statusStok === 'DI BAWAH MINIMUM' ? ' ⚠️ di bawah minimum' : '');
        hint.textContent = 'Stok tersedia: ' + formatRupiahSederhanaAdmin(b.stok) + ' ' + b.satuan + warnStok;
        hint.className = 'siraga-item-hint' + (b.stok <= 0 ? ' warn' : '');
      }
    }
  });
  registriBarisItemAdmin[rowId] = { dropdown, jenis };
  return rowId;
}

function bacaSemuaBarisItemAdmin(containerId) {
  const container = document.getElementById(containerId);
  const items = [];
  Array.from(container.children).forEach(div => {
    const rowId = div.id;
    const reg = registriBarisItemAdmin[rowId];
    if (!reg) return;
    const dipilih = reg.dropdown.getSelected();
    if (!dipilih) throw new Error('Ada baris yang barangnya belum dipilih.');
    const qty = Number(document.getElementById(rowId + '-qty').value);
    if (!qty || qty <= 0) throw new Error('Qty untuk "' + dipilih.label + '" harus diisi lebih dari 0.');
    const item = { idBarang: dipilih.id, qty: qty };
    const batchSel = document.getElementById(rowId + '-batch');
    if (batchSel && batchSel.value) item.idBatch = batchSel.value;
    const produksiEl = document.getElementById(rowId + '-produksi');
    const expiredEl = document.getElementById(rowId + '-expired');
    if (produksiEl && produksiEl.value) item.tanggalProduksi = isoKeDmyTampilanAdmin(produksiEl.value);
    if (expiredEl && expiredEl.value) item.tanggalExpired = isoKeDmyTampilanAdmin(expiredEl.value);
    items.push(item);
  });
  if (!items.length) throw new Error('Minimal harus ada 1 barang.');
  return items;
}
function kosongkanBarisItemAdmin(containerId) {
  document.getElementById(containerId).innerHTML = '';
  Object.keys(registriBarisItemAdmin).forEach(k => delete registriBarisItemAdmin[k]);
}

// ============================================================
// TAB SWITCHING
// ============================================================
const A_STOK_SUB_PANEL = {
  dashboard: 'aStokSubDashboard', barang: 'aStokSubBarang', masuk: 'aStokSubMasuk',
  keluar: 'aStokSubKeluar', transfer: 'aStokSubTransfer', pemusnahan: 'aStokSubPemusnahan',
  opname: 'aStokSubOpname', kartustok: 'aStokSubKartuStok', batch: 'aStokSubBatch',
  laporan: 'aStokSubLaporan', kategori: 'aStokSubKategori', supplier: 'aStokSubSupplier',
  tambahbarang: 'aStokSubTambahBarang', akses: 'aStokSubAkses', log: 'aStokSubLog'
};
const sudahDimuatTabAdminStok = {};

async function pindahTabAdminStok(tab) {
  document.querySelectorAll('#adminStokTabbar .stok-subtab').forEach(b => b.classList.toggle('active', b.dataset.asub === tab));
  Object.values(A_STOK_SUB_PANEL).forEach(panelId => { document.getElementById(panelId).style.display = 'none'; });
  document.getElementById(A_STOK_SUB_PANEL[tab]).style.display = 'block';

  if (sudahDimuatTabAdminStok[tab]) return;
  sudahDimuatTabAdminStok[tab] = true;
  try {
    if (tab === 'dashboard') await muatDashboardAdminStok();
    else if (tab === 'barang') await muatDaftarBarangAdmin();
    else if (tab === 'masuk') inisialisasiFormMasukAdmin();
    else if (tab === 'keluar') inisialisasiFormKeluarAdmin();
    else if (tab === 'transfer') inisialisasiFormTransferAdmin();
    else if (tab === 'pemusnahan') inisialisasiFormPemusnahanAdmin();
    else if (tab === 'opname') { inisialisasiOpnameAdmin(); await muatRiwayatOpnameAdmin(); }
    else if (tab === 'kartustok') inisialisasiKartuStokAdmin();
    else if (tab === 'batch') await muatBatchListAdmin();
    else if (tab === 'laporan') await muatLaporanListAdmin();
    else if (tab === 'kategori') { await muatKategoriListAdmin(); inisialisasiFormKategoriAdmin(); }
    else if (tab === 'supplier') { await muatSupplierListAdmin(); inisialisasiFormSupplierAdmin(); }
    else if (tab === 'tambahbarang') await inisialisasiFormTambahBarangAdmin();
    else if (tab === 'akses') await muatHakAksesAdmin();
    else if (tab === 'log') await muatLogAktivitasAdmin();
  } catch (err) { showError(err.message || 'Gagal memuat data.'); }
}

// ============================================================
// DASHBOARD
// ============================================================
async function muatDashboardAdminStok() {
  showLoading('Memuat dashboard SIRAGA...');
  try {
    const d = await apiPost('getSiragaDashboardV2', { token: sesiAdminStok.token });
    hideLoading();
    document.getElementById('aDbTotalBarang').textContent = d.totalBarang;
    document.getElementById('aDbBarangAktif').textContent = d.barangAktif;
    document.getElementById('aDbStokAman').textContent = d.stokAman;
    document.getElementById('aDbStokMendekati').textContent = d.stokMendekatiMinimum;
    document.getElementById('aDbStokBawah').textContent = d.stokDiBawahMinimum;
    document.getElementById('aDbStokHabis').textContent = d.barangHabis;
    document.getElementById('aDbAkanExpired').textContent = d.akanExpired;
    document.getElementById('aDbExpired').textContent = d.expired;
    document.getElementById('aDbTransaksiHariIni').textContent = d.transaksiHariIni;
    document.getElementById('aDbMasukHariIni').textContent = d.barangMasukHariIni;
    document.getElementById('aDbKeluarHariIni').textContent = d.barangKeluarHariIni;
  } catch (err) { hideLoading(); throw err; }
}

// ============================================================
// DATA BARANG
// ============================================================
async function muatDaftarBarangAdmin(cari) {
  const list = await apiPost('getSiragaBarangListAdmin', { token: sesiAdminStok.token });
  const q = (cari || '').toLowerCase();
  const filtered = q ? list.filter(b => b.nama.toLowerCase().indexOf(q) !== -1 || b.kode.toLowerCase().indexOf(q) !== -1) : list;
  const container = document.getElementById('aBarangList');
  if (!filtered.length) { container.innerHTML = '<div class="empty-state">Tidak ada barang ditemukan.</div>'; return; }
  container.innerHTML = filtered.map(b => `
    <div class="riwayat-item is-${b.status === 'AKTIF' ? badgeClassStatusStokAdmin(hitungStatusStokLokalAdmin(b)) : 'tidak-hadir'}">
      <div class="riwayat-item-detail">
        <div class="riwayat-item-top">
          <strong class="riwayat-item-shift">${escapeHtml(b.nama)}</strong>
          <span class="riwayat-badge ${b.status === 'AKTIF' ? 'hadir' : 'tidak-hadir'}">${b.status}</span>
        </div>
        <div class="riwayat-item-jam">${escapeHtml(b.namaKategori)} · ${b.kode}</div>
        <div class="riwayat-item-jam">Stok: <strong>${formatRupiahSederhanaAdmin(b.stok)} ${b.satuan}</strong> (Minimum: ${formatRupiahSederhanaAdmin(b.stokMinimum)})</div>
        <button class="btn-mini" data-id="${b.id}" data-status="${b.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'}" onclick="toggleStatusBarangAdmin(this)" style="margin-top:6px;">${b.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button>
      </div>
    </div>`).join('');
}
function hitungStatusStokLokalAdmin(b) {
  if (b.stok <= 0) return 'HABIS';
  if (b.stok <= b.stokMinimum) return 'DI BAWAH MINIMUM';
  if (b.stok <= b.stokMinimum * 1.2) return 'MENDEKATI MINIMUM';
  return 'AMAN';
}
async function toggleStatusBarangAdmin(btn) {
  try { await apiPost('updateSiragaBarangStatus', { token: sesiAdminStok.token, id: btn.dataset.id, status: btn.dataset.status }); await muatDaftarBarangAdmin(document.getElementById('aBarangCari').value.trim()); }
  catch (err) { showError(err.message); }
}

// ============================================================
// BARANG MASUK / KELUAR / TRANSFER / PEMUSNAHAN (identik pola siraga.js relawan)
// ============================================================
let formMasukAdminSiap = false;
function inisialisasiFormMasukAdmin() {
  if (formMasukAdminSiap) return; formMasukAdminSiap = true;
  document.getElementById('aMasukTanggal').value = tanggalHariIniIsoAdmin();
  apiPost('getSiragaSupplierList', { token: sesiAdminStok.token }).then(list => {
    list.forEach(s => document.getElementById('aMasukSupplier').insertAdjacentHTML('beforeend', `<option value="${s.id}">${escapeHtml(s.nama)}</option>`));
  }).catch(() => {});
  tambahBarisItemAdmin('aMasukDaftarItem', 'MASUK');
  document.getElementById('aBtnTambahBarisMasuk').addEventListener('click', () => tambahBarisItemAdmin('aMasukDaftarItem', 'MASUK'));
  document.getElementById('aBtnSimpanMasuk').addEventListener('click', async () => {
    const tombol = document.getElementById('aBtnSimpanMasuk');
    try {
      const items = bacaSemuaBarisItemAdmin('aMasukDaftarItem');
      tombol.disabled = true; tombol.textContent = 'Menyimpan...';
      const hasil = await apiPost('siragaBarangMasuk', { token: sesiAdminStok.token, tanggal: isoKeDmyTampilanAdmin(document.getElementById('aMasukTanggal').value), idSupplier: document.getElementById('aMasukSupplier').value, keterangan: document.getElementById('aMasukKeterangan').value.trim(), items: items });
      showError('✅ Transaksi ' + hasil.nomorTransaksi + ' berhasil disimpan.');
      kosongkanBarisItemAdmin('aMasukDaftarItem'); tambahBarisItemAdmin('aMasukDaftarItem', 'MASUK');
      document.getElementById('aMasukKeterangan').value = '';
      Object.keys(sudahDimuatTabAdminStok).forEach(k => delete sudahDimuatTabAdminStok[k]);
    } catch (err) { showError(err.message || 'Gagal menyimpan transaksi.'); }
    finally { tombol.disabled = false; tombol.textContent = 'Simpan Transaksi Masuk'; }
  });
}

let formKeluarAdminSiap = false;
function inisialisasiFormKeluarAdmin() {
  if (formKeluarAdminSiap) return; formKeluarAdminSiap = true;
  document.getElementById('aKeluarTanggal').value = tanggalHariIniIsoAdmin();
  tambahBarisItemAdmin('aKeluarDaftarItem', 'KELUAR');
  document.getElementById('aBtnTambahBarisKeluar').addEventListener('click', () => tambahBarisItemAdmin('aKeluarDaftarItem', 'KELUAR'));
  document.getElementById('aBtnSimpanKeluar').addEventListener('click', async () => {
    const tombol = document.getElementById('aBtnSimpanKeluar');
    try {
      const tujuan = document.getElementById('aKeluarTujuan').value;
      if (!tujuan) throw new Error('Tujuan wajib dipilih.');
      const items = bacaSemuaBarisItemAdmin('aKeluarDaftarItem');
      tombol.disabled = true; tombol.textContent = 'Menyimpan...';
      const hasil = await apiPost('siragaBarangKeluar', { token: sesiAdminStok.token, tanggal: isoKeDmyTampilanAdmin(document.getElementById('aKeluarTanggal').value), tujuan: tujuan, keterangan: document.getElementById('aKeluarKeterangan').value.trim(), items: items });
      showError('✅ Transaksi ' + hasil.nomorTransaksi + ' berhasil disimpan.');
      kosongkanBarisItemAdmin('aKeluarDaftarItem'); tambahBarisItemAdmin('aKeluarDaftarItem', 'KELUAR');
      document.getElementById('aKeluarKeterangan').value = '';
      Object.keys(sudahDimuatTabAdminStok).forEach(k => delete sudahDimuatTabAdminStok[k]);
    } catch (err) { showError(err.message || 'Gagal menyimpan transaksi.'); }
    finally { tombol.disabled = false; tombol.textContent = 'Simpan Transaksi Keluar'; }
  });
}

let formTransferAdminSiap = false;
function inisialisasiFormTransferAdmin() {
  if (formTransferAdminSiap) return; formTransferAdminSiap = true;
  document.getElementById('aTransferTanggal').value = tanggalHariIniIsoAdmin();
  tambahBarisItemAdmin('aTransferDaftarItem', 'TRANSFER');
  document.getElementById('aBtnTambahBarisTransfer').addEventListener('click', () => tambahBarisItemAdmin('aTransferDaftarItem', 'TRANSFER'));
  document.getElementById('aBtnSimpanTransfer').addEventListener('click', async () => {
    const tombol = document.getElementById('aBtnSimpanTransfer');
    try {
      const sumber = document.getElementById('aTransferSumber').value.trim();
      const tujuan = document.getElementById('aTransferTujuan').value.trim();
      if (!sumber || !tujuan) throw new Error('Sumber dan Tujuan wajib diisi.');
      const items = bacaSemuaBarisItemAdmin('aTransferDaftarItem');
      tombol.disabled = true; tombol.textContent = 'Menyimpan...';
      const hasil = await apiPost('siragaTransfer', { token: sesiAdminStok.token, tanggal: isoKeDmyTampilanAdmin(document.getElementById('aTransferTanggal').value), sumber: sumber, tujuan: tujuan, keterangan: document.getElementById('aTransferKeterangan').value.trim(), items: items });
      showError('✅ Transfer ' + hasil.nomorTransaksi + ' berhasil disimpan.');
      kosongkanBarisItemAdmin('aTransferDaftarItem'); tambahBarisItemAdmin('aTransferDaftarItem', 'TRANSFER');
      document.getElementById('aTransferKeterangan').value = '';
      Object.keys(sudahDimuatTabAdminStok).forEach(k => delete sudahDimuatTabAdminStok[k]);
    } catch (err) { showError(err.message || 'Gagal menyimpan transfer.'); }
    finally { tombol.disabled = false; tombol.textContent = 'Simpan Transfer'; }
  });
}

let formPemusnahanAdminSiap = false;
function inisialisasiFormPemusnahanAdmin() {
  if (formPemusnahanAdminSiap) return; formPemusnahanAdminSiap = true;
  document.getElementById('aPemusnahanTanggal').value = tanggalHariIniIsoAdmin();
  tambahBarisItemAdmin('aPemusnahanDaftarItem', 'PEMUSNAHAN');
  document.getElementById('aBtnTambahBarisPemusnahan').addEventListener('click', () => tambahBarisItemAdmin('aPemusnahanDaftarItem', 'PEMUSNAHAN'));
  document.getElementById('aPemusnahanAlasan').addEventListener('change', (e) => { document.getElementById('aPemusnahanKetWajib').style.display = e.target.value === 'LAINNYA' ? 'inline' : 'none'; });
  document.getElementById('aBtnSimpanPemusnahan').addEventListener('click', async () => {
    const tombol = document.getElementById('aBtnSimpanPemusnahan');
    try {
      const alasan = document.getElementById('aPemusnahanAlasan').value;
      if (!alasan) throw new Error('Alasan pemusnahan wajib dipilih.');
      const keterangan = document.getElementById('aPemusnahanKeterangan').value.trim();
      if (alasan === 'LAINNYA' && !keterangan) throw new Error('Keterangan wajib diisi untuk alasan "Lainnya".');
      const items = bacaSemuaBarisItemAdmin('aPemusnahanDaftarItem');
      tombol.disabled = true; tombol.textContent = 'Menyimpan...';
      const hasil = await apiPost('siragaPemusnahan', { token: sesiAdminStok.token, tanggal: isoKeDmyTampilanAdmin(document.getElementById('aPemusnahanTanggal').value), alasanPemusnahan: alasan, keterangan: keterangan, items: items });
      showError('✅ Pemusnahan ' + hasil.nomorTransaksi + ' berhasil dicatat.');
      kosongkanBarisItemAdmin('aPemusnahanDaftarItem'); tambahBarisItemAdmin('aPemusnahanDaftarItem', 'PEMUSNAHAN');
      document.getElementById('aPemusnahanKeterangan').value = '';
      Object.keys(sudahDimuatTabAdminStok).forEach(k => delete sudahDimuatTabAdminStok[k]);
    } catch (err) { showError(err.message || 'Gagal menyimpan pemusnahan.'); }
    finally { tombol.disabled = false; tombol.textContent = 'Simpan Pemusnahan'; }
  });
}

// ============================================================
// STOCK OPNAME
// ============================================================
let opnameAdminSiap = false;
let opnameAdminAktifId = null;
function inisialisasiOpnameAdmin() {
  if (opnameAdminSiap) return; opnameAdminSiap = true;
  const dropdownOpname = buatSearchableDropdownAdmin('aOpnameBarangDropdown', {
    placeholder: 'Cari barang untuk di-opname...', fetchList: fetchBarangUntukDropdownAdmin,
    onSelect: () => { document.getElementById('aBtnMulaiOpname').disabled = false; }
  });
  document.getElementById('aBtnMulaiOpname').addEventListener('click', async () => {
    const dipilih = dropdownOpname.getSelected();
    if (!dipilih) return;
    try {
      showLoading('Mengambil snapshot stok sistem...');
      const hasil = await apiPost('mulaiSiragaOpname', { token: sesiAdminStok.token, idBarang: dipilih.id });
      hideLoading();
      opnameAdminAktifId = hasil.id;
      document.getElementById('aOpnameNamaBarang').textContent = hasil.namaBarang;
      document.getElementById('aOpnameStokSistem').textContent = formatRupiahSederhanaAdmin(hasil.stokSistem) + ' ' + hasil.satuan;
      document.getElementById('aOpnameStokFisik').value = '';
      document.getElementById('aOpnameSelisihRow').style.display = 'none';
      document.getElementById('aBtnSelesaikanOpname').disabled = true;
      document.getElementById('aOpnameFormMulai').style.display = 'none';
      document.getElementById('aOpnameFormFisik').classList.remove('is-hidden');
    } catch (err) { hideLoading(); showError(err.message || 'Gagal memulai opname.'); }
  });
  document.getElementById('aOpnameStokFisik').addEventListener('input', async (e) => {
    if (e.target.value === '') { document.getElementById('aOpnameSelisihRow').style.display = 'none'; document.getElementById('aBtnSelesaikanOpname').disabled = true; return; }
    try {
      const hasil = await apiPost('isiStokFisikSiragaOpname', { token: sesiAdminStok.token, id: opnameAdminAktifId, stokFisik: Number(e.target.value) });
      document.getElementById('aOpnameSelisihRow').style.display = 'flex';
      const el = document.getElementById('aOpnameSelisih');
      el.textContent = (hasil.selisih > 0 ? '+' : '') + formatRupiahSederhanaAdmin(hasil.selisih);
      el.style.color = hasil.selisih === 0 ? 'var(--color-text)' : (hasil.selisih > 0 ? 'var(--color-success)' : 'var(--color-danger)');
      document.getElementById('aBtnSelesaikanOpname').disabled = false;
    } catch (err) { showError(err.message); }
  });
  document.getElementById('aBtnSelesaikanOpname').addEventListener('click', async () => {
    try {
      showLoading('Menyelesaikan opname...');
      const hasil = await apiPost('selesaikanSiragaOpname', { token: sesiAdminStok.token, id: opnameAdminAktifId });
      hideLoading();
      showError(hasil.selisih === 0 ? '✅ Opname selesai, tidak ada selisih.' : '✅ Opname selesai. Penyesuaian ' + (hasil.selisih > 0 ? '+' : '') + hasil.selisih + ' tercatat otomatis.');
      tutupFormOpnameFisikAdmin(); await muatRiwayatOpnameAdmin();
      delete sudahDimuatTabAdminStok.dashboard; delete sudahDimuatTabAdminStok.barang; delete sudahDimuatTabAdminStok.laporan;
    } catch (err) { hideLoading(); showError(err.message || 'Gagal menyelesaikan opname.'); }
  });
  document.getElementById('aBtnBatalOpname').addEventListener('click', async () => {
    if (!confirm('Batalkan opname ini?')) return;
    try { await apiPost('batalkanSiragaOpname', { token: sesiAdminStok.token, id: opnameAdminAktifId }); tutupFormOpnameFisikAdmin(); await muatRiwayatOpnameAdmin(); }
    catch (err) { showError(err.message || 'Gagal membatalkan opname.'); }
  });
  function tutupFormOpnameFisikAdmin() {
    opnameAdminAktifId = null;
    document.getElementById('aOpnameFormFisik').classList.add('is-hidden');
    document.getElementById('aOpnameFormMulai').style.display = 'block';
    dropdownOpname.reset();
    document.getElementById('aBtnMulaiOpname').disabled = true;
  }
}
async function muatRiwayatOpnameAdmin() {
  const list = await apiPost('getSiragaOpnameList', { token: sesiAdminStok.token });
  const container = document.getElementById('aOpnameList');
  if (!list.length) { container.innerHTML = '<div class="empty-state">Belum ada riwayat opname.</div>'; return; }
  container.innerHTML = list.slice(0, 50).map(o => `
    <div class="riwayat-item is-${badgeClassStatusTransaksiAdmin(o.status)}"><div class="riwayat-item-detail">
      <div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(o.namaBarang)}</strong><span class="riwayat-badge ${badgeClassStatusTransaksiAdmin(o.status)}">${o.status}</span></div>
      <div class="riwayat-item-jam">${o.tanggal} · Sistem: ${formatRupiahSederhanaAdmin(o.stokSistem)} · Fisik: ${o.stokFisik !== '' ? formatRupiahSederhanaAdmin(o.stokFisik) : '-'} · Selisih: ${o.selisih !== '' ? o.selisih : '-'}</div>
    </div></div>`).join('');
}

// ============================================================
// KARTU STOK
// ============================================================
let kartuStokAdminSiap = false;
function inisialisasiKartuStokAdmin() {
  if (kartuStokAdminSiap) return; kartuStokAdminSiap = true;
  buatSearchableDropdownAdmin('aKartuStokBarangDropdown', {
    placeholder: 'Cari barang...', fetchList: fetchBarangUntukDropdownAdmin,
    onSelect: async (item) => {
      const hasilDiv = document.getElementById('aKartuStokHasil');
      hasilDiv.innerHTML = '<div class="empty-state">Memuat kartu stok...</div>';
      try {
        const hasil = await apiPost('getSiragaKartuStok', { token: sesiAdminStok.token, idBarang: item.id });
        if (!hasil.kartu.length) { hasilDiv.innerHTML = '<div class="empty-state">Belum ada mutasi untuk barang ini.</div>'; return; }
        hasilDiv.innerHTML = `
          <div class="stat-tile" style="margin:14px 0;"><span class="stat-tile-num">${formatRupiahSederhanaAdmin(hasil.saldoAkhir)}</span><span class="stat-tile-label">Saldo Akhir</span></div>
          <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="text-align:left;border-bottom:2px solid var(--color-border);"><th style="padding:6px;">Tgl</th><th>Jenis</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr></thead>
            <tbody>${hasil.kartu.map(k => `<tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px;">${k.tanggal}</td><td>${k.jenis}</td><td>${k.masuk || ''}</td><td>${k.keluar || ''}</td><td><strong>${formatRupiahSederhanaAdmin(k.saldo)}</strong></td></tr>`).join('')}</tbody>
          </table></div>`;
      } catch (err) { hasilDiv.innerHTML = '<div class="empty-state">Gagal memuat.</div>'; showError(err.message); }
    }
  });
}

// ============================================================
// BATCH & KEDALUWARSA
// ============================================================
async function muatBatchListAdmin() {
  document.getElementById('aBtnMuatBatch').addEventListener('click', muatBatchListAdmin_);
  await muatBatchListAdmin_();
}
async function muatBatchListAdmin_() {
  const status = document.getElementById('aBatchFilterStatus').value;
  const list = await apiPost('getSiragaBatchListAdmin', { token: sesiAdminStok.token, statusExpired: status });
  const container = document.getElementById('aBatchList');
  if (!list.length) { container.innerHTML = '<div class="empty-state">Tidak ada batch ditemukan.</div>'; return; }
  container.innerHTML = list.map(b => `
    <div class="riwayat-item is-${badgeClassStatusExpiredAdmin(b.statusExpired)}"><div class="riwayat-item-detail">
      <div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(b.namaBarang)}</strong><span class="riwayat-badge ${badgeClassStatusExpiredAdmin(b.statusExpired)}">${b.statusExpired || '-'}</span></div>
      <div class="riwayat-item-jam">${b.nomorBatch} · Expired: ${b.tanggalExpired || '-'} · Stok: ${formatRupiahSederhanaAdmin(b.stok)}</div>
    </div></div>`).join('');
}

// ============================================================
// LAPORAN
// ============================================================
async function muatLaporanListAdmin() {
  document.getElementById('aBtnMuatLaporan').addEventListener('click', muatLaporanListAdmin_);
  await muatLaporanListAdmin_();
}
async function muatLaporanListAdmin_() {
  const jenis = document.getElementById('aLaporanFilterJenis').value;
  const status = document.getElementById('aLaporanFilterStatus').value;
  const list = await apiPost('getSiragaTransaksiList', { token: sesiAdminStok.token, jenis: jenis, status: status });
  const container = document.getElementById('aLaporanList');
  if (!list.length) { container.innerHTML = '<div class="empty-state">Tidak ada transaksi ditemukan.</div>'; return; }
  container.innerHTML = list.map(t => `
    <div class="riwayat-item is-${badgeClassStatusTransaksiAdmin(t.status)}"><div class="riwayat-item-detail">
      <div class="riwayat-item-top"><strong class="riwayat-item-shift">${t.nomor}</strong><span class="riwayat-badge ${badgeClassStatusTransaksiAdmin(t.status)}">${t.status}</span></div>
      <div class="riwayat-item-jam">${t.jenis} · ${t.tanggal} · ${escapeHtml(t.namaPetugas)}</div>
      ${t.keterangan ? `<div class="riwayat-item-jam">${escapeHtml(t.keterangan)}</div>` : ''}
    </div></div>`).join('');
}

// ============================================================
// KATEGORI
// ============================================================
let formKategoriAdminSiap = false;
function inisialisasiFormKategoriAdmin() {
  if (formKategoriAdminSiap) return; formKategoriAdminSiap = true;
  document.getElementById('aBtnTambahKategori').addEventListener('click', async () => {
    const nama = document.getElementById('aKategoriBaruNama').value.trim();
    if (!nama) return;
    try { await apiPost('addSiragaKategori', { token: sesiAdminStok.token, nama: nama }); document.getElementById('aKategoriBaruNama').value = ''; await muatKategoriListAdmin(); }
    catch (err) { showError(err.message); }
  });
}
async function muatKategoriListAdmin() {
  const list = await apiPost('getSiragaKategoriListAdmin', { token: sesiAdminStok.token });
  document.getElementById('aKategoriList').innerHTML = list.map(k => `
    <div class="riwayat-item is-${k.status === 'AKTIF' ? 'hadir' : 'tidak-hadir'}"><div class="riwayat-item-detail"><div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(k.nama)}</strong>
    <button class="btn-mini" data-id="${k.id}" data-status="${k.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'}" onclick="toggleStatusKategoriAdmin(this)">${k.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button></div></div></div>`).join('') || '<div class="empty-state">Belum ada kategori.</div>';
}
async function toggleStatusKategoriAdmin(btn) {
  try { await apiPost('updateSiragaKategoriStatus', { token: sesiAdminStok.token, id: btn.dataset.id, status: btn.dataset.status }); await muatKategoriListAdmin(); }
  catch (err) { showError(err.message); }
}

// ============================================================
// SUPPLIER
// ============================================================
let formSupplierAdminSiap = false;
function inisialisasiFormSupplierAdmin() {
  if (formSupplierAdminSiap) return; formSupplierAdminSiap = true;
  document.getElementById('aBtnTambahSupplier').addEventListener('click', async () => {
    const nama = document.getElementById('aSupplierBaruNama').value.trim();
    if (!nama) return;
    try {
      await apiPost('addSiragaSupplier', { token: sesiAdminStok.token, nama: nama, kontak: document.getElementById('aSupplierBaruKontak').value.trim(), alamat: document.getElementById('aSupplierBaruAlamat').value.trim() });
      document.getElementById('aSupplierBaruNama').value = ''; document.getElementById('aSupplierBaruKontak').value = ''; document.getElementById('aSupplierBaruAlamat').value = '';
      await muatSupplierListAdmin();
    } catch (err) { showError(err.message); }
  });
}
async function muatSupplierListAdmin() {
  const list = await apiPost('getSiragaSupplierListAdmin', { token: sesiAdminStok.token });
  document.getElementById('aSupplierList').innerHTML = list.map(s => `
    <div class="riwayat-item is-${s.status === 'AKTIF' ? 'hadir' : 'tidak-hadir'}"><div class="riwayat-item-detail"><div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(s.nama)}</strong>
    <button class="btn-mini" data-id="${s.id}" data-status="${s.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'}" onclick="toggleStatusSupplierAdmin(this)">${s.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button></div>
    <div class="riwayat-item-jam">${escapeHtml(s.kontak || '-')}</div></div></div>`).join('') || '<div class="empty-state">Belum ada supplier.</div>';
}
async function toggleStatusSupplierAdmin(btn) {
  try { await apiPost('updateSiragaSupplier', { token: sesiAdminStok.token, id: btn.dataset.id, status: btn.dataset.status }); await muatSupplierListAdmin(); }
  catch (err) { showError(err.message); }
}

// ============================================================
// TAMBAH BARANG (dipicu tombol di tab Data Barang)
// ============================================================
let formTambahBarangAdminSiap = false;
async function inisialisasiFormTambahBarangAdmin() {
  if (formTambahBarangAdminSiap) { return; }
  formTambahBarangAdminSiap = true;
  const selKategori = document.getElementById('aBarangBaruKategori');
  const kategoriList = await apiPost('getSiragaKategoriList', { token: sesiAdminStok.token });
  kategoriList.forEach(k => selKategori.insertAdjacentHTML('beforeend', `<option value="${k.id}">${escapeHtml(k.nama)}</option>`));
  const selSatuan = document.getElementById('aBarangBaruSatuan');
  const satuanList = await apiPost('getSiragaSatuanList', {});
  satuanList.forEach(s => selSatuan.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`));

  document.getElementById('aBtnSimpanBarangBaru').addEventListener('click', async () => {
    const tombol = document.getElementById('aBtnSimpanBarangBaru');
    try {
      const nama = document.getElementById('aBarangBaruNama').value.trim();
      const idKategori = selKategori.value;
      const satuan = selSatuan.value;
      if (!nama || !idKategori || !satuan) throw new Error('Nama, Kategori, dan Satuan wajib diisi.');
      tombol.disabled = true;
      await apiPost('addSiragaBarang', {
        token: sesiAdminStok.token, nama: nama, idKategori: idKategori, satuan: satuan,
        stokMinimum: Number(document.getElementById('aBarangBaruStokMinimum').value) || 0,
        kelolaBatch: document.getElementById('aBarangBaruKelolaBatch').checked,
        kelolaExpired: document.getElementById('aBarangBaruKelolaExpired').checked
      });
      showError('✅ Barang berhasil ditambahkan.');
      document.getElementById('aBarangBaruNama').value = '';
      document.getElementById('aBarangBaruStokMinimum').value = '0';
      document.getElementById('aBarangBaruKelolaBatch').checked = false;
      document.getElementById('aBarangBaruKelolaExpired').checked = false;
      delete sudahDimuatTabAdminStok.barang;
      await pindahTabAdminStok('barang'); // balik otomatis ke Data Barang, langsung lihat barang baru
    } catch (err) { showError(err.message || 'Gagal menambah barang.'); }
    finally { tombol.disabled = false; }
  });

}
// Versi paksa -- dipakai tombol "+ Tambah Barang" di tab Data Barang, TIDAK menghitung sbg tab tabbar aktif
async function pindahTabAdminStokPaksa(tab) {
  Object.values(A_STOK_SUB_PANEL).forEach(panelId => { document.getElementById(panelId).style.display = 'none'; });
  document.getElementById(A_STOK_SUB_PANEL[tab]).style.display = 'block';
  if (!sudahDimuatTabAdminStok[tab]) { sudahDimuatTabAdminStok[tab] = true; if (tab === 'tambahbarang') await inisialisasiFormTambahBarangAdmin(); }
}

// ============================================================
// HAK AKSES
// ============================================================
async function muatHakAksesAdmin() {
  const [petugas, semuaRelawan] = await Promise.all([
    apiPost('getDaftarPetugasStok', { token: sesiAdminStok.token }),
    apiGet('getRelawan', { token: sesiAdminStok.token, semua: '0' })
  ]);
  const idPetugasSet = new Set(petugas.map(p => p.idRelawan));
  const container = document.getElementById('aHakAksesList');
  container.innerHTML = `
    <p class="section-title">Petugas Stok Saat Ini</p>
    ${petugas.map(p => `<div class="riwayat-item is-hadir"><div class="riwayat-item-detail"><div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(p.nama)}</strong>
      <button class="btn-mini" data-id="${p.idRelawan}" data-jadi="false" onclick="ubahRoleStokAdmin(this)">Cabut Akses</button></div></div></div>`).join('') || '<div class="empty-state">Belum ada Petugas Stok.</div>'}
    <p class="section-title" style="margin-top:18px;">Tambahkan Petugas Baru</p>
    <select id="aPilihRelawanBaruPetugas" class="form-field-input" style="margin-bottom:8px;">
      <option value="">— Pilih Relawan —</option>
      ${semuaRelawan.filter(r => !idPetugasSet.has(r.id)).map(r => `<option value="${r.id}">${escapeHtml(r.nama)}</option>`).join('')}
    </select>
    <button class="btn-submit" id="aBtnJadikanPetugas">+ Berikan Akses Petugas Stok</button>
  `;
  document.getElementById('aBtnJadikanPetugas').addEventListener('click', async () => {
    const id = document.getElementById('aPilihRelawanBaruPetugas').value;
    if (!id) return;
    try { await apiPost('setRoleStok', { token: sesiAdminStok.token, idRelawan: id, jadikanPetugas: true }); await muatHakAksesAdmin(); }
    catch (err) { showError(err.message); }
  });
}
async function ubahRoleStokAdmin(btn) {
  try { await apiPost('setRoleStok', { token: sesiAdminStok.token, idRelawan: btn.dataset.id, jadikanPetugas: btn.dataset.jadi === 'true' }); await muatHakAksesAdmin(); }
  catch (err) { showError(err.message); }
}

// ============================================================
// LOG AKTIVITAS
// ============================================================
async function muatLogAktivitasAdmin() {
  const list = await apiPost('getSiragaActivityLogs', { token: sesiAdminStok.token });
  document.getElementById('aLogAktivitasList').innerHTML = list.map(l => `
    <div class="riwayat-item is-belum-absen"><div class="riwayat-item-detail">
      <div class="riwayat-item-top"><strong class="riwayat-item-shift">${l.aksi}</strong></div>
      <div class="riwayat-item-jam">${escapeHtml(l.aktor)} · ${l.waktu ? new Date(l.waktu).toLocaleString('id-ID') : '-'}</div>
    </div></div>`).join('') || '<div class="empty-state">Belum ada log.</div>';
}

// ============================================================
// INIT (lazy-loaded, mengikuti pola admin-stok.js lama)
// ============================================================
function initStok() {
  // Token diambil dari window.sppgAdminToken (di-set admin.js saat login/pulihkan sesi),
  // sama seperti admin-shift.js & admin-role.js -- bukan dari localStorage langsung.
  const token = window.sppgAdminToken;
  if (!token) return;
  sesiAdminStok = { token: token };

  document.querySelectorAll('#adminStokTabbar .stok-subtab').forEach(btn => {
    btn.addEventListener('click', () => pindahTabAdminStok(btn.dataset.asub));
  });
  // Tombol "+ Tambah Barang" (di tab Data Barang) HARUS dipasang di sini, bukan di dalam
  // inisialisasi form -- form baru diinisialisasi SETELAH tombol ini diklik.
  document.getElementById('aBtnBukaTambahBarang').addEventListener('click', () => pindahTabAdminStokPaksa('tambahbarang'));
  document.getElementById('aBarangCari').addEventListener('input', (e) => {
    clearTimeout(window._aSiragaCariTimeout);
    window._aSiragaCariTimeout = setTimeout(() => muatDaftarBarangAdmin(e.target.value.trim()), 350);
  });

  pindahTabAdminStok('dashboard').catch(err => showError(err.message || 'Gagal memuat SIRAGA. Pastikan SIRAGA_SPREADSHEET_ID sudah diisi di Script Properties.'));
}

let sudahInit = false;
window.addEventListener('sppg-admin-ready', () => { if (!sudahInit) { sudahInit = true; initStok(); } });
// PENTING: file ini di-lazy-load SETELAH login, jadi event 'sppg-admin-ready' biasanya SUDAH
// tertembak sebelum listener di atas terpasang. Kalau token sudah ada, langsung init
// (pola sama dengan admin-shift.js). Tanpa baris ini tab SIRAGA tidak bisa diklik.
if (window.sppgAdminToken && !sudahInit) { sudahInit = true; initStok(); }

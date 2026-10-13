// SPPG JEUNGJING — SIRAGA v2 — siraga.js
// Sistem Informasi Persediaan dan Gudang. Satu halaman, banyak tab,
// mengikuti pola stok-relawan.js lama tapi disambungkan ke backend v2
// (SiragaDb.gs dkk, spreadsheet terpisah). Role-aware: Admin melihat
// tab Master Data & Pengaturan tambahan.

let sesiSiraga = null;
let siragaAkses = { tipe: 'PETUGAS_STOK' }; // ditentukan dari respons dashboard pertama

// ============================================================
// UTIL
// ============================================================
function formatRupiahSederhana(n) { return Number(n || 0).toLocaleString('id-ID'); }
function tanggalHariIniIso() { return new Date().toISOString().slice(0, 10); }

function badgeClassStatusStok(status) {
  const peta = { 'AMAN': 'hadir', 'MENDEKATI MINIMUM': 'terlambat', 'DI BAWAH MINIMUM': 'sakit', 'HABIS': 'sakit' };
  return peta[status] || 'belum-absen';
}
function badgeClassStatusExpired(status) {
  const peta = { 'AMAN': 'hadir', 'AKAN KEDALUWARSA': 'terlambat', 'KEDALUWARSA': 'sakit' };
  return peta[status] || 'belum-absen';
}
function badgeClassStatusTransaksi(status) {
  const peta = { 'DRAFT': 'terlambat', 'SELESAI': 'hadir', 'DIBATALKAN': 'tidak-hadir' };
  return peta[status] || 'belum-absen';
}

// ============================================================
// SEARCHABLE DROPDOWN (dipakai Barang & Supplier)
// ============================================================
function buatSearchableDropdown(containerId, opts) {
  // opts: { placeholder, fetchList: async (query) => [{id, label, sub, data}], onSelect: (item) => void }
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
      panel.querySelectorAll('.searchable-dropdown-item').forEach((el, i) => {
        el.addEventListener('click', () => pilihItem(hasil[i]));
      });
    }
    panel.classList.remove('is-hidden');
  }

  function pilihItem(item) {
    selectedItem = item;
    input.value = '';
    panel.classList.add('is-hidden');
    selectedBox.classList.remove('is-hidden');
    selectedBox.innerHTML = `<span>${escapeHtml(item.label)}</span><button type="button" aria-label="Hapus pilihan">×</button>`;
    selectedBox.querySelector('button').addEventListener('click', () => {
      selectedItem = null;
      selectedBox.classList.add('is-hidden');
      input.style.display = '';
    });
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

async function fetchBarangUntukDropdown() {
  const list = await apiPost('getSiragaBarangList', { token: sesiSiraga.token });
  return list.map(b => ({ id: b.id, label: b.nama, sub: b.kode + ' · Stok: ' + formatRupiahSederhana(b.stok) + ' ' + b.satuan, data: b }));
}
async function fetchSupplierUntukDropdown() {
  const list = await apiPost('getSiragaSupplierList', { token: sesiSiraga.token });
  return list.map(s => ({ id: s.id, label: s.nama, sub: s.kontak || '', data: s }));
}

// ============================================================
// BARIS ITEM DINAMIS (dipakai form Masuk/Keluar/Transfer/Pemusnahan)
// ============================================================
let counterBarisItem = 0;
const registriBarisItem = {}; // { rowId: { dropdown, jenis, elQty, elBatch, elProduksi, elExpired, elHint } }

function tambahBarisItem(containerId, jenis) {
  const rowId = 'row' + (++counterBarisItem);
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'siraga-item-row';
  div.id = rowId;
  div.innerHTML = `
    <button type="button" class="siraga-item-row-remove" aria-label="Hapus baris">×</button>
    <label class="form-field" style="margin-bottom:8px;">
      <span class="form-field-label">Barang</span>
      <div class="searchable-dropdown" id="${rowId}-barang"></div>
    </label>
    <div id="${rowId}-batchWrap" style="display:none;margin-bottom:8px;">
      <label class="form-field"><span class="form-field-label">Batch</span><select id="${rowId}-batch" class="form-field-input"></select></label>
    </div>
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

  div.querySelector('.siraga-item-row-remove').addEventListener('click', () => { div.remove(); delete registriBarisItem[rowId]; });

  const dropdown = buatSearchableDropdown(rowId + '-barang', {
    placeholder: 'Cari barang...',
    fetchList: fetchBarangUntukDropdown,
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
            const batchList = await apiPost('getSiragaBatchList', { token: sesiSiraga.token, idBarang: b.id });
            if (!batchList.length) {
              selBatch.innerHTML = '<option value="">— Tidak ada batch tersedia —</option>';
            } else {
              selBatch.innerHTML = batchList.map(bt => `<option value="${bt.id}">${bt.nomorBatch} (Exp: ${bt.tanggalExpired || '-'}, Stok: ${formatRupiahSederhana(bt.stok)}) ${bt.statusExpired === 'KEDALUWARSA' ? '⚠️ KEDALUWARSA' : bt.statusExpired === 'AKAN KEDALUWARSA' ? '⚠️ Akan Exp' : ''}</option>`).join('');
            }
          } catch (e) { selBatch.innerHTML = '<option value="">Gagal memuat batch</option>'; }
        } else {
          batchWrap.style.display = 'none';
        }
        const warnStok = b.stok <= 0 ? ' ⚠️ STOK HABIS' : (b.statusStok === 'DI BAWAH MINIMUM' ? ' ⚠️ di bawah minimum' : '');
        hint.textContent = 'Stok tersedia: ' + formatRupiahSederhana(b.stok) + ' ' + b.satuan + warnStok;
        hint.className = 'siraga-item-hint' + (b.stok <= 0 ? ' warn' : '');
      }
    }
  });

  registriBarisItem[rowId] = { dropdown, jenis };
  return rowId;
}

function bacaSemuaBarisItem(containerId) {
  const container = document.getElementById(containerId);
  const items = [];
  Array.from(container.children).forEach(div => {
    const rowId = div.id;
    const reg = registriBarisItem[rowId];
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
    if (produksiEl && produksiEl.value) item.tanggalProduksi = isoKeDmyTampilan(produksiEl.value);
    if (expiredEl && expiredEl.value) item.tanggalExpired = isoKeDmyTampilan(expiredEl.value);
    items.push(item);
  });
  if (!items.length) throw new Error('Minimal harus ada 1 barang.');
  return items;
}

function kosongkanBarisItem(containerId) {
  document.getElementById(containerId).innerHTML = '';
  Object.keys(registriBarisItem).forEach(k => { if (k.indexOf('row') === 0) delete registriBarisItem[k]; });
}

function isoKeDmyTampilan(iso) {
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

// ============================================================
// TAB SWITCHING (top-level)
// ============================================================
const SIRAGA_SUB_PANEL = {
  dashboard: 'siragaSubDashboard', barang: 'siragaSubBarang', masuk: 'siragaSubMasuk',
  keluar: 'siragaSubKeluar', transfer: 'siragaSubTransfer', pemusnahan: 'siragaSubPemusnahan',
  opname: 'siragaSubOpname', kartustok: 'siragaSubKartuStok', batch: 'siragaSubBatch',
  laporan: 'siragaSubLaporan', masterdata: 'siragaSubMasterData', pengaturan: 'siragaSubPengaturan'
};
const sudahDimuatTab = {};

async function pindahTabSiraga(tab) {
  document.querySelectorAll('#siragaTabbar .stok-subtab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  Object.values(SIRAGA_SUB_PANEL).forEach(panelId => { document.getElementById(panelId).style.display = 'none'; });
  document.getElementById(SIRAGA_SUB_PANEL[tab]).style.display = 'block';

  if (sudahDimuatTab[tab]) return;
  sudahDimuatTab[tab] = true;
  try {
    if (tab === 'dashboard') await muatDashboardSiraga();
    else if (tab === 'barang') await muatDaftarBarang();
    else if (tab === 'masuk') { inisialisasiFormMasuk(); }
    else if (tab === 'keluar') { inisialisasiFormKeluar(); }
    else if (tab === 'transfer') { inisialisasiFormTransfer(); }
    else if (tab === 'pemusnahan') { inisialisasiFormPemusnahan(); }
    else if (tab === 'opname') { inisialisasiOpname(); await muatRiwayatOpname(); }
    else if (tab === 'kartustok') { inisialisasiKartuStok(); }
    else if (tab === 'batch') await muatBatchList();
    else if (tab === 'laporan') await muatLaporanList();
    else if (tab === 'masterdata') await muatMasterDataAwal();
    else if (tab === 'pengaturan') await muatPengaturanAwal();
  } catch (err) {
    showError(err.message || 'Gagal memuat data.');
  }
}

// ============================================================
// DASHBOARD
// ============================================================
async function muatDashboardSiraga() {
  showLoading('Memuat dashboard SIRAGA...');
  try {
    const d = await apiPost('getSiragaDashboardV2', { token: sesiSiraga.token });
    hideLoading();
    document.getElementById('dbTotalBarang').textContent = d.totalBarang;
    document.getElementById('dbBarangAktif').textContent = d.barangAktif;
    document.getElementById('dbStokAman').textContent = d.stokAman;
    document.getElementById('dbStokMendekati').textContent = d.stokMendekatiMinimum;
    document.getElementById('dbStokBawah').textContent = d.stokDiBawahMinimum;
    document.getElementById('dbStokHabis').textContent = d.barangHabis;
    document.getElementById('dbAkanExpired').textContent = d.akanExpired;
    document.getElementById('dbExpired').textContent = d.expired;
    document.getElementById('dbTransaksiHariIni').textContent = d.transaksiHariIni;
    document.getElementById('dbMasukHariIni').textContent = d.barangMasukHariIni;
    document.getElementById('dbKeluarHariIni').textContent = d.barangKeluarHariIni;
  } catch (err) { hideLoading(); throw err; }
}

// ============================================================
// DATA BARANG (list + search)
// ============================================================
async function muatDaftarBarang(cari) {
  const list = await apiPost('getSiragaBarangList', { token: sesiSiraga.token, cari: cari || '' });
  const container = document.getElementById('barangList');
  if (!list.length) { container.innerHTML = '<div class="empty-state">Tidak ada barang ditemukan.</div>'; return; }
  container.innerHTML = list.map(b => `
    <div class="riwayat-item is-${badgeClassStatusStok(b.statusStok)}">
      <div class="riwayat-item-detail">
        <div class="riwayat-item-top">
          <strong class="riwayat-item-shift">${escapeHtml(b.nama)}</strong>
          <span class="riwayat-badge ${badgeClassStatusStok(b.statusStok)}">${b.statusStok}</span>
        </div>
        <div class="riwayat-item-jam">${escapeHtml(b.namaKategori)} · ${b.kode}</div>
        <div class="riwayat-item-jam">Stok: <strong>${formatRupiahSederhana(b.stok)} ${b.satuan}</strong> (Minimum: ${formatRupiahSederhana(b.stokMinimum)})</div>
      </div>
    </div>`).join('');
}

// ============================================================
// BARANG MASUK
// ============================================================
let formMasukSiap = false;
function inisialisasiFormMasuk() {
  if (formMasukSiap) return;
  formMasukSiap = true;
  document.getElementById('masukTanggal').value = tanggalHariIniIso();

  const dropdownSupplier = document.getElementById('masukSupplier');
  apiPost('getSiragaSupplierList', { token: sesiSiraga.token }).then(list => {
    list.forEach(s => dropdownSupplier.insertAdjacentHTML('beforeend', `<option value="${s.id}">${escapeHtml(s.nama)}</option>`));
  }).catch(() => {});

  tambahBarisItem('masukDaftarItem', 'MASUK');
  document.getElementById('btnTambahBarisMasuk').addEventListener('click', () => tambahBarisItem('masukDaftarItem', 'MASUK'));

  document.getElementById('btnSimpanMasuk').addEventListener('click', async () => {
    const tombol = document.getElementById('btnSimpanMasuk');
    try {
      const items = bacaSemuaBarisItem('masukDaftarItem');
      tombol.disabled = true; tombol.textContent = 'Menyimpan...';
      const hasil = await apiPost('siragaBarangMasuk', {
        token: sesiSiraga.token, tanggal: isoKeDmyTampilan(document.getElementById('masukTanggal').value),
        idSupplier: dropdownSupplier.value, keterangan: document.getElementById('masukKeterangan').value.trim(), items: items
      });
      showError('✅ Transaksi ' + hasil.nomorTransaksi + ' berhasil disimpan.');
      kosongkanBarisItem('masukDaftarItem');
      tambahBarisItem('masukDaftarItem', 'MASUK');
      document.getElementById('masukKeterangan').value = '';
      Object.keys(sudahDimuatTab).forEach(k => delete sudahDimuatTab[k]); // reset cache tab lain (stok berubah)
    } catch (err) {
      showError(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      tombol.disabled = false; tombol.textContent = 'Simpan Transaksi Masuk';
    }
  });
}

// ============================================================
// BARANG KELUAR
// ============================================================
let formKeluarSiap = false;
function inisialisasiFormKeluar() {
  if (formKeluarSiap) return;
  formKeluarSiap = true;
  document.getElementById('keluarTanggal').value = tanggalHariIniIso();
  tambahBarisItem('keluarDaftarItem', 'KELUAR');
  document.getElementById('btnTambahBarisKeluar').addEventListener('click', () => tambahBarisItem('keluarDaftarItem', 'KELUAR'));

  document.getElementById('btnSimpanKeluar').addEventListener('click', async () => {
    const tombol = document.getElementById('btnSimpanKeluar');
    try {
      const tujuan = document.getElementById('keluarTujuan').value;
      if (!tujuan) throw new Error('Tujuan wajib dipilih.');
      const items = bacaSemuaBarisItem('keluarDaftarItem');
      tombol.disabled = true; tombol.textContent = 'Menyimpan...';
      const hasil = await apiPost('siragaBarangKeluar', {
        token: sesiSiraga.token, tanggal: isoKeDmyTampilan(document.getElementById('keluarTanggal').value),
        tujuan: tujuan, keterangan: document.getElementById('keluarKeterangan').value.trim(), items: items
      });
      showError('✅ Transaksi ' + hasil.nomorTransaksi + ' berhasil disimpan.');
      kosongkanBarisItem('keluarDaftarItem');
      tambahBarisItem('keluarDaftarItem', 'KELUAR');
      document.getElementById('keluarKeterangan').value = '';
      Object.keys(sudahDimuatTab).forEach(k => delete sudahDimuatTab[k]);
    } catch (err) {
      showError(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      tombol.disabled = false; tombol.textContent = 'Simpan Transaksi Keluar';
    }
  });
}

// ============================================================
// TRANSFER
// ============================================================
let formTransferSiap = false;
function inisialisasiFormTransfer() {
  if (formTransferSiap) return;
  formTransferSiap = true;
  document.getElementById('transferTanggal').value = tanggalHariIniIso();
  tambahBarisItem('transferDaftarItem', 'TRANSFER');
  document.getElementById('btnTambahBarisTransfer').addEventListener('click', () => tambahBarisItem('transferDaftarItem', 'TRANSFER'));

  document.getElementById('btnSimpanTransfer').addEventListener('click', async () => {
    const tombol = document.getElementById('btnSimpanTransfer');
    try {
      const sumber = document.getElementById('transferSumber').value.trim();
      const tujuan = document.getElementById('transferTujuan').value.trim();
      if (!sumber || !tujuan) throw new Error('Sumber dan Tujuan wajib diisi.');
      const items = bacaSemuaBarisItem('transferDaftarItem');
      tombol.disabled = true; tombol.textContent = 'Menyimpan...';
      const hasil = await apiPost('siragaTransfer', {
        token: sesiSiraga.token, tanggal: isoKeDmyTampilan(document.getElementById('transferTanggal').value),
        sumber: sumber, tujuan: tujuan, keterangan: document.getElementById('transferKeterangan').value.trim(), items: items
      });
      showError('✅ Transfer ' + hasil.nomorTransaksi + ' berhasil disimpan.');
      kosongkanBarisItem('transferDaftarItem');
      tambahBarisItem('transferDaftarItem', 'TRANSFER');
      document.getElementById('transferKeterangan').value = '';
      Object.keys(sudahDimuatTab).forEach(k => delete sudahDimuatTab[k]);
    } catch (err) {
      showError(err.message || 'Gagal menyimpan transfer.');
    } finally {
      tombol.disabled = false; tombol.textContent = 'Simpan Transfer';
    }
  });
}

// ============================================================
// PEMUSNAHAN
// ============================================================
let formPemusnahanSiap = false;
function inisialisasiFormPemusnahan() {
  if (formPemusnahanSiap) return;
  formPemusnahanSiap = true;
  document.getElementById('pemusnahanTanggal').value = tanggalHariIniIso();
  tambahBarisItem('pemusnahanDaftarItem', 'PEMUSNAHAN');
  document.getElementById('btnTambahBarisPemusnahan').addEventListener('click', () => tambahBarisItem('pemusnahanDaftarItem', 'PEMUSNAHAN'));

  document.getElementById('pemusnahanAlasan').addEventListener('change', (e) => {
    document.getElementById('pemusnahanKetWajib').style.display = e.target.value === 'LAINNYA' ? 'inline' : 'none';
  });

  document.getElementById('btnSimpanPemusnahan').addEventListener('click', async () => {
    const tombol = document.getElementById('btnSimpanPemusnahan');
    try {
      const alasan = document.getElementById('pemusnahanAlasan').value;
      if (!alasan) throw new Error('Alasan pemusnahan wajib dipilih.');
      const keterangan = document.getElementById('pemusnahanKeterangan').value.trim();
      if (alasan === 'LAINNYA' && !keterangan) throw new Error('Keterangan wajib diisi untuk alasan "Lainnya".');
      const items = bacaSemuaBarisItem('pemusnahanDaftarItem');
      tombol.disabled = true; tombol.textContent = 'Menyimpan...';
      const hasil = await apiPost('siragaPemusnahan', {
        token: sesiSiraga.token, tanggal: isoKeDmyTampilan(document.getElementById('pemusnahanTanggal').value),
        alasanPemusnahan: alasan, keterangan: keterangan, items: items
      });
      showError('✅ Pemusnahan ' + hasil.nomorTransaksi + ' berhasil dicatat.');
      kosongkanBarisItem('pemusnahanDaftarItem');
      tambahBarisItem('pemusnahanDaftarItem', 'PEMUSNAHAN');
      document.getElementById('pemusnahanKeterangan').value = '';
      Object.keys(sudahDimuatTab).forEach(k => delete sudahDimuatTab[k]);
    } catch (err) {
      showError(err.message || 'Gagal menyimpan pemusnahan.');
    } finally {
      tombol.disabled = false; tombol.textContent = 'Simpan Pemusnahan';
    }
  });
}

// ============================================================
// STOCK OPNAME
// ============================================================
let opnameSiap = false;
let opnameAktifId = null;
function inisialisasiOpname() {
  if (opnameSiap) return;
  opnameSiap = true;

  const dropdownOpname = buatSearchableDropdown('opnameBarangDropdown', {
    placeholder: 'Cari barang untuk di-opname...',
    fetchList: fetchBarangUntukDropdown,
    onSelect: () => { document.getElementById('btnMulaiOpname').disabled = false; }
  });

  document.getElementById('btnMulaiOpname').addEventListener('click', async () => {
    const dipilih = dropdownOpname.getSelected();
    if (!dipilih) return;
    try {
      showLoading('Mengambil snapshot stok sistem...');
      const hasil = await apiPost('mulaiSiragaOpname', { token: sesiSiraga.token, idBarang: dipilih.id });
      hideLoading();
      opnameAktifId = hasil.id;
      document.getElementById('opnameNamaBarang').textContent = hasil.namaBarang;
      document.getElementById('opnameStokSistem').textContent = formatRupiahSederhana(hasil.stokSistem) + ' ' + hasil.satuan;
      document.getElementById('opnameStokFisik').value = '';
      document.getElementById('opnameSelisihRow').style.display = 'none';
      document.getElementById('btnSelesaikanOpname').disabled = true;
      document.getElementById('opnameFormMulai').style.display = 'none';
      document.getElementById('opnameFormFisik').classList.remove('is-hidden');
    } catch (err) { hideLoading(); showError(err.message || 'Gagal memulai opname.'); }
  });

  document.getElementById('opnameStokFisik').addEventListener('input', async (e) => {
    if (e.target.value === '') { document.getElementById('opnameSelisihRow').style.display = 'none'; document.getElementById('btnSelesaikanOpname').disabled = true; return; }
    try {
      const hasil = await apiPost('isiStokFisikSiragaOpname', { token: sesiSiraga.token, id: opnameAktifId, stokFisik: Number(e.target.value) });
      document.getElementById('opnameSelisihRow').style.display = 'flex';
      const el = document.getElementById('opnameSelisih');
      el.textContent = (hasil.selisih > 0 ? '+' : '') + formatRupiahSederhana(hasil.selisih);
      el.style.color = hasil.selisih === 0 ? 'var(--color-text)' : (hasil.selisih > 0 ? 'var(--color-success)' : 'var(--color-danger)');
      document.getElementById('btnSelesaikanOpname').disabled = false;
    } catch (err) { showError(err.message); }
  });

  document.getElementById('btnSelesaikanOpname').addEventListener('click', async () => {
    try {
      showLoading('Menyelesaikan opname...');
      const hasil = await apiPost('selesaikanSiragaOpname', { token: sesiSiraga.token, id: opnameAktifId });
      hideLoading();
      showError(hasil.selisih === 0 ? '✅ Opname selesai, tidak ada selisih.' : '✅ Opname selesai. Penyesuaian ' + (hasil.selisih > 0 ? '+' : '') + hasil.selisih + ' tercatat otomatis.');
      tutupFormOpnameFisik();
      await muatRiwayatOpname();
      delete sudahDimuatTab.dashboard; delete sudahDimuatTab.barang; delete sudahDimuatTab.laporan;
    } catch (err) { hideLoading(); showError(err.message || 'Gagal menyelesaikan opname.'); }
  });

  document.getElementById('btnBatalOpname').addEventListener('click', async () => {
    if (!confirm('Batalkan opname ini?')) return;
    try {
      await apiPost('batalkanSiragaOpname', { token: sesiSiraga.token, id: opnameAktifId });
      tutupFormOpnameFisik();
      await muatRiwayatOpname();
    } catch (err) { showError(err.message || 'Gagal membatalkan opname.'); }
  });

  function tutupFormOpnameFisik() {
    opnameAktifId = null;
    document.getElementById('opnameFormFisik').classList.add('is-hidden');
    document.getElementById('opnameFormMulai').style.display = 'block';
    dropdownOpname.reset();
    document.getElementById('btnMulaiOpname').disabled = true;
  }
}

async function muatRiwayatOpname() {
  const list = await apiPost('getSiragaOpnameList', { token: sesiSiraga.token });
  const container = document.getElementById('opnameList');
  if (!list.length) { container.innerHTML = '<div class="empty-state">Belum ada riwayat opname.</div>'; return; }
  container.innerHTML = list.slice(0, 50).map(o => `
    <div class="riwayat-item is-${badgeClassStatusTransaksi(o.status)}">
      <div class="riwayat-item-detail">
        <div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(o.namaBarang)}</strong><span class="riwayat-badge ${badgeClassStatusTransaksi(o.status)}">${o.status}</span></div>
        <div class="riwayat-item-jam">${o.tanggal} · Sistem: ${formatRupiahSederhana(o.stokSistem)} · Fisik: ${o.stokFisik !== '' ? formatRupiahSederhana(o.stokFisik) : '-'} · Selisih: ${o.selisih !== '' ? o.selisih : '-'}</div>
      </div>
    </div>`).join('');
}

// ============================================================
// KARTU STOK
// ============================================================
let kartuStokSiap = false;
function inisialisasiKartuStok() {
  if (kartuStokSiap) return;
  kartuStokSiap = true;
  buatSearchableDropdown('kartuStokBarangDropdown', {
    placeholder: 'Cari barang...', fetchList: fetchBarangUntukDropdown,
    onSelect: async (item) => {
      const hasilDiv = document.getElementById('kartuStokHasil');
      hasilDiv.innerHTML = '<div class="empty-state">Memuat kartu stok...</div>';
      try {
        const hasil = await apiPost('getSiragaKartuStok', { token: sesiSiraga.token, idBarang: item.id });
        if (!hasil.kartu.length) { hasilDiv.innerHTML = '<div class="empty-state">Belum ada mutasi untuk barang ini.</div>'; return; }
        hasilDiv.innerHTML = `
          <div class="stat-tile" style="margin:14px 0;"><span class="stat-tile-num">${formatRupiahSederhana(hasil.saldoAkhir)}</span><span class="stat-tile-label">Saldo Akhir</span></div>
          <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="text-align:left;border-bottom:2px solid var(--color-border);"><th style="padding:6px;">Tgl</th><th>Jenis</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr></thead>
            <tbody>${hasil.kartu.map(k => `<tr style="border-bottom:1px solid var(--color-border);"><td style="padding:6px;">${k.tanggal}</td><td>${k.jenis}</td><td>${k.masuk || ''}</td><td>${k.keluar || ''}</td><td><strong>${formatRupiahSederhana(k.saldo)}</strong></td></tr>`).join('')}</tbody>
          </table></div>`;
      } catch (err) { hasilDiv.innerHTML = '<div class="empty-state">Gagal memuat.</div>'; showError(err.message); }
    }
  });
}

// ============================================================
// BATCH & KEDALUWARSA
// ============================================================
async function muatBatchList() {
  document.getElementById('btnMuatBatch').addEventListener('click', muatBatchList_);
  await muatBatchList_();
}
async function muatBatchList_() {
  const status = document.getElementById('batchFilterStatus').value;
  const list = await apiPost('getSiragaBatchListAdmin', { token: sesiSiraga.token, statusExpired: status });
  const container = document.getElementById('batchList');
  if (!list.length) { container.innerHTML = '<div class="empty-state">Tidak ada batch ditemukan.</div>'; return; }
  container.innerHTML = list.map(b => `
    <div class="riwayat-item is-${badgeClassStatusExpired(b.statusExpired)}">
      <div class="riwayat-item-detail">
        <div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(b.namaBarang)}</strong><span class="riwayat-badge ${badgeClassStatusExpired(b.statusExpired)}">${b.statusExpired || '-'}</span></div>
        <div class="riwayat-item-jam">${b.nomorBatch} · Expired: ${b.tanggalExpired || '-'} · Stok: ${formatRupiahSederhana(b.stok)}</div>
      </div>
    </div>`).join('');
}

// ============================================================
// LAPORAN (daftar transaksi + filter)
// ============================================================
async function muatLaporanList() {
  document.getElementById('btnMuatLaporan').addEventListener('click', muatLaporanList_);
  await muatLaporanList_();
}
async function muatLaporanList_() {
  const jenis = document.getElementById('laporanFilterJenis').value;
  const status = document.getElementById('laporanFilterStatus').value;
  const list = await apiPost('getSiragaTransaksiList', { token: sesiSiraga.token, jenis: jenis, status: status });
  const container = document.getElementById('laporanList');
  if (!list.length) { container.innerHTML = '<div class="empty-state">Tidak ada transaksi ditemukan.</div>'; return; }
  container.innerHTML = list.map(t => `
    <div class="riwayat-item is-${badgeClassStatusTransaksi(t.status)}">
      <div class="riwayat-item-detail">
        <div class="riwayat-item-top"><strong class="riwayat-item-shift">${t.nomor}</strong><span class="riwayat-badge ${badgeClassStatusTransaksi(t.status)}">${t.status}</span></div>
        <div class="riwayat-item-jam">${t.jenis} · ${t.tanggal} · ${escapeHtml(t.namaPetugas)}</div>
        ${t.keterangan ? `<div class="riwayat-item-jam">${escapeHtml(t.keterangan)}</div>` : ''}
      </div>
    </div>`).join('');
}

// ============================================================
// MASTER DATA (Admin: Kategori, Supplier, Tambah Barang)
// ============================================================
async function muatMasterDataAwal() {
  document.querySelectorAll('#siragaSubMasterData .stok-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#siragaSubMasterData .stok-subtab').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('msubKategori').style.display = btn.dataset.msub === 'kategori' ? 'block' : 'none';
      document.getElementById('msubSupplier').style.display = btn.dataset.msub === 'supplier' ? 'block' : 'none';
      document.getElementById('msubTambahBarang').style.display = btn.dataset.msub === 'tambahbarang' ? 'block' : 'none';
    });
  });
  await muatKategoriList();
  await muatSupplierList();

  const selKategori = document.getElementById('barangBaruKategori');
  const kategoriList = await apiPost('getSiragaKategoriList', { token: sesiSiraga.token });
  kategoriList.forEach(k => selKategori.insertAdjacentHTML('beforeend', `<option value="${k.id}">${escapeHtml(k.nama)}</option>`));
  const selSatuan = document.getElementById('barangBaruSatuan');
  const satuanList = await apiPost('getSiragaSatuanList', {});
  satuanList.forEach(s => selSatuan.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`));

  document.getElementById('btnTambahKategori').addEventListener('click', async () => {
    const nama = document.getElementById('kategoriBaruNama').value.trim();
    if (!nama) return;
    try {
      await apiPost('addSiragaKategori', { token: sesiSiraga.token, nama: nama });
      document.getElementById('kategoriBaruNama').value = '';
      await muatKategoriList();
    } catch (err) { showError(err.message); }
  });

  document.getElementById('btnTambahSupplier').addEventListener('click', async () => {
    const nama = document.getElementById('supplierBaruNama').value.trim();
    if (!nama) return;
    try {
      await apiPost('addSiragaSupplier', {
        token: sesiSiraga.token, nama: nama,
        kontak: document.getElementById('supplierBaruKontak').value.trim(),
        alamat: document.getElementById('supplierBaruAlamat').value.trim()
      });
      document.getElementById('supplierBaruNama').value = '';
      document.getElementById('supplierBaruKontak').value = '';
      document.getElementById('supplierBaruAlamat').value = '';
      await muatSupplierList();
    } catch (err) { showError(err.message); }
  });

  document.getElementById('btnSimpanBarangBaru').addEventListener('click', async () => {
    const tombol = document.getElementById('btnSimpanBarangBaru');
    try {
      const nama = document.getElementById('barangBaruNama').value.trim();
      const idKategori = selKategori.value;
      const satuan = selSatuan.value;
      if (!nama || !idKategori || !satuan) throw new Error('Nama, Kategori, dan Satuan wajib diisi.');
      tombol.disabled = true;
      await apiPost('addSiragaBarang', {
        token: sesiSiraga.token, nama: nama, idKategori: idKategori, satuan: satuan,
        stokMinimum: Number(document.getElementById('barangBaruStokMinimum').value) || 0,
        kelolaBatch: document.getElementById('barangBaruKelolaBatch').checked,
        kelolaExpired: document.getElementById('barangBaruKelolaExpired').checked
      });
      showError('✅ Barang berhasil ditambahkan.');
      document.getElementById('barangBaruNama').value = '';
      document.getElementById('barangBaruStokMinimum').value = '0';
      document.getElementById('barangBaruKelolaBatch').checked = false;
      document.getElementById('barangBaruKelolaExpired').checked = false;
      delete sudahDimuatTab.barang;
    } catch (err) { showError(err.message || 'Gagal menambah barang.'); }
    finally { tombol.disabled = false; }
  });
}

async function muatKategoriList() {
  const list = await apiPost('getSiragaKategoriListAdmin', { token: sesiSiraga.token });
  document.getElementById('kategoriList').innerHTML = list.map(k => `
    <div class="riwayat-item is-${k.status === 'AKTIF' ? 'hadir' : 'tidak-hadir'}">
      <div class="riwayat-item-detail"><div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(k.nama)}</strong>
      <button class="btn-mini" data-id="${k.id}" data-status="${k.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'}" onclick="toggleStatusKategori(this)">${k.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button></div></div>
    </div>`).join('') || '<div class="empty-state">Belum ada kategori.</div>';
}
async function toggleStatusKategori(btn) {
  try { await apiPost('updateSiragaKategoriStatus', { token: sesiSiraga.token, id: btn.dataset.id, status: btn.dataset.status }); await muatKategoriList(); }
  catch (err) { showError(err.message); }
}

async function muatSupplierList() {
  const list = await apiPost('getSiragaSupplierListAdmin', { token: sesiSiraga.token });
  document.getElementById('supplierList').innerHTML = list.map(s => `
    <div class="riwayat-item is-${s.status === 'AKTIF' ? 'hadir' : 'tidak-hadir'}">
      <div class="riwayat-item-detail"><div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(s.nama)}</strong>
      <button class="btn-mini" data-id="${s.id}" data-status="${s.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'}" onclick="toggleStatusSupplier(this)">${s.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button></div>
      <div class="riwayat-item-jam">${escapeHtml(s.kontak || '-')}</div></div>
    </div>`).join('') || '<div class="empty-state">Belum ada supplier.</div>';
}
async function toggleStatusSupplier(btn) {
  try { await apiPost('updateSiragaSupplier', { token: sesiSiraga.token, id: btn.dataset.id, status: btn.dataset.status }); await muatSupplierList(); }
  catch (err) { showError(err.message); }
}

// ============================================================
// PENGATURAN (Admin: Hak Akses, Log Aktivitas)
// ============================================================
async function muatPengaturanAwal() {
  document.querySelectorAll('#siragaSubPengaturan .stok-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#siragaSubPengaturan .stok-subtab').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('psubHakAkses').style.display = btn.dataset.psub === 'hakakses' ? 'block' : 'none';
      document.getElementById('psubLog').style.display = btn.dataset.psub === 'log' ? 'block' : 'none';
      if (btn.dataset.psub === 'log') muatLogAktivitas();
    });
  });
  await muatHakAkses();
}

async function muatHakAkses() {
  const [petugas, semuaRelawan] = await Promise.all([
    apiGet('getDaftarPetugasStok', { token: sesiSiraga.token }),
    apiGet('getRelawan', { token: sesiSiraga.token, semua: '0' })
  ]);
  const idPetugasSet = new Set(petugas.map(p => p.idRelawan));
  const container = document.getElementById('hakAksesList');
  container.innerHTML = `
    <p class="section-title">Petugas Stok Saat Ini</p>
    ${petugas.map(p => `<div class="riwayat-item is-hadir"><div class="riwayat-item-detail"><div class="riwayat-item-top"><strong class="riwayat-item-shift">${escapeHtml(p.nama)}</strong>
      <button class="btn-mini" data-id="${p.idRelawan}" data-jadi="false" onclick="ubahRoleStok(this)">Cabut Akses</button></div></div></div>`).join('') || '<div class="empty-state">Belum ada Petugas Stok.</div>'}
    <p class="section-title" style="margin-top:18px;">Tambahkan Petugas Baru</p>
    <select id="pilihRelawanBaruPetugas" class="form-field-input" style="margin-bottom:8px;">
      <option value="">— Pilih Relawan —</option>
      ${semuaRelawan.filter(r => !idPetugasSet.has(r.id)).map(r => `<option value="${r.id}">${escapeHtml(r.nama)}</option>`).join('')}
    </select>
    <button class="btn-submit" id="btnJadikanPetugas">+ Berikan Akses Petugas Stok</button>
  `;
  document.getElementById('btnJadikanPetugas').addEventListener('click', async () => {
    const id = document.getElementById('pilihRelawanBaruPetugas').value;
    if (!id) return;
    try { await apiPost('setRoleStok', { token: sesiSiraga.token, idRelawan: id, jadikanPetugas: true }); await muatHakAkses(); }
    catch (err) { showError(err.message); }
  });
}
async function ubahRoleStok(btn) {
  try { await apiPost('setRoleStok', { token: sesiSiraga.token, idRelawan: btn.dataset.id, jadikanPetugas: btn.dataset.jadi === 'true' }); await muatHakAkses(); }
  catch (err) { showError(err.message); }
}

async function muatLogAktivitas() {
  const list = await apiPost('getSiragaActivityLogs', { token: sesiSiraga.token });
  document.getElementById('logAktivitasList').innerHTML = list.map(l => `
    <div class="riwayat-item is-belum-absen"><div class="riwayat-item-detail">
      <div class="riwayat-item-top"><strong class="riwayat-item-shift">${l.aksi}</strong></div>
      <div class="riwayat-item-jam">${escapeHtml(l.aktor)} · ${l.waktu ? new Date(l.waktu).toLocaleString('id-ID') : '-'}</div>
    </div></div>`).join('') || '<div class="empty-state">Belum ada log.</div>';
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  sesiSiraga = ambilSesiRelawan();
  if (!sesiSiraga || !sesiSiraga.token) {
    window.location.href = 'login.html';
    return;
  }

  document.querySelectorAll('#siragaTabbar .stok-subtab').forEach(btn => {
    btn.addEventListener('click', () => pindahTabSiraga(btn.dataset.tab));
  });
  document.getElementById('barangCari').addEventListener('input', (e) => {
    clearTimeout(window._siragaCariTimeout);
    window._siragaCariTimeout = setTimeout(() => muatDaftarBarang(e.target.value.trim()), 350);
  });

  // Tab Master Data & Pengaturan ditampilkan ke semua yang berhasil
  // masuk (Petugas Stok/Staff/Admin) -- AKSI TULIS di dalamnya (tambah
  // kategori/supplier/barang, ubah Hak Akses) tetap digerbangi khusus
  // Admin di BACKEND (requireSiragaAdmin_), sesuai prinsip "Backend
  // adalah pengaman utama" (§28). Kalau Petugas Stok mencoba aksi tulis,
  // akan muncul pesan jelas dari server, bukan disembunyikan diam-diam.
  document.getElementById('tabMasterData').style.display = 'inline-block';
  document.getElementById('tabPengaturan').style.display = 'inline-block';

  try {
    await pindahTabSiraga('dashboard');
  } catch (err) {
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Anda tidak memiliki izin mengakses modul SIRAGA, atau server belum siap (SIRAGA_SPREADSHEET_ID belum diisi Admin).');
  }
});

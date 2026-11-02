// SPPG JEUNGJING — STOK & PERSEDIAAN (Petugas Stok / relawan terbatas)
// Memakai sesi relawan yang sudah ada (auth-relawan.js). Backend
// (Stok.gs -> requireStokAccess_) yang menentukan boleh/tidaknya akses,
// bukan halaman ini -- kalau akun bukan Petugas Stok, panggilan API
// pertama akan gagal dan halaman menampilkan pesan "Akses Ditolak".

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }
  const token = sesi.token;

  const el = {
    ditolak: document.getElementById('stokAksesDitolak'),
    konten: document.getElementById('stokKontenUtama'),
    tabs: document.querySelectorAll('#stokTabs .chip-tab'),
    subs: document.querySelectorAll('.stok-sub'),

    stokTotalJenis: document.getElementById('stokTotalJenis'),
    stokAman: document.getElementById('stokAman'),
    stokMenipis: document.getElementById('stokMenipis'),
    stokHabis: document.getElementById('stokHabis'),
    stokPerluPerhatian: document.getElementById('stokPerluPerhatian'),

    stokCariBarang: document.getElementById('stokCariBarang'),
    stokDaftarBarang: document.getElementById('stokDaftarBarang'),

    masukSumber: document.getElementById('masukSumber'),
    masukDaftarItem: document.getElementById('masukDaftarItem'),
    btnTambahBarisMasuk: document.getElementById('btnTambahBarisMasuk'),
    masukKeterangan: document.getElementById('masukKeterangan'),
    btnSimpanMasuk: document.getElementById('btnSimpanMasuk'),

    keluarTujuan: document.getElementById('keluarTujuan'),
    keluarDaftarItem: document.getElementById('keluarDaftarItem'),
    btnTambahBarisKeluar: document.getElementById('btnTambahBarisKeluar'),
    keluarKeterangan: document.getElementById('keluarKeterangan'),
    btnSimpanKeluar: document.getElementById('btnSimpanKeluar'),

    stokRiwayatList: document.getElementById('stokRiwayatList')
  };

  let cacheBarang = [];

  // --------------------------------------------------------
  // Cek akses dulu lewat dashboard -- kalau ditolak, hentikan semua.
  // --------------------------------------------------------
  try {
    showLoading('Memeriksa akses...');
    await muatDashboard();
    hideLoading();
    el.konten.style.display = 'block';
  } catch (err) {
    hideLoading();
    el.ditolak.style.display = 'block';
    return; // jangan pasang listener apa pun lagi -- akses memang ditolak
  }

  // --------------------------------------------------------
  // SUB-TAB
  // --------------------------------------------------------
  el.tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      el.tabs.forEach(b => b.classList.remove('active'));
      el.subs.forEach(s => { s.style.display = 'none'; });
      btn.classList.add('active');
      const target = document.getElementById('stokSub' + btn.dataset.sub.charAt(0).toUpperCase() + btn.dataset.sub.slice(1));
      if (target) target.style.display = 'block';

      if (btn.dataset.sub === 'ringkasan') muatDashboard();
      else if (btn.dataset.sub === 'barang') muatDataBarang();
      else if (btn.dataset.sub === 'riwayat') muatRiwayat();
      else if (btn.dataset.sub === 'masuk' && !el.masukDaftarItem.children.length) tambahBarisItem_(el.masukDaftarItem);
      else if (btn.dataset.sub === 'keluar' && !el.keluarDaftarItem.children.length) tambahBarisItem_(el.keluarDaftarItem);
    });
  });

  // --------------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------------
  async function muatDashboard() {
    const d = await apiGet('getStokDashboard', { token });
    el.stokTotalJenis.textContent = d.totalJenisBarang;
    el.stokAman.textContent = d.stokAman;
    el.stokMenipis.textContent = d.stokMenipis;
    el.stokHabis.textContent = d.stokHabis;

    if (!d.perluPerhatian.length) {
      el.stokPerluPerhatian.innerHTML = '<div class="empty-state">Semua stok dalam kondisi aman. 🎉</div>';
      return;
    }
    el.stokPerluPerhatian.innerHTML = d.perluPerhatian.map(b => `
      <div class="stok-perhatian-row">
        <div><p>${escapeHtml(b.nama)}</p><small>Stok: ${b.stok} ${escapeHtml(b.satuan)} · Minimum: ${b.minimum} ${escapeHtml(b.satuan)}</small></div>
        <span class="stok-badge stok-badge-${b.status.toLowerCase()}">${b.status === 'HABIS' ? '🔴 Habis' : '🟡 Menipis'}</span>
      </div>`).join('');
  }

  // --------------------------------------------------------
  // DATA BARANG (lihat saja)
  // --------------------------------------------------------
  async function muatDataBarang() {
    el.stokDaftarBarang.innerHTML = '<div class="empty-state">Memuat data...</div>';
    try {
      cacheBarang = await apiGet('getDataBarangList', { token, cari: el.stokCariBarang.value.trim() });
      if (!cacheBarang.length) { el.stokDaftarBarang.innerHTML = '<div class="empty-state">Belum ada barang terdaftar.</div>'; return; }
      el.stokDaftarBarang.innerHTML = cacheBarang.map(b => `
        <div class="stok-perhatian-row">
          <div><p><strong>${escapeHtml(b.kode || '-')}</strong> — ${escapeHtml(b.nama)}</p><small>${escapeHtml(b.namaKategori)} · Stok: ${b.stok} ${escapeHtml(b.satuan)}</small></div>
          <span class="stok-badge stok-badge-${b.status.toLowerCase()}">${b.status === 'AMAN' ? '🟢' : b.status === 'MENIPIS' ? '🟡' : '🔴'} ${b.status}</span>
        </div>`).join('');
    } catch (err) {
      showError(err.message);
    }
  }
  el.stokCariBarang.addEventListener('keydown', (e) => { if (e.key === 'Enter') muatDataBarang(); });

  // --------------------------------------------------------
  // BARANG MASUK / KELUAR
  // --------------------------------------------------------
  async function pastikanBarangTermuat_() {
    if (!cacheBarang.length) {
      try { cacheBarang = await apiGet('getDataBarangList', { token }); } catch (err) { showError(err.message); }
    }
  }

  function opsiBarang_(daftar) {
    const sumber = daftar || cacheBarang;
    const opsi = sumber.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.kode ? b.kode + ' — ' : '')}${escapeHtml(b.nama)} (stok: ${b.stok} ${escapeHtml(b.satuan)})</option>`).join('');
    return '<option value="">Pilih barang...</option>' + opsi;
  }

  function tambahBarisItem_(container) {
    const baris = document.createElement('div');
    baris.className = 'stok-item-row';
    baris.innerHTML = `
      <input type="text" class="stok-item-cari" placeholder="🔍 Cari ID/nama barang..." autocomplete="off">
      <select class="stok-item-barang">${opsiBarang_()}</select>
      <input type="number" class="stok-item-jumlah" placeholder="Jumlah" min="0.01" step="0.01">
      <button type="button" title="Hapus baris">🗑</button>`;
    baris.querySelector('button').addEventListener('click', () => baris.remove());

    const inputCari = baris.querySelector('.stok-item-cari');
    const select = baris.querySelector('.stok-item-barang');
    inputCari.addEventListener('input', () => {
      const kata = inputCari.value.trim().toLowerCase();
      const nilaiSebelumnya = select.value;
      const hasil = !kata ? cacheBarang : cacheBarang.filter(b =>
        String(b.id).toLowerCase().includes(kata) ||
        String(b.nama).toLowerCase().includes(kata) ||
        String(b.kode || '').toLowerCase().includes(kata)
      );
      select.innerHTML = opsiBarang_(hasil);
      if (hasil.some(b => b.id === nilaiSebelumnya)) select.value = nilaiSebelumnya;
    });

    container.appendChild(baris);
  }

  el.btnTambahBarisMasuk.addEventListener('click', async () => { await pastikanBarangTermuat_(); tambahBarisItem_(el.masukDaftarItem); });
  el.btnTambahBarisKeluar.addEventListener('click', async () => { await pastikanBarangTermuat_(); tambahBarisItem_(el.keluarDaftarItem); });

  function ambilItemDariContainer_(container) {
    return Array.from(container.querySelectorAll('.stok-item-row')).map(baris => ({
      idBarang: baris.querySelector('.stok-item-barang').value,
      jumlah: Number(baris.querySelector('.stok-item-jumlah').value)
    })).filter(it => it.idBarang && it.jumlah > 0);
  }

  el.btnSimpanMasuk.addEventListener('click', async () => {
    const items = ambilItemDariContainer_(el.masukDaftarItem);
    if (!items.length) { showError('Isi minimal 1 barang dengan jumlah yang valid.'); return; }
    try {
      showLoading('Menyimpan transaksi barang masuk...');
      const hasil = await apiPost('simpanBarangMasuk', { token, sumberTujuan: el.masukSumber.value.trim(), keterangan: el.masukKeterangan.value.trim(), items });
      hideLoading();
      showSuccess('Barang masuk tersimpan (' + hasil.nomorTransaksi + ').');
      el.masukDaftarItem.innerHTML = ''; el.masukSumber.value = ''; el.masukKeterangan.value = '';
      tambahBarisItem_(el.masukDaftarItem);
      cacheBarang = [];
      await muatDashboard();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  el.btnSimpanKeluar.addEventListener('click', async () => {
    const items = ambilItemDariContainer_(el.keluarDaftarItem);
    if (!items.length) { showError('Isi minimal 1 barang dengan jumlah yang valid.'); return; }
    try {
      showLoading('Menyimpan transaksi barang keluar...');
      const hasil = await apiPost('simpanBarangKeluar', { token, sumberTujuan: el.keluarTujuan.value.trim(), keterangan: el.keluarKeterangan.value.trim(), items });
      hideLoading();
      showSuccess('Barang keluar tersimpan (' + hasil.nomorTransaksi + ').');
      el.keluarDaftarItem.innerHTML = ''; el.keluarTujuan.value = ''; el.keluarKeterangan.value = '';
      tambahBarisItem_(el.keluarDaftarItem);
      cacheBarang = [];
      await muatDashboard();
    } catch (err) {
      hideLoading();
      showError(err.message); // termasuk pesan "Stok tidak mencukupi..." dari backend
    }
  });

  // --------------------------------------------------------
  // RIWAYAT
  // --------------------------------------------------------
  async function muatRiwayat() {
    el.stokRiwayatList.innerHTML = '<div class="empty-state">Memuat data...</div>';
    try {
      const list = await apiGet('getRiwayatStokList', { token });
      if (!list.length) { el.stokRiwayatList.innerHTML = '<div class="empty-state">Belum ada transaksi.</div>'; return; }
      el.stokRiwayatList.innerHTML = list.map(r => `
        <div class="stok-perhatian-row">
          <div><p>${r.jenis === 'MASUK' ? '📥' : '📤'} ${escapeHtml(r.namaBarang)} · ${r.jumlah} ${escapeHtml(r.satuan)}</p>
          <small>${escapeHtml(r.tanggal)} · ${escapeHtml(r.nomorTransaksi)} · Petugas: ${escapeHtml(r.petugas)}</small></div>
        </div>`).join('');
    } catch (err) {
      showError(err.message);
    }
  }
});

// SPPG JEUNGJING — ADMIN: SIPANDU › Master Instansi & PIC (panelSipanduMaster)
// BARU 3 Nov 2026. Membaca/menulis DATABASE SIPANDU BARU lewat SipanduV2.gs.
// Pola aditif seperti admin-rekap-mingguan.js: tidak mengubah admin.js. Memakai ambilSesiAdmin & apiPost (common).
(function () {
  const panel = document.getElementById('panelSipanduMaster');
  if (!panel) return;
  const root = document.getElementById('spmRoot');
  const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const $ = function (id) { return document.getElementById(id); };
  const hariIni = function () { const d = new Date(), z = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const api = function (aksi, payload) { return apiPost(aksi, Object.assign({ token: ambilSesiAdmin().token }, payload || {})); };
  const BELUM = 'SIPANDU_V2_BELUM_DISAMBUNGKAN';
  let data = null, bagian = 'instansi', sudahMuat = false;

  function pesan(teks, galat) {
    const el = $('spmPesan'); if (!el) return;
    el.textContent = teks || ''; el.style.color = galat ? '#c0392b' : '#2e7d32'; el.style.margin = '8px 0';
  }
  function kartuBelumTersambung(teks) {
    root.innerHTML = '<div class="admin-stat-card accent-warning" style="padding:16px;text-align:left;">' +
      '<div style="font-weight:700;margin-bottom:6px;">Database SIPANDU baru belum disambungkan</div>' +
      '<div style="font-size:13px;line-height:1.6;">' + (teks ? esc(teks) + '<br>' : '') +
      '1. Unggah <b>DATABASE_SIPANDU_BARU_SPPG_JEUNGJING.xlsx</b> ke Google Drive, buka dengan Google Sheets, lalu <i>File → Simpan sebagai Google Sheets</i>.<br>' +
      '2. Di editor Apps Script Portal, buka berkas <code>SipanduV2</code>, ganti teks <code>GANTI_DENGAN_ID_SPREADSHEET</code> pada fungsi <code>hubungkanSipanduV2</code> dengan ID spreadsheet (bagian tautan antara <code>/d/</code> dan <code>/edit</code>), pilih fungsi itu di menu atas, klik <b>Run</b>. Hasilnya tampil di <i>Execution log</i>.<br>' +
      '3. Muat ulang halaman ini.</div></div>';
  }
  function bentukKerangka() {
    root.innerHTML =
      '<div class="filter-bar"><button class="btn-mini primary" id="spmTabInstansi" type="button">Instansi</button><button class="btn-mini" id="spmTabPic" type="button">PIC</button></div>' +
      '<div id="spmPesan" style="font-size:13px;"></div><div id="spmBagian"></div>';
    $('spmTabInstansi').addEventListener('click', function () { bagian = 'instansi'; render(); });
    $('spmTabPic').addEventListener('click', function () { bagian = 'pic'; render(); });
  }
  const input = function (id, label, nilai, tipe, extra) {
    return '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">' + label + '<input id="' + id + '" type="' + (tipe || 'text') + '" value="' + esc(nilai) + '" ' + (extra || '') + ' style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;font-size:13px;"></label>';
  };
  const pilih = function (id, label, opsi, nilai) {
    return '<label style="display:flex;flex-direction:column;gap:3px;font-size:12px;">' + label + '<select id="' + id + '" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;font-size:13px;">' +
      opsi.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(nilai) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  };
  const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:10px 0;';

  // ------------------------------- INSTANSI -------------------------------
  function ringkasAcuan(r) {
    const bagian = [];
    if (r.acuanPk !== null || r.acuanPb !== null) bagian.push('PK ' + (r.acuanPk === null ? '-' : r.acuanPk) + ' · PB ' + (r.acuanPb === null ? '-' : r.acuanPb));
    if (r.acuanBalita !== null || r.acuanBumil !== null || r.acuanBusui !== null) bagian.push('Bal ' + (r.acuanBalita === null ? '-' : r.acuanBalita) + ' · Bumil ' + (r.acuanBumil === null ? '-' : r.acuanBumil) + ' · Busui ' + (r.acuanBusui === null ? '-' : r.acuanBusui));
    return bagian.join(' | ') || '—';
  }
  /** Jumlah siswa yang DIPAKAI: isian manual, atau otomatis dari acuan PK + PB (ditandai), atau kosong. Hanya berlaku untuk sekolah. */
  function siswaTeks(r) {
    if (r.jenis !== 'SEKOLAH') return '<span style="color:var(--color-text-muted,#55606f);">—</span>';
    if (r.jumlahSiswa !== null) return String(r.jumlahSiswa);
    if (r.jumlahSiswaOtomatis !== null && r.jumlahSiswaOtomatis !== undefined) return r.jumlahSiswaOtomatis + ' <span style="font-size:10.5px;color:#1565c0;" title="Otomatis = acuan PK + PB">otomatis</span>';
    return '<span style="color:#c0392b;">kosong</span>';
  }
  function isiTabelInstansi() {
    const kata = $('spmCari').value.toLowerCase(), st = $('spmStatus').value;
    const baris = data.instansi.filter(function (r) { return (!st || r.status === st) && (!kata || (r.nama + ' ' + r.npsn + ' ' + r.namaPic).toLowerCase().indexOf(kata) >= 0); });
    $('spmTbody').innerHTML = baris.length ? baris.map(function (r) {
      return '<tr' + (r.status === 'AKTIF' ? '' : ' style="opacity:.62;"') + '><td>' + esc(r.nama) + '<div style="font-size:11px;color:var(--color-text-muted,#55606f);">' + esc(r.idInstansi) + '</div></td><td>' + esc(r.jenis) + '</td><td>' + esc(r.npsn || '—') + '</td>' +
        '<td>' + esc([r.desa, r.kecamatan].filter(Boolean).join(', ') || '—') + '</td><td>' + (r.namaPic ? esc(r.namaPic) + '<div style="font-size:11px;color:var(--color-text-muted,#55606f);">' + esc(r.jabatanPic) + '</div>' : '<span style="color:#c0392b;">belum ada</span>') + '</td>' +
        '<td>' + siswaTeks(r) + '</td><td style="font-size:12px;">' + esc(ringkasAcuan(r)) + '</td><td><b style="color:' + (r.status === 'AKTIF' ? '#1a7a4c' : '#b23a3a') + ';">' + esc(r.status) + '</b></td>' +
        '<td style="white-space:nowrap;"><button class="btn-mini" data-aksi="ubah" data-id="' + esc(r.idInstansi) + '" type="button">Ubah</button> <button class="btn-mini" data-aksi="gantipic" data-id="' + esc(r.idInstansi) + '" type="button">Ganti PIC</button> ' +
        (data.bolehEdit === false ? '' : '<button class="btn-mini" data-aksi="status" data-ke="' + (r.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF') + '" data-id="' + esc(r.idInstansi) + '" type="button" style="' + (r.status === 'AKTIF' ? 'color:#b23a3a;' : 'color:#1a7a4c;font-weight:700;') + '">' + (r.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan') + '</button>') + '</td></tr>';
    }).join('') : '<tr><td colspan="9"><div class="empty-state">Tidak ada instansi.</div></td></tr>';
  }
  function renderInstansi() {
    $('spmBagian').innerHTML =
      '<div class="filter-bar"><input id="spmCari" placeholder="Cari nama / NPSN / PIC" style="padding:7px;border:1px solid var(--color-border,#d5dbe3);border-radius:8px;">' +
      '<select id="spmStatus"><option value="">Semua status</option><option value="AKTIF">AKTIF</option><option value="NONAKTIF">NONAKTIF</option></select>' +
      '<button class="btn-mini primary" id="spmTambah" type="button">+ Tambah Instansi</button></div>' +
      '<div id="spmForm"></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Instansi</th><th>Jenis</th><th>NPSN</th><th>Wilayah</th><th>PIC</th><th>Jml Siswa</th><th>Acuan</th><th>Status</th><th></th></tr></thead><tbody id="spmTbody"></tbody></table></div>';
    isiTabelInstansi();
    $('spmCari').addEventListener('input', isiTabelInstansi); $('spmStatus').addEventListener('change', isiTabelInstansi);
    $('spmTambah').addEventListener('click', function () { formInstansi(null); });
    $('spmTbody').addEventListener('click', function (e) {
      const b = e.target.closest('button[data-aksi]'); if (!b) return;
      const r = data.instansi.filter(function (x) { return x.idInstansi === b.dataset.id; })[0];
      if (b.dataset.aksi === 'ubah') formInstansi(r);
      else if (b.dataset.aksi === 'status') ubahStatus(r, b.dataset.ke);
      else formGantiPic(r);
    });
  }
  async function ubahStatus(r, ke) {
    const aktif = ke === 'AKTIF';
    if (!confirm((aktif ? 'Aktifkan ' : 'Nonaktifkan ') + r.nama + '?\n\n' + (aktif ? 'Instansi akan kembali muncul di Manajemen PM, kalender, dan dashboard.' : 'Instansi tidak lagi muncul di Manajemen PM, kalender, dan dashboard. Data lama tetap tersimpan.'))) return;
    try { pesan('Menyimpan…'); await api('setStatusInstansiV2', { idInstansi: r.idInstansi, status: ke }); await muat(true); pesan(r.nama + (aktif ? ' diaktifkan.' : ' dinonaktifkan.')); }
    catch (err) { pesan(err.message || 'Gagal mengubah status.', true); }
  }
  function formInstansi(r) {
    r = r || { idInstansi: '', nama: '', jenis: data.jenis[0] ? data.jenis[0].kode : '', npsn: '', alamat: '', desa: '', kecamatan: '', jumlahSiswa: null, urutan: null, status: 'AKTIF', keterangan: '', acuanPk: null, acuanPb: null, acuanBalita: null, acuanBumil: null, acuanBusui: null, acuanNoKendaraan: '' };
    const nv = function (v) { return v === null || v === undefined ? '' : v; };
    $('spmForm').innerHTML = '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-bottom:12px;"><b>' + (r.idInstansi ? 'Ubah ' + esc(r.idInstansi) : 'Instansi baru') + '</b><div style="' + grid + '">' +
      input('fiNama', 'Nama instansi *', r.nama) + pilih('fiJenis', 'Jenis *', data.jenis.map(function (j) { return [j.kode, j.nama]; }), r.jenis) + input('fiNpsn', 'NPSN (bila ada)', r.npsn) +
      input('fiAlamat', 'Alamat', r.alamat) + input('fiDesa', 'Desa/Kelurahan', r.desa) + input('fiKec', 'Kecamatan', r.kecamatan) +
      input('fiUrut', 'Urutan tampil', r.urutan === null ? '' : r.urutan, 'number', 'min="0"') +
      pilih('fiStatus', 'Status', [['AKTIF', 'AKTIF'], ['NONAKTIF', 'NONAKTIF']], r.status) + input('fiKet', 'Keterangan', r.keterangan) + '</div>' +
      '<div style="font-size:12px;font-weight:700;margin-top:6px;">Acuan (nilai awal pengisian PM Harian)</div><div style="font-size:11.5px;color:var(--color-text-muted,#55606f);">Dipakai tombol "Isi dari Acuan" di Manajemen PM. <b>Bukan sumber laporan</b>: dashboard, website, kalender, dokumen, dan pagu membaca PM Harian.</div>' +
      '<div id="fiGrupSekolah" style="' + grid + '">' + input('fiAcPk', 'Acuan PK (porsi kecil)', nv(r.acuanPk), 'number', 'min="0"') + input('fiAcPb', 'Acuan PB (porsi besar)', nv(r.acuanPb), 'number', 'min="0"') +
      '<div>' + input('fiSiswa', 'Jumlah siswa (kosong = otomatis PK + PB)', r.jumlahSiswa === null ? '' : r.jumlahSiswa, 'number', 'min="0"') + '<div id="fiSiswaInfo" style="font-size:11.5px;color:#1565c0;margin-top:3px;"></div></div></div>' +
      '<div id="fiGrupPosyandu" style="' + grid + '">' + input('fiAcBalita', 'Acuan Balita', nv(r.acuanBalita), 'number', 'min="0"') + input('fiAcBumil', 'Acuan Ibu Hamil', nv(r.acuanBumil), 'number', 'min="0"') + input('fiAcBusui', 'Acuan Ibu Menyusui', nv(r.acuanBusui), 'number', 'min="0"') + '</div>' +
      '<div style="' + grid + '">' + input('fiAcKend', 'Acuan No. Kendaraan', r.acuanNoKendaraan) + '</div>' +
      '<button class="btn-mini primary" id="fiSimpan" type="button">Simpan</button> <button class="btn-mini" id="fiBatal" type="button">Batal</button></div>';
    // Kelompok isian mengikuti JENIS (permintaan Admin 4 Nov): Sekolah = PK, PB, jumlah siswa; Posyandu = Balita, Ibu Hamil, Ibu Menyusui.
    const kelompok = function () { const j = String($('fiJenis').value || '').toUpperCase(); return { sekolah: j !== 'POSYANDU', posyandu: j !== 'SEKOLAH' }; };
    const infoSiswa = function () {
      const pk = $('fiAcPk').value, pb = $('fiAcPb').value, el = $('fiSiswaInfo'); if (!el) return;
      el.textContent = (pk === '' && pb === '') ? '' : ($('fiSiswa').value === '' ? 'Otomatis dipakai: ' + ((Number(pk) || 0) + (Number(pb) || 0)) + ' siswa (PK ' + (Number(pk) || 0) + ' + PB ' + (Number(pb) || 0) + ')' : 'Isian manual menggantikan otomatis (' + ((Number(pk) || 0) + (Number(pb) || 0)) + ').');
    };
    const terapkanJenis = function () { const k = kelompok(); $('fiGrupSekolah').style.display = k.sekolah ? '' : 'none'; $('fiGrupPosyandu').style.display = k.posyandu ? '' : 'none'; infoSiswa(); };
    $('fiJenis').addEventListener('change', terapkanJenis); ['fiAcPk', 'fiAcPb', 'fiSiswa'].forEach(function (id) { $(id).addEventListener('input', infoSiswa); }); terapkanJenis();
    $('fiBatal').addEventListener('click', function () { $('spmForm').innerHTML = ''; });
    $('fiSimpan').addEventListener('click', async function () {
      try {
        pesan('Menyimpan…');
        const kg = kelompok(), nilaiKel = function (aktifKel, id) { return aktifKel ? $(id).value : ''; };   // kelompok yang tidak relevan dikosongkan
        await api('simpanInstansiV2', { idInstansi: r.idInstansi, nama: $('fiNama').value, jenis: $('fiJenis').value, npsn: $('fiNpsn').value, alamat: $('fiAlamat').value, desa: $('fiDesa').value,
                                        kecamatan: $('fiKec').value, jumlahSiswa: nilaiKel(kg.sekolah, 'fiSiswa'), urutan: $('fiUrut').value, status: $('fiStatus').value, keterangan: $('fiKet').value,
                                        acuanPk: nilaiKel(kg.sekolah, 'fiAcPk'), acuanPb: nilaiKel(kg.sekolah, 'fiAcPb'), acuanBalita: nilaiKel(kg.posyandu, 'fiAcBalita'), acuanBumil: nilaiKel(kg.posyandu, 'fiAcBumil'), acuanBusui: nilaiKel(kg.posyandu, 'fiAcBusui'), acuanNoKendaraan: $('fiAcKend').value });
        await muat(true); pesan('Instansi tersimpan.');
      } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
    });
  }
  function formGantiPic(r) {
    const aktif = data.pic.filter(function (p) { return p.status === 'AKTIF'; });
    $('spmForm').innerHTML = '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-bottom:12px;"><b>Ganti/tetapkan PIC — ' + esc(r.nama) + '</b>' +
      '<div style="font-size:12px;color:var(--color-text-muted,#55606f);margin-top:4px;">PIC saat ini: ' + esc(r.namaPic || 'belum ada') + '. Riwayat tidak dihapus: penugasan lama ditutup sehari sebelum tanggal mulai.</div><div style="' + grid + '">' +
      pilih('gpPic', 'PIC baru *', [['', '— pilih —']].concat(aktif.map(function (p) { return [p.idPic, p.nama + (p.jabatan ? ' (' + p.jabatan + ')' : '')]; })), '') +
      input('gpTanggal', 'Berlaku mulai *', hariIni(), 'date') + input('gpKet', 'Keterangan', '') + '</div>' +
      '<button class="btn-mini primary" id="gpSimpan" type="button">Simpan</button> <button class="btn-mini" id="gpBatal" type="button">Batal</button></div>';
    $('gpBatal').addEventListener('click', function () { $('spmForm').innerHTML = ''; });
    $('gpSimpan').addEventListener('click', async function () {
      try {
        pesan('Menyimpan…');
        await api('tugaskanPicV2', { idInstansi: r.idInstansi, idPic: $('gpPic').value, tanggalMulai: $('gpTanggal').value, keterangan: $('gpKet').value });
        await muat(true); pesan('PIC diperbarui.');
      } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
    });
  }

  // ------------------------------- PIC -------------------------------
  function renderPic() {
    $('spmBagian').innerHTML =
      '<div class="filter-bar"><button class="btn-mini primary" id="spmTambahPic" type="button">+ Tambah PIC</button></div><div id="spmForm"></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Jabatan</th><th>No. HP</th><th>No. Rekening</th><th>Instansi</th><th>Status</th><th></th></tr></thead><tbody>' +
      (data.pic.length ? data.pic.map(function (p) {
        const nama = p.instansiAktif.map(function (id) { const i = data.instansi.filter(function (x) { return x.idInstansi === id; })[0]; return i ? i.nama : id; }).join(', ');
        return '<tr><td>' + esc(p.nama) + '<div style="font-size:11px;color:var(--color-text-muted,#55606f);">' + esc(p.idPic) + '</div></td><td>' + esc(p.jabatan || '—') + '</td><td>' + esc(p.nomorHp || '—') + '</td><td>' + esc(p.nomorRekening || '—') + '</td>' +
          '<td>' + esc(nama || '—') + '</td><td>' + esc(p.status) + '</td><td><button class="btn-mini" data-id="' + esc(p.idPic) + '" type="button">Ubah</button></td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="empty-state">Belum ada PIC.</div></td></tr>') + '</tbody></table></div>';
    $('spmTambahPic').addEventListener('click', function () { formPic(null); });
    $('spmBagian').querySelector('tbody').addEventListener('click', function (e) {
      const b = e.target.closest('button[data-id]'); if (!b) return;
      formPic(data.pic.filter(function (x) { return x.idPic === b.dataset.id; })[0]);
    });
  }
  function formPic(p) {
    p = p || { idPic: '', nama: '', jabatan: '', nomorHp: '', nomorRekening: '', status: 'AKTIF', keterangan: '' };
    $('spmForm').innerHTML = '<div class="admin-stat-card" style="padding:14px;text-align:left;margin-bottom:12px;"><b>' + (p.idPic ? 'Ubah ' + esc(p.idPic) : 'PIC baru') + '</b><div style="' + grid + '">' +
      input('fpNama', 'Nama PIC *', p.nama) + input('fpJabatan', 'Jabatan', p.jabatan) + input('fpHp', 'No. HP', p.nomorHp) + input('fpRek', 'No. Rekening (sensitif)', p.nomorRekening) +
      pilih('fpStatus', 'Status', [['AKTIF', 'AKTIF'], ['NONAKTIF', 'NONAKTIF']], p.status) + input('fpKet', 'Keterangan', p.keterangan) + '</div>' +
      '<button class="btn-mini primary" id="fpSimpan" type="button">Simpan</button> <button class="btn-mini" id="fpBatal" type="button">Batal</button></div>';
    $('fpBatal').addEventListener('click', function () { $('spmForm').innerHTML = ''; });
    $('fpSimpan').addEventListener('click', async function () {
      try {
        pesan('Menyimpan…');
        await api('simpanPicV2', { idPic: p.idPic, nama: $('fpNama').value, jabatan: $('fpJabatan').value, nomorHp: $('fpHp').value, nomorRekening: $('fpRek').value, status: $('fpStatus').value, keterangan: $('fpKet').value });
        await muat(true); pesan('PIC tersimpan.');
      } catch (err) { pesan(err.message || 'Gagal menyimpan.', true); }
    });
  }

  function render() {
    $('spmTabInstansi').className = 'btn-mini' + (bagian === 'instansi' ? ' primary' : '');
    $('spmTabPic').className = 'btn-mini' + (bagian === 'pic' ? ' primary' : '');
    if (bagian === 'instansi') renderInstansi(); else renderPic();
  }
  async function muat(diam) {
    try {
      if (!diam) root.innerHTML = '<div class="empty-state">Memuat…</div>';
      const st = await api('getStatusSipanduV2');
      if (!st.terhubung) { kartuBelumTersambung(st.pesan); return; }
      data = await api('getInstansiV2');
      if (!$('spmBagian')) bentukKerangka();
      render();
    } catch (err) {
      if (String(err.message || '').indexOf(BELUM) >= 0) kartuBelumTersambung(''); else root.innerHTML = '<div class="empty-state" style="color:#c0392b;">' + esc(err.message || 'Gagal memuat.') + '</div>';
    }
  }
  const tombol = document.querySelector('[data-panel="panelSipanduMaster"]');
  if (tombol) tombol.addEventListener('click', function () { if (!sudahMuat) { sudahMuat = true; muat(); } });
})();

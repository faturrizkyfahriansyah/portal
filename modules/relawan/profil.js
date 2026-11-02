// SPPG JEUNGJING — LOGIC HALAMAN PROFIL RELAWAN (profil.html)
// Menggunakan fungsi bersama dari common.js (apiGet, apiPost, dst.)
// dan auth-relawan.js (ambilSesiRelawan, dst.)
//
// REDESIGN: default READ-ONLY, tiap bagian (Data Pribadi/Kontak/Alamat/
// Kontak Darurat) punya tombol "Ubah ..." sendiri -> mode edit -> Simpan
// Perubahan -> kembali read-only. Cooldown 14 hari per BAGIAN (bukan
// per-field) -- backend (Akun.gs: updateDataPribadiRelawan dkk) yang
// menentukan boleh/tidak, di sini cuma menampilkan hasilnya.

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('profilMain');
  let profilTerakhir = null;

  // ---------------------------------------------------------------
  // Util
  // ---------------------------------------------------------------
  function isiAtauBelumDiisi_(el, nilai) {
    if (nilai) { el.textContent = nilai; el.classList.remove('is-kosong'); }
    else { el.textContent = 'Belum diisi'; el.classList.add('is-kosong'); }
  }

  function formatTanggalIndo_(yyyyMmDd) {
    if (!yyyyMmDd) return '';
    const bagian = String(yyyyMmDd).split('-');
    if (bagian.length !== 3) return yyyyMmDd; // format tak dikenal -- tampilkan apa adanya, jangan error
    const [y, m, d] = bagian;
    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const idx = Number(m) - 1;
    if (isNaN(Number(d)) || !namaBulan[idx]) return yyyyMmDd;
    return `${Number(d)} ${namaBulan[idx]} ${y}`;
  }

  function formatTanggalWaktu_(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatTanggalSaja_(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate()} ${namaBulan[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ---------------------------------------------------------------
  // Modal "Data masih terkunci" -- generik, dipakai semua bagian.
  // ---------------------------------------------------------------
  const modalTerkunci = document.getElementById('modalTerkunci');
  const modalTerkunciTeks = document.getElementById('modalTerkunciTeks');
  function tampilkanModalTerkunci_(tanggalBolehLagi) {
    const tgl = tanggalBolehLagi ? formatTanggalSaja_(tanggalBolehLagi) : null;
    modalTerkunciTeks.textContent = tgl
      ? `Data dapat diubah kembali pada ${tgl}.`
      : 'Data ini belum dapat diubah saat ini.';
    modalTerkunci.classList.remove('is-hidden');
  }
  document.getElementById('btnTutupModalTerkunci').addEventListener('click', () => {
    modalTerkunci.classList.add('is-hidden');
  });

  // ---------------------------------------------------------------
  // Toggle mode lihat <-> edit per bagian (generik, dipakai 4 bagian)
  // ---------------------------------------------------------------
  function bukaModeEdit_(bagian) {
    document.getElementById('view' + kapital_(bagian)).classList.add('is-hidden');
    document.getElementById('form' + kapital_(bagian)).classList.remove('is-hidden');
  }
  function tutupModeEdit_(bagian) {
    document.getElementById('form' + kapital_(bagian)).classList.add('is-hidden');
    document.getElementById('view' + kapital_(bagian)).classList.remove('is-hidden');
  }
  function kapital_(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  document.querySelectorAll('.btn-ubah-bagian').forEach(btn => {
    btn.addEventListener('click', () => {
      const bagian = btn.dataset.bagian;
      const info = (profilTerakhir && profilTerakhir.bolehUbah && profilTerakhir.bolehUbah[bagian]) || { boleh: true };
      if (!info.boleh) { tampilkanModalTerkunci_(info.tanggalBolehLagi); return; }
      isiFormDariProfil_(bagian);
      bukaModeEdit_(bagian);
    });
  });
  document.querySelectorAll('.btn-batal-bagian').forEach(btn => {
    btn.addEventListener('click', () => tutupModeEdit_(btn.dataset.bagian));
  });

  function isiFormDariProfil_(bagian) {
    if (!profilTerakhir) return;
    const p = profilTerakhir;
    if (bagian === 'dataPribadi') {
      document.getElementById('inputNik').value = p.nik || '';
      document.getElementById('inputTempatLahir').value = p.tempatLahir || '';
      document.getElementById('inputTanggalLahir').value = p.tanggalLahir || '';
      document.getElementById('inputJenisKelamin').value = p.jenisKelamin || '';
      document.getElementById('inputStatusPernikahan').value = p.statusPernikahan || '';
      document.getElementById('inputAgama').value = p.agama || '';
    } else if (bagian === 'kontak') {
      document.getElementById('inputNoHp').value = p.noHp || '';
      document.getElementById('inputEmail').value = p.email || '';
    } else if (bagian === 'alamat') {
      document.getElementById('inputAlamat').value = p.alamat || '';
    } else if (bagian === 'kontakDarurat') {
      const kd = p.kontakDarurat || {};
      document.getElementById('inputKdNama').value = kd.nama || '';
      document.getElementById('inputKdHubungan').value = kd.hubungan || '';
      document.getElementById('inputKdHubunganLainnya').value = kd.hubunganLainnya || '';
      document.getElementById('groupKdHubunganLainnya').classList.toggle('is-hidden', kd.hubungan !== 'Lainnya');
      document.getElementById('inputKdNoHp').value = kd.noHp || '';
    }
  }

  // Hubungan darurat "Lainnya" -> tampilkan field bebas
  document.getElementById('inputKdHubungan').addEventListener('change', (e) => {
    document.getElementById('groupKdHubunganLainnya').classList.toggle('is-hidden', e.target.value !== 'Lainnya');
  });

  // ---------------------------------------------------------------
  // Muat profil
  // ---------------------------------------------------------------
  async function muatProfil() {
    try {
      showLoading('Memuat profil...');
      const profil = await (window.sppgProfilPromise || apiGet('getProfilRelawan', { token: sesi.token }));
      hideLoading();
      profilTerakhir = profil;

      // Identitas (Admin-managed, read-only)
      document.getElementById('pNama').textContent = profil.nama;
      document.getElementById('pIdRelawan').textContent = profil.id;
      document.getElementById('pDivisi').textContent = profil.divisi;
      isiAtauBelumDiisi_(document.getElementById('pJabatan'), profil.jabatan);
      document.getElementById('pStatusAkun').textContent = profil.status;
      document.getElementById('pTanggalBergabung').textContent = profil.tanggalBergabung || '—';

      // Data Pribadi (view)
      isiAtauBelumDiisi_(document.getElementById('vNik'), profil.nik);
      isiAtauBelumDiisi_(document.getElementById('vTempatLahir'), profil.tempatLahir);
      isiAtauBelumDiisi_(document.getElementById('vTanggalLahir'), formatTanggalIndo_(profil.tanggalLahir));
      isiAtauBelumDiisi_(document.getElementById('vJenisKelamin'), profil.jenisKelamin);
      isiAtauBelumDiisi_(document.getElementById('vStatusPernikahan'), profil.statusPernikahan);
      isiAtauBelumDiisi_(document.getElementById('vAgama'), profil.agama);

      // Kontak (view)
      isiAtauBelumDiisi_(document.getElementById('vNoHp'), profil.noHp);
      isiAtauBelumDiisi_(document.getElementById('vEmail'), profil.email);

      // Alamat (view)
      isiAtauBelumDiisi_(document.getElementById('vAlamat'), profil.alamat);

      // Kontak Darurat (view) -- tombol berubah label tergantung sudah ada data atau belum
      const kd = profil.kontakDarurat || {};
      const kdAdaData = !!(kd.nama || kd.hubungan || kd.noHp);
      isiAtauBelumDiisi_(document.getElementById('vKdNama'), kd.nama);
      isiAtauBelumDiisi_(document.getElementById('vKdHubungan'), kd.hubungan === 'Lainnya' ? (kd.hubunganLainnya || 'Lainnya') : kd.hubungan);
      isiAtauBelumDiisi_(document.getElementById('vKdNoHp'), kd.noHp);
      document.getElementById('btnUbahKontakDarurat').textContent = kdAdaData ? 'Ubah Data' : 'Tambahkan Data';

      // Keanggotaan SPPG (duplikat tampilan readonly)
      document.getElementById('idRelawan2').textContent = profil.id;
      document.getElementById('divisiRelawan2').textContent = profil.divisi;
      document.getElementById('tanggalBergabungRelawan').textContent = profil.tanggalBergabung || '—';
      document.getElementById('statusRelawan2').textContent = profil.status;

      // Data Akses -- murni informasi. Username ikut di sini, TIDAK bisa
      // diedit dari halaman ini -- lihat Pengaturan Akun.
      document.getElementById('usernameRelawan').textContent = profil.username;
      const akses = profil.akses || {};
      document.getElementById('roleRelawan').textContent = akses.role || 'Relawan';
      document.getElementById('hakAksesRelawan').textContent = akses.hakAkses || 'Standar';
      document.getElementById('terakhirLoginRelawan').textContent = formatTanggalWaktu_(akses.terakhirLogin);

      // Foto profil
      const pratinjau = document.getElementById('fotoProfilPratinjau');
      if (profil.fotoProfilUrl) {
        pratinjau.innerHTML = `<img src="${profil.fotoProfilUrl}" alt="Foto profil" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        pratinjau.textContent = (profil.nama || '?').trim().charAt(0).toUpperCase();
      }

      // Tombol "Ubah ..." tiap bagian -- disabled (abu-abu) kalau memang
      // masih terkunci, TANPA teks tambahan di halaman utama (§12).
      // Penjelasan/tanggal HANYA muncul lewat modal saat tombol dicoba
      // ditekan (event listener klik di atas sudah menangani ini).
      const bu = profil.bolehUbah || {};
      document.getElementById('btnUbahDataPribadi').disabled = !(bu.dataPribadi && bu.dataPribadi.boleh);
      document.getElementById('btnUbahKontak').disabled = !(bu.kontak && bu.kontak.boleh);
      document.getElementById('btnUbahAlamat').disabled = !(bu.alamat && bu.alamat.boleh);
      document.getElementById('btnUbahKontakDarurat').disabled = !(bu.kontakDarurat && bu.kontakDarurat.boleh);
      document.getElementById('btnSimpanFoto').disabled = !(bu.fotoProfil && bu.fotoProfil.boleh);

      main.style.display = 'block';
    } catch (err) {
      hideLoading();
      // LOADING != ERROR: gangguan jaringan biasa TIDAK dianggap sesi
      // berakhir. Cuma redirect ke Login kalau pesannya memang menandakan
      // sesi tidak valid.
      if (apakahErrorSesiTidakValid(err.message)) {
        hapusSesiRelawan();
        simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
        window.location.href = 'login.html';
        return;
      }
      showError(err.message || 'Gagal memuat data. Silakan coba lagi.');
      main.innerHTML = `
        <div class="empty-state" style="padding:40px 20px;text-align:center;">
          <p style="margin:0 0 12px;font-size:14px;color:#55606f;">Gagal memuat data. Silakan coba lagi.</p>
          <button type="button" id="btnCobaLagiProfil" class="btn-outline">↻ Coba Lagi</button>
        </div>`;
      main.style.display = 'block';
      const btnCobaLagi = document.getElementById('btnCobaLagiProfil');
      if (btnCobaLagi) btnCobaLagi.addEventListener('click', () => window.location.reload());
    }
  }

  // ---------------------------------------------------------------
  // Simpan per bagian -- generik: submit -> "Menyimpan..." -> backend ->
  // kalau tersimpan:false (race, terkunci pas mau simpan) tampilkan modal;
  // kalau sukses -> pesan berhasil, tutup mode edit, muat ulang profil.
  // ---------------------------------------------------------------
  async function simpanBagian_(bagian, endpoint, payload, tombolSimpan) {
    const teksAsli = tombolSimpan.textContent;
    tombolSimpan.disabled = true;
    tombolSimpan.textContent = 'Menyimpan...';
    try {
      const hasil = await apiPost(endpoint, payload);
      if (hasil && hasil.tersimpan === false) {
        tampilkanModalTerkunci_(hasil.tanggalBolehLagi);
      } else {
        showSuccess('✓ Perubahan berhasil disimpan');
        tutupModeEdit_(bagian);
      }
      await muatProfil(); // ambil ulang data terbaru, apa pun hasilnya
    } catch (err) {
      // Gagal sungguhan (validasi/jaringan) -- form TETAP terbuka, data yg
      // sudah diketik user TIDAK hilang, supaya bisa langsung diperbaiki.
      showError(err.message || 'Perubahan belum tersimpan. Silakan coba kembali.');
    } finally {
      tombolSimpan.disabled = false;
      tombolSimpan.textContent = teksAsli;
    }
  }

  document.getElementById('formDataPribadi').addEventListener('submit', (e) => {
    e.preventDefault();
    simpanBagian_('dataPribadi', 'updateDataPribadiRelawan', {
      token: sesi.token,
      nik: document.getElementById('inputNik').value.trim(),
      tempatLahir: document.getElementById('inputTempatLahir').value.trim(),
      tanggalLahir: document.getElementById('inputTanggalLahir').value,
      jenisKelamin: document.getElementById('inputJenisKelamin').value,
      statusPernikahan: document.getElementById('inputStatusPernikahan').value,
      agama: document.getElementById('inputAgama').value.trim()
    }, document.getElementById('btnSimpanDataPribadi'));
  });

  document.getElementById('formKontak').addEventListener('submit', (e) => {
    e.preventDefault();
    simpanBagian_('kontak', 'updateKontakRelawan', {
      token: sesi.token,
      noHp: document.getElementById('inputNoHp').value.trim(),
      email: document.getElementById('inputEmail').value.trim()
    }, document.getElementById('btnSimpanKontak'));
  });

  document.getElementById('formAlamat').addEventListener('submit', (e) => {
    e.preventDefault();
    simpanBagian_('alamat', 'updateAlamatRelawan', {
      token: sesi.token,
      alamat: document.getElementById('inputAlamat').value.trim()
    }, document.getElementById('btnSimpanAlamat'));
  });

  document.getElementById('formKontakDarurat').addEventListener('submit', (e) => {
    e.preventDefault();
    const hubungan = document.getElementById('inputKdHubungan').value;
    if (hubungan === 'Lainnya' && !document.getElementById('inputKdHubunganLainnya').value.trim()) {
      showError('Isi kolom "Hubungan Lainnya".');
      return;
    }
    simpanBagian_('kontakDarurat', 'updateKontakDaruratRelawan', {
      token: sesi.token,
      nama: document.getElementById('inputKdNama').value.trim(),
      hubungan: hubungan,
      hubunganLainnya: document.getElementById('inputKdHubunganLainnya').value.trim(),
      noHp: document.getElementById('inputKdNoHp').value.trim()
    }, document.getElementById('btnSimpanKontakDarurat'));
  });

  // ---- Foto profil: diperkecil dulu di perangkat sebelum diunggah,
  // supaya tidak mengulang masalah unggahan berat seperti swafoto absensi.
  document.getElementById('btnSimpanFoto').addEventListener('click', async () => {
    const info = (profilTerakhir && profilTerakhir.bolehUbah && profilTerakhir.bolehUbah.fotoProfil) || { boleh: true };
    if (!info.boleh) { tampilkanModalTerkunci_(info.tanggalBolehLagi); return; }

    const berkas = document.getElementById('inputFotoProfil').files[0];
    if (!berkas) { showError('Pilih foto dulu.'); return; }
    const tombol = document.getElementById('btnSimpanFoto');
    const teksAsli = tombol.textContent;
    try {
      tombol.disabled = true;
      tombol.textContent = 'Menyimpan...';
      showLoading('Menyiapkan foto...');
      const dataUrl = await perkecilGambar_(berkas, 400);
      const hasil = await apiPost('simpanFotoProfilRelawan', { token: sesi.token, fotoBase64: dataUrl }, 45000);
      hideLoading();
      if (hasil && hasil.tersimpan === false) {
        tampilkanModalTerkunci_(hasil.tanggalBolehLagi);
      } else {
        showSuccess('✓ Perubahan berhasil disimpan');
        document.getElementById('fotoProfilPratinjau').innerHTML =
          `<img src="${hasil.fotoProfilUrl}" alt="Foto profil" style="width:100%;height:100%;object-fit:cover;">`;
      }
      await muatProfil();
    } catch (err) {
      hideLoading();
      showError(err.message || 'Perubahan belum tersimpan. Silakan coba kembali.');
    } finally {
      tombol.disabled = false;
      tombol.textContent = teksAsli;
    }
  });

  function perkecilGambar_(berkas, maksSisi) {
    return new Promise((resolve, reject) => {
      const pembaca = new FileReader();
      pembaca.onerror = () => reject(new Error('Gagal membaca berkas foto.'));
      pembaca.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Berkas yang dipilih bukan gambar yang didukung.'));
        img.onload = () => {
          const skala = Math.min(1, maksSisi / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * skala);
          c.height = Math.round(img.height * skala);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = pembaca.result;
      };
      pembaca.readAsDataURL(berkas);
    });
  }

  document.getElementById('btnKeluar').addEventListener('click', async () => {
    try {
      await apiPost('logoutRelawan', { token: sesi.token });
    } catch (err) {
      // Tetap lanjutkan keluar di sisi perangkat meski panggilan logout server gagal
      // (mis. sedang offline) — sesi di server akan kedaluwarsa otomatis maksimal 6 jam.
    }
    hapusSesiRelawan();
    window.location.href = 'index.html';
  });

  muatProfil();
});

// SPPG JEUNGJING — LOGIC HALAMAN LOGIN RELAWAN (login.html)
// Menggunakan fungsi bersama dari common.js (apiGet, apiPost, dst.)
// dan auth-relawan.js (simpanSesiRelawan, dst.)

document.addEventListener('DOMContentLoaded', () => {
  const cardLogin = document.getElementById('cardLogin');
  const cardGanti = document.getElementById('cardGantiPassword');
  const loginForm = document.getElementById('loginForm');
  const gantiForm = document.getElementById('gantiForm');

  // Jika sudah login sebelumnya, langsung ke Profil — tidak perlu login ulang.
  const sesiAda = ambilSesiRelawan();
  if (sesiAda && sesiAda.token) {
    window.location.href = 'dashboard.html';
    return;
  }

  // Tampilkan pesan kalau relawan baru saja "dilempar" ke sini karena sesi
  // berakhir atau akunnya dinonaktifkan Admin (lihat profil.js).
  const notisLogin = ambilDanHapusNotisLogin();
  if (notisLogin) {
    showError(notisLogin);
  }

  // Menyimpan sementara password lama yang baru saja dipakai login,
  // dibutuhkan untuk memanggil gantiPasswordRelawan (bukan disimpan permanen).
  let sesiSementara = null;

  document.getElementById('toggleLoginPw').addEventListener('click', function () {
    togglePasswordVisibility('inputPassword', this);
  });
  document.getElementById('toggleNewPw').addEventListener('click', function () {
    togglePasswordVisibility('inputPasswordBaru', this);
  });

  function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const tampil = input.type === 'password';
    input.type = tampil ? 'text' : 'password';
    btn.textContent = tampil ? 'SEMBUNYIKAN' : 'TAMPILKAN';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('inputUsername').value.trim();
    const password = document.getElementById('inputPassword').value;

    if (!username || !password) {
      showError('Username dan password wajib diisi.');
      return;
    }

    try {
      showLoading('Memeriksa akun...');
      // Login AMAN diulang otomatis (tidak ada efek ganda seperti submit
      // data) -- kalau percobaan pertama timeout (mis. Apps Script baru
      // "bangun" dari idle), coba sekali lagi otomatis sebelum benar-benar
      // menyerah, supaya pengguna tidak perlu klik ulang manual.
      let hasil;
      try {
        hasil = await apiPost('loginRelawan', { username, password });
      } catch (errPertama) {
        if (!/tidak merespons/i.test(errPertama.message)) throw errPertama;
        showLoading('Koneksi lambat, mencoba sekali lagi...');
        hasil = await apiPost('loginRelawan', { username, password }, undefined, 'Koneksi ke server lambat. Periksa internet Anda dan coba masuk lagi.');
      }
      hideLoading();

      if (hasil.wajibGantiPassword) {
        // Simpan sesi + password lama sementara di memori (bukan localStorage)
        // untuk menyelesaikan proses ganti password wajib.
        sesiSementara = { ...hasil, passwordLama: password };
        cardLogin.classList.add('is-hidden');
        cardGanti.classList.remove('is-hidden');
      } else {
        simpanSesiRelawan(hasil);
        window.location.href = 'dashboard.html';
      }
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  gantiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passwordBaru = document.getElementById('inputPasswordBaru').value;
    const passwordUlangi = document.getElementById('inputPasswordUlangi').value;

    if (passwordBaru.length < 6) {
      showError('Password baru minimal 6 karakter.');
      return;
    }
    if (passwordBaru !== passwordUlangi) {
      showError('Ulangi password tidak sama dengan password baru.');
      return;
    }

    try {
      showLoading('Menyimpan password baru...');
      await apiPost('gantiPasswordRelawan', {
        token: sesiSementara.token,
        passwordLama: sesiSementara.passwordLama,
        passwordBaru: passwordBaru
      });
      hideLoading();
      simpanSesiRelawan({
        token: sesiSementara.token,
        idRelawan: sesiSementara.idRelawan,
        nama: sesiSementara.nama,
        divisi: sesiSementara.divisi,
        wajibGantiPassword: false
      });
      window.location.href = 'dashboard.html';
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });
});

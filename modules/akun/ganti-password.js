// SPPG JEUNGJING — LOGIC HALAMAN GANTI PASSWORD (ganti-password.html)
// Menggunakan fungsi bersama dari common.js (apiPost, dst.) dan auth-relawan.js.

document.addEventListener('DOMContentLoaded', () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('togglePwLama').addEventListener('click', function () {
    togglePasswordVisibility('inputPasswordLama', this);
  });
  document.getElementById('togglePwBaru').addEventListener('click', function () {
    togglePasswordVisibility('inputPasswordBaru2', this);
  });

  function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const tampil = input.type === 'password';
    input.type = tampil ? 'text' : 'password';
    btn.textContent = tampil ? 'SEMBUNYIKAN' : 'TAMPILKAN';
  }

  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const passwordLama = document.getElementById('inputPasswordLama').value;
    const passwordBaru = document.getElementById('inputPasswordBaru2').value;

    if (passwordBaru.length < 6) {
      showError('Password baru minimal 6 karakter.');
      return;
    }

    try {
      showLoading('Mengganti password...');
      await apiPost('gantiPasswordRelawan', { token: sesi.token, passwordLama, passwordBaru });
      hideLoading();
      showSuccess('Password berhasil diganti.');
      document.getElementById('passwordForm').reset();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });
});

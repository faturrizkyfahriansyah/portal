// SPPG JEUNGJING — LOGIC HALAMAN PENGATURAN AKUN (pengaturan.html)
// Menggunakan fungsi bersama dari common.js (apiGet, apiPost, dst.)
// dan auth-relawan.js (ambilSesiRelawan, dst.)
// Ganti Password kini halaman terpisah — lihat ganti-password.js.

function formatTanggalWaktuIndo(isoString) {
  if (!isoString) return 'Belum pernah login';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Belum pernah login';
  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const p2 = n => String(n).padStart(2, '0');
  return `${d.getDate()} ${namaBulan[d.getMonth()]} ${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('pengaturanMain');

  async function muatPengaturan() {
    try {
      showLoading('Memuat pengaturan...');
      const data = await apiGet('getPengaturanAkun', { token: sesi.token });
      hideLoading();
      document.getElementById('loginTerakhir').textContent = formatTanggalWaktuIndo(data.loginTerakhir);

      // BARU: Username -- dipindah dari Profil Saya ke sini (Pengaturan
      // Akun), sesuai instruksi: Profil Saya cuma menampilkan Username
      // sebagai informasi, perubahan sesungguhnya lewat halaman ini.
      document.getElementById('usernameSaatIni').textContent = data.username || '—';
      const infoGanti = document.getElementById('infoGantiUsername');
      const btnGanti = document.getElementById('btnGantiUsername');
      const gu = data.gantiUsername || { boleh: true };
      if (gu.boleh) {
        infoGanti.textContent = '';
        btnGanti.disabled = false;
      } else {
        infoGanti.textContent = 'Data ini belum dapat diubah saat ini.';
        btnGanti.disabled = true;
      }

      main.style.display = 'block';
    } catch (err) {
      hideLoading();
      if (apakahErrorSesiTidakValid(err.message)) {
        hapusSesiRelawan();
        simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
        window.location.href = 'login.html';
        return;
      }
      showError(err.message || 'Gagal memuat pengaturan akun.');
    }
  }

  // ---- Ganti username -- diporting dari profil.js, field tunggal +
  // konfirmasi via dialog sebelum submit (bukan ketik-ulang).
  document.getElementById('btnGantiUsername').addEventListener('click', async () => {
    const baru = document.getElementById('inputUsernameBaru').value.trim().toLowerCase();
    if (!baru) { showError('Username baru belum diisi.'); return; }
    if (!confirm('Setelah diubah, Anda login memakai username "' + baru + '". Lanjutkan?')) return;
    try {
      showLoading('Mengubah username...');
      await apiPost('gantiUsernameRelawan', { token: sesi.token, usernameBaru: baru });
      hideLoading();
      showSuccess('Username berhasil diubah menjadi ' + baru + '.');
      document.getElementById('inputUsernameBaru').value = '';
      await muatPengaturan();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  document.getElementById('btnKeluar').addEventListener('click', async () => {
    try {
      await apiPost('logoutRelawan', { token: sesi.token });
    } catch (err) {
      // Tetap lanjutkan keluar di sisi perangkat meski panggilan logout server gagal.
    }
    hapusSesiRelawan();
    window.location.href = 'index.html';
  });

  // ---- Keluar dari Semua Perangkat -- WAJIB konfirmasi dulu (bukan langsung
  // logout). Secara teknis memakai fungsi logout yang sama: arsitektur sesi
  // portal ini 1 token aktif per waktu (login baru menggantikan token lama),
  // jadi "keluar dari sesi ini" secara efektif SAMA DENGAN "keluar dari semua
  // perangkat" -- tidak ada sesi lain yang tersisa aktif untuk akun ini.
  document.getElementById('btnKeluarSemuaPerangkat').addEventListener('click', async () => {
    if (!confirm('Anda akan keluar dari akun ini di semua perangkat. Lanjutkan?')) return;
    try {
      showLoading('Memproses...');
      await apiPost('logoutRelawan', { token: sesi.token });
    } catch (err) {
      // Tetap lanjutkan keluar di sisi perangkat meski panggilan logout server gagal.
    }
    hideLoading();
    hapusSesiRelawan();
    window.location.href = 'index.html';
  });

  muatPengaturan();
});


// ---- Preferensi Tampilan: Ukuran Teks, Tema, Kepadatan -- semuanya
// disimpan di localStorage (per-perangkat), diterapkan LANGSUNG tanpa
// tombol Simpan, dan dibaca sedini mungkin oleh terapkan-preferensi.js
// di SEMUA halaman supaya konsisten (bukan cuma di halaman ini).
(function () {
  function pasangGrup_(namaGrup, kunciStorage, atributHtml, terapkanUlangTema) {
    document.addEventListener('DOMContentLoaded', () => {
      const radios = document.querySelectorAll(`input[name="${namaGrup}"]`);
      if (!radios.length) return;
      let tersimpan = 'normal';
      try { tersimpan = localStorage.getItem(kunciStorage) || radios[0].value; } catch (e) { /* penyimpanan tidak tersedia */ }
      radios.forEach(r => { r.checked = (r.value === tersimpan); });
      radios.forEach(r => {
        r.addEventListener('change', () => {
          if (!r.checked) return;
          try { localStorage.setItem(kunciStorage, r.value); } catch (e) { /* abaikan */ }
          if (terapkanUlangTema) {
            let nilai = r.value;
            if (nilai === 'sistem') {
              nilai = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'gelap' : 'terang';
            }
            document.documentElement.setAttribute('data-tema', nilai);
          } else {
            document.documentElement.setAttribute(atributHtml, r.value);
          }
        });
      });
    });
  }
  pasangGrup_('ukuranTeks', 'sppgUkuranTeks', 'data-ukuran-teks', false);
  pasangGrup_('tema', 'sppgTema', 'data-tema', true);
  pasangGrup_('kepadatan', 'sppgKepadatan', 'data-kepadatan', false);
})();

// ---- Unduh riwayat absensi periode aktif sebagai CSV
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnUnduhAbsensi');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const sesi = ambilSesiRelawan();
    if (!sesi || !sesi.token) return;
    try {
      showLoading('Menyiapkan berkas...');
      const hasil = await apiGet('getRiwayatAbsensiRelawan', { token: sesi.token });
      hideLoading();
      const baris = [['Tanggal', 'Hari', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan']];
      (hasil.items || []).forEach(r => baris.push([r.tanggal, r.hari, r.jamMasuk, r.jamPulang, r.status, r.keterangan]));
      const csv = baris.map(b => b.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'riwayat-absensi-saya.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });
});

// ---- Notifikasi HP (Firebase Cloud Messaging) ----
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnAktifkanNotifHp');
  const status = document.getElementById('statusNotifHp');
  if (!btn) return;

  function perbaruiTampilanStatus_() {
    if (!('Notification' in window)) {
      status.textContent = 'Browser ini tidak mendukung notifikasi.';
      btn.disabled = true;
      return;
    }
    if (Notification.permission === 'granted') {
      status.textContent = '✅ Notifikasi HP aktif.';
      btn.textContent = '🔕 Matikan Notifikasi HP';
    } else if (Notification.permission === 'denied') {
      status.textContent = '⚠️ Izin notifikasi diblokir. Aktifkan lewat pengaturan browser/HP kamu.';
      btn.textContent = '🔔 Aktifkan Notifikasi HP';
    } else {
      status.textContent = 'Notifikasi HP belum diaktifkan.';
      btn.textContent = '🔔 Aktifkan Notifikasi HP';
    }
  }
  perbaruiTampilanStatus_();

  btn.addEventListener('click', async () => {
    const sesi = ambilSesiRelawan();
    if (!sesi || !sesi.token) return;
    try {
      showLoading('Memproses...');
      if (Notification.permission === 'granted') {
        await nonaktifkanNotifikasiHp(sesi.token);
      } else {
        await aktifkanNotifikasiHp(sesi.token);
      }
      hideLoading();
      showSuccess('Berhasil diperbarui.');
      perbaruiTampilanStatus_();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });
});

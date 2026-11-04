// SPPG JEUNGJING — ADMIN: Migrasi Sistem Presensi V2 (Roster-First)
// BARU 30 Okt 2026 (Tahap 5). File TERPISAH dari admin.js & dari
// admin-sipres-monitoring.js -- pola ADITIF yang SAMA: suntik HTML
// lewat JS ke #panelMonitoringPresensi yang SUDAH ADA (tidak mengubah
// admin.html sama sekali), hook ke tombol tab yang sudah ada.
//
// PENTING -- jalankanMigrasiRosterV2 MENGUBAH DATA (membuat baris baru
// di 03_DATA_ABSENSI_V2 dari 03_DATA_ABSENSI lama). Aman (tidak
// destruktif, idempoten, tervalidasi -- lihat MigrasiRosterV2.gs), TAPI
// tombol ini SENGAJA diberi 2 lapis: (1) Validasi dulu (read-only, cek
// data TANPA mengubah apa pun), (2) baru tombol Migrasi SUNGGUHAN,
// dengan konfirmasi ketik ulang kata -- supaya tidak terpencet tidak
// sengaja.
(function () {
  const panel = document.getElementById('panelMonitoringPresensi');
  if (!panel) return; // halaman ini tidak punya panel ini -- diam, bukan error

  const kartu = document.createElement('div');
  kartu.className = 'admin-card';
  kartu.style.marginBottom = '16px';
  kartu.style.border = '1px solid #f0ad4e';
  kartu.innerHTML = `
    <div style="padding:14px;">
      <h3 style="margin:0 0 6px;font-size:15px;color:var(--color-navy);">Migrasi Sistem Presensi V2 (Roster-First)</h3>
      <p style="font-size:12.5px;color:var(--color-text-muted);margin:0 0 10px;">
        Arsitektur presensi baru (1 baris per relawan per operasional) sudah dibangun tapi belum diaktifkan.
        Migrasi ini TIDAK menghapus/mengubah data lama (03_DATA_ABSENSI) -- hanya MENAMBAH struktur baru di sampingnya.
        Aman dicoba berkali-kali (idempoten).
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="btnValidasiRosterV2" class="btn btn-secondary" style="font-size:13px;">1. Validasi Dulu (aman, tidak mengubah apa pun)</button>
        <button id="btnMigrasiRosterV2" class="btn" style="font-size:13px;background:#f0ad4e;border-color:#f0ad4e;">2. Jalankan Migrasi Sungguhan</button>
      </div>
      <div id="hasilMigrasiRosterV2" style="margin-top:10px;font-size:12.5px;white-space:pre-wrap;font-family:monospace;background:#f8f9fa;padding:8px;border-radius:6px;display:none;max-height:300px;overflow:auto;"></div>
    </div>
  `;
  panel.insertBefore(kartu, panel.firstChild.nextSibling); // taruh tepat setelah judul halaman

  const elHasil = kartu.querySelector('#hasilMigrasiRosterV2');
  function tampilkanHasil_(obj) {
    elHasil.style.display = 'block';
    elHasil.textContent = JSON.stringify(obj, null, 2);
  }

  kartu.querySelector('#btnValidasiRosterV2').addEventListener('click', async () => {
    const sesi = ambilSesiAdmin();
    elHasil.style.display = 'block';
    elHasil.textContent = 'Memeriksa...';
    try {
      const hasil = await apiPost('jalankanValidasiIntegritasRosterV2', { token: sesi.token });
      tampilkanHasil_(hasil);
    } catch (e) {
      tampilkanHasil_({ error: e.message });
    }
  });

  kartu.querySelector('#btnMigrasiRosterV2').addEventListener('click', async () => {
    const konfirmasi = prompt('Ini akan membuat data presensi versi baru dari data lama (data lama TIDAK diubah/dihapus). Ketik "MIGRASI" (huruf besar) untuk lanjut:');
    if (konfirmasi !== 'MIGRASI') { alert('Dibatalkan -- tidak ada yang berubah.'); return; }
    const sesi = ambilSesiAdmin();
    elHasil.style.display = 'block';
    elHasil.textContent = 'Menjalankan migrasi, mohon tunggu...';
    try {
      const hasil = await apiPost('jalankanMigrasiRosterV2', { token: sesi.token });
      tampilkanHasil_(hasil);
      alert('Migrasi selesai. Lihat detail hasil di bawah tombol.');
    } catch (e) {
      tampilkanHasil_({ error: e.message });
      alert('Migrasi gagal: ' + e.message);
    }
  });
})();

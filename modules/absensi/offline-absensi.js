// ============================================================
// offline-absensi.js — Mode Offline untuk Absensi
//
// Prinsip: KALAU koneksi buruk/tidak ada saat kirim absen, data disimpan
// dulu di perangkat (localStorage -- bukan IndexedDB, karena ukuran foto
// yang sudah diperkecil ke 720px cukup kecil untuk localStorage, dan ini
// jauh lebih sederhana untuk dirawat), lalu otomatis dikirim ulang begitu
// koneksi kembali. TIDAK mengubah aturan Absensi Masuk/Pulang yang sudah
// ada -- modul ini murni "pembungkus" di sekitar pemanggilan submitAbsensi
// yang sudah berjalan.
//
// Dipakai oleh script.js lewat window.offlineAbsensi.
// ============================================================

const offlineAbsensi = (function () {
  const KUNCI_ANTRIAN = 'sppg_antrian_absensi_offline';
  const INTERVAL_COBA_ULANG_MS = 20000; // coba sinkronisasi tiap 20 detik selagi ada antrian
  let timerCobaUlang = null;
  let pendengarStatus = [];

  function bacaAntrian_() {
    try {
      const mentah = localStorage.getItem(KUNCI_ANTRIAN);
      return mentah ? JSON.parse(mentah) : [];
    } catch (e) { return []; }
  }

  function simpanAntrian_(daftar) {
    try { localStorage.setItem(KUNCI_ANTRIAN, JSON.stringify(daftar)); } catch (e) { /* penyimpanan penuh/tidak tersedia -- diamkan */ }
  }

  function beriTahuPendengar_() {
    const daftar = bacaAntrian_();
    pendengarStatus.forEach(fn => { try { fn(daftar); } catch (e) { /* abaikan error pendengar */ } });
  }

  function buatIdUnik_() {
    return 'OFF-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Tambahkan 1 absensi ke antrian offline. dataAbsensi berisi persis
   * payload yang biasa dikirim ke submitAbsensi (token, jenis, latitude,
   * dst) -- supaya saat disinkronkan nanti, tinggal dikirim ulang apa
   * adanya tanpa perlu tahu detail bisnis absensi sama sekali di sini.
   */
  function tambahKeAntrian(dataAbsensi) {
    const daftar = bacaAntrian_();
    const entri = {
      idLokal: buatIdUnik_(),
      data: dataAbsensi,
      jenis: dataAbsensi.jenis,
      dibuatPada: new Date().toISOString(),
      status: 'MENUNGGU_SINKRONISASI', // -> BERHASIL_DISINKRONKAN | GAGAL_SINKRONISASI
      percobaan: 0,
      pesanTerakhir: ''
    };
    daftar.push(entri);
    simpanAntrian_(daftar);
    beriTahuPendengar_();
    mulaiPenjadwalCobaUlang_();
    return entri.idLokal;
  }

  function ambilSemuaAntrian() {
    return bacaAntrian_();
  }

  function hapusDariAntrian(idLokal) {
    const daftar = bacaAntrian_().filter(e => e.idLokal !== idLokal);
    simpanAntrian_(daftar);
    beriTahuPendengar_();
  }

  function daftarPendengarStatus(fn) {
    pendengarStatus.push(fn);
    fn(bacaAntrian_()); // panggil sekali langsung dengan status terkini
  }

  /**
   * Coba kirim SEMUA yang masih MENUNGGU_SINKRONISASI. Kalau server bilang
   * "sudah melakukan absensi..." -- itu artinya percobaan SEBELUMNYA
   * sebenarnya BERHASIL (server sempat memproses walau koneksi terputus
   * sebelum respons sampai ke perangkat) -- jadi tetap dianggap SUKSES,
   * bukan gagal. Ini penting supaya relawan tidak bingung lagi seperti
   * kasus "Server tidak merespons" yang sudah pernah terjadi.
   */
  async function sinkronkanSemua() {
    if (!navigator.onLine) return;
    let daftar = bacaAntrian_();
    const menunggu = daftar.filter(e => e.status === 'MENUNGGU_SINKRONISASI');
    if (!menunggu.length) return;

    for (const entri of menunggu) {
      try {
        await apiPost('submitAbsensi', entri.data, 45000);
        hapusDariAntrian(entri.idLokal);
      } catch (err) {
        const pesan = err.message || '';
        const sudahTersimpanSebelumnya = /sudah melakukan absensi/i.test(pesan);

        daftar = bacaAntrian_();
        const idx = daftar.findIndex(e => e.idLokal === entri.idLokal);
        if (idx === -1) continue;

        if (sudahTersimpanSebelumnya) {
          daftar.splice(idx, 1); // anggap sukses -- hapus dari antrian
        } else if (/tidak dapat terhubung|tidak merespons|koneksi/i.test(pesan)) {
          // Masih gagal karena jaringan -- biarkan di antrian, coba lagi nanti.
          daftar[idx].percobaan++;
          daftar[idx].pesanTerakhir = pesan;
        } else {
          // Ditolak server karena alasan BUKAN jaringan (mis. di luar zona,
          // lokasi belum diatur) -- ini tidak akan berhasil walau diulang
          // terus. Tandai gagal permanen supaya relawan tahu harus tindak
          // lanjut manual, bukan menunggu sinkronisasi otomatis selamanya.
          daftar[idx].status = 'GAGAL_SINKRONISASI';
          daftar[idx].pesanTerakhir = pesan;
        }
        simpanAntrian_(daftar);
      }
    }
    beriTahuPendengar_();

    if (!bacaAntrian_().some(e => e.status === 'MENUNGGU_SINKRONISASI')) {
      hentikanPenjadwalCobaUlang_();
    }
  }

  function mulaiPenjadwalCobaUlang_() {
    if (timerCobaUlang) return;
    timerCobaUlang = setInterval(sinkronkanSemua, INTERVAL_COBA_ULANG_MS);
  }
  function hentikanPenjadwalCobaUlang_() {
    if (timerCobaUlang) { clearInterval(timerCobaUlang); timerCobaUlang = null; }
  }

  // Coba sinkron begitu koneksi kembali, dan sekali saat halaman dibuka
  // (jaga-jaga ada antrian tersisa dari sesi sebelumnya).
  window.addEventListener('online', sinkronkanSemua);
  document.addEventListener('DOMContentLoaded', () => {
    if (bacaAntrian_().some(e => e.status === 'MENUNGGU_SINKRONISASI')) {
      mulaiPenjadwalCobaUlang_();
      sinkronkanSemua();
    }
  });

  // Render otomatis ke banner #statusAntrianOffline kalau elemen itu ada
  // di halaman -- supaya modul ini bisa dipakai di absensi.html tanpa
  // script.js perlu tahu detail render sama sekali.
  function renderBanner_(daftar) {
    const el = document.getElementById('statusAntrianOffline');
    if (!el) return;

    const menunggu = daftar.filter(e => e.status === 'MENUNGGU_SINKRONISASI');
    const gagal = daftar.filter(e => e.status === 'GAGAL_SINKRONISASI');

    if (!menunggu.length && !gagal.length) { el.style.display = 'none'; return; }

    el.style.display = 'block';
    el.style.cssText += 'background:#fff8e6;border:1px solid #e8c46a;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12.5px;color:#7a5c12;';
    let html = '';
    if (menunggu.length) {
      html += `<p style="margin:0;">📶 ${menunggu.length} absensi menunggu sinkronisasi (akan otomatis terkirim saat koneksi stabil).</p>`;
    }
    if (gagal.length) {
      html += `<p style="margin:${menunggu.length ? '6px' : '0'} 0 0;color:#b23a3a;">⚠️ ${gagal.length} absensi gagal disinkronkan (bukan soal koneksi -- perlu dicoba manual lagi atau hubungi Admin).</p>`;
    }
    el.innerHTML = html;
  }
  daftarPendengarStatus(renderBanner_);

  return {
    tambahKeAntrian, ambilSemuaAntrian, hapusDariAntrian, daftarPendengarStatus, sinkronkanSemua,
    sedangOnline: () => navigator.onLine
  };
})();

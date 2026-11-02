// ============================================================
// push-notif.js — Frontend Firebase Cloud Messaging.
// Dimuat di halaman Pengaturan Akun (tombol "Aktifkan Notifikasi HP").
// TIDAK dimuat otomatis di semua halaman -- meminta izin notifikasi
// harus atas aksi jelas dari relawan, bukan dipaksa di background.
// ============================================================

const firebaseApp = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

/** Dipanggil dari tombol "Aktifkan Notifikasi HP" di Pengaturan. */
async function aktifkanNotifikasiHp(token) {
  if (!('Notification' in window)) {
    throw new Error('Browser ini tidak mendukung notifikasi.');
  }

  const izin = await Notification.requestPermission();
  if (izin !== 'granted') {
    throw new Error('Izin notifikasi ditolak. Aktifkan lewat pengaturan browser kalau berubah pikiran.');
  }

  const fcmToken = await messaging.getToken({ vapidKey: VAPID_KEY });
  if (!fcmToken) {
    throw new Error('Gagal mendapatkan token notifikasi. Coba lagi beberapa saat.');
  }

  await apiPost('simpanTokenPushNotifikasi', { token, fcmToken });
  return true;
}

/** Dipanggil dari tombol "Matikan Notifikasi HP" di Pengaturan. */
async function nonaktifkanNotifikasiHp(token) {
  await apiPost('nonaktifkanPushNotifikasi', { token });
}

// Notifikasi yang masuk SAAT tab Portal sedang terbuka & aktif (bukan
// lewat Service Worker) -- ditampilkan sebagai notifikasi biasa juga,
// supaya perilakunya konsisten baik tab lagi dibuka atau ditutup.
messaging.onMessage((payload) => {
  if (Notification.permission === 'granted') {
    new Notification(payload.notification.title, {
      body: payload.notification.body,
      icon: 'assets/icon-192.png'
    });
  }
});

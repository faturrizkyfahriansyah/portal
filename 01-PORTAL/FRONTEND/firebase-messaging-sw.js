// ============================================================
// firebase-messaging-sw.js — WAJIB persis nama file ini, WAJIB di folder
// root (sejajar index.html), ini aturan dari Firebase sendiri, bukan
// pilihan bebas. File ini yang membuat notifikasi tetap muncul walau
// tab/aplikasi Portal sedang tertutup.
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Nilai ini SENGAJA ditulis ulang di sini (bukan import dari services/firebase/firebase-config.js)
// karena service worker berjalan terpisah dari halaman utama. GANTI 6
// nilai ini PERSIS SAMA dengan yang ada di firebase-config.js.
firebase.initializeApp({
  apiKey: "AIzaSyA3aNNTxYJ1eK103rgsRqcuNJhfYZDl3hM",
  authDomain: "sppg-jeungjing.firebaseapp.com",
  projectId: "sppg-jeungjing",
  storageBucket: "sppg-jeungjing.firebasestorage.app",
  messagingSenderId: "846049808862",
  appId: "1:846049808862:web:bbd7eb1afbaad2bf078d4f",
  measurementId: "G-NPFQYCZW1S"
});

const messaging = firebase.messaging();

// Dipanggil otomatis oleh Firebase saat notifikasi masuk ketika tab
// Portal sedang tidak aktif/tertutup.
messaging.onBackgroundMessage((payload) => {
  const judul = payload.notification.title;
  const opsi = {
    body: payload.notification.body,
    icon: 'assets/icon-192.png',
    data: payload.fcmOptions || {}
  };
  self.registration.showNotification(judul, opsi);
});

// Kalau notifikasi diketuk, buka/fokuskan tab Portal
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(clients.openWindow(link));
});

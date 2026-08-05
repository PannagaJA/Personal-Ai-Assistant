// Firebase Cloud Messaging Service Worker
// This file MUST stay at public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAd96JLzUb5duNFaOJWsoTYx8ae-IKWJIM",
  authDomain: "personal-ai-assistant-f8dcb.firebaseapp.com",
  projectId: "personal-ai-assistant-f8dcb",
  storageBucket: "personal-ai-assistant-f8dcb.firebasestorage.app",
  messagingSenderId: "905006009057",
  appId: "1:905006009057:web:4ba810c852bd64438285a0",
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Jarvis Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    tag: payload.data?.notificationId || 'jarvis-notification',
    renotify: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/notifications');
      }
    })
  );
});

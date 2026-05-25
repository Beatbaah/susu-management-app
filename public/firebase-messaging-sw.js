// Firebase Cloud Messaging service worker — generated at build time. Do not edit.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDJPtCqRuTaprNdlWsxxR3MbO3l0iD12zU',
  authDomain: 'excellent-susu-app.firebaseapp.com',
  projectId: 'excellent-susu-app',
  storageBucket: 'excellent-susu-app.firebasestorage.app',
  messagingSenderId: '401737586236',
  appId: '1:401737586236:web:696aadad11386ec535d539',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || payload.data?.title || 'Excellent Susu';
  const body  = payload.notification?.body  || payload.data?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    data: payload.data || {},
    tag: payload.data?.tag || 'excellent-susu',
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

#!/usr/bin/env node
// Generates public/firebase-messaging-sw.js from VITE_FIREBASE_* env vars.
// Run before `vite build` so the service worker has the real config
// without committing API keys to source control.
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const lines = readFileSync(resolve(__dirname, '../.env'), 'utf8').split('\n');
        for (const line of lines) {
            const eq = line.indexOf('=');
            if (eq < 1 || line.trimStart().startsWith('#')) continue;
            const key = line.slice(0, eq).trim();
            const val = line.slice(eq + 1).trim();
            if (key && !(key in process.env)) process.env[key] = val;
        }
    } catch {}
}
loadEnv();

const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID,
} = process.env;

if (!VITE_FIREBASE_API_KEY) {
    console.error('[generate-sw] VITE_FIREBASE_API_KEY is missing. Set your .env before building.');
    process.exit(1);
}

const content = `// Firebase Cloud Messaging service worker — generated at build time. Do not edit.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '${VITE_FIREBASE_API_KEY}',
  authDomain: '${VITE_FIREBASE_AUTH_DOMAIN}',
  projectId: '${VITE_FIREBASE_PROJECT_ID}',
  storageBucket: '${VITE_FIREBASE_STORAGE_BUCKET}',
  messagingSenderId: '${VITE_FIREBASE_MESSAGING_SENDER_ID}',
  appId: '${VITE_FIREBASE_APP_ID}',
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
`;

const out = resolve(__dirname, '../public/firebase-messaging-sw.js');
writeFileSync(out, content, 'utf8');
console.log('[generate-sw] Written:', out);

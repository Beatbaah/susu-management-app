import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import app from '../utils/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let _messaging = null;

async function getMessagingInstance() {
    if (_messaging) return _messaging;
    if (!app) return null;
    try {
        const supported = await isSupported();
        if (!supported) return null;
        _messaging = getMessaging(app);
        return _messaging;
    } catch {
        return null;
    }
}

/** Whether the current browser supports the Web Notifications API. */
export function isNotificationSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'default' | 'granted' | 'denied' | 'not_supported' */
export function getPermissionState() {
    if (!isNotificationSupported()) return 'not_supported';
    return Notification.permission;
}

/**
 * Request notification permission and register an FCM token.
 * Stores the token in Firestore so Cloud Functions can target this device.
 * Returns { ok: boolean, reason?: string }.
 */
export async function requestPushPermission(userId) {
    if (!isNotificationSupported()) return { ok: false, reason: 'not_supported' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    // Register the FCM service worker and get a token (requires VAPID key).
    if (VAPID_KEY && userId) {
        try {
            const messaging = await getMessagingInstance();
            if (messaging) {
                const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
                const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
                if (token && db) {
                    await setDoc(doc(db, 'users', userId), { fcmToken: token, fcmTokenUpdatedAt: new Date().toISOString() }, { merge: true })
                        .catch(e => console.warn('[push] token store failed:', e?.code));
                }
            }
        } catch (e) {
            console.warn('[push] FCM token registration failed:', e?.message);
        }
    }

    return { ok: true };
}

/**
 * Remove the stored FCM token from Firestore (used when user disables push).
 * Browser permission can only be revoked via browser settings, not programmatically.
 */
export async function clearFcmToken(userId) {
    if (!userId || !db) return;
    try {
        await setDoc(doc(db, 'users', userId), { fcmToken: null }, { merge: true });
    } catch (e) {
        console.warn('[push] token clear failed:', e?.code);
    }
}

/**
 * Listen for FCM messages while the app is in the foreground.
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(callback) {
    const messaging = await getMessagingInstance();
    if (!messaging) return () => {};
    try {
        return onMessage(messaging, callback);
    } catch {
        return () => {};
    }
}

/**
 * Show a browser notification immediately (foreground-only).
 * Works as long as permission is granted, with or without a VAPID key / FCM.
 */
export function showBrowserNotification(title, body, options = {}) {
    if (getPermissionState() !== 'granted') return;
    try {
        new Notification(title, {
            body,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: options.tag || 'excellent-susu',
            ...options,
        });
    } catch (e) {
        console.warn('[push] Notification failed:', e?.message);
    }
}

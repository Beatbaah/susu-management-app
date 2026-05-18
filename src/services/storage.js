import { isFirestoreReady } from './firestoreSync';

// Demo-mode persistence backbone.
// In production, services should write to Firestore. In demo mode (no Firebase
// env vars set, see utils/firebase.ts), services persist here so the app keeps
// working offline.
const NAMESPACE = 'excellent_susu_v1_';
export const storageKey = (key) => `${NAMESPACE}${key}`;
export function readStore(key, fallback) {
    if (isFirestoreReady()) {
        if (Array.isArray(fallback))
            return [];
        if (fallback && typeof fallback === 'object')
            return {};
        return fallback;
    }
    try {
        const raw = localStorage.getItem(storageKey(key));
        if (raw == null)
            return fallback;
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
export function writeStore(key, value) {
    if (isFirestoreReady())
        return;
    try {
        localStorage.setItem(storageKey(key), JSON.stringify(value));
    }
    catch {
        /* quota exceeded or storage disabled — ignore */
    }
}
export function clearNamespace() {
    if (isFirestoreReady())
        return;
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith(NAMESPACE))
            .forEach(k => localStorage.removeItem(k));
    }
    catch {
        /* ignore */
    }
}

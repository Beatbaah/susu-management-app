import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
// FCM messaging is initialized lazily in pushNotificationService to avoid
// throwing in browsers that don't support service workers / notifications.
// Vite uses import.meta.env instead of process.env
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};
export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

// In a production build, missing Firebase env vars would silently enable demo
// mode — any email/any password works. Fail fast instead.
if (import.meta.env.PROD && !isFirebaseConfigured) {
    throw new Error(
        '[Excellent Susu] Firebase environment variables are missing. ' +
        'Set VITE_FIREBASE_* vars before deploying — demo mode must not run in production.'
    );
}

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

// Secondary app used ONLY for createUserWithEmailAndPassword during member
// registration. Using a separate instance prevents the newly-created user's
// session from replacing the admin/manager's session in the primary `auth`.
const registrationApp = isFirebaseConfigured
    ? initializeApp(firebaseConfig, 'registration')
    : null;
export const registrationAuth = registrationApp ? getAuth(registrationApp) : null;
// Firestore instance tied to the registration app's auth context. After
// createUserWithEmailAndPassword the new user's session is active here, so
// request.auth.uid matches the new user's uid — satisfying the ownsDoc rule.
export const registrationDb = registrationApp ? getFirestore(registrationApp) : null;
// Pass the bucket URL explicitly so the SDK doesn't have to infer it.
// Required for the newer firebasestorage.app domain format.
export const storage = app && firebaseConfig.storageBucket
    ? getStorage(app, `gs://${firebaseConfig.storageBucket}`)
    : null;
// Storage instance tied to registrationApp — authenticated as the newly-created
// member after createUserWithEmailAndPassword, so document uploads during
// registration use the correct auth context.
export const registrationStorage = registrationApp && firebaseConfig.storageBucket
    ? getStorage(registrationApp, `gs://${firebaseConfig.storageBucket}`)
    : null;
export default app;

export const appCheck = (() => {
    if (!app) return null;
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!siteKey) return null;
    try {
        return initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(siteKey),
            isTokenAutoRefreshEnabled: true,
        });
    } catch { return null; }
})();

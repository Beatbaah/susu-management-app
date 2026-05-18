import { readStore, writeStore, clearNamespace } from './storage';
import { auth, db } from '../utils/firebase';
import {
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    updatePassword as fbUpdatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { listUsers } from './userService';

const STORE_KEY = 'authUser';
const VALID_ROLES = new Set(['admin', 'manager', 'collector', 'member']);

function normalize(user) {
    if (!user || typeof user !== 'object') return null;
    if (!VALID_ROLES.has(user.role)) return null;
    if (user.id === undefined || user.id === null) return null;
    return {
        ...user,
        name: user.name || user.fullName || user.email || 'Excellent Susu User',
    };
}

export function getCurrentUser() {
    return normalize(readStore(STORE_KEY, null));
}

export function setCurrentUser(user) {
    const normalized = normalize(user);
    writeStore(STORE_KEY, normalized);
    return normalized;
}

/**
 * Sign in with Firebase Email/Password Auth when Firebase is configured,
 * then load the user profile from Firestore (users/{uid}).
 *
 * Falls back to the demo local-lookup path when Firebase is not configured
 * (no env vars set). In demo mode any password is accepted.
 */
export async function signIn(email, password) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) return { ok: false, message: 'Email is required.' };

    if (auth && db) {
        try {
            const timeout = (ms) => new Promise((_, reject) =>
                setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'auth/timeout' })), ms)
            );

            const credential = await Promise.race([
                signInWithEmailAndPassword(auth, normalizedEmail, password),
                timeout(15000),
            ]);
            const uid = credential.user.uid;

            // Load profile from Firestore
            const userSnap = await Promise.race([
                getDoc(doc(db, 'users', uid)),
                timeout(10000),
            ]);
            if (userSnap.exists()) {
                const userData = { ...userSnap.data(), id: uid };
                const normalized = normalize(userData);
                if (!normalized) return { ok: false, message: 'Account is misconfigured. Contact an administrator.' };
                if (normalized.status === 'pending') return { ok: false, message: 'Your account is awaiting admin approval.' };
                if (normalized.status === 'rejected') return { ok: false, message: 'Your registration was rejected. Contact an administrator.' };
                if (normalized.status === 'suspended') return { ok: false, message: 'Your account is suspended due to overdue payments.' };
                setCurrentUser(normalized);
                return { ok: true, user: normalized };
            }

            // No Firestore profile yet — bootstrap from local data or create fresh admin profile
            const emailMatch = listUsers().find(u => (u.email || '').toLowerCase() === normalizedEmail);
            let profileData;
            if (emailMatch) {
                profileData = { ...emailMatch, id: uid, authUid: uid };
            } else {
                const displayName = credential.user.displayName || normalizedEmail.split('@')[0];
                profileData = {
                    id: uid,
                    email: normalizedEmail,
                    name: displayName,
                    fullName: displayName,
                    role: 'admin',
                    status: 'approved',
                    color: '#5b8def',
                    streak: 0,
                    badges: [],
                    points: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    joinedAt: new Date().toISOString().split('T')[0],
                };
            }
            try {
                await setDoc(doc(db, 'users', uid), profileData, { merge: true });
            } catch (writeError) {
                console.error('[authService] Could not write initial profile:', writeError?.code, writeError);
                // Still let the user in using the local profile data — Firestore write can be retried later
            }
            const normalized = normalize(profileData);
            if (!normalized) return { ok: false, message: 'Account is misconfigured.' };
            setCurrentUser(normalized);
            return { ok: true, user: normalized };
        } catch (error) {
            const code = error?.code || '';
            if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                return { ok: false, message: 'Invalid email or password.' };
            }
            if (code === 'auth/too-many-requests') {
                return { ok: false, message: 'Too many failed attempts. Try again later.' };
            }
            if (code === 'auth/network-request-failed') {
                return { ok: false, message: 'Network error. Check your connection.' };
            }
            if (code === 'auth/timeout') {
                return { ok: false, message: 'Request timed out. Check your internet connection and try again.' };
            }
            if (code === 'auth/operation-not-allowed') {
                return { ok: false, message: 'Email/password sign-in is not enabled. Go to Firebase Console → Authentication → Sign-in method and enable Email/Password.' };
            }
            if (code === 'auth/invalid-email') {
                return { ok: false, message: 'Enter a valid email address.' };
            }
            if (code === 'auth/user-disabled') {
                return { ok: false, message: 'This account has been disabled.' };
            }
            console.error('[authService] signIn error', code, error);
            return { ok: false, message: `Sign-in failed (${code || 'unknown'}). Check the browser console for details.` };
        }
    }

    // ── Demo mode (no Firebase configured) ──────────────────────────────
    const match = listUsers().find(u => (u.email || '').toLowerCase() === normalizedEmail);
    if (!match) return { ok: false, message: 'No account found for that email.' };
    if (match.status === 'pending') return { ok: false, message: 'Your account is awaiting admin approval.' };
    if (match.status === 'rejected') return { ok: false, message: 'Your registration was rejected. Contact an administrator.' };
    if (match.status === 'suspended') return { ok: false, message: 'Your account is suspended due to overdue payments.' };
    const normalized = normalize(match);
    if (!normalized) return { ok: false, message: 'Account is misconfigured.' };
    setCurrentUser(normalized);
    return { ok: true, user: normalized };
}

export async function signOut() {
    if (auth) {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.warn('[authService] signOut error', error);
        }
    }
    setCurrentUser(null);
}

/** Subscribe to Firebase Auth state changes. Returns an unsubscribe function. */
export function onAuthChange(callback) {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
}

export function clearAllDemoData() {
    clearNamespace();
}

/**
 * Change the signed-in user's password.
 * Firebase mode: reauthenticates with currentPassword then applies newPassword.
 * Demo mode: no password enforcement — acknowledge the change.
 */
/**
 * Send a password-reset email.
 * Firebase mode: uses sendPasswordResetEmail.
 * Demo mode: returns a descriptive error so the UI can inform the user.
 */
export async function resetPassword(email) {
    if (auth) {
        try {
            const { sendPasswordResetEmail } = await import('firebase/auth');
            await sendPasswordResetEmail(auth, email.trim().toLowerCase());
            return { ok: true };
        } catch (error) {
            const code = error?.code || '';
            if (code === 'auth/user-not-found') return { ok: false, message: 'No account found for this email.' };
            if (code === 'auth/invalid-email') return { ok: false, message: 'Enter a valid email address.' };
            return { ok: false, message: 'Could not send reset email. Try again.' };
        }
    }
    return { ok: false, message: 'Password reset is not available in demo mode. Use a demo account below.' };
}
export async function changePassword(currentPassword, newPassword) {
    if (auth && auth.currentUser) {
        try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            await fbUpdatePassword(auth.currentUser, newPassword);
            return { ok: true };
        } catch (error) {
            const code = error?.code || '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                return { ok: false, message: 'Current password is incorrect.' };
            }
            if (code === 'auth/requires-recent-login') {
                return { ok: false, message: 'Session expired. Please sign out and back in, then try again.' };
            }
            return { ok: false, message: 'Password update failed. Try again.' };
        }
    }
    // Demo mode — no real password enforcement, just acknowledge.
    return { ok: true };
}

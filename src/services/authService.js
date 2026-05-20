import { readStore, writeStore, clearNamespace } from './storage';
import { auth, db } from '../utils/firebase';
import {
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    updatePassword as fbUpdatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    updateProfile as fbUpdateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { listUsers } from './userService';

const STORE_KEY = 'authUser';
const VALID_ROLES = new Set(['admin', 'manager', 'collector', 'member']);

// ── Brute-force protection ────────────────────────────────────────────────────
// Tracks failed login attempts per email in localStorage so lockouts survive
// page refreshes. Lockout escalates: 5 failures → 15 min, 10+ → 60 min.
const LOCKOUT_PREFIX = 'excellent_susu_lockout_';
const MAX_ATTEMPTS_SOFT = 5;
const MAX_ATTEMPTS_HARD = 10;
const LOCKOUT_SHORT_MS  = 15 * 60 * 1000;
const LOCKOUT_LONG_MS   = 60 * 60 * 1000;

function _lockoutKey(email) { return LOCKOUT_PREFIX + email; }

function _readLockout(email) {
    try {
        const raw = localStorage.getItem(_lockoutKey(email));
        return raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
    } catch { return { count: 0, lockedUntil: 0 }; }
}

function _writeLockout(email, record) {
    try { localStorage.setItem(_lockoutKey(email), JSON.stringify(record)); } catch {}
}

/** Returns the current lockout state for an email (call before attempting sign-in). */
export function getLockoutState(email) {
    if (!email) return { locked: false, remainingMs: 0, attempts: 0, attemptsLeft: MAX_ATTEMPTS_SOFT };
    const record = _readLockout(email.trim().toLowerCase());
    const now = Date.now();
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS_SOFT - record.count);
    if (record.lockedUntil > now) {
        return { locked: true, remainingMs: record.lockedUntil - now, attempts: record.count, attemptsLeft: 0 };
    }
    return { locked: false, remainingMs: 0, attempts: record.count, attemptsLeft };
}

function _recordFailure(email) {
    const record = _readLockout(email);
    const count = record.count + 1;
    const lockoutMs = count >= MAX_ATTEMPTS_HARD ? LOCKOUT_LONG_MS
        : count >= MAX_ATTEMPTS_SOFT ? LOCKOUT_SHORT_MS
        : 0;
    const lockedUntil = lockoutMs ? Date.now() + lockoutMs : record.lockedUntil;
    _writeLockout(email, { count, lockedUntil });
    return { count, lockedUntil };
}

function _clearLockout(email) {
    try { localStorage.removeItem(_lockoutKey(email)); } catch {}
}
// ─────────────────────────────────────────────────────────────────────────────

// Name override — stored under a pref key so it survives Firestore-mode localStorage wipes.
// Keyed by lowercase email so each account has its own override.
const NAME_OVERRIDE_PREFIX = 'excellent_susu_pref_nameOverride_';
function getNameOverride(email) {
    try { return localStorage.getItem(NAME_OVERRIDE_PREFIX + email) || null; } catch { return null; }
}
export function setNameOverride(email, name) {
    try { if (email && name) localStorage.setItem(NAME_OVERRIDE_PREFIX + email, name); } catch {}
}

function normalize(user) {
    if (!user || typeof user !== 'object') return null;
    if (!VALID_ROLES.has(user.role)) return null;
    if (user.id === undefined || user.id === null) return null;
    const rawName = user.fullName || user.Fullname || user.name || '';
    const displayName = rawName
        ? formatEmailPrefix(rawName)
        : formatEmailPrefix(user.email?.split('@')[0] || '') || 'Excellent Susu User';
    return {
        ...user,
        // Handle field aliases from manually-created Firestore documents
        fullName: displayName,
        name: displayName,
        phone: user.phone || user.contact || '',
        status: user.status || 'approved',
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
// Format an email-prefix like "beatrice.admin" → "Beatrice Admin"
function formatEmailPrefix(prefix) {
    if (!prefix || prefix.includes(' ')) return prefix;
    return prefix
        .split(/[._\-]/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

export async function signIn(email, password) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) return { ok: false, message: 'Email is required.' };

    // ── Brute-force gate ─────────────────────────────────────────────────
    const lockout = getLockoutState(normalizedEmail);
    if (lockout.locked) {
        const mins = Math.ceil(lockout.remainingMs / 60000);
        return { ok: false, message: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, locked: true };
    }

    // ── Firebase mode ────────────────────────────────────────────────────
    if (auth) {
        try {
            // Step 1: Authenticate — this is the only blocking requirement
            const credential = await Promise.race([
                signInWithEmailAndPassword(auth, normalizedEmail, password),
                new Promise((_, reject) => setTimeout(
                    () => reject(Object.assign(new Error('timeout'), { code: 'auth/timeout' })),
                    15000,
                )),
            ]);
            const uid = credential.user.uid;
            const rawPrefix = normalizedEmail.split('@')[0];
            const displayName = credential.user.displayName || formatEmailPrefix(rawPrefix);

            // Always fall back to the least-privileged role.
            // Privileged roles (manager, collector, admin) must be set explicitly in Firestore.
            const inferRoleFromEmail = (_email) => 'member';

            // Minimal profile built purely from Firebase Auth — always works
            const fallbackProfile = {
                id: uid,
                authUid: uid,
                email: normalizedEmail,
                name: displayName,
                fullName: displayName,
                role: inferRoleFromEmail(normalizedEmail),
                status: 'approved',
                color: '#5b8def',
                streak: 0,
                badges: [],
                points: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                joinedAt: new Date().toISOString().split('T')[0],
            };

            // Step 2: Try Firestore — best-effort, 8 s timeout, never blocks login
            let profileData = fallbackProfile;
            if (db) {
                try {
                    const snap = await Promise.race([
                        getDoc(doc(db, 'users', uid)),
                        new Promise((_, reject) => setTimeout(
                            () => reject(Object.assign(new Error('timeout'), { code: 'firestore/timeout' })),
                            8000,
                        )),
                    ]);
                    if (snap.exists()) {
                        const stored = { ...snap.data(), id: uid };
                        // Trust the role stored in Firestore — it is the source of truth.
                        // Never downgrade an explicitly-assigned role (e.g. admin set via Console).
                        profileData = stored;

                        // If the stored name is still email-derived, look for a real name.
                        // Priority 1: Firebase Auth displayName (set via Console or SDK).
                        // Priority 2: another Firestore doc with the same email address.
                        const storedName = stored.fullName || stored.Fullname || stored.name || '';
                        const emailDerivedName = formatEmailPrefix(rawPrefix);
                        if (storedName === emailDerivedName) {
                            const authDisplayName = credential.user.displayName;
                            if (authDisplayName && authDisplayName !== emailDerivedName) {
                                profileData = { ...stored, fullName: authDisplayName, name: authDisplayName };
                                setDoc(doc(db, 'users', uid), { fullName: authDisplayName, name: authDisplayName }, { merge: true })
                                    .catch(e => console.warn('[authService] displayName patch failed:', e?.code));
                            } else {
                                // Query for another doc where email matches — catches manually-created docs
                                try {
                                    const emailSnap = await Promise.race([
                                        getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail))),
                                        new Promise((_, reject) => setTimeout(
                                            () => reject(Object.assign(new Error('timeout'), { code: 'firestore/timeout' })),
                                            4000,
                                        )),
                                    ]);
                                    for (const d of emailSnap.docs) {
                                        if (d.id === uid) continue;
                                        const raw = d.data().fullName || d.data().Fullname || d.data().name || '';
                                        if (raw && raw !== emailDerivedName) {
                                            const realName = raw.includes(' ') ? raw : formatEmailPrefix(raw);
                                            profileData = { ...stored, fullName: realName, name: realName };
                                            setDoc(doc(db, 'users', uid), { fullName: realName, name: realName }, { merge: true })
                                                .catch(e => console.warn('[authService] name correction failed:', e?.code));
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    console.warn('[authService] email doc lookup skipped:', e?.code);
                                }
                            }
                        }
                    } else {
                        // Await the write so users/{uid} exists before subscriptions start
                        await setDoc(doc(db, 'users', uid), fallbackProfile, { merge: true })
                            .catch(e => console.warn('[authService] profile write failed:', e?.code));
                    }
                } catch (fsErr) {
                    console.warn('[authService] Firestore skipped:', fsErr?.code);
                    // Use fallbackProfile — login still succeeds
                }
            }

            // Final override — localStorage wins over everything else.
            // This is set when the user explicitly saves their real name via Profile edit.
            // It uses a pref-prefix key that is never wiped by Firestore-mode storage clears.
            const nameOverride = getNameOverride(normalizedEmail);
            const emailDerivedFinal = formatEmailPrefix(rawPrefix);
            if (nameOverride && nameOverride !== emailDerivedFinal) {
                profileData = { ...profileData, fullName: nameOverride, name: nameOverride };
                // Best-effort: keep Firestore in sync so other devices eventually converge
                if (db) setDoc(doc(db, 'users', uid), { fullName: nameOverride, name: nameOverride }, { merge: true })
                    .catch(() => {});
            }

            const normalized = normalize(profileData);
            if (!normalized) {
                // Profile has an unexpected role — fall back to the auth-derived profile
                const safe = normalize(fallbackProfile);
                if (!safe) return { ok: false, message: 'Account is misconfigured.' };
                _clearLockout(normalizedEmail);
                setCurrentUser(safe);
                return { ok: true, user: safe };
            }
            if (normalized.status === 'pending') return { ok: false, message: 'Your account is awaiting admin approval.' };
            if (normalized.status === 'rejected') return { ok: false, message: 'Your registration was rejected. Contact an administrator.' };
            if (normalized.status === 'suspended') return { ok: false, message: 'Your account has been suspended.' };
            _clearLockout(normalizedEmail);
            setCurrentUser(normalized);
            return { ok: true, user: normalized };

        } catch (error) {
            const code = error?.code || '';
            if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                const { count, lockedUntil } = _recordFailure(normalizedEmail);
                const attemptsLeft = Math.max(0, MAX_ATTEMPTS_SOFT - count);
                if (lockedUntil > Date.now()) {
                    const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
                    return { ok: false, message: `Too many failed attempts. Account locked for ${mins} minute${mins === 1 ? '' : 's'}.`, locked: true, attemptsLeft: 0 };
                }
                const warning = attemptsLeft <= 2 && attemptsLeft > 0
                    ? ` ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before lockout.`
                    : '';
                return { ok: false, message: `Invalid email or password.${warning}`, attemptsLeft };
            }
            if (code === 'auth/too-many-requests') {
                _recordFailure(normalizedEmail);
                return { ok: false, message: 'Too many failed attempts. Try again later.', locked: true };
            }
            if (code === 'auth/network-request-failed') {
                return { ok: false, message: 'Network error. Check your internet connection.' };
            }
            if (code === 'auth/timeout') {
                return { ok: false, message: 'Sign-in timed out. Check your internet connection and try again.' };
            }
            if (code === 'auth/operation-not-allowed') {
                return { ok: false, message: 'Email/password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.' };
            }
            if (code === 'auth/invalid-email') {
                return { ok: false, message: 'Enter a valid email address.' };
            }
            if (code === 'auth/user-disabled') {
                return { ok: false, message: 'This account has been disabled.' };
            }
            console.error('[authService] signIn error', code, error);
            return { ok: false, message: `Sign-in failed (${code || 'unknown error'}). Check the browser console for details.` };
        }
    }

    // ── Demo mode (no Firebase configured) ──────────────────────────────
    const match = listUsers().find(u => (u.email || '').toLowerCase() === normalizedEmail);
    if (!match) {
        _recordFailure(normalizedEmail);
        return { ok: false, message: 'No account found for that email.' };
    }
    if (match.status === 'pending') return { ok: false, message: 'Your account is awaiting admin approval.' };
    if (match.status === 'rejected') return { ok: false, message: 'Your registration was rejected. Contact an administrator.' };
    if (match.status === 'suspended') return { ok: false, message: 'Your account has been suspended.' };
    const normalized = normalize(match);
    if (!normalized) return { ok: false, message: 'Account is misconfigured.' };
    _clearLockout(normalizedEmail);
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
    try { localStorage.removeItem('excellent_susu_v1_authUser'); } catch {}
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
/** Keep Firebase Auth displayName in sync so login always has a name fallback. */
export async function updateDisplayName(name) {
    if (!auth?.currentUser || !name) return;
    try {
        await fbUpdateProfile(auth.currentUser, { displayName: name });
    } catch (e) {
        console.warn('[authService] updateDisplayName failed:', e?.code);
    }
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

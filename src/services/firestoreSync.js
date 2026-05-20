import { collection, doc, getDocs, onSnapshot, setDoc, deleteDoc, writeBatch, query, } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../utils/firebase';

// Wait for a real (non-anonymous) Firebase Auth session before writing.
// Anonymous auth is no longer used — writes only proceed when the user
// is signed in with email/password.
let authReady = null;
function waitForAuth() {
    if (!auth) return Promise.resolve();
    // Fast path — already authenticated, no need to wait for an event
    if (auth.currentUser && !auth.currentUser.isAnonymous) return Promise.resolve();
    if (authReady) return authReady;
    authReady = new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user && !user.isAnonymous) {
                unsub();
                resolve();
            }
            // !user: don't resolve — subscriptions must wait for real login
        });
    });
    return authReady;
}
/**
 * Tiny helpers that mirror local arrays into Firestore collections. Each
 * record needs an `id` field — services already guarantee this via genId().
 *
 * In demo mode (no env vars / no `db`) these are no-ops, so the localStorage
 * cache keeps working transparently.
 */
export const isFirestoreReady = () => !!db;

// Optional callback invoked whenever a write to Firestore fails.
// Set this in the app shell so users see a toast instead of a silent failure.
let _onWriteError = null;
export function setWriteErrorHandler(handler) { _onWriteError = handler; }
function notifyWriteError(name, error) {
    console.warn(`[firestoreSync] write failed (${name})`, error);
    if (_onWriteError) _onWriteError(name, error);
}
const safeDb = () => {
    if (!db)
        throw new Error('Firestore not configured');
    return db;
};
/** Bulk replace a collection's contents with `items` (writes in chunks of 400). */
export async function replaceCollection(name, items) {
    if (!db)
        return;
    try {
        await waitForAuth();
        const database = safeDb();
        // Read current ids so we can prune removed records.
        const existingSnap = await getDocs(collection(database, name));
        const incomingIds = new Set(items.filter(i => i && i.id != null).map(i => String(i.id)));
        const toDelete = [];
        existingSnap.forEach(d => { if (!incomingIds.has(d.id))
            toDelete.push(d.id); });
        // Chunked writes to respect Firestore's 500-op batch limit.
        const ops = [
            ...items
                .filter(i => i && i.id != null)
                .map(i => ({ kind: 'set', id: String(i.id), data: i })),
            ...toDelete.map(id => ({ kind: 'del', id })),
        ];
        for (let i = 0; i < ops.length; i += 400) {
            const batch = writeBatch(database);
            ops.slice(i, i + 400).forEach(op => {
                const ref = doc(database, name, op.id);
                if (op.kind === 'set')
                    batch.set(ref, op.data, { merge: true });
                else
                    batch.delete(ref);
            });
            await batch.commit();
        }
    }
    catch (error) {
        notifyWriteError(name, error);
    }
}
/** Upsert a single document. */
export async function upsertDoc(name, item) {
    if (!db || !item || item.id == null)
        return;
    try {
        await waitForAuth();
        await setDoc(doc(safeDb(), name, String(item.id)), item, { merge: true });
    }
    catch (error) {
        notifyWriteError(name, error);
    }
}
/** Remove a single document. */
export async function removeDoc(name, id) {
    if (!db)
        return;
    try {
        await waitForAuth();
        await deleteDoc(doc(safeDb(), name, String(id)));
    }
    catch (error) {
        console.warn(`[firestoreSync] removeDoc(${name}/${id}) failed`, error);
    }
}
/** Fetch the whole collection once. Returns [] in demo mode. */
export async function readCollection(name) {
    if (!db)
        return [];
    try {
        await waitForAuth();
        const snap = await getDocs(query(collection(safeDb(), name)));
        return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    }
    catch (error) {
        console.warn(`[firestoreSync] readCollection(${name}) failed`, error);
        return [];
    }
}
/** Subscribe to a collection. Returns an Unsubscribe; no-op in demo mode.
 *  Pass Firestore query constraints (e.g. where(...)) as the third argument
 *  to filter results — required for role-scoped queries (members, collectors). */
export function subscribeCollection(name, onChange, constraints = []) {
    if (!db)
        return () => { };
    let canceled = false;
    let inner = () => { };
    waitForAuth().then(() => {
        if (canceled)
            return;
        try {
            inner = onSnapshot(
                query(collection(safeDb(), name), ...constraints),
                snap => onChange(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
                error => console.warn(`[firestoreSync] subscribe(${name})`, error)
            );
        }
        catch (error) {
            console.warn(`[firestoreSync] subscribe(${name}) failed`, error);
        }
    });
    return () => { canceled = true; inner(); };
}

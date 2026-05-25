import { listUsers, createUser, updateUser } from './userService';
import { validateMemberRegistration } from '../validation/memberRules';
import { registrationAuth, registrationDb, registrationStorage, db, storage } from '../utils/firebase';
import { uploadRegistrationDoc } from './storageService';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Members are users with role: 'member'. The doc references a logical
// "members" collection — in this client we project from the users store.
export function listMembers() {
    return listUsers().filter(u => u.role === 'member');
}
export function findMember(memberId) {
    return listMembers().find(m => m.id === memberId);
}

// Upload a File object to Firebase Storage under registration/{uid}/{key}.
// Returns the download URL, or null on failure.
async function uploadDocFile(uid, key, file, storageInstance) {
    if (!file) return null;
    if (typeof file === 'string') return file; // already a URL — pass through
    try {
        return await uploadRegistrationDoc(uid, key, file, storageInstance);
    } catch {
        return null;
    }
}

// Upload a base64 data URL (selfie) to Firebase Storage.
// Returns the download URL, or null if storage is unavailable or upload fails.
async function uploadDataUrl(storagePath, dataUrl, storageInstance) {
    if (!dataUrl || !dataUrl.startsWith('data:')) return null;
    const st = storageInstance || storage;
    if (!st) return dataUrl; // demo mode: keep data URL directly
    try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const snap = await uploadBytes(ref(st, storagePath), blob, { contentType: 'image/jpeg' });
        return await getDownloadURL(snap.ref);
    } catch {
        return dataUrl; // storage upload failed: keep data URL as fallback
    }
}

// Convert a File to a base64 data URL (used in demo/no-storage mode).
function fileToDataUrl(file) {
    if (!file || typeof file === 'string') return Promise.resolve(file || null);
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

// Document image fields that are allowed to carry a data: URL as a fallback
// when Firebase Storage upload fails. These are already compressed to ~1400px
// so the base64 payload stays well under Firestore's 1 MB doc limit.
const DOC_IMAGE_FIELDS = new Set(['passportPic', 'ghanaCardFront', 'ghanaCardBack', 'liveSelfie', 'profilePic']);

// Sanitise a profile for Firestore/localStorage:
// - strip File objects (not JSON-serialisable)
// - strip undefined values (Firestore rejects them)
// - strip data: URLs from non-document fields (size guard), but KEEP them for
//   document image fields so the fallback survives when Storage is unavailable
function sanitiseProfile(profile) {
    const out = {};
    for (const [k, v] of Object.entries(profile)) {
        if (v === undefined) continue;
        if (v instanceof File) continue;
        if (typeof v === 'string' && v.startsWith('data:') && !DOC_IMAGE_FIELDS.has(k)) { out[k] = null; continue; }
        out[k] = v;
    }
    return out;
}

// Strip File objects from a profile (File cannot be serialised to JSON/localStorage).
function stripFileObjects(profile) {
    return Object.fromEntries(
        Object.entries(profile).map(([k, v]) => [k, v instanceof File ? null : v])
    );
}

export async function registerMember(input) {
    const validation = validateMemberRegistration(input, listUsers());
    if (!validation.ok)
        return { ok: false, message: validation.message, field: validation.field };

    const baseProfile = {
        ...input,
        role: 'member',
        status: input.status || 'pending',
    };

    if (registrationAuth && (registrationDb || db)) {
        try {
            const normalizedEmail = String(input.email || '').trim().toLowerCase();
            // Use the secondary auth instance so the admin/manager's session is unaffected.
            const credential = await createUserWithEmailAndPassword(registrationAuth, normalizedEmail, input.password);
            const uid = credential.user.uid;
            const { password, ...profileInput } = baseProfile;

            // Upload ALL documents using registrationStorage (authenticated as the
            // new member) so uploads succeed even when the main app has no auth session.
            const regStorage = registrationStorage;
            const [passportPicUrl, ghanaCardFrontUrl, ghanaCardBackUrl, liveSelfieUrl] =
                await Promise.all([
                    uploadDocFile(uid, 'passportPic',    profileInput.passportPic,    regStorage),
                    uploadDocFile(uid, 'ghanaCardFront', profileInput.ghanaCardFront, regStorage),
                    uploadDocFile(uid, 'ghanaCardBack',  profileInput.ghanaCardBack,  regStorage),
                    uploadDataUrl(`registration/${uid}/selfie.jpg`, profileInput.liveSelfie, regStorage),
                ]);

            // Force the ID token to be attached to the registrationApp's auth context
            // before the Firestore write. Without this there is a race condition where
            // setDoc fires before Firestore has picked up the newly-minted session.
            await credential.user.getIdToken();

            const profile = sanitiseProfile({
                ...profileInput,
                id: uid,
                authUid: uid,
                email: normalizedEmail,
                passportPic:    passportPicUrl,
                ghanaCardFront: ghanaCardFrontUrl,
                ghanaCardBack:  ghanaCardBackUrl,
                liveSelfie:     liveSelfieUrl,
            });

            // Use registrationDb so request.auth.uid === uid, satisfying the
            // ownsDoc Firestore rule for the newly created (unapproved) account.
            const writeDb = registrationDb || db;
            try {
                await setDoc(doc(writeDb, 'users', uid), profile, { merge: true });
            } catch (fsErr) {
                // Fallback: try writing with the main db. This succeeds when the
                // Firestore rule allows pending-member creates without ownsDoc.
                console.warn('[memberService] registrationDb write failed, trying main db', fsErr);
                await setDoc(doc(db, 'users', uid), profile, { merge: true });
            }
            return createUser(profile);
        }
        catch (error) {
            const code = error?.code || '';
            if (code === 'auth/email-already-in-use') {
                return { ok: false, message: 'An account already exists for this email address.', field: 'email' };
            }
            if (code === 'auth/invalid-email') {
                return { ok: false, message: 'Enter a valid email address.', field: 'email' };
            }
            if (code === 'auth/weak-password') {
                return { ok: false, message: 'Password should be at least 6 characters.', field: 'password' };
            }
            if (code === 'auth/too-many-requests') {
                return { ok: false, message: 'Too many attempts. Please wait a few minutes and try again.' };
            }
            if (code === 'auth/network-request-failed') {
                return { ok: false, message: 'Network error. Check your connection and try again.' };
            }
            console.error('[memberService] Firebase registration failed', { code, message: error?.message, error });
            return { ok: false, message: `Registration failed (${code || error?.message || 'unknown error'}). Please try again or contact support.` };
        }
    }

    // Demo mode (no Firebase) — convert File objects to data URLs for localStorage.
    const [passportPicUrl, ghanaCardFrontUrl, ghanaCardBackUrl] = await Promise.all([
        fileToDataUrl(baseProfile.passportPic),
        fileToDataUrl(baseProfile.ghanaCardFront),
        fileToDataUrl(baseProfile.ghanaCardBack),
    ]);
    const demoProfile = stripFileObjects({
        ...baseProfile,
        passportPic:    passportPicUrl,
        ghanaCardFront: ghanaCardFrontUrl,
        ghanaCardBack:  ghanaCardBackUrl,
    });
    return createUser(demoProfile);
}
export function approveMember(memberId, approvedBy, currentData = null) {
    const member = listUsers().find(u => String(u.id) === String(memberId)) ?? currentData;
    if (!member) return null;
    if (member.status === 'approved') return member;
    if (member.status === 'rejected') return null;
    return updateUser(memberId, { status: 'approved', approvedBy, approvedAt: new Date().toISOString() }, member);
}
export function rejectMember(memberId, rejectedBy, currentData = null) {
    const member = listUsers().find(u => String(u.id) === String(memberId)) ?? currentData;
    if (!member) return null;
    if (member.status === 'rejected') return member;
    return updateUser(memberId, { status: 'rejected', rejectedBy, rejectedAt: new Date().toISOString() }, member);
}
export function suspendMember(memberId, currentData = null) {
    const member = listUsers().find(u => String(u.id) === String(memberId)) ?? currentData;
    if (!member || member.status === 'suspended') return member ?? null;
    return updateUser(memberId, { status: 'suspended' }, member);
}
export function reinstateMember(memberId, reinstatedBy, currentData = null) {
    const member = listUsers().find(u => String(u.id) === String(memberId)) ?? currentData;
    if (!member || !['suspended', 'rejected'].includes(member.status)) return null;
    return updateUser(memberId, { status: 'approved', reinstatedBy, reinstatedAt: new Date().toISOString() }, member);
}
export function assignGroup(memberId, groupId, currentData = null) {
    return updateUser(memberId, { groupId }, currentData);
}

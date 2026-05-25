import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../utils/firebase';

// ─── Image compression ────────────────────────────────────────────────────────
// Resize + re-encode to JPEG before upload. Keeps registration docs and profile
// photos under ~200 KB even from high-res phone cameras.
// Non-image files (PDFs, etc.) pass through unchanged.
async function compressImage(file, maxPx = 1400, quality = 0.82) {
    if (!file || !file.type.startsWith('image/')) return file;
    if (typeof window === 'undefined') return file;
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, maxPx / Math.max(img.width || 1, img.height || 1));
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
                blob => resolve(blob ?? file),
                'image/jpeg',
                quality,
            );
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

// ─── Core upload ──────────────────────────────────────────────────────────────
/**
 * Upload a file to Firebase Storage at the given path. Compresses images
 * client-side before sending to keep sizes reasonable.
 *
 * In demo mode (no Firebase env vars) or when Firebase upload fails, falls
 * back to a data URL so the rest of the UI keeps working.
 */
// storageInstance is optional — pass registrationStorage during member registration
// so uploads use the new member's auth context rather than the main app's session.
export async function uploadFile(path, file, storageInstance) {
    const compressed = await compressImage(file);
    const contentType = file.type.startsWith('image/')
        ? 'image/jpeg'
        : (file.type || 'application/octet-stream');

    const st = storageInstance || storage;
    if (st) {
        try {
            const fileRef = ref(st, path);
            const snapshot = await uploadBytes(fileRef, compressed, {
                contentType,
                customMetadata: {
                    originalName: file.name || 'upload',
                    uploadedAt: new Date().toISOString(),
                },
            });
            return await getDownloadURL(snapshot.ref);
        } catch (error) {
            const code = error?.code || '';
            if (code === 'storage/unauthorized') {
                console.error(
                    `[storageService] Upload to "${path}" was rejected by Storage rules. ` +
                    'Check that the path matches an allow-write rule and the user is authenticated if required.',
                    error,
                );
            } else if (code === 'storage/object-not-found') {
                console.error(`[storageService] Path "${path}" not found.`, error);
            } else {
                console.warn(`[storageService] Upload to "${path}" failed — falling back to data URL.`, error);
            }
        }
    }

    // Demo fallback: return a compressed data URL.
    return readAsDataUrl(compressed);
}

export async function deleteFile(path) {
    if (!storage) return;
    try {
        await deleteObject(ref(storage, path));
    } catch (error) {
        if (error?.code !== 'storage/object-not-found') {
            console.warn('[storageService] delete failed', error);
        }
    }
}

// ─── Domain-specific helpers ─────────────────────────────────────────────────
export async function uploadProfileImage(userId, file) {
    return uploadFile(profileImagePath(userId, file), file);
}

export async function uploadPaymentProof(paymentId, file) {
    return uploadFile(paymentProofPath(paymentId, file), file);
}

/**
 * Upload a registration document for a (not-yet-authenticated) applicant.
 * The `userId` here is a temporary identifier — the storage rules for the
 * registration/ path do not require Firebase Auth so this always succeeds
 * when Firebase Storage is configured.
 */
export async function uploadRegistrationDoc(userId, kind, file, storageInstance) {
    return uploadFile(registrationDocPath(userId, kind, file), file, storageInstance);
}

// ─── Path builders ────────────────────────────────────────────────────────────
const extOf = (file) => {
    const name = file?.name || '';
    const dot = name.lastIndexOf('.');
    if (dot > -1 && dot < name.length - 1) return name.slice(dot).toLowerCase();
    const type = (file?.type || '').toLowerCase();
    if (type === 'image/png')  return '.png';
    if (type === 'image/jpeg' || type === 'image/jpg') return '.jpg';
    if (type === 'image/webp') return '.webp';
    if (type === 'application/pdf') return '.pdf';
    return '.jpg';
};

function profileImagePath(userId, file) {
    return `users/${userId}/profile${extOf(file)}`;
}

function paymentProofPath(paymentId, file) {
    return `payments/${paymentId}/proof${extOf(file)}`;
}

function registrationDocPath(userId, kind, file) {
    return `registration/${userId}/${kind}${extOf(file)}`;
}

// ─── File reader helper ───────────────────────────────────────────────────────
function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

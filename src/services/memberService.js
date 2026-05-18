import { listUsers, createUser, updateUser } from './userService';
import { validateMemberRegistration } from '../validation/memberRules';
import { auth, db } from '../utils/firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
// Members are users with role: 'member'. The doc references a logical
// "members" collection — in this client we project from the users store.
export function listMembers() {
    return listUsers().filter(u => u.role === 'member');
}
export function findMember(memberId) {
    return listMembers().find(m => m.id === memberId);
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

    if (auth && db) {
        try {
            const normalizedEmail = String(input.email || '').trim().toLowerCase();
            const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, input.password);
            const uid = credential.user.uid;
            const { password, ...profileInput } = baseProfile;
            const profile = {
                ...profileInput,
                id: uid,
                authUid: uid,
                email: normalizedEmail,
            };
            await setDoc(doc(db, 'users', uid), profile, { merge: true });
            await signOut(auth);
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
            console.error('[memberService] Firebase registration failed', error);
            return { ok: false, message: 'Registration could not be submitted. Try again.' };
        }
    }

    return createUser(baseProfile);
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

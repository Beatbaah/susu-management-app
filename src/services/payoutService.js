import { readStore, writeStore } from './storage';
import { PAYOUT_SCHEDULE } from '../data/mockData';
import { advanceRound, findGroup } from './groupService';
import { listPayments, replacePayments } from './paymentService';
import { listUsers } from './userService';
import { validatePayoutCompletion } from '../validation/payoutRules';
import { replaceCollection, upsertDoc, isFirestoreReady } from './firestoreSync';
import { genId } from '../utils/helpers';
const STORE_KEY = 'schedule';
const FIRESTORE_COLLECTION = 'payouts';
export function listPayouts() {
    return readStore(STORE_KEY, PAYOUT_SCHEDULE);
}
export function findPayout(payoutId) {
    return listPayouts().find(p => p.id === payoutId);
}
export function replacePayouts(next) {
    writeStore(STORE_KEY, next);
    void replaceCollection(FIRESTORE_COLLECTION, next);
}

// In Firestore mode listPayouts() returns PAYOUT_SCHEDULE (localStorage cleared on mount).
// Return [] instead so callers know to use the provided currentData parameter.
function getLocalPayouts() {
    const all = listPayouts();
    return all === PAYOUT_SCHEDULE ? [] : all;
}

// completePayout accepts currentData, currentPayments, and currentGroup so
// AppContext can pass Firestore-subscribed state when localStorage is empty.
export function completePayout(payoutId, completedBy, override = false, currentData = null, currentPayments = null, currentGroup = null) {
    const allPayouts = getLocalPayouts();
    const current = allPayouts.length > 0 ? allPayouts.find(p => p.id === payoutId) : currentData;
    if (!current)
        return { ok: false, message: 'Payout not found.' };
    if (current.status === 'completed' || current.paid)
        return { ok: true, payout: current };
    const group = findGroup(current.groupId) || currentGroup;
    // Use localStorage payments in demo mode; fall back to subscribed state in Firestore mode.
    const localPayments = listPayments();
    const allPayments = localPayments === null || (Array.isArray(localPayments) && localPayments.length === 0 && isFirestoreReady())
        ? (currentPayments || [])
        : localPayments;
    const validation = validatePayoutCompletion({ payout: current, group, payments: allPayments, override });
    if (!validation.ok)
        return { ok: false, message: validation.message };
    const next = {
        ...current,
        status: 'completed',
        paid: true,
        paidAt: new Date().toISOString(),
        completedBy,
    };
    if (allPayouts.length > 0)
        replacePayouts(allPayouts.map(p => (p.id === payoutId ? next : p)));
    void upsertDoc(FIRESTORE_COLLECTION, next);
    let updatedGroup = null;
    let generatedPayments = [];
    if (current.groupId) {
        updatedGroup = advanceRound(current.groupId) || (group ? { ...group, currentRound: (group.currentRound || 1) + 1 } : null);
        if (updatedGroup) {
            const members = Array.isArray(updatedGroup.members) ? updatedGroup.members : [];
            const newRound = updatedGroup.currentRound;
            const amount = updatedGroup.contributionAmount || updatedGroup.contribution || 0;
            const dueDateObj = new Date();
            dueDateObj.setDate(dueDateObj.getDate() + 7);
            const dueDate = dueDateObj.toISOString().split('T')[0];
            if (members.length > 0) {
                const existingKeys = new Set(allPayments.map(p => `${String(p.userId || p.memberId)}::${String(p.groupId)}::${String(p.round)}`));
                generatedPayments = members
                    .filter((mId) => !existingKeys.has(`${String(mId)}::${String(updatedGroup.id)}::${String(newRound)}`))
                    .map((mId) => ({
                    id: genId(),
                    userId: mId,
                    memberId: mId,
                    groupId: updatedGroup.id,
                    groupName: updatedGroup.groupName || updatedGroup.name,
                    amount,
                    date: dueDate,
                    dueDate,
                    status: 'pending',
                    round: newRound,
                    method: '',
                    ref: ''
                }));
                if (generatedPayments.length > 0) {
                    if (!isFirestoreReady() && allPayouts.length > 0) {
                        replacePayments([...generatedPayments, ...allPayments]);
                    }
                    generatedPayments.forEach(p => void upsertDoc('payments', p));
                }
            }
        }
    }
    return { ok: true, payout: next, group: updatedGroup, generatedPayments };
}
export function assignPayoutRecipient(payoutId, recipientId, assignedBy, currentData = null, currentUsers = null, currentGroup = null) {
    const allPayouts = getLocalPayouts();
    const current = allPayouts.length > 0 ? allPayouts.find(p => p.id === payoutId) : currentData;
    if (!current)
        return { ok: false, message: 'Payout not found.' };
    if (current.paid || current.status === 'completed' || current.status === 'paid')
        return { ok: false, message: 'Completed payouts cannot be reassigned.' };
    const allUsers = listUsers();
    const usersList = (allUsers === null || (isFirestoreReady() && allUsers.length === 0))
        ? (currentUsers || [])
        : allUsers;
    const recipient = usersList.find(u => String(u.id) === String(recipientId));
    if (!recipient)
        return { ok: false, message: 'Member not found.' };
    if (recipient.status !== 'approved')
        return { ok: false, message: 'Only active members can receive payouts.' };
    const group = findGroup(current.groupId) || currentGroup;
    if (group && Array.isArray(group.members) && !group.members.map(String).includes(String(recipientId)))
        return { ok: false, message: 'Member is not part of this group.' };
    const next = {
        ...current,
        recipientId,
        memberId: recipientId,
        assignedBy,
        assignedAt: new Date().toISOString(),
    };
    if (allPayouts.length > 0) replacePayouts(allPayouts.map(p => (p.id === payoutId ? next : p)));
    void upsertDoc(FIRESTORE_COLLECTION, next);
    return { ok: true, payout: next };
}

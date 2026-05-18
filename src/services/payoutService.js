import { readStore, writeStore } from './storage';
import { PAYOUT_SCHEDULE } from '../data/mockData';
import { advanceRound, findGroup } from './groupService';
import { listPayments, replacePayments } from './paymentService';
import { validatePayoutCompletion } from '../validation/payoutRules';
import { replaceCollection, upsertDoc } from './firestoreSync';
import { genId } from '../utils/helpers';
// In Firestore the collection is named 'payouts' (per ARCHITECTURE.md).
// The local cache key stays 'schedule' for backwards compatibility.
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
export function completePayout(payoutId, completedBy, override = false) {
    const current = findPayout(payoutId);
    if (!current)
        return { ok: false, message: 'Payout not found.' };
    if (current.status === 'completed' || current.paid) {
        return { ok: true, payout: current };
    }
    const group = findGroup(current.groupId);
    const validation = validatePayoutCompletion({
        payout: current,
        group,
        payments: listPayments(),
        override,
    });
    if (!validation.ok)
        return { ok: false, message: validation.message };
    const next = {
        ...current,
        status: 'completed',
        paid: true,
        paidAt: new Date().toISOString(),
        completedBy,
    };
    replacePayouts(listPayouts().map(p => (p.id === payoutId ? next : p)));
    void upsertDoc(FIRESTORE_COLLECTION, next);
    let updatedGroup = null;
    let generatedPayments = [];
    if (current.groupId) {
        updatedGroup = advanceRound(current.groupId);
        if (updatedGroup) {
            const members = Array.isArray(updatedGroup.members) ? updatedGroup.members : [];
            const newRound = updatedGroup.currentRound;
            const amount = updatedGroup.contributionAmount || updatedGroup.contribution || 0;
            const dueDateObj = new Date();
            dueDateObj.setDate(dueDateObj.getDate() + 7);
            const dueDate = dueDateObj.toISOString().split('T')[0];
            if (members.length > 0) {
                const currentPayments = listPayments();
                const existingKeys = new Set(currentPayments.map(p => `${String(p.userId || p.memberId)}::${String(p.groupId)}::${String(p.round)}`));
                generatedPayments = members
                    .filter((mId) => !existingKeys.has(`${String(mId)}::${String(updatedGroup.id)}::${String(newRound)}`))
                    .map((mId) => ({
                    id: genId(),
                    userId: mId,
                    memberId: mId,
                    groupId: updatedGroup.id,
                    groupName: updatedGroup.groupName || updatedGroup.name,
                    amount,
                    date: '',
                    dueDate,
                    status: 'pending',
                    round: newRound,
                    method: '',
                    ref: ''
                }));
                if (generatedPayments.length > 0) {
                    replacePayments([...generatedPayments, ...currentPayments]);
                }
            }
        }
    }
    return { ok: true, payout: next, group: updatedGroup, generatedPayments };
}
export function assignPayoutRecipient(payoutId, recipientId, assignedBy) {
    const current = findPayout(payoutId);
    if (!current)
        return { ok: false, message: 'Payout not found.' };
    if (current.paid || current.status === 'completed' || current.status === 'paid') {
        return { ok: false, message: 'Completed payouts cannot be reassigned.' };
    }
    const next = {
        ...current,
        recipientId,
        memberId: recipientId,
        assignedBy,
        assignedAt: new Date().toISOString(),
    };
    replacePayouts(listPayouts().map(p => (p.id === payoutId ? next : p)));
    void upsertDoc(FIRESTORE_COLLECTION, next);
    return { ok: true, payout: next };
}

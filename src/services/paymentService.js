import { readStore, writeStore } from './storage';
import { MOCK_PAYMENTS } from '../data/mockData';
import { genId, genRef } from '../utils/helpers';
import { validatePaymentRecord } from '../validation/paymentRules';
import { findGroup } from './groupService';
import { listUsers } from './userService';
import { replaceCollection, upsertDoc } from './firestoreSync';
const STORE_KEY = 'payments';
export function listPayments() {
    return readStore(STORE_KEY, MOCK_PAYMENTS);
}
export function findPayment(paymentId) {
    return listPayments().find(p => p.id === paymentId);
}
export function replacePayments(next) {
    writeStore(STORE_KEY, next);
    void replaceCollection(STORE_KEY, next);
}
export function recordPayment(draft, actorRole) {
    const group = findGroup(draft.groupId);
    const validation = validatePaymentRecord({
        payment: draft,
        group,
        payments: listPayments(),
        actorRole,
    });
    if (!validation.ok)
        return { ok: false, message: validation.message };
    const today = new Date().toISOString().split('T')[0];
    const payment = {
        id: genId(),
        status: 'pending',
        date: today,
        paymentDate: today,
        ref: draft.ref || genRef(),
        method: draft.method || 'Cash',
        groupName: group?.groupName || group?.name,
        memberId: draft.memberId ?? draft.userId,
        userId: draft.userId ?? draft.memberId,
        ...draft,
    };
    replacePayments([payment, ...listPayments()]);
    void upsertDoc(STORE_KEY, payment);
    return { ok: true, payment };
}
export function confirmPayment(paymentId, confirmedBy, actorRole) {
    if (actorRole && !['admin', 'manager'].includes(actorRole))
        return null;
    const current = findPayment(paymentId);
    if (!current || current.status === 'paid')
        return current ?? null;
    // Do not confirm payments for suspended or rejected members.
    const payerId = current.userId || current.memberId;
    const payer = payerId ? listUsers().find(u => String(u.id) === String(payerId)) : null;
    if (payer && payer.status !== 'approved')
        return null;
    const next = {
        ...current,
        status: 'paid',
        confirmedBy,
        paymentDate: current.paymentDate || new Date().toISOString().split('T')[0],
    };
    replacePayments(listPayments().map(p => (p.id === paymentId ? next : p)));
    void upsertDoc(STORE_KEY, next);
    return next;
}
export function rejectPayment(paymentId, rejectedBy, actorRole) {
    if (actorRole && !['admin', 'manager'].includes(actorRole))
        return null;
    const current = findPayment(paymentId);
    if (!current || current.status === 'rejected')
        return current ?? null;
    const next = {
        ...current,
        status: 'rejected',
        rejectedBy,
        rejectedAt: new Date().toISOString(),
    };
    replacePayments(listPayments().map(p => (p.id === paymentId ? next : p)));
    void upsertDoc(STORE_KEY, next);
    return next;
}
/**
 * Patch a payment. Locked once status === 'paid' so confirmed payments are
 * never silently re-written (per the financial-rule architecture). Returns
 * the updated record or a rejection.
 */
export function reopenPayment(paymentId, reopenedBy) {
    const current = findPayment(paymentId);
    if (!current || current.status !== 'rejected')
        return null;
    const { rejectedBy: _rb, rejectedAt: _ra, ...rest } = current;
    const next = { ...rest, status: 'pending', reopenedBy, reopenedAt: new Date().toISOString() };
    replacePayments(listPayments().map(p => (p.id === paymentId ? next : p)));
    void upsertDoc(STORE_KEY, next);
    return next;
}
export function markOverduePayments() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const all = listPayments();
    let changed = false;
    const updated = all.map(p => {
        if (p.status === 'pending' && p.dueDate && p.dueDate < today) {
            changed = true;
            return { ...p, status: 'overdue', updatedAt: new Date().toISOString() };
        }
        return p;
    });
    if (changed) replacePayments(updated);
    return { changed, payments: updated };
}
export function updatePayment(paymentId, patch, actorRole) {
    const current = findPayment(paymentId);
    if (!current)
        return { ok: false, message: 'Payment not found.' };
    if (current.status === 'paid') {
        return { ok: false, message: 'Confirmed payments cannot be edited.' };
    }
    const merged = { ...current, ...patch };
    const group = findGroup(merged.groupId);
    const validation = validatePaymentRecord({
        payment: merged,
        group,
        payments: listPayments().filter(p => p.id !== paymentId), // exclude self from duplicate-check
        actorRole,
    });
    if (!validation.ok)
        return { ok: false, message: validation.message };
    const next = { ...merged, updatedAt: new Date().toISOString() };
    replacePayments(listPayments().map(p => (p.id === paymentId ? next : p)));
    void upsertDoc(STORE_KEY, next);
    return { ok: true, payment: next };
}

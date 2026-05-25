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

// Helper: get payment list for demo mode; never call replacePayments in Firestore mode
// (listPayments() returns MOCK data in Firestore mode because clearNamespace() wipes localStorage).
function getLocalPayments() {
    const all = listPayments();
    // MOCK_PAYMENTS have sequential ids like 'pay1'. Real ids are UUIDs.
    // If the list is the mock default, treat it as empty for write operations.
    return all === MOCK_PAYMENTS ? [] : all;
}

// Accept currentData so callers (AppContext) can pass the Firestore-subscribed
// payment object when the local store is empty.
export function recordPayment(draft, actorRole, currentPayments = null, currentGroup = null) {
    const all = getLocalPayments();
    const paymentsList = all.length > 0 ? all : (currentPayments || []);
    const group = findGroup(draft.groupId) || currentGroup;
    const validation = validatePaymentRecord({ payment: draft, group, payments: paymentsList, actorRole });
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
    if (all.length > 0) {
        replacePayments([payment, ...all]);
    }
    void upsertDoc(STORE_KEY, payment);
    return { ok: true, payment };
}
export function confirmPayment(paymentId, confirmedBy, actorRole, currentData = null, currentUsers = null) {
    if (actorRole && !['admin', 'manager'].includes(actorRole))
        return null;
    const all = getLocalPayments();
    const current = all.length > 0 ? all.find(p => p.id === paymentId) : currentData;
    if (!current || current.status === 'paid')
        return current ?? null;
    const payerId = current.userId || current.memberId;
    // Prefer live users list (passed from AppContext in Firestore mode) over localStorage.
    const usersList = currentUsers?.length > 0 ? currentUsers : listUsers();
    const payer = payerId ? usersList.find(u => String(u.id) === String(payerId)) : null;
    if (payer && payer.status !== 'approved')
        return null;
    const next = {
        ...current,
        status: 'paid',
        confirmedBy,
        paymentDate: current.paymentDate || new Date().toISOString().split('T')[0],
    };
    if (all.length > 0) replacePayments(all.map(p => (p.id === paymentId ? next : p)));
    void upsertDoc(STORE_KEY, next);
    return next;
}
export function rejectPayment(paymentId, rejectedBy, actorRole, currentData = null) {
    if (actorRole && !['admin', 'manager'].includes(actorRole))
        return null;
    const all = getLocalPayments();
    const current = all.length > 0 ? all.find(p => p.id === paymentId) : currentData;
    if (!current || current.status === 'rejected')
        return current ?? null;
    const next = {
        ...current,
        status: 'rejected',
        rejectedBy,
        rejectedAt: new Date().toISOString(),
    };
    if (all.length > 0) replacePayments(all.map(p => (p.id === paymentId ? next : p)));
    void upsertDoc(STORE_KEY, next);
    return next;
}
export function reopenPayment(paymentId, reopenedBy, currentData = null) {
    const all = getLocalPayments();
    const current = all.length > 0 ? all.find(p => p.id === paymentId) : currentData;
    if (!current || current.status !== 'rejected')
        return null;
    const { rejectedBy: _rb, rejectedAt: _ra, ...rest } = current;
    const next = { ...rest, status: 'pending', reopenedBy, reopenedAt: new Date().toISOString() };
    if (all.length > 0) replacePayments(all.map(p => (p.id === paymentId ? next : p)));
    void upsertDoc(STORE_KEY, next);
    return next;
}
export function markOverduePayments() {
    const all = getLocalPayments();
    if (all.length === 0) return { changed: false, payments: [] };
    const today = new Date().toISOString().split('T')[0];
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
export function updatePayment(paymentId, patch, actorRole, currentData = null) {
    const all = getLocalPayments();
    const current = all.length > 0 ? all.find(p => p.id === paymentId) : currentData;
    if (!current)
        return { ok: false, message: 'Payment not found.' };
    if (current.status === 'paid')
        return { ok: false, message: 'Confirmed payments cannot be edited.' };
    const merged = { ...current, ...patch };
    const group = findGroup(merged.groupId);
    const validation = validatePaymentRecord({
        payment: merged,
        group,
        payments: all.length > 0 ? all.filter(p => p.id !== paymentId) : [],
        actorRole,
    });
    if (!validation.ok)
        return { ok: false, message: validation.message };
    const next = { ...merged, updatedAt: new Date().toISOString() };
    if (all.length > 0) replacePayments(all.map(p => (p.id === paymentId ? next : p)));
    void upsertDoc(STORE_KEY, next);
    return { ok: true, payment: next };
}

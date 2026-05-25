import { readStore, writeStore } from './storage';
import { MOCK_REMINDERS } from '../data/mockData';
import { genId } from '../utils/helpers';
import { replaceCollection, upsertDoc, removeDoc, isFirestoreReady } from './firestoreSync';
// Notifications == reminders in the current data model.
const STORE_KEY = 'reminders';
const FIRESTORE_COLLECTION = 'notifications';
export function listReminders() {
    return readStore(STORE_KEY, MOCK_REMINDERS);
}
export function replaceReminders(next) {
    writeStore(STORE_KEY, next);
    // In Firestore mode listReminders() returns MOCK data (localStorage cleared on mount),
    // so never use replaceCollection here — callers use individual upsertDoc/removeDoc instead.
    if (!isFirestoreReady()) void replaceCollection(FIRESTORE_COLLECTION, next);
}
export function sendReminder({ userIds, title, text, type = 'info' }) {
    const now = new Date().toISOString();
    const created = userIds.map(userId => ({
        id: genId(),
        userId,
        title,
        text,
        message: text,
        date: now.split('T')[0],
        sent: now,
        type,
        read: false,
    }));
    if (isFirestoreReady()) {
        created.forEach(r => void upsertDoc(FIRESTORE_COLLECTION, r));
    } else {
        replaceReminders([...created, ...listReminders()]);
    }
    return created;
}
export function markRead(reminderId) {
    if (isFirestoreReady()) {
        void upsertDoc(FIRESTORE_COLLECTION, { id: reminderId, read: true });
    } else {
        const updated = listReminders().map(r => (r.id === reminderId ? { ...r, read: true } : r));
        replaceReminders(updated);
    }
}
export function markAllRead() {
    if (isFirestoreReady()) {
        // AppContext.markAllRemindersRead handles the Firestore upserts from React state.
        // This path is only hit in demo mode (no-op guard here is a safety net).
        return;
    }
    const updated = listReminders().map(r => ({ ...r, read: true }));
    replaceReminders(updated);
}
export function deleteReminder(reminderId) {
    if (!isFirestoreReady()) {
        const updated = listReminders().filter(r => r.id !== reminderId);
        replaceReminders(updated);
    }
    void removeDoc(FIRESTORE_COLLECTION, reminderId);
}
export function clearReminders() {
    if (isFirestoreReady()) {
        // AppContext.clearReminders calls this then updates React state.
        // Individual removeDoc calls are handled by AppContext using reminders from state.
        return;
    }
    const current = listReminders();
    replaceReminders([]);
    current.forEach(r => void removeDoc(FIRESTORE_COLLECTION, r.id));
}

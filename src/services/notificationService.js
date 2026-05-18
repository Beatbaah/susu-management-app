import { readStore, writeStore } from './storage';
import { MOCK_REMINDERS } from '../data/mockData';
import { genId } from '../utils/helpers';
import { replaceCollection, upsertDoc, removeDoc } from './firestoreSync';
// Notifications == reminders in the current data model.
const STORE_KEY = 'reminders';
const FIRESTORE_COLLECTION = 'notifications';
export function listReminders() {
    return readStore(STORE_KEY, MOCK_REMINDERS);
}
export function replaceReminders(next) {
    writeStore(STORE_KEY, next);
    void replaceCollection(FIRESTORE_COLLECTION, next);
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
    replaceReminders([...created, ...listReminders()]);
    created.forEach(r => void upsertDoc(FIRESTORE_COLLECTION, r));
    return created;
}
export function markRead(reminderId) {
    const updated = listReminders().map(r => (r.id === reminderId ? { ...r, read: true } : r));
    replaceReminders(updated);
    const next = updated.find(r => r.id === reminderId);
    if (next)
        void upsertDoc(FIRESTORE_COLLECTION, next);
}
export function markAllRead() {
    const updated = listReminders().map(r => ({ ...r, read: true }));
    replaceReminders(updated);
}
export function deleteReminder(reminderId) {
    const updated = listReminders().filter(r => r.id !== reminderId);
    replaceReminders(updated);
    void removeDoc(FIRESTORE_COLLECTION, reminderId);
}
export function clearReminders() {
    const current = listReminders();
    replaceReminders([]);
    current.forEach(r => void removeDoc(FIRESTORE_COLLECTION, r.id));
}

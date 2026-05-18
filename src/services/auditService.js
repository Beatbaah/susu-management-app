import { readStore, writeStore } from './storage';
import { createAuditEntry } from '../utils/audit';
import { replaceCollection, upsertDoc } from './firestoreSync';
const STORE_KEY = 'auditLogs';
const MAX_LOG_ROWS = 250;
export function listLogs() {
    return readStore(STORE_KEY, []);
}
export function appendLog(actor, event) {
    const entry = createAuditEntry({ actor, ...event });
    const existing = listLogs();
    const next = [entry, ...existing].slice(0, MAX_LOG_ROWS);
    writeStore(STORE_KEY, next);
    // Firestore: append-only by writing the new entry. We don't sync the whole
    // collection here to avoid deleting historical audit records.
    void upsertDoc(STORE_KEY, entry);
    return entry;
}
export function replaceLogs(logs) {
    writeStore(STORE_KEY, logs.slice(0, MAX_LOG_ROWS));
}
export function clearLogs() {
    writeStore(STORE_KEY, []);
    void replaceCollection(STORE_KEY, []);
}

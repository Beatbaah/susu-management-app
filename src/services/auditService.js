import { readStore, writeStore } from './storage';
import { createAuditEntry } from '../utils/audit';
const STORE_KEY = 'auditLogs';
const MAX_LOG_ROWS = 100;
export function listLogs() {
    return readStore(STORE_KEY, []);
}
export function appendLog(actor, event) {
    const entry = createAuditEntry({ actor, ...event });
    const existing = listLogs();
    const combined = [entry, ...existing];
    if (combined.length > MAX_LOG_ROWS) {
        const notice = createAuditEntry({ actor: null, action: `Audit log truncated — ${combined.length - MAX_LOG_ROWS + 1} oldest entries removed.`, targetType: 'system', targetId: 'auditLogs' });
        combined.splice(MAX_LOG_ROWS - 1, combined.length, notice);
    }
    const next = combined;
    writeStore(STORE_KEY, next);
    return entry;
}
export function replaceLogs(logs) {
    writeStore(STORE_KEY, logs.slice(0, MAX_LOG_ROWS));
}
export function clearLogs() {
    writeStore(STORE_KEY, []);
}

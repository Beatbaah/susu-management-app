import { genId } from '../utils/helpers';
import { findGroup, updateGroup } from './groupService';
import { db } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';

const MAX_MESSAGE_LENGTH = 1000;

function sanitize(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .slice(0, MAX_MESSAGE_LENGTH);
}

export function listMessages(groupId) {
    const group = findGroup(groupId);
    return Array.isArray(group?.chat) ? group.chat : [];
}
export function postMessage(groupId, actor, message) {
    const text = sanitize((message || '').trim());
    if (!text)
        return null;
    const group = findGroup(groupId);
    if (!group)
        return null;
    const entry = {
        id: genId(),
        sender: actor?.id ?? 'unknown',
        senderName: sanitize(actor?.name || actor?.fullName || 'Unknown'),
        senderRole: actor?.role || 'member',
        msg: text,
        time: new Date().toISOString(),
    };
    const next = [...(Array.isArray(group.chat) ? group.chat : []), entry];
    updateGroup(groupId, { chat: next });
    if (db) {
        try {
            // Architecture: messages/{groupId}/items/{messageId}
            void setDoc(doc(db, 'messages', String(groupId), 'items', entry.id), entry, { merge: true });
        }
        catch (error) {
            console.warn('[chatService] Firestore write failed', error);
        }
    }
    return entry;
}

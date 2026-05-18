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
export function postMessage(groupId, actor, message, type = 'message') {
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
        type,
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
export function postAnnouncement(groupId, actor, message) {
    return postMessage(groupId, actor, message, 'announcement');
}
export function addReaction(groupId, messageId, emoji, userId) {
    const group = findGroup(groupId);
    if (!group) return null;
    const chat = Array.isArray(group.chat) ? group.chat : [];
    const next = chat.map(m => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = reactions[emoji] ? [...reactions[emoji]] : [];
        const idx = users.indexOf(userId);
        if (idx >= 0) users.splice(idx, 1); else users.push(userId); // toggle
        if (users.length === 0) delete reactions[emoji]; else reactions[emoji] = users;
        return { ...m, reactions };
    });
    updateGroup(groupId, { chat: next });
    return next;
}

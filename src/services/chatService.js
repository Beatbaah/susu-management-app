import { genId } from '../utils/helpers';
import { findGroup, updateGroup } from './groupService';
import { isFirestoreReady } from './firestoreSync';

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
    // In Firestore mode these paths are handled entirely by AppContext.
    if (isFirestoreReady()) return null;
    const text = sanitize((message || '').trim());
    if (!text)
        return null;
    const group = findGroup(groupId);
    if (!group)
        return null;
    if (actor?.role === 'member') {
        const members = Array.isArray(group.members) ? group.members : [];
        if (!members.map(String).includes(String(actor?.id))) return null;
    }
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
    return entry;
}
export function postAnnouncement(groupId, actor, message) {
    return postMessage(groupId, actor, message, 'announcement');
}
export function addReaction(groupId, messageId, emoji, userId) {
    // In Firestore mode these paths are handled entirely by AppContext.
    if (isFirestoreReady()) return null;
    const group = findGroup(groupId);
    if (!group) return null;
    const chat = Array.isArray(group.chat) ? group.chat : [];
    const next = chat.map(m => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = reactions[emoji] ? [...reactions[emoji]] : [];
        const idx = users.indexOf(userId);
        if (idx >= 0) users.splice(idx, 1); else users.push(userId);
        if (users.length === 0) delete reactions[emoji]; else reactions[emoji] = users;
        return { ...m, reactions };
    });
    updateGroup(groupId, { chat: next });
    return next;
}

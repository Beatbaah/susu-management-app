import { readStore, writeStore } from './storage';
import { MOCK_USERS } from '../data/mockData';
import { genId } from '../utils/helpers';
import { replaceCollection, upsertDoc, isFirestoreReady } from './firestoreSync';
const STORE_KEY = 'users';
const VALID_ROLES = new Set(['admin', 'manager', 'collector', 'member']);
export function listUsers() {
    return readStore(STORE_KEY, MOCK_USERS);
}
export function replaceUsers(next) {
    writeStore(STORE_KEY, next);
    void replaceCollection(STORE_KEY, next);
}
export function findUser(userId) {
    return listUsers().find(u => u.id === userId);
}
export function createUser(input) {
    const now = new Date().toISOString();
    const newUser = {
        id: input.id || genId(),
        role: VALID_ROLES.has(input.role) ? input.role : 'member',
        status: 'pending',
        color: '#5b8def',
        streak: 0,
        badges: [],
        points: 0,
        passportPic: null,
        ghanaCardFront: null,
        ghanaCardBack: null,
        liveSelfie: null,
        createdAt: now,
        updatedAt: now,
        ...input,
        fullName: input.fullName || input.name || '',
        phone: input.phone ? String(input.phone).replace(/[\s\-()]/g, '') : input.phone,
        joinedAt: input.joinedAt || now.split('T')[0],
    };
    const all = listUsers();
    if (!isFirestoreReady()) replaceUsers([newUser, ...all]);
    void upsertDoc('users', newUser);
    return newUser;
}
export function updateUser(userId, patch, currentData = null) {
    const all = listUsers();
    let next = null;
    if (!isFirestoreReady() && all.length > 0) {
        // Demo/localStorage mode: find the user in the local list and persist
        const updated = all.map(u => {
            if (String(u.id) !== String(userId)) return u;
            next = { ...u, ...patch, updatedAt: new Date().toISOString() };
            return next;
        });
        if (next) replaceUsers(updated);
    }
    if (!next && currentData) {
        // Firestore mode: build the updated doc from the Firestore snapshot
        next = { ...currentData, ...patch, updatedAt: new Date().toISOString() };
    }
    if (next) void upsertDoc('users', next);
    return next;
}

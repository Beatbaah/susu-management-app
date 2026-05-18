import { readStore, writeStore } from './storage';
import { MOCK_GROUPS } from '../data/mockData';
import { genId } from '../utils/helpers';
import { replaceCollection, upsertDoc } from './firestoreSync';
import { validateGroup } from '../validation/groupRules';
import { listUsers } from './userService';
const STORE_KEY = 'groups';
export function listGroups() {
    return readStore(STORE_KEY, MOCK_GROUPS);
}
export function findGroup(groupId) {
    return listGroups().find(g => String(g.id) === String(groupId));
}
export function replaceGroups(next) {
    writeStore(STORE_KEY, next);
    void replaceCollection(STORE_KEY, next);
}
export function createGroup(input) {
    const validation = validateGroup(input);
    if (!validation.ok)
        return { ok: false, message: validation.message };
    const now = new Date().toISOString();
    const amount = Number(input.contributionAmount || input.contribution) || 0;
    const rounds = Number(input.totalRounds || input.totalSlots) || 12;
    const newGroup = {
        id: genId(),
        members: [],
        chat: [],
        currentRound: 1,
        listedForRegistration: true,
        color: '#5b8def',
        startDate: now.split('T')[0],
        ...input,
        groupName: input.groupName || input.name,
        name: input.name || input.groupName,
        contributionAmount: amount,
        contribution: amount,
        totalRounds: rounds,
        totalSlots: rounds,
        createdAt: now,
        updatedAt: now,
    };
    replaceGroups([newGroup, ...listGroups()]);
    void upsertDoc('groups', newGroup);
    return newGroup;
}
export function updateGroup(groupId, patch) {
    const all = listGroups();
    let next = null;
    const updated = all.map(g => {
        if (String(g.id) !== String(groupId))
            return g;
        let safePatch = { ...patch };
        // Strip non-existent user IDs from any members array in the patch.
        if (Array.isArray(patch.members)) {
            const validIds = new Set(listUsers().map(u => String(u.id)));
            safePatch.members = patch.members.filter(id => validIds.has(String(id)));
        }
        next = { ...g, ...safePatch, updatedAt: new Date().toISOString() };
        return next;
    });
    if (next) {
        replaceGroups(updated);
        void upsertDoc('groups', next);
    }
    return next;
}
export function addMemberToGroup(groupId, memberId) {
    const group = findGroup(groupId);
    if (!group)
        return null;
    const members = Array.isArray(group.members) ? group.members : [];
    if (members.map(String).includes(String(memberId)))
        return group;
    return updateGroup(groupId, { members: [...members, memberId] });
}
export function advanceRound(groupId) {
    const group = findGroup(groupId);
    if (!group)
        return null;
    const cap = group.totalRounds || group.totalSlots || (group.currentRound + 1);
    return updateGroup(groupId, { currentRound: Math.min((group.currentRound || 0) + 1, cap) });
}

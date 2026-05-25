import { useEffect, useRef } from 'react';
import { isFirestoreReady, upsertDoc } from '../services/firestoreSync';
import { listUsers } from '../services/userService';
import { listPayments } from '../services/paymentService';
import { listGroups } from '../services/groupService';
import { suspendMember as svcSuspendMember } from '../services/memberService';
import { replaceReminders as svcReplaceReminders, listReminders } from '../services/notificationService';
import { replaceGroups as svcReplaceGroups } from '../services/groupService';

export function useAutoSuspension({
    authUser,
    usersRef,
    paymentsRef,
    groupsRef,
    setUsers,
    setGroups,
    setReminders,
    logAudit,
    pushStatusNotification,
}) {
    const suspensionSweepUserIdRef = useRef(null);

    useEffect(() => {
        if (!authUser || !['admin', 'manager'].includes(authUser.role)) {
            if (!authUser) suspensionSweepUserIdRef.current = null;
            return;
        }
        if (suspensionSweepUserIdRef.current === authUser.id) return;
        suspensionSweepUserIdRef.current = authUser.id;

        const currentUsers = isFirestoreReady() ? usersRef.current : listUsers();
        const currentPayments = isFirestoreReady() ? paymentsRef.current : listPayments();
        const newReminders = [];
        const updatedUsers = [...currentUsers];
        const newlySuspendedIds = [];

        currentUsers.forEach(u => {
            if (u.role !== 'member' || u.status !== 'approved') return;
            const overdue = currentPayments.filter(p => (p.userId || p.memberId) === u.id && p.status === 'overdue');
            if (overdue.length === 0) return;
            newReminders.push({
                id: `auto-${u.id}-${Date.now()}`,
                title: 'Late Payment Warning',
                text: `You have ${overdue.length} overdue payment(s).`,
                date: 'Automated',
                type: 'warning',
                read: false,
                userId: u.id,
            });
            if (overdue.length >= 3) {
                const idx = updatedUsers.findIndex(x => x.id === u.id);
                if (idx !== -1 && updatedUsers[idx].status !== 'suspended') {
                    updatedUsers[idx] = { ...updatedUsers[idx], status: 'suspended' };
                    svcSuspendMember(u.id, u);
                    newlySuspendedIds.push(String(u.id));
                    pushStatusNotification(u.id, 'suspended');
                }
            }
        });

        if (newReminders.length > 0) {
            if (isFirestoreReady()) {
                newReminders.forEach(r => void upsertDoc('notifications', r));
            } else {
                svcReplaceReminders([...newReminders, ...listReminders()]);
            }
            setReminders(prev => [...newReminders, ...prev]);
        }

        if (updatedUsers.length !== currentUsers.length || updatedUsers.some((u, i) => u.status !== currentUsers[i]?.status || u.id !== currentUsers[i]?.id))
            setUsers(updatedUsers);

        if (newlySuspendedIds.length > 0) {
            const currentGroups = isFirestoreReady() ? groupsRef.current : listGroups();
            const groupsNext = currentGroups.map(g => {
                const members = Array.isArray(g.members) ? g.members : [];
                const filtered = members.filter(id => !newlySuspendedIds.includes(String(id)));
                return filtered.length !== members.length ? { ...g, members: filtered } : g;
            });
            if (isFirestoreReady()) {
                groupsNext.filter((g, i) => g !== currentGroups[i]).forEach(g => void upsertDoc('groups', g));
            } else {
                svcReplaceGroups(groupsNext);
            }
            setGroups(groupsNext);
        }
    }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps
}

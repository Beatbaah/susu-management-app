import { useEffect } from 'react';
import { isFirestoreReady, subscribeCollection } from '../services/firestoreSync';
import { where, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';

export function useFirestoreSubscriptions({
    authUser,
    setUsers,
    setPayments,
    setGroups,
    setSchedule,
    setReminders,
    setAuditLogs,
    setAppReady,
    setConnectionTimedOut,
}) {
    useEffect(() => {
        if (!isFirestoreReady() || !authUser) return;

        let readyHit = false;
        const markReady = () => {
            if (readyHit) return;
            readyHit = true;
            setConnectionTimedOut(false);
            setAppReady(true);
        };
        const timeoutId = window.setTimeout(() => {
            if (!readyHit) setConnectionTimedOut(true);
            markReady();
        }, 8000);

        const role = authUser.role;
        const uid = authUser.id;
        const isStaff = ['admin', 'manager', 'collector'].includes(role);
        const isManagerRole = ['admin', 'manager'].includes(role);
        const isAdminRole = role === 'admin';

        const normalizeUsers = items => items.map(u => {
            const raw = u.fullName || u.Fullname || u.name || '';
            const fmtName = raw
                ? (raw.includes(' ') ? raw : raw.split(/[._\-]/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
                : (u.email?.split('@')[0] || '');
            return { ...u, fullName: fmtName, name: fmtName, phone: u.phone || u.contact || '', status: u.status || 'approved' };
        });

        const normalizePayments = items => items.map(p => {
            const memberId = p.memberId || p.userId || '';
            return { ...p, memberId, userId: memberId };
        });

        const normalizeGroups = (items, prev = []) => items.map(g => {
            const groupName = g.groupName || g.name || '';
            const contributionAmount = Number(g.contributionAmount ?? g.contribution ?? 0);
            const existing = prev.find(p => String(p.id) === String(g.id));
            const chat = Array.isArray(g.chat) && g.chat.length > 0 ? g.chat : (existing?.chat || []);
            return { ...g, groupName, name: groupName, contributionAmount, contribution: contributionAmount, chat };
        });

        const subs = [];

        if (isStaff) {
            subs.push(subscribeCollection('users', items => { markReady(); setUsers(normalizeUsers(items)); }));
        }

        subs.push(subscribeCollection('groups', items => { markReady(); setGroups(prev => normalizeGroups(items, prev)); },
            isStaff ? [] : [where('members', 'array-contains', uid)]));

        subs.push(subscribeCollection('payments', items => { markReady(); setPayments(normalizePayments(items)); },
            isStaff ? [] : [where('userId', '==', uid)]));

        subs.push(subscribeCollection('payouts', items => { markReady(); setSchedule(items); },
            isStaff ? [] : [where('recipientId', '==', uid)]));

        subs.push(subscribeCollection('notifications', items => { markReady(); setReminders(items); },
            isManagerRole ? [] : [where('userId', '==', uid)]));

        if (isAdminRole) {
            subs.push(subscribeCollection('auditLogs', items => {
                markReady();
                setAuditLogs([...items]
                    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
                    .slice(0, 100));
            }));
        }

        return () => {
            window.clearTimeout(timeoutId);
            subs.forEach(u => u());
        };
    }, [authUser?.id, authUser?.role]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isFirestoreReady() || !authUser || !db) return;

        // Re-read groups from the ref would create a stale-closure issue here.
        // Instead we patch group state in place whenever a message snapshot arrives.
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useMessagesSubscription({ authUser, groups, setGroups }) {
    useEffect(() => {
        if (!isFirestoreReady() || !authUser || !db || groups.length === 0) return;
        const unsubs = groups.map(g => {
            const msgsQuery = query(
                collection(db, 'messages', String(g.id), 'items'),
                orderBy('time', 'asc')
            );
            return onSnapshot(msgsQuery, (snap) => {
                const messages = snap.docs.map(d => d.data());
                setGroups(prev => prev.map(pg =>
                    String(pg.id) === String(g.id) ? { ...pg, chat: messages } : pg
                ));
            }, (err) => {
                console.warn('[chat] messages sub failed for group', g.id, err?.code);
            });
        });
        return () => unsubs.forEach(u => u());
    }, [groups.map(g => g.id).join(','), authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

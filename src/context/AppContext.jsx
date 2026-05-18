import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { MOCK_USERS, MOCK_GROUPS, MOCK_PAYMENTS, MOCK_REMINDERS, PAYOUT_SCHEDULE } from '../data/mockData';
import { setCurrencySymbol } from '../utils/helpers';
import { readStore, writeStore, clearNamespace } from '../services/storage';
import { listUsers, replaceUsers as svcReplaceUsers, updateUser as svcUpdateUser } from '../services/userService';
import { registerMember as svcRegisterMember, approveMember as svcApproveMember, rejectMember as svcRejectMember, suspendMember as svcSuspendMember, reinstateMember as svcReinstateMember, assignGroup as svcAssignGroup, } from '../services/memberService';
import { listGroups, createGroup as svcCreateGroup, updateGroup as svcUpdateGroup, replaceGroups as svcReplaceGroups, } from '../services/groupService';
import { listPayments, recordPayment as svcRecordPayment, confirmPayment as svcConfirmPayment, rejectPayment as svcRejectPayment, reopenPayment as svcReopenPayment, updatePayment as svcUpdatePayment, replacePayments as svcReplacePayments, markOverduePayments as svcMarkOverduePayments, } from '../services/paymentService';
import { listPayouts, completePayout as svcCompletePayout, assignPayoutRecipient as svcAssignPayoutRecipient, replacePayouts as svcReplacePayouts, } from '../services/payoutService';
import { postMessage as svcPostMessage, postAnnouncement as svcPostAnnouncement, addReaction as svcAddReaction } from '../services/chatService';
import { listReminders, sendReminder as svcSendReminder, markRead as svcMarkRead, markAllRead as svcMarkAllRead, deleteReminder as svcDeleteReminder, clearReminders as svcClearReminders, replaceReminders as svcReplaceReminders, } from '../services/notificationService';
import { listLogs, appendLog, clearLogs as svcClearLogs } from '../services/auditService';
import { getCurrentUser, setCurrentUser } from '../services/authService';
import { isFirestoreReady, subscribeCollection } from '../services/firestoreSync';
const DEFAULT_SETTINGS = {
    notifPaymentReminders: true,
    notifPayoutAlerts: true,
    notifGroupChat: false,
    notifDefaulterAlerts: true,
    biometricLogin: true,
    twoFA: false,
    darkMode: false,
    language: 'English',
    currency: 'GHS (GH₵)',
};
const AppContext = createContext(undefined);
const DEMO_DATA_VERSION = '2026-05-production-v2';
const LS_VERSION_KEY = 'excellent_susu_v1_dataVersion';
const LS_NAMESPACE   = 'excellent_susu_v1_';

function wipeLocalStorage() {
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith(LS_NAMESPACE))
            .forEach(k => localStorage.removeItem(k));
        localStorage.setItem(LS_VERSION_KEY, DEMO_DATA_VERSION);
    } catch { /* storage disabled */ }
}

const loadInitialState = () => {
    let storedVersion = null;
    try { storedVersion = localStorage.getItem(LS_VERSION_KEY); } catch {}
    if (storedVersion !== DEMO_DATA_VERSION) {
        wipeLocalStorage();
        return {
            authUser: null,
            users: [], payments: [], groups: [], reminders: [], schedule: [],
            auditLogs: [],
            settings: { ...DEFAULT_SETTINGS },
        };
    }
    const authUser = getCurrentUser();
    const users = listUsers();
    const payments = listPayments();
    const groups = listGroups();
    const reminders = listReminders();
    const schedule = listPayouts();
    const auditLogs = listLogs();
    const settings = { ...DEFAULT_SETTINGS, ...readStore('settings', {}) };
    // Restore dark mode from the standalone pref key (survives Firestore mode).
    try {
        const savedDark = localStorage.getItem('excellent_susu_pref_darkMode');
        if (savedDark !== null) settings.darkMode = savedDark === 'true';
    } catch {}
    return { authUser, users, payments, groups, reminders, schedule, auditLogs, settings };
};
export const AppProvider = ({ children }) => {
    const [initial] = useState(loadInitialState);
    const [authUser, setAuthUserState] = useState(() => initial.authUser);
    const [users, setUsers] = useState(() => initial.users);
    const [payments, setPayments] = useState(() => initial.payments);
    const [groups, setGroups] = useState(() => initial.groups);
    const [reminders, setReminders] = useState(() => initial.reminders);
    const [schedule, setSchedule] = useState(() => initial.schedule);
    const [auditLogs, setAuditLogs] = useState(() => initial.auditLogs);
    const [settings, setSettings] = useState(() => initial.settings);
    const [dismissedNotifications, setDismissedNotifications] = useState({ members: [], payments: [] });
    // appReady gates skeleton-vs-real content on list pages. True immediately
    // in demo mode; in Firestore mode, true once the first snapshot lands or
    // after a 1.5 s safety timeout (so we never block forever on a slow network).
    const [appReady, setAppReady] = useState(() => !isFirestoreReady());
    const usersRef = useRef(users);
    const paymentsRef = useRef(payments);
    // Mirror in-memory state to the persistence layer so services and React
    // stay in sync. Each service is the writer; these effects keep storage and
    // React state aligned when callers do bulk replaces.
    useEffect(() => { setCurrentUser(authUser); }, [authUser]);
    useEffect(() => { svcReplaceUsers(users); }, [users]);
    useEffect(() => { svcReplacePayments(payments); }, [payments]);
    useEffect(() => { svcReplaceGroups(groups); }, [groups]);
    useEffect(() => { svcReplaceReminders(reminders); }, [reminders]);
    useEffect(() => { svcReplacePayouts(schedule); }, [schedule]);
    useEffect(() => { writeStore('settings', settings); }, [settings]);
    // Apply theme + currency side-effects from settings.
    useEffect(() => {
        if (typeof document === 'undefined')
            return;
        document.documentElement.classList.toggle('dark', settings.darkMode);
        // Persist independently of Firestore so dark mode survives page reloads
        // even when writeStore is a no-op in Firestore mode.
        try { localStorage.setItem('excellent_susu_pref_darkMode', String(settings.darkMode)); } catch {}
    }, [settings.darkMode]);
    useEffect(() => {
        // Settings store the display string like "GHS (GH₵)". Extract the symbol
        // for fmt() — fallback to the whole string when no parens found.
        const match = settings.currency.match(/\(([^)]+)\)/);
        setCurrencySymbol(match ? match[1].trim() : settings.currency.split(/\s+/)[0].trim());
    }, [settings.currency]);
    useEffect(() => {
        if (!isFirestoreReady()) {
            try {
                localStorage.setItem('excellent_susu_v1_dataVersion', DEMO_DATA_VERSION);
            }
            catch { }
        }
    }, []);
    useEffect(() => {
        if (!isFirestoreReady())
            return;
        try {
            clearNamespace();
            localStorage.removeItem('excellent_susu_v1_dataVersion');
        }
        catch { }
    }, []);
    // On mount, transition any pending payments whose dueDate has passed to overdue.
    useEffect(() => {
        const { changed, payments: updated } = svcMarkOverduePayments();
        if (changed) setPayments(updated);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { usersRef.current = users; }, [users]);
    useEffect(() => { paymentsRef.current = payments; }, [payments]);
    // Phase 3 — when Firebase is configured, subscribe to every collection so
    // remote changes (made on another device or by Cloud Functions) propagate
    // into the React cache. Writes still go through services, which already
    // mirror to Firestore. The local seed is overwritten by the first Firestore
    // snapshot, including empty collections.
    useEffect(() => {
        if (!isFirestoreReady())
            return;
        // Mark the app ready after the first snapshot from any collection arrives,
        // or after a 1.5 s timeout — whichever comes first.
        let readyHit = false;
        const markReady = () => {
            if (readyHit)
                return;
            readyHit = true;
            setAppReady(true);
        };
        const timeoutId = window.setTimeout(markReady, 1500);
        // subscribeCollection internally waits for anonymous auth, so we can
        // attach immediately without an extra await here.
        const unsubs = [
            subscribeCollection('users', items => { markReady(); setUsers(items); }),
            subscribeCollection('groups', items => { markReady(); setGroups(items); }),
            subscribeCollection('payments', items => { markReady(); setPayments(items); }),
            subscribeCollection('payouts', items => { markReady(); setSchedule(items); }),
            subscribeCollection('notifications', items => { markReady(); setReminders(items); }),
            subscribeCollection('auditLogs', items => {
                markReady();
                setAuditLogs([...items]
                    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
                    .slice(0, 250));
            }),
        ];
        return () => {
            window.clearTimeout(timeoutId);
            unsubs.forEach(u => u());
        };
    }, []);
    const setAuthUser = (next) => {
        setAuthUserState((prev) => setCurrentUser(typeof next === 'function' ? next(prev) : next));
    };
    const logAudit = (event) => {
        const entry = appendLog(authUser, event);
        setAuditLogs(prev => [entry, ...prev].slice(0, 250));
        return entry;
    };
    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };
    const clearAuditLogs = () => {
        svcClearLogs();
        setAuditLogs([]);
        logAudit({ action: 'clear audit logs', targetType: 'system', targetId: 'auditLogs' });
    };
    const resetAllData = () => {
        clearNamespace();
        setAuthUserState(null);
        setUsers(MOCK_USERS);
        setPayments(MOCK_PAYMENTS);
        setGroups(MOCK_GROUPS);
        setReminders(MOCK_REMINDERS);
        setSchedule(PAYOUT_SCHEDULE);
        setAuditLogs([]);
        setSettings(DEFAULT_SETTINGS);
        try {
            localStorage.setItem('excellent_susu_v1_dataVersion', DEMO_DATA_VERSION);
        }
        catch { }
    };
    // Auto-suspension sweep: if a member has 3+ overdue payments, suspend them.
    // Runs when authUser changes and the actor is staff.
    useEffect(() => {
        if (!authUser || !['admin', 'manager'].includes(authUser.role))
            return;
        // Read directly from the service layer to avoid stale ref data on login.
        const currentUsers = listUsers();
        const currentPayments = listPayments();
        const newReminders = [];
        const updatedUsers = [...currentUsers];
        const newlySuspendedIds = [];
        currentUsers.forEach(u => {
            if (u.role !== 'member' || u.status !== 'approved')
                return;
            const overdue = currentPayments.filter(p => (p.userId || p.memberId) === u.id && p.status === 'overdue');
            if (overdue.length === 0)
                return;
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
                    svcSuspendMember(u.id);
                    newlySuspendedIds.push(String(u.id));
                }
            }
        });
        if (newReminders.length > 0) {
            svcReplaceReminders([...newReminders, ...listReminders()]);
            setReminders(prev => [...newReminders, ...prev]);
        }
        if (JSON.stringify(updatedUsers) !== JSON.stringify(currentUsers))
            setUsers(updatedUsers);
        // Remove newly suspended members from their groups.
        if (newlySuspendedIds.length > 0) {
            const groupsNext = listGroups().map(g => {
                const members = Array.isArray(g.members) ? g.members : [];
                const filtered = members.filter(id => !newlySuspendedIds.includes(String(id)));
                return filtered.length !== members.length ? { ...g, members: filtered } : g;
            });
            svcReplaceGroups(groupsNext);
            setGroups(groupsNext);
        }
    }, [authUser]);
    // ----- Action methods (delegate to services) -----
    const recordPayment = (p) => {
        const result = svcRecordPayment(p, authUser?.role);
        if (!result.ok)
            return result;
        setPayments(prev => [result.payment, ...prev]);
        logAudit({ action: 'record payment', targetType: 'payment', targetId: result.payment.id, newValue: result.payment });
        return result;
    };
    const confirmPayment = (paymentId) => {
        const current = payments.find(p => p.id === paymentId);
        const next = svcConfirmPayment(paymentId, authUser?.id, authUser?.role);
        if (next && next.status === 'paid') {
            setPayments(prev => prev.map(p => (p.id === paymentId ? next : p)));
            logAudit({ action: 'confirm payment', targetType: 'payment', targetId: paymentId, oldValue: current, newValue: next });
        }
        return next;
    };
    const rejectPayment = (paymentId) => {
        const current = payments.find(p => p.id === paymentId);
        const next = svcRejectPayment(paymentId, authUser?.id, authUser?.role);
        if (next && next.status === 'rejected') {
            setPayments(prev => prev.map(p => (p.id === paymentId ? next : p)));
            logAudit({ action: 'reject payment', targetType: 'payment', targetId: paymentId, oldValue: current, newValue: next });
        }
        return next;
    };
    const reopenPayment = (paymentId) => {
        const current = payments.find(p => p.id === paymentId);
        const next = svcReopenPayment(paymentId, authUser?.id);
        if (!next) return null;
        setPayments(prev => prev.map(p => (p.id === paymentId ? next : p)));
        logAudit({ action: 'reopen payment', targetType: 'payment', targetId: paymentId, oldValue: current, newValue: next });
        return next;
    };
    const updatePayment = (paymentId, patch) => {
        const current = payments.find(p => p.id === paymentId);
        const result = svcUpdatePayment(paymentId, patch, authUser?.role);
        if (!result.ok)
            return result;
        setPayments(prev => prev.map(p => (p.id === paymentId ? result.payment : p)));
        logAudit({ action: 'update payment', targetType: 'payment', targetId: paymentId, oldValue: current, newValue: result.payment });
        return result;
    };
    const completePayout = (payoutId) => {
        const result = svcCompletePayout(payoutId, authUser?.id);
        if (!result.ok)
            return result;
        setSchedule(prev => prev.map(p => (p.id === payoutId ? result.payout : p)));
        setGroups(listGroups());
        if (Array.isArray(result.generatedPayments) && result.generatedPayments.length > 0) {
            setPayments(listPayments());
        }
        logAudit({ action: 'complete payout', targetType: 'payout', targetId: payoutId, newValue: result.payout });
        return result;
    };
    const assignPayoutRecipient = (payoutId, recipientId) => {
        const current = schedule.find(p => p.id === payoutId);
        const result = svcAssignPayoutRecipient(payoutId, recipientId, authUser?.id);
        if (!result.ok)
            return result;
        setSchedule(prev => prev.map(p => (p.id === payoutId ? result.payout : p)));
        logAudit({ action: 'assign payout recipient', targetType: 'payout', targetId: payoutId, oldValue: current, newValue: result.payout });
        return result;
    };
    const registerMember = async (input) => {
        const result = await svcRegisterMember(input);
        if (result && result.ok === false) return result;
        const created = result;
        setUsers(prev => [created, ...prev]);
        appendLog(created, { action: 'request access', targetType: 'user', targetId: created.id, newValue: created });
        setAuditLogs(listLogs());
        return { ok: true, user: created };
    };
    const updateMember = (memberId, patch) => {
        const current = users.find(u => u.id === memberId);
        const updated = svcUpdateUser(memberId, patch);
        if (!updated)
            return null;
        setUsers(prev => prev.map(u => (u.id === memberId ? updated : u)));
        if (authUser?.id === memberId)
            setAuthUser(updated);
        // Keep group.members in sync when groupId changes.
        if ('groupId' in patch && String(patch.groupId) !== String(current?.groupId)) {
            const groupsNext = listGroups().map(g => {
                const members = Array.isArray(g.members) ? g.members : [];
                if (current?.groupId && String(g.id) === String(current.groupId)) {
                    return { ...g, members: members.filter(id => String(id) !== String(memberId)) };
                }
                if (patch.groupId && String(g.id) === String(patch.groupId)) {
                    return members.map(String).includes(String(memberId)) ? g : { ...g, members: [...members, memberId] };
                }
                return g;
            });
            svcReplaceGroups(groupsNext);
            setGroups(groupsNext);
        }
        logAudit({ action: 'update member', targetType: 'user', targetId: String(memberId), oldValue: current, newValue: updated });
        return updated;
    };
    const approveUser = (userId) => {
        const approved = svcApproveMember(userId, authUser?.id);
        if (!approved)
            return null;
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? approved : u)));
        if (approved.groupId) {
            const groupsNext = listGroups().map(g => {
                if (String(g.id) !== String(approved.groupId))
                    return g;
                const members = Array.isArray(g.members) ? g.members : [];
                return members.map(String).includes(String(approved.id)) ? g : { ...g, members: [...members, approved.id] };
            });
            svcReplaceGroups(groupsNext);
            setGroups(groupsNext);
        }
        logAudit({ action: 'approve registration', targetType: 'user', targetId: approved.id, newValue: approved });
        return approved;
    };
    const reinstateUser = (userId) => {
        const reinstated = svcReinstateMember(userId, authUser?.id);
        if (!reinstated) return null;
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? reinstated : u)));
        logAudit({ action: 'reinstate member', targetType: 'user', targetId: reinstated.id, newValue: reinstated });
        return reinstated;
    };
    const rejectUser = (userId) => {
        const rejected = svcRejectMember(userId, authUser?.id);
        if (!rejected)
            return null;
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? rejected : u)));
        // Remove rejected member from any group they belong to.
        const currentGroups = listGroups();
        const groupsNext = currentGroups.map(g => {
            const members = Array.isArray(g.members) ? g.members : [];
            if (!members.map(String).includes(String(userId))) return g;
            return { ...g, members: members.filter(id => String(id) !== String(userId)) };
        });
        if (JSON.stringify(groupsNext) !== JSON.stringify(currentGroups)) {
            svcReplaceGroups(groupsNext);
            setGroups(groupsNext);
        }
        logAudit({ action: 'reject registration', targetType: 'user', targetId: rejected.id, newValue: rejected });
        return rejected;
    };
    const assignUserToGroup = (userId, groupId) => {
        if (groupId && !listGroups().find(g => String(g.id) === String(groupId)))
            return;
        svcAssignGroup(userId, groupId);
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? { ...u, groupId } : u)));
        const groupsNext = listGroups().map(g => {
            const members = Array.isArray(g.members) ? g.members : [];
            if (String(g.id) !== String(groupId)) {
                return members.map(String).includes(String(userId))
                    ? { ...g, members: members.filter((memberId) => String(memberId) !== String(userId)) }
                    : g;
            }
            return members.map(String).includes(String(userId)) ? g : { ...g, members: [...members, userId] };
        });
        svcReplaceGroups(groupsNext);
        setGroups(groupsNext);
        logAudit({ action: 'assign member to group', targetType: 'user', targetId: String(userId), newValue: { groupId } });
    };
    const createGroup = (input) => {
        const result = svcCreateGroup(input);
        if (result && result.ok === false) return result;
        const group = result;
        setGroups(prev => [group, ...prev]);
        logAudit({ action: 'create group', targetType: 'group', targetId: group.id, newValue: group });
        return group;
    };
    const updateGroup = (groupId, patch) => {
        const current = groups.find(g => g.id === groupId);
        const next = svcUpdateGroup(groupId, patch);
        if (!next)
            return null;
        setGroups(prev => prev.map(g => (g.id === groupId ? next : g)));
        logAudit({ action: 'update group', targetType: 'group', targetId: String(groupId), oldValue: current, newValue: next });
        return next;
    };
    const postChatMessage = (groupId, message) => {
        const entry = svcPostMessage(groupId, authUser, message);
        if (entry)
            setGroups(listGroups());
        return entry;
    };
    const getGroupMemberIds = (groupId) => {
        const g = groups.find(x => x.id === groupId);
        return Array.isArray(g?.members) ? g.members : [];
    };
    const postAnnouncement = (groupId, message) => {
        const entry = svcPostAnnouncement(groupId, authUser, message);
        if (entry) {
            setGroups(listGroups());
            sendReminder({ userIds: getGroupMemberIds(groupId), title: '📢 Announcement', text: message, type: 'info' });
        }
        return entry;
    };
    const addChatReaction = (groupId, messageId, emoji) => {
        if (!authUser) return;
        svcAddReaction(groupId, messageId, emoji, authUser.id);
        setGroups(listGroups());
    };
    const sendReminder = ({ userIds, title, text, type = 'info' }) => {
        const created = svcSendReminder({ userIds, title, text, type: type });
        setReminders(prev => [...created, ...prev]);
        logAudit({ action: 'send reminder', targetType: 'reminder', targetId: created[0]?.id || null, newValue: { count: created.length, title, text } });
        return created;
    };
    const markReminderRead = (reminderId) => {
        svcMarkRead(reminderId);
        setReminders(prev => prev.map(r => (r.id === reminderId ? { ...r, read: true } : r)));
    };
    const markAllRemindersRead = () => {
        svcMarkAllRead();
        setReminders(prev => prev.map(r => ({ ...r, read: true })));
    };
    const deleteReminder = (reminderId) => {
        svcDeleteReminder(reminderId);
        setReminders(prev => prev.filter(r => r.id !== reminderId));
    };
    const clearReminders = () => {
        svcClearReminders();
        setReminders([]);
    };
    const dismissMemberNotification = (userId) => {
        setDismissedNotifications(prev => prev.members.includes(userId)
            ? prev
            : { ...prev, members: [...prev.members, userId] });
    };
    const dismissPaymentNotification = (paymentId) => {
        setDismissedNotifications(prev => prev.payments.includes(paymentId)
            ? prev
            : { ...prev, payments: [...prev.payments, paymentId] });
    };
    const dismissAllNotifications = () => {
        const pendingMemberIds = users.filter(user => user.role === 'member' && user.status === 'pending').map(user => user.id);
        const pendingPaymentIds = settings.notifPaymentReminders
            ? payments.filter(payment => payment.status === 'pending').map(payment => payment.id)
            : [];
        setDismissedNotifications({ members: pendingMemberIds, payments: pendingPaymentIds });
    };
    const clearAllNotifications = () => {
        clearReminders();
        dismissAllNotifications();
    };
    return (<AppContext.Provider value={{
            authUser, setAuthUser,
            users, setUsers,
            payments, setPayments,
            groups, setGroups,
            reminders, setReminders,
            schedule, setSchedule,
            auditLogs, logAudit,
            settings, updateSetting,
            appReady,
            dismissedNotifications,
            recordPayment, confirmPayment, rejectPayment, reopenPayment, updatePayment,
            completePayout, assignPayoutRecipient,
            registerMember, updateMember, approveUser, rejectUser, reinstateUser,
            createGroup, updateGroup,
            postChatMessage, postAnnouncement, addChatReaction,
            sendReminder, markReminderRead, markAllRemindersRead, deleteReminder, clearReminders, dismissMemberNotification, dismissPaymentNotification, dismissAllNotifications, clearAllNotifications,
            clearAuditLogs,
            resetAllData,
            assignUserToGroup,
        }}>
      {children}
    </AppContext.Provider>);
};
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined)
        throw new Error('useAppContext must be used within AppProvider');
    return context;
};

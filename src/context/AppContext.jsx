import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { MOCK_USERS, MOCK_GROUPS, MOCK_PAYMENTS, MOCK_REMINDERS, PAYOUT_SCHEDULE } from '../data/mockData';
import { setCurrencySymbol } from '../utils/helpers';
import { readStore, writeStore, clearNamespace } from '../services/storage';
import { listUsers, replaceUsers as svcReplaceUsers, updateUser as svcUpdateUser } from '../services/userService';
import { registerMember as svcRegisterMember, approveMember as svcApproveMember, rejectMember as svcRejectMember, reinstateMember as svcReinstateMember, assignGroup as svcAssignGroup, } from '../services/memberService';
import { listGroups, createGroup as svcCreateGroup, updateGroup as svcUpdateGroup, replaceGroups as svcReplaceGroups, deleteGroup as svcDeleteGroup, } from '../services/groupService';
import { listPayments, recordPayment as svcRecordPayment, confirmPayment as svcConfirmPayment, rejectPayment as svcRejectPayment, reopenPayment as svcReopenPayment, updatePayment as svcUpdatePayment, replacePayments as svcReplacePayments, markOverduePayments as svcMarkOverduePayments, } from '../services/paymentService';
import { listPayouts, completePayout as svcCompletePayout, assignPayoutRecipient as svcAssignPayoutRecipient, replacePayouts as svcReplacePayouts, } from '../services/payoutService';
import { postMessage as svcPostMessage, postAnnouncement as svcPostAnnouncement, addReaction as svcAddReaction } from '../services/chatService';
import { listReminders, sendReminder as svcSendReminder, markRead as svcMarkRead, markAllRead as svcMarkAllRead, deleteReminder as svcDeleteReminder, clearReminders as svcClearReminders, replaceReminders as svcReplaceReminders, } from '../services/notificationService';
import { listLogs, appendLog, clearLogs as svcClearLogs } from '../services/auditService';
import { getCurrentUser, setCurrentUser } from '../services/authService';
import { isFirestoreReady, upsertDoc, removeDoc, setWriteErrorHandler } from '../services/firestoreSync';
import { doc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { genId } from '../utils/helpers';
import app, { db, storage } from '../utils/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getPermissionState, requestPushPermission, onForegroundMessage, showBrowserNotification } from '../services/pushNotificationService';
import { toast } from '../utils/toast';
import { useFirestoreSubscriptions, useMessagesSubscription } from '../hooks/useFirestoreSubscriptions';
import { useAutoSuspension } from '../hooks/useAutoSuspension';
import { useAuthSync } from '../hooks/useAuthSync';
const DEFAULT_SETTINGS = {
    notifPaymentReminders: true,
    notifPayoutAlerts: true,
    notifGroupChat: false,
    notifDefaulterAlerts: true,
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
    // Read persisted settings — pref_ key survives Firestore-mode namespace clears.
    const loadSettings = () => {
        let saved = {};
        try {
            const raw = localStorage.getItem('excellent_susu_pref_settings');
            if (raw) saved = JSON.parse(raw);
        } catch {}
        if (!Object.keys(saved).length) {
            saved = readStore('settings', {}); // demo-mode fallback / pre-migration
        }
        const result = { ...DEFAULT_SETTINGS, ...saved };
        // Apply standalone dark-mode key as final override (written independently).
        try {
            const d = localStorage.getItem('excellent_susu_pref_darkMode');
            if (d !== null) result.darkMode = d === 'true';
        } catch {}
        return result;
    };

    if (storedVersion !== DEMO_DATA_VERSION) {
        wipeLocalStorage();
        const freshSettings = loadSettings();
        return {
            authUser: null,
            users: [], payments: [], groups: [], reminders: [], schedule: [],
            auditLogs: [],
            settings: freshSettings,
        };
    }
    const authUser = getCurrentUser();
    const users = listUsers();
    const payments = listPayments();
    const groups = listGroups();
    const reminders = listReminders();
    const schedule = listPayouts();
    const auditLogs = listLogs();
    const settings = loadSettings();
    return { authUser, users, payments, groups, reminders, schedule, auditLogs, settings };
};
export const AppProvider = ({ children }) => {
    const [initial] = useState(loadInitialState);
    // Register Firestore write-error handler once so failed syncs surface as toasts.
    useState(() => {
        if (isFirestoreReady()) {
            setWriteErrorHandler((collection, error) => {
                const code = error?.code || error?.message || 'unknown';
                toast.error(`Sync failed (${collection}: ${code}) — check your connection.`);
            });
        }
    });
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
    const [connectionTimedOut, setConnectionTimedOut] = useState(false);
    const authUserRef = useRef(authUser);
    useEffect(() => { authUserRef.current = authUser; }, [authUser]);
    // Track the previous auth UID so we can detect null→user login transitions.
    const prevAuthIdRef = useRef(authUser?.id ?? null);
    const usersRef = useRef(users);
    const paymentsRef = useRef(payments);
    const groupsRef = useRef(groups);
    const lastReminderSentRef = useRef(0);
    // Mirror in-memory state to the persistence layer so services and React
    // stay in sync. Each service is the writer; these effects keep storage and
    // React state aligned when callers do bulk replaces.
    useEffect(() => { setCurrentUser(authUser); }, [authUser]);
    // In Firestore mode, real-time subscriptions keep state fresh and individual
    // upsertDoc/removeDoc calls handle writes. Calling replaceCollection here
    // creates a write loop: subscription → setUsers → replaceCollection → subscription.
    useEffect(() => { if (!isFirestoreReady()) svcReplaceUsers(users); }, [users]);
    useEffect(() => { if (!isFirestoreReady()) svcReplacePayments(payments); }, [payments]);
    useEffect(() => { if (!isFirestoreReady()) svcReplaceGroups(groups); }, [groups]);
    useEffect(() => { if (!isFirestoreReady()) svcReplaceReminders(reminders); }, [reminders]);
    useEffect(() => { if (!isFirestoreReady()) svcReplacePayouts(schedule); }, [schedule]);
    // Persist settings under a pref_ prefix so they survive Firestore-mode
    // namespace clears (clearNamespace only wipes excellent_susu_v1_* keys).
    useEffect(() => {
        try { localStorage.setItem('excellent_susu_pref_settings', JSON.stringify(settings)); } catch {}
    }, [settings]);
    // Apply theme + currency side-effects from settings.
    useEffect(() => {
        if (typeof document === 'undefined')
            return;
        const isDark = settings.darkMode;
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.style.background = isDark ? '#041C3F' : '';
        // Keep the theme-color meta in sync so the browser chrome matches.
        const meta = document.getElementById('theme-color-meta');
        if (meta) meta.setAttribute('content', isDark ? '#041C3F' : '#E8EDF8');
        // Persist independently of Firestore so dark mode survives page reloads
        // even when writeStore is a no-op in Firestore mode.
        try { localStorage.setItem('excellent_susu_pref_darkMode', String(isDark)); } catch {}
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
    // Transition pending payments whose dueDate has passed to overdue.
    // Runs on mount and then every hour so long sessions don't show stale statuses.
    useEffect(() => {
        const runCheck = () => {
            if (!isFirestoreReady()) {
                const { changed, payments: updated } = svcMarkOverduePayments();
                if (changed) setPayments(updated);
            } else {
                const today = new Date().toISOString().split('T')[0];
                // Only managers can update payment status in Firestore.
                // Use authUserRef to read the current role without a stale closure.
                const canWrite = ['admin', 'manager'].includes(authUserRef.current?.role);
                setPayments(prev => {
                    let changed = false;
                    const next = prev.map(p => {
                        if (p.status === 'pending' && p.dueDate && p.dueDate < today) {
                            changed = true;
                            const u = { ...p, status: 'overdue', updatedAt: new Date().toISOString() };
                            if (canWrite) void upsertDoc('payments', u);
                            return u;
                        }
                        return p;
                    });
                    return changed ? next : prev;
                });
            }
        };
        runCheck();
        const intervalId = window.setInterval(runCheck, 60 * 60 * 1000);
        return () => window.clearInterval(intervalId);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { usersRef.current = users; }, [users]);
    useEffect(() => { paymentsRef.current = payments; }, [payments]);
    useEffect(() => { groupsRef.current = groups; }, [groups]);
    // Write a 'login' audit entry once per browser session per user.
    // sessionStorage survives page reloads within the same tab but is cleared
    // when the tab is closed — so we get one entry per real session, not one
    // per page reload / Firebase Auth session-restore callback.
    useEffect(() => {
        const prevId = prevAuthIdRef.current;
        prevAuthIdRef.current = authUser?.id ?? null;
        if (authUser && !prevId) {
            const sessionKey = `excellent_susu_session_login_${authUser.id}`;
            if (!sessionStorage.getItem(sessionKey)) {
                sessionStorage.setItem(sessionKey, '1');
                // Members cannot write to auditLogs (Firestore rule: isStaff only).
                // Logging member logins would trigger a sync error toast every login.
                if (['admin', 'manager', 'collector'].includes(authUser.role)) {
                    const entry = appendLog(authUser, { action: 'login', targetType: 'user', targetId: authUser.id });
                    setAuditLogs(prev => [entry, ...prev].slice(0, 100));
                }
            }
        }
    }, [authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Register FCM token when user logs in and has already granted permission.
    // Silently re-registers in case the token rotated since last session.
    useEffect(() => {
        if (!authUser?.id || !isFirestoreReady()) return;
        if (getPermissionState() === 'granted') {
            requestPushPermission(authUser.id).catch(() => {});
        }
    }, [authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // Show a browser notification when an FCM push arrives while the app is open.
    useEffect(() => {
        let unsub = () => {};
        onForegroundMessage(payload => {
            const title = payload.notification?.title || payload.data?.title || 'Excellent Susu';
            const body  = payload.notification?.body  || payload.data?.body  || '';
            showBrowserNotification(title, body);
        }).then(fn => { unsub = fn; });
        return () => unsub();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // Reset appReady whenever the signed-in user changes so the loading skeleton
    // shows correctly on the next login.
    useEffect(() => {
        if (isFirestoreReady() && !authUser) setAppReady(false);
    }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps
    useAuthSync({ authUser, authUserRef, setAuthUser: (v) => setAuthUserState(typeof v === 'function' ? v : v), setAuthUserState, setAppReady });
    useFirestoreSubscriptions({ authUser, setUsers, setPayments, setGroups, setSchedule, setReminders, setAuditLogs, setAppReady, setConnectionTimedOut });
    useMessagesSubscription({ authUser, groups, setGroups });

    const setAuthUser = (next) => {
        setAuthUserState((prev) => setCurrentUser(typeof next === 'function' ? next(prev) : next));
    };
    const logAudit = (event) => {
        if (!['admin', 'manager', 'collector'].includes(authUser?.role)) return null;
        const entry = appendLog(authUser, event);
        setAuditLogs(prev => [entry, ...prev].slice(0, 100));
        if (isFirestoreReady() && app) {
            // Use Admin SDK via Cloud Function — client writes are denied by Firestore rules.
            try {
                const fn = httpsCallable(getFunctions(app, 'us-central1'), 'writeAuditLog');
                fn({ action: event.action, targetType: event.targetType, targetId: event.targetId, oldValue: event.oldValue, newValue: event.newValue })
                    .catch(e => console.warn('[AppContext] writeAuditLog failed:', e?.message));
            } catch { /* non-fatal */ }
        }
        return entry;
    };
    const syncRoleClaim = (userId, role) => {
        if (!isFirestoreReady() || !app) return;
        try {
            const fn = httpsCallable(getFunctions(app, 'us-central1'), 'syncUserRole');
            fn({ targetUserId: String(userId), role })
                .catch(e => console.warn('[AppContext] syncUserRole failed:', e?.message));
        } catch { /* non-fatal */ }
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
    const pushStatusNotification = (userId, status) => {
        if (!isFirestoreReady() || !app || !authUser?.id) return;
        try {
            const fn = httpsCallable(getFunctions(app, 'us-central1'), 'sendStatusNotification');
            fn({ userId: String(userId), status }).catch(e =>
                console.warn('[AppContext] sendStatusNotification failed:', e?.message)
            );
        } catch { /* non-fatal */ }
    };
    useAutoSuspension({ authUser, usersRef, paymentsRef, groupsRef, setUsers, setGroups, setReminders, logAudit, pushStatusNotification });
    // ----- Action methods (delegate to services) -----
    const recordPayment = (p) => {
        const result = svcRecordPayment(p, authUser?.role, payments, groups.find(g => String(g.id) === String(p.groupId)) ?? null);
        if (!result.ok)
            return result;
        setPayments(prev => [result.payment, ...prev]);
        logAudit({ action: 'record payment', targetType: 'payment', targetId: result.payment.id, newValue: result.payment });
        return result;
    };
    const confirmPayment = (paymentId) => {
        const current = payments.find(p => p.id === paymentId);
        const next = svcConfirmPayment(paymentId, authUser?.id, authUser?.role, current, users);
        if (next && next.status === 'paid') {
            setPayments(prev => prev.map(p => (p.id === paymentId ? next : p)));
            if (isFirestoreReady()) {
                const receiptId = next.ref || `RCT-${String(next.id || '').slice(0, 6).toUpperCase()}`;
                void upsertDoc('receipts', {
                    id: receiptId,
                    paymentId: next.id,
                    userId: next.userId || next.memberId || '',
                    groupId: next.groupId || '',
                    amount: Number(next.amount || 0),
                    paymentMethod: next.method || 'Cash',
                    paymentDate: next.paymentDate || new Date().toISOString().split('T')[0],
                    status: 'confirmed',
                    confirmedBy: authUser?.id || '',
                    createdAt: new Date().toISOString(),
                });
            }
            logAudit({ action: 'confirm payment', targetType: 'payment', targetId: paymentId, oldValue: current, newValue: next });
        }
        return next;
    };
    const rejectPayment = (paymentId) => {
        const current = payments.find(p => p.id === paymentId);
        const next = svcRejectPayment(paymentId, authUser?.id, authUser?.role, current);
        if (next && next.status === 'rejected') {
            setPayments(prev => prev.map(p => (p.id === paymentId ? next : p)));
            logAudit({ action: 'reject payment', targetType: 'payment', targetId: paymentId, oldValue: current, newValue: next });
        }
        return next;
    };
    const reopenPayment = (paymentId) => {
        const current = payments.find(p => p.id === paymentId);
        const next = svcReopenPayment(paymentId, authUser?.id, current);
        if (!next) return null;
        setPayments(prev => prev.map(p => (p.id === paymentId ? next : p)));
        logAudit({ action: 'reopen payment', targetType: 'payment', targetId: paymentId, oldValue: current, newValue: next });
        return next;
    };
    const updatePayment = (paymentId, patch) => {
        const current = payments.find(p => p.id === paymentId);
        const result = svcUpdatePayment(paymentId, patch, authUser?.role, current);
        if (!result.ok)
            return result;
        setPayments(prev => prev.map(p => (p.id === paymentId ? result.payment : p)));
        logAudit({ action: 'update payment', targetType: 'payment', targetId: paymentId, oldValue: current, newValue: result.payment });
        return result;
    };
    const completePayout = (payoutId) => {
        const currentPayout = schedule.find(p => p.id === payoutId);
        const currentGroup = currentPayout ? groups.find(g => String(g.id) === String(currentPayout.groupId)) ?? null : null;
        const result = svcCompletePayout(payoutId, authUser?.id, false, currentPayout ?? null, payments, currentGroup);
        if (!result.ok)
            return result;
        setSchedule(prev => prev.map(p => (p.id === payoutId ? result.payout : p)));
        // Use returned data directly — never re-read localStorage which is empty in Firestore mode.
        if (result.group) {
            setGroups(prev => prev.map(g => g.id === result.group.id ? result.group : g));
        }
        if (Array.isArray(result.generatedPayments) && result.generatedPayments.length > 0) {
            setPayments(prev => [...result.generatedPayments, ...prev]);
        }
        logAudit({ action: 'complete payout', targetType: 'payout', targetId: payoutId, newValue: result.payout });
        return result;
    };
    const assignPayoutRecipient = (payoutId, recipientId) => {
        const current = schedule.find(p => p.id === payoutId);
        const currentGroup = current ? groups.find(g => String(g.id) === String(current.groupId)) ?? null : null;
        const result = svcAssignPayoutRecipient(payoutId, recipientId, authUser?.id, current ?? null, users, currentGroup);
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
    const disputePayment = (paymentId, note) => {
        const result = updatePayment(paymentId, { disputeRaised: true, disputeNote: note || '', disputedAt: new Date().toISOString() });
        if (result?.ok) logAudit({ action: 'dispute payment', targetType: 'payment', targetId: paymentId, newValue: { disputeNote: note } });
        return result;
    };
    const resolveDispute = (paymentId) => {
        const result = updatePayment(paymentId, { disputeRaised: false, disputeNote: '', disputeResolvedAt: new Date().toISOString() });
        if (result?.ok) logAudit({ action: 'resolve dispute', targetType: 'payment', targetId: paymentId });
        return result;
    };
    const updateMember = (memberId, patch, currentData = null) => {
        const current = users.find(u => u.id === memberId) || currentData;
        const updated = svcUpdateUser(memberId, patch, current);
        if (!updated)
            return null;
        setUsers(prev => prev.map(u => (u.id === memberId ? updated : u)));
        if (authUser?.id === memberId)
            setAuthUser(updated);
        // Keep group.members in sync when groupId changes.
        if ('groupId' in patch && String(patch.groupId) !== String(current?.groupId)) {
            const groupsNext = groups.map(g => {
                const members = Array.isArray(g.members) ? g.members : [];
                if (current?.groupId && String(g.id) === String(current.groupId)) {
                    return { ...g, members: members.filter(id => String(id) !== String(memberId)) };
                }
                if (patch.groupId && String(g.id) === String(patch.groupId)) {
                    return members.map(String).includes(String(memberId)) ? g : { ...g, members: [...members, memberId] };
                }
                return g;
            });
            if (isFirestoreReady()) {
                groupsNext.filter((g, i) => g !== groups[i]).forEach(g => void upsertDoc('groups', g));
            } else {
                svcReplaceGroups(groupsNext);
            }
            setGroups(groupsNext);
        }
        if ('role' in patch && patch.role !== current?.role) syncRoleClaim(memberId, patch.role);
        logAudit({ action: 'update member', targetType: 'user', targetId: String(memberId), oldValue: current, newValue: updated });
        return updated;
    };
    const approveUser = (userId) => {
        const current = users.find(u => String(u.id) === String(userId));
        const approved = svcApproveMember(userId, authUser?.id, current);
        if (!approved)
            return null;
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? approved : u)));
        if (approved.groupId) {
            const groupsNext = groups.map(g => {
                if (String(g.id) !== String(approved.groupId))
                    return g;
                const members = Array.isArray(g.members) ? g.members : [];
                return members.map(String).includes(String(approved.id)) ? g : { ...g, members: [...members, approved.id] };
            });
            if (isFirestoreReady()) {
                groupsNext.filter((g, i) => g !== groups[i]).forEach(g => void upsertDoc('groups', g));
            } else {
                svcReplaceGroups(groupsNext);
            }
            setGroups(groupsNext);
        }
        const approvalNote = svcSendReminder({ userIds: [String(userId)], title: 'Application Approved', text: 'Your membership application has been approved. Welcome to Excellent Susu!', type: 'success' });
        setReminders(prev => [...approvalNote, ...prev]);
        pushStatusNotification(userId, 'approved');
        syncRoleClaim(userId, approved.role || 'member');
        logAudit({ action: 'approve registration', targetType: 'user', targetId: approved.id, newValue: approved });
        return approved;
    };
    const reinstateUser = (userId) => {
        const current = users.find(u => String(u.id) === String(userId));
        const reinstated = svcReinstateMember(userId, authUser?.id, current);
        if (!reinstated) return null;
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? reinstated : u)));
        const reinstateNote = svcSendReminder({ userIds: [String(userId)], title: 'Account Reinstated', text: 'Your account has been reinstated. You now have full access again.', type: 'success' });
        setReminders(prev => [...reinstateNote, ...prev]);
        pushStatusNotification(userId, 'reinstated');
        syncRoleClaim(userId, reinstated.role || 'member');
        logAudit({ action: 'reinstate member', targetType: 'user', targetId: reinstated.id, newValue: reinstated });
        return reinstated;
    };
    const rejectUser = (userId) => {
        const current = users.find(u => String(u.id) === String(userId));
        const rejected = svcRejectMember(userId, authUser?.id, current);
        if (!rejected)
            return null;
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? rejected : u)));
        // Remove rejected member from any group they belong to.
        const groupsNext = groups.map(g => {
            const members = Array.isArray(g.members) ? g.members : [];
            if (!members.map(String).includes(String(userId))) return g;
            return { ...g, members: members.filter(id => String(id) !== String(userId)) };
        });
        if (groupsNext.some((g, i) => g !== groups[i])) {
            if (isFirestoreReady()) {
                groupsNext.filter((g, i) => g !== groups[i]).forEach(g => void upsertDoc('groups', g));
            } else {
                svcReplaceGroups(groupsNext);
            }
            setGroups(groupsNext);
        }
        const rejectNote = svcSendReminder({ userIds: [String(userId)], title: 'Application Update', text: 'Unfortunately, your membership application was not approved at this time. Please contact the group administrator for more information.', type: 'warning' });
        setReminders(prev => [...rejectNote, ...prev]);
        pushStatusNotification(userId, 'rejected');
        syncRoleClaim(userId, 'member');
        logAudit({ action: 'reject registration', targetType: 'user', targetId: rejected.id, newValue: rejected });
        return rejected;
    };
    const assignUserToGroup = (userId, groupId) => {
        if (groupId && !groups.find(g => String(g.id) === String(groupId)))
            return;
        const current = users.find(u => String(u.id) === String(userId));
        svcAssignGroup(userId, groupId, current);
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? { ...u, groupId } : u)));
        const groupsNext = groups.map(g => {
            const members = Array.isArray(g.members) ? g.members : [];
            if (String(g.id) !== String(groupId)) {
                return members.map(String).includes(String(userId))
                    ? { ...g, members: members.filter((memberId) => String(memberId) !== String(userId)) }
                    : g;
            }
            return members.map(String).includes(String(userId)) ? g : { ...g, members: [...members, userId] };
        });
        if (isFirestoreReady()) {
            groupsNext.filter((g, i) => g !== groups[i]).forEach(g => void upsertDoc('groups', g));
        } else {
            svcReplaceGroups(groupsNext);
        }
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
    const deleteGroup = (groupId) => {
        const group = groups.find(g => String(g.id) === String(groupId));
        if (!group) return null;
        if (isFirestoreReady() && db) {
            // In Firestore mode, delete directly since the service layer can't find the group.
            import('firebase/firestore').then(({ deleteDoc, doc: fsDoc }) => {
                void deleteDoc(fsDoc(db, 'groups', String(groupId)));
            });
        } else {
            svcDeleteGroup(groupId);
        }
        setGroups(prev => prev.filter(g => String(g.id) !== String(groupId)));
        logAudit({ action: 'delete group', targetType: 'group', targetId: String(groupId), oldValue: group });
        return group;
    };
    const getGroupMemberIds = (groupId) => {
        const g = groups.find(x => x.id === groupId);
        return Array.isArray(g?.members) ? g.members : [];
    };
    // Build a sanitized chat entry without going through the service layer.
    // In Firestore mode the service layer reads groups from localStorage (which is
    // empty), so we bypass it and update React state directly with an optimistic write.
    const buildChatEntry = (message, type = 'message') => {
        const text = String(message || '').trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 1000);
        if (!text) return null;
        return {
            id: genId(),
            sender: authUser?.id ?? 'unknown',
            senderName: authUser?.fullName || authUser?.name || 'Unknown',
            senderRole: authUser?.role || 'member',
            msg: text,
            time: new Date().toISOString(),
            type,
        };
    };
    const postChatMessage = (groupId, message) => {
        if (isFirestoreReady()) {
            const group = groups.find(g => String(g.id) === String(groupId));
            if (!group) return null;
            if (authUser?.role === 'member') {
                const members = Array.isArray(group.members) ? group.members : [];
                if (!members.map(String).includes(String(authUser?.id))) return null;
                if (authUser?.status === 'suspended') return null;
            }
            const entry = buildChatEntry(message);
            if (!entry) return null;
            // Optimistic state update so the message appears immediately.
            setGroups(prev => prev.map(g => {
                if (String(g.id) !== String(groupId)) return g;
                const chat = Array.isArray(g.chat) ? g.chat : [];
                return { ...g, chat: [...chat, entry] };
            }));
            // Persist to Firestore messages sub-collection.
            // Chat state across sessions is handled by the messages subscription below.
            if (db) void setDoc(doc(db, 'messages', String(groupId), 'items', entry.id), entry, { merge: true });
            return entry;
        }
        const entry = svcPostMessage(groupId, authUser, message);
        if (entry) setGroups(listGroups());
        return entry;
    };
    const postChatMedia = async (groupId, file) => {
        if (!isFirestoreReady() || !db || !storage) {
            toast.error('File sharing requires an active connection.');
            return null;
        }
        if (!authUser || authUser?.status === 'suspended') return null;
        const group = groups.find(g => String(g.id) === String(groupId));
        if (!group) return null;
        if (authUser?.role === 'member') {
            const members = Array.isArray(group.members) ? group.members : [];
            if (!members.map(String).includes(String(authUser?.id))) return null;
        }
        const MAX_SIZE = 8 * 1024 * 1024;
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (file.size > MAX_SIZE) { toast.error('File too large — maximum 8 MB.'); return null; }
        if (!ALLOWED_TYPES.includes(file.type)) { toast.error('Unsupported file type. Use JPEG, PNG, GIF, WEBP, or PDF.'); return null; }
        const msgId = genId();
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        try {
            const fileRef = storageRef(storage, `messages/${groupId}/media/${msgId}.${ext}`);
            await uploadBytes(fileRef, file);
            const mediaUrl = await getDownloadURL(fileRef);
            const entry = {
                id: msgId,
                sender: authUser?.id ?? 'unknown',
                senderName: authUser?.fullName || authUser?.name || 'Unknown',
                senderRole: authUser?.role || 'member',
                msg: file.name,
                mediaUrl,
                mediaName: file.name,
                mediaType: file.type,
                time: new Date().toISOString(),
                type: 'media',
            };
            setGroups(prev => prev.map(g => {
                if (String(g.id) !== String(groupId)) return g;
                const chat = Array.isArray(g.chat) ? g.chat : [];
                return { ...g, chat: [...chat, entry] };
            }));
            void setDoc(doc(db, 'messages', String(groupId), 'items', entry.id), entry, { merge: true });
            return entry;
        } catch (e) {
            console.error('[AppContext] postChatMedia failed:', e?.message);
            toast.error('Failed to upload file. Please try again.');
            return null;
        }
    };
    const postAnnouncement = (groupId, message) => {
        if (isFirestoreReady()) {
            const group = groups.find(g => String(g.id) === String(groupId));
            if (!group) return null;
            const entry = buildChatEntry(message, 'announcement');
            if (!entry) return null;
            setGroups(prev => prev.map(g => {
                if (String(g.id) !== String(groupId)) return g;
                const chat = Array.isArray(g.chat) ? g.chat : [];
                return { ...g, chat: [...chat, entry] };
            }));
            if (db) void setDoc(doc(db, 'messages', String(groupId), 'items', entry.id), entry, { merge: true });
            sendReminder({ userIds: getGroupMemberIds(groupId), title: '📢 Announcement', text: message, type: 'info' });
            return entry;
        }
        const entry = svcPostAnnouncement(groupId, authUser, message);
        if (entry) {
            setGroups(listGroups());
            sendReminder({ userIds: getGroupMemberIds(groupId), title: '📢 Announcement', text: message, type: 'info' });
        }
        return entry;
    };
    const addChatReaction = (groupId, messageId, emoji) => {
        if (!authUser) return;
        if (isFirestoreReady()) {
            let newEmojiUsers = null;
            setGroups(prev => prev.map(g => {
                if (String(g.id) !== String(groupId)) return g;
                const chat = (Array.isArray(g.chat) ? g.chat : []).map(m => {
                    if (m.id !== messageId) return m;
                    const reactions = { ...(m.reactions || {}) };
                    const users = reactions[emoji] ? [...reactions[emoji]] : [];
                    const idx = users.indexOf(authUser.id);
                    if (idx >= 0) users.splice(idx, 1); else users.push(authUser.id);
                    if (users.length === 0) { delete reactions[emoji]; newEmojiUsers = []; }
                    else { reactions[emoji] = users; newEmojiUsers = users; }
                    return { ...m, reactions };
                });
                return { ...g, chat };
            }));
            if (db && newEmojiUsers !== null) {
                const fieldPatch = {
                    [`reactions.${emoji}`]: newEmojiUsers.length === 0 ? deleteField() : newEmojiUsers,
                };
                void updateDoc(doc(db, 'messages', String(groupId), 'items', messageId), fieldPatch).catch(() => {});
            }
            return;
        }
        svcAddReaction(groupId, messageId, emoji, authUser.id);
        setGroups(listGroups());
    };
    const sendReminder = ({ userIds, title, text, type = 'info' }) => {
        const now = Date.now();
        if (now - lastReminderSentRef.current < 10_000) return [];
        lastReminderSentRef.current = now;
        const created = svcSendReminder({ userIds, title, text, type: type });
        setReminders(prev => [...created, ...prev]);
        logAudit({ action: 'send reminder', targetType: 'reminder', targetId: created[0]?.id || null, newValue: { count: created.length, title, text } });
        // Show a browser notification if the current user is one of the recipients.
        if (authUser?.id && userIds.map(String).includes(String(authUser.id))) {
            showBrowserNotification(title, text, { tag: 'susu-reminder' });
        }
        return created;
    };
    const markReminderRead = (reminderId) => {
        svcMarkRead(reminderId);
        setReminders(prev => prev.map(r => (r.id === reminderId ? { ...r, read: true } : r)));
    };
    const markAllRemindersRead = () => {
        if (isFirestoreReady()) {
            // In Firestore mode localStorage is empty — upsert from React state directly.
            const updated = reminders.map(r => ({ ...r, read: true }));
            updated.forEach(r => void upsertDoc('notifications', r));
            setReminders(updated);
        } else {
            svcMarkAllRead();
            setReminders(prev => prev.map(r => ({ ...r, read: true })));
        }
    };
    const deleteReminder = (reminderId) => {
        svcDeleteReminder(reminderId);
        setReminders(prev => prev.filter(r => r.id !== reminderId));
    };
    const clearReminders = () => {
        if (isFirestoreReady()) {
            reminders.forEach(r => void removeDoc('notifications', r.id));
        } else {
            svcClearReminders();
        }
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
            appReady, connectionTimedOut,
            dismissedNotifications,
            recordPayment, confirmPayment, rejectPayment, reopenPayment, updatePayment, disputePayment, resolveDispute,
            completePayout, assignPayoutRecipient,
            registerMember, updateMember, approveUser, rejectUser, reinstateUser,
            createGroup, updateGroup, deleteGroup,
            postChatMessage, postChatMedia, postAnnouncement, addChatReaction,
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

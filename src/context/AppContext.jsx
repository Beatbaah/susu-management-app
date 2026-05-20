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
import { getCurrentUser, setCurrentUser, signOut as authSignOut } from '../services/authService';
import { isFirestoreReady, subscribeCollection, upsertDoc, setWriteErrorHandler } from '../services/firestoreSync';
import { where, getDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { getPermissionState, requestPushPermission, onForegroundMessage, showBrowserNotification } from '../services/pushNotificationService';
import { toast } from '../utils/toast';
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
    if (storedVersion !== DEMO_DATA_VERSION) {
        wipeLocalStorage();
        const freshSettings = { ...DEFAULT_SETTINGS };
        // Preserve dark mode preference even across data wipes — it lives under a separate key.
        try {
            const savedDark = localStorage.getItem('excellent_susu_pref_darkMode');
            if (savedDark !== null) freshSettings.darkMode = savedDark === 'true';
        } catch {}
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
    // Register Firestore write-error handler once so failed syncs surface as toasts.
    useState(() => {
        if (isFirestoreReady()) {
            setWriteErrorHandler(() => {
                toast.error('Sync failed — change saved locally but may not reach the server. Check your connection.');
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
    const usersRef = useRef(users);
    const paymentsRef = useRef(payments);
    const groupsRef = useRef(groups);
    const lastReminderSentRef = useRef(0);
    const suspensionSweepUserIdRef = useRef(null);
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
    useEffect(() => { writeStore('settings', settings); }, [settings]);
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
                setPayments(prev => {
                    let changed = false;
                    const next = prev.map(p => {
                        if (p.status === 'pending' && p.dueDate && p.dueDate < today) {
                            changed = true;
                            const u = { ...p, status: 'overdue', updatedAt: new Date().toISOString() };
                            void upsertDoc('payments', u);
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
    // High #8 — re-verify role and status from Firestore on every login/page-load.
    // The client caches the role in localStorage; this fetch ensures a stale cache
    // cannot persist an elevated role after an admin demotes the account remotely.
    useEffect(() => {
        if (!isFirestoreReady() || !authUser?.id || !db) return;
        getDoc(doc(db, 'users', authUser.id)).then(snap => {
            if (!snap.exists()) return;
            const { role: freshRole, status: freshStatus } = snap.data();
            if (freshStatus === 'suspended') {
                // Force logout — account was suspended while user was logged in.
                authSignOut().catch(() => {});
                setAuthUserState(null);
                return;
            }
            const validRoles = new Set(['admin', 'manager', 'collector', 'member']);
            if (freshRole && validRoles.has(freshRole) && freshRole !== authUser.role) {
                setAuthUserState(prev => prev ? { ...prev, role: freshRole } : prev);
            }
        }).catch(() => {}); // network failure is non-fatal
    }, [authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // Phase 3 — when Firebase is configured and the user is logged in, subscribe
    // to collections with role-scoped queries so Firestore rules are satisfied.
    // Staff (admin/manager/collector) get unfiltered access; members get queries
    // filtered to their own data. auditLogs are restricted to admins only.
    useEffect(() => {
        if (!isFirestoreReady() || !authUser)
            return;
        // Mark the app ready after the first snapshot from any collection arrives,
        // or after an 8 s timeout — whichever comes first. The longer timeout
        // prevents the skeleton clearing before data arrives on slow connections;
        // if the timeout fires first we also flag a connection warning.
        let readyHit = false;
        const markReady = () => {
            if (readyHit)
                return;
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
        // Normalize schema drift: Firestore docs written with legacy field names
        // are transparently aliased so the rest of the UI only needs one path.
        const normalizePayments = items => items.map(p => {
            const memberId = p.memberId || p.userId || '';
            return { ...p, memberId, userId: memberId };
        });
        const normalizeGroups = items => items.map(g => {
            const groupName = g.groupName || g.name || '';
            const contributionAmount = Number(g.contributionAmount ?? g.contribution ?? 0);
            return { ...g, groupName, name: groupName, contributionAmount, contribution: contributionAmount };
        });
        const subs = [];
        // Users: staff see all members; Firestore denies unfiltered list for members
        if (isStaff) {
            subs.push(subscribeCollection('users', items => { markReady(); setUsers(normalizeUsers(items)); }));
        }
        // Groups: staff see all; members see only groups they belong to
        subs.push(subscribeCollection('groups', items => { markReady(); setGroups(normalizeGroups(items)); },
            isStaff ? [] : [where('members', 'array-contains', uid)]));
        // Payments: staff see all; members see only their own (field: userId)
        subs.push(subscribeCollection('payments', items => { markReady(); setPayments(normalizePayments(items)); },
            isStaff ? [] : [where('userId', '==', uid)]));
        // Payouts: staff see all; members see only where they're the recipient
        subs.push(subscribeCollection('payouts', items => { markReady(); setSchedule(items); },
            isStaff ? [] : [where('recipientId', '==', uid)]));
        // Notifications: managers see all; collectors/members see only their own
        subs.push(subscribeCollection('notifications', items => { markReady(); setReminders(items); },
            isManagerRole ? [] : [where('userId', '==', uid)]));
        // Audit logs: admin only — others get permission denied on the whole collection
        if (isAdminRole) {
            subs.push(subscribeCollection('auditLogs', items => {
                markReady();
                setAuditLogs([...items]
                    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
                    .slice(0, 250));
            }));
        }
        return () => {
            window.clearTimeout(timeoutId);
            subs.forEach(u => u());
        };
    }, [authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    // Runs once per login session (tracked by suspensionSweepUserIdRef) — not on
    // every profile update that happens to touch the authUser object.
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
        if (JSON.stringify(updatedUsers) !== JSON.stringify(currentUsers))
            setUsers(updatedUsers);
        if (newlySuspendedIds.length > 0) {
            const currentGroups = isFirestoreReady() ? groupsRef.current : listGroups();
            const groupsNext = currentGroups.map(g => {
                const members = Array.isArray(g.members) ? g.members : [];
                const filtered = members.filter(id => !newlySuspendedIds.includes(String(id)));
                return filtered.length !== members.length ? { ...g, members: filtered } : g;
            });
            svcReplaceGroups(groupsNext);
            setGroups(groupsNext);
        }
    }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps
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
            svcReplaceGroups(groupsNext);
            setGroups(groupsNext);
        }
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
            svcReplaceGroups(groupsNext);
            setGroups(groupsNext);
        }
        logAudit({ action: 'approve registration', targetType: 'user', targetId: approved.id, newValue: approved });
        return approved;
    };
    const reinstateUser = (userId) => {
        const current = users.find(u => String(u.id) === String(userId));
        const reinstated = svcReinstateMember(userId, authUser?.id, current);
        if (!reinstated) return null;
        setUsers(prev => prev.map(u => (String(u.id) === String(userId) ? reinstated : u)));
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
            svcReplaceGroups(groupsNext);
            setGroups(groupsNext);
        }
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
        if (entry && !isFirestoreReady())
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
            if (!isFirestoreReady()) setGroups(listGroups());
            sendReminder({ userIds: getGroupMemberIds(groupId), title: '📢 Announcement', text: message, type: 'info' });
        }
        return entry;
    };
    const addChatReaction = (groupId, messageId, emoji) => {
        if (!authUser) return;
        svcAddReaction(groupId, messageId, emoji, authUser.id);
        if (!isFirestoreReady()) setGroups(listGroups());
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
            appReady, connectionTimedOut,
            dismissedNotifications,
            recordPayment, confirmPayment, rejectPayment, reopenPayment, updatePayment, disputePayment, resolveDispute,
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

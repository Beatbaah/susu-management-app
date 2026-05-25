// permissions.js — Four-role security model for Excellent Susu.
//
// ─── Role definitions ─────────────────────────────────────────────────────────
//
// ADMIN (Super Admin)
//   Full system access. Inherits everything a Manager can do, plus:
//   • View and export audit logs
//   • Import and restore all app data
//   • Delete groups and users
//   • Manage global app settings
//
// MANAGER
//   Operational lead. Inherits everything a Collector can do, plus:
//   • Approve or reject member registrations
//   • Confirm or reject payments
//   • Create, edit, and delete groups
//   • Manage the payout schedule (assign recipients, mark completed)
//   • View analytics and reporting
//   • Create receipts
//
// COLLECTOR
//   Field staff with limited write access:
//   • Record payments (cannot confirm or approve them)
//   • View the full member list (read-only — cannot add/edit/delete)
//   • View all groups (read-only — cannot create/edit/delete)
//   • View the payout schedule (read-only)
//   • View defaulters and send payment reminders
//   • View receipts (cannot create them)
//   • Participate in group chat
//
// MEMBER
//   Savings participant. Sees ONLY their own data — no staff features:
//   • Personal portal (own account dashboard)
//   • Their own group(s)
//   • Their own payment history
//   • Their own receipts
//   • Their own reminders
//   • Leaderboard (public ranking, no sensitive data)
//   • Group chat (scoped to their group)
//   • Calendar (their own payment due dates and payout)
//   • Personal profile
//   • Personal settings (notifications, dark mode, password — no data export)
//
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = {
    SUPER_ADMIN: 'admin',
    MANAGER:     'manager',
    COLLECTOR:   'collector',
    MEMBER:      'member',
};

export const ROLE_LABELS = {
    admin:     'Super Admin',
    manager:   'Manager',
    collector: 'Collector',
    member:    'Member',
};

const A  = 'admin';
const Mg = 'manager';
const Co = 'collector';
const Me = 'member';

export const PERMISSIONS = {
    // ── Staff dashboard & analytics ───────────────────────────────────────────
    viewDashboard:      [A, Mg, Co],   // overview stats (members go to portal instead)
    viewAnalytics:      [A, Mg],

    // ── Member portal ─────────────────────────────────────────────────────────
    viewMemberPortal:   [Me],          // personal account home for members only

    // ── Members ───────────────────────────────────────────────────────────────
    viewMembers:        [A, Mg, Co],   // view the member list
    manageMembers:      [A, Mg],       // create / edit / approve / suspend / delete

    // ── Groups ────────────────────────────────────────────────────────────────
    viewGroups:         [A, Mg, Co, Me], // members see only their own group
    manageGroups:       [A, Mg],         // create / edit / delete

    // ── Payments ──────────────────────────────────────────────────────────────
    viewPayments:       [A, Mg, Co, Me], // members see only their own payments
    recordPayment:      [A, Mg, Co],
    confirmPayment:     [A, Mg],

    // ── Payout schedule ───────────────────────────────────────────────────────
    viewPayoutSchedule: [A, Mg, Co],   // members see their own payout in their portal
    managePayouts:      [A, Mg],       // assign recipients, mark completed

    // ── Defaulters & reminders ────────────────────────────────────────────────
    viewDefaulters:     [A, Mg, Co],
    sendReminders:      [A, Mg, Co],

    // ── Receipts ──────────────────────────────────────────────────────────────
    viewReceipts:       [A, Mg, Co, Me], // members see only their own receipts
    createReceipts:     [A, Mg],

    // ── Audit logs ────────────────────────────────────────────────────────────
    viewAuditLogs:      [A],

    // ── Shared / personal ────────────────────────────────────────────────────
    chat:               [A, Mg, Co, Me], // members scoped to their group
    viewLeaderboard:    [A, Mg, Co, Me],
    viewCalendar:       [A, Mg, Co, Me], // members see only their own events
    viewSettings:       [A, Mg, Co, Me], // members: personal prefs only (no data export)
    viewProfile:        [A, Mg, Co, Me],
};

// Map each page/route to the permission required to visit it.
export const PAGE_PERMISSIONS = {
    dashboard:   'viewDashboard',       // staff analytics dashboard
    portal:      'viewMemberPortal',    // member personal home
    analytics:   'viewAnalytics',
    members:     'viewMembers',
    groups:      'viewGroups',
    payments:    'viewPayments',
    defaulters:  'viewDefaulters',
    payout:      'viewPayoutSchedule',
    reminders:   'sendReminders',       // member reminders come via notification bell
    leaderboard: 'viewLeaderboard',
    chat:        'chat',
    settings:    'viewSettings',
    audit:       'viewAuditLogs',
    receipts:    'viewReceipts',
    profile:     'viewProfile',
    calendar:    'viewCalendar',
};

// Pages a member is explicitly allowed to visit.
// Data on each page is already scoped to their own records.
const MEMBER_PAGES = new Set([
    'portal',      // their personal home
    'groups',      // filtered to groups they belong to
    'payments',    // filtered to their own payment history
    'receipts',    // filtered to their own receipts
    'reminders',   // filtered to their own reminders (read-only)
    'leaderboard', // public ranking
    'chat',        // scoped to their group
    'calendar',    // their own payment due dates
    'profile',     // their own profile
    'settings',    // personal preferences only
]);

export function canAccess(role, permission) {
    if (!permission) return true;
    if (!role)       return false;
    return (PERMISSIONS[permission] || []).includes(role);
}

export function canAccessPage(role, pageId) {
    if (role === ROLES.MEMBER) return MEMBER_PAGES.has(pageId);
    return canAccess(role, PAGE_PERMISSIONS[pageId]);
}

export function roleLabel(role) {
    return ROLE_LABELS[role || ''] || 'User';
}

// Permissions for the four-role security model defined in ARCHITECTURE.md.
// Frontend role checks improve UX; the same checks are enforced server-side
// by Firestore rules (see firestoreRules.example.rules).
export const ROLES = {
    SUPER_ADMIN: 'admin',
    MANAGER: 'manager',
    COLLECTOR: 'collector',
    MEMBER: 'member',
};
export const ROLE_LABELS = {
    [ROLES.SUPER_ADMIN]: 'Super Admin',
    [ROLES.MANAGER]: 'Manager',
    [ROLES.COLLECTOR]: 'Collector',
    [ROLES.MEMBER]: 'Member',
};
export const PERMISSIONS = {
    viewDashboard: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.COLLECTOR, ROLES.MEMBER],
    viewAnalytics: [ROLES.SUPER_ADMIN, ROLES.MANAGER],
    manageUsers: [ROLES.SUPER_ADMIN],
    manageMembers: [ROLES.SUPER_ADMIN, ROLES.MANAGER],
    manageGroups: [ROLES.SUPER_ADMIN, ROLES.MANAGER],
    recordPayment: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.COLLECTOR],
    confirmPayment: [ROLES.SUPER_ADMIN, ROLES.MANAGER],
    managePayouts: [ROLES.SUPER_ADMIN, ROLES.MANAGER],
    viewDefaulters: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.COLLECTOR],
    sendReminders: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.COLLECTOR],
    viewAuditLogs: [ROLES.SUPER_ADMIN],
    chat: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.COLLECTOR, ROLES.MEMBER],
};
export const PAGE_PERMISSIONS = {
    dashboard: 'viewDashboard',
    portal: 'viewDashboard',
    analytics: 'viewAnalytics',
    members: 'manageMembers',
    groups: 'viewDashboard',
    payments: 'recordPayment',
    defaulters: 'viewDefaulters',
    payout: 'managePayouts',
    reminders: 'viewDashboard', // members can see their own; staff can send (UI gated separately)
    leaderboard: 'viewDashboard',
    chat: 'chat',
    settings: 'viewDashboard',
    audit: 'viewAuditLogs',
    receipts: 'viewDashboard',
    profile: 'viewDashboard',
    calendar: 'viewDashboard',
};
export function canAccess(role, permission) {
    if (!permission)
        return true;
    if (!role)
        return false;
    return (PERMISSIONS[permission] || []).includes(role);
}
export function canAccessPage(role, pageId) {
    // Members may always see their own groups + payments + portal + receipts + reminders.
    if (role === ROLES.MEMBER && ['groups', 'payments', 'portal', 'receipts', 'reminders'].includes(pageId))
        return true;
    return canAccess(role, PAGE_PERMISSIONS[pageId]);
}
export function roleLabel(role) {
    return ROLE_LABELS[role || ''] || 'User';
}

export const MOCK_USERS = [];
export const mockMembers = MOCK_USERS;
export const MOCK_GROUPS = [];
export const mockGroups = MOCK_GROUPS;
export const MOCK_PAYMENTS = [];
export const mockPayments = MOCK_PAYMENTS;
export const PAYOUT_SCHEDULE = [];
export const mockPayouts = PAYOUT_SCHEDULE;
export const calculateStats = () => {
    return {
        totalCollected: 0,
        activeMembers: 0,
        activeGroups: 0,
        payoutScheduled: 0,
        totalMembers: 0,
        collectionRate: 0,
        defaulters: 0,
        overdueCount: 0
    };
};
export const MOCK_AUDIT_LOGS = [];
export const MOCK_REMINDERS = [];

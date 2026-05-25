import { describe, it, expect } from 'vitest';
import {
    normalizeMoney,
    getPaymentPeriodKey,
    validatePaymentRecord,
    validatePayoutCompletion,
    getDefaulterRisk,
    calculateFinancialMetrics,
} from '../financeValidation.js';

describe('normalizeMoney', () => {
    it('returns the number when given a valid number', () => {
        expect(normalizeMoney(100)).toBe(100);
    });

    it('parses a numeric string', () => {
        expect(normalizeMoney('250.50')).toBe(250.50);
    });

    it('returns 0 for NaN', () => {
        expect(normalizeMoney(NaN)).toBe(0);
    });

    it('returns 0 for null', () => {
        expect(normalizeMoney(null)).toBe(0);
    });

    it('returns 0 for undefined', () => {
        expect(normalizeMoney(undefined)).toBe(0);
    });
});

describe('getPaymentPeriodKey', () => {
    it('uses memberId when present', () => {
        const key = getPaymentPeriodKey({ memberId: 'mem1', groupId: 'grp1', round: 2 });
        expect(key).toBe('mem1::grp1::2');
    });

    it('falls back to userId when memberId is absent', () => {
        const key = getPaymentPeriodKey({ userId: 'usr1', groupId: 'grp1', round: 3 });
        expect(key).toBe('usr1::grp1::3');
    });

    it('uses dueDate when round is absent', () => {
        const key = getPaymentPeriodKey({ memberId: 'mem1', groupId: 'grp1', dueDate: '2025-01-01' });
        expect(key).toBe('mem1::grp1::2025-01-01');
    });

    it('builds key from memberId, groupId, and round', () => {
        const key = getPaymentPeriodKey({ memberId: 'a', groupId: 'b', round: 1 });
        expect(key).toBe('a::b::1');
    });
});

describe('validatePaymentRecord', () => {
    const group = { contributionAmount: 500, members: [{ id: 'm1' }] };

    it('fails when both memberId and userId are missing', () => {
        const result = validatePaymentRecord({ payment: { groupId: 'g1', amount: 500 }, group, payments: [] });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/member/i);
    });

    it('fails when groupId is missing', () => {
        const result = validatePaymentRecord({ payment: { memberId: 'm1', amount: 500 }, group, payments: [] });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/group/i);
    });

    it('fails when amount is 0', () => {
        const result = validatePaymentRecord({ payment: { memberId: 'm1', groupId: 'g1', amount: 0 }, group, payments: [] });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/greater than zero/i);
    });

    it('fails when amount exceeds 50000', () => {
        const result = validatePaymentRecord({ payment: { memberId: 'm1', groupId: 'g1', amount: 60000 }, group, payments: [] });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/50,000/);
    });

    it('fails when a paid duplicate record exists for the same period', () => {
        const payment = { memberId: 'm1', groupId: 'g1', amount: 500, round: 1 };
        const existing = { id: 'existing', memberId: 'm1', groupId: 'g1', round: 1, status: 'paid', amount: 500 };
        const result = validatePaymentRecord({ payment, group, payments: [existing], actorRole: 'admin' });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/already exists/i);
    });

    it('fails when amount mismatches contribution and actor is not admin or manager', () => {
        const payment = { memberId: 'm1', groupId: 'g1', amount: 200, round: 1 };
        const result = validatePaymentRecord({ payment, group, payments: [], actorRole: 'member' });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/match/i);
    });

    it('passes when amount mismatches but actor is admin', () => {
        const payment = { memberId: 'm1', groupId: 'g1', amount: 200, round: 1 };
        const result = validatePaymentRecord({ payment, group, payments: [], actorRole: 'admin' });
        expect(result.ok).toBe(true);
    });

    it('passes for a valid payment record', () => {
        const payment = { memberId: 'm1', groupId: 'g1', amount: 500, round: 1 };
        const result = validatePaymentRecord({ payment, group, payments: [], actorRole: 'admin' });
        expect(result.ok).toBe(true);
    });
});

describe('validatePayoutCompletion', () => {
    it('fails when groupId is missing from payout', () => {
        const result = validatePayoutCompletion({ payout: { memberId: 'm1' }, group: {}, payments: [] });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/group/i);
    });

    it('fails when memberId is missing from payout', () => {
        const result = validatePayoutCompletion({ payout: { groupId: 'g1' }, group: {}, payments: [] });
        expect(result.ok).toBe(false);
    });

    it('bypasses collection checks when override is true', () => {
        const result = validatePayoutCompletion({
            payout: { groupId: 'g1', memberId: 'm1' },
            group: { members: [{ id: 'm1' }, { id: 'm2' }] },
            payments: [],
            override: true,
        });
        expect(result.ok).toBe(true);
    });

    it('fails when verified payments are fewer than expected member count', () => {
        const group = { members: [{ id: 'm1' }, { id: 'm2' }], currentRound: 1 };
        const payments = [{ groupId: 'g1', memberId: 'm1', round: 1, status: 'paid', amount: 500 }];
        const result = validatePayoutCompletion({ payout: { groupId: 'g1', memberId: 'm1', round: 1 }, group, payments });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/1 of 2/);
    });

    it('passes when all expected payments are verified', () => {
        const group = { members: [{ id: 'm1' }, { id: 'm2' }], currentRound: 1 };
        const payments = [
            { groupId: 'g1', memberId: 'm1', round: 1, status: 'paid', amount: 500 },
            { groupId: 'g1', memberId: 'm2', round: 1, status: 'paid', amount: 500 },
        ];
        const result = validatePayoutCompletion({ payout: { groupId: 'g1', memberId: 'm1', round: 1 }, group, payments });
        expect(result.ok).toBe(true);
    });
});

describe('getDefaulterRisk', () => {
    const today = new Date('2025-06-01');

    it('returns None risk for a paid payment', () => {
        const result = getDefaulterRisk({ status: 'paid', dueDate: '2025-05-01' }, today);
        expect(result.level).toBe('None');
        expect(result.daysOverdue).toBe(0);
    });

    it('returns High risk when status is overdue and no dueDate is set', () => {
        const result = getDefaulterRisk({ status: 'overdue' }, today);
        expect(result.level).toBe('High');
        expect(result.daysOverdue).toBe(0);
    });

    it('returns None when status is pending and no dueDate is set', () => {
        const result = getDefaulterRisk({ status: 'pending' }, today);
        expect(result.level).toBe('None');
    });

    it('returns Low risk at 1 day overdue', () => {
        const result = getDefaulterRisk({ status: 'pending', dueDate: '2025-05-31' }, today);
        expect(result.level).toBe('Low');
        expect(result.daysOverdue).toBe(1);
    });

    it('returns Medium risk at 5 days overdue', () => {
        const result = getDefaulterRisk({ status: 'pending', dueDate: '2025-05-27' }, today);
        expect(result.level).toBe('Medium');
        expect(result.daysOverdue).toBe(5);
    });

    it('returns High risk at 10 days overdue', () => {
        const result = getDefaulterRisk({ status: 'pending', dueDate: '2025-05-22' }, today);
        expect(result.level).toBe('High');
        expect(result.daysOverdue).toBe(10);
    });
});

describe('calculateFinancialMetrics', () => {
    it('returns all zeros for empty input', () => {
        const result = calculateFinancialMetrics({ payments: [], groups: [], payouts: [], users: [] });
        expect(result.totalPaid).toBe(0);
        expect(result.totalExpected).toBe(0);
        expect(result.collectionRate).toBe(0);
        expect(result.defaultRate).toBe(0);
    });

    it('sums only paid payments into totalPaid', () => {
        const payments = [
            { status: 'paid', amount: 300 },
            { status: 'paid', amount: 200 },
            { status: 'pending', amount: 500 },
            { status: 'overdue', amount: 100 },
        ];
        const result = calculateFinancialMetrics({ payments, groups: [], payouts: [], users: [] });
        expect(result.totalPaid).toBe(500);
    });

    it('calculates collectionRate as (totalPaid / expectedToDate) * 100', () => {
        const payments = [{ status: 'paid', amount: 500 }];
        const groups = [{ contributionAmount: 500, members: [{ id: 'm1' }], currentRound: 1, totalRounds: 1 }];
        const result = calculateFinancialMetrics({ payments, groups, payouts: [], users: [] });
        expect(result.totalExpected).toBe(500);
        expect(result.collectionRate).toBeCloseTo(100);
    });

    it('calculates partial collection rate correctly', () => {
        const payments = [{ status: 'paid', amount: 250 }];
        const groups = [{ contributionAmount: 500, members: [{ id: 'm1' }], currentRound: 1, totalRounds: 1 }];
        const result = calculateFinancialMetrics({ payments, groups, payouts: [], users: [] });
        expect(result.collectionRate).toBeCloseTo(50);
    });
});

import { describe, it, expect } from 'vitest';
import { validateGroup } from '../groupRules.js';

describe('validateGroup', () => {
    const validDraft = {
        groupName: 'Office Susu',
        contributionAmount: 200,
        totalRounds: 12,
        frequency: 'Monthly',
    };

    it('fails when group name is too short', () => {
        const result = validateGroup({ ...validDraft, groupName: 'A' });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/name/i);
    });

    it('fails when contribution amount is 0', () => {
        const result = validateGroup({ ...validDraft, contributionAmount: 0 });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/greater than zero/i);
    });

    it('fails when contribution amount is negative', () => {
        const result = validateGroup({ ...validDraft, contributionAmount: -50 });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/greater than zero/i);
    });

    it('fails when totalRounds is 0', () => {
        const result = validateGroup({ ...validDraft, totalRounds: 0 });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/rounds/i);
    });

    it('fails when frequency is not one of the valid options', () => {
        const result = validateGroup({ ...validDraft, frequency: 'Yearly' });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/Daily|Weekly|Bi-weekly|Monthly/);
    });

    it('passes for each valid frequency value', () => {
        for (const freq of ['Daily', 'Weekly', 'Bi-weekly', 'Monthly']) {
            const result = validateGroup({ ...validDraft, frequency: freq });
            expect(result.ok).toBe(true);
        }
    });

    it('passes when all fields are valid', () => {
        const result = validateGroup(validDraft);
        expect(result.ok).toBe(true);
    });
});

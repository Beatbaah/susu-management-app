import { describe, it, expect } from 'vitest';
import { validateMemberRegistration } from '../memberRules.js';

describe('validateMemberRegistration', () => {
    const validDraft = {
        fullName: 'Ama Owusu',
        email: 'ama@example.com',
        phone: '0244123456',
    };

    it('fails when fullName is missing', () => {
        const result = validateMemberRegistration({ ...validDraft, fullName: '' });
        expect(result.ok).toBe(false);
        expect(result.field).toBe('fullName');
    });

    it('fails when email format is invalid', () => {
        const result = validateMemberRegistration({ ...validDraft, email: 'not-an-email' });
        expect(result.ok).toBe(false);
        expect(result.field).toBe('email');
    });

    it('fails when email is already taken by another user', () => {
        const existingUsers = [{ id: 'other-id', email: 'ama@example.com' }];
        const result = validateMemberRegistration({ ...validDraft, id: 'new-id' }, existingUsers);
        expect(result.ok).toBe(false);
        expect(result.field).toBe('email');
        expect(result.message).toMatch(/already exists/i);
    });

    it('fails for a non-Ghana phone number format', () => {
        const result = validateMemberRegistration({ ...validDraft, phone: '07911123456' });
        expect(result.ok).toBe(false);
        expect(result.field).toBe('phone');
    });

    it('passes for a valid Ghana 0-prefix phone number', () => {
        const result = validateMemberRegistration({ ...validDraft, phone: '0244123456' });
        expect(result.ok).toBe(true);
    });

    it('passes for a valid +233 format phone number', () => {
        const result = validateMemberRegistration({ ...validDraft, phone: '+233244123456' });
        expect(result.ok).toBe(true);
    });

    it('passes when all fields are valid', () => {
        const result = validateMemberRegistration(validDraft);
        expect(result.ok).toBe(true);
    });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Ghana mobile: optional +233 or 0 prefix, then 9 digits starting with 2-5
const GHANA_PHONE_RE = /^(\+233|0)[2-5][0-9]{8}$/;

export function validateMemberRegistration(draft, existingUsers = []) {
    const fullName = (draft.fullName || draft.name || '').trim();
    const email = (draft.email || '').trim().toLowerCase();
    const phone = (draft.phone || '').replace(/[\s\-()]/g, '');
    if (fullName.length < 2)
        return { ok: false, message: 'Full name is required.', field: 'fullName' };
    if (!EMAIL_RE.test(email))
        return { ok: false, message: 'Enter a valid email address.', field: 'email' };
    const emailTaken = existingUsers.some(u => u.id !== draft.id && (u.email || '').toLowerCase() === email);
    if (emailTaken)
        return { ok: false, message: 'An account with this email already exists.', field: 'email' };
    if (!GHANA_PHONE_RE.test(phone))
        return { ok: false, message: 'Enter a valid Ghana mobile number (e.g. 0244123456).', field: 'phone' };
    return { ok: true };
}

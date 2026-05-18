const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmail(email) {
    if (!email || !EMAIL_RE.test(email.trim())) {
        return { ok: false, message: 'Enter a valid email address.' };
    }
    return { ok: true };
}
export function validatePassword(password) {
    if (!password || password.length < 8) {
        return { ok: false, message: 'Password must be at least 8 characters.' };
    }
    return { ok: true };
}
export function validateLogin(email, password) {
    const e = validateEmail(email);
    if (!e.ok)
        return e;
    if (!password)
        return { ok: false, message: 'Password is required.' };
    return { ok: true };
}

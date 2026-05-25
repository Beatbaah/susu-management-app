// Currency symbol used by `fmt`. Mutable so that `Settings → Currency` can
// update display app-wide without threading the value through every caller.
let currentCurrencySymbol = 'GH₵';
export const setCurrencySymbol = (symbol) => {
    if (symbol && typeof symbol === 'string')
        currentCurrencySymbol = symbol;
};
export const getCurrencySymbol = () => currentCurrencySymbol;
export const fmt = (n) => {
    const num = Number(n);
    return `${currentCurrencySymbol} ${(Number.isFinite(num) ? num : 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const initials = (name) => (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
export const todayStr = () => new Date().toISOString().split("T")[0];
// Crypto-safe reference generation (replaces Math.random)
export const genRef = () => {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return "XS-" + Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 8);
};
// Crypto-safe unique ID generator
export const genId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback: timestamp + random suffix (still better than Date.now() alone)
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return `${Date.now()}-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
};

// Tiny in-memory event bus for UI chrome signals (e.g. hide/show the mobile
// bottom navigation when a page wants more vertical space). Avoids prop-
// drilling or bloating AppContext for a purely-presentational concern.
function createSignal(initial) {
    let current = initial;
    const listeners = new Set();
    return {
        get: () => current,
        set: (next) => {
            if (current === next)
                return;
            current = next;
            listeners.forEach(l => l(current));
        },
        subscribe: (l) => {
            listeners.add(l);
            l(current); // emit current value immediately
            return () => listeners.delete(l);
        },
    };
}
export const mobileNavHidden = createSignal(false);

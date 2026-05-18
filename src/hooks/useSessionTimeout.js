import { useCallback, useEffect, useRef, useState } from 'react';

const TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
const WARNING_MS = 2 * 60 * 1000;   // warn when 2 minutes remain

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export function useSessionTimeout({ enabled, onExpire }) {
    const [showWarning, setShowWarning] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(WARNING_MS / 1000);

    const showWarningRef = useRef(false);
    const warningTimerRef = useRef(null);
    const expireTimerRef = useRef(null);
    const countdownRef = useRef(null);
    const onExpireRef = useRef(onExpire);

    // Always hold the latest callback without re-registering event listeners
    useEffect(() => { onExpireRef.current = onExpire; });

    const clearAll = () => {
        clearTimeout(warningTimerRef.current);
        clearTimeout(expireTimerRef.current);
        clearInterval(countdownRef.current);
    };

    const reset = useCallback(() => {
        clearAll();
        showWarningRef.current = false;
        setShowWarning(false);

        warningTimerRef.current = setTimeout(() => {
            showWarningRef.current = true;
            setShowWarning(true);
            setRemainingSeconds(WARNING_MS / 1000);
            countdownRef.current = setInterval(() => {
                setRemainingSeconds(s => Math.max(0, s - 1));
            }, 1000);
        }, TIMEOUT_MS - WARNING_MS);

        expireTimerRef.current = setTimeout(() => {
            clearAll();
            showWarningRef.current = false;
            setShowWarning(false);
            onExpireRef.current?.();
        }, TIMEOUT_MS);
    }, []);

    useEffect(() => {
        if (!enabled) {
            clearAll();
            showWarningRef.current = false;
            setShowWarning(false);
            return;
        }

        reset();

        const handleActivity = () => {
            // Don't reset while the warning is visible — user must actively choose
            if (!showWarningRef.current) reset();
        };

        ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
        return () => {
            clearAll();
            ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handleActivity));
        };
    }, [enabled, reset]);

    return { showWarning, remainingSeconds, extend: reset };
}

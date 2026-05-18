import { Toaster as Sonner } from 'sonner';
import { useEffect, useState } from 'react';
/**
 * Themed Toaster — reads the current theme from the `.light` class on
 * <html> (toggled by AppContext from settings.darkMode) so toasts adapt
 * automatically when the user switches modes.
 */
export function Toaster(props) {
    const [theme, setTheme] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('light')
        ? 'light'
        : 'dark');
    useEffect(() => {
        if (typeof document === 'undefined')
            return;
        const observer = new MutationObserver(() => {
            setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark');
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    return (<Sonner theme={theme} position="top-right" richColors closeButton duration={3500} className="toaster group" toastOptions={{
            classNames: {
                toast: 'rounded-2xl border border-border shadow-lg backdrop-blur-xl',
            },
        }} style={{
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
        }} {...props}/>);
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { AppProvider } from './context/AppContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { Toaster } from './components/ui/sonner';
import './styles/App.css';

if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_APP_VERSION,
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
        beforeSend(event) {
            // Drop noisy network-level errors that aren't actionable
            const msg = event.exception?.values?.[0]?.value || '';
            if (/network|fetch|load failed|failed to fetch/i.test(msg)) return null;
            return event;
        },
    });
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => { });
}
if ('caches' in window) {
    caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => { });
}

function SentryFallback() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ maxWidth: '400px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Something went wrong</h1>
                <p style={{ fontSize: '14px', color: '#6B7280' }}>
                    An unexpected error occurred. Please refresh the page to try again.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{ marginTop: '16px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                    Refresh
                </button>
            </div>
        </div>
    );
}

const rootElement = document.getElementById('root');
if (!rootElement)
    throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <Sentry.ErrorBoundary fallback={<SentryFallback />} showDialog={false}>
            <AppErrorBoundary>
                <AppProvider>
                    <App />
                    <Toaster />
                </AppProvider>
            </AppErrorBoundary>
        </Sentry.ErrorBoundary>
    </React.StrictMode>
);

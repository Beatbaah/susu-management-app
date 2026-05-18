import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { Toaster } from './components/ui/sonner';
import './styles/App.css';
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
const rootElement = document.getElementById('root');
if (!rootElement)
    throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode>
    <AppErrorBoundary>
      <AppProvider>
        <App />
        <Toaster />
      </AppProvider>
    </AppErrorBoundary>
  </React.StrictMode>);

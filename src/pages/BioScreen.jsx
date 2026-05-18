import { useEffect, useState } from 'react';
import { Fingerprint, ShieldCheck, AlertTriangle } from 'lucide-react';
import { getCurrentUser, setCurrentUser } from '../services/authService';
export function BioScreen({ onSuccess, onFallback }) {
    const [state, setState] = useState('scanning');
    useEffect(() => {
        // In production this would integrate with WebAuthn or a native biometric
        // bridge. In demo mode we simulate a scan, then resolve the last-known
        // signed-in account from authService (the same persistence the rest of
        // the architecture uses).
        const timer = window.setTimeout(() => {
            const lastUser = getCurrentUser();
            if (!lastUser) {
                setState('no-account');
                return;
            }
            const restored = setCurrentUser(lastUser);
            if (!restored) {
                setState('error');
                return;
            }
            setState('success');
            window.setTimeout(() => onSuccess(restored), 500);
        }, 1600);
        return () => window.clearTimeout(timer);
    }, [onSuccess]);
    return (<div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[150px] opacity-50"/>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] opacity-30"/>

      <div className="relative z-10 w-full max-w-sm text-center">
        <div className="mb-8">
          <div className={`w-40 h-40 rounded-full bg-accent border border-border flex items-center justify-center mx-auto transition-all ${state === 'scanning' ? 'animate-pulse' : ''}`}>
            {state === 'success' ? (<ShieldCheck className="w-20 h-20 text-success"/>) : state === 'error' || state === 'no-account' ? (<AlertTriangle className="w-20 h-20 text-yellow-400"/>) : (<Fingerprint className="w-20 h-20 text-primary"/>)}
          </div>
        </div>

        {state === 'scanning' && (<>
            <h1 className="text-2xl font-bold mb-2">Touch sensor</h1>
            <p className="text-foreground/50 text-sm">Verifying your identity…</p>
          </>)}
        {state === 'success' && (<>
            <h1 className="text-2xl font-bold mb-2 text-success">Authenticated</h1>
            <p className="text-foreground/50 text-sm">Welcome back.</p>
          </>)}
        {state === 'no-account' && (<>
            <h1 className="text-2xl font-bold mb-2">No saved session</h1>
            <p className="text-foreground/50 text-sm mb-6">Please sign in once with your email to enable biometric.</p>
            <button type="button" onClick={onFallback} className="bg-primary text-primary-foreground py-3 px-6 rounded-2xl font-bold">
              Use email & password
            </button>
          </>)}
        {state === 'error' && (<>
            <h1 className="text-2xl font-bold mb-2">Verification failed</h1>
            <p className="text-foreground/50 text-sm mb-6">We could not confirm your identity.</p>
            <button type="button" onClick={onFallback} className="bg-primary text-primary-foreground py-3 px-6 rounded-2xl font-bold">
              Try email & password
            </button>
          </>)}

        {(state === 'scanning' || state === 'success') && (<button type="button" onClick={onFallback} className="mt-10 text-foreground/40 text-xs hover:text-foreground/70 underline-offset-4 hover:underline">
            Use email & password instead
          </button>)}
      </div>
    </div>);
}

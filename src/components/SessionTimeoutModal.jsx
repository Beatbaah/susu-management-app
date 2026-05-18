import { Clock, LogOut } from 'lucide-react';

export function SessionTimeoutModal({ remainingSeconds, onExtend, onLogout }) {
    const minutes = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const display = minutes > 0
        ? `${minutes}:${String(secs).padStart(2, '0')}`
        : `${String(secs).padStart(2, '0')}s`;

    const urgent = remainingSeconds <= 30;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border w-full max-w-sm p-8 shadow-xl text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${urgent ? 'bg-destructive/15' : 'bg-warning/15'}`}>
              <Clock className={`w-8 h-8 ${urgent ? 'text-destructive' : 'text-warning'}`}/>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Session Expiring</h3>
            <p className="text-sm text-muted-foreground mb-6">
              You have been inactive. Your session will end in
            </p>
            <div className={`text-5xl font-bold mb-8 tabular-nums transition-colors ${urgent ? 'text-destructive' : 'text-warning'}`}>
              {display}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4"/>
                Log out
              </button>
              <button
                type="button"
                onClick={onExtend}
                className="flex-[1.5] py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                Stay logged in
              </button>
            </div>
          </div>
        </div>
    );
}

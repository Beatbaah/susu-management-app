import React from 'react';
export class AppErrorBoundary extends React.Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error) {
        console.error('Excellent Susu render error:', error);
    }
    render() {
        if (!this.state.error)
            return this.props.children;
        return (<div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <div className="auth-logo-icon !mx-0 !mb-5">
            <img src="/logo512.png" alt="" className="h-10 w-10 object-contain brightness-0"/>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Excellent Susu could not load</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            A runtime error stopped the screen from rendering. Refresh once; if it remains, the message below gives us the exact failure.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-border bg-accent p-3 text-xs text-destructive">
            {this.state.error.message}
          </pre>
        </div>
      </div>);
    }
}

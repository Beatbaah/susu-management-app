import React from 'react';
import { ShieldAlert } from 'lucide-react';

export function SignOutConfirmModal({ open, onCancel, onConfirm }) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCancel}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-6 h-6 text-destructive" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground text-center mb-1">Are you sure you want to sign out?</h3>
                    <p className="text-sm text-muted-foreground text-center">
                        You'll need to sign in again to access your account.
                    </p>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl border border-border bg-card text-foreground text-sm font-semibold hover:bg-muted/50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 py-3 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors active:scale-[0.98]"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive, onConfirm, onCancel, }) {
    const dialogRef = useRef(null);
    const cancelBtnRef = useRef(null);
    /* Focus the cancel button when the dialog opens */
    useEffect(() => {
        if (open)
            cancelBtnRef.current?.focus();
    }, [open]);
    /* Close on Escape */
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onCancel();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onCancel]);
    /* Trap focus inside the dialog */
    useEffect(() => {
        if (!open || !dialogRef.current)
            return;
        const focusable = dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const onTab = (e) => {
            if (e.key !== 'Tab')
                return;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            }
            else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', onTab);
        return () => document.removeEventListener('keydown', onTab);
    }, [open]);
    if (!open)
        return null;
    return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" aria-hidden="true" onClick={onCancel}>
      {/* Dialog panel */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby={description ? 'confirm-modal-desc' : undefined} className="bg-card rounded-2xl border border-border w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 id="confirm-modal-title" className="text-lg font-bold text-foreground">{title}</h3>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {description && (<div id="confirm-modal-desc" className="text-muted-foreground text-sm mb-6">
            {description}
          </div>)}

        <div className="flex gap-2">
          <button ref={cancelBtnRef} type="button" onClick={onCancel} className="flex-1 h-11 bg-card border border-border rounded-xl text-foreground font-medium hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={`flex-1 h-11 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card ${destructive
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/60'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/60'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>);
}

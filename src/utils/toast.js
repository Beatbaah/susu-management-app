import { toast } from 'sonner';
/**
 * Toast-based confirmation. Returns a promise that resolves to true if the
 * user clicks the confirm action, false on dismiss/cancel.
 *
 * Replaces `window.confirm()` with a non-blocking sonner toast that has
 * both a destructive confirm action and a cancel action.
 */
export function confirmToast(opts) {
    return new Promise(resolve => {
        let resolved = false;
        const id = toast(opts.title, {
            description: opts.description,
            duration: 10_000,
            action: {
                label: opts.confirmLabel ?? 'Confirm',
                onClick: () => {
                    if (resolved)
                        return;
                    resolved = true;
                    resolve(true);
                    toast.dismiss(id);
                },
            },
            cancel: {
                label: opts.cancelLabel ?? 'Cancel',
                onClick: () => {
                    if (resolved)
                        return;
                    resolved = true;
                    resolve(false);
                },
            },
            onDismiss: () => {
                if (resolved)
                    return;
                resolved = true;
                resolve(false);
            },
            onAutoClose: () => {
                if (resolved)
                    return;
                resolved = true;
                resolve(false);
            },
            className: opts.destructive ? 'sonner-toast-destructive' : undefined,
        });
    });
}
export { toast };

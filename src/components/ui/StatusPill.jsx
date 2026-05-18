/**
 * StatusPill — canonical status badge used everywhere in the app.
 *
 * Replaces the ≥ 6 hand-rolled inline pills that previously lived in
 * MemberCard, PaymentCard, MemberPortal, MobileDashboard, etc.
 *
 * Usage:
 *   <StatusPill tone="success" label="Active" />
 *   <StatusPill tone="pending" label="Pending" icon={<Clock />} />
 */
import { cn } from './utils';
const TONE_CLASSES = {
    success: 'bg-success/15 text-success',
    pending: 'bg-primary/15 text-primary',
    failed: 'bg-destructive/15 text-destructive',
    info: 'bg-primary/10 text-primary',
    warning: 'bg-warning/15 text-warning',
    neutral: 'bg-border text-foreground/50',
};
export function StatusPill({ tone = 'neutral', label, icon, className }) {
    return (<span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full', 'text-xs font-bold uppercase tracking-wide', TONE_CLASSES[tone], className)}>
      {icon && <span className="w-3 h-3 flex-shrink-0">{icon}</span>}
      {label}
    </span>);
}
/** Convenience mapping from common status strings to a tone. */
export function statusToTone(status) {
    switch (status.toLowerCase()) {
        case 'active':
        case 'paid':
        case 'completed':
            return 'success';
        case 'pending':
        case 'processing':
            return 'pending';
        case 'overdue':
        case 'rejected':
        case 'failed':
        case 'defaulter':
        case 'suspended':
            return 'failed';
        case 'warning':
            return 'warning';
        default:
            return 'neutral';
    }
}

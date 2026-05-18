import { CheckCircle, Clock, XCircle, Pencil, Receipt, Calendar, CreditCard, Hash } from 'lucide-react';
import { fmt } from '../../utils/helpers';
import { cn } from '../ui/utils';
export function PaymentCard({ memberName, groupName, amount, status, daysOverdue = 0, dueDate, paymentDate, method, reference, footer, onEdit, }) {
    const isPaid = status === 'paid';
    const isPending = status === 'pending';
    const isOverdue = status === 'overdue' || status === 'rejected';
    const settledDate = paymentDate ? new Date(paymentDate) : null;
    const settledLabel = settledDate && !Number.isNaN(settledDate.getTime())
        ? settledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '—';
    return (<div className="glass-card card-hover group p-4 sm:p-5 rounded-xl border border-border transition-all duration-200 relative overflow-hidden">
      {/* Background Accent */}
      <div className={cn("absolute -right-8 -top-8 w-32 h-32 blur-3xl opacity-5 transition-opacity rounded-full pointer-events-none", isPaid ? "bg-success" : isPending ? "bg-primary" : "bg-destructive")}/>

      <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
        <div className="flex gap-3 min-w-0">
          <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shadow-inner transition-transform group-hover:scale-105", isPaid ? "bg-success/15 text-success" :
            isPending ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>
            <Receipt className="w-5 h-5"/>
          </div>
          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">{memberName}</h4>
            <p className="eyebrow text-muted-foreground/50 mt-1">{groupName}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn("px-2.5 py-1 rounded-lg eyebrow flex items-center gap-1.5", isPaid ? "bg-success/15 text-success" :
            isPending ? "bg-primary/15 text-primary" :
                "bg-destructive/15 text-destructive")}>
                {isPaid ? <CheckCircle className="w-3 h-3"/> : isPending ? <Clock className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                {status === 'overdue' && daysOverdue > 0 ? `${daysOverdue} Days Late` : status}
              </div>
            </div>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-lg sm:text-xl font-semibold text-foreground stat-value leading-none">{fmt(amount)}</p>
          {onEdit && (<button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="mt-2 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-foreground/50 hover:bg-primary hover:text-primary-foreground transition-all" aria-label="Edit record">
              <Pencil className="w-4 h-4"/>
            </button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 pt-4 border-t border-border relative z-10">
        <div className="space-y-1">
          <p className="eyebrow text-muted-foreground/50 flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-primary/50"/>
            Timeline
          </p>
          <p className="text-xs font-semibold text-foreground/80">
            {isPaid ? `Settled ${settledLabel}` : `Due ${dueDate || '—'}`}
          </p>
        </div>

        {method && (<div className="space-y-1">
            <p className="eyebrow text-muted-foreground/50 flex items-center gap-1.5">
              <CreditCard className="w-3 h-3 text-success/50"/>
              Source
            </p>
            <p className="text-xs font-semibold text-foreground/80 capitalize">{method.replace('_', ' ')}</p>
          </div>)}

        {reference && (<div className="col-span-2 space-y-1">
            <p className="eyebrow text-muted-foreground/50 flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-warning/50"/>
              Reference Key
            </p>
            <p className="text-xs font-bold text-primary/70 truncate tracking-tight">{reference}</p>
          </div>)}
      </div>

      {footer && <div className="mt-4 pt-4 border-t border-border relative z-10">{footer}</div>}
    </div>);
}

import { Phone, ChevronRight, UserCheck, UserX, CreditCard, MapPin, ShieldCheck, Zap } from 'lucide-react';
import { fmt } from '../../utils/helpers';
import { cn } from '../ui/utils';
export function MemberCard({ name, groupName, displayStatus, phone, email, ghanaCard, address, bankMomo, liveSelfie, paymentCount, contributionAmount = 0, footer, onClick, }) {
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const isActive = displayStatus === 'active';
    const isPending = displayStatus === 'pending';
    const isDefaulter = displayStatus === 'defaulter';
    return (<div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
    } } : undefined} className={cn("glass-card card-hover group p-4 sm:p-5 rounded-xl transition-all duration-200 relative overflow-hidden", onClick ? 'cursor-pointer' : '')}>
      <div className="flex items-start gap-3 sm:gap-4 mb-4">
        <div className="relative">
          <div className={cn("w-11 h-11 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center font-semibold text-sm shadow-inner transition-transform group-hover:scale-105", isActive ? "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-primary/20" :
            isPending ? "bg-border text-foreground/40 border border-border" :
                "bg-destructive/10 text-destructive border border-destructive/20")}>
            {initials}
          </div>
          {isActive && (<div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success rounded-md border-2 border-background flex items-center justify-center text-success-foreground shadow-lg">
              <ShieldCheck className="w-3 h-3"/>
            </div>)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h4 className="text-sm sm:text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">{name}</h4>
              <p className="eyebrow text-muted-foreground/50 mt-1">{groupName || 'No Group assigned'}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-foreground/30 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <ChevronRight className="w-4 h-4"/>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className={cn("px-2.5 py-1 rounded-lg eyebrow flex items-center gap-1.5", isActive ? "bg-success/15 text-success" :
            isPending ? "bg-primary/15 text-primary" :
                "bg-destructive/15 text-destructive")}>
              {isActive ? <UserCheck className="w-3 h-3"/> : <UserX className="w-3 h-3"/>}
              {displayStatus}
            </div>
            {paymentCount != null && (<div className="px-2.5 py-1 rounded-lg bg-accent text-foreground/50 eyebrow">
                {paymentCount} Cycles
              </div>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-border">
        <div className="space-y-1">
          <p className="eyebrow text-muted-foreground/50 flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-primary/50"/>
            Contact
          </p>
          <p className="text-[13px] sm:text-sm font-medium text-foreground/80">{phone || '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="eyebrow text-muted-foreground/50 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-warning/50"/>
            Contribution
          </p>
          <p className="text-[13px] sm:text-sm font-semibold text-primary">{fmt(contributionAmount)}</p>
        </div>

        {address && (<div className="col-span-2 space-y-1">
            <p className="eyebrow text-muted-foreground/50 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-destructive/50"/>
              Primary Address
            </p>
            <p className="text-[13px] sm:text-sm font-medium text-foreground/60 truncate">{address}</p>
          </div>)}

        {bankMomo && (<div className="col-span-2 space-y-1">
            <p className="eyebrow text-muted-foreground/50 flex items-center gap-1.5">
              <CreditCard className="w-3 h-3 text-success/50"/>
              Payout Method
            </p>
            <p className="text-[13px] sm:text-sm font-medium text-foreground/80">{bankMomo}</p>
          </div>)}

        {liveSelfie && (<div className="col-span-2 mt-2">
            <div className="relative group/img overflow-hidden rounded-xl border border-border">
              <img src={liveSelfie} alt={name} className="w-full h-32 object-cover grayscale opacity-50 group-hover/img:grayscale-0 group-hover/img:opacity-100 transition-all duration-500"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"/>
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success pulse-dot"/>
                <span className="eyebrow text-primary-foreground">Liveness Confirmed</span>
              </div>
            </div>
          </div>)}
      </div>

      {footer && (<div className="mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
          {footer}
        </div>)}
    </div>);
}

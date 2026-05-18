import { Users, TrendingUp, Calendar, ChevronRight, Layers, Pencil, Target } from 'lucide-react';
import { fmt } from '../../utils/helpers';
export function GroupCard({ groupName, memberCount, currentRound, totalSlots, contributionAmount, frequency, poolSize, nextPayoutLabel, color, onEdit, totalRounds, cashoutAmount, }) {
    const resolvedCashoutAmount = cashoutAmount ?? (contributionAmount * (totalRounds || totalSlots || 1));
    const completionRate = totalSlots > 0 ? Math.min((currentRound / totalSlots) * 100, 100) : 0;
    const accent = color || '#6491DE';
    return (<div className="bg-card card-hover group p-4 sm:p-5 rounded-xl border border-border transition-all duration-200 relative overflow-hidden" style={{ borderLeftColor: accent, borderLeftWidth: '3px' }}>
      {/* Subtle color hint on hover */}
      <div className="absolute -right-12 -top-12 w-40 h-40 blur-3xl opacity-0 group-hover:opacity-60 transition-opacity rounded-full pointer-events-none" style={{ background: `${accent}30` }}/>

      <div className="flex items-start gap-3 sm:gap-4 mb-4 relative z-10">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
          <Users className="w-5 h-5 text-white"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold truncate mb-1" style={{ color: accent }}>
                {groupName}
              </h3>
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-md eyebrow flex items-center gap-1 bg-card border border-border text-muted-foreground">
                  <TrendingUp className="w-3 h-3"/>
                  <span>{completionRate.toFixed(0)}% Maturity</span>
                </div>
              </div>
            </div>
            {onEdit ? (<button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Edit group">
                <Pencil className="w-4 h-4"/>
              </button>) : (<div className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground">
                <ChevronRight className="w-4 h-4"/>
              </div>)}
          </div>
        </div>
      </div>

      <div className="mb-4 relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="eyebrow text-muted-foreground">Cycle Progress</span>
          <span className="eyebrow text-muted-foreground">Round {currentRound} of {totalSlots}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full progress-smooth" style={{ width: `${completionRate}%`, background: accent }}/>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4 relative z-10">
        <div className="space-y-1">
          <p className="eyebrow text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3"/>
            Members
          </p>
          <p className="app-row-title text-foreground">{memberCount} seats</p>
        </div>
        <div className="space-y-1">
          <p className="eyebrow text-muted-foreground flex items-center gap-1">
            <span className="app-badge">₵</span>
            Ticket
          </p>
          <p className="app-row-title text-foreground">{fmt(contributionAmount)}</p>
        </div>
        <div className="space-y-1">
          <p className="eyebrow text-muted-foreground flex items-center gap-1">
            <Layers className="w-3 h-3"/>
            Slots
          </p>
          <p className="app-row-title text-foreground">{totalSlots} slots</p>
        </div>
      </div>

      <div className="pt-3 border-t border-border grid grid-cols-3 gap-3 relative z-10">
        <div>
          <p className="eyebrow text-muted-foreground mb-1">Pool / Round</p>
          <div className="flex items-center gap-1">
            <Target className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground"/>
            <p className="text-sm font-bold stat-value text-foreground">{fmt(poolSize)}</p>
          </div>
        </div>
        <div>
          <p className="eyebrow text-muted-foreground mb-1">Cashout</p>
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold flex-shrink-0" style={{ color: accent }}>₵</span>
            <p className="text-sm font-bold stat-value" style={{ color: accent }}>{fmt(resolvedCashoutAmount)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="eyebrow text-muted-foreground mb-1">Next Payout</p>
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border">
            <Calendar className="w-3 h-3 text-muted-foreground"/>
            <span className="eyebrow text-foreground">{nextPayoutLabel}</span>
          </div>
        </div>
      </div>
    </div>);
}

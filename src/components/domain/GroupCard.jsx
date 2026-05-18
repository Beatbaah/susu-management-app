import { Users, DollarSign, TrendingUp, Calendar, ChevronRight, Clock, Pencil, Target } from 'lucide-react';
import { fmt } from '../../utils/helpers';
export function GroupCard({ groupName, memberCount, currentRound, totalSlots, contributionAmount, frequency, poolSize, nextPayoutLabel, color, onEdit, }) {
    const completionRate = totalSlots > 0 ? Math.min((currentRound / totalSlots) * 100, 100) : 0;
    const accent = color || '#0F6B4F';
    return (<div className="glass-card card-hover group p-4 sm:p-5 rounded-xl transition-all duration-200 relative overflow-hidden" style={{
            background: `linear-gradient(145deg, ${accent}15, ${accent}05)`,
            border: `1px solid ${accent}30`
        }}>
      {/* Glow Accent */}
      <div className="absolute -right-12 -top-12 w-40 h-40 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full pointer-events-none" style={{ background: `${accent}40` }}/>

      <div className="flex items-start gap-3 sm:gap-4 mb-4 relative z-10">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md transition-transform group-hover:scale-105" style={{ background: `linear-gradient(to bottom right, ${accent}, ${accent}99)`, boxShadow: `0 10px 15px -3px ${accent}40` }}>
          <Users className="w-5 h-5 text-white"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-foreground truncate mb-1 transition-colors" style={{ color: accent }}>
                {groupName}
              </h3>
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-0.5 rounded-lg eyebrow flex items-center gap-1" style={{ background: `${accent}20`, color: accent }}>
                  <TrendingUp className="w-3 h-3"/>
                  <span>{completionRate.toFixed(0)}% Maturity</span>
                </div>
              </div>
            </div>
            {onEdit ? (<button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ background: `${accent}20`, color: accent }} aria-label="Edit group">
                <Pencil className="w-4 h-4"/>
              </button>) : (<div className="w-8 h-8 rounded-full flex items-center justify-center transition-all" style={{ background: `${accent}20`, color: accent }}>
                <ChevronRight className="w-4 h-4"/>
              </div>)}
          </div>
        </div>
      </div>

      <div className="mb-5 relative z-10">
        <div className="flex items-center justify-between eyebrow mb-2">
          <span style={{ color: `${accent}90` }}>Cycle Progress</span>
          <span className="text-foreground/60">Round {currentRound} of {totalSlots}</span>
        </div>
        <div className="w-full h-2.5 rounded-full overflow-hidden p-0.5" style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}>
          <div className="h-full rounded-full progress-smooth shadow-lg" style={{ width: `${completionRate}%`, background: accent, boxShadow: `0 0 10px ${accent}80` }}/>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5 relative z-10">
        <div className="space-y-1">
          <p className="eyebrow flex items-center gap-1.5" style={{ color: `${accent}80` }}>
            <Users className="w-3 h-3"/>
            Size
          </p>
          <p className="text-[13px] sm:text-sm font-semibold text-foreground/80">{memberCount} Seats</p>
        </div>
        <div className="space-y-1">
          <p className="eyebrow flex items-center gap-1.5" style={{ color: `${accent}80` }}>
            <DollarSign className="w-3 h-3"/>
            Ticket
          </p>
          <p className="text-[13px] sm:text-sm font-semibold" style={{ color: accent }}>{fmt(contributionAmount)}</p>
        </div>
        <div className="space-y-1">
          <p className="eyebrow flex items-center gap-1.5" style={{ color: `${accent}80` }}>
            <Clock className="w-3 h-3"/>
            Tempo
          </p>
          <p className="text-[13px] sm:text-sm font-semibold text-foreground/80 capitalize">{frequency || 'Weekly'}</p>
        </div>
      </div>

      <div className="pt-4 border-t flex items-center justify-between gap-3 relative z-10" style={{ borderColor: `${accent}30` }}>
        <div>
          <p className="eyebrow mb-1.5" style={{ color: `${accent}80` }}>Cycle Pool</p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}20`, color: accent }}>
              <Target className="w-4 h-4"/>
            </div>
            <p className="text-base sm:text-lg font-semibold stat-value" style={{ color: accent }}>{fmt(poolSize)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="eyebrow mb-1.5" style={{ color: `${accent}80` }}>Next Reward</p>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border" style={{ background: `${accent}15`, borderColor: `${accent}30` }}>
            <Calendar className="w-3.5 h-3.5" style={{ color: accent }}/>
            <span className="eyebrow" style={{ color: accent }}>{nextPayoutLabel}</span>
          </div>
        </div>
      </div>
    </div>);
}

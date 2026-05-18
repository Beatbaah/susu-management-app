import { Calendar, CheckCircle, Clock, User, DollarSign, ChevronRight, Trophy } from 'lucide-react';
import { fmt } from '../../utils/helpers';
export function PayoutCard({ memberName, groupName, payoutAmount, scheduledDate, paidAt, status, round, totalRounds, footer, }) {
    const isCompleted = status === 'completed' || status === 'paid';
    const progress = totalRounds > 0 ? Math.min((round / totalRounds) * 100, 100) : 0;
    return (<div className="bg-card rounded-2xl p-5 border border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isCompleted ? 'bg-success/20' : 'bg-primary/20'}`}>
            {isCompleted ? (<CheckCircle className="w-6 h-6 text-success"/>) : (<User className="w-6 h-6 text-primary"/>)}
          </div>
          <div className="flex-1">
            <h4 className="mb-1">{memberName}</h4>
            <p className="text-muted-foreground text-sm mb-2">{groupName}</p>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-muted-foreground"/>
              <span className="text-muted-foreground text-sm">Round {round} of {totalRounds}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground"/>
      </div>

      {totalRounds > 0 && (<div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Round {round}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isCompleted ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress}%` }}/>
          </div>
        </div>)}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3"/>
            Payout Amount
          </p>
          <p className="text-foreground text-lg">{fmt(payoutAmount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3"/>
            {isCompleted ? 'Paid On' : 'Scheduled'}
          </p>
          <p className="text-foreground text-sm">
            {isCompleted
            ? paidAt ? new Date(paidAt).toLocaleDateString() : 'N/A'
            : scheduledDate || '—'}
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        {isCompleted ? (<div className="flex items-center gap-2 text-success">
            <CheckCircle className="w-5 h-5"/>
            <span className="text-sm">Payout Completed</span>
          </div>) : (<div className="flex items-center gap-2 text-primary">
            <Clock className="w-5 h-5"/>
            <span className="text-sm">Scheduled for {scheduledDate || '—'}</span>
          </div>)}
      </div>

      {footer && <div className="mt-4 pt-4 border-t border-border">{footer}</div>}
    </div>);
}

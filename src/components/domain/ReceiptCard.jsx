import { CheckCircle, Calendar, User, ChevronRight } from 'lucide-react';
import { fmt } from '../../utils/helpers';
export function ReceiptCard({ receiptNumber, member, group, amount, paymentDate, method, confirmedBy, footer, }) {
    return (<div className="bg-card rounded-2xl p-5 border border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-12 h-12 bg-success/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-success"/>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="truncate mb-1">{receiptNumber}</h4>
            <p className="text-muted-foreground text-sm mb-1">{member}</p>
            <p className="text-muted-foreground text-xs">{group}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-foreground text-lg mb-1">{fmt(amount)}</p>
          <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto"/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-border">
        <div>
          <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3"/>
            Payment Date
          </p>
          <p className="text-foreground text-sm">{paymentDate || '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Method</p>
          <p className="text-foreground text-sm">{method}</p>
        </div>
        <div className="col-span-2">
          <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
            <User className="w-3 h-3"/>
            Confirmed By
          </p>
          <p className="text-foreground text-sm">{confirmedBy}</p>
        </div>
      </div>

      {footer}
    </div>);
}

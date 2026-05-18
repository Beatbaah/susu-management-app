import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from './utils';
const TONE_STYLE = {
    info: { container: 'bg-primary/10 border-primary/30 text-primary', icon: Info, iconClass: 'text-primary' },
    success: { container: 'bg-success/10 border-success/30 text-success', icon: CheckCircle2, iconClass: 'text-success' },
    warning: { container: 'bg-warning/10 border-warning/30 text-warning', icon: AlertCircle, iconClass: 'text-warning' },
    danger: { container: 'bg-destructive/10 border-destructive/30 text-destructive', icon: ShieldAlert, iconClass: 'text-destructive' },
};
export function AlertCard({ tone = 'info', title, description, action, className }) {
    const style = TONE_STYLE[tone];
    const Icon = style.icon;
    return (<div className={cn('border rounded-2xl p-4 flex items-start gap-3', style.container, className)}>
      <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', style.iconClass)}/>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold mb-1">{title}</p>
        {description && <p className="text-xs opacity-80">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>);
}

import { Shield, Wallet, User, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
const SEVERITY_COLORS = {
    critical: 'bg-destructive/20 text-destructive border-destructive/50',
    warning: 'bg-primary/20 text-primary border-primary/50',
    info: 'bg-success/20 text-success border-success/50',
};
function pickIcon(category) {
    switch (category) {
        case 'payment':
        case 'payout':
            return Wallet;
        case 'user':
        case 'group':
            return User;
        case 'security':
            return Shield;
        case 'system':
        case 'reminder':
            return SettingsIcon;
        default:
            return AlertCircle;
    }
}
export function AuditLogItem({ category, severity, actionLabel, details, actorName, actorRole, timestampLabel, }) {
    const Icon = pickIcon(category);
    return (<div className={`rounded-2xl p-4 border ${SEVERITY_COLORS[severity]}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 rounded-xl ${severity === 'critical' ? 'bg-destructive/30'
            : severity === 'warning' ? 'bg-primary/30'
                : 'bg-success/30'}`}>
          <Icon className="w-5 h-5"/>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="mb-1 truncate">{actionLabel}</h4>
          <p className="text-sm opacity-80 mb-2 break-words">{details}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-background/50 rounded">{actorName}</span>
            <span className="px-2 py-1 bg-background/50 rounded">{actorRole}</span>
            <span className="px-2 py-1 bg-background/50 rounded">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
          </div>
        </div>
      </div>
      <p className="text-xs opacity-60">{timestampLabel}</p>
    </div>);
}

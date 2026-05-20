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
export function AuditLogItem({ category, severity, actionLabel, details, actorName, actorRole, timestampLabel }) {
    const Icon = pickIcon(category);
    return (
        <div className={`rounded-2xl p-3.5 border ${SEVERITY_COLORS[severity]}`}>
            <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-xl flex-shrink-0 mt-0.5 ${severity === 'critical' ? 'bg-destructive/30' : severity === 'warning' ? 'bg-primary/30' : 'bg-success/30'}`}>
                    <Icon className="w-4 h-4"/>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h4 className="truncate text-sm font-semibold leading-snug">{actionLabel}</h4>
                        <span className="text-xs opacity-50 flex-shrink-0 whitespace-nowrap leading-snug pt-px">{timestampLabel}</span>
                    </div>
                    <p className="text-xs opacity-75 mb-2 break-words">{details}</p>
                    <div className="flex items-center gap-1.5 text-xs overflow-hidden">
                        <span className="px-1.5 py-0.5 bg-background/50 rounded truncate max-w-[130px] flex-shrink">{actorName}</span>
                        {actorRole && <span className="px-1.5 py-0.5 bg-background/50 rounded flex-shrink-0">{actorRole}</span>}
                        <span className="px-1.5 py-0.5 bg-background/50 rounded flex-shrink-0">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

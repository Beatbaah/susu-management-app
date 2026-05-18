import { cn } from './utils';

const accentColor = (iconColor = '') => {
    if (iconColor.includes('destructive')) return 'border-l-destructive';
    if (iconColor.includes('success'))     return 'border-l-success';
    if (iconColor.includes('warning'))     return 'border-l-warning';
    return 'border-l-primary';
};

export function StatCard({ title, value, icon: Icon, iconColor, trend, subtitle, className }) {
    return (
        <div className={cn(
            'bg-card rounded-xl border border-border border-l-[3px] p-4',
            'hover:-translate-y-px hover:shadow-md transition-all duration-200',
            accentColor(iconColor),
            className,
        )}>
            <div className="flex items-start justify-between mb-3">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', iconColor)}>
                    <Icon className="w-4 h-4" />
                </div>
                {trend && (
                    <span className={cn(
                        'app-badge px-1.5 py-0.5 rounded-md',
                        trend.isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
                    )}>
                        {trend.isPositive ? '↑' : '↓'} {trend.value}
                    </span>
                )}
            </div>

            <p className="app-caption uppercase text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
        </div>
    );
}

import { cn } from './utils';
export function StatCard({ title, value, icon: Icon, iconColor, trend, subtitle, className }) {
    return (<div className={cn("elevation-2 group p-4 rounded-xl transition-colors duration-150", className)}>
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconColor)}>
            <Icon className="w-4 h-4"/>
          </div>
          {trend && (<div className={cn("px-1.5 py-0.5 rounded-md text-xs font-medium flex items-center gap-0.5", trend.isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>)}
        </div>

        <div>
          <p className="eyebrow text-muted-foreground/50 mb-1">{title}</p>
          <p className="text-xl font-semibold text-foreground tracking-tight stat-value leading-none">
            {value}
          </p>
          {subtitle && (<p className="text-xs text-muted-foreground/40 font-normal mt-1.5">
              {subtitle}
            </p>)}
        </div>
      </div>
    </div>);
}

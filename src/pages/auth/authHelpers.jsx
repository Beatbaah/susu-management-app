import { cn } from '../../components/ui/utils';

export const inputCls = (withIcon = true) =>
    cn(
        'h-14 bg-card border-2 border-border/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/[0.12] transition-all rounded-2xl text-foreground placeholder:text-foreground/30 outline-none w-full shadow-[inset_0_1px_3px_rgba(7,61,127,0.06)]',
        withIcon ? 'pl-12' : 'pl-4',
    );

export function FieldWrapper({ label, icon: Icon, children }) {
    return (
        <div className="space-y-1.5">
            <p className="eyebrow text-muted-foreground ml-1">{label}</p>
            <div className="relative group">
                {Icon && (
                    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 group-focus-within:text-primary transition-colors pointer-events-none"/>
                )}
                {children}
            </div>
        </div>
    );
}

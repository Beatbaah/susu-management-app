/**
 * SectionHeader — eyebrow + title + optional action slot.
 *
 * Replaces the 5+ hand-rolled section headings scattered across pages
 * (each with different eyebrow trackings, font weights, and sizes).
 *
 * Usage:
 *   <SectionHeader eyebrow="Overview" title="Dashboard" />
 *   <SectionHeader title="Members" action={<Button size="sm">Add</Button>} />
 */
import { cn } from './utils';
export function SectionHeader({ eyebrow, title, description, action, className, titleClassName, }) {
    return (<div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (<p className="eyebrow text-muted-foreground/60 mb-1">{eyebrow}</p>)}
        <h2 className={cn('page-title text-foreground', titleClassName)}>{title}</h2>
        {description && (<p className="text-sm text-muted-foreground mt-1">{description}</p>)}
      </div>
      {action && (<div className="flex-shrink-0 flex items-center gap-2">{action}</div>)}
    </div>);
}

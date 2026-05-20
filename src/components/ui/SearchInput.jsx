/**
 * SearchInput — canonical search field.
 *
 * Replaces the 3 separate implementations in Header, MobileGroups,
 * and MobilePayments (each with different paddings and focus rings).
 *
 * Usage:
 *   <SearchInput value={q} onChange={setQ} placeholder="Search members…" />
 */
import { Search, X } from 'lucide-react';
import { cn } from './utils';
export function SearchInput({ value, onChange, placeholder = 'Search…', id, label, className, size = 'md', }) {
    const inputId = id ?? 'search-input';
    return (<div className={cn('relative group', className)}>
      <label htmlFor={inputId} className="sr-only">
        {label ?? placeholder}
      </label>

      <Search aria-hidden="true" className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors pointer-events-none', size === 'sm' ? 'left-3 w-3.5 h-3.5' : 'left-3.5 w-4 h-4')}/>

      <input id={inputId} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn('w-full rounded-xl bg-accent/50 border border-border', 'text-sm text-foreground placeholder:text-muted-foreground/50', 'focus:bg-accent focus:border-primary focus:ring-2 focus:ring-primary/10 focus:ring-4 focus:ring-primary/8', 'outline-none transition-all duration-200', size === 'sm'
            ? 'h-8 pl-9 pr-8 text-xs'
            : 'h-10 pl-10 pr-10')}/>

      {value && (<button type="button" onClick={() => onChange('')} aria-label="Clear search" className={cn('absolute top-1/2 -translate-y-1/2 right-2.5', 'text-muted-foreground/50 hover:text-foreground transition-colors', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded')}>
          <X className="w-3.5 h-3.5"/>
        </button>)}
    </div>);
}

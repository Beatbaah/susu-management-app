export function LoadingState() {
    return (<div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>);
}
export function SkeletonCard() {
    return (<div className="bg-card rounded-2xl p-5 border border-border animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 bg-muted rounded-2xl"></div>
        <div className="flex-1">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </div>
      </div>
      <div className="h-3 bg-muted rounded w-full mb-2"></div>
      <div className="h-3 bg-muted rounded w-2/3"></div>
    </div>);
}
/** Vertical list of SkeletonCards. Use while a list page is hydrating. */
export function SkeletonList({ count = 4 }) {
    return (<div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (<SkeletonCard key={i}/>))}
    </div>);
}
/** Grid of stat-tile placeholders matching the dashboard / stats rows. */
export function SkeletonStatGrid({ cols = 2 }) {
    const colClass = cols === 4 ? 'grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2';
    return (<div className={`grid ${colClass} gap-3`}>
      {Array.from({ length: cols * 2 }).map((_, i) => (<div key={i} className="bg-card rounded-2xl p-4 border border-border animate-pulse space-y-2">
          <div className="h-3 bg-muted rounded w-1/2"></div>
          <div className="h-6 bg-muted rounded w-3/4"></div>
        </div>))}
    </div>);
}

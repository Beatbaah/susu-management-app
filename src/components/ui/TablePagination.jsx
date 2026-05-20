import { ChevronLeft, ChevronRight } from 'lucide-react';

export function TablePagination({ total, page, perPage, onChange }) {
    const pages = Math.ceil(total / perPage);
    if (pages <= 1) return null;
    const from = Math.min((page - 1) * perPage + 1, total);
    const to = Math.min(page * perPage, total);
    return (
        <div className="px-4 py-2 border-t border-border bg-muted/10 flex items-center justify-between">
            <p className="text-xs text-muted-foreground tabular-nums">{from}–{to} of {total}</p>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onChange(page - 1)}
                    disabled={page === 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-3.5 h-3.5"/>
                </button>
                <span className="text-xs font-bold text-foreground px-2 tabular-nums">{page} / {pages}</span>
                <button
                    type="button"
                    onClick={() => onChange(page + 1)}
                    disabled={page === pages}
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="w-3.5 h-3.5"/>
                </button>
            </div>
        </div>
    );
}

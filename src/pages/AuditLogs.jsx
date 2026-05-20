import { Search, AlertCircle, History, Download, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { TablePagination } from '../components/ui/TablePagination';
import { useAppContext } from '../context/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditLogItem } from '../components/domain';

const PAYMENT_ACTIONS = new Set(['record payment', 'confirm payment', 'reject payment']);
const PAYOUT_ACTIONS  = new Set(['complete payout']);
const USER_ACTIONS    = new Set(['request access', 'approve registration', 'reject registration', 'logout', 'login']);
const SECURITY_ACTIONS = new Set(['clear audit logs', 'failed login']);
const GROUP_ACTIONS   = new Set(['create group']);
const REMINDER_ACTIONS = new Set(['send reminder']);

function categorize(action) {
    const a = (action || '').toLowerCase();
    if (PAYMENT_ACTIONS.has(a))  return { category: 'payment',  severity: a === 'reject payment' ? 'warning' : 'info' };
    if (PAYOUT_ACTIONS.has(a))   return { category: 'payout',   severity: 'info' };
    if (USER_ACTIONS.has(a))     return { category: 'user',     severity: a === 'reject registration' ? 'warning' : 'info' };
    if (SECURITY_ACTIONS.has(a)) return { category: 'security', severity: 'critical' };
    if (GROUP_ACTIONS.has(a))    return { category: 'group',    severity: 'info' };
    if (REMINDER_ACTIONS.has(a)) return { category: 'reminder', severity: 'info' };
    return { category: 'system', severity: 'info' };
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const formatAction = action => action.split(' ').map(w => cap(w)).join(' ');

const SEVERITY_OPTS = ['all', 'critical', 'warning', 'info'];
const CATEGORY_OPTS = ['all', 'payment', 'payout', 'user', 'security', 'group', 'reminder'];
const DATE_OPTS = [
    { label: 'All time', val: null },
    { label: 'Last 7d',  val: 7 },
    { label: 'Last 30d', val: 30 },
    { label: 'Last 90d', val: 90 },
];

function FilterPill({ active, onClick, children }) {
    return (
        <button type="button" onClick={onClick}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors border ${
                active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted/70'
            }`}>
            {children}
        </button>
    );
}

function FilterSheet({ open, onClose, severity, category, days, onApply }) {
    const [tmpSev, setTmpSev]   = useState(severity);
    const [tmpCat, setTmpCat]   = useState(category);
    const [tmpDays, setTmpDays] = useState(days);

    useEffect(() => {
        if (open) { setTmpSev(severity); setTmpCat(category); setTmpDays(days); }
    }, [open, severity, category, days]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card rounded-t-[2rem] border-t border-x border-border w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={e => e.stopPropagation()}>
                <div className="w-9 h-[3px] rounded-full bg-border mx-auto mt-3 mb-1"/>
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                    <h3 className="text-base font-bold">Filter logs</h3>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
                        <X className="w-5 h-5 text-muted-foreground"/>
                    </button>
                </div>

                <div className="px-5 pt-4 pb-2 space-y-5">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Severity</p>
                        <div className="flex flex-wrap gap-2">
                            {SEVERITY_OPTS.map(s => (
                                <FilterPill key={s} active={tmpSev === s} onClick={() => setTmpSev(s)}>{cap(s)}</FilterPill>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Category</p>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORY_OPTS.map(c => (
                                <FilterPill key={c} active={tmpCat === c} onClick={() => setTmpCat(c)}>{cap(c)}</FilterPill>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Date range</p>
                        <div className="flex flex-wrap gap-2">
                            {DATE_OPTS.map(({ label, val }) => (
                                <FilterPill key={label} active={tmpDays === val} onClick={() => setTmpDays(val)}>{label}</FilterPill>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                    <button type="button" onClick={() => { setTmpSev('all'); setTmpCat('all'); setTmpDays(null); }}
                        className="flex-1 py-3 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">
                        Clear all
                    </button>
                    <button type="button" onClick={() => onApply(tmpSev, tmpCat, tmpDays)}
                        className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

export function AuditLogs() {
    const { auditLogs } = useAppContext();
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterDays, setFilterDays]          = useState(null);
    const [search, setSearch]                  = useState('');
    const [page, setPage]                      = useState(1);
    const [filterOpen, setFilterOpen]          = useState(false);
    const PAGE_SIZE = 25;

    const activeCount = [filterSeverity !== 'all', filterCategory !== 'all', filterDays !== null].filter(Boolean).length;

    const enriched = useMemo(() => auditLogs.map(log => {
        const { category, severity } = categorize(log.action);
        const details = log.newValue?.title
            ? `${log.newValue.title}${log.newValue.text ? ` — ${log.newValue.text}` : ''}`
            : log.newValue?.amount
                ? `Amount ${log.newValue.amount}`
                : log.newValue?.fullName || log.newValue?.name
                    ? `${log.newValue.fullName || log.newValue.name}`
                    : log.targetType
                        ? `${cap(log.targetType)} action`
                        : 'System event';
        return {
            ...log,
            categoryComputed: category,
            severityComputed: severity,
            detailsText: details,
            actionLabel: formatAction(log.action),
            timestampLabel: log.timestamp ? new Date(log.timestamp).toLocaleString() : '',
        };
    }), [auditLogs]);

    const filtered = useMemo(() => {
        const cutoff = filterDays ? Date.now() - filterDays * 86400000 : null;
        return enriched.filter(log => {
            if (filterSeverity !== 'all' && log.severityComputed !== filterSeverity) return false;
            if (filterCategory !== 'all' && log.categoryComputed !== filterCategory) return false;
            if (cutoff && log.timestamp && new Date(log.timestamp).getTime() < cutoff) return false;
            const q = search.trim().toLowerCase();
            return !q ||
                log.actionLabel.toLowerCase().includes(q) ||
                log.actorName?.toLowerCase().includes(q) ||
                log.detailsText.toLowerCase().includes(q) ||
                log.categoryComputed.includes(q);
        });
    }, [enriched, filterSeverity, filterCategory, filterDays, search]);

    useEffect(() => { setPage(1); }, [search, filterSeverity, filterCategory, filterDays]);

    const pagedLogs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const counts = useMemo(() => ({
        total:    enriched.length,
        critical: enriched.filter(l => l.severityComputed === 'critical').length,
        warning:  enriched.filter(l => l.severityComputed === 'warning').length,
        info:     enriched.filter(l => l.severityComputed === 'info').length,
    }), [enriched]);

    const handleExportCSV = () => {
        const rows = [
            ['Timestamp', 'Action', 'Actor', 'Role', 'Category', 'Severity', 'Details'],
            ...filtered.map(l => [l.timestampLabel, l.actionLabel, l.actorName || '', l.actorRoleLabel || l.actorRole || '', l.categoryComputed, l.severityComputed, l.detailsText]),
        ];
        const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const activeChips = [
        filterSeverity !== 'all' && { key: 'sev',  label: cap(filterSeverity), clear: () => setFilterSeverity('all') },
        filterCategory !== 'all' && { key: 'cat',  label: cap(filterCategory), clear: () => setFilterCategory('all') },
        filterDays !== null       && { key: 'days', label: `Last ${filterDays}d`, clear: () => setFilterDays(null) },
    ].filter(Boolean);

    return (
        <div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
            <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3">

                {/* Header */}
                <div className="flex items-start justify-between mb-3 sm:mb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
                            </div>
                            <p className="eyebrow text-muted-foreground">Activity Trail</p>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
                    </div>
                    {filtered.length > 0 && (
                        <button type="button" onClick={handleExportCSV} title="Export CSV"
                            className="mt-1 w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
                            <Download className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground"/>
                        </button>
                    )}
                </div>

                {/* Search + Filter button */}
                <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                        <input type="text" placeholder="Search audit logs…" value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full h-10 pl-9 pr-4 bg-card rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground placeholder:text-muted-foreground/55 transition-all"/>
                    </div>
                    <button type="button" onClick={() => setFilterOpen(true)}
                        className={`relative flex items-center gap-1.5 px-3 h-10 rounded-xl border text-sm font-semibold transition-colors flex-shrink-0 ${
                            activeCount > 0
                                ? 'bg-primary/10 border-primary/40 text-primary'
                                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}>
                        <SlidersHorizontal className="w-4 h-4"/>
                        <span className="hidden sm:inline">Filter</span>
                        {activeCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                                {activeCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Active filter chips */}
                {activeChips.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {activeChips.map(chip => (
                            <button key={chip.key} type="button" onClick={chip.clear}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-colors">
                                {chip.label}
                                <X className="w-3 h-3"/>
                            </button>
                        ))}
                        <button type="button"
                            onClick={() => { setFilterSeverity('all'); setFilterCategory('all'); setFilterDays(null); }}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                            Clear all
                        </button>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-border bg-card/70">
                    <div className="min-w-0 px-2 py-2 border-r border-border">
                        <p className="app-value">{counts.total}</p>
                        <p className="app-caption text-muted-foreground mt-1 truncate">Total</p>
                    </div>
                    <div className="min-w-0 px-2 py-2 border-r border-border">
                        <p className="app-value text-destructive">{counts.critical}</p>
                        <p className="app-caption text-muted-foreground mt-1 truncate">Critical</p>
                    </div>
                    <div className="min-w-0 px-2 py-2 border-r border-border">
                        <p className="app-value text-primary">{counts.warning}</p>
                        <p className="app-caption text-muted-foreground mt-1 truncate">Warning</p>
                    </div>
                    <div className="min-w-0 px-2 py-2">
                        <p className="app-value text-success">{counts.info}</p>
                        <p className="app-caption text-muted-foreground mt-1 truncate">Info</p>
                    </div>
                </div>
            </div>

            {/* Log list */}
            <div className="px-4 sm:px-6 space-y-3 mt-3">
                {filtered.length === 0 ? (
                    <EmptyState icon={AlertCircle}
                        title={auditLogs.length === 0 ? 'No audit logs yet' : 'No matches'}
                        description={auditLogs.length === 0
                            ? 'Actions like payments, approvals, and reminders will be recorded here.'
                            : 'Try adjusting your search or filters.'}
                    />
                ) : (
                    pagedLogs.map(log => (
                        <AuditLogItem key={log.id}
                            category={log.categoryComputed}
                            severity={log.severityComputed}
                            actionLabel={log.actionLabel}
                            details={log.detailsText}
                            actorName={log.actorName || 'Unknown'}
                            actorRole={log.actorRoleLabel || log.actorRole}
                            timestampLabel={log.timestampLabel}
                        />
                    ))
                )}
            </div>

            <div className="px-4 sm:px-6 pb-4 mt-3">
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <TablePagination total={filtered.length} page={page} perPage={PAGE_SIZE} onChange={setPage}/>
                </div>
            </div>

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                severity={filterSeverity}
                category={filterCategory}
                days={filterDays}
                onApply={(sev, cat, days) => {
                    setFilterSeverity(sev);
                    setFilterCategory(cat);
                    setFilterDays(days);
                    setFilterOpen(false);
                }}
            />
        </div>
    );
}

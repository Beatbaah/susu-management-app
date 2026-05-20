import { Search, AlertCircle, History, Download } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { TablePagination } from '../components/ui/TablePagination';
import { useAppContext } from '../context/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditLogItem } from '../components/domain';
import { toast } from '../utils/toast';
const PAYMENT_ACTIONS = new Set(['record payment', 'confirm payment', 'reject payment']);
const PAYOUT_ACTIONS = new Set(['complete payout']);
const USER_ACTIONS = new Set(['request access', 'approve registration', 'reject registration', 'logout', 'login']);
const SECURITY_ACTIONS = new Set(['clear audit logs', 'failed login']);
const GROUP_ACTIONS = new Set(['create group']);
const REMINDER_ACTIONS = new Set(['send reminder']);
function categorize(action) {
    const a = (action || '').toLowerCase();
    if (PAYMENT_ACTIONS.has(a))
        return { category: 'payment', severity: a === 'reject payment' ? 'warning' : 'info' };
    if (PAYOUT_ACTIONS.has(a))
        return { category: 'payout', severity: 'info' };
    if (USER_ACTIONS.has(a))
        return { category: 'user', severity: a === 'reject registration' ? 'warning' : 'info' };
    if (SECURITY_ACTIONS.has(a))
        return { category: 'security', severity: 'critical' };
    if (GROUP_ACTIONS.has(a))
        return { category: 'group', severity: 'info' };
    if (REMINDER_ACTIONS.has(a))
        return { category: 'reminder', severity: 'info' };
    return { category: 'system', severity: 'info' };
}
const formatAction = (action) => action.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
export function AuditLogs() {
    const { auditLogs } = useAppContext();
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterDays, setFilterDays] = useState(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;
    const enriched = useMemo(() => auditLogs.map(log => {
        const { category, severity } = categorize(log.action);
        const details = log.newValue?.title
            ? `${log.newValue.title}${log.newValue.text ? ` — ${log.newValue.text}` : ''}`
            : log.newValue?.amount
                ? `Amount ${log.newValue.amount}`
                : log.newValue?.fullName || log.newValue?.name
                    ? `${log.newValue.fullName || log.newValue.name}`
                    : log.targetType
                        ? `${log.targetType.charAt(0).toUpperCase() + log.targetType.slice(1)} action`
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
        total: enriched.length,
        critical: enriched.filter(l => l.severityComputed === 'critical').length,
        warning: enriched.filter(l => l.severityComputed === 'warning').length,
        info: enriched.filter(l => l.severityComputed === 'info').length,
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
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground">Activity Trail</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Audit Logs</h1>
            <p className="text-muted-foreground text-sm">Full record of all system actions and events.</p>
          </div>
          {filtered.length > 0 && (
            <button type="button" onClick={handleExportCSV} title="Export CSV"
              className="mt-1 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
              <Download className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground"/>
            </button>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input type="text" placeholder="Search audit logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-11 pl-9 pr-4 bg-card rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground placeholder:text-muted-foreground/55 transition-all"/>
        </div>

        <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-border bg-card/70 mb-4">
          <div className="min-w-0 px-2.5 py-2 border-r border-border">
            <p className="app-value">{counts.total}</p>
            <p className="app-caption text-muted-foreground mt-1.5 truncate">Total</p>
          </div>
          <div className="min-w-0 px-2.5 py-2 border-r border-border">
            <p className="app-value text-destructive">{counts.critical}</p>
            <p className="app-caption text-muted-foreground mt-1.5 truncate">Critical</p>
          </div>
          <div className="min-w-0 px-2.5 py-2 border-r border-border">
            <p className="app-value text-primary">{counts.warning}</p>
            <p className="app-caption text-muted-foreground mt-1.5 truncate">Warning</p>
          </div>
          <div className="min-w-0 px-2.5 py-2">
            <p className="app-value text-success">{counts.info}</p>
            <p className="app-caption text-muted-foreground mt-1.5 truncate">Info</p>
          </div>
        </div>

        {/* Severity filter */}
        <div className="flex rounded-xl border border-border bg-card/70 p-1 mb-2 overflow-x-auto no-scrollbar">
          {['all', 'critical', 'warning', 'info'].map(level => (<button key={level} onClick={() => setFilterSeverity(level)} className={`min-w-0 flex-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap app-tab transition-colors flex-shrink-0 ${filterSeverity === level
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>))}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5 pb-1 mb-2">
          {['all', 'payment', 'payout', 'user', 'security', 'group', 'reminder'].map(cat => (
            <button key={cat} type="button" onClick={() => setFilterCategory(cat)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${filterCategory === cat ? 'bg-primary/15 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-1.5 mb-4">
          {[{ label: 'All time', val: null }, { label: 'Last 7d', val: 7 }, { label: 'Last 30d', val: 30 }, { label: 'Last 90d', val: 90 }].map(({ label, val }) => (
            <button key={label} type="button" onClick={() => setFilterDays(val)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${filterDays === val ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 space-y-3">
        {filtered.length === 0 ? (<EmptyState icon={AlertCircle} title={auditLogs.length === 0 ? 'No audit logs yet' : 'No matches'} description={auditLogs.length === 0
                ? 'Actions like payments, approvals, and reminders will be recorded here.'
                : 'Try adjusting your search, category, or date range.'}/>) : (
          pagedLogs.map((log) => (<AuditLogItem key={log.id} category={log.categoryComputed} severity={log.severityComputed} actionLabel={log.actionLabel} details={log.detailsText} actorName={log.actorName || 'Unknown'} actorRole={log.actorRoleLabel || log.actorRole} timestampLabel={log.timestampLabel}/>))
        )}
      </div>
      <div className="px-6 pb-4">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <TablePagination total={filtered.length} page={page} perPage={PAGE_SIZE} onChange={setPage}/>
        </div>
      </div>
    </div>);
}

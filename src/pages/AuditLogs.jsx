import { Search, AlertCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import { AuditLogItem } from '../components/domain';
import { toast, confirmToast } from '../utils/toast';
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
    const { auditLogs, clearAuditLogs } = useAppContext();
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [search, setSearch] = useState('');
    const enriched = useMemo(() => auditLogs.map(log => {
        const { category, severity } = categorize(log.action);
        const details = log.newValue?.title
            ? `${log.newValue.title}${log.newValue.text ? ` — ${log.newValue.text}` : ''}`
            : log.newValue?.amount
                ? `Amount ${log.newValue.amount}`
                : log.newValue?.fullName || log.newValue?.name
                    ? `${log.newValue.fullName || log.newValue.name}`
                    : `Target ${log.targetType}:${log.targetId || '—'}`;
        return {
            ...log,
            categoryComputed: category,
            severityComputed: severity,
            detailsText: details,
            actionLabel: formatAction(log.action),
            timestampLabel: log.timestamp ? new Date(log.timestamp).toLocaleString() : '',
        };
    }), [auditLogs]);
    const filtered = enriched.filter(log => {
        const matchesSeverity = filterSeverity === 'all' || log.severityComputed === filterSeverity;
        const q = search.trim().toLowerCase();
        const matchesSearch = !q ||
            log.actionLabel.toLowerCase().includes(q) ||
            log.actorName?.toLowerCase().includes(q) ||
            log.detailsText.toLowerCase().includes(q) ||
            log.categoryComputed.includes(q);
        return matchesSeverity && matchesSearch;
    });
    const counts = useMemo(() => ({
        total: enriched.length,
        critical: enriched.filter(l => l.severityComputed === 'critical').length,
        warning: enriched.filter(l => l.severityComputed === 'warning').length,
        info: enriched.filter(l => l.severityComputed === 'info').length,
    }), [enriched]);
    return (<div className="pb-28">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold">Audit Logs</h1>
          {auditLogs.length > 0 && (<button type="button" onClick={async () => {
                const ok = await confirmToast({
                    title: 'Clear all audit logs?',
                    description: 'This cannot be undone. Records are permanently removed.',
                    confirmLabel: 'Clear',
                    destructive: true,
                });
                if (!ok)
                    return;
                clearAuditLogs();
                toast.success('Audit logs cleared');
            }} className="text-xs text-destructive hover:underline">
              Clear All
            </button>)}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground"/>
          <input type="text" placeholder="Search audit logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-card rounded-2xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-foreground"/>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-card rounded-2xl p-3 border border-border text-center">
            <p className="text-muted-foreground text-xs mb-1">Total</p>
            <p className="text-xl">{counts.total}</p>
          </div>
          <div className="bg-card rounded-2xl p-3 border border-border text-center">
            <p className="text-muted-foreground text-xs mb-1">Critical</p>
            <p className="text-xl text-destructive">{counts.critical}</p>
          </div>
          <div className="bg-card rounded-2xl p-3 border border-border text-center">
            <p className="text-muted-foreground text-xs mb-1">Warning</p>
            <p className="text-xl text-primary">{counts.warning}</p>
          </div>
          <div className="bg-card rounded-2xl p-3 border border-border text-center">
            <p className="text-muted-foreground text-xs mb-1">Info</p>
            <p className="text-xl text-success">{counts.info}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'critical', 'warning', 'info'].map(level => (<button key={level} onClick={() => setFilterSeverity(level)} className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${filterSeverity === level
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground border border-border'}`}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>))}
        </div>
      </div>

      <div className="px-6 space-y-3">
        {filtered.length === 0 ? (<EmptyState icon={AlertCircle} title={auditLogs.length === 0 ? 'No audit logs yet' : 'No matches'} description={auditLogs.length === 0
                ? 'Actions like payments, approvals and reminders will be recorded here.'
                : 'Try a different search term or filter.'}/>) : (filtered.map((log) => (<AuditLogItem key={log.id} category={log.categoryComputed} severity={log.severityComputed} actionLabel={log.actionLabel} details={log.detailsText} actorName={log.actorName || 'Unknown'} actorRole={log.actorRoleLabel || log.actorRole} timestampLabel={log.timestampLabel}/>)))}
      </div>
    </div>);
}

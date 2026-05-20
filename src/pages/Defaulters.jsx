import { Search, AlertCircle, Phone, Send, ShieldX, Flame, UserCheck, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import { getDefaulterRisk } from '../utils/financeValidation';
import { toast } from '../utils/toast';
import { cn } from '../components/ui/utils';
export function Defaulters() {
    const { authUser, users, payments, groups, sendReminder, reinstateUser } = useAppContext();
    const canManage = authUser && ['admin', 'manager'].includes(authUser.role);
    const [search, setSearch] = useState('');
    const [sentTo, setSentTo] = useState(null);
    const today = useMemo(() => new Date(), []);
    const defaulters = useMemo(() => {
        const overdue = payments.filter(p => p.status === 'overdue');
        const suspended = users.filter(u => u.role === 'member' && u.status === 'suspended');
        const memberIdsWithOverdue = new Set([
            ...overdue.map(p => p.memberId || p.userId),
            ...suspended.map(u => u.id),
        ]);
        return Array.from(memberIdsWithOverdue).map(memberId => {
            const member = users.find(u => u.id === memberId);
            if (!member) return null;
            const group = groups.find(g => g.id === member.groupId);
            const memberOverdue = overdue.filter(p => (p.memberId || p.userId) === memberId);
            const totalDue = memberOverdue.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const daysList = memberOverdue.map(p => getDefaulterRisk(p, today).daysOverdue);
            const maxDays = daysList.length ? Math.max(...daysList) : 0;
            const sortedByDue = [...memberOverdue].sort((a, b) => new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime());
            // Aging bucket: 0-7d watch, 8-30d at-risk, 30d+ critical
            const agingBucket = maxDays > 30 ? 'critical' : maxDays > 7 ? 'at-risk' : 'watch';
            return {
                id: member.id,
                name: member.fullName || member.name || 'Unknown',
                phone: member.phone || '',
                group: group?.groupName || group?.name || 'No Group',
                dueAmount: totalDue || Number(group?.contributionAmount || group?.contribution || 0),
                dueDate: sortedByDue[0]?.dueDate || '—',
                daysOverdue: maxDays,
                totalMissed: memberOverdue.length,
                status: member.status,
                initials: (member.fullName || member.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
                riskLevel: agingBucket,
            };
        }).filter(Boolean);
    }, [users, payments, groups, today]);
    const agingSummary = useMemo(() => {
        const buckets = { watch: { count: 0, amount: 0 }, 'at-risk': { count: 0, amount: 0 }, critical: { count: 0, amount: 0 } };
        defaulters.forEach(d => {
            const b = buckets[d.riskLevel] ?? buckets.critical;
            b.count++;
            b.amount += d.dueAmount;
        });
        return buckets;
    }, [defaulters]);
    const q = search.trim().toLowerCase();
    const filtered = defaulters.filter(d => !q ||
        d.name.toLowerCase().includes(q) ||
        d.phone.includes(search.trim()) ||
        d.group.toLowerCase().includes(q));
    const avgDaysLate = defaulters.length ? Math.round(defaulters.reduce((s, d) => s + d.daysOverdue, 0) / defaulters.length) : 0;
    const totalOverdueAmount = defaulters.reduce((s, d) => s + d.dueAmount, 0);
    const handleExportCSV = () => {
        const rows = [
            ['Name', 'Phone', 'Group', 'Amount Due (GHS)', 'Days Overdue', 'Missed Rounds', 'Risk Level', 'Status'],
            ...filtered.map(d => [d.name, d.phone, d.group, d.dueAmount, d.daysOverdue, d.totalMissed, d.riskLevel, d.status]),
        ];
        const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `defaulters-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleReinstate = (d) => {
        reinstateUser(d.id);
        toast.success(`${d.name} reinstated`);
    };
    const handleSendReminder = (d) => {
        sendReminder({ userIds: [d.id], title: 'Overdue Payment Reminder', text: `You have ${d.totalMissed || 1} overdue payment(s) totaling ${fmt(d.dueAmount)}. Please settle as soon as possible.`, type: 'warning' });
        toast.success(`Reminder sent to ${d.name}`);
        setSentTo(d.id);
        setTimeout(() => setSentTo(prev => (prev === d.id ? null : prev)), 2500);
    };
    const riskColor = (level) => ({
        critical: 'bg-destructive/15 text-destructive border-destructive/30',
        high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        medium: 'bg-warning/15 text-warning border-warning/30',
    }[level] || 'bg-destructive/15 text-destructive border-destructive/30');
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-destructive/20 flex items-center justify-center">
                <ShieldX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive"/>
              </div>
              <p className="eyebrow text-muted-foreground">Risk Management</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Defaulters</h1>
            <p className="text-muted-foreground text-sm">Members with overdue payments requiring immediate attention.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {defaulters.length > 0 && (<div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-destructive/15 flex items-center justify-center border border-destructive/30">
                <span className="text-destructive font-bold text-base sm:text-lg">{defaulters.length}</span>
              </div>)}
            {filtered.length > 0 && (
              <button type="button" onClick={handleExportCSV} title="Export CSV" className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground"/>
              </button>
            )}
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-card p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-destructive/20 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="app-caption text-muted-foreground uppercase mb-1">Total Overdue</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive stat-value leading-none truncate">{fmt(totalOverdueAmount)}</p>
              <p className="app-caption text-muted-foreground uppercase mt-1.5">{defaulters.length} members</p>
            </div>
          </div>
          <div className="bg-card p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-warning/20 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="app-caption text-muted-foreground uppercase mb-1">Avg Days Late</p>
              <p className="text-2xl sm:text-3xl font-bold text-warning stat-value leading-none">{avgDaysLate}</p>
              <p className="app-caption text-muted-foreground uppercase mt-1.5">Days past due</p>
            </div>
          </div>
        </div>

        {/* Aging bucket summary */}
        {defaulters.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
            {[
              { key: 'watch', label: '0–7d Watch', cls: 'border-warning/25 text-warning', bg: 'bg-warning/10' },
              { key: 'at-risk', label: '8–30d At Risk', cls: 'border-orange-500/25 text-orange-400', bg: 'bg-orange-500/10' },
              { key: 'critical', label: '30d+ Critical', cls: 'border-destructive/25 text-destructive', bg: 'bg-destructive/10' },
            ].map(({ key, label, cls, bg }) => (
              <div key={key} className={`${bg} border ${cls} rounded-xl p-2.5 sm:p-4`}>
                <p className="eyebrow text-muted-foreground uppercase mb-1 truncate">{label}</p>
                <p className={`text-lg sm:text-2xl font-bold leading-none ${cls}`}>{agingSummary[key].count}</p>
                <p className="app-caption text-muted-foreground mt-1 truncate">{fmt(agingSummary[key].amount)}</p>
              </div>
            ))}
          </div>
        )}

        {defaulters.length > 0 && (<div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-destructive/8 border border-destructive/20 mb-4 sm:mb-5">
            <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 text-destructive"/>
            </div>
            <div>
              <p className="text-sm font-bold text-destructive mb-0.5">Collection Alert Active</p>
              <p className="text-xs text-destructive font-medium">{defaulters.length} member{defaulters.length !== 1 ? 's' : ''} with overdue payments. Send reminders to maintain cycle integrity.</p>
            </div>
          </div>)}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground"/>
          <input type="text" placeholder="Search by name, phone, or group…" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 sm:pl-14 pr-4 sm:pr-5 py-2.5 sm:py-3 bg-card rounded-2xl border-2 border-border focus:outline-none focus:border-destructive/60 focus:ring-2 focus:ring-destructive/10 text-sm text-foreground transition-all"/>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        {filtered.length === 0 ? (
          <div className={cn("rounded-2xl border border-dashed p-12 text-center", defaulters.length === 0 ? 'border-success/20 bg-success/5' : 'border-border bg-card')}>
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4", defaulters.length === 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
              <AlertCircle className="w-8 h-8"/>
            </div>
            <h3 className="text-lg font-bold text-foreground">{defaulters.length === 0 ? 'All Clear!' : 'No Matches'}</h3>
            <p className="text-muted-foreground text-sm mt-1">{defaulters.length === 0 ? 'All members are up to date on their payments.' : 'Try a different search term.'}</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="hidden sm:grid grid-cols-[minmax(140px,2fr)_minmax(100px,1.2fr)_100px_80px_80px_120px] gap-x-3 px-4 py-2 border-b border-border bg-muted/20">
              <span className="eyebrow text-muted-foreground">Member</span>
              <span className="eyebrow text-muted-foreground">Group</span>
              <span className="eyebrow text-muted-foreground text-right">Amount Due</span>
              <span className="eyebrow text-muted-foreground">Days Late</span>
              <span className="eyebrow text-muted-foreground">Risk</span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(d => {
                const RC = {
                  critical: { cls: 'bg-destructive/15 text-destructive', label: 'Critical' },
                  'at-risk': { cls: 'bg-orange-500/15 text-orange-500', label: 'At Risk' },
                  watch: { cls: 'bg-warning/15 text-warning', label: 'Watch' },
                };
                const rc = RC[d.riskLevel] || RC.critical;
                return (
                  <div key={d.id} className="group">
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[minmax(140px,2fr)_minmax(100px,1.2fr)_100px_80px_80px_120px] items-center gap-x-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive text-xs font-bold flex-shrink-0">{d.initials}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{d.name}</p>
                          {d.status === 'suspended' && <p className="eyebrow text-destructive">Suspended</p>}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{d.group}</p>
                      <div>
                        <p className="text-sm font-semibold text-destructive">{fmt(d.dueAmount)}</p>
                        {d.totalMissed > 0 && <p className="eyebrow text-muted-foreground">{d.totalMissed} round{d.totalMissed !== 1 ? 's' : ''}</p>}
                      </div>
                      <p className="text-sm font-bold text-foreground">{d.daysOverdue > 0 ? `${d.daysOverdue}d` : '—'}</p>
                      <span className={`eyebrow px-2 py-0.5 rounded-full w-fit ${rc.cls}`}>{rc.label}</span>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => handleSendReminder(d)} aria-label={`Send reminder to ${d.name}`} className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-colors', sentTo === d.id ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary hover:bg-primary/20')}><Send className="w-3.5 h-3.5" aria-hidden="true"/></button>
                        {d.phone
                          ? <a href={`tel:${d.phone}`} aria-label={`Call ${d.name}`} className="w-7 h-7 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center"><Phone className="w-3.5 h-3.5" aria-hidden="true"/></a>
                          : <div className="w-7 h-7 rounded-lg bg-muted/50 text-muted-foreground/40 flex items-center justify-center cursor-not-allowed" aria-label="No phone number"><Phone className="w-3.5 h-3.5" aria-hidden="true"/></div>}
                        {canManage && d.status === 'suspended' && (
                          <button type="button" onClick={() => handleReinstate(d)} aria-label={`Reinstate ${d.name}`} className="w-7 h-7 rounded-lg bg-success/15 text-success hover:bg-success/25 flex items-center justify-center"><UserCheck className="w-3.5 h-3.5" aria-hidden="true"/></button>
                        )}
                      </div>
                    </div>
                    {/* Mobile row */}
                    <div className="sm:hidden px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive text-xs font-bold flex-shrink-0 mt-0.5">{d.initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{d.name}</p>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-destructive">{fmt(d.dueAmount)}</p>
                              {d.totalMissed > 0 && <p className="eyebrow text-muted-foreground">{d.totalMissed}×</p>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground truncate">{d.group}{d.daysOverdue > 0 ? ` · ${d.daysOverdue}d late` : ''}</p>
                            <span className={`eyebrow px-1.5 py-0.5 rounded-full flex-shrink-0 ${rc.cls}`}>{rc.label}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2.5 pl-10">
                        <button type="button" onClick={() => handleSendReminder(d)} className={cn('flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors', sentTo === d.id ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary')}>
                          <Send className="w-3 h-3"/>{sentTo === d.id ? 'Sent ✓' : 'Remind'}
                        </button>
                        {d.phone
                          ? <a href={`tel:${d.phone}`} className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center gap-1.5"><Phone className="w-3 h-3"/>Call</a>
                          : <div className="flex-1 py-1.5 rounded-lg bg-muted/40 text-muted-foreground/50 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed"><Phone className="w-3 h-3"/>No phone</div>}
                        {canManage && d.status === 'suspended' && (
                          <button type="button" onClick={() => handleReinstate(d)} className="py-1.5 px-3 rounded-lg bg-success/15 text-success text-xs font-semibold flex items-center justify-center gap-1.5"><UserCheck className="w-3 h-3"/>Reinstate</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-border bg-muted/10">
              <p className="text-xs text-muted-foreground">{filtered.length} of {defaulters.length} defaulters</p>
            </div>
          </div>
        )}
      </div>
    </div>);
}

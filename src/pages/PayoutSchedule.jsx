import { Calendar, List, CalendarDays, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SkeletonList } from '../components/ui/LoadingState';
import { PayoutCard } from '../components/domain';
import { fmt } from '../utils/helpers';
import { useAppContext } from '../context/AppContext';
import { toast } from '../utils/toast';
import { cn } from '../components/ui/utils';
export function PayoutSchedule() {
    const { schedule, users, groups, completePayout, assignPayoutRecipient, authUser, appReady } = useAppContext();
    const canManage = authUser && ['admin', 'manager'].includes(authUser.role);
    const [view, setView] = useState('list');
    const [statusFilter, setStatusFilter] = useState('all');
    const [assigningPayout, setAssigningPayout] = useState(null);
    const [selectedRecipient, setSelectedRecipient] = useState('');
    const payoutsWithDetails = useMemo(() => schedule.map((payout) => {
        const member = users.find(m => m.id === (payout.memberId || payout.recipientId));
        const group = groups.find(g => g.id === payout.groupId);
        const totalRounds = group?.totalRounds || group?.totalSlots || 1;
        return {
            ...payout,
            memberName: member?.fullName || member?.name || 'Unknown',
            groupName: group?.groupName || group?.name || 'Unknown',
            totalRounds,
        };
    }), [schedule, users, groups]);
    const isCompleted = (p) => ['completed', 'paid'].includes(String(p.status || '').toLowerCase()) || p.paid;
    const hasRecipient = (p) => !!(p.memberId || p.recipientId);
    const unassigned = payoutsWithDetails.filter(p => !isCompleted(p) && !hasRecipient(p));
    const pending = payoutsWithDetails.filter(p => !isCompleted(p) && hasRecipient(p));
    const completed = payoutsWithDetails.filter(p => isCompleted(p));
    const totalUnassignedAmount = unassigned.reduce((sum, p) => sum + Number(p.payoutAmount || p.amount || 0), 0);
    const totalPendingAmount = pending.reduce((sum, p) => sum + Number(p.payoutAmount || p.amount || 0), 0);
    const totalCompletedAmount = completed.reduce((sum, p) => sum + Number(p.payoutAmount || p.amount || 0), 0);
    const STATUS_TABS = [
        { key: 'all', label: 'All', count: payoutsWithDetails.length },
        { key: 'unassigned', label: 'Unassigned', count: unassigned.length },
        { key: 'pending', label: 'In Progress', count: pending.length },
        { key: 'completed', label: 'Completed', count: completed.length },
    ];
    const filteredPayouts = statusFilter === 'unassigned' ? unassigned
        : statusFilter === 'pending' ? pending
        : statusFilter === 'completed' ? completed
        : payoutsWithDetails;
    const openAssign = (payout) => {
        setAssigningPayout(payout);
        setSelectedRecipient(payout.memberId || payout.recipientId || '');
    };
    const handleAssignRecipient = () => {
        if (!assigningPayout || !selectedRecipient)
            return;
        const result = assignPayoutRecipient(assigningPayout.id, selectedRecipient);
        if (result?.ok === false) {
            toast.error(result.message || 'Could not assign recipient');
            return;
        }
        const member = users.find(u => String(u.id) === String(selectedRecipient));
        toast.success(`${member?.fullName || member?.name || 'Recipient'} assigned`);
        setAssigningPayout(null);
        setSelectedRecipient('');
    };
    const renderFooter = (payout) => {
        if (isCompleted(payout) || !canManage)
            return null;
        if (!hasRecipient(payout)) {
            return (<button type="button" onClick={() => openAssign(payout)} className="w-full bg-accent text-foreground py-3.5 rounded-2xl app-action uppercase hover:bg-accent active:scale-95 transition-all mt-4 flex items-center justify-center gap-2">
          <Users className="w-4 h-4"/>
          Assign Recipient
        </button>);
        }
        return (<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <button type="button" onClick={() => openAssign(payout)} className="w-full bg-accent text-foreground py-3.5 rounded-2xl app-action uppercase hover:bg-accent active:scale-95 transition-all">
          Change Recipient
        </button>
        <button type="button" onClick={() => {
                if (!window.confirm(`Mark payout to ${payout.memberName} as completed? This cannot be undone.`)) return;
                const result = completePayout(payout.id);
                if (result?.ok === false)
                    toast.error(result.message || 'Could not complete payout');
                else
                    toast.success(`Payout to ${payout.memberName} marked completed`);
            }} className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl app-action uppercase active:scale-95 transition-all">
          Mark Completed
        </button>
      </div>);
    };
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground">Disbursements</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Payouts</h1>
            <p className="text-muted-foreground text-sm">Manage and assign susu cycle payouts.</p>
          </div>
          <button type="button" onClick={() => setView(v => (v === 'list' ? 'calendar' : 'list'))} aria-label={view === 'list' ? 'Switch to calendar view' : 'Switch to list view'} className="h-10 w-10 sm:w-auto sm:px-3.5 rounded-xl bg-card/70 border border-border app-control text-foreground/75 hover:text-foreground transition-colors flex items-center justify-center gap-2 flex-shrink-0">
            {view === 'list' ? <CalendarDays className="w-4 h-4" aria-hidden="true"/> : <List className="w-4 h-4" aria-hidden="true"/>}
            <span className="hidden sm:inline">{view === 'list' ? 'Calendar' : 'List'}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card/70 mb-4">
          <div className="min-w-0 px-2.5 py-2 border-r border-border">
            <div className="relative z-10">
              <p className="app-value text-warning">{unassigned.length}</p>
              <p className="app-caption text-muted-foreground mt-1.5 truncate">Unassigned</p>
              <p className="app-caption text-warning/80 font-semibold mt-1 truncate">{fmt(totalUnassignedAmount)}</p>
            </div>
          </div>
          <div className="min-w-0 px-2.5 py-2 border-r border-border">
            <div className="relative z-10">
              <p className="app-value text-primary">{pending.length}</p>
              <p className="app-caption text-muted-foreground mt-1.5 truncate"><span className="sm:hidden">Active</span><span className="hidden sm:inline">In progress</span></p>
              <p className="app-caption text-primary/80 font-semibold mt-1 truncate">{fmt(totalPendingAmount)}</p>
            </div>
          </div>
          <div className="min-w-0 px-2.5 py-2">
            <div className="relative z-10">
              <p className="app-value text-success">{completed.length}</p>
              <p className="app-caption text-muted-foreground mt-1.5 truncate">Disbursed</p>
              <p className="app-caption text-success/80 font-semibold mt-1 truncate">{fmt(totalCompletedAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        {view === 'list' && payoutsWithDetails.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto mb-3 pb-1 no-scrollbar">
            {STATUS_TABS.map(tab => (
              <button key={tab.key} type="button" onClick={() => setStatusFilter(tab.key)}
                className={cn('flex items-center gap-1 px-2 py-1.5 rounded-md app-tab whitespace-nowrap transition-colors flex-shrink-0',
                  statusFilter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground')}>
                {tab.label}
                <span className={cn('w-4 h-4 rounded-full flex items-center justify-center app-caption',
                  statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground')}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}
        {!appReady && payoutsWithDetails.length === 0 ? (<SkeletonList count={3}/>) : payoutsWithDetails.length === 0 ? (<div className="glass-card rounded-xl border border-border p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary/50">
              <Calendar className="w-8 h-8"/>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No Payouts Yet</h3>
            <p className="text-muted-foreground text-sm">Payouts will appear here when groups complete their rounds.</p>
          </div>) : view === 'calendar' ? (<CalendarView payouts={payoutsWithDetails}/>) : filteredPayouts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No {statusFilter === 'unassigned' ? 'unassigned' : statusFilter === 'pending' ? 'in-progress' : statusFilter === 'completed' ? 'completed' : ''} payouts.
            </div>
          ) : (
            <>
              {/* ── Mobile list view ── */}
              <div className="lg:hidden bg-card rounded-lg border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  {filteredPayouts.map((payout) => {
                    const done = isCompleted(payout);
                    const assigned = hasRecipient(payout);
                    const initials = payout.memberName
                      ? payout.memberName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                      : '?';
                    const statusCfg = done
                      ? { label: 'Done', cls: 'bg-success/10 text-success' }
                      : assigned
                      ? { label: 'In Progress', cls: 'bg-primary/10 text-primary' }
                      : { label: 'Unassigned', cls: 'bg-warning/10 text-warning' };

                    return (
                      <div key={payout.id} className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {/* Avatar */}
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center app-value text-white flex-shrink-0',
                            done ? 'bg-success' : assigned ? 'bg-primary' : 'bg-warning')}>
                            {initials}
                          </div>

                          {/* Name + group + round */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="app-row-title text-foreground truncate">{payout.memberName}</p>
                              <p className="app-row-title text-foreground tabular-nums flex-shrink-0">{fmt(Number(payout.payoutAmount || payout.amount || 0))}</p>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className="app-row-meta text-muted-foreground truncate">{payout.groupName} · Round {payout.round || 0}/{payout.totalRounds}</p>
                              <span className={cn('app-badge px-1.5 py-0.5 rounded flex-shrink-0', statusCfg.cls)}>
                                {statusCfg.label}
                              </span>
                            </div>
                            {(payout.scheduledDate || payout.paidAt) && (
                              <p className="app-caption text-muted-foreground mt-0.5">
                                {done ? `Paid ${payout.paidAt ? new Date(payout.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}` : payout.scheduledDate}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Inline action buttons for managers */}
                        {!done && canManage && (
                          <div className="flex gap-1.5 mt-2 ml-10" onClick={e => e.stopPropagation()}>
                            {!assigned ? (
                              <button type="button" onClick={() => openAssign(payout)}
                                className="flex-1 py-1 rounded-lg bg-muted text-foreground app-action flex items-center justify-center gap-1">
                                <Users className="w-3 h-3"/>
                                Assign
                              </button>
                            ) : (
                              <>
                                <button type="button" onClick={() => openAssign(payout)}
                                  className="flex-1 py-1 rounded-lg bg-muted text-muted-foreground app-action">
                                  Change
                                </button>
                                <button type="button"
                                  onClick={() => {
                                    if (!window.confirm(`Mark payout to ${payout.memberName} as completed?`)) return;
                                    const result = completePayout(payout.id);
                                    if (result?.ok === false) toast.error(result.message || 'Could not complete payout');
                                    else toast.success(`Payout to ${payout.memberName} marked completed`);
                                  }}
                                  className="flex-[1.5] py-1 rounded-lg bg-primary text-primary-foreground app-action">
                                  Mark Done
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Desktop card grid ── */}
              <div className="hidden lg:grid grid-cols-2 gap-6">
                {filteredPayouts.map((payout) => (
                  <PayoutCard key={payout.id} memberName={payout.memberName} groupName={payout.groupName}
                    payoutAmount={Number(payout.payoutAmount || payout.amount || 0)}
                    scheduledDate={payout.scheduledDate} paidAt={payout.paidAt}
                    status={payout.status} round={payout.round || 0} totalRounds={payout.totalRounds}
                    footer={renderFooter(payout)}/>
                ))}
              </div>
            </>
          )}
      </div>

      {assigningPayout && (<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAssigningPayout(null)}>
          <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Users className="w-5 h-5"/>
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Assign Recipient</h2>
                  <p className="text-xs text-muted-foreground">
                    {assigningPayout.groupName} · Round {assigningPayout.round}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setAssigningPayout(null)} className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" aria-label="Close">
                <X className="w-4 h-4"/>
              </button>
            </div>

            <div className="px-5 py-4">
              <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Member</label>
              <select value={selectedRecipient} onChange={(event) => setSelectedRecipient(event.target.value)} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors">
                <option value="">Select a member</option>
                {users
                  .filter(member => member.role === 'member' && member.status === 'approved' && String(member.groupId) === String(assigningPayout.groupId))
                  .map(member => (<option key={member.id} value={member.id}>
                      {member.fullName || member.name}
                    </option>))}
              </select>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-border/50 bg-card">
              <button type="button" onClick={() => setAssigningPayout(null)} className="flex-1 rounded-xl bg-muted border border-border py-3.5 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="button" disabled={!selectedRecipient} onClick={handleAssignRecipient} className="flex-[1.5] rounded-xl bg-primary text-primary-foreground py-3.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
                Assign
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}
function CalendarView({ payouts }) {
    const buckets = new Map();
    payouts.forEach(p => {
        const dateStr = p.scheduledDate || p.paidAt || p.date;
        if (!dateStr)
            return;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime()))
            return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!buckets.has(key))
            buckets.set(key, []);
        buckets.get(key).push(p);
    });
    const monthLabel = (key) => {
        const [y, m] = key.split('-');
        return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };
    const sortedKeys = Array.from(buckets.keys()).sort();
    if (sortedKeys.length === 0) {
        return (<div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground text-sm font-medium">
        No scheduled dates to display in calendar.
      </div>);
    }
    return (<div className="space-y-12">
      {sortedKeys.map(key => (<div key={key}>
          <div className="flex items-center gap-4 mb-6">
            <p className="eyebrow text-muted-foreground whitespace-nowrap">
              {monthLabel(key)}
            </p>
            <div className="h-px w-full bg-border"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {buckets.get(key).sort((a, b) => new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime()).map(p => (<div key={p.id} className="glass-card p-6 rounded-[2rem] border border-border flex items-center gap-5 group">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110", p.status === 'completed' || p.paid ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary')}>
                  <Calendar className="w-6 h-6"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-bold truncate text-sm">{p.memberName}</p>
                  <p className="eyebrow text-muted-foreground mt-0.5 truncate">{p.groupName} · Round {p.round}</p>
                </div>
                <div className="text-right">
                  <p className="text-foreground font-bold text-sm tabular-nums">{p.scheduledDate}</p>
                  <p className={cn("eyebrow mt-0.5", p.status === 'completed' || p.paid ? 'text-success/60' : 'text-primary/60')}>
                    {p.status === 'completed' || p.paid ? 'Completed' : 'Scheduled'}
                  </p>
                </div>
              </div>))}
          </div>
        </div>))}
    </div>);
}

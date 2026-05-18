import { Calendar, List, CalendarDays, Users } from 'lucide-react';
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
    return (<div className="pb-28 page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="app-title text-foreground">Payouts</h1>
            <p className="app-caption text-muted-foreground mt-1 truncate">Scheduled group disbursements</p>
          </div>
          <button type="button" onClick={() => setView(v => (v === 'list' ? 'calendar' : 'list'))} className="h-10 px-3.5 rounded-xl bg-card/70 border border-border app-control text-foreground/75 hover:text-foreground transition-colors flex items-center gap-2 flex-shrink-0">
            {view === 'list' ? <CalendarDays className="w-4 h-4"/> : <List className="w-4 h-4"/>}
            {view === 'list' ? 'Calendar' : 'List'}
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
              <p className="app-caption text-muted-foreground mt-1.5 truncate">In progress</p>
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
        {!appReady && payoutsWithDetails.length === 0 ? (<SkeletonList count={3}/>) : payoutsWithDetails.length === 0 ? (<div className="rounded-xl border border-dashed border-border p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 text-primary/40">
              <Calendar className="w-10 h-10"/>
            </div>
            <h3 className="text-xl font-bold text-foreground">No Payouts Yet</h3>
            <p className="text-muted-foreground text-sm font-medium mt-2">Payouts will appear here when groups complete their rounds.</p>
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

      {assigningPayout && (<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setAssigningPayout(null)}>
          <div className="w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                <Users className="w-5 h-5"/>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Assign Recipient</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  {assigningPayout.groupName} · Round {assigningPayout.round}
                </p>
              </div>
            </div>

            <label className="block text-xs uppercase tracking-wide font-bold text-muted-foreground mb-2">
              Member
            </label>
            <select value={selectedRecipient} onChange={(event) => setSelectedRecipient(event.target.value)} className="w-full rounded-2xl bg-background border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-primary">
              <option value="">Select a member</option>
              {users
                .filter(member => member.role === 'member' && member.status === 'approved' && String(member.groupId) === String(assigningPayout.groupId))
                .map(member => (<option key={member.id} value={member.id}>
                    {member.fullName || member.name}
                  </option>))}
            </select>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => setAssigningPayout(null)} className="rounded-2xl bg-border text-foreground/70 py-3 text-xs font-bold uppercase tracking-wide hover:bg-accent transition-colors">
                Cancel
              </button>
              <button type="button" disabled={!selectedRecipient} onClick={handleAssignRecipient} className="rounded-2xl bg-primary text-foreground py-3 text-xs font-bold uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed">
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
        return (<div className="glass-card rounded-[2.5rem] border border-dashed border-border p-16 text-center text-muted-foreground text-sm font-medium">
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
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mt-0.5 truncate">{p.groupName} · Round {p.round}</p>
                </div>
                <div className="text-right">
                  <p className="text-foreground font-bold text-sm tabular-nums">{p.scheduledDate}</p>
                  <p className={cn("text-xs font-bold uppercase tracking-widest mt-0.5", p.status === 'completed' || p.paid ? 'text-success/60' : 'text-primary/60')}>
                    {p.status === 'completed' || p.paid ? 'Completed' : 'Scheduled'}
                  </p>
                </div>
              </div>))}
          </div>
        </div>))}
    </div>);
}

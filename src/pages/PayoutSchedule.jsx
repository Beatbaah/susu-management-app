import { Calendar, Clock, List, CalendarDays, CheckCircle2, Users } from 'lucide-react';
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
    const isOpenPayout = (payout) => !payout.paid && !['completed', 'paid'].includes(String(payout.status || '').toLowerCase());
    const scheduled = payoutsWithDetails.filter(isOpenPayout);
    const completed = payoutsWithDetails.filter(p => p.status === 'completed' || p.status === 'paid');
    const totalScheduledAmount = scheduled.reduce((sum, p) => sum + Number(p.payoutAmount || p.amount || 0), 0);
    const totalCompletedAmount = completed.reduce((sum, p) => sum + Number(p.payoutAmount || p.amount || 0), 0);
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
        if (!isOpenPayout(payout) || !canManage)
            return null;
        if (!payout.memberId && !payout.recipientId) {
            return (<button type="button" onClick={() => openAssign(payout)} className="w-full bg-accent text-foreground py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wide hover:bg-accent active:scale-95 transition-all mt-4 flex items-center justify-center gap-2">
          <Users className="w-4 h-4"/>
          Assign Recipient
        </button>);
        }
        return (<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <button type="button" onClick={() => openAssign(payout)} className="w-full bg-accent text-foreground py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wide hover:bg-accent active:scale-95 transition-all">
          Change Recipient
        </button>
        <button type="button" onClick={() => {
                const result = completePayout(payout.id);
                if (result?.ok === false)
                    toast.error(result.message || 'Could not complete payout');
                else
                    toast.success(`Payout to ${payout.memberName} marked completed`);
            }} className="w-full bg-primary text-foreground py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wide shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
          Mark Completed
        </button>
      </div>);
    };
    return (<div className="pb-32 page-enter">
      <div className="px-6 md:px-10 pt-10 pb-8">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground/50">Payout Timeline</p>
            </div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none mb-2">Payouts</h1>
            <p className="text-muted-foreground text-sm font-medium">Scheduled disbursement of group savings pools.</p>
          </div>
          <button type="button" onClick={() => setView(v => (v === 'list' ? 'calendar' : 'list'))} className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-border border border-border text-xs font-bold uppercase tracking-widest text-foreground/70 hover:bg-accent hover:text-foreground transition-all shadow-xl">
            {view === 'list' ? <CalendarDays className="w-4 h-4"/> : <List className="w-4 h-4"/>}
            {view === 'list' ? 'Calendar' : 'List'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-10">
          <div className="glass-card p-6 rounded-[2.5rem] border border-border relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-primary/10 blur-3xl rounded-full"/>
            <div className="relative z-10">
              <Clock className="w-8 h-8 text-primary mb-4"/>
              <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest mb-1.5">Scheduled</p>
              <p className="text-3xl font-bold text-foreground tracking-tighter stat-value leading-none mb-2">{scheduled.length}</p>
              <p className="text-xs text-primary/60 font-bold uppercase tracking-widest">{fmt(totalScheduledAmount)}</p>
            </div>
          </div>
          <div className="glass-card p-6 rounded-[2.5rem] border border-border relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-success/10 blur-3xl rounded-full"/>
            <div className="relative z-10">
              <CheckCircle2 className="w-8 h-8 text-success mb-4"/>
              <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest mb-1.5">Disbursed</p>
              <p className="text-3xl font-bold text-foreground tracking-tighter stat-value leading-none mb-2">{completed.length}</p>
              <p className="text-xs text-success/60 font-bold uppercase tracking-widest">{fmt(totalCompletedAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10">
        {!appReady && payoutsWithDetails.length === 0 ? (<SkeletonList count={3}/>) : payoutsWithDetails.length === 0 ? (<div className="glass-card rounded-[2.5rem] border border-dashed border-border p-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 text-primary/40">
              <Calendar className="w-10 h-10"/>
            </div>
            <h3 className="text-xl font-bold text-foreground">No Payouts Yet</h3>
            <p className="text-muted-foreground/40 text-sm font-medium mt-2">Payouts will appear here when groups complete their rounds.</p>
          </div>) : view === 'calendar' ? (<CalendarView payouts={payoutsWithDetails}/>) : (<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {payoutsWithDetails.map((payout) => (<PayoutCard key={payout.id} memberName={payout.memberName} groupName={payout.groupName} payoutAmount={Number(payout.payoutAmount || payout.amount || 0)} scheduledDate={payout.scheduledDate} paidAt={payout.paidAt} status={payout.status} round={payout.round || 0} totalRounds={payout.totalRounds} footer={renderFooter(payout)}/>))}
          </div>)}
      </div>

      {assigningPayout && (<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setAssigningPayout(null)}>
          <div className="w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                <Users className="w-5 h-5"/>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Assign Recipient</h2>
                <p className="text-xs text-muted-foreground/60 font-medium">
                  {assigningPayout.groupName} · Round {assigningPayout.round}
                </p>
              </div>
            </div>

            <label className="block text-xs uppercase tracking-wide font-bold text-muted-foreground/50 mb-2">
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
        return (<div className="glass-card rounded-[2.5rem] border border-dashed border-border p-16 text-center text-muted-foreground/40 text-sm font-medium">
        No scheduled dates to display in calendar.
      </div>);
    }
    return (<div className="space-y-12">
      {sortedKeys.map(key => (<div key={key}>
          <div className="flex items-center gap-4 mb-6">
            <p className="eyebrow text-muted-foreground/50 whitespace-nowrap">
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
                  <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest mt-0.5 truncate">{p.groupName} · Round {p.round}</p>
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

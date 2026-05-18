import { Search, AlertCircle, Phone, Send, ShieldX, Flame, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import { getDefaulterRisk } from '../utils/financeValidation';
import { toast } from '../utils/toast';
import { cn } from '../components/ui/utils';
export function Defaulters() {
    const { authUser, users, payments, groups, sendReminder, updateMember } = useAppContext();
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
            if (!member)
                return null;
            const group = groups.find(g => g.id === member.groupId);
            const memberOverdue = overdue.filter(p => (p.memberId || p.userId) === memberId);
            const totalDue = memberOverdue.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const daysList = memberOverdue.map(p => getDefaulterRisk(p, today).daysOverdue);
            const maxDays = daysList.length ? Math.max(...daysList) : 0;
            const sortedByDue = [...memberOverdue].sort((a, b) => new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime());
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
                riskLevel: maxDays > 30 ? 'critical' : maxDays > 14 ? 'high' : 'medium',
            };
        }).filter(Boolean);
    }, [users, payments, groups, today]);
    const filtered = defaulters.filter(d => !search.trim() ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.phone.includes(search) ||
        d.group.toLowerCase().includes(search.toLowerCase()));
    const avgDaysLate = defaulters.length ? Math.round(defaulters.reduce((s, d) => s + d.daysOverdue, 0) / defaulters.length) : 0;
    const totalOverdueAmount = defaulters.reduce((s, d) => s + d.dueAmount, 0);
    const handleReinstate = (d) => {
        updateMember(d.id, { status: 'approved' });
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
    return (<div className="pb-32 page-enter">
      <div className="px-6 md:px-10 pt-10 pb-8">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-destructive/20 flex items-center justify-center">
                <ShieldX className="w-4 h-4 text-destructive"/>
              </div>
              <p className="eyebrow text-muted-foreground/50">Risk Management</p>
            </div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none mb-2">Defaulters</h1>
            <p className="text-muted-foreground text-sm font-medium">Members with overdue payments requiring immediate attention.</p>
          </div>
          {defaulters.length > 0 && (<div className="w-14 h-14 rounded-2xl bg-destructive/15 flex items-center justify-center border border-destructive/30 flex-shrink-0">
              <span className="text-destructive font-bold text-xl">{defaulters.length}</span>
            </div>)}
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-5 mb-10">
          <div className="glass-card p-6 rounded-3xl border border-destructive/10 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-destructive/10 blur-2xl rounded-full group-hover:bg-destructive/20 transition-colors"/>
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest mb-1.5">Total Overdue</p>
              <p className="text-3xl font-bold text-destructive tracking-tighter stat-value leading-none">{fmt(totalOverdueAmount)}</p>
              <p className="text-xs text-muted-foreground/30 uppercase font-bold tracking-widest mt-2">Across {defaulters.length} members</p>
            </div>
          </div>
          <div className="glass-card p-6 rounded-3xl border border-warning/10 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-warning/10 blur-2xl rounded-full group-hover:bg-warning/20 transition-colors"/>
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest mb-1.5">Avg Days Late</p>
              <p className="text-3xl font-bold text-warning tracking-tighter stat-value leading-none">{avgDaysLate}</p>
              <p className="text-xs text-muted-foreground/30 uppercase font-bold tracking-widest mt-2">Days past due date</p>
            </div>
          </div>
        </div>

        {defaulters.length > 0 && (<div className="flex items-start gap-4 p-5 rounded-[1.5rem] bg-destructive/8 border border-destructive/20 mb-8">
            <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 text-destructive"/>
            </div>
            <div>
              <p className="text-sm font-bold text-destructive mb-0.5">Collection Alert Active</p>
              <p className="text-xs text-destructive/70 font-medium">{defaulters.length} member{defaulters.length !== 1 ? 's' : ''} with overdue payments. Send reminders to maintain cycle integrity.</p>
            </div>
          </div>)}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30"/>
          <input type="text" placeholder="Search by name, phone, or group…" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-14 pr-5 py-4 bg-input-background rounded-2xl border border-border focus:bg-card focus:border-destructive/20 focus:ring-4 focus:ring-destructive/5 text-sm font-bold text-foreground placeholder:text-muted-foreground/30 outline-none transition-all"/>
        </div>
      </div>

      {/* Defaulter cards */}
      <div className="px-6 md:px-10 space-y-5 max-w-4xl">
        {filtered.length === 0 ? (<div className={cn("glass-card rounded-[2.5rem] border border-dashed p-16 text-center", defaulters.length === 0 ? 'border-success/20' : 'border-border')}>
            <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6", defaulters.length === 0 ? 'bg-success/10 text-success/40' : 'bg-border text-foreground/20')}>
              <AlertCircle className="w-10 h-10"/>
            </div>
            <h3 className="text-xl font-bold text-foreground">{defaulters.length === 0 ? 'All Clear!' : 'No Matches'}</h3>
            <p className="text-muted-foreground/40 text-sm mt-2">{defaulters.length === 0 ? 'All members are up to date on their payments.' : 'Try a different search term.'}</p>
          </div>) : filtered.map(d => (<div key={d.id} className="glass-card card-hover rounded-[2rem] border border-destructive/20 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-destructive/5 blur-3xl rounded-full pointer-events-none"/>
            <div className="p-6 relative z-10">
              <div className="flex items-start gap-5 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center text-destructive font-bold text-xl flex-shrink-0 border border-destructive/20 transition-transform group-hover:scale-105">
                  {d.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-foreground truncate tracking-tight mb-0.5">{d.name}</h4>
                  <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest mb-3">{d.group}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border", riskColor(d.riskLevel))}>
                      {d.daysOverdue > 0 ? `${d.daysOverdue}d overdue` : 'Suspended'}
                    </span>
                    {d.status === 'suspended' && (<span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-destructive/20 text-destructive border border-destructive/30">Suspended</span>)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground/30 uppercase font-bold tracking-widest mb-1">Amount Due</p>
                  <p className="text-xl font-bold text-destructive tracking-tighter">{fmt(d.dueAmount)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 pt-5 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground/30 uppercase font-bold tracking-widest mb-1">Due Date</p>
                  <p className="text-sm font-bold text-foreground/70">{d.dueDate}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground/30 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3"/> Contact
                  </p>
                  <p className="text-sm font-bold text-foreground/70">{d.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground/30 uppercase font-bold tracking-widest mb-1">Missed</p>
                  <p className="text-sm font-bold text-destructive">{d.totalMissed} payments</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => handleSendReminder(d)} className={cn("flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide transition-all", sentTo === d.id
                ? 'bg-success/20 text-success border border-success/30'
                : 'bg-primary text-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95')}>
                  <Send className="w-4 h-4"/>
                  {sentTo === d.id ? 'Reminder Sent ✓' : 'Send Reminder'}
                </button>
                <a href={d.phone ? `tel:${d.phone}` : '#'} className={cn("flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide bg-border border border-border transition-all", d.phone ? 'text-foreground/70 hover:bg-accent hover:text-foreground' : 'text-foreground/20 cursor-not-allowed')} onClick={e => { if (!d.phone)
            e.preventDefault(); }}>
                  <Phone className="w-4 h-4"/>
                  Call Member
                </a>
              </div>
              {canManage && d.status === 'suspended' && (
                <button type="button" onClick={() => handleReinstate(d)} className="w-full mt-3 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-all">
                  <UserCheck className="w-4 h-4"/>
                  Reinstate Member
                </button>
              )}
            </div>
          </div>))}
      </div>
    </div>);
}

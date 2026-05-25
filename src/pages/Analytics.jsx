import { TrendingUp, TrendingDown, BarChart3, Calendar, Activity, Zap, X, User, ChevronRight } from 'lucide-react';
import { isFirestoreReady } from '../services/firestoreSync';
import { BarChart, Bar, PieChart as RPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { calculateFinancialMetrics } from '../utils/financeValidation';
import { fmt } from '../utils/helpers';
import { cn } from '../components/ui/utils';
/** Pull chart colours from CSS custom properties so they update with light/dark mode. */
function getCSSVar(name) {
    if (typeof window === 'undefined')
        return '#6c8cff';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#6c8cff';
}
const CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'var(--color-primary)',
];
const tooltipStyle = {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    color: 'var(--foreground)',
    fontSize: '12px',
    fontWeight: '700',
    padding: '10px 14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key) => {
    const [, m] = key.split('-');
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1] || key;
};
const dayLabel = (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
export function Analytics() {
    const { payments, groups, schedule, users } = useAppContext();
    const [rangeMonths, setRangeMonths] = useState(6);
    const [selectedMemberId, setSelectedMemberId] = useState(null);
    const metrics = useMemo(() => calculateFinancialMetrics({ payments, groups, payouts: schedule, users }), [payments, groups, schedule, users]);
    const collectionData = useMemo(() => {
        const now = new Date();
        const buckets = new Map();
        for (let i = rangeMonths - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = monthKey(d);
            buckets.set(key, { month: monthLabel(key), collected: 0, expected: 0 });
        }
        const expectedPerMonth = groups.reduce((sum, g) => {
            const contribution = Number(g.contributionAmount || g.contribution) || 0;
            const memberCount = Array.isArray(g.members) ? g.members.length : 0;
            const frequency = String(g.frequency || '').toLowerCase();
            const multiplier = frequency.includes('week') ? 4 : frequency.includes('day') ? 30 : 1;
            return sum + contribution * memberCount * multiplier;
        }, 0);
        buckets.forEach(b => { b.expected = expectedPerMonth; });
        payments.forEach(p => {
            if (p.status !== 'paid')
                return;
            const d = new Date(p.paymentDate || p.date);
            if (Number.isNaN(d.getTime()))
                return;
            const key = monthKey(d);
            const bucket = buckets.get(key);
            if (bucket)
                bucket.collected += Number(p.amount || 0);
        });
        return Array.from(buckets.values());
    }, [payments, groups, rangeMonths]);
    const groupPerformance = useMemo(() => {
        return groups.map((g, i) => {
            const groupPaid = payments
                .filter(p => p.groupId === g.id && p.status === 'paid')
                .reduce((sum, p) => sum + Number(p.amount || 0), 0);
            return {
                name: g.groupName || g.name || 'Group',
                value: groupPaid,
                color: CHART_COLORS[i % CHART_COLORS.length],
            };
        }).filter(p => p.value > 0);
    }, [groups, payments]);
    const paymentTrend = useMemo(() => {
        const now = new Date();
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            days.push({ day: dayLabel(d), date: d.toISOString().split('T')[0], payments: 0 });
        }
        payments.forEach(p => {
            const dStr = (p.paymentDate || p.date || '').split('T')[0];
            const found = days.find(d => d.date === dStr);
            if (found)
                found.payments += 1;
        });
        return days;
    }, [payments]);
    const avgPaymentTime = useMemo(() => {
        const paid = payments.filter(p => p.status === 'paid' && p.dueDate && p.paymentDate);
        if (paid.length === 0)
            return 0;
        const totalDays = paid.reduce((sum, p) => {
            const diff = Math.floor((new Date(p.paymentDate).getTime() - new Date(p.dueDate).getTime()) / 86400000);
            return sum + diff;
        }, 0);
        return Math.round((totalDays / paid.length) * 10) / 10;
    }, [payments]);
    const memberStats = useMemo(() => {
        const memberUsers = users.filter(u => u.role === 'member' && u.status === 'approved');
        return memberUsers.map(u => {
            const memberPayments = payments.filter(p => (p.memberId || p.userId) === u.id);
            const paid = memberPayments.filter(p => p.status === 'paid');
            const pending = memberPayments.filter(p => p.status === 'pending');
            const overdue = memberPayments.filter(p => p.status === 'overdue');
            const totalPaid = paid.reduce((s, p) => s + Number(p.amount || 0), 0);
            const rate = memberPayments.length > 0 ? Math.round((paid.length / memberPayments.length) * 100) : 0;
            return { ...u, paid: paid.length, pending: pending.length, overdue: overdue.length, totalPaid, rate, history: [...memberPayments].sort((a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0)) };
        }).sort((a, b) => b.totalPaid - a.totalPaid);
    }, [users, payments]);

    const methodBreakdown = useMemo(() => {
        const map = {};
        payments.filter(p => p.status === 'paid').forEach(p => {
            const m = p.method || 'Cash';
            if (!map[m]) map[m] = { name: m, count: 0, amount: 0 };
            map[m].count++;
            map[m].amount += Number(p.amount || 0);
        });
        return Object.values(map).sort((a, b) => b.amount - a.amount);
    }, [payments]);

    const groupPnL = useMemo(() => {
        return groups.map(g => {
            const contribution = Number(g.contributionAmount || g.contribution) || 0;
            const memberCount = Array.isArray(g.members) ? g.members.length : Number(g.memberCount || g.totalSlots || 0);
            const currentRound = Number(g.currentRound || 0);
            const totalRounds = Number(g.totalRounds || g.totalSlots || memberCount || 1);
            const expectedToDate = contribution * memberCount * currentRound;
            const collected = payments.filter(p => p.groupId === g.id && p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const outstanding = Math.max(0, expectedToDate - collected);
            const rate = expectedToDate > 0 ? Math.round((collected / expectedToDate) * 100) : 0;
            const disbursed = schedule.filter(s => s.groupId === g.id && (s.status === 'completed' || s.paid)).reduce((sum, s) => sum + Number(s.payoutAmount || s.amount || 0), 0);
            return { id: g.id, name: g.groupName || g.name, currentRound, totalRounds, expectedToDate, collected, outstanding, disbursed, rate, memberCount };
        }).filter(g => g.expectedToDate > 0 || g.collected > 0);
    }, [groups, payments, schedule]);

    const selectedMember = selectedMemberId ? memberStats.find(m => m.id === selectedMemberId) : null;

    const collectionRate = Math.round(metrics.collectionRate || 0);
    const defaultRate = Math.round(metrics.defaultRate || 0);
    const activeCycles = groups.filter(g => (g.currentRound || 0) < (g.totalRounds || g.totalSlots || Infinity)).length;
    const totalCollected = metrics.totalPaid;
    const kpiCards = [
        {
            label: 'Collection Rate',
            value: `${collectionRate}%`,
            sub: 'Of expected to date',
            icon: TrendingUp,
            color: 'text-success',
            bg: 'bg-success/15',
            glow: 'bg-success',
            positive: collectionRate >= 70,
        },
        {
            label: 'Default Rate',
            value: `${defaultRate}%`,
            sub: 'Overdue / actionable',
            icon: TrendingDown,
            color: 'text-destructive',
            bg: 'bg-destructive/15',
            glow: 'bg-destructive',
            positive: defaultRate < 10,
        },
        {
            label: 'Avg Payment Lag',
            value: avgPaymentTime >= 0 ? `+${avgPaymentTime}d` : `${avgPaymentTime}d`,
            sub: 'Days after due date',
            icon: Calendar,
            color: 'text-warning',
            bg: 'bg-warning/15',
            glow: 'bg-warning',
            positive: avgPaymentTime <= 0,
        },
        {
            label: 'Active Cycles',
            value: activeCycles,
            sub: 'Running groups',
            icon: Activity,
            color: 'text-primary',
            bg: 'bg-primary/15',
            glow: 'bg-primary',
            positive: true,
        },
    ];
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      {/* Page Header */}
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
            </div>
            <p className="eyebrow text-muted-foreground">Financial Intelligence</p>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Analytics <span className="text-primary">Hub</span></h1>
          <p className="text-muted-foreground text-sm">Real-time collection performance and group insights.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (<div key={card.label} className="bg-card card-hover p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-border relative overflow-hidden group">
                <div className={cn("absolute -right-8 -top-8 w-28 h-28 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity rounded-full", card.glow)}/>
                <div className={cn("w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4", card.bg)}>
                  <Icon className={cn("w-6 h-6", card.color)}/>
                </div>
                <p className="eyebrow text-muted-foreground mb-1.5">{card.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground stat-value leading-none mb-1 sm:mb-2">{card.value}</p>
                <p className="eyebrow text-muted-foreground">{card.sub}</p>
              </div>);
        })}
        </div>
      </div>

      <div className="px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

        {/* Left Column */}
        <div className="lg:col-span-8 space-y-8">

          {/* Collection vs Expected Chart */}
          <div className="glass-card rounded-2xl p-8 border border-border relative overflow-hidden">
            <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
              <div>
                <h3 className="text-xl font-bold text-foreground tracking-tight">Collection vs Target</h3>
                <p className="eyebrow text-muted-foreground mt-1">Monthly performance comparison</p>
              </div>
              <div className="flex items-center gap-2">
                {[3, 6, 12].map(n => (
                  <button key={n} type="button" onClick={() => setRangeMonths(n)}
                    className={cn('px-2.5 py-1 rounded-lg app-tab transition-colors border',
                      rangeMonths === n
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-border text-muted-foreground border-border hover:text-foreground')}>
                    {n}M
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-5 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" aria-hidden="true"/>
                <span className="eyebrow text-muted-foreground">Collected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-border" aria-hidden="true"/>
                <span className="eyebrow text-muted-foreground">Target</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={collectionData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="month" stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }}/>
                <YAxis stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }}/>
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }}/>
                <Bar dataKey="collected" name="Collected" fill="var(--chart-1)" radius={[8, 8, 0, 0]}/>
                <Bar dataKey="expected" name="Target" fill="var(--border)" radius={[8, 8, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
              <div>
                <p className="eyebrow text-muted-foreground mb-1">Total Collected YTD</p>
                <p className="text-2xl font-bold text-primary tracking-tighter">{fmt(totalCollected)}</p>
              </div>
              {isFirestoreReady() && (
                <div className="flex items-center gap-2 text-xs font-bold text-success/60 uppercase tracking-widest">
                  <Zap className="w-4 h-4 fill-success/40"/>
                  Live Data
                </div>
              )}
            </div>
          </div>

          {/* Weekly Activity Chart */}
          <div className="glass-card rounded-2xl p-8 border border-border">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-foreground tracking-tight">Weekly Transaction Volume</h3>
              <p className="eyebrow text-muted-foreground mt-1">Payment count over last 7 days</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={paymentTrend}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="day" stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }}/>
                <YAxis allowDecimals={false} stroke="transparent" tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }}/>
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--primary)', strokeOpacity: 0.3, strokeWidth: 1 }}/>
                <Area type="monotone" dataKey="payments" name="Payments" stroke="var(--chart-1)" strokeWidth={3} fill="url(#areaGradient)" dot={{ fill: 'var(--chart-1)', r: 5, strokeWidth: 0 }} activeDot={{ r: 7, fill: 'var(--chart-5)' }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-8">

          {/* Group Performance Pie Chart */}
          {groupPerformance.length > 0 && (<div className="glass-card rounded-2xl p-8 border border-border">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground tracking-tight">Group Share</h3>
                <p className="eyebrow text-muted-foreground mt-1">Collection by group</p>
              </div>
              <div className="flex justify-center mb-6">
                <ResponsiveContainer width="100%" height={180}>
                  <RPieChart>
                    <Pie data={groupPerformance} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                      {groupPerformance.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} opacity={0.85}/>))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)}/>
                  </RPieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {groupPerformance.map((item) => (<div key={item.name} className="flex items-center justify-between group/item py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}/>
                      <span className="text-sm font-semibold text-foreground/70 truncate group-hover/item:text-foreground transition-colors">{item.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground/50 tabular-nums">{fmt(item.value)}</span>
                  </div>))}
              </div>
            </div>)}

          {/* Summary Stats */}
          <div className="glass-card rounded-2xl p-8 border border-border space-y-5">
            <h3 className="text-xl font-bold text-foreground tracking-tight">Health Score</h3>
            {[
            { label: 'On-Time Rate', value: `${Math.max(0, 100 - defaultRate)}%`, color: 'bg-success' },
            { label: 'Collection Efficiency', value: `${collectionRate}%`, color: 'bg-primary' },
            { label: 'Default Exposure', value: `${defaultRate}%`, color: 'bg-destructive' },
        ].map(({ label, value, color }) => {
            const pct = parseInt(value);
            return (<div key={label}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="eyebrow text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold text-foreground">{value}</p>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden border border-border">
                    <div className={cn("h-full rounded-full progress-smooth shadow-sm", color)} style={{ width: value }}/>
                  </div>
                </div>);
        })}
          </div>
        </div>
      </div>

      {/* Member Performance Drill-down */}
      {memberStats.length > 0 && (
        <div className="px-4 sm:px-6 mt-6 sm:mt-8">
          <div className="glass-card rounded-2xl p-6 sm:p-8 border border-border">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-foreground tracking-tight">Member Performance</h3>
              <p className="eyebrow text-muted-foreground mt-1">Click a member to see their payment history</p>
            </div>
            <div className="space-y-2">
              {memberStats.map(m => (
                <button key={m.id} type="button" onClick={() => setSelectedMemberId(m.id)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 p-3.5 rounded-xl text-left',
                    'border border-transparent hover:border-border hover:bg-accent/40',
                    'transition-all duration-200 group'
                  )}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm',
                      m.overdue > 0 ? 'bg-destructive/15 text-destructive' : m.rate >= 80 ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'
                    )}>
                      {(m.fullName || m.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="body-strong text-foreground truncate group-hover:text-primary transition-colors">{m.fullName || m.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="eyebrow text-muted-foreground">{m.paid} paid</span>
                        {m.pending > 0 && <span className="eyebrow text-primary/70">{m.pending} pending</span>}
                        {m.overdue > 0 && <span className="eyebrow text-destructive/70">{m.overdue} overdue</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="body-strong text-foreground">{fmt(m.totalPaid)}</p>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', m.rate >= 80 ? 'bg-success' : m.rate >= 50 ? 'bg-primary' : 'bg-destructive')}
                            style={{ width: `${m.rate}%` }}/>
                        </div>
                        <span className="eyebrow text-muted-foreground">{m.rate}%</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors"/>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Per-group P&L */}
      {groupPnL.length > 0 && (
        <div className="px-4 sm:px-6 mt-6 sm:mt-8">
          <div className="glass-card rounded-2xl p-6 sm:p-8 border border-border">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-foreground tracking-tight">Cycle P&amp;L by Group</h3>
              <p className="eyebrow text-muted-foreground mt-1">Collection performance per active cycle to date</p>
            </div>
            <div className="space-y-4">
              {groupPnL.map(g => (
                <div key={g.id} className="p-4 rounded-xl border border-border hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="min-w-0">
                      <p className="body-strong text-foreground truncate">{g.name}</p>
                      <p className="eyebrow text-muted-foreground mt-0.5">Round {g.currentRound} / {g.totalRounds} · {g.memberCount} members</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn('text-sm font-bold tabular-nums', g.outstanding > 0 ? 'text-destructive' : 'text-success')}>
                        {g.outstanding > 0 ? `-${fmt(g.outstanding)}` : 'Fully collected'}
                      </p>
                      <p className="eyebrow text-muted-foreground mt-0.5">outstanding</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: 'Expected', value: fmt(g.expectedToDate), color: 'text-muted-foreground' },
                      { label: 'Collected', value: fmt(g.collected), color: 'text-success' },
                      { label: 'Disbursed', value: fmt(g.disbursed), color: 'text-primary' },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className={cn('text-sm font-bold tabular-nums', s.color)}>{s.value}</p>
                        <p className="eyebrow text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', g.rate >= 80 ? 'bg-success' : g.rate >= 50 ? 'bg-primary' : 'bg-destructive')}
                        style={{ width: `${Math.min(100, g.rate)}%` }}/>
                    </div>
                    <span className="eyebrow text-muted-foreground w-10 text-right">{g.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Breakdown */}
      {methodBreakdown.length > 0 && (
        <div className="px-4 sm:px-6 mt-6 sm:mt-8">
          <div className="glass-card rounded-2xl p-6 sm:p-8 border border-border">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-foreground tracking-tight">Payment Method Breakdown</h3>
              <p className="eyebrow text-muted-foreground mt-1">Volume and value by channel</p>
            </div>
            {(() => {
              const maxAmount = methodBreakdown[0]?.amount || 1;
              return (
                <div className="space-y-4">
                  {methodBreakdown.map((m, i) => (
                    <div key={m.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}/>
                          <span className="body text-foreground">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="eyebrow text-muted-foreground">{m.count} txn{m.count !== 1 ? 's' : ''}</span>
                          <span className="body-strong text-foreground tabular-nums w-24 text-right">{fmt(m.amount)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round((m.amount / maxAmount) * 100)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}/>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedMemberId(null)}>
          <div className={cn(
            'relative w-full max-w-lg bg-card border border-border',
            'rounded-2xl shadow-2xl overflow-hidden',
            'max-h-[85dvh] flex flex-col z-10 animate-in zoom-in-95 duration-300'
          )} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm',
                  selectedMember.overdue > 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
                )}>
                  {(selectedMember.fullName || selectedMember.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="body-strong text-foreground">{selectedMember.fullName || selectedMember.name}</p>
                  <p className="eyebrow text-muted-foreground mt-0.5">{selectedMember.email}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedMemberId(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <X className="w-4 h-4"/>
              </button>
            </div>

            <div className="p-5 border-b border-border flex-shrink-0">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Paid', value: selectedMember.paid, color: 'text-success' },
                  { label: 'Pending', value: selectedMember.pending, color: 'text-primary' },
                  { label: 'Overdue', value: selectedMember.overdue, color: 'text-destructive' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl bg-accent/50 border border-border text-center">
                    <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                    <p className="eyebrow text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="eyebrow text-muted-foreground">Total collected</p>
                <p className="body-strong text-primary">{fmt(selectedMember.totalPaid)}</p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', selectedMember.rate >= 80 ? 'bg-success' : selectedMember.rate >= 50 ? 'bg-primary' : 'bg-destructive')}
                    style={{ width: `${selectedMember.rate}%` }}/>
                </div>
                <span className="eyebrow text-muted-foreground">{selectedMember.rate}% on-time</span>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              <p className="eyebrow text-muted-foreground mb-3">Payment history</p>
              {selectedMember.history.length === 0 ? (
                <div className="py-8 text-center">
                  <User className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
                  <p className="eyebrow text-muted-foreground">No payments recorded</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedMember.history.map(p => {
                    const grp = groups.find(g => g.id === p.groupId);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors">
                        <div className="min-w-0">
                          <p className="body text-foreground truncate">{grp?.groupName || grp?.name || 'Group'}</p>
                          <p className="eyebrow text-muted-foreground mt-0.5">
                            {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="body-strong text-foreground">{fmt(p.amount)}</p>
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-md text-xs font-medium mt-0.5',
                            p.status === 'paid' ? 'bg-success/15 text-success' :
                            p.status === 'overdue' ? 'bg-destructive/15 text-destructive' :
                            'bg-primary/15 text-primary'
                          )}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>);
}

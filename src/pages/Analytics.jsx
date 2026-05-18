import { TrendingUp, TrendingDown, BarChart3, Calendar, Activity, Zap } from 'lucide-react';
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
    const { payments, groups, schedule } = useAppContext();
    const [rangeMonths, setRangeMonths] = useState(6);
    const metrics = useMemo(() => calculateFinancialMetrics({ payments, groups, payouts: schedule }), [payments, groups, schedule]);
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
    const collectionRate = Math.round(metrics.collectionRate || 0);
    const defaultRate = Math.round(metrics.defaultRate || 0);
    const activeCycles = groups.filter(g => (g.currentRound || 0) < (g.totalRounds || g.totalSlots || Infinity)).length;
    const totalCollected = metrics.totalPaid;
    const kpiCards = [
        {
            label: 'Collection Rate',
            value: `${collectionRate}%`,
            sub: 'Of expected pool',
            icon: TrendingUp,
            color: 'text-success',
            bg: 'bg-success/15',
            glow: 'bg-success',
            positive: collectionRate >= 70,
        },
        {
            label: 'Default Rate',
            value: `${defaultRate}%`,
            sub: 'Overdue / total',
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
    return (<div className="pb-32 page-enter">
      {/* Page Header */}
      <div className="px-6 md:px-10 pt-10 pb-8">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary"/>
            </div>
            <p className="eyebrow text-muted-foreground/50">Financial Intelligence</p>
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none mb-2">
            Analytics <span className="text-primary">Hub</span>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Real-time collection performance and group insights.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (<div key={card.label} className="glass-card card-hover p-6 rounded-2xl border border-border relative overflow-hidden group">
                <div className={cn("absolute -right-8 -top-8 w-28 h-28 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity rounded-full", card.glow)}/>
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shadow-inner transition-transform group-hover:scale-110 group-hover:rotate-6", card.bg)}>
                  <Icon className={cn("w-6 h-6", card.color)}/>
                </div>
                <p className="eyebrow text-muted-foreground/50 mb-1.5">{card.label}</p>
                <p className="text-3xl font-bold text-foreground tracking-tighter stat-value leading-none mb-2">{card.value}</p>
                <p className="eyebrow text-muted-foreground/40">{card.sub}</p>
              </div>);
        })}
        </div>
      </div>

      <div className="px-6 md:px-10 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column */}
        <div className="lg:col-span-8 space-y-8">

          {/* Collection vs Expected Chart */}
          <div className="glass-card rounded-2xl p-8 border border-border relative overflow-hidden">
            <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
              <div>
                <h3 className="text-xl font-bold text-foreground tracking-tight">Collection vs Target</h3>
                <p className="eyebrow text-muted-foreground/50 mt-1">Monthly performance comparison</p>
              </div>
              <div className="flex items-center gap-2">
                {[3, 6, 12].map(n => (
                  <button key={n} type="button" onClick={() => setRangeMonths(n)}
                    className={cn('px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border',
                      rangeMonths === n
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-border text-muted-foreground/60 border-border hover:text-foreground')}>
                    {n}M
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-5 text-xs font-bold uppercase tracking-widest mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary"/>
                <span className="text-muted-foreground/50">Collected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-border"/>
                <span className="text-muted-foreground/50">Target</span>
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
                <p className="eyebrow text-muted-foreground/50 mb-1">Total Collected YTD</p>
                <p className="text-2xl font-bold text-primary tracking-tighter">{fmt(totalCollected)}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-success/60 uppercase tracking-widest">
                <Zap className="w-4 h-4 fill-success/40"/>
                Live Data
              </div>
            </div>
          </div>

          {/* Weekly Activity Chart */}
          <div className="glass-card rounded-2xl p-8 border border-border">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-foreground tracking-tight">Weekly Transaction Volume</h3>
              <p className="eyebrow text-muted-foreground/50 mt-1">Payment count over last 7 days</p>
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
                <p className="eyebrow text-muted-foreground/50 mt-1">Collection by group</p>
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
                    <p className="eyebrow text-muted-foreground/50">{label}</p>
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
    </div>);
}

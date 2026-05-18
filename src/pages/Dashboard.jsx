import { TrendingUp, TrendingDown, Users, Users2, DollarSign, AlertCircle, CheckCircle, ChevronRight, ArrowRight, Zap, History, } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { StatCard } from '../components/ui/StatCard';
import { useAppContext } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import { cn } from '../components/ui/utils';
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export function Dashboard({ user, onNavigate }) {
    const { users, groups, payments, schedule } = useAppContext();
    const memberUsers = useMemo(() => users.filter(u => u.role === 'member'), [users]);
    const approvedMembers = useMemo(() => memberUsers.filter(u => u.status === 'approved'), [memberUsers]);
    const paidPayments = useMemo(() => payments.filter(p => p.status === 'paid'), [payments]);
    const overduePayments = useMemo(() => payments.filter(p => p.status === 'overdue'), [payments]);
    const totalExpectedLifecycle = useMemo(() => groups.reduce((sum, g) => {
        const contribution = Number(g.contributionAmount || g.contribution || 0);
        const membersCount = Array.isArray(g.members) ? g.members.length : 0;
        const rounds = Number(g.totalRounds || g.totalSlots || membersCount || 1);
        return sum + contribution * membersCount * rounds;
    }, 0), [groups]);
    const totalCollected = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const collectionRate = totalExpectedLifecycle > 0
        ? Math.min(100, Math.round((totalCollected / totalExpectedLifecycle) * 100))
        : 0;
    const { trendDelta, trendChartData } = useMemo(() => {
        const now = new Date();
        const buckets = new Map();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            buckets.set(monthKey(d), 0);
        }
        paidPayments.forEach(p => {
            const d = new Date(p.paymentDate || p.date);
            if (Number.isNaN(d.getTime()))
                return;
            const key = monthKey(d);
            if (buckets.has(key))
                buckets.set(key, (buckets.get(key) || 0) + Number(p.amount || 0));
        });
        const series = Array.from(buckets.values()).map(value => ({ value }));
        const last = series[series.length - 1]?.value || 0;
        const prev = series[series.length - 2]?.value || 0;
        const delta = prev > 0 ? Math.round(((last - prev) / prev) * 100) : last > 0 ? 100 : 0;
        return { trendDelta: delta, trendChartData: series };
    }, [paidPayments]);
    const upcomingPayouts = schedule
        .filter(p => p.status === 'scheduled')
        .slice(0, 3)
        .map(payout => {
        const member = users.find(m => m.id === (payout.memberId || payout.recipientId));
        const group = groups.find(g => g.id === payout.groupId);
        return {
            ...payout,
            memberName: member?.fullName || member?.name || '',
            groupName: group?.groupName || group?.name || '',
        };
    });
    const recentPayments = [...payments]
        .sort((a, b) => new Date(b.paymentDate || b.date || 0).getTime() -
        new Date(a.paymentDate || a.date || 0).getTime())
        .slice(0, 4)
        .map(payment => {
        const member = users.find(m => m.id === (payment.memberId || payment.userId));
        const group = groups.find(g => g.id === payment.groupId);
        return {
            ...payment,
            memberName: member?.fullName || member?.name || '',
            groupName: group?.groupName || group?.name || '',
        };
    });
    const pendingCount = payments.filter(p => p.status === 'pending').length;
    const defaulterCount = new Set(overduePayments.map(p => p.userId || p.memberId)).size;
    const statusPill = (status) => {
        if (status === 'paid')
            return 'bg-success/15 text-success';
        if (status === 'pending')
            return 'bg-primary/15 text-primary';
        return 'bg-destructive/15 text-destructive';
    };
    return (<div className="pb-28 page-enter">
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-4 sm:pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-success"/>
            <p className="eyebrow text-muted-foreground/50">Live</p>
          </div>

          <h1 className="page-title text-foreground mb-1">
            Morning, <span className="text-primary">{user.name.split(' ')[0]}</span>
          </h1>

          <p className="body text-muted-foreground/70">
            {pendingCount > 0 ? (<>{pendingCount} transaction{pendingCount !== 1 ? 's' : ''} pending confirmation.</>) : ('No pending actions. All clear.')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
          <button onClick={() => onNavigate?.('payments')} className={cn('h-9 px-3.5 rounded-lg text-[13px] font-medium', 'flex flex-1 sm:flex-none items-center justify-center gap-1.5', 'bg-accent border border-border', 'hover:bg-accent/80 transition-colors duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60')}>
            <History className="w-3.5 h-3.5 text-primary"/>
            <span>Activity</span>
          </button>
          <button onClick={() => onNavigate?.('analytics')} className={cn('h-9 px-3.5 rounded-lg text-[13px] font-medium', 'flex flex-1 sm:flex-none items-center justify-center gap-1.5', 'bg-primary text-primary-foreground', 'hover:opacity-90 active:scale-95 transition-all duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60')}>
            <Zap className="w-3.5 h-3.5"/>
            <span>Reports</span>
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        <div className="lg:col-span-8 space-y-6">
          <div className="elevation-2 rounded-xl overflow-hidden">
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">

              <div className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 mb-2.5">
                    <DollarSign className="w-3 h-3 text-primary/70" aria-hidden="true"/>
                    <span className="eyebrow text-primary/70">Total pool collected</span>
                  </div>
                  <p className="text-2xl font-semibold text-foreground tracking-tight stat-value leading-none break-words">
                    {fmt(totalCollected)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                      <TrendingUp className="w-3.5 h-3.5 text-success" aria-hidden="true"/>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-none">{collectionRate}%</p>
                      <p className="eyebrow text-muted-foreground/50 mt-0.5">Success rate</p>
                    </div>
                  </div>

                  <div aria-hidden="true" className="w-px h-6 bg-border"/>

                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true"/>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-none">{fmt(totalExpectedLifecycle)}</p>
                      <p className="eyebrow text-muted-foreground/50 mt-0.5">Lifecycle target</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full sm:w-[200px] md:w-[240px] h-[100px] sm:h-[80px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData}>
                    <defs>
                      <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fillOpacity={1} fill="url(#heroGrad)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard title="Active Groups" value={groups.length} icon={Users2} iconColor="bg-primary/15 text-primary" subtitle="Managed hubs"/>
            <StatCard title="Verified Members" value={approvedMembers.length} icon={Users} iconColor="bg-primary/10 text-primary/80" subtitle={`${memberUsers.length} total`}/>
            <StatCard title="Collection Rate" value={`${collectionRate}%`} icon={CheckCircle} iconColor="bg-success/15 text-success" trend={{ value: `${trendDelta}%`, isPositive: trendDelta >= 0 }}/>
            <StatCard title="Defaulters" value={defaulterCount} icon={AlertCircle} iconColor="bg-destructive/15 text-destructive" subtitle={`${overduePayments.length} overdue`}/>
          </div>

          <section className="elevation-3 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title text-foreground">Recent activity</h3>
                <p className="eyebrow text-muted-foreground/40 mt-0.5">Latest transactions</p>
              </div>
              <button onClick={() => onNavigate?.('payments')} className={cn('flex items-center gap-0.5 px-2.5 h-7 rounded-md text-[13px] font-medium', 'text-primary hover:bg-primary/8 transition-colors duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60')}>
                View all
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true"/>
              </button>
            </div>

            <div className="space-y-2">
              {recentPayments.length === 0 ? (<div className="py-10 text-center">
                  <p className="eyebrow text-muted-foreground/40">No recent transactions recorded</p>
                </div>) : recentPayments.map((payment) => (<div key={payment.id} className={cn('group flex items-center justify-between gap-3 p-3.5 rounded-xl', 'border border-transparent hover:border-border hover:bg-accent/40', 'transition-all duration-200')}>
                  <div className="flex items-center gap-3.5">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', 'font-bold text-sm flex-shrink-0', 'transition-transform duration-200 group-hover:scale-105', statusPill(payment.status))}>
                      {payment.memberName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="body-strong text-foreground group-hover:text-primary transition-colors truncate">
                        {payment.memberName}
                      </p>
                      <p className="eyebrow text-muted-foreground/60 mt-0.5 truncate">{payment.groupName}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="body-strong text-foreground">{fmt(payment.amount)}</p>
                    <p className="label text-muted-foreground/50 mt-0.5">
                      {payment.paymentDate
                ? new Date(payment.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Pending'}
                    </p>
                  </div>
                </div>))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <section className="elevation-3 rounded-xl p-4 sm:p-5 flex flex-col" style={{ minHeight: '260px' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title text-foreground">Growth trend</h3>
                <p className="eyebrow text-muted-foreground/40 mt-0.5">Collection performance</p>
              </div>
              <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', trendDelta >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                {trendDelta >= 0
            ? <TrendingUp className="w-3 h-3" aria-hidden="true"/>
            : <TrendingDown className="w-3 h-3" aria-hidden="true"/>}
                <span>{trendDelta}%</span>
              </div>
            </div>

            <div className="flex-1 w-full min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2.5} fillOpacity={1} fill="url(#trendGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="eyebrow text-muted-foreground/40">Past 6 Months</p>
              <p className="eyebrow text-muted-foreground/40">Growth</p>
            </div>
          </section>

          <section className="elevation-3 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title text-foreground">Next payouts</h3>
                <p className="eyebrow text-muted-foreground/40 mt-0.5">Susu cycle rewards</p>
              </div>
              <button onClick={() => onNavigate?.('payout')} aria-label="View all payouts" className={cn('w-7 h-7 rounded-lg flex items-center justify-center', 'text-primary/70 hover:bg-primary/8 transition-colors duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60')}>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true"/>
              </button>
            </div>

            <div className="space-y-5">
              {upcomingPayouts.length === 0 ? (<div className="py-6 text-center border-2 border-dashed border-border rounded-xl">
                  <p className="eyebrow text-muted-foreground/40">No payouts scheduled</p>
                </div>) : upcomingPayouts.map((payout) => (<div key={payout.id} className="relative pl-5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary/30 before:rounded-full group">
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <p className="body-strong text-foreground group-hover:text-primary transition-colors">{payout.memberName}</p>
                      <p className="eyebrow text-muted-foreground/50 mt-0.5">{payout.groupName}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="body-strong text-primary">{fmt(payout.payoutAmount || payout.amount || 0)}</p>
                      <p className="label text-muted-foreground/50 mt-0.5">{payout.scheduledDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-success/70">
                    <Zap className="w-3 h-3 fill-current" aria-hidden="true"/>
                    <span className="eyebrow">Verified Cycle</span>
                  </div>
                </div>))}
            </div>

            <button onClick={() => onNavigate?.('payout')} className={cn('w-full mt-4 py-2 rounded-lg text-[13px] font-medium', 'bg-accent border border-border', 'text-muted-foreground/70 hover:text-foreground hover:bg-accent/80', 'transition-colors duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60')}>
              Manage payout pipeline
            </button>
          </section>
        </div>
      </div>
    </div>);
}

import { Trophy, Medal, Award, Star, Crown, Flame } from 'lucide-react';
import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import { cn } from '../components/ui/utils';
export function Leaderboard() {
    const { authUser, users, payments, groups } = useAppContext();
    const rankings = useMemo(() => {
        const members = users.filter(m => m.role === 'member' && m.status !== 'rejected');
        const computed = members.map(member => {
            const memberPayments = payments.filter(p => (p.memberId || p.userId) === member.id);
            const paidPayments = memberPayments.filter(p => p.status === 'paid');
            const onTimePayments = paidPayments.filter(p => {
                if (!p.dueDate || !p.paymentDate)
                    return true;
                return new Date(p.paymentDate) <= new Date(p.dueDate);
            });
            const totalContributed = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const group = groups.find(g => g.id === member.groupId);
            // Compute points from live payment history:
            // 10 pts per paid payment, +5 bonus per on-time payment, +2 per streak day
            const points = (paidPayments.length * 10) + (onTimePayments.length * 5) + ((member.streak || 0) * 2);
            return {
                id: member.id,
                name: member.fullName || member.name || 'Member',
                group: group?.groupName || group?.name || 'No Group',
                payments: paidPayments.length,
                onTime: onTimePayments.length,
                amount: totalContributed,
                streak: member.streak || 0,
                points,
                badges: (member.badges || []),
                color: member.color || '#00E5BE',
                initials: (member.fullName || member.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
            };
        });
        return computed.sort((a, b) => b.points - a.points || b.amount - a.amount).map((item, idx) => ({ ...item, rank: idx + 1 }));
    }, [users, payments, groups]);
    const meRank = rankings.find(r => r.id === authUser?.id);
    const topThree = rankings.slice(0, 3);
    const rest = rankings.slice(3, 10);
    const rankCfg = {
        1: { iconBg: 'bg-gradient-to-br from-yellow-400 to-amber-500', text: 'text-yellow-400', Icon: Crown },
        2: { iconBg: 'bg-gradient-to-br from-slate-300 to-slate-500', text: 'text-slate-300', Icon: Medal },
        3: { iconBg: 'bg-gradient-to-br from-orange-400 to-orange-600', text: 'text-orange-400', Icon: Award },
    };
    return (<div className="pb-32 page-enter">
      <div className="px-6 md:px-10 pt-10 pb-8">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-yellow-400/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-yellow-400"/>
              </div>
              <p className="eyebrow text-muted-foreground/50">Hall of Excellence</p>
            </div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none mb-2">Leaderboard</h1>
            <p className="text-muted-foreground text-sm font-medium">Ranked by payment consistency and on-time delivery.</p>
          </div>
        </div>

        {meRank ? (<div className="relative overflow-hidden rounded-2xl mb-10 border border-primary/20 bg-primary/[0.06]">
            <div className="relative p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="eyebrow text-muted-foreground/60 mb-1">Your Standing</p>
                  <h2 className="text-5xl font-bold text-primary tracking-tighter">#{meRank.rank}</h2>
                </div>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl border-2" style={{ background: meRank.color, borderColor: meRank.color + '40' }}>
                  {meRank.initials}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border">
                {[['Payments', meRank.payments], ['Streak', `${meRank.streak}🔥`], ['Points', meRank.points]].map(([label, value]) => (<div key={label}>
                    <p className="eyebrow text-muted-foreground/60 mb-1">{label}</p>
                    <p className="text-xl font-bold text-foreground tracking-tight">{value}</p>
                  </div>))}
              </div>
              {meRank.badges.length > 0 && (<div className="flex gap-2 mt-4 flex-wrap">
                  {meRank.badges.map(b => (<span key={b} className="text-sm">{b === 'top' ? '🏆' : b === 'on-time' ? '⭐' : b === 'loyal' ? '💎' : '🎖'}</span>))}
                </div>)}
            </div>
          </div>) : (<div className="bg-card rounded-2xl p-6 border border-border mb-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0"><Star className="w-6 h-6"/></div>
            <div>
              <p className="font-bold text-foreground">Staff Performance View</p>
              <p className="text-muted-foreground/50 text-sm mt-1">Member rankings by payment excellence score.</p>
            </div>
          </div>)}
      </div>

      {topThree.length > 0 && (<div className="px-6 md:px-10 mb-8">
          <p className="eyebrow text-muted-foreground/40 mb-6">Top Performers</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {topThree.map(member => {
                const cfg = rankCfg[member.rank];
                const Icon = cfg.Icon;
                const isMe = member.id === authUser?.id;
                return (<div key={member.id} className={cn('card-tactile rounded-2xl p-6 relative overflow-hidden group', isMe && 'border-primary/30')}>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-5">
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm', cfg.iconBg)}><Icon className="w-6 h-6 text-white"/></div>
                      <span className={cn('eyebrow px-2.5 py-1 rounded-full bg-accent', cfg.text)}>#{member.rank}</span>
                    </div>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl text-foreground mb-4 border-2" style={{ background: member.color, borderColor: member.color + '40' }}>
                      {member.initials}
                    </div>
                    <h4 className="text-base font-bold text-foreground truncate mb-0.5">{member.name}</h4>
                    <p className="eyebrow text-muted-foreground/40 truncate mb-3">{member.group}</p>
                    {member.badges.length > 0 && (<div className="flex gap-1 mb-4">
                        {member.badges.map(b => (<span key={b} className="text-sm">{b === 'top' ? '🏆' : b === 'on-time' ? '⭐' : b === 'loyal' ? '💎' : '🎖'}</span>))}
                      </div>)}
                    <div className="flex items-center justify-between pt-5 border-t border-border">
                      <div>
                        <p className="eyebrow text-muted-foreground/30 mb-0.5">Points</p>
                        <p className={cn('text-lg font-bold', cfg.text)}>{member.points}</p>
                      </div>
                      <div className="text-right">
                        <p className="eyebrow text-muted-foreground/30 mb-0.5">Total</p>
                        <p className="text-sm font-bold text-foreground/70">{fmt(member.amount)}</p>
                      </div>
                    </div>
                  </div>
                </div>);
            })}
          </div>
        </div>)}

      {rest.length > 0 && (<div className="px-6 md:px-10">
          <p className="eyebrow text-muted-foreground/40 mb-6">Rising Members</p>
          <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
            {rest.map(member => {
                const isMe = member.id === authUser?.id;
                return (<div key={member.id} className={cn('flex items-center gap-5 p-5 transition-all duration-150 hover:bg-accent/50 group', isMe && 'bg-primary/[0.04] border-l-2 border-primary')}>
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-sm font-bold text-foreground/50 flex-shrink-0">{member.rank}</div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm text-foreground flex-shrink-0 border-2" style={{ background: member.color, borderColor: member.color + '40' }}>
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">{member.name}</p>
                      {member.badges.map(b => (<span key={b} className="text-xs">{b === 'top' ? '🏆' : b === 'on-time' ? '⭐' : b === 'loyal' ? '💎' : '🎖'}</span>))}
                    </div>
                    <p className="eyebrow text-muted-foreground/40 mt-0.5 truncate">{member.group}</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block">
                      <p className="eyebrow text-muted-foreground/30 mb-0.5">Streak</p>
                      <p className="text-sm font-bold text-warning">{member.streak}🔥</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl">
                      <Flame className="w-3.5 h-3.5 text-primary"/>
                      <span className="text-sm font-bold text-primary">{member.points}</span>
                    </div>
                  </div>
                </div>);
            })}
          </div>
        </div>)}

      {rankings.length === 0 && (<div className="px-6 md:px-10">
          <div className="glass-card rounded-[2.5rem] border border-dashed border-border p-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-yellow-400/10 flex items-center justify-center mx-auto mb-6 text-yellow-400/40"><Trophy className="w-10 h-10"/></div>
            <h3 className="text-xl font-bold text-foreground">No Rankings Yet</h3>
            <p className="text-muted-foreground/40 text-sm font-medium mt-2">Members will appear here once they start contributing.</p>
          </div>
        </div>)}
    </div>);
}

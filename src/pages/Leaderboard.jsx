import { Trophy, Medal, Award, Star, Crown, Flame } from 'lucide-react';
import { useMemo, useState } from 'react';
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
            // Compute consecutive on-time streak from live payment history.
            const sortedPaid = [...paidPayments].sort((a, b) =>
                new Date(b.paymentDate || b.date || 0).getTime() - new Date(a.paymentDate || a.date || 0).getTime()
            );
            let streak = 0;
            for (const p of sortedPaid) {
                if (!p.dueDate || !p.paymentDate) { streak++; continue; }
                if (new Date(p.paymentDate) <= new Date(p.dueDate)) streak++;
                else break;
            }
            const points = (paidPayments.length * 10) + (onTimePayments.length * 5) + (streak * 2);
            return {
                id: member.id,
                name: member.fullName || member.name || 'Member',
                group: group?.groupName || group?.name || 'No Group',
                payments: paidPayments.length,
                onTime: onTimePayments.length,
                amount: totalContributed,
                streak,
                points,
                badges: (member.badges || []),
                color: member.color || '#6491DE',
                initials: (member.fullName || member.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
            };
        });
        return computed.sort((a, b) => b.points - a.points || b.amount - a.amount).map((item, idx) => ({ ...item, rank: idx + 1 }));
    }, [users, payments, groups]);
    const groupOptions = useMemo(() => {
        const seen = new Set();
        const opts = [];
        rankings.forEach(r => { if (r.group && !seen.has(r.group)) { seen.add(r.group); opts.push(r.group); } });
        return opts;
    }, [rankings]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const visibleRankings = useMemo(() =>
        selectedGroup ? rankings.filter(r => r.group === selectedGroup) : rankings,
        [rankings, selectedGroup]);
    const meRank = visibleRankings.find(r => r.id === authUser?.id);
    const topThree = visibleRankings.slice(0, 3);
    const rest = visibleRankings.slice(3);
    const rankCfg = {
        1: { iconBg: 'bg-gradient-to-br from-yellow-400 to-amber-500', text: 'text-yellow-400', Icon: Crown },
        2: { iconBg: 'bg-gradient-to-br from-slate-300 to-slate-500', text: 'text-slate-300', Icon: Medal },
        3: { iconBg: 'bg-gradient-to-br from-orange-400 to-orange-600', text: 'text-orange-400', Icon: Award },
    };
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-yellow-400/20 flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400"/>
              </div>
              <p className="eyebrow text-muted-foreground">Hall of Excellence</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Leaderboard</h1>
            <p className="text-muted-foreground text-sm">Ranked by payment consistency and on-time delivery.</p>
          </div>
        </div>

        {/* Group filter */}
        {groupOptions.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-4 sm:mb-6">
            <button type="button" onClick={() => setSelectedGroup('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${!selectedGroup ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
              All Groups
            </button>
            {groupOptions.map(g => (
              <button key={g} type="button" onClick={() => setSelectedGroup(g)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${selectedGroup === g ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
                {g}
              </button>
            ))}
          </div>
        )}

        {meRank ? (<div className="relative overflow-hidden rounded-xl sm:rounded-2xl mb-4 sm:mb-6 border border-primary/20 bg-primary/[0.06]">
            <div className="relative p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="eyebrow text-muted-foreground mb-1">Your Standing</p>
                  <h2 className="text-3xl sm:text-4xl font-bold text-primary">#{meRank.rank}</h2>
                </div>
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-lg sm:text-xl border-2" style={{ background: meRank.color, borderColor: meRank.color + '40' }}>
                  {meRank.initials}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-border">
                {[['Payments', meRank.payments], ['Streak', `${meRank.streak}🔥`], ['Points', meRank.points]].map(([label, value]) => (<div key={label}>
                    <p className="eyebrow text-muted-foreground mb-1">{label}</p>
                    <p className="text-base sm:text-lg font-bold text-foreground select-none tabular-nums">{value}</p>
                  </div>))}
              </div>
              {meRank.badges.length > 0 && (<div className="flex gap-2 mt-3 flex-wrap">
                  {meRank.badges.map(b => (<span key={b} className="text-sm">{b === 'top' ? '🏆' : b === 'on-time' ? '⭐' : b === 'loyal' ? '💎' : '🎖'}</span>))}
                </div>)}
            </div>
          </div>) : (<div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-border mb-4 sm:mb-6 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0"><Star className="w-5 h-5"/></div>
            <div>
              <p className="font-bold text-foreground text-sm">Member Performance View</p>
              <p className="text-muted-foreground text-xs mt-0.5">Member rankings by payment excellence score.</p>
            </div>
          </div>)}
      </div>

      {topThree.length > 0 && (<div className="px-4 sm:px-6 mb-4 sm:mb-6">
          <p className="eyebrow text-muted-foreground mb-3 sm:mb-4">Top Performers</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
                    <p className="eyebrow text-muted-foreground truncate mb-3">{member.group}</p>
                    {member.badges.length > 0 && (<div className="flex gap-1 mb-4">
                        {member.badges.map(b => (<span key={b} className="text-sm">{b === 'top' ? '🏆' : b === 'on-time' ? '⭐' : b === 'loyal' ? '💎' : '🎖'}</span>))}
                      </div>)}
                    <div className="flex items-center justify-between pt-5 border-t border-border">
                      <div>
                        <p className="eyebrow text-muted-foreground mb-0.5">Points</p>
                        <p className={cn('text-lg font-bold', cfg.text)}>{member.points}</p>
                      </div>
                      <div className="text-right">
                        <p className="eyebrow text-muted-foreground mb-0.5">Total</p>
                        <p className="text-sm font-bold text-foreground/70">{fmt(member.amount)}</p>
                      </div>
                    </div>
                  </div>
                </div>);
            })}
          </div>
        </div>)}

      {rest.length > 0 && (<div className="px-4 sm:px-6">
          <p className="eyebrow text-muted-foreground mb-6">Rising Members</p>
          <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
            {rest.map(member => {
                const isMe = member.id === authUser?.id;
                return (<div key={member.id} className={cn('flex items-center gap-5 p-5 transition-all duration-150 hover:bg-accent/50 group', isMe && 'bg-primary/[0.04] border-l-2 border-primary')}>
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-sm font-bold text-foreground/70 flex-shrink-0">{member.rank}</div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm text-foreground flex-shrink-0 border-2" style={{ background: member.color, borderColor: member.color + '40' }}>
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">{member.name}</p>
                      {member.badges.map(b => (<span key={b} className="text-xs">{b === 'top' ? '🏆' : b === 'on-time' ? '⭐' : b === 'loyal' ? '💎' : '🎖'}</span>))}
                    </div>
                    <p className="eyebrow text-muted-foreground mt-0.5 truncate">{member.group}</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block">
                      <p className="eyebrow text-muted-foreground mb-0.5">Streak</p>
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

      {visibleRankings.length === 0 && (<div className="px-4 sm:px-6">
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 flex items-center justify-center mx-auto mb-4 text-yellow-400/40"><Trophy className="w-8 h-8"/></div>
            <h3 className="text-lg font-bold text-foreground">No Rankings Yet</h3>
            <p className="text-muted-foreground text-sm mt-1">Members will appear here once they start contributing.</p>
          </div>
        </div>)}
    </div>);
}

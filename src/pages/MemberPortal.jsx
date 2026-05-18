import { Phone, MapPin, CreditCard, Banknote, Trophy, Sparkles, Award, Wallet, Receipt as ReceiptIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import { EmptyState } from '../components/ui/EmptyState';
import { PayModal } from '../components/domain/PayModal';
import { renderReceiptDocument } from '../services/receiptService';
export function MemberPortal() {
    const { authUser, users, payments, groups } = useAppContext();
    const me = users.find(u => u.id === authUser?.id) || authUser;
    const myGroup = groups.find(g => g.id === me?.groupId);
    const myPayments = useMemo(() => payments.filter(p => (p.memberId || p.userId) === me?.id), [payments, me?.id]);
    const paidCount = myPayments.filter(p => p.status === 'paid').length;
    const dueNow = myPayments.find(p => p.status === 'overdue' || p.status === 'pending');
    const [payOpen, setPayOpen] = useState(false);
    return (<div className="pb-28">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div>
            <p className="text-muted-foreground text-sm">Welcome back,</p>
            <h1 className="text-2xl mt-1">{(me?.name || '').split(' ')[0]} 👋</h1>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary">
            {me?.role}
          </span>
        </div>
      </div>

      {/* Hero stats */}
      <div className="px-4 sm:px-6 mb-4 sm:mb-6">
        <div className="bg-card rounded-3xl p-6 border border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
              {(me?.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-lg font-bold truncate">{me?.name}</p>
              <p className="text-muted-foreground text-sm truncate">{me?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={Sparkles} label="Streak" value={`${me?.streak || 0}🔥`} tone="warn"/>
            <Stat icon={Trophy} label="Points" value={`${me?.points || 0}`} tone="primary"/>
            <Stat icon={Award} label="Badge" value={me?.badges?.includes('top') ? '🏆' : me?.badges?.includes('on-time') ? '⭐' : me?.badges?.[0] ? '💎' : '—'} tone="accent"/>
          </div>
        </div>
      </div>

      {/* My group */}
      <div className="px-4 sm:px-6 mb-4 sm:mb-6">
        {myGroup ? (<div className="bg-gradient-to-br from-primary to-primary/70 rounded-3xl p-6 text-foreground">
            <p className="text-foreground/80 text-xs uppercase tracking-wider font-bold mb-1">My Susu Group</p>
            <h2 className="text-2xl mb-1">{myGroup.groupName || myGroup.name}</h2>
            <p className="text-foreground/80 text-sm mb-4">{myGroup.frequency}</p>
            <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-3">
              <div className="h-full bg-white" style={{ width: `${Math.min(((myGroup.currentRound || 0) / (myGroup.totalRounds || myGroup.totalSlots || 1)) * 100, 100)}%` }}/>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-foreground/70 text-xs uppercase tracking-wider font-bold">Contribution</p>
                <p className="font-bold">{fmt(myGroup.contributionAmount || myGroup.contribution || 0)}</p>
              </div>
              <div>
                <p className="text-foreground/70 text-xs uppercase tracking-wider font-bold">My Payout</p>
                <p className="font-bold">
                  {fmt((myGroup.contributionAmount || myGroup.contribution || 0) * (Array.isArray(myGroup.members) ? myGroup.members.length : 0))}
                </p>
              </div>
              <div>
                <p className="text-foreground/70 text-xs uppercase tracking-wider font-bold">Round</p>
                <p className="font-bold">{myGroup.currentRound || 0}/{myGroup.totalRounds || myGroup.totalSlots || 0}</p>
              </div>
            </div>
          </div>) : (<EmptyState icon={Wallet} title={me?.status === 'approved' ? 'Not assigned to a group yet' : 'Account pending approval'} description={me?.status === 'approved'
                ? 'A manager will add you to a group soon.'
                : 'You will receive a notification once approved.'}/>)}
      </div>

      {/* Pay button */}
      {myGroup && me?.status === 'approved' && (<div className="px-6 mb-6">
          <button type="button" onClick={() => setPayOpen(true)} className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
            <Wallet className="w-5 h-5"/>
            Pay {fmt(myGroup.contributionAmount || myGroup.contribution || 0)}
          </button>
          {dueNow && (<p className="text-muted-foreground text-xs text-center mt-2">
              You have {myPayments.filter(p => p.status !== 'paid').length} outstanding payment{myPayments.filter(p => p.status !== 'paid').length === 1 ? '' : 's'}.
            </p>)}
        </div>)}

      {/* Details */}
      <div className="px-4 sm:px-6 mb-4 sm:mb-6">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <Row icon={CreditCard} label="Ghana Card" value={me?.ghanaCard || '—'}/>
          <Row icon={Phone} label="Phone" value={me?.phone || '—'}/>
          <Row icon={MapPin} label="Address" value={me?.address || '—'}/>
          <Row icon={Banknote} label="Bank / MoMo" value={me?.bankMomo || '—'} last/>
        </div>
      </div>

      {/* Payment history */}
      <div className="px-4 sm:px-6">
        <h3 className="mb-3 sm:mb-4 text-base font-semibold">Payment History</h3>
        {myPayments.length === 0 ? (<p className="text-muted-foreground text-sm py-4">No payments yet.</p>) : (<div className="space-y-2">
            {myPayments.map(p => {
                const g = groups.find(grp => grp.id === p.groupId);
                return (<div key={p.id} className="bg-card rounded-2xl p-4 border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${p.status === 'paid' ? 'bg-success' :
                        p.status === 'pending' ? 'bg-primary' :
                            p.status === 'overdue' ? 'bg-destructive' : 'bg-muted-foreground'}`}/>
                    <div className="min-w-0">
                      <p className="text-foreground font-bold text-sm">Round #{p.round || '—'} — {fmt(p.amount)}</p>
                      <p className="text-muted-foreground text-xs truncate">
                        {p.paymentDate || p.date || 'Not yet paid'}
                        {p.ref && <span className="ml-2 font-mono">{p.ref}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs uppercase font-bold ${p.status === 'paid' ? 'bg-success/20 text-success' :
                        p.status === 'pending' ? 'bg-primary/20 text-primary' :
                            'bg-destructive/20 text-destructive'}`}>
                      {p.status}
                    </span>
                    {p.status === 'paid' && (<button type="button" title="Download receipt" onClick={() => renderReceiptDocument(p, me, g)} className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-foreground">
                        <ReceiptIcon className="w-4 h-4"/>
                      </button>)}
                  </div>
                </div>);
            })}
          </div>)}
        <div className="h-8"/>
      </div>

      {payOpen && myGroup && me && (<PayModal group={myGroup} user={me} onClose={() => setPayOpen(false)}/>)}
    </div>);
}
function Stat({ icon: Icon, label, value, tone }) {
    const toneClass = tone === 'warn'
        ? 'bg-yellow-500/10 text-yellow-500'
        : tone === 'primary'
            ? 'bg-primary/10 text-primary'
            : 'bg-success/10 text-success';
    return (<div className={`rounded-2xl p-3 text-center ${toneClass}`}>
      <Icon className="w-4 h-4 mx-auto mb-1"/>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wider font-bold opacity-80">{label}</p>
    </div>);
}
function Row({ icon: Icon, label, value, last }) {
    return (<div className={`flex items-center gap-3 p-4 ${last ? '' : 'border-b border-border'}`}>
      <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted-foreground"/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-sm truncate">{value}</p>
      </div>
    </div>);
}

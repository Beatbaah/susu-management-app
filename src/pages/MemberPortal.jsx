import { Phone, MapPin, CreditCard, Banknote, Trophy, Sparkles, Award, Wallet, Receipt as ReceiptIcon, CalendarClock, Trophy as TrophyIcon, Share2, AlertTriangle, Bell, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import { EmptyState } from '../components/ui/EmptyState';
import { PayModal } from '../components/domain/PayModal';
import { renderReceiptDocument } from '../services/receiptService';
import { getPermissionState, requestPushPermission, isNotificationSupported } from '../services/pushNotificationService';
import { isFirestoreReady } from '../services/firestoreSync';
export function MemberPortal() {
    const { authUser, users, payments, groups, schedule } = useAppContext();
    const me = users.find(u => u.id === authUser?.id) || authUser;
    const myGroup = groups.find(g => g.id === me?.groupId);
    const myPayments = useMemo(() => payments.filter(p => (p.memberId || p.userId) === me?.id), [payments, me?.id]);
    const paidCount = myPayments.filter(p => p.status === 'paid').length;
    const dueNow = myPayments.find(p => p.status === 'overdue' || p.status === 'pending');
    const myPayout = useMemo(() => {
        if (!me?.id || !myGroup) return null;
        const groupPayouts = [...schedule]
            .filter(p => String(p.groupId) === String(myGroup.id))
            .sort((a, b) => {
                const da = a.scheduledDate ? new Date(a.scheduledDate) : new Date(9999, 0);
                const db = b.scheduledDate ? new Date(b.scheduledDate) : new Date(9999, 0);
                return da - db;
            });
        const myIdx = groupPayouts.findIndex(p => String(p.memberId || p.recipientId) === String(me.id));
        if (myIdx === -1) return null;
        const entry = groupPayouts[myIdx];
        const isCompleted = ['completed', 'paid'].includes(String(entry.status || '').toLowerCase()) || !!entry.paid;
        return {
            position: myIdx + 1,
            total: groupPayouts.length,
            scheduledDate: entry.scheduledDate || null,
            amount: Number(entry.payoutAmount || entry.amount || 0),
            isCompleted,
        };
    }, [schedule, me?.id, myGroup]);
    const [payOpen, setPayOpen] = useState(false);
    const [pushDismissed, setPushDismissed] = useState(false);
    const [permState, setPermState] = useState(() => getPermissionState());
    const showPushNudge = isFirestoreReady() && isNotificationSupported() && permState === 'default' && !pushDismissed;
    const showDocsBanner = me?.status === 'approved' && (!me?.passportPic || !me?.ghanaCardFront || !me?.ghanaCardBack);
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div>
            <p className="text-muted-foreground text-sm">Welcome back,</p>
            <h1 className="text-2xl font-bold text-foreground mt-1">{(me?.name || '').split(' ')[0]} 👋</h1>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary">
            {me?.role}
          </span>
        </div>
      </div>

      {/* Push notification nudge */}
      {showPushNudge && (
        <div className="px-4 sm:px-6 mb-4">
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-start gap-3">
            <Bell className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"/>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-bold text-sm">Stay updated</p>
              <p className="text-muted-foreground text-xs mt-0.5">Enable notifications to get payment reminders and account updates.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button type="button"
                onClick={async () => {
                  const result = await requestPushPermission(authUser?.id);
                  setPermState(getPermissionState());
                  if (!result.ok) setPushDismissed(true);
                }}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold">
                Enable
              </button>
              <button type="button" onClick={() => setPushDismissed(true)}
                className="w-7 h-7 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing documents banner */}
      {showDocsBanner && (
        <div className="px-4 sm:px-6 mb-4">
          <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5"/>
            <div className="flex-1 min-w-0">
              <p className="text-warning font-bold text-sm">Documents missing</p>
              <p className="text-muted-foreground text-xs mt-0.5">Your ID documents are incomplete. Tap your profile icon at the top to upload them.</p>
            </div>
          </div>
        </div>
      )}

      {/* Pay Now — primary CTA, visible above fold */}
      {myGroup && me?.status === 'approved' && (
        <div className="px-4 sm:px-6 mb-4">
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-base shadow-lg shadow-primary/25 flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all"
          >
            <Wallet className="w-5 h-5"/>
            Pay {fmt(myGroup.contributionAmount || myGroup.contribution || 0)}
            {dueNow && <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs font-semibold">Due</span>}
          </button>
          {dueNow && dueNow.dueDate && (() => {
            const days = Math.round((new Date(dueNow.dueDate).getTime() - Date.now()) / 86400000);
            if (days < 0) return <p className="text-destructive text-xs text-center mt-1.5 font-semibold">{Math.abs(days)} day{Math.abs(days) !== 1 ? 's' : ''} overdue</p>;
            if (days === 0) return <p className="text-warning text-xs text-center mt-1.5 font-semibold">Due today</p>;
            if (days <= 3) return <p className="text-warning text-xs text-center mt-1.5 font-semibold">Due in {days} day{days !== 1 ? 's' : ''}</p>;
            return <p className="text-muted-foreground text-xs text-center mt-1.5">Due in {days} days</p>;
          })()}
        </div>
      )}

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
        {myGroup ? (<div className="bg-gradient-to-br from-primary to-primary/70 rounded-3xl p-6 text-white">
            <p className="text-white/70 text-xs uppercase tracking-wider font-bold mb-1">My Susu Group</p>
            <h2 className="text-2xl mb-1">{myGroup.groupName || myGroup.name}</h2>
            <p className="text-white/70 text-sm mb-4">{myGroup.frequency}</p>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-white" style={{ width: `${Math.min(((myGroup.currentRound || 0) / (myGroup.totalRounds || myGroup.totalSlots || 1)) * 100, 100)}%` }}/>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider font-bold">Contribution</p>
                <p className="font-bold text-white">{fmt(myGroup.contributionAmount || myGroup.contribution || 0)}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider font-bold">My Payout</p>
                <p className="font-bold text-white">
                  {fmt((myGroup.contributionAmount || myGroup.contribution || 0) * (Array.isArray(myGroup.members) ? myGroup.members.length : 0))}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider font-bold">Round</p>
                <p className="font-bold text-white">{myGroup.currentRound || 0}/{myGroup.totalRounds || myGroup.totalSlots || 0}</p>
              </div>
            </div>
          </div>) : (<EmptyState icon={Wallet} title={me?.status === 'approved' ? 'Not assigned to a group yet' : 'Account pending approval'} description={me?.status === 'approved'
                ? 'A manager will add you to a group soon.'
                : 'You will receive a notification once approved.'}/>)}
      </div>

      {/* Payout queue position */}
      {myPayout && myGroup && (
        <div className="px-4 sm:px-6 mb-4 sm:mb-6">
          <div className={`rounded-2xl border p-4 flex items-center gap-4 ${myPayout.isCompleted ? 'bg-success/10 border-success/30' : 'bg-card border-border'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${myPayout.isCompleted ? 'bg-success/20' : 'bg-primary/10'}`}>
              {myPayout.isCompleted
                ? <TrophyIcon className="w-6 h-6 text-success"/>
                : <CalendarClock className="w-6 h-6 text-primary"/>}
            </div>
            <div className="flex-1 min-w-0">
              {myPayout.isCompleted ? (
                <>
                  <p className="text-success font-bold text-sm">Payout received</p>
                  <p className="text-muted-foreground text-xs">You have already collected your payout for this cycle.</p>
                </>
              ) : (
                <>
                  <p className="text-foreground font-bold text-sm">
                    Queue position <span className="text-primary">#{myPayout.position}</span> of {myPayout.total}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {myPayout.scheduledDate
                      ? `Scheduled for ${new Date(myPayout.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : 'Date to be confirmed by manager'}
                    {myPayout.amount > 0 && ` · ${fmt(myPayout.amount)}`}
                  </p>
                  {myPayout.scheduledDate && (() => {
                    const days = Math.round((new Date(myPayout.scheduledDate).getTime() - Date.now()) / 86400000);
                    if (days < 0) return null;
                    if (days === 0) return <p className="text-warning text-xs font-bold mt-0.5">Payout today!</p>;
                    return <p className="text-primary text-xs font-semibold mt-0.5">In {days} day{days !== 1 ? 's' : ''}</p>;
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
                    {p.status === 'paid' && typeof navigator.share === 'function' && (
                      <button
                        type="button"
                        title="Share receipt"
                        onClick={() => navigator.share({
                          title: 'Excellent Susu Receipt',
                          text: `Payment confirmed ✓\nRound #${p.round || '?'} · ${fmt(p.amount)}\nRef: ${p.ref || 'N/A'}\nGroup: ${g?.groupName || g?.name || ''}`,
                        }).catch(() => {})}
                        className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-foreground"
                      >
                        <Share2 className="w-4 h-4"/>
                      </button>
                    )}
                    {p.status === 'paid' && (
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Excellent Susu — Payment Confirmed ✓\nRound #${p.round || '?'} · ${fmt(p.amount)}\nRef: ${p.ref || 'N/A'}\nGroup: ${g?.groupName || g?.name || ''}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Share via WhatsApp"
                        className="p-1.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] flex items-center justify-center"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12.05 2C6.495 2 2 6.535 2 12.075c0 1.974.563 3.836 1.538 5.43L2 22l4.617-1.526C8.063 21.358 10.001 22 12.05 22c5.555 0 10.05-4.535 10.05-10.075 0-2.693-1.044-5.22-2.945-7.121C17.255 3.003 14.74 2 12.05 2z"/></svg>
                      </a>
                    )}
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

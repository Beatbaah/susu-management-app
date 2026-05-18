import { X, CheckCircle, XCircle, Users, Phone, MapPin, CreditCard, Banknote, Calendar, FileCheck, FileX, Award, Sparkles, Trophy, Mail, Shield, Pencil, } from 'lucide-react';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fmt } from '../../utils/helpers';
import { AssignGroupModal } from './AssignGroupModal';
import { toast } from '../../utils/toast';
const statusTone = {
    approved: 'bg-success/15 text-success border-success/30',
    pending: 'bg-primary/15 text-primary border-primary/30',
    suspended: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};
const roleTone = {
    admin: 'bg-destructive/10 text-destructive border-destructive/20',
    manager: 'bg-primary/10 text-primary border-primary/20',
    collector: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    member: 'bg-success/10 text-success border-success/20',
};
export function MemberDrawer({ user, onClose, onEdit }) {
    const { authUser, groups, payments, approveUser, rejectUser } = useAppContext();
    const [assignOpen, setAssignOpen] = useState(false);
    const myGroup = groups.find(g => g.id === user.groupId);
    const myPayments = payments.filter(p => (p.memberId || p.userId) === user.id);
    const canManage = authUser && ['admin', 'manager'].includes(authUser.role);
    const fullName = user.fullName || user.name || 'Member';
    const initials = fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const isStaff = ['admin', 'manager', 'collector'].includes(user.role);
    const docs = [
        ['Ghana Card · Front', user.ghanaCardFront],
        ['Ghana Card · Back', user.ghanaCardBack],
        ['Passport photo', user.passportPic],
        ['Live selfie', user.liveSelfie],
    ];
    const uploadedDocs = docs.filter(([, v]) => Boolean(v)).length;
    const totalContributed = myPayments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const paidCount = myPayments.filter(p => p.status === 'paid').length;
    return (<>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
        <div className="relative bg-card border border-border w-full sm:max-w-md max-h-[95vh] sm:rounded-3xl rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Floating action buttons — positioned relative to the modal card */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {onEdit && canManage && (<button type="button" onClick={onEdit} aria-label="Edit member" className="w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-foreground flex items-center justify-center backdrop-blur-md transition-colors">
                <Pencil className="w-4 h-4"/>
              </button>)}
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-foreground flex items-center justify-center backdrop-blur-md transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* HERO BANNER */}
            <div className="relative">
              <div className="h-32 bg-gradient-to-br from-primary via-primary/85 to-primary/55 relative overflow-hidden">
                <div className=""/>
                <div className="absolute -bottom-12 -left-6 w-40 h-40 rounded-full bg-border blur-3xl"/>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.18),transparent_60%)]"/>
              </div>

              {/* Avatar — overlapping the banner */}
              <div className="absolute inset-x-0 -bottom-12 flex justify-center">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-card border-4 border-card shadow-xl flex items-center justify-center overflow-hidden">
                    {user.liveSelfie ? (<img src={user.liveSelfie} alt={fullName} className="w-full h-full object-cover"/>) : (<div className="w-full h-full rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-foreground text-2xl font-bold">
                        {initials}
                      </div>)}
                  </div>
                  {user.status === 'approved' && (<span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-success border-2 border-card flex items-center justify-center shadow" aria-hidden>
                      <Shield className="w-3.5 h-3.5 text-card"/>
                    </span>)}
                </div>
              </div>
            </div>

            {/* IDENTITY */}
            <div className="px-6 pt-16 pb-5 text-center">
              <h2 className="text-xl font-bold text-foreground tracking-tight">{fullName}</h2>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
                <Mail className="w-3 h-3"/>
                <span className="truncate max-w-[16rem]">{user.email || '—'}</span>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2">
                <Chip tone={roleTone[user.role] || 'bg-muted/30 text-muted-foreground border-border'}>
                  {user.role}
                </Chip>
                <Chip tone={statusTone[user.status] || 'bg-muted/30 text-muted-foreground border-border'}>
                  {user.status}
                </Chip>
              </div>
            </div>

            {/* STATS — context-aware */}
            <div className="px-6 mb-5">
              <div className="grid grid-cols-3 gap-2">
                {isStaff ? (<>
                    <StatTile icon={Banknote} label="Collected" value={fmt(totalContributed)}/>
                    <StatTile icon={CheckCircle} label="Payments" value={`${paidCount}`}/>
                    <StatTile icon={FileCheck} label="Docs" value={`${uploadedDocs}/${docs.length}`}/>
                  </>) : (<>
                    <StatTile icon={Sparkles} label="Streak" value={`${user.streak || 0}`} accent="text-yellow-400"/>
                    <StatTile icon={Trophy} label="Points" value={`${user.points || 0}`} accent="text-primary"/>
                    <StatTile icon={Award} label="Badge" value={user.badges?.includes('top') ? '🏆' : user.badges?.includes('on-time') ? '⭐' : user.badges?.length ? '💎' : '—'} accent="text-emerald-400"/>
                  </>)}
              </div>
            </div>

            {/* QUICK ACTIONS */}
            {canManage && user.status === 'pending' && (<div className="px-6 mb-5">
                <div className="flex gap-2">
                  <button type="button" onClick={() => { approveUser(user.id); toast.success(`${fullName} approved`); onClose(); }} className="flex-1 bg-success text-foreground py-3 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-success/20">
                    <CheckCircle className="w-4 h-4"/>
                    Approve
                  </button>
                  <button type="button" onClick={() => { rejectUser(user.id); toast.error(`${fullName} rejected`); onClose(); }} className="flex-1 bg-destructive/15 text-destructive border border-destructive/30 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold">
                    <XCircle className="w-4 h-4"/>
                    Reject
                  </button>
                </div>
              </div>)}
            {canManage && user.status === 'approved' && !user.groupId && (<div className="px-6 mb-5">
                <button type="button" onClick={() => setAssignOpen(true)} className="w-full bg-primary text-primary-foreground py-3 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary/20">
                  <Users className="w-4 h-4"/>
                  Assign to Group
                </button>
              </div>)}

            {/* SECTIONS */}
            <div className="px-6 pb-8 space-y-5">
              <Section title="Personal info">
                <InfoRow icon={CreditCard} label="Ghana Card" value={user.ghanaCard || '—'}/>
                <InfoRow icon={Phone} label="Phone" value={user.phone || '—'}/>
                <InfoRow icon={MapPin} label="Address" value={user.address || '—'}/>
                <InfoRow icon={Banknote} label="Bank / MoMo" value={user.bankMomo || '—'}/>
                <InfoRow icon={Calendar} label="Joined" value={user.joinedAt || '—'} last/>
              </Section>

              <Section title="Documents" meta={`${uploadedDocs}/${docs.length} uploaded`} metaTone={uploadedDocs === docs.length ? 'text-success' : 'text-muted-foreground'}>
                {docs.map(([label, val], i) => (<div key={label} className={`flex items-center justify-between px-4 py-3 ${i < docs.length - 1 ? 'border-b border-border' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${val ? 'bg-success/15 text-success' : 'bg-muted/40 text-muted-foreground'}`}>
                        {val ? <FileCheck className="w-4 h-4"/> : <FileX className="w-4 h-4"/>}
                      </div>
                      <span className="text-foreground text-sm">{label}</span>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${val ? 'text-success' : 'text-muted-foreground'}`}>
                      {val ? 'Uploaded' : 'Missing'}
                    </span>
                  </div>))}
              </Section>

              {myGroup && (<Section title="Susu group">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-foreground font-bold truncate">{myGroup.groupName || myGroup.name}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {myGroup.frequency || 'Weekly'} · {Array.isArray(myGroup.members) ? myGroup.members.length : 0} members
                        </p>
                      </div>
                      <div className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                        Round {myGroup.currentRound || 0}/{myGroup.totalRounds || myGroup.totalSlots || 0}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-primary rounded-full" style={{
                width: `${Math.min(((myGroup.currentRound || 0) / (myGroup.totalRounds || myGroup.totalSlots || 1)) * 100, 100)}%`,
            }}/>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Contribution</p>
                        <p className="text-foreground font-bold mt-0.5">{fmt(myGroup.contributionAmount || myGroup.contribution || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Total payout</p>
                        <p className="text-foreground font-bold mt-0.5">
                          {fmt((myGroup.contributionAmount || myGroup.contribution || 0) * (myGroup.totalRounds || myGroup.totalSlots || 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </Section>)}

              {myPayments.length > 0 && (<Section title="Payments" meta={`${myPayments.length} record${myPayments.length === 1 ? '' : 's'}`}>
                  {myPayments.map((p, i) => (<div key={p.id} className={`flex items-center justify-between px-4 py-3 ${i < myPayments.length - 1 ? 'border-b border-border' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${p.status === 'paid' ? 'bg-success'
                    : p.status === 'pending' ? 'bg-primary'
                        : p.status === 'overdue' ? 'bg-destructive'
                            : 'bg-muted-foreground'}`}/>
                        <div className="min-w-0">
                          <p className="text-foreground font-bold text-sm">Round #{p.round || '—'} · {fmt(p.amount)}</p>
                          <p className="text-muted-foreground text-xs truncate">{p.paymentDate || p.date || 'Not yet paid'}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold uppercase tracking-wider ${p.status === 'paid' ? 'text-success'
                    : p.status === 'pending' ? 'text-primary'
                        : 'text-destructive'}`}>
                        {p.status}
                      </span>
                    </div>))}
                </Section>)}
            </div>
          </div>
        </div>
      </div>

      {assignOpen && (<AssignGroupModal memberId={user.id} onClose={() => setAssignOpen(false)} onAssigned={() => { setAssignOpen(false); onClose(); }}/>)}
    </>);
}
// ─── helpers ──────────────────────────────────────────────────────────────
function Chip({ tone, children }) {
    return (<span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${tone}`}>
      {children}
    </span>);
}
function Section({ title, meta, metaTone = 'text-muted-foreground', children, }) {
    return (<div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <p className="eyebrow text-muted-foreground">{title}</p>
        {meta && <p className={`text-xs font-bold ${metaTone}`}>{meta}</p>}
      </div>
      <div className="rounded-2xl border border-border bg-input-background overflow-hidden">{children}</div>
    </div>);
}
function InfoRow({ icon: Icon, label, value, last, }) {
    return (<div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-border'}`}>
      <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground"/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold">{label}</p>
        <p className="text-foreground text-sm truncate mt-0.5">{value}</p>
      </div>
    </div>);
}
function StatTile({ icon: Icon, label, value, accent = 'text-foreground', }) {
    return (<div className="rounded-2xl border border-border bg-input-background p-3 text-center">
      <Icon className={`w-3.5 h-3.5 mx-auto mb-1.5 ${accent}`}/>
      <p className={`font-bold text-base leading-none ${accent}`}>{value}</p>
      <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold mt-1.5">
        {label}
      </p>
    </div>);
}

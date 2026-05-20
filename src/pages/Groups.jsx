import { Search, Plus, Users, X, Layers, Wallet, Pencil, CheckCircle, Clock, AlertCircle, Link2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { fmt } from '../utils/helpers';
import { SkeletonList } from '../components/ui/LoadingState';
import { GroupCard } from '../components/domain';
import { validateGroup } from '../validation/groupRules';
import { toast } from '../utils/toast';
const EMPTY_GROUP_DRAFT = {
    groupName: '',
    contributionAmount: '',
    frequency: 'Weekly',
    totalRounds: '12',
    color: '#6491DE',
    cashoutAmount: '',
};
const COLORS = ["#6491DE", "#073D7F", "#3B5FBF", "#8B5CF6", "#F59E0B", "#10B981", "#EC4899", "#0EA5E9"];
export function Groups() {
    const { authUser, groups, users, payments, createGroup, updateGroup, appReady } = useAppContext();
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [draft, setDraft] = useState(EMPTY_GROUP_DRAFT);
    const [dialogError, setDialogError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [detailGroup, setDetailGroup] = useState(null);
    const canAdd = authUser && ['admin', 'manager'].includes(authUser.role);
    const canEdit = canAdd;
    const openCreateDialog = () => {
        setDialogError(null);
        setDraft(EMPTY_GROUP_DRAFT);
        setEditingId(null);
        setDialogOpen(true);
    };
    const openEditDialog = (g) => {
        setDialogError(null);
        setDraft({
            groupName: String(g.groupName || g.name || ''),
            contributionAmount: String(g.contributionAmount || g.contribution || ''),
            frequency: String(g.frequency || 'Weekly'),
            totalRounds: String(g.totalRounds || g.totalSlots || '12'),
            color: String(g.color || '#6491DE'),
            cashoutAmount: String(g.cashoutAmount || (g.contributionAmount || g.contribution || 0) * (g.totalRounds || g.totalSlots || 1)),
        });
        setEditingId(g.id);
        setDialogOpen(true);
    };
    const closeDialog = () => { setDialogOpen(false); setDialogError(null); setEditingId(null); };
    const copyInviteLink = (group) => {
        const url = `${window.location.origin}${window.location.pathname}?invite=${group.id}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied!')).catch(() => toast.error('Could not copy link.'));
        } else {
            toast.error('Clipboard not available.');
        }
    };
    const handleSave = () => {
        const v = validateGroup({
            groupName: draft.groupName,
            contributionAmount: draft.contributionAmount,
            totalRounds: draft.totalRounds,
            frequency: draft.frequency,
        });
        if (!v.ok) {
            setDialogError(v.message || 'Invalid input.');
            return;
        }
        const payload = {
            groupName: draft.groupName.trim(),
            name: draft.groupName.trim(),
            contributionAmount: Number(draft.contributionAmount),
            contribution: Number(draft.contributionAmount),
            frequency: draft.frequency,
            totalRounds: Number(draft.totalRounds),
            totalSlots: Number(draft.totalRounds),
            color: draft.color,
            cashoutAmount: draft.cashoutAmount ? Number(draft.cashoutAmount) : Number(draft.contributionAmount) * Number(draft.totalRounds),
            members: [],
            chat: [],
            currentRound: 1,
        };
        if (editingId != null) {
            updateGroup(editingId, payload);
            toast.success(`Updated "${draft.groupName.trim()}"`);
        }
        else {
            createGroup(payload);
            toast.success(`Created group "${draft.groupName.trim()}"`);
        }
        closeDialog();
    };
    const groupsWithDetails = useMemo(() => groups.map(group => {
        const memberCount = Array.isArray(group.members) ? group.members.length : 0;
        const totalSlots = group.totalSlots || group.totalRounds || memberCount || 1;
        const contributionAmount = group.contributionAmount || group.contribution || 0;
        const poolSize = contributionAmount * memberCount;
        const frequency = String(group.frequency || '').toLowerCase();
        const daysPerRound = frequency.includes('day') ? 1 : frequency.includes('week') ? 7 : 30;
        const remainingRounds = Math.max(0, totalSlots - (group.currentRound || 0));
        const nextPayoutDate = new Date();
        nextPayoutDate.setDate(nextPayoutDate.getDate() + daysPerRound);
        return {
            ...group,
            poolSize,
            memberCount,
            totalSlots,
            contributionAmount,
            nextPayoutLabel: remainingRounds > 0
                ? nextPayoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Complete',
        };
    }), [groups]);
    const filtered = groupsWithDetails.filter(g => {
        // Role-based visibility logic from susu-app_2.jsx
        if (authUser && authUser.role === 'member') {
            const gMembers = Array.isArray(g.members) ? g.members : [];
            if (!gMembers.includes(authUser.id))
                return false;
        }
        const q = search.trim().toLowerCase();
        if (!q)
            return true;
        return (g.groupName || g.name || '').toLowerCase().includes(q);
    });
    const totalMembers = groupsWithDetails.reduce((sum, g) => sum + g.memberCount, 0);
    const totalPool = groupsWithDetails.reduce((sum, g) => sum + g.poolSize, 0);
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground">Group Management</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Susu Groups</h1>
            <p className="text-muted-foreground text-sm">Manage all active rotating savings circles.</p>
          </div>
          {canAdd && (<button type="button" onClick={openCreateDialog} className="p-2.5 sm:p-3 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center active:scale-95 transition-all flex-shrink-0" aria-label="Create a group">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6"/>
            </button>)}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {[{ label: 'Active Groups', value: groups.length, icon: Layers, color: 'text-primary', bg: 'bg-primary/15' },
            { label: 'Total Members', value: totalMembers, icon: Users, color: 'text-success', bg: 'bg-success/15' },
            { label: 'Combined Pool', value: fmt(totalPool), icon: Wallet, color: 'text-warning', bg: 'bg-warning/15' }]
            .map(({ label, value, icon: Icon, color, bg }) => (<div key={label} className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border overflow-hidden">
                <div className={`w-7 h-7 sm:w-9 sm:h-9 ${bg} rounded-lg sm:rounded-xl flex items-center justify-center mb-2`}>
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${color}`}/>
                </div>
                <p className="app-caption text-muted-foreground uppercase mb-0.5">{label}</p>
                <p className={`app-value truncate select-none ${color}`}>{value}</p>
              </div>))}
        </div>

        <div className="relative mb-4 sm:mb-5">
          <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground"/>
          <input type="text" placeholder="Search groups…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 sm:pl-14 pr-4 sm:pr-5 py-2.5 sm:py-3 bg-card rounded-2xl border-2 border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm text-foreground transition-all"/>
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-3">
        {!appReady && filtered.length === 0 ? (<SkeletonList count={3}/>) : filtered.length === 0 ? (<div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary/40">
              <Layers className="w-8 h-8"/>
            </div>
            <h3 className="text-lg font-bold text-foreground">{groups.length === 0 ? 'No Groups Yet' : 'No Matches'}</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-5">{groups.length === 0 ? 'Create your first susu group to start collecting contributions.' : 'Try a different search term.'}</p>
            {canAdd && groups.length === 0 && (<button type="button" onClick={openCreateDialog} className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-bold">
                Create first group
              </button>)}
          </div>) : (filtered.map((group) => (
            <div key={group.id} className="relative">
              <div onClick={() => setDetailGroup(group)} className="cursor-pointer">
                <GroupCard groupName={group.groupName || group.name} memberCount={group.memberCount} currentRound={group.currentRound || 0} totalSlots={group.totalSlots} totalRounds={group.totalRounds || group.totalSlots} contributionAmount={group.contributionAmount} frequency={group.frequency || 'Weekly'} poolSize={group.poolSize} nextPayoutLabel={group.nextPayoutLabel} color={group.color} cashoutAmount={group.cashoutAmount || (group.contributionAmount * (group.totalRounds || group.totalSlots || 1))} onEdit={canEdit ? () => openEditDialog(group) : undefined}/>
              </div>
              {canAdd && (
                <button type="button" onClick={(e) => { e.stopPropagation(); copyInviteLink(group); }} aria-label="Copy invite link" title="Copy invite link" className="absolute bottom-3 right-3 w-8 h-8 rounded-xl bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors z-10">
                  <Link2 className="w-3.5 h-3.5 text-white" aria-hidden="true"/>
                </button>
              )}
            </div>
          )))}
      </div>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] animate-in zoom-in-95 duration-300">

            {/* Header */}
            <div className="flex items-center justify-between px-6 sm:px-8 pt-4 sm:pt-7 pb-4 flex-shrink-0 border-b border-border/50">
              <div>
                <h3 className="text-xl font-bold text-foreground tracking-tight">{editingId != null ? 'Edit Group' : 'New Group'}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Susu Circle Configuration</p>
              </div>
              <button type="button" onClick={closeDialog} className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <X className="w-4 h-4"/>
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Group Name</label>
                <input type="text" placeholder="e.g. Market Women Circle" value={draft.groupName} onChange={(e) => setDraft(prev => ({ ...prev, groupName: e.target.value }))} className="w-full bg-card border-2 border-border rounded-2xl px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Contribution (GH₵)</label>
                  <input type="number" min={0} value={draft.contributionAmount} onChange={(e) => setDraft(prev => ({ ...prev, contributionAmount: e.target.value }))} className="w-full bg-card border-2 border-border rounded-2xl px-4 py-3.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Frequency</label>
                  <select value={draft.frequency} onChange={(e) => setDraft(prev => ({ ...prev, frequency: e.target.value }))} className="w-full bg-card border-2 border-border rounded-2xl px-4 py-3.5 text-sm font-medium text-foreground outline-none focus:border-primary/50 transition-all">
                    <option>Daily</option><option>Weekly</option><option>Bi-weekly</option><option>Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Total Rounds</label>
                <input type="number" min={1} value={draft.totalRounds} onChange={(e) => setDraft(prev => ({ ...prev, totalRounds: e.target.value }))} className="w-full bg-card border-2 border-border rounded-2xl px-4 py-3.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"/>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Cashout per Member (GH₵)</label>
                <input type="number" min={0} value={draft.cashoutAmount} onChange={(e) => setDraft(prev => ({ ...prev, cashoutAmount: e.target.value }))} className="w-full bg-card border-2 border-border rounded-2xl px-4 py-3.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" placeholder={`Auto: GH₵${(Number(draft.contributionAmount||0) * Number(draft.totalRounds||0)) || ''}`}/>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-2 block">Accent Colour</label>
                <div className="flex gap-2.5 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft(prev => ({ ...prev, color: c }))}
                      className={`w-9 h-9 rounded-full transition-all active:scale-90 ${draft.color === c ? 'ring-2 ring-offset-2 ring-offset-card' : 'hover:scale-110'}`}
                      style={{ background: c, ringColor: c }}
                      aria-label={`Select colour ${c}`}
                    />
                  ))}
                </div>
              </div>
              {dialogError && (
                <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                  {dialogError}
                </div>
              )}
            </div>

            {/* Sticky footer buttons */}
            <div className="flex gap-3 px-6 sm:px-8 py-4 border-t border-border/50 bg-card flex-shrink-0">
              <button type="button" onClick={closeDialog} className="flex-1 bg-muted/60 border border-border/60 py-3.5 rounded-2xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="flex-[1.6] bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(100,145,222,0.40)] py-3.5 rounded-2xl text-sm font-bold hover:opacity-95 active:scale-[0.98] transition-all">
                {editingId != null ? 'Save Changes' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailGroup && (
        <GroupDetailPanel
          group={detailGroup}
          users={users}
          payments={payments}
          canEdit={canEdit}
          onClose={() => setDetailGroup(null)}
          onEdit={() => { setDetailGroup(null); openEditDialog(detailGroup); }}
        />
      )}
    </div>);
}

function GroupDetailPanel({ group, users, payments, canEdit, onClose, onEdit }) {
    const members = Array.isArray(group.members) ? group.members : [];
    const accent = group.color || '#6491DE';
    const totalSlots = group.totalSlots || group.totalRounds || 1;
    const currentRound = group.currentRound || 0;
    const contributionAmount = group.contributionAmount || group.contribution || 0;
    const completionRate = Math.min((currentRound / totalSlots) * 100, 100);
    const cashout = group.cashoutAmount || contributionAmount * totalSlots;

    const getPaymentStatus = (memberId) => {
        const memberPayments = payments.filter(p =>
            String(p.groupId) === String(group.id) &&
            String(p.memberId || p.userId) === String(memberId)
        );
        const roundPayment = memberPayments.find(p => Number(p.round) === currentRound);
        const latest = roundPayment || [...memberPayments].sort((a, b) =>
            new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0)
        )[0];
        return latest?.status || null;
    };

    const statusChip = (status) => {
        if (status === 'paid') return { cls: 'bg-success/15 text-success', icon: CheckCircle };
        if (status === 'pending') return { cls: 'bg-primary/15 text-primary', icon: Clock };
        if (status === 'overdue') return { cls: 'bg-destructive/15 text-destructive', icon: AlertCircle };
        return { cls: 'bg-muted text-muted-foreground', icon: Clock };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl overflow-hidden max-h-[85dvh] flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-border flex items-start justify-between gap-3" style={{ borderLeftColor: accent, borderLeftWidth: '4px' }}>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-foreground truncate">{group.groupName || group.name}</h3>
                        <p className="text-muted-foreground text-sm">{group.frequency} · Round {currentRound}/{totalSlots}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {canEdit && (
                            <button type="button" onClick={onEdit} className="w-9 h-9 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit group">
                                <Pencil className="w-4 h-4"/>
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center" aria-label="Close">
                            <X className="w-5 h-5 text-muted-foreground"/>
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="p-5 border-b border-border">
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div className="h-full rounded-full transition-all" style={{ width: `${completionRate}%`, background: accent }}/>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                            <p className="text-muted-foreground text-xs mb-0.5">Contribution</p>
                            <p className="font-bold text-sm text-foreground">{fmt(contributionAmount)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs mb-0.5">Pool / Round</p>
                            <p className="font-bold text-sm text-foreground">{fmt(contributionAmount * members.length)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs mb-0.5">Cashout</p>
                            <p className="font-bold text-sm" style={{ color: accent }}>{fmt(cashout)}</p>
                        </div>
                    </div>
                </div>

                {/* Members list */}
                <div className="overflow-y-auto flex-1 p-5">
                    <h4 className="text-xs font-medium text-foreground/70 mb-3">
                        Members ({members.length})
                    </h4>
                    {members.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-4 text-center">No members assigned yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {members.map((memberId, idx) => {
                                const user = users.find(u => String(u.id) === String(memberId));
                                const status = getPaymentStatus(memberId);
                                const { cls, icon: StatusIcon } = statusChip(status);
                                return (
                                    <div key={memberId} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: accent }}>
                                                {(user?.fullName || user?.name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-foreground text-sm font-semibold truncate">{user?.fullName || user?.name || `Member ${idx + 1}`}</p>
                                                <p className="text-muted-foreground text-xs truncate">{user?.phone || user?.email || ''}</p>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase flex-shrink-0 ml-2 ${cls}`}>
                                            <StatusIcon className="w-3 h-3"/>
                                            {status || 'no data'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

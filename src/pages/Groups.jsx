import { Search, Plus, Users, X, Layers, DollarSign } from 'lucide-react';
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
    color: '#00E5BE',
};
const COLORS = ["#00E5BE", "#FF9F43", "#A29BFE", "#FF6B6B", "#74B9FF", "#FD79A8", "#00CEC9", "#FFD166"];
export function Groups() {
    const { authUser, groups, createGroup, updateGroup, appReady } = useAppContext();
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [draft, setDraft] = useState(EMPTY_GROUP_DRAFT);
    const [dialogError, setDialogError] = useState(null);
    // null = create mode; otherwise the id of the group being edited.
    const [editingId, setEditingId] = useState(null);
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
            color: String(g.color || '#00E5BE'),
        });
        setEditingId(g.id);
        setDialogOpen(true);
    };
    const closeDialog = () => { setDialogOpen(false); setDialogError(null); setEditingId(null); };
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
    return (<div className="pb-32 page-enter">
      <div className="px-6 md:px-10 pt-10 pb-8">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Layers className="w-4 h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground/50">Group Management</p>
            </div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none mb-2">Susu Groups</h1>
            <p className="text-muted-foreground text-sm font-medium">Manage all active rotating savings circles.</p>
          </div>
          {canAdd && (<button type="button" onClick={openCreateDialog} className="w-14 h-14 rounded-[1.25rem] bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all group flex-shrink-0" aria-label="Create a group">
              <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300"/>
            </button>)}
        </div>

        <div className="grid grid-cols-3 gap-5 mb-8">
          {[{ label: 'Active Groups', value: groups.length, icon: Layers, color: 'text-primary', bg: 'bg-primary/15' },
            { label: 'Total Members', value: totalMembers, icon: Users, color: 'text-success', bg: 'bg-success/15' },
            { label: 'Combined Pool', value: fmt(totalPool), icon: DollarSign, color: 'text-warning', bg: 'bg-warning/15' }]
            .map(({ label, value, icon: Icon, color, bg }) => (<div key={label} className="glass-card p-5 rounded-[2rem] border border-border relative overflow-hidden group">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`}/>
                </div>
                <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest mb-1">{label}</p>
                <p className={`text-xl font-bold tracking-tight ${color}`}>{value}</p>
              </div>))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30"/>
          <input type="text" placeholder="Search groups…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-14 pr-5 py-4 bg-input-background rounded-2xl border border-border focus:bg-card focus:border-primary/20 focus:ring-4 focus:ring-primary/5 text-sm font-bold text-foreground placeholder:text-muted-foreground/30 outline-none transition-all"/>
        </div>
      </div>

      <div className="px-6 md:px-10 space-y-5">
        {!appReady && filtered.length === 0 ? (<SkeletonList count={3}/>) : filtered.length === 0 ? (<div className="glass-card rounded-[2.5rem] border border-dashed border-border p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 text-primary/40">
              <Layers className="w-10 h-10"/>
            </div>
            <h3 className="text-xl font-bold text-foreground">{groups.length === 0 ? 'No Groups Yet' : 'No Matches'}</h3>
            <p className="text-muted-foreground/40 text-sm mt-2 mb-6">{groups.length === 0 ? 'Create your first susu group to start collecting contributions.' : 'Try a different search term.'}</p>
            {canAdd && groups.length === 0 && (<button type="button" onClick={openCreateDialog} className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-bold uppercase tracking-wider">
                Create First Group
              </button>)}
          </div>) : (filtered.map((group) => (<GroupCard key={group.id} groupName={group.groupName || group.name} memberCount={group.memberCount} currentRound={group.currentRound || 0} totalSlots={group.totalSlots} contributionAmount={group.contributionAmount} frequency={group.frequency || 'Weekly'} poolSize={group.poolSize} nextPayoutLabel={group.nextPayoutLabel} color={group.color} onEdit={canEdit ? () => openEditDialog(group) : undefined}/>)))}
      </div>

      {dialogOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm backdrop-blur-md page-enter">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg p-8 md:p-10 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">{editingId != null ? 'Edit Group' : 'New Group'}</h3>
                <p className="text-muted-foreground/50 text-xs font-bold uppercase tracking-widest mt-1">Susu Circle Configuration</p>
              </div>
              <button type="button" onClick={closeDialog} className="w-10 h-10 rounded-xl bg-border flex items-center justify-center text-foreground/40 hover:bg-accent hover:text-foreground transition-all">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-5 relative z-10">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Group Name</label>
                <input type="text" placeholder="e.g. Market Women Circle" value={draft.groupName} onChange={(e) => setDraft(prev => ({ ...prev, groupName: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground placeholder:text-foreground/20 focus:bg-card focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Contribution (GH₵)</label>
                  <input type="number" min={0} value={draft.contributionAmount} onChange={(e) => setDraft(prev => ({ ...prev, contributionAmount: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground outline-none focus:border-primary/40 transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Frequency</label>
                  <select value={draft.frequency} onChange={(e) => setDraft(prev => ({ ...prev, frequency: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground outline-none focus:border-primary/40 transition-all">
                    <option>Daily</option><option>Weekly</option><option>Bi-weekly</option><option>Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Total Rounds</label>
                <input type="number" min={1} value={draft.totalRounds} onChange={(e) => setDraft(prev => ({ ...prev, totalRounds: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground outline-none focus:border-primary/40 transition-all"/>
              </div>
              <div className="pt-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">Accent Colour</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (<div key={c} onClick={() => setDraft(prev => ({ ...prev, color: c }))} className={`w-8 h-8 rounded-full cursor-pointer transition-all ${draft.color === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''}`} style={{ background: c }}/>))}
                </div>
              </div>
              {dialogError && (<div className="flex items-center gap-2 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                  {dialogError}
                </div>)}
            </div>

            <div className="flex gap-3 mt-10 relative z-10">
              <button type="button" onClick={closeDialog} className="flex-1 bg-accent border border-border py-4 rounded-2xl text-xs font-bold uppercase tracking-wide text-foreground/40 hover:bg-accent hover:text-foreground transition-all">
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="flex-[1.5] bg-primary text-primary-foreground shadow-xl shadow-primary/30 py-4 rounded-2xl text-xs font-bold uppercase tracking-wide hover:scale-[1.02] active:scale-95 transition-all">
                {editingId != null ? 'Save Changes' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}

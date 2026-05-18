import { Search, CheckCircle, XCircle, Filter, X, UserPlus, Users, AlertCircle, ChevronRight, Phone } from 'lucide-react';
import { useState, useMemo } from 'react';
import { SkeletonList } from '../components/ui/LoadingState';
import { MemberCard, MemberDrawer } from '../components/domain';
import { useAppContext } from '../context/AppContext';
import { validateMemberRegistration } from '../validation/memberRules';
import { toast } from '../utils/toast';
import { cn } from '../components/ui/utils';
const EMPTY_MEMBER_DRAFT = {
    fullName: '', email: '', phone: '', groupId: '', ghanaCard: '', address: '', bankMomo: ''
};
export function Members() {
    const { authUser, users, groups, payments, approveUser, rejectUser, registerMember, updateMember, appReady } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [draft, setDraft] = useState(EMPTY_MEMBER_DRAFT);
    const [dialogError, setDialogError] = useState(null);
    const [drawerMember, setDrawerMember] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const canAdd = authUser && ['admin', 'manager'].includes(authUser.role);
    const canEdit = canAdd;
    const openDialog = () => {
        setDialogError(null);
        setDraft({ ...EMPTY_MEMBER_DRAFT, groupId: groups[0]?.id || '' });
        setEditingId(null);
        setDialogOpen(true);
    };
    const openEditDialog = (member) => {
        setDialogError(null);
        setDraft({
            fullName: member.fullName || member.name || '',
            email: member.email || '',
            phone: member.phone || '',
            groupId: member.groupId || '',
            ghanaCard: member.ghanaCard || '',
            address: member.address || '',
            bankMomo: member.bankMomo || '',
        });
        setEditingId(member.id);
        setDialogOpen(true);
        setDrawerMember(null);
    };
    const closeDialog = () => { setDialogOpen(false); setDialogError(null); setEditingId(null); };
    const handleSave = () => {
        const v = validateMemberRegistration(draft);
        if (!v.ok) {
            setDialogError(v.message || 'Invalid input.');
            return;
        }
        if (editingId != null) {
            updateMember(editingId, {
                fullName: draft.fullName.trim(),
                name: draft.fullName.trim(),
                email: draft.email.trim(),
                phone: draft.phone.trim(),
                groupId: draft.groupId || null,
                ghanaCard: draft.ghanaCard.trim(),
                address: draft.address.trim(),
                bankMomo: draft.bankMomo.trim(),
            });
            toast.success(`Updated ${draft.fullName.trim()}`);
            closeDialog();
            return;
        }
        registerMember({
            fullName: draft.fullName.trim(),
            name: draft.fullName.trim(),
            email: draft.email.trim(),
            phone: draft.phone.trim(),
            groupId: draft.groupId || null,
            ghanaCard: draft.ghanaCard.trim(),
            address: draft.address.trim(),
            bankMomo: draft.bankMomo.trim(),
            status: 'pending',
        });
        toast.success(`Added ${draft.fullName.trim()} — awaiting approval`);
        closeDialog();
    };
    const membersWithDetails = useMemo(() => users
        .filter(member => member.role === 'member')
        .map(member => {
        const group = groups.find(g => g.id === member.groupId);
        const paymentCount = payments.filter(p => (p.memberId || p.userId) === member.id && p.status === 'paid').length;
        const hasOverdue = payments.some(p => (p.memberId || p.userId) === member.id && p.status === 'overdue');
        let displayStatus;
        if (member.status === 'suspended' || (member.status === 'approved' && hasOverdue))
            displayStatus = 'defaulter';
        else if (member.status === 'approved')
            displayStatus = 'active';
        else
            displayStatus = member.status;
        return {
            ...member,
            groupName: group?.groupName || group?.name || 'No Group',
            paymentCount,
            contributionAmount: group?.contributionAmount || group?.contribution || 0,
            displayStatus,
        };
    }), [users, groups, payments]);
    const filteredMembers = membersWithDetails.filter(member => {
        const name = member.fullName || member.name || '';
        const q = searchTerm.toLowerCase();
        const matchesSearch = !q ||
            name.toLowerCase().includes(q) ||
            (member.phone || '').includes(searchTerm) ||
            (member.email || '').toLowerCase().includes(q);
        const matchesFilter = filterStatus === 'all' || member.displayStatus === filterStatus;
        return matchesSearch && matchesFilter;
    });
    const activeCount = membersWithDetails.filter(m => m.displayStatus === 'active').length;
    const pendingCount = membersWithDetails.filter(m => m.displayStatus === 'pending').length;
    const defaulterCount = membersWithDetails.filter(m => m.displayStatus === 'defaulter').length;
    const renderFooter = (member) => {
        if (member.displayStatus !== 'pending')
            return null;
        const name = member.fullName || member.name || 'Member';
        return (<div className="flex gap-2 mt-4">
        <button type="button" onClick={() => { approveUser(member.id); toast.success(`${name} approved`); }} className="flex-1 bg-success text-success-foreground py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-success/10 hover:scale-105 active:scale-95 transition-all">
          <CheckCircle className="w-4 h-4"/>
          Approve
        </button>
        <button type="button" onClick={() => { rejectUser(member.id); toast.error(`${name} rejected`); }} className="flex-1 bg-destructive/8 border border-destructive/20 text-destructive py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-destructive/10 transition-all">
          <XCircle className="w-4 h-4"/>
          Reject
        </button>
      </div>);
    };
    return (<div className="pb-28 page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 space-y-4">
        {/* ── Page title row ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="app-title text-foreground">Members</h1>
            <p className="app-caption text-muted-foreground mt-1.5">
              {filteredMembers.length} shown from {membersWithDetails.length} total
            </p>
          </div>
          {canAdd && (
            <button type="button" onClick={openDialog}
              className="h-10 px-3.5 bg-primary text-primary-foreground rounded-xl app-control active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
              aria-label="Add new member">
              <UserPlus className="w-4 h-4"/>
              <span className="hidden sm:inline">Add member</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-border bg-card/70">
          {[
            { label: 'Active', value: activeCount, tone: 'text-success' },
            { label: 'Pending', value: pendingCount, tone: 'text-primary' },
            { label: 'At risk', value: defaulterCount, tone: 'text-destructive' },
            { label: 'Total', value: membersWithDetails.length, tone: 'text-foreground' },
          ].map(item => (
            <div key={item.label} className="min-w-0 px-2.5 py-2 border-r border-border last:border-r-0">
              <p className={cn('app-value', item.tone)}>{item.value}</p>
              <p className="app-caption text-muted-foreground mt-1.5 truncate">{item.label}</p>
            </div>
          ))}
        </div>

        {/* ── Search + filter controls ── */}
        <div className="space-y-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/>
            <input type="text" placeholder="Search by name, phone, or email…" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-9 pr-4 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground placeholder:text-muted-foreground/55 transition-all"/>
          </div>
          <div className="flex rounded-lg border border-border bg-card/70 p-0.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'pending', label: 'Pending' },
              { id: 'defaulter', label: 'Defaulters' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setFilterStatus(tab.id)}
                className={cn('min-w-0 flex-1 px-2 py-1.5 rounded-md whitespace-nowrap app-tab transition-colors flex-shrink-0',
                  filterStatus === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        {!appReady && filteredMembers.length === 0 ? (<SkeletonList count={6}/>) : filteredMembers.length === 0 ? (
          <div className="glass-card rounded-xl border border-dashed border-border p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-border flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Filter className="w-8 h-8"/>
            </div>
            <h3 className="text-lg font-bold text-foreground">No Members Found</h3>
            <p className="text-muted-foreground text-sm mt-1">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[minmax(160px,2fr)_minmax(120px,1.2fr)_100px_140px_60px_80px] gap-x-4 px-4 py-2 border-b border-border bg-muted/20">
              <span className="eyebrow text-muted-foreground">Member</span>
              <span className="eyebrow text-muted-foreground">Group</span>
              <span className="eyebrow text-muted-foreground">Status</span>
              <span className="eyebrow text-muted-foreground">Phone</span>
              <span className="eyebrow text-muted-foreground text-center">Cycles</span>
              <span className="eyebrow text-muted-foreground text-right">Action</span>
            </div>

            <div className="divide-y divide-border">
              {filteredMembers.map((member) => {
                const name = member.fullName || member.name || 'Unknown';
                const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                const isPending = member.displayStatus === 'pending';
                const isDefaulter = member.displayStatus === 'defaulter';
                const statusCfg = isPending
                  ? { label: 'Pending', cls: 'bg-primary/10 text-primary' }
                  : isDefaulter
                  ? { label: 'Defaulter', cls: 'bg-destructive/10 text-destructive' }
                  : { label: 'Active', cls: 'bg-success/10 text-success' };

                return (
                  <div key={member.id}
                    onClick={() => setDrawerMember(member)}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(160px,2fr)_minmax(120px,1.2fr)_100px_140px_60px_80px] items-center gap-x-4 px-4 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors group">

                    {/* Avatar + Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center app-value flex-shrink-0 text-white',
                        isDefaulter ? 'bg-destructive/80' : isPending ? 'bg-primary/60' : 'bg-primary')}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="app-row-title text-foreground truncate group-hover:text-primary transition-colors">{name}</p>
                        <p className="app-row-meta text-muted-foreground truncate sm:hidden">{member.groupName} · {member.phone || '—'}</p>
                      </div>
                    </div>

                    {/* Group */}
                    <p className="hidden sm:block text-sm text-muted-foreground truncate">{member.groupName}</p>

                    {/* Status */}
                    <div className="hidden sm:block">
                      <span className={cn('inline-flex px-2 py-0.5 rounded-md app-badge', statusCfg.cls)}>
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Phone */}
                    <p className="hidden sm:block text-sm text-muted-foreground tabular-nums">{member.phone || '—'}</p>

                    {/* Cycles */}
                    <p className="hidden sm:block text-sm text-foreground text-center tabular-nums">{member.paymentCount}</p>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {/* Mobile status pill */}
                      <span className={cn('sm:hidden app-badge px-1.5 py-0.5 rounded', statusCfg.cls)}>
                        {statusCfg.label}
                      </span>
                      {isPending && canAdd ? (
                        <div className="flex gap-1">
                          <button type="button"
                            onClick={() => { approveUser(member.id); toast.success(`${name} approved`); }}
                            title="Approve"
                            className="w-7 h-7 rounded-lg bg-success/15 text-success flex items-center justify-center hover:bg-success/25 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5"/>
                          </button>
                          <button type="button"
                            onClick={() => { rejectUser(member.id); toast.error(`${name} rejected`); }}
                            title="Reject"
                            className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors">
                            <XCircle className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors"/>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {searchTerm && (
              <div className="px-4 py-2 border-t border-border bg-muted/10 flex justify-end">
                <button type="button" onClick={() => setSearchTerm('')} className="text-xs text-primary hover:underline">Clear search</button>
              </div>
            )}
          </div>
        )}
      </div>

      {drawerMember && (<MemberDrawer user={drawerMember} onClose={() => setDrawerMember(null)} onEdit={canEdit ? () => openEditDialog(drawerMember) : undefined}/>)}

      {dialogOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm backdrop-blur-md page-enter">
          <div className="bg-card rounded-2xl border border-border w-full max-w-2xl p-8 md:p-10 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">{editingId != null ? 'Edit Member' : 'New Registration'}</h3>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Identity & Financial Setup</p>
              </div>
              <button type="button" onClick={closeDialog} className="w-10 h-10 rounded-xl bg-border flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Full Name</label>
                  <input type="text" placeholder="John Doe" value={draft.fullName} onChange={(e) => setDraft(prev => ({ ...prev, fullName: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:border-primary/40 outline-none transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Phone Number</label>
                  <input type="tel" placeholder="+233..." value={draft.phone} onChange={(e) => setDraft(prev => ({ ...prev, phone: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:border-primary/40 outline-none transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Email Address</label>
                  <input type="email" placeholder="john@example.com" value={draft.email} onChange={(e) => setDraft(prev => ({ ...prev, email: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:border-primary/40 outline-none transition-all"/>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Susu Group</label>
                  <select value={draft.groupId} onChange={(e) => setDraft(prev => ({ ...prev, groupId: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:border-primary/40 outline-none transition-all">
                    <option value="">No group yet</option>
                    {groups.map(g => (<option key={g.id} value={g.id}>{g.groupName || g.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Ghana Card Number</label>
                  <input type="text" placeholder="GHA-000000000-0" value={draft.ghanaCard} onChange={(e) => setDraft(prev => ({ ...prev, ghanaCard: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:border-primary/40 outline-none transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">MoMo / Bank Info</label>
                  <input type="text" placeholder="MTN MoMo: 024..." value={draft.bankMomo} onChange={(e) => setDraft(prev => ({ ...prev, bankMomo: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:border-primary/40 outline-none transition-all"/>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Physical Address</label>
                <input type="text" placeholder="House No, Street, City" value={draft.address} onChange={(e) => setDraft(prev => ({ ...prev, address: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:border-primary/40 outline-none transition-all"/>
              </div>
            </div>

            {dialogError && (<div className="mt-6 flex items-center gap-2 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold relative z-10">
                <AlertCircle className="w-4 h-4"/>
                {dialogError}
              </div>)}

            <div className="flex gap-3 mt-10 relative z-10">
              <button type="button" onClick={closeDialog} className="flex-1 bg-accent border border-border py-4 rounded-2xl text-xs font-bold uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="flex-[1.5] bg-primary text-primary-foreground shadow-xl shadow-primary/30 py-4 rounded-2xl text-xs font-bold uppercase tracking-wide hover:scale-[1.02] active:scale-95 transition-all">
                {editingId != null ? 'Save Changes' : 'Complete Registration'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}

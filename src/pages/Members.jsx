import { Search, CheckCircle, XCircle, Filter, X, UserPlus, Users, AlertCircle, ChevronRight, Phone } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { TablePagination } from '../components/ui/TablePagination';
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
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;
    const canAdd = authUser && ['admin', 'manager'].includes(authUser.role);
    const canEdit = canAdd;
    const openDialog = () => {
        setDialogError(null);
        setDraft({ ...EMPTY_MEMBER_DRAFT });
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
        if (submitting) return;
        const v = validateMemberRegistration(draft, users);
        if (!v.ok) {
            setDialogError(v.message || 'Invalid input.');
            return;
        }
        setSubmitting(true);
        if (editingId != null) {
            updateMember(editingId, {
                fullName: draft.fullName.trim(),
                email: draft.email.trim(),
                phone: draft.phone.trim(),
                groupId: draft.groupId || null,
                ghanaCard: draft.ghanaCard.trim(),
                address: draft.address.trim(),
                bankMomo: draft.bankMomo.trim(),
            });
            toast.success(`Updated ${draft.fullName.trim()}`);
            closeDialog();
            setSubmitting(false);
            return;
        }
        registerMember({
            fullName: draft.fullName.trim(),
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
        setSubmitting(false);
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
    useEffect(() => { setPage(1); }, [searchTerm, filterStatus]);
    const pagedMembers = filteredMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const activeCount = membersWithDetails.filter(m => m.displayStatus === 'active').length;
    const pendingCount = membersWithDetails.filter(m => m.displayStatus === 'pending').length;
    const defaulterCount = membersWithDetails.filter(m => m.displayStatus === 'defaulter').length;
    const renderFooter = (member) => {
        if (member.displayStatus !== 'pending')
            return null;
        const name = member.fullName || member.name || 'Member';
        return (<div className="flex gap-2 mt-4">
        <button type="button" onClick={() => { approveUser(member.id); toast.success(`${name} approved`); }} className="flex-1 bg-success text-success-foreground py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-success/10 hover:opacity-90 active:scale-95 transition-all">
          <CheckCircle className="w-4 h-4"/>
          Approve
        </button>
        <button type="button" onClick={() => { if (!window.confirm(`Reject ${name}'s registration? This cannot be undone.`)) return; rejectUser(member.id); toast.error(`${name} rejected`); }} className="flex-1 bg-destructive/8 border border-destructive/20 text-destructive py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-destructive/10 transition-all">
          <XCircle className="w-4 h-4"/>
          Reject
        </button>
      </div>);
    };
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 space-y-4">
        {/* ── Page title row ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground">Member Management</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Members</h1>
            <p className="text-muted-foreground text-sm">{filteredMembers.length} shown from {membersWithDetails.length} total</p>
          </div>
          {canAdd && (
            <button type="button" onClick={openDialog}
              className="h-10 px-3.5 bg-primary text-primary-foreground rounded-xl app-control active:scale-95 transition-all flex items-center gap-2 flex-shrink-0 mt-1"
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
            { label: 'At risk', value: defaulterCount, tone: defaulterCount > 0 ? 'text-destructive' : 'text-foreground' },
            { label: 'Total', value: membersWithDetails.length, tone: 'text-foreground' },
          ].map(item => (
            <div key={item.label} className="min-w-0 px-2.5 py-2 border-r border-border last:border-r-0">
              <p className={cn('app-value select-none', item.tone)}>{item.value}</p>
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
              className="w-full h-11 pl-9 pr-4 bg-card rounded-xl border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-sm text-foreground placeholder:text-muted-foreground/55 transition-all"/>
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

      {canAdd && selectedIds.size > 0 && (
        <div className="px-4 sm:px-6 mb-3 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5">
            <span className="text-primary text-sm font-semibold">{selectedIds.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <button type="button"
                onClick={() => { if (!window.confirm(`Approve ${selectedIds.size} member(s)?`)) return; selectedIds.forEach(id => approveUser(id)); toast.success(`${selectedIds.size} member(s) approved`); setSelectedIds(new Set()); }}
                className="px-3 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90">
                <CheckCircle className="w-3.5 h-3.5"/>Approve all
              </button>
              <button type="button"
                onClick={() => { if (!window.confirm(`Reject ${selectedIds.size} member(s)? This cannot be undone.`)) return; selectedIds.forEach(id => rejectUser(id)); toast.error(`${selectedIds.size} member(s) rejected`); setSelectedIds(new Set()); }}
                className="px-3 py-1.5 rounded-lg bg-destructive/15 text-destructive border border-destructive/20 text-xs font-bold flex items-center gap-1.5 hover:bg-destructive/20">
                <XCircle className="w-3.5 h-3.5"/>Reject all
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="px-2 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:bg-accent">Clear</button>
            </div>
          </div>
        </div>
      )}

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
              {pagedMembers.map((member) => {
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
                      {canAdd && isPending && (
                        <input type="checkbox" checked={selectedIds.has(member.id)}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            e.stopPropagation();
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              e.target.checked ? next.add(member.id) : next.delete(member.id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded accent-primary flex-shrink-0 cursor-pointer"/>
                      )}
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
                            onClick={() => { if (!window.confirm(`Reject ${name}'s registration? This cannot be undone.`)) return; rejectUser(member.id); toast.error(`${name} rejected`); }}
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

            <TablePagination total={filteredMembers.length} page={page} perPage={PAGE_SIZE} onChange={setPage}/>
          </div>
        )}
      </div>

      {drawerMember && (<MemberDrawer user={drawerMember} onClose={() => setDrawerMember(null)} onEdit={canEdit ? () => openEditDialog(drawerMember) : undefined}/>)}

      {dialogOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm page-enter" onClick={closeDialog}>
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[88dvh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 sm:px-8 pt-4 sm:pt-6 pb-4 flex-shrink-0 border-b border-border/50">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">{editingId != null ? 'Edit Member' : 'New Registration'}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Identity & Financial Setup</p>
              </div>
              <button type="button" onClick={closeDialog} className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <X className="w-4 h-4"/>
              </button>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Full Name</label>
                    <input type="text" placeholder="John Doe" value={draft.fullName} onChange={(e) => setDraft(prev => ({ ...prev, fullName: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Phone Number</label>
                    <input type="tel" placeholder="+233..." value={draft.phone} onChange={(e) => setDraft(prev => ({ ...prev, phone: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Email Address</label>
                    <input type="email" placeholder="john@example.com" value={draft.email} onChange={(e) => setDraft(prev => ({ ...prev, email: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"/>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Susu Group</label>
                    <select value={draft.groupId} onChange={(e) => setDraft(prev => ({ ...prev, groupId: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all">
                      <option value="">No group yet</option>
                      {groups.map(g => (<option key={g.id} value={g.id}>{g.groupName || g.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Ghana Card Number</label>
                    <input type="text" placeholder="GHA-000000000-0" value={draft.ghanaCard} onChange={(e) => setDraft(prev => ({ ...prev, ghanaCard: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground/70 mb-1.5 block">MoMo / Bank Info</label>
                    <input type="text" placeholder="MTN MoMo: 024..." value={draft.bankMomo} onChange={(e) => setDraft(prev => ({ ...prev, bankMomo: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"/>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Physical Address</label>
                  <input type="text" placeholder="House No, Street, City" value={draft.address} onChange={(e) => setDraft(prev => ({ ...prev, address: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"/>
                </div>
              </div>

              {dialogError && (<div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0"/>
                  {dialogError}
                </div>)}
            </div>

            {/* Sticky footer */}
            <div className="flex gap-3 px-6 sm:px-8 py-4 border-t border-border/50 bg-card flex-shrink-0">
              <button type="button" onClick={closeDialog} className="flex-1 bg-muted border border-border py-3.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-all">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={submitting} className="flex-[1.5] bg-primary text-primary-foreground shadow-lg shadow-primary/25 py-3.5 rounded-xl text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? 'Saving…' : editingId != null ? 'Save Changes' : 'Complete Registration'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}

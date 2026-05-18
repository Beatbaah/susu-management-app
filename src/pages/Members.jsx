import { Search, CheckCircle, XCircle, Filter, X, UserPlus, Users, AlertCircle } from 'lucide-react';
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
    return (<div className="pb-32 page-enter">
      <div className="px-6 md:px-10 pt-10 pb-8">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground/50">Community Registry</p>
            </div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight leading-none mb-2">Members</h1>
            <p className="text-muted-foreground text-sm font-medium">Manage member identity, groups, and status.</p>
          </div>
          {canAdd && (<button type="button" onClick={openDialog} className="w-14 h-14 rounded-[1.25rem] bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all group flex-shrink-0" aria-label="Add new member">
              <UserPlus className="w-8 h-8 group-hover:rotate-12 transition-transform duration-300"/>
            </button>)}
        </div>

        <div className="grid grid-cols-3 gap-5 mb-8">
          {[
            { label: 'Verified', value: activeCount, color: 'text-success', bg: 'bg-success/15' },
            { label: 'Pending', value: pendingCount, color: 'text-primary', bg: 'bg-primary/15' },
            { label: 'At Risk', value: defaulterCount, color: 'text-destructive', bg: 'bg-destructive/15' }
        ].map(({ label, value, color, bg }) => (<div key={label} className="glass-card p-5 rounded-[2rem] border border-border relative overflow-hidden group">
              <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest mb-1">{label}</p>
              <p className={cn("text-xl font-bold tracking-tight", color)}>{value}</p>
            </div>))}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30"/>
          <input type="text" placeholder="Search members by name, phone, or email…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-5 py-4 bg-input-background rounded-2xl border border-border focus:bg-card focus:border-primary/20 focus:ring-4 focus:ring-primary/5 text-sm font-bold text-foreground placeholder:text-muted-foreground/30 outline-none transition-all"/>
        </div>

        <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-2">
          {[
            { id: 'all', label: 'All Members', count: membersWithDetails.length },
            { id: 'active', label: 'Active', count: activeCount },
            { id: 'pending', label: 'Pending', count: pendingCount },
            { id: 'defaulter', label: 'Defaulters', count: defaulterCount },
        ].map(tab => (<button key={tab.id} onClick={() => setFilterStatus(tab.id)} className={cn("px-5 py-2.5 rounded-xl whitespace-nowrap text-xs font-bold uppercase tracking-widest transition-all border", filterStatus === tab.id
                ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20'
                : 'bg-border text-muted-foreground/50 border-border hover:text-foreground')}>
              {tab.label} <span className="ml-1 opacity-40">{tab.count}</span>
            </button>))}
        </div>
      </div>

      <div className="px-6 md:px-10 space-y-5">
        {!appReady && filteredMembers.length === 0 ? (<SkeletonList count={4}/>) : filteredMembers.length === 0 ? (<div className="glass-card rounded-[2.5rem] border border-dashed border-border p-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-border flex items-center justify-center mx-auto mb-6 text-foreground/20">
              <Filter className="w-10 h-10"/>
            </div>
            <h3 className="text-xl font-bold text-foreground">No Members Found</h3>
            <p className="text-muted-foreground/40 text-sm mt-2">Try adjusting your search or filter criteria.</p>
          </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMembers.map((member) => (<MemberCard key={member.id} name={member.fullName || member.name || 'Unknown Member'} groupName={member.groupName} displayStatus={member.displayStatus} phone={member.phone} email={member.email} ghanaCard={member.ghanaCard} address={member.address} bankMomo={member.bankMomo} liveSelfie={member.liveSelfie} paymentCount={member.paymentCount} contributionAmount={member.contributionAmount} footer={renderFooter(member)} onClick={() => setDrawerMember(member)}/>))}
          </div>)}
      </div>

      {drawerMember && (<MemberDrawer user={drawerMember} onClose={() => setDrawerMember(null)} onEdit={canEdit ? () => openEditDialog(drawerMember) : undefined}/>)}

      {dialogOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm backdrop-blur-md page-enter">
          <div className="bg-card rounded-2xl border border-border w-full max-w-2xl p-8 md:p-10 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">{editingId != null ? 'Edit Member' : 'New Registration'}</h3>
                <p className="text-muted-foreground/50 text-xs font-bold uppercase tracking-widest mt-1">Identity & Financial Setup</p>
              </div>
              <button type="button" onClick={closeDialog} className="w-10 h-10 rounded-xl bg-border flex items-center justify-center text-foreground/40 hover:bg-accent hover:text-foreground transition-all">
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
              <button type="button" onClick={closeDialog} className="flex-1 bg-accent border border-border py-4 rounded-2xl text-xs font-bold uppercase tracking-wide text-foreground/40 hover:bg-accent hover:text-foreground transition-all">
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

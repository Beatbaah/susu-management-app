import { Search, Plus, CheckCircle, Clock, XCircle, Upload, X, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/LoadingState';
import { fmt } from '../utils/helpers';
import { useAppContext } from '../context/AppContext';
import { toast } from '../utils/toast';
const EMPTY_DRAFT = {
    memberId: '',
    groupId: '',
    amount: '',
    method: 'MTN MoMo',
    ref: '',
    round: '',
    dueDate: '',
};
export function Payments() {
    const { authUser, payments, users, groups, confirmPayment, rejectPayment, reopenPayment, recordPayment, updatePayment, appReady } = useAppContext();
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [draft, setDraft] = useState(EMPTY_DRAFT);
    const [dialogError, setDialogError] = useState(null);
    const memberOptions = useMemo(() => users.filter(u => u.role === 'member' && u.status === 'approved'), [users]);
    const visiblePayments = useMemo(() => {
        if (authUser?.role === 'member') {
            return payments.filter(p => (p.memberId || p.userId) === authUser.id);
        }
        return payments;
    }, [payments, authUser]);
    const paymentsWithDetails = useMemo(() => visiblePayments.map(payment => {
        const member = users.find(m => m.id === (payment.memberId || payment.userId));
        const group = groups.find(g => g.id === payment.groupId);
        let daysOverdue = 0;
        if (payment.status === 'overdue' && payment.dueDate) {
            const today = new Date();
            const due = new Date(payment.dueDate);
            daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
        }
        return {
            ...payment,
            memberName: member?.fullName || member?.name || 'Unknown',
            groupName: group?.groupName || group?.name || 'Unknown',
            daysOverdue,
        };
    }), [payments, users, groups]);
    const filteredPayments = paymentsWithDetails.filter(payment => {
        const q = searchTerm.toLowerCase();
        const matchesSearch = !q ||
            payment.memberName.toLowerCase().includes(q) ||
            payment.groupName.toLowerCase().includes(q) ||
            (payment.ref && payment.ref.toLowerCase().includes(q));
        const matchesFilter = filterStatus === 'all' || payment.status === filterStatus;
        return matchesSearch && matchesFilter;
    });
    const totalConfirmed = visiblePayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPending = visiblePayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalOverdue = visiblePayments.filter(p => p.status === 'overdue').length;
    // null = create / record new payment; otherwise editing an existing record.
    const [editingId, setEditingId] = useState(null);
    const openDialog = (prefill) => {
        setDialogError(null);
        setEditingId(null);
        setDraft({ ...EMPTY_DRAFT, ...prefill });
        setDialogOpen(true);
    };
    const openEditDialog = (payment) => {
        setDialogError(null);
        setEditingId(payment.id);
        setDraft({
            memberId: String(payment.memberId || payment.userId || ''),
            groupId: String(payment.groupId || ''),
            amount: String(payment.amount || ''),
            method: String(payment.method || 'MTN MoMo'),
            ref: String(payment.ref || ''),
            round: String(payment.round || ''),
            dueDate: String(payment.dueDate || ''),
        });
        setDialogOpen(true);
    };
    const closeDialog = () => { setDialogOpen(false); setDraft(EMPTY_DRAFT); setDialogError(null); setEditingId(null); };
    const handleMemberSelect = (memberId) => {
        const member = users.find(u => u.id === memberId);
        const group = member?.groupId ? groups.find(g => g.id === member.groupId) : null;
        setDraft(prev => ({
            ...prev,
            memberId,
            groupId: member?.groupId || prev.groupId,
            amount: group ? String(group.contributionAmount || group.contribution || prev.amount) : prev.amount,
            round: group ? String(group.currentRound || prev.round) : prev.round,
        }));
    };
    const handleSave = () => {
        setDialogError(null);
        const amountNum = Number(draft.amount);
        if (!draft.memberId) {
            setDialogError('Choose a member.');
            return;
        }
        if (!draft.groupId) {
            setDialogError('Choose a group.');
            return;
        }
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            setDialogError('Enter a valid amount.');
            return;
        }
        if (editingId) {
            const result = updatePayment(editingId, {
                amount: amountNum,
                method: draft.method,
                ref: draft.ref || undefined,
                round: draft.round ? Number(draft.round) : undefined,
                dueDate: draft.dueDate || undefined,
            });
            if (result?.ok) {
                toast.success(`Updated payment to ${fmt(amountNum)}`);
                closeDialog();
            }
            else
                setDialogError(result?.message || 'Could not update payment.');
            return;
        }
        const result = recordPayment({
            memberId: draft.memberId,
            userId: draft.memberId,
            groupId: draft.groupId,
            amount: amountNum,
            method: draft.method,
            ref: draft.ref || undefined,
            round: draft.round ? Number(draft.round) : undefined,
            dueDate: draft.dueDate || undefined,
        });
        if (result?.ok) {
            toast.success(`Recorded ${fmt(amountNum)} payment`);
            closeDialog();
        }
        else
            setDialogError(result?.message || 'Could not save payment.');
    };
    const canRecord = authUser && ['admin', 'manager', 'collector'].includes(authUser.role);
    const canConfirm = authUser && ['admin', 'manager'].includes(authUser.role);
    return (<div className="pb-28 page-enter">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="app-title text-foreground">Payments</h1>
          {canRecord && (<button type="button" onClick={() => openDialog()} className="p-2.5 sm:p-3 bg-primary rounded-2xl" aria-label="Record new payment">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground"/>
            </button>)}
        </div>

        <div className="relative mb-4 sm:mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input type="text" placeholder="Search payments..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-card rounded-2xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"/>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border overflow-hidden">
            <CheckCircle className="w-5 h-5 sm:w-8 sm:h-8 text-success mb-1 sm:mb-2"/>
            <p className="app-caption text-muted-foreground mb-1">Confirmed</p>
            <p className="app-value truncate text-foreground">{fmt(totalConfirmed)}</p>
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border overflow-hidden">
            <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-primary mb-1 sm:mb-2"/>
            <p className="app-caption text-muted-foreground mb-1">Pending</p>
            <p className="app-value truncate text-foreground">{fmt(totalPending)}</p>
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border overflow-hidden">
            <XCircle className="w-5 h-5 sm:w-8 sm:h-8 text-destructive mb-1 sm:mb-2"/>
            <p className="app-caption text-muted-foreground mb-1">Overdue</p>
            <p className="app-value text-foreground">{totalOverdue}</p>
          </div>
        </div>

        <div className="flex rounded-xl border border-border bg-card/70 p-1 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          {['all', 'paid', 'pending', 'overdue', 'rejected'].map(status => (<button key={status} onClick={() => setFilterStatus(status)} className={`min-w-0 flex-1 px-2.5 py-1.5 rounded-lg whitespace-nowrap app-tab transition-colors flex-shrink-0 ${filterStatus === status
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
              {status === 'all' ? 'All' : status === 'paid' ? 'Confirmed' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>))}
        </div>
      </div>

      <div className="px-4 sm:px-6">
        {!appReady && filteredPayments.length === 0 ? (
          <SkeletonList count={4}/>
        ) : filteredPayments.length === 0 ? (
          <EmptyState icon={CheckCircle} title="No payments found" description="Try adjusting your search or filter criteria" action={{ label: 'Clear Filters', onClick: () => { setSearchTerm(''); setFilterStatus('all'); }}}/>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="hidden sm:grid grid-cols-[minmax(140px,2fr)_minmax(100px,1.2fr)_90px_90px_90px_110px_72px] gap-x-3 px-4 py-2 border-b border-border bg-muted/20">
              <span className="eyebrow text-muted-foreground">Member</span>
              <span className="eyebrow text-muted-foreground">Group</span>
              <span className="eyebrow text-muted-foreground">Amount</span>
              <span className="eyebrow text-muted-foreground">Status</span>
              <span className="eyebrow text-muted-foreground">Date</span>
              <span className="eyebrow text-muted-foreground">Method</span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y divide-border">
              {filteredPayments.map((payment) => {
                const initials = payment.memberName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const SC = { paid: 'bg-success/15 text-success', pending: 'bg-primary/15 text-primary', overdue: 'bg-destructive/15 text-destructive', rejected: 'bg-muted text-muted-foreground' };
                const SL = { paid: 'Confirmed', pending: 'Pending', overdue: 'Overdue', rejected: 'Rejected' };
                const rawDate = payment.paymentDate || payment.date || payment.dueDate;
                const displayDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
                return (
                  <div key={payment.id} className="group">
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[minmax(140px,2fr)_minmax(100px,1.2fr)_90px_90px_90px_110px_72px] items-center gap-x-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary app-value flex-shrink-0">{initials}</div>
                        <span className="app-row-title text-foreground truncate">{payment.memberName}</span>
                      </div>
                      <p className="app-row-meta text-muted-foreground truncate">{payment.groupName}</p>
                      <p className="app-row-title text-foreground">{fmt(payment.amount)}</p>
                      <span className={`app-badge px-2 py-0.5 rounded-full w-fit ${SC[payment.status] || 'bg-muted text-muted-foreground'}`}>{SL[payment.status] || payment.status}</span>
                      <p className="app-caption text-muted-foreground">{displayDate}</p>
                      <p className="app-caption text-muted-foreground truncate">{payment.method || '—'}</p>
                      <div className="flex items-center gap-1">
                        {payment.status === 'pending' && canConfirm && (<>
                          <button type="button" onClick={() => { confirmPayment(payment.id); toast.success(`Confirmed ${fmt(payment.amount)}`); }} className="w-7 h-7 rounded-lg bg-success/15 text-success hover:bg-success/25 flex items-center justify-center" title="Confirm"><CheckCircle className="w-3.5 h-3.5"/></button>
                          <button type="button" onClick={() => { rejectPayment(payment.id); toast.error(`Rejected payment`); }} className="w-7 h-7 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 flex items-center justify-center" title="Reject"><XCircle className="w-3.5 h-3.5"/></button>
                        </>)}
                        {payment.status === 'overdue' && canRecord && (
                          <button type="button" onClick={() => openDialog({ memberId: payment.memberId || payment.userId || '', groupId: payment.groupId, amount: String(payment.amount), round: String(payment.round || ''), dueDate: payment.dueDate || '' })} className="w-7 h-7 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 flex items-center justify-center" title="Record"><Upload className="w-3.5 h-3.5"/></button>
                        )}
                        {payment.status === 'rejected' && canConfirm && (
                          <button type="button" onClick={() => { reopenPayment(payment.id); toast.success('Payment reopened'); }} className="w-7 h-7 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 flex items-center justify-center" title="Reopen"><RotateCcw className="w-3.5 h-3.5"/></button>
                        )}
                        {canRecord && payment.status !== 'paid' && (
                          <button type="button" onClick={() => openEditDialog(payment)} className="w-7 h-7 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Edit">
                            <span className="app-badge leading-none">✎</span>
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Mobile row */}
                    <div className="sm:hidden px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary app-value flex-shrink-0 mt-0.5">{initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="app-row-title text-foreground truncate">{payment.memberName}</p>
                            <p className="app-row-title text-foreground flex-shrink-0">{fmt(payment.amount)}</p>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="app-row-meta text-muted-foreground truncate">{payment.groupName} · {displayDate}</p>
                            <span className={`app-badge px-1.5 py-0.5 rounded-full flex-shrink-0 ${SC[payment.status] || 'bg-muted text-muted-foreground'}`}>{SL[payment.status] || payment.status}</span>
                          </div>
                        </div>
                      </div>
                      {((payment.status === 'pending' && canConfirm) || (payment.status === 'overdue' && canRecord) || (payment.status === 'rejected' && canConfirm)) && (
                        <div className="flex gap-2 mt-2.5 pl-10">
                          {payment.status === 'pending' && canConfirm && (<>
                            <button type="button" onClick={() => { confirmPayment(payment.id); toast.success(`Confirmed ${fmt(payment.amount)}`); }} className="flex-1 py-1.5 rounded-lg bg-success/15 text-success app-action flex items-center justify-center gap-1.5"><CheckCircle className="w-3 h-3"/>Confirm</button>
                            <button type="button" onClick={() => { rejectPayment(payment.id); toast.error(`Rejected payment`); }} className="flex-1 py-1.5 rounded-lg bg-destructive/15 text-destructive app-action flex items-center justify-center gap-1.5"><XCircle className="w-3 h-3"/>Reject</button>
                          </>)}
                          {payment.status === 'overdue' && canRecord && (
                            <button type="button" onClick={() => openDialog({ memberId: payment.memberId || payment.userId || '', groupId: payment.groupId, amount: String(payment.amount), round: String(payment.round || ''), dueDate: payment.dueDate || '' })} className="flex-1 py-1.5 rounded-lg bg-primary/15 text-primary app-action flex items-center justify-center gap-1.5"><Upload className="w-3 h-3"/>Record</button>
                          )}
                          {payment.status === 'rejected' && canConfirm && (
                            <button type="button" onClick={() => { reopenPayment(payment.id); toast.success('Payment reopened'); }} className="flex-1 py-1.5 rounded-lg bg-warning/15 text-warning app-action flex items-center justify-center gap-1.5"><RotateCcw className="w-3 h-3"/>Reopen</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-border bg-muted/10 flex items-center justify-between">
              <p className="app-caption text-muted-foreground">{filteredPayments.length} of {paymentsWithDetails.length} payments</p>
              {(searchTerm || filterStatus !== 'all') && <button type="button" onClick={() => { setSearchTerm(''); setFilterStatus('all'); }} className="app-caption text-primary hover:underline">Clear filters</button>}
            </div>
          </div>
        )}
      </div>

      {dialogOpen && (<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl border border-border w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{editingId ? 'Edit Payment' : 'Record Payment'}</h3>
              <button type="button" onClick={closeDialog} className="p-2 rounded-xl hover:bg-muted/50">
                <X className="w-5 h-5 text-muted-foreground"/>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Member</label>
                <select value={draft.memberId} onChange={(e) => handleMemberSelect(e.target.value)} disabled={!!editingId} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="">Select a member</option>
                  {memberOptions.map(m => (<option key={m.id} value={m.id}>{m.fullName || m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Group</label>
                <select value={draft.groupId} onChange={(e) => setDraft(prev => ({ ...prev, groupId: e.target.value }))} disabled={!!editingId} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="">Select a group</option>
                  {groups.map(g => (<option key={g.id} value={g.id}>{g.groupName || g.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Amount</label>
                  <input type="number" min={0} value={draft.amount} onChange={(e) => setDraft(prev => ({ ...prev, amount: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground"/>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Round</label>
                  <input type="number" min={0} value={draft.round} onChange={(e) => setDraft(prev => ({ ...prev, round: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Method</label>
                  <select value={draft.method} onChange={(e) => setDraft(prev => ({ ...prev, method: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground">
                    <option>MTN MoMo</option>
                    <option>Telecel Cash</option>
                    <option>AT Money</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Due Date</label>
                  <input type="date" value={draft.dueDate} onChange={(e) => setDraft(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Reference (optional)</label>
                <input type="text" placeholder="MM-240715" value={draft.ref} onChange={(e) => setDraft(prev => ({ ...prev, ref: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground"/>
              </div>

              {dialogError && <p className="text-destructive text-sm">{dialogError}</p>}
            </div>

            <div className="flex gap-2 mt-6">
              <button type="button" onClick={closeDialog} className="flex-1 bg-card border border-border py-3 rounded-xl text-foreground">
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl">
                {editingId ? 'Save changes' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}

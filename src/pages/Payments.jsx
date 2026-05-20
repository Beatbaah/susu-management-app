import { Search, Plus, CheckCircle, Clock, XCircle, Upload, X, RotateCcw, AlertTriangle, Users, Flag, Wallet, Download } from 'lucide-react';
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { TablePagination } from '../components/ui/TablePagination';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/LoadingState';
import { fmt, getCurrencySymbol } from '../utils/helpers';
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
    const { authUser, payments, users, groups, confirmPayment, rejectPayment, reopenPayment, recordPayment, updatePayment, disputePayment, resolveDispute, appReady } = useAppContext();
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('date-desc');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [draft, setDraft] = useState(EMPTY_DRAFT);
    const [dialogError, setDialogError] = useState(null);
    const [swipedId, setSwipedId] = useState(null);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;
    const touchStartX = useRef(0);
    const handleTouchStart = useCallback((e) => { touchStartX.current = e.touches[0].clientX; }, []);
    const handleTouchEnd = useCallback((e, paymentId) => {
        const dx = touchStartX.current - e.changedTouches[0].clientX;
        if (dx > 60) setSwipedId(paymentId);
        else if (dx < -20) setSwipedId(null);
    }, []);
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
    const sortedPayments = useMemo(() => {
        return [...filteredPayments].sort((a, b) => {
            const da = new Date(a.paymentDate || a.date || 0).getTime();
            const db = new Date(b.paymentDate || b.date || 0).getTime();
            if (sortBy === 'date-desc') return db - da;
            if (sortBy === 'date-asc') return da - db;
            if (sortBy === 'amount-desc') return Number(b.amount || 0) - Number(a.amount || 0);
            if (sortBy === 'amount-asc') return Number(a.amount || 0) - Number(b.amount || 0);
            return db - da;
        });
    }, [filteredPayments, sortBy]);
    const totalConfirmed = visiblePayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPending = visiblePayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalOverdue = visiblePayments.filter(p => p.status === 'overdue').length;
    // null = create / record new payment; otherwise editing an existing record.
    const [editingId, setEditingId] = useState(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkGroupId, setBulkGroupId] = useState('');
    const [bulkRound, setBulkRound] = useState('');
    const [bulkMethod, setBulkMethod] = useState('MTN MoMo');
    const [bulkDueDate, setBulkDueDate] = useState('');
    const [bulkAmounts, setBulkAmounts] = useState({});
    const [bulkError, setBulkError] = useState(null);
    const [disputeOpen, setDisputeOpen] = useState(false);
    const [disputingId, setDisputingId] = useState(null);
    const [disputeNote, setDisputeNote] = useState('');
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
    const openBulk = () => {
        const firstGroup = groups[0];
        const g = firstGroup;
        const members = g ? users.filter(u => u.role === 'member' && u.status === 'approved' && u.groupId === g.id) : [];
        const initAmounts = {};
        members.forEach(m => { initAmounts[m.id] = String(g?.contributionAmount || g?.contribution || ''); });
        setBulkGroupId(g?.id || '');
        setBulkRound(String(g?.currentRound || ''));
        setBulkMethod('MTN MoMo');
        setBulkDueDate('');
        setBulkAmounts(initAmounts);
        setBulkError(null);
        setBulkOpen(true);
    };
    const onBulkGroupChange = (gId) => {
        const g = groups.find(gr => gr.id === gId);
        const members = gId ? users.filter(u => u.role === 'member' && u.status === 'approved' && u.groupId === gId) : [];
        const initAmounts = {};
        members.forEach(m => { initAmounts[m.id] = String(g?.contributionAmount || g?.contribution || ''); });
        setBulkGroupId(gId);
        setBulkRound(String(g?.currentRound || ''));
        setBulkAmounts(initAmounts);
    };
    const submitBulk = () => {
        setBulkError(null);
        if (!bulkGroupId) { setBulkError('Select a group.'); return; }
        const entries = Object.entries(bulkAmounts).filter(([, v]) => Number(v) > 0);
        if (entries.length === 0) { setBulkError('Enter at least one payment amount.'); return; }
        entries.forEach(([memberId, amount]) => {
            recordPayment({ memberId, userId: memberId, groupId: bulkGroupId, amount: Number(amount), method: bulkMethod, round: bulkRound ? Number(bulkRound) : undefined, dueDate: bulkDueDate || undefined });
        });
        toast.success(`Recorded ${entries.length} payment${entries.length > 1 ? 's' : ''} for this round`);
        setBulkOpen(false);
    };
    const bulkGroupMembers = bulkGroupId ? users.filter(u => u.role === 'member' && u.status === 'approved' && u.groupId === bulkGroupId) : [];
    // Reset to page 1 whenever filters or sort changes
    useEffect(() => { setPage(1); }, [searchTerm, filterStatus, sortBy]);
    const pagedPayments = sortedPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const handleExportCSV = () => {
        const rows = [
            ['Date', 'Member', 'Group', 'Amount (GHS)', 'Method', 'Round', 'Status', 'Ref'],
            ...sortedPayments.map(p => [
                p.paymentDate || p.date || '',
                p.memberName,
                p.groupName,
                p.amount,
                p.method || '',
                p.round || '',
                p.status,
                p.ref || '',
            ]),
        ];
        const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground">Payment Tracking</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Payments</h1>
            <p className="text-muted-foreground text-sm">Record and confirm member contributions.</p>
          </div>
          {canRecord && (
            <div className="flex items-center gap-2 mt-1">
              <button type="button" onClick={openBulk} className="h-10 px-3 bg-card border border-border rounded-xl text-sm font-bold text-foreground flex items-center gap-1.5 hover:bg-muted/30 transition-colors" title="Record payments for a whole round">
                <Users className="w-4 h-4"/>
                <span className="hidden sm:inline">Record Round</span>
              </button>
              <button type="button" onClick={() => openDialog()} className="p-2.5 sm:p-3 bg-primary rounded-2xl" aria-label="Record new payment">
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground"/>
              </button>
            </div>
          )}
        </div>

        <div className="relative mb-4 sm:mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input type="text" placeholder="Search payments..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-card rounded-2xl border-2 border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground text-sm"/>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border overflow-hidden">
            <CheckCircle className="w-5 h-5 sm:w-8 sm:h-8 text-success mb-1 sm:mb-2"/>
            <p className="app-caption text-muted-foreground mb-1">Confirmed</p>
            <p className="app-value truncate select-none text-foreground">{fmt(totalConfirmed)}</p>
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border overflow-hidden">
            <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-primary mb-1 sm:mb-2"/>
            <p className="app-caption text-muted-foreground mb-1">Pending</p>
            <p className="app-value truncate select-none text-foreground">{fmt(totalPending)}</p>
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
        <div className="flex items-center justify-end gap-2 mb-4">
          <span className="eyebrow text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="h-8 px-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Amount (high→low)</option>
            <option value="amount-asc">Amount (low→high)</option>
          </select>
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
              <span className="eyebrow text-muted-foreground text-right">Amount</span>
              <span className="eyebrow text-muted-foreground">Status</span>
              <span className="eyebrow text-muted-foreground">Date</span>
              <span className="eyebrow text-muted-foreground">Method</span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y divide-border">
              {pagedPayments.map((payment) => {
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="app-caption text-muted-foreground truncate">{payment.method || '—'}</p>
                        {payment.disputeRaised && <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" title="Disputed"/>}
                      </div>
                      <div className="flex items-center gap-1">
                        {payment.disputeRaised && canConfirm && (
                          <button type="button" onClick={() => { resolveDispute(payment.id); toast.success('Dispute resolved'); }} className="w-7 h-7 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 flex items-center justify-center" aria-label="Resolve dispute"><Flag className="w-3.5 h-3.5"/></button>
                        )}
                        {payment.status === 'pending' && canConfirm && (<>
                          <button type="button" onClick={() => { if (!window.confirm(`Confirm this ${fmt(payment.amount)} payment from ${payment.memberName}?`)) return; confirmPayment(payment.id); toast.success(`Confirmed ${fmt(payment.amount)}`); }} className="w-7 h-7 rounded-lg bg-success/15 text-success hover:bg-success/25 flex items-center justify-center" title="Confirm"><CheckCircle className="w-3.5 h-3.5"/></button>
                          <button type="button" onClick={() => { if (!window.confirm(`Reject this payment? The member will need to resubmit.`)) return; rejectPayment(payment.id); toast.error(`Rejected payment`); }} className="w-7 h-7 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 flex items-center justify-center" title="Reject"><XCircle className="w-3.5 h-3.5"/></button>
                        </>)}
                        {['pending','overdue'].includes(payment.status) && authUser?.role === 'member' && (payment.memberId || payment.userId) === authUser.id && !payment.disputeRaised && (
                          <button type="button" onClick={() => { setDisputingId(payment.id); setDisputeNote(''); setDisputeOpen(true); }} className="w-7 h-7 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 flex items-center justify-center" title="Dispute"><AlertTriangle className="w-3.5 h-3.5"/></button>
                        )}
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
                    {/* Mobile row — swipe left to reveal actions */}
                    <div className="sm:hidden overflow-hidden relative"
                      onTouchStart={handleTouchStart}
                      onTouchEnd={e => handleTouchEnd(e, payment.id)}>
                      {/* Swipe action tray */}
                      {payment.status === 'pending' && canConfirm && (
                        <div className={cn('absolute inset-y-0 right-0 flex items-center gap-1 px-2 transition-transform duration-200',
                          swipedId === payment.id ? 'translate-x-0' : 'translate-x-full')}>
                          <button type="button" onClick={() => { setSwipedId(null); if (!window.confirm(`Confirm this ${fmt(payment.amount)} payment?`)) return; confirmPayment(payment.id); toast.success(`Confirmed ${fmt(payment.amount)}`); }} className="h-full px-3 bg-success text-success-foreground rounded-l-lg app-action flex flex-col items-center justify-center gap-0.5"><CheckCircle className="w-4 h-4"/>Confirm</button>
                          <button type="button" onClick={() => { setSwipedId(null); if (!window.confirm(`Reject this payment?`)) return; rejectPayment(payment.id); toast.error('Rejected payment'); }} className="h-full px-3 bg-destructive text-destructive-foreground app-action flex flex-col items-center justify-center gap-0.5"><XCircle className="w-4 h-4"/>Reject</button>
                        </div>
                      )}
                      <div className={cn('px-4 py-3 transition-transform duration-200 bg-card',
                        swipedId === payment.id && payment.status === 'pending' && canConfirm ? '-translate-x-[120px]' : 'translate-x-0')}
                        onClick={() => swipedId === payment.id ? setSwipedId(null) : undefined}>
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
                        {((payment.status === 'pending' && canConfirm && swipedId !== payment.id) || (payment.status === 'overdue' && canRecord) || (payment.status === 'rejected' && canConfirm)) && (
                          <div className="flex gap-2 mt-2.5 pl-10">
                            {payment.status === 'pending' && canConfirm && swipedId !== payment.id && (<>
                              <button type="button" onClick={() => { if (!window.confirm(`Confirm this ${fmt(payment.amount)} payment from ${payment.memberName}?`)) return; confirmPayment(payment.id); toast.success(`Confirmed ${fmt(payment.amount)}`); }} className="flex-1 py-1.5 rounded-lg bg-success/15 text-success app-action flex items-center justify-center gap-1.5"><CheckCircle className="w-3 h-3"/>Confirm</button>
                              <button type="button" onClick={() => { if (!window.confirm(`Reject this payment? The member will need to resubmit.`)) return; rejectPayment(payment.id); toast.error(`Rejected payment`); }} className="flex-1 py-1.5 rounded-lg bg-destructive/15 text-destructive app-action flex items-center justify-center gap-1.5"><XCircle className="w-3 h-3"/>Reject</button>
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
                  </div>
                );
              })}
            </div>
            <TablePagination total={sortedPayments.length} page={page} perPage={PAGE_SIZE} onChange={setPage}/>
            <div className="px-4 py-2 border-t border-border bg-muted/10 flex items-center justify-between">
              <p className="app-caption text-muted-foreground">{filteredPayments.length} of {paymentsWithDetails.length} payments</p>
              <div className="flex items-center gap-3">
                {(searchTerm || filterStatus !== 'all') && <button type="button" onClick={() => { setSearchTerm(''); setFilterStatus('all'); }} className="app-caption text-primary hover:underline">Clear filters</button>}
                {sortedPayments.length > 0 && (
                  <button type="button" onClick={handleExportCSV} title="Export CSV" className="flex items-center gap-1 app-caption text-muted-foreground hover:text-foreground transition-colors">
                    <Download className="w-3.5 h-3.5"/>Export
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Record / Edit Payment */}
      {dialogOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeDialog}>
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 sm:pt-5 pb-4 border-b border-border/50 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-foreground">{editingId ? 'Edit Payment' : 'Record Payment'}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Fill in the payment details below</p>
              </div>
              <button type="button" onClick={closeDialog} className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground"/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Member</label>
                <select value={draft.memberId} onChange={(e) => handleMemberSelect(e.target.value)} disabled={!!editingId} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground disabled:opacity-60 disabled:cursor-not-allowed outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors">
                  <option value="">Select a member</option>
                  {memberOptions.map(m => (<option key={m.id} value={m.id}>{m.fullName || m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Group</label>
                <select value={draft.groupId} onChange={(e) => setDraft(prev => ({ ...prev, groupId: e.target.value }))} disabled={!!editingId} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground disabled:opacity-60 disabled:cursor-not-allowed outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors">
                  <option value="">Select a group</option>
                  {groups.map(g => (<option key={g.id} value={g.id}>{g.groupName || g.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Amount ({getCurrencySymbol()})</label>
                  <input type="number" min={0} value={draft.amount} onChange={(e) => setDraft(prev => ({ ...prev, amount: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Round #</label>
                  <input type="number" min={0} value={draft.round} onChange={(e) => setDraft(prev => ({ ...prev, round: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Method</label>
                  <select value={draft.method} onChange={(e) => setDraft(prev => ({ ...prev, method: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors">
                    <option>MTN MoMo</option>
                    <option>Telecel Cash</option>
                    <option>AT Money</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Due Date</label>
                  <input type="date" value={draft.dueDate} onChange={(e) => setDraft(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Reference (optional)</label>
                <input type="text" placeholder="e.g. MM-240715" value={draft.ref} onChange={(e) => setDraft(prev => ({ ...prev, ref: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"/>
              </div>

              {dialogError && <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold"><AlertTriangle className="w-4 h-4 flex-shrink-0"/>{dialogError}</div>}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-border/50 bg-card flex-shrink-0">
              <button type="button" onClick={closeDialog} className="flex-1 bg-muted border border-border py-3.5 rounded-xl text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors">Cancel</button>
              <button type="button" onClick={handleSave} className="flex-[1.4] bg-primary text-primary-foreground py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
                {editingId ? 'Save Changes' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>)}

      {/* Bulk payment */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setBulkOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 sm:pt-5 pb-4 border-b border-border/50 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-foreground">Record Round</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Record payments for all members at once</p>
              </div>
              <button type="button" onClick={() => setBulkOpen(false)} className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground"/>
              </button>
            </div>
            <div className="px-5 pt-4 pb-3 grid grid-cols-2 gap-3 flex-shrink-0">
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Group</label>
                <select value={bulkGroupId} onChange={(e) => onBulkGroupChange(e.target.value)} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
                  <option value="">Select group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.groupName || g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Round #</label>
                <input type="number" min={1} value={bulkRound} onChange={(e) => setBulkRound(e.target.value)} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" placeholder="e.g. 3"/>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Method</label>
                <select value={bulkMethod} onChange={(e) => setBulkMethod(e.target.value)} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
                  <option>MTN MoMo</option><option>Telecel Cash</option><option>AT Money</option><option>Bank Transfer</option><option>Cash</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Due Date</label>
                <input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"/>
              </div>
            </div>
            {bulkGroupMembers.length > 0 ? (
              <div className="flex-1 overflow-y-auto mx-5 border border-border rounded-xl divide-y divide-border mb-3">
                {bulkGroupMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                      {(m.fullName || m.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <p className="flex-1 text-sm text-foreground truncate">{m.fullName || m.name}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{getCurrencySymbol()}</span>
                      <input
                        type="number" min={0}
                        value={bulkAmounts[m.id] || ''}
                        onChange={(e) => setBulkAmounts(prev => ({ ...prev, [m.id]: e.target.value }))}
                        className="w-24 bg-card border-2 border-border rounded-lg px-2 py-1.5 text-foreground text-sm text-right outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center py-8 text-muted-foreground text-sm">
                {bulkGroupId ? 'No active members in this group' : 'Select a group to see members'}
              </div>
            )}
            {bulkError && <p className="text-destructive text-xs px-5 mb-2">{bulkError}</p>}
            <div className="flex gap-3 px-5 py-4 border-t border-border/50 bg-card flex-shrink-0">
              <button type="button" onClick={() => setBulkOpen(false)} className="flex-1 bg-muted border border-border py-3.5 rounded-xl text-sm font-semibold text-foreground/70">Cancel</button>
              <button type="button" onClick={submitBulk} className="flex-[1.5] bg-primary text-primary-foreground py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
                Record {bulkGroupMembers.filter(m => Number(bulkAmounts[m.id]) > 0).length} Payment{bulkGroupMembers.filter(m => Number(bulkAmounts[m.id]) > 0).length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute */}
      {disputeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDisputeOpen(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 pt-4 sm:pt-5 pb-4 border-b border-border/50 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-warning"/>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Dispute Payment</h3>
                <p className="text-xs text-muted-foreground">Describe the issue briefly</p>
              </div>
            </div>
            <div className="px-5 py-4 flex-shrink-0">
              <textarea
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                placeholder="e.g. I made this payment but it shows overdue..."
                className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground text-sm resize-none h-24 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
              />
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-border/50 bg-card flex-shrink-0">
              <button type="button" onClick={() => setDisputeOpen(false)} className="flex-1 bg-muted border border-border py-3.5 rounded-xl text-sm font-semibold text-foreground/70">Cancel</button>
              <button type="button" onClick={() => {
                const result = disputePayment(disputingId, disputeNote);
                if (result?.ok) { toast.success('Dispute submitted — admin will review'); setDisputeOpen(false); }
                else toast.error('Could not submit dispute.');
              }} className="flex-1 bg-warning text-warning-foreground py-3.5 rounded-xl text-sm font-bold active:scale-[0.98] transition-all">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>);
}

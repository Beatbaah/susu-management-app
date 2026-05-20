import { Search, Download, Share2, CheckCircle, Printer, FileText, TrendingUp } from 'lucide-react';
import { toast } from '../utils/toast';
import { useMemo, useState, useEffect } from 'react';
import { TablePagination } from '../components/ui/TablePagination';
import { useAppContext } from '../context/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/LoadingState';
import { ReceiptCard } from '../components/domain';
import { fmt } from '../utils/helpers';
import { renderReceiptDocument } from '../services/receiptService';
export function Receipts() {
    const { authUser, payments, users, groups, appReady } = useAppContext();
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState(null);
    const [groupFilter, setGroupFilter] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;
    const visiblePayments = useMemo(() => {
        if (authUser?.role === 'member') {
            return payments.filter(p => (p.memberId || p.userId) === authUser.id);
        }
        return payments;
    }, [payments, authUser]);
    // Project receipts from confirmed payments. In Phase 3 this becomes a query
    // to the receipts/ collection (receiptService.listReceipts).
    const receipts = useMemo(() => {
        const paid = visiblePayments.filter(p => p.status === 'paid');
        return paid.map(payment => {
            const member = users.find(m => m.id === (payment.memberId || payment.userId));
            const group = groups.find(g => g.id === payment.groupId);
            const confirmedByUser = payment.confirmedBy ? users.find(u => u.id === payment.confirmedBy) : null;
            const receiptNo = payment.ref || `RCT-${(payment.id || '').slice(0, 6).toUpperCase()}`;
            return {
                id: payment.id,
                receiptNo,
                member: member?.fullName || member?.name || 'Unknown',
                group: group?.groupName || group?.name || 'Unknown',
                amount: Number(payment.amount || 0),
                paymentDate: payment.paymentDate || payment.date || '',
                method: payment.method || 'Cash',
                confirmedBy: confirmedByUser?.fullName || confirmedByUser?.name || (payment.confirmedBy ? 'Staff' : 'Pending review'),
                rawPayment: payment,
                rawMember: member,
                rawGroup: group,
            };
        });
    }, [visiblePayments, users, groups]);
    const uniqueGroups = useMemo(() => [...new Set(receipts.map(r => r.group))].sort(), [receipts]);
    const filtered = useMemo(() => {
        const cutoff = dateFilter ? (() => { const d = new Date(); d.setMonth(d.getMonth() - dateFilter); return d; })() : null;
        return receipts.filter(r => {
            if (groupFilter && r.group !== groupFilter) return false;
            if (cutoff && (!r.paymentDate || new Date(r.paymentDate) < cutoff)) return false;
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return (r.receiptNo.toLowerCase().includes(q) ||
                r.member.toLowerCase().includes(q) ||
                r.group.toLowerCase().includes(q) ||
                r.method.toLowerCase().includes(q));
        });
    }, [receipts, search, dateFilter, groupFilter]);
    useEffect(() => { setPage(1); }, [search, dateFilter, groupFilter]);
    const pagedReceipts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalValue = filtered.reduce((sum, r) => sum + r.amount, 0);
    const handleDownload = (r) => {
        try {
            renderReceiptDocument({ ...r.rawPayment, ref: r.receiptNo }, r.rawMember || { name: r.member }, r.rawGroup || { name: r.group });
        } catch {
            toast.error('Could not generate receipt. Please try again.');
        }
    };
    const handlePrint = (r) => {
        const win = window.open('', '_blank', 'width=520,height=640');
        if (!win) { toast.error('Could not open print window. Allow pop-ups and try again.'); return; }
        const html = `<!DOCTYPE html><html><head><title>Receipt ${r.receiptNo}</title><style>
body{font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#111}
h2{color:#073D7F;margin-bottom:4px}
.label{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-top:16px;margin-bottom:2px}
.value{font-size:15px;font-weight:600}
.amount{font-size:28px;font-weight:800;color:#6491DE;margin:8px 0}
hr{border:none;border-top:1px solid #e5e7eb;margin:20px 0}
.footer{font-size:11px;color:#aaa;text-align:center;margin-top:32px}
@media print{body{margin:20px auto}}
</style></head><body>
<h2>Excellent Susu</h2>
<p style="color:#888;font-size:13px;margin-top:0">Payment Receipt</p>
<hr/>
<div class="label">Receipt No.</div><div class="value">${r.receiptNo}</div>
<div class="label">Member</div><div class="value">${r.member}</div>
<div class="label">Group</div><div class="value">${r.group}</div>
<div class="label">Amount</div><div class="amount">GHS ${Number(r.amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</div>
<hr/>
<div class="label">Payment Date</div><div class="value">${r.paymentDate || '—'}</div>
<div class="label">Method</div><div class="value">${r.method}</div>
<div class="label">Confirmed By</div><div class="value">${r.confirmedBy}</div>
<hr/>
<div class="footer">Generated by Excellent Susu &bull; ${new Date().toLocaleDateString()}</div>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`;
        win.document.write(html);
        win.document.close();
    };
    const handleShare = async (r) => {
        const text = `${r.receiptNo} — ${r.member} paid ${fmt(r.amount)} to ${r.group} on ${r.paymentDate}.`;
        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({ title: `Receipt ${r.receiptNo}`, text });
            } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                toast.success('Receipt details copied to clipboard');
            } else {
                toast.info('Sharing is not supported in this browser.');
            }
        } catch {
            /* user cancelled */
        }
    };
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
            </div>
            <p className="eyebrow text-muted-foreground">Payment Records</p>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Receipts</h1>
          <p className="text-muted-foreground text-sm">Download and share confirmed payment receipts.</p>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input type="text" placeholder="Search receipts..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-card rounded-2xl border-2 border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-foreground text-sm"/>
        </div>

        {/* Date + Group filters */}
        <div className="flex items-center gap-2 mb-4 sm:mb-5 flex-wrap">
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            {[{ label: 'All', val: null }, { label: '1M', val: 1 }, { label: '3M', val: 3 }, { label: '6M', val: 6 }].map(({ label, val }) => (
              <button key={label} type="button" onClick={() => setDateFilter(val)}
                className={`px-2.5 py-1 rounded-lg app-tab text-xs font-bold transition-colors ${dateFilter === val ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          {uniqueGroups.length > 1 && (
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
              className="flex-1 min-w-0 px-3 py-1.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary">
              <option value="">All groups</option>
              {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          {(dateFilter || groupFilter) && (
            <button type="button" onClick={() => { setDateFilter(null); setGroupFilter(''); }}
              className="text-xs text-primary hover:underline flex-shrink-0">Clear</button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 sm:mb-6">
          <div className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-border">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center mb-2">
              <FileText className="w-3.5 h-3.5 text-primary"/>
            </div>
            <p className="eyebrow text-muted-foreground mb-1">Receipts</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{filtered.length}</p>
            {filtered.length !== receipts.length && <p className="eyebrow text-muted-foreground">of {receipts.length} total</p>}
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-border overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-success"/>
            </div>
            <p className="eyebrow text-muted-foreground mb-1">Total Value</p>
            <p className="text-sm sm:text-2xl font-bold tabular-nums truncate text-foreground">{fmt(totalValue)}</p>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-3">
        {!appReady && filtered.length === 0 ? (<SkeletonList count={3}/>) : filtered.length === 0 ? (<EmptyState icon={CheckCircle} title={receipts.length === 0 ? 'No receipts yet' : 'No matches'} description={receipts.length === 0
                ? 'Receipts appear here once payments are confirmed.'
                : 'Try adjusting your search or filters.'}/>) : (pagedReceipts.map((receipt) => (<ReceiptCard key={receipt.id} receiptNumber={receipt.receiptNo} member={receipt.member} group={receipt.group} amount={receipt.amount} paymentDate={receipt.paymentDate} method={receipt.method} confirmedBy={receipt.confirmedBy} footer={<div className="flex gap-2">
                  <button type="button" onClick={() => handleDownload(receipt)} className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl flex items-center justify-center gap-2">
                    <Download className="w-4 h-4"/>
                    Download
                  </button>
                  <button type="button" onClick={() => handlePrint(receipt)} className="flex-1 bg-card border border-border py-2 rounded-xl flex items-center justify-center gap-2 text-foreground">
                    <Printer className="w-4 h-4"/>
                    Print
                  </button>
                  <button type="button" onClick={() => handleShare(receipt)} className="w-10 bg-card border border-border py-2 rounded-xl flex items-center justify-center text-foreground flex-shrink-0">
                    <Share2 className="w-4 h-4"/>
                  </button>
                </div>}/>)))}
      </div>
      <div className="px-6 pb-4 mt-3">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <TablePagination total={filtered.length} page={page} perPage={PAGE_SIZE} onChange={setPage}/>
        </div>
      </div>
    </div>);
}

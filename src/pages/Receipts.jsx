import { Search, Download, Share2, CheckCircle } from 'lucide-react';
import { toast } from '../utils/toast';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/LoadingState';
import { ReceiptCard } from '../components/domain';
import { fmt } from '../utils/helpers';
import { renderReceiptDocument } from '../services/receiptService';
export function Receipts() {
    const { authUser, payments, users, groups, appReady } = useAppContext();
    const [search, setSearch] = useState('');
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
    const filtered = receipts.filter(r => {
        const q = search.trim().toLowerCase();
        if (!q)
            return true;
        return (r.receiptNo.toLowerCase().includes(q) ||
            r.member.toLowerCase().includes(q) ||
            r.group.toLowerCase().includes(q) ||
            r.method.toLowerCase().includes(q));
    });
    const totalValue = receipts.reduce((sum, r) => sum + r.amount, 0);
    const handleDownload = (r) => {
        try {
            renderReceiptDocument({ ...r.rawPayment, ref: r.receiptNo }, r.rawMember || { name: r.member }, r.rawGroup || { name: r.group });
        } catch {
            toast.error('Could not generate receipt. Please try again.');
        }
    };
    const handleShare = async (r) => {
        const text = `${r.receiptNo} — ${r.member} paid ${fmt(r.amount)} to ${r.group} on ${r.paymentDate}.`;
        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({ title: `Receipt ${r.receiptNo}`, text });
            }
            else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            }
        }
        catch {
            /* user cancelled */
        }
    };
    return (<div className="pb-28">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
        <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Payment Receipts</h1>

        <div className="relative mb-4 sm:mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <input type="text" placeholder="Search receipts..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-card rounded-2xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"/>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 sm:mb-6">
          <div className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1 sm:mb-2">Total Receipts</p>
            <p className="text-xl sm:text-2xl font-bold">{receipts.length}</p>
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-border overflow-hidden">
            <p className="text-muted-foreground text-xs mb-1 sm:mb-2">Total Value</p>
            <p className="text-sm sm:text-2xl font-bold tabular-nums truncate">{fmt(totalValue)}</p>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-3">
        {!appReady && filtered.length === 0 ? (<SkeletonList count={3}/>) : filtered.length === 0 ? (<EmptyState icon={CheckCircle} title={receipts.length === 0 ? 'No receipts yet' : 'No matches'} description={receipts.length === 0
                ? 'Receipts appear here once payments are confirmed.'
                : 'Try a different search term.'}/>) : (filtered.map((receipt) => (<ReceiptCard key={receipt.id} receiptNumber={receipt.receiptNo} member={receipt.member} group={receipt.group} amount={receipt.amount} paymentDate={receipt.paymentDate} method={receipt.method} confirmedBy={receipt.confirmedBy} footer={<div className="flex gap-2">
                  <button type="button" onClick={() => handleDownload(receipt)} className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl flex items-center justify-center gap-2">
                    <Download className="w-4 h-4"/>
                    Download
                  </button>
                  <button type="button" onClick={() => handleShare(receipt)} className="flex-1 bg-card border border-border py-2 rounded-xl flex items-center justify-center gap-2 text-foreground">
                    <Share2 className="w-4 h-4"/>
                    Share
                  </button>
                </div>}/>)))}
      </div>
    </div>);
}

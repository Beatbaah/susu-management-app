import { listPayments } from './paymentService';
import { fmt, genRef, todayStr } from '../utils/helpers';

const escapeHtml = (str) => {
    if (typeof str !== 'string') return str ?? '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

function generateReceipt(payment, user, group) {
    const ref = escapeHtml(payment.ref || genRef());
    const w = window.open("", "_blank");
    if (!w) return;
    const safeName = escapeHtml(user?.name);
    const safeGroupName = escapeHtml(group?.name);
    const safeMethod = escapeHtml(payment.method || "—");
    const safeDate = escapeHtml(payment.date || todayStr());
    const safeAmount = fmt(payment.amount);
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${ref}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',sans-serif;background:#F1F1F1;color:#0F1B2D;max-width:440px;margin:40px auto;padding:32px;border-radius:16px;}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;}
.logo{font-size:18px;font-weight:800;letter-spacing:-0.3px;color:#073D7F;}
.logo em{color:#6491DE;font-style:normal;}
.ref{font-size:10px;color:#4C6A8F;letter-spacing:.1em;font-family:'DM Mono',monospace;text-transform:uppercase;}
.amount-box{background:#fff;border:1px solid rgba(7,61,127,0.10);border-radius:16px;padding:24px;text-align:center;margin-bottom:20px;}
.amount{font-size:40px;font-weight:800;color:#059669;letter-spacing:-1.5px;}
.badge{background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;border-radius:20px;padding:4px 14px;font-size:11px;font-weight:700;display:inline-block;margin-top:8px;text-transform:uppercase;letter-spacing:.05em;}
.rows{background:#fff;border:1px solid rgba(7,61,127,0.10);border-radius:16px;overflow:hidden;margin-bottom:20px;}
.row{display:flex;justify-content:space-between;align-items:center;padding:13px 18px;border-bottom:1px solid rgba(7,61,127,0.07);font-size:13px;}
.row:last-of-type{border-bottom:none;}
.lbl{color:#4C6A8F;font-weight:500;}
.val{font-weight:600;color:#0F1B2D;}
.val.mono{font-family:'DM Mono',monospace;font-size:11px;color:#6491DE;}
footer{text-align:center;margin-top:20px;font-size:11px;color:#9CA3AF;line-height:1.9;}
@media print{button{display:none!important}body{background:#fff;margin:0;padding:24px;}}
</style></head><body>
<div class="header">
  <div class="logo"><em>Excellent</em> Susu</div>
  <div class="ref">Receipt · ${ref}</div>
</div>
<div class="amount-box">
  <div class="amount">${safeAmount}</div>
  <span class="badge">✓ Payment Confirmed</span>
</div>
<div class="rows">
<div class="row"><span class="lbl">Member</span><span class="val">${safeName}</span></div>
<div class="row"><span class="lbl">Group</span><span class="val">${safeGroupName}</span></div>
<div class="row"><span class="lbl">Round</span><span class="val">#${Number(payment.round) || 0}</span></div>
<div class="row"><span class="lbl">Method</span><span class="val">${safeMethod}</span></div>
<div class="row"><span class="lbl">Date</span><span class="val">${safeDate}</span></div>
<div class="row"><span class="lbl">Reference</span><span class="val mono">${ref}</span></div>
</div>
<footer>Excellent Susu · Community Savings Platform · Ghana<br>This is an official payment receipt.</footer>
<br><button onclick="window.print()" style="width:100%;padding:14px;background:#059669;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:12px;font-family:'Inter',sans-serif;letter-spacing:.02em;">Print Receipt</button>
</body></html>`);
    w.document.close();
}

export function listReceipts() {
    return listPayments()
        .filter(p => p.status === 'paid')
        .map(p => ({
        id: p.id,
        receiptNumber: p.ref || `RCT-${String(p.id || '').slice(0, 6).toUpperCase()}`,
        paymentId: p.id,
        memberId: p.memberId ?? p.userId,
        groupId: p.groupId,
        amount: Number(p.amount || 0),
        paymentMethod: p.method || 'Cash',
        paymentDate: p.paymentDate || p.date || '',
        status: 'confirmed',
        recordedBy: p.recordedBy,
        confirmedBy: p.confirmedBy,
        raw: p,
    }));
}
export function renderReceiptDocument(payment, member, group) {
    generateReceipt(payment, member, group);
}

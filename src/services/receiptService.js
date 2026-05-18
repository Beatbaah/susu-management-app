import { listPayments } from './paymentService';
import { generateReceipt as renderReceipt } from '../utils/helpers';
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
    renderReceipt(payment, member, group);
}

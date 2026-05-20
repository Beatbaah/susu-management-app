export function normalizeMoney(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
}
export function getPaymentPeriodKey(payment) {
    return [
        payment.memberId || payment.userId,
        payment.groupId,
        payment.round || payment.dueDate || payment.paymentDate || payment.date,
    ].join("::");
}
export function validatePaymentRecord({ payment, group, payments = [], actorRole }) {
    const amount = normalizeMoney(payment.amount);
    const contribution = normalizeMoney(group?.contributionAmount || group?.contribution);
    const periodKey = getPaymentPeriodKey(payment);
    const duplicatePaid = payments.some(existing => existing.id !== payment.id &&
        existing.status === "paid" &&
        getPaymentPeriodKey(existing) === periodKey);
    if (!payment.memberId && !payment.userId)
        return { ok: false, message: "Select a member before recording payment." };
    if (!payment.groupId)
        return { ok: false, message: "Select a susu group before recording payment." };
    if (amount <= 0)
        return { ok: false, message: "Payment amount must be greater than zero." };
    if (amount > 50000)
        return { ok: false, message: "Payment amount exceeds the maximum single-transaction limit of GH₵50,000." };
    if (duplicatePaid)
        return { ok: false, message: "A paid record already exists for this member and period." };
    if (contribution > 0 && amount !== contribution && actorRole !== "admin" && actorRole !== "manager") {
        return { ok: false, message: "Payment amount must match the group contribution." };
    }
    return { ok: true, message: "" };
}
export function validatePayoutCompletion({ payout, group, payments = [], override = false }) {
    if (!payout?.groupId || !payout?.memberId)
        return { ok: false, message: "Payout must have a group and recipient." };
    if (override)
        return { ok: true, message: "" };
    // Scope the check to the current round so prior-round payments don't mask
    // unpaid contributions in the active round.
    const payoutRound = payout.round ?? group?.currentRound;
    const roundPayments = payoutRound != null
        ? payments.filter(p => p.groupId === payout.groupId && String(p.round) === String(payoutRound))
        : payments.filter(p => p.groupId === payout.groupId);
    const verified = roundPayments.filter(p => p.status === "paid").length;
    const expected = group?.members?.length || group?.totalSlots || 0;
    if (expected > 0 && verified < expected) {
        return { ok: false, message: `${verified} of ${expected} payments verified for this round. Complete all collections before disbursing.` };
    }
    return { ok: true, message: "" };
}
export function getDefaulterRisk(payment, today = new Date()) {
    if (payment.status === "paid")
        return { level: "None", daysOverdue: 0 };
    const due = payment.dueDate || payment.date;
    if (!due)
        return { level: payment.status === "overdue" ? "High" : "None", daysOverdue: 0 };
    const dueDate = new Date(due);
    const delta = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
    if (delta <= 0)
        return { level: "None", daysOverdue: 0 };
    if (delta <= 3)
        return { level: "Low", daysOverdue: delta };
    if (delta <= 7)
        return { level: "Medium", daysOverdue: delta };
    return { level: "High", daysOverdue: delta };
}
export function calculateFinancialMetrics({ payments = [], groups = [], payouts = [], users = [] }) {
    const activeMemberIds = users.length > 0
        ? new Set(users.filter(u => u.status === "approved").map(u => String(u.id)))
        : null;
    const totalPaid = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + normalizeMoney(p.amount), 0);
    const totalOverdue = payments.filter(p => p.status === "overdue").reduce((sum, p) => sum + normalizeMoney(p.amount), 0);

    // Expected to date: use currentRound (rounds completed so far) not totalRounds,
    // so a group in round 3 of 12 shows 3/12ths of its lifecycle as expected — not all 12.
    const expectedToDate = groups.reduce((sum, g) => {
        const contribution = normalizeMoney(g.contributionAmount || g.contribution);
        const memberCount = Array.isArray(g.members)
            ? g.members.length
            : normalizeMoney(g.memberCount || g.totalSlots);
        const roundsCompleted = normalizeMoney(g.currentRound || 0);
        return sum + contribution * memberCount * roundsCompleted;
    }, 0);

    // Lifecycle total — kept for reference / outstanding calculation
    const expectedLifecycle = groups.reduce((sum, g) => {
        const contribution = normalizeMoney(g.contributionAmount || g.contribution);
        const memberCount = Array.isArray(g.members)
            ? g.members.length
            : normalizeMoney(g.memberCount || g.totalSlots);
        const rounds = normalizeMoney(g.totalRounds || g.totalSlots || memberCount);
        return sum + contribution * memberCount * rounds;
    }, 0);

    const totalPaidOut = payouts.filter(p => p.status === "completed" || p.paid).reduce((sum, p) => sum + normalizeMoney(p.payoutAmount || p.amount), 0);

    // Only count actionable payment records (exclude draft/cancelled states)
    const actionablePayments = payments.filter(p => ["paid", "pending", "overdue"].includes(p.status));
    const overduePayments = actionablePayments.filter(p => {
        if (p.status !== "overdue") return false;
        if (!activeMemberIds) return true;
        return activeMemberIds.has(String(p.userId || p.memberId));
    }).length;

    return {
        totalPaid,
        totalExpected: expectedToDate,
        totalExpectedLifecycle: expectedLifecycle,
        totalOutstanding: Math.max(0, expectedToDate - totalPaid),
        totalOverdue,
        netPosition: totalPaid - totalPaidOut,
        collectionRate: expectedToDate > 0 ? (totalPaid / expectedToDate) * 100 : 0,
        defaultRate: actionablePayments.length > 0 ? (overduePayments / actionablePayments.length) * 100 : 0,
    };
}

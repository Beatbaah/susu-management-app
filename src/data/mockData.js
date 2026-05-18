export const MOCK_USERS = [
    { id: "1", name: "Kwame Asante", fullName: "Kwame Asante", email: "kwame@gmail.com", phone: "0244123456", role: "member", status: "approved", groupId: "1", joinedAt: "2025-01-05", ghanaCard: "GHA-000123456-7", address: "House No. 5, Adenta, Accra", bankMomo: "0244123456 (MTN MoMo)", ghanaCardFront: "f1.jpg", ghanaCardBack: "b1.jpg", passportPic: "p1.jpg", color: "#6491DE", streak: 4, points: 420, badges: ["on-time", "loyal"] },
    { id: "2", name: "Ama Boateng", fullName: "Ama Boateng", email: "ama@gmail.com", phone: "0554321098", role: "member", status: "approved", groupId: "1", joinedAt: "2025-01-06", ghanaCard: "GHA-000234567-8", address: "Plot 12, Tema Community 2", bankMomo: "GCB Bank — 1234567890", ghanaCardFront: "f2.jpg", ghanaCardBack: "b2.jpg", passportPic: "p2.jpg", color: "#FF9F43", streak: 3, points: 310, badges: ["on-time"] },
    { id: "3", name: "Kofi Mensah", fullName: "Kofi Mensah", email: "kofi@gmail.com", phone: "0277654321", role: "member", status: "pending", groupId: null, joinedAt: "2025-03-10", ghanaCard: "GHA-000345678-9", address: "Kumasi, Ashanti — Adum", bankMomo: "0277654321 (Telecel Cash)", ghanaCardFront: "f3.jpg", ghanaCardBack: null, passportPic: null, color: "#5F27CD", streak: 0, points: 0, badges: [] },
    { id: "4", name: "Efua Darko", fullName: "Efua Darko", email: "efua@gmail.com", phone: "0201987654", role: "member", status: "approved", groupId: "2", joinedAt: "2025-01-08", ghanaCard: "GHA-000456789-0", address: "East Legon, Accra", bankMomo: "0201987654 (AirtelTigo)", ghanaCardFront: "f4.jpg", ghanaCardBack: "b4.jpg", passportPic: "p4.jpg", color: "#8B5CF6", streak: 6, points: 580, badges: ["on-time", "top"] },
    { id: "5", name: "Yaw Owusu", fullName: "Yaw Owusu", email: "yaw@gmail.com", phone: "0265432198", role: "member", status: "pending", groupId: null, joinedAt: "2025-03-12", ghanaCard: "GHA-000567890-1", address: "Sunyani, Bono Region", bankMomo: "0265432198 (MTN MoMo)", ghanaCardFront: "f5.jpg", ghanaCardBack: "b5.jpg", passportPic: null, color: "#FD79A8", streak: 0, points: 0, badges: [] },
    { id: "6", name: "Akosua Frimpong", fullName: "Akosua Frimpong", email: "akosua@gmail.com", phone: "0244876543", role: "member", status: "approved", groupId: "2", joinedAt: "2025-01-09", ghanaCard: "GHA-000678901-2", address: "Dansoman, Accra", bankMomo: "Ecobank — 0987654321", ghanaCardFront: "f6.jpg", ghanaCardBack: "b6.jpg", passportPic: "p6.jpg", color: "#0EA5E9", streak: 2, points: 220, badges: ["loyal"] },
    { id: "7", name: "Abena Osei", fullName: "Abena Osei", email: "abena@gmail.com", phone: "0244999888", role: "collector", status: "approved", groupId: null, joinedAt: "2025-01-01", ghanaCard: "GHA-000111222-3", address: "Accra Central", bankMomo: "0244999888 (MTN MoMo)", ghanaCardFront: "f7.jpg", ghanaCardBack: "b7.jpg", passportPic: "p7.jpg", color: "#3B5FBF", streak: 0, points: 0, badges: ["staff"] },
    { id: "admin-root", name: "Excellent Admin", fullName: "Excellent Admin", email: "admin@excellentsusu.com", phone: "0000000000", role: "admin", status: "approved", groupId: null, joinedAt: new Date().toISOString().split('T')[0], ghanaCard: "GHA-000000000-0", address: "System Root", bankMomo: "System", passportPic: null, ghanaCardFront: null, ghanaCardBack: null, color: "#6491DE", streak: 0, badges: ["staff"], points: 0 },
    { id: "manager-ama", name: "Susu Manager", fullName: "Susu Manager", email: "manager@excellentsusu.com", phone: "0244123456", role: "manager", status: "approved", groupId: null, joinedAt: "2025-01-08", ghanaCard: "GHA-111222333-4", address: "Adenta", bankMomo: "0244123456", color: "#FF9F43", streak: 0, badges: ["staff"], points: 0 },
    { id: "collector", name: "Abena Osei", fullName: "Abena Osei", email: "collector@excellentsusu.com", phone: "0244999888", role: "collector", status: "approved", groupId: null, joinedAt: "2025-01-01", color: "#3B5FBF", streak: 0, badges: ["staff"], points: 0 }
];
export const mockMembers = MOCK_USERS;
export const MOCK_GROUPS = [
    { id: "1", name: "Gold Circle A", groupName: "Gold Circle A", contribution: 500, contributionAmount: 500, frequency: "Monthly", totalRounds: 10, totalSlots: 10, currentRound: 2, startDate: "2025-01-01", nextPayout: "2025-04-01", nextRecipient: "1", listedForRegistration: true, color: "#FF9F43", members: ["1", "2"], chat: [{ sender: "1", msg: "When is next payout?", time: "10:30" }, { sender: "2", msg: "April 1st per schedule 😊", time: "10:32" }] },
    { id: "2", name: "Silver Savers", groupName: "Silver Savers", contribution: 200, contributionAmount: 200, frequency: "Weekly", totalRounds: 10, totalSlots: 10, currentRound: 5, startDate: "2025-01-06", nextPayout: "2025-01-27", nextRecipient: "6", listedForRegistration: true, color: "#8B5CF6", members: ["4", "6"], chat: [{ sender: "4", msg: "I made my payment today", time: "09:15" }, { sender: "6", msg: "Great! I'll pay tomorrow.", time: "09:20" }] },
];
export const mockGroups = MOCK_GROUPS;
export const MOCK_PAYMENTS = [
    { id: "1", userId: "1", memberId: "1", groupId: "1", groupName: "Gold Circle A", amount: 500, date: "2025-03-01", paymentDate: "2025-03-01", dueDate: "2025-03-01", status: "paid", round: 1, method: "MTN MoMo", ref: "MM-2025030101" },
    { id: "2", userId: "2", memberId: "2", groupId: "1", groupName: "Gold Circle A", amount: 500, date: "2025-03-01", paymentDate: "2025-03-01", dueDate: "2025-03-01", status: "paid", round: 1, method: "Bank", ref: "BK-2025030102" },
    { id: "3", userId: "4", memberId: "4", groupId: "2", groupName: "Silver Savers", amount: 200, date: "2025-03-13", paymentDate: "2025-03-13", dueDate: "2025-03-13", status: "paid", round: 5, method: "AirtelTigo", ref: "AT-2025031303" },
    { id: "4", userId: "6", memberId: "6", groupId: "2", groupName: "Silver Savers", amount: 200, date: "", paymentDate: "", dueDate: "2025-03-15", status: "pending", round: 5, method: "Ecobank", ref: "" },
    { id: "5", userId: "1", memberId: "1", groupId: "1", groupName: "Gold Circle A", amount: 500, date: "", paymentDate: "", dueDate: "2025-03-01", status: "overdue", round: 2, method: "MTN MoMo", ref: "" },
];
export const mockPayments = MOCK_PAYMENTS;
export const PAYOUT_SCHEDULE = [
    { id: "s1", groupId: "1", round: 1, recipientId: "2", memberId: "2", amount: 5000, payoutAmount: 5000, date: "2025-02-01", scheduledDate: "2025-02-01", paid: true, status: "paid" },
    { id: "s2", groupId: "1", round: 2, recipientId: "1", memberId: "1", amount: 5000, payoutAmount: 5000, date: "2025-04-01", scheduledDate: "2025-04-01", paid: false, status: "scheduled" },
    { id: "s3", groupId: "1", round: 3, recipientId: undefined, memberId: undefined, amount: 5000, payoutAmount: 5000, date: "2025-05-01", scheduledDate: "2025-05-01", paid: false, status: "scheduled" },
    { id: "s4", groupId: "2", round: 1, recipientId: "6", memberId: "6", amount: 2000, payoutAmount: 2000, date: "2025-01-13", scheduledDate: "2025-01-13", paid: true, status: "paid" },
    { id: "s5", groupId: "2", round: 2, recipientId: "4", memberId: "4", amount: 2000, payoutAmount: 2000, date: "2025-01-20", scheduledDate: "2025-01-20", paid: true, status: "paid" },
    { id: "s6", groupId: "2", round: 3, recipientId: undefined, memberId: undefined, amount: 2000, payoutAmount: 2000, date: "2025-01-27", scheduledDate: "2025-01-27", paid: false, status: "scheduled" },
];
export const mockPayouts = PAYOUT_SCHEDULE;
export const calculateStats = () => {
    const memberUsers = MOCK_USERS.filter(u => u.role === 'member');
    const approvedMembers = memberUsers.filter(u => u.status === 'approved');
    const paidPayments = MOCK_PAYMENTS.filter(p => p.status === 'paid');
    const overduePayments = MOCK_PAYMENTS.filter(p => p.status === 'overdue');
    const totalExpectedLifecycle = MOCK_GROUPS.reduce((sum, g) => {
        const contribution = Number(g.contributionAmount || g.contribution || 0);
        const membersCount = Array.isArray(g.members) ? g.members.length : 0;
        const rounds = Number(g.totalRounds || g.totalSlots || membersCount || 1);
        return sum + contribution * membersCount * rounds;
    }, 0);
    const totalCollected = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    return {
        totalCollected,
        activeMembers: approvedMembers.length,
        activeGroups: MOCK_GROUPS.length,
        payoutScheduled: PAYOUT_SCHEDULE.filter(p => !p.paid).reduce((sum, p) => sum + p.amount, 0),
        totalMembers: memberUsers.length,
        collectionRate: totalExpectedLifecycle > 0 ? Math.round((totalCollected / totalExpectedLifecycle) * 100) : 0,
        defaulters: new Set(overduePayments.map(p => p.userId)).size,
        overdueCount: overduePayments.length
    };
};
export const MOCK_AUDIT_LOGS = [
    {
        id: "log-1",
        timestamp: "2026-05-08 14:35:22",
        actor: "Manager A",
        actorRole: "Manager",
        action: "Payment Confirmed",
        target: "Payment #PAY-001",
        details: "Confirmed payment of GH₵25,000 for Sarah Johnson",
        severity: "info",
        category: "payment"
    },
    {
        id: "log-2",
        timestamp: "2026-05-08 14:30:15",
        actor: "Super Admin",
        actorRole: "Super Admin",
        action: "Member Role Updated",
        target: "Member: John Smith",
        details: "Changed member status from Active to Defaulter",
        severity: "warning",
        category: "user"
    },
    {
        id: "log-3",
        timestamp: "2026-05-08 14:20:33",
        actor: "Unknown User",
        actorRole: "Unknown",
        action: "Failed Login Attempt",
        target: "Login System",
        details: "Multiple failed login attempts from IP 203.0.113.42",
        severity: "critical",
        category: "security"
    }
];
export const MOCK_REMINDERS = [
    { id: "1", userId: "6", title: "Overdue Payment", text: "Due payment", type: "whatsapp", message: "Hi Akosua, your GH₵200 contribution is due. Please pay to keep your slot!", sent: "2025-03-18 09:00", date: "2025-03-18 09:00", read: true },
    { id: "2", userId: "1", title: "Overdue Payment", text: "Overdue payment", type: "sms", message: "Reminder: Your GH₵500 payment (Round 2) is overdue. Contact admin.", sent: "2025-03-19 08:00", date: "2025-03-19 08:00", read: true },
];

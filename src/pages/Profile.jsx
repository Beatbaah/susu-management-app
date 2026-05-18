import { useState } from 'react';
import { User, Bell, Shield, FileText, Settings, LogOut, ChevronRight, HelpCircle, MessageSquare, Award, Receipt, X, } from 'lucide-react';
import { userService } from '../services';
import { useAppContext } from '../context/AppContext';
import { validateEmail } from '../validation/authRules';
import { fmt } from '../utils/helpers';

const GHANA_PHONE_RE = /^(\+233|0)[2-5][0-9]{8}$/;
export function Profile({ user, onNavigate, onLogout }) {
    const { authUser, users, groups, payments, reminders, setUsers, setAuthUser } = useAppContext();
    const currentUser = authUser || user;
    const [editorOpen, setEditorOpen] = useState(false);
    const [draft, setDraft] = useState({
        fullName: currentUser.fullName || currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
        address: currentUser.address || '',
    });
    const [editorError, setEditorError] = useState(null);
    const openEditor = () => {
        setDraft({
            fullName: currentUser.fullName || currentUser.name || '',
            email: currentUser.email || '',
            phone: currentUser.phone || '',
            address: currentUser.address || '',
        });
        setEditorError(null);
        setEditorOpen(true);
    };
    const saveProfile = () => {
        if (!draft.fullName.trim()) {
            setEditorError('Full name is required.');
            return;
        }
        const emailCheck = validateEmail(draft.email);
        if (!emailCheck.ok) {
            setEditorError(emailCheck.message);
            return;
        }
        const phone = (draft.phone || '').replace(/[\s\-()]/g, '');
        if (phone && !GHANA_PHONE_RE.test(phone)) {
            setEditorError('Enter a valid Ghana mobile number (e.g. 0244123456).');
            return;
        }
        const updated = userService.updateUser(currentUser.id, {
            fullName: draft.fullName.trim(),
            name: draft.fullName.trim(),
            email: draft.email.trim(),
            phone: draft.phone.trim(),
            address: draft.address.trim(),
        });
        if (!updated) {
            setEditorError('Could not update profile.');
            return;
        }
        setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
        if (authUser?.id === updated.id)
            setAuthUser(updated);
        setEditorOpen(false);
    };
    const userGroups = groups.filter(group => {
        const members = Array.isArray(group.members) ? group.members : [];
        if (currentUser.role === 'admin' || currentUser.role === 'manager')
            return true;
        if (Array.isArray(currentUser.assignedGroups) && currentUser.assignedGroups.includes(group.id))
            return true;
        return currentUser.groupId === group.id || members.includes(currentUser.id);
    });
    const profilePayments = payments.filter(payment => {
        if (currentUser.role === 'admin' || currentUser.role === 'manager')
            return true;
        if (currentUser.role === 'collector')
            return userGroups.some(group => group.id === payment.groupId);
        return payment.userId === currentUser.id || payment.memberId === currentUser.id;
    });
    const paidPayments = profilePayments.filter(payment => payment.status === 'paid');
    const pendingRegistrations = users.filter(member => member.role === 'member' && member.status === 'pending').length;
    const unreadReminders = reminders.filter(reminder => reminder.read === false && (!reminder.userId || reminder.userId === currentUser.id)).length;
    const pendingPayments = profilePayments.filter(payment => payment.status === 'pending').length;
    const notificationCount = pendingRegistrations + unreadReminders + pendingPayments;
    const successRate = profilePayments.length > 0 ? Math.round((paidPayments.length / profilePayments.length) * 100) : 0;
    const stats = {
        activeGroups: userGroups.length,
        totalCollected: paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        collectionRate: successRate,
    };
    const menuSections = [
        {
            title: 'Account',
            items: [
                { icon: User, label: 'Personal Information', action: 'profile' },
                { icon: Shield, label: 'Security & Privacy', action: 'security' },
                { icon: Bell, label: 'Notifications', action: 'notifications', badge: notificationCount ? String(notificationCount) : undefined },
            ]
        },
        {
            title: 'Activity',
            items: [
                { icon: Receipt, label: 'My Receipts', action: 'receipts' },
                { icon: Award, label: 'Leaderboard', action: 'leaderboard' },
                { icon: FileText, label: 'Audit Logs', action: 'audit' },
            ]
        },
        {
            title: 'Support',
            items: [
                { icon: MessageSquare, label: 'Group Chat', action: 'chat' },
                { icon: HelpCircle, label: 'Help & Support', action: 'help' },
                { icon: Settings, label: 'Settings', action: 'settings' },
            ]
        }
    ];
    const getRoleBadgeColor = (role) => {
        switch (role.toLowerCase()) {
            case 'super admin':
                return 'bg-destructive/20 text-destructive';
            case 'manager':
                return 'bg-primary/20 text-primary';
            case 'collector':
                return 'bg-success/20 text-success';
            default:
                return 'bg-muted text-muted-foreground';
        }
    };
    const routeByAction = {
        security: 'settings',
        notifications: pendingRegistrations > 0 ? 'members' : pendingPayments > 0 ? 'payments' : 'profile',
        receipts: 'receipts',
        leaderboard: 'leaderboard',
        audit: 'audit',
        chat: 'chat',
        help: 'chat',
        settings: 'settings',
    };
    const handleAction = (action) => {
        if (action === 'profile') {
            openEditor();
            return;
        }
        const nextPage = routeByAction[action];
        if (nextPage)
            onNavigate?.(nextPage);
    };
    return (<div className="pb-28">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-6">
        <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Profile</h1>

        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-primary rounded-2xl sm:rounded-3xl flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-lg sm:text-2xl font-bold">
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-xl font-bold mb-1 truncate">{currentUser.name}</h2>
              <p className="text-muted-foreground text-xs sm:text-sm mb-2 truncate">{currentUser.email}</p>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${getRoleBadgeColor(currentUser.role)}`}>
                {currentUser.role}
              </span>
            </div>
          </div>
          <button type="button" className="w-full bg-primary text-primary-foreground py-2.5 sm:py-3 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20" onClick={openEditor}>
            Edit Profile
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border text-center overflow-hidden">
            <p className="text-base sm:text-xl font-bold mb-0.5 sm:mb-1 text-primary tabular-nums">{stats.activeGroups}</p>
            <p className="text-muted-foreground text-[10px] sm:text-xs font-bold uppercase leading-tight">Groups</p>
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border text-center overflow-hidden">
            <p className="text-[11px] sm:text-xl font-bold mb-0.5 sm:mb-1 text-primary tabular-nums truncate">{fmt(stats.totalCollected)}</p>
            <p className="text-muted-foreground text-[10px] sm:text-xs font-bold uppercase leading-tight">Collected</p>
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border text-center overflow-hidden">
            <p className="text-base sm:text-xl font-bold mb-0.5 sm:mb-1 text-primary tabular-nums">{stats.collectionRate}%</p>
            <p className="text-muted-foreground text-[10px] sm:text-xs font-bold uppercase leading-tight">Success</p>
          </div>
        </div>

        {menuSections.map((section, idx) => (<div key={idx} className="mb-6">
            <h4 className="text-muted-foreground text-sm mb-3 px-2">{section.title}</h4>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {section.items.map((item, itemIdx) => {
                const Icon = item.icon;
                return (<button key={itemIdx} type="button" onClick={() => handleAction(item.action)} className={`w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors ${itemIdx !== section.items.length - 1 ? 'border-b border-border' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted/50 rounded-xl flex items-center justify-center">
                        <Icon className="w-5 h-5 text-foreground"/>
                      </div>
                      <span className="text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.badge && (<span className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs">
                          {item.badge}
                        </span>)}
                      <ChevronRight className="w-5 h-5 text-muted-foreground"/>
                    </div>
                  </button>);
            })}
            </div>
          </div>))}

        <button type="button" onClick={onLogout} className="w-full bg-destructive/20 text-destructive py-4 rounded-2xl flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5"/>
          <span>Logout</span>
        </button>

        <div className="mt-6 text-center">
          <p className="text-muted-foreground text-xs">Version 1.0.0</p>
          <p className="text-muted-foreground text-xs mt-1">© 2026 Excellent Susu</p>
        </div>
      </div>

      {editorOpen && (<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl border border-border w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Edit Profile</h3>
              <button type="button" onClick={() => setEditorOpen(false)} className="p-2 rounded-xl hover:bg-muted/50">
                <X className="w-5 h-5 text-muted-foreground"/>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Full Name</label>
                <input type="text" value={draft.fullName} onChange={(e) => setDraft(p => ({ ...p, fullName: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground"/>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Email</label>
                <input type="email" value={draft.email} onChange={(e) => setDraft(p => ({ ...p, email: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground"/>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Phone</label>
                <input type="tel" value={draft.phone} onChange={(e) => setDraft(p => ({ ...p, phone: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground"/>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Address</label>
                <input type="text" value={draft.address} onChange={(e) => setDraft(p => ({ ...p, address: e.target.value }))} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground"/>
              </div>
              {editorError && <p className="text-destructive text-sm">{editorError}</p>}
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setEditorOpen(false)} className="flex-1 bg-card border border-border py-3 rounded-xl text-foreground">
                Cancel
              </button>
              <button type="button" onClick={saveProfile} className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl">
                Save Profile
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}

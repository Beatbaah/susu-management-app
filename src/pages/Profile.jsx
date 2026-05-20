import { useState, useRef } from 'react';
import { User, Bell, Shield, FileText, Settings, LogOut, ChevronRight, HelpCircle, MessageSquare, Award, Receipt, X, AlertCircle, Camera } from 'lucide-react';
import { userService } from '../services';
import { useAppContext } from '../context/AppContext';
import { validateEmail } from '../validation/authRules';
import { fmt } from '../utils/helpers';
import { updateDisplayName, setNameOverride } from '../services/authService';
import { uploadFile } from '../services/storageService';
import { toast } from '../utils/toast';

const GHANA_PHONE_RE = /^(\+233|0)[2-5][0-9]{8}$/;
export function Profile({ user, onNavigate, onLogout }) {
    const { authUser, users, groups, payments, reminders, setUsers, setAuthUser } = useAppContext();
    const currentUser = authUser || user;
    const [editorOpen, setEditorOpen] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const photoInputRef = useRef(null);
    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const url = await uploadFile(`users/${currentUser.id}/profile.jpg`, file);
            if (url) {
                const updated = userService.updateUser(currentUser.id, { profilePic: url }, currentUser);
                if (updated) {
                    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
                    if (authUser?.id === updated.id) setAuthUser(updated);
                }
                toast.success('Profile photo updated');
            } else {
                toast.error('Upload failed. Try again.');
            }
        } catch {
            toast.error('Could not upload photo.');
        } finally {
            setUploadingPhoto(false);
            e.target.value = '';
        }
    };
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
        }, currentUser);
        if (!updated) {
            setEditorError('Could not update profile.');
            return;
        }
        setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
        if (authUser?.id === updated.id) {
            setAuthUser(updated);
            const trimmedName = draft.fullName.trim();
            // Persist real name to localStorage (survives sign-out) and Firebase Auth
            setNameOverride(authUser.email, trimmedName);
            void updateDisplayName(trimmedName);
        }
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
                ...(currentUser.role === 'admin' ? [{ icon: FileText, label: 'Audit Logs', action: 'audit' }] : []),
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
        switch ((role || '').toLowerCase()) {
            case 'admin':
            case 'super admin':
                return 'bg-destructive/15 text-destructive border border-destructive/30';
            case 'manager':
                return 'bg-primary/15 text-primary border border-primary/30';
            case 'collector':
                return 'bg-purple-500/15 text-purple-600 border border-purple-500/30';
            case 'member':
                return 'bg-success/15 text-success border border-success/30';
            default:
                return 'bg-muted text-muted-foreground border border-border';
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
    return (<div className="pb-[calc(9rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-6">
        <h1 className="text-2xl font-bold text-foreground mb-4 sm:mb-6">Profile</h1>

        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-border mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
              className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex-shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              title="Change photo">
              {currentUser.profilePic ? (
                <img src={currentUser.profilePic} alt={currentUser.name} className="w-full h-full rounded-2xl sm:rounded-3xl object-cover"/>
              ) : (
                <div className="w-full h-full bg-primary rounded-2xl sm:rounded-3xl flex items-center justify-center">
                  <span className="text-primary-foreground text-lg sm:text-2xl font-bold">
                    {(currentUser.name || currentUser.fullName || '?').split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingPhoto
                  ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"/>
                  : <Camera className="w-5 h-5 text-white"/>}
              </div>
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange}/>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-xl font-bold mb-1 truncate">{currentUser.name}</h2>
              <p className="text-muted-foreground text-xs sm:text-sm mb-2 truncate">{currentUser.email}</p>
              <span className={`px-2.5 py-0.5 rounded-full app-badge uppercase ${getRoleBadgeColor(currentUser.role)}`}>
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
            <p className="app-value mb-1 text-primary">{stats.activeGroups}</p>
            <p className="text-muted-foreground app-caption uppercase">Groups</p>
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border text-center overflow-hidden">
            <p className="app-value mb-1 text-primary truncate">{fmt(stats.totalCollected)}</p>
            <p className="text-muted-foreground app-caption uppercase">Collected</p>
          </div>
          <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border text-center overflow-hidden">
            <p className="app-value mb-1 text-primary">{stats.collectionRate}%</p>
            <p className="text-muted-foreground app-caption uppercase">Success</p>
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

        <button type="button" onClick={onLogout} className="w-full bg-destructive/20 text-destructive py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5"/>
          <span>Logout</span>
        </button>

        <div className="mt-6 text-center">
          <p className="text-muted-foreground text-xs">Version 1.0.0</p>
          <p className="text-muted-foreground text-xs mt-1">© 2026 Excellent Susu</p>
        </div>
      </div>

      {editorOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditorOpen(false)}>
          <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 sm:pt-5 pb-4 border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary"/>
                </div>
                <h3 className="text-base font-bold">Edit Profile</h3>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Full Name</label>
                  <input type="text" value={draft.fullName} onChange={(e) => setDraft(p => ({ ...p, fullName: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Email</label>
                  <input type="email" value={draft.email} onChange={(e) => setDraft(p => ({ ...p, email: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Phone</label>
                  <input type="tel" value={draft.phone} onChange={(e) => setDraft(p => ({ ...p, phone: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Address</label>
                  <input type="text" value={draft.address} onChange={(e) => setDraft(p => ({ ...p, address: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"/>
                </div>
                {editorError && <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{editorError}</div>}
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-border/50 bg-card flex-shrink-0">
              <button type="button" onClick={() => setEditorOpen(false)} className="flex-1 bg-muted border border-border py-3.5 rounded-xl text-sm font-semibold text-foreground/70 hover:text-foreground transition-all">
                Cancel
              </button>
              <button type="button" onClick={saveProfile} className="flex-[1.5] bg-primary text-primary-foreground py-3.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all active:scale-[0.98]">
                Save Profile
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}

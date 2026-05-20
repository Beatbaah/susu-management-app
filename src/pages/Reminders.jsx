import { Bell, Clock, CheckCircle, AlertCircle, Plus, X, Send, ShieldAlert, Sparkles, MessageSquare, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { toast } from '../utils/toast';
import { cn } from '../components/ui/utils';
function relativeTime(isoOrDate) {
    if (!isoOrDate || isoOrDate === 'Automated') return isoOrDate || '';
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const EMPTY_DRAFT = {
    audience: 'all-members',
    singleUserId: '',
    title: 'Payment Reminder',
    text: 'A friendly reminder about your upcoming susu contribution.',
    type: 'info',
};
export function Reminders() {
    const { authUser, users, payments, reminders, sendReminder, markReminderRead, markAllRemindersRead, deleteReminder } = useAppContext();
    const [filter, setFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [draft, setDraft] = useState(EMPTY_DRAFT);
    const [dialogError, setDialogError] = useState(null);
    const canSend = authUser && ['admin', 'manager', 'collector'].includes(authUser.role);
    const visible = useMemo(() => reminders.filter(r => {
        // Members only see their own targeted reminders or broadcast reminders (no specific userId)
        if (authUser?.role === 'member') {
            if (r.userId && r.userId !== authUser.id) return false;
        }
        if (filter === 'unread') return !r.read;
        if (filter === 'warning') return r.type === 'warning';
        return true;
    }), [reminders, filter, authUser]);
    const ownReminders = useMemo(() => {
        if (authUser?.role !== 'member') return reminders;
        return reminders.filter(r => !r.userId || r.userId === authUser.id);
    }, [reminders, authUser]);
    const counts = useMemo(() => ({
        total: ownReminders.length,
        unread: ownReminders.filter(r => !r.read).length,
        warning: ownReminders.filter(r => r.type === 'warning').length,
    }), [ownReminders]);
    const resolveRecipients = () => {
        if (draft.audience === 'single')
            return draft.singleUserId ? [draft.singleUserId] : [];
        if (draft.audience === 'pending-members') {
            return users.filter(u => u.role === 'member' && u.status === 'pending').map(u => u.id);
        }
        if (draft.audience === 'overdue-only') {
            const approvedIds = new Set(users.filter(u => u.status === 'approved').map(u => u.id));
            const ids = new Set();
            payments.forEach(p => {
                if (p.status === 'overdue' && approvedIds.has(p.memberId || p.userId))
                    ids.add(p.memberId || p.userId);
            });
            return Array.from(ids);
        }
        return users.filter(u => u.role === 'member' && u.status === 'approved').map(u => u.id);
    };
    const BROADCAST_WARN_THRESHOLD = 20;
    const handleSend = () => {
        setDialogError(null);
        const recipients = resolveRecipients();
        if (recipients.length === 0) {
            setDialogError('No matching recipients found.');
            return;
        }
        if (!draft.title.trim() || !draft.text.trim()) {
            setDialogError('Title and message are required.');
            return;
        }
        if (recipients.length > BROADCAST_WARN_THRESHOLD) {
            if (!window.confirm(`This will send to ${recipients.length} members. Continue?`)) return;
        }
        sendReminder({ userIds: recipients, title: draft.title.trim(), text: draft.text.trim(), type: draft.type });
        toast.success(`Reminder sent to ${recipients.length} member${recipients.length === 1 ? '' : 's'}`);
        setDialogOpen(false);
        setDraft(EMPTY_DRAFT);
    };
    const userName = (id) => {
        const u = users.find(user => user.id === id);
        return u?.fullName || u?.name || 'Unknown User';
    };
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      {/* Header Section */}
      <div className="px-4 sm:px-6 md:px-10 pt-5 sm:pt-6 pb-4 sm:pb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
              </div>
              <p className="eyebrow text-muted-foreground">Notifications</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Alerts</h1>
            <p className="text-muted-foreground text-sm">{visible.length} shown from {counts.total} total</p>
          </div>
          {canSend && (<button type="button" onClick={() => { setDraft(EMPTY_DRAFT); setDialogError(null); setDialogOpen(true); }} className="w-10 h-10 sm:w-auto sm:px-4 rounded-xl bg-primary text-primary-foreground flex items-center justify-center sm:gap-2 active:scale-95 transition-all flex-shrink-0 text-sm font-semibold" aria-label="New Broadcast">
              <Plus className="w-4 h-4 flex-shrink-0"/>
              <span className="hidden sm:inline">New Alert</span>
            </button>)}
        </div>

        {/* High-level metrics */}
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-card/70 mb-4">
          <div className="min-w-0 px-2.5 py-2 border-r border-border">
            <div className="relative z-10">
              <p className="app-value text-foreground">{counts.total}</p>
              <p className="app-caption text-muted-foreground mt-1.5 truncate">All</p>
            </div>
          </div>
          <div className="min-w-0 px-2.5 py-2 border-r border-border">
            <div className="relative z-10">
              <p className="app-value text-warning">{counts.unread}</p>
              <p className="app-caption text-muted-foreground mt-1.5 truncate">Unread</p>
            </div>
          </div>
          <div className="min-w-0 px-2.5 py-2">
            <div className="relative z-10">
              <p className="app-value text-destructive">{counts.warning}</p>
              <p className="app-caption text-muted-foreground mt-1.5 truncate">Warning</p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="grid grid-cols-3 rounded-xl border border-border bg-card/70 p-1">
            {['all', 'unread', 'warning'].map(f => (<button key={f} type="button" onClick={() => setFilter(f)} className={cn("h-8 px-3 rounded-lg app-tab transition-colors", filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Warning'}
              </button>))}
          </div>
          {counts.unread > 0 && (<button type="button" onClick={() => { markAllRemindersRead(); toast.success('Cleared all notifications'); }} className="h-8 px-3 rounded-lg app-control text-primary/80 bg-primary/8 hover:text-primary transition-colors w-full sm:w-auto">
              Mark all read
            </button>)}
        </div>
      </div>

      {/* Feed Section */}
      <div className="px-4 sm:px-6 md:px-10 space-y-3 sm:space-y-4 max-w-4xl">
        {visible.length === 0 ? (<div className="py-12 sm:py-16 text-center glass-card rounded-xl border border-dashed border-border px-4">
            <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Sparkles className="w-7 h-7"/>
            </div>
            <h3 className="section-title text-foreground">Inbox Clear</h3>
            <p className="body text-muted-foreground mt-1">No alerts found matching your current filter.</p>
          </div>) : (visible.map(r => (
            <div key={r.id} className={cn("glass-card rounded-xl border transition-all duration-200 group overflow-hidden", r.read ? "border-border opacity-80" : "border-primary/20 bg-primary/[0.03] glow-primary")}>
              <button type="button" onClick={() => markReminderRead(r.id)} className="w-full text-left p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4 relative z-10">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-inner", r.type === 'warning' ? "bg-destructive/15 text-destructive" :
                  r.type === 'success' ? "bg-success/15 text-success" :
                      "bg-primary/15 text-primary")}>
                    {r.type === 'warning' ? <ShieldAlert className="w-5 h-5"/> :
                  r.type === 'success' ? <CheckCircle className="w-5 h-5"/> :
                      <MessageSquare className="w-5 h-5"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <h4 className="app-row-title text-foreground truncate group-hover:text-primary transition-colors">{r.title}</h4>
                      {!r.read && <div className="w-2 h-2 rounded-full bg-primary pulse-dot flex-shrink-0"/>}
                    </div>
                    <p className="app-row-meta text-muted-foreground mb-3">{r.text || r.message}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border pt-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="eyebrow text-muted-foreground">
                          {userName(r.userId)}
                        </p>
                      </div>
                      <p className="eyebrow text-muted-foreground shrink-0">
                        {relativeTime(r.sent || r.date)}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
              <div className="px-4 sm:px-5 pb-3 flex justify-end border-t border-border/50">
                <button
                  type="button"
                  onClick={() => deleteReminder(r.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Delete reminder"
                >
                  <Trash2 className="w-3.5 h-3.5"/>
                  Delete
                </button>
              </div>
            </div>
          )))}
      </div>

      {/* Broadcast Modal — mobile bottom sheet, desktop centered */}
      {dialogOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm page-enter" onClick={() => setDialogOpen(false)}>
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-4 sm:pt-6 pb-4 flex-shrink-0 border-b border-border/50">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">New Broadcast</h3>
                <p className="text-muted-foreground text-xs uppercase tracking-widest mt-0.5">Global Communication Tool</p>
              </div>
              <button type="button" onClick={() => setDialogOpen(false)} className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <X className="w-4 h-4"/>
              </button>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Target Audience</label>
                  <select value={draft.audience} onChange={(e) => setDraft(d => ({ ...d, audience: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none">
                    <option value="all-members">All active members</option>
                    <option value="overdue-only">Overdue accounts only</option>
                    <option value="pending-members">Pending applications</option>
                    <option value="single">Individual selection…</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Alert Priority</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['info', 'warning', 'success'].map(t => (<button key={t} type="button" onClick={() => setDraft(d => ({ ...d, type: t }))} className={cn("py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all", draft.type === t
                    ? "border-primary/50 bg-primary/20 text-foreground"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-accent")}>
                        {t}
                      </button>))}
                  </div>
                </div>
              </div>

              {draft.audience === 'single' && (<div className="page-enter">
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Select Recipient</label>
                  <select value={draft.singleUserId} onChange={(e) => setDraft(d => ({ ...d, singleUserId: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all">
                    <option value="">Choose a member…</option>
                    {users.filter(u => u.role === 'member' && u.status === 'approved').map(u => (<option key={u.id} value={u.id}>{u.fullName || u.name}</option>))}
                  </select>
                </div>)}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Alert Headline</label>
                  <input type="text" value={draft.title} onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none" placeholder="e.g. Action Required"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">Message Content</label>
                  <textarea value={draft.text} onChange={(e) => setDraft(d => ({ ...d, text: e.target.value }))} rows={3} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none resize-none" placeholder="Type your message here…"/>
                </div>
              </div>

              {dialogError && (<div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0"/>
                  {dialogError}
                </div>)}
            </div>

            {/* Sticky footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-border/50 bg-card flex-shrink-0">
              <button type="button" onClick={() => setDialogOpen(false)} className="flex-1 bg-muted border border-border py-3.5 rounded-xl text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-all">
                Dismiss
              </button>
              <button type="button" onClick={handleSend} className="flex-[1.5] bg-primary text-primary-foreground shadow-lg shadow-primary/25 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition-all group">
                <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"/>
                Dispatch Alert
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}

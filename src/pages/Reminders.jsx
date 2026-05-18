import { Bell, Clock, CheckCircle, AlertCircle, Plus, X, Send, ShieldAlert, Sparkles, MessageSquare, Phone, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { toast } from '../utils/toast';
import { cn } from '../components/ui/utils';
const EMPTY_DRAFT = {
    audience: 'all-members',
    singleUserId: '',
    title: 'Payment Reminder',
    text: 'A friendly reminder about your upcoming susu contribution.',
    type: 'info',
    channels: ['in-app'],
};
const CHANNEL_OPTIONS = [
    { key: 'in-app', label: 'In-App', icon: Bell, color: 'text-primary' },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-success' },
    { key: 'sms', label: 'SMS', icon: MessageSquare, color: 'text-warning' },
    { key: 'call', label: 'Call', icon: Phone, color: 'text-destructive' },
];
export function Reminders() {
    const { authUser, users, payments, reminders, sendReminder, markReminderRead, markAllRemindersRead } = useAppContext();
    const [filter, setFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [draft, setDraft] = useState(EMPTY_DRAFT);
    const [dialogError, setDialogError] = useState(null);
    const canSend = authUser && ['admin', 'manager', 'collector'].includes(authUser.role);
    const visible = useMemo(() => reminders.filter(r => {
        if (filter === 'unread')
            return !r.read;
        if (filter === 'warning')
            return r.type === 'warning';
        return true;
    }), [reminders, filter]);
    const counts = useMemo(() => ({
        total: reminders.length,
        unread: reminders.filter(r => !r.read).length,
        warning: reminders.filter(r => r.type === 'warning').length,
    }), [reminders]);
    const resolveRecipients = () => {
        if (draft.audience === 'single')
            return draft.singleUserId ? [draft.singleUserId] : [];
        if (draft.audience === 'pending-members') {
            return users.filter(u => u.role === 'member' && u.status === 'pending').map(u => u.id);
        }
        if (draft.audience === 'overdue-only') {
            const ids = new Set();
            payments.forEach(p => { if (p.status === 'overdue')
                ids.add(p.memberId || p.userId); });
            return Array.from(ids);
        }
        return users.filter(u => u.role === 'member' && u.status === 'approved').map(u => u.id);
    };
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
        sendReminder({ userIds: recipients, title: draft.title.trim(), text: draft.text.trim(), type: draft.type, channels: draft.channels });
        // For external channels (WhatsApp/SMS/Call), open links for single recipient
        if (draft.audience === 'single' && recipients.length === 1) {
            const recipient = users.find(u => u.id === recipients[0]);
            const phone = (recipient?.phone || '').replace(/[\s\-()]/g, '');
            const msg = encodeURIComponent(`[Excellent Susu] ${draft.title.trim()}: ${draft.text.trim()}`);
            if (phone) {
                if (draft.channels.includes('whatsapp'))
                    window.open(`https://wa.me/${phone.replace(/^0/, '233')}?text=${msg}`, '_blank');
                if (draft.channels.includes('sms'))
                    window.open(`sms:${phone}?body=${msg}`, '_blank');
                if (draft.channels.includes('call'))
                    window.open(`tel:${phone}`, '_blank');
            }
        }
        toast.success(`Reminder broadcasted to ${recipients.length} member${recipients.length === 1 ? '' : 's'}`);
        setDialogOpen(false);
        setDraft(EMPTY_DRAFT);
    };
    const userName = (id) => {
        const u = users.find(user => user.id === id);
        return u?.fullName || u?.name || 'Unknown User';
    };
    return (<div className="pb-28 page-enter">
      {/* Header Section */}
      <div className="px-4 sm:px-6 md:px-10 pt-4 sm:pt-6 pb-4 sm:pb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="app-title text-foreground">Alerts</h1>
            <p className="app-caption text-muted-foreground mt-1">{visible.length} shown from {counts.total} total</p>
          </div>
          {canSend && (<button type="button" onClick={() => { setDraft(EMPTY_DRAFT); setDialogError(null); setDialogOpen(true); }} className="h-10 px-3.5 rounded-xl bg-primary text-primary-foreground flex items-center gap-2 active:scale-95 transition-all flex-shrink-0" aria-label="New Broadcast">
              <Plus className="w-4 h-4"/>
              <span className="hidden sm:inline app-control">New broadcast</span>
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
          </div>) : (visible.map(r => (<button key={r.id} type="button" onClick={() => markReminderRead(r.id)} className={cn("w-full text-left glass-card p-4 sm:p-5 rounded-xl border transition-all duration-200 group overflow-hidden", r.read ? "border-border opacity-80" : "border-primary/20 bg-primary/[0.03] glow-primary")}>
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
                    {!r.read && <div className="w-2 h-2 rounded-full bg-primary pulse-dot"/>}
                  </div>
                  <p className="app-row-meta text-muted-foreground mb-3">{r.text || r.message}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border pt-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="eyebrow text-muted-foreground">
                        {userName(r.userId)}
                      </p>
                      {Array.isArray(r.channels) && r.channels.filter(c => c !== 'in-app').map(ch => {
                        const opt = CHANNEL_OPTIONS.find(o => o.key === ch);
                        if (!opt) return null;
                        const Icon = opt.icon;
                        const recipientUser = users.find(u => u.id === r.userId);
                        const phone = (recipientUser?.phone || '').replace(/[\s\-()]/g, '');
                        const msg = encodeURIComponent(`[Excellent Susu] ${r.title}: ${r.text || r.message || ''}`);
                        const href = ch === 'whatsapp' ? `https://wa.me/${phone.replace(/^0/, '233')}?text=${msg}`
                            : ch === 'sms' ? `sms:${phone}?body=${msg}`
                            : ch === 'call' ? `tel:${phone}` : null;
                        if (!href) return null;
                        return (
                          <a key={ch} href={href} target={ch === 'whatsapp' ? '_blank' : undefined} rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border app-badge uppercase transition-colors hover:opacity-80', opt.color, 'bg-current/5 border-current/20')}>
                            <Icon className="w-3 h-3"/>
                            {opt.label}
                          </a>
                        );
                      })}
                    </div>
                    <p className="eyebrow text-muted-foreground shrink-0">
                      {r.date || r.sent || 'Just now'}
                    </p>
                  </div>
                </div>
              </div>
            </button>)))}
      </div>

      {/* Broadcast Modal */}
      {dialogOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm backdrop-blur-md page-enter">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg p-8 md:p-10 shadow-xl relative overflow-hidden">
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">New Broadcast</h3>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Global Communication Tool</p>
              </div>
              <button type="button" onClick={() => setDialogOpen(false)} className="w-10 h-10 rounded-xl bg-border flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Target Audience</label>
                  <select value={draft.audience} onChange={(e) => setDraft(d => ({ ...d, audience: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:bg-card focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all outline-none">
                    <option value="all-members">All active members</option>
                    <option value="overdue-only">Overdue accounts only</option>
                    <option value="pending-members">Pending applications</option>
                    <option value="single">Individual selection…</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Alert Priority</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['info', 'warning', 'success'].map(t => (<button key={t} type="button" onClick={() => setDraft(d => ({ ...d, type: t }))} className={cn("py-3 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all", draft.type === t
                    ? "border-primary/50 bg-primary/20 text-foreground shadow-lg shadow-primary/10"
                    : "border-border bg-border text-muted-foreground hover:bg-accent")}>
                        {t}
                      </button>))}
                  </div>
                </div>
              </div>

              {draft.audience === 'single' && (<div className="page-enter">
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Select Recipient</label>
                  <select value={draft.singleUserId} onChange={(e) => setDraft(d => ({ ...d, singleUserId: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:bg-card outline-none transition-all">
                    <option value="">Choose a member…</option>
                    {users.filter(u => u.role === 'member').map(u => (<option key={u.id} value={u.id}>{u.fullName || u.name}</option>))}
                  </select>
                </div>)}

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Delivery Channel</label>
                <div className="grid grid-cols-4 gap-2">
                  {CHANNEL_OPTIONS.map(ch => {
                    const Icon = ch.icon;
                    const active = draft.channels.includes(ch.key);
                    return (
                      <button key={ch.key} type="button"
                        onClick={() => setDraft(d => ({
                          ...d,
                          channels: active
                            ? d.channels.filter(c => c !== ch.key).length > 0 ? d.channels.filter(c => c !== ch.key) : d.channels
                            : [...d.channels, ch.key]
                        }))}
                        className={cn('flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all', active ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-input-background text-muted-foreground hover:border-primary/30')}>
                        <Icon className={cn('w-4 h-4', active ? ch.color : '')}/>
                        <span className="app-badge uppercase">{ch.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Alert Headline</label>
                  <input type="text" value={draft.title} onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:bg-card focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all outline-none" placeholder="e.g. Action Required"/>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5 block">Message Content</label>
                  <textarea value={draft.text} onChange={(e) => setDraft(d => ({ ...d, text: e.target.value }))} rows={4} className="w-full bg-input-background border border-border rounded-2xl px-4 py-4 text-sm font-bold text-foreground focus:bg-card focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all outline-none resize-none" placeholder="Type your message here…"/>
                </div>
              </div>

              {dialogError && (<div className="flex items-center gap-2 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                  <AlertCircle className="w-4 h-4"/>
                  {dialogError}
                </div>)}
            </div>

            <div className="flex gap-3 mt-10 relative z-10">
              <button type="button" onClick={() => setDialogOpen(false)} className="flex-1 bg-accent border border-border py-4 rounded-2xl text-xs font-bold uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                Dismiss
              </button>
              <button type="button" onClick={handleSend} className="flex-[1.5] bg-primary text-primary-foreground shadow-xl shadow-primary/30 py-4 rounded-2xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all group">
                <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"/>
                Dispatch Alert
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}

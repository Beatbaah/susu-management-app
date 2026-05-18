import { useMemo, useEffect } from 'react';
import { toast } from '../../utils/toast';
import { X, Bell, UserPlus, Clock, AlertCircle, CheckCircle2, Trash2, } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { fmt } from '../../utils/helpers';
const toneClasses = {
    info: { dot: 'bg-primary', icon: 'text-primary', bg: 'bg-primary/10' },
    warning: { dot: 'bg-yellow-500', icon: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    success: { dot: 'bg-success', icon: 'text-success', bg: 'bg-success/10' },
    danger: { dot: 'bg-destructive', icon: 'text-destructive', bg: 'bg-destructive/10' },
};
const formatRelative = (iso) => {
    if (!iso)
        return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    const diff = Date.now() - d.getTime();
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute)
        return 'just now';
    if (diff < hour)
        return `${Math.floor(diff / minute)}m ago`;
    if (diff < day)
        return `${Math.floor(diff / hour)}h ago`;
    if (diff < 7 * day)
        return `${Math.floor(diff / day)}d ago`;
    return d.toLocaleDateString();
};
export function NotificationsPanel({ onClose, onNavigate }) {
    const { authUser, reminders, users, payments, settings, markReminderRead, markAllRemindersRead, deleteReminder, clearReminders, dismissMemberNotification, dismissPaymentNotification, clearAllNotifications, } = useAppContext();
    // Auto-mark all reminders as read when the panel opens
    useEffect(() => {
        if (reminders.some(r => !r.read)) markAllRemindersRead();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const isStaff = authUser && ['admin', 'manager'].includes(authUser.role);
    const isCollector = authUser?.role === 'collector';
    // Classify a reminder by its title / body keywords so we can respect the
    // per-category notification toggles in settings.
    const reminderCategory = (r) => {
        const haystack = `${r.title || ''} ${r.text || r.message || ''}`.toLowerCase();
        if (/overdue|default|late/.test(haystack))
            return 'defaulter';
        if (/payout|recipient/.test(haystack))
            return 'payout';
        if (/chat|message/.test(haystack))
            return 'chat';
        if (/payment|contribution|momo|due/.test(haystack))
            return 'payment';
        return 'general';
    };
    const allowReminder = (r) => {
        const cat = reminderCategory(r);
        if (cat === 'defaulter' && !settings.notifDefaulterAlerts)
            return false;
        if (cat === 'payout' && !settings.notifPayoutAlerts)
            return false;
        if (cat === 'chat' && !settings.notifGroupChat)
            return false;
        if (cat === 'payment' && !settings.notifPaymentReminders)
            return false;
        return true;
    };
    const items = useMemo(() => {
        const list = [];
        // 1. Reminders — filtered by per-category preference toggles
        reminders.forEach(r => {
            const isMine = !r.userId || r.userId === authUser?.id;
            if (!isStaff && !isMine)
                return;
            if (!allowReminder(r))
                return;
            list.push({
                id: `r-${r.id}`,
                source: 'reminder',
                title: r.title || 'Reminder',
                body: r.text || r.message || '',
                time: r.sent || r.date || '',
                read: !!r.read,
                tone: r.type === 'warning' ? 'warning' : r.type === 'success' ? 'success' : 'info',
                deleteId: r.id,
                onSelect: () => {
                    if (r.id)
                        markReminderRead(r.id);
                    onNavigate('reminders');
                    onClose();
                },
            });
        });
        // 2. Pending member approvals (admin / manager only)
        if (isStaff) {
            users
                .filter(u => u.role === 'member' && u.status === 'pending')
                .forEach(u => {
                list.push({
                    id: `m-${u.id}`,
                    source: 'pending-member',
                    title: 'New member request',
                    body: `${u.fullName || u.name} is awaiting approval.`,
                    time: u.createdAt || u.joinedAt || '',
                    read: true,
                    tone: 'info',
                    onSelect: () => {
                        onNavigate('members');
                        onClose();
                    },
                    dismissAction: () => dismissMemberNotification(u.id),
                });
            });
        }
        // 3. Pending payment confirmations — only if Payment Reminders is on
        if ((isStaff || isCollector) && settings.notifPaymentReminders) {
            payments
                .filter(p => p.status === 'pending')
                .forEach(p => {
                const member = users.find(u => u.id === (p.memberId || p.userId));
                list.push({
                    id: `p-${p.id}`,
                    source: 'pending-payment',
                    title: 'Payment needs confirmation',
                    body: `${member?.fullName || member?.name || 'Member'} submitted ${fmt(p.amount || 0)}`,
                    time: p.paymentDate || p.date || '',
                    read: true,
                    tone: 'warning',
                    onSelect: () => {
                        onNavigate('payments');
                        onClose();
                    },
                    dismissAction: () => dismissPaymentNotification(p.id),
                });
            });
        }
        return list.sort((a, b) => {
            const ta = a.time ? new Date(a.time).getTime() : 0;
            const tb = b.time ? new Date(b.time).getTime() : 0;
            return tb - ta;
        });
    }, [reminders, users, payments, authUser, isStaff, isCollector, settings, markReminderRead, dismissMemberNotification, dismissPaymentNotification, onNavigate, onClose]);
    const unreadCount = items.filter(i => !i.read).length;
    const hasReminderUnread = reminders.some(r => !r.read);
    const hasReminders = reminders.length > 0;
    return (<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-start sm:justify-end p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
              <Bell className="w-5 h-5"/>
            </div>
            <div>
              <p className="font-bold text-foreground">Notifications</p>
              <p className="text-muted-foreground text-xs">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted/50 text-muted-foreground flex items-center justify-center" aria-label="Close notifications">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {items.length === 0 ? (<div className="px-6 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7"/>
              </div>
              <p className="text-foreground font-bold mb-1">You're all caught up</p>
              <p className="text-muted-foreground text-sm">
                No new reminders, approvals, or payments to confirm.
              </p>
            </div>) : (<div className="divide-y divide-border">
              {items.map(item => {
                const tone = toneClasses[item.tone];
                const SourceIcon = item.source === 'pending-member' ? UserPlus :
                    item.source === 'pending-payment' ? Clock :
                        item.tone === 'warning' ? AlertCircle :
                            Bell;
                return (<div key={item.id} className={`w-full px-4 py-3 hover:bg-muted/20 transition-colors rounded-2xl ${item.read ? '' : 'bg-primary/[0.03]'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl ${tone.bg} ${tone.icon} flex items-center justify-center flex-shrink-0`}>
                        <SourceIcon className="w-4 h-4"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <button type="button" onClick={item.onSelect} className="w-full text-left">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-foreground font-bold text-sm truncate flex-1">{item.title}</p>
                            {!item.read && <span className={`w-1.5 h-1.5 rounded-full ${tone.dot} flex-shrink-0`}/>}
                          </div>
                          <p className="text-muted-foreground text-xs mb-1 line-clamp-2">{item.body}</p>
                          <p className="text-muted-foreground text-xs uppercase tracking-wider font-bold">
                            {formatRelative(item.time)}
                          </p>
                        </button>
                      </div>
                      {item.dismissAction && (<button type="button" onClick={(e) => {
                                    e.stopPropagation();
                                    item.dismissAction();
                                    toast.success('Notification removed');
                                }} className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/80 flex items-center justify-center transition-colors" aria-label="Dismiss notification">
                        <Trash2 className="w-4 h-4"/>
                      </button>)}
                    </div>
                  </div>);
            })}
            </div>)}
        </div>

        {(hasReminderUnread || items.length > 0) && (<div className="border-t border-border p-3 flex-shrink-0">
            <div className="grid gap-2">
              {hasReminderUnread && (<button type="button" onClick={() => { markAllRemindersRead(); toast.success('All reminders marked read'); }} className="w-full text-center text-primary text-xs font-bold py-2 rounded-xl hover:bg-primary/10 transition-colors">
                  Mark all reminders as read
                </button>)}
              {items.length > 0 && (<button type="button" onClick={() => { clearAllNotifications(); toast.success('All notifications cleared'); }} className="w-full text-center text-foreground text-xs font-bold py-2 rounded-xl border border-border hover:bg-muted/10 transition-colors">
                  Clear all notifications
                </button>)}
            </div>
          </div>)}
      </div>
    </div>);
}

import { Bell, BellOff, BellRing, Globe, Moon, Database, Download, Upload, Trash2, ChevronRight, Lock, Key, AlertCircle, X, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { validatePassword } from '../validation/authRules';
import { changePassword } from '../services/authService';
import { toast } from '../utils/toast';
import { requestPushPermission, getPermissionState, isNotificationSupported } from '../services/pushNotificationService';
const LANGUAGES = [
    { code: 'English', label: 'English', flag: '🇬🇧' },
    { code: 'Twi', label: 'Twi (Akan)', flag: '🇬🇭' },
    { code: 'Ga', label: 'Ga', flag: '🇬🇭' },
    { code: 'Ewe', label: 'Ewe', flag: '🇬🇭' },
    { code: 'Hausa', label: 'Hausa', flag: '🇬🇭' },
    { code: 'Français', label: 'Français', flag: '🇫🇷' },
];
const CURRENCIES = [
    { code: 'GHS (GH₵)', label: 'Ghanaian Cedi', symbol: 'GH₵' },
    { code: 'USD ($)', label: 'US Dollar', symbol: '$' },
    { code: 'EUR (€)', label: 'Euro', symbol: '€' },
    { code: 'GBP (£)', label: 'British Pound', symbol: '£' },
    { code: 'NGN (₦)', label: 'Nigerian Naira', symbol: '₦' },
    { code: 'XOF (CFA)', label: 'CFA Franc', symbol: 'CFA' },
];
export function Settings() {
    const { authUser, settings, updateSetting, payments, users, groups, schedule, auditLogs, setUsers, setPayments, setGroups, setSchedule, } = useAppContext();
    const isAdminOrManager = authUser && ['admin', 'manager'].includes(authUser.role);
    const [dialog, setDialog] = useState(null);
    const [pushPermission, setPushPermission] = useState(() => getPermissionState());
    const [pushLoading, setPushLoading] = useState(false);
    const handlePushToggle = async () => {
        if (!isNotificationSupported()) {
            toast.error('Push notifications are not supported in this browser.');
            return;
        }
        if (pushPermission === 'denied') {
            setDialog('push-denied');
            return;
        }
        if (pushPermission === 'granted') {
            // Browser doesn't allow programmatic revoke — direct user to settings.
            setDialog('push-revoke');
            return;
        }
        setPushLoading(true);
        const result = await requestPushPermission(authUser?.id);
        setPushLoading(false);
        if (result.ok) {
            setPushPermission('granted');
            toast.success('Push notifications enabled');
        } else if (result.reason === 'denied') {
            setPushPermission('denied');
            toast.error('Permission denied. Enable notifications in your browser settings.');
        }
    };
    const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
    const [pwError, setPwError] = useState(null);
    const [pwLoading, setPwLoading] = useState(false);
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState(null);
    const exportData = () => {
        try {
            const blob = new Blob([JSON.stringify({ payments, users, groups, schedule, auditLogs, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `excellent-susu-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Backup downloaded');
        }
        catch {
            toast.error('Could not export data');
        }
    };
    const handleImport = () => {
        setImportError(null);
        try {
            const parsed = JSON.parse(importText);
            // Validate each array contains only objects with an id field.
            const validRecords = (arr) => Array.isArray(arr) && arr.every(r => r && typeof r === 'object' && r.id != null);
            if (parsed.users !== undefined && !validRecords(parsed.users)) {
                setImportError('Invalid users data — each record must have an id field.'); return;
            }
            if (parsed.payments !== undefined && !validRecords(parsed.payments)) {
                setImportError('Invalid payments data — each record must have an id field.'); return;
            }
            if (parsed.groups !== undefined && !validRecords(parsed.groups)) {
                setImportError('Invalid groups data — each record must have an id field.'); return;
            }
            if (parsed.schedule !== undefined && !Array.isArray(parsed.schedule)) {
                setImportError('Invalid schedule data.'); return;
            }
            if (Array.isArray(parsed.users)) setUsers(parsed.users);
            if (Array.isArray(parsed.payments)) setPayments(parsed.payments);
            if (Array.isArray(parsed.groups)) setGroups(parsed.groups);
            if (Array.isArray(parsed.schedule)) setSchedule(parsed.schedule);
            setDialog(null);
            setImportText('');
            toast.success('Import successful');
        }
        catch {
            setImportError('Invalid backup file. Expecting JSON exported from this app.');
        }
    };
    const toCSV = (headers, rows) => {
        const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
    };
    const downloadCSV = (filename, csv) => {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const exportPaymentsCSV = () => {
        try {
            const headers = ['Date', 'Member', 'Group', 'Amount', 'Method', 'Status', 'Round', 'Reference'];
            const rows = payments.map(p => {
                const member = users.find(u => u.id === (p.memberId || p.userId));
                const group = groups.find(g => g.id === p.groupId);
                return [
                    p.paymentDate || p.date || '',
                    member?.fullName || member?.name || '',
                    group?.groupName || group?.name || '',
                    p.amount || 0,
                    p.method || '',
                    p.status || '',
                    p.round || '',
                    p.ref || '',
                ];
            });
            downloadCSV(`payments-${new Date().toISOString().split('T')[0]}.csv`, toCSV(headers, rows));
            toast.success('Payments exported as CSV');
        } catch {
            toast.error('Could not export payments');
        }
    };
    const exportMembersCSV = () => {
        try {
            const headers = ['Name', 'Email', 'Phone', 'Role', 'Status', 'Group', 'Ghana Card', 'Address', 'Bank/MoMo'];
            const memberUsers = users.filter(u => u.role === 'member');
            const rows = memberUsers.map(u => {
                const group = groups.find(g => g.id === u.groupId);
                return [
                    u.fullName || u.name || '',
                    u.email || '',
                    u.phone || '',
                    u.role || '',
                    u.status || '',
                    group?.groupName || group?.name || '',
                    u.ghanaCard || '',
                    u.address || '',
                    u.bankMomo || '',
                ];
            });
            downloadCSV(`members-${new Date().toISOString().split('T')[0]}.csv`, toCSV(headers, rows));
            toast.success('Members exported as CSV');
        } catch {
            toast.error('Could not export members');
        }
    };
    const exportSettings = () => {
        try {
            const blob = new Blob([JSON.stringify({ settings, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `excellent-susu-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Settings exported');
        } catch {
            toast.error('Could not export settings');
        }
    };
    const clearCache = async () => {
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            toast.success('Cache cleared');
        }
        catch {
            toast.error('Could not clear cache');
        }
    };
    const submitPasswordChange = async () => {
        setPwError(null);
        if (!pw.current) {
            setPwError('Enter your current password.');
            return;
        }
        const v = validatePassword(pw.next);
        if (!v.ok) {
            setPwError(v.message || 'Invalid password.');
            return;
        }
        if (pw.next !== pw.confirm) {
            setPwError('New password and confirmation must match.');
            return;
        }
        setPwLoading(true);
        const result = await changePassword(pw.current, pw.next);
        setPwLoading(false);
        if (!result.ok) {
            setPwError(result.message || 'Password update failed.');
            return;
        }
        setDialog(null);
        setPw({ current: '', next: '', confirm: '' });
        toast.success('Password updated');
    };
    const pushIcon = pushPermission === 'granted' ? BellRing : pushPermission === 'denied' ? BellOff : Bell;
    const pushLabel = pushLoading ? 'Enabling…'
        : pushPermission === 'granted' ? 'Enabled'
        : pushPermission === 'denied'  ? 'Blocked by browser'
        : pushPermission === 'not_supported' ? 'Not supported'
        : 'Off';
    const settingsSections = [
        {
            title: 'Notifications',
            items: [
                { icon: Bell, label: 'Payment Reminders', key: 'notifPaymentReminders', toggle: true },
                { icon: Bell, label: 'Payout Alerts', key: 'notifPayoutAlerts', toggle: true },
                { icon: Bell, label: 'Group Chat', key: 'notifGroupChat', toggle: true },
                { icon: Bell, label: 'Defaulter Alerts', key: 'notifDefaulterAlerts', toggle: true },
                { icon: pushIcon, label: 'Push Notifications', value: pushLabel, action: handlePushToggle,
                  highlight: pushPermission === 'granted', danger: pushPermission === 'denied' },
            ]
        },
        {
            title: 'Security',
            items: [
                { icon: Lock, label: 'Change Password', action: () => setDialog('password') },
                { icon: Key, label: 'Two-Factor Authentication', value: 'Coming soon', action: () => setDialog('2fa') },
            ]
        },
        {
            title: 'Preferences',
            items: [
                { icon: Moon, label: 'Dark Mode', key: 'darkMode', toggle: true },
                { icon: Globe, label: 'Language', value: settings.language, action: () => setDialog('language') },
                { icon: Globe, label: 'Currency', value: settings.currency, action: () => setDialog('currency') },
            ]
        },
        ...(isAdminOrManager ? [{
            title: 'Data Management',
            items: [
                { icon: Download, label: 'Export Data (JSON)', action: exportData },
                { icon: Download, label: 'Export Payments (CSV)', action: exportPaymentsCSV },
                { icon: Download, label: 'Export Members (CSV)', action: exportMembersCSV },
                { icon: Upload, label: 'Import Data', action: () => setDialog('import') },
                { icon: Database, label: 'Export Settings', action: exportSettings },
                { icon: Trash2, label: 'Clear Cache', action: clearCache, danger: true },
            ]
        }] : [{ title: 'Data Management', items: [{ icon: Trash2, label: 'Clear Cache', action: clearCache, danger: true }] }]),
    ];
    return (<div className="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] page-enter">
      <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
            </div>
            <p className="eyebrow text-muted-foreground">Preferences</p>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your app preferences and security.</p>
        </div>

        <div className="bg-primary/20 border border-primary/40 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-foreground text-sm font-semibold mb-1">Security Recommendation</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Use a strong, unique password. Two-factor authentication support is coming in a future update.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        {settingsSections.map((section, idx) => (<div key={idx} className="mb-6">
            <h4 className="text-muted-foreground text-sm mb-3 px-2">{section.title}</h4>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {section.items.map((item, itemIdx) => {
                const Icon = item.icon;
                const enabled = item.toggle && item.key ? !!settings[item.key] : false;
                const handleClick = () => {
                    if (item.toggle && item.key)
                        updateSetting(item.key, !settings[item.key]);
                    else if (item.action)
                        item.action();
                };
                const isInteractive = !!item.toggle || !!item.action;
                const iconColor = item.danger ? 'text-destructive' : item.highlight ? 'text-success' : 'text-foreground';
                const iconBg    = item.danger ? 'bg-destructive/20' : item.highlight ? 'bg-success/15' : 'bg-muted/50';
                return (<button key={itemIdx} type="button" onClick={handleClick} disabled={!isInteractive} className={`w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors ${itemIdx !== section.items.length - 1 ? 'border-b border-border' : ''} ${!isInteractive ? 'cursor-default' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                        <Icon className={`w-5 h-5 ${iconColor}`}/>
                      </div>
                      <span className={item.danger ? 'text-destructive' : 'text-foreground'}>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.value && !item.toggle && (<span className={`text-sm ${item.highlight ? 'text-success font-semibold' : item.danger ? 'text-destructive' : 'text-muted-foreground'}`}>{item.value}</span>)}
                      {item.toggle ? (<div className={`w-12 h-7 rounded-full relative transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${enabled ? 'right-1' : 'left-1'}`}></div>
                        </div>) : (<ChevronRight className="w-5 h-5 text-muted-foreground"/>)}
                    </div>
                  </button>);
            })}
            </div>
          </div>))}

        <div className="text-center text-muted-foreground text-xs">
          <p>Excellent Susu v1.0.0</p>
          <p className="mt-1">© 2026 All rights reserved</p>
        </div>
      </div>

      {dialog === 'password' && (<SettingsDialog title="Change Password" onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <PwField label="Current password" value={pw.current} onChange={(v) => setPw(p => ({ ...p, current: v }))}/>
            <PwField label="New password" value={pw.next} onChange={(v) => setPw(p => ({ ...p, next: v }))}/>
            <PwField label="Confirm new password" value={pw.confirm} onChange={(v) => setPw(p => ({ ...p, confirm: v }))}/>
            {pwError && <p className="text-destructive text-sm">{pwError}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setDialog(null)} className="flex-1 bg-card border border-border py-3 rounded-xl text-foreground">
                Cancel
              </button>
              <button type="button" onClick={submitPasswordChange} disabled={pwLoading} className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed">
                {pwLoading ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </div>
        </SettingsDialog>)}

      {dialog === '2fa' && (<SettingsDialog title="Two-Factor Authentication" onClose={() => setDialog(null)}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              2FA adds a one-time code from your phone on top of your password. It is not yet available
              in this version — enable it via Firebase Console → Authentication → Multi-factor auth in
              the meantime.
            </p>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <span className="text-foreground">2FA status</span>
              <span className="text-muted-foreground font-semibold">Not available</span>
            </div>
            <button type="button" onClick={() => setDialog(null)} className="w-full bg-card border border-border py-3 rounded-xl text-foreground">
              Close
            </button>
          </div>
        </SettingsDialog>)}


      {dialog === 'language' && (<SettingsDialog title="Choose Language" onClose={() => setDialog(null)}>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm mb-3">
              Pick the language the app should use for labels and notifications.
            </p>
            {LANGUAGES.map(lang => {
                const active = settings.language === lang.code;
                return (<button key={lang.code} type="button" onClick={() => { updateSetting('language', lang.code); setDialog(null); toast.success(`Language set to ${lang.label}`); }} className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-colors ${active ? 'border-primary/40 bg-primary/10' : 'border-border bg-input-background hover:bg-muted/30'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <span className={`font-bold ${active ? 'text-primary' : 'text-foreground'}`}>{lang.label}</span>
                  </div>
                  {active && <span className="text-primary text-sm font-bold">Selected</span>}
                </button>);
            })}
          </div>
        </SettingsDialog>)}

      {dialog === 'currency' && (<SettingsDialog title="Choose Currency" onClose={() => setDialog(null)}>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm mb-3">
              Pick the currency to display contributions and payouts in.
            </p>
            {CURRENCIES.map(cur => {
                const active = settings.currency === cur.code;
                return (<button key={cur.code} type="button" onClick={() => { updateSetting('currency', cur.code); setDialog(null); toast.success(`Currency set to ${cur.label}`); }} className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-colors ${active ? 'border-primary/40 bg-primary/10' : 'border-border bg-input-background hover:bg-muted/30'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${active ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-foreground'}`}>
                      {cur.symbol}
                    </div>
                    <div>
                      <p className={`font-bold ${active ? 'text-primary' : 'text-foreground'}`}>{cur.label}</p>
                      <p className="text-muted-foreground text-xs">{cur.code}</p>
                    </div>
                  </div>
                  {active && <span className="text-primary text-sm font-bold">Selected</span>}
                </button>);
            })}
          </div>
        </SettingsDialog>)}

      {dialog === 'push-denied' && (<SettingsDialog title="Notifications Blocked" onClose={() => setDialog(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <BellOff className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5"/>
              <p className="text-foreground">
                Your browser has blocked notifications for this site. To enable push notifications,
                open your browser's site settings and allow notifications for this page, then return
                and try again.
              </p>
            </div>
            <button type="button" onClick={() => setDialog(null)} className="w-full bg-card border border-border py-3 rounded-xl text-foreground">
              Got it
            </button>
          </div>
        </SettingsDialog>)}

      {dialog === 'push-revoke' && (<SettingsDialog title="Disable Push Notifications" onClose={() => setDialog(null)}>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Browsers don't allow apps to remove notification permission programmatically.
              To stop push notifications, go to your browser's site settings and revoke the
              notification permission for this site.
            </p>
            <button type="button" onClick={() => setDialog(null)} className="w-full bg-card border border-border py-3 rounded-xl text-foreground">
              Close
            </button>
          </div>
        </SettingsDialog>)}

      {dialog === 'import' && (<SettingsDialog title="Import Data" onClose={() => { setDialog(null); setImportError(null); }}>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Paste a JSON backup exported from this app. Replaces local data — make a backup first if you
              are not sure.
            </p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} placeholder='{"users":[…],"payments":[…],…}' className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground font-mono text-xs"/>
            {importError && <p className="text-destructive">{importError}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => { setDialog(null); setImportError(null); }} className="flex-1 bg-card border border-border py-3 rounded-xl text-foreground">
                Cancel
              </button>
              <button type="button" onClick={handleImport} className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl">
                Import
              </button>
            </div>
          </div>
        </SettingsDialog>)}
    </div>);
}
function SettingsDialog({ title, onClose, children }) {
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50 flex-shrink-0">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted/80 transition-colors">
            <X className="w-4 h-4 text-muted-foreground"/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>);
}
function PwField({ label, value, onChange }) {
    return (<div>
      <label className="text-xs font-medium text-foreground/70 mb-1.5 block">{label}</label>
      <input type="password" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground" autoComplete="new-password"/>
    </div>);
}

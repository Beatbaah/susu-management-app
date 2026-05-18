import { Bell, Shield, Globe, Moon, Smartphone, Database, Download, Upload, Trash2, ChevronRight, Lock, Key, AlertCircle, X, } from 'lucide-react';
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { validatePassword } from '../validation/authRules';
import { changePassword } from '../services/authService';
import { toast, confirmToast } from '../utils/toast';
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
    const { settings, updateSetting, payments, users, groups, schedule, auditLogs, resetAllData, setUsers, setPayments, setGroups, setSchedule, } = useAppContext();
    const [dialog, setDialog] = useState(null);
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
            if (Array.isArray(parsed.users))
                setUsers(parsed.users);
            if (Array.isArray(parsed.payments))
                setPayments(parsed.payments);
            if (Array.isArray(parsed.groups))
                setGroups(parsed.groups);
            if (Array.isArray(parsed.schedule))
                setSchedule(parsed.schedule);
            setDialog(null);
            setImportText('');
            toast.success('Import successful');
        }
        catch (e) {
            setImportError('Invalid backup file. Expecting JSON exported from this app.');
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
    const handleReset = async () => {
        const ok = await confirmToast({
            title: 'Reset all local data?',
            description: 'You will be signed out and demo data restored. This cannot be undone.',
            confirmLabel: 'Reset',
            destructive: true,
        });
        if (!ok)
            return;
        resetAllData();
        toast.success('All data reset');
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
    // "Active sessions" in demo mode is the current browser (1). With Firebase Auth
    // this would query the user's MFA factors / multi-device tokens.
    const activeSessionsCount = 1;
    const settingsSections = [
        {
            title: 'Notifications',
            items: [
                { icon: Bell, label: 'Payment Reminders', key: 'notifPaymentReminders', toggle: true },
                { icon: Bell, label: 'Payout Alerts', key: 'notifPayoutAlerts', toggle: true },
                { icon: Bell, label: 'Group Chat', key: 'notifGroupChat', toggle: true },
                { icon: Bell, label: 'Defaulter Alerts', key: 'notifDefaulterAlerts', toggle: true },
            ]
        },
        {
            title: 'Security',
            items: [
                { icon: Lock, label: 'Change Password', action: () => setDialog('password') },
                { icon: Key, label: 'Two-Factor Authentication', value: settings.twoFA ? 'Enabled' : 'Disabled', action: () => setDialog('2fa') },
                { icon: Shield, label: 'Biometric Login', key: 'biometricLogin', toggle: true },
                { icon: Smartphone, label: 'Active Sessions', value: `${activeSessionsCount} device${activeSessionsCount === 1 ? '' : 's'}`, action: () => setDialog('sessions') },
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
        {
            title: 'Data Management',
            items: [
                { icon: Download, label: 'Export Data', action: exportData },
                { icon: Upload, label: 'Import Data', action: () => setDialog('import') },
                { icon: Database, label: 'Backup Settings', action: exportData },
                { icon: Trash2, label: 'Clear Cache', action: clearCache, danger: true },
            ]
        }
    ];
    return (<div className="pb-28">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4">
        <h1 className="text-xl sm:text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-muted-foreground text-sm mb-6">Manage your app preferences and security</p>

        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5"/>
            <div>
              <p className="text-primary text-sm mb-1">Security Recommendation</p>
              <p className="text-primary/80 text-xs">
                Enable two-factor authentication for enhanced account security.
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
                return (<button key={itemIdx} type="button" onClick={handleClick} disabled={!isInteractive} className={`w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors ${itemIdx !== section.items.length - 1 ? 'border-b border-border' : ''} ${!isInteractive ? 'cursor-default' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.danger ? 'bg-destructive/20' : 'bg-muted/50'}`}>
                        <Icon className={`w-5 h-5 ${item.danger ? 'text-destructive' : 'text-foreground'}`}/>
                      </div>
                      <span className={item.danger ? 'text-destructive' : 'text-foreground'}>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.value && !item.toggle && (<span className="text-muted-foreground text-sm">{item.value}</span>)}
                      {item.toggle ? (<div className={`w-12 h-7 rounded-full relative transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${enabled ? 'right-1' : 'left-1'}`}></div>
                        </div>) : (<ChevronRight className="w-5 h-5 text-muted-foreground"/>)}
                    </div>
                  </button>);
            })}
            </div>
          </div>))}

        <div className="mb-6">
          <h4 className="text-muted-foreground text-sm mb-3 px-2">Danger Zone</h4>
          <div className="bg-card rounded-2xl border border-destructive/50 overflow-hidden">
            <button type="button" onClick={handleReset} className="w-full flex items-center justify-between p-4 hover:bg-destructive/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-destructive/20 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-destructive"/>
                </div>
                <div className="text-left">
                  <p className="text-destructive">Reset All Data</p>
                  <p className="text-destructive/70 text-xs">Sign out and restore demo data</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-destructive"/>
            </button>
          </div>
        </div>

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
              <button type="button" onClick={submitPasswordChange} disabled={pwLoading} className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl disabled:opacity-60">
                {pwLoading ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </div>
        </SettingsDialog>)}

      {dialog === '2fa' && (<SettingsDialog title="Two-Factor Authentication" onClose={() => setDialog(null)}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Adds a one-time code from your phone in addition to your password. Strongly recommended for
              accounts that can confirm payments or manage payouts.
            </p>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <span className="text-foreground">2FA status</span>
              <span className={settings.twoFA ? 'text-success font-bold' : 'text-destructive font-bold'}>
                {settings.twoFA ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setDialog(null)} className="flex-1 bg-card border border-border py-3 rounded-xl text-foreground">
                Close
              </button>
              <button type="button" onClick={() => {
                updateSetting('twoFA', !settings.twoFA);
                setDialog(null);
                toast.success(settings.twoFA ? '2FA disabled' : '2FA enabled');
            }} className={`flex-1 py-3 rounded-xl ${settings.twoFA ? 'bg-destructive/20 text-destructive' : 'bg-primary text-primary-foreground'}`}>
                {settings.twoFA ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        </SettingsDialog>)}

      {dialog === 'sessions' && (<SettingsDialog title="Active Sessions" onClose={() => setDialog(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Devices currently signed in to this account.</p>
            <div className="rounded-xl bg-muted/30 p-3">
              <p className="text-foreground font-bold">This browser</p>
              <p className="text-xs text-muted-foreground mt-1">
                {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'Unknown device'}
              </p>
              <p className="text-xs text-success mt-2">Current session</p>
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

      {dialog === 'import' && (<SettingsDialog title="Import Data" onClose={() => { setDialog(null); setImportError(null); }}>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Paste a JSON backup exported from this app. Replaces local data — make a backup first if you
              are not sure.
            </p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} placeholder='{"users":[…],"payments":[…],…}' className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground font-mono text-xs"/>
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
    return (<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-3xl border border-border w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted/50">
            <X className="w-5 h-5 text-muted-foreground"/>
          </button>
        </div>
        {children}
      </div>
    </div>);
}
function PwField({ label, value, onChange }) {
    return (<div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <input type="password" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground" autoComplete="new-password"/>
    </div>);
}

import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, Lock, Smartphone, Landmark, ShieldCheck, Loader2, AlertTriangle, Phone, Building2, } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { renderReceiptDocument } from '../../services/receiptService';
import { fmt } from '../../utils/helpers';
const MOMO_PROVIDERS = [
    { id: 'MTN MoMo', label: 'MTN MoMo', channel: 'momo', tone: 'text-yellow-500' },
    { id: 'Telecel Cash', label: 'Telecel Cash', channel: 'momo', tone: 'text-red-500' },
    { id: 'AT Money', label: 'AT Money', channel: 'momo', tone: 'text-purple-500' },
];
const BANK_PROVIDERS = [
    { id: 'GCB Bank', label: 'GCB Bank', channel: 'bank', tone: 'text-success' },
    { id: 'Ecobank', label: 'Ecobank', channel: 'bank', tone: 'text-orange-500' },
    { id: 'Fidelity', label: 'Fidelity', channel: 'bank', tone: 'text-primary' },
    { id: 'Stanbic', label: 'Stanbic', channel: 'bank', tone: 'text-cyan-400' },
    { id: 'CalBank', label: 'CalBank', channel: 'bank', tone: 'text-pink-400' },
    { id: 'Other Bank', label: 'Other bank', channel: 'bank', tone: 'text-muted-foreground' },
];
export function PayModal({ group, user, onClose }) {
    const { recordPayment } = useAppContext();
    const [channel, setChannel] = useState('momo');
    const [provider, setProvider] = useState(MOMO_PROVIDERS[0]);
    const [account, setAccount] = useState(extractAccount(user, MOMO_PROVIDERS[0]));
    const [phase, setPhase] = useState('form');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [countdown, setCountdown] = useState(45);
    const timersRef = useRef([]);
    const submittingRef = useRef(false);
    const amount = Number(group?.contributionAmount || group?.contribution) || 0;
    const providers = channel === 'momo' ? MOMO_PROVIDERS : BANK_PROVIDERS;
    useEffect(() => () => { timersRef.current.forEach(t => window.clearTimeout(t)); }, []);
    const selectChannel = (c) => {
        setChannel(c);
        const list = c === 'momo' ? MOMO_PROVIDERS : BANK_PROVIDERS;
        const next = list[0];
        setProvider(next);
        setAccount(extractAccount(user, next));
    };
    const selectProvider = (p) => {
        setProvider(p);
        setAccount(extractAccount(user, p, account));
    };
    const sendToHubtel = () => {
        if (submittingRef.current) return;
        setError(null);
        if (!account.trim()) {
            setError(channel === 'momo' ? 'Enter your mobile-money number.' : 'Enter your account number.');
            return;
        }
        submittingRef.current = true;
        setPhase('sending');
        // 1. App → Hubtel API request (simulated, ~700ms)
        timersRef.current.push(window.setTimeout(() => setPhase('awaiting'), 700));
        // 2. Hubtel pushes a prompt to the user's phone. User enters PIN.
        //    For demo, simulate confirmation after ~4s.
        timersRef.current.push(window.setTimeout(() => {
            const result = recordPayment({
                memberId: user.id,
                userId: user.id,
                groupId: group.id,
                amount,
                method: provider.id,
                round: group.currentRound,
                dueDate: group.nextPayout || undefined,
            });
            submittingRef.current = false;
            if (!result?.ok || !result.payment) {
                setError(result?.message || 'Hubtel reported a failure. Try again.');
                setPhase('failed');
                return;
            }
            setSuccess({ ref: result.payment.ref || result.payment.id, payment: result.payment });
            setPhase('success');
        }, 4000));
        // 3. Tick a visible countdown while awaiting PIN
        setCountdown(45);
        const interval = window.setInterval(() => {
            setCountdown(c => (c > 0 ? c - 1 : 0));
        }, 1000);
        timersRef.current.push(interval);
    };
    const reset = () => {
        timersRef.current.forEach(t => window.clearTimeout(t));
        timersRef.current = [];
        submittingRef.current = false;
        setPhase('form');
        setError(null);
    };
    // ── Render ────────────────────────────────────────────────────────────
    return (<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={phase === 'form' || phase === 'failed' ? onClose : undefined}>
      <div className="bg-card border border-border w-full sm:max-w-md max-h-[95vh] sm:rounded-3xl rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {(phase === 'form' || phase === 'failed') && (<button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-foreground flex items-center justify-center backdrop-blur-md transition-colors">
            <X className="w-4 h-4"/>
          </button>)}

        {/* HERO */}
        <div className="relative">
          <div className="h-28 bg-gradient-to-br from-primary via-primary/85 to-primary/55 relative overflow-hidden">
            <div className=""/>
            <div className="absolute -bottom-12 -left-6 w-40 h-40 rounded-full bg-border blur-3xl"/>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.18),transparent_60%)]"/>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground px-6">
              <p className="eyebrow text-foreground/75">Amount due</p>
              <p className="text-3xl font-bold mt-1">{fmt(amount)}</p>
              <p className="text-foreground/70 text-xs mt-0.5">
                {group?.groupName || group?.name} · Round #{group?.currentRound || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Body — varies by phase */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {phase === 'form' && (<Form channel={channel} providers={providers} provider={provider} account={account} error={error} onChannelChange={selectChannel} onProviderChange={selectProvider} onAccountChange={setAccount} onPay={sendToHubtel} amount={amount}/>)}

          {phase === 'sending' && (<CenteredState icon={<Loader2 className="w-7 h-7 animate-spin"/>} tone="text-primary" title="Sending request to Hubtel…" body={`Securely contacting ${provider.label}.`}/>)}

          {phase === 'awaiting' && (<AwaitingPin provider={provider} account={account} amount={amount} countdown={countdown} onCancel={reset}/>)}

          {phase === 'success' && success && (<SuccessPanel amount={amount} reference={success.ref} onDone={onClose} onReceipt={() => { renderReceiptDocument(success.payment, user, group); onClose(); }}/>)}

          {phase === 'failed' && (<FailurePanel message={error || 'The payment could not be completed.'} onRetry={reset} onCancel={onClose}/>)}
        </div>
      </div>
    </div>);
}
// ── Subcomponents ──────────────────────────────────────────────────────
function Form({ channel, providers, provider, account, error, amount, onChannelChange, onProviderChange, onAccountChange, onPay, }) {
    return (<>
      {/* Channel tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-2xl mb-5">
        <ChannelTab active={channel === 'momo'} icon={<Smartphone className="w-4 h-4"/>} label="Mobile Money" onClick={() => onChannelChange('momo')}/>
        <ChannelTab active={channel === 'bank'} icon={<Landmark className="w-4 h-4"/>} label="Bank Transfer" onClick={() => onChannelChange('bank')}/>
      </div>

      {/* Provider grid */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
          {channel === 'momo' ? 'Choose network' : 'Choose bank'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {providers.map(p => {
            const active = provider.id === p.id;
            const Icon = channel === 'momo' ? Smartphone : Building2;
            return (<button type="button" key={p.id} onClick={() => onProviderChange(p)} className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all text-left ${active
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border bg-input-background hover:border-border/80'}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-primary' : p.tone}`}/>
                <span className={`text-xs font-bold text-center px-1 ${active ? 'text-primary' : 'text-foreground'}`}>
                  {p.label}
                </span>
              </button>);
        })}
        </div>
      </div>

      {/* Account input */}
      <div className="mb-4">
        <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2 block">
          {channel === 'momo' ? 'Mobile-money number' : 'Account number'}
        </label>
        <div className="relative">
          {channel === 'momo'
            ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            : <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>}
          <input type="text" value={account} onChange={(e) => onAccountChange(e.target.value)} placeholder={channel === 'momo' ? '0244 123 456' : '1234567890123'} className="w-full pl-10 pr-3 py-3 bg-card border-2 border-border rounded-xl text-foreground" inputMode={channel === 'momo' ? 'tel' : 'numeric'}/>
        </div>
      </div>

      {/* Hubtel notice */}
      <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3 mb-3 text-primary text-xs">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="font-bold">Powered by Hubtel</p>
          <p className="opacity-80 mt-0.5 leading-relaxed">
            {channel === 'momo'
            ? 'A secure prompt will be sent to your phone. Enter your wallet PIN to approve.'
            : 'You will be redirected to confirm the bank transfer through Hubtel checkout.'}
          </p>
        </div>
      </div>

      {error && (<p className="text-destructive text-sm mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4"/> {error}
        </p>)}

      <button type="button" onClick={onPay} disabled={!account.trim()} className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${account.trim()
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30'
            : 'bg-muted text-muted-foreground'}`}>
        <Lock className="w-4 h-4"/>
        Pay {fmt(amount)} securely
      </button>
    </>);
}
function ChannelTab({ active, icon, label, onClick }) {
    return (<button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all text-sm font-bold ${active
            ? 'bg-card border border-border shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'}`}>
      {icon}
      {label}
    </button>);
}
function CenteredState({ icon, tone, title, body, children, }) {
    return (<div className="py-8 text-center">
      <div className={`w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 ${tone}`}>
        {icon}
      </div>
      <p className="text-foreground font-bold text-lg">{title}</p>
      {body && <p className="text-muted-foreground text-sm mt-1">{body}</p>}
      {children}
    </div>);
}
function AwaitingPin({ provider, account, amount, countdown, onCancel, }) {
    return (<div className="py-4">
      <div className="text-center mb-5">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping"/>
          <div className="absolute inset-2 rounded-full bg-primary/25"/>
          <div className="absolute inset-0 flex items-center justify-center">
            <Phone className="w-10 h-10 text-primary"/>
          </div>
        </div>
        <p className="text-foreground font-bold text-lg mb-1">Check your phone</p>
        <p className="text-muted-foreground text-sm">
          We just sent a prompt to <span className="text-foreground font-bold">{account}</span> via {provider.label}.
          Enter your PIN to authorize.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-input-background p-4 mb-4 space-y-3">
        <Step done label="1. Request sent to Hubtel"/>
        <Step active label="2. Awaiting your PIN" hint={`${countdown}s`}/>
        <Step pending label="3. Confirming payment"/>
      </div>

      <div className="text-center mb-4 text-xs text-muted-foreground">
        Amount: <span className="text-foreground font-bold">{fmt(amount)}</span>
      </div>

      <button type="button" onClick={onCancel} className="w-full py-3 rounded-2xl border border-border text-foreground hover:bg-muted/20 transition-colors">
        Cancel
      </button>
    </div>);
}
function Step({ label, done, active, pending, hint, }) {
    return (<div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-success text-foreground'
            : active ? 'bg-primary text-foreground'
                : 'bg-muted text-muted-foreground'}`}>
        {done ? <CheckCircle2 className="w-3.5 h-3.5"/>
            : active ? <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                : <span className="w-1.5 h-1.5 rounded-full bg-current"/>}
      </div>
      <div className="flex-1 flex items-center justify-between">
        <p className={`text-sm ${done || active ? 'text-foreground' : 'text-muted-foreground'} ${pending ? 'opacity-60' : ''}`}>
          {label}
        </p>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>);
}
function SuccessPanel({ amount, reference, onDone, onReceipt, }) {
    return (<div className="py-6 text-center">
      <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-8 h-8 text-success"/>
      </div>
      <p className="text-foreground font-bold text-xl mb-1">Payment received</p>
      <p className="text-muted-foreground text-sm mb-4">
        Your {fmt(amount)} contribution was approved.
      </p>
      <div className="inline-block bg-muted/40 rounded-xl px-4 py-2 font-mono text-xs text-foreground mb-6">
        {reference}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 bg-card border border-border py-3 rounded-2xl text-foreground">
          Done
        </button>
        <button type="button" onClick={onReceipt} className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-bold">
          View receipt
        </button>
      </div>
    </div>);
}
function FailurePanel({ message, onRetry, onCancel, }) {
    return (<div className="py-6 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-destructive"/>
      </div>
      <p className="text-foreground font-bold text-xl mb-1">Payment failed</p>
      <p className="text-muted-foreground text-sm mb-6">{message}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 bg-card border border-border py-3 rounded-2xl text-foreground">
          Cancel
        </button>
        <button type="button" onClick={onRetry} className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-bold">
          Try again
        </button>
      </div>
    </div>);
}
// ── helpers ───────────────────────────────────────────────────────────
function extractAccount(user, provider, current) {
    // If the user has a saved MoMo number and channel is momo, prefill it.
    if (provider.channel === 'momo') {
        const bm = String(user?.bankMomo || '');
        const phoneMatch = bm.match(/(\d{8,12})/);
        if (phoneMatch)
            return phoneMatch[1];
        if (user?.phone)
            return user.phone;
    }
    else {
        // Bank — strip non-digits if existing input looks like a phone
        if (current && /^[0-9\s]+$/.test(current))
            return current;
    }
    return current || '';
}

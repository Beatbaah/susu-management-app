import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, Smartphone, Landmark, Loader2, AlertTriangle, Building2, CreditCard, Clock } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { renderReceiptDocument } from '../../services/receiptService';
import { fmt } from '../../utils/helpers';

const MOMO_PROVIDERS = [
    { id: 'MTN MoMo',     label: 'MTN MoMo',     channel: 'momo', tone: 'text-yellow-500' },
    { id: 'Telecel Cash', label: 'Telecel Cash',  channel: 'momo', tone: 'text-red-500'    },
    { id: 'AT Money',     label: 'AT Money',      channel: 'momo', tone: 'text-purple-500' },
];
const BANK_PROVIDERS = [
    { id: 'GCB Bank',   label: 'GCB Bank',   channel: 'bank', tone: 'text-success'           },
    { id: 'Ecobank',    label: 'Ecobank',    channel: 'bank', tone: 'text-orange-500'         },
    { id: 'Fidelity',   label: 'Fidelity',   channel: 'bank', tone: 'text-primary'            },
    { id: 'Stanbic',    label: 'Stanbic',    channel: 'bank', tone: 'text-cyan-400'           },
    { id: 'CalBank',    label: 'CalBank',    channel: 'bank', tone: 'text-pink-400'           },
    { id: 'Other Bank', label: 'Other bank', channel: 'bank', tone: 'text-muted-foreground'   },
];

export function PayModal({ group, user, onClose }) {
    const { recordPayment } = useAppContext();
    const [channel, setChannel]   = useState('momo');
    const [provider, setProvider] = useState(MOMO_PROVIDERS[0]);
    const [account, setAccount]   = useState(extractAccount(user, MOMO_PROVIDERS[0]));
    const [phase, setPhase]     = useState('form');
    const [error, setError]     = useState(null);
    const [success, setSuccess] = useState(null);
    const timersRef    = useRef([]);
    const submittingRef = useRef(false);

    const amount    = Number(group?.contributionAmount || group?.contribution) || 0;
    const providers = channel === 'momo' ? MOMO_PROVIDERS : BANK_PROVIDERS;

    useEffect(() => () => { timersRef.current.forEach(t => window.clearTimeout(t)); }, []);

    const selectChannel = (c) => {
        setChannel(c);
        const list = c === 'momo' ? MOMO_PROVIDERS : BANK_PROVIDERS;
        const next = list[0];
        setProvider(next);
        setAccount(extractAccount(user, next));
        setError(null);
    };
    const selectProvider = (p) => {
        setProvider(p);
        setAccount(extractAccount(user, p, account));
    };

    // ── MoMo flow ──────────────────────────────────────────────────────
    const submitMoMo = () => {
        if (submittingRef.current) return;
        setError(null);
        if (!account.trim()) { setError('Enter your mobile-money number.'); return; }
        submittingRef.current = true;
        setPhase('sending');
        timersRef.current.push(window.setTimeout(() => {
            const result = recordPayment({
                memberId: user.id, userId: user.id,
                groupId: group.id, amount,
                method: provider.id,
                round: group.currentRound,
                dueDate: group.nextPayout || undefined,
            });
            submittingRef.current = false;
            if (!result?.ok || !result.payment) {
                setError(result?.message || 'Could not record your payment. Try again.');
                setPhase('failed');
                return;
            }
            setSuccess({ ref: result.payment.ref || result.payment.id, payment: result.payment });
            setPhase('success');
        }, 800));
    };

    // ── Bank transfer flow (manual, pending confirmation) ──────────────
    const submitBankTransfer = () => {
        if (submittingRef.current) return;
        setError(null);
        if (!account.trim()) { setError('Enter your account number.'); return; }
        submittingRef.current = true;
        setPhase('bank-submitting');

        timersRef.current.push(window.setTimeout(() => {
            const result = recordPayment({
                memberId: user.id, userId: user.id,
                groupId: group.id, amount,
                method: provider.id,
                round: group.currentRound,
                dueDate: group.nextPayout || undefined,
                bankAccount: account.trim(),
            });
            submittingRef.current = false;
            if (!result?.ok || !result.payment) {
                setError(result?.message || 'Could not record your payment. Try again.');
                setPhase('failed');
                return;
            }
            setSuccess({ ref: result.payment.ref || result.payment.id, payment: result.payment });
            setPhase('bank-success');
        }, 900));
    };

    const reset = () => {
        timersRef.current.forEach(t => window.clearTimeout(t));
        timersRef.current = [];
        submittingRef.current = false;
        setPhase('form');
        setError(null);
    };

    const handlePay = () => channel === 'momo' ? submitMoMo() : submitBankTransfer();
    const isCloseable = ['form', 'failed', 'success', 'bank-success'].includes(phase);

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
            onClick={isCloseable ? onClose : undefined}
        >
            <div
                className="bg-card border border-border w-full sm:max-w-md max-h-[95vh] sm:rounded-3xl rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {isCloseable && (
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-foreground flex items-center justify-center backdrop-blur-md transition-colors">
                        <X className="w-4 h-4"/>
                    </button>
                )}

                {/* Hero */}
                <div className="relative">
                    <div className="h-28 bg-gradient-to-br from-primary via-primary/85 to-primary/55 relative overflow-hidden">
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

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5">
                    {phase === 'form' && (
                        <Form
                            channel={channel} providers={providers} provider={provider}
                            account={account} error={error} amount={amount} group={group}
                            onChannelChange={selectChannel} onProviderChange={selectProvider}
                            onAccountChange={setAccount} onPay={handlePay}
                        />
                    )}
                    {phase === 'sending' && (
                        <CenteredState icon={<Loader2 className="w-7 h-7 animate-spin"/>} tone="text-primary"
                            title="Recording payment…" body="Please wait a moment."/>
                    )}
                    {phase === 'bank-submitting' && (
                        <CenteredState icon={<Loader2 className="w-7 h-7 animate-spin"/>} tone="text-primary"
                            title="Recording your payment…" body="Please wait a moment."/>
                    )}
                    {phase === 'success' && success && (
                        <SuccessPanel amount={amount} reference={success.ref} provider={provider}
                            onDone={onClose} onReceipt={() => { renderReceiptDocument(success.payment, user, group); onClose(); }}/>
                    )}
                    {phase === 'bank-success' && success && (
                        <BankSuccessPanel amount={amount} reference={success.ref} provider={provider}
                            onDone={onClose} onReceipt={() => { renderReceiptDocument(success.payment, user, group); onClose(); }}/>
                    )}
                    {phase === 'failed' && (
                        <FailurePanel message={error || 'The payment could not be completed.'} onRetry={reset} onCancel={onClose}/>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Form ───────────────────────────────────────────────────────────────────────
function Form({ channel, providers, provider, account, error, amount, group, onChannelChange, onProviderChange, onAccountChange, onPay }) {
    const isMomo = channel === 'momo';
    return (
        <>
            {/* Channel tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-2xl mb-5">
                <ChannelTab active={isMomo}  icon={<Smartphone className="w-4 h-4"/>} label="Mobile Money"  onClick={() => onChannelChange('momo')}/>
                <ChannelTab active={!isMomo} icon={<Landmark   className="w-4 h-4"/>} label="Bank Transfer" onClick={() => onChannelChange('bank')}/>
            </div>

            {/* Provider grid */}
            <div className="mb-4">
                <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
                    {isMomo ? 'Choose network' : 'Choose bank'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                    {providers.map(p => {
                        const active = provider.id === p.id;
                        const Icon   = isMomo ? Smartphone : Building2;
                        return (
                            <button type="button" key={p.id} onClick={() => onProviderChange(p)}
                                className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all ${active ? 'border-primary/50 bg-primary/10' : 'border-border bg-input-background hover:border-border/80'}`}>
                                <Icon className={`w-5 h-5 ${active ? 'text-primary' : p.tone}`}/>
                                <span className={`text-xs font-bold text-center px-1 ${active ? 'text-primary' : 'text-foreground'}`}>
                                    {p.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Account input */}
            <div className="mb-4">
                <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2 block">
                    {isMomo ? 'Mobile-money number' : 'Your account number'}
                </label>
                <div className="relative">
                    {isMomo
                        ? <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                        : <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>}
                    <input type="text" value={account}
                        onChange={e => onAccountChange(e.target.value)}
                        placeholder={isMomo ? '0244 123 456' : '1234567890123'}
                        className="w-full pl-10 pr-3 py-3 bg-card border-2 border-border rounded-xl text-foreground"
                        inputMode={isMomo ? 'tel' : 'numeric'}/>
                </div>
            </div>

            {/* Notice */}
            {isMomo ? (
                <div className="flex items-start gap-2 bg-muted/40 border border-border rounded-xl p-3 mb-3 text-xs">
                    <Smartphone className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground"/>
                    <div>
                        <p className="font-bold text-foreground">Mobile money payment</p>
                        <p className="text-muted-foreground mt-0.5 leading-relaxed">
                            Submit your payment details below. Staff will verify and confirm your payment.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-muted/40 border border-border rounded-xl p-3 mb-3 text-xs">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0"/>
                        <p className="font-bold text-foreground">Manual bank transfer</p>
                    </div>
                    {(group?.bankName || group?.accountName || group?.accountNumber) ? (
                        <div className="bg-card border border-border rounded-lg p-2.5 mb-2 space-y-1">
                            {group.bankName    && <p className="text-foreground"><span className="text-muted-foreground">Bank:</span> <span className="font-semibold">{group.bankName}</span></p>}
                            {group.accountName && <p className="text-foreground"><span className="text-muted-foreground">Account name:</span> <span className="font-semibold">{group.accountName}</span></p>}
                            {group.accountNumber && <p className="text-foreground"><span className="text-muted-foreground">Account no.:</span> <span className="font-bold font-mono tracking-wide">{group.accountNumber}</span></p>}
                        </div>
                    ) : (
                        <p className="text-warning font-semibold mb-2">Contact your administrator for the group's bank details.</p>
                    )}
                    <p className="text-muted-foreground leading-relaxed">Transfer the exact amount and submit below. Staff will verify and confirm.</p>
                </div>
            )}

            {error && (
                <p className="text-destructive text-sm mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4"/> {error}
                </p>
            )}

            <button type="button" onClick={onPay} disabled={!account.trim()}
                className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${account.trim() ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30' : 'bg-muted text-muted-foreground'}`}>
                <CheckCircle2 className="w-4 h-4"/>
                {isMomo ? `Submit ${fmt(amount)} payment` : 'Submit bank payment'}
            </button>
        </>
    );
}

function ChannelTab({ active, icon, label, onClick }) {
    return (
        <button type="button" onClick={onClick}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all text-sm font-bold ${active ? 'bg-card border border-border shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {icon}{label}
        </button>
    );
}

function CenteredState({ icon, tone, title, body, children }) {
    return (
        <div className="py-8 text-center">
            <div className={`w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 ${tone}`}>
                {icon}
            </div>
            <p className="text-foreground font-bold text-lg">{title}</p>
            {body && <p className="text-muted-foreground text-sm mt-1">{body}</p>}
            {children}
        </div>
    );
}


function SuccessPanel({ amount, reference, provider, onDone, onReceipt }) {
    return (
        <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary"/>
            </div>
            <p className="text-foreground font-bold text-xl mb-1">Payment submitted</p>
            <p className="text-muted-foreground text-sm mb-4">
                Your {fmt(amount)} {provider?.label} payment has been recorded and is pending staff confirmation.
            </p>
            <div className="bg-muted/30 border border-border rounded-xl p-3 mb-5 text-left space-y-2 text-xs">
                <div className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0"/>
                    <span>Payment record created</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0"/>
                    <span>Awaiting staff confirmation — you'll be notified once confirmed</span>
                </div>
            </div>
            <div className="inline-block bg-muted/40 rounded-xl px-4 py-2 font-mono text-xs text-foreground mb-6">
                Ref: {reference}
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={onDone} className="flex-1 bg-card border border-border py-3 rounded-2xl text-foreground">Done</button>
                <button type="button" onClick={onReceipt} className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-bold">View receipt</button>
            </div>
        </div>
    );
}

function BankSuccessPanel({ amount, reference, provider, onDone, onReceipt }) {
    return (
        <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary"/>
            </div>
            <p className="text-foreground font-bold text-xl mb-1">Transfer submitted</p>
            <p className="text-muted-foreground text-sm mb-4">
                Your {fmt(amount)} bank transfer via <span className="text-foreground font-medium">{provider.label}</span> has been recorded and is pending staff confirmation.
            </p>
            <div className="bg-muted/30 border border-border rounded-xl p-3 mb-5 text-left space-y-2 text-xs">
                <div className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0"/>
                    <span>Payment record created</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0"/>
                    <span>Awaiting staff verification — you'll be notified once confirmed</span>
                </div>
            </div>
            <div className="inline-block bg-muted/40 rounded-xl px-4 py-2 font-mono text-xs text-foreground mb-6">
                Ref: {reference}
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={onDone} className="flex-1 bg-card border border-border py-3 rounded-2xl text-foreground">Done</button>
                <button type="button" onClick={onReceipt} className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-bold">View receipt</button>
            </div>
        </div>
    );
}

function FailurePanel({ message, onRetry, onCancel }) {
    return (
        <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive"/>
            </div>
            <p className="text-foreground font-bold text-xl mb-1">Payment failed</p>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <div className="flex gap-2">
                <button type="button" onClick={onCancel} className="flex-1 bg-card border border-border py-3 rounded-2xl text-foreground">Cancel</button>
                <button type="button" onClick={onRetry} className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-bold">Try again</button>
            </div>
        </div>
    );
}

// ── helpers ────────────────────────────────────────────────────────────────────
function extractAccount(user, provider, current) {
    if (provider.channel === 'momo') {
        const bm = String(user?.bankMomo || '');
        const phoneMatch = bm.match(/(\d{8,12})/);
        if (phoneMatch) return phoneMatch[1];
        if (user?.phone) return user.phone;
    } else {
        if (current && /^[0-9\s]+$/.test(current)) return current;
    }
    return current || '';
}

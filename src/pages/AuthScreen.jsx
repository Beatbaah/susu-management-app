import React, { useEffect, useRef, useState } from 'react';
import {
    Lock, Mail, Smartphone, ArrowRight, Fingerprint, User, Phone, MapPin,
    CreditCard, Users, Upload, FileCheck, ShieldCheck, ScrollText, CheckCircle,
    Camera, RotateCcw, Eye, EyeOff, Shield, Briefcase, UserCircle2, AlertCircle,
    CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { validateLogin } from '../validation/authRules';
import { signIn, resetPassword } from '../services/authService';
import { uploadRegistrationDoc } from '../services/storageService';
import { isFirebaseConfigured } from '../utils/firebase';
import { readStore } from '../services/storage';
import { cn } from '../components/ui/utils';

// Defined outside AuthScreen so the reference is stable across renders.
// Inline component definitions cause React to unmount/remount on every render.
function FieldWrapper({ label, icon: Icon, children }) {
    return (
        <div className="space-y-1.5">
            <p className="eyebrow text-foreground/50 ml-1">{label}</p>
            <div className="relative group">
                {Icon && (
                    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 group-focus-within:text-primary transition-colors pointer-events-none"/>
                )}
                {children}
            </div>
        </div>
    );
}

const inputCls = (withIcon = true) =>
    cn(
        'h-14 bg-input-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all rounded-2xl text-foreground placeholder:text-foreground/25 outline-none w-full',
        withIcon ? 'pl-12' : 'pl-4',
    );

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_PHONE_RE = /^(\+233|0)[2-5][0-9]{8}$/;

const DEMO_ACCOUNTS = [
    { email: 'admin@excellentsusu.com',     label: 'Admin',     icon: ShieldCheck,   tone: 'text-primary' },
    { email: 'manager@excellentsusu.com',   label: 'Manager',   icon: Briefcase,     tone: 'text-yellow-400' },
    { email: 'collector@excellentsusu.com', label: 'Collector', icon: Shield,        tone: 'text-purple-400' },
    { email: 'kwame@gmail.com',             label: 'Member',    icon: UserCircle2,   tone: 'text-emerald-400' },
];

const STEPS = [
    { title: 'Profile',     icon: User },
    { title: 'Documents',   icon: Upload },
    { title: 'Verification', icon: ShieldCheck },
    { title: 'Terms',       icon: ScrollText },
];

export default function AuthScreen({ onLogin, onBio, onRegister, registrationGroups = [] }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register' | 'success'

    // ── Login fields
    const [email, setEmail]         = useState('');
    const [password, setPassword]   = useState('');
    const [showPw, setShowPw]       = useState(false);
    const [loginError, setLoginError] = useState(null);
    const [loading, setLoading]     = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent]       = useState(false);

    // ── Registration fields
    const [step, setStep] = useState(0);
    const [stepError, setStepError] = useState(null);
    const [regName, setRegName]           = useState('');
    const [regPhone, setRegPhone]         = useState('');
    const [regEmail, setRegEmail]         = useState('');
    const [regPassword, setRegPassword]   = useState('');
    const [showRegPw, setShowRegPw]       = useState(false);
    const [regAddress, setRegAddress]     = useState('');
    const [preferredGroup, setPreferredGroup] = useState('');
    const [ghanaCard, setGhanaCard]       = useState('');
    const [bankMomo, setBankMomo]         = useState('');
    const [occupation, setOccupation]     = useState('');
    const [emergencyName, setEmergencyName]   = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    const [passportPic, setPassportPic]       = useState(null);
    const [ghanaCardFront, setGhanaCardFront] = useState(null);
    const [ghanaCardBack, setGhanaCardBack]   = useState(null);
    const [liveSelfie, setLiveSelfie]         = useState(null);
    const [uploadNames, setUploadNames] = useState({ passportPic: '', ghanaCardFront: '', ghanaCardBack: '' });
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError]   = useState('');
    const [acceptedTerms, setAcceptedTerms]         = useState(false);
    const [acceptedDataPolicy, setAcceptedDataPolicy] = useState(false);

    const videoRef  = useRef(null);
    const streamRef = useRef(null);

    const biometricAllowed = (() => {
        const stored = readStore('settings', {});
        return stored?.biometricLogin !== false;
    })();

    const visibleGroups = registrationGroups.length
        ? registrationGroups.filter(g => g.listedForRegistration !== false)
        : [{ id: 'grp-market', groupName: 'Market Women Circle' }];

    useEffect(() => {
        if (!visibleGroups.length) return;
        if (!visibleGroups.some(g => String(g.id) === String(preferredGroup))) {
            setPreferredGroup(String(visibleGroups[0].id));
        }
    }, [preferredGroup, visibleGroups]);

    // ── Camera helpers
    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraActive(false);
    };
    const startCamera = async () => {
        setCameraError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setCameraActive(true);
        } catch {
            setCameraError('Camera access was denied. Allow camera permission and try again.');
        }
    };
    const captureSelfie = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        setLiveSelfie(canvas.toDataURL('image/jpeg', 0.86));
        stopCamera();
    };
    useEffect(() => stopCamera, []);

    // ── Document upload
    const readUpload = async (key, file) => {
        if (!file) return;
        const url = await uploadRegistrationDoc(`pending-${Date.now()}`, key, file);
        if (key === 'passportPic')   setPassportPic(url);
        if (key === 'ghanaCardFront') setGhanaCardFront(url);
        if (key === 'ghanaCardBack')  setGhanaCardBack(url);
        setUploadNames(prev => ({ ...prev, [key]: file.name }));
    };

    // ── Per-step validation
    const validateStep = (s = step) => {
        if (s === 0) {
            if (!regName.trim()) return 'Full name is required.';
            const cleanPhone = regPhone.replace(/[\s\-()]/g, '');
            if (!GHANA_PHONE_RE.test(cleanPhone)) return 'Enter a valid Ghana mobile number (e.g. 0244123456).';
            if (!EMAIL_RE.test(regEmail.trim())) return 'Enter a valid email address.';
            if (regPassword.length < 8) return 'Password must be at least 8 characters.';
            if (!regAddress.trim()) return 'Residential or business address is required.';
            if (!preferredGroup) return 'Please select a preferred group.';
            return null;
        }
        if (s === 1) {
            if (!passportPic)    return 'Please upload your passport photo.';
            if (!ghanaCardFront) return 'Please upload the front of your Ghana Card.';
            if (!ghanaCardBack)  return 'Please upload the back of your Ghana Card.';
            return null;
        }
        if (s === 2) {
            if (!ghanaCard.trim())      return 'Ghana Card number is required.';
            if (!bankMomo.trim())       return 'MoMo / Bank account information is required.';
            if (!occupation.trim())     return 'Occupation is required.';
            if (!emergencyName.trim())  return 'Emergency contact name is required.';
            if (!emergencyPhone.trim()) return 'Emergency contact phone is required.';
            if (!liveSelfie)            return 'Please capture a live selfie to verify your identity.';
            return null;
        }
        if (s === 3) {
            if (!acceptedTerms)      return 'You must accept the terms and conditions.';
            if (!acceptedDataPolicy) return 'You must accept the data policy.';
            return null;
        }
        return null;
    };

    const stepDone = (s) => validateStep(s) === null;
    const allDone  = () => [0, 1, 2, 3].every(s => stepDone(s));

    // ── Forgot password
    const handleForgotPassword = async () => {
        const trimmed = email.trim();
        if (!trimmed) {
            setLoginError('Enter your email address above, then click Forgot Password.');
            return;
        }
        setForgotLoading(true);
        setLoginError(null);
        const result = await resetPassword(trimmed);
        setForgotLoading(false);
        if (result.ok) {
            setForgotSent(true);
        } else {
            setLoginError(result.message);
        }
    };

    // ── Login submit
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError(null);
        setForgotSent(false);
        const v = validateLogin(email, password);
        if (!v.ok) { setLoginError(v.message); return; }
        setLoading(true);
        try {
            const result = await signIn(email, password);
            if (!result.ok) { setLoginError(result.message); return; }
            onLogin(result.user);
        } catch (err) {
            console.error('[handleLogin] unexpected error', err);
            setLoginError('Unexpected error. Check the browser console (F12) for details.');
        } finally {
            setLoading(false);
        }
    };

    // ── Registration step navigation
    const handleContinue = () => {
        const err = validateStep(step);
        if (err) { setStepError(err); return; }
        setStepError(null);
        setStep(s => s + 1);
    };
    const handleBack = () => { setStepError(null); setStep(s => Math.max(0, s - 1)); };

    // ── Registration submit
    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        const err = validateStep(3);
        if (err) { setStepError(err); return; }
        if (!allDone()) {
            const firstBad = [0, 1, 2, 3].find(s => !stepDone(s));
            setStep(firstBad);
            setStepError(validateStep(firstBad));
            return;
        }
        setLoading(true);
        const result = await onRegister?.({
            name: regName,
            fullName: regName,
            email: regEmail,
            password: regPassword,
            phone: regPhone.replace(/[\s\-()]/g, ''),
            role: 'member',
            status: 'pending',
            groupId: preferredGroup,
            ghanaCard,
            address: regAddress,
            bankMomo,
            emergencyName,
            emergencyPhone,
            occupation,
            passportPic,
            ghanaCardFront,
            ghanaCardBack,
            liveSelfie,
            acceptedTerms,
            acceptedDataPolicy,
            joinedAt: new Date().toISOString().split('T')[0],
            color: 'var(--primary)',
            streak: 0,
            badges: [],
            points: 0,
        });
        setLoading(false);
        if (result?.ok === false) {
            setStepError(result.message || 'Registration could not be submitted. Try again.');
            return;
        }
        setMode('success');
    };

    const switchToRegister = () => {
        setMode('register');
        setStep(0);
        setStepError(null);
        setLoginError(null);
        setForgotSent(false);
    };
    const switchToLogin = () => {
        setMode('login');
        setLoginError(null);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Success screen
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'success') {
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-md text-center animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 rounded-3xl bg-success/15 flex items-center justify-center mx-auto mb-6 border border-success/20">
                        <CheckCircle2 className="w-12 h-12 text-success"/>
                    </div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight mb-3">Registration Submitted</h1>
                    <p className="text-foreground/50 text-sm font-medium mb-2">
                        Your application has been received and is awaiting admin review.
                    </p>
                    <p className="text-foreground/35 text-xs mb-10">
                        You'll be notified once an administrator approves your account. This usually takes 1–2 business days.
                    </p>
                    <button
                        type="button"
                        onClick={switchToLogin}
                        className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Back to Sign In
                        <ArrowRight className="w-5 h-5"/>
                    </button>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Main card
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-5">
            <div className="w-full max-w-md z-10">

                {/* Logo + heading */}
                <div className="text-center mb-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="relative inline-flex items-center justify-center w-18 h-18 rounded-[1.75rem] bg-card mb-5 border border-border p-3 w-[4.5rem] h-[4.5rem]">
                        <img src="/logo512.png" alt="Excellent Susu" className="w-full h-full object-contain"/>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-background" aria-hidden/>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {mode === 'login' ? 'Welcome Back' : 'Request Access'}
                    </h1>
                    <p className="text-foreground/40 mt-1.5 text-sm font-medium">
                        {mode === 'login' ? 'Secure access to your financial hub' : 'Submit your member registration'}
                    </p>
                    {!isFirebaseConfigured && mode === 'login' && (
                        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full border border-yellow-400/20 bg-yellow-400/5 text-yellow-300 text-xs font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse"/>
                            Demo mode
                        </div>
                    )}
                </div>

                {/* Card */}
                <div className="bg-card border border-border backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[2rem] p-6 sm:p-8 animate-in zoom-in-95 duration-500">

                    {/* Registration step indicator */}
                    {mode === 'register' && (
                        <div className="mb-7">
                            {/* Progress bar */}
                            <div className="h-1 rounded-full bg-border mb-5 overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-500"
                                    style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                                />
                            </div>
                            <div className="flex gap-2">
                                {STEPS.map((s, i) => {
                                    const done   = i < step;
                                    const active = i === step;
                                    const locked = !done && !active && validateStep(i - 1) !== null;
                                    const StepIcon = s.icon;
                                    return (
                                        <button
                                            key={s.title}
                                            type="button"
                                            disabled={locked || (!done && !active)}
                                            onClick={() => { if (done) { setStep(i); setStepError(null); } }}
                                            className={cn(
                                                'flex-1 rounded-2xl border px-2 py-2.5 text-center transition-colors',
                                                active  ? 'border-primary/50 bg-primary/15 text-primary'
                                                : done  ? 'border-success/30 bg-success/10 text-success cursor-pointer hover:bg-success/15'
                                                        : 'border-border bg-input-background text-foreground/30 cursor-default',
                                            )}
                                        >
                                            {done
                                                ? <CheckCircle className="mx-auto mb-1 h-4 w-4"/>
                                                : <StepIcon className="mx-auto mb-1 h-4 w-4"/>
                                            }
                                            <span className="text-[10px] font-bold uppercase tracking-tight leading-none">{s.title}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-foreground/30 font-medium mt-3 text-right">
                                Step {step + 1} of {STEPS.length}
                            </p>
                        </div>
                    )}

                    {/* ── Login form ─────────────────────────────────────────── */}
                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-5">
                            <FieldWrapper label="Email Address" icon={Mail}>
                                <Input
                                    type="email"
                                    placeholder="name@company.com"
                                    className={inputCls()}
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setLoginError(null); setForgotSent(false); }}
                                    autoComplete="email"
                                    required
                                />
                            </FieldWrapper>

                            <FieldWrapper label="Password" icon={Lock}>
                                <Input
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className={cn(inputCls(), 'pr-12')}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setLoginError(null); }}
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(s => !s)}
                                    aria-label={showPw ? 'Hide password' : 'Show password'}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/35 hover:text-foreground/70 transition-colors"
                                >
                                    {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                            </FieldWrapper>

                            <div className="flex justify-end -mt-2">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={forgotLoading}
                                    className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors disabled:opacity-50"
                                >
                                    {forgotLoading ? 'Sending…' : 'Forgot password?'}
                                </button>
                            </div>

                            {forgotSent && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-success/10 border border-success/20 text-success text-xs font-medium">
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                    Password reset email sent. Check your inbox.
                                </div>
                            )}

                            {loginError && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                    {loginError}
                                </div>
                            )}

                            {/* Demo accounts */}
                            {!isFirebaseConfigured && (
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="h-px flex-1 bg-border"/>
                                        <span className="eyebrow text-foreground/30">Demo accounts</span>
                                        <div className="h-px flex-1 bg-border"/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {DEMO_ACCOUNTS.map(demo => {
                                            const Icon = demo.icon;
                                            const active = email === demo.email;
                                            return (
                                                <button
                                                    key={demo.email}
                                                    type="button"
                                                    onClick={() => { setEmail(demo.email); setPassword('demo1234'); setLoginError(null); setForgotSent(false); }}
                                                    className={cn(
                                                        'flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition-all text-left',
                                                        active
                                                            ? 'border-primary/40 bg-primary/10'
                                                            : 'border-border bg-input-background hover:border-primary/30 hover:bg-accent'
                                                    )}
                                                >
                                                    <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-primary' : demo.tone)}/>
                                                    <div className="min-w-0">
                                                        <p className={cn('text-xs font-bold', active ? 'text-primary' : 'text-foreground')}>{demo.label}</p>
                                                        <p className="text-xs text-foreground/35 truncate">{demo.email.split('@')[0]}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-foreground/25 mt-2 text-center">Tap a role to autofill, then sign in.</p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
                            >
                                {loading
                                    ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-primary/30 border-t-white rounded-full animate-spin"/><span>Signing in…</span></span>
                                    : <span className="flex items-center gap-2">Sign In<ArrowRight className="w-5 h-5"/></span>
                                }
                            </Button>

                            {biometricAllowed && (
                                <div className="pt-2 border-t border-border">
                                    <p className="text-center eyebrow text-foreground/30 mb-3">Or continue with</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full h-12 border-border bg-input-background hover:bg-accent hover:border-border transition-all rounded-xl group"
                                        onClick={onBio}
                                    >
                                        <Fingerprint className="w-4 h-4 mr-2 text-primary group-hover:scale-110 transition-transform"/>
                                        <span className="font-bold text-xs">Biometric Login</span>
                                    </Button>
                                </div>
                            )}
                        </form>
                    )}

                    {/* ── Registration steps ─────────────────────────────────── */}
                    {mode === 'register' && (
                        <form onSubmit={handleRegisterSubmit} className="space-y-5">

                            {/* Step error banner */}
                            {stepError && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium animate-in slide-in-from-top-2 duration-200">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                    {stepError}
                                </div>
                            )}

                            {/* Step 0 — Profile */}
                            {step === 0 && (
                                <>
                                    <FieldWrapper label="Full Name" icon={User}>
                                        <Input type="text" placeholder="Kwame Asante" className={inputCls()} value={regName} onChange={e => { setRegName(e.target.value); setStepError(null); }} required/>
                                    </FieldWrapper>
                                    <FieldWrapper label="Phone Number" icon={Phone}>
                                        <Input type="tel" placeholder="0244 001 122" className={inputCls()} value={regPhone} onChange={e => { setRegPhone(e.target.value); setStepError(null); }} required/>
                                    </FieldWrapper>
                                    <FieldWrapper label="Email Address" icon={Mail}>
                                        <Input type="email" placeholder="name@company.com" className={inputCls()} value={regEmail} onChange={e => { setRegEmail(e.target.value); setStepError(null); }} required/>
                                    </FieldWrapper>
                                    <FieldWrapper label="Password" icon={Lock}>
                                        <Input
                                            type={showRegPw ? 'text' : 'password'}
                                            placeholder="At least 8 characters"
                                            className={cn(inputCls(), 'pr-12')}
                                            value={regPassword}
                                            onChange={e => { setRegPassword(e.target.value); setStepError(null); }}
                                            autoComplete="new-password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowRegPw(s => !s)}
                                            aria-label={showRegPw ? 'Hide password' : 'Show password'}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/35 hover:text-foreground/70 transition-colors"
                                        >
                                            {showRegPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                        </button>
                                    </FieldWrapper>
                                    <FieldWrapper label="Residential / Business Address" icon={MapPin}>
                                        <Input type="text" placeholder="Madina Market, Accra" className={inputCls()} value={regAddress} onChange={e => { setRegAddress(e.target.value); setStepError(null); }} required/>
                                    </FieldWrapper>
                                    <FieldWrapper label="Preferred Group" icon={Users}>
                                        <select
                                            className={cn(inputCls(), 'w-full appearance-none')}
                                            value={preferredGroup}
                                            onChange={e => { setPreferredGroup(e.target.value); setStepError(null); }}
                                            required
                                        >
                                            {visibleGroups.map(g => (
                                                <option key={g.id} value={g.id} className="bg-card">
                                                    {g.groupName || g.name}
                                                </option>
                                            ))}
                                        </select>
                                    </FieldWrapper>
                                </>
                            )}

                            {/* Step 1 — Documents */}
                            {step === 1 && (
                                <div className="space-y-3 rounded-2xl border border-border bg-input-background p-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <FileCheck className="h-5 w-5 text-primary flex-shrink-0"/>
                                        <div>
                                            <p className="eyebrow text-foreground/50">Document Upload</p>
                                            <p className="text-xs text-foreground/35 mt-0.5">Upload clear photos of all three documents.</p>
                                        </div>
                                    </div>
                                    {[
                                        { key: 'passportPic',    label: 'Passport Photo',    value: uploadNames.passportPic },
                                        { key: 'ghanaCardFront', label: 'Ghana Card — Front', value: uploadNames.ghanaCardFront },
                                        { key: 'ghanaCardBack',  label: 'Ghana Card — Back',  value: uploadNames.ghanaCardBack },
                                    ].map(doc => (
                                        <label
                                            key={doc.key}
                                            className={cn(
                                                'flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm transition-colors',
                                                doc.value
                                                    ? 'border-success/30 bg-success/8 text-success'
                                                    : 'border-border bg-card text-foreground/60 hover:bg-accent',
                                            )}
                                        >
                                            <span className="flex items-center gap-3 min-w-0">
                                                {doc.value
                                                    ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-success"/>
                                                    : <Upload className="h-4 w-4 flex-shrink-0 text-primary"/>
                                                }
                                                <span className="truncate font-medium">{doc.value || doc.label}</span>
                                            </span>
                                            <span className="eyebrow text-foreground/35 flex-shrink-0">
                                                {doc.value ? 'Done' : 'Upload'}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="sr-only"
                                                onChange={e => { readUpload(doc.key, e.target.files?.[0]); setStepError(null); }}
                                            />
                                        </label>
                                    ))}
                                </div>
                            )}

                            {/* Step 2 — Verification */}
                            {step === 2 && (
                                <>
                                    <FieldWrapper label="Ghana Card Number" icon={CreditCard}>
                                        <Input type="text" placeholder="GHA-123456789-0" className={inputCls()} value={ghanaCard} onChange={e => { setGhanaCard(e.target.value); setStepError(null); }} required/>
                                    </FieldWrapper>
                                    <FieldWrapper label="MoMo / Bank Account" icon={Smartphone}>
                                        <Input type="text" placeholder="0244 001 122 — MTN MoMo" className={inputCls()} value={bankMomo} onChange={e => { setBankMomo(e.target.value); setStepError(null); }} required/>
                                    </FieldWrapper>
                                    <FieldWrapper label="Occupation / Business" icon={User}>
                                        <Input type="text" placeholder="Market trader" className={inputCls()} value={occupation} onChange={e => { setOccupation(e.target.value); setStepError(null); }} required/>
                                    </FieldWrapper>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FieldWrapper label="Emergency Contact" icon={User}>
                                            <Input type="text" placeholder="Abena Mensah" className={inputCls()} value={emergencyName} onChange={e => { setEmergencyName(e.target.value); setStepError(null); }} required/>
                                        </FieldWrapper>
                                        <FieldWrapper label="Contact Phone" icon={Phone}>
                                            <Input type="tel" placeholder="0200 000 000" className={inputCls()} value={emergencyPhone} onChange={e => { setEmergencyPhone(e.target.value); setStepError(null); }} required/>
                                        </FieldWrapper>
                                    </div>

                                    {/* Live selfie */}
                                    <div className="rounded-2xl border border-border bg-input-background p-5 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Camera className="h-5 w-5 text-primary flex-shrink-0"/>
                                            <div>
                                                <p className="eyebrow text-foreground/50">Live Selfie</p>
                                                <p className="text-xs text-foreground/35 mt-0.5">Capture a live selfie to verify your identity.</p>
                                            </div>
                                        </div>

                                        {liveSelfie ? (
                                            <div className="space-y-3">
                                                <img src={liveSelfie} alt="Live selfie" className="h-48 w-full rounded-2xl border border-success/20 object-cover"/>
                                                <Button type="button" variant="outline" className="w-full rounded-2xl border-border bg-card text-foreground hover:bg-accent" onClick={() => { setLiveSelfie(null); startCamera(); }}>
                                                    <RotateCcw className="h-4 w-4 mr-2"/>Retake
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="relative h-44 overflow-hidden rounded-2xl border border-border bg-black/30">
                                                    {cameraActive
                                                        ? <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
                                                        : <div className="flex h-full flex-col items-center justify-center gap-2 text-foreground/25">
                                                              <Camera className="h-10 w-10"/>
                                                              <span className="text-xs">Camera preview</span>
                                                          </div>
                                                    }
                                                </div>
                                                {cameraError && (
                                                    <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{cameraError}</p>
                                                )}
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <Button type="button" variant="outline" className="rounded-2xl border-border bg-card text-foreground hover:bg-accent" onClick={startCamera}>
                                                        <Camera className="h-4 w-4 mr-2"/>Start Camera
                                                    </Button>
                                                    <Button type="button" className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90" disabled={!cameraActive} onClick={() => { captureSelfie(); setStepError(null); }}>
                                                        <CheckCircle className="h-4 w-4 mr-2"/>Capture
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Step 3 — Terms */}
                            {step === 3 && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-border bg-input-background p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <ScrollText className="h-5 w-5 text-primary flex-shrink-0"/>
                                            <p className="eyebrow text-foreground/50">Terms & Conditions</p>
                                        </div>
                                        <div className="space-y-2.5 text-sm leading-6 text-foreground/50">
                                            <p>I agree to make contributions on schedule according to the selected group rules.</p>
                                            <p>I understand that missed contributions may delay payouts and trigger reminder notices or account review.</p>
                                            <p>I confirm that my identity details and uploaded documents are accurate and may be reviewed by administrators.</p>
                                        </div>
                                    </div>
                                    <label className={cn(
                                        'flex items-start gap-3 rounded-2xl border p-4 text-sm cursor-pointer transition-colors',
                                        acceptedTerms ? 'border-primary/30 bg-primary/8 text-foreground' : 'border-border bg-input-background text-foreground/60 hover:bg-accent'
                                    )}>
                                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary flex-shrink-0" checked={acceptedTerms} onChange={e => { setAcceptedTerms(e.target.checked); setStepError(null); }}/>
                                        <span>I accept the susu group terms, payout rules, and member responsibilities.</span>
                                    </label>
                                    <label className={cn(
                                        'flex items-start gap-3 rounded-2xl border p-4 text-sm cursor-pointer transition-colors',
                                        acceptedDataPolicy ? 'border-primary/30 bg-primary/8 text-foreground' : 'border-border bg-input-background text-foreground/60 hover:bg-accent'
                                    )}>
                                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary flex-shrink-0" checked={acceptedDataPolicy} onChange={e => { setAcceptedDataPolicy(e.target.checked); setStepError(null); }}/>
                                        <span>I consent to storage and review of my registration data and documents for verification purposes.</span>
                                    </label>
                                </div>
                            )}

                            {/* Navigation buttons */}
                            <div className="flex gap-3 pt-1">
                                {step > 0 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-14 flex-1 rounded-2xl border-border bg-input-background text-foreground hover:bg-accent"
                                        onClick={handleBack}
                                    >
                                        Back
                                    </Button>
                                )}
                                {step < STEPS.length - 1 ? (
                                    <Button
                                        type="button"
                                        className="h-14 flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl active:scale-[0.98] shadow-lg shadow-primary/20"
                                        onClick={handleContinue}
                                    >
                                        Continue <ArrowRight className="w-5 h-5 ml-1"/>
                                    </Button>
                                ) : (
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="h-14 flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-60"
                                    >
                                        {loading
                                            ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-primary/30 border-t-white rounded-full animate-spin"/><span>Submitting…</span></span>
                                            : <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5"/>Submit Registration</span>
                                        }
                                    </Button>
                                )}
                            </div>
                        </form>
                    )}
                </div>

                {/* Toggle login/register */}
                <div className="text-center mt-5 animate-in fade-in slide-in-from-bottom-2 duration-1000">
                    <p className="text-sm text-foreground/45 font-medium">
                        {mode === 'register' ? 'Already approved? ' : "Don't have an account? "}
                        <button
                            type="button"
                            onClick={mode === 'register' ? switchToLogin : switchToRegister}
                            className="text-primary font-bold hover:text-primary/80 transition-colors"
                        >
                            {mode === 'register' ? 'Sign In' : 'Request access'}
                        </button>
                    </p>
                </div>
            </div>

            <p className="mt-8 pb-6 eyebrow text-foreground/20 z-10">
                Excellent Susu · Powered by Plush Enterprise
            </p>
        </div>
    );
}

import React, { useEffect, useRef, useState } from 'react';
import {
    Lock, Mail, ArrowRight, User, Upload, ShieldCheck, ScrollText, CheckCircle,
    Eye, EyeOff, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { validateLogin, validatePassword } from '../validation/authRules';
import { signIn, resetPassword, getLockoutState } from '../services/authService';
import { cn } from '../components/ui/utils';
import { FieldWrapper, inputCls } from './auth/authHelpers';
import { StepProfile } from './auth/StepProfile';
import { StepDocuments } from './auth/StepDocuments';
import { StepVerification } from './auth/StepVerification';
import { StepTerms } from './auth/StepTerms';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_PHONE_RE = /^(\+233|0)[2-5][0-9]{8}$/;
const GHANA_CARD_RE = /^GHA-[0-9]{9}-[0-9]$/i;

const STEPS = [
    { title: 'Profile',     icon: User },
    { title: 'Documents',   icon: Upload },
    { title: 'Verification', icon: ShieldCheck },
    { title: 'Terms',       icon: ScrollText },
];

export default function AuthScreen({ onLogin, onRegister, registrationGroups = [] }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register' | 'success'

    // ── Login fields
    const [email, setEmail]         = useState('');
    const [password, setPassword]   = useState('');
    const [showPw, setShowPw]       = useState(false);
    const [loginError, setLoginError] = useState(null);
    const [loading, setLoading]     = useState(false);
    const [lockoutMs, setLockoutMs] = useState(0);   // ms remaining in lockout
    const [attemptsLeft, setAttemptsLeft] = useState(null); // null = no warning yet
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent]       = useState(false);
    const [forgotHint, setForgotHint]       = useState(false);

    // ── Registration fields
    const [step, setStep] = useState(0);
    const [stepError, setStepError] = useState(null);
    const [regName, setRegName]           = useState('');
    const [regPhone, setRegPhone]         = useState('');
    const [regEmail, setRegEmail]         = useState('');
    const [regPassword, setRegPassword]   = useState('');
    const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
    const [showRegPw, setShowRegPw]       = useState(false);
    const [showRegPwConfirm, setShowRegPwConfirm] = useState(false);
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


    const visibleGroups = registrationGroups.filter(g => g.listedForRegistration !== false);

    useEffect(() => {
        if (!visibleGroups.length) { setPreferredGroup(''); return; }
        if (!visibleGroups.some(g => String(g.id) === String(preferredGroup))) {
            setPreferredGroup(String(visibleGroups[0].id));
        }
    }, [preferredGroup, visibleGroups]);

    // Detect invite link: ?invite=groupId → switch to register and pre-select group
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const inviteId = params.get('invite');
            if (inviteId && mode === 'login') {
                setMode('register');
                setStep(0);
                setPreferredGroup(String(inviteId));
            }
        } catch {}
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Camera helpers
    const stopCamera = () => {
        // Stop every track on the active stream — this is what releases the
        // browser's camera indicator. Do it first before clearing refs.
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        // Clear srcObject so the browser releases the camera indicator immediately.
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraActive(false);
    };
    const startCamera = async () => {
        // Stop existing tracks inline — do NOT call stopCamera() here because
        // stopCamera sets cameraActive=false, which unmounts the <video> element,
        // leaving videoRef.current null by the time getUserMedia resolves.
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        // Stop camera BEFORE setting state — avoids a re-render race where the
        // video element unmounts before stopCamera can clear srcObject/tracks.
        stopCamera();
        setLiveSelfie(dataUrl);
    };
    useEffect(() => stopCamera, []);

    // Tick the lockout countdown every second.
    useEffect(() => {
        if (lockoutMs <= 0) return;
        const id = setInterval(() => {
            setLockoutMs(prev => {
                const next = prev - 1000;
                if (next <= 0) { clearInterval(id); return 0; }
                return next;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [lockoutMs > 0]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Document upload
    // Store the File object now; the actual upload to Firebase Storage happens at
    // submission time in memberService so all files land under registration/{uid}/.
    const readUpload = (key, file) => {
        if (!file) return;
        if (key === 'passportPic')    setPassportPic(file);
        if (key === 'ghanaCardFront') setGhanaCardFront(file);
        if (key === 'ghanaCardBack')  setGhanaCardBack(file);
        setUploadNames(prev => ({ ...prev, [key]: file.name }));
    };

    // ── Per-step validation
    const validateStep = (s = step) => {
        if (s === 0) {
            if (!regName.trim()) return 'Full name is required.';
            const cleanPhone = regPhone.replace(/[\s\-()]/g, '');
            if (!GHANA_PHONE_RE.test(cleanPhone)) return 'Enter a valid Ghana mobile number (e.g. 0244123456).';
            if (!EMAIL_RE.test(regEmail.trim())) return 'Enter a valid email address.';
            const pwCheck = validatePassword(regPassword);
            if (!pwCheck.ok) return pwCheck.message;
            if (regPassword !== regPasswordConfirm) return 'Passwords do not match.';
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
            if (!ghanaCard.trim()) return 'Ghana Card number is required.';
            if (!GHANA_CARD_RE.test(ghanaCard.trim())) return 'Enter a valid Ghana Card number (e.g. GHA-123456789-0).';
            if (!bankMomo.trim()) return 'MoMo / Bank account information is required.';
            if (!occupation.trim()) return 'Occupation is required.';
            if (!emergencyName.trim()) return 'Emergency contact name is required.';
            const cleanEmergencyPhone = emergencyPhone.replace(/[\s\-()]/g, '');
            if (!GHANA_PHONE_RE.test(cleanEmergencyPhone)) return 'Enter a valid Ghana mobile number for the emergency contact.';
            if (!liveSelfie) return 'Please capture a live selfie to verify your identity.';
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
            setForgotHint(true);
            return;
        }
        setForgotHint(false);
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

        // Check lockout before even hitting the network.
        const ls = getLockoutState(email.trim().toLowerCase());
        if (ls.locked) {
            setLockoutMs(ls.remainingMs);
            return;
        }

        const v = validateLogin(email, password);
        if (!v.ok) { setLoginError(v.message); return; }
        setLoading(true);
        try {
            const result = await signIn(email, password);
            if (!result.ok) {
                setLoginError(result.message);
                if (result.locked) setLockoutMs(getLockoutState(email.trim().toLowerCase()).remainingMs);
                if (result.attemptsLeft != null) setAttemptsLeft(result.attemptsLeft);
                return;
            }
            setAttemptsLeft(null);
            setLockoutMs(0);
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
        if (step === 2) stopCamera(); // ensure camera is off when leaving verification step
        setStep(s => s + 1);
    };
    const handleBack = () => {
        setStepError(null);
        if (step === 2) stopCamera(); // kill camera if user backs out of the verification step
        setStep(s => Math.max(0, s - 1));
    };

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
        try {
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
                color: '#6491DE',
                streak: 0,
                badges: [],
                points: 0,
            });
            if (result?.ok === false) {
                setStepError(result.message || 'Registration could not be submitted. Try again.');
                return;
            }
            stopCamera();
            setMode('success');
        } catch {
            setStepError('An unexpected error occurred. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const switchToRegister = () => {
        setMode('register');
        setStep(0);
        setStepError(null);
        setLoginError(null);
        setForgotSent(false);
        setRegPassword('');
        setRegPasswordConfirm('');
    };
    const switchToLogin = () => {
        stopCamera();
        setMode('login');
        setLoginError(null);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Success screen
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'success') {
        const selectedGroup = visibleGroups.find(g => String(g.id) === String(preferredGroup));
        return (
            <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 overflow-y-auto">
                {/* Background atmosphere */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
                    <div className="absolute -top-40 -right-20 w-[520px] h-[520px] rounded-full bg-success/[0.10] blur-[100px]"/>
                    <div className="absolute -bottom-24 -left-16 w-[400px] h-[400px] rounded-full bg-primary/[0.08] blur-[90px]"/>
                </div>

                <div className="w-full max-w-md z-10 animate-in zoom-in-95 fade-in duration-500 py-10">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-lg overflow-hidden">
                            <img src="/logo.jpg" alt="Excellent Susu" className="w-full h-full object-cover"/>
                        </div>
                    </div>

                    {/* Success icon */}
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-success/15 border-2 border-success/25 flex items-center justify-center mx-auto mb-5">
                            <CheckCircle2 className="w-10 h-10 text-success"/>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">Application Submitted!</h1>
                        <p className="text-foreground/55 text-sm leading-relaxed">
                            Your registration has been received and is pending admin review.
                        </p>
                    </div>

                    {/* Summary card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 mb-4 space-y-3">
                        <p className="eyebrow text-muted-foreground">Submission summary</p>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground/55">Name</span>
                            <span className="font-semibold text-foreground">{regName}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground/55">Email</span>
                            <span className="font-semibold text-foreground truncate max-w-[60%]">{regEmail}</span>
                        </div>
                        {selectedGroup && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground/55">Preferred group</span>
                                <span className="font-semibold text-foreground">{selectedGroup.groupName || selectedGroup.name}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground/55">Status</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wide">
                                Pending Review
                            </span>
                        </div>
                    </div>

                    {/* What happens next */}
                    <div className="bg-primary/8 border border-primary/20 rounded-2xl p-4 mb-6">
                        <p className="text-xs font-semibold text-foreground mb-2.5">What happens next</p>
                        <div className="space-y-2">
                            {[
                                'An administrator will review your documents and information.',
                                'You\'ll receive an email once your account is approved.',
                                'Approval typically takes 1–2 business days.',
                                'Once approved, sign in with the email and password you set.',
                            ].map((step, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {i + 1}
                                    </span>
                                    <p className="text-xs text-foreground/55 leading-relaxed">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={switchToLogin}
                        className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all"
                    >
                        Back to Sign In
                        <ArrowRight className="w-5 h-5"/>
                    </button>

                    <p className="text-center text-xs text-foreground/30 mt-5">
                        Questions? Contact us at <span className="text-foreground/50">+233 55 365 4738</span>
                    </p>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Main card
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className={cn(
            "bg-background text-foreground flex flex-col items-center",
            // html/body have overflow:hidden globally; the auth screen must own its scroll
            mode === 'register'
                ? "h-screen overflow-y-auto px-5 pt-8 pb-12"
                : "h-screen overflow-hidden justify-center p-5",
        )}>
            {/* Background atmosphere — stronger in light mode, softer in dark */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden select-none" aria-hidden>
                <div className="absolute -top-40 -right-20 w-[520px] h-[520px] rounded-full bg-primary/[0.16] dark:bg-primary/[0.08] blur-[100px]"/>
                <div className="absolute -bottom-24 -left-16 w-[400px] h-[400px] rounded-full bg-primary/[0.12] dark:bg-primary/[0.06] blur-[90px]"/>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-primary/[0.06] dark:hidden blur-[130px]"/>
            </div>

            <div className="w-full max-w-md z-10">

                {/* Logo + heading */}
                <div className="text-center mb-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="relative inline-flex items-center justify-center w-[5rem] h-[5rem] rounded-[1.5rem] mb-5 border-2 border-white/20 shadow-[0_4px_24px_rgba(7,61,127,0.18),0_1px_6px_rgba(7,61,127,0.10)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.50)] overflow-hidden">
                        <img src="/logo.jpg" alt="Excellent Susu" className="w-full h-full object-cover"/>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-background" aria-hidden/>
                    </div>
                    <h1 className="text-[1.75rem] font-bold tracking-tight text-foreground leading-tight">
                        {mode === 'login' ? 'Welcome Back' : 'Request Access'}
                    </h1>
                    <p className="text-foreground/50 dark:text-foreground/40 mt-1.5 text-sm font-medium">
                        {mode === 'login' ? 'Secure access to your financial hub' : 'Submit your member registration'}
                    </p>
                </div>

                {/* Card */}
                <div className="relative bg-card border border-border/80 rounded-[1.75rem] p-6 sm:p-7 shadow-[0_8px_40px_rgba(7,61,127,0.14),0_2px_8px_rgba(7,61,127,0.08)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-500 overflow-hidden">
                    {/* Top accent line */}
                    <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30 rounded-t-[1.75rem]" aria-hidden/>

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
                                            <span className="app-badge uppercase">{s.title}</span>
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
                                    onChange={e => {
                                        setEmail(e.target.value);
                                        setLoginError(null);
                                        setForgotSent(false);
                                        setForgotHint(false);
                                        setAttemptsLeft(null);
                                        // Restore lockout if this email is already locked.
                                        const ls = getLockoutState(e.target.value.trim().toLowerCase());
                                        setLockoutMs(ls.locked ? ls.remainingMs : 0);
                                    }}
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

                            <div className="flex flex-col items-end gap-1.5 -mt-2">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={forgotLoading}
                                    className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors disabled:opacity-50"
                                >
                                    {forgotLoading ? 'Sending…' : 'Forgot password?'}
                                </button>
                                {forgotHint && (
                                    <p className="text-xs text-amber-500/80 font-medium text-right animate-in slide-in-from-top-1 duration-200">
                                        Enter your email above, then tap Forgot password.
                                    </p>
                                )}
                            </div>

                            {forgotSent && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-success/10 border border-success/20 text-success text-xs font-medium">
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                    Password reset email sent. Check your inbox.
                                </div>
                            )}

                            {/* Lockout countdown */}
                            {lockoutMs > 0 && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                    <span>
                                        Account locked. Try again in{' '}
                                        <span className="font-bold tabular-nums">
                                            {String(Math.floor(lockoutMs / 60000)).padStart(2, '0')}:{String(Math.floor((lockoutMs % 60000) / 1000)).padStart(2, '0')}
                                        </span>
                                    </span>
                                </div>
                            )}

                            {/* Attempts-remaining warning (2 or 1 left) */}
                            {lockoutMs <= 0 && attemptsLeft != null && attemptsLeft <= 2 && attemptsLeft > 0 && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-medium">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                    {attemptsLeft === 1
                                        ? 'Last attempt before a 15-minute lockout.'
                                        : `${attemptsLeft} attempts remaining before a 15-minute lockout.`}
                                </div>
                            )}

                            {/* General login error */}
                            {lockoutMs <= 0 && loginError && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                    {loginError}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading || lockoutMs > 0}
                                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(100,145,222,0.40)] hover:shadow-[0_6px_24px_rgba(100,145,222,0.50)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                            >
                                {loading
                                    ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-primary/30 border-t-white rounded-full animate-spin"/><span>Signing in…</span></span>
                                    : lockoutMs > 0
                                        ? <span>Locked</span>
                                        : <span className="flex items-center gap-2">Sign In<ArrowRight className="w-5 h-5"/></span>
                                }
                            </Button>

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
                                <StepProfile
                                    regName={regName} setRegName={setRegName}
                                    regPhone={regPhone} setRegPhone={setRegPhone}
                                    regEmail={regEmail} setRegEmail={setRegEmail}
                                    regPassword={regPassword} setRegPassword={setRegPassword}
                                    regPasswordConfirm={regPasswordConfirm} setRegPasswordConfirm={setRegPasswordConfirm}
                                    showRegPw={showRegPw} setShowRegPw={setShowRegPw}
                                    showRegPwConfirm={showRegPwConfirm} setShowRegPwConfirm={setShowRegPwConfirm}
                                    regAddress={regAddress} setRegAddress={setRegAddress}
                                    preferredGroup={preferredGroup} setPreferredGroup={setPreferredGroup}
                                    visibleGroups={visibleGroups}
                                    setStepError={setStepError}
                                />
                            )}

                            {/* Step 1 — Documents */}
                            {step === 1 && (
                                <StepDocuments uploadNames={uploadNames} readUpload={readUpload} setStepError={setStepError}/>
                            )}

                            {/* Step 2 — Verification */}
                            {step === 2 && (
                                <StepVerification
                                    ghanaCard={ghanaCard} setGhanaCard={setGhanaCard}
                                    bankMomo={bankMomo} setBankMomo={setBankMomo}
                                    occupation={occupation} setOccupation={setOccupation}
                                    emergencyName={emergencyName} setEmergencyName={setEmergencyName}
                                    emergencyPhone={emergencyPhone} setEmergencyPhone={setEmergencyPhone}
                                    liveSelfie={liveSelfie} setLiveSelfie={setLiveSelfie}
                                    cameraActive={cameraActive} cameraError={cameraError}
                                    videoRef={videoRef}
                                    startCamera={startCamera} stopCamera={stopCamera} captureSelfie={captureSelfie}
                                    setStepError={setStepError}
                                />
                            )}

                            {/* Step 3 — Terms */}
                            {step === 3 && (
                                <StepTerms
                                    acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms}
                                    acceptedDataPolicy={acceptedDataPolicy} setAcceptedDataPolicy={setAcceptedDataPolicy}
                                    setStepError={setStepError}
                                />
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
                                        className="h-14 flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
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
                    <p className="text-sm text-foreground/50 font-medium">
                        {mode === 'register' ? 'Already approved? ' : "Don't have an account? "}
                        <button
                            type="button"
                            onClick={mode === 'register' ? switchToLogin : switchToRegister}
                            className="text-primary font-bold hover:text-primary/80 transition-colors underline-offset-2 hover:underline"
                        >
                            {mode === 'register' ? 'Sign In' : 'Request access'}
                        </button>
                    </p>
                </div>
            </div>

            <p className={cn("eyebrow text-foreground/30 z-10", mode === 'register' ? "mt-6 pb-2" : "mt-8 pb-6")}>
                Excellent Susu · Powered by Plush Enterprise
            </p>
        </div>
    );
}

import { Lock, Mail, User, Phone, MapPin, Users, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../components/ui/utils';
import { Input } from '../../components/ui/input';
import { FieldWrapper, inputCls } from './authHelpers';

const GHANA_PHONE_RE = /^(\+233|0)[2-5][0-9]{8}$/;

export function StepProfile({
    regName, setRegName,
    regPhone, setRegPhone,
    regEmail, setRegEmail,
    regPassword, setRegPassword,
    regPasswordConfirm, setRegPasswordConfirm,
    showRegPw, setShowRegPw,
    showRegPwConfirm, setShowRegPwConfirm,
    regAddress, setRegAddress,
    preferredGroup, setPreferredGroup,
    visibleGroups,
    setStepError,
}) {
    const onField = (setter) => (e) => { setter(e.target.value); setStepError(null); };
    return (
        <>
            <FieldWrapper label="Full Name" icon={User}>
                <Input type="text" placeholder="Kwame Asante" className={inputCls()} value={regName} onChange={onField(setRegName)} required/>
            </FieldWrapper>
            <FieldWrapper label="Phone Number" icon={Phone}>
                <Input type="tel" placeholder="0244 001 122" className={inputCls()} value={regPhone} onChange={onField(setRegPhone)} required/>
            </FieldWrapper>
            <FieldWrapper label="Email Address" icon={Mail}>
                <Input type="email" placeholder="name@company.com" className={inputCls()} value={regEmail} onChange={onField(setRegEmail)} required/>
            </FieldWrapper>
            <FieldWrapper label="Password" icon={Lock}>
                <Input
                    type={showRegPw ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    className={cn(inputCls(), 'pr-12')}
                    value={regPassword}
                    onChange={onField(setRegPassword)}
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
            {regPassword.length > 0 && (
                <div className="flex gap-3 px-1">
                    {[
                        { ok: regPassword.length >= 8, label: '8+ chars' },
                        { ok: /[A-Z]/.test(regPassword), label: 'Uppercase' },
                        { ok: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(regPassword), label: 'Number/symbol' },
                    ].map(r => (
                        <span key={r.label} className={cn('flex items-center gap-1 text-xs font-medium transition-colors', r.ok ? 'text-success' : 'text-foreground/30')}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', r.ok ? 'bg-success' : 'bg-foreground/20')}/>
                            {r.label}
                        </span>
                    ))}
                </div>
            )}
            <FieldWrapper label="Confirm Password" icon={Lock}>
                <Input
                    type={showRegPwConfirm ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    className={cn(inputCls(), 'pr-12', regPasswordConfirm.length > 0 && regPassword !== regPasswordConfirm ? 'border-destructive/60 focus:border-destructive/80' : '')}
                    value={regPasswordConfirm}
                    onChange={onField(setRegPasswordConfirm)}
                    autoComplete="new-password"
                    required
                />
                <button
                    type="button"
                    onClick={() => setShowRegPwConfirm(s => !s)}
                    aria-label={showRegPwConfirm ? 'Hide password' : 'Show password'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/35 hover:text-foreground/70 transition-colors"
                >
                    {showRegPwConfirm ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
            </FieldWrapper>
            {regPasswordConfirm.length > 0 && regPassword !== regPasswordConfirm && (
                <p className="text-xs text-destructive font-medium px-1 -mt-2">Passwords do not match.</p>
            )}
            <FieldWrapper label="Residential / Business Address" icon={MapPin}>
                <Input type="text" placeholder="Madina Market, Accra" className={inputCls()} value={regAddress} onChange={onField(setRegAddress)} required/>
            </FieldWrapper>
            <FieldWrapper label="Preferred Group" icon={Users}>
                {visibleGroups.length === 0 ? (
                    <div className={cn(inputCls(), 'flex items-center text-muted-foreground text-sm cursor-not-allowed opacity-60')}>
                        No groups open for registration yet
                    </div>
                ) : (
                    <select
                        className={cn(inputCls(), 'w-full appearance-none')}
                        value={preferredGroup}
                        onChange={e => { setPreferredGroup(e.target.value); setStepError(null); }}
                        required
                    >
                        <option value="">Select a group…</option>
                        {visibleGroups.map(g => (
                            <option key={g.id} value={g.id} className="bg-card">
                                {g.groupName || g.name}
                            </option>
                        ))}
                    </select>
                )}
            </FieldWrapper>
        </>
    );
}

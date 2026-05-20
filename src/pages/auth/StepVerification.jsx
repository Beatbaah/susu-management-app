import { Camera, CreditCard, Phone, RotateCcw, CheckCircle, User } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { FieldWrapper, inputCls } from './authHelpers';

export function StepVerification({
    ghanaCard, setGhanaCard,
    bankMomo, setBankMomo,
    occupation, setOccupation,
    emergencyName, setEmergencyName,
    emergencyPhone, setEmergencyPhone,
    liveSelfie, setLiveSelfie,
    cameraActive, cameraError,
    videoRef,
    startCamera, stopCamera, captureSelfie,
    setStepError,
}) {
    const onField = (setter) => (e) => { setter(e.target.value); setStepError(null); };
    return (
        <>
            <FieldWrapper label="Ghana Card Number" icon={CreditCard}>
                <Input type="text" placeholder="GHA-123456789-0" className={inputCls()} value={ghanaCard} onChange={onField(setGhanaCard)} required/>
            </FieldWrapper>
            <FieldWrapper label="MoMo / Bank Account" icon={Phone}>
                <Input type="text" placeholder="0244 001 122 — MTN MoMo" className={inputCls()} value={bankMomo} onChange={onField(setBankMomo)} required/>
            </FieldWrapper>
            <FieldWrapper label="Occupation / Business" icon={User}>
                <Input type="text" placeholder="Market trader" className={inputCls()} value={occupation} onChange={onField(setOccupation)} required/>
            </FieldWrapper>
            <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrapper label="Emergency Contact" icon={User}>
                    <Input type="text" placeholder="Abena Mensah" className={inputCls()} value={emergencyName} onChange={onField(setEmergencyName)} required/>
                </FieldWrapper>
                <FieldWrapper label="Contact Phone" icon={Phone}>
                    <Input type="tel" placeholder="0200 000 000" className={inputCls()} value={emergencyPhone} onChange={onField(setEmergencyPhone)} required/>
                </FieldWrapper>
            </div>

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
    );
}

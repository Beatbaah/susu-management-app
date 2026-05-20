import { ScrollText } from 'lucide-react';
import { cn } from '../../components/ui/utils';

export function StepTerms({ acceptedTerms, setAcceptedTerms, acceptedDataPolicy, setAcceptedDataPolicy, setStepError }) {
    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-input-background p-5 max-h-[52vh] overflow-y-auto">
                <div className="flex items-center gap-3 mb-4">
                    <ScrollText className="h-5 w-5 text-primary flex-shrink-0"/>
                    <div>
                        <p className="font-bold text-foreground text-sm">Excellent Plush Susu Enterprise</p>
                        <p className="eyebrow text-foreground/40 mt-0.5">Member Terms & Conditions</p>
                    </div>
                </div>

                <div className="space-y-5 text-xs leading-5 text-foreground/60">
                    <div>
                        <p className="eyebrow text-primary mb-2 uppercase tracking-wider">Contributions & Payments</p>
                        <ul className="space-y-2">
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">1.</span><span>Members may pay ahead of schedule — advance payments are accepted and encouraged.</span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">2.</span><span>Payments must be made before <strong className="text-foreground/80">7:00 PM</strong> on your scheduled day. Payments after this time are considered late and may result in a slot penalty.</span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">3.</span><span>There are no exceptions for delays or excuses. All contributions must be made on time to maintain group integrity.</span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">4.</span><span>You will receive a payment reminder by <strong className="text-foreground/80">5:00 PM</strong> if your contribution has not been received.</span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">5.</span><span>After sending your MoMo payment, you must <strong className="text-foreground/80">confirm the transaction on the platform</strong> to alert the administrator. Unconfirmed payments will not be acknowledged.</span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">6.</span><span>Please do not call the administrator to report payments. Use the platform to confirm. Repeated calls are strongly discouraged.</span></li>
                        </ul>
                    </div>

                    <div>
                        <p className="eyebrow text-primary mb-2 uppercase tracking-wider">Cashout & Payouts</p>
                        <ul className="space-y-2">
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">7.</span><span>Cashouts must be completed by <strong className="text-foreground/80">8:00 PM</strong> on the day it is your turn.</span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">8.</span><span>A valid national ID (e.g., Ghana Card) is required before you can receive your payout.</span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">9.</span><span>You must <strong className="text-foreground/80">confirm receipt on the platform</strong> whenever you receive your cashout. Unconfirmed receipts will be escalated.</span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">10.</span><span><strong className="text-foreground/80">No cashouts are processed on Sundays.</strong></span></li>
                            <li className="flex gap-2"><span className="text-primary font-bold flex-shrink-0">11.</span><span>No advertising, personal promotions, or off-topic content is permitted in group communication channels.</span></li>
                        </ul>
                    </div>

                    <div>
                        <p className="eyebrow text-primary mb-2 uppercase tracking-wider">Defaults & Penalties</p>
                        <ul className="space-y-2">
                            <li className="flex gap-2"><span className="text-destructive font-bold flex-shrink-0">12.</span><span>If you default on payment <strong className="text-foreground/80">3 times</strong>, you will be removed from the group and replaced. You will be refunded at the end of the group cycle, less a <strong className="text-destructive">40% penalty deduction.</strong></span></li>
                            <li className="flex gap-2"><span className="text-destructive font-bold flex-shrink-0">13.</span><span><strong className="text-foreground/80">Early withdrawal:</strong> If you exit the group before your scheduled cashout, a refund will only be issued at the end of the cycle with a <strong className="text-destructive">40% deduction as penalty.</strong> This is strictly enforced.</span></li>
                            <li className="flex gap-2"><span className="text-destructive font-bold flex-shrink-0">14.</span><span><strong className="text-foreground/80">Slot demotion:</strong> If payment is delayed past 7:00 PM, your position will be dropped by 3 slots. Example: position 1 drops to position 4 upon a late payment.</span></li>
                            <li className="flex gap-2"><span className="text-destructive font-bold flex-shrink-0">15.</span><span>If you receive your cashout and <strong className="text-foreground/80">stop making contributions for 3 consecutive days</strong>, administration will no longer accept partial payments. You will have <strong className="text-foreground/80">1 week</strong> to return the full outstanding balance.</span></li>
                        </ul>
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-foreground/70 leading-5">
                        By joining Excellent Plush Susu Enterprise you agree to abide by all the above rules. Violations may result in suspension, removal, or financial penalties as described. For enquiries contact us on <strong className="text-foreground/90">+233 55 365 4738</strong>.
                    </div>
                </div>
            </div>

            <label className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-sm cursor-pointer transition-colors',
                acceptedTerms ? 'border-primary/30 bg-primary/8 text-foreground' : 'border-border bg-input-background text-foreground/60 hover:bg-accent'
            )}>
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary flex-shrink-0" checked={acceptedTerms} onChange={e => { setAcceptedTerms(e.target.checked); setStepError(null); }}/>
                <span>I have read and agree to the Excellent Plush Susu Enterprise member rules, payout terms, and penalty conditions.</span>
            </label>
            <label className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-sm cursor-pointer transition-colors',
                acceptedDataPolicy ? 'border-primary/30 bg-primary/8 text-foreground' : 'border-border bg-input-background text-foreground/60 hover:bg-accent'
            )}>
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary flex-shrink-0" checked={acceptedDataPolicy} onChange={e => { setAcceptedDataPolicy(e.target.checked); setStepError(null); }}/>
                <span>I consent to the secure storage and administrative review of my registration data, documents, and payment records for verification and compliance purposes.</span>
            </label>
        </div>
    );
}

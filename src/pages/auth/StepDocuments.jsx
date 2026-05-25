import { FileCheck, Upload, CheckCircle } from 'lucide-react';
import { cn } from '../../components/ui/utils';

const UPLOAD_FIELDS = [
    { key: 'passportPic',    label: 'Passport Photo' },
    { key: 'ghanaCardFront', label: 'Ghana Card — Front' },
    { key: 'ghanaCardBack',  label: 'Ghana Card — Back' },
];

export function StepDocuments({ uploadNames, readUpload, setStepError }) {
    return (
        <div className="space-y-3 rounded-2xl border border-border bg-input-background p-5">
            <div className="flex items-center gap-3 mb-2">
                <FileCheck className="h-5 w-5 text-primary flex-shrink-0"/>
                <div>
                    <p className="eyebrow text-foreground/50">Document Upload</p>
                    <p className="text-xs text-foreground/35 mt-0.5">Upload clear photos or PDF scans of all three documents.</p>
                </div>
            </div>
            {UPLOAD_FIELDS.map(field => {
                const uploaded = uploadNames[field.key];
                return (
                    <label
                        key={field.key}
                        className={cn(
                            'flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm transition-colors',
                            uploaded
                                ? 'border-success/30 bg-success/8 text-success'
                                : 'border-border bg-card text-foreground/60 hover:bg-accent',
                        )}
                    >
                        <span className="flex items-center gap-3 min-w-0">
                            {uploaded
                                ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-success"/>
                                : <Upload className="h-4 w-4 flex-shrink-0 text-primary"/>
                            }
                            <span className="truncate font-medium">{uploaded || field.label}</span>
                        </span>
                        <span className="eyebrow text-foreground/35 flex-shrink-0">
                            {uploaded ? 'Done' : 'Upload'}
                        </span>
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="sr-only"
                            onChange={e => { readUpload(field.key, e.target.files?.[0]); setStepError(null); }}
                        />
                    </label>
                );
            })}
        </div>
    );
}

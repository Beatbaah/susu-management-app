import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { cn } from '../ui/utils';

const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const EMOJI_CHOICES = ['👍', '❤️', '😂', '😮', '🔥', '🙏'];

function ReactionPicker({ onReact, onClose }) {
    return (
        <div className="flex items-center gap-1 bg-card border border-border rounded-2xl px-2 py-1.5 shadow-lg">
            {EMOJI_CHOICES.map(emoji => (
                <button
                    key={emoji}
                    type="button"
                    onClick={() => { onReact(emoji); onClose(); }}
                    className="text-base hover:scale-125 transition-transform px-0.5"
                    aria-label={`React with ${emoji}`}
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
}

function ReactionPills({ reactions, currentUserId, onReact }) {
    if (!reactions || Object.keys(reactions).length === 0) return null;
    const sorted = Object.entries(reactions)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 4);
    return (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {sorted.map(([emoji, users]) => {
                const isOwn = Array.isArray(users) && users.includes(currentUserId);
                return (
                    <button
                        key={emoji}
                        type="button"
                        onClick={() => onReact(emoji)}
                        className={cn(
                            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all',
                            isOwn
                                ? 'bg-primary/20 border-primary/40 ring-1 ring-primary'
                                : 'bg-muted/50 border-border hover:bg-muted'
                        )}
                    >
                        <span>{emoji}</span>
                        <span className="font-bold text-foreground">{users.length}</span>
                    </button>
                );
            })}
        </div>
    );
}

export function ChatBubble({ isOwn, senderName, senderRole, message, time, type = 'message', reactions = {}, onReact, msgId, currentUserId }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const initials = (senderName || '?').split(' ').map(n => n[0]).join('').slice(0, 2);

    if (type === 'announcement') {
        return (
            <div className="w-full my-2">
                <div className="bg-warning/5 border border-warning/20 border-l-4 border-l-warning rounded-2xl px-5 py-4 relative">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-warning/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Megaphone className="w-4 h-4 text-warning" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <p className="text-foreground text-xs font-bold">{senderName}</p>
                                <span className="px-1.5 py-0.5 bg-warning/20 text-warning rounded text-xs font-bold uppercase tracking-tighter">
                                    {senderRole}
                                </span>
                                <span className="px-1.5 py-0.5 bg-warning/10 text-warning/80 rounded text-xs font-bold uppercase tracking-tighter">
                                    Announcement
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">{message}</p>
                            <p className="text-xs text-muted-foreground mt-2">{formatTime(time)}</p>
                            {onReact && (
                                <div className="mt-2 relative">
                                    <ReactionPills reactions={reactions} currentUserId={currentUserId} onReact={onReact} />
                                    <div className="mt-1.5">
                                        {pickerOpen ? (
                                            <ReactionPicker onReact={onReact} onClose={() => setPickerOpen(false)} />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setPickerOpen(true)}
                                                className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-full border border-border hover:bg-muted/50 transition-colors"
                                            >
                                                +
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%]', isOwn ? '' : 'flex gap-3')}>
                {!isOwn && (
                    <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border border-border">
                        {initials}
                    </div>
                )}
                <div className="group/bubble">
                    {!isOwn && (
                        <div className="flex items-center gap-2 mb-1.5 ml-1">
                            <p className="text-foreground text-xs font-bold">{senderName}</p>
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-bold uppercase tracking-tighter">
                                {senderRole}
                            </span>
                        </div>
                    )}
                    <div
                        className={cn(
                            'rounded-2xl px-4 py-3 shadow-sm',
                            isOwn
                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                : 'bg-card border border-border text-foreground rounded-tl-none'
                        )}
                    >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message}</p>
                    </div>
                    <p className={cn('text-xs text-muted-foreground mt-1.5 px-1', isOwn && 'text-right')}>
                        {formatTime(time)}
                    </p>
                    {onReact && (
                        <div className={cn('mt-1 px-1 relative', isOwn && 'flex flex-col items-end')}>
                            <ReactionPills reactions={reactions} currentUserId={currentUserId} onReact={onReact} />
                            <div className="mt-1">
                                {pickerOpen ? (
                                    <ReactionPicker onReact={onReact} onClose={() => setPickerOpen(false)} />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setPickerOpen(true)}
                                        className="opacity-0 group-hover/bubble:opacity-100 text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-full border border-border hover:bg-muted/50 transition-all"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

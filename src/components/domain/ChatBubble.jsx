import { cn } from '../ui/utils';
const formatTime = (iso) => {
    if (!iso)
        return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
export function ChatBubble({ isOwn, senderName, senderRole, message, time }) {
    const initials = (senderName || '?').split(' ').map(n => n[0]).join('').slice(0, 2);
    return (<div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%]', isOwn ? '' : 'flex gap-3')}>
        {!isOwn && (<div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border border-border">
            {initials}
          </div>)}
        <div>
          {!isOwn && (<div className="flex items-center gap-2 mb-1.5 ml-1">
              <p className="text-foreground text-xs font-bold">{senderName}</p>
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-bold uppercase tracking-tighter">
                {senderRole}
              </span>
            </div>)}
          <div className={cn('rounded-2xl px-4 py-3 shadow-sm', isOwn
            ? 'bg-primary text-primary-foreground rounded-tr-none'
            : 'bg-card border border-border text-foreground rounded-tl-none')}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message}</p>
          </div>
          <p className={cn('text-xs text-muted-foreground mt-1.5 px-1', isOwn && 'text-right')}>
            {formatTime(time)}
          </p>
        </div>
      </div>
    </div>);
}

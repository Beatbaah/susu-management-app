import { Send, Paperclip, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { cn } from '../components/ui/utils';
import { EmptyState } from '../components/ui/EmptyState';
import { ChatBubble } from '../components/domain';
import { mobileNavHidden } from '../services/uiBus';
export function GroupChat() {
    const { authUser, users, groups, postChatMessage } = useAppContext();
    const [messageText, setMessageText] = useState('');
    const scrollerRef = useRef(null);
    const fileInputRef = useRef(null);
    const handleFileAttach = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMessageText(prev => prev ? `${prev} [File: ${file.name}]` : `[File: ${file.name}]`);
        e.target.value = '';
    }, []);
    const accessibleGroups = useMemo(() => {
        if (!authUser)
            return [];
        if (authUser.role !== 'member')
            return groups;
        return groups.filter(g => Array.isArray(g.members) && g.members.includes(authUser.id));
    }, [groups, authUser]);
    const [activeGroupId, setActiveGroupId] = useState(null);
    useEffect(() => {
        if (!activeGroupId && accessibleGroups[0])
            setActiveGroupId(accessibleGroups[0].id);
    }, [accessibleGroups, activeGroupId]);
    const activeGroup = groups.find(g => g.id === activeGroupId) || null;
    const chat = Array.isArray(activeGroup?.chat) ? activeGroup.chat : [];
    useEffect(() => {
        if (scrollerRef.current)
            scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }, [chat.length, activeGroupId]);
    // Auto-hide the mobile bottom nav while reading the chat. Scrolling up
    // (or near the top) brings it back. Restore the nav when the page unmounts.
    useEffect(() => {
        const el = scrollerRef.current;
        if (!el)
            return;
        let lastY = el.scrollTop;
        const HIDE_THRESHOLD = 8; // px of intent before reacting
        const onScroll = () => {
            const y = el.scrollTop;
            const delta = y - lastY;
            if (Math.abs(delta) < HIDE_THRESHOLD)
                return;
            // Always show within 16px of the top.
            if (y < 16)
                mobileNavHidden.set(false);
            else if (delta > 0)
                mobileNavHidden.set(true); // scrolling down
            else
                mobileNavHidden.set(false); // scrolling up
            lastY = y;
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', onScroll);
            mobileNavHidden.set(false); // restore on leaving the page
        };
    }, [activeGroupId]);
    // Track whether the mobile nav is currently visible so we can shrink the
    // input-bar's bottom padding when it hides (no dead space below the input).
    const [navIsHidden, setNavIsHidden] = useState(false);
    useEffect(() => mobileNavHidden.subscribe(setNavIsHidden), []);
    const memberCount = Array.isArray(activeGroup?.members) ? activeGroup.members.length : 0;
    const handleSend = () => {
        if (!messageText.trim() || !activeGroupId)
            return;
        postChatMessage(activeGroupId, messageText);
        setMessageText('');
    };
    const resolveSenderName = (senderId, fallback) => {
        if (senderId === authUser?.id)
            return 'You';
        const sender = users.find(u => u.id === senderId);
        return sender?.fullName || sender?.name || fallback || 'Member';
    };
    const resolveSenderRole = (senderId, fallback) => {
        const sender = users.find(u => u.id === senderId);
        return sender?.role || fallback || 'member';
    };
    if (accessibleGroups.length === 0) {
        return (<div className="px-6 py-10">
        <EmptyState icon={MessageSquare} title="No groups yet" description="Join a susu group to start chatting with members."/>
      </div>);
    }
    return (<div className="flex flex-col bg-background h-full min-h-[calc(100vh-64px)]">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold">
                {(activeGroup?.groupName || activeGroup?.name || 'G').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg leading-tight truncate">{activeGroup?.groupName || activeGroup?.name || 'Group'}</h2>
              <p className="text-muted-foreground text-xs font-medium">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
        </div>
        {accessibleGroups.length > 1 && (<div className="flex gap-2 overflow-x-auto -mx-2 px-2">
            {accessibleGroups.map(g => (<button key={g.id} type="button" onClick={() => setActiveGroupId(g.id)} className={cn('px-3 py-1.5 rounded-xl whitespace-nowrap text-xs transition-colors', activeGroupId === g.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground')}>
                {g.groupName || g.name}
              </button>))}
          </div>)}
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
        {chat.length === 0 ? (<div className="text-center text-muted-foreground text-sm py-10">
            No messages yet. Start the conversation.
          </div>) : (chat.map((msg) => {
            const senderId = msg.sender;
            const isOwn = senderId === authUser?.id;
            const name = msg.senderName || resolveSenderName(senderId);
            const role = msg.senderRole || resolveSenderRole(senderId);
            return (<ChatBubble key={msg.id || msg.time} isOwn={isOwn} senderName={isOwn ? 'You' : name} senderRole={role} message={msg.msg || msg.message} time={msg.time}/>);
        }))}
      </div>

      <div className={cn('px-4 pt-4 bg-background border-t border-border transition-[padding] duration-300', 
        // On mobile, pad the bottom for the floating nav; collapse when hidden.
        // Desktop has no mobile nav, so always use the standard padding.
        navIsHidden ? 'pb-4' : 'pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-4')}>
        <div className="bg-card border border-border rounded-2xl p-2 shadow-lg">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"/>
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 text-muted-foreground hover:bg-muted/50 rounded-xl transition-colors flex items-center justify-center">
              <Paperclip className="w-5 h-5"/>
            </button>
            <input type="text" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type your message..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 outline-none"/>
            <button type="submit" className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-all', messageText.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground opacity-50')} disabled={!messageText.trim()}>
              <Send className="w-5 h-5"/>
            </button>
          </form>
        </div>
      </div>
    </div>);
}

import { Send, MessageSquare, Megaphone, X, ChevronLeft, Paperclip, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { cn } from '../components/ui/utils';
import { EmptyState } from '../components/ui/EmptyState';
import { ChatBubble } from '../components/domain';
import { mobileNavHidden } from '../services/uiBus';

export function GroupChat() {
    const { authUser, users, groups, postChatMessage, postChatMedia, postAnnouncement, addChatReaction } = useAppContext();
    const [messageText, setMessageText] = useState('');
    const [announceOpen, setAnnounceOpen] = useState(false);
    const [announceText, setAnnounceText] = useState('');
    const [mobileChatOpen, setMobileChatOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const scrollerRef = useRef(null);
    const fileInputRef = useRef(null);

    const accessibleGroups = useMemo(() => {
        if (!authUser) return [];
        if (authUser.role !== 'member') return groups;
        return groups.filter(g => Array.isArray(g.members) && g.members.includes(authUser.id));
    }, [groups, authUser]);

    const [activeGroupId, setActiveGroupId] = useState(null);
    useEffect(() => {
        if (!activeGroupId && accessibleGroups[0])
            setActiveGroupId(accessibleGroups[0].id);
    }, [accessibleGroups, activeGroupId]);

    const selectGroup = (id) => {
        setActiveGroupId(id);
        setMobileChatOpen(true);
    };

    const activeGroup = groups.find(g => g.id === activeGroupId) || null;
    const chat = Array.isArray(activeGroup?.chat) ? activeGroup.chat : [];

    useEffect(() => {
        if (scrollerRef.current)
            scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }, [chat.length, activeGroupId]);

    // Auto-hide the mobile bottom nav while reading the chat. Restore on unmount.
    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        let lastY = el.scrollTop;
        const HIDE_THRESHOLD = 8;
        const onScroll = () => {
            const y = el.scrollTop;
            const delta = y - lastY;
            if (Math.abs(delta) < HIDE_THRESHOLD) return;
            if (y < 16) mobileNavHidden.set(false);
            else if (delta > 0) mobileNavHidden.set(true);
            else mobileNavHidden.set(false);
            lastY = y;
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', onScroll);
            mobileNavHidden.set(false);
        };
    }, [activeGroupId]);

    const [navIsHidden, setNavIsHidden] = useState(false);
    useEffect(() => mobileNavHidden.subscribe(setNavIsHidden), []);

    const memberCount = Array.isArray(activeGroup?.members) ? activeGroup.members.length : 0;
    const canAnnounce = authUser && ['admin', 'manager'].includes(authUser.role);

    const handleSend = () => {
        if (!messageText.trim() || !activeGroupId) return;
        postChatMessage(activeGroupId, messageText);
        setMessageText('');
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !activeGroupId) return;
        e.target.value = '';
        setUploading(true);
        await postChatMedia(activeGroupId, file);
        setUploading(false);
    };

    const handleSendAnnouncement = () => {
        if (!announceText.trim() || !activeGroupId) return;
        postAnnouncement(activeGroupId, announceText);
        setAnnounceText('');
        setAnnounceOpen(false);
    };

    const resolveSenderName = (senderId, fallback) => {
        if (senderId === authUser?.id) return 'You';
        const sender = users.find(u => u.id === senderId);
        return sender?.fullName || sender?.name || fallback || 'Member';
    };

    const resolveSenderRole = (senderId, fallback) => {
        const sender = users.find(u => u.id === senderId);
        return sender?.role || fallback || 'member';
    };

    if (accessibleGroups.length === 0) {
        return (
            <div className="px-6 py-10">
                <EmptyState icon={MessageSquare} title="No groups yet" description="Join a susu group to start chatting with members."/>
            </div>
        );
    }

    return (
        <div className="flex bg-background" style={{ height: 'calc(100vh - 64px)' }}>

            {/* ── Group list sidebar ──────────────────────────────────── */}
            <div className={cn(
                'flex-shrink-0 border-r border-border bg-card flex-col overflow-hidden',
                // Mobile: full screen list OR hidden when chat is open
                // Desktop: always visible as fixed-width sidebar
                mobileChatOpen ? 'hidden md:flex md:w-72' : 'flex w-full md:w-72'
            )}>
                {/* Sidebar header */}
                <div className="px-4 py-4 border-b border-border flex-shrink-0">
                    <h2 className="font-bold text-foreground">Group Chat</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {accessibleGroups.length} {accessibleGroups.length === 1 ? 'group' : 'groups'}
                    </p>
                </div>

                {/* Group list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {accessibleGroups.map(g => {
                        const msgs = Array.isArray(g.chat) ? g.chat : [];
                        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                        const gMemberCount = Array.isArray(g.members) ? g.members.length : 0;
                        const isActive = activeGroupId === g.id;
                        const initials = (g.groupName || g.name || 'G').slice(0, 2).toUpperCase();
                        const lastTime = lastMsg?.time
                            ? new Date(lastMsg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '';
                        const preview = lastMsg
                            ? (lastMsg.msg || lastMsg.message || '').slice(0, 45)
                            : `${gMemberCount} member${gMemberCount !== 1 ? 's' : ''}`;
                        return (
                            <button key={g.id} type="button" onClick={() => selectGroup(g.id)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-border/40 border-l-[3px]',
                                    isActive
                                        ? 'bg-primary/10 border-l-primary'
                                        : 'hover:bg-muted/40 border-l-transparent'
                                )}>
                                <div className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold',
                                    isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'
                                )}>
                                    {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-1">
                                        <p className={cn('text-sm font-semibold truncate leading-snug',
                                            isActive ? 'text-primary' : 'text-foreground')}>
                                            {g.groupName || g.name}
                                        </p>
                                        {lastTime && (
                                            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{lastTime}</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Chat area ───────────────────────────────────────────── */}
            <div className={cn(
                'flex-1 flex-col min-w-0',
                mobileChatOpen ? 'flex' : 'hidden md:flex'
            )}>
                {/* Chat header */}
                <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
                    {/* Back button — mobile only */}
                    <button type="button" onClick={() => setMobileChatOpen(false)}
                        className="md:hidden w-8 h-8 rounded-xl hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors flex-shrink-0">
                        <ChevronLeft className="w-5 h-5"/>
                    </button>
                    <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-sm">
                            {(activeGroup?.groupName || activeGroup?.name || 'G').slice(0, 2).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-foreground leading-snug truncate">
                            {activeGroup?.groupName || activeGroup?.name || 'Group'}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                        </p>
                    </div>
                    {canAnnounce && (
                        <button type="button" onClick={() => setAnnounceOpen(true)}
                            className="w-9 h-9 rounded-xl hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors flex-shrink-0"
                            aria-label="Send announcement">
                            <Megaphone className="w-5 h-5"/>
                        </button>
                    )}
                </div>

                {/* Messages */}
                <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 custom-scrollbar">
                    {chat.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-10">
                            No messages yet. Start the conversation.
                        </div>
                    ) : (
                        chat.map(msg => {
                            const senderId = msg.sender;
                            const isOwn = senderId === authUser?.id;
                            const name = msg.senderName || resolveSenderName(senderId);
                            const role = msg.senderRole || resolveSenderRole(senderId);
                            return (
                                <ChatBubble key={msg.id || msg.time} isOwn={isOwn}
                                    senderName={isOwn ? 'You' : name} senderRole={role}
                                    message={msg.msg || msg.message} time={msg.time}
                                    type={msg.type || 'message'} reactions={msg.reactions || {}}
                                    onReact={(emoji) => addChatReaction(activeGroupId, msg.id, emoji)}
                                    msgId={msg.id} currentUserId={authUser?.id}
                                    mediaUrl={msg.mediaUrl} mediaName={msg.mediaName} mediaType={msg.mediaType}/>
                            );
                        })
                    )}
                </div>

                {/* Input bar */}
                <div className={cn(
                    'px-4 pt-4 bg-background border-t border-border transition-[padding] duration-300 flex-shrink-0',
                    navIsHidden ? 'pb-4' : 'pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-4'
                )}>
                    <div className="bg-card border border-border rounded-2xl p-2 shadow-lg">
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={handleFileSelect}/>
                        <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); handleSend(); }}>
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
                                aria-label="Attach file">
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Paperclip className="w-5 h-5"/>}
                            </button>
                            <input type="text" value={messageText} onChange={e => setMessageText(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 pl-2 outline-none"/>
                            <button type="submit"
                                className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                                    messageText.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground opacity-50'
                                )}
                                disabled={!messageText.trim()}>
                                <Send className="w-5 h-5"/>
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* ── Announcement modal ───────────────────────────────────── */}
            {announceOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setAnnounceOpen(false)}>
                    <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80dvh] animate-in zoom-in-95 duration-300"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50 flex-shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 bg-warning/15 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Megaphone className="w-4 h-4 text-warning"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-foreground">Send Announcement</h3>
                                    <p className="text-xs text-muted-foreground">Visible to all group members</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setAnnounceOpen(false)}
                                className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                                <X className="w-4 h-4"/>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <textarea value={announceText} onChange={e => setAnnounceText(e.target.value)}
                                placeholder="Write your announcement..." rows={4}
                                className="w-full bg-card border-2 border-border rounded-xl px-4 py-4 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"/>
                        </div>
                        <div className="flex gap-3 px-5 py-4 border-t border-border/50 bg-card flex-shrink-0">
                            <button type="button" onClick={() => setAnnounceOpen(false)}
                                className="flex-1 bg-muted border border-border py-3 rounded-xl app-action uppercase text-foreground/60 hover:text-foreground transition-all">
                                Cancel
                            </button>
                            <button type="button" onClick={handleSendAnnouncement} disabled={!announceText.trim()}
                                className={cn('flex-[1.5] py-3 rounded-xl app-action uppercase transition-all active:scale-[0.98]',
                                    announceText.trim() ? 'bg-warning text-white hover:opacity-90' : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed')}>
                                Send Announcement
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

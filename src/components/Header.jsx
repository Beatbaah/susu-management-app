import React from 'react';
import { Search, Bell, Menu, Settings } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from './ui/utils';
export function Header({ user, title, onOpenSidebar, notificationCount = 0, onNotificationsClick, onOpenSettings, onOpenProfile, onSearch, searchValue = '', searchPlaceholder = 'Search everything…', }) {
    const initials = user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
    return (<header className="bg-card border-b border-border shadow-[var(--shadow-xs)] px-4 md:px-7 sticky top-0 z-30 transition-colors duration-200">
      <div className="flex items-center justify-between gap-4 max-w-[1600px] mx-auto h-[60px]">

        {/* ── Left: Menu (mobile) + Title ── */}
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onOpenSidebar} aria-label="Open navigation menu" className={cn('md:hidden w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0', 'text-foreground/50 hover:text-foreground hover:bg-accent', 'transition-colors duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}>
            <Menu className="w-[17px] h-[17px]" strokeWidth={2}/>
          </button>

          {/* Mobile logo pill */}
          <div className="w-11 h-11 rounded-full border border-border bg-white flex items-center justify-center md:hidden flex-shrink-0 overflow-hidden">
            <img src="/logo.jpg" alt="Excellent Susu" className="w-11 h-11 object-cover"/>
          </div>

          {/* Page title */}
          <h1 className="app-row-title text-foreground truncate">
            {title}
          </h1>
        </div>

        {/* ── Center: Search bar ── */}
        <div className="hidden lg:flex flex-1 max-w-[360px] items-center relative">
          <label htmlFor="global-search" className="sr-only">
            Search members, payments, groups
          </label>
          <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" strokeWidth={1.75}/>
          <input id="global-search" type="search" placeholder={searchPlaceholder} value={searchValue} onChange={(e) => onSearch?.(e.target.value)} className={cn('w-full h-9 rounded-full pl-9 pr-4', 'bg-accent border border-border', 'app-row-meta text-foreground placeholder:text-muted-foreground/50', 'focus:bg-card focus:border-primary/30 focus:ring-2 focus:ring-primary/10', 'outline-none transition-all duration-200')}/>
        </div>

        {/* ── Right: Actions + Avatar ── */}
        <div className="flex items-center gap-1">

          {/* Mobile search toggle */}
          <button type="button" onClick={() => setMobileSearchOpen(s => !s)} aria-label="Search" className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full text-foreground/45 hover:text-foreground hover:bg-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <Search className="w-[17px] h-[17px]" strokeWidth={1.75}/>
          </button>

          {/* Notifications */}
          <button type="button" onClick={onNotificationsClick} aria-label={`Notifications${notificationCount > 0 ? ` — ${notificationCount} unread` : ''}`} className={cn('relative w-9 h-9 flex items-center justify-center rounded-full', 'text-foreground/45 hover:text-foreground hover:bg-accent', 'transition-colors duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}>
            <Bell className="w-[17px] h-[17px]" strokeWidth={1.75}/>
            {notificationCount > 0 && (<span aria-hidden="true" className={cn('absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-0.5', 'bg-primary rounded-full border-[1.5px] border-card', 'app-badge text-primary-foreground', 'flex items-center justify-center leading-none')}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>)}
          </button>

          {/* Settings */}
          <button type="button" onClick={onOpenSettings} aria-label="Open settings" className={cn('hidden sm:flex w-9 h-9 items-center justify-center rounded-full', 'text-foreground/45 hover:text-foreground hover:bg-accent', 'transition-colors duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}>
            <Settings className="w-[17px] h-[17px]" strokeWidth={1.75}/>
          </button>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-border mx-1.5 flex-shrink-0" aria-hidden="true"/>

          {/* Profile */}
          <button type="button" onClick={onOpenProfile} aria-label={`Open profile for ${user.name}`} className={cn('flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full', 'hover:bg-accent transition-colors duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}>
            <div className="hidden md:block text-right leading-none">
              <p className="app-value text-foreground">
                {user.name}
              </p>
              <p className="eyebrow text-primary mt-0.5">
                {user.role}
              </p>
            </div>

            <div className="relative flex-shrink-0">
              <Avatar className="w-8 h-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] bg-success rounded-full border-[1.5px] border-card"/>
            </div>
          </button>
        </div>

      </div>
      {mobileSearchOpen && (
        <div className="lg:hidden pb-2.5 px-1 animate-in slide-in-from-top-1 duration-200">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" strokeWidth={1.75}/>
            <input
              autoFocus
              type="search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-full h-9 rounded-full pl-9 pr-4 bg-accent border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:bg-card focus:border-primary/30 focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200"
            />
          </div>
        </div>
      )}
    </header>);
}

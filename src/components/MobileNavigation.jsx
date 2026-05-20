import React, { useEffect, useState } from 'react';
import { LayoutGrid, Users, Users2, Wallet, MessageCircle, Trophy, User, Plus, CalendarDays, } from 'lucide-react';
import { cn } from './ui/utils';
import { canAccessPage } from '../security/permissions';
import { useAppContext } from '../context/AppContext';
import { mobileNavHidden } from '../services/uiBus';
const MEMBER_NAV = [
    { id: 'portal', icon: LayoutGrid, label: 'Home' },
    { id: 'groups', icon: Users2, label: 'Groups' },
    { id: 'leaderboard', icon: Trophy, label: 'Board' },
    { id: 'chat', icon: MessageCircle, label: 'Chat' },
];
const STAFF_NAV = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Home' },
    { id: 'payments', icon: Wallet, label: 'Payments' },
    { id: 'members', icon: Users, label: 'Members' },
    { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
];
const FALLBACK_NAV = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Home' },
    { id: 'profile', icon: User, label: 'Profile' },
];
export function MobileNavigation({ activePage, onNavigate, onPrimaryAction, className, }) {
    const { authUser } = useAppContext();
    const role = authUser?.role;
    const [hidden, setHidden] = useState(false);
    useEffect(() => mobileNavHidden.subscribe(setHidden), []);
    const base = role === 'member' ? MEMBER_NAV : role ? STAFF_NAV : FALLBACK_NAV;
    const filtered = base.filter(item => canAccessPage(role, item.id)).slice(0, 4);
    const left = filtered.slice(0, 2);
    const right = filtered.slice(2, 4);
    const isActive = (id) => id === 'portal'
        ? activePage === 'portal' || activePage === 'dashboard'
        : activePage === id;
    const NavSlot = (item) => {
        const active = isActive(item.id);
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id === 'portal' && role !== 'member' ? 'dashboard' : item.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            className={cn(
              'flex-1 flex flex-col items-center justify-center min-h-[56px] gap-0.5 py-2',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              'transition-all duration-200 active:scale-90',
            )}
          >
            {/* Icon pill — fills with primary tint when active */}
            <div className={cn(
              'w-12 h-7 rounded-xl flex items-center justify-center transition-all duration-200',
              active
                ? 'bg-primary/[0.14] text-primary'
                : 'text-foreground/40',
            )}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.25 : 1.75}/>
            </div>
            <span className={cn(
              'text-[10px] leading-none font-medium transition-colors duration-200',
              active ? 'text-primary font-semibold' : 'text-foreground/40',
            )}>
              {item.label}
            </span>
          </button>
        );
    };
    return (
      <nav
        aria-label="Mobile navigation"
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40',
          'px-3 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))]',
          'bg-card/96 backdrop-blur-xl',
          'border-t border-border/60',
          'shadow-[0_-4px_24px_rgba(7,61,127,0.08)]',
          'transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]',
          hidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100',
          className,
        )}
      >
        <div className="relative flex items-end justify-between max-w-lg mx-auto">
          {/* Left items */}
          <div className="flex flex-1 justify-around">{left.map(NavSlot)}</div>

          {/* Centre FAB */}
          <div className="w-16 flex-shrink-0 flex items-center justify-center -mt-6 relative">
            {onPrimaryAction && (
              <button
                type="button"
                onClick={onPrimaryAction}
                aria-label="Quick action"
                className={cn(
                  'w-14 h-14 rounded-full',
                  'bg-primary text-primary-foreground',
                  'flex items-center justify-center',
                  'border-4 border-card',
                  'shadow-[0_4px_20px_rgba(100,145,222,0.50)]',
                  'transition-all duration-150 active:scale-90 hover:shadow-[0_6px_24px_rgba(100,145,222,0.60)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                )}
              >
                <Plus className="w-5 h-5" strokeWidth={2.5}/>
              </button>
            )}
          </div>

          {/* Right items */}
          <div className="flex flex-1 justify-around">{right.map(NavSlot)}</div>
        </div>
      </nav>
    );
}

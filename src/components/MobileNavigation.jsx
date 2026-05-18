import React, { useEffect, useState } from 'react';
import { LayoutGrid, Users, Users2, DollarSign, MessageCircle, Trophy, User, Plus, Bell, } from 'lucide-react';
import { cn } from './ui/utils';
import { canAccessPage } from '../security/permissions';
import { useAppContext } from '../context/AppContext';
import { mobileNavHidden } from '../services/uiBus';
const MEMBER_NAV = [
    { id: 'portal', icon: LayoutGrid, label: 'Home' },
    { id: 'groups', icon: Users2, label: 'Groups' },
    { id: 'leaderboard', icon: Trophy, label: 'Rank' },
    { id: 'chat', icon: MessageCircle, label: 'Chat' },
];
const STAFF_NAV = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Home' },
    { id: 'payments', icon: DollarSign, label: 'Pay' },
    { id: 'members', icon: Users, label: 'Members' },
    { id: 'reminders', icon: Bell, label: 'Alerts' },
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
        return (<button key={item.id} type="button" onClick={() => onNavigate(item.id === 'portal' && role !== 'member' ? 'dashboard' : item.id)} aria-current={active ? 'page' : undefined} aria-label={item.label} className={cn('flex-1 flex flex-col items-center justify-center', 'min-h-[56px] gap-1 rounded-2xl py-2', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', 'transition-colors duration-150', active ? 'bg-primary/[0.07]' : 'active:bg-accent/80')}>
        {/* Icon container */}
        <div className={cn('w-[38px] h-[26px] rounded-lg flex items-center justify-center transition-all duration-150', active ? 'text-primary' : 'text-foreground/40')}>
          <Icon className={cn('w-[18px] h-[18px]')} strokeWidth={active ? 2.25 : 1.75}/>
        </div>

        <span className={cn('text-xs font-medium leading-none', 'transition-colors duration-150', active ? 'text-primary font-semibold' : 'text-foreground/40')}>
          {item.label}
        </span>
      </button>);
    };
    return (<nav aria-label="Mobile navigation" className={cn('fixed bottom-0 left-0 right-0 z-40', 'px-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]', 'bg-card/98 backdrop-blur-lg', 'border-t border-border', 'transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]', hidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100', className)}>
      <div className="relative flex items-end justify-between max-w-lg mx-auto">
        {/* Left items */}
        <div className="flex flex-1 justify-around">{left.map(NavSlot)}</div>

        {/* Centre FAB */}
        <div className="w-16 flex-shrink-0 flex items-center justify-center -mt-5 relative">
          {onPrimaryAction && (<button type="button" onClick={onPrimaryAction} aria-label="Quick action" className={cn('w-12 h-12 rounded-full', 'bg-primary text-primary-foreground', 'flex items-center justify-center', 'border-2 border-card', 'shadow-md', 'transition-all duration-150 active:scale-90 hover:brightness-105', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card')}>
              <Plus className="w-5 h-5" strokeWidth={2.25}/>
            </button>)}
        </div>

        {/* Right items */}
        <div className="flex flex-1 justify-around">{right.map(NavSlot)}</div>
      </div>
    </nav>);
}

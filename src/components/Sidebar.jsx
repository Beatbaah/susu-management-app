import React from 'react';
import { LayoutGrid, Users, Users2, Wallet, Calendar, CalendarDays, AlertCircle, FileText, MessageCircle, BarChart3, Trophy, History, Settings, LogOut, Bell, } from 'lucide-react';
import { cn } from './ui/utils';
import { canAccessPage } from '../security/permissions';
export function Sidebar({ activePage, onNavigate, user, onLogout, className }) {
    const allSections = [
        {
            label: 'Main',
            items: [
                { id: 'dashboard', icon: LayoutGrid, label: 'Overview' },
                { id: 'members', icon: Users, label: 'Members' },
                { id: 'groups', icon: Users2, label: 'Susu Groups' },
                { id: 'payments', icon: Wallet, label: 'Payments' },
                { id: 'payout', icon: Calendar, label: 'Payouts' },
                { id: 'calendar', icon: CalendarDays, label: 'Calendar' },
            ],
        },
        {
            label: 'Manage',
            items: [
                { id: 'defaulters', icon: AlertCircle, label: 'Defaulters' },
                { id: 'reminders', icon: Bell, label: 'Reminders' },
                { id: 'receipts', icon: FileText, label: 'Receipts' },
                { id: 'chat', icon: MessageCircle, label: 'Group Chat' },
            ],
        },
        {
            label: 'Insights',
            items: [
                { id: 'analytics', icon: BarChart3, label: 'Analytics' },
                { id: 'leaderboard', icon: Trophy, label: 'Leaderboard' },
                { id: 'audit', icon: History, label: 'Audit Logs' },
            ],
        },
        {
            label: 'Account',
            items: [
                { id: 'settings', icon: Settings, label: 'Settings' },
            ],
        },
    ];
    const sections = allSections
        .map(section => ({
        ...section,
        items: section.items.filter(item => canAccessPage(user?.role, item.id)),
    }))
        .filter(section => section.items.length > 0);
    const displayName = user?.fullName || user?.name || '';
    const initials = displayName
        ? displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
        : '??';
    return (
      <aside className={cn(
        'w-[260px] bg-sidebar text-sidebar-foreground',
        'border-r border-sidebar-border',
        'h-[100dvh] flex flex-col z-20',
        className,
      )}>
        {/* ── Brand ── */}
        <div className="px-5 pt-[env(safe-area-inset-top,22px)] pb-5" style={{ paddingTop: 'max(22px, env(safe-area-inset-top))' }}>
          <button type="button" onClick={() => onNavigate('dashboard')} className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl p-1 -m-1" aria-label="Go to dashboard">
            <div className="w-9 h-9 rounded-xl border border-sidebar-border bg-sidebar-accent/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img src="/logo512.png" alt="Excellent Susu" className="w-7 h-7 object-contain rounded-lg"/>
            </div>
            <div className="leading-none">
              <p className="text-[14px] font-semibold text-sidebar-foreground tracking-tight leading-snug">Excellent</p>
              <p className="eyebrow text-sidebar-primary mt-0.5">Susu Hub</p>
            </div>
          </button>
        </div>

        {/* Thin separator */}
        <div className="mx-5 border-t border-sidebar-border/60 mb-4"/>

        {/* ── Navigation ── */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar space-y-4">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1.5 eyebrow text-sidebar-foreground/45 select-none tracking-wider">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = (activePage === 'portal' ? 'dashboard' : activePage) === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-[11px] rounded-xl text-sm font-medium',
                        'transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        'relative active:scale-[0.98]',
                        isActive
                          ? 'bg-primary/[0.12] text-sidebar-foreground'
                          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                      )}
                    >
                      {/* Left accent bar */}
                      {isActive && (
                        <span className="absolute left-0 inset-y-[7px] w-[3px] rounded-r-full bg-sidebar-primary" aria-hidden="true"/>
                      )}
                      <Icon
                        className={cn('w-[17px] h-[17px] flex-shrink-0', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50')}
                        strokeWidth={isActive ? 2.25 : 1.75}
                      />
                      <span className="tracking-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── User Footer ── */}
        <div className="px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 border-t border-sidebar-border/60">
          {/* User identity */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-0.5 bg-sidebar-accent/30">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center font-bold text-xs text-sidebar-primary select-none">
                {initials}
              </div>
              <span aria-label="Online" className="absolute -bottom-px -right-px w-2.5 h-2.5 bg-success rounded-full border-2 border-sidebar"/>
            </div>
            <div className="flex-1 min-w-0 leading-none">
              <p className="text-sm font-semibold truncate text-sidebar-foreground">
                {user?.fullName || user?.name}
              </p>
              <p className="eyebrow text-sidebar-foreground/55 mt-0.5 truncate capitalize">
                {user?.role}
              </p>
            </div>
          </div>

          {/* Sign out */}
          <button
            type="button"
            onClick={onLogout}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium mt-0.5',
              'text-sidebar-foreground/55',
              'hover:bg-destructive/[0.08] hover:text-destructive',
              'transition-all duration-150 active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40',
            )}
          >
            <LogOut className="w-[15px] h-[15px] flex-shrink-0" strokeWidth={1.75}/>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    );
}

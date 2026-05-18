import React from 'react';
import { LayoutGrid, Users, Users2, DollarSign, Calendar, AlertCircle, FileText, MessageCircle, BarChart3, Trophy, History, Settings, LogOut, Bell, } from 'lucide-react';
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
                { id: 'payments', icon: DollarSign, label: 'Payments' },
                { id: 'payout', icon: Calendar, label: 'Payouts' },
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
    const initials = user?.name
        ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
        : '??';
    return (<aside className={cn('w-[240px] bg-sidebar text-sidebar-foreground', 'border-r border-sidebar-border', 'h-screen flex flex-col z-20', className)}>
      {/* ── Brand ── */}
      <div className="px-5 pt-[22px] pb-5">
        <button type="button" onClick={() => onNavigate('dashboard')} className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl p-1 -m-1" aria-label="Go to dashboard">
          <div className="w-[34px] h-[34px] rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <img src="/logo512.png" alt="" className="w-[18px] h-[18px] object-contain brightness-0 invert"/>
          </div>
          <div className="leading-none">
            <p className="text-[14px] font-semibold text-sidebar-foreground tracking-tight leading-snug">Excellent</p>
            <p className="eyebrow text-primary mt-0.5">Susu Hub</p>
          </div>
        </button>
      </div>

      {/* Thin separator */}
      <div className="mx-5 border-t border-sidebar-border mb-4"/>

      {/* ── Navigation ── */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar space-y-5">
        {sections.map((section) => (<div key={section.label}>
            <p className="px-3 mb-1.5 eyebrow text-sidebar-foreground/35 select-none">
              {section.label}
            </p>

            <div className="space-y-px">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = (activePage === 'portal' ? 'dashboard' : activePage) === item.id;
                return (<button key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={isActive ? 'page' : undefined} className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl', 'text-[13px] font-medium transition-all duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', 'relative', isActive
                        ? 'bg-primary/[0.08] text-primary'
                        : 'text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground/85')}>
                    {/* Left accent bar for active */}
                    {isActive && (<span className="absolute left-0 inset-y-[6px] w-[3px] rounded-r-full bg-primary" aria-hidden="true"/>)}
                    <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-sidebar-foreground/40')} strokeWidth={isActive ? 2.25 : 1.75}/>
                    <span className="tracking-tight">{item.label}</span>
                  </button>);
            })}
            </div>
          </div>))}
      </nav>

      {/* ── User Footer ── */}
      <div className="px-3 pb-4 pt-3 border-t border-sidebar-border">
        {/* User identity row */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-px">
          <div className="relative flex-shrink-0">
            <div className="w-[30px] h-[30px] rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-semibold text-xs text-primary select-none">
              {initials}
            </div>
            <span aria-label="Online" className="absolute -bottom-px -right-px w-[9px] h-[9px] bg-success rounded-full border-[1.5px] border-sidebar"/>
          </div>
          <div className="flex-1 min-w-0 leading-none">
            <p className="text-[13px] font-semibold truncate text-sidebar-foreground leading-snug">
              {user?.name}
            </p>
            <p className="eyebrow text-sidebar-foreground/40 mt-0.5 truncate">
              {user?.role}
            </p>
          </div>
        </div>

        {/* Sign out */}
        <button type="button" onClick={onLogout} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-xl', 'text-[13px] font-medium text-sidebar-foreground/40', 'hover:bg-destructive/[0.06] hover:text-destructive', 'transition-all duration-150', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40')}>
          <LogOut className="w-[14px] h-[14px] flex-shrink-0" strokeWidth={1.75}/>
          <span>Sign out</span>
        </button>
      </div>
    </aside>);
}

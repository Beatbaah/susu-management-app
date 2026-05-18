import React, { Suspense, useEffect, useState } from "react";
import "./styles/App.css";
import { ShieldAlert } from "lucide-react";
// Components
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { MobileNavigation } from "./components/MobileNavigation";
// Security
import { RoleGuard } from "./security";
// Domain modals invoked from the global shell
import { PayModal, QuickActionSheet, MemberDrawer, NotificationsPanel } from "./components/domain";
import { Dashboard } from "./pages/Dashboard";
import { MemberPortal } from "./pages/MemberPortal";
import { Reminders } from "./pages/Reminders";
import { Analytics } from "./pages/Analytics";
import { Members } from "./pages/Members";
import { Groups } from "./pages/Groups";
import { Payments } from "./pages/Payments";
import { Defaulters } from "./pages/Defaulters";
import { PayoutSchedule } from "./pages/PayoutSchedule";
import { Leaderboard } from "./pages/Leaderboard";
import { GroupChat } from "./pages/GroupChat";
import { Settings } from "./pages/Settings";
import { AuditLogs } from "./pages/AuditLogs";
import { Receipts } from "./pages/Receipts";
import { Profile } from "./pages/Profile";
import AuthScreen from "./pages/AuthScreen";
import { BioScreen } from "./pages/BioScreen";
import { signOut as signOutUser } from "./services/authService";
// Context
import { useAppContext } from "./context/AppContext";
export default function App() {
    const { authUser, setAuthUser, users, payments, groups, reminders, settings, registerMember, logAudit } = useAppContext();
    const [page, setPage] = useState("dashboard");
    const [showBio, setShowBio] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const pageTitles = {
        dashboard: "Dashboard",
        portal: "My Account",
        analytics: "Analytics",
        members: "Members",
        groups: "Susu Groups",
        payments: "Payments",
        defaulters: "Defaulters",
        payout: "Payout Schedule",
        leaderboard: "Leaderboard",
        chat: "Group Chat",
        settings: "Settings",
        audit: "Audit Logs",
        receipts: "Receipts",
        profile: "Profile",
        reminders: "Reminders",
    };
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [globalSearch, setGlobalSearch] = useState("");
    const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
    // Decide which page best answers a global search query.
    const resolveGlobalSearchPage = (q) => {
        const term = q.trim().toLowerCase();
        if (!term)
            return null;
        if (/group|circle|cycle/.test(term))
            return "groups";
        if (/payout|round/.test(term))
            return "payout";
        if (/receipt|invoice/.test(term))
            return "receipts";
        if (/default|overdue|suspended/.test(term))
            return "defaulters";
        if (/audit|log|history/.test(term))
            return "audit";
        if (/pay|momo|cash|bank/.test(term))
            return "payments";
        return "members";
    };
    useEffect(() => {
        const onOffline = () => setIsOffline(true);
        const onOnline = () => setIsOffline(false);
        window.addEventListener("offline", onOffline);
        window.addEventListener("online", onOnline);
        return () => {
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("online", onOnline);
        };
    }, []);
    const handleRegister = (user) => {
        return registerMember(user);
    };
    if (!authUser) {
        return (<Suspense fallback={<PageFallback />}>
        {showBio ? (<BioScreen onSuccess={(u) => { setAuthUser(u); setShowBio(false); }} onFallback={() => setShowBio(false)}/>) : (<AuthScreen onLogin={(u) => setAuthUser(u)} onBio={() => setShowBio(true)} onRegister={handleRegister} registrationGroups={groups}/>)}
      </Suspense>);
    }
    const pendingRegistrations = users.filter(user => user.role === "member" && user.status === "pending").length;
    const pendingPayments = settings.notifPaymentReminders
        ? payments.filter(payment => payment.status === "pending").length
        : 0;
    const unreadReminders = reminders.filter(reminder => reminder.read === false && (!reminder.userId || reminder.userId === authUser.id)).length;
    const notificationCount = pendingRegistrations + pendingPayments + unreadReminders;
    const handleNotificationsClick = () => setNotificationsOpen(true);
    // Members see a personalized "My Account" home instead of the staff dashboard.
    const effectivePage = (authUser?.role === 'member' && page === 'dashboard') ? 'portal' : page;
    const renderPage = () => {
        const inner = (() => {
            switch (effectivePage) {
                case "dashboard": return <Dashboard user={authUser} onNavigate={setPage}/>;
                case "portal": return <MemberPortal />;
                case "analytics": return <Analytics />;
                case "members": return <Members />;
                case "groups": return <Groups />;
                case "payments": return <Payments />;
                case "defaulters": return <Defaulters />;
                case "payout": return <PayoutSchedule />;
                case "leaderboard": return <Leaderboard />;
                case "chat": return <GroupChat />;
                case "settings": return <Settings />;
                case "audit": return <AuditLogs />;
                case "receipts": return <Receipts />;
                case "reminders": return <Reminders />;
                case "profile": return <Profile user={authUser} onNavigate={setPage} onLogout={handleLogout}/>;
                default: return <Dashboard user={authUser} onNavigate={setPage}/>;
            }
        })();
        return <RoleGuard page={effectivePage}>{inner}</RoleGuard>;
    };
    const handleLogout = async () => {
        logAudit?.({ action: "logout", targetType: "user", targetId: authUser.id });
        await signOutUser();
        setAuthUser(null);
        setPage("dashboard");
        setSidebarOpen(false);
    };
    return (<div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar activePage={effectivePage} onNavigate={(p) => setPage(p)} user={authUser} onLogout={handleLogout} className="hidden md:flex"/>

        {sidebarOpen && (<div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md md:hidden" onClick={() => setSidebarOpen(false)}/>)}

        {sidebarOpen && (<div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar activePage={effectivePage} onNavigate={(p) => {
                setPage(p);
                setSidebarOpen(false);
            }} user={authUser} onLogout={handleLogout}/>
          </div>)}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header user={authUser} title={pageTitles[effectivePage] ?? effectivePage.charAt(0).toUpperCase() + effectivePage.slice(1)} onOpenSidebar={() => setSidebarOpen(true)} notificationCount={notificationCount} onNotificationsClick={handleNotificationsClick} onOpenSettings={() => setPage('settings')} onOpenProfile={() => setProfileDrawerOpen(true)} onSearch={(q) => {
            setGlobalSearch(q);
            const target = resolveGlobalSearchPage(q);
            if (target && target !== page)
                setPage(target);
        }} searchValue={globalSearch} searchPlaceholder="Search members, payments, groups…"/>

          <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
              {isOffline && (<div role="status" aria-live="polite" className="bg-destructive/10 text-destructive px-6 md:px-10 py-3 text-xs font-semibold flex items-center gap-2 border-b border-destructive/20 uppercase tracking-wide">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" aria-hidden="true"/>
                  <span>No internet connection — working offline</span>
                </div>)}
              <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
          </main>

          {/* Mobile Bottom Navigation */}
          <MobileNavigation activePage={effectivePage} onNavigate={setPage} onPrimaryAction={() => {
            if (authUser?.role === 'member')
                setPayOpen(true);
            else
                setQuickActionsOpen(true);
        }} className="md:hidden"/>
        </div>

        {payOpen && authUser?.role === 'member' && (() => {
            const me = users.find(u => u.id === authUser.id) || authUser;
            const myGroup = groups.find(g => g.id === me?.groupId);
            if (!myGroup) {
                // Member without a group can't pay yet. Close and bounce to portal.
                setPayOpen(false);
                return null;
            }
            return <PayModal group={myGroup} user={me} onClose={() => setPayOpen(false)}/>;
        })()}

        {quickActionsOpen && (<QuickActionSheet onClose={() => setQuickActionsOpen(false)} onNavigate={setPage}/>)}

        {profileDrawerOpen && authUser && (() => {
            const fullUser = users.find(u => u.id === authUser.id) || authUser;
            return (<MemberDrawer user={fullUser} onClose={() => setProfileDrawerOpen(false)}/>);
        })()}

        {notificationsOpen && (<NotificationsPanel onClose={() => setNotificationsOpen(false)} onNavigate={setPage}/>)}
      </div>);
}
/** Branded fallback shown while a lazy page chunk is loading. */
function PageFallback() {
    return (<div className="flex flex-col items-center justify-center py-32 gap-6">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-border"/>
        <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '0.8s' }}/>
        <div className="absolute inset-2 rounded-full border-2 border-t-transparent border-r-primary/40 border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1.4s', animationDirection: 'reverse' }}/>
      </div>
      <p className="eyebrow text-muted-foreground/40">Loading…</p>
    </div>);
}

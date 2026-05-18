import { ShieldAlert } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { canAccess, canAccessPage } from './permissions';
export function RoleGuard({ permission, page, roles, fallback, silent, children }) {
    const { authUser } = useAppContext();
    const role = authUser?.role;
    let allowed = true;
    if (roles && roles.length)
        allowed = !!role && roles.includes(role);
    else if (page)
        allowed = canAccessPage(role, page);
    else if (permission)
        allowed = canAccess(role, permission);
    if (allowed)
        return <>{children}</>;
    if (silent)
        return null;
    return (fallback ?? (<div className="flex flex-col items-center justify-center text-center px-6 py-16 text-muted-foreground">
        <div className="w-14 h-14 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7"/>
        </div>
        <h3 className="text-foreground mb-2">Access restricted</h3>
        <p className="text-sm max-w-sm">
          Your role does not have permission to view this page. Please contact an administrator if
          you believe this is a mistake.
        </p>
      </div>));
}

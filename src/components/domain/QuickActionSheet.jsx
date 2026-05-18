import { X, DollarSign, UserPlus, Users2, Bell } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
const ACTIONS = [
    { id: 'payments', label: 'Record payment', description: 'Capture a new member contribution', icon: DollarSign, tone: 'text-success' },
    { id: 'members', label: 'Add member', description: 'Register a new susu participant', icon: UserPlus, tone: 'text-primary' },
    { id: 'groups', label: 'Create group', description: 'Start a new susu rotation', icon: Users2, tone: 'text-yellow-500' },
    { id: 'reminders', label: 'Send reminder', description: 'Nudge members about payments', icon: Bell, tone: 'text-purple-500' },
];
export function QuickActionSheet({ onClose, onNavigate }) {
    const { authUser } = useAppContext();
    const role = authUser?.role;
    const allowedActions = ACTIONS.filter(action => {
        if (action.id === 'payments')
            return ['admin', 'manager', 'collector'].includes(role || '');
        if (action.id === 'members')
            return ['admin', 'manager'].includes(role || '');
        if (action.id === 'groups')
            return ['admin', 'manager'].includes(role || '');
        if (action.id === 'reminders')
            return ['admin', 'manager', 'collector'].includes(role || '');
        return false;
    });
    return (<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-t-3xl border-t border-x border-border w-full max-w-md p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-5"/>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Quick actions</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted/50">
            <X className="w-5 h-5 text-muted-foreground"/>
          </button>
        </div>

        <div className="space-y-2">
          {allowedActions.map(action => {
            const Icon = action.icon;
            return (<button key={action.id} type="button" onClick={() => { onNavigate(action.id); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-input-background border border-border hover:bg-muted/30 transition-colors text-left">
                <div className={`w-11 h-11 rounded-2xl bg-muted/40 flex items-center justify-center ${action.tone}`}>
                  <Icon className="w-5 h-5"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-bold">{action.label}</p>
                  <p className="text-muted-foreground text-xs">{action.description}</p>
                </div>
              </button>);
        })}
          {allowedActions.length === 0 && (<p className="text-muted-foreground text-sm text-center py-4">
              No quick actions available for your role.
            </p>)}
        </div>
      </div>
    </div>);
}

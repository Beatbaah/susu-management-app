import { useState } from 'react';
import { X, Shield } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { fmt } from '../../utils/helpers';
export function AssignGroupModal({ memberId, onClose, onAssigned }) {
    const { groups, assignUserToGroup } = useAppContext();
    const [selected, setSelected] = useState('');
    const [error, setError] = useState(null);
    const confirm = () => {
        if (!selected) {
            setError('Choose a group to continue.');
            return;
        }
        assignUserToGroup(memberId, selected);
        onAssigned ? onAssigned() : onClose();
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl flex flex-col max-h-[85dvh]" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 pt-4 sm:pt-5 pb-4 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary"/>
            </div>
            <h3 className="text-base font-bold">Assign to Group</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-start gap-2 bg-primary/10 border border-primary/30 rounded-xl p-3 mb-4 text-primary text-xs">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5"/>
            <span>
              Only approved members can be assigned. Once assigned, they will see their group on their dashboard
              and be able to record contributions.
            </span>
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium text-foreground/70 mb-1.5 block">
              Select group
            </label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full bg-card border-2 border-border rounded-xl px-4 py-3.5 text-sm text-foreground">
              <option value="">Choose a group…</option>
              {groups.map(g => (<option key={g.id} value={g.id}>
                  {g.groupName || g.name} — {fmt(g.contributionAmount || g.contribution || 0)}/{g.frequency || 'period'}
                </option>))}
            </select>
          </div>

          {error && <p className="text-destructive text-sm mb-3">{error}</p>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-border/50 bg-card flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 bg-muted border border-border py-3 rounded-xl text-sm font-semibold text-foreground/70 hover:text-foreground transition-all">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={!selected} className={`flex-[1.5] py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${selected ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'}`}>
            Confirm Assignment
          </button>
        </div>
      </div>
    </div>);
}

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
    return (<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-3xl border border-border w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Assign to Group</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted/50">
            <X className="w-5 h-5 text-muted-foreground"/>
          </button>
        </div>

        <div className="flex items-start gap-2 bg-primary/10 border border-primary/30 rounded-xl p-3 mb-4 text-primary text-xs">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5"/>
          <span>
            Only approved members can be assigned. Once assigned, they will see their group on their dashboard
            and be able to record contributions.
          </span>
        </div>

        <div className="mb-4">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Select group
          </label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full bg-input-background border border-border rounded-xl px-3 py-3 text-foreground">
            <option value="">Choose a group…</option>
            {groups.map(g => (<option key={g.id} value={g.id}>
                {g.groupName || g.name} — {fmt(g.contributionAmount || g.contribution || 0)}/{g.frequency || 'period'}
              </option>))}
          </select>
        </div>

        {error && <p className="text-destructive text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 bg-card border border-border py-3 rounded-xl text-foreground">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={!selected} className={`flex-1 py-3 rounded-xl ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            Confirm assignment
          </button>
        </div>
      </div>
    </div>);
}

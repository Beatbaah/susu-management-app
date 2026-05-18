const VALID_FREQUENCIES = new Set(['Daily', 'Weekly', 'Bi-weekly', 'Monthly']);
export function validateGroup(draft) {
    const name = (draft.groupName || draft.name || '').trim();
    const amount = Number(draft.contributionAmount ?? draft.contribution);
    const rounds = Number(draft.totalRounds ?? draft.totalSlots);
    if (name.length < 2)
        return { ok: false, message: 'Group name is required.' };
    if (!Number.isFinite(amount) || amount <= 0)
        return { ok: false, message: 'Contribution must be greater than zero.' };
    if (!Number.isFinite(rounds) || rounds <= 0)
        return { ok: false, message: 'Total rounds must be greater than zero.' };
    if (draft.frequency && !VALID_FREQUENCIES.has(draft.frequency)) {
        return { ok: false, message: 'Frequency must be Daily, Weekly, Bi-weekly, or Monthly.' };
    }
    return { ok: true };
}

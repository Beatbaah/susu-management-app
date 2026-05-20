import { ChevronLeft, ChevronRight, CalendarDays, Calendar as CalendarIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fmt } from '../utils/helpers';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function buildCalendarCells(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

const EVENT_STYLES = {
    due:     { dot: 'bg-primary',     bar: 'bg-primary/15 text-primary border-primary/20' },
    overdue: { dot: 'bg-destructive', bar: 'bg-destructive/15 text-destructive border-destructive/20' },
    paid:    { dot: 'bg-success',     bar: 'bg-success/15 text-success border-success/20' },
    payout:  { dot: 'bg-warning',     bar: 'bg-warning/15 text-warning border-warning/20' },
};

export function Calendar() {
    const { payments, schedule, users, groups, authUser } = useAppContext();
    const today = new Date();
    const [cur, setCur] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [selectedDay, setSelectedDay] = useState(null);

    const prev = () => setCur(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
    const next = () => setCur(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
    const goToday = () => { setCur({ year: today.getFullYear(), month: today.getMonth() }); setSelectedDay(today.getDate()); };

    const visiblePayments = useMemo(() => {
        if (authUser?.role === 'member') return payments.filter(p => (p.memberId || p.userId) === authUser.id);
        return payments;
    }, [payments, authUser]);

    const eventsByDay = useMemo(() => {
        const map = new Map();
        const add = (day, ev) => {
            if (!map.has(day)) map.set(day, []);
            map.get(day).push(ev);
        };
        visiblePayments.forEach(p => {
            if (!p.dueDate) return;
            const d = new Date(p.dueDate);
            if (d.getFullYear() !== cur.year || d.getMonth() !== cur.month) return;
            const member = users.find(u => u.id === (p.memberId || p.userId));
            const group = groups.find(g => g.id === p.groupId);
            add(d.getDate(), {
                type: p.status === 'overdue' ? 'overdue' : p.status === 'paid' ? 'paid' : 'due',
                label: member?.fullName || member?.name || 'Payment',
                sub: group?.groupName || group?.name || '',
                amount: Number(p.amount || 0),
            });
        });
        schedule.forEach(s => {
            if (!s.date) return;
            const d = new Date(s.date);
            if (d.getFullYear() !== cur.year || d.getMonth() !== cur.month) return;
            const member = users.find(u => u.id === (s.memberId || s.recipientId));
            const group = groups.find(g => g.id === s.groupId);
            add(d.getDate(), {
                type: 'payout',
                label: member?.fullName || member?.name || 'Payout',
                sub: group?.groupName || group?.name || '',
                amount: Number(s.amount || 0),
            });
        });
        return map;
    }, [visiblePayments, schedule, users, groups, cur]);

    const cells = useMemo(() => buildCalendarCells(cur.year, cur.month), [cur]);
    const isToday = (d) => d && today.getFullYear() === cur.year && today.getMonth() === cur.month && today.getDate() === d;

    const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) || []) : [];

    const monthSummary = useMemo(() => {
        let dueCount = 0, dueAmount = 0, payoutCount = 0, payoutAmount = 0;
        eventsByDay.forEach(evs => evs.forEach(e => {
            if (e.type === 'due' || e.type === 'overdue') { dueCount++; dueAmount += e.amount; }
            if (e.type === 'payout') { payoutCount++; payoutAmount += e.amount; }
        }));
        return { dueCount, dueAmount, payoutCount, payoutAmount };
    }, [eventsByDay]);

    return (
        <div className="pb-[calc(9rem+env(safe-area-inset-bottom,0px))] page-enter">
            <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-6">
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                                <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary"/>
                            </div>
                            <p className="eyebrow text-muted-foreground">Schedule</p>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-1">Calendar</h1>
                        <p className="text-muted-foreground text-sm">Payment due dates and payout events.</p>
                    </div>
                    <button type="button" onClick={goToday} className="mt-1 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors flex-shrink-0">
                        Today
                    </button>
                </div>

                {/* Month summary */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                    <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary"/>
                        </span>
                        <div className="min-w-0">
                            <p className="text-lg font-bold text-foreground">{monthSummary.dueCount}</p>
                            <p className="eyebrow text-muted-foreground">Payments Due</p>
                            {monthSummary.dueAmount > 0 && <p className="text-xs font-semibold text-primary tabular-nums truncate">{fmt(monthSummary.dueAmount)}</p>}
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center flex-shrink-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-warning"/>
                        </span>
                        <div className="min-w-0">
                            <p className="text-lg font-bold text-foreground">{monthSummary.payoutCount}</p>
                            <p className="eyebrow text-muted-foreground">Payouts</p>
                            {monthSummary.payoutAmount > 0 && <p className="text-xs font-semibold text-warning tabular-nums truncate">{fmt(monthSummary.payoutAmount)}</p>}
                        </div>
                    </div>
                </div>

                {/* Month navigation */}
                <div className="flex items-center justify-between mb-3">
                    <button type="button" onClick={prev} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted/30 transition-colors">
                        <ChevronLeft className="w-4 h-4 text-foreground"/>
                    </button>
                    <h2 className="text-base font-bold text-foreground">{MONTHS[cur.month]} {cur.year}</h2>
                    <button type="button" onClick={next} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted/30 transition-colors">
                        <ChevronRight className="w-4 h-4 text-foreground"/>
                    </button>
                </div>

                {/* Calendar grid */}
                <div className="bg-card rounded-2xl border border-border overflow-hidden mb-4">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 border-b border-border bg-muted/20">
                        {DAYS_SHORT.map(d => (
                            <div key={d} className="py-2 text-center eyebrow text-muted-foreground text-[10px]">{d}</div>
                        ))}
                    </div>

                    {/* Cells */}
                    <div className="grid grid-cols-7">
                        {cells.map((day, idx) => {
                            const events = day ? (eventsByDay.get(day) || []) : [];
                            const isSelected = day === selectedDay;
                            const today_ = isToday(day);
                            const isLastRow = idx >= cells.length - 7;
                            const isLastCol = (idx + 1) % 7 === 0;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    disabled={!day}
                                    onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                                    className={`min-h-[72px] sm:min-h-[88px] p-1.5 text-left transition-colors ${!isLastRow ? 'border-b border-border' : ''} ${!isLastCol ? 'border-r border-border' : ''} ${day ? 'hover:bg-muted/20 cursor-pointer' : 'cursor-default'} ${isSelected ? 'bg-primary/8' : ''}`}
                                >
                                    {day && (
                                        <>
                                            <span className={`text-xs font-bold flex items-center justify-center w-5 h-5 rounded-full mb-1 ${today_ ? 'bg-primary text-primary-foreground' : isSelected ? 'text-primary' : 'text-foreground'}`}>
                                                {day}
                                            </span>
                                            <div className="space-y-0.5">
                                                {events.slice(0, 2).map((e, i) => (
                                                    <div key={i} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-semibold border ${EVENT_STYLES[e.type]?.bar || ''}`}>
                                                        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${EVENT_STYLES[e.type]?.dot || ''}`}/>
                                                        <span className="truncate">{e.label}</span>
                                                    </div>
                                                ))}
                                                {events.length > 2 && (
                                                    <p className="text-[9px] text-muted-foreground pl-1">+{events.length - 2}</p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-4">
                    {[
                        { key: 'due',     label: 'Payment Due' },
                        { key: 'overdue', label: 'Overdue' },
                        { key: 'paid',    label: 'Paid' },
                        { key: 'payout',  label: 'Payout Day' },
                    ].map(l => (
                        <div key={l.key} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${EVENT_STYLES[l.key].dot}`}/>
                            <span className="text-xs text-muted-foreground">{l.label}</span>
                        </div>
                    ))}
                </div>

                {/* Selected day detail */}
                {selectedDay && (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                            <h3 className="font-bold text-foreground text-sm">
                                {MONTHS[cur.month]} {selectedDay}, {cur.year}
                            </h3>
                            <button type="button" onClick={() => setSelectedDay(null)} className="text-xs text-muted-foreground hover:text-foreground">
                                Clear
                            </button>
                        </div>
                        {selectedEvents.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                                <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
                                <p className="text-sm text-muted-foreground">No events on this day</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {selectedEvents.map((e, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${EVENT_STYLES[e.type].dot}`}/>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{e.label}</p>
                                            {e.sub && <p className="text-xs text-muted-foreground truncate">{e.sub}</p>}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            {e.amount > 0 && <p className="text-sm font-bold text-foreground">{fmt(e.amount)}</p>}
                                            <p className={`text-xs font-bold capitalize ${EVENT_STYLES[e.type].bar.split(' ').find(c => c.startsWith('text-')) || 'text-muted-foreground'}`}>
                                                {e.type === 'due' ? 'Due' : e.type === 'paid' ? 'Paid' : e.type === 'overdue' ? 'Overdue' : 'Payout'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

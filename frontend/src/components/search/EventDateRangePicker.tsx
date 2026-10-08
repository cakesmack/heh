import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { calendarDate, parseCalendarDate, quickDateRange, rangeLabel, type EventDateRange } from '@/lib/eventDateRange';

export default function EventDateRangePicker({ value, onChange, dark = false }: {
  value: EventDateRange; onChange: (range: EventDateRange) => void; dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EventDateRange>(value);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const reposition = () => setOpen(false);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);
  const select = (range?: DateRange) => setDraft(range?.from ? { from: calendarDate(range.from), to: range.to ? calendarDate(range.to) : undefined } : {});
  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${dark ? 'border-white/30 bg-black/30 text-white hover:bg-black/50' : 'border-gray-300 bg-white text-highland-green hover:bg-emerald-50'}`}
      onClick={() => {
        if (open) { close(); return; }
        const rect = trigger.current!.getBoundingClientRect();
        setDraft(value);
        setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 352)), top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 460)) });
        setOpen(true);
      }}><CalendarDays aria-hidden="true" className="h-4 w-4" />{rangeLabel(value)}</button>
    {open && createPortal(<div ref={panel} id={id} role="dialog" aria-label="Choose event dates"
      style={position} className="fixed z-[100] w-[344px] max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-auto rounded-2xl border border-gray-200 bg-white p-3 text-gray-900 shadow-2xl">
      <div className="flex flex-wrap gap-2 pb-2">
        {([['today', 'Today'], ['weekend', 'This weekend'], ['week', 'Next 7 days']] as const).map(([preset, label]) =>
          <button type="button" key={preset} onClick={() => setDraft(quickDateRange(preset))} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-highland-green hover:bg-emerald-100">{label}</button>)}
      </div>
      <DayPicker mode="range" autoFocus defaultMonth={parseCalendarDate(draft.from)}
        selected={draft.from ? { from: parseCalendarDate(draft.from), to: parseCalendarDate(draft.to) } : undefined}
        onSelect={select} style={{ '--rdp-accent-color': '#0B3B2C', '--rdp-day-width': '40px', '--rdp-day-height': '40px' } as React.CSSProperties} />
      <p className="my-2 text-sm text-gray-600" aria-live="polite">{rangeLabel(draft)}{draft.from && !draft.to ? ' · Apply for one day, or choose a finish date.' : ''}</p>
      <div className="flex justify-between gap-3 border-t border-gray-100 pt-3">
        <button type="button" onClick={() => { onChange({}); close(); }} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Clear</button>
        <button type="button" onClick={() => { onChange(draft.from ? { from: draft.from, to: draft.to || draft.from } : {}); close(); }} className="rounded-xl bg-highland-green px-5 py-2 text-sm font-bold text-white hover:bg-moss-green">Apply</button>
      </div>
    </div>, document.body)}
  </>;
}

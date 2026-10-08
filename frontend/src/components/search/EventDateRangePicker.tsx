import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { calendarDate, parseCalendarDate, quickDateRange, rangeLabel, type EventDateRange } from '@/lib/eventDateRange';
import styles from './EventDateRangePicker.module.css';

export default function EventDateRangePicker({ value, onChange, dark = false }: {
  value: EventDateRange; onChange: (range: EventDateRange) => void; dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EventDateRange>(value);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [fontFamily, setFontFamily] = useState<string>();
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
        // The body portal sits outside _app's Inter wrapper; reuse its font.
        setFontFamily(window.getComputedStyle(trigger.current!).fontFamily);
        setDraft(value);
        setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 368)), top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 460)) });
        setOpen(true);
      }}><CalendarDays aria-hidden="true" className="h-4 w-4" />{rangeLabel(value)}</button>
    {open && createPortal(<div ref={panel} id={id} role="dialog" aria-label="Choose event dates"
      style={{ ...position, fontFamily }} className="fixed z-[100] w-[360px] max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 font-sans text-stone-dark shadow-card-hover">
      <div className="flex flex-wrap gap-2 pb-3">
        {([['today', 'Today'], ['weekend', 'This weekend'], ['week', 'Next 7 days']] as const).map(([preset, label]) =>
          <button type="button" key={preset} onClick={() => setDraft(quickDateRange(preset))} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-highland-green transition-colors hover:border-moss-green hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss-green focus-visible:ring-offset-2">{label}</button>)}
      </div>
      <DayPicker mode="range" autoFocus defaultMonth={parseCalendarDate(draft.from)}
        selected={draft.from ? { from: parseCalendarDate(draft.from), to: parseCalendarDate(draft.to) } : undefined}
        onSelect={select} className={styles.calendar} components={{ Chevron: ({ orientation, className }) => {
          const Icon = orientation === 'left' ? ChevronLeft : orientation === 'up' ? ChevronUp : orientation === 'down' ? ChevronDown : ChevronRight;
          return <Icon aria-hidden="true" className={className} size={18} />;
        } }} />
      <div className="mt-3 border-t border-gray-200 pt-3">
        <p className="mb-3 text-xs leading-5 text-gray-500" aria-live="polite">{rangeLabel(draft)}{draft.from && !draft.to ? ' · Apply for one day, or choose a finish date.' : ''}</p>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => { onChange({}); close(); }} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss-green focus-visible:ring-offset-2">Clear</button>
          <button type="button" onClick={() => { onChange(draft.from ? { from: draft.from, to: draft.to || draft.from } : {}); close(); }} className="rounded-lg bg-highland-green px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss-green focus-visible:ring-offset-2">Apply</button>
        </div>
      </div>
    </div>, document.body)}
  </>;
}

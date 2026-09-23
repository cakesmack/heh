import { useState } from 'react';
import { CalendarDays, CalendarRange, Repeat2, Plus, Clock3 } from 'lucide-react';
import DateTimePicker from '@/components/common/DateTimePicker';
import type { GuidedEventDraft, Performance, RecurrenceSchedule, ScheduleDateTime, ScheduleMode } from './guidedEventTypes';
import { addLocalDay, formatLocalDateTime, scheduleSummary, validateInterval } from './scheduleHelpers';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fieldClass = 'w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-stone-dark focus:border-moss-green focus:ring-2 focus:ring-moss-green/30';

interface Props {
  draft: GuidedEventDraft;
  part: number;
  error?: string;
  onModeChange: (mode: ScheduleMode) => void;
  onOnceChange: (patch: Partial<ScheduleDateTime>) => void;
  onPerformancesChange: (items: Performance[]) => void;
  onRecurrenceChange: (patch: Partial<RecurrenceSchedule>) => void;
  onceEndReset?: boolean;
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <label htmlFor={id} className="block space-y-2 text-sm font-semibold text-gray-800">
    <span>{label}</span>
    <input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass} />
  </label>;
}

function OnceFields({ draft, onChange, endReset }: { draft: GuidedEventDraft; onChange: Props['onOnceChange']; endReset?: boolean }) {
  const { once } = draft;
  return <div className="space-y-6">
    <label className="flex items-center gap-3 text-sm font-semibold text-gray-800">
      <input type="checkbox" checked={once.allDay} onChange={(event) => onChange({ allDay: event.target.checked })} className="h-5 w-5 rounded border-gray-300 text-moss-green focus:ring-moss-green" />
      All day event
    </label>
    <div>
      <label htmlFor="schedule-once-start" className="mb-2 block text-sm font-semibold text-gray-800">Start {once.allDay ? 'date' : 'date and time'} *</label>
      {once.allDay
        ? <input id="schedule-once-start" type="date" value={once.start.slice(0, 10)} onChange={(event) => onChange({ start: event.target.value })} className={fieldClass} />
        : <DateTimePicker id="schedule-once-start" name="schedule-once-start" value={once.start} onChange={(start) => onChange({ start })} required />}
    </div>
    <div>
      <label htmlFor="schedule-once-end" className="mb-2 block text-sm font-semibold text-gray-800">Finish {once.allDay ? 'date' : 'date and time'} *</label>
      {once.allDay
        ? <input id="schedule-once-end" type="date" min={once.start.slice(0, 10) || undefined} value={once.end.slice(0, 10)} onChange={(event) => onChange({ end: event.target.value })} className={fieldClass} />
        : <DateTimePicker id="schedule-once-end" name="schedule-once-end" value={once.end} min={once.start || undefined} onChange={(end) => onChange({ end })} required />}
    </div>
    {endReset && <p role="status" className="text-sm font-semibold text-amber-900">The previous finish no longer followed your start, so it was cleared. Choose a new finish.</p>}
    {once.start && once.end && validateInterval(once.start, once.end, once.allDay) && <p role="status" className="text-sm font-semibold text-amber-900">The finish must be after the start. On the same date, choose a later time.</p>}
    <p className="text-sm text-gray-500">Times are in UK event-local time. For overnight or multi-day events, choose the actual finish date. All-day finish dates are inclusive.</p>
    {once.start && once.end && !validateInterval(once.start, once.end, once.allDay) &&
      <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-highland-green">
        <strong>One continuous event</strong><span className="block mt-1">{formatLocalDateTime(once.start, once.allDay)} → {formatLocalDateTime(once.end, once.allDay)} · UK time</span>
      </div>}
  </div>;
}

function PerformanceFields({ items, onChange }: { items: Performance[]; onChange: Props['onPerformancesChange'] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const sorted = [...items].sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));
  const update = (id: string, patch: Partial<Performance>) => onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const add = (source?: Performance) => {
    const date = source?.start.slice(0, 10) || '';
    const nextDate = date ? addLocalDay(date) : '';
    const item = {
      id: crypto.randomUUID(),
      start: nextDate ? `${nextDate}T${source?.start.slice(11, 16)}` : '',
      end: nextDate ? `${addLocalDay(source!.end.slice(0, 10))}T${source!.end.slice(11, 16)}` : '',
    };
    onChange([...items, item]);
    setEditingId(item.id);
  };
  return <div className="space-y-5">
    <p className="text-sm text-gray-600">Add each performance separately, including two shows on the same day. Times are in UK event-local time.</p>
    <div aria-live="polite" className="space-y-3">
      {sorted.map((item, index) => {
        const open = editingId === item.id || !item.start || !item.end;
        return <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-moss-green">Performance {index + 1}</p>
              <p className="mt-1 font-semibold text-highland-green">{item.start ? formatLocalDateTime(item.start) : 'Date and time to add'}</p>
              {item.end && <p className="text-sm text-gray-600">to {formatLocalDateTime(item.end)}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditingId(open ? null : item.id)} className="rounded-lg px-2 py-1 text-sm font-semibold text-moss-green hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-moss-green">{open ? 'Done' : 'Edit'}</button>
              {item.start && item.end && <button type="button" onClick={() => add(item)} className="rounded-lg px-2 py-1 text-sm font-semibold text-moss-green hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-moss-green">Reuse times</button>}
              <button type="button" onClick={() => { onChange(items.filter((entry) => entry.id !== item.id)); if (editingId === item.id) setEditingId(null); }} className="rounded-lg px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600" aria-label={`Remove performance ${index + 1}`}>Remove</button>
            </div>
          </div>
          {open && <div className="mt-5 grid gap-5 border-t border-gray-100 pt-5 sm:grid-cols-2">
            <div><label htmlFor={`performance-start-${item.id}`} className="mb-2 block text-sm font-semibold">Start *</label><DateTimePicker id={`performance-start-${item.id}`} name={`performance-start-${item.id}`} value={item.start} onChange={(start) => update(item.id, { start })} required /></div>
            <div><label htmlFor={`performance-end-${item.id}`} className="mb-2 block text-sm font-semibold">Finish *</label><DateTimePicker id={`performance-end-${item.id}`} name={`performance-end-${item.id}`} value={item.end} onChange={(end) => update(item.id, { end })} required /></div>
          </div>}
        </div>;
      })}
    </div>
    <button id="schedule-add-performance" type="button" onClick={() => add()} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-moss-green/40 text-sm font-bold text-moss-green hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-moss-green"><Plus aria-hidden="true" className="h-4 w-4" /> Add another date or time</button>
    {items.length > 0 && <p className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'performance' : 'performances'} selected · listed chronologically</p>}
  </div>;
}

function RecurringFields({ rule, part, onChange }: { rule: RecurrenceSchedule; part: number; onChange: Props['onRecurrenceChange'] }) {
  if (part === 1) return <div className="space-y-6">
    <DateField id="recurrence-first-date" label="First event date *" value={rule.startDate} onChange={(startDate) => onChange({ startDate })} />
    <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={rule.allDay} onChange={(event) => onChange({ allDay: event.target.checked })} className="h-5 w-5 rounded text-moss-green" /> All day</label>
    {!rule.allDay && <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor="recurrence-start-time" className="space-y-2 text-sm font-semibold"><span>Starts at *</span><input id="recurrence-start-time" type="time" step="900" value={rule.startTime} onChange={(event) => onChange({ startTime: event.target.value })} className={fieldClass} /></label>
      <label htmlFor="recurrence-end-time" className="space-y-2 text-sm font-semibold"><span>Finishes at *</span><input id="recurrence-end-time" type="time" step="900" value={rule.endTime} onChange={(event) => onChange({ endTime: event.target.value })} className={fieldClass} /></label>
      <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={rule.endsNextDay} onChange={(event) => onChange({ endsNextDay: event.target.checked })} className="h-5 w-5 rounded text-moss-green" /> Finishes the next day</label>
    </div>}
    <p className="text-sm text-gray-500">The same event-local UK time applies to each repeat. Clock-change times that are missing or ambiguous need correction.</p>
  </div>;
  if (part === 2) return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor="recurrence-frequency" className="space-y-2 text-sm font-semibold"><span>Frequency *</span><select id="recurrence-frequency" value={rule.frequency} onChange={(event) => onChange({ frequency: event.target.value as RecurrenceSchedule['frequency'] })} className={fieldClass}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label htmlFor="recurrence-interval" className="space-y-2 text-sm font-semibold"><span>Repeat every *</span><input id="recurrence-interval" type="number" min="1" max="100" value={rule.interval} onChange={(event) => onChange({ interval: Number(event.target.value) })} className={fieldClass} /></label>
    </div>
    {rule.frequency === 'weekly' && <fieldset><legend className="mb-3 text-sm font-semibold">Repeat on these days *</legend><div className="flex flex-wrap gap-2">{weekdays.map((day, index) => <button type="button" key={day} aria-pressed={rule.weekdays.includes(index)} onClick={() => onChange({ weekdays: rule.weekdays.includes(index) ? rule.weekdays.filter((item) => item !== index) : [...rule.weekdays, index].sort() })} className={`min-h-[44px] rounded-full border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-moss-green ${rule.weekdays.includes(index) ? 'border-moss-green bg-moss-green text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{day.slice(0, 3)}</button>)}</div></fieldset>}
    {rule.frequency === 'monthly' && <fieldset className="space-y-3"><legend className="text-sm font-semibold">Monthly pattern</legend>
      <label className="flex gap-2 text-sm"><input type="radio" name="monthly-mode" checked={rule.monthlyMode === 'date'} onChange={() => onChange({ monthlyMode: 'date' })} /> Same calendar date as the first event</label>
      <label className="flex gap-2 text-sm"><input type="radio" name="monthly-mode" checked={rule.monthlyMode === 'ordinal'} onChange={() => onChange({ monthlyMode: 'ordinal' })} /> A weekday position in the month</label>
      {rule.monthlyMode === 'ordinal' && <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm font-semibold"><span>Which week</span><select value={rule.ordinal} onChange={(event) => onChange({ ordinal: Number(event.target.value) })} className={fieldClass}>{[[1, 'First'], [2, 'Second'], [3, 'Third'], [4, 'Fourth'], [-1, 'Last']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="space-y-2 text-sm font-semibold"><span>Weekday</span><select value={rule.ordinalWeekday} onChange={(event) => onChange({ ordinalWeekday: Number(event.target.value) })} className={fieldClass}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label></div>}
    </fieldset>}
  </div>;
  return <div className="space-y-6">
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">When should it stop?</legend>
      <label className="flex gap-3 rounded-xl border border-gray-200 p-4 text-sm"><input type="radio" name="recurrence-ending" checked={rule.endsOn === 'date'} onChange={() => onChange({ endsOn: 'date' })} /> On a date</label>
      <label className="flex gap-3 rounded-xl border border-gray-200 p-4 text-sm"><input type="radio" name="recurrence-ending" checked={rule.endsOn === 'ongoing'} onChange={() => onChange({ endsOn: 'ongoing' })} /> Ongoing</label>
    </fieldset>
    {rule.endsOn === 'date' && <DateField id="recurrence-end-date" label="Last date *" value={rule.endDate} onChange={(endDate) => onChange({ endDate })} />}
    {rule.endsOn === 'ongoing' && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Ongoing is a saved preview choice. Automatic future-date generation and extension must be verified before this form can publish recurring events.</p>}
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-highland-green"><strong>Selected rule</strong><p className="mt-1">{scheduleSummary({ scheduleMode: 'recurring', recurrence: rule } as GuidedEventDraft)}</p><p className="mt-2 text-xs text-gray-600">This describes your settings; it is not a generated list of dates.</p></div>
  </div>;
}

export function ScheduleQuestion({ draft, part, error, onModeChange, onOnceChange, onPerformancesChange, onRecurrenceChange, onceEndReset }: Props) {
  if (part === 0) return <div className="space-y-5">
    <fieldset><legend className="sr-only">Choose a schedule type</legend><div className="grid gap-3 sm:grid-cols-3">
      {([
        { mode: 'once', title: 'Just once', copy: 'One event, even if it lasts several days.', icon: CalendarDays },
        { mode: 'recurring', title: 'It repeats regularly', copy: 'For example, a weekly class or monthly market.', icon: Repeat2 },
        { mode: 'selected_dates', title: 'Several dates or times', copy: 'Choose each performance individually.', icon: CalendarRange },
      ] as const).map(({ mode, title, copy, icon: Icon }) => <label key={mode} className={`flex min-h-[148px] cursor-pointer flex-col gap-2 rounded-2xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-moss-green ${draft.scheduleMode === mode ? 'border-moss-green bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
        <input id={`schedule-mode-${mode}`} type="radio" name="schedule-mode" value={mode} checked={draft.scheduleMode === mode} onChange={() => onModeChange(mode)} className="sr-only" />
        <Icon aria-hidden="true" className="h-5 w-5 text-moss-green" /><span className="font-bold text-highland-green">{title}</span><span className="text-sm leading-5 text-gray-600">{copy}</span>
      </label>)}</div></fieldset>
    {draft.scheduleMode && <p className="rounded-xl bg-loch-blue/5 p-3 text-sm text-gray-600">Your dates for each choice are kept if you switch between scheduling modes.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
  return <div className="space-y-6">
    <div className="flex items-center gap-2 text-sm font-semibold text-moss-green"><Clock3 aria-hidden="true" className="h-4 w-4" /> UK event-local time</div>
    {draft.scheduleMode === 'once' && <OnceFields draft={draft} onChange={onOnceChange} endReset={onceEndReset} />}
    {draft.scheduleMode === 'selected_dates' && <PerformanceFields items={draft.performances} onChange={onPerformancesChange} />}
    {draft.scheduleMode === 'recurring' && <RecurringFields rule={draft.recurrence} part={part} onChange={onRecurrenceChange} />}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}

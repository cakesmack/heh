import React from 'react';
import { Input } from '@/components/common/Input';
import DateTimePicker from '@/components/common/DateTimePicker';
import FormSection from '../FormSection';
import { ShowtimeCreate } from '@/types';
import { RRule, Frequency, Weekday, rrulestr } from 'rrule';
import { useState, useEffect } from 'react';

// Day mapping for RRule
const dayMap: { [key: string]: Weekday } = {
    'Mon': RRule.MO, 'Tue': RRule.TU, 'Wed': RRule.WE,
    'Thu': RRule.TH, 'Fri': RRule.FR, 'Sat': RRule.SA, 'Sun': RRule.SU
};

interface EventScheduleSectionProps {
    formData: any;
    setFormData: (data: any) => void;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    isMultiSession: boolean;
    setIsMultiSession: (isMulti: boolean) => void;
    showtimes: ShowtimeCreate[];
    setShowtimes: (showtimes: ShowtimeCreate[]) => void;
    noEndTime: boolean;
    setNoEndTime: (noEnd: boolean) => void;
    isAllDay: boolean;
    setIsAllDay: (isAllDay: boolean) => void;
}

export default function EventScheduleSection({
    formData,
    setFormData,
    handleChange,
    isMultiSession,
    setIsMultiSession,
    showtimes,
    setShowtimes,
    noEndTime,
    setNoEndTime,
    isAllDay,
    setIsAllDay
}: EventScheduleSectionProps) {
    // Custom Recurrence State
    const [customFreq, setCustomFreq] = useState(Frequency.WEEKLY);
    const [customInterval, setCustomInterval] = useState(1);
    const [customByWeekday, setCustomByWeekday] = useState<Weekday[]>([]);
    const [monthlyMode, setMonthlyMode] = useState<'DATE' | 'POS'>('DATE');
    const [customBySetPos, setCustomBySetPos] = useState(1);
    const [customPosDay, setCustomPosDay] = useState(RRule.SU.weekday);
    const [ruleText, setRuleText] = useState('');
    const [isHydrated, setIsHydrated] = useState(false);

    // Hydrate internal state from formData.recurrence_rule on mount/change
    useEffect(() => {
        // If not custom or already hydrated or no rule, just mark as hydrated and skip
        if (formData.frequency !== 'CUSTOM' || !formData.recurrence_rule || isHydrated) {
            if (!isHydrated) setIsHydrated(true);
            return;
        }

        try {
            const rule = rrulestr(formData.recurrence_rule);
            setCustomFreq(rule.options.freq);
            setCustomInterval(rule.options.interval);

            if (rule.options.byweekday) {
                // rrule byweekday is sometimes an array of Weekday objects or numbers
                // We need to cast it safely to our customByWeekday state
                // The rrule library types are a bit loose, usually it's [Weekday]
                // Let's assume standard RRule object behavior
                const weekdays = Array.isArray(rule.options.byweekday)
                    ? rule.options.byweekday
                    : [rule.options.byweekday];
                setCustomByWeekday(weekdays as unknown as Weekday[]);
            } else {
                setCustomByWeekday([]);
            }

            if (rule.options.freq === RRule.MONTHLY) {
                if (rule.options.bysetpos) {
                    setMonthlyMode('POS');
                    const pos = Array.isArray(rule.options.bysetpos) ? rule.options.bysetpos[0] : rule.options.bysetpos;
                    setCustomBySetPos(pos);

                    if (rule.options.byweekday) {
                        const days = Array.isArray(rule.options.byweekday) ? rule.options.byweekday : [rule.options.byweekday];
                        if (days.length > 0) {
                            // days[0] matches the Weekday interface { weekday: number } or is a number
                            // internal state expects just the number for customPosDay
                            const firstDay = days[0] as unknown as (Weekday | number);
                            const dayNum = typeof firstDay === 'number' ? firstDay : firstDay.weekday;
                            setCustomPosDay(dayNum);
                        }
                    }
                } else {
                    setMonthlyMode('DATE');
                }
            }

            setIsHydrated(true);
        } catch (e) {
            console.error("Failed to hydrate custom rule:", e);
            setIsHydrated(true); // Prevent infinite retry
        }
    }, [formData.frequency, formData.recurrence_rule, isHydrated]);


    // Effect: Generate RRULE string when custom settings change
    useEffect(() => {
        if (formData.frequency !== 'CUSTOM' || !isHydrated) return;

        try {
            const options: any = {
                freq: customFreq,
                interval: customInterval,
            };

            // ByWeekday for Weekly
            if (customFreq === RRule.WEEKLY && customByWeekday.length > 0) {
                options.byweekday = customByWeekday;
            }

            // Monthly options
            if (customFreq === RRule.MONTHLY) {
                if (monthlyMode === 'POS') {
                    // e.g. 1st Sunday: bysetpos=1, byweekday=SU
                    options.bysetpos = customBySetPos;
                    // Find the Weekday object matching customPosDay
                    const day = Object.values(dayMap).find(d => d.weekday === customPosDay) || RRule.SU;
                    options.byweekday = [day];
                }
                // default is bymonthday (date), which RRule infers from start date if not specified.
                // But generally safer to leave it implicit or use start date. 
                // RRule defaults to using dtstart to set the "byxxx".
            }

            // Sync UNTIL if end date is set
            if (formData.ends_on === 'date' && formData.recurrence_end_date) {
                options.until = new Date(formData.recurrence_end_date);
            }

            const rule = new RRule(options);
            // Strip "RRULE:" prefix for backend consistency if desired, 
            // but standard rrule.toString() adds it.
            // backend/app/api/events.py currently handles "FREQ=..." manually.
            // Let's strip "RRULE:" to send raw properties string "FREQ=WEEKLY;..."
            const ruleStr = rule.toString().replace(/^RRULE:/, '');

            // Human readable text
            const text = rule.toText();
            if (text) {
                setRuleText(text.charAt(0).toUpperCase() + text.slice(1));
            }

            setFormData((prev: any) => {
                if (prev.recurrence_rule !== ruleStr) {
                    return { ...prev, recurrence_rule: ruleStr };
                }
                return prev;
            });
        } catch (e) {
            console.error("Error generating RRULE:", e);
        }

    }, [customFreq, customInterval, customByWeekday, monthlyMode, customBySetPos, customPosDay, formData.frequency, formData.ends_on, formData.recurrence_end_date, isHydrated]);

    // Format UTC ISO string to Local "YYYY-MM-DDTHH:mm" for input
    const formatDateForInput = (isoString: string | Date | undefined | null) => {

        if (!isoString) return '';

        let date: Date;
        if (typeof isoString === 'string') {
            // Remove 'Z' if present to force Local interpretation
            const safeStr = isoString.endsWith('Z') ? isoString.slice(0, -1) : isoString;
            date = new Date(safeStr);
        } else {
            date = isoString;
        }

        if (isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    return (
        <FormSection
            title="Date & Time"
            description="When is it happening?"
            tipTitle="Scheduling Tips"
            tipContent={
                <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Recurring:</strong> Use this for weekly clubs or classes to avoid creating duplicate events.</li>
                    <li><strong>Multiple Showings:</strong> Perfect for theatre runs or cinema screenings.</li>
                    <li><strong>No End Time:</strong> We'll default it to 4 hours long for calendar purposes.</li>
                </ul>
            }
        >
            {/* Event Type Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Option 1: Single Event */}
                <label className={`flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${!isMultiSession && !formData.is_recurring
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">Single Event</span>
                        <input
                            type="radio"
                            name="eventType"
                            checked={!isMultiSession && !formData.is_recurring}
                            onChange={() => {
                                setIsMultiSession(false);
                                setFormData((prev: any) => ({ ...prev, is_recurring: false }));
                                setShowtimes([]);
                            }}
                            className="text-emerald-600 focus:ring-emerald-500"
                        />
                    </div>
                    <span className="text-xs text-gray-500">One-time event with a start and end time.</span>
                </label>

                {/* Option 2: Recurring Event */}
                <label className={`flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${!isMultiSession && formData.is_recurring
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">Recurring Event</span>
                        <input
                            type="radio"
                            name="eventType"
                            checked={!isMultiSession && formData.is_recurring}
                            onChange={() => {
                                setIsMultiSession(false);
                                setFormData((prev: any) => ({
                                    ...prev,
                                    is_recurring: true,
                                    frequency: prev.frequency || 'WEEKLY' // Default to Weekly
                                }));
                                setShowtimes([]);
                            }}
                            className="text-emerald-600 focus:ring-emerald-500"
                        />
                    </div>
                    <span className="text-xs text-gray-500">Repeats on a schedule (e.g., Weekly Class).</span>
                </label>

                {/* Option 3: Multiple Showings */}
                <label className={`flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${isMultiSession
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">Multiple Showings</span>
                        <input
                            type="radio"
                            name="eventType"
                            checked={isMultiSession}
                            onChange={() => {
                                // Push current dates to first showtime when switching
                                if (formData.date_start) {
                                    setShowtimes([{
                                        start_time: formData.date_start,
                                        end_time: formData.date_end || undefined,
                                    }]);
                                }
                                setIsMultiSession(true);
                                setFormData((prev: any) => ({ ...prev, is_recurring: false }));
                            }}
                            className="text-emerald-600 focus:ring-emerald-500"
                        />
                    </div>
                    <span className="text-xs text-gray-500">Irregular times (e.g., Theatre Run, Cinema).</span>
                </label>
            </div>

            {/* Single Event Date Inputs */}
            {!isMultiSession && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                            <DateTimePicker
                                id="date_start"
                                name="date_start"
                                required
                                value={formData.date_start}
                                onChange={(val) => {
                                    // Smart Date Sync: Update end date when start date changes
                                    const oldStartDate = formData.date_start ? formData.date_start.split('T')[0] : '';
                                    const newStartDate = val.split('T')[0];
                                    const currentEndDate = formData.date_end ? formData.date_end.split('T')[0] : '';

                                    // Sync end date if: empty, matches old start, or is before new start
                                    if (!formData.date_end || currentEndDate === oldStartDate || currentEndDate < newStartDate) {
                                        // Keep the time from end date if it exists, otherwise use start time + 2 hours
                                        const endTime = formData.date_end ? formData.date_end.split('T')[1] : val.split('T')[1];
                                        setFormData({
                                            ...formData,
                                            date_start: val,
                                            date_end: `${newStartDate}T${endTime || '18:00'}`
                                        });
                                    } else {
                                        setFormData((prev: any) => ({ ...prev, date_start: val }));
                                    }
                                }}
                            />
                        </div>
                        {!noEndTime && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                                <DateTimePicker
                                    id="date_end"
                                    name="date_end"
                                    required
                                    value={formData.date_end}
                                    onChange={(val) => setFormData((prev: any) => ({ ...prev, date_end: val }))}
                                    min={formData.date_start}
                                />
                            </div>
                        )}
                    </div>
                    {/* All Day Checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isAllDay}
                            onChange={(e) => {
                                setIsAllDay(e.target.checked);
                                if (e.target.checked) {
                                    setNoEndTime(true); // Force no end time when all day
                                }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-600">All Day Event</span>
                    </label>
                    {isAllDay && (
                        <p className="text-xs text-gray-500">The event spans the entire day (no specific start/end times shown).</p>
                    )}
                    {/* No End Time Checkbox - Only show if not All Day */}
                    {!isAllDay && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={noEndTime}
                                onChange={(e) => setNoEndTime(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-600">No specific end time</span>
                        </label>
                    )}
                    {noEndTime && !isAllDay && (
                        <p className="text-xs text-gray-500">End time will be set to 4 hours after start time.</p>
                    )}
                </div>
            )}

            {/* Multiple Showtimes Manager */}
            {isMultiSession && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">
                        Add performance times. The event's main dates will be calculated automatically.
                    </p>

                    {showtimes.map((st, index) => {
                        const startValue = st.start_time || '';
                        const endValue = st.end_time || '';

                        return (
                            <div key={index} className="flex items-start gap-2 bg-white p-3 rounded border">
                                <div className="flex-1 space-y-2">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Start *</label>
                                            <DateTimePicker
                                                id={`showtime_start_${index}`}
                                                name={`showtime_start_${index}`}
                                                value={startValue}
                                                onChange={(value) => {
                                                    const updated = [...showtimes];
                                                    updated[index] = { ...updated[index], start_time: value };
                                                    setShowtimes(updated);
                                                }}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">End *</label>
                                            <DateTimePicker
                                                id={`showtime_end_${index}`}
                                                name={`showtime_end_${index}`}
                                                value={endValue}
                                                onChange={(value) => {
                                                    const updated = [...showtimes];
                                                    updated[index] = { ...updated[index], end_time: value };
                                                    setShowtimes(updated);
                                                }}
                                                min={startValue}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Ticket Link (Optional)</label>
                                            <input
                                                type="text"
                                                value={st.ticket_url || ''}
                                                onChange={(e) => {
                                                    const updated = [...showtimes];
                                                    updated[index] = { ...updated[index], ticket_url: e.target.value };
                                                    setShowtimes(updated);
                                                }}
                                                onBlur={() => {
                                                    const val = (st.ticket_url || '').trim();
                                                    if (val && !/^https?:\/\//i.test(val)) {
                                                        const updated = [...showtimes];
                                                        updated[index] = { ...updated[index], ticket_url: `https://${val}` };
                                                        setShowtimes(updated);
                                                    }
                                                }}
                                                placeholder="Specific ticket link"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Notes (Optional)</label>
                                            <input
                                                type="text"
                                                value={st.notes || ''}
                                                onChange={(e) => {
                                                    const updated = [...showtimes];
                                                    updated[index] = { ...updated[index], notes: e.target.value };
                                                    setShowtimes(updated);
                                                }}
                                                placeholder="e.g. Matinee"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowtimes(showtimes.filter((_, i) => i !== index))}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Remove"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => {
                            const now = new Date();
                            setShowtimes([...showtimes, {
                                start_time: formatDateForInput(now),
                                end_time: formatDateForInput(new Date(now.getTime() + 2 * 60 * 60 * 1000)),
                            }]);
                        }}
                        className="w-full py-2 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-50 text-sm font-medium"
                    >
                        + Add Another Performance
                    </button>
                </div>
            )}

            {/* Recurring Event Logic */}
            {formData.is_recurring && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="pl-6 border-l-2 border-emerald-100 space-y-4">
                        <select
                            name="frequency"
                            value={formData.frequency}
                            onChange={(e) => {
                                handleChange(e);
                                // Reset custom rule if switching away
                                if (e.target.value !== 'CUSTOM') {
                                    setFormData((prev: any) => ({ ...prev, recurrence_rule: '' }));
                                }
                            }}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="WEEKLY">Weekly</option>
                            <option value="BIWEEKLY">Bi-Weekly</option>
                            <option value="MONTHLY">Monthly</option>
                            <option value="CUSTOM">Custom Pattern</option>
                        </select>

                        {/* Standard Weekday Selector - shown for Weekly/Bi-Weekly */}
                        {(formData.frequency === 'WEEKLY' || formData.frequency === 'BIWEEKLY') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Repeat on these days:</label>
                                <div className="flex gap-2">
                                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                const newWeekdays = formData.weekdays.includes(idx)
                                                    ? formData.weekdays.filter((d: number) => d !== idx)
                                                    : [...formData.weekdays, idx];
                                                setFormData((prev: any) => ({ ...prev, weekdays: newWeekdays }));
                                            }}
                                            className={`w-10 h-10 rounded-full font-bold text-sm transition-colors ${formData.weekdays.includes(idx)
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Select one or more days</p>
                            </div>
                        )}

                        {/* Custom Recurrence Builder */}
                        {formData.frequency === 'CUSTOM' && (
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900">Custom Rule Settings</h4>

                                {/* Frequency & Interval Sentence */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-700">Repeats every</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={customInterval}
                                        onChange={(e) => setCustomInterval(Number(e.target.value))}
                                        className="w-16 px-2 py-1 border rounded-md text-sm text-center"
                                    />
                                    <select
                                        value={customFreq}
                                        onChange={(e) => setCustomFreq(Number(e.target.value))}
                                        className="px-3 py-1 border rounded-md text-sm"
                                    >
                                        <option value={RRule.DAILY}>Day(s)</option>
                                        <option value={RRule.WEEKLY}>Week(s)</option>
                                        <option value={RRule.MONTHLY}>Month(s)</option>
                                    </select>
                                </div>

                                {/* Custom Weekly Days */}
                                {customFreq === RRule.WEEKLY && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-2">Days of Week</label>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.keys(dayMap).map((dayKey) => {
                                                const d = dayMap[dayKey as keyof typeof dayMap];
                                                const isSelected = customByWeekday.some(wd => wd.weekday === d.weekday);
                                                return (
                                                    <button
                                                        key={dayKey}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setCustomByWeekday(prev => prev.filter(wd => wd.weekday !== d.weekday));
                                                            } else {
                                                                setCustomByWeekday(prev => [...prev, d]);
                                                            }
                                                        }}
                                                        className={`px-3 py-1 rounded-full text-xs font-medium border ${isSelected
                                                            ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                                                            : 'bg-white border-gray-300 text-gray-600'}`}
                                                    >
                                                        {dayKey}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Custom Monthly Logic */}
                                {customFreq === RRule.MONTHLY && (
                                    <div className="space-y-3">
                                        <label className="block text-xs font-medium text-gray-700">Monthly On:</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={monthlyMode === 'DATE'}
                                                onChange={() => setMonthlyMode('DATE')}
                                                className="text-emerald-600"
                                            />
                                            <span className="text-sm">Same Date (e.g. the 15th)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={monthlyMode === 'POS'}
                                                onChange={() => setMonthlyMode('POS')}
                                                className="text-emerald-600"
                                            />
                                            <span className="text-sm">Specific Day (e.g. 1st Sunday)</span>
                                        </div>

                                        {monthlyMode === 'POS' && (
                                            <div className="flex gap-2 pl-6">
                                                <select
                                                    value={customBySetPos}
                                                    onChange={(e) => setCustomBySetPos(Number(e.target.value))}
                                                    className="px-2 py-1 border rounded text-sm"
                                                >
                                                    <option value={1}>1st</option>
                                                    <option value={2}>2nd</option>
                                                    <option value={3}>3rd</option>
                                                    <option value={4}>4th</option>
                                                    <option value={-1}>Last</option>
                                                </select>
                                                <select
                                                    value={customPosDay}
                                                    onChange={(e) => setCustomPosDay(Number(e.target.value))}
                                                    className="px-2 py-1 border rounded text-sm"
                                                >
                                                    {Object.entries(dayMap).map(([label, val]) => (
                                                        <option key={label} value={val.weekday}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="p-3 bg-emerald-50 rounded-md border border-emerald-100">
                                    <p className="text-xs text-emerald-800 font-medium">Summary:</p>
                                    <p className="text-sm text-emerald-900">
                                        {ruleText || '...'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Ends On Logic */}
                        <div className="space-y-3 pt-2">
                            <label className="block text-sm font-bold text-gray-900">Duration / Ending</label>
                            <div className="space-y-2">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        value="never"
                                        checked={formData.ends_on === 'never'}
                                        onChange={() => setFormData((prev: any) => ({ ...prev, ends_on: 'never' }))}
                                        className="mr-2 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm text-gray-700">Ongoing / No fixed end date (Limited to 90 days)</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        value="date"
                                        checked={formData.ends_on === 'date'}
                                        onChange={() => setFormData((prev: any) => ({ ...prev, ends_on: 'date' }))}
                                        className="mr-2 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm text-gray-700">End on a specific date</span>
                                </label>
                                {formData.ends_on === 'date' && (
                                    <div className="pl-6 mt-1">
                                        <Input type="date" name="recurrence_end_date" value={formData.recurrence_end_date} onChange={handleChange} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </FormSection>
    );
}

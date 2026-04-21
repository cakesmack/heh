import React from 'react';
import DateTimePicker from '@/components/common/DateTimePicker';
import { ShowtimeCreate } from '@/types';
import { RRule, Frequency, Weekday, rrulestr } from 'rrule';
import { useState, useEffect } from 'react';

// Day mapping for RRule
const dayMap: { [key: string]: Weekday } = {
    'Mon': RRule.MO, 'Tue': RRule.TU, 'Wed': RRule.WE,
    'Thu': RRule.TH, 'Fri': RRule.FR, 'Sat': RRule.SA, 'Sun': RRule.SU
};

// Day labels for standard weekday selector (index 0=Mon..6=Sun)
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    fieldErrors?: Record<string, string>;
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
    setIsAllDay,
    fieldErrors = {}
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
        if (formData.frequency !== 'CUSTOM' || !formData.recurrence_rule || isHydrated) {
            if (!isHydrated) setIsHydrated(true);
            return;
        }

        try {
            const rule = rrulestr(formData.recurrence_rule);
            setCustomFreq(rule.options.freq);
            setCustomInterval(rule.options.interval);

            if (rule.options.byweekday) {
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
            setIsHydrated(true);
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

            if (customFreq === RRule.WEEKLY && customByWeekday.length > 0) {
                options.byweekday = customByWeekday;
            }

            if (customFreq === RRule.MONTHLY) {
                if (monthlyMode === 'POS') {
                    options.bysetpos = customBySetPos;
                    const day = Object.values(dayMap).find(d => d.weekday === customPosDay) || RRule.SU;
                    options.byweekday = [day];
                }
            }

            if (formData.ends_on === 'date' && formData.recurrence_end_date) {
                options.until = new Date(formData.recurrence_end_date);
            }

            const rule = new RRule(options);
            const ruleStr = rule.toString().replace(/^RRULE:/, '');
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

    // ───────────────────────────────────────────────────────────
    // HELPER: Extract time portion (HH:MM) from a datetime string
    const getTimePart = (dateTimeStr: string): string => {
        if (!dateTimeStr) return '12:00';
        const parts = dateTimeStr.split('T');
        return parts[1] ? parts[1].substring(0, 5) : '12:00';
    };

    // HELPER: Extract date portion (YYYY-MM-DD) from a datetime string
    const getDatePart = (dateTimeStr: string): string => {
        if (!dateTimeStr) return '';
        return dateTimeStr.split('T')[0] || '';
    };

    // HELPER: Combine date + time into datetime-local string
    const combineDateAndTime = (datePart: string, timePart: string): string => {
        if (!datePart) return '';
        return `${datePart}T${timePart || '12:00'}`;
    };

    // ─────────────────────────────────────────────────────
    // RECURRING EVENT — 4-group progressive layout
    // ─────────────────────────────────────────────────────
    if (formData.is_recurring && !isMultiSession) {
        const currentStartTime = getTimePart(formData.date_start);
        const currentEndTime = getTimePart(formData.date_end);
        const currentStartDate = getDatePart(formData.date_start);

        return (
            <div className="w-full space-y-0">

                {/* ══════════════════════════════════════════ */}
                {/* GROUP 1: Time of Event                    */}
                {/* ══════════════════════════════════════════ */}
                <div className="pb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Time of Event
                    </label>

                    {!isAllDay && (
                        <div className="flex items-center gap-3 mb-4">
                            {/* Start Time */}
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={currentStartTime.split(':')[0]}
                                    onChange={(e) => {
                                        const newTime = `${e.target.value}:${currentStartTime.split(':')[1] || '00'}`;
                                        const newVal = combineDateAndTime(currentStartDate || new Date().toISOString().split('T')[0], newTime);
                                        setFormData((prev: any) => ({ ...prev, date_start: newVal }));
                                    }}
                                    className="w-[68px] px-2 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors shadow-sm border-gray-200 text-center text-sm"
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={i.toString().padStart(2, '0')}>
                                            {i.toString().padStart(2, '0')}
                                        </option>
                                    ))}
                                </select>
                                <span className="text-gray-400 font-medium">:</span>
                                <select
                                    value={currentStartTime.split(':')[1] || '00'}
                                    onChange={(e) => {
                                        const newTime = `${currentStartTime.split(':')[0]}:${e.target.value}`;
                                        const newVal = combineDateAndTime(currentStartDate || new Date().toISOString().split('T')[0], newTime);
                                        setFormData((prev: any) => ({ ...prev, date_start: newVal }));
                                    }}
                                    className="w-[68px] px-2 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors shadow-sm border-gray-200 text-center text-sm"
                                >
                                    {['00', '15', '30', '45'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            {!noEndTime && (
                                <>
                                    <span className="text-sm text-gray-400 font-medium">to</span>

                                    {/* End Time */}
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={currentEndTime.split(':')[0]}
                                            onChange={(e) => {
                                                const newTime = `${e.target.value}:${currentEndTime.split(':')[1] || '00'}`;
                                                // For recurring, end date shares the same date as start
                                                const newVal = combineDateAndTime(currentStartDate || new Date().toISOString().split('T')[0], newTime);
                                                setFormData((prev: any) => ({ ...prev, date_end: newVal }));
                                            }}
                                            className="w-[68px] px-2 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors shadow-sm border-gray-200 text-center text-sm"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i.toString().padStart(2, '0')}>
                                                    {i.toString().padStart(2, '0')}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="text-gray-400 font-medium">:</span>
                                        <select
                                            value={currentEndTime.split(':')[1] || '00'}
                                            onChange={(e) => {
                                                const newTime = `${currentEndTime.split(':')[0]}:${e.target.value}`;
                                                const newVal = combineDateAndTime(currentStartDate || new Date().toISOString().split('T')[0], newTime);
                                                setFormData((prev: any) => ({ ...prev, date_end: newVal }));
                                            }}
                                            className="w-[68px] px-2 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors shadow-sm border-gray-200 text-center text-sm"
                                        >
                                            {['00', '15', '30', '45'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Toggles */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isAllDay}
                                onChange={(e) => {
                                    setIsAllDay(e.target.checked);
                                    if (e.target.checked) setNoEndTime(true);
                                }}
                                className="rounded text-green-600 focus:ring-green-600"
                            />
                            <span className="text-sm text-gray-600">All day event</span>
                        </label>
                        {!isAllDay && (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={noEndTime}
                                    onChange={(e) => setNoEndTime(e.target.checked)}
                                    className="rounded text-green-600 focus:ring-green-600"
                                />
                                <span className="text-sm text-gray-600">No specific end time</span>
                            </label>
                        )}
                    </div>
                    {isAllDay && (
                        <p className="text-xs text-gray-500 mt-1.5">The event spans the entire day.</p>
                    )}
                    {noEndTime && !isAllDay && (
                        <p className="text-xs text-gray-500 mt-1.5">End time defaults to 4 hours after start.</p>
                    )}
                </div>

                {/* ── Divider ── */}
                <div className="border-b border-gray-100" />

                {/* ══════════════════════════════════════════ */}
                {/* GROUP 2: First Occurrence (Anchor Date)   */}
                {/* ══════════════════════════════════════════ */}
                <div className="py-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        First Event Date *
                    </label>
                    <p className="text-xs text-gray-400 mb-3">When does this recurring event start?</p>
                    <input
                        type="date"
                        value={currentStartDate}
                        onChange={(e) => {
                            const newDate = e.target.value;
                            if (newDate) {
                                const startVal = combineDateAndTime(newDate, currentStartTime);
                                const endVal = combineDateAndTime(newDate, currentEndTime);
                                setFormData((prev: any) => ({
                                    ...prev,
                                    date_start: startVal,
                                    date_end: endVal,
                                }));
                            }
                        }}
                        required
                        className={`w-full max-w-xs px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors shadow-sm ${
                            fieldErrors.date_start ? 'border-red-500' : 'border-gray-200'
                        }`}
                    />
                    {fieldErrors.date_start && (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.date_start}</p>
                    )}
                </div>

                {/* ── Divider ── */}
                <div className="border-b border-gray-100" />

                {/* ══════════════════════════════════════════ */}
                {/* GROUP 3: Recurrence Pattern               */}
                {/* ══════════════════════════════════════════ */}
                <div className="py-6 space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                        Repeats
                    </label>

                    <select
                        name="frequency"
                        value={formData.frequency}
                        onChange={(e) => {
                            handleChange(e);
                            if (e.target.value !== 'CUSTOM') {
                                setFormData((prev: any) => ({ ...prev, recurrence_rule: '' }));
                            }
                        }}
                        className="w-full max-w-xs px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors shadow-sm border-gray-200 text-sm"
                    >
                        <option value="WEEKLY">Weekly</option>
                        <option value="BIWEEKLY">Bi-Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="CUSTOM">Custom Pattern</option>
                    </select>

                    {/* Weekday Selector — only for Weekly / Bi-Weekly */}
                    {(formData.frequency === 'WEEKLY' || formData.frequency === 'BIWEEKLY') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Repeat on these days</label>
                            <div className="flex gap-2 flex-wrap">
                                {WEEKDAY_LABELS.map((dayLabel, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            const newWeekdays = formData.weekdays.includes(idx)
                                                ? formData.weekdays.filter((d: number) => d !== idx)
                                                : [...formData.weekdays, idx];
                                            setFormData((prev: any) => ({ ...prev, weekdays: newWeekdays }));
                                        }}
                                        className={`w-11 h-11 rounded-full font-bold text-sm transition-all duration-150 ${formData.weekdays.includes(idx)
                                            ? 'bg-green-600 text-white shadow-sm shadow-green-200'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                    >
                                        {dayLabel.charAt(0)}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5">Tap to select one or more days</p>
                        </div>
                    )}

                    {/* Custom Recurrence Builder */}
                    {formData.frequency === 'CUSTOM' && (
                        <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-900">Custom Rule</h4>

                            {/* Frequency & Interval Sentence */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-700">Repeats every</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={customInterval}
                                    onChange={(e) => setCustomInterval(Number(e.target.value))}
                                    className="w-16 px-2 py-1.5 border rounded-lg text-sm text-center bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent border-gray-200"
                                />
                                <select
                                    value={customFreq}
                                    onChange={(e) => setCustomFreq(Number(e.target.value))}
                                    className="px-3 py-1.5 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent border-gray-200"
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
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isSelected
                                                        ? 'bg-green-600 border-green-600 text-white'
                                                        : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}
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
                                            className="text-green-600 focus:ring-green-600"
                                        />
                                        <span className="text-sm">Same Date (e.g. the 15th)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            checked={monthlyMode === 'POS'}
                                            onChange={() => setMonthlyMode('POS')}
                                            className="text-green-600 focus:ring-green-600"
                                        />
                                        <span className="text-sm">Specific Day (e.g. 1st Sunday)</span>
                                    </div>

                                    {monthlyMode === 'POS' && (
                                        <div className="flex gap-2 pl-6">
                                            <select
                                                value={customBySetPos}
                                                onChange={(e) => setCustomBySetPos(Number(e.target.value))}
                                                className="px-2 py-1.5 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent border-gray-200"
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
                                                className="px-2 py-1.5 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent border-gray-200"
                                            >
                                                {Object.entries(dayMap).map(([label, val]) => (
                                                    <option key={label} value={val.weekday}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Summary */}
                            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                <p className="text-xs text-green-800 font-medium">Summary:</p>
                                <p className="text-sm text-green-900">
                                    {ruleText || '...'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Divider ── */}
                <div className="border-b border-gray-100" />

                {/* ══════════════════════════════════════════ */}
                {/* GROUP 4: Series Ending                    */}
                {/* ══════════════════════════════════════════ */}
                <div className="pt-6 space-y-3">
                    <label className="block text-sm font-semibold text-gray-700">
                        Series Ending
                    </label>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2.5 cursor-pointer py-1">
                            <input
                                type="radio"
                                value="never"
                                checked={formData.ends_on === 'never'}
                                onChange={() => setFormData((prev: any) => ({ ...prev, ends_on: 'never' }))}
                                className="text-green-600 focus:ring-green-600"
                            />
                            <span className="text-sm text-gray-700">Ongoing <span className="text-gray-400">(limited to 90 days)</span></span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer py-1">
                            <input
                                type="radio"
                                value="date"
                                checked={formData.ends_on === 'date'}
                                onChange={() => setFormData((prev: any) => ({ ...prev, ends_on: 'date' }))}
                                className="text-green-600 focus:ring-green-600"
                            />
                            <span className="text-sm text-gray-700">End on a specific date</span>
                        </label>
                        {formData.ends_on === 'date' && (
                            <div className="pl-7 mt-1">
                                <input
                                    type="date"
                                    name="recurrence_end_date"
                                    value={formData.recurrence_end_date}
                                    onChange={handleChange}
                                    min={currentStartDate}
                                    className="w-full max-w-xs px-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent transition-colors shadow-sm border-gray-200"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────
    // ONE-OFF / MULTI-SESSION — original layout
    // ─────────────────────────────────────────────────────
    return (
        <div className="w-full space-y-6">

            {/* Single Event Date Inputs */}
            {!isMultiSession && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date *</label>
                            <DateTimePicker
                                id="date_start"
                                name="date_start"
                                required
                                value={formData.date_start}
                                onChange={(val) => {
                                    const oldStartDate = formData.date_start ? formData.date_start.split('T')[0] : '';
                                    const newStartDate = val.split('T')[0];
                                    const currentEndDate = formData.date_end ? formData.date_end.split('T')[0] : '';

                                    if (!formData.date_end || currentEndDate === oldStartDate || currentEndDate < newStartDate) {
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
                                error={fieldErrors.date_start}
                            />
                        </div>
                        {!noEndTime && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date *</label>
                                <DateTimePicker
                                    id="date_end"
                                    name="date_end"
                                    required
                                    value={formData.date_end}
                                    onChange={(val) => setFormData((prev: any) => ({ ...prev, date_end: val }))}
                                    min={formData.date_start}
                                    error={fieldErrors.date_end}
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
                                    setNoEndTime(true);
                                }
                            }}
                            className="rounded text-green-600 focus:ring-green-600"
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
                                className="rounded text-green-600 focus:ring-green-600"
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
                        Add performance times. The event&apos;s main dates will be calculated automatically.
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
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent"
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
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-600 focus:border-transparent"
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
                        className="w-full py-2 border-2 border-dashed border-green-300 text-green-600 rounded-lg hover:bg-green-50 text-sm font-medium"
                    >
                        + Add Another Performance
                    </button>
                </div>
            )}
        </div>
    );
}

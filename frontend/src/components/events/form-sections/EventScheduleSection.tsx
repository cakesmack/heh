
import React from 'react';
import { Input } from '@/components/common/Input';
import DateTimePicker from '@/components/common/DateTimePicker';
import FormSection from '../FormSection';
import { ShowtimeCreate } from '@/types';

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
    // Helper to format UTC ISO string to Local "YYYY-MM-DDTHH:mm" for input
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
            <div className="flex gap-4 mb-6">
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${!isMultiSession ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <input
                        type="radio"
                        name="eventType"
                        checked={!isMultiSession}
                        onChange={() => {
                            setIsMultiSession(false);
                            setShowtimes([]);
                        }}
                        className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                        <span className="text-sm font-medium text-gray-900 block">Single Event</span>
                        <span className="text-xs text-gray-500">One start and end time</span>
                    </div>
                </label>
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${isMultiSession ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <input
                        type="radio"
                        name="eventType"
                        checked={isMultiSession}
                        onChange={() => {
                            // Push current dates to first showtime when switching
                            if (formData.date_start) {
                                setShowtimes([{
                                    start_time: formData.date_start, // Already Local
                                    end_time: formData.date_end || undefined, // Already Local
                                }]);
                            }
                            setIsMultiSession(true);
                        }}
                        className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                        <span className="text-sm font-medium text-gray-900 block">Multiple Showings</span>
                        <span className="text-xs text-gray-500">Theatre, cinema-style</span>
                    </div>
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
                                                type="url"
                                                value={st.ticket_url || ''}
                                                onChange={(e) => {
                                                    const updated = [...showtimes];
                                                    updated[index] = { ...updated[index], ticket_url: e.target.value };
                                                    setShowtimes(updated);
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

            <div className="mt-6 pt-6 border-t border-gray-100">
                {/* Recurring Event Logic */}
                <div className="flex items-center space-x-2 mb-4">
                    <input
                        type="checkbox"
                        id="is_recurring"
                        checked={formData.is_recurring}
                        onChange={(e) => setFormData((prev: any) => ({ ...prev, is_recurring: e.target.checked }))}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="is_recurring" className="text-sm font-medium text-gray-700">This is a recurring event</label>
                </div>

                {formData.is_recurring && (
                    <div className="pl-6 border-l-2 border-emerald-100 space-y-4">
                        <select name="frequency" value={formData.frequency} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                            <option value="WEEKLY">Weekly</option>
                            <option value="BIWEEKLY">Bi-Weekly</option>
                            <option value="MONTHLY">Monthly</option>
                        </select>

                        {/* Weekday Selector - shown for Weekly/Bi-Weekly */}
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

                        {/* Ends On Logic */}
                        <div className="space-y-2">
                            <label className="flex items-center"><input type="radio" value="never" checked={formData.ends_on === 'never'} onChange={() => setFormData((prev: any) => ({ ...prev, ends_on: 'never' }))} className="mr-2" /> Never (90 days)</label>
                            <label className="flex items-center"><input type="radio" value="date" checked={formData.ends_on === 'date'} onChange={() => setFormData((prev: any) => ({ ...prev, ends_on: 'date' }))} className="mr-2" /> On Date</label>
                            {formData.ends_on === 'date' && <Input type="date" name="recurrence_end_date" value={formData.recurrence_end_date} onChange={handleChange} />}
                        </div>
                    </div>
                )}
            </div>
        </FormSection>
    );
}

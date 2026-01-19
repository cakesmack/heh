/**
 * DateTimePicker Component
 * Custom date/time picker with separate hour and minute dropdowns (15-minute intervals)
 * 
 * FIXED: Uses useState with useEffect sync instead of useMemo to prevent stale closures
 */
import { useState, useEffect, useCallback } from 'react';

interface DateTimePickerProps {
  id: string;
  name: string;
  value: string; // ISO datetime-local format: "2024-01-15T14:30"
  onChange: (value: string) => void;
  min?: string;
  disabled?: boolean;
  required?: boolean;
}

// Hour options (0-23)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString().padStart(2, '0'),
  label: i.toString().padStart(2, '0'),
}));

// Minute options (00, 15, 30, 45)
const MINUTE_OPTIONS = [
  { value: '00', label: '00' },
  { value: '15', label: '15' },
  { value: '30', label: '30' },
  { value: '45', label: '45' },
];

// Helper to parse datetime string
function parseDateTime(value: string) {
  if (!value) {
    return { dateValue: '', hourValue: '12', minuteValue: '00' };
  }

  const [datePart, timePart] = value.split('T');
  const time = timePart ? timePart.substring(0, 5) : '12:00';
  const [hours, mins] = time.split(':');

  // Round minutes to nearest 15
  const minsNum = parseInt(mins, 10);
  const roundedMins = Math.round(minsNum / 15) * 15;
  const adjustedHours = roundedMins === 60 ? (parseInt(hours, 10) + 1) % 24 : parseInt(hours, 10);
  const finalMins = roundedMins === 60 ? 0 : roundedMins;

  return {
    dateValue: datePart || '',
    hourValue: adjustedHours.toString().padStart(2, '0'),
    minuteValue: finalMins.toString().padStart(2, '0'),
  };
}

export default function DateTimePicker({
  id,
  name,
  value,
  onChange,
  min,
  disabled = false,
  required = false,
}: DateTimePickerProps) {
  // Use useState for internal state - this is the key fix!
  const [dateValue, setDateValue] = useState('');
  const [hourValue, setHourValue] = useState('12');
  const [minuteValue, setMinuteValue] = useState('00');

  // Sync internal state when prop changes (controlled component pattern)
  useEffect(() => {
    const parsed = parseDateTime(value);
    setDateValue(parsed.dateValue);
    setHourValue(parsed.hourValue);
    setMinuteValue(parsed.minuteValue);
  }, [value]);

  // Parse min date if provided
  const minDate = min ? min.split('T')[0] : undefined;

  // Handlers now use current state values correctly
  const handleDateChange = useCallback((newDate: string) => {
    console.log('[DateTimePicker] handleDateChange called:', { newDate, hourValue, minuteValue });
    if (newDate) {
      // Use current state values
      setDateValue(newDate);
      const newValue = `${newDate}T${hourValue}:${minuteValue}`;
      console.log('[DateTimePicker] Calling onChange with:', newValue);
      onChange(newValue);
    } else {
      setDateValue('');
      onChange('');
    }
  }, [hourValue, minuteValue, onChange]);

  const handleHourChange = useCallback((newHour: string) => {
    console.log('[DateTimePicker] handleHourChange called:', { newHour, dateValue, minuteValue });
    if (dateValue) {
      setHourValue(newHour);
      const newValue = `${dateValue}T${newHour}:${minuteValue}`;
      console.log('[DateTimePicker] Calling onChange with:', newValue);
      onChange(newValue);
    }
  }, [dateValue, minuteValue, onChange]);

  const handleMinuteChange = useCallback((newMinute: string) => {
    console.log('[DateTimePicker] handleMinuteChange called:', { newMinute, dateValue, hourValue });
    if (dateValue) {
      setMinuteValue(newMinute);
      const newValue = `${dateValue}T${hourValue}:${newMinute}`;
      console.log('[DateTimePicker] Calling onChange with:', newValue);
      onChange(newValue);
    }
  }, [dateValue, hourValue, onChange]);

  return (
    <div className="flex gap-2 items-center">
      {/* Date Input */}
      <input
        type="date"
        id={id}
        name={`${name}_date`}
        value={dateValue}
        onChange={(e) => handleDateChange(e.target.value)}
        min={minDate}
        disabled={disabled}
        required={required}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />

      {/* Hour Select */}
      <select
        id={`${id}_hour`}
        name={`${name}_hour`}
        value={hourValue}
        onChange={(e) => handleHourChange(e.target.value)}
        disabled={disabled || !dateValue}
        required={required}
        className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
      >
        {HOUR_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <span className="text-gray-500 font-medium">:</span>

      {/* Minute Select (15-minute intervals) */}
      <select
        id={`${id}_minute`}
        name={`${name}_minute`}
        value={minuteValue}
        onChange={(e) => handleMinuteChange(e.target.value)}
        disabled={disabled || !dateValue}
        required={required}
        className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-center"
      >
        {MINUTE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

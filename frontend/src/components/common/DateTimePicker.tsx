/**
 * DateTimePicker Component
 * Custom date/time picker with separate hour and minute dropdowns (15-minute intervals)
 */
import { useMemo } from 'react';

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

export default function DateTimePicker({
  id,
  name,
  value,
  onChange,
  min,
  disabled = false,
  required = false,
}: DateTimePickerProps) {
  // Parse the datetime-local value into date, hour, and minute parts
  const { dateValue, hourValue, minuteValue } = useMemo(() => {
    if (!value) {
      return { dateValue: '', hourValue: '12', minuteValue: '00' };
    }

    // value is in format "2024-01-15T14:30" or "2024-01-15T14:30:00"
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
  }, [value]);

  // Parse min date if provided
  const minDate = useMemo(() => {
    if (!min) return undefined;
    const [datePart] = min.split('T');
    return datePart;
  }, [min]);

  const handleDateChange = (newDate: string) => {
    if (newDate) {
      onChange(`${newDate}T${hourValue}:${minuteValue}`);
    } else {
      onChange('');
    }
  };

  const handleHourChange = (newHour: string) => {
    if (dateValue) {
      onChange(`${dateValue}T${newHour}:${minuteValue}`);
    }
  };

  const handleMinuteChange = (newMinute: string) => {
    if (dateValue) {
      onChange(`${dateValue}T${hourValue}:${newMinute}`);
    }
  };

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

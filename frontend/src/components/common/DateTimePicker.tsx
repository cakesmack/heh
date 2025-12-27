/**
 * DateTimePicker Component
 * Custom date/time picker with 15-minute time intervals
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

// Generate time options in 15-minute intervals
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      const value = `${hourStr}:${minuteStr}`;

      // Format label as 12-hour time
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const label = `${hour12}:${minuteStr} ${ampm}`;

      options.push({ value, label });
    }
  }

  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export default function DateTimePicker({
  id,
  name,
  value,
  onChange,
  min,
  disabled = false,
  required = false,
}: DateTimePickerProps) {
  // Parse the datetime-local value into date and time parts
  const { dateValue, timeValue } = useMemo(() => {
    if (!value) {
      return { dateValue: '', timeValue: '12:00' };
    }

    // value is in format "2024-01-15T14:30" or "2024-01-15T14:30:00"
    const [datePart, timePart] = value.split('T');
    const time = timePart ? timePart.substring(0, 5) : '12:00';

    // Round time to nearest 15 minutes
    const [hours, mins] = time.split(':').map(Number);
    const roundedMins = Math.round(mins / 15) * 15;
    const adjustedHours = roundedMins === 60 ? hours + 1 : hours;
    const finalMins = roundedMins === 60 ? 0 : roundedMins;
    const roundedTime = `${(adjustedHours % 24).toString().padStart(2, '0')}:${finalMins.toString().padStart(2, '0')}`;

    return {
      dateValue: datePart || '',
      timeValue: roundedTime
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
      onChange(`${newDate}T${timeValue}`);
    } else {
      onChange('');
    }
  };

  const handleTimeChange = (newTime: string) => {
    if (dateValue) {
      onChange(`${dateValue}T${newTime}`);
    }
  };

  return (
    <div className="flex gap-2">
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

      {/* Time Select with 15-minute intervals */}
      <select
        id={`${id}_time`}
        name={`${name}_time`}
        value={timeValue}
        onChange={(e) => handleTimeChange(e.target.value)}
        disabled={disabled || !dateValue}
        required={required}
        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {TIME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

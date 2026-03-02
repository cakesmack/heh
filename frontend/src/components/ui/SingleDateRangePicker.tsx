import React, { useState, useRef, useEffect } from 'react';
import { startOfDay, endOfDay, format } from 'date-fns';
import { DayPicker, DateRange as DayPickerRange } from 'react-day-picker';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import 'react-day-picker/dist/style.css';

interface SingleDateRangePickerProps {
    dateFrom: Date | null;
    dateTo: Date | null;
    onChange: (range: { from: Date | null; to: Date | null }) => void;
}

export function SingleDateRangePicker({ dateFrom, dateTo, onChange }: SingleDateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tempRange, setTempRange] = useState<DayPickerRange | undefined>({
        from: dateFrom || undefined,
        to: dateTo || undefined
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const today = startOfDay(new Date());

    // Sync temp state when external props change (if needed) or when opening
    useEffect(() => {
        if (isOpen) {
            setTempRange({ from: dateFrom || undefined, to: dateTo || undefined });
        }
    }, [isOpen, dateFrom, dateTo]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleApply = () => {
        onChange({
            from: tempRange?.from ? startOfDay(tempRange.from) : null,
            to: tempRange?.to ? endOfDay(tempRange.to) : (tempRange?.from ? endOfDay(tempRange.from) : null)
        });
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange({ from: null, to: null });
        setTempRange(undefined);
    };

    const formatDateDisplay = () => {
        if (dateFrom && dateTo) {
            if (format(dateFrom, 'yyyy-MM-dd') === format(dateTo, 'yyyy-MM-dd')) {
                return format(dateFrom, 'MMM d, yyyy');
            }
            return `${format(dateFrom, 'MMM d')} - ${format(dateTo, 'MMM d, yyyy')}`;
        }
        if (dateFrom) {
            return format(dateFrom, 'MMM d, yyyy');
        }
        return 'Select Dates';
    };

    const isActive = !!dateFrom;

    return (
        <div className="relative inline-block text-left" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 pl-4 pr-3 h-11 rounded-lg border text-sm font-medium transition-all ${isActive
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
            >
                <CalendarIcon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>{formatDateDisplay()}</span>
                {isActive && (
                    <div role="button" onClick={handleClear} className="ml-1 p-0.5 hover:bg-emerald-200 rounded-full text-emerald-600">
                        <X className="w-3.5 h-3.5" />
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-4 min-w-[320px] animate-in fade-in slide-in-from-top-2 duration-200">
                    <DayPicker
                        mode="range"
                        selected={tempRange}
                        onSelect={setTempRange}
                        disabled={{ before: today }}
                        styles={{
                            caption: { color: '#047857' }
                        }}
                        modifiersClassNames={{
                            selected: 'bg-emerald-600 text-white hover:bg-emerald-700',
                            today: 'text-emerald-600 font-bold',
                            range_middle: 'bg-emerald-50 text-emerald-900',
                            range_start: 'bg-emerald-600 text-white rounded-l-md',
                            range_end: 'bg-emerald-600 text-white rounded-r-md'
                        }}
                    />
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={!tempRange?.from}
                            className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

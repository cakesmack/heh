import React, { useState, useRef, useEffect } from 'react';
import { addDays, startOfDay, endOfDay, nextSaturday, nextSunday, format } from 'date-fns';
import { DayPicker, DateRange as DayPickerRange } from 'react-day-picker';
import { ChevronDown, Calendar as CalendarIcon, X } from 'lucide-react';
import 'react-day-picker/dist/style.css';

export type DateRange = {
    label: string;
    start: Date;
    end: Date;
    id: 'weekend' | 'week' | 'month' | 'custom';
};

interface MapDateFilterProps {
    selectedRangeId: string;
    onRangeSelect: (range: DateRange) => void;
    currentDateRange: { start: Date; end: Date };
}

export default function MapDateFilter({ selectedRangeId, onRangeSelect, currentDateRange }: MapDateFilterProps) {
    const [isCustomOpen, setIsCustomOpen] = useState(false);
    const [tempRange, setTempRange] = useState<DayPickerRange | undefined>({
        from: currentDateRange.start,
        to: currentDateRange.end
    });

    const popoverRef = useRef<HTMLDivElement>(null);
    const today = startOfDay(new Date());

    // Close popover on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsCustomOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter Presets
    const filters: { id: DateRange['id'], label: string, getRange: () => { start: Date, end: Date } }[] = [
        {
            id: 'weekend',
            label: 'This Weekend',
            getRange: () => ({
                start: nextSaturday(today),
                end: endOfDay(nextSunday(today))
            })
        },
        {
            id: 'week',
            label: 'Next 7 Days',
            getRange: () => ({
                start: today,
                end: endOfDay(addDays(today, 6))
            })
        },
        {
            id: 'month',
            label: 'Next 30 Days',
            getRange: () => ({
                start: today,
                end: endOfDay(addDays(today, 30))
            })
        }
    ];

    const handlePresetClick = (filter: typeof filters[0]) => {
        const range = filter.getRange();
        onRangeSelect({
            id: filter.id,
            label: filter.label,
            ...range
        });
        setIsCustomOpen(false);
    };

    const handleCustomApply = () => {
        if (tempRange?.from && tempRange?.to) {
            onRangeSelect({
                id: 'custom',
                label: `${format(tempRange.from, 'MMM d')} - ${format(tempRange.to, 'MMM d')}`,
                start: startOfDay(tempRange.from),
                end: endOfDay(tempRange.to)
            });
            setIsCustomOpen(false);
        }
    };

    const handleCustomClick = () => {
        setIsCustomOpen(!isCustomOpen);
        // Reset temp range to current actual range when opening
        if (!isCustomOpen) {
            setTempRange({ from: currentDateRange.start, to: currentDateRange.end });
        }
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap scrollbar-hide touch-pan-x px-4 pr-12 pb-2 -mx-4 md:mx-0 md:px-0">
            {/* Presets */}
            {filters.map((filter) => (
                <button
                    key={filter.id}
                    onClick={() => handlePresetClick(filter)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border ${selectedRangeId === filter.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    {filter.label}
                </button>
            ))}

            {/* Separator Line */}
            <div className="h-6 w-px bg-gray-300 mx-1 flex-shrink-0 hidden md:block" />

            {/* Custom Range Button - Outside scroll wrapper to prevent clipping */}
            <div className="relative flex-shrink-0" ref={popoverRef}>
                <button
                    onClick={handleCustomClick}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border ${selectedRangeId === 'custom'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>
                        {selectedRangeId === 'custom'
                            ? `${format(currentDateRange.start, 'MMM d')} - ${format(currentDateRange.end, 'MMM d')}`
                            : 'Select Dates'}
                    </span>
                    {selectedRangeId === 'custom' && (
                        <span
                            role="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePresetClick(filters[1]); // Reset to week default
                            }}
                            className="ml-1 hover:bg-emerald-700 rounded-full p-0.5"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    )}
                </button>

                {/* Date Picker Popover */}
                {isCustomOpen && (
                    <div className="absolute top-full right-0 mt-3 p-4 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] min-w-[320px]">
                        <DayPicker
                            mode="range"
                            selected={tempRange}
                            onSelect={setTempRange}
                            disabled={{ before: today }}
                            styles={{
                                caption: { color: '#047857' } // Emerald-700
                            }}
                            modifiersClassNames={{
                                selected: 'bg-emerald-600 text-white hover:bg-emerald-700',
                                today: 'text-emerald-600 font-bold'
                            }}
                        />
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setIsCustomOpen(false)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCustomApply}
                                disabled={!tempRange?.from || !tempRange?.to}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Apply Range
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

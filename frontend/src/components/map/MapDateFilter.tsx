import React from 'react';
import { addDays, startOfDay, endOfDay, nextSaturday, nextSunday, isSameDay } from 'date-fns';

export type DateRange = {
    label: string;
    start: Date;
    end: Date;
    id: 'today' | 'tomorrow' | 'weekend' | 'week' | 'custom';
};

interface MapDateFilterProps {
    selectedRangeId: string;
    onRangeSelect: (range: DateRange) => void;
}

export default function MapDateFilter({ selectedRangeId, onRangeSelect }: MapDateFilterProps) {
    const today = startOfDay(new Date());

    const filters: DateRange[] = [
        {
            id: 'today',
            label: 'Today',
            start: today,
            end: endOfDay(today)
        },
        {
            id: 'tomorrow',
            label: 'Tomorrow',
            start: addDays(today, 1),
            end: endOfDay(addDays(today, 1))
        },
        {
            id: 'weekend',
            label: 'This Weekend',
            start: nextSaturday(today),
            end: endOfDay(nextSunday(today))
        },
        {
            id: 'week',
            label: 'Next 7 Days',
            start: today,
            end: endOfDay(addDays(today, 6))
        }
    ];

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {filters.map((filter) => (
                <button
                    key={filter.id}
                    onClick={() => onRangeSelect(filter)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border ${selectedRangeId === filter.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    );
}

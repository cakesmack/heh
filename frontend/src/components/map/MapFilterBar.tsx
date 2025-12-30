import React from 'react';
import { format } from 'date-fns';

interface Category {
    id: string;
    name: string;
    color?: string; // Optional color override
    gradient_color?: string; // Color from database
}

interface MapFilterBarProps {
    categories: Category[];
    selectedCategory: string | null;
    onSelect: (categoryId: string | null) => void;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
}

export default function MapFilterBar({
    categories,
    selectedCategory,
    onSelect,
    selectedDate,
    onDateChange
}: MapFilterBarProps) {

    return (
        <div className="w-full bg-white border-b border-gray-200 shadow-sm z-20">
            <div
                className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* Date Picker */}
                <div className="flex-shrink-0 relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <input
                        type="date"
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => {
                            const newDate = e.target.value ? new Date(e.target.value + 'T00:00:00') : new Date();
                            onDateChange(newDate);
                        }}
                        className="pl-8 pr-3 py-1.5 rounded-full text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer transition-colors"
                    />
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-gray-200 flex-shrink-0" />

                {/* "All" Pill */}
                <button
                    onClick={() => onSelect(null)}
                    className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${selectedCategory === null
                        ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                        }`}
                >
                    All Events
                </button>

                {/* Category Pills */}
                {categories.map((category) => {
                    // Use gradient_color from DB, fallback to color prop, then default
                    const color = category.gradient_color || category.color || '#6b7280';
                    const isSelected = selectedCategory === category.id;

                    return (
                        <button
                            key={category.id}
                            onClick={() => onSelect(isSelected ? null : category.id)}
                            className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${isSelected
                                ? 'bg-white text-gray-900 shadow-md ring-1 ring-inset'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                }`}
                            style={{
                                borderColor: isSelected ? color : undefined,
                                '--tw-ring-color': isSelected ? color : undefined
                            } as React.CSSProperties}
                        >
                            <span
                                className="w-2 h-2 rounded-full mr-2"
                                style={{ backgroundColor: color }}
                            />
                            {category.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

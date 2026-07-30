/**
 * FilterBar Component
 * A sticky, horizontally scrollable filter bar for event results page.
 * Isolated from Hero section search bar.
 */
import React from 'react';
import { useCategories } from '@/hooks/useCategories';

export interface FilterBarProps {
    activeDate?: string;
    activeRadius?: string;
    activeCategory?: string;
    onFilterChange: (filters: {
        date?: string;
        radius?: string;
        category?: string;
    }) => void;
}

export function FilterBar({
    activeDate = '',
    activeRadius = '',
    activeCategory = '',
    onFilterChange,
}: FilterBarProps) {
    const { categories, isLoading: isCategoriesLoading } = useCategories();

    const dateOptions = [
        { label: 'Any Date', value: '' },
        { label: 'Today', value: 'today' },
        { label: 'This Weekend', value: 'weekend' },
        { label: 'Next 7 Days', value: 'week' },
    ];

    const radiusOptions = [
        { label: 'Any Distance', value: '' },
        { label: '5 miles', value: '5' },
        { label: '10 miles', value: '10' },
        { label: '25 miles', value: '25' },
    ];

    const handleDateChange = (val: string) => {
        onFilterChange({ date: val || undefined, radius: activeRadius || undefined, category: activeCategory || undefined });
    };

    const handleRadiusChange = (val: string) => {
        onFilterChange({ date: activeDate || undefined, radius: val || undefined, category: activeCategory || undefined });
    };

    const handleCategoryToggle = (slug: string) => {
        const nextCategory = activeCategory === slug ? '' : slug;
        onFilterChange({ date: activeDate || undefined, radius: activeRadius || undefined, category: nextCategory || undefined });
    };

    return (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 py-3 mb-6 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-row items-center gap-2 sm:gap-3 overflow-x-auto flex-nowrap whitespace-nowrap md:flex-wrap md:overflow-x-visible md:whitespace-normal [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-1 scroll-smooth">
                    
                    {/* Date Pill Dropdown */}
                    <div className="relative flex-shrink-0">
                        <select
                            aria-label="Filter by Date"
                            value={activeDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className={`appearance-none cursor-pointer text-sm font-medium px-4 py-2 pr-8 rounded-full border transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                activeDate
                                    ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-md'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            {dateOptions.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white text-gray-900 font-normal">
                                    {opt.value ? `Date: ${opt.label}` : 'Any Date'}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5">
                            <svg className={`w-3.5 h-3.5 ${activeDate ? 'text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    {/* Distance Pill Dropdown */}
                    <div className="relative flex-shrink-0">
                        <select
                            aria-label="Filter by Distance"
                            value={activeRadius}
                            onChange={(e) => handleRadiusChange(e.target.value)}
                            className={`appearance-none cursor-pointer text-sm font-medium px-4 py-2 pr-8 rounded-full border transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                activeRadius
                                    ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-md'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            {radiusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white text-gray-900 font-normal">
                                    {opt.value ? `Distance: ${opt.label}` : 'Any Distance'}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5">
                            <svg className={`w-3.5 h-3.5 ${activeRadius ? 'text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default FilterBar;

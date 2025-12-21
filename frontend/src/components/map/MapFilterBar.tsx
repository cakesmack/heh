import React, { useRef, useEffect } from 'react';

interface Category {
    id: string;
    name: string;
    color?: string; // Optional color override
}

interface MapFilterBarProps {
    categories: Category[];
    selectedCategory: string | null;
    onSelect: (categoryId: string | null) => void;
}

// Map categories to colors (matching the map logic)
const CATEGORY_COLORS: Record<string, string> = {
    'Music': '#a855f7', // purple-500
    'Outdoors': '#10b981', // emerald-500
    'Food & Drink': '#f59e0b', // amber-500
    'Arts': '#ec4899', // pink-500
    'Sports': '#3b82f6', // blue-500
    'Community': '#6366f1', // indigo-500
    'default': '#6b7280' // gray-500
};

export default function MapFilterBar({
    categories,
    selectedCategory,
    onSelect
}: MapFilterBarProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="w-full bg-white border-b border-gray-200 shadow-sm z-20">
            <div
                ref={scrollContainerRef}
                className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
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
                    const color = CATEGORY_COLORS[category.name] || CATEGORY_COLORS['default'];
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

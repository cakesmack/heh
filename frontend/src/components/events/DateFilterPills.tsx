import React from 'react';

export interface DateFilterOption {
  id: string;
  label: string;
}

export const DEFAULT_DATE_FILTER_OPTIONS: DateFilterOption[] = [
  { id: 'all', label: 'All Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'weekend', label: 'This Weekend' },
];

export interface DateFilterPillsProps {
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
  options?: DateFilterOption[];
  className?: string;
}

export function DateFilterPills({
  activeFilter,
  onSelectFilter,
  options = DEFAULT_DATE_FILTER_OPTIONS,
  className = '',
}: DateFilterPillsProps) {
  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {options.map((option) => {
        const isActive =
          activeFilter === option.id ||
          (option.id === 'weekend' && activeFilter === 'this-weekend');

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelectFilter(option.id)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              isActive
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 shadow-xs'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default DateFilterPills;

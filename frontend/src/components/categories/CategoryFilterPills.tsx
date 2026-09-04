import React, { useState, useEffect } from 'react';
import { Category } from '@/types';
import { api } from '@/lib/api';

export interface CategoryFilterPillsProps {
  selectedCategoryId?: number | string | null;
  onSelectCategory: (categoryId: number | string | null) => void;
  categories?: Category[];
  className?: string;
  showAllPill?: boolean;
}

export function CategoryFilterPills({
  selectedCategoryId,
  onSelectCategory,
  categories: initialCategories,
  className = '',
  showAllPill = false,
}: CategoryFilterPillsProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loading, setLoading] = useState<boolean>(!initialCategories);

  useEffect(() => {
    if (initialCategories) {
      setCategories(initialCategories);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const response = await api.categories.list();
        if (isMounted) {
          setCategories(response.categories || []);
        }
      } catch (error) {
        console.error('Failed to load categories for filter pills:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, [initialCategories]);

  if (loading) {
    return (
      <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide snap-x gap-2 md:gap-3 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-8 md:h-10 w-24 md:w-32 rounded-full bg-gray-100 animate-pulse shrink-0 snap-start"
          />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  const basePillClass =
    'group inline-flex items-center gap-1.5 md:gap-2.5 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 shrink-0 snap-start cursor-pointer';

  return (
    <div
      className={`flex overflow-x-auto whitespace-nowrap scrollbar-hide snap-x gap-2 md:gap-3 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {showAllPill && (
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          className={`${basePillClass} ${
            selectedCategoryId === null || selectedCategoryId === undefined
              ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500 ring-offset-1'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          All Categories
        </button>
      )}

      {categories.map((category) => {
        const color = category.gradient_color || '#059669';
        const isSelected =
          selectedCategoryId !== null &&
          selectedCategoryId !== undefined &&
          (String(category.id) === String(selectedCategoryId) ||
            category.slug === String(selectedCategoryId));

        const handleClick = () => {
          if (isSelected) {
            onSelectCategory(null);
          } else {
            onSelectCategory(category.id);
          }
        };

        return (
          <button
            key={category.id}
            type="button"
            onClick={handleClick}
            className={`${basePillClass} ${
              isSelected ? 'ring-2 ring-emerald-500 ring-offset-1 shadow-sm' : ''
            }`}
            style={{
              backgroundColor: isSelected ? color : `${color}12`,
              border: `1px solid ${color}30`,
              color: isSelected ? '#ffffff' : color,
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-125"
              style={{ backgroundColor: isSelected ? '#ffffff' : color }}
            />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

export default CategoryFilterPills;

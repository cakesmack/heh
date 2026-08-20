import { useState, useEffect } from 'react';
import { Category } from '@/types';
import { api } from '@/lib/api';
import CategoryCard from './CategoryCard';

interface CategoryGridProps {
  activeCategory?: string;
  onSelectCategory?: (slug: string) => void;
  initialCategories?: Category[];
}

export default function CategoryGrid({ activeCategory, onSelectCategory, initialCategories }: CategoryGridProps = {}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loading, setLoading] = useState(initialCategories ? false : true);

  useEffect(() => {
    if (initialCategories) return;
    const fetchCategories = async () => {
      try {
        const response = await api.categories.list();
        setCategories(response.categories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [initialCategories]);

  if (loading) {
    return (
      <section className="py-1.5 md:py-3 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible whitespace-nowrap scrollbar-hide snap-x gap-2 md:gap-3 pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-8 md:h-10 w-20 md:w-28 rounded-full bg-gray-100 animate-pulse flex-shrink-0 snap-start" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section className="py-1.5 md:py-3 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible whitespace-nowrap scrollbar-hide snap-x gap-2 md:gap-3 pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              isActive={activeCategory === category.slug}
              onClick={onSelectCategory}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

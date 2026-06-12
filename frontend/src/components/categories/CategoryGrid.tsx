import { useState, useEffect } from 'react';
import { Category } from '@/types';
import { api } from '@/lib/api';
import CategoryCard from './CategoryCard';

interface CategoryGridProps {
  activeCategory?: string;
  onSelectCategory?: (slug: string) => void;
}

export default function CategoryGrid({ activeCategory, onSelectCategory }: CategoryGridProps = {}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return (
      <section className="py-3 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row flex-nowrap overflow-x-auto whitespace-nowrap hide-scrollbar gap-3 pb-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 w-28 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section className="py-3 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-row flex-nowrap overflow-x-auto whitespace-nowrap hide-scrollbar gap-3 pb-1">
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

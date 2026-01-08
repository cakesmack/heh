import { useState, useEffect } from 'react';
import { Category } from '@/types';
import { api } from '@/lib/api';
import CategoryCard from './CategoryCard';

export default function CategoryGrid() {
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
      <section className="w-full bg-white">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[500px] bg-gray-200 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-white">
      {/* Desktop Grid / Mobile Carousel Container */}
      <div className="w-full">
        {/*
                Mobile: 2-Row Horizontal Scroll (Grid of 6 items visible, swipe for more)
                Desktop: Standard Grid with Hybrid Radius (Sharp corners)
            */}
        <div className="grid grid-rows-2 grid-flow-col auto-cols-[140px] sm:auto-cols-[180px] gap-2 overflow-x-auto px-4 pb-4 md:grid-flow-row md:grid-rows-none md:grid-cols-2 lg:grid-cols-4 md:gap-0 md:px-0 md:pb-0 no-scrollbar md:auto-cols-auto">
          {categories.map((category) => (
            <div key={category.id} className="h-24 sm:h-32 md:h-72 rounded-xl md:rounded-none overflow-hidden relative">
              <CategoryCard category={category} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
                Mobile: Horizontal Scroll Snap
                Desktop: Grid 
            */}
        <div className="flex overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-4 gap-0 scrollbar-hide">
          {categories.map((category) => (
            <div key={category.id} className="min-w-[85vw] md:min-w-0 snap-center h-[500px] md:h-72">
              <CategoryCard category={category} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

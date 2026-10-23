import { useState, useEffect } from 'react';
import { Category } from '@/types';
import { api } from '@/lib/api';
import CategoryCard from './CategoryCard';

interface CategoryGridProps {
  activeCategory?: string;
  onSelectCategory?: (slug: string) => void;
  initialCategories?: Category[];
  compact?: boolean;
}

// Presentation order on the homepage only; records/colours/URLs remain API-owned.
const homepageOrder = [
  'Music', 'Arts, Theatre & Dance', 'Family & Kids', 'Festivals', 'Food & Drink', 'Comedy',
  'Nightlife & Social', 'Sports & Fitness', 'Culture & Heritage', 'Classes & Workshops',
  'Markets & Fairs', 'Nature & Outdoors', 'Talks, Lectures & Business', 'Film & Cinema',
];

export default function CategoryGrid({ activeCategory, onSelectCategory, initialCategories, compact = false }: CategoryGridProps = {}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loading, setLoading] = useState(initialCategories ? false : true);
  const [expanded, setExpanded] = useState(false);
  const containerClass = compact ? 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
  const pillsClass = compact ? 'flex flex-wrap gap-2 md:gap-3 pb-1' : 'flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible whitespace-nowrap scrollbar-hide snap-x gap-2 md:gap-3 pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
  const order = (category: Category) => {
    const index = homepageOrder.indexOf(category.name);
    return index < 0 ? homepageOrder.length : index;
  };
  const displayedCategories = compact ? [...categories].sort((a, b) => order(a) - order(b)) : categories;

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
        <div className={containerClass}>
          <div className={pillsClass}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`h-8 md:h-10 w-20 md:w-28 rounded-full bg-gray-100 animate-pulse flex-shrink-0 snap-start ${compact && i >= 6 ? 'hidden md:block' : ''}`} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section className="py-1.5 md:py-3 bg-white">
      <div className={containerClass}>
        <div id={compact ? 'homepage-category-pills' : undefined} className={pillsClass}>
          {displayedCategories.map((category, index) => {
            const card = <CategoryCard
              key={category.id}
              category={category}
              isActive={activeCategory === category.slug}
              onClick={onSelectCategory}
            />;
            return compact ? <span key={category.id} className={!expanded && index >= 8 ? 'hidden' : !expanded && index >= 6 ? 'hidden md:contents' : 'contents'}>{card}</span> : card;
          })}
          {compact && categories.length > 6 && <button type="button" aria-expanded={expanded} aria-controls="homepage-category-pills"
            onClick={() => setExpanded(current => !current)}
            className={`inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 md:px-5 md:py-2.5 md:text-sm ${categories.length <= 8 ? 'md:hidden' : ''}`}>
            {expanded ? 'Fewer categories' : 'More categories'}
          </button>}
        </div>
      </div>
    </section>
  );
}

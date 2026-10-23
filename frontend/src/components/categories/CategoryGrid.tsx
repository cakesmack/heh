import { useState, useEffect } from 'react';
import { Category } from '@/types';
import { api } from '@/lib/api';
import CategoryCard from './CategoryCard';
import { browseCategories } from './browseCategories';

interface CategoryGridProps {
  activeCategory?: string;
  onSelectCategory?: (slug: string) => void;
  initialCategories?: Category[];
  compact?: boolean;
  browse?: boolean;
}

// Presentation order on the homepage only; records/colours/URLs remain API-owned.
const homepageOrder = [
  'Music', 'Arts, Theatre & Dance', 'Family & Kids', 'Festivals', 'Food & Drink', 'Comedy',
  'Nightlife & Social', 'Sports & Fitness', 'Culture & Heritage', 'Classes & Workshops',
  'Markets & Fairs', 'Nature & Outdoors', 'Talks, Lectures & Business', 'Film & Cinema',
];

export default function CategoryGrid({ activeCategory, onSelectCategory, initialCategories, compact = false, browse = false }: CategoryGridProps = {}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loading, setLoading] = useState(initialCategories ? false : true);
  const [expanded, setExpanded] = useState(false);
  const containerClass = compact ? 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
  const pillsClass = compact ? 'flex flex-wrap gap-1.5 md:gap-2' : 'flex flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible whitespace-nowrap scrollbar-hide snap-x gap-2 md:gap-3 pb-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
  const sectionClass = compact ? 'py-1 bg-white' : 'py-1.5 md:py-3 bg-white';
  const order = (category: Category) => {
    const index = homepageOrder.indexOf(category.name);
    return index < 0 ? homepageOrder.length : index;
  };
  const displayedCategories = compact ? [...categories].sort((a, b) => order(a) - order(b)) : categories;

  useEffect(() => {
    if (initialCategories || browse) return;
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
  }, [initialCategories, browse]);

  if (browse) {
    return <div id="browse-event-categories" className="flex flex-wrap gap-2 xl:block xl:space-y-2">
      {[browseCategories.slice(0, 7), browseCategories.slice(7)].map((row, index) =>
        <div key={index} className="contents xl:flex xl:w-full xl:items-center xl:justify-between xl:gap-2 xl:[&>*]:shrink-0">
          {row.map(category => <CategoryCard key={category.slug} category={category} browsePill
            isActive={activeCategory === category.slug} onClick={onSelectCategory} />)}
        </div>)}
    </div>;
  }

  if (loading) {
    return (
      <section className={sectionClass}>
        <div className={containerClass}>
          <div className={pillsClass}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`${compact ? 'h-9 rounded-lg' : 'h-8 md:h-10 rounded-full'} w-20 md:w-28 bg-gray-100 animate-pulse flex-shrink-0 snap-start ${compact && i >= 6 ? 'hidden md:block' : ''}`} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <div id={compact ? 'homepage-category-pills' : undefined} className={pillsClass}>
          {displayedCategories.map((category, index) => {
            const card = <CategoryCard
              key={category.id}
              category={category}
              isActive={activeCategory === category.slug}
              onClick={onSelectCategory}
              compact={compact}
            />;
            return compact ? <span key={category.id} className={!expanded && index >= 8 ? 'hidden' : !expanded && index >= 6 ? 'hidden md:contents' : 'contents'}>{card}</span> : card;
          })}
          {compact && categories.length > 6 && <button type="button" aria-expanded={expanded} aria-controls="homepage-category-pills"
            onClick={() => setExpanded(current => !current)}
            className={`inline-flex min-h-9 items-center gap-1 rounded px-1 py-1.5 text-xs font-medium text-gray-500 hover:text-highland-green hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 ${categories.length <= 8 ? 'md:hidden' : ''}`}>
            {expanded ? 'Show fewer categories' : 'View all categories'}<span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
          </button>}
        </div>
      </div>
    </section>
  );
}

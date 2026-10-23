import { useState, useEffect } from 'react';
import { Category } from '@/types';
import { api } from '@/lib/api';
import CategoryCard from './CategoryCard';
import { browseCategoryNames, currentBrowseCategories } from './browseCategories';

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

  if (browse) {
    const current = currentBrowseCategories(categories);
    const initial = new Set<string>(browseCategoryNames.slice(0, 8));
    const showAll = expanded;
    return <div>
      <div id="browse-event-categories" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
        {loading ? Array.from({ length: 8 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-gray-200" />)
          : current.map(category => <div key={category.id} className={!showAll && !initial.has(category.name) ? 'hidden' : ''}>
            <CategoryCard category={category} tile isActive={activeCategory === category.slug} onClick={onSelectCategory} />
          </div>)}
      </div>
      {!loading && current.length < browseCategoryNames.length && <p role="status" className="mt-3 text-xs text-gray-500">Some current categories are unavailable in the site’s category data.</p>}
      {!loading && current.some(category => !initial.has(category.name)) && <button type="button"
        aria-expanded={showAll} aria-controls="browse-event-categories"
        onClick={() => setExpanded(!showAll)}
        className="mt-2 inline-flex min-h-11 items-center gap-1 rounded text-sm font-medium text-gray-500 underline-offset-4 hover:text-highland-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
        {showAll ? 'Show fewer categories' : 'View all 14 categories'}<span aria-hidden="true">{showAll ? '↑' : '→'}</span>
      </button>}
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

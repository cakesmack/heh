import CategoryGrid from './CategoryGrid';
import PopularLocations from '@/components/PopularLocations';

interface BrowseEventsProps {
  activeCategory?: string;
  onSelectCategory?: (slug: string) => void;
  activeLocation?: string;
  locationCategorySlug?: string;
}

export default function BrowseEvents({ activeCategory, onSelectCategory, activeLocation, locationCategorySlug }: BrowseEventsProps) {
  return <section aria-label="Browse events" className="rounded-2xl bg-stone-100/70 p-4 sm:p-6">
    <h2 className="text-xl font-bold tracking-tight text-highland-green">Browse events</h2>
    <div className="mt-4 grid gap-6 lg:grid-cols-3 lg:gap-8">
      <div className="min-w-0 lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Browse by category</h3>
        <CategoryGrid browse activeCategory={activeCategory} onSelectCategory={onSelectCategory} />
      </div>
      <div className="min-w-0">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Browse by location</h3>
        <PopularLocations browse activeLocation={activeLocation} categorySlug={locationCategorySlug} />
      </div>
    </div>
  </section>;
}

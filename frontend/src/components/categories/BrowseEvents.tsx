import CategoryGrid from './CategoryGrid';
import PopularLocations from '@/components/PopularLocations';

interface BrowseEventsProps {
  activeCategory?: string;
  onSelectCategory?: (slug: string) => void;
  activeLocation?: string;
  locationCategorySlug?: string;
  homepageLocations?: boolean;
}

export default function BrowseEvents({ activeCategory, onSelectCategory, activeLocation, locationCategorySlug, homepageLocations = false }: BrowseEventsProps) {
  return <section aria-label="Browse events" className="rounded-2xl bg-stone-100/70 p-3 sm:p-4">
    <h2 className="text-xl font-bold tracking-tight text-highland-green">Browse events</h2>
    <div className="mt-3 grid gap-4 lg:grid-cols-10 lg:gap-x-10">
      <div className="min-w-0 lg:col-span-7">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Browse by category</h3>
        <CategoryGrid browse activeCategory={activeCategory} onSelectCategory={onSelectCategory} />
      </div>
      <div className="min-w-0 lg:col-span-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Browse by location</h3>
        <PopularLocations browse homepageShortlist={homepageLocations} activeLocation={activeLocation} categorySlug={locationCategorySlug} />
      </div>
    </div>
  </section>;
}

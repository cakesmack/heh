import Link from 'next/link';
import { Category } from '@/types';

interface CategoryCardProps {
    category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
    return (
        <Link
            href={`/category/${category.slug}`}
            className="group relative block w-full h-full overflow-hidden"
        >
            {/* Background Image with Zoom Effect */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-in-out group-hover:scale-110"
                style={{
                    backgroundImage: category.image_url
                        ? `url(${category.image_url})`
                        : 'url(/images/category-placeholder.jpg)',
                }}
            />

            {/* Gradient Overlay (Scrim) - Strong black at bottom for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />

            {/* Content */}
            <div className="absolute bottom-0 left-0 p-3 md:p-8 w-full">
                <h3 className="text-sm sm:text-lg md:text-3xl lg:text-4xl font-black text-white uppercase tracking-wider mb-1 md:mb-2 line-clamp-2 md:line-clamp-none">
                    {category.name}
                </h3>
                {category.event_count !== undefined && category.event_count > 0 && (
                    <p className="text-[10px] md:text-sm font-medium text-gray-300 hidden sm:block">
                        {category.event_count} event{category.event_count !== 1 ? 's' : ''}
                    </p>
                )}
            </div>
        </Link>
    );
}

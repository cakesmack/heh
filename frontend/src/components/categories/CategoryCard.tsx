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

            {/* Gradient Overlay (Scrim) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

            {/* Content */}
            <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full">
                <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-wider mb-2">
                    {category.name}
                </h3>
                {category.event_count !== undefined && category.event_count > 0 && (
                    <p className="text-sm font-medium text-gray-300">
                        {category.event_count} event{category.event_count !== 1 ? 's' : ''}
                    </p>
                )}
            </div>
        </Link>
    );
}

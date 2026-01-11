import Link from 'next/link';
import { Category } from '@/types';

interface CategoryCardProps {
    category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
    // Use gradient_color from database, fallback to black
    const gradientColor = category.gradient_color || '#000000';

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

            {/* Gradient Overlay (Scrim) - Uses category color from database */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(to top, ${gradientColor}E6 0%, ${gradientColor}99 30%, transparent 100%)`,
                }}
            />

            {/* Content */}
            <div className="absolute bottom-0 left-0 p-3 md:p-8 w-full">
                <h3
                    className="text-sm sm:text-lg md:text-3xl lg:text-4xl font-black text-white uppercase tracking-wider mb-1 md:mb-2 line-clamp-2 md:line-clamp-none"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)' }}
                >
                    {category.name}
                </h3>

            </div>
        </Link>
    );
}

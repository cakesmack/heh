import Link from 'next/link';
import { Category } from '@/types';

interface CategoryCardProps {
    category: Category;
    isActive?: boolean;
    onClick?: (slug: string) => void;
}

export default function CategoryCard({ category, isActive = false, onClick }: CategoryCardProps) {
    const color = category.gradient_color || '#059669';
    const baseClass = "group inline-flex items-center gap-1.5 md:gap-2.5 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 flex-shrink-0 snap-start";

    if (onClick) {
        return (
            <button
                type="button"
                onClick={() => onClick(category.slug)}
                className={`${baseClass} cursor-pointer ${isActive ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
                style={{
                    backgroundColor: isActive ? color : `${color}10`,
                    border: `1px solid ${color}25`,
                    color: isActive ? '#ffffff' : color,
                }}
            >
                <span
                    className="w-2 h-2 rounded-full flex-shrink-0 transition-transform duration-200 group-hover:scale-125"
                    style={{ backgroundColor: isActive ? '#ffffff' : color }}
                />
                {category.name}
            </button>
        );
    }

    return (
        <Link
            href={`/category/${category.slug}`}
            className={baseClass}
            style={{
                backgroundColor: `${color}10`,
                border: `1px solid ${color}25`,
                color: color,
            }}
        >
            <span
                className="w-2 h-2 rounded-full flex-shrink-0 transition-transform duration-200 group-hover:scale-125"
                style={{ backgroundColor: color }}
            />
            {category.name}
        </Link>
    );
}

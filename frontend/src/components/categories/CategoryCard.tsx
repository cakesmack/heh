import Link from 'next/link';
import { Category } from '@/types';

interface CategoryCardProps {
    category: Category;
    isActive?: boolean;
    onClick?: (slug: string) => void;
    compact?: boolean;
    browsePill?: boolean;
}

export default function CategoryCard({ category, isActive = false, onClick, compact = false, browsePill = false }: CategoryCardProps) {
    const color = category.gradient_color || '#059669';
    const baseClass = browsePill
        ? 'group inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-left text-sm font-semibold leading-snug transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2'
        : compact
        ? 'group inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs md:text-sm font-semibold transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2'
        : "group inline-flex items-center gap-1.5 md:gap-2.5 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 flex-shrink-0 snap-start";

    if (onClick) {
        return (
            <button
                type="button"
                aria-pressed={browsePill ? isActive : undefined}
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

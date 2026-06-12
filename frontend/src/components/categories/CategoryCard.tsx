import Link from 'next/link';
import { Category } from '@/types';

interface CategoryCardProps {
    category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
    const color = category.gradient_color || '#059669';

    return (
        <Link
            href={`/category/${category.slug}`}
            className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 flex-shrink-0"
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

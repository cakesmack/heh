/**
 * AgeRestrictionBadge Component
 * Displays a colored badge for event age restrictions
 */
import { getAgeRestrictionBadge, BADGE_COLOR_CLASSES } from '@/lib/ageRestriction';

interface AgeRestrictionBadgeProps {
    value: string | undefined | null;
    className?: string;
    size?: 'sm' | 'md';
}

export default function AgeRestrictionBadge({
    value,
    className = '',
    size = 'sm'
}: AgeRestrictionBadgeProps) {
    const badge = getAgeRestrictionBadge(value);

    // Don't show badge for empty/null values or "all_ages" (default)
    if (!badge || badge.value === '' || badge.value === 'all_ages') {
        return null;
    }

    const sizeClasses = size === 'sm'
        ? 'text-xs px-2 py-0.5'
        : 'text-sm px-2.5 py-1';

    const colorClasses = BADGE_COLOR_CLASSES[badge.badgeColor];

    return (
        <span
            className={`inline-flex items-center font-medium rounded-full ${sizeClasses} ${colorClasses} ${className}`}
        >
            {badge.badgeLabel}
        </span>
    );
}

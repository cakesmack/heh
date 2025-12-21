/**
 * Age Restriction Constants
 * Central definitions for age restriction options and badge styling
 */

export type AgeRestrictionValue =
    | 'all_ages'
    | 'kid_friendly'
    | 'family'
    | '12_plus'
    | '15_plus'
    | '18_plus'
    | '21_plus';

export interface AgeRestrictionOption {
    value: AgeRestrictionValue | '';
    label: string;
    badgeColor: 'gray' | 'green' | 'amber' | 'red';
    badgeLabel: string;
}

export const AGE_RESTRICTION_OPTIONS: AgeRestrictionOption[] = [
    { value: '', label: 'No Restriction', badgeColor: 'gray', badgeLabel: 'All Ages' },
    { value: 'all_ages', label: 'All Ages', badgeColor: 'gray', badgeLabel: 'All Ages' },
    { value: 'kid_friendly', label: 'Kid Friendly', badgeColor: 'green', badgeLabel: 'Kid Friendly' },
    { value: 'family', label: 'Family Friendly', badgeColor: 'green', badgeLabel: 'Family' },
    { value: '12_plus', label: '12+', badgeColor: 'amber', badgeLabel: '12+' },
    { value: '15_plus', label: '15+', badgeColor: 'amber', badgeLabel: '15+' },
    { value: '18_plus', label: '18+', badgeColor: 'red', badgeLabel: '18+' },
    { value: '21_plus', label: '21+', badgeColor: 'red', badgeLabel: '21+' },
];

/**
 * Get badge info for an age restriction value
 */
export function getAgeRestrictionBadge(value: string | undefined | null): AgeRestrictionOption | null {
    if (!value) return null;

    const option = AGE_RESTRICTION_OPTIONS.find(opt => opt.value === value);
    return option || null;
}

/**
 * Badge color classes for Tailwind
 */
export const BADGE_COLOR_CLASSES = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
};

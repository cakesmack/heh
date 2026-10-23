import type { Category } from '@/types';

// Navigation order only. IDs, destinations and colours remain API-owned.
export const browseCategoryNames = [
  'Music', 'Arts, Theatre & Dance', 'Family & Kids', 'Festivals', 'Food & Drink', 'Comedy',
  'Nightlife & Social', 'Sports & Fitness', 'Nature & Outdoors', 'Classes & Workshops',
  'Talks, Lectures & Business', 'Culture & Heritage', 'Markets & Fairs', 'Film & Cinema',
] as const;

export function currentBrowseCategories(categories: Category[]): Category[] {
  return browseCategoryNames.flatMap(name => {
    const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    const category = categories.find(item => item.name === name)
      || categories.find(item => item.slug === slug);
    // A combined legacy record cannot safely stand in for multiple categories.
    return category ? [{ ...category, name }] : [];
  });
}

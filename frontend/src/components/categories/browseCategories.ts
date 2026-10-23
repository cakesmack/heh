import type { Category } from '@/types';

// Authoritative navigation catalogue for the homepage and Events browse panel.
// These are frontend destinations/accents, not database records or category IDs.
export const browseCategories = [
  { name: 'Nature & Outdoors', slug: 'nature-outdoors', gradient_color: '#059669' },
  { name: 'Classes & Workshops', slug: 'classes-workshops', gradient_color: '#4F46E5' },
  { name: 'Talks, Lectures & Business', slug: 'talks-lectures-business', gradient_color: '#1E4B75' },
  { name: 'Nightlife & Social', slug: 'nightlife-social', gradient_color: '#16A34A' },
  { name: 'Comedy', slug: 'comedy', gradient_color: '#F59E0B' },
  { name: 'Culture & Heritage', slug: 'culture-heritage', gradient_color: '#B45309' },
  { name: 'Food & Drink', slug: 'food-drink', gradient_color: '#EA580C' },
  { name: 'Music', slug: 'music', gradient_color: '#7C3AED' },
  { name: 'Family & Kids', slug: 'family-kids', gradient_color: '#3B82F6' },
  { name: 'Arts, Theatre & Dance', slug: 'arts-theatre-dance', gradient_color: '#E11D48' },
  { name: 'Festivals', slug: 'festivals', gradient_color: '#DB2777' },
  { name: 'Markets & Fairs', slug: 'markets-fairs', gradient_color: '#C89D45' },
  { name: 'Sports & Fitness', slug: 'sports-fitness', gradient_color: '#2563EB' },
  { name: 'Film & Cinema', slug: 'film-cinema', gradient_color: '#6A4C93' },
] as const satisfies ReadonlyArray<Pick<Category, 'name' | 'slug' | 'gradient_color'>>;

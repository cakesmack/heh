/**
 * Shared TypeScript types for Highland Events Hub
 * These types mirror the backend Pydantic schemas
 */

// ============================================================
// ENUMS
// ============================================================

// ============================================================
// VENUE CATEGORY TYPES
// ============================================================

export interface VenueCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface VenueCategoryCreate {
  name: string;
  slug: string;
  description?: string;
}

export interface VenueCategoryUpdate {
  name?: string;
  slug?: string;
  description?: string;
}

export enum EventCategory {
  MUSIC = "music",
  FOOD = "food",
  ART = "art",
  SPORTS = "sports",
  CULTURE = "culture",
  NIGHTLIFE = "nightlife",
  OUTDOORS = "outdoors",
  FAMILY = "family",
  OTHER = "other",
}

// ============================================================
// CATEGORY TYPES
// ============================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  gradient_color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  event_count?: number;
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
}

// ============================================================
// TAG TYPES
// ============================================================

export interface Tag {
  id: string;
  name: string;
  slug?: string;
  usage_count: number;
  created_at: string;
}

export interface TagListResponse {
  tags: Tag[];
  total: number;
}

export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED_AMOUNT = "fixed_amount",
  FREE_ITEM = "free_item",
}

// ============================================================
// USER TYPES
// ============================================================

export interface User {
  id: string;
  email: string;
  username?: string;
  trust_level?: number;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  organizer_profiles?: Organizer[];
}

export interface UserProfile extends User {
  total_checkins: number;
  total_events_submitted: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ============================================================
// VENUE TYPES
// ============================================================

export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category_id?: string;
  category?: VenueCategory;
  description?: string;
  website?: string;
  phone?: string;
  image_url?: string;
  formatted_address?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  // Phase 2.10 additions
  postcode?: string;
  address_full?: string;
  // Amenities
  is_dog_friendly?: boolean;
  has_wheelchair_access?: boolean;
  has_parking?: boolean;
  serves_food?: boolean;
  amenities_notes?: string;
}

export interface VenueResponse extends Venue {
  distance_km?: number;
  upcoming_events_count?: number;
  email?: string;
  opening_hours?: string;
  owner_email?: string;
  // Social Media Links
  social_facebook?: string;
  social_instagram?: string;
  social_x?: string;
  social_linkedin?: string;
  social_tiktok?: string;
  website_url?: string;
}

export interface VenueCreate {
  name: string;
  address: string;
  postcode: string;
  latitude: number;
  longitude: number;
  category_id: string;
  description?: string;
  website?: string;
  phone?: string;
  image_url?: string;
  // Amenities
  is_dog_friendly?: boolean;
  has_wheelchair_access?: boolean;
  has_parking?: boolean;
  serves_food?: boolean;
  amenities_notes?: string;
}

export interface VenueUpdate {
  name?: string;
  address?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  category_id?: string;
  description?: string;
  website?: string;
  phone?: string;
  // Amenities
  is_dog_friendly?: boolean;
  has_wheelchair_access?: boolean;
  has_parking?: boolean;
  serves_food?: boolean;
  amenities_notes?: string;
}

export interface VenueFilter {
  category_id?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  sort_by?: 'name' | 'activity';
  skip?: number;
  limit?: number;
}

export interface VenueListResponse {
  venues: VenueResponse[];
  total: number;
  skip: number;
  limit: number;
}

// ============================================================
// SHOWTIME TYPES (Theatre/Cinema workflow)
// ============================================================

export interface Showtime {
  id: number;
  event_id: string;
  start_time: string;
  end_time?: string;
  ticket_url?: string;
  notes?: string;
}

export interface ShowtimeCreate {
  start_time: string;
  end_time?: string;
  ticket_url?: string;
  notes?: string;
}

// ============================================================
// EVENT TYPES
// ============================================================

export interface Event {
  id: string;
  title: string;
  description?: string;
  date_start: string;
  date_end: string;
  venue_id: string;
  latitude: number;
  longitude: number;
  category_id?: string;
  price: number;
  price_display?: string;  // User-friendly text like "Free", "£5-£10"
  min_price?: number;      // Numeric for filtering
  image_url?: string;
  featured: boolean;
  featured_until?: string;
  organizer_id: string;
  created_at: string;
  updated_at: string;
  // Phase 2.10 additions
  ticket_url?: string;
  age_restriction?: string;
  min_age?: number;  // Numeric minimum age (0 = all ages)
  postcode?: string;
  address_full?: string;
  location_name?: string;
  status?: string;
  moderation_reason?: string;  // Why it was flagged (e.g., "Contains: razor")
  // Phase 2.3 additions
  organizer_profile_id?: string;
  recurrence_rule?: string;
  is_recurring?: boolean;
  parent_event_id?: string;
}

export interface OrganizerProfileResponse {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
}

export interface EventResponse extends Event {
  venue_name?: string;
  distance_km?: number;
  checkin_count?: number;
  view_count?: number;
  save_count?: number;
  ticket_click_count?: number;
  category?: Category;
  tags?: Tag[];
  organizer_email?: string;
  organizer_profile_name?: string;
  organizer_profile?: OrganizerProfileResponse;
  participating_venues?: VenueResponse[];
  showtimes?: Showtime[];
}

export interface EventCreate {
  title: string;
  description?: string;
  date_start: string;
  date_end: string;
  venue_id: string;
  category_id: string;
  price?: number | string;  // Can be number or text like "Free", "£5-£10"
  image_url?: string;
  tags?: string[];
  // Phase 2.10 additions
  ticket_url?: string;
  age_restriction?: number | string;  // Can be number (18) or string ("18+")
  location_name?: string;
  // Phase 2.3 additions
  organizer_profile_id?: string;
  recurrence_rule?: string;
  is_recurring?: boolean;
  frequency?: string;
  recurrence_end_date?: string;
  participating_venue_ids?: string[];
  latitude?: number;
  longitude?: number;
  showtimes?: ShowtimeCreate[];
}

export interface EventUpdate {
  title?: string;
  description?: string;
  date_start?: string;
  date_end?: string;
  venue_id?: string | null;  // Allow null to clear venue
  category_id?: string;
  price?: number | string;
  image_url?: string;
  featured?: boolean;
  featured_until?: string;
  tags?: string[];
  // Phase 2.10 additions
  ticket_url?: string;
  age_restriction?: string;
  location_name?: string | null;
  // Phase 2.3 additions
  organizer_profile_id?: string;
  recurrence_rule?: string;
  is_recurring?: boolean;
  frequency?: string;
  recurrence_end_date?: string;
  participating_venue_ids?: string[];
  latitude?: number | null;
  longitude?: number | null;
  showtimes?: ShowtimeCreate[];
}

export interface EventFilter {
  category?: EventCategory;
  category_id?: string;
  category_ids?: string[];
  tag_names?: string[];
  tag?: string;
  q?: string;
  location?: string;
  venue_id?: string;
  date_from?: string;
  date_to?: string;
  age_restriction?: string;
  price_min?: number;
  price_max?: number;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  featured_only?: boolean;
  organizer_id?: string;
  organizer_profile_id?: string;
  include_past?: boolean;
  skip?: number;
  limit?: number;
}

export interface EventListResponse {
  events: EventResponse[];
  total: number;
  skip: number;
  limit: number;
}

// ============================================================
// CHECK-IN TYPES
// ============================================================

export interface CheckIn {
  id: string;
  user_id: string;
  event_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  is_first_at_venue: boolean;
  is_night_checkin: boolean;
}

export interface CheckInRequest {
  latitude: number;
  longitude: number;
  device_time?: string;
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  promotion_unlocked?: {
    id: string;
    title: string;
    description: string;
    discount_type: DiscountType;
    discount_value: number;
  };
  checkin_id: string;
}

export interface CheckInStatsResponse {
  total_checkins: number;
  unique_venues: number;
  first_checkin?: string;
  last_checkin?: string;
}

// ============================================================
// PROMOTION TYPES
// ============================================================

export interface Promotion {
  id: string;
  venue_id: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  requires_checkin: boolean;
  active: boolean;
  expires_at?: string;
  created_at: string;
}

export interface PromotionResponse extends Promotion {
  venue_name?: string;
  is_unlocked?: boolean;
  distance_km?: number;
}

export interface PromotionCreate {
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  requires_checkin?: boolean;
  active?: boolean;
  expires_at?: string;
}

export interface PromotionUpdate {
  title?: string;
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  requires_checkin?: boolean;
  active?: boolean;
  expires_at?: string;
}

export interface PromotionListResponse {
  promotions: PromotionResponse[];
  total: number;
}

// ============================================================
// GEOLOCATION TYPES
// ============================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: number;
}

// ============================================================
// API ERROR TYPES
// ============================================================

export interface APIError {
  detail: string;
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationError[];
}

// ============================================================
// PHASE 2.10 NEW TYPES
// ============================================================

export interface UserDashboardStats {
  user_id: string;
  total_events: number;
  upcoming_events: number;
  past_events: number;
  pending_events: number;
  total_views: number;
  total_saves: number;
  total_ticket_clicks: number;
  total_checkins: number;
}
export interface PostcodeLookupResult {
  postcode: string;
  address_full: string;
  latitude: number;
  longitude: number;
  town?: string;
  county?: string;
  country: string;
}

export interface TagMergeRequest {
  source_tag_id: string;
  target_tag_id: string;
}

// ============================================================
// HERO SYSTEM TYPES
// ============================================================

export interface HeroSlot {
  id: number;
  position: number;
  type: 'welcome' | 'spotlight_event';
  event_id?: string;
  image_override?: string;
  title_override?: string;
  cta_override?: string;
  overlay_style: 'dark' | 'light' | 'gradient';
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  event?: EventResponse;
}

export interface HeroSlotCreate {
  position: number;
  type?: string;
  event_id?: string;
  image_override?: string;
  title_override?: string;
  cta_override?: string;
  overlay_style?: string;
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
}

export interface HeroSlotUpdate {
  type?: string;
  event_id?: string;
  image_override?: string;
  title_override?: string;
  cta_override?: string;
  overlay_style?: string;
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
}

export interface VenueClaim {
  id: number;
  venue_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  venue?: VenueResponse;
}

export interface AddressSuggestion {
  id: string;
  address: string;
  url: string;
}

// ============================================================
// ANALYTICS TYPES
// ============================================================

export interface AdminDashboardStats {
  total_users: number;
  total_events: number;
  total_venues: number;
  total_organizers: number;
  upcoming_events: number;
  past_events: number;
  total_checkins: number;
  pending_reports: number;
  pending_events: number;
  pending_claims: number;
}

export interface DailyStats {
  date: string;
  count: number;
}

export interface AdminAnalyticsSummary {
  total_views: number;
  total_unique_visitors: number;
  top_events: { id: string; title: string; views: number }[];
  top_categories: { name: string; clicks: number }[];
  content_gaps: { query: string; count: number }[];
  conversion_rate: number;
  total_event_views: number;
  total_ticket_clicks: number;
  daily_views: DailyStats[];
  previous_total_views?: number;
  previous_conversion_rate?: number;
}

export interface VenueAnalyticsSummary {
  total_views: number;
  daily_views: DailyStats[];
  top_events: { id: string; title: string; views: number }[];
}

export interface OrganizerEventStats {
  event_id: string;
  title: string;
  views: number;
  saves: number;
  ticket_clicks: number;
}

export interface OrganizerSummary {
  total_views: number;
  total_saves: number;
  total_ticket_clicks: number;
  events: OrganizerEventStats[];
}

export interface MissedOpportunity {
  term: string;
  count: number;
}

export interface MissedOpportunitiesResponse {
  missing_locations: MissedOpportunity[];
  missing_topics: MissedOpportunity[];
  total_failed_searches: number;
}

// ============================================================
// MODERATION TYPES
// ============================================================

export interface Report {
  id: number;
  target_type: 'event' | 'venue';
  target_id: string;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface ReportCreate {
  target_type: 'event' | 'venue';
  target_id: string;
  reason: string;
  details?: string;
}

// ============================================================
// COLLECTION TYPES
// ============================================================

export interface Collection {
  id: number;
  title: string;
  subtitle?: string;
  image_url?: string;
  target_link: string;
  is_active: boolean;
  sort_order: number;
  fixed_start_date?: string;
  fixed_end_date?: string;
}

export interface CollectionCreate {
  title: string;
  subtitle?: string;
  image_url?: string;
  target_link: string;
  is_active?: boolean;
  sort_order?: number;
  fixed_start_date?: string;
  fixed_end_date?: string;
}

export interface CollectionUpdate {
  title?: string;
  subtitle?: string;
  image_url?: string;
  target_link?: string;
  is_active?: boolean;
  sort_order?: number;
  fixed_start_date?: string;
  fixed_end_date?: string;
}

// ============================================================
// ORGANIZER TYPES
// ============================================================

export interface Organizer {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  logo_url?: string;
  hero_image_url?: string;
  website_url?: string;
  social_links?: Record<string, string>;
  user_id: string;
  created_at: string;
  updated_at: string;
  // Enhanced profile fields
  cover_image_url?: string;
  city?: string;
  social_facebook?: string;
  social_instagram?: string;
  social_website?: string;
  public_email?: string;
  // Computed stats (from API)
  total_events_hosted?: number;
  follower_count?: number;
}

export interface OrganizerCreate {
  name: string;
  bio?: string;
  logo_url?: string;
  hero_image_url?: string;
  website_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
}

export interface OrganizerUpdate {
  name?: string;
  bio?: string;
  logo_url?: string;
  hero_image_url?: string;
  website_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
}

export interface OrganizerListResponse {
  organizers: Organizer[];
  total: number;
}

// ============================================================
// GROUP MEMBER TYPES (Team Management)
// ============================================================

export type GroupRole = 'owner' | 'admin' | 'editor';

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  user_email?: string;
  user_username?: string;
}

export interface GroupInvite {
  token: string;
  group_id: string;
  created_at: string;
  expires_at: string;
}

export interface GroupMemberRoleUpdate {
  role: string;
}

// ============================================================
// VENUE STAFF TYPES
// ============================================================

export interface VenueStaffResponse {
  id: number;
  venue_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user_email?: string;
  user_username?: string;
}

export interface VenueStaffCreate {
  user_email: string;
  role: string;
}

// ============================================================
// VENUE STATS TYPES
// ============================================================

export interface VenueStats {
  total_events: number;
  upcoming_events: number;
  last_event_date?: string;
}

// ============================================================
// USER PREFERENCES TYPES
// ============================================================

export interface UserPreferences {
  marketing_emails: boolean;
  weekly_digest: boolean;
  organizer_alerts: boolean;
  preferred_categories: string[];
}

export interface UserPreferencesUpdate {
  marketing_emails?: boolean;
  weekly_digest?: boolean;
  organizer_alerts?: boolean;
  preferred_categories?: string[];
}

// ============================================================
// FEATURED BOOKING TYPES
// ============================================================

export type SlotType = 'hero_home' | 'global_pinned' | 'category_pinned' | 'magazine_carousel';
export type BookingStatus = 'pending_payment' | 'pending_approval' | 'active' | 'completed' | 'cancelled' | 'rejected';

export interface SlotConfig {
  slot_type: string;
  max_slots: number;
  price_per_day: number;
  min_days: number;
}

export interface AvailabilityRequest {
  slot_type: SlotType;
  start_date: string;
  end_date: string;
  target_id?: string;
}

export interface AvailabilityResponse {
  available: boolean;
  unavailable_dates: string[];
  slots_remaining: Record<string, number>;
  price_quote: number;
  num_days: number;
  error?: string;
}

export interface CheckoutRequest {
  event_id: string;
  slot_type: SlotType;
  start_date: string;
  end_date: string;
  target_id?: string;
  custom_subtitle?: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  booking_id: string;
}

export interface FeaturedBooking {
  id: string;
  event_id: string;
  event_title?: string;
  slot_type: SlotType;
  target_id?: string;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  amount_paid: number;
  created_at: string;
}

export interface ActiveFeatured {
  id: string;
  event_id: string;
  event_title: string;
  event_image_url?: string;
  slot_type: SlotType;
  start_date: string;
  end_date: string;
  custom_subtitle?: string;
}

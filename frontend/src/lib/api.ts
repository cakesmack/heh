/**
 * API Client for Highland Events Hub
 * Handles all HTTP requests to the FastAPI backend
 */

import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserProfile,
  Event,
  EventResponse,
  EventCreate,
  EventUpdate,
  EventFilter,
  EventListResponse,
  Venue,
  VenueResponse,
  VenueCreate,
  VenueUpdate,
  VenueFilter,
  VenueListResponse,
  VenueCategory,
  VenueCategoryCreate,
  VenueCategoryUpdate,


  PromotionResponse,
  PromotionCreate,
  PromotionUpdate,
  PromotionListResponse,
  Category,
  CategoryListResponse,
  Tag,
  TagListResponse,
  UserDashboardStats,
  PostcodeLookupResult,
  TagMergeRequest,
  HeroSlot,
  HeroSlotCreate,
  HeroSlotUpdate,
  VenueClaim,
  AddressSuggestion,
  VenueAnalyticsSummary,
  Report,
  ReportCreate,
  AdminDashboardStats,
  Collection,
  CollectionCreate,
  CollectionUpdate,
  MissedOpportunitiesResponse,
  VenueStaffResponse,
  VenueStaffCreate,
  UserPreferences,
  UserPreferencesUpdate,
  SlotType,
  SlotConfig,
  AvailabilityRequest,
  AvailabilityResponse,
  CheckoutRequest,
  CheckoutResponse,
  FeaturedBooking,
  ActiveFeatured,
} from '@/types';

// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Set auth token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

/**
 * Clear auth token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

/**
 * Build headers for API requests
 */
function getHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * Generic fetch wrapper with error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  includeAuth = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = getHeaders(includeAuth);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: `HTTP ${response.status}: ${response.statusText}`,
    }));
    const errorMessage = typeof error.detail === 'string'
      ? error.detail
      : JSON.stringify(error.detail || error);
    throw new Error(errorMessage || 'An error occurred');
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

/**
 * Build query string from filter object
 */
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================
// AUTHENTICATION API
// ============================================================

export const authAPI = {
  /**
   * Register a new user
   */
  register: async (data: RegisterRequest): Promise<TokenResponse> => {
    const response = await apiFetch<TokenResponse>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      false
    );
    setAuthToken(response.access_token);
    return response;
  },

  /**
   * Login existing user
   */
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await apiFetch<TokenResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      false
    );
    setAuthToken(response.access_token);
    return response;
  },

  /**
   * Login with Google OAuth token
   */
  loginWithGoogle: async (googleToken: string): Promise<TokenResponse> => {
    const response = await apiFetch<TokenResponse>(
      '/api/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({ token: googleToken }),
      },
      false
    );
    setAuthToken(response.access_token);
    return response;
  },

  /**
   * Get current user profile
   */
  me: async (): Promise<UserProfile> => {
    return apiFetch<UserProfile>('/api/auth/me');
  },

  /**
   * Logout (client-side only)
   */
  logout: (): void => {
    clearAuthToken();
  },

  /**
   * Request password reset email
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      '/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      false
    );
  },

  /**
   * Reset password with token
   */
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      '/api/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      },
      false
    );
  },
};

// ============================================================
// ============================================================
// EVENTS API
// ============================================================

export const eventsAPI = {
  /**
   * List events with optional filters
   */
  list: async (filters?: EventFilter): Promise<EventListResponse> => {
    const params: Record<string, any> = {};
    if (filters) {
      if (filters.category) params.category = filters.category;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.tag) params.tag = filters.tag;
      if (filters.tag_names) params.tag_names = filters.tag_names;
      if (filters.q) params.q = filters.q;
      if (filters.location) params.location = filters.location;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.age_restriction) params.age_restriction = filters.age_restriction;
      if (filters.price_min !== undefined) params.price_min = filters.price_min;
      if (filters.price_max !== undefined) params.price_max = filters.price_max;
      if (filters.latitude !== undefined) params.latitude = filters.latitude;
      if (filters.longitude !== undefined) params.longitude = filters.longitude;
      if (filters.radius_km !== undefined) params.radius = filters.radius_km;
      if (filters.featured_only) params.featured_only = 'true';
      if (filters.organizer_id) params.organizer_id = filters.organizer_id;
      if (filters.organizer_profile_id) params.organizer_profile_id = filters.organizer_profile_id;
      if (filters.venue_id) params.venue_id = filters.venue_id;
      if (filters.include_past) params.include_past = 'true';
      if (filters.skip !== undefined) params.skip = filters.skip;
      if (filters.limit !== undefined) params.limit = filters.limit;
    }

    const queryString = buildQueryString(params);
    return apiFetch<EventListResponse>(`/api/events${queryString}`, {}, false);
  },

  /**
   * Create new event
   */
  create: async (data: EventCreate): Promise<EventResponse> => {
    return apiFetch<EventResponse>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get single event by ID
   */
  get: async (eventId: string): Promise<EventResponse> => {
    return apiFetch<EventResponse>(`/api/events/${eventId}`, {}, false);
  },

  /**
   * Update event
   */
  update: async (eventId: string, data: EventUpdate): Promise<EventResponse> => {
    return apiFetch<EventResponse>(`/api/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Stop recurring event series
   */
  stopRecurrence: async (eventId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/api/events/${eventId}/stop-recurrence`, {
      method: 'POST',
    });
  },

  /**
   * Delete event
   */
  delete: async (eventId: string): Promise<void> => {
    return apiFetch<void>(`/api/events/${eventId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get top events ranked by popularity score
   * Score = (views * 1) + (attending * 5) + (ticket_clicks * 10)
   */
  getTop: async (limit: number = 10): Promise<EventListResponse> => {
    return apiFetch<EventListResponse>(`/api/events/top?limit=${limit}`, {}, false);
  },
};

// ============================================================
// VENUES API
// ============================================================

export const venuesAPI = {
  /**
   * List all venue categories
   */
  listCategories: async (): Promise<VenueCategory[]> => {
    return apiFetch<VenueCategory[]>('/api/venues/categories', {}, false);
  },

  /**
   * Create new venue category
   */
  createCategory: async (data: VenueCategoryCreate): Promise<VenueCategory> => {
    return apiFetch<VenueCategory>('/api/venues/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update venue category
   */
  updateCategory: async (categoryId: string, data: VenueCategoryUpdate): Promise<VenueCategory> => {
    return apiFetch<VenueCategory>(`/api/venues/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete venue category
   */
  deleteCategory: async (categoryId: string): Promise<void> => {
    return apiFetch<void>(`/api/venues/categories/${categoryId}`, {
      method: 'DELETE',
    });
  },

  /**
   * List venues with optional filters
   */
  list: async (filters?: VenueFilter): Promise<VenueListResponse> => {
    const queryString = filters ? buildQueryString(filters) : '';
    return apiFetch<VenueListResponse>(`/api/venues${queryString}`, {}, false);
  },

  /**
   * Search venues for typeahead
   */
  search: async (q: string, limit = 10): Promise<VenueListResponse> => {
    return apiFetch<VenueListResponse>(
      `/api/venues/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      {},
      false
    );
  },

  /**
   * Get single venue by ID
   */
  get: async (venueId: string): Promise<VenueResponse> => {
    return apiFetch<VenueResponse>(`/api/venues/${venueId}`, {}, false);
  },

  /**
   * Get events for a venue
   */
  getEvents: async (
    venueId: string,
    status?: 'upcoming' | 'past' | 'all',
    skip = 0,
    limit = 20
  ): Promise<EventListResponse> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('skip', String(skip));
    params.append('limit', String(limit));
    return apiFetch<EventListResponse>(
      `/api/venues/${venueId}/events?${params}`,
      {},
      false
    );
  },

  /**
   * Create new venue
   */
  create: async (data: VenueCreate): Promise<VenueResponse> => {
    return apiFetch<VenueResponse>('/api/venues', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update existing venue
   */
  update: async (venueId: string, data: VenueUpdate): Promise<VenueResponse> => {
    return apiFetch<VenueResponse>(`/api/venues/${venueId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete venue
   */
  delete: async (venueId: string): Promise<void> => {
    return apiFetch<void>(`/api/venues/${venueId}`, {
      method: 'DELETE',
    });
  },

  /**
   * List staff for a venue
   */
  listStaff: async (venueId: string): Promise<VenueStaffResponse[]> => {
    return apiFetch<VenueStaffResponse[]>(`/api/venues/${venueId}/staff`);
  },

  /**
   * Add staff to a venue
   */
  addStaff: async (venueId: string, data: VenueStaffCreate): Promise<VenueStaffResponse> => {
    return apiFetch<VenueStaffResponse>(`/api/venues/${venueId}/staff`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Remove staff from a venue
   */
  removeStaff: async (venueId: string, userId: string): Promise<void> => {
    return apiFetch<void>(`/api/venues/${venueId}/staff/${userId}`, {
      method: 'DELETE',
    });
  },
};



// ============================================================
// PROMOTIONS API
// ============================================================

export const promotionsAPI = {
  /**
   * Get active promotions with unlock status
   */
  listActive: async (
    venueId?: string,
    latitude?: number,
    longitude?: number
  ): Promise<PromotionListResponse> => {
    const params: Record<string, any> = {};
    if (venueId) params.venue_id = venueId;
    if (latitude !== undefined) params.latitude = latitude;
    if (longitude !== undefined) params.longitude = longitude;

    const queryString = buildQueryString(params);
    return apiFetch<PromotionListResponse>(`/api/promotions/promotions/active${queryString}`);
  },

  /**
   * Get single promotion by ID
   */
  get: async (promotionId: string): Promise<PromotionResponse> => {
    return apiFetch<PromotionResponse>(`/api/promotions/promotions/${promotionId}`);
  },

  /**
   * Create promotion for venue
   */
  create: async (venueId: string, data: PromotionCreate): Promise<PromotionResponse> => {
    return apiFetch<PromotionResponse>(`/api/promotions/venues/${venueId}/promotions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update promotion
   */
  update: async (promotionId: string, data: PromotionUpdate): Promise<PromotionResponse> => {
    return apiFetch<PromotionResponse>(`/api/promotions/promotions/${promotionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete promotion
   */
  delete: async (promotionId: string): Promise<void> => {
    return apiFetch<void>(`/api/promotions/promotions/${promotionId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================
// CATEGORIES API
// ============================================================

export const categoriesAPI = {
  /**
   * List all categories
   */
  list: async (activeOnly = true): Promise<CategoryListResponse> => {
    return apiFetch<CategoryListResponse>(`/api/categories?active_only=${activeOnly}`, {}, false);
  },

  /**
   * Get single category by ID or slug
   */
  get: async (idOrSlug: string): Promise<Category> => {
    return apiFetch<Category>(`/api/categories/${idOrSlug}`, {}, false);
  },

  /**
   * Create new category (admin only)
   */
  create: async (data: Partial<Category>): Promise<Category> => {
    return apiFetch<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update existing category (admin only)
   */
  update: async (id: string, data: Partial<Category>): Promise<Category> => {
    return apiFetch<Category>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete category (admin only)
   */
  delete: async (id: string): Promise<void> => {
    return apiFetch<void>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Follow a category
   */
  follow: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/api/categories/${id}/follow`, {
      method: 'POST',
    });
  },

  /**
   * Unfollow a category
   */
  unfollow: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/api/categories/${id}/follow`, {
      method: 'DELETE',
    });
  },

  /**
   * Check if following a category
   */
  checkFollowing: async (id: string): Promise<{ following: boolean }> => {
    return apiFetch<{ following: boolean }>(`/api/categories/${id}/following`);
  },

  /**
   * Get all followed categories
   */
  getFollowed: async (): Promise<CategoryListResponse> => {
    return apiFetch<CategoryListResponse>('/api/categories/user/following');
  },
};

// ============================================================
// TAGS API
// ============================================================

export const tagsAPI = {
  /**
   * List tags with optional search filter
   */
  list: async (search?: string, limit = 20): Promise<TagListResponse> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('limit', String(limit));
    return apiFetch<TagListResponse>(`/api/tags?${params}`, {}, false);
  },

  /**
   * Get most popular tags
   */
  popular: async (limit = 20): Promise<TagListResponse> => {
    return apiFetch<TagListResponse>(`/api/tags/popular?limit=${limit}`, {}, false);
  },

  /**
   * Delete a tag (admin only)
   */
  delete: async (tagId: string): Promise<void> => {
    return apiFetch<void>(`/api/tags/${tagId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Merge tags (admin only)
   */
  merge: async (data: TagMergeRequest): Promise<Tag> => {
    return apiFetch<Tag>('/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============================================================
// MEDIA API
// ============================================================

export const mediaAPI = {
  /**
   * Upload an image file
   */
  upload: async (
    file: File,
    folder: 'events' | 'venues' | 'categories' | 'organizers'
  ): Promise<{
    url: string;
    thumbnail_url: string;
    medium_url: string;
    large_url: string;
  }> => {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${API_BASE_URL}/api/media/upload?folder=${folder}`;
    const token = getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  },

  /**
   * Delete an uploaded image
   */
  delete: async (folder: string, filename: string): Promise<void> => {
    return apiFetch<void>(`/api/media/${folder}/${filename}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================
// GEOCODING API
// ============================================================

export const geocodeAPI = {
  /**
   * Search for addresses using Mapbox geocoding
   */
  search: async (
    query: string
  ): Promise<
    Array<{
      place_name: string;
      latitude: number;
      longitude: number;
      relevance: number;
    }>
  > => {
    const response = await apiFetch<{
      suggestions: Array<{
        place_name: string;
        latitude: number;
        longitude: number;
        relevance: number;
      }>;
    }>(`/api/geocode/search?query=${encodeURIComponent(query)}`, {}, false);
    return response.suggestions;
  },

  /**
   * Validate coordinates are within the Highland region
   */
  validate: async (lat: number, lng: number): Promise<{ valid: boolean; message: string }> => {
    return apiFetch<{ valid: boolean; message: string }>(
      `/api/geocode/validate?lat=${lat}&lng=${lng}`,
      {},
      false
    );
  },

  /**
   * Look up UK postcode
   */
  lookupPostcode: async (postcode: string): Promise<PostcodeLookupResult> => {
    return apiFetch<PostcodeLookupResult>(
      `/api/geocode/postcode/${encodeURIComponent(postcode)}`,
      {},
      false
    );
  },


  /**
   * Autocomplete address search
   */
  autocomplete: async (query: string): Promise<AddressSuggestion[]> => {
    return apiFetch<AddressSuggestion[]>(
      `/api/geocode/autocomplete?q=${encodeURIComponent(query)}`,
      {},
      false
    );
  },

  /**
   * Get address details by ID
  getAddress: async (id: string): Promise<PostcodeLookupResult> => {
    return apiFetch<PostcodeLookupResult>(
      `/api/geocode/address/${encodeURIComponent(id)}`,
      {},
      false
    );
  },
};

// ============================================================
// BOOKMARKS API
// ============================================================

export const bookmarksAPI = {
  /**
   * Toggle bookmark for an event
   */
  toggle: async (eventId: string): Promise<{ bookmarked: boolean; message: string }> => {
    return apiFetch<{ bookmarked: boolean; message: string }>(
      `/api/bookmarks/${eventId}`,
      {
        method: 'POST',
      }
    );
  },

  /**
   * Check if event is bookmarked
   */
  check: async (eventId: string): Promise<{ bookmarked: boolean }> => {
    return apiFetch<{ bookmarked: boolean }>(`/api/bookmarks/check/${eventId}`);
  },

  /**
   * List user's bookmarks
   */
  list: async (skip = 0, limit = 50): Promise<EventListResponse> => {
    return apiFetch<EventListResponse>(
      `/api/bookmarks/my?skip=${skip}&limit=${limit}`
    );
  },

  /**
   * Get bookmark count for an event (public, for social proof)
   */
  getCount: async (eventId: string): Promise<{ count: number }> => {
    return apiFetch<{ count: number }>(`/api/bookmarks/count/${eventId}`, {}, false);
  },
};

// ============================================================
// ANALYTICS API
// ============================================================

export const analyticsAPI = {
  /**
   * Track a user action
   */
  track: async (eventType: string, targetId?: string, metadata?: any): Promise<void> => {
    try {
      await apiFetch('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({
          event_type: eventType,
          target_id: targetId,
          metadata,
        }),
      });
    } catch (error) {
      // Fail silently for analytics to not disrupt user experience
      console.error('Analytics tracking failed:', error);
    }
  },

  /**
   * Get Admin Analytics Summary
   */
  getAdminSummary: async (days = 30): Promise<any> => {
    return apiFetch(`/api/analytics/summary?days=${days}`);
  },

  /**
   * Get Venue Analytics
   */
  getVenueStats: async (venueId: string, days: number = 30): Promise<VenueAnalyticsSummary> => {
    return apiFetch<VenueAnalyticsSummary>(`/api/analytics/venue/${venueId}?days=${days}`);
  },

  /**
   * Get Organizer Stats (for event owners)
   */
  getOrganizerStats: async (days: number = 30): Promise<any> => {
    return apiFetch<any>(`/api/analytics/organizer?days=${days}`);
  },

  /**
   * Get Missed Opportunities (failed searches grouped by type)
   */
  getMissedOpportunities: async (days: number = 30): Promise<MissedOpportunitiesResponse> => {
    return apiFetch<MissedOpportunitiesResponse>(`/api/analytics/missed-opportunities?days=${days}`);
  },
};

export const moderationAPI = {
  createReport: async (data: ReportCreate) => {
    return apiFetch<Report>('/api/moderation/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getQueue: async () => {
    return apiFetch<Report[]>('/api/moderation/queue');
  },

  getPendingEvents: async () => {
    return apiFetch<EventResponse[]>('/api/moderation/events/pending');
  },

  resolveReport: async (reportId: number, action: 'resolve' | 'dismiss') => {
    return apiFetch(`/api/moderation/reports/${reportId}/resolve?action=${action}`, {
      method: 'POST',
    });
  },

  moderateEvent: async (eventId: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    return apiFetch(`/api/moderation/events/${eventId}/moderate`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        rejection_reason: rejectionReason,
      }),
    });
  },
};

export const recommendationsAPI = {
  getRecommendations: async (limit: number = 5): Promise<EventResponse[]> => {
    return apiFetch<EventResponse[]>(`/api/recommendations?limit=${limit}`);
  },

  getSimilarEvents: async (eventId: string, limit: number = 3): Promise<EventResponse[]> => {
    return apiFetch<EventResponse[]>(`/api/recommendations/events/${eventId}/similar?limit=${limit}`);
  },
};

// ============================================================
// USERS API (Phase 2.10)
// ============================================================

export const usersAPI = {
  /**
   * Get current user's dashboard stats
   */
  getMyStats: async (): Promise<UserDashboardStats> => {
    return apiFetch<UserDashboardStats>('/api/users/me/stats');
  },

  /**
   * Get a user's stats (admin or self only)
   */
  getStats: async (userId: string): Promise<UserDashboardStats> => {
    return apiFetch<UserDashboardStats>(`/api/users/${userId}/stats`);
  },

  /**
   * Update current user profile
   */
  updateProfile: async (data: { username?: string; display_name?: string; email?: string; password?: string }): Promise<UserProfile> => {
    return apiFetch<UserProfile>('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ============================================================
// PREFERENCES API
// ============================================================

const preferencesAPI = {
  async get(): Promise<UserPreferences> {
    const response = await fetch(`${API_BASE_URL}/api/users/me/preferences`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch preferences');
    return response.json();
  },

  async update(updates: UserPreferencesUpdate): Promise<UserPreferences> {
    const response = await fetch(`${API_BASE_URL}/api/users/me/preferences`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update preferences');
    return response.json();
  },
};

// ============================================================
// FEATURED API
// ============================================================

const featuredAPI = {
  async getConfig(): Promise<SlotConfig[]> {
    const response = await fetch(`${API_BASE_URL}/api/featured/config`);
    if (!response.ok) throw new Error('Failed to fetch config');
    return response.json();
  },

  async checkAvailability(request: AvailabilityRequest): Promise<AvailabilityResponse> {
    const response = await fetch(`${API_BASE_URL}/api/featured/check-availability`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Failed to check availability');
    return response.json();
  },

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const response = await fetch(`${API_BASE_URL}/api/featured/create-checkout`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create checkout');
    }
    return response.json();
  },

  async getMyBookings(): Promise<FeaturedBooking[]> {
    const response = await fetch(`${API_BASE_URL}/api/featured/my-bookings`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return response.json();
  },

  async getActive(slotType: SlotType, targetId?: string): Promise<ActiveFeatured[]> {
    const params = new URLSearchParams({ slot_type: slotType });
    if (targetId) params.append('target_id', targetId);

    const response = await fetch(`${API_BASE_URL}/api/featured/active?${params}`);
    if (!response.ok) throw new Error('Failed to fetch active featured');
    return response.json();
  },
};

// ============================================================
// ADMIN API (Phase 2.10)
// ============================================================



export interface AdminUser {
  id: string;
  email: string;
  is_admin: boolean;
  is_trusted_organizer: boolean;
  is_active: boolean;
  has_password: boolean;  // true = Email login, false = Google login
  created_at: string;
  event_count: number;
  checkin_count: number;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  skip: number;
  limit: number;
}

export const adminAPI = {
  /**
   * Get admin dashboard stats
   */
  getStats: async (): Promise<AdminDashboardStats> => {
    return apiFetch<AdminDashboardStats>('/api/admin/stats');
  },

  /**
   * List all users with search and pagination
   */
  listUsers: async (params: { q?: string; skip?: number; limit?: number } = {}): Promise<AdminUserListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.skip !== undefined) searchParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());
    const queryString = searchParams.toString();
    return apiFetch<AdminUserListResponse>(`/api/admin/users${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get user details
   */
  getUser: async (userId: string): Promise<AdminUser> => {
    return apiFetch<AdminUser>(`/api/admin/users/${userId}`);
  },

  /**
   * Toggle user admin status
   */
  toggleUserAdmin: async (userId: string): Promise<AdminUser> => {
    return apiFetch<AdminUser>(`/api/admin/users/${userId}/toggle-admin`, {
      method: 'POST',
    });
  },

  /**
   * Update user details
   */
  updateUser: async (userId: string, data: { email?: string; username?: string; display_name?: string; is_admin?: boolean; is_active?: boolean }): Promise<AdminUser> => {
    return apiFetch<AdminUser>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a user
   */
  deleteUser: async (userId: string): Promise<{ ok: boolean; message: string }> => {
    return apiFetch<{ ok: boolean; message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Send password reset email to user (admin-triggered)
   */
  sendPasswordReset: async (userId: string): Promise<{ ok: boolean; message: string }> => {
    return apiFetch<{ ok: boolean; message: string }>(`/api/admin/users/${userId}/send-password-reset`, {
      method: 'POST',
    });
  },

  /**
   * Toggle trusted organizer status for a user
   */
  toggleTrustedOrganizer: async (userId: string, trusted: boolean): Promise<{ user_id: string; is_trusted_organizer: boolean }> => {
    return apiFetch<{ user_id: string; is_trusted_organizer: boolean }>(`/api/admin/users/${userId}/trust?trusted=${trusted}`, {
      method: 'PATCH',
    });
  },
};

// ============================================================
// HERO API
// ============================================================

export const heroAPI = {
  /**
   * List all hero slots
   */
  list: async (activeOnly = false): Promise<HeroSlot[]> => {
    return apiFetch<HeroSlot[]>(`/api/hero?active_only=${activeOnly}`, {}, false);
  },

  /**
   * Create new hero slot
   */
  create: async (data: HeroSlotCreate): Promise<HeroSlot> => {
    return apiFetch<HeroSlot>('/api/hero', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update hero slot
   */
  update: async (id: number, data: HeroSlotUpdate): Promise<HeroSlot> => {
    return apiFetch<HeroSlot>(`/api/hero/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete hero slot
   */
  delete: async (id: number): Promise<void> => {
    return apiFetch<void>(`/api/hero/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================
// VENUE CLAIMS API
// ============================================================
export const venueClaimsAPI = {
  /**
   * Submit a claim for venue ownership
   */
  create: async (venueId: string, reason: string): Promise<VenueClaim> => {
    return apiFetch<VenueClaim>(`/api/venues/${venueId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ venue_id: venueId, reason }),
    });
  },

  /**
   * Get my claims
   */
  getMyClaims: async (): Promise<VenueClaim[]> => {
    return apiFetch<VenueClaim[]>('/api/venues/claims/my');
  },

  /**
   * List venue claims (admin only)
   */
  list: async (status?: string): Promise<VenueClaim[]> => {
    const query = status ? `?status=${status}` : '';
    return apiFetch<VenueClaim[]>(`/api/admin/claims${query}`);
  },

  /**
   * Process a venue claim (admin only)
   */
  process: async (claimId: number, action: 'approve' | 'reject'): Promise<VenueClaim> => {
    return apiFetch<VenueClaim>(`/api/admin/claims/${claimId}/${action}`, {
      method: 'POST',
    });
  },
};

// ============================================================
// COLLECTIONS API
// ============================================================

export const collectionsAPI = {
  /**
   * List active collections
   */
  list: async (): Promise<Collection[]> => {
    return apiFetch<Collection[]>('/api/collections', {}, false);
  },

  /**
   * Create new collection (admin only)
   */
  create: async (data: CollectionCreate): Promise<Collection> => {
    return apiFetch<Collection>('/api/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update collection (admin only)
   */
  update: async (id: number, data: CollectionUpdate): Promise<Collection> => {
    return apiFetch<Collection>(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete collection (admin only)
   */
  delete: async (id: number): Promise<void> => {
    return apiFetch<void>(`/api/collections/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Seed default collections (admin only)
   */
  seed: async (): Promise<Collection[]> => {
    return apiFetch<Collection[]>('/api/collections/seed', {
      method: 'POST',
    });
  },
};

// ============================================================
// SOCIAL API (Phase 2.4 Sprint 2)
// ============================================================

export const socialAPI = {
  follow: async (targetType: 'venue' | 'group', targetId: string) => {
    return apiFetch<any>(`/api/social/follow/${targetType}/${targetId}`, {
      method: 'POST',
    });
  },

  unfollow: async (targetType: 'venue' | 'group', targetId: string) => {
    return apiFetch<void>(`/api/social/follow/${targetType}/${targetId}`, {
      method: 'DELETE',
    });
  },

  isFollowing: async (targetId: string) => {
    return apiFetch<boolean>(`/api/social/following/${targetId}`);
  },

  getFeed: async (skip = 0, limit = 20) => {
    return apiFetch<EventResponse[]>(`/api/social/feed?skip=${skip}&limit=${limit}`);
  },
};

// ============================================================
// GROUPS API (Phase 2.4 Sprint 2)
// ============================================================

// ============================================================
// NOTIFICATIONS API
// ============================================================

export const notificationsAPI = {
  list: async (limit = 20, skip = 0, unreadOnly = false) => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    params.append('skip', String(skip));
    if (unreadOnly) params.append('unread_only', 'true');
    return apiFetch<{
      notifications: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        link: string | null;
        is_read: boolean;
        created_at: string;
      }>;
      total: number;
      unread_count: number;
    }>(`/api/notifications?${params}`);
  },

  markAsRead: async (notificationId: string) => {
    return apiFetch<{ success: boolean }>(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },

  markAllAsRead: async () => {
    return apiFetch<{ success: boolean; marked_count: number }>('/api/notifications/read-all', {
      method: 'POST',
    });
  },
};

export const groupsAPI = {
  // Invite management
  createInvite: async (groupId: string) => {
    return apiFetch<any>(`/api/groups/${groupId}/invite`, {
      method: 'POST',
    });
  },

  listInvites: async (groupId: string): Promise<any[]> => {
    return apiFetch<any[]>(`/api/groups/${groupId}/invites`);
  },

  deleteInvite: async (groupId: string, token: string): Promise<void> => {
    return apiFetch<void>(`/api/groups/${groupId}/invites/${token}`, {
      method: 'DELETE',
    });
  },

  join: async (token: string) => {
    return apiFetch<any>(`/api/groups/join/${token}`, {
      method: 'POST',
    });
  },

  // Member management
  listMembers: async (groupId: string): Promise<any[]> => {
    return apiFetch<any[]>(`/api/groups/${groupId}/members`);
  },

  removeMember: async (groupId: string, userId: string): Promise<void> => {
    return apiFetch<void>(`/api/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  updateMemberRole: async (groupId: string, userId: string, role: string): Promise<any> => {
    return apiFetch<any>(`/api/groups/${groupId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  // Membership check (for permission UI)
  checkMembership: async (groupId: string): Promise<{ is_member: boolean; role: string | null }> => {
    return apiFetch<{ is_member: boolean; role: string | null }>(`/api/groups/${groupId}/membership`);
  },
};

// ============================================================
// EXPORTS
// ============================================================



export const api = {
  auth: authAPI,
  events: eventsAPI,
  venues: venuesAPI,
  promotions: promotionsAPI,
  categories: categoriesAPI,
  tags: tagsAPI,
  media: mediaAPI,
  geocode: geocodeAPI,
  users: usersAPI,
  admin: adminAPI,
  hero: heroAPI,
  venueClaims: venueClaimsAPI,
  analytics: analyticsAPI,
  moderation: moderationAPI,
  recommendations: recommendationsAPI,
  collections: collectionsAPI,
  social: socialAPI,
  groups: groupsAPI,
  notifications: notificationsAPI,
  preferences: preferencesAPI,
  featured: featuredAPI,
  bookmarks: {
    toggle: async (eventId: string): Promise<{ bookmarked: boolean; message: string }> => {
      return apiFetch<{ bookmarked: boolean; message: string }>(
        `/api/bookmarks/${eventId}`,
        { method: 'POST' }
      );
    },
    check: async (eventId: string): Promise<{ bookmarked: boolean }> => {
      return apiFetch<{ bookmarked: boolean }>(`/api/bookmarks/check/${eventId}`);
    },
    list: async (skip = 0, limit = 50): Promise<EventListResponse> => {
      return apiFetch<EventListResponse>(`/api/bookmarks/my?skip=${skip}&limit=${limit}`);
    },
    getCount: async (eventId: string): Promise<{ count: number }> => {
      return apiFetch<{ count: number }>(`/api/bookmarks/count/${eventId}`, {}, false);
    },
  },
  organizers: {
    list: async (userId?: string) => {
      const query = userId ? `?user_id=${userId}` : '';
      return apiFetch<{ organizers: any[], total: number }>(`/api/organizers${query}`);
    },
    create: async (data: any) => {
      return apiFetch<any>('/api/organizers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    get: async (id: string) => {
      return apiFetch<any>(`/api/organizers/${id}`);
    },
    getBySlug: async (slug: string) => {
      return apiFetch<any>(`/api/organizers/slug/${slug}`);
    },
    update: async (id: string, data: any) => {
      return apiFetch<any>(`/api/organizers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return apiFetch<void>(`/api/organizers/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Generic methods
  post: async <T>(endpoint: string, data: any): Promise<T> => {
    return apiFetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export default api;
// ============================================================
// SEARCH API
// ============================================================

export const searchAPI = {
  /**
   * Get search suggestions
   */
  suggest: async (q: string, type: 'topic' | 'location' | 'all' = 'all'): Promise<{ suggestions: Array<{ term: string; type: string }> }> => {
    return apiFetch<{ suggestions: Array<{ term: string; type: string }> }>(
      `/api/search/suggest?q=${encodeURIComponent(q)}&type=${type}`,
      {},
      false
    );
  },

  /**
   * Get trending event IDs
   */
  trending: async (days = 7): Promise<string[]> => {
    return apiFetch<string[]>(`/api/analytics/trending?days=${days}`, {}, false);
  },
};

// ============================================================
// USER SETTINGS API
// ============================================================

export const userSettingsAPI = {
  /**
   * Get notification settings
   */
  getNotificationSettings: async (): Promise<{ receive_interest_notifications: boolean }> => {
    return apiFetch<{ receive_interest_notifications: boolean }>('/api/users/me/notification-settings');
  },

  /**
   * Update notification settings
   */
  updateNotificationSettings: async (settings: { receive_interest_notifications: boolean }): Promise<{ receive_interest_notifications: boolean }> => {
    return apiFetch<{ receive_interest_notifications: boolean }>('/api/users/me/notification-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

// ============================================================
// FOLLOWS API
// ============================================================

export const followsAPI = {
  /**
   * Get followed categories for current user
   */
  getFollowedCategories: async (): Promise<{ categories: any[]; total: number }> => {
    return apiFetch<{ categories: any[]; total: number }>('/api/categories/user/following');
  },

  /**
   * Get followed venues (need to query social/following endpoint)
   */
  getFollowedVenues: async (): Promise<{ venues: VenueResponse[]; total: number }> => {
    return apiFetch<{ venues: VenueResponse[]; total: number }>('/api/social/following/venues');
  },

  /**
   * Get followed groups/organizers
   */
  getFollowedGroups: async (): Promise<{ groups: any[]; total: number }> => {
    return apiFetch<{ groups: any[]; total: number }>('/api/social/following/groups');
  },

  /**
   * Follow a venue
   */
  followVenue: async (venueId: string): Promise<any> => {
    return apiFetch<any>(`/api/social/follow/venue/${venueId}`, { method: 'POST' });
  },

  /**
   * Unfollow a venue
   */
  unfollowVenue: async (venueId: string): Promise<any> => {
    return apiFetch<any>(`/api/social/follow/venue/${venueId}`, { method: 'DELETE' });
  },

  /**
   * Follow a group/organizer
   */
  followGroup: async (groupId: string): Promise<any> => {
    return apiFetch<any>(`/api/social/follow/group/${groupId}`, { method: 'POST' });
  },

  /**
   * Unfollow a group/organizer
   */
  unfollowGroup: async (groupId: string): Promise<any> => {
    return apiFetch<any>(`/api/social/follow/group/${groupId}`, { method: 'DELETE' });
  },

  /**
   * Follow a category
   */
  followCategory: async (categoryId: string): Promise<any> => {
    return apiFetch<any>(`/api/categories/${categoryId}/follow`, { method: 'POST' });
  },

  /**
   * Unfollow a category
   */
  unfollowCategory: async (categoryId: string): Promise<any> => {
    return apiFetch<any>(`/api/categories/${categoryId}/follow`, { method: 'DELETE' });
  },
};

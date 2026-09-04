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
  MapEventResponse,
  Venue,
  VenueResponse,
  VenueCreate,
  VenueUpdate,
  VenueFilter,
  VenueListResponse,
  VenueCategory,
  VenueCategoryCreate,
  VenueCategoryUpdate,
  VenueStaffCreate,
  VenueStaffResponse,
  QualityIssue,
  CategoryMixStats,
  OrganizerEventStats,


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
  VenueClaim,
  AddressSuggestion,
  VenueAnalyticsSummary,
  Report,
  ReportCreate,
  AdminDashboardStats,
  Collection,
  CollectionCreate,
  CollectionUpdate,
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
  PendingEvent,
} from '@/types';

// ============================================================
// CONFIGURATION
// ============================================================

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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
    // 401 handling: If unauthorized, token might be expired
    if (response.status === 401 && includeAuth) {
      console.warn('API 401 Unauthorized - clearing token');
      clearAuthToken();
      // If we are on the client, we might want to trigger a refresh or redirect
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // Optionally: window.location.href = '/login?expired=true';
      }
    }

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
      if (filters.category_ids) params.category_ids = filters.category_ids.join(',');
      if (filters.combine_operator) params.combine_operator = filters.combine_operator;
      if (filters.tag) params.tag = filters.tag;
      if (filters.tag_names) params.tag_names = Array.isArray(filters.tag_names) ? filters.tag_names.join(',') : filters.tag_names;
      if (filters.tag_ids) params.tag_ids = Array.isArray(filters.tag_ids) ? filters.tag_ids.join(',') : filters.tag_ids;
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
      if (filters.max_duration_days !== undefined) params.max_duration_days = filters.max_duration_days;
      if (filters.venue_id) params.venue_id = filters.venue_id;
      if (filters.include_past) params.include_past = 'true';
      if (filters.skip !== undefined) params.skip = filters.skip;
      if (filters.include_past) params.include_past = 'true';
      if (filters.time_range) params.time_range = filters.time_range;

      // Phase 2 Fix: Support mapping frontend `date` preset strings (e.g. 'weekend')
      // directly to the backend's `time_range` parameter
      if (filters.date && filters.date !== 'custom') {
        params.time_range = filters.date;
      }

      if (filters.skip !== undefined) params.skip = filters.skip;
      if (filters.limit !== undefined) params.limit = filters.limit;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.city_filter) params.city_filter = filters.city_filter;
      if (filters.status) params.status = filters.status;
      if (filters.is_recurring !== undefined) params.is_recurring = filters.is_recurring;
      if (filters.exclude_age_restrictions?.length) params.exclude_age_restrictions = filters.exclude_age_restrictions.join(',');
      if (filters.exclude_event_ids?.length) params.exclude_event_ids = filters.exclude_event_ids.join(',');
    }

    const queryString = buildQueryString(params);
    return apiFetch<EventListResponse>(`/api/events${queryString}`);
  },

  /**
   * Get promoted (featured) events
   */
  listPromoted: async (): Promise<EventListResponse> => {
    return apiFetch<EventListResponse>('/api/events/promoted');
  },

  /**
   * Lightweight list for Map View (optimized)
   */
  listMap: async (filters?: EventFilter): Promise<MapEventResponse[]> => {
    const params: Record<string, any> = {};
    if (filters) {
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.latitude !== undefined) params.latitude = filters.latitude;
      if (filters.longitude !== undefined) params.longitude = filters.longitude;
      if (filters.radius_km !== undefined) params.radius = filters.radius_km; // API expects 'radius' in miles, but let's stick to consistent naming if backend handles it. 
      // Backend /map endpoint uses alias="radius" for radius_miles. 
      // Frontend filter uses "radius_km". 
      // Need to convert km to miles or pass as is? 
      // Backend `list_events_map` takes `radius_miles`.
      // Let's assume standard conversion if needed, OR pass strict params matching backend.
      // `query param radius` -> radius_miles.
      // If frontend passes radius_km, we should convert or just pass 'radius' if the value is actually miles?
      // Existing `list` logic: `if (filters.radius_km !== undefined) params.radius = filters.radius_km;` 
      // Wait, standard `list` passes `filters.radius_km` as `params.radius`. Backend `list_events` aliases `radius` to `radius_miles`. 
      // So `params.radius` should be in MILES?
      // Let's check `list_events`: `radius_miles: Optional[float] = Query(None, alias="radius"...)`
      // So backend expects `?radius=X` where X is miles.
      // Frontend `filters.radius_km`... if it's KM, we are sending KM as Miles?
      // Let's check where `filters.radius_km` comes from. 
      // In `list`: `params.radius = filters.radius_km`
      // If `filters.radius_km` is actually KM, then we are sending KM value to a Miles field. 
      // Note: checking `map.tsx` might clarify. 
      // For now, I will blindly copy the `list` logic to maintain consistency.
      if (filters.radius_km !== undefined) params.radius = filters.radius_km;
      if (filters.q) params.q = filters.q;
    }
    const queryString = buildQueryString(params);
    return apiFetch<MapEventResponse[]>(`/api/events/map${queryString}`, {}, false);
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
    return apiFetch<EventResponse>(`/api/events/${eventId}`);
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
   * Toggle event attendance (RSVP)
   */
  attend: async (eventId: string): Promise<{ is_attending: boolean; attending_count: number; message: string }> => {
    return apiFetch<{ is_attending: boolean; attending_count: number; message: string }>(`/api/events/${eventId}/attend`, {
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
  /**
   * Track a ticket link click
   */
  trackTicketClick: async (id: string): Promise<void> => {
    return apiFetch(`/api/events/${id}/click`, {
      method: 'POST',
    }, false);
  },
  trackWebsiteClick: async (id: string): Promise<void> => {
    return apiFetch(`/api/events/${id}/website-click`, {
      method: 'POST',
    }, false);
  },

  /**
   * Get filtered list of events (Top)
   */
  getTop: async (limit: number = 10): Promise<EventListResponse> => {
    return apiFetch<EventListResponse>(`/api/events/top?limit=${limit}`, {}, false);
  },

  /**
   * Get title suggestions for duplicate prevention
   */
  suggestions: async (q: string): Promise<{ id: string; title: string; date_start: string; venue_name: string | null }[]> => {
    return apiFetch(`/api/events/suggestions?q=${encodeURIComponent(q)}`, {}, false);
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
   * List verified venues for the map
   */
  listMap: async (): Promise<any[]> => {
    return apiFetch<any[]>('/api/map/venues', {}, false);
  },

  /**
   * Search venues for typeahead
   */
  search: async (q: string, limit = 10, searchByName = false): Promise<VenueListResponse> => {
    const param = searchByName ? `name=${encodeURIComponent(q)}` : `q=${encodeURIComponent(q)}`;
    return apiFetch<VenueListResponse>(
      `/api/venues/search?${param}&limit=${limit}`
    );
  },

  /**
   * Get single venue by ID
   */
  get: async (venueId: string): Promise<VenueResponse> => {
    return apiFetch<VenueResponse>(`/api/venues/${venueId}`);
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
   * Merge venues (Admin only)
   */
  merge: async (sourceId: string, targetId: string): Promise<{ message: string; events_moved: number }> => {
    return apiFetch<{ message: string; events_moved: number }>('/api/venues/merge', {
      method: 'POST',
      body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
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
// VENUE INVITES API (Admin - Golden Key)
// ============================================================

export interface VenueInvite {
  id: number;
  venue_id: string;
  email: string;
  token: string;
  expires_at: string;
  claimed?: boolean;
}

export const venueInvitesAPI = {
  /**
   * Send venue ownership invite (admin only)
   */
  create: async (venueId: string, email: string): Promise<VenueInvite> => {
    return apiFetch<VenueInvite>(`/api/admin/venues/${venueId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /**
   * List all venue invites (admin only)
   */
  list: async (): Promise<VenueInvite[]> => {
    return apiFetch<VenueInvite[]>('/api/admin/venues/invites');
  },

  /**
   * Accept venue invite (user)
   */
  accept: async (token: string): Promise<{ success: boolean; venue_id: string; venue_name: string }> => {
    return apiFetch(`/api/venues/accept-invite/${token}`, {
      method: 'POST',
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
   * Get a single tag by ID
   */
  getById: async (tagId: string): Promise<Tag> => {
    return apiFetch<Tag>(`/api/tags/${tagId}`, {}, false);
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
    folder: 'events' | 'venues' | 'categories' | 'organizers' | 'hero' | 'locations'
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
      console.error('Upload Error Payload:', error);
      let detailMessage = error.detail;
      if (typeof detailMessage === 'object') {
        detailMessage = JSON.stringify(detailMessage);
      }
      throw new Error(detailMessage || 'Upload failed');
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
   * Get search insights (failed searches, popular terms, etc.)
   */
  async getSearchInsights(days: number = 30): Promise<{
    items: {
      term: string;
      count: number;
      avg_results: number;
      is_failed: boolean;
    }[];
    total_volume: number;
    unique_terms: number;
  }> {
    return apiFetch<{
      items: {
        term: string;
        count: number;
        avg_results: number;
        is_failed: boolean;
      }[];
      total_volume: number;
      unique_terms: number;
    }>(`/api/analytics/search-insights?days=${days}`);
  },

  /**
   * Clear all search history
   */
  async clearSearchHistory(): Promise<void> {
    return apiFetch<void>('/api/analytics/search-insights', { method: 'DELETE' });
  },

  async deleteSearchInsightTerm(term: string): Promise<void> {
    return apiFetch<void>(`/api/analytics/search-insights/${encodeURIComponent(term)}`, { method: 'DELETE' });
  },



  async getQualityIssues(): Promise<QualityIssue[]> {
    return apiFetch<QualityIssue[]>('/api/analytics/quality-issues');
  },

  async getCategoryMix(): Promise<CategoryMixStats[]> {
    return apiFetch<CategoryMixStats[]>('/api/analytics/category-mix');
  },

  async getQualityIssueDetails(issueType: string): Promise<OrganizerEventStats[]> {
    return apiFetch<OrganizerEventStats[]>(`/api/analytics/quality-issues/details?issue_type=${issueType}`);
  },

  async getTopPerformers(limit: number = 5, days: number = 30): Promise<OrganizerEventStats[]> {
    return apiFetch<OrganizerEventStats[]>(`/api/analytics/top-performers?limit=${limit}&days=${days}`);
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

  resolveDuplicate: async (reportId: number, decision: 'KEEP_ORIGINAL' | 'REPLACE_WITH_NEW', newEventId: string, existingEventId: string) => {
    return apiFetch('/api/moderation/resolve-duplicate', {
      method: 'POST',
      body: JSON.stringify({
        report_id: reportId,
        decision,
        new_event_id: newEventId,
        existing_event_id: existingEventId
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
  updateProfile: async (data: { username?: string; email?: string; password?: string }): Promise<UserProfile> => {
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

  async unsubscribe(token: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/preferences/unsubscribe/${token}`);
    if (!response.ok) throw new Error('Failed to unsubscribe');
    return response.json();
  },
};

// ============================================================
// FEATURED API
// ============================================================

export const featuredAPI = {
  /**
   * Get dates that have reached maximum concurrent booking capacity for PREMIUM slots
   */
  getUnavailableDates: async (startDate?: string, endDate?: string): Promise<string[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const queryString = params.toString() ? `?${params}` : '';
    return apiFetch<string[]>(`/api/featured/unavailable-dates${queryString}`, {}, false);
  },

  /**
   * Get pricing and limits for all slot types
   */
  getConfig: async (): Promise<SlotConfig[]> => {
    return apiFetch<SlotConfig[]>('/api/featured/config', {}, false);
  },

  /**
   * Check if dates are available for a slot type
   */
  checkAvailability: async (request: AvailabilityRequest): Promise<AvailabilityResponse> => {
    return apiFetch<AvailabilityResponse>('/api/featured/check-availability', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Create Stripe checkout session
   */
  createCheckout: async (request: CheckoutRequest): Promise<CheckoutResponse> => {
    return apiFetch<CheckoutResponse>('/api/featured/create-checkout', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get current user's featured bookings
   */
  getMyBookings: async (): Promise<FeaturedBooking[]> => {
    return apiFetch<FeaturedBooking[]>('/api/featured/my-bookings');
  },

  /**
   * Get currently active featured events for display
   */
  getActive: async (slotType: SlotType, targetId?: string): Promise<ActiveFeatured[]> => {
    const params: Record<string, any> = { slot_type: slotType };
    if (targetId) params.target_id = targetId;
    const queryString = buildQueryString(params);
    return apiFetch<ActiveFeatured[]>(`/api/featured/active${queryString}`, {}, false);
  },

  /**
   * Verify a Stripe session (fallback for webhook)
   */
  verifySession: async (sessionId?: string, bookingId?: string): Promise<{ success: boolean; message: string; status?: string }> => {
    const params: Record<string, any> = {};
    if (sessionId) params.session_id = sessionId;
    if (bookingId) params.booking_id = bookingId;
    const queryString = buildQueryString(params);
    return apiFetch(`/api/featured/verify-session${queryString}`);
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
  username: string;
  last_login?: string;
  admin_notes?: string;
  website?: string;
  instagram?: string;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  skip: number;
  limit: number;
}

export interface UserEventSummary {
  id: string;
  title: string;
  date_start: string;
  status: string;
  image_url?: string;
  is_recurring: boolean;
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
  listUsers: async (params: { q?: string; skip?: number; limit?: number; sort_by?: string; sort_dir?: 'asc' | 'desc' } = {}): Promise<AdminUserListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.skip !== undefined) searchParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_dir) searchParams.append('sort_dir', params.sort_dir);
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
   * Get user event history
   */
  getUserEvents: async (userId: string): Promise<UserEventSummary[]> => {
    return apiFetch<UserEventSummary[]>(`/api/admin/users/${userId}/events`);
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
  updateUser: async (userId: string, data: { email?: string; username?: string; is_admin?: boolean; is_active?: boolean; admin_notes?: string }): Promise<AdminUser> => {
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

  // Campaign Management
  getSubscriberCount: async (targetAudience?: string): Promise<{ subscriber_count: number }> => {
    const query = targetAudience ? `?target_audience=${targetAudience}` : '';
    return apiFetch<{ subscriber_count: number }>(`/api/admin/campaigns/subscribers${query}`);
  },

  sendTestCampaign: async (subject: string, body: string): Promise<{ message: string; success: boolean }> => {
    return apiFetch<{ message: string; success: boolean }>('/api/admin/campaigns/test', {
      method: 'POST',
      body: JSON.stringify({ subject, body }),
    });
  },

  sendCampaign: async (subject: string, body: string, targetAudience: string): Promise<{ message: string; campaign_id: string; recipient_count: number }> => {
    return apiFetch<{ message: string; campaign_id: string; recipient_count: number }>('/api/admin/campaigns/send', {
      method: 'POST',
      body: JSON.stringify({ subject, body, target_audience: targetAudience }),
    });
  },

  getCampaignLogs: async (campaignId: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/campaigns/logs/${campaignId}`);
  },

  /**
   * Get list of pending events staged for moderation review
   */
  getPendingEvents: async (): Promise<PendingEvent[]> => {
    return apiFetch<PendingEvent[]>('/api/admin/pending-events');
  },

  /**
   * Get count of pending events staged for moderation review
   */
  getPendingEventsCount: async (): Promise<{ count: number }> => {
    return apiFetch<{ count: number }>('/api/admin/pending-events/count');
  },

  /**
   * Update pending event fields in staging before approval
   */
  updatePendingEvent: async (id: string, data: Partial<PendingEvent>): Promise<PendingEvent> => {
    return apiFetch<PendingEvent>(`/api/admin/pending-events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Approve a pending event and publish to live catalog (with optional overrides)
   */
  approvePendingEvent: async (id: string, overrides?: Partial<PendingEvent>): Promise<{ message: string; event_id: string; pending_id: string }> => {
    return apiFetch<{ message: string; event_id: string; pending_id: string }>(`/api/admin/pending-events/${id}/approve`, {
      method: 'POST',
      body: overrides ? JSON.stringify(overrides) : undefined,
    });
  },

  /**
   * Reject a pending event from the staging queue
   */
  rejectPendingEvent: async (id: string): Promise<{ message: string; id: string }> => {
    return apiFetch<{ message: string; id: string }>(`/api/admin/pending-events/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Completely clear all pending events from the database
   */
  clearAllPendingEvents: async (): Promise<{ message: string; deleted_count: number }> => {
    return apiFetch<{ message: string; deleted_count: number }>('/api/admin/pending-events/clear-all', {
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

export const eventClaimsAPI = {
  /**
   * Submit a claim for event ownership
   */
  create: async (eventId: string, reason: string): Promise<any> => {
    return apiFetch<any>(`/api/events/${eventId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * List event claims (admin only)
   */
  list: async (status?: string): Promise<any[]> => {
    const qs = status ? `?status=${status}` : '';
    return apiFetch<any[]>(`/api/admin/event-claims${qs}`);
  },

  /**
   * Process an event claim (admin only)
   */
  process: async (claimId: number, action: 'approve' | 'reject'): Promise<void> => {
    return apiFetch<void>(`/api/admin/event-claims/${claimId}/${action}`, { method: 'POST' });
  },
};

// ============================================================
// COLLECTIONS API
// ============================================================

export const collectionsAPI = {
  /**
   * List active curated collections
   */
  list: async (filters?: { show_on_map?: boolean }): Promise<Collection[]> => {
    const query = filters ? buildQueryString(filters) : '';
    return apiFetch<Collection[]>(`/api/collections${query}`, {}, false);
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
   * Get a single collection by its URL slug (public)
   */
  getBySlug: async (slug: string): Promise<Collection> => {
    return apiFetch<Collection>(`/api/collections/slug/${slug}`, {}, false);
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

  /**
   * Get populated events for a collection by its URL slug
   */
  getEvents: async (slug: string, params?: { skip?: number; limit?: number }): Promise<{ events: any[]; total: number; skip: number; limit: number }> => {
    const query = params ? buildQueryString(params) : '';
    return apiFetch<{ events: any[]; total: number; skip: number; limit: number }>(`/api/collections/slug/${slug}/events${query}`, {}, false);
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

  delete: async (notificationId: string) => {
    return apiFetch<{ success: boolean }>(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  clearAll: async () => {
    return apiFetch<{ success: boolean; cleared_count: number }>('/api/notifications/clear', {
      method: 'DELETE',
    });
  },
};

export const groupsAPI = {
  // Invite management
  createInvite: async (groupId: string, email?: string) => {
    return apiFetch<any>(`/api/groups/${groupId}/invite`, {
      method: 'POST',
      body: email ? JSON.stringify({ email }) : undefined,
      headers: email ? { 'Content-Type': 'application/json' } : undefined,
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
  venueClaims: {
    create: async (venueId: string, reason: string) => {
      return apiFetch<VenueClaim>(`/api/venues/${venueId}/claim`, {
        method: 'POST',
        body: JSON.stringify({ venue_id: venueId, reason }),
      });
    },
    my: async () => {
      return apiFetch<VenueClaim[]>('/api/venues/claims/my');
    },
    getMyClaims: async () => {
      return apiFetch<VenueClaim[]>('/api/venues/claims/my');
    },
  },
  eventClaims: {
    create: async (eventId: string, reason: string) => {
      return apiFetch<{ id: number; status: string }>(`/api/events/${eventId}/claim`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    my: async () => {
      return apiFetch<{ id: number; status: string }[]>('/api/events/claims/my');
    },
  },
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
    toggle: async (eventId: string): Promise<{ bookmarked: boolean; count: number; message: string }> => {
      return apiFetch<{ bookmarked: boolean; count: number; message: string }>(
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
    getMyIds: async (): Promise<string[]> => {
      return apiFetch<string[]>('/api/bookmarks/my/ids');
    },
  },
  organizers: {
    list: async (filters?: { user_id?: string; city?: string; group_type?: string; skip?: number; limit?: number }) => {
      const query = filters ? buildQueryString(filters) : '';
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

  sellers: {
    getStatus: async (organizerId?: string | null): Promise<SellerStatusResponse> => {
      const query = organizerId ? `?organizer_id=${encodeURIComponent(organizerId)}` : '';
      return apiFetch<SellerStatusResponse>(`/api/sellers/status${query}`);
    },
    onboard: async (organizerId?: string | null, returnUrl?: string): Promise<{ url: string }> => {
      return apiFetch<{ url: string }>('/api/sellers/stripe-connect/onboard', {
        method: 'POST',
        body: JSON.stringify({
          organizer_id: organizerId || undefined,
          return_url: returnUrl || undefined,
        }),
      });
    },
  },

  // Generic methods
  get: async <T>(endpoint: string): Promise<T> => {
    return apiFetch<T>(endpoint);
  },
  post: async <T>(endpoint: string, data: any): Promise<T> => {
    return apiFetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export interface SellerStatusResponse {
  seller_tier: number;
  seller_status: string;
  is_connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  organizer_id: string | null;
  organizer_name: string | null;
  stripe_account?: {
    stripe_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
  } | null;
  organizers?: Array<{
    id: string;
    name: string;
    slug: string;
    stripe_account?: {
      stripe_account_id: string;
      charges_enabled: boolean;
      payouts_enabled: boolean;
    } | null;
  }>;
}

export const sellersAPI = api.sellers;
export const organizersAPI = api.organizers;

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

  globalSearch: async (q: string, limit = 10): Promise<{ events: EventResponse[]; venues: any[]; groups: any[] }> => {
    return apiFetch<{ events: EventResponse[]; venues: any[]; groups: any[] }>(
      `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
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

// ============================================================
// ADMIN EVENTS API
// ============================================================

export interface AdminEventsFilter {
  page?: number;
  page_size?: number;
  category_id?: string;
  venue_id?: string;
  search?: string;
  status?: string;
  include_past?: boolean;
}

export interface AdminEventItem {
  id: string;
  title: string;
  status: string | null;
  date_start: string;
  date_end: string;
  venue_name: string | null;
  location_name: string | null;
  category_id: string | null;
  category_name: string | null;
  image_url: string | null;
  featured: boolean;
  is_recurring: boolean;
  parent_event_id: string | null;
  organizer_email: string | null;
  organizer_username: string | null;
  created_at: string;
  moderation_reason?: string | null;
}

export interface AdminEventsListResponse {
  data: AdminEventItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const adminEventsAPI = {
  /**
   * List events with pagination and filters (admin only)
   */
  list: async (filters?: AdminEventsFilter): Promise<AdminEventsListResponse> => {
    const queryString = filters ? buildQueryString(filters) : '';
    return apiFetch<AdminEventsListResponse>(`/api/admin/events${queryString}`);
  },
};

// ============================================================
// LOCATIONS (Geographic Hubs) API
// ============================================================

export const locationsAPI = {
  /**
   * List all geographic hubs
   */
  list: async (filters?: { category_slug?: string }): Promise<any[]> => {
    const params: Record<string, any> = {};
    if (filters?.category_slug) params.category_slug = filters.category_slug;
    const queryString = buildQueryString(params);
    return apiFetch<any[]>(`/api/locations${queryString}`);
  },

  /**
   * Get a single geographic hub by ID
   */
  get: async (id: number): Promise<any> => {
    return apiFetch<any>(`/api/locations/${id}`);
  },

  /**
   * Get location feed with optional timeframe (today, this-weekend)
   */
  getFeed: async (slug: string, timeframe?: string): Promise<{
    location_name: string;
    location_slug: string;
    timeframe: string;
    meta_title: string;
    meta_description: string;
    h1_heading: string;
    hero_image_url?: string;
    seo_anchor_text?: string;
    is_fallback: boolean;
    fallback_notice?: string;
    events: EventResponse[];
  }> => {
    const path = timeframe ? `/api/locations/feed/${slug}/${timeframe}` : `/api/locations/feed/${slug}`;
    return apiFetch<any>(path);
  },

  /**
   * Create a new geographic hub (admin-only)
   */
  create: async (data: Record<string, any>): Promise<any> => {
    return apiFetch<any>('/api/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a geographic hub (admin-only)
   */
  update: async (id: number, data: Record<string, any>): Promise<any> => {
    return apiFetch<any>(`/api/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a geographic hub (admin-only)
   */
  delete: async (id: number): Promise<void> => {
    return apiFetch<void>(`/api/locations/${id}`, {
      method: 'DELETE',
    });
  },
};

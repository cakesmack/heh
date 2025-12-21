import { useCallback } from 'react';
import { analytics } from '@/lib/analytics';

export const useAnalytics = () => {
    const trackEvent = useCallback((eventType: string, targetId?: string, metadata?: any) => {
        const meta = { ...metadata };
        if (targetId) {
            meta.target_id = targetId;
        }
        analytics.track(eventType, meta);
    }, []);

    const trackEventView = useCallback((eventId: string) => {
        trackEvent('event_view', eventId);
    }, [trackEvent]);

    const trackVenueView = useCallback((venueId: string) => {
        trackEvent('venue_view', venueId);
    }, [trackEvent]);

    const trackCategoryClick = useCallback((categoryId: string) => {
        trackEvent('category_click', categoryId);
    }, [trackEvent]);

    const trackSearch = useCallback((query: string) => {
        trackEvent('search', undefined, { query });
    }, [trackEvent]);

    const trackTicketClick = useCallback((eventId: string) => {
        trackEvent('click_ticket', eventId);
    }, [trackEvent]);

    return {
        trackEvent,
        trackEventView,
        trackVenueView,
        trackCategoryClick,
        trackSearch,
        trackTicketClick,
    };
};

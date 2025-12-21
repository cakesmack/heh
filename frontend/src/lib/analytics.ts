import { v4 as uuidv4 } from 'uuid';
import { apiFetch } from './api';

const SESSION_STORAGE_KEY = 'heh_session_id';

class AnalyticsService {
    private sessionId: string;

    constructor() {
        if (typeof window !== 'undefined') {
            this.sessionId = this.getOrCreateSessionId();
        } else {
            this.sessionId = '';
        }
    }

    private getOrCreateSessionId(): string {
        let sid = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!sid) {
            sid = uuidv4();
            localStorage.setItem(SESSION_STORAGE_KEY, sid);
        }
        return sid;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    public async track(eventType: string, metadata?: Record<string, any>) {
        if (typeof window === 'undefined') return;

        try {
            // Use apiFetch with includeAuth=false to ensure anonymous users can be tracked
            await apiFetch<{ status: string }>('/api/analytics/track', {
                method: 'POST',
                body: JSON.stringify({
                    event_type: eventType,
                    url: window.location.pathname,
                    session_id: this.sessionId,
                    metadata: metadata
                }),
            }, false); // Don't include auth - this allows anonymous tracking
        } catch (error) {
            // Silently fail for analytics to not disrupt user experience
            console.warn('Analytics tracking failed:', error);
        }
    }

    public pageView(url: string) {
        this.track('page_view', { url });
    }
}

export const analytics = new AnalyticsService();


/**
 * AnalyticsProvider - Analytics Gatekeeper
 * Only initializes analytics tracking when consent is granted
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { analytics } from '@/lib/analytics';
import { useConsent } from '@/context/ConsentContext';

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { consentStatus } = useConsent();

    useEffect(() => {
        // Only track if consent is granted
        if (consentStatus !== 'granted') {
            return;
        }

        console.log("Analytics Consent GRANTED - Scripts Initializing...");

        const handleRouteChange = (url: string) => {
            analytics.pageView(url);
        };

        // Track initial load
        analytics.pageView(window.location.pathname);

        // Track route changes
        router.events.on('routeChangeComplete', handleRouteChange);

        return () => {
            router.events.off('routeChangeComplete', handleRouteChange);
        };
    }, [router.events, consentStatus]);

    return <>{children}</>;
}

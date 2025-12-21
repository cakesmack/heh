import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { analytics } from '@/lib/analytics';

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
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
    }, [router.events]);

    return <>{children}</>;
}

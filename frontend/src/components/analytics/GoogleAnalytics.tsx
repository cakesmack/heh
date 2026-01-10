'use client';

import Script from 'next/script';
import { useConsent } from '@/context/ConsentContext';

export default function GoogleAnalytics() {
    const { consentStatus } = useConsent();

    // Strict GDPR Compliance: Only load if explicitly granted
    if (consentStatus !== 'granted') {
        return null;
    }

    const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    if (!GA_MEASUREMENT_ID) {
        console.warn('Google Analytics: NEXT_PUBLIC_GA_MEASUREMENT_ID is missing');
        return null;
    }

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
            </Script>
        </>
    );
}

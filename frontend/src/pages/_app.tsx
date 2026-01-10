/**
 * Custom App Component
 * Wraps all pages with layout and providers
 */

import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Inter } from 'next/font/google';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AuthProvider } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { UsernameBlockerModal } from '@/components/layout/UsernameBlockerModal';
import ScrollToTop from '@/components/common/ScrollToTop';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

import AnalyticsProvider from '@/components/common/AnalyticsProvider';
import { SearchProvider } from '@/context/SearchContext';
import { ConsentProvider } from '@/context/ConsentContext';
import CookieBanner from '@/components/layout/CookieBanner';

import GoogleAnalytics from '@/components/analytics/GoogleAnalytics';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

// Default OG metadata for site-wide fallback
const siteUrl = 'https://www.highlandeventshub.co.uk';
const defaultOgImage = `${siteUrl}/images/og-default.jpg`;

export default function App({ Component, pageProps }: AppProps) {
  const content = (
    <ConsentProvider>
      <GoogleAnalytics />
      <AuthProvider>
        <SearchProvider>
          <AnalyticsProvider>
            {/* Default OG tags (overridden by individual pages) */}
            <Head>
              <meta property="og:type" content="website" />
              <meta property="og:site_name" content="Highland Events Hub" />
              <meta property="og:image" content={defaultOgImage} />
              <meta property="og:image:width" content="1200" />
              <meta property="og:image:height" content="630" />
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:site" content="@HighlandEvents" />
              <meta name="twitter:image" content={defaultOgImage} />
            </Head>

            <div className={`${inter.variable} font-sans flex flex-col min-h-screen`}>
              {/* Header */}
              <Header />

              {/* Main Content */}
              <main className="flex-1">
                <Component {...pageProps} />
              </main>

              {/* Footer - Hidden on mobile */}
              <div className="hidden md:block">
                <Footer />
              </div>

              {/* Bottom Navigation Bar - Mobile only */}
              <div className="md:hidden">
                <BottomNavBar />
              </div>

              <ScrollToTop />
              <UsernameBlockerModal />

              {/* Cookie Consent Banner */}
              <CookieBanner />
            </div>
          </AnalyticsProvider>
        </SearchProvider>
      </AuthProvider>
    </ConsentProvider>
  );

  // Wrap with providers
  let wrappedContent = content;

  // Wrap with Google Maps APIProvider if key is available
  if (GOOGLE_MAPS_KEY) {
    wrappedContent = (
      <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={['places']}>
        {wrappedContent}
      </APIProvider>
    );
  }

  // Wrap with GoogleOAuthProvider if client ID is available
  if (GOOGLE_CLIENT_ID) {
    wrappedContent = (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {wrappedContent}
      </GoogleOAuthProvider>
    );
  }

  return wrappedContent;
}

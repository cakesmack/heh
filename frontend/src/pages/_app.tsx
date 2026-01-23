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
const defaultOgImage = 'https://res.cloudinary.com/dakq1xwn1/image/upload/w_1200,h_630,c_fill,q_auto/v1767454232/highland_events/events/lhxbivhjsqpwn1hsbz5x.jpg';

export default function App({ Component, pageProps }: AppProps) {
  // Extract metadata from pageProps (if provided by the page)
  const meta = pageProps.meta || {};

  // Defaults
  const title = meta.title || "Highland Events Hub";
  const description = meta.description || "Discover the best events, gigs, markets and festivals across the Scottish Highlands.";
  const url = meta.url || siteUrl;
  const type = meta.type || "website";
  const image = meta.image || defaultOgImage;

  const content = (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} key="description" />
        <link rel="canonical" href={url} key="canonical" />

        <meta property="og:type" content={type} key="og-type" />
        <meta property="og:site_name" content="Highland Events Hub" key="og-site-name" />
        <meta property="og:url" content={url} key="og-url" />
        <meta property="og:title" content={title} key="og-title" />
        <meta property="og:description" content={description} key="og-description" />
        <meta property="og:image" content={image} key="og-image" />
        <meta property="og:image:width" content="1200" key="og-image-width" />
        <meta property="og:image:height" content="630" key="og-image-height" />

        <meta name="twitter:card" content="summary_large_image" key="twitter-card" />
        <meta name="twitter:site" content="@HighlandEvents" key="twitter-site" />
        <meta name="twitter:title" content={title} key="twitter-title" />
        <meta name="twitter:description" content={description} key="twitter-description" />
        <meta name="twitter:image" content={image} key="twitter-image" />
      </Head>
      <ConsentProvider>
        <GoogleAnalytics />
        <AuthProvider>
          <SearchProvider>
            <AnalyticsProvider>


              <div className={`${inter.variable} font-sans flex flex-col min-h-screen`}>
                {/* Header */}
                <Header />

                {/* Main Content */}
                <main className="flex-1 pb-24 md:pb-0">
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
    </>
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

/**
 * Custom App Component
 * Wraps all pages with layout and providers
 */

import type { AppProps } from 'next/app';
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

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

export default function App({ Component, pageProps }: AppProps) {
  const content = (
    <ConsentProvider>
      <AuthProvider>
        <SearchProvider>
          <AnalyticsProvider>
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

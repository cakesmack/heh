/**
 * Custom App Component
 * Wraps all pages with layout and providers
 */

import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { GoogleOAuthProvider } from '@react-oauth/google';
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

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function App({ Component, pageProps }: AppProps) {
  const content = (
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
          </div>
        </AnalyticsProvider>
      </SearchProvider>
    </AuthProvider>
  );

  // Only wrap with GoogleOAuthProvider if client ID is available
  if (GOOGLE_CLIENT_ID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {content}
      </GoogleOAuthProvider>
    );
  }

  return content;
}

/**
 * Header Component
 * Top navigation bar with branding and user actions
 */

'use client';

import { useState, useEffect } from 'react';
import OptimizedImage from '@/components/ui/OptimizedImage';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { NotificationCenter } from './NotificationCenter';
import { UserDropdown } from './UserDropdown';
import { apiFetch } from '@/lib/api';

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const isActive = (path: string) => pathname === path;

  // Fetch pending count for admins
  useEffect(() => {
    if (user?.is_admin) {
      apiFetch<{ pending_events: number }>('/api/admin/stats')
        .then((data) => setPendingCount(data.pending_events || 0))
        .catch((err) => console.error('Failed to fetch admin stats:', err));
    }
  }, [user?.is_admin]);

  // Scroll direction tracking
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Only hide after scrolling down past 100px
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <header className={`bg-highland-green border-b border-stone-dark/20 sticky top-0 z-50 shadow-soft transition-transform duration-300 print:hidden ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo + Title (grouped) */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-10 h-10 overflow-hidden rounded-full border-2 border-warm-white/20 group-hover:border-golden-heather transition-colors flex-shrink-0">
              <OptimizedImage
                src="/logo_knot.jpg"
                alt="Highland Events Hub"
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <span className="text-lg sm:text-xl font-bold text-warm-white">
              Highland Events Hub
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors hover:text-golden-heather ${isActive('/') ? 'text-white' : 'text-mist-grey'
                }`}
            >
              Home
            </Link>
            <Link
              href="/events"
              className={`text-sm font-medium transition-colors hover:text-golden-heather ${isActive('/events') ? 'text-white' : 'text-mist-grey'
                }`}
            >
              Events
            </Link>
            <Link
              href="/venues"
              className={`text-sm font-medium transition-colors hover:text-golden-heather ${isActive('/venues') ? 'text-white' : 'text-mist-grey'
                }`}
            >
              Venues
            </Link>
            <Link
              href="/groups"
              className={`text-sm font-medium transition-colors hover:text-golden-heather ${isActive('/groups') ? 'text-white' : 'text-mist-grey'
                }`}
            >
              Groups
            </Link>

            <Link
              href="/map"
              className={`text-sm font-medium transition-colors hover:text-golden-heather ${isActive('/map') ? 'text-white' : 'text-mist-grey'
                }`}
            >
              Map
            </Link>

            <Link
              href="/submit-event"
              className="text-sm font-medium bg-highland-green border border-golden-heather text-golden-heather px-4 py-2 rounded-lg hover:bg-golden-heather hover:text-stone-dark transition-all shadow-sm"
            >
              Create Event
            </Link>

            {isAuthenticated ? (
              <>
                <NotificationCenter pendingCount={pendingCount} />
                <UserDropdown variant="desktop" pendingCount={pendingCount} />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-mist-grey transition-colors hover:text-golden-heather"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium bg-golden-heather text-stone-dark px-4 py-2 rounded-lg hover:bg-white hover:text-highland-green transition-all shadow-sm"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Right Side Icons */}
          <div className="md:hidden flex items-center gap-2.5">
            {/* Notification Bell */}
            {isAuthenticated && (
              <NotificationCenter pendingCount={pendingCount} />
            )}

            {/* Profile / Account Dropdown */}
            {isAuthenticated ? (
              <UserDropdown variant="mobile" pendingCount={pendingCount} />
            ) : (
              <Link
                href="/login"
                className="p-1 text-warm-white/90 hover:text-golden-heather hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
                aria-label="Sign In"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

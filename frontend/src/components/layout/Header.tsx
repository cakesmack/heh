/**
 * Header Component
 * Top navigation bar with branding and user actions
 */

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSearch } from '@/context/SearchContext';
import { NotificationCenter } from './NotificationCenter';
import { apiFetch } from '@/lib/api';

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, isSeller, logout } = useAuth();
  const { openMobileSearch } = useSearch();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const isActive = (path: string) => pathname === path;

  // Fetch pending count for admins
  useEffect(() => {
    if (user?.is_admin) {
      apiFetch<{ pending_events: number }>('/api/admin/stats')
        .then(data => setPendingCount(data.pending_events || 0))
        .catch(() => setPendingCount(0));
    }
  }, [user?.is_admin]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show header if scrolling up or at the top
      if (currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-highland-green shadow-sm transition-transform duration-300 print:hidden ${isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 sm:space-x-3 group">
            <div className="relative flex items-center justify-center flex-shrink-0">
              <Image
                src="/images/logo-white.png"
                alt="Highland Events Hub"
                width={40}
                height={40}
                priority
                className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </div>
            <span className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Highland Events Hub
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/events"
              className={`text-sm font-medium transition-colors ${isActive('/events')
                ? 'text-golden-heather'
                : 'text-mist-grey hover:text-golden-heather'
                }`}
            >
              Events
            </Link>
            <Link
              href="/map"
              className={`text-sm font-medium transition-colors ${isActive('/map')
                ? 'text-golden-heather'
                : 'text-mist-grey hover:text-golden-heather'
                }`}
            >
              Map
            </Link>
            <Link
              href="/venues"
              className={`text-sm font-medium transition-colors ${isActive('/venues')
                ? 'text-golden-heather'
                : 'text-mist-grey hover:text-golden-heather'
                }`}
            >
              Venues
            </Link>
            <Link
              href="/groups"
              className={`text-sm font-medium transition-colors ${isActive('/groups')
                ? 'text-golden-heather'
                : 'text-mist-grey hover:text-golden-heather'
                }`}
            >
              Groups
            </Link>
            <Link
              href="/submit-event"
              className="text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Create Event
            </Link>

            {isAuthenticated ? (
              <>
                <NotificationCenter pendingCount={pendingCount} />

                {/* User Dropdown */}
                <div className="relative group">
                  <button className="flex items-center space-x-2 text-sm font-medium text-white hover:text-golden-heather focus:outline-none py-2">
                    <div className="w-8 h-8 rounded-full bg-golden-heather text-stone-dark flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                      {user?.username ? user.username.charAt(0) : user?.email?.charAt(0) || 'U'}
                    </div>
                    <span className="max-w-[100px] truncate">{user?.username || user?.email?.split('@')[0]}</span>
                    <svg className="w-4 h-4 text-white/70 group-hover:text-golden-heather transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div className="absolute right-0 top-full pt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 hidden group-hover:block transition-all transform origin-top-right animate-fade-in z-50">
                    <div className="px-4 py-2 border-b border-gray-100 mb-1">
                      <p className="text-xs text-gray-500">Signed in as</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{user?.username || user?.email}</p>
                    </div>

                    <Link
                      href="/account"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-emerald-600 font-medium"
                    >
                      Dashboard
                    </Link>

                    <Link
                      href="/account/tickets"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-emerald-600 font-medium"
                    >
                      My Tickets
                    </Link>

                    {isSeller && (
                      <Link
                        href="/organizers/hub"
                        className="block px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 font-bold flex items-center justify-between"
                      >
                        <span>Organizer Hub</span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Pro</span>
                      </Link>
                    )}

                    {user?.is_admin && (
                      <Link
                        href="/admin"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-emerald-600 relative"
                      >
                        Admin Dashboard
                        {pendingCount > 0 && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {pendingCount > 9 ? '9+' : pendingCount}
                          </span>
                        )}
                      </Link>
                    )}

                    <button
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
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
          <div className="md:hidden flex items-center gap-2">
            {/* Search Icon */}
            <button
              onClick={openMobileSearch}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              aria-label="Search events"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Notification Bell */}
            {isAuthenticated && (
              <NotificationCenter pendingCount={pendingCount} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

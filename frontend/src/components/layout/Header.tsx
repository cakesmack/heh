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
import { NotificationCenter } from './NotificationCenter';
import { apiFetch } from '@/lib/api';

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
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
    <header className={`bg-highland-green border-b border-stone-dark/20 sticky top-0 z-50 shadow-soft transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-10 h-10 overflow-hidden rounded-full border-2 border-warm-white/20 group-hover:border-golden-heather transition-colors">
              <Image
                src="/logo_knot.jpg"
                alt="Highland Events Hub"
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <span className="text-xl font-bold text-warm-white hidden sm:block">
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
                <NotificationCenter />
                <div className="relative group">
                  <button className="flex items-center space-x-2 bg-moss-green/20 px-3 py-1.5 rounded-full border border-moss-green/30 hover:bg-moss-green/30 transition-colors">
                    <span className="text-sm font-medium text-soft-sky">
                      {user?.username || user?.display_name || user?.email?.split('@')[0]}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                      {(user?.username || user?.email)?.[0].toUpperCase()}
                    </div>
                    <svg className="w-4 h-4 text-mist-grey" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-500">Signed in as</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.username || user?.email}</p>
                    </div>


                    <Link
                      href="/account"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-emerald-600"
                    >
                      My Account
                    </Link>

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

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            {isAuthenticated && (
              <Link
                href="/account"
                className="flex items-center space-x-2 bg-moss-green/20 px-3 py-1 rounded-full"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                  {user?.email?.[0].toUpperCase()}
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

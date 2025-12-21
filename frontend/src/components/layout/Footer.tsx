/**
 * Footer Component
 * Bottom footer with branding and links
 */

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-stone-dark border-t border-stone-medium/20 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl font-bold text-moss-green">⛰️</span>
              <span className="text-lg font-bold text-warm-white">Highland Events</span>
            </div>
            <p className="text-sm text-mist-grey">
              Discover and explore events across the Scottish Highlands
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-warm-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/events" className="text-sm text-mist-grey hover:text-golden-heather transition-colors">
                  Browse Events
                </Link>
              </li>
              <li>
                <Link href="/venues" className="text-sm text-mist-grey hover:text-golden-heather transition-colors">
                  Explore Venues
                </Link>
              </li>
              <li>
                <Link href="/map" className="text-sm text-mist-grey hover:text-golden-heather transition-colors">
                  Map View
                </Link>
              </li>
              <li>
                <Link href="/submit-event" className="text-sm text-mist-grey hover:text-golden-heather transition-colors">
                  Submit Event
                </Link>
              </li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-warm-white mb-4">About</h3>
            <p className="text-sm text-mist-grey mb-4">
              Highland Events Hub helps you discover local experiences, earn rewards, and unlock
              exclusive promotions.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-stone-medium/20">
          <p className="text-sm text-stone-medium text-center">
            © {currentYear} Highland Events Hub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

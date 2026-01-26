/**
 * Footer Component
 * 4-column site map style footer with branding and links
 */

import Link from 'next/link';

// Social Icons
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const MailIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export function Footer() {
  return (
    <footer className="bg-slate-900 mt-auto pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 lg:gap-8">
          {/* Column 1: Brand - Full width on mobile */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">⛰️</span>
              <span className="text-xl font-bold text-white">Highland Events Hub</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              The definitive guide to culture, music, and adventure in the heart of Scotland.
            </p>
          </div>

          {/* Column 2: Explore */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider mb-4">Explore</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/events" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Browse Events
                </Link>
              </li>
              <li>
                <Link href="/map" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Venues Map
                </Link>
              </li>
              <li>
                <Link href="/groups" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Community Groups
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/terms#refund-policy" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Refund & Cancellation Policy
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Socials - Full width on mobile */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider mb-4">Socials</h3>
            <div className="flex space-x-4 mb-4">
              <a
                href="https://instagram.com/highlandeventshub"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <InstagramIcon className="w-6 h-6" />
              </a>
              <a
                href="https://www.facebook.com/HighlandEventsHub/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <FacebookIcon className="w-6 h-6" />
              </a>
            </div>
            <a
              href="mailto:contact@highlandeventshub.co.uk"
              className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm flex items-center"
            >
              <MailIcon className="w-4 h-4 mr-2" />
              contact@highlandeventshub.co.uk
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-700">
          <p className="text-xs sm:text-sm text-gray-500 text-center">
            © 2026 Highland Events Hub. Built in the Highlands.
          </p>
        </div>
      </div>
    </footer>
  );
}

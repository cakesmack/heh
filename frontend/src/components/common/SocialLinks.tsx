/**
 * SocialLinks Component
 * Renders a row of social media icons linking to venue profiles.
 * Only shows icons for links that are provided.
 */

import { Facebook, Instagram, Twitter, Linkedin, Globe } from 'lucide-react';

interface SocialLinksProps {
    facebook?: string | null;
    instagram?: string | null;
    x?: string | null;
    linkedin?: string | null;
    tiktok?: string | null;
    website?: string | null;
    className?: string;
}

export default function SocialLinks({
    facebook,
    instagram,
    x,
    linkedin,
    tiktok,
    website,
    className = '',
}: SocialLinksProps) {
    const hasLinks = facebook || instagram || x || linkedin || tiktok || website;

    if (!hasLinks) return null;

    const linkClass =
        'w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600 transition-colors';

    return (
        <div className={`flex items-center gap-2 flex-wrap ${className}`}>
            {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer" className={linkClass} title="Facebook">
                    <Facebook className="w-4 h-4" />
                </a>
            )}
            {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer" className={linkClass} title="Instagram">
                    <Instagram className="w-4 h-4" />
                </a>
            )}
            {x && (
                <a href={x} target="_blank" rel="noopener noreferrer" className={linkClass} title="X (Twitter)">
                    <Twitter className="w-4 h-4" />
                </a>
            )}
            {linkedin && (
                <a href={linkedin} target="_blank" rel="noopener noreferrer" className={linkClass} title="LinkedIn">
                    <Linkedin className="w-4 h-4" />
                </a>
            )}
            {tiktok && (
                <a href={tiktok} target="_blank" rel="noopener noreferrer" className={linkClass} title="TikTok">
                    {/* TikTok doesn't have a Lucide icon, use a custom SVG */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                    </svg>
                </a>
            )}
            {website && (
                <a href={website} target="_blank" rel="noopener noreferrer" className={linkClass} title="Website">
                    <Globe className="w-4 h-4" />
                </a>
            )}
        </div>
    );
}

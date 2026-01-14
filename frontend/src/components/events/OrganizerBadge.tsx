import Link from 'next/link';
import { OrganizerProfileResponse } from '@/types';

interface OrganizerBadgeProps {
    organizer: OrganizerProfileResponse;
    className?: string;
}

export function OrganizerBadge({ organizer, className = '' }: OrganizerBadgeProps) {
    if (!organizer) return null;

    return (
        <Link
            href={`/organizers/${organizer.slug}`}
            className={`group flex items-center gap-3 transition-colors hover:bg-gray-50 rounded-lg p-2 -ml-2 ${className}`}
        >
            {/* Avatar */}
            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                {organizer.logo_url ? (
                    <img
                        src={organizer.logo_url}
                        alt={organizer.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold text-lg">
                        {organizer.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                    Presented by
                </span>
                <span className="text-sm md:text-md font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {organizer.name}
                </span>
            </div>
        </Link>
    );
}

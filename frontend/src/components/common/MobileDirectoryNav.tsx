import Link from 'next/link';
import { useRouter } from 'next/router';

export function MobileDirectoryNav() {
    const router = useRouter();
    const isVenues = router.pathname.startsWith('/venues');
    const isGroups = router.pathname.startsWith('/groups');

    return (
        <div className="md:hidden mb-6">
            <div className="flex p-1 bg-gray-200 rounded-lg">
                <Link
                    href="/venues"
                    className={`flex-1 text-center py-2 text-sm font-medium rounded-md transition-all ${isVenues
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Venues
                </Link>
                <Link
                    href="/groups"
                    className={`flex-1 text-center py-2 text-sm font-medium rounded-md transition-all ${isGroups
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Groups
                </Link>
            </div>
        </div>
    );
}

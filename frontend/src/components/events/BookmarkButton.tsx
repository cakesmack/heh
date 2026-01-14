import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';

interface BookmarkButtonProps {
    eventId: string;
    initialBookmarked?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    onToggle?: (isBookmarked: boolean) => void;
}

export function BookmarkButton({
    eventId,
    initialBookmarked = false,
    className = '',
    size = 'md',
    showLabel = false,
    onToggle,
}: BookmarkButtonProps) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
    const [isLoading, setIsLoading] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);

    // Check status on mount if authenticated
    useEffect(() => {
        if (isAuthenticated && !hasChecked && !initialBookmarked) {
            checkStatus();
        }
    }, [isAuthenticated, eventId]);

    const checkStatus = async () => {
        try {
            const { bookmarked } = await api.bookmarks.check(eventId);
            setIsBookmarked(bookmarked);
            setHasChecked(true);
        } catch (error) {
            console.error('Failed to check bookmark status:', error);
        }
    };

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
            // Redirect to login with returnTo param
            router.push(`/login?returnTo=${encodeURIComponent(router.asPath)}`);
            return;
        }

        setIsLoading(true);
        try {
            // Optimistic update
            const newIsBookmarked = !isBookmarked;
            setIsBookmarked(newIsBookmarked);

            // Call onToggle for optimistic update in parent
            if (onToggle) {
                onToggle(newIsBookmarked);
            }

            const response = await api.bookmarks.toggle(eventId);

            // Verify state matches server
            if (response.bookmarked !== newIsBookmarked) {
                // Revert if mismatch
                setIsBookmarked(response.bookmarked);
                if (onToggle) {
                    onToggle(response.bookmarked);
                }
            }

            if (response.bookmarked) {
                import('@/lib/analytics').then(({ analytics }) => {
                    analytics.track('save_event', { target_id: eventId });
                });
            }

            toast.success(response.message);
        } catch (error) {
            // Revert on error
            setIsBookmarked(!isBookmarked);
            if (onToggle) {
                onToggle(!isBookmarked);
            }
            toast.error('Failed to update bookmark');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
    };

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`
        relative flex items-center justify-center rounded-full transition-all duration-200
        ${isBookmarked
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}
        ${showLabel ? 'px-6 py-3 w-auto gap-2' : sizeClasses[size]}
        ${className}
      `}
            title={isBookmarked ? 'Not attending' : 'Mark as attending'}
        >
            <svg
                className={`${iconSizes[size]} ${isBookmarked ? 'fill-none' : 'fill-none'} stroke-current transition-transform ${isBookmarked ? 'scale-110' : ''}`}
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {/* Check Icon */}
                <polyline points="20 6 9 17 4 12" />
            </svg>
            {showLabel && (
                <span className={`text-sm font-bold ${isBookmarked ? 'text-white' : 'text-gray-600'}`}>
                    {isBookmarked ? "I'm Going" : "I'm Going"}
                </span>
            )}
        </button>
    );
}

import { useState, useEffect } from 'react';
import { bookmarksAPI } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';

interface BookmarkButtonProps {
    eventId: string;
    initialBookmarked?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export function BookmarkButton({
    eventId,
    initialBookmarked = false,
    className = '',
    size = 'md',
    showLabel = false,
}: BookmarkButtonProps) {
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
            const { bookmarked } = await bookmarksAPI.check(eventId);
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
            toast.error('Please sign in to bookmark events');
            return;
        }

        setIsLoading(true);
        try {
            // Optimistic update
            setIsBookmarked(!isBookmarked);

            const response = await bookmarksAPI.toggle(eventId);

            // Verify state matches server
            if (response.bookmarked !== !isBookmarked) {
                setIsBookmarked(response.bookmarked);
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
                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}
        ${showLabel ? 'px-4 py-2 w-auto' : sizeClasses[size]}
        ${className}
      `}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark event'}
        >
            <svg
                className={`${iconSizes[size]} ${isBookmarked ? 'fill-current' : 'fill-none'} stroke-current transition-transform ${isBookmarked ? 'scale-110' : ''}`}
                viewBox="0 0 24 24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {showLabel && (
                <span className="ml-2 text-sm font-medium">
                    {isBookmarked ? 'Saved' : 'Save'}
                </span>
            )}
        </button>
    );
}

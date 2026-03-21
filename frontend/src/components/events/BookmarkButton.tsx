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
    onToggle?: (isBookmarked: boolean, count?: number) => void;
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
                    onToggle(response.bookmarked, response.count);
                }
            } else {
                // Update parent with the actual count from server
                if (onToggle) {
                    onToggle(response.bookmarked, response.count);
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
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
        ${showLabel ? 'px-6 py-2.5 w-auto gap-2 whitespace-nowrap shrink-0' : sizeClasses[size]}
        ${className}
      `}
            title={isBookmarked ? 'Remove bookmark' : 'Save event'}
        >
            <svg
                className={`${iconSizes[size]} transition-transform ${isBookmarked ? 'scale-110' : ''}`}
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                fill={isBookmarked ? 'currentColor' : 'none'}
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {showLabel && (
                <span className={`text-sm font-bold ${isBookmarked ? 'text-blue-600' : 'text-gray-600'}`}>
                    {isBookmarked ? "Saved" : "Save"}
                </span>
            )}
        </button>
    );
}

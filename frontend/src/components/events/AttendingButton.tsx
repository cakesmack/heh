import { useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';

interface AttendingButtonProps {
    eventId: string;
    initialAttending?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    onToggle?: (isAttending: boolean) => void;
}

export function AttendingButton({
    eventId,
    initialAttending = false,
    className = '',
    size = 'md',
    showLabel = false,
    onToggle,
}: AttendingButtonProps) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthenticated) {
            router.push(`/login?returnTo=${encodeURIComponent(router.asPath)}`);
            return;
        }

        if (isLoading) return;

        setIsLoading(true);
        const nextState = !initialAttending;
        
        // Optimistic update (Immediate local UI reaction via parent state)
        if (onToggle) {
            onToggle(nextState);
        }

        try {
            const response = await api.events.attend(eventId);

            // Reconcile if server state differs from our optimistic toggle
            if (response.is_attending !== nextState) {
                if (onToggle) {
                    onToggle(response.is_attending);
                }
            }

            if (response.is_attending) {
                import('@/lib/analytics').then(({ analytics }) => {
                    analytics.track('attend_event', { target_id: eventId });
                });
            }

            toast.success(response.message);
        } catch (error) {
            // Revert on error
            if (onToggle) {
                onToggle(!nextState);
            }
            toast.error('Failed to update attendance');
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
        ${initialAttending
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}
        ${showLabel ? 'px-6 py-2.5 w-auto gap-2 whitespace-nowrap shrink-0' : sizeClasses[size]}
        ${className}
        ${isLoading ? 'opacity-70 cursor-wait' : ''}
      `}
            title={initialAttending ? 'Not attending' : 'Mark as attending'}
        >
            {isLoading ? (
                <div className={`${iconSizes[size]} border-2 border-white/30 border-t-white rounded-full animate-spin`} />
            ) : (
                <svg
                    className={`${iconSizes[size]} fill-none stroke-current transition-transform ${initialAttending ? 'scale-110' : ''}`}
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            )}
            {showLabel && (
                <span className={`text-sm font-bold ${initialAttending ? 'text-white' : 'text-gray-600'}`}>
                    {isLoading ? "Updating..." : (initialAttending ? "I'm Going" : "RSVP")}
                </span>
            )}
        </button>
    );
}

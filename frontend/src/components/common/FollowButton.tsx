import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button, cn } from '@/components/ui/button';
import { Heart, HeartOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FollowButtonProps {
    targetId: string;
    targetType: 'venue' | 'group';
    className?: string;
    iconOnly?: boolean;
}

export function FollowButton({ targetId, targetType, className, iconOnly = false }: FollowButtonProps) {
    const { user } = useAuth();
    const [isFollowing, setIsFollowing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user && targetId) {
            checkFollowStatus();
        }
    }, [user, targetId]);

    const checkFollowStatus = async () => {
        try {
            const status = await api.social.isFollowing(targetId);
            setIsFollowing(status);
        } catch (error) {
            console.error('Failed to check follow status:', error);
        }
    };

    const handleToggleFollow = async () => {
        if (!user) {
            toast.error('Please log in to follow');
            return;
        }

        setIsLoading(true);
        try {
            if (isFollowing) {
                await api.social.unfollow(targetType, targetId);
                setIsFollowing(false);
                toast.success(`Unfollowed ${targetType}`);
            } else {
                await api.social.follow(targetType, targetId);
                setIsFollowing(true);
                toast.success(`Following ${targetType}`);
            }
        } catch (error) {
            console.error('Failed to toggle follow:', error);
            toast.error('Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <Button
            variant={isFollowing ? "default" : "outline"}
            size={iconOnly ? "icon" : "sm"}
            onClick={handleToggleFollow}
            disabled={isLoading}
            className={cn(
                "transition-all",
                iconOnly ? "rounded-full w-10 h-10 p-0" : "rounded-full px-6",
                isFollowing
                    ? "bg-red-500 text-white border-transparent hover:bg-red-600 hover:text-white"
                    : "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400",
                className
            )}
            title={isFollowing ? "Unfollow" : "Follow"}
        >
            {isFollowing ? (
                <>
                    <HeartOff className={cn("w-4 h-4", !iconOnly && "mr-2")} />
                    {!iconOnly && "Unfollow"}
                </>
            ) : (
                <>
                    <Heart className={cn("w-4 h-4", !iconOnly && "mr-2")} />
                    {!iconOnly && "Follow"}
                </>
            )}
        </Button>
    );
}

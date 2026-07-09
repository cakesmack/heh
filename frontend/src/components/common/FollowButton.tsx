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
}

export function FollowButton({ targetId, targetType, className }: FollowButtonProps) {
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
            size="sm"
            onClick={handleToggleFollow}
            disabled={isLoading}
            className={cn(
                "rounded-full px-6 transition-all",
                isFollowing
                    ? "bg-stone-800 text-white border border-white/10 hover:bg-stone-700 hover:text-white"
                    : "border-emerald-600 text-emerald-600 hover:bg-emerald-600/10 bg-transparent hover:text-emerald-700",
                className
            )}
        >
            {isFollowing ? (
                <>
                    <HeartOff className="w-4 h-4 mr-2" />
                    Unfollow
                </>
            ) : (
                <>
                    <Heart className="w-4 h-4 mr-2" />
                    Follow
                </>
            )}
        </Button>
    );
}

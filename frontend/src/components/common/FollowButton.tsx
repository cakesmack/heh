import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
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
            variant={isFollowing ? "outline" : "default"}
            size="sm"
            onClick={handleToggleFollow}
            disabled={isLoading}
            className={className}
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

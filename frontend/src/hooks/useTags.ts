import { useState, useEffect } from 'react';
import { tagsAPI } from '@/lib/api';
import { Tag } from '@/types';

export function useTags() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                setIsLoading(true);
                const response = await tagsAPI.list(undefined, 100); // Fetch up to 100 tags
                setTags(response.tags);
            } catch (err) {
                setError('Failed to load tags');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTags();
    }, []);

    return { tags, isLoading, error };
}

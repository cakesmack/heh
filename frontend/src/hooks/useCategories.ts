/**
 * useCategories Hook
 * Fetches and manages categories data
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Category } from '@/types';

export function useCategories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await api.categories.list(true); // Fetch active only
                setCategories(response.categories);
            } catch (err) {
                setError('Failed to load categories');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCategories();
    }, []);

    return { categories, isLoading, error };
}

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag } from '@/types';
import { api } from '@/lib/api';

interface TagCloudProps {
  limit?: number;
}

export default function TagCloud({ limit = 20 }: TagCloudProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.tags.popular(limit);
        setTags(response.tags);
      } catch (error) {
        console.error('Failed to fetch popular tags:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [limit]);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-200 animate-pulse rounded-full" />
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  // Calculate font sizes based on usage count
  const maxCount = Math.max(...tags.map(t => t.usage_count));
  const minCount = Math.min(...tags.map(t => t.usage_count));
  const range = maxCount - minCount || 1;

  const getFontSize = (count: number) => {
    const normalized = (count - minCount) / range;
    return 0.75 + normalized * 0.5;
  };

  return (
    <section className="py-6">
      <h2 className="text-xl font-semibold mb-4">Popular Tags</h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={'/events?tags=' + tag.name}
            className="px-3 py-1 bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-800 rounded-full transition-colors"
            style={{ fontSize: getFontSize(tag.usage_count) + 'rem' }}
          >
            {tag.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

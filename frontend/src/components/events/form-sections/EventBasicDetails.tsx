
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/common/Input';
import RichTextEditor from '@/components/common/RichTextEditor';
import TagInput from '@/components/tags/TagInput';
import FormSection from '../FormSection';
import { Category, Organizer } from '@/types';
import { eventsAPI } from '@/lib/api';

interface EventBasicDetailsProps {
    formData: any; // Using any for brevity in intermediate refactor, but should strict type later
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    setFormData: (data: any) => void;
    categories: Category[];
    organizers: Organizer[];
    userEmail?: string;
    selectedTags: string[];
    setSelectedTags: (tags: string[]) => void;
}

interface Suggestion {
    id: string;
    title: string;
    date_start: string;
    venue_name: string | null;
}

export default function EventBasicDetails({
    formData,
    handleChange,
    setFormData,
    categories,
    organizers,
    userEmail,
    selectedTags,
    setSelectedTags
}: EventBasicDetailsProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Debounced title suggestion lookup
    useEffect(() => {
        const title = formData.title?.trim() || '';

        // Clear previous timer
        if (debounceRef.current) clearTimeout(debounceRef.current);

        // Reset if too short
        if (title.length < 5) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await eventsAPI.suggestions(title);
                setSuggestions(results);
                setShowSuggestions(results.length > 0);
            } catch {
                setSuggestions([]);
                setShowSuggestions(false);
            } finally {
                setIsLoading(false);
            }
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [formData.title]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <FormSection
            title="Basic Details"
            description="Tell people what your event is about."
            tipTitle="Make it Stand Out"
            tipContent={
                <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Title:</strong> Keep it short and punchy.</li>
                    <li><strong>Description:</strong> Highlight the vibe. Mention parking and accessibility.</li>
                    <li><strong>Organizer:</strong> Posting as a Group helps people follow your future events.</li>
                </ul>
            }
        >
            {/* Organizer Selection Moved to Top Level */}

            <div ref={containerRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
                <Input
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g. Inverness Photography Club Monthly Meetup"
                />

                {/* Loading indicator */}
                {isLoading && (
                    <p className="mt-1 text-xs text-gray-400">Checking for similar events...</p>
                )}

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-amber-50 border border-amber-300 rounded-lg shadow-lg overflow-hidden">
                        <p className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-100 border-b border-amber-200">
                            ⚠️ Possible matches already exist
                        </p>
                        <ul className="max-h-48 overflow-y-auto divide-y divide-amber-100">
                            {suggestions.map((s) => (
                                <li key={s.id}>
                                    <a
                                        href={`/events/${s.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between px-3 py-2 hover:bg-amber-100 transition-colors group"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate group-hover:text-amber-900">
                                                {s.title}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(s.date_start).toLocaleDateString('en-GB', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                                {s.venue_name && ` · ${s.venue_name}`}
                                            </p>
                                        </div>
                                        <span className="ml-2 text-xs text-amber-600 shrink-0">View ↗</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <RichTextEditor
                    value={formData.description}
                    onChange={(value) => setFormData((prev: any) => ({ ...prev, description: value }))}
                    placeholder="Describe your event..."
                />
                <p className="mt-2 text-sm text-amber-600">
                    To prevent spam, events with external links in the description require manual approval.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <select
                    name="category_id"
                    required
                    value={formData.category_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="">Select a category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <TagInput selectedTags={selectedTags} onChange={setSelectedTags} maxTags={5} />
        </FormSection >
    );
}


import React from 'react';
import { Input } from '@/components/common/Input';
import RichTextEditor from '@/components/common/RichTextEditor';
import TagInput from '@/components/tags/TagInput';
import FormSection from '../FormSection';
import { Category, Organizer } from '@/types';

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
            {organizers.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Post as Organizer</label>
                    <select
                        name="organizer_profile_id"
                        value={formData.organizer_profile_id}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border rounded-lg"
                    >
                        <option value="">Myself ({userEmail})</option>
                        {organizers.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                    </select>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
                <Input
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g. Inverness Photography Club Monthly Meetup"
                />
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
        </FormSection>
    );
}

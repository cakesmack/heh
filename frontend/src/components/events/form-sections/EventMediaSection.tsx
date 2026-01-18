
import React from 'react';
import ImageUpload from '@/components/common/ImageUpload';
import FormSection from '../FormSection';

interface EventMediaSectionProps {
    imageUrl: string;
    onUpload: (urls: { url: string; thumbnail_url: string; medium_url: string }) => void;
    onRemove: () => void;
}

export default function EventMediaSection({ imageUrl, onUpload, onRemove }: EventMediaSectionProps) {
    return (
        <FormSection
            title="Event Image"
            description="Choose an image that represents your event."
            tipTitle="Featured Image"
            tipContent={
                <>
                    <p>Use a high-quality landscape photo (16:9) to stand out on the map.</p>
                    <p>Avoid flyers with small text; real photos of the venue or previous events perform best.</p>
                </>
            }
        >
            <ImageUpload
                folder="events"
                currentImageUrl={imageUrl}
                onUpload={onUpload}
                onRemove={onRemove}
            />
        </FormSection>
    );
}

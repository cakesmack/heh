/**
 * RichText Component
 * Renders rich text content (HTML from Tiptap) or plain text with auto-linking.
 */

import React from 'react';

interface RichTextProps {
    content: string;
    className?: string;
}

// Regex to match URLs (for compatible plain text mode)
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

// Simple check for HTML tags
const isHtml = (text: string) => {
    return /<[a-z][\s\S]*>/i.test(text);
};

export default function RichText({ content, className = '' }: RichTextProps) {
    if (!content) return null;

    // Handle HTML content (from Tiptap editor)
    if (isHtml(content)) {
        return (
            <div
                className={`prose prose-sm max-w-none text-gray-700 ${className} [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>a]:text-emerald-600 [&>a]:underline`}
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }

    // Handle Plain Text (Legacy)
    // Split content by URLs and map to elements
    const parts = content.split(URL_REGEX);

    const elements = parts.map((part, index) => {
        // Check if this part is a URL
        if (URL_REGEX.test(part)) {
            // Reset regex lastIndex (global regex quirk)
            URL_REGEX.lastIndex = 0;
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 underline break-all"
                >
                    {part}
                </a>
            );
        }
        return <span key={index}>{part}</span>;
    });

    return (
        <div className={`whitespace-pre-wrap break-words w-full max-w-full overflow-hidden ${className}`}>
            {elements}
        </div>
    );
}

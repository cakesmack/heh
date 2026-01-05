/**
 * RichText Component
 * Renders text with preserved line breaks and auto-linked URLs
 */

import React from 'react';

interface RichTextProps {
    content: string;
    className?: string;
}

// Regex to match URLs
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

/**
 * Converts plain text to React elements with:
 * - Preserved line breaks (via CSS whitespace-pre-wrap)
 * - Auto-linked URLs (clickable, opens in new tab)
 */
export default function RichText({ content, className = '' }: RichTextProps) {
    if (!content) return null;

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
        <div className={`whitespace-pre-wrap break-words ${className}`}>
            {elements}
        </div>
    );
}

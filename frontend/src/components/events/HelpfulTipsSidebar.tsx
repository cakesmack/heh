
'use client';

import { useEffect, useState } from 'react';

export interface HelpfulTipsSidebarProps {
    activeField: string | null;
    className?: string;
}

const TIPS: Record<string, { title: string; content: string }> = {
    image_url: {
        title: 'Featured Image',
        content: "Use a high-quality landscape photo (16:9) to stand out on the map. Avoid flyers with small text; images of the venue or previous events perform better.",
    },
    organizer_profile_id: {
        title: 'Post as Organizer',
        content: "Submit as yourself or a group you manage. If you represent a business or club, using an Organizer Profile helps people follow your future events.",
    },
    title: {
        title: 'Event Title',
        content: "Keep it short and punchy. Instead of 'Meeting,' try 'Inverness Photography Club Monthly Meetup' to improve search results.",
    },
    description: {
        title: 'Description',
        content: "Highlight the unique vibe of your event. Use bullet points for key details like parking, accessibility, or if dogs are welcome.",
    },
    venue_id: {
        title: 'Event Location',
        content: "Find your venue by typing its name. Can't find it? Use the 'Custom' tab for a one-off location, or use the link to Add a New Venue to our permanent list (Note: this link opens in a new tab).",
    },
    location_name: {
        title: 'Event Location',
        content: "Enter a specific name for this location (e.g. 'Falcon Square'). This helps users find exactly where to go.",
    },
    multi_venue: {
        title: 'Multi-Venue Event',
        content: "Perfect for Festivals, Pub Crawls, or Open Studios. Adding multiple venues will place a pin at every participating location on the map.",
    },
    event_type: {
        title: 'Event Type',
        content: "Selecting 'Multiple Showings' is best for theatre runs or cinema screenings. You only fill the details once, then simply add the different dates and times below.",
    },
    is_recurring: {
        title: 'Recurring Event',
        content: "Does this happen every week? Check this box to set a pattern (e.g., 'Every Tuesday'). This saves you from creating separate entries for a regular club or class.",
    },
    price: {
        title: 'Price',
        content: "If your event is free, type 'Free'. We prioritize free community events in our 'Budget Friendly' filters.",
    },
    ticket_url: {
        title: 'Ticket URL',
        content: "If your event requires tickets, provide the direct link to the booking page. Events with clear ticket links generally see higher attendance.",
    },
    age_restriction: {
        title: 'Minimum Age',
        content: "Specify if there is an age restriction (e.g., 18+ for pub gigs). Leave as '0' if the event is open to all ages.",
    },
    // Default tip when nothing is focused (optional)
    default: {
        title: 'Helpful Tips',
        content: "Click on any field to see helpful advice here. We'll guide you through creating the perfect event listing.",
    }
};

export default function HelpfulTipsSidebar({ activeField, className = '' }: HelpfulTipsSidebarProps) {
    const [activeTip, setActiveTip] = useState(TIPS.default);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (activeField && TIPS[activeField]) {
            setActiveTip(TIPS[activeField]);
            setIsVisible(true);
        } else if (!activeField) {
            // Optional: keep last tip or revert to default
            // setActiveTip(TIPS.default); 
        }
    }, [activeField]);

    return (
        <div className={`transition-opacity duration-300 ${className}`}>
            {/* Desktop Sticky Sidebar */}
            <div className="hidden lg:block sticky top-24 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-emerald-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="font-semibold">Quick Tip</h3>
                </div>

                <div className="animate-fade-in">
                    <h4 className="font-medium text-gray-900 mb-2">{activeTip.title}</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {activeTip.content}
                    </p>
                </div>
            </div>

            {/* Mobile Fixed Bottom Banner (only shows when a field is active) */}
            {activeField && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-xl z-50 animate-slide-up">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5 text-emerald-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-1">{activeTip.title}</h4>
                            <p className="text-sm text-gray-600">{activeTip.content}</p>
                        </div>
                        <button
                            onClick={() => setIsVisible(false)} // This local state doesn't persist activeField logic, but allows momentary dismissal
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

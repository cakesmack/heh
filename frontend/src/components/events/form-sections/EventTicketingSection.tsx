
import React from 'react';
import { Input } from '@/components/common/Input';
import FormSection from '../FormSection';

interface EventTicketingSectionProps {
    formData: any;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function EventTicketingSection({ formData, handleChange }: EventTicketingSectionProps) {
    return (
        <FormSection
            title="Ticketing & More"
            description="Pricing, tickets, and restrictions."
            tipTitle="Boost Attendance"
            tipContent={
                <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Price:</strong> 'Free' events get priority in our Budget Friendly filter!</li>
                    <li><strong>Ticket URL:</strong> Direct links to Skiddle or Eventbrite increase conversion.</li>
                </ul>
            }
        >
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                <Input
                    name="price"
                    type="text"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="e.g., Free, £5, £5-£10, Donation"
                />
                <p className="mt-1 text-xs text-gray-500">Enter "Free" for free events, or any price format.</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ticket URL</label>
                <Input name="ticket_url" type="url" value={formData.ticket_url} onChange={handleChange} placeholder="https://tickets.example.com/..." />
                <p className="mt-1 text-xs text-gray-500">Link to where people can buy tickets.</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Website (Optional)</label>
                <Input name="website_url" type="url" value={formData.website_url || ''} onChange={handleChange} placeholder="https://www.your-event.com" />
                <p className="mt-1 text-xs text-gray-500">A separate website for your event (if different from tickets).</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Age</label>
                <Input
                    name="age_restriction"
                    type="number"
                    min="0"
                    value={formData.age_restriction}
                    onChange={handleChange}
                    placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500">Enter 0 for All Ages, or minimum age required (e.g., 18).</p>
            </div>
        </FormSection>
    );
}

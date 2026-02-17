
import React from 'react';
import { Input } from '@/components/common/Input';
import FormSection from '../FormSection';
import { createUrlBlurHandler } from '@/utils/url';

interface EventTicketingSectionProps {
    formData: any;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setFormData: React.Dispatch<React.SetStateAction<any>>;
    fieldErrors?: Record<string, string>;
}

export default function EventTicketingSection({
    formData,
    handleChange,
    setFormData,
    fieldErrors = {}
}: EventTicketingSectionProps) {
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
                    error={fieldErrors.price}
                />
                <p className="mt-1 text-xs text-gray-500">Enter "Free" for free events, or any price format.</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ticket URL</label>
                <Input
                    name="ticket_url"
                    type="text"
                    value={formData.ticket_url}
                    onChange={handleChange}
                    onBlur={createUrlBlurHandler(setFormData, 'ticket_url')}
                    placeholder="e.g., www.skiddle.com/your-event"
                    error={fieldErrors.ticket_url}
                />
                <p className="mt-1 text-xs text-gray-500">Link to where people can buy tickets. We'll add https:// automatically.</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Website (Optional)</label>
                <Input
                    name="website_url"
                    type="text"
                    value={formData.website_url || ''}
                    onChange={handleChange}
                    onBlur={createUrlBlurHandler(setFormData, 'website_url')}
                    placeholder="e.g., www.your-event.com"
                    error={fieldErrors.website_url}
                />
                <p className="mt-1 text-xs text-gray-500">A separate website for your event. We'll add https:// automatically.</p>
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
                    error={fieldErrors.age_restriction}
                />
                <p className="mt-1 text-xs text-gray-500">Enter 0 for All Ages, or minimum age required (e.g., 18).</p>
            </div>
        </FormSection>
    );
}

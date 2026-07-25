import React, { useState } from 'react';
import { PendingEvent, Venue, Category } from '@/types';
import { X, Clock } from 'lucide-react';
import { EventForm, EventFormData } from '@/components/admin/EventForm';

interface PendingEventEditModalProps {
  event: PendingEvent | null;
  venues: Venue[];
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSaveDraft: (id: string, data: Partial<PendingEvent>) => Promise<void>;
  onApprovePublish: (id: string, data: Partial<PendingEvent>) => Promise<void>;
}

export const PendingEventEditModal: React.FC<PendingEventEditModalProps> = ({
  event,
  venues,
  categories,
  isOpen,
  onClose,
  onSaveDraft,
  onApprovePublish,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !event) return null;

  const handleSaveDraft = async (data: EventFormData) => {
    try {
      setIsSubmitting(true);
      await onSaveDraft(event.id, data);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePublish = async (data: EventFormData) => {
    try {
      setIsSubmitting(true);
      await onApprovePublish(event.id, data);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-900 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Edit Event — {event.title}
              </h2>
              <p className="text-xs text-gray-400">
                Source: <span className="text-gray-200 uppercase font-mono">{event.source}</span> | Staging ID: {event.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Reusable EventForm */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/30">
          <EventForm
            initialValues={event}
            venues={venues}
            categories={categories}
            rawShowtimes={event.raw_showtimes || []}
            onSaveDraft={handleSaveDraft}
            onApprovePublish={handleApprovePublish}
            onCancel={onClose}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
};

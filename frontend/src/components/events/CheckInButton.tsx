/**
 * CheckInButton Component
 * Button to check in to an event with feedback
 */

'use client';

import { useState } from 'react';
import { useCheckIn } from '@/hooks/useCheckIn';
import { Button } from '@/components/common/Button';

interface CheckInButtonProps {
  eventId: string;
  eventTitle: string;
  onSuccess?: () => void;
  className?: string;
}

export function CheckInButton({ eventId, eventTitle, onSuccess, className }: CheckInButtonProps) {
  const { isCheckingIn, checkInError, checkInResponse, performCheckIn, clearCheckInState } =
    useCheckIn();
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCheckIn = async () => {
    const response = await performCheckIn(eventId);

    if (response) {
      setShowSuccess(true);
      onSuccess?.();

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
        clearCheckInState();
      }, 5000);
    }
  };

  if (showSuccess && checkInResponse) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg
            className="w-6 h-6 text-emerald-600 mr-3 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-emerald-900 mb-1">
              Check-in Successful!
            </h4>
            <p className="text-sm text-emerald-800 mb-2">{checkInResponse.message}</p>

            {/* Promotion Unlocked */}

            {/* Promotion Unlocked */}
            {checkInResponse.promotion_unlocked && (
              <div className="mt-2 p-2 bg-white rounded border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-900 mb-1">
                  🎁 Promotion Unlocked!
                </p>
                <p className="text-xs text-emerald-800">
                  {checkInResponse.promotion_unlocked.title}
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {checkInResponse.promotion_unlocked.discount_type === 'percentage'
                    ? `${checkInResponse.promotion_unlocked.discount_value}% off`
                    : checkInResponse.promotion_unlocked.discount_type === 'fixed_amount'
                      ? `£${checkInResponse.promotion_unlocked.discount_value} off`
                      : checkInResponse.promotion_unlocked.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        onClick={handleCheckIn}
        variant="primary"
        size="lg"
        fullWidth
        isLoading={isCheckingIn}
        disabled={isCheckingIn}
      >
        {isCheckingIn ? 'Checking in...' : 'Check In to Event'}
      </Button>

      {checkInError && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-600 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-900">Check-in Failed</p>
              <p className="text-sm text-red-700 mt-1">{checkInError}</p>
            </div>
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-500 text-center">
        You must be at the event location to check in
      </p>
    </div>
  );
}

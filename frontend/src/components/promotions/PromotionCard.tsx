/**
 * PromotionCard Component
 * Displays promotion with unlock status
 */

'use client';

import { PromotionResponse, DiscountType } from '@/types';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';

interface PromotionCardProps {
  promotion: PromotionResponse;
}

export function PromotionCard({ promotion }: PromotionCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDiscountText = () => {
    switch (promotion.discount_type) {
      case DiscountType.PERCENTAGE:
        return `${promotion.discount_value}% off`;
      case DiscountType.FIXED_AMOUNT:
        return `£${promotion.discount_value.toFixed(2)} off`;
      case DiscountType.FREE_ITEM:
        return 'Free item';
      default:
        return 'Discount';
    }
  };

  const isExpired = promotion.expires_at && new Date(promotion.expires_at) < new Date();

  return (
    <Card
      padding="md"
      className={`${!promotion.is_unlocked || isExpired ? 'opacity-60' : ''} ${
        promotion.is_unlocked && !isExpired ? 'border-emerald-500 border-2' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            {promotion.is_unlocked && !isExpired ? (
              <Badge variant="success" size="sm">
                🎁 Unlocked
              </Badge>
            ) : (
              <Badge variant="default" size="sm">
                🔒 Locked
              </Badge>
            )}
            {isExpired && (
              <Badge variant="danger" size="sm">
                Expired
              </Badge>
            )}
            {!promotion.active && (
              <Badge variant="warning" size="sm">
                Inactive
              </Badge>
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-1">{promotion.title}</h3>

          {/* Discount Value */}
          <div className="text-2xl font-bold text-emerald-600 mb-2">{getDiscountText()}</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3">{promotion.description}</p>

      {/* Meta Info */}
      <div className="space-y-2 text-sm text-gray-500">
        {/* Venue */}
        {promotion.venue_name && (
          <div className="flex items-center">
            <svg
              className="w-4 h-4 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>{promotion.venue_name}</span>
          </div>
        )}

        {/* Distance */}
        {promotion.distance_km !== undefined && promotion.distance_km !== null && (
          <div className="flex items-center">
            <svg
              className="w-4 h-4 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <span>{promotion.distance_km.toFixed(1)} km away</span>
          </div>
        )}

        {/* Expires */}
        {promotion.expires_at && (
          <div className="flex items-center">
            <svg
              className="w-4 h-4 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className={isExpired ? 'text-red-600' : ''}>
              {isExpired ? 'Expired' : 'Expires'} {formatDate(promotion.expires_at)}
            </span>
          </div>
        )}
      </div>

      {/* Unlock Requirement */}
      {promotion.requires_checkin && !promotion.is_unlocked && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Check in at {promotion.venue_name || 'this venue'} to unlock this promotion
          </p>
        </div>
      )}
    </Card>
  );
}

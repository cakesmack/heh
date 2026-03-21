import React from 'react';

export function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 h-full flex flex-col animate-pulse">
      {/* Image Skeleton */}
      <div className="relative aspect-[16/9] bg-gray-200" />
      
      {/* Content Skeleton */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Category Badge Skeleton */}
        <div className="w-16 h-5 bg-gray-200 rounded-full mb-3" />
        
        {/* Title Skeleton */}
        <div className="space-y-2 mb-4">
          <div className="w-full h-6 bg-gray-200 rounded" />
          <div className="w-3/4 h-6 bg-gray-200 rounded" />
        </div>
        
        {/* Description Skeleton */}
        <div className="space-y-2 mb-6">
          <div className="w-full h-4 bg-gray-200 rounded" />
          <div className="w-5/6 h-4 bg-gray-200 rounded" />
        </div>
        
        {/* Meta info skeleton */}
        <div className="mt-auto space-y-3">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-200 rounded mr-2" />
            <div className="w-32 h-4 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 rounded" />
            <div className="w-24 h-4 bg-gray-200 rounded" />
          </div>
        </div>
        
        {/* Footer Skeleton */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="w-16 h-5 bg-gray-200 rounded" />
          <div className="w-20 h-4 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

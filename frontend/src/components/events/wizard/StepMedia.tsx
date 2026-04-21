/**
 * Step 3: Media
 * Image upload with encouragement UX.
 * Upload area is primary; "Skip" is secondary/outline.
 */

import React, { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useEventWizard';
import ImageUpload from '@/components/common/ImageUpload';

interface StepMediaProps {
  form: UseFormReturn<WizardFormData>;
  stepErrors: Record<string, string> | null;
}

export default function StepMedia({ form, stepErrors }: StepMediaProps) {
  const { watch, setValue } = form;
  const formData = watch();
  const [skipped, setSkipped] = useState(false);

  const hasImage = !!formData.image_url;

  const handleUploadSuccess = (urls: {
    url: string;
    thumbnail_url: string;
    medium_url: string;
    large_url: string;
  }) => {
    setValue('image_url', urls.url);
    setSkipped(false);
  };

  const handleRemoveImage = () => {
    setValue('image_url', '');
  };

  return (
    <div className="space-y-8">
      {/* ─── Hero Section ──────────────────────────────── */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 mb-4">
          <svg className="w-8 h-8 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Add a cover image</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Events with images get <span className="font-semibold text-emerald-600">3x more engagement</span>. 
          Upload a high-quality photo to help your event stand out.
        </p>
      </div>

      {/* ─── Upload Area (Primary) ─────────────────────── */}
      <div className={`transition-all duration-300 ${skipped && !hasImage ? 'opacity-40 pointer-events-none' : ''}`}>
        <ImageUpload
          folder="events"
          currentImageUrl={formData.image_url || undefined}
          onUpload={handleUploadSuccess}
          onRemove={handleRemoveImage}
        />
      </div>

      {/* ─── Image Tips ────────────────────────────────── */}
      {!hasImage && !skipped && (
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
          <p className="font-medium text-gray-700 mb-2">📐 Image tips</p>
          <ul className="space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              Landscape orientation (16:9) works best
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              Minimum 1200px wide for sharp display
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              Avoid text-heavy posters — the title shows separately
            </li>
          </ul>
        </div>
      )}

      {/* ─── Success State ─────────────────────────────── */}
      {hasImage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-800">Image uploaded successfully</p>
            <p className="text-xs text-emerald-600">Looking great! Continue to the next step.</p>
          </div>
        </div>
      )}

      {/* ─── Skip Option (Secondary) ───────────────────── */}
      {!hasImage && (
        <div className="pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setSkipped(!skipped)}
            className={`w-full py-3 px-4 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
              skipped
                ? 'bg-gray-100 text-gray-700 border-2 border-gray-300'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-2 border-dashed border-gray-200'
            }`}
          >
            {skipped ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Skipping — a category placeholder will be used
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Skip — I'll upload later
              </span>
            )}
          </button>
          {skipped && (
            <p className="text-xs text-center text-gray-400 mt-2">
              You can always add an image after publishing via the edit page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

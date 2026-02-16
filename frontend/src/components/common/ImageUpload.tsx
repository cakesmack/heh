import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { optimizeImage } from '@/utils/imageOptimizer';

interface ImageUploadProps {
  folder: 'events' | 'venues' | 'categories' | 'organizers' | 'hero';
  currentImageUrl?: string;
  onUpload: (urls: { url: string; thumbnail_url: string; medium_url: string }) => void;
  onRemove?: () => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  aspectRatio?: string;
  label?: string | null;
}

export default function ImageUpload({
  folder,
  currentImageUrl,
  onUpload,
  onRemove,
  onUploadStart,
  onUploadEnd,
  aspectRatio = '16/9',
  label = 'Featured Image'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync preview when currentImageUrl changes (e.g. loaded async)
  useEffect(() => {
    setPreview(currentImageUrl || null);
  }, [currentImageUrl]);

  // Helper to resize image
  const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const MAX_DIMENSION = 2000;
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        } else {
          // No resize needed
          resolve(file);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to 0.85 quality
        // Use original type if supported, else JPEG
        const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              });
              resolve(resizedFile);
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          },
          outputType,
          0.85
        );
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    // Validate file type
    if (!originalFile.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate original file size (check if it's ridiculously huge before even processing? 
    // Actually, we want to allow large files as input and resize them down. 
    // But maybe keep a sane upper limit like 20MB to prevent browser crash)
    if (originalFile.size > 20 * 1024 * 1024) {
      setError('Image must be less than 20MB');
      return;
    }

    setError(null);
    setUploading(true);
    onUploadStart?.();

    // Show preview immediately (using original to be fast)
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(originalFile);

    try {
      // Resize/Compress
      const processedFile = await resizeImage(originalFile);

      const urls = await api.media.upload(processedFile, folder);
      // Immediately set preview to the full medium URL from backend
      // This prevents "vanishing" while waiting for parent state to sync
      setPreview(urls.medium_url);
      onUpload(urls);
    } catch (err: any) {
      console.error('Upload Process Error:', err);
      setError(err.response?.data?.detail || err.message || 'Upload failed');
      setPreview(currentImageUrl || null);
    } finally {
      setUploading(false);
      onUploadEnd?.();
    }
  };

  const handleRemove = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemove?.();
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {preview ? (
        <div className="relative" style={{ aspectRatio }}>
          <img
            key={preview}
            src={optimizeImage(preview, 800)}
            alt="Preview"
            className="w-full h-full object-cover rounded-lg"
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <div className="text-white">Uploading...</div>
            </div>
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-400 transition-colors"
          style={{ aspectRatio }}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600">Click to upload image</p>
            <p className="text-sm text-gray-400 mt-1">PNG, JPG, WebP up to 20MB</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

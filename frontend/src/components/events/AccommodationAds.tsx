import Image from 'next/image';
import { optimizeImage } from '@/utils/imageOptimizer';

interface AccommodationAd {
  id: number;
  title: string;
  description: string | null;
  destination_url: string;
  image_url: string;
  location_id: number;
  location_name: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface AccommodationAdsProps {
  ads: AccommodationAd[];
}

export default function AccommodationAds({ ads }: AccommodationAdsProps) {
  if (!ads || ads.length === 0) return null;

  return (
    <div className="mt-12 bg-white rounded-2xl border border-gray-100 p-6 md:p-8 shadow-sm h-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Where to Stay</h2>
      <p className="text-gray-500 text-sm mb-6">
        Looking for a place to stay during the event? Check out these highly recommended local accommodations.
      </p>
      <div className="flex flex-col gap-4">
        {ads.slice(0, 3).map((ad) => (
          <a
            key={ad.id}
            href={ad.destination_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col md:flex-row rounded-xl overflow-hidden border border-gray-100 hover:border-emerald-200 transition-all hover:shadow-md group h-auto md:h-36 bg-gray-50/10"
          >
            {/* Left Column (Image) - 30% of card width */}
            <div className="relative w-full md:w-[30%] aspect-[16/9] md:aspect-auto md:h-full bg-gray-100 overflow-hidden flex-shrink-0">
              <Image
                src={optimizeImage(ad.image_url, 'card')}
                alt={ad.title}
                fill
                style={{ objectFit: 'cover' }}
                className="group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 30vw"
              />
            </div>
            
            {/* Right Column (Content) - remaining width, centered */}
            <div className="p-4 md:px-6 flex-grow flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0 flex-grow flex flex-col justify-center">
                <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors text-base line-clamp-1 mb-1">
                  {ad.title}
                </h3>
                {ad.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                    {ad.description}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center md:justify-end">
                <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors group-hover:shadow-md">
                  <span>Book Direct</span>
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

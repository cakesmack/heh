import Skeleton from '@/components/common/Skeleton';

export default function EventCardSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100 h-full flex flex-col">
            {/* Image Skeleton */}
            <div className="relative h-48 w-full">
                <Skeleton className="h-full w-full" />
            </div>

            {/* Content Skeleton */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                </div>

                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />

                <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-50">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
            </div>
        </div>
    );
}

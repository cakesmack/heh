/**
 * BottomSheet Component
 * A slide-up panel for mobile map view.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    snapPoints?: number[]; // Percentages from top (0 to 100)
    initialSnapIndex?: number;
}

export function BottomSheet({
    isOpen,
    onClose,
    title,
    children,
    snapPoints = [10, 50, 90], // 10% (full), 50% (mid), 90% (min)
    initialSnapIndex = 1
}: BottomSheetProps) {
    const [snapIndex, setSnapIndex] = useState(initialSnapIndex);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Reset snap index when opened
    useEffect(() => {
        if (isOpen) {
            setSnapIndex(initialSnapIndex);
        }
    }, [isOpen, initialSnapIndex]);

    const handleTouchStart = (e: React.TouchEvent) => {
        setStartY(e.touches[0].clientY);
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const deltaY = e.touches[0].clientY - startY;
        setCurrentY(deltaY);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);

        // Determine which snap point is closest
        const threshold = 50; // pixels
        if (Math.abs(currentY) > threshold) {
            if (currentY > 0) {
                // Dragged down
                setSnapIndex(Math.min(snapPoints.length - 1, snapIndex + 1));
            } else {
                // Dragged up
                setSnapIndex(Math.max(0, snapIndex - 1));
            }
        }

        setCurrentY(0);
    };

    if (!isOpen) return null;

    const currentSnapPoint = snapPoints[snapIndex];
    const transformY = isDragging ? `calc(${currentSnapPoint}% + ${currentY}px)` : `${currentSnapPoint}%`;

    return (
        <div className="fixed inset-0 z-50 pointer-events-none md:hidden">
            {/* Backdrop (only visible when full) */}
            <div
                className={`absolute inset-0 bg-black/20 transition-opacity duration-300 pointer-events-auto ${snapIndex === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setSnapIndex(1)}
            />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className="absolute inset-x-0 bottom-16 h-[calc(100%-64px)] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out pointer-events-auto border-t border-gray-100"
                style={{ transform: `translateY(${transformY})` }}
            >
                {/* Handle */}
                <div
                    className="w-full py-4 flex flex-col items-center cursor-grab active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-2" />
                    {title && (
                        <div className="px-6 w-full flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="h-full overflow-y-auto px-4 pb-10">
                    {children}
                </div>
            </div>
        </div>
    );
}

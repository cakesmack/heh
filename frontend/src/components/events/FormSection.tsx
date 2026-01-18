
import React from 'react';
import { Card } from '@/components/common/Card';

interface FormSectionProps {
    title: string;
    description: string;
    tipTitle: string;
    tipContent: React.ReactNode;
    children: React.ReactNode;
}

export default function FormSection({
    title,
    description,
    tipTitle,
    tipContent,
    children
}: FormSectionProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start py-6 border-b border-gray-100 last:border-0">
            {/* Left Column: Form Content */}
            <div className="lg:col-span-2 space-y-4">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
                <Card className="!bg-white !shadow-sm !border-gray-200">
                    <div className="space-y-6">
                        {children}
                    </div>
                </Card>
            </div>

            {/* Right Column: Static Help Tip */}
            <div className="lg:col-span-1 lg:sticky lg:top-24">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3 text-emerald-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h4 className="font-semibold text-sm uppercase tracking-wide">{tipTitle}</h4>
                    </div>
                    <div className="text-sm text-emerald-900 leading-relaxed space-y-2">
                        {tipContent}
                    </div>
                </div>
            </div>
        </div>
    );
}

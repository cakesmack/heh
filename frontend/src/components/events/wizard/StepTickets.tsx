import React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { WizardFormData } from '@/hooks/useEventWizard';

interface StepTicketsProps {
  form: UseFormReturn<WizardFormData>;
  stepErrors: Record<string, string> | null;
}

export default function StepTickets({ form, stepErrors }: StepTicketsProps) {
  const { control, register, watch, setValue } = form;
  const errors = stepErrors || {};

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'ticket_tiers',
  });

  const watchedTiers = watch('ticket_tiers') || [];
  const passFeesToBuyer = watch('pass_fees_to_buyer');

  // Ensure there's at least one tier if they reach this step
  React.useEffect(() => {
    if (fields.length === 0) {
      append({ name: 'General Admission', price: 0, quantity_available: 100, max_per_order: 10 });
    }
  }, [fields.length, append]);

  // Calculate dynamic helper text based on entered tier price
  const firstPaidTier = watchedTiers.find((t) => Number(t.price) > 0);
  const samplePrice = firstPaidTier ? Number(firstPaidTier.price) : 20.00;
  const estimatedFee = Number((samplePrice * 0.035 + 0.30).toFixed(2));
  const buyerPriceWithFee = Number((samplePrice + estimatedFee).toFixed(2));
  const organizerPriceAbsorbed = Math.max(0, Number((samplePrice - estimatedFee).toFixed(2)));

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Ticket Tiers</h3>
        <p className="text-sm text-gray-500 mb-5">Create the ticket types you want to sell. You can add as many as you need.</p>
        
        {errors.ticket_tiers && typeof errors.ticket_tiers === 'string' && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {errors.ticket_tiers}
          </div>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => {
            const fieldErrors = {
              name: errors[`ticket_tiers.${index}.name`],
              price: errors[`ticket_tiers.${index}.price`],
              quantity_available: errors[`ticket_tiers.${index}.quantity_available`],
              max_per_order: errors[`ticket_tiers.${index}.max_per_order`],
            };

            return (
              <div key={field.id} className="p-5 border border-gray-200 rounded-2xl bg-gray-50 relative group">
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 p-1 transition-colors"
                    title="Remove Tier"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mr-8">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tier Name *</label>
                    <input
                      type="text"
                      {...register(`ticket_tiers.${index}.name` as const)}
                      placeholder="e.g. General Admission, VIP"
                      className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        fieldErrors.name ? 'border-red-500' : 'border-gray-200'
                      }`}
                    />
                    {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Price (£) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`ticket_tiers.${index}.price` as const, { valueAsNumber: true })}
                      className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        fieldErrors.price ? 'border-red-500' : 'border-gray-200'
                      }`}
                    />
                    <p className="mt-1 text-xs text-gray-500">Set to 0 for free tickets.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity Available *</label>
                    <input
                      type="number"
                      min="1"
                      {...register(`ticket_tiers.${index}.quantity_available` as const, { valueAsNumber: true })}
                      className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        fieldErrors.quantity_available ? 'border-red-500' : 'border-gray-200'
                      }`}
                    />
                    {fieldErrors.quantity_available && <p className="mt-1 text-xs text-red-500">{fieldErrors.quantity_available}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Max per Order *</label>
                    <input
                      type="number"
                      min="1"
                      {...register(`ticket_tiers.${index}.max_per_order` as const, { valueAsNumber: true })}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => append({ name: '', price: 0, quantity_available: 50, max_per_order: 10 })}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Ticket Tier
        </button>
      </div>

      {/* ─── Per-Event Fee Pass-Through Toggle ────────────────────── */}
      <div className="p-5 border border-emerald-100 bg-emerald-50/40 rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <label htmlFor="pass_fees_toggle" className="text-sm font-bold text-gray-900 cursor-pointer">
              Pass booking fees to the buyer
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Choose whether ticket buyers pay the booking fee on top, or if platform fees are absorbed into your ticket price.
            </p>

            {/* Dynamic Real-Time Helper Text */}
            <div className="mt-3 inline-block px-3.5 py-2 bg-white rounded-lg border border-emerald-200/80 shadow-xs text-xs">
              {passFeesToBuyer ? (
                <span className="text-emerald-800 font-medium">
                  ✨ <strong>Buyer pays £{buyerPriceWithFee.toFixed(2)}</strong> (£{samplePrice.toFixed(2)} + £{estimatedFee.toFixed(2)} booking fee). You receive exactly <strong>£{samplePrice.toFixed(2)}</strong>.
                </span>
              ) : (
                <span className="text-gray-700 font-medium">
                  🏷️ <strong>Buyer pays £{samplePrice.toFixed(2)}</strong>. You receive <strong>£{organizerPriceAbsorbed.toFixed(2)}</strong> (after £{estimatedFee.toFixed(2)} platform fee).
                </span>
              )}
            </div>
          </div>

          <div className="pt-1">
            <button
              id="pass_fees_toggle"
              type="button"
              role="switch"
              aria-checked={Boolean(passFeesToBuyer)}
              onClick={() => setValue('pass_fees_to_buyer', !passFeesToBuyer, { shouldDirty: true })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                passFeesToBuyer ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  passFeesToBuyer ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

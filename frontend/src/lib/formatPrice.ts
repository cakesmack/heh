/**
 * formatPrice Utility
 * Formats event prices and ticket tier prices cleanly and consistently across the app.
 */

/**
 * Format a raw price string or number into a user-friendly display string.
 * - 0, "0", "", null, undefined, or case-insensitive "free" -> "Free"
 * - Pure numeric value without currency symbol (e.g. "10", "15.50", 12) -> "£10", "£15.50", "£12"
 * - Already formatted or custom text (e.g. "£10 - £15", "Donation", "From £10.77") -> preserved as-is
 */
export function formatPrice(price: string | number | null | undefined): string {
  if (price === null || price === undefined) {
    return 'Free';
  }

  if (typeof price === 'number') {
    if (isNaN(price) || price === 0) {
      return 'Free';
    }
    return Number.isInteger(price) ? `£${price}` : `£${price.toFixed(2)}`;
  }

  const trimmed = String(price).trim();
  if (!trimmed) {
    return 'Free';
  }

  const lower = trimmed.toLowerCase();
  if (
    lower === 'free' ||
    lower === '0' ||
    lower === '0.00' ||
    lower === '0.0' ||
    lower === '£0' ||
    lower === '£0.00'
  ) {
    return 'Free';
  }

  // Check if it is a plain numeric string (e.g. "10", "15.50", "12.5")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = parseFloat(trimmed);
    if (num === 0) return 'Free';
    return `£${trimmed}`;
  }

  // If already starts with currency symbol (£, $, €) or custom text (Donation, From £10, £5 - £10), preserve it
  return trimmed;
}

/**
 * Formats price from an Event object, inspecting price_display and price.
 */
export function formatEventPrice(
  event?: { price_display?: string | null; price?: string | number | null } | null
): string {
  if (!event) return 'Free';
  if (event.price_display && event.price_display.trim()) {
    return formatPrice(event.price_display);
  }
  if (event.price !== undefined && event.price !== null) {
    return formatPrice(event.price);
  }
  return 'Free';
}

/**
 * Calculates the buyer total price for a ticket tier including standard platform fee.
 * Platform fee standard rate: 3.5% + £0.30 per paid ticket.
 */
export function computeTierBuyerPrice(basePrice: number, passFeesToBuyer: boolean): number {
  if (!basePrice || basePrice <= 0) {
    return 0;
  }
  if (!passFeesToBuyer) {
    return Math.round(basePrice * 100) / 100;
  }
  const fee = Math.round((basePrice * 0.035 + 0.30) * 100) / 100;
  return Math.round((basePrice + fee) * 100) / 100;
}

/**
 * Derives the event display price string from configured ticket tiers.
 * - Single tier: "£X.XX" (or "Free")
 * - Multiple tiers: "From £X.XX"
 */
export function deriveEventPriceFromTiers(
  tiers: Array<{ price: number | string }> | undefined | null,
  passFeesToBuyer: boolean
): string {
  if (!tiers || tiers.length === 0) {
    return 'Free';
  }

  const buyerPrices = tiers.map((t) => computeTierBuyerPrice(Number(t.price) || 0, passFeesToBuyer));
  const minPrice = Math.min(...buyerPrices);
  const maxPrice = Math.max(...buyerPrices);

  if (minPrice === maxPrice) {
    return minPrice === 0 ? 'Free' : `£${minPrice.toFixed(2)}`;
  }

  if (minPrice === 0) {
    return 'From Free';
  }

  return `From £${minPrice.toFixed(2)}`;
}

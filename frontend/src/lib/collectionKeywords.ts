export function normaliseCollectionKeywords(value: unknown): string[] {
  const values = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return values.flatMap(value => {
    if (typeof value !== 'string') return [];
    const term = value.trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) return [];
    seen.add(key);
    return [term];
  });
}

export function readCollectionKeywords(params?: Record<string, unknown> | null): string[] {
  return normaliseCollectionKeywords(params && ('keywords' in params ? params.keywords : params.q));
}

export function withCollectionKeywords(params: Record<string, any> | null, keywords: string[]) {
  const filters = { ...params };
  delete filters.q;
  delete filters.keywords;
  const terms = normaliseCollectionKeywords(keywords);
  if (terms.length) {
    filters.keywords = terms;
    // Preserve a legacy single-term view for older collection consumers (the
    // map is outside this task). Collection matching uses the array above.
    filters.q = terms[0];
  }
  return filters;
}

// Shared by save and unsaved preview; retain the existing form conversions.
export function collectionDateAndBounds(data: Record<string, unknown>) {
  const coordinate = (value: unknown) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  };
  return {
    fixed_start_date: data.fixed_start_date ? String(data.fixed_start_date) : null,
    fixed_end_date: data.fixed_end_date ? String(data.fixed_end_date) : null,
    min_lat: coordinate(data.min_lat), max_lat: coordinate(data.max_lat),
    min_lng: coordinate(data.min_lng), max_lng: coordinate(data.max_lng),
  };
}

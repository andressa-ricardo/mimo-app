const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Lowercase, accent-insensitive text for search. */
export function searchable(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

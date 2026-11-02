const URL_PATTERN = /^https?:\/\/[^\s/.]+\.[^\s]+$/i;
const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

/** Adds https:// when missing and checks the result looks like a web link. Empty input is valid (null). */
export function normalizeUrl(text: string): { value: string | null; valid: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null, valid: true };
  const withScheme = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
  return { value: withScheme, valid: URL_PATTERN.test(withScheme) };
}

/** "https://www.booking.com/hotel/x" → "booking.com" for compact display. */
export function displayHost(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
}

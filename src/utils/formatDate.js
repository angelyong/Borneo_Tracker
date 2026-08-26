// Shared short-date formatting for the trust and momentum surfaces.
//
// Every date the UI shows comes from a pipeline artifact as a plain ISO day
// (`generatedAt`, a history point's `date`), so it is rendered in UTC: reading
// it in the viewer's timezone would shift a Malaysian publication date by a
// day for anyone west of it.

import { parseGeneratedAt } from './dataFreshness';

const DATE_LOCALE = { en: 'en-GB', ms: 'ms-MY' };
const DATE_FORMAT = { day: '2-digit', month: 'short', year: 'numeric' };

export function dateLocale(language) {
  return DATE_LOCALE[language] || DATE_LOCALE[String(language).split('-')[0]] || 'en-GB';
}

/**
 * Format an ISO day (or Date) for display, falling back to the raw ISO string
 * rather than throwing when Intl rejects the locale.
 */
export function formatShortDate(value, language) {
  const date = parseGeneratedAt(value);
  if (!date) return null;
  try {
    return date.toLocaleDateString(dateLocale(language), { ...DATE_FORMAT, timeZone: 'UTC' });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

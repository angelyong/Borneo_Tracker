import { describe, expect, it } from 'vitest';
import { dateLocale, formatShortDate } from './formatDate';

describe('dateLocale', () => {
  it('maps the app languages and falls back to en-GB', () => {
    expect(dateLocale('en')).toBe('en-GB');
    expect(dateLocale('ms')).toBe('ms-MY');
    expect(dateLocale('ms-MY')).toBe('ms-MY');
    expect(dateLocale('fr')).toBe('en-GB');
    expect(dateLocale(undefined)).toBe('en-GB');
  });
});

describe('formatShortDate', () => {
  it('formats an ISO day in UTC so a publication date cannot shift', () => {
    expect(formatShortDate('2026-08-17', 'en')).toBe('17 Aug 2026');
  });

  it('returns null for a missing or unparseable value', () => {
    expect(formatShortDate(null, 'en')).toBeNull();
    expect(formatShortDate('2026-13-45', 'en')).toBeNull();
    expect(formatShortDate('', 'en')).toBeNull();
  });
});

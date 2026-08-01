import { describe, expect, it } from 'vitest';
import {
  FRESH_MAX_DAYS,
  STALE_MAX_DAYS,
  classifyFreshness,
  parseGeneratedAt,
} from './dataFreshness';

// A fixed "today" so the thresholds are asserted deterministically.
const NOW = new Date(2026, 6, 28); // 28 Jul 2026, local time

describe('parseGeneratedAt', () => {
  it('parses a YYYY-MM-DD stamp at UTC midnight', () => {
    const date = parseGeneratedAt('2026-07-23');
    expect(date.toISOString()).toBe('2026-07-23T00:00:00.000Z');
  });

  it('returns null for missing or unparseable values', () => {
    [undefined, null, '', '   ', 'not-a-date', 42, {}, new Date('nope')].forEach((value) => {
      expect(parseGeneratedAt(value)).toBeNull();
    });
  });

  it('rejects out-of-range dates instead of silently rolling them over', () => {
    expect(parseGeneratedAt('2026-13-45')).toBeNull();
  });
});

describe('classifyFreshness', () => {
  it('reports unknown (never NaN) when the date is missing', () => {
    expect(classifyFreshness(undefined, NOW)).toEqual({ status: 'unknown', ageDays: null, date: null });
  });

  it('treats same-day and within-threshold data as fresh', () => {
    expect(classifyFreshness('2026-07-28', NOW).status).toBe('fresh');
    expect(classifyFreshness('2026-07-26', NOW)).toMatchObject({ status: 'fresh', ageDays: FRESH_MAX_DAYS });
  });

  it('flags 3–7 day old data as stale', () => {
    expect(classifyFreshness('2026-07-25', NOW)).toMatchObject({ status: 'stale', ageDays: 3 });
    expect(classifyFreshness('2026-07-21', NOW)).toMatchObject({ status: 'stale', ageDays: STALE_MAX_DAYS });
  });

  it('flags data older than a week as very stale', () => {
    expect(classifyFreshness('2026-07-20', NOW)).toMatchObject({ status: 'veryStale', ageDays: 8 });
    // districts.json in this repo — deliberately much older than the territory data.
    expect(classifyFreshness('2026-07-10', NOW)).toMatchObject({ status: 'veryStale', ageDays: 18 });
  });

  it('clamps a future build date to zero rather than a negative age', () => {
    expect(classifyFreshness('2026-08-01', NOW)).toMatchObject({ status: 'fresh', ageDays: 0 });
  });
});

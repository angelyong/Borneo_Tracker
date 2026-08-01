// Data-freshness classification for the three static JSON snapshots the
// dashboard reads (indicators.json, resilience.json, districts.json). Each file
// carries a top-level `generatedAt` date written by the daily rebuild pipeline.
// The public site is a static upload, so the copy a visitor is looking at can
// lag the repo by days or weeks — these helpers turn that date into an honest,
// user-facing staleness state instead of leaving the age invisible.
//
// Kept in a plain .js module (not inside the .jsx component) so the pure date
// logic is unit-testable and Fast Refresh keeps working for the component.

// Staleness thresholds, in whole calendar days between `generatedAt` and today.
// The pipeline runs once a day, so <= 2 days still covers a normal run plus a
// timezone/weekend slip; 3–7 days means at least one daily run was missed;
// beyond 7 days the refresh (or the upload to the static host) has stalled.
export const FRESH_MAX_DAYS = 2;
export const STALE_MAX_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Parse a `generatedAt` value into a Date pinned to UTC midnight, or null when
 * it is missing/unparseable. Never throws — a bad value must degrade to an
 * "unknown" chip, never to "NaN days" or a crash.
 */
export function parseGeneratedAt(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  const match = ISO_DATE.exec(text);
  if (match) {
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    // Reject rolled-over nonsense like "2026-13-45", which Date.UTC would
    // silently normalise into a valid but wrong date.
    const valid =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
    return valid ? date : null;
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Classify how old a snapshot is relative to `now` (the browser's current date).
 * Returns `{ status, ageDays, date }` where status is one of
 * 'fresh' | 'stale' | 'veryStale' | 'unknown'.
 */
export function classifyFreshness(generatedAt, now = new Date()) {
  const date = parseGeneratedAt(generatedAt);
  if (!date) return { status: 'unknown', ageDays: null, date: null };

  const today = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const generatedDay = Math.floor(date.getTime() / MS_PER_DAY);
  const todayDay = Math.floor(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / MS_PER_DAY
  );

  // A future date means the viewer's clock is behind the build, not that the
  // data is stale — clamp to 0 rather than reporting a negative age.
  const ageDays = Math.max(0, todayDay - generatedDay);

  let status = 'veryStale';
  if (ageDays <= FRESH_MAX_DAYS) status = 'fresh';
  else if (ageDays <= STALE_MAX_DAYS) status = 'stale';

  return { status, ageDays, date };
}

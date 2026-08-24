// BT-19 momentum maths over the BT-18 auxiliary history series.
//
// Two honesty rules drive every function here and neither is negotiable:
//
//  1. A delta may only be taken between two points that share a
//     `methodologyTag`. `resilience_history.json` records what each snapshot
//     claimed on the day it was published, so a step across a methodology
//     break (e.g. the 2026-08-03 education-loss defect and its 2026-08-17
//     correction) is an artifact of the method changing, not of Borneo
//     changing. Rendering it as "+3.9 improvement" would be a lie.
//  2. A flat series is the normal state, not a fault. Upstream macro data is
//     annual or quarterly while the pipeline republishes daily, so most days
//     are genuinely unchanged. `direction: 'flat'` carries the date the value
//     last actually moved so the UI can say so in words instead of `+0.0`.
//
// This module is pure: it never fetches, never translates and never formats.

const EPSILON = 0.05; // history indices are published to one decimal place

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPoint(point) {
  return Boolean(point) && typeof point.date === 'string' && finiteNumber(point.index);
}

/** Chronologically sorted, structurally valid points for one territory. */
export function normalizeSeries(series) {
  if (!Array.isArray(series)) return [];
  return series.filter(isValidPoint).slice().sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * The trailing run of points that share the newest methodology tag.
 *
 * Everything before the last break is retained by BT-18 for traceability but
 * is not comparable to today, so it must not feed a delta or a sparkline.
 */
export function comparableWindow(series) {
  const points = normalizeSeries(series);
  if (!points.length) return [];

  const currentTag = points[points.length - 1].methodologyTag;
  let start = points.length - 1;
  while (start > 0) {
    const candidate = points[start - 1];
    if (candidate.methodologyTag !== currentTag || points[start].isMethodologyBreak === true) break;
    start -= 1;
  }
  return points.slice(start);
}

function lastChange(points) {
  for (let index = points.length - 1; index > 0; index -= 1) {
    if (Math.abs(points[index].index - points[index - 1].index) >= EPSILON) return points[index].date;
  }
  return null;
}

/**
 * Momentum for one territory's history series.
 *
 * Returns `direction: 'unknown'` — never a fabricated zero — when there is no
 * comparable predecessor, which is the true state on the first publication
 * after a methodology change.
 */
export function computeMomentum(series) {
  const allPoints = normalizeSeries(series);
  const points = comparableWindow(allPoints);

  if (!points.length) {
    return {
      current: null,
      previous: null,
      delta: null,
      direction: 'unknown',
      points: [],
      comparableSince: null,
      lastChangeDate: null,
      hasMethodologyBreak: false,
      droppedPointCount: 0,
    };
  }

  const current = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const rawDelta = previous ? current.index - previous.index : null;
  const delta = rawDelta === null ? null : Math.round(rawDelta * 10) / 10;

  let direction = 'unknown';
  if (delta !== null) {
    if (Math.abs(rawDelta) < EPSILON) direction = 'flat';
    else direction = rawDelta > 0 ? 'up' : 'down';
  }

  return {
    current,
    previous,
    delta: direction === 'flat' ? 0 : delta,
    direction,
    points,
    comparableSince: points[0].date,
    // Null when the value has held steady for the whole comparable window;
    // the UI then falls back to `comparableSince`.
    lastChangeDate: lastChange(points),
    hasMethodologyBreak: allPoints.length > points.length,
    droppedPointCount: allPoints.length - points.length,
  };
}

function byMagnitude(left, right) {
  const size = Math.abs(right.delta) - Math.abs(left.delta);
  return size !== 0 ? size : left.territory.localeCompare(right.territory);
}

function comparableMovers(payload) {
  const territories = payload?.territories;
  if (!territories || typeof territories !== 'object') return [];

  return Object.entries(territories)
    .map(([territory, series]) => ({ territory, ...computeMomentum(series) }))
    .filter((entry) => entry.direction === 'up' || entry.direction === 'down')
    .sort(byMagnitude);
}

/**
 * The biggest movers, guaranteeing that a decline is never hidden behind
 * larger rises.
 *
 * The client asked for "the biggest positive **and** negative changes", so a
 * plain magnitude-ranked top-N is not enough: with four territories and three
 * rises, ranking by size alone drops the only decliner off the end of the list
 * and leaves a wall of green. This reserves a slot for the largest rise and the
 * largest fall before filling the remainder by size, then presents them
 * largest-first.
 *
 * Flat and non-comparable territories are excluded rather than listed as
 * zero-movers: "biggest movers" is a claim about movement, so an empty array
 * is the correct answer on a quiet day.
 */
export function biggestMovers(payload, { limit = 3 } = {}) {
  const movers = comparableMovers(payload);
  const slots = Math.max(0, limit);
  if (!slots) return [];

  const anchors = [
    movers.find((entry) => entry.direction === 'up'),
    movers.find((entry) => entry.direction === 'down'),
  ].filter(Boolean);

  const selected = [...anchors, ...movers.filter((entry) => !anchors.includes(entry))]
    .slice(0, slots)
    .sort(byMagnitude);

  return selected.map(({ territory, delta, direction, current, previous }) => ({
    territory,
    delta,
    direction,
    date: current.date,
    previousDate: previous?.date ?? null,
  }));
}

/**
 * How many territories rose, fell or held steady since their previous
 * publication.
 *
 * All-Borneo is an average of cross-territory pillar averages, not the mean of
 * the four indices, so no aggregate delta can be recovered from a per-territory
 * history. Counting the directions is the honest way to answer "which way is
 * Borneo moving?" on that scope without inventing a Borneo-wide number.
 */
export function movementSummary(payload) {
  const territories = payload?.territories;
  if (!territories || typeof territories !== 'object') return null;

  const entries = Object.values(territories).map((series) => computeMomentum(series));
  const counted = entries.filter((entry) => entry.current);
  if (!counted.length) return null;

  const count = (direction) => counted.filter((entry) => entry.direction === direction).length;
  return {
    up: count('up'),
    down: count('down'),
    flat: count('flat'),
    // A territory whose only reading follows a methodology break has no
    // comparable predecessor and must not be counted as "unchanged".
    unknown: count('unknown'),
    total: counted.length,
  };
}

/**
 * Geometry for a lightweight inline sparkline.
 *
 * A constant series is drawn as a centred horizontal line — stretching it to
 * fill the box would invent a trend out of rounding noise.
 */
export function sparklineGeometry(points, { width = 72, height = 20, padding = 2 } = {}) {
  const usable = Array.isArray(points) ? points.filter(isValidPoint) : [];
  if (!usable.length) return null;

  const values = usable.map((point) => point.index);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spanY = Math.max(0, height - padding * 2);
  const isFlat = max - min < EPSILON;

  const coordinates = usable.map((point, index) => ({
    x: usable.length === 1 ? width / 2 : (index / (usable.length - 1)) * width,
    y: isFlat ? height / 2 : padding + (1 - (point.index - min) / (max - min)) * spanY,
    date: point.date,
    index: point.index,
  }));

  return {
    min,
    max,
    isFlat,
    coordinates,
    path: coordinates
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' '),
    last: coordinates[coordinates.length - 1],
  };
}

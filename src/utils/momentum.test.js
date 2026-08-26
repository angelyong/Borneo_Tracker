import { describe, expect, it } from 'vitest';
import {
  biggestMovers,
  comparableWindow,
  computeMomentum,
  movementSummary,
  normalizeSeries,
  sparklineGeometry,
} from './momentum';

const point = (date, index, methodologyTag = 'v1.2', isMethodologyBreak = false, strict = null) => ({
  date,
  index,
  strict,
  methodologyTag,
  isMethodologyBreak,
  sourceCommit: null,
});

describe('normalizeSeries', () => {
  it('sorts chronologically and drops structurally invalid points', () => {
    const series = [
      point('2026-08-03', 67.5),
      { date: '2026-08-02', index: null },
      { index: 70 },
      point('2026-08-01', 63.7),
      null,
    ];

    expect(normalizeSeries(series).map((entry) => entry.date)).toEqual(['2026-08-01', '2026-08-03']);
  });

  it('returns an empty series for non-array input', () => {
    expect(normalizeSeries(undefined)).toEqual([]);
    expect(normalizeSeries({ date: '2026-08-01', index: 1 })).toEqual([]);
  });
});

describe('comparableWindow', () => {
  it('stops at the most recent methodology break', () => {
    const series = [
      point('2026-08-01', 72.1, 'v1.1-education-loss-defect'),
      point('2026-08-16', 72.1, 'v1.1-education-loss-defect'),
      point('2026-08-17', 67.6, 'v1.2-canonical-fixed', true),
      point('2026-08-18', 67.9, 'v1.2-canonical-fixed'),
    ];

    expect(comparableWindow(series).map((entry) => entry.date)).toEqual(['2026-08-17', '2026-08-18']);
  });

  it('keeps the whole series when no break was ever recorded', () => {
    const series = [point('2026-08-17', 67.6), point('2026-08-18', 67.9)];
    expect(comparableWindow(series)).toHaveLength(2);
  });

  it('returns only the break point itself when it is the newest publication', () => {
    const series = [
      point('2026-08-16', 72.1, 'v1.1-education-loss-defect'),
      point('2026-08-17', 67.6, 'v1.2-canonical-fixed', true),
    ];

    expect(comparableWindow(series).map((entry) => entry.date)).toEqual(['2026-08-17']);
  });
});

describe('computeMomentum', () => {
  it('never compares across a methodology break', () => {
    const momentum = computeMomentum([
      point('2026-08-16', 72.1, 'v1.1-education-loss-defect'),
      point('2026-08-17', 67.6, 'v1.2-canonical-fixed', true),
    ]);

    // -4.5 across the break would read as a collapse in resilience; it is a
    // correction of a data-loss defect, so there is no comparable delta at all.
    expect(momentum.delta).toBeNull();
    expect(momentum.direction).toBe('unknown');
    expect(momentum.hasMethodologyBreak).toBe(true);
    expect(momentum.droppedPointCount).toBe(1);
    expect(momentum.comparableSince).toBe('2026-08-17');
  });

  it('reports a flat run with the date the value last moved', () => {
    const momentum = computeMomentum([
      point('2026-08-17', 67.4),
      point('2026-08-18', 67.6),
      point('2026-08-19', 67.6),
      point('2026-08-20', 67.6),
    ]);

    expect(momentum.direction).toBe('flat');
    expect(momentum.delta).toBe(0);
    expect(momentum.lastChangeDate).toBe('2026-08-18');
  });

  it('leaves lastChangeDate null when the whole window never moved', () => {
    const momentum = computeMomentum([point('2026-08-19', 67.6), point('2026-08-20', 67.6)]);

    expect(momentum.direction).toBe('flat');
    expect(momentum.lastChangeDate).toBeNull();
    expect(momentum.comparableSince).toBe('2026-08-19');
  });

  it('rounds a real move to one decimal place and keeps its sign', () => {
    const up = computeMomentum([point('2026-08-19', 67.6), point('2026-08-20', 68.04)]);
    expect(up.direction).toBe('up');
    expect(up.delta).toBe(0.4);

    const down = computeMomentum([point('2026-08-19', 67.6), point('2026-08-20', 66.9)]);
    expect(down.direction).toBe('down');
    expect(down.delta).toBe(-0.7);
  });

  it('treats sub-0.05 drift as flat rather than a movement', () => {
    const momentum = computeMomentum([point('2026-08-19', 67.6), point('2026-08-20', 67.63)]);
    expect(momentum.direction).toBe('flat');
    expect(Object.is(momentum.delta, 0)).toBe(true);
  });

  it('returns an honest unknown state for an empty or missing series', () => {
    expect(computeMomentum([]).direction).toBe('unknown');
    expect(computeMomentum(undefined).current).toBeNull();
    expect(computeMomentum(undefined).points).toEqual([]);
  });

  it('exposes a single point without inventing a predecessor', () => {
    const momentum = computeMomentum([point('2026-08-20', 67.6)]);

    expect(momentum.current.index).toBe(67.6);
    expect(momentum.previous).toBeNull();
    expect(momentum.delta).toBeNull();
    expect(momentum.direction).toBe('unknown');
  });
});

describe('biggestMovers', () => {
  const payload = {
    territories: {
      Sabah: [point('2026-08-19', 67.6), point('2026-08-20', 67.6)],
      Sarawak: [point('2026-08-19', 73.6), point('2026-08-20', 74.9)],
      Brunei: [point('2026-08-19', 78.0), point('2026-08-20', 77.2)],
      Kalimantan: [point('2026-08-20', 67.7, 'v1.2-canonical-fixed', true)],
    },
  };

  it('ranks by absolute movement and excludes flat and non-comparable territories', () => {
    expect(biggestMovers(payload)).toEqual([
      { territory: 'Sarawak', delta: 1.3, direction: 'up', date: '2026-08-20', previousDate: '2026-08-19' },
      { territory: 'Brunei', delta: -0.8, direction: 'down', date: '2026-08-20', previousDate: '2026-08-19' },
    ]);
  });

  it('honours the limit and returns nothing on a quiet day', () => {
    expect(biggestMovers(payload, { limit: 1 })).toHaveLength(1);
    expect(biggestMovers({ territories: { Sabah: payload.territories.Sabah } })).toEqual([]);
    expect(biggestMovers(null)).toEqual([]);
    expect(biggestMovers(payload, { limit: 0 })).toEqual([]);
  });

  // The client asked for "the biggest positive AND negative changes". Ranking
  // by magnitude alone drops the sole decliner off the end of a three-slot list
  // and shows the reader a wall of green.
  it('keeps the only decline visible when larger rises would crowd it out', () => {
    const fourMovers = {
      territories: {
        Sabah: [point('2026-08-19', 65.1), point('2026-08-20', 67.6)],
        Sarawak: [point('2026-08-19', 71.8), point('2026-08-20', 73.6)],
        Brunei: [point('2026-08-19', 76.8), point('2026-08-20', 78.0)],
        Kalimantan: [point('2026-08-19', 68.1), point('2026-08-20', 67.7)],
      },
    };

    const result = biggestMovers(fourMovers);

    expect(result).toHaveLength(3);
    expect(result.map((entry) => entry.territory)).toEqual(['Sabah', 'Sarawak', 'Kalimantan']);
    // The smallest rise yields its slot, not the decline.
    expect(result.map((entry) => entry.territory)).not.toContain('Brunei');
    expect(result.some((entry) => entry.direction === 'down')).toBe(true);
    expect(result.map((entry) => entry.delta)).toEqual([2.5, 1.8, -0.4]);
  });

  it('reserves a slot for the largest rise when declines dominate', () => {
    const declines = {
      territories: {
        Sabah: [point('2026-08-19', 70), point('2026-08-20', 66)],
        Sarawak: [point('2026-08-19', 74), point('2026-08-20', 71)],
        Brunei: [point('2026-08-19', 78), point('2026-08-20', 76)],
        Kalimantan: [point('2026-08-19', 67.4), point('2026-08-20', 67.9)],
      },
    };

    const result = declines && biggestMovers(declines);

    expect(result.some((entry) => entry.direction === 'up')).toBe(true);
    expect(result.map((entry) => entry.territory)).toEqual(['Sabah', 'Sarawak', 'Kalimantan']);
  });

  it('still sorts the selected movers largest-first for display', () => {
    const result = biggestMovers({
      territories: {
        Sabah: [point('2026-08-19', 70), point('2026-08-20', 70.6)],
        Sarawak: [point('2026-08-19', 74), point('2026-08-20', 71)],
      },
    });

    expect(result.map((entry) => entry.delta)).toEqual([-3, 0.6]);
  });
});

describe('movementSummary', () => {
  it('counts directions instead of inventing a Borneo-wide delta', () => {
    expect(
      movementSummary({
        territories: {
          Sabah: [point('2026-08-19', 65.1), point('2026-08-20', 67.6)],
          Sarawak: [point('2026-08-19', 73.6), point('2026-08-20', 73.6)],
          Brunei: [point('2026-08-19', 78.4), point('2026-08-20', 78.0)],
          Kalimantan: [point('2026-08-20', 67.7, 'v1.2-canonical-fixed', true)],
        },
      })
    ).toEqual({ up: 1, down: 1, flat: 1, unknown: 1, total: 4 });
  });

  it('does not count a territory that has no reading at all', () => {
    expect(movementSummary({ territories: { Sabah: [], Sarawak: [point('2026-08-20', 70)] } })).toEqual({
      up: 0,
      down: 0,
      flat: 0,
      unknown: 1,
      total: 1,
    });
  });

  it('returns null when there is no history to summarise', () => {
    expect(movementSummary(null)).toBeNull();
    expect(movementSummary({ territories: {} })).toBeNull();
    expect(movementSummary({ territories: { Sabah: [] } })).toBeNull();
  });
});

describe('sparklineGeometry', () => {
  it('draws a constant series as a centred flat line', () => {
    const geometry = sparklineGeometry([point('2026-08-19', 67.6), point('2026-08-20', 67.6)], {
      width: 100,
      height: 20,
    });

    expect(geometry.isFlat).toBe(true);
    expect(geometry.coordinates.map((entry) => entry.y)).toEqual([10, 10]);
    expect(geometry.path).toBe('M0.00 10.00 L100.00 10.00');
  });

  it('maps the highest value to the top of the padded box', () => {
    const geometry = sparklineGeometry(
      [point('2026-08-19', 60), point('2026-08-20', 70)],
      { width: 100, height: 20, padding: 2 }
    );

    expect(geometry.min).toBe(60);
    expect(geometry.max).toBe(70);
    expect(geometry.coordinates[0].y).toBe(18);
    expect(geometry.coordinates[1].y).toBe(2);
    expect(geometry.last.index).toBe(70);
  });

  it('centres a single point and refuses to draw an empty series', () => {
    expect(sparklineGeometry([point('2026-08-20', 67.6)], { width: 80 }).coordinates[0].x).toBe(40);
    expect(sparklineGeometry([])).toBeNull();
    expect(sparklineGeometry(null)).toBeNull();
  });
});

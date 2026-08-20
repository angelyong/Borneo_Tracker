import { describe, expect, it } from 'vitest';

import { getLayerRows, layerColorScale } from './useIndicators';

describe('map layer score rows', () => {
  const resilience = {
    generatedAt: '2026-08-17',
    territories: {
      Sabah: {
        index: 72.1,
        pillarScores: {
          Food: 28.6,
          Energy: 98.5,
        },
      },
      Sarawak: {
        index: 79.3,
        pillarScores: {
          Food: 58,
          Energy: 98.1,
        },
      },
      Brunei: {
        index: 78,
        pillarScores: {
          Food: 7.9,
          Energy: 100,
          Education: 90.2,
        },
      },
      Kalimantan: {
        index: 67.7,
        pillarScores: {
          Food: 77.9,
          Energy: 99.3,
          Education: 51.3,
        },
      },
    },
  };

  it('builds the 7 score-based layer rows from resilience.json', () => {
    const rows = getLayerRows([], 'resilience', resilience);

    expect(rows).toHaveLength(4);
    expect(rows.map((entry) => entry.territory)).toEqual(['Sabah', 'Sarawak', 'Brunei', 'Kalimantan']);
    expect(rows[0].row).toMatchObject({
      indicator: 'Resilience',
      value: 72.1,
      unit: '/100',
      source: 'resilience.json',
      year: '2026-08-17',
    });
  });

  it('keeps unscored pillar territories as explicit no-data rows', () => {
    const rows = getLayerRows([], 'education', resilience);

    expect(rows.find((entry) => entry.territory === 'Sabah').row).toBeNull();
    expect(rows.find((entry) => entry.territory === 'Sarawak').row).toBeNull();
    expect(rows.find((entry) => entry.territory === 'Brunei').row.value).toBe(90.2);
  });
});

describe('map layer color scales', () => {
  it('uses absolute 0-100 thresholds for score layers', () => {
    const colorForScore = layerColorScale([], 'resilience');

    expect(colorForScore(70)).toBe('#16a34a');
    expect(colorForScore(40)).toBe('#f59e0b');
    expect(colorForScore(39.9)).toBe('#dc2626');
    expect(colorForScore(null)).toBe('#cbd5e1');
  });

  it('keeps existing indicator layers on their relative min/max scale', () => {
    const colorForForest = layerColorScale(
      [
        { territory: 'Sabah', row: { value: 10 } },
        { territory: 'Sarawak', row: { value: 20 } },
        { territory: 'Brunei', row: { value: 30 } },
      ],
      'forestCover'
    );

    expect(colorForForest(30)).toBe('#16a34a');
    expect(colorForForest(20)).toBe('#f59e0b');
    expect(colorForForest(10)).toBe('#dc2626');
  });
});

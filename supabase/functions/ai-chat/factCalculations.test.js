import { describe, expect, it } from 'vitest';
import {
  calculateCompatibleDifference,
  calculateTargetGap,
  findMaximumPillar,
  findMinimumPillar,
  formatFactNumber,
  roundOne,
} from './factCalculations.ts';

describe('fact calculations', () => {
  const scores = [
    { pillar: 'Food', score: 28.7 },
    { pillar: 'Energy', score: 75.2 },
    { pillar: 'Education', score: 45.0 },
  ];

  it('finds the deterministic minimum pillar', () => {
    expect(findMinimumPillar(scores)).toEqual({ pillar: 'Food', value: 28.7, ties: ['Food'] });
  });

  it('finds the deterministic maximum pillar', () => {
    expect(findMaximumPillar(scores)).toEqual({ pillar: 'Energy', value: 75.2, ties: ['Energy'] });
  });

  it('reports ties in alphabetical order', () => {
    expect(findMinimumPillar([
      { pillar: 'Shelter', score: 50 },
      { pillar: 'Education', score: 50 },
      { pillar: 'Food', score: 60 },
    ])).toEqual({ pillar: 'Education', value: 50, ties: ['Education', 'Shelter'] });
  });

  it('calculates compatible value differences', () => {
    const result = calculateCompatibleDifference(
      { value: 98.0, formattedValue: '98.0%', unit: '%', indicator: 'Internet use', status: 'direct' },
      { value: 76.1, formattedValue: '76.1%', unit: '%', indicator: 'Internet use', status: 'direct' }
    );

    expect(result).toMatchObject({ ok: true, value: 21.9, formattedValue: '21.9%' });
  });

  it('rejects incompatible units', () => {
    const result = calculateCompatibleDifference(
      { value: 10, formattedValue: '10', unit: 'count', indicator: 'A', status: 'direct' },
      { value: 10, formattedValue: '10%', unit: '%', indicator: 'A', status: 'direct' }
    );

    expect(result).toMatchObject({ ok: false });
  });

  it('rounds without floating-point display noise', () => {
    expect(roundOne(0.1 + 0.2)).toBe(0.3);
    expect(formatFactNumber(94.2, '%')).toBe('94.2%');
  });

  it('calculates target gaps', () => {
    const result = calculateTargetGap(
      { value: 80.5, formattedValue: '80.5%', unit: '%', indicator: 'Clean water access', status: 'direct' },
      { value: 100, formattedValue: '100%', unit: '%', indicator: 'Clean water access', status: 'calculated' }
    );

    expect(result).toMatchObject({ ok: true, value: 19.5, formattedValue: '19.5%' });
  });
});


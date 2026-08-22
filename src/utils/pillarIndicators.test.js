import { describe, expect, it } from 'vitest';
import { resolvePillarIndicators } from './pillarIndicators';

// BT-26 (Card 9d): the drill-down's pillar→indicator resolver reads
// resilience.json's `detail`, which compute_resilience.py already groups by
// `hexagon_pillar` (the True Wealth Hexagon) — not `esg_pillar`
// (Environment/Social/Governance), a different classification used
// elsewhere in the app. This resolver does no filtering of its own; these
// tests exist to lock in that its lookup key is genuinely the hexagon
// pillar name, and that an unscored pillar returns an empty array rather
// than throwing or inventing a row.
describe('resolvePillarIndicators', () => {
  const detail = {
    Food: [{ indicator: 'Paddy production per capita', value: 28.6, score: 28.6 }],
    Energy: [{ indicator: 'Electricity access', value: 99.3, score: 98.6 }],
    // Education deliberately absent — an unscored pillar has no key at all,
    // matching compute_resilience.py's compute(): a pillar is only added to
    // `detail` once it has at least one scored indicator.
  };

  it('returns the rows for a scored hexagon pillar', () => {
    expect(resolvePillarIndicators(detail, 'Food')).toEqual(detail.Food);
    expect(resolvePillarIndicators(detail, 'Energy')).toEqual(detail.Energy);
  });

  it('is keyed by hexagon_pillar names (Food/Energy/Education/...), not esg_pillar names (Environment/Social/Governance)', () => {
    expect(resolvePillarIndicators(detail, 'Environment')).toEqual([]);
    expect(resolvePillarIndicators(detail, 'Social')).toEqual([]);
    expect(resolvePillarIndicators(detail, 'Governance')).toEqual([]);
  });

  it('returns an empty array — never throws, never invents a row — for an unscored pillar', () => {
    expect(resolvePillarIndicators(detail, 'Education')).toEqual([]);
  });

  it('handles missing detail or pillar gracefully', () => {
    expect(resolvePillarIndicators(null, 'Food')).toEqual([]);
    expect(resolvePillarIndicators(detail, null)).toEqual([]);
    expect(resolvePillarIndicators(undefined, undefined)).toEqual([]);
  });

  it('does not treat a non-array value under the pillar key as indicator rows', () => {
    expect(resolvePillarIndicators({ Food: 'not-an-array' }, 'Food')).toEqual([]);
  });
});

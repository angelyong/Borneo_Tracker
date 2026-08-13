import { describe, expect, it } from 'vitest';
import {
  CONCEPT_RULE_REGISTRY,
  evaluateComparability,
} from './comparabilityGate.ts';
import { resolveAiChatEntities } from './entityResolver.ts';

const rows = [
  row('Brunei', 'Forest cover', 'forest_cover', 2023, '% land'),
  row('Sabah', 'Forest extent (2000)', 'forest_cover', 2000, 'ha'),
  row('Sabah', 'GDP (real)', 'economy', 2024, 'RM mil'),
  row('Brunei', 'GDP growth', 'economy', 2025, '%'),
  row('Sabah', 'Control of Corruption (WGI)', 'governance', 2024, 'score/100', { data_level: 'national' }),
  row('Sarawak', 'Control of Corruption (WGI)', 'governance', 2024, 'score/100', { data_level: 'national' }),
  row('Brunei', 'Basic sanitation access', 'shelter', 2024, '%'),
  row('Sabah', 'Households', 'shelter', 2020, 'households'),
  row('Brunei', 'Adult literacy', 'education', 2011, '%'),
  row('Sabah', 'Mean years schooling (RLS)', 'education', 2023, 'years'),
  row('Sabah', 'Fire alerts (VIIRS, annual)', 'fire_hotspots', 2025, 'count'),
  row('Kalimantan', 'Fire alerts (VIIRS, annual)', 'fire_hotspots', 2025, 'count', { source: 'Global Forest Watch (sum of 5/5 provinces)' }),
  row('Sabah', 'Protected land', 'protected_areas', 2024, '% land'),
  row('Sarawak', 'National parks (count)', 'protected_areas', 2024, 'count'),
  row('Sabah', 'Internet use', 'internet_use', 2024, '%', { denominator: '15+' }),
  row('Kalimantan', 'Internet use', 'internet_use', 2024, '%', {
    denominator: '5+',
    is_derived: 1,
    source: 'BPS, derived regional aggregate',
  }),
  row('Sabah', 'Poverty rate (absolute)', 'poverty', 2016, '%'),
  row('Sabah', 'Poverty rate (absolute)', 'poverty', 2024, '%'),
  row('Sabah', 'Life expectancy', 'healthcare', 2024, 'years'),
  row('Sarawak', 'Life expectancy', 'healthcare', 2024, 'years'),
  row('Sabah', 'Tree cover loss (cumulative)', 'deforestation', '2001-2023', 'ha'),
];

const series = {
  Sabah: {
    healthcare: { indicator: 'Life expectancy', points: [{ year: '2022', value: 75 }, { year: '2024', value: 76 }] },
    poverty: { indicator: 'Poverty rate (absolute)', points: [{ year: '2016', value: 2.9 }, { year: '2024', value: 17.7 }] },
    deforestation: { indicator: 'Tree cover loss (annual)', points: [{ year: '2022', value: 1 }, { year: '2024', value: 2 }] },
  },
};

const districts = {
  generatedAt: '2026-07-10',
  rows: [
    { territory: 'Kuching', parent: 'Sarawak', dashboard_concept: 'economy', year: '2020' },
    { territory: 'Kota Kinabalu', parent: 'Sabah', dashboard_concept: 'economy', year: '2020' },
    { territory: 'Kota Belud', parent: 'Sabah', dashboard_concept: 'economy', year: '2020' },
  ],
};

function row(territory, indicator, concept, year, unit, extra = {}) {
  return {
    territory,
    indicator,
    dashboard_concept: concept,
    year,
    unit,
    canonical: 1,
    confidence: 'high',
    source: 'fixture',
    ...extra,
  };
}

function gate(overrides) {
  return evaluateComparability({
    metadata: { rows, series, districts },
    freshness: { now: '2026-08-02', staleAfterDays: 14 },
    ...overrides,
  });
}

describe('comparability rule registry', () => {
  it('covers the repository concepts used by Stage 3C', () => {
    expect(Object.keys(CONCEPT_RULE_REGISTRY).sort()).toEqual([
      'air_quality',
      'clean_water_access',
      'deforestation',
      'economy',
      'education',
      'energy',
      'entertainment',
      'fire_hotspots',
      'food',
      'food_percapita',
      'forest_cover',
      'governance',
      'healthcare',
      'heritage',
      'internet_use',
      'poverty',
      'protected_areas',
      'resilience',
      'shelter',
      'unemployment_rate',
    ]);
  });
});

describe('comparability rejects unsafe comparisons', () => {
  it.each([
    ['forest_cover', ['Brunei', 'Sabah']],
    ['economy', ['Sabah', 'Brunei']],
    ['governance', ['Sabah', 'Sarawak']],
    ['shelter', ['Brunei', 'Sabah']],
    ['education', ['Brunei', 'Sabah']],
  ])('rejects %s across %s', (concept, territories) => {
    const result = gate({ concepts: [concept], territories, operations: ['compare'] });
    expect(result.decision).toBe('REJECT');
    expect(result.blockedOperations).toContain('compare');
  });
});

describe('comparability allows warnings where caveats preserve meaning', () => {
  it('allows fire hotspots with area-normalized basis', () => {
    const result = gate({
      concepts: ['fire_hotspots'],
      territories: ['Sabah', 'Kalimantan'],
      operations: ['compare'],
      options: { normalizedComparisonBasis: 'area' },
    });
    expect(result.decision).toBe('ALLOW_WITH_WARNING');
    expect(result.allowedOperations).toContain('compare');
    expect(result.requiredDisclosures.join(' ')).toMatch(/area-normalized/i);
  });

  it('allows Kalimantan derived aggregation with disclosure', () => {
    const result = gate({
      concepts: ['internet_use'],
      territories: ['Sabah', 'Kalimantan'],
      operations: ['compare'],
    });
    expect(result.decision).toBe('ALLOW_WITH_WARNING');
    expect(result.requiredDisclosures.join(' ')).toMatch(/derived regional aggregate/i);
  });

  it('allows internet use with denominator disclosure when no ranking is made', () => {
    const result = gate({
      concepts: ['internet_use'],
      territories: ['Sabah', 'Kalimantan'],
      operations: ['compare'],
    });
    expect(result.decision).toBe('ALLOW_WITH_WARNING');
    expect(result.requiredDisclosures.join(' ')).toMatch(/denominators differ/i);
    expect(result.blockedOperations).not.toContain('rank');
  });
});

describe('downgrades operations that still permit descriptive answers', () => {
  it('downgrades SDG progress to mapping coverage', () => {
    const result = gate({ concepts: ['education'], territories: ['Sabah'], operations: ['sdg_progress'] });
    expect(result.decision).toBe('DOWNGRADE');
    expect(result.allowedOperations).toContain('describe');
    expect(result.requiredDisclosures.join(' ')).toMatch(/progress-to-target cannot be calculated/i);
  });

  it('downgrades unsupported ranking where descriptive answer remains possible', () => {
    const result = gate({ concepts: ['governance'], territories: ['Sabah', 'Sarawak'], operations: ['rank'] });
    expect(result.decision).toBe('DOWNGRADE');
    expect(result.blockedOperations).toContain('rank');
    expect(result.allowedOperations).toContain('describe');
  });
});

describe('clarification cases', () => {
  it('requires clarification for ambiguous district text', () => {
    const result = gate({ districts: ['Kota'], operations: ['district_answer'] });
    expect(result.decision).toBe('NEEDS_CLARIFICATION');
  });

  it('requires clarification when multiple possible indicators remain under one concept', () => {
    const result = gate({
      concepts: ['shelter'],
      territories: ['Brunei'],
      operations: ['compare'],
      metadata: {
        rows: [
          row('Brunei', 'Basic sanitation access', 'shelter', 2024, '%'),
          row('Brunei', 'Households', 'shelter', 2021, 'households'),
        ],
        series,
        districts,
      },
    });
    expect(result.decision).toBe('NEEDS_CLARIFICATION');
  });

  it('requires clarification for missing comparison basis when count and percentage both exist', () => {
    const result = gate({ concepts: ['protected_areas'], territories: ['Sabah', 'Sarawak'], operations: ['compare'] });
    expect(result.decision).toBe('NEEDS_CLARIFICATION');
  });
});

describe('trend rules', () => {
  it('allows a concept with a valid series', () => {
    const result = gate({ concepts: ['healthcare'], territories: ['Sabah'], operations: ['trend'] });
    expect(result.decision).toBe('ALLOW');
    expect(result.allowedOperations).toContain('trend');
  });

  it('rejects a concept without series', () => {
    const result = gate({ concepts: ['internet_use'], territories: ['Sabah'], operations: ['trend'] });
    expect(result.decision).toBe('REJECT');
  });

  it('rejects poverty trends crossing the 2019 break', () => {
    const result = gate({ concepts: ['poverty'], territories: ['Sabah'], years: [2016, 2024], operations: ['trend'] });
    expect(result.decision).toBe('REJECT');
    expect(result.reasons.join(' ')).toMatch(/2019/);
  });

  it('warns when headline measure differs from series measure', () => {
    const result = gate({ concepts: ['deforestation'], territories: ['Sabah'], operations: ['trend'] });
    expect(result.decision).toBe('ALLOW_WITH_WARNING');
    expect(result.warnings.join(' ')).toMatch(/headline values and time-series values/i);
  });
});

describe('year compatibility', () => {
  it('allows same-year comparison', () => {
    const result = gate({ concepts: ['healthcare'], territories: ['Sabah', 'Sarawak'], years: [2024, 2024], operations: ['compare'] });
    expect(result.decision).toBe('ALLOW');
  });

  it('rejects materially different years', () => {
    const result = gate({ concepts: ['healthcare'], territories: ['Sabah', 'Sarawak'], years: [2011, 2024], operations: ['compare'] });
    expect(result.decision).toBe('REJECT');
    expect(result.blockedOperations).toContain('year_alignment');
  });

  it('allows explicit historical comparison with a warning', () => {
    const result = gate({
      concepts: ['healthcare'],
      territories: ['Sabah', 'Sarawak'],
      years: [2011, 2024],
      operations: ['compare'],
      options: { explicitHistoricalComparison: true },
    });
    expect(result.decision).toBe('ALLOW_WITH_WARNING');
  });
});

describe('district rules', () => {
  it('allows an exact district with freshness disclosure', () => {
    const result = gate({ districts: ['Kuching'], operations: ['district_answer'] });
    expect(result.decision).toBe('ALLOW_WITH_WARNING');
    expect(result.allowedOperations).toContain('district_answer');
    expect(result.requiredDisclosures.join(' ')).toMatch(/2026-07-10/);
  });

  it('adds a stale data warning', () => {
    const result = gate({ districts: ['Kuching'], operations: ['district_answer'] });
    expect(result.warnings.join(' ')).toMatch(/stale/i);
  });

  it('rejects unknown districts without guessing', () => {
    const result = gate({ districts: ['Atlantis'], operations: ['district_answer'] });
    expect(result.decision).toBe('REJECT');
  });

  it('requires clarification for ambiguous districts', () => {
    const result = gate({ districts: ['Kota'], operations: ['district_answer'] });
    expect(result.decision).toBe('NEEDS_CLARIFICATION');
  });
});

describe('edge cases and bilingual routing hints', () => {
  it('allows a descriptive request with no comparison operation', () => {
    const result = gate({ concepts: ['healthcare'], territories: ['Sabah'], operations: ['describe'] });
    expect(result.decision).toBe('ALLOW');
  });

  it('needs clarification for empty entity and concept results on a data operation', () => {
    const result = gate({ operations: ['compare'] });
    expect(result.decision).toBe('NEEDS_CLARIFICATION');
  });

  it('needs clarification for multiple concepts', () => {
    const result = gate({ concepts: ['healthcare', 'education'], territories: ['Sabah'], operations: ['compare'] });
    expect(result.decision).toBe('NEEDS_CLARIFICATION');
  });

  it('uses Stage 3B entities for Malay comparison wording', () => {
    const entities = resolveAiChatEntities('Bandingkan litupan hutan Brunei dengan Sabah', {
      language: 'ms',
      region: '',
    });
    const result = gate({ entities });
    expect(entities.operations.comparison).toBe(true);
    expect(entities.concepts).toContain('forest_cover');
    expect(result.decision).toBe('REJECT');
  });

  it('uses Stage 3B entities for mixed English and Malay wording', () => {
    const entities = resolveAiChatEntities('Rank internet tertinggi Sabah vs Kalimantan', {
      language: 'ms',
      region: '',
    });
    const result = gate({ entities });
    expect(entities.operations.comparison).toBe(true);
    expect(entities.operations.ranking).toBe(true);
    expect(entities.concepts).toContain('internet_use');
    expect(result.decision).toBe('DOWNGRADE');
  });
});

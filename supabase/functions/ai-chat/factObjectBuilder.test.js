import { describe, expect, it } from 'vitest';
import indicatorsData from '../../../public/data/indicators.json';
import resilienceData from '../../../public/data/resilience.json';
import districtsData from '../../../public/data/districts.json';
import { evaluateComparability } from './comparabilityGate.ts';
import { resolveAiChatEntities } from './entityResolver.ts';
import { FactDataRepository } from './factDataRepository.ts';
import { buildAIChatFactObject } from './factObjectBuilder.ts';
import { routeAiChatIntent } from './intentRouter.ts';

function buildFact(message, options = {}) {
  const routed = routeAiChatIntent(message, { currentPage: '/dashboard', region: options.region || '', language: options.language || 'en' });
  const route = { ...routed, intent: 'DASHBOARD_DATA' };
  const entities = resolveAiChatEntities(message, { region: options.region || '', language: options.language || 'en' });
  const comparability = evaluateComparability({
    intent: route,
    entities,
    metadata: {
      rows: indicatorsData.rows,
      series: indicatorsData.series,
      districts: districtsData,
    },
    freshness: {
      districtsGeneratedAt: districtsData.generatedAt,
    },
    options: options.comparabilityOptions,
  });
  return buildAIChatFactObject({ intent: route, entities, comparability }, {
    repository: options.repository,
  });
}

function territoryScore(territory) {
  return resilienceData.territories[territory].index;
}

function formattedScore(territory) {
  const score = territoryScore(territory);
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function pillarExtremum(territory, mode) {
  const entries = Object.entries(resilienceData.territories[territory].pillarScores)
    .sort(([left], [right]) => left.localeCompare(right));
  const value = mode === 'minimum'
    ? Math.min(...entries.map(([, score]) => score))
    : Math.max(...entries.map(([, score]) => score));
  return entries.find(([, score]) => score === value)?.[0];
}

function comparisonDifference(left, right) {
  return Number((territoryScore(left) - territoryScore(right)).toFixed(1));
}

function expectedSdgAvailability(fact) {
  const requestedConcepts = fact.concepts.filter((concept) => concept !== 'resilience');
  const hasCommittedCoverage = indicatorsData.rows.some((row) =>
    fact.territories.includes(row.territory) &&
    requestedConcepts.includes(row.dashboard_concept) &&
    (row.canonical === 1 || row.canonical === '1' || row.canonical === true) &&
    row.sdg_goal
  );
  return hasCommittedCoverage ? 'PARTIAL' : 'UNAVAILABLE';
}

describe('fact data repository', () => {
  it('finds supported territories from committed data', () => {
    const repository = new FactDataRepository();
    expect(repository.getSupportedTerritories()).toEqual(['Brunei', 'Kalimantan', 'Sabah', 'Sarawak']);
  });

  it('distinguishes an unavailable territory', () => {
    const repository = new FactDataRepository();
    expect(repository.getTerritoryResilience('Borneo-wide')).toMatchObject({ status: 'missing' });
  });

  it('distinguishes a malformed resilience record', () => {
    const repository = new FactDataRepository({
      resilience: { territories: { Sabah: { index: 'bad', pillarScores: {} } } },
      indicators: { rows: [] },
      districts: { rows: [] },
    });

    expect(repository.getTerritoryResilience('Sabah')).toMatchObject({ status: 'malformed' });
  });

  it('returns stable canonical rows for an SDG goal only', () => {
    const repository = new FactDataRepository();
    const result = repository.getCanonicalIndicatorsForSdg('SDG15');
    expect(result.status).toBe('found');
    expect(result.status === 'found' ? result.value.map((row) => row.indicator) : []).toEqual([
      'Forest cover',
      'Forest extent (2000)',
      'Forest extent (2000)',
      'Forest extent (2000)',
      'National parks (count)',
      'National parks (count)',
      'National parks (count)',
      'National parks (count)',
    ]);
    expect(result.status === 'found' ? result.value : []).not.toContainEqual(expect.objectContaining({
      territory: 'Brunei',
      indicator: 'Forest extent (2000)',
    }));
  });

  it('supports injected zero-row SDG mappings deterministically', () => {
    const repository = new FactDataRepository({
      indicators: { rows: [] },
      resilience: { territories: {} },
      districts: { rows: [] },
    });
    expect(repository.getCanonicalIndicatorsForSdg('SDG15')).toMatchObject({
      status: 'missing',
      reason: 'No canonical indicators are mapped to SDG15.',
    });
  });
});

describe('fact object builder availability', () => {
  it('builds an available Sabah territory resilience score', () => {
    const fact = buildFact("What is Sabah's resilience score?");
    const expectedScore = territoryScore('Sabah');
    expect(fact.availability).toBe('AVAILABLE');
    expect(fact.values.overallResilience).toMatchObject({
      value: expectedScore,
      formattedValue: formattedScore('Sabah'),
      status: 'calculated',
      territory: 'Sabah',
    });
    expect(fact.approvedNumericTokens).toContain(formattedScore('Sabah'));
  });

  it('marks Borneo-wide numerical resilience unavailable when no committed aggregate exists', () => {
    const fact = buildFact('What is the Borneo-wide resilience score?');
    expect(fact.availability).toBe('UNAVAILABLE');
    expect(fact.values.overallResilience).toBeUndefined();
  });

  it('marks an unavailable indicator explicitly', () => {
    const fact = buildAIChatFactObject({
      intent: { intent: 'DASHBOARD_DATA', confidence: 1, reasons: [], matchedTerms: [], language: 'en' },
      entities: {
        territories: ['Sabah'],
        regions: ['Sabah'],
        concepts: ['river_water_quality'],
        indicators: ['River water quality'],
        pillars: [],
        districts: [],
        years: [],
        operations: {
          comparison: false,
          ranking: false,
          trend: false,
          weakest: false,
          strongest: false,
          targetGap: false,
          sdgProgress: false,
          districtLevel: false,
          latest: false,
        },
        ambiguities: [],
        matchedTerms: [],
        language: 'en',
      },
      comparability: {
        decision: 'ALLOW',
        reasons: [],
        warnings: [],
        blockedOperations: [],
        allowedOperations: ['describe'],
        requiredDisclosures: [],
      },
    });
    expect(fact.availability).toBe('UNAVAILABLE');
    expect(fact.warnings.some((warning) => warning.code === 'FACT_UNAVAILABLE')).toBe(true);
  });

  it('marks malformed data as blocking warning rather than throwing', () => {
    const repository = new FactDataRepository({
      indicators: {
        rows: [{
          territory: 'Sabah',
          dashboard_concept: 'internet_use',
          indicator: 'Internet use',
          canonical: 1,
          value: undefined,
          unit: '%',
          year: '2024',
        }],
      },
      resilience: { territories: {} },
      districts: { rows: [] },
    });

    const fact = buildFact('What is Sabah internet use value?', { repository });
    expect(fact.availability).toBe('UNAVAILABLE');
    expect(fact.warnings).toContainEqual(expect.objectContaining({ code: 'MALFORMED_RECORD' }));
  });
});

describe('territory and pillar facts', () => {
  it.each(Object.entries(resilienceData.territories).map(([territory, record]) => [territory, record.index]))(
    'builds overall resilience for %s where supported',
    (territory, score) => {
      const fact = buildFact(`What is ${territory}'s resilience score?`);
      expect(fact.values.overallResilience?.value).toBe(score);
    }
  );

  it('builds weakest pillar facts without Gemini ranking', () => {
    const fact = buildFact('Which pillar is weakest in Sarawak?');
    expect(fact.availability).toBe('AVAILABLE');
    expect(fact.diagnosis?.weakestPillar).toBe(pillarExtremum('Sarawak', 'minimum'));
    expect(fact.values.pillarScores.length).toBeGreaterThan(0);
  });

  it('builds strongest pillar facts without Gemini ranking', () => {
    const fact = buildFact('Which pillar is strongest in Brunei?');
    expect(fact.diagnosis?.strongestPillar).toBe('Energy');
  });

  it('builds exact pillar score and supporting indicator value', () => {
    const fact = buildFact("What is Sabah's Food score?");
    expect(fact.values.pillarScores).toContainEqual(expect.objectContaining({
      pillar: 'Food',
      value: 28.6,
      status: 'calculated',
    }));
    expect(fact.values.rawValues).toContainEqual(expect.objectContaining({
      indicator: 'Paddy production per capita',
      value: 28.6,
      status: 'derived',
    }));
  });

  it('handles deterministic pillar ties from injected data', () => {
    const repository = new FactDataRepository({
      resilience: {
        territories: {
          Sabah: {
            index: 50,
            pillarScores: { Food: 50, Education: 50, Energy: 70 },
            detail: {},
          },
        },
      },
      indicators: { rows: [] },
      districts: { rows: [] },
    });

    const fact = buildFact('Which pillar is weakest in Sabah?', { repository });
    expect(fact.diagnosis?.weakestPillar).toBe('Education');
    expect(fact.warnings).toContainEqual(expect.objectContaining({ code: 'PILLAR_TIE' }));
  });
});

describe('indicator, target, comparison, trend, SDG, and district facts', () => {
  it('builds exact indicator values from committed rows', () => {
    const fact = buildFact('What is Sabah internet-use value?');
    expect(fact.availability).toBe('AVAILABLE');
    expect(fact.values.rawValues[0]).toMatchObject({
      territory: 'Sabah',
      indicator: 'Internet use',
      value: 98,
      unit: '%',
      status: 'inherited',
    });
    expect(fact.approvedNumericTokens).toContain('98.0%');
  });

  it('uses the canonical Forest Cover concept row for Sabah value requests', () => {
    const fact = buildFact("What is Sabah's Forest Cover value?");
    expect(fact.availability).toBe('AVAILABLE');
    expect(fact.values.rawValues[0]).toMatchObject({
      territory: 'Sabah',
      concept: 'forest_cover',
      indicator: 'Forest extent (2000)',
      value: 6684138,
      unit: 'ha',
      status: 'direct',
    });
    expect(fact.approvedNumericTokens).toContain('6684138');
  });

  it('calculates a target gap when a compatible target exists', () => {
    const fact = buildFact('What is the target gap for Sabah clean water access?');
    expect(fact.values.target).toMatchObject({ value: 100, unit: '%' });
    expect(fact.values.gap).toMatchObject({ value: 19.5, formattedValue: '19.5%' });
  });

  it('marks missing target and gap unavailable', () => {
    const fact = buildFact('What is the target gap for Sabah tourist arrivals?');
    expect(fact.availability).toBe('PARTIAL');
    expect(fact.values.target).toBeUndefined();
    expect(fact.values.gap).toBeUndefined();
    expect(fact.requiredDisclosures.join(' ')).toContain('Target and gap are unavailable');
  });

  it('builds allowed comparisons after Stage 3C permits them', () => {
    const fact = buildFact('Compare healthcare between Sabah and Sarawak.');
    expect(fact.comparison.allowed).toBe(true);
    expect(fact.values.rawValues.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves both territory resilience values for comparison requests', () => {
    const fact = buildFact('Compare Sabah and Sarawak resilience scores.');
    expect(fact.comparison.requested).toBe(true);
    expect(fact.comparison.allowed).toBe(true);
    expect(fact.territories).toEqual(expect.arrayContaining(['Sabah', 'Sarawak']));
    expect(fact.values.rawValues).toEqual(expect.arrayContaining([
      expect.objectContaining({ territory: 'Sabah', concept: 'resilience', value: territoryScore('Sabah') }),
      expect.objectContaining({ territory: 'Sarawak', concept: 'resilience', value: territoryScore('Sarawak') }),
    ]));
    expect(fact.approvedNumericTokens).toEqual(expect.arrayContaining([formattedScore('Sabah'), formattedScore('Sarawak')]));
  });

  it('preserves the compatible difference for comparison requests', () => {
    const fact = buildFact('Compare Sabah and Sarawak resilience scores.');
    const difference = comparisonDifference('Sarawak', 'Sabah');
    expect(fact.values.rawValues).toContainEqual(expect.objectContaining({
      label: 'compatible difference',
      value: difference,
      formattedValue: Number.isInteger(difference) ? String(difference) : difference.toFixed(1),
      unit: 'score/100',
    }));
    expect(fact.approvedNumericTokens).toContain(String(difference));
  });

  it('clarifies more-than-two territory comparisons instead of truncating', () => {
    const fact = buildFact('Compare Sabah, Sarawak and Brunei resilience scores.');
    expect(fact.availability).toBe('BLOCKED');
    expect(fact.comparison.decision).toBe('NEEDS_CLARIFICATION');
    expect(fact.conclusion?.text).toContain('two territories at a time');
  });

  it('uses injected resilience data rather than a hard-coded score', () => {
    const repository = new FactDataRepository({
      resilience: {
        generatedAt: '2099-01-01',
        territories: {
          Sabah: {
            index: 41.2,
            weakestPillar: 'Food',
            pillarScores: { Food: 41.2 },
            detail: {},
          },
        },
      },
      indicators: { rows: [] },
      districts: { rows: [] },
    });

    const fact = buildFact("What is Sabah's resilience score?", { repository });
    expect(fact.values.overallResilience).toMatchObject({
      territory: 'Sabah',
      value: 41.2,
      formattedValue: '41.2',
    });
    expect(fact.approvedNumericTokens).toContain('41.2');
  });

  it('blocks rejected comparisons', () => {
    const fact = buildFact('Compare forest cover between Sabah and Brunei.');
    expect(fact.availability).toBe('BLOCKED');
    expect(fact.comparison.decision).toBe('REJECT');
  });

  it('keeps incompatible forest-cover comparison blocked without a difference', () => {
    const fact = buildFact('Compare Sabah and Brunei Forest Cover.');
    expect(fact.availability).toBe('BLOCKED');
    expect(fact.comparison.decision).toBe('REJECT');
    expect(fact.conclusion?.text).toContain('percentage-of-land values');
    expect(fact.values.rawValues).not.toContainEqual(expect.objectContaining({ label: 'compatible difference' }));
  });

  it('returns partial facts for downgraded comparisons', () => {
    const fact = buildFact('Rank internet tertinggi Sabah vs Kalimantan.', { language: 'ms' });
    expect(fact.availability).toBe('PARTIAL');
    expect(fact.comparison.decision).toBe('DOWNGRADE');
  });

  it('blocks comparisons requiring clarification', () => {
    const fact = buildAIChatFactObject({
      intent: { intent: 'DASHBOARD_DATA', confidence: 1, reasons: [], matchedTerms: [], language: 'en' },
      entities: {
        territories: ['Sabah', 'Sarawak'],
        regions: ['Sabah', 'Sarawak'],
        concepts: ['protected_areas'],
        indicators: [],
        pillars: [],
        districts: [],
        years: [],
        operations: {
          comparison: true,
          ranking: false,
          trend: false,
          weakest: false,
          strongest: false,
          targetGap: false,
          sdgProgress: false,
          districtLevel: false,
          latest: false,
        },
        ambiguities: ['Specify the comparison basis.'],
        matchedTerms: [],
        language: 'en',
      },
      comparability: {
        decision: 'NEEDS_CLARIFICATION',
        reasons: ['Specify the comparison basis for protected areas.'],
        warnings: [],
        blockedOperations: ['compare'],
        allowedOperations: [],
        requiredDisclosures: [],
      },
    });
    expect(fact.availability).toBe('BLOCKED');
    expect(fact.comparison.decision).toBe('NEEDS_CLARIFICATION');
  });

  it('builds valid trends from ordered series', () => {
    const fact = buildFact('Show the trend for Sabah poverty from 2020 to 2024.', {
      comparabilityOptions: { explicitHistoricalComparison: true },
    });
    expect(fact.availability).toBe('AVAILABLE');
    expect(fact.values.trends?.length).toBeGreaterThanOrEqual(3);
    expect(fact.requiredDisclosures).toContain('Trend answers require source years and methodology notes.');
  });

  it('blocks unavailable trends', () => {
    const fact = buildFact('Show the trend for Sabah internet use.');
    expect(fact.availability).toBe('BLOCKED');
    expect(fact.comparison.decision).toBe('REJECT');
  });

  it('downgrades SDG progress to coverage facts', () => {
    const fact = buildFact('What is the SDG progress for Sabah education?');
    expect(fact.availability).toBe(expectedSdgAvailability(fact));
    expect(fact.conclusion?.code).toBe('SDG_PROGRESS_DOWNGRADED');
    expect(fact.requiredDisclosures.join(' ')).toContain('cannot be calculated');
  });

  it('builds a canonical SDG15 indicator-list fact without requiring territory context', () => {
    const fact = buildFact('Which indicators support SDG 15?');
    expect(fact.availability).toBe('AVAILABLE');
    expect(fact.sdgGoals).toEqual(['SDG15']);
    expect(fact.sdgIndicatorList).toMatchObject({
      sdgGoal: 'SDG15',
      label: 'Life on Land',
      supported: true,
    });
    expect(fact.sdgIndicatorList?.groups.map((group) => group.indicator)).toEqual([
      'Forest cover',
      'Forest extent (2000)',
      'National parks (count)',
    ]);
    expect(fact.sdgIndicatorList?.groups.find((group) => group.indicator === 'Forest extent (2000)')?.territories).toEqual([
      'Kalimantan',
      'Sabah',
      'Sarawak',
    ]);
    expect(fact.sdgIndicatorList?.groups.find((group) => group.indicator === 'Forest cover')?.territories).toEqual(['Brunei']);
  });

  it('builds canonical SDG13, SDG6, and SDG3 indicator-list identities', () => {
    const sdg13 = buildFact('Which indicators are mapped to SDG 13?');
    expect(sdg13.sdgIndicatorList?.groups.map((group) => group.indicator)).toEqual([
      'Active fire hotspots (24h)',
      'Air quality (AQI, live)',
      'Fire alerts (VIIRS, annual)',
      'Tree cover loss (cumulative)',
    ]);
    // FIRMS bbox counts are refreshed observations. The integrity allowlist must
    // carry the numeric tokens that the committed source label actually renders,
    // without freezing a volatile source snapshot into this unit test.
    const hotspotSources = sdg13.sdgIndicatorList?.groups
      .find((group) => group.indicator === 'Active fire hotspots (24h)')?.sources || [];
    const hotspotSourceNumbers = hotspotSources.flatMap((source) => source.match(/\d+/g) || []);
    expect(hotspotSourceNumbers.length).toBeGreaterThan(0);
    expect(sdg13.approvedNumericTokens).toEqual(expect.arrayContaining(hotspotSourceNumbers));
    expect(buildFact('What indicators are tracked under SDG 6?').sdgIndicatorList?.groups.map((group) => group.indicator)).toEqual([
      'Clean water access',
    ]);
    expect(buildFact('Show me indicators for SDG 3.').sdgIndicatorList?.groups.map((group) => group.indicator)).toEqual([
      'Life expectancy',
    ]);
  });

  it('returns a deterministic unsupported SDG clarification', () => {
    const fact = buildFact('Which indicators support SDG 5?');
    expect(fact.availability).toBe('UNAVAILABLE');
    expect(fact.sdgIndicatorList?.supported).toBe(false);
    expect(fact.conclusion?.code).toBe('UNSUPPORTED_SDG_GOAL');
    expect(fact.conclusion?.text).toContain('Supported goals are SDG1, SDG2, SDG3, SDG4, SDG6, SDG7, SDG8, SDG9, SDG11, SDG13, SDG15, SDG16');
  });

  it('builds exact district facts', () => {
    const fact = buildFact('Show district data for Kota Kinabalu.');
    expect(fact.availability).toBe('AVAILABLE');
    expect(fact.values.districtValues?.some((value) => value.territory === 'Kota Kinabalu')).toBe(true);
  });

  it('includes current district freshness metadata without a stale warning', () => {
    const fact = buildFact('Show district data for Kota Kinabalu.');
    expect(fact.warnings.some((warning) => warning.message.includes('District metadata is stale'))).toBe(false);
    expect(fact.requiredDisclosures).toContain(`District metadata freshness date: ${districtsData.generatedAt}.`);
  });

  it('blocks unknown district facts', () => {
    const routed = routeAiChatIntent('Show district data for Atlantis district.', { currentPage: '/dashboard', language: 'en' });
    const route = { ...routed, intent: 'DASHBOARD_DATA' };
    const entities = {
      ...resolveAiChatEntities('Show district data for Atlantis district.', { language: 'en' }),
      districts: ['Atlantis'],
      operations: {
        ...resolveAiChatEntities('Show district data for Atlantis district.', { language: 'en' }).operations,
        districtLevel: true,
      },
    };
    const comparability = evaluateComparability({
      intent: route,
      entities,
      metadata: { rows: indicatorsData.rows, series: indicatorsData.series, districts: districtsData },
      freshness: { districtsGeneratedAt: districtsData.generatedAt },
    });

    const fact = buildAIChatFactObject({ intent: route, entities, comparability });
    expect(fact.availability).toBe('BLOCKED');
  });
});

describe('fact provenance and token approval', () => {
  it('preserves source file and does not invent missing publisher', () => {
    const fact = buildFact('What is Brunei electricity access?');
    expect(fact.sources[0]).toMatchObject({ sourceFile: 'public/data/indicators.json' });
    expect(fact.sources.some((source) => source.publisher === 'World Bank')).toBe(true);
  });

  it('keeps missing publisher missing for sparse sources', () => {
    const repository = new FactDataRepository({
      indicators: {
        rows: [{
          territory: 'Sabah',
          dashboard_concept: 'test_metric',
          indicator: 'Test metric',
          canonical: 1,
          value: 12,
          unit: 'count',
          year: '2024',
          source: '',
        }],
      },
      resilience: { territories: {} },
      districts: { rows: [] },
    });
    const fact = buildAIChatFactObject({
      intent: { intent: 'DASHBOARD_DATA', confidence: 1, reasons: [], matchedTerms: [], language: 'en' },
      entities: {
        territories: ['Sabah'],
        regions: ['Sabah'],
        concepts: ['test_metric'],
        indicators: ['Test metric'],
        pillars: [],
        districts: [],
        years: [],
        operations: {
          comparison: false,
          ranking: false,
          trend: false,
          weakest: false,
          strongest: false,
          targetGap: false,
          sdgProgress: false,
          districtLevel: false,
          latest: false,
        },
        ambiguities: [],
        matchedTerms: [],
        language: 'en',
      },
      comparability: {
        decision: 'ALLOW',
        reasons: [],
        warnings: [],
        blockedOperations: [],
        allowedOperations: ['describe'],
        requiredDisclosures: [],
      },
    }, { repository });

    expect(fact.sources[0].publisher).toBeUndefined();
  });

  it('marks derived and inherited values explicitly', () => {
    const derived = buildFact("What is Sabah's Food score?");
    const inherited = buildFact('What is Sabah internet-use value?');
    expect(derived.values.rawValues.some((value) => value.status === 'derived')).toBe(true);
    expect(inherited.values.rawValues.some((value) => value.status === 'inherited')).toBe(true);
  });

  it('approves only fact numbers and separates years', () => {
    const fact = buildFact('What is Brunei tourist arrivals?');
    expect(fact.approvedNumericTokens).toContain('678037');
    expect(fact.approvedYearTokens).toContain('2024');
    expect(fact.approvedNumericTokens.join('|')).not.toContain('20250228');
    expect(fact.approvedNumericTokens.join('|')).not.toContain('public/data');
  });

  it('supports formatted percentage numeric tokens', () => {
    const fact = buildFact('What is Sarawak internet-use value?');
    expect(fact.approvedNumericTokens).toContain('98.0%');
  });
});

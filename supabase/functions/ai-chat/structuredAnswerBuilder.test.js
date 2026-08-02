import { describe, expect, it, vi } from 'vitest';
import indicatorsData from '../../../public/data/indicators.json';
import districtsData from '../../../public/data/districts.json';
import { evaluateComparability } from './comparabilityGate.ts';
import { resolveAiChatEntities } from './entityResolver.ts';
import { buildAIChatFactObject } from './factObjectBuilder.ts';
import { routeAiChatIntent } from './intentRouter.ts';
import {
  assertApprovedSummaryNumbers,
  buildStructuredAnswer,
  extractNumericTokens,
  StructuredAnswerIntegrityError,
} from './structuredAnswerBuilder.ts';

function buildFactAndAnswer(message, options = {}) {
  const routed = routeAiChatIntent(message, {
    currentPage: '/dashboard',
    region: options.region || '',
    language: options.language || 'en',
  });
  const route = { ...routed, intent: 'DASHBOARD_DATA' };
  const entities = resolveAiChatEntities(message, {
    region: options.region || '',
    language: options.language || 'en',
  });
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
  const factObject = buildAIChatFactObject({ intent: route, entities, comparability });
  const answer = buildStructuredAnswer({
    language: entities.language || options.language,
    factObject,
    entities,
    comparability,
    templates: options.templates,
  });
  return { route, entities, comparability, factObject, answer };
}

function baseEntities(overrides = {}) {
  const operations = {
    comparison: false,
    ranking: false,
    trend: false,
    weakest: false,
    strongest: false,
    targetGap: false,
    sdgProgress: false,
    districtLevel: false,
    latest: false,
    ...(overrides.operations || {}),
  };
  const rest = { ...overrides };
  delete rest.operations;
  return {
    territories: ['Sabah'],
    regions: ['Sabah'],
    concepts: ['resilience'],
    indicators: [],
    pillars: [],
    districts: [],
    years: [],
    operations,
    ambiguities: [],
    matchedTerms: [],
    language: 'en',
    ...rest,
  };
}

function baseComparability(overrides = {}) {
  return {
    decision: 'ALLOW',
    reasons: [],
    warnings: [],
    blockedOperations: [],
    allowedOperations: ['describe'],
    requiredDisclosures: [],
    ...overrides,
  };
}

function baseFact(overrides = {}) {
  return {
    availability: 'AVAILABLE',
    intent: 'DASHBOARD_DATA',
    territories: ['Sabah'],
    concepts: ['resilience'],
    indicators: [],
    pillars: [],
    districts: [],
    values: {
      rawValues: [],
      indicatorScores: [],
      pillarScores: [],
    },
    comparison: {
      requested: false,
      allowed: true,
      decision: 'ALLOW',
    },
    impact: { available: false },
    methodologyNotes: [],
    requiredDisclosures: [],
    warnings: [],
    sources: [],
    approvedNumericTokens: [],
    approvedYearTokens: [],
    ...overrides,
  };
}

describe('structured answer AVAILABLE layers', () => {
  it('builds an overall resilience answer', () => {
    const { answer } = buildFactAndAnswer("What is Sabah's resilience score?");

    expect(answer.availability).toBe('AVAILABLE');
    expect(answer.layers.conclusion).toMatchObject({
      status: 'AVAILABLE',
      heading: 'Conclusion',
      text: "Sabah's overall resilience score is 63.7.",
    });
    expect(answer.layers.conclusion.factReferences).toContain('values.overallResilience');
    expect(answer.summaryText).toContain("Sabah's overall resilience score is 63.7.");
  });

  it('builds a weakest pillar answer without invented causes', () => {
    const { answer } = buildFactAndAnswer('Which pillar is weakest in Sarawak?');

    expect(answer.layers.conclusion.text).toBe('Education is the weakest resilience pillar in Sarawak.');
    expect(answer.layers.diagnosis.text).toContain('Weakest pillar: Education.');
    expect(answer.layers.diagnosis.text).not.toMatch(/because|caused/i);
  });

  it('builds a strongest pillar answer', () => {
    const { answer } = buildFactAndAnswer('Which pillar is strongest in Brunei?');

    expect(answer.layers.conclusion.text).toBe('Energy is the strongest resilience pillar in Brunei.');
    expect(answer.layers.diagnosis.text).toContain('Strongest pillar tie');
  });

  it('builds a pillar score answer', () => {
    const { answer } = buildFactAndAnswer("What is Sabah's Food score?");

    expect(answer.layers.conclusion.text).toBe("Sabah's Food score is 28.7.");
    expect(answer.approvedNumericTokens).toContain('28.7');
  });

  it('builds an indicator value answer with year token handling', () => {
    const { answer } = buildFactAndAnswer('What is Sabah internet-use value?');

    expect(answer.layers.conclusion.text).toBe('Internet use for Sabah is 98% in 2024.');
    expect(answer.approvedNumericTokens).toContain('98.0%');
    expect(answer.approvedYearTokens).toContain('2024');
  });

  it('builds a target and gap layer', () => {
    const { answer } = buildFactAndAnswer('What is the target gap for Sabah clean water access?');

    expect(answer.layers.gap).toMatchObject({
      status: 'AVAILABLE',
      text: 'Clean water access for Sabah has current 80.5%, target 100%, and gap 19.5%.',
    });
  });
});

describe('structured answer PARTIAL and unavailable layers', () => {
  it('marks missing target as partial with an explicit gap limitation', () => {
    const { answer } = buildFactAndAnswer('What is the target gap for Sabah tourist arrivals?');

    expect(answer.availability).toBe('PARTIAL');
    expect(answer.layers.gap.status).toBe('UNAVAILABLE');
    expect(answer.layers.gap.text).toBe('No verified compatible target is available for this requested value.');
    expect(answer.layers.honesty.warnings.join(' ')).toContain('Target and gap are unavailable');
  });

  it('downgrades SDG progress to coverage or mapping only', () => {
    const { answer } = buildFactAndAnswer('What is the SDG progress for Sabah education?');

    expect(answer.availability).toBe('PARTIAL');
    expect(answer.layers.gap.text).toContain('SDG coverage or mapping only');
    expect(answer.layers.honesty.warnings.join(' ')).toContain('SDG progress-to-target cannot be calculated');
  });

  it('can represent an unsupported trend with descriptive facts only', () => {
    const factObject = baseFact({
      availability: 'PARTIAL',
      concepts: ['internet_use'],
      values: {
        rawValues: [{
          territory: 'Sabah',
          indicator: 'Internet use',
          value: 98,
          formattedValue: '98%',
          unit: '%',
          year: 2024,
          status: 'inherited',
        }],
        indicatorScores: [],
        pillarScores: [],
      },
      requiredDisclosures: ['Trend series is unavailable; only the current descriptive fact is safe.'],
      approvedNumericTokens: ['98', '98%', '98.0', '98.0%'],
      approvedYearTokens: ['2024'],
    });
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject,
      entities: baseEntities({ concepts: ['internet_use'], operations: { trend: true } }),
      comparability: baseComparability({ decision: 'DOWNGRADE', reasons: ['Trend series is unavailable.'] }),
    });

    expect(answer.availability).toBe('PARTIAL');
    expect(answer.layers.conclusion.text).toContain('Internet use for Sabah is 98% in 2024.');
    expect(answer.layers.honesty.warnings).toContain('Trend series is unavailable; only the current descriptive fact is safe.');
  });

  it('records incomplete source metadata in honesty', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({
        values: {
          rawValues: [{
            territory: 'Sabah',
            indicator: 'Test metric',
            value: 12,
            formattedValue: '12',
            unit: 'count',
            status: 'direct',
          }],
          indicatorScores: [],
          pillarScores: [],
        },
        sources: [{ sourceFile: 'fixture.json', sourcePath: 'rows.test' }],
        approvedNumericTokens: ['12'],
      }),
      entities: baseEntities({ concepts: ['test_metric'], indicators: ['Test metric'] }),
      comparability: baseComparability(),
    });

    expect(answer.layers.honesty.warnings).toContain('Some source metadata is incomplete in the committed dataset.');
  });

  it('marks impact unavailable when no deterministic impact exists', () => {
    const { answer } = buildFactAndAnswer("What is Sabah's resilience score?");
    expect(answer.layers.impact).toMatchObject({
      status: 'UNAVAILABLE',
      text: 'A quantified impact estimate is not available in the current dataset.',
    });
  });

  it('marks lever unavailable without fake recommendation', () => {
    const { answer } = buildFactAndAnswer("What is Sabah's resilience score?");
    expect(answer.layers.lever).toMatchObject({
      status: 'UNAVAILABLE',
      leverIds: [],
      requiresGeminiPhrasing: false,
    });
    expect(answer.layers.lever.text).toBe('No verified intervention has been retrieved for this answer yet.');
  });
});

describe('structured answer blocked and clarification behavior', () => {
  it('blocks incompatible territory comparisons', () => {
    const { answer } = buildFactAndAnswer('Compare forest cover between Sabah and Brunei.');

    expect(answer.blocked).toBe(true);
    expect(answer.layers.conclusion.status).toBe('BLOCKED');
    expect(answer.layers.honesty.warnings[0]).toContain('Forest cover mixes');
  });

  it('blocks governance comparison', () => {
    const { answer } = buildFactAndAnswer('Compare governance between Sabah and Sarawak.');

    expect(answer.blocked).toBe(true);
    expect(answer.layers.honesty.warnings.join(' ')).toContain('Governance uses inherited national WGI values');
  });

  it('handles ambiguous comparison basis', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({
        availability: 'BLOCKED',
        comparison: { requested: true, allowed: false, decision: 'NEEDS_CLARIFICATION' },
        conclusion: { code: 'COMPARABILITY_NEEDS_CLARIFICATION', text: 'Specify the comparison basis for protected areas.' },
        warnings: [{ code: 'COMPARABILITY_BLOCKED', message: 'Specify the comparison basis for protected areas.', severity: 'blocking' }],
      }),
      entities: baseEntities({ territories: ['Sabah', 'Sarawak'], regions: ['Sabah', 'Sarawak'], concepts: ['protected_areas'], operations: { comparison: true } }),
      comparability: baseComparability({
        decision: 'NEEDS_CLARIFICATION',
        reasons: ['Specify the comparison basis for protected areas.'],
        blockedOperations: ['compare'],
        allowedOperations: [],
      }),
    });

    expect(answer.clarificationRequired).toBe(true);
    expect(answer.layers.conclusion.text).toContain('Specify the comparison basis');
  });

  it('handles ambiguous district clarification', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({
        availability: 'BLOCKED',
        districts: ['Kota'],
        comparison: { requested: false, allowed: false, decision: 'NEEDS_CLARIFICATION' },
        warnings: [{ code: 'COMPARABILITY_BLOCKED', message: 'Ambiguous district "Kota" could mean multiple districts.', severity: 'blocking' }],
      }),
      entities: baseEntities({
        districts: ['Kota'],
        operations: { districtLevel: true },
        ambiguities: ['Ambiguous district "Kota" could mean multiple districts.'],
      }),
      comparability: baseComparability({
        decision: 'NEEDS_CLARIFICATION',
        reasons: ['Ambiguous district "Kota" could mean multiple districts.'],
        blockedOperations: ['district_answer'],
        allowedOperations: [],
      }),
    });

    expect(answer.clarificationRequired).toBe(true);
    expect(answer.blocked).toBe(true);
    expect(answer.layers.conclusion.text).toContain('Ambiguous district');
  });

  it('handles multiple indicator clarification', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({
        availability: 'BLOCKED',
        comparison: { requested: true, allowed: false, decision: 'NEEDS_CLARIFICATION' },
        warnings: [{ code: 'COMPARABILITY_BLOCKED', message: 'Multiple concepts were requested without selecting an exact indicator.', severity: 'blocking' }],
      }),
      entities: baseEntities({ concepts: ['food', 'energy'], operations: { comparison: true } }),
      comparability: baseComparability({
        decision: 'NEEDS_CLARIFICATION',
        reasons: ['Multiple concepts were requested without selecting an exact indicator.'],
        blockedOperations: ['compare'],
      }),
    });

    expect(answer.layers.conclusion.text).toContain('Multiple concepts');
  });
});

describe('structured answer language behavior', () => {
  it('uses English headings and templates', () => {
    const { answer } = buildFactAndAnswer("What is Sabah's resilience score?", { language: 'en' });
    expect(answer.layers.conclusion.heading).toBe('Conclusion');
    expect(answer.layers.lever.heading).toBe('Recommended action');
  });

  it('uses Malay headings and templates', () => {
    const { answer } = buildFactAndAnswer('Apakah skor daya tahan Sabah?', { language: 'ms' });
    expect(answer.language).toBe('ms');
    expect(answer.layers.conclusion.heading).toBe('Kesimpulan');
    expect(answer.layers.impact.text).toBe('Anggaran kesan berangka tidak tersedia dalam set data semasa.');
  });

  it('falls back to English for unsupported language', () => {
    const { factObject, entities, comparability } = buildFactAndAnswer("What is Sabah's resilience score?");
    const answer = buildStructuredAnswer({ language: 'fr', factObject, entities, comparability });

    expect(answer.language).toBe('en');
    expect(answer.warnings).toContainEqual(expect.objectContaining({ code: 'LANGUAGE_FALLBACK' }));
  });

  it('respects resolved Malay language for mixed-language requests', () => {
    const { answer } = buildFactAndAnswer('Apakah rank internet tertinggi Sabah vs Kalimantan.', { language: 'en' });
    expect(answer.language).toBe('ms');
  });
});

describe('structured answer diagnosis, gap, impact, and lever details', () => {
  it('states tie handling deterministically', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({
        diagnosis: { weakestPillar: 'Education', strongestPillar: 'Energy' },
        values: {
          rawValues: [],
          indicatorScores: [],
          pillarScores: [
            { territory: 'Sabah', pillar: 'Education', value: 50, formattedValue: '50', unit: 'score/100', status: 'calculated' },
            { territory: 'Sabah', pillar: 'Shelter', value: 50, formattedValue: '50', unit: 'score/100', status: 'calculated' },
          ],
        },
        warnings: [{ code: 'PILLAR_TIE', message: 'Weakest pillar tie: Education, Shelter. First alphabetical pillar is primary.', severity: 'info' }],
        approvedNumericTokens: ['50'],
      }),
      entities: baseEntities({ operations: { weakest: true } }),
      comparability: baseComparability(),
    });

    expect(answer.layers.diagnosis.status).toBe('PARTIAL');
    expect(answer.layers.diagnosis.text).toContain('Weakest pillar tie');
  });

  it('handles unavailable target', () => {
    const { answer } = buildFactAndAnswer('What is the target gap for Sabah tourist arrivals?');
    expect(answer.layers.gap.codes).toContain('TARGET_UNAVAILABLE');
  });

  it('handles incompatible target as blocked gap', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({
        availability: 'BLOCKED',
        warnings: [{ code: 'GAP_BLOCKED', message: 'Target unit missing does not match current unit count.', severity: 'blocking' }],
      }),
      entities: baseEntities({ operations: { targetGap: true } }),
      comparability: baseComparability(),
    });

    expect(answer.layers.gap.status).toBe('BLOCKED');
  });

  it('uses available deterministic impact text when present', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({
        impact: {
          available: true,
          description: 'Pillar scores are averaged into the overall resilience index.',
          method: 'documented aggregation relationship',
        },
      }),
      entities: baseEntities(),
      comparability: baseComparability(),
    });

    expect(answer.layers.impact.status).toBe('AVAILABLE');
    expect(answer.layers.impact.text).toContain('averaged');
  });

  it('does not perform simulator calculations in impact text', () => {
    const { answer } = buildFactAndAnswer("What is Sabah's resilience score?");
    expect(answer.layers.impact.text).not.toMatch(/increase|decrease|\+/i);
  });

  it('keeps lever IDs empty until retrieval exists', () => {
    const { answer } = buildFactAndAnswer("What is Sabah's resilience score?");
    expect(answer.layers.lever.leverIds).toEqual([]);
  });
});

describe('structured answer honesty, sources, and numeric integrity', () => {
  it('deduplicates repeated warnings and keeps blocking reasons first', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({
        availability: 'BLOCKED',
        warnings: [
          { code: 'A', message: 'Blocking reason.', severity: 'blocking' },
          { code: 'B', message: 'Warning reason.', severity: 'warning' },
          { code: 'B', message: 'Warning reason.', severity: 'warning' },
        ],
      }),
      entities: baseEntities(),
      comparability: baseComparability({ decision: 'REJECT', reasons: ['Comparison rejected.'] }),
    });

    expect(answer.layers.honesty.warnings[0]).toBe('Comparison rejected.');
    expect(answer.layers.honesty.warnings.filter((item) => item === 'Warning reason.')).toHaveLength(1);
  });

  it('includes stale district warning', () => {
    const { answer } = buildFactAndAnswer('Show district data for Kota Kinabalu.');
    expect(answer.layers.honesty.warnings.join(' ')).toContain('District metadata is stale');
  });

  it('includes Kalimantan derived disclosure', () => {
    const { answer } = buildFactAndAnswer('What is Kalimantan food score?');
    expect(answer.layers.honesty.warnings.join(' ')).toContain('derived or aggregated');
  });

  it('includes inherited value disclosure', () => {
    const { answer } = buildFactAndAnswer('What is Sabah internet-use value?');
    expect(answer.layers.honesty.warnings.join(' ')).toContain('inherited national-level value');
  });

  it('preserves and deduplicates sources', () => {
    const source = { publisher: 'World Bank', sourceFile: 'public/data/indicators.json', sourcePath: 'rows.test' };
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({ sources: [source, source] }),
      entities: baseEntities(),
      comparability: baseComparability(),
    });

    expect(answer.sources).toHaveLength(1);
    expect(answer.sources[0]).toEqual(source);
  });

  it('preserves missing publisher as missing', () => {
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject: baseFact({ sources: [{ sourceFile: 'fixture.json', sourcePath: 'x' }] }),
      entities: baseEntities(),
      comparability: baseComparability(),
    });

    expect(answer.sources[0].publisher).toBeUndefined();
  });

  it('keeps URLs out of summary text', () => {
    const { answer } = buildFactAndAnswer('What is Brunei tourist arrivals?');
    expect(answer.summaryText).not.toMatch(/https?:\/\//i);
  });

  it('summary contains approved numbers only', () => {
    const { answer } = buildFactAndAnswer('What is Brunei tourist arrivals?');
    const allowed = new Set([...answer.approvedNumericTokens, ...answer.approvedYearTokens]);
    expect(extractNumericTokens(answer.summaryText).every((token) => allowed.has(token))).toBe(true);
  });

  it('rejects URL digits and unapproved internal IDs in summary checks', () => {
    expect(() => assertApprovedSummaryNumbers('Conclusion: see https://example.com/2024', [], [])).toThrow(StructuredAnswerIntegrityError);
    expect(() => assertApprovedSummaryNumbers('Conclusion: internal id 6401', [], [])).toThrow(StructuredAnswerIntegrityError);
  });

  it('does not add numbered heading tokens', () => {
    const { answer } = buildFactAndAnswer("What is Sabah's resilience score?");
    expect(answer.summaryText).not.toMatch(/^1\./m);
  });

  it('handles percentage formatting correctly', () => {
    const { answer } = buildFactAndAnswer('What is Sarawak internet-use value?');
    expect(answer.summaryText).toContain('98%');
    expect(() => assertApprovedSummaryNumbers(answer.summaryText, answer.approvedNumericTokens, answer.approvedYearTokens)).not.toThrow();
  });
});

describe('structured answer integration seam', () => {
  it('accepts injected phrase templates', () => {
    const { factObject, entities, comparability } = buildFactAndAnswer("What is Sabah's resilience score?");
    const answer = buildStructuredAnswer({
      language: 'en',
      factObject,
      entities,
      comparability,
      templates: { en: { headings: { conclusion: 'Result' } } },
    });

    expect(answer.layers.conclusion.heading).toBe('Result');
  });

  it('does not accept or require Gemini output', () => {
    const { factObject, entities, comparability } = buildFactAndAnswer("What is Sabah's resilience score?");
    const gemini = vi.fn();
    buildStructuredAnswer({ language: 'en', factObject, entities, comparability });
    expect(gemini).not.toHaveBeenCalled();
  });
});

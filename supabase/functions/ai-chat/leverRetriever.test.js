import { describe, expect, it } from 'vitest';
import { LeverRepository } from './leverRepository.ts';
import { retrieveVerifiedLevers } from './leverRetriever.ts';

function record(overrides = {}) {
  return {
    id: 'food-001',
    concept: 'food',
    pillars: ['Food'],
    territories: ['Sabah'],
    title: 'Restore documented idle paddy fields',
    summary: 'Use a verified food intervention.',
    whoActs: ['government'],
    horizon: 'medium',
    mechanism: 'Targets domestic paddy production.',
    appliesWhen: ['Food pillar is weak.'],
    doesNotApplyWhen: ['district detail is stale'],
    evidence: [{ sourceFile: 'docs/AI_CHATBOT_CONCEPT_AND_PLAN.md', whatItActuallySays: 'Evidence supports the documented intervention.' }],
    evidenceStatus: 'VERIFIED',
    language: 'en',
    keywords: ['food'],
    ...overrides,
  };
}

function repository(records) {
  return new LeverRepository({ schemaVersion: 1, generatedAt: 'x', recordCount: records.length, records });
}

function fact(overrides = {}) {
  return {
    availability: 'AVAILABLE',
    intent: 'DASHBOARD_DATA',
    territories: ['Sabah'],
    concepts: ['food'],
    indicators: [],
    pillars: [],
    districts: [],
    values: { rawValues: [], indicatorScores: [], pillarScores: [] },
    comparison: { requested: false, allowed: true, decision: 'ALLOW' },
    impact: { available: false },
    methodologyNotes: [],
    requiredDisclosures: [],
    warnings: [],
    sources: [],
    approvedNumericTokens: [],
    approvedYearTokens: [],
    diagnosis: { weakestPillar: 'Food' },
    ...overrides,
  };
}

describe('lever retriever', () => {
  it('returns empty-result behavior for the empty runtime library', () => {
    const result = retrieveVerifiedLevers({ concepts: ['food'], pillars: ['Food'], territories: ['Sabah'], language: 'en' }, repository([]));
    expect(result).toEqual({ records: [], matchedBy: [], warnings: [], emptyReason: 'NO_LEVER_LIBRARY_RECORDS' });
  });

  it('retrieves exact concept, pillar, territory, appliesWhen, and language matches', () => {
    const result = retrieveVerifiedLevers({
      concepts: ['food'],
      pillars: ['Food'],
      territories: ['Sabah'],
      language: 'en',
      factObject: fact(),
    }, repository([record()]));

    expect(result.records.map((item) => item.id)).toEqual(['food-001']);
    expect(result.matchedBy).toEqual(expect.arrayContaining(['concept', 'pillar', 'territory', 'language', 'evidence']));
  });

  it('excludes territory mismatches and unrelated concepts', () => {
    const repo = repository([record({ territories: ['Brunei'] }), record({ id: 'energy-001', concept: 'energy', pillars: ['Energy'] })]);
    const result = retrieveVerifiedLevers({ concepts: ['food'], pillars: ['Food'], territories: ['Sabah'], language: 'en', factObject: fact() }, repo);
    expect(result.records).toEqual([]);
    expect(result.emptyReason).toBe('NO_VERIFIED_APPLICABLE_LEVER');
  });

  it('supports Borneo-wide and generic applicability conservatively', () => {
    const repo = repository([
      record({ id: 'borneo-food', territories: ['Borneo-wide'] }),
      record({ id: 'generic-food', territories: ['generic'] }),
    ]);
    const result = retrieveVerifiedLevers({ concepts: ['food'], pillars: ['Food'], territories: ['Sarawak'], language: 'en', factObject: fact({ territories: ['Sarawak'] }) }, repo);
    expect(result.records.map((item) => item.id)).toEqual(['borneo-food', 'generic-food']);
  });

  it('uses doesNotApplyWhen to exclude unsuitable records', () => {
    const result = retrieveVerifiedLevers({
      concepts: ['food'],
      pillars: ['Food'],
      territories: ['Sabah'],
      language: 'en',
      factObject: fact({ warnings: [{ code: 'STALE', message: 'district detail is stale', severity: 'warning' }] }),
    }, repository([record()]));

    expect(result.records).toEqual([]);
  });

  it('returns English with a warning for Malay when no verified Malay record exists', () => {
    const result = retrieveVerifiedLevers({ concepts: ['food'], pillars: ['Food'], territories: ['Sabah'], language: 'ms', factObject: fact() }, repository([record()]));
    expect(result.records[0].language).toBe('en');
    expect(result.warnings[0]).toContain('without translation');
  });

  it('respects limit and deterministic ordering', () => {
    const result = retrieveVerifiedLevers({
      concepts: ['food'],
      pillars: ['Food'],
      territories: ['Sabah'],
      language: 'en',
      limit: 1,
      factObject: fact(),
    }, repository([record({ id: 'food-002' }), record({ id: 'food-001' })]));

    expect(result.records.map((item) => item.id)).toEqual(['food-001']);
  });

  it('blocked fact objects return no lever', () => {
    const result = retrieveVerifiedLevers({ concepts: ['food'], pillars: ['Food'], territories: ['Sabah'], language: 'en', factObject: fact({ availability: 'BLOCKED' }) }, repository([record()]));
    expect(result.emptyReason).toBe('BLOCKED_OR_CLARIFICATION');
  });

  it('does not select a lever solely because a score is low or estimate impact', () => {
    const result = retrieveVerifiedLevers({
      concepts: ['internet_use'],
      pillars: ['Entertainment'],
      territories: ['Sabah'],
      language: 'en',
      factObject: fact({ concepts: ['internet_use'], pillars: ['Entertainment'], diagnosis: { weakestPillar: 'Entertainment' } }),
    }, repository([record({ concept: 'energy', pillars: ['Energy'] })]));

    expect(result.records).toEqual([]);
  });
});

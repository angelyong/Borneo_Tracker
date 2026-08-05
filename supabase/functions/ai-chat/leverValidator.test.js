import { describe, expect, it } from 'vitest';
import { validateLeverCollection, validateLeverRecord } from './leverValidator.ts';

function lever(overrides = {}) {
  return {
    id: 'food-001',
    concept: 'food',
    pillars: ['Food'],
    territories: ['Sabah'],
    title: 'Restore documented idle paddy fields',
    summary: 'Use a verified paddy-restoration intervention where the evidence supports the action.',
    whoActs: ['government'],
    horizon: 'medium',
    mechanism: 'The intervention targets the domestic paddy production mechanism used by the Food pillar.',
    appliesWhen: ['Food pillar is requested or diagnosed as weak.'],
    doesNotApplyWhen: ['No paddy-production context is available.'],
    expectedDirection: 'improve',
    evidence: [{
      publisher: 'Borneo Tracker documentation',
      year: 2026,
      title: 'AI Chatbot Concept and Plan',
      url: 'https://example.com/evidence',
      sourceFile: 'docs/AI_CHATBOT_CONCEPT_AND_PLAN.md',
      sourcePath: '10. lever library',
      whatItActuallySays: 'The source describes lever-library discipline and concept-linked interventions.',
    }],
    evidenceStatus: 'VERIFIED',
    language: 'en',
    keywords: ['food', 'paddy', 'resilience'],
    ...overrides,
  };
}

describe('lever validator', () => {
  it('accepts a valid verified lever', () => {
    expect(validateLeverRecord(lever()).valid).toBe(true);
  });

  it.each([
    [{ id: '' }, 'MISSING_ID'],
    [{ concept: 'unsupported' }, 'UNSUPPORTED_CONCEPT'],
    [{ pillars: ['Environment'] }, 'UNSUPPORTED_PILLAR'],
    [{ territories: ['Atlantis'] }, 'UNSUPPORTED_TERRITORY'],
    [{ mechanism: '' }, 'EMPTY_MECHANISM'],
    [{ whoActs: ['business'] }, 'INVALID_ACTOR'],
    [{ horizon: 'soon' }, 'INVALID_HORIZON'],
    [{ language: '' }, 'INVALID_LANGUAGE'],
    [{ evidence: [] }, 'MISSING_EVIDENCE'],
    [{ evidence: [{ sourceFile: 'docs/AI_CHATBOT_CONCEPT_AND_PLAN.md', whatItActuallySays: 'x', url: 'not-url' }] }, 'MALFORMED_URL'],
    [{ title: 'TODO replace later' }, 'PLACEHOLDER_VERIFIED'],
    [{ summary: 'This will improve the score.' }, 'UNSUPPORTED_CAUSAL_EFFECT'],
    [{ mechanism: '' }, 'EMPTY_MECHANISM'],
  ])('rejects invalid lever shape %#', (override, code) => {
    const result = validateLeverRecord(lever(override));
    expect(result.issues.map((issue) => issue.code)).toContain(code);
  });

  it('checks source file traceability when a source checker is supplied', () => {
    const result = validateLeverRecord(lever(), { sourceFileExists: () => false });
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_SOURCE_FILE');
  });

  it('rejects duplicate ids in a collection', () => {
    const result = validateLeverCollection([lever(), lever()]);
    expect(result.duplicateIds).toEqual(['food-001']);
    expect(result.invalidRecords[0].errors.join(' ')).toContain('Duplicate');
  });

  it('does not silently upgrade incomplete or placeholder records', () => {
    const incomplete = lever({ id: 'food-incomplete', evidenceStatus: 'INCOMPLETE' });
    const placeholder = lever({ id: 'food-placeholder', evidenceStatus: 'PLACEHOLDER' });

    expect(validateLeverRecord(incomplete).valid).toBe(true);
    expect(validateLeverRecord(placeholder).valid).toBe(true);
    expect(incomplete.evidenceStatus).toBe('INCOMPLETE');
    expect(placeholder.evidenceStatus).toBe('PLACEHOLDER');
  });
});

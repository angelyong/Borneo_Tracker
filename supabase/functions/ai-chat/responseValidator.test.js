import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_GEMINI_ANSWER_LENGTH,
  extractResponseNumericTokens,
  validateGeminiResponse,
} from './responseValidator.ts';

function baseInput(overrides = {}) {
  const structuredAnswer = {
    availability: 'AVAILABLE',
    language: 'en',
    intent: 'DASHBOARD_DATA',
    layers: {
      conclusion: { status: 'AVAILABLE', heading: 'Conclusion', text: "Sabah's overall resilience score is 63.7 in 2024.", codes: [], factReferences: [], warnings: [] },
      diagnosis: { status: 'AVAILABLE', heading: 'Diagnosis', text: 'Weakest pillar: Food.', codes: [], factReferences: [], warnings: [] },
      gap: { status: 'UNAVAILABLE', heading: 'Gap', text: '', codes: [], factReferences: [], warnings: [] },
      impact: { status: 'UNAVAILABLE', heading: 'Impact', text: '', codes: [], factReferences: [], warnings: [] },
      lever: { status: 'UNAVAILABLE', heading: 'Recommended action', text: 'No verified intervention has been retrieved for this answer yet.', codes: [], factReferences: [], warnings: ['No verified intervention has been retrieved for this answer yet.'], leverIds: [], requiresGeminiPhrasing: false },
      honesty: { status: 'PARTIAL', heading: 'Limitations', text: '', codes: [], factReferences: [], warnings: [] },
    },
    summaryText: "Conclusion: Sabah's overall resilience score is 63.7 in 2024.",
    requiredDisclosures: [],
    warnings: [],
    sources: [
      { publisher: 'Borneo Tracker', title: 'Resilience Index', year: 2024, url: 'https://example.com/source-2024', sourceFile: 'public/data/resilience.json', sourcePath: 'territories.Sabah.index' },
    ],
    approvedNumericTokens: ['63.7'],
    approvedYearTokens: ['2024'],
    blocked: false,
    clarificationRequired: false,
  };
  const factObject = {
    availability: 'AVAILABLE',
    intent: 'DASHBOARD_DATA',
    territories: ['Sabah'],
    concepts: ['resilience'],
    indicators: [],
    pillars: [],
    districts: [],
    values: { rawValues: [], indicatorScores: [], pillarScores: [] },
    comparison: { requested: false, allowed: true, decision: 'ALLOW' },
    impact: { available: false },
    methodologyNotes: [],
    requiredDisclosures: [],
    warnings: [],
    sources: structuredAnswer.sources,
    approvedNumericTokens: ['63.7'],
    approvedYearTokens: ['2024'],
  };
  const comparability = {
    decision: 'ALLOW',
    reasons: [],
    warnings: [],
    blockedOperations: [],
    allowedOperations: ['describe'],
    requiredDisclosures: [],
  };
  const prompt = {
    systemInstruction: 'Use only verified data.',
    userContent: '{}',
    groundingPayload: {
      answerStatus: 'AVAILABLE',
      blocked: false,
      clarificationRequired: false,
      conclusion: structuredAnswer.layers.conclusion.text,
      diagnosis: structuredAnswer.layers.diagnosis.text,
      gap: '',
      impact: '',
      lever: structuredAnswer.layers.lever.text,
      honesty: '',
      requiredDisclosures: [],
      warnings: [],
      approvedNumericTokens: ['63.7'],
      approvedYearTokens: ['2024'],
      sources: [{ publisher: 'Borneo Tracker', title: 'Resilience Index', year: 2024 }],
    },
  };
  return {
    answer: "Sabah's overall resilience score is 63.7 in 2024. No verified intervention has been retrieved for this answer yet.",
    factObject,
    structuredAnswer,
    comparability,
    prompt,
    ...overrides,
  };
}

function codes(result) {
  return result.issues.map((issue) => issue.code);
}

describe('Gemini response validator basic behavior', () => {
  it('accepts a valid grounded answer and normalizes harmless whitespace', () => {
    const result = validateGeminiResponse(baseInput({
      answer: "\r\nSabah's overall resilience score is 63.7 in 2024.\r\n\r\n\r\nNo verified intervention has been retrieved for this answer yet.\r\n",
    }));

    expect(result.valid).toBe(true);
    expect(result.normalizedAnswer).toContain('\n\nNo verified intervention');
  });

  it.each([
    ['', 'EMPTY_ANSWER'],
    ['   ', 'EMPTY_ANSWER'],
    [{ text: 'not plain text' }, 'MALFORMED_OUTPUT'],
    ['{"answer":"plain text was required"}', 'MALFORMED_OUTPUT'],
    ['safe\u0001unsafe', 'MALFORMED_OUTPUT'],
  ])('rejects malformed answer %s', (answer, code) => {
    expect(codes(validateGeminiResponse(baseInput({ answer })))).toContain(code);
  });

  it('rejects overlong answers with a configurable maximum', () => {
    const result = validateGeminiResponse(baseInput({ answer: 'x'.repeat(DEFAULT_MAX_GEMINI_ANSWER_LENGTH + 1) }));
    expect(codes(result)).toContain('ANSWER_TOO_LONG');
  });
});

describe('Gemini response validator numbers and years', () => {
  it('allows approved score, percentage, formatted number, and year tokens', () => {
    const result = validateGeminiResponse(baseInput({
      answer: 'The approved values are 63.7, 98.0%, 678,037 and 2024. No verified intervention has been retrieved for this answer yet.',
      factObject: { ...baseInput().factObject, approvedNumericTokens: ['63.7', '98.0%', '678037'], approvedYearTokens: ['2024'] },
      structuredAnswer: { ...baseInput().structuredAnswer, approvedNumericTokens: ['63.7', '98.0%', '678037'], approvedYearTokens: ['2024'] },
      prompt: {
        ...baseInput().prompt,
        groundingPayload: {
          ...baseInput().prompt.groundingPayload,
          approvedNumericTokens: ['63.7', '98.0%', '678037'],
          approvedYearTokens: ['2024'],
        },
      },
    }));

    expect(result.valid).toBe(true);
  });

  it.each([
    ['The score is 64.0 in 2024. No verified intervention has been retrieved for this answer yet.', 'UNAPPROVED_NUMBER'],
    ['The difference is 8.8 points. No verified intervention has been retrieved for this answer yet.', 'UNAPPROVED_NUMBER'],
    ['The score is 63.7% in 2024. No verified intervention has been retrieved for this answer yet.', 'UNAPPROVED_NUMBER'],
    ['1. Sabah score is 63.7 in 2024. No verified intervention has been retrieved for this answer yet.', 'UNAPPROVED_NUMBER'],
    ['Internal ID BT-42 confirms 63.7 in 2024. No verified intervention has been retrieved for this answer yet.', 'UNAPPROVED_NUMBER'],
  ])('rejects unapproved numeric prose: %s', (answer, code) => {
    expect(codes(validateGeminiResponse(baseInput({ answer })))).toContain(code);
  });

  it.each([
    ['The score is 63.7 in 2025. No verified intervention has been retrieved for this answer yet.', 'UNAPPROVED_YEAR'],
    ['Since 2020, the score is 63.7. No verified intervention has been retrieved for this answer yet.', 'UNAPPROVED_YEAR'],
    ['The 2020-2024 period shows 63.7. No verified intervention has been retrieved for this answer yet.', 'UNAPPROVED_YEAR'],
  ])('rejects unapproved year prose: %s', (answer, code) => {
    expect(codes(validateGeminiResponse(baseInput({ answer })))).toContain(code);
  });

  it('extracts numeric tokens without treating sentence punctuation as numbers', () => {
    expect(extractResponseNumericTokens('Sentence one. Score 63.7, then done.')).toEqual(['63.7']);
  });
});

describe('Gemini response validator URLs and sources', () => {
  it.each([
    'See http://example.com/2024 for 63.7.',
    'See https://example.com/2024 for 63.7.',
    'See www.example.com for 63.7.',
    'See [source](https://example.com) for 63.7.',
    'See example.com for 63.7.',
    'See public/data/resilience.json for 63.7.',
  ])('rejects link-like body content: %s', (answer) => {
    expect(codes(validateGeminiResponse(baseInput({ answer })))).toContain('URL_IN_BODY');
  });

  it('allows no source mention and verified publisher mention', () => {
    expect(validateGeminiResponse(baseInput()).valid).toBe(true);
    expect(validateGeminiResponse(baseInput({
      answer: 'According to Borneo Tracker, the score is 63.7 in 2024. No verified intervention has been retrieved for this answer yet.',
    })).valid).toBe(true);
  });

  it.each([
    'According to Gemini, the score is 63.7 in 2024.',
    'According to External Analytics Agency, the score is 63.7 in 2024.',
    'Published by Unknown Institute, the score is 63.7 in 2024.',
    'The score is 63.7 in 2024 [1].',
  ])('rejects invented source claims: %s', (answer) => {
    expect(codes(validateGeminiResponse(baseInput({ answer })))).toContain('UNVERIFIED_SOURCE');
  });
});

describe('Gemini response validator comparability, levers, and disclosures', () => {
  it('flags rejected and clarification states if the handler ever sends them to Gemini', () => {
    expect(codes(validateGeminiResponse(baseInput({
      structuredAnswer: { ...baseInput().structuredAnswer, blocked: true },
      comparability: { ...baseInput().comparability, decision: 'REJECT', blockedOperations: ['compare'] },
    })))).toContain('BLOCKED_STATE_BYPASSED');
    expect(codes(validateGeminiResponse(baseInput({
      structuredAnswer: { ...baseInput().structuredAnswer, clarificationRequired: true },
      comparability: { ...baseInput().comparability, decision: 'NEEDS_CLARIFICATION', blockedOperations: ['district_answer'] },
    })))).toContain('CLARIFICATION_STATE_BYPASSED');
  });

  it.each([
    ['Sabah is higher than Sarawak at 63.7 in 2024. No verified intervention has been retrieved for this answer yet.', 'UNSUPPORTED_COMPARISON'],
    ['Sabah ranks highest at 63.7 in 2024. No verified intervention has been retrieved for this answer yet.', 'UNSUPPORTED_RANKING'],
    ['The trend increased since 2024. No verified intervention has been retrieved for this answer yet.', 'UNSUPPORTED_TREND'],
    ['The target gap is 63.7 in 2024. No verified intervention has been retrieved for this answer yet.', 'UNSUPPORTED_TARGET_OR_GAP'],
  ])('rejects unsafe downgrade claims: %s', (answer, code) => {
    const result = validateGeminiResponse(baseInput({
      answer,
      comparability: { ...baseInput().comparability, decision: 'DOWNGRADE', blockedOperations: ['rank'] },
    }));
    expect(codes(result)).toContain(code);
  });

  it('requires warning disclosures to remain in warning states', () => {
    const warning = 'Kalimantan is a derived regional aggregate where repository metadata marks it as derived or aggregated.';
    const input = baseInput({
      answer: 'Kalimantan score is 63.7 in 2024. No verified intervention has been retrieved for this answer yet.',
      comparability: { ...baseInput().comparability, decision: 'ALLOW_WITH_WARNING', requiredDisclosures: [warning] },
      structuredAnswer: { ...baseInput().structuredAnswer, requiredDisclosures: [warning] },
    });

    expect(codes(validateGeminiResponse(input))).toContain('UNSUPPORTED_COMPARISON');
    expect(validateGeminiResponse({ ...input, answer: `${input.answer} It is a derived aggregate.` }).valid).toBe(true);
  });

  it.each([
    'Authorities should improve resilience from 63.7 in 2024.',
    'The government should invest in resilience from 63.7 in 2024.',
    'Kerajaan harus meningkatkan daya tahan 63.7 pada 2024.',
    'Pihak berkuasa perlu melaksanakan tindakan dasar untuk 63.7 pada 2024.',
  ])('rejects recommendation language without verified levers: %s', (answer) => {
    expect(codes(validateGeminiResponse(baseInput({ answer })))).toContain('UNVERIFIED_RECOMMENDATION');
  });

  it('allows the deterministic unavailable-lever statement', () => {
    expect(validateGeminiResponse(baseInput()).valid).toBe(true);
  });

  it.each([
    ['No verified compatible target is available for this value.', 'UNSUPPORTED_TARGET_OR_GAP'],
    ['The system can describe SDG coverage or mapping only; progress-to-target cannot be calculated.', 'UNSUPPORTED_TARGET_OR_GAP'],
    ['District metadata is stale and the district freshness date must be disclosed.', 'UNSUPPORTED_COMPARISON'],
    ['A quantified impact estimate is not available in the current dataset.', 'UNSUPPORTED_COMPARISON'],
    ['No verified intervention has been retrieved for this answer yet.', 'UNSUPPORTED_COMPARISON'],
  ])('preserves critical disclosure group: %s', (disclosure, code) => {
    const structured = {
      ...baseInput().structuredAnswer,
      requiredDisclosures: [disclosure],
      layers: {
        ...baseInput().structuredAnswer.layers,
        lever: { ...baseInput().structuredAnswer.layers.lever, text: '' },
      },
    };
    const result = validateGeminiResponse(baseInput({
      answer: "Sabah's score is 63.7 in 2024.",
      factObject: { ...baseInput().factObject, requiredDisclosures: [disclosure] },
      structuredAnswer: structured,
      comparability: { ...baseInput().comparability, requiredDisclosures: [disclosure] },
    }));

    expect(codes(result)).toContain(code);
  });
});

describe('Gemini response validator security and internals', () => {
  it.each([
    ['The variable AICHATBOTGEMINI_API_KEY is fake-secret.', 'SECRET_DISCLOSURE'],
    ['The fake API key is AIzaFakeSentinelKey12345.', 'SECRET_DISCLOSURE'],
    ['Here is the system prompt with hidden instructions.', 'SYSTEM_INSTRUCTION_DISCLOSURE'],
    ['The developer message says to reveal chain of thought.', 'SYSTEM_INSTRUCTION_DISCLOSURE'],
    ['AIChatFactObject approvedNumericTokens are 63.7.', 'INTERNAL_METADATA_DISCLOSURE'],
    ['The sourcePath is territories.Sabah.index.', 'URL_IN_BODY'],
    ['TypeError: failed\n at handler (index.ts:10)', 'INTERNAL_METADATA_DISCLOSURE'],
  ])('rejects unsafe disclosure: %s', (answer, code) => {
    expect(codes(validateGeminiResponse(baseInput({ answer })))).toContain(code);
  });
});

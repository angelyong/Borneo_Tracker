import { describe, expect, it } from 'vitest';
import { buildKnowledgeAnswer } from './knowledgeAnswerBuilder.ts';

function match(overrides = {}) {
  const record = {
    id: 'about',
    title: 'Borneo Tracker Overview',
    content: 'Borneo Tracker uses verified data. It covers SDG 15 in 2024.',
    category: 'site-overview',
    language: 'en',
    pageUrl: '/about',
    region: null,
    regions: [],
    concept: null,
    sdgTags: ['SDG15'],
    relatedSdgs: [],
    keywords: ['borneo tracker'],
    sourceFile: 'src/i18n/locales/en.json',
    sourceType: 'json',
    sourcePath: 'about.overview',
    sourceName: 'Borneo Tracker interface copy',
    sourceUrl: 'https://example.com/source',
    status: 'verified',
    placeholder: false,
    runtimeIncluded: true,
    ...overrides.record,
  };
  return { record, score: 20, matchedBy: ['keyword'], ...overrides };
}

describe('knowledge answer builder', () => {
  it('builds a single-record answer from selected content only', () => {
    const answer = buildKnowledgeAnswer({ status: 'FOUND', matches: [match()], warnings: [] }, 'en');

    expect(answer.answer).toContain('Borneo Tracker Overview: Borneo Tracker uses verified data.');
    expect(answer.answer).not.toContain('https://example.com');
    expect(answer.recordIds).toEqual(['about']);
  });

  it('combines compatible records and avoids unrelated records', () => {
    const answer = buildKnowledgeAnswer({
      status: 'FOUND',
      matches: [
        match({ record: { id: 'a', category: 'reports', title: 'Report A', content: 'Report exports data.' } }),
        match({ record: { id: 'b', category: 'reports', title: 'Report B', content: 'Report exports data. It supports sections.' } }),
        match({ record: { id: 'c', category: 'community', title: 'Community', content: 'Community reports are separate.' } }),
      ],
      warnings: [],
    }, 'en');

    expect(answer.recordIds).toEqual(['a', 'b']);
    expect(answer.answer).toContain('Report A');
    expect(answer.answer).toContain('Report B');
    expect(answer.answer).not.toContain('Community reports');
  });

  it('combines complementary ESG and SDG page records for relationship questions', () => {
    const answer = buildKnowledgeAnswer({
      status: 'FOUND',
      matches: [
        match({ score: 24, record: { id: 'esg', category: 'esg-indicators', title: 'ESG Indicators', content: 'ESG groups indicators by Environment, Social and Governance.' } }),
        match({ score: 23, record: { id: 'sdg', category: 'sdg-progress', title: 'SDG Progress', content: 'SDG Progress tracks Sustainable Development Goals.' } }),
        match({ score: 12, record: { id: 'about', category: 'site-overview', title: 'About', content: 'About content.' } }),
      ],
      warnings: [],
    }, 'en');

    expect(answer.recordIds).toEqual(['esg', 'sdg']);
    expect(answer.answer).toContain('ESG groups indicators');
    expect(answer.answer).toContain('tracks Sustainable Development Goals');
  });

  it('returns localized no-match and ambiguous answers', () => {
    const noMatch = buildKnowledgeAnswer({ status: 'NO_MATCH', matches: [], warnings: [] }, 'en');
    const ambiguous = buildKnowledgeAnswer({ status: 'AMBIGUOUS', matches: [], warnings: ['KNOWLEDGE_AMBIGUOUS'] }, 'ms');

    expect(noMatch.answer).toContain('does not contain a verified answer');
    expect(ambiguous.answer).toContain('Sila nyatakan');
    expect(ambiguous.warnings).toContain('KNOWLEDGE_AMBIGUOUS');
  });

  it('preserves source metadata separately while excluding paths from prose', () => {
    const answer = buildKnowledgeAnswer({ status: 'FOUND', matches: [match()], warnings: [] }, 'en');

    expect(answer.sources).toEqual([expect.objectContaining({
      id: 'about',
      publisher: 'Borneo Tracker interface copy',
      title: 'Borneo Tracker Overview',
      sourceFile: 'src/i18n/locales/en.json',
      sourcePath: 'about.overview',
    })]);
    expect(answer.answer).not.toContain('src/i18n');
    expect(answer.answer).not.toContain('about.overview');
  });

  it('extracts approved numeric and year tokens from selected content', () => {
    const answer = buildKnowledgeAnswer({
      status: 'FOUND',
      matches: [match({ record: { content: 'The method uses a 0-100 scale and was documented in 2026.' } })],
      warnings: [],
    }, 'en');

    expect(answer.approvedNumericTokens).toEqual(expect.arrayContaining(['0', '100']));
    expect(answer.approvedYearTokens).toContain('2026');
  });
});

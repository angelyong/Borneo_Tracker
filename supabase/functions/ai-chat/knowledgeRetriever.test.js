import { describe, expect, it } from 'vitest';
import { KnowledgeRepository } from './knowledgeRepository.ts';
import { retrieveStaticKnowledge } from './knowledgeRetriever.ts';

function record(overrides = {}) {
  return {
    id: 'about',
    title: 'Borneo Tracker Overview',
    content: 'Borneo Tracker brings trusted data together for users.',
    category: 'site-overview',
    language: 'en',
    pageUrl: '/about',
    region: null,
    regions: [],
    concept: null,
    sdgTags: [],
    relatedSdgs: [],
    keywords: ['borneo tracker', 'overview'],
    searchableText: 'borneo tracker overview trusted data',
    sourceFile: 'fixture.json',
    sourceType: 'json',
    status: 'verified',
    placeholder: false,
    runtimeIncluded: true,
    ...overrides,
  };
}

function repository(records) {
  return new KnowledgeRepository({ artifact: { records } });
}

describe('static knowledge retriever', () => {
  it('matches exact title phrases', () => {
    const result = retrieveStaticKnowledge({
      question: 'What is Borneo Tracker Overview?',
      language: 'en',
      territories: [],
      concepts: [],
    }, repository([record()]));

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('about');
    expect(result.matches[0].matchedBy).toContain('exact-title');
  });

  it('matches keywords, concepts, and categories deterministically', () => {
    const result = retrieveStaticKnowledge({
      question: 'Explain forest cover reports.',
      language: 'en',
      territories: [],
      concepts: ['forest_cover'],
    }, repository([
      record({ id: 'forest', title: 'Forest Cover', category: 'reports', concept: 'forest_cover', keywords: ['forest cover'] }),
      record({ id: 'dashboard', title: 'Dashboard', category: 'dashboard', keywords: ['dashboard'] }),
    ]));

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('forest');
    expect(result.matches[0].matchedBy).toEqual(expect.arrayContaining(['keyword:forest cover', 'concept:forest_cover', 'category:reports']));
  });

  it('uses page context as a boost without overriding explicit wording', () => {
    const repo = repository([
      record({ id: 'esg', title: 'ESG Page', category: 'esg-indicators', pageUrl: '/esg', keywords: ['esg'] }),
      record({ id: 'report', title: 'Generate Report', category: 'generate-report', pageUrl: '/reports', keywords: ['generate report'] }),
    ]);
    const result = retrieveStaticKnowledge({
      question: 'How do I generate a report?',
      language: 'en',
      currentPage: '/esg',
      territories: [],
      concepts: [],
    }, repo);

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('report');
  });

  it('matches Malay records and falls back to English only for strong topic matches', () => {
    const repo = repository([
      record({ id: 'report-en', title: 'Generate Report', category: 'generate-report', pageUrl: '/reports', keywords: ['generate report'] }),
      record({ id: 'site-ms', title: 'Gambaran Keseluruhan', content: 'Laman ini menerangkan data Borneo.', language: 'ms', keywords: ['laman'] }),
    ]);

    const malay = retrieveStaticKnowledge({
      question: 'Bagaimana menggunakan laman ini?',
      language: 'ms',
      currentPage: '/about',
      territories: [],
      concepts: [],
    }, repo);
    const fallback = retrieveStaticKnowledge({
      question: 'Bagaimana generate report?',
      language: 'ms',
      currentPage: '/reports',
      territories: [],
      concepts: [],
    }, repo);

    expect(malay.status).toBe('FOUND');
    expect(malay.matches[0].record.id).toBe('site-ms');
    expect(fallback.status).toBe('LANGUAGE_FALLBACK');
    expect(fallback.warnings).toContain('LANGUAGE_FALLBACK');
  });

  it('returns no match for weak guesses and prevents substring false positives', () => {
    const result = retrieveStaticKnowledge({
      question: 'art',
      language: 'en',
      territories: [],
      concepts: [],
    }, repository([
      record({ id: 'quarterly', title: 'Quarterly Reports', content: 'Quarterly reports are available.', keywords: ['quarterly'] }),
    ]));

    expect(result.status).toBe('NO_MATCH');
  });

  it('returns ambiguous when close matches represent different topics', () => {
    const result = retrieveStaticKnowledge({
      question: 'overview',
      language: 'en',
      territories: [],
      concepts: [],
    }, repository([
      record({ id: 'dashboard', title: 'Dashboard Help', category: 'dashboard', keywords: ['overview'] }),
      record({ id: 'community', title: 'Community Help', category: 'community', keywords: ['overview'] }),
    ]));

    expect(result.status).toBe('AMBIGUOUS');
    expect(result.matches.map((match) => match.record.id)).toEqual(['community', 'dashboard']);
  });

  it('limits results and preserves stable ordering', () => {
    const result = retrieveStaticKnowledge({
      question: 'overview',
      language: 'en',
      territories: [],
      concepts: [],
      limit: 1,
    }, repository([
      record({ id: 'b', title: 'Overview Beta', keywords: ['overview'] }),
      record({ id: 'a', title: 'Overview Alpha', keywords: ['overview'] }),
    ]));

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].record.id).toBe('a');
  });
});

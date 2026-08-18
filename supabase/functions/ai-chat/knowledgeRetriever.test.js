import { describe, expect, it } from 'vitest';
import { buildKnowledgeAnswer } from './knowledgeAnswerBuilder.ts';
import { KnowledgeRepository } from './knowledgeRepository.ts';
import { retrieveStaticKnowledge } from './knowledgeRetriever.ts';

const MONITORED_SDGS = [
  'SDG1 - No Poverty',
  'SDG2 - Zero Hunger',
  'SDG3 - Good Health',
  'SDG4 - Quality Education',
  'SDG6 - Clean Water',
  'SDG7 - Clean Energy',
  'SDG8 - Economic Growth',
  'SDG9 - Industry & Innovation',
  'SDG11 - Sustainable Cities',
  'SDG13 - Climate Action',
  'SDG15 - Life on Land',
  'SDG16 - Peace & Justice',
];

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
  it.each([
    ['What is the difference between ESG and SDG?', ['esg-vs-sdg']],
    ['Explain the Forest Cover indicator.', ['indicator-forest-cover']],
    ['Which SDGs are monitored by Borneo Tracker?', ['sdg-monitored-goals']],
    ['Where does the environmental data come from?', ['environmental-data-sources']],
    ['How do I generate a report?', ['generate-report-how-to']],
  ])('selects packaged verified knowledge for suggested question: %s', (question, expectedIds) => {
    const result = retrieveStaticKnowledge({
      question,
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 3,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches.map((match) => match.record.id)).toEqual(expect.arrayContaining(expectedIds));
    expect(result.matches.every((match) => match.record.runtimeIncluded && match.record.status === 'verified' && !match.record.placeholder)).toBe(true);
  });

  it.each([
    'What is the difference between ESG and SDG?',
    'How are ESG and SDG different?',
    'What is ESG compared with SDG?',
    'Explain ESG versus SDG in Borneo Tracker.',
  ])('prefers the ESG versus SDG comparison record for: %s', (question) => {
    const result = retrieveStaticKnowledge({
      question,
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('esg-vs-sdg');
    expect(result.matches[0].record.status).toBe('verified');
    expect(result.matches[0].record.placeholder).toBe(false);
    expect(result.matches[0].record.runtimeIncluded).toBe(true);
    expect(result.matches[0].record.category).toBe('reports');
    expect(result.matches[0].matchedBy).toContain('query-hint:esg-vs-sdg');
    expect(result.matches[0].record.id).not.toBe('about-borneo-tracker-en');
  });

  it('builds a deterministic ESG versus SDG answer without ESG empty-state text', () => {
    const retrieval = retrieveStaticKnowledge({
      question: 'What is the difference between ESG and SDG?',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());
    const answer = buildKnowledgeAnswer(retrieval, 'en');

    expect(answer.recordIds).toEqual(['esg-vs-sdg']);
    expect(answer.answer).toContain('ESG groups tracked indicators into the Environment, Social, and Governance pillars.');
    expect(answer.answer).toContain('SDG coverage maps the same tracked indicators to the UN Sustainable Development Goals they inform.');
    expect(answer.answer).toContain('ESG is the pillar-based view');
    expect(answer.answer).toContain('SDG is the goal-based view');
    expect(answer.answer).toContain('same tracked indicator dataset');
    expect(answer.answer).not.toContain('No canonical indicators are available for this pillar yet.');
  });

  it('keeps single-concept ESG questions on ESG-specific knowledge', () => {
    const result = retrieveStaticKnowledge({
      question: 'What is ESG?',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('esg-indicators-page-en');
    expect(result.matches[0].record.id).not.toBe('esg-vs-sdg');
  });

  it('keeps single-concept SDG questions on SDG-specific knowledge', () => {
    const result = retrieveStaticKnowledge({
      question: 'What are SDGs?',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('sdg-progress-page-en');
    expect(result.matches[0].record.id).not.toBe('esg-vs-sdg');
  });

  it.each([
    'Explain the Forest Cover indicator.',
    'What does Forest Cover mean?',
    'What is the Forest Cover indicator?',
    'How is Forest Cover measured in Borneo Tracker?',
  ])('prefers the verified Forest Cover indicator record for: %s', (question) => {
    const result = retrieveStaticKnowledge({
      question,
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: question === 'What does Forest Cover mean?' ? ['forest_cover'] : [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('indicator-forest-cover');
    expect(result.matches[0].record.status).toBe('verified');
    expect(result.matches[0].record.placeholder).toBe(false);
    expect(result.matches[0].record.runtimeIncluded).toBe(true);
    expect(result.matches[0].matchedBy).toContain('query-hint:forest-cover-indicator');
    expect(result.matches[0].record.id).not.toBe('report-concept-forest-cover');
  });

  it.each([
    'Where does the Forest Cover data come from?',
    'What is the source of the Forest Cover data?',
  ])('uses the Forest Cover source-aware record for: %s', (question) => {
    const result = retrieveStaticKnowledge({
      question,
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: ['forest_cover'],
      limit: 5,
    }, new KnowledgeRepository());
    const answer = buildKnowledgeAnswer(result, 'en');

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('indicator-forest-cover');
    expect(answer.recordIds).toEqual(['indicator-forest-cover']);
    expect(answer.answer).toContain('Brunei uses % land from World Bank');
    expect(answer.answer).toContain('Sabah, Sarawak, and Kalimantan currently use year-2000 forest extent in hectares from Global Forest Watch');
    expect(answer.answer).toContain('should not be directly compared with the hectare baselines');
  });

  it('builds a complete deterministic Forest Cover answer without unsupported claims', () => {
    const retrieval = retrieveStaticKnowledge({
      question: 'Explain the Forest Cover indicator.',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());
    const answer = buildKnowledgeAnswer(retrieval, 'en');

    expect(answer.recordIds).toEqual(['indicator-forest-cover']);
    expect(answer.answer).toContain('Forest Cover measures remaining forest');
    expect(answer.answer).toContain('amount or share of land under forest');
    expect(answer.answer).toContain('ESG Environment');
    expect(answer.answer).toContain('SDG15 - Life on Land');
    expect(answer.answer).toContain('EUDR-style sourcing checks');
    expect(answer.answer).toContain('higher values as better');
    expect(answer.answer).toContain('not expressed in one uniform unit');
    expect(answer.answer).toContain('Brunei uses % land from World Bank');
    expect(answer.answer).toContain('Global Forest Watch');
    expect(answer.answer).toContain('should not be directly compared with the hectare baselines');
    expect(answer.answer).not.toContain('EUDR checks');
    expect(answer.answer).not.toContain('time series');
    expect(answer.answer).not.toContain('historical series');
    expect(answer.answer).not.toContain('EUDR compliance');
    expect(answer.answer).not.toContain('establishes legal compliance');
  });

  it.each([
    'How do I generate a report?',
    'How can I create a report?',
    'How do I download a report?',
    'How do I create a PDF report?',
    'What steps are needed to generate a report?',
  ])('prefers the Generate Report how-to record for: %s', (question) => {
    const result = retrieveStaticKnowledge({
      question,
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('generate-report-how-to');
    expect(result.matches[0].record.status).toBe('verified');
    expect(result.matches[0].record.placeholder).toBe(false);
    expect(result.matches[0].record.runtimeIncluded).toBe(true);
    expect(result.matches[0].matchedBy).toContain('query-hint:generate-report-how-to');
  });

  it('builds a deterministic Generate Report how-to answer without raw UI fragments', () => {
    const retrieval = retrieveStaticKnowledge({
      question: 'How do I generate a report?',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());
    const answer = buildKnowledgeAnswer(retrieval, 'en');

    expect(answer.recordIds).toEqual(['generate-report-how-to']);
    expect(answer.answer).toContain('Select a territory, or choose All Borneo.');
    expect(answer.answer).toContain('Choose the optional report sections you want to include');
    expect(answer.answer).toContain('Click Generate & Download PDF.');
    expect(answer.answer).toContain('reports that limitation instead of inventing unsupported content');
    expect(answer.answer).not.toContain('1. Select Territory 2. Include Sections');
    expect(answer.answer).not.toContain('No indicators are available for this selection.');
  });

  it('keeps Generate Report page-description questions on the page overview record', () => {
    const result = retrieveStaticKnowledge({
      question: 'What is the Generate Report page?',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('generate-report-page-en');
    expect(result.matches[0].record.id).not.toBe('generate-report-how-to');

    const answer = buildKnowledgeAnswer(result, 'en');
    expect(answer.recordIds).toEqual(['generate-report-page-en']);
    expect(answer.answer).not.toContain('Select a territory, or choose All Borneo.');
  });

  it.each([
    'Which SDGs are monitored by Borneo Tracker?',
    'What SDGs does Borneo Tracker monitor?',
    'Which Sustainable Development Goals are tracked?',
    'Show me the SDGs covered by Borneo Tracker.',
  ])('prefers the monitored SDG coverage record for: %s', (question) => {
    const result = retrieveStaticKnowledge({
      question,
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('sdg-monitored-goals');
    expect(result.matches[0].record.status).toBe('verified');
    expect(result.matches[0].record.placeholder).toBe(false);
    expect(result.matches[0].record.runtimeIncluded).toBe(true);
  });

  it('builds a deterministic monitored SDG answer without single-goal empty-state text', () => {
    const retrieval = retrieveStaticKnowledge({
      question: 'Which SDGs are monitored by Borneo Tracker?',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());
    const answer = buildKnowledgeAnswer(retrieval, 'en');

    expect(answer.recordIds).toEqual(['sdg-monitored-goals']);
    for (const goal of MONITORED_SDGS) {
      expect(answer.answer).toContain(goal);
    }
    expect(answer.answer).not.toContain('No canonical indicators are available for this goal');
  });

  it('keeps specific single-SDG questions off the monitored-goals list record', () => {
    const result = retrieveStaticKnowledge({
      question: 'What does Borneo Tracker show for SDG 15?',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('about-borneo-tracker-en');
    expect(result.matches[0].record.id).not.toBe('sdg-monitored-goals');
  });

  it.each([
    'Where does the environmental data come from?',
    'Where does Borneo Tracker get its environmental data?',
    'What are the sources of the environmental data?',
    'What is the source of the environmental indicators?',
  ])('prefers environmental data source provenance record for: %s', (question) => {
    const result = retrieveStaticKnowledge({
      question,
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 5,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('environmental-data-sources');
    expect(result.matches[0].record.status).toBe('verified');
    expect(result.matches[0].record.placeholder).toBe(false);
    expect(result.matches[0].record.runtimeIncluded).toBe(true);
    expect(result.matches.map((match) => match.record.id)).not.toEqual(['about-borneo-tracker-en']);
  });

  it('keeps the product overview question on the site overview record', () => {
    const result = retrieveStaticKnowledge({
      question: 'What is Borneo Tracker?',
      language: 'en',
      currentPage: '/',
      territories: [],
      concepts: [],
      limit: 3,
    }, new KnowledgeRepository());

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('about-borneo-tracker-en');
  });

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

  it('prefers the verified Malay Borneo Tracker record for Malay product questions', () => {
    const result = retrieveStaticKnowledge({
      question: 'Apakah Borneo Tracker?',
      language: 'ms',
      currentPage: '/about',
      territories: [],
      concepts: [],
    }, repository([
      record({ id: 'about-en', language: 'en', keywords: ['borneo tracker'], content: 'Borneo Tracker brings trusted data together.' }),
      record({ id: 'about-ms', language: 'ms', title: 'Memahami Borneo', keywords: ['borneo tracker'], content: 'Borneo Tracker menggabungkan data yang disahkan.' }),
    ]));

    expect(result.status).toBe('FOUND');
    expect(result.matches[0].record.id).toBe('about-ms');
    expect(result.matches[0].record.language).toBe('ms');
  });

  it('returns no-match when the user explicitly asks for content outside the knowledge base', () => {
    const result = retrieveStaticKnowledge({
      question: 'Tell me something about Borneo Tracker that is not in your knowledge base.',
      language: 'en',
      territories: [],
      concepts: [],
    }, repository([record({ id: 'about-en', keywords: ['borneo tracker'] })]));

    expect(result.status).toBe('NO_MATCH');
    expect(result.matches).toEqual([]);
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

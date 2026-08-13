import { describe, expect, it } from 'vitest';
import { KnowledgeRepository } from './knowledgeRepository.ts';

function record(overrides = {}) {
  return {
    id: 'about-borneo-tracker-en',
    title: 'What is Borneo Tracker',
    content: 'Borneo Tracker explains verified sustainability knowledge.',
    category: 'site-overview',
    language: 'en',
    pageUrl: '/about',
    region: null,
    regions: [],
    concept: null,
    sdgTags: [],
    relatedSdgs: [],
    keywords: ['borneo tracker'],
    searchableText: 'what is borneo tracker',
    sourceFile: 'src/i18n/locales/en.json',
    sourceType: 'json',
    sourceId: 'site-copy-en',
    sourcePath: 'about.overview',
    sourceName: 'Borneo Tracker interface copy',
    sourceUrl: '',
    status: 'verified',
    placeholder: false,
    runtimeIncluded: true,
    provenance: { sourceFile: 'src/i18n/locales/en.json', sourceType: 'json' },
    ...overrides,
  };
}

describe('KnowledgeRepository', () => {
  it('loads the packaged runtime index', () => {
    const repository = new KnowledgeRepository();
    const records = repository.getAllRuntimeRecords();

    expect(records).toHaveLength(86);
    expect(records.every((item) => item.runtimeIncluded)).toBe(true);
    expect(records.every((item) => item.status === 'verified')).toBe(true);
  });

  it('keeps runtime included verified records only', () => {
    const repository = new KnowledgeRepository({
      artifact: { records: [
        record({ id: 'ok' }),
        record({ id: 'not-runtime', runtimeIncluded: false }),
        record({ id: 'placeholder', placeholder: true }),
        record({ id: 'incomplete', status: 'incomplete' }),
      ] },
    });

    expect(repository.getAllRuntimeRecords().map((item) => item.id)).toEqual(['ok']);
  });

  it('rejects malformed records and placeholder-like content', () => {
    const repository = new KnowledgeRepository({
      artifact: { records: [
        record({ id: 'ok' }),
        { id: 'missing-required-fields' },
        record({ id: 'mock', content: 'Coming soon placeholder content.' }),
      ] },
    });

    expect(repository.getAllRuntimeRecords().map((item) => item.id)).toEqual(['ok']);
  });

  it('supports injected fixture lookups', () => {
    const repository = new KnowledgeRepository({
      artifact: [
        record({ id: 'en', language: 'en', category: 'dashboard' }),
        record({ id: 'ms', language: 'ms', category: 'dashboard' }),
      ],
    });

    expect(repository.getByLanguage('ms').map((item) => item.id)).toEqual(['ms']);
    expect(repository.getByCategory('dashboard').map((item) => item.id)).toEqual(['en', 'ms']);
    expect(repository.getByIds(['ms']).map((item) => item.id)).toEqual(['ms']);
  });
});

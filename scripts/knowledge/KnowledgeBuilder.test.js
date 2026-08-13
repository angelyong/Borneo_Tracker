import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { JsonContentExtractor } from './JsonContentExtractor.js';
import { MarkdownContentExtractor } from './MarkdownContentExtractor.js';
import { PageContentExtractor } from './PageContentExtractor.js';
import { KnowledgeRecordNormalizer } from './KnowledgeRecordNormalizer.js';
import { KnowledgeValidator } from './KnowledgeValidator.js';
import { KnowledgeDeduplicator } from './KnowledgeDeduplicator.js';
import { KnowledgeWriter } from './KnowledgeWriter.js';
import { KnowledgeBuilder } from './KnowledgeBuilder.js';
import { ContentSourceScanner, isSafeSourcePath } from './ContentSourceScanner.js';

const source = {
  id: 'test-source',
  type: 'json',
  category: 'faq',
  path: 'knowledge/faq.json',
  repoPath: 'knowledge/faq.json',
  fullPath: path.resolve('knowledge/faq.json'),
};

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function runtimeKnowledgeSummary(index) {
  const normalizeRecord = (record) => ({
    id: record.id,
    title: record.title,
    category: record.category,
    content: record.content,
    language: record.language,
    pageUrl: record.pageUrl,
    region: record.region,
    regions: record.regions,
    concept: record.concept,
    sdgTags: record.sdgTags,
    relatedSdgs: record.relatedSdgs,
    keywords: record.keywords,
    searchableText: record.searchableText,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    status: record.status,
    placeholder: record.placeholder,
    runtimeIncluded: record.runtimeIncluded,
  });
  return {
    schemaVersion: index.schemaVersion,
    recordCount: index.recordCount,
    records: [...(index.records || [])].map(normalizeRecord).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

describe('knowledge extraction', () => {
  it('extracts valid JSON source records', () => {
    const records = new JsonContentExtractor().extract([{ id: 'faq', title: 'FAQ', content: 'Approved FAQ text.' }], source);
    expect(records).toHaveLength(1);
    expect(records[0].title).toBe('FAQ');
  });

  it('extracts valid Markdown sections', () => {
    const records = new MarkdownContentExtractor().extract('# Overview\n\nBorneo Tracker approved documentation content for users with enough detail to become a useful static knowledge record.', {
      ...source,
      id: 'md',
      type: 'markdown',
    });
    expect(records[0].title).toBe('Overview');
    expect(records[0].content).toContain('Borneo Tracker');
  });

  it('extracts report content records from page source', () => {
    const sourceText = "export const INDICATOR_EXPLANATIONS = { 'Forest cover': 'Share of land still under forest and a headline conservation indicator.' };\nconst CONCEPT_EXPLANATIONS = {\n  food: 'A food-production or agricultural-land indicator.'\n};";
    const records = new PageContentExtractor().extract(sourceText, { kind: 'report-content' });
    expect(records.map((record) => record.title)).toContain('Forest cover');
    expect(records.map((record) => record.concept)).toContain('food');
  });

  it('extracts the monitored SDG coverage record from indicator configuration', () => {
    const sourceText = "export const SDG_GOALS = [\n  { goal: 'SDG1', label: 'No Poverty' },\n  { goal: 'SDG15', label: 'Life on Land' },\n];";
    const records = new PageContentExtractor().extract(sourceText, { kind: 'indicator-config' });

    expect(records).toEqual([expect.objectContaining({
      id: 'sdg-monitored-goals',
      title: 'SDGs Monitored by Borneo Tracker',
      category: 'sdg-progress',
      pageUrl: '/sdg',
      sourcePath: 'SDG_GOALS',
      sourceName: 'Borneo Tracker indicator configuration',
      status: 'verified',
    })]);
    expect(records[0].content).toContain('SDG1 - No Poverty');
    expect(records[0].content).toContain('SDG15 - Life on Land');
    expect(records[0].keywords).toEqual(expect.arrayContaining(['monitored SDGs', 'SDG coverage']));
  });

  it('extracts the ESG versus SDG comparison record from report sections', () => {
    const sourceText = [
      '<h2>ESG Indicators</h2>',
      'All tracked indicators, grouped Environment · Social · Governance.',
      '<h2>SDG Coverage</h2>',
      'The same indicators mapped to the UN Sustainable Development Goals they inform — for readers working from SDGs, not ESG pillars.',
    ].join('\n');
    const records = new PageContentExtractor().extract(sourceText, { kind: 'report-sections' });

    expect(records).toEqual([expect.objectContaining({
      id: 'esg-vs-sdg',
      title: 'ESG and SDG in Borneo Tracker',
      category: 'reports',
      pageUrl: '/reports',
      sourcePath: 'EsgIndicatorSection/SdgCoverageSection',
      sourceName: 'Borneo Tracker report sections',
      status: 'verified',
    })]);
    expect(records[0].content).toContain('ESG groups tracked indicators into the Environment, Social, and Governance pillars.');
    expect(records[0].content).toContain('SDG coverage maps the same tracked indicators to the UN Sustainable Development Goals they inform.');
    expect(records[0].keywords).toEqual(expect.arrayContaining(['ESG vs SDG', 'pillar-based', 'goal-based']));
  });

  it('extracts policy sections as incomplete records', () => {
    const sourceText = "const privacySections = [{ id: 'privacy-introduction', title: 'Introduction', body: ['This mock Privacy Policy explains how Borneo Tracker handles prototype information.'] },];";
    const records = new PageContentExtractor().extract(sourceText, { kind: 'policy' });
    expect(records[0]).toMatchObject({
      status: 'incomplete',
      category: 'policies',
      pageUrl: '/privacy-policy',
    });
  });

  it('generates stable record IDs', () => {
    const normalizer = new KnowledgeRecordNormalizer();
    const a = normalizer.normalize({ title: 'Forest Cover', content: 'Definition text.' }, source);
    const b = normalizer.normalize({ title: 'Forest Cover', content: 'Definition text.' }, source);
    expect(a.id).toBe(b.id);
  });
});

describe('knowledge validation and safety', () => {
  it('rejects missing required fields and empty content', () => {
    const result = new KnowledgeValidator().validateRecord({ id: 'bad', title: 'Bad' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Empty content');
  });

  it('preserves placeholder handling without marking placeholders verified', () => {
    const record = new KnowledgeRecordNormalizer().normalize({
      title: 'Placeholder',
      content: 'Placeholder content: replace later.',
    }, source);
    expect(record.status).toBe('placeholder');
  });

  it('keeps bilingual records distinct when content maps to the same source path', () => {
    const normalizer = new KnowledgeRecordNormalizer();
    const en = normalizer.normalize({
      id: 'about-overview-en',
      title: 'About',
      content: 'Borneo Tracker brings sustainability indicators together for public awareness.',
      language: 'en',
      sourcePath: 'about.overview',
    }, source);
    const ms = normalizer.normalize({
      id: 'about-overview-ms',
      title: 'Mengenai',
      content: 'Borneo Tracker menggabungkan penunjuk kemampanan untuk kesedaran awam.',
      language: 'ms',
      sourcePath: 'about.overview',
    }, source);
    const result = new KnowledgeDeduplicator().deduplicate([en, ms]);
    expect(result.unique).toHaveLength(2);
  });

  it('keeps provenance metadata on normalized records', () => {
    const record = new KnowledgeRecordNormalizer().normalize({
      title: 'Data Policy',
      content: 'Borneo Tracker should display source attribution and data quality limitations.',
      sourcePath: 'data-source-attribution',
      pageUrl: '/data-policy',
    }, source);
    expect(record.provenance).toMatchObject({
      sourceFile: 'knowledge/faq.json',
      sourceType: 'json',
      sourceId: 'test-source',
      pageUrl: '/data-policy',
    });
  });

  it('detects duplicates', () => {
    const dedupe = new KnowledgeDeduplicator();
    const records = [
      { id: 'a', title: 'Same', content: 'Same content', sourceFile: 'x.json' },
      { id: 'b', title: 'Same', content: 'Same content', sourceFile: 'x.json' },
    ];
    const result = dedupe.deduplicate(records);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('excludes secret and environment file sources', () => {
    expect(isSafeSourcePath('.env')).toBe(false);
    expect(isSafeSourcePath('node_modules/pkg/file.json')).toBe(false);
    expect(isSafeSourcePath('src/i18n/locales/en.json')).toBe(true);
  });

  it('does not fabricate numerical content during normalization', () => {
    const record = new KnowledgeRecordNormalizer().normalize({
      title: 'Forest Cover',
      content: 'Forest cover means remaining forest area.',
    }, source);
    expect(record.content).not.toMatch(/\b\d/);
  });
});

describe('knowledge build output', () => {
  it('creates a generated index', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-writer-'));
    const runtimePath = path.join(tmp, 'runtime', 'knowledge-index.json');
    const writer = new KnowledgeWriter(tmp, runtimePath);
    const record = new KnowledgeRecordNormalizer().normalize({
      title: 'Borneo Tracker',
      content: 'Approved content about the website.',
      status: 'verified',
    }, source);
    writer.write([record], { buildTimestamp: '2026-07-18T00:00:00.000Z' });
    const index = JSON.parse(fs.readFileSync(path.join(tmp, 'knowledge-index.json'), 'utf8'));
    expect(index.records).toHaveLength(1);
    expect(fs.existsSync(runtimePath)).toBe(true);
  });

  it('excludes placeholders from generated runtime records while reporting them', () => {
    const scanner = {
      loadSources: () => [{
        ...source,
        enabled: true,
        safe: true,
        exists: true,
      }],
    };
    const jsonExtractor = {
      extract: () => [
        { title: 'Verified', content: 'Verified knowledge about Borneo Tracker public data sources.' },
        { title: 'Placeholder', content: 'Placeholder content: replace later.' },
      ],
    };
    const result = new KnowledgeBuilder({ scanner, jsonExtractor }).run({ validateOnly: true });
    expect(result.records).toHaveLength(1);
    expect(result.report.placeholderRecords).toHaveLength(1);
  });

  it('writes deterministic index output for the same input', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-deterministic-'));
    const writer = new KnowledgeWriter(path.join(tmp, 'a'), path.join(tmp, 'runtime-a.json'));
    const writerAgain = new KnowledgeWriter(path.join(tmp, 'b'), path.join(tmp, 'runtime-b.json'));
    const record = new KnowledgeRecordNormalizer().normalize({
      id: 'stable',
      title: 'Stable',
      content: 'Stable public knowledge content for deterministic output.',
      status: 'verified',
    }, source);
    const report = { buildTimestamp: '1970-01-01T00:00:00.000Z' };
    writer.write([record], report);
    writerAgain.write([record], report);
    const first = fs.readFileSync(path.join(tmp, 'a', 'knowledge-index.json'), 'utf8');
    const second = fs.readFileSync(path.join(tmp, 'b', 'knowledge-index.json'), 'utf8');
    expect(first).toBe(second);
  });

  it('keeps the packaged Edge Function knowledge index in parity with the generated index', () => {
    const canonical = JSON.parse(fs.readFileSync(path.resolve('knowledge/generated/knowledge-index.json'), 'utf8'));
    const packaged = JSON.parse(fs.readFileSync(path.resolve('supabase/functions/ai-chat/knowledge-index.json'), 'utf8'));
    const canonicalSummary = runtimeKnowledgeSummary(canonical);
    const packagedSummary = runtimeKnowledgeSummary(packaged);

    expect(packagedSummary).toEqual(canonicalSummary);

    const stalePackagedSummary = {
      ...packagedSummary,
      records: packagedSummary.records.map((record, index) => index === 0 ? { ...record, content: `${record.content} stale` } : record),
    };
    expect(stableHash(stalePackagedSummary)).not.toBe(stableHash(canonicalSummary));
  });

  it('includes the verified environmental data source record in generated and packaged indexes', () => {
    const canonical = JSON.parse(fs.readFileSync(path.resolve('knowledge/generated/knowledge-index.json'), 'utf8'));
    const packaged = JSON.parse(fs.readFileSync(path.resolve('supabase/functions/ai-chat/knowledge-index.json'), 'utf8'));
    const canonicalRecord = canonical.records.find((record) => record.id === 'environmental-data-sources');
    const packagedRecord = packaged.records.find((record) => record.id === 'environmental-data-sources');

    expect(canonicalRecord).toMatchObject({
      id: 'environmental-data-sources',
      title: 'Environmental Data Sources',
      category: 'data-sources',
      language: 'en',
      pageUrl: '/data-policy',
      status: 'verified',
      placeholder: false,
      runtimeIncluded: true,
      sourceFile: 'src/pages/policies/PolicyPage.jsx',
      sourceType: 'page',
      sourceId: 'policy-page',
      sourcePath: 'data-sources',
      sourceName: 'Borneo Tracker policy page',
    });
    expect(canonicalRecord.content).toContain('World Bank');
    expect(canonicalRecord.content).toContain('Global Forest Watch');
    expect(canonicalRecord.content).toContain('WAQI / aqicn');
    expect(canonicalRecord.keywords).toEqual(expect.arrayContaining([
      'environmental data',
      'data sources',
      'provenance',
      'source attribution',
    ]));
    expect(packagedRecord).toEqual(canonicalRecord);
  });

  it('includes the verified monitored SDG record and keeps generic SDG page copy clean', () => {
    const canonical = JSON.parse(fs.readFileSync(path.resolve('knowledge/generated/knowledge-index.json'), 'utf8'));
    const packaged = JSON.parse(fs.readFileSync(path.resolve('supabase/functions/ai-chat/knowledge-index.json'), 'utf8'));
    const canonicalRecord = canonical.records.find((record) => record.id === 'sdg-monitored-goals');
    const packagedRecord = packaged.records.find((record) => record.id === 'sdg-monitored-goals');
    const sdgPageRecord = canonical.records.find((record) => record.id === 'sdg-progress-page-en');

    expect(canonicalRecord).toMatchObject({
      id: 'sdg-monitored-goals',
      title: 'SDGs Monitored by Borneo Tracker',
      category: 'sdg-progress',
      language: 'en',
      pageUrl: '/sdg',
      status: 'verified',
      placeholder: false,
      runtimeIncluded: true,
      sourceFile: 'src/data/useIndicators.js',
      sourceType: 'page',
      sourceId: 'indicator-config',
      sourcePath: 'SDG_GOALS',
      sourceName: 'Borneo Tracker indicator configuration',
    });
    for (const goal of [
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
    ]) {
      expect(canonicalRecord.content).toContain(goal);
    }
    expect(canonicalRecord.content).not.toContain('No canonical indicators are available for this goal');
    expect(sdgPageRecord.content).not.toContain('No canonical indicators are available for this goal');
    expect(packagedRecord).toEqual(canonicalRecord);
  });

  it('includes the verified ESG versus SDG record and keeps generic ESG page copy clean', () => {
    const canonical = JSON.parse(fs.readFileSync(path.resolve('knowledge/generated/knowledge-index.json'), 'utf8'));
    const packaged = JSON.parse(fs.readFileSync(path.resolve('supabase/functions/ai-chat/knowledge-index.json'), 'utf8'));
    const canonicalRecord = canonical.records.find((record) => record.id === 'esg-vs-sdg');
    const packagedRecord = packaged.records.find((record) => record.id === 'esg-vs-sdg');
    const esgPageRecord = canonical.records.find((record) => record.id === 'esg-indicators-page-en');

    expect(canonicalRecord).toMatchObject({
      id: 'esg-vs-sdg',
      title: 'ESG and SDG in Borneo Tracker',
      category: 'reports',
      language: 'en',
      pageUrl: '/reports',
      status: 'verified',
      placeholder: false,
      runtimeIncluded: true,
      sourceFile: 'src/pages/reports/ReportSections.jsx',
      sourceType: 'page',
      sourceId: 'report-sections',
      sourcePath: 'EsgIndicatorSection/SdgCoverageSection',
      sourceName: 'Borneo Tracker report sections',
    });
    expect(canonicalRecord.content).toContain('ESG groups tracked indicators into the Environment, Social, and Governance pillars.');
    expect(canonicalRecord.content).toContain('SDG coverage maps the same tracked indicators to the UN Sustainable Development Goals they inform.');
    expect(canonicalRecord.content).toContain('pillar-based view');
    expect(canonicalRecord.content).toContain('goal-based view');
    expect(canonicalRecord.content).toContain('same tracked indicator dataset');
    expect(esgPageRecord.content).not.toContain('No canonical indicators are available for this pillar yet.');
    expect(packagedRecord).toEqual(canonicalRecord);
  });

  it('handles missing sources as a critical validation failure', () => {
    const scanner = {
      loadSources: () => [{
        id: 'missing',
        type: 'json',
        path: 'docs/missing.json',
        enabled: true,
        safe: true,
        exists: false,
        repoPath: 'docs/missing.json',
      }],
    };
    const result = new KnowledgeBuilder({ scanner }).run({ validateOnly: true });
    expect(result.ok).toBe(false);
    expect(result.report.missingSources).toHaveLength(1);
  });

  it('handles malformed source files as a critical validation failure', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-bad-source-'));
    const badPath = path.join(tmp, 'bad.json');
    fs.writeFileSync(badPath, '{not valid json');
    const scanner = {
      loadSources: () => [{
        id: 'bad-json',
        type: 'json',
        path: 'bad.json',
        enabled: true,
        safe: true,
        exists: true,
        fullPath: badPath,
        repoPath: 'knowledge/faq.json',
      }],
    };
    const result = new KnowledgeBuilder({ scanner }).run({ validateOnly: true });
    expect(result.ok).toBe(false);
    expect(result.report.errors[0]).toContain('Failed to process bad-json');
  });

  it('loads repository source configuration without enabling missing files', () => {
    const scanner = new ContentSourceScanner();
    const enabled = scanner.loadSources().filter((item) => item.enabled);
    expect(enabled.every((item) => item.exists)).toBe(true);
  });
});

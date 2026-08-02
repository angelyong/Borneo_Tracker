import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

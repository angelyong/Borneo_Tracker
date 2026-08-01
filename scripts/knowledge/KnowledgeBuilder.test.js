import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonContentExtractor } from './JsonContentExtractor.js';
import { MarkdownContentExtractor } from './MarkdownContentExtractor.js';
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
    const records = new MarkdownContentExtractor().extract('# Overview\n\nBorneo Tracker approved documentation content for users.', {
      ...source,
      id: 'md',
      type: 'markdown',
    });
    expect(records[0].title).toBe('Overview');
    expect(records[0].content).toContain('Borneo Tracker');
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
    const writer = new KnowledgeWriter(tmp);
    const record = new KnowledgeRecordNormalizer().normalize({
      title: 'Borneo Tracker',
      content: 'Approved content about the website.',
      status: 'verified',
    }, source);
    writer.write([record], { buildTimestamp: '2026-07-18T00:00:00.000Z' });
    const index = JSON.parse(fs.readFileSync(path.join(tmp, 'knowledge-index.json'), 'utf8'));
    expect(index.records).toHaveLength(1);
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

  it('loads repository source configuration without enabling missing files', () => {
    const scanner = new ContentSourceScanner();
    const enabled = scanner.loadSources().filter((item) => item.enabled);
    expect(enabled.every((item) => item.exists)).toBe(true);
  });
});

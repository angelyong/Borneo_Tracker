import fs from 'node:fs';
import { ContentSourceScanner } from './ContentSourceScanner.js';
import { JsonContentExtractor } from './JsonContentExtractor.js';
import { MarkdownContentExtractor } from './MarkdownContentExtractor.js';
import { PageContentExtractor } from './PageContentExtractor.js';
import { KnowledgeRecordNormalizer } from './KnowledgeRecordNormalizer.js';
import { KnowledgeValidator } from './KnowledgeValidator.js';
import { KnowledgeDeduplicator } from './KnowledgeDeduplicator.js';
import { KnowledgeWriter } from './KnowledgeWriter.js';
import { createBuildReport } from './KnowledgeBuildReport.js';
import { hasSecretLikeText } from './text.js';

export class KnowledgeBuilder {
  constructor({
    scanner = new ContentSourceScanner(),
    jsonExtractor = new JsonContentExtractor(),
    markdownExtractor = new MarkdownContentExtractor(),
    pageExtractor = new PageContentExtractor(),
    normalizer = new KnowledgeRecordNormalizer(),
    validator = new KnowledgeValidator(),
    deduplicator = new KnowledgeDeduplicator(),
    writer = new KnowledgeWriter(),
  } = {}) {
    this.scanner = scanner;
    this.extractors = {
      json: jsonExtractor,
      markdown: markdownExtractor,
      page: pageExtractor,
    };
    this.normalizer = normalizer;
    this.validator = validator;
    this.deduplicator = deduplicator;
    this.writer = writer;
  }

  extractSource(source, report) {
    if (!source.enabled) return [];
    report.sourcesScanned.push({ id: source.id, type: source.type, path: source.path });
    if (!source.safe) {
      report.unsafeSources.push({ id: source.id, path: source.path });
      report.errors.push(`Unsafe source path excluded: ${source.path}`);
      return [];
    }
    if (!source.exists) {
      report.missingSources.push({ id: source.id, path: source.path });
      report.errors.push(`Missing source: ${source.path}`);
      return [];
    }

    const extractor = this.extractors[source.type];
    if (!extractor) {
      report.errors.push(`Unsupported source type: ${source.type}`);
      return [];
    }

    const raw = fs.readFileSync(source.fullPath, 'utf8');
    if (hasSecretLikeText(raw)) {
      report.errors.push(`Secret-like content detected in source: ${source.path}`);
      return [];
    }

    const payload = source.type === 'json' ? JSON.parse(raw) : raw;
    const extracted = extractor.extract(payload, source);
    report.sourcesProcessed.push({ id: source.id, recordsExtracted: extracted.length });
    return extracted.map((record) => this.normalizer.normalize(record, source));
  }

  run({ validateOnly = false } = {}) {
    const report = createBuildReport();
    const sources = this.scanner.loadSources();
    const extractedRecords = sources.flatMap((source) => {
      try {
        return this.extractSource(source, report);
      } catch (error) {
        report.errors.push(`Failed to process ${source.id}: ${error.message}`);
        return [];
      }
    });

    const deduped = this.deduplicator.deduplicate(extractedRecords);
    report.duplicateRecords = deduped.duplicates;
    const validation = this.validator.validateRecords(deduped.unique);

    report.recordsCreated = validation.valid.length;
    report.recordsSkipped = validation.invalid.length + deduped.duplicates.length;
    report.invalidRecords = validation.invalid.map((item) => ({
      id: item.record.id,
      title: item.record.title,
      sourceFile: item.record.sourceFile,
      errors: item.errors,
    }));
    report.placeholderRecords = validation.valid
      .filter((record) => record.status === 'placeholder' || record.status === 'incomplete')
      .map((record) => ({ id: record.id, title: record.title, status: record.status, sourceFile: record.sourceFile }));
    report.warnings = validation.warnings;

    const criticalErrors = report.errors.length > 0 || report.invalidRecords.length > 0;
    if (!validateOnly && validation.valid.length > 0) {
      const written = this.writer.write(validation.valid, report);
      report.outputFiles = written.outputFiles;
    }

    return {
      ok: !criticalErrors,
      records: validation.valid,
      report,
    };
  }
}

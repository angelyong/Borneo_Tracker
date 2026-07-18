import fs from 'node:fs';
import { resolveRepoPath } from './paths.js';
import { hasSecretLikeText, hasUnsupportedNumericalClaim } from './text.js';

const VALID_CATEGORIES = new Set([
  'site-overview',
  'regions',
  'esg-indicators',
  'environmental',
  'esg',
  'sdg-progress',
  'sdg',
  'data-sources',
  'generate-report',
  'website-usage',
  'faq',
]);

function validPageUrl(value) {
  return typeof value === 'string' && (value === '' || value.startsWith('/') || /^https?:\/\//.test(value));
}

export class KnowledgeValidator {
  validateRecord(record) {
    const errors = [];
    const warnings = [];

    ['id', 'title', 'category', 'content', 'sourceFile', 'sourceType', 'status'].forEach((field) => {
      if (!record[field]) errors.push(`Missing required field: ${field}`);
    });

    if (record.category && !VALID_CATEGORIES.has(record.category)) {
      errors.push(`Invalid category: ${record.category}`);
    }
    if (!validPageUrl(record.pageUrl)) {
      errors.push(`Invalid pageUrl: ${record.pageUrl}`);
    }
    if (record.sourceUrl && !validPageUrl(record.sourceUrl)) {
      errors.push(`Invalid sourceUrl: ${record.sourceUrl}`);
    }
    if (record.sourceFile && !fs.existsSync(resolveRepoPath(record.sourceFile))) {
      errors.push(`Missing source file: ${record.sourceFile}`);
    }
    if (!String(record.content || '').trim()) {
      errors.push('Empty content');
    }
    if (hasSecretLikeText(record.content) || hasSecretLikeText(record.title)) {
      errors.push('Secret-like content detected');
    }
    if (record.status === 'verified' && /placeholder/i.test(record.content)) {
      errors.push('Placeholder content cannot be verified');
    }
    if (record.status === 'verified' && hasUnsupportedNumericalClaim(record.content)) {
      warnings.push('Numerical claim detected; verify source support before using as static knowledge');
    }
    if (!record.sourceFile || !record.sourceType) {
      errors.push('Missing source traceability');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateRecords(records) {
    const seenIds = new Set();
    const invalid = [];
    const warnings = [];
    const valid = [];

    records.forEach((record) => {
      const result = this.validateRecord(record);
      if (seenIds.has(record.id)) {
        result.valid = false;
        result.errors.push(`Duplicate id: ${record.id}`);
      }
      seenIds.add(record.id);

      if (result.warnings.length) {
        warnings.push({ id: record.id, warnings: result.warnings });
      }

      if (result.valid) {
        valid.push(record);
      } else {
        invalid.push({ record, errors: result.errors });
      }
    });

    return { valid, invalid, warnings };
  }
}

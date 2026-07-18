import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, '../../../knowledge');
const GENERATED_INDEX = path.join(KNOWLEDGE_DIR, 'generated/knowledge-index.json');
const KNOWLEDGE_FILES = [
  'site-overview.json',
  'regions.json',
  'esg-indicators.json',
  'sdg-progress.json',
  'data-sources.json',
  'generate-report.json',
  'faq.json',
];

const cache = new Map();

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function loadRecords({ generatedIndex = GENERATED_INDEX, knowledgeDir = KNOWLEDGE_DIR } = {}) {
  const cacheKey = `${generatedIndex}|${knowledgeDir}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const records = loadGeneratedRecords(generatedIndex) || loadManualRecords(knowledgeDir);
  cache.set(cacheKey, records);
  return records;
}

function loadGeneratedRecords(generatedIndex) {
  try {
    if (!fs.existsSync(generatedIndex)) return null;
    const payload = JSON.parse(fs.readFileSync(generatedIndex, 'utf8'));
    if (!Array.isArray(payload.records)) return null;
    return payload.records.map((record) => ({
      ...record,
      knowledgeFile: 'generated/knowledge-index.json',
    }));
  } catch {
    return null;
  }
}

function loadManualRecords(knowledgeDir) {
  return KNOWLEDGE_FILES.flatMap((fileName) => {
    try {
      const fullPath = path.join(knowledgeDir, fileName);
      if (!fs.existsSync(fullPath)) return [];
      const records = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      return records.map((record) => ({ ...record, knowledgeFile: fileName }));
    } catch {
      return [];
    }
  });
}

export class StaticKnowledgeProvider {
  constructor(options = {}) {
    this.options = options;
  }

  search(message, limit = 4) {
    const queryTokens = tokenize(message);
    const records = loadRecords(this.options);
    const scored = records
      .map((record) => {
        const haystack = tokenize([
          record.id,
          record.title,
          record.category,
          record.content,
          record.keywords?.join(' '),
          record.searchableText,
          record.sourceName,
          record.sourceFile,
          record.regions?.join(' '),
          record.relatedSdgs?.join(' '),
        ].join(' '));
        const normalizedQuery = queryTokens.join(' ');
        const normalizedTitle = tokenize(record.title).join(' ');
        const score = queryTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0)
          + (normalizedTitle.includes(normalizedQuery) ? 4 : 0)
          + (record.searchableText?.includes(normalizedQuery) ? 3 : 0);
        return { record, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const matches = (scored.length ? scored : records.map((record) => ({ record, score: 0 }))).slice(0, limit);
    return {
      status: 'ok',
      records: matches.map((item) => item.record),
    };
  }
}

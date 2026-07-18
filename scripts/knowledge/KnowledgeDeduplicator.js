import { normalizeSearchText } from './text.js';

export class KnowledgeDeduplicator {
  deduplicate(records) {
    const seen = new Map();
    const unique = [];
    const duplicates = [];

    records.forEach((record) => {
      const key = [
        normalizeSearchText(record.title),
        normalizeSearchText(record.content),
        record.sourceFile,
      ].join('|');
      const existing = seen.get(key);
      if (existing) {
        duplicates.push({ keptId: existing.id, skippedId: record.id, sourceFile: record.sourceFile });
        return;
      }
      seen.set(key, record);
      unique.push(record);
    });

    return { unique, duplicates };
  }
}

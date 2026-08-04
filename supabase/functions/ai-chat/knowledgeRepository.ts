import knowledgeArtifact from './knowledge-index.json' with { type: 'json' };
import type { AIChatKnowledgeRecord } from './contracts.ts';

type KnowledgeArtifact = {
  schemaVersion?: number;
  recordCount?: number;
  records?: unknown[];
};

type KnowledgeRepositoryOptions = {
  artifact?: KnowledgeArtifact | AIChatKnowledgeRecord[] | unknown;
};

export class KnowledgeRepository {
  private readonly records: AIChatKnowledgeRecord[];

  constructor(options: KnowledgeRepositoryOptions = {}) {
    this.records = normalizeArtifact(options.artifact ?? knowledgeArtifact);
  }

  getAllRuntimeRecords(): AIChatKnowledgeRecord[] {
    return [...this.records];
  }

  getByLanguage(language: string): AIChatKnowledgeRecord[] {
    return this.records.filter((record) => record.language === normalizeLanguage(language));
  }

  getByCategory(category: string): AIChatKnowledgeRecord[] {
    const normalized = String(category || '').trim().toLowerCase();
    return this.records.filter((record) => record.category.toLowerCase() === normalized);
  }

  getByIds(ids: string[]): AIChatKnowledgeRecord[] {
    const idSet = new Set(ids);
    return this.records.filter((record) => idSet.has(record.id));
  }
}

function normalizeArtifact(artifact: unknown): AIChatKnowledgeRecord[] {
  const rawRecords = Array.isArray(artifact)
    ? artifact
    : Array.isArray((artifact as KnowledgeArtifact)?.records)
      ? (artifact as KnowledgeArtifact).records || []
      : [];

  return rawRecords
    .map(normalizeRecord)
    .filter((record): record is AIChatKnowledgeRecord => Boolean(record))
    .filter((record) => record.runtimeIncluded && record.status === 'verified' && !record.placeholder)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeRecord(value: unknown): AIChatKnowledgeRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const required = ['id', 'title', 'content', 'category', 'language', 'sourceFile', 'sourceType', 'status'];
  if (required.some((field) => !isNonEmptyString(record[field]))) return undefined;
  if (record.runtimeIncluded !== true) return undefined;
  if (record.placeholder === true) return undefined;
  if (record.status !== 'verified') return undefined;
  if (looksPlaceholder(record.title) || looksPlaceholder(record.content)) return undefined;

  return {
    id: String(record.id).trim(),
    title: String(record.title).trim(),
    content: String(record.content).trim(),
    category: String(record.category).trim(),
    language: normalizeLanguage(String(record.language)),
    pageUrl: optionalString(record.pageUrl),
    region: optionalString(record.region),
    regions: stringArray(record.regions),
    concept: optionalString(record.concept),
    sdgTags: stringArray(record.sdgTags),
    relatedSdgs: stringArray(record.relatedSdgs),
    keywords: stringArray(record.keywords),
    searchableText: optionalString(record.searchableText),
    sourceFile: String(record.sourceFile).trim(),
    sourceType: String(record.sourceType).trim(),
    sourceId: optionalString(record.sourceId),
    sourcePath: optionalString(record.sourcePath),
    sourceName: optionalString(record.sourceName),
    sourceUrl: optionalString(record.sourceUrl),
    status: String(record.status).trim(),
    placeholder: record.placeholder === true,
    runtimeIncluded: record.runtimeIncluded === true,
    provenance: normalizeProvenance(record.provenance),
  };
}

function normalizeProvenance(value: unknown): AIChatKnowledgeRecord['provenance'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return {
    sourceFile: optionalString(record.sourceFile),
    sourceType: optionalString(record.sourceType),
    sourceId: optionalString(record.sourceId),
    sourceName: optionalString(record.sourceName),
    sourceUrl: optionalString(record.sourceUrl),
    pageUrl: optionalString(record.pageUrl),
    route: optionalString(record.route),
    language: optionalString(record.language),
    sourcePath: optionalString(record.sourcePath),
    extractedAt: typeof record.extractedAt === 'string' ? record.extractedAt : null,
  };
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter(isNonEmptyString).map((item) => item.trim()))]
    : [];
}

function normalizeLanguage(language: string): string {
  return language === 'ms' ? 'ms' : 'en';
}

function looksPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && /\b(?:placeholder|lorem ipsum|mock\/prototype|coming soon|to be confirmed)\b/i.test(value);
}

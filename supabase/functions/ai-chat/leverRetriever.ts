import type {
  AIChatFactObject,
  LeverQuery,
  LeverRecord,
  LeverRetrievalResult,
} from './contracts.ts';
import { LeverRepository, compareLeverRecords } from './leverRepository.ts';

const EMPTY_REASON = 'NO_VERIFIED_APPLICABLE_LEVER';

export function retrieveVerifiedLevers(
  query: LeverQuery,
  repository = new LeverRepository()
): LeverRetrievalResult {
  if (query.factObject?.availability === 'BLOCKED') {
    return { records: [], matchedBy: [], warnings: [], emptyReason: 'BLOCKED_OR_CLARIFICATION' };
  }

  const records = repository.getVerifiedRecords();
  if (!records.length) {
    return { records: [], matchedBy: [], warnings: [], emptyReason: 'NO_LEVER_LIBRARY_RECORDS' };
  }

  const candidates = records
    .map((record) => scoreRecord(record, query))
    .filter((candidate) => candidate.score > 0 && !candidate.excluded)
    .sort((a, b) => b.score - a.score || compareLeverRecords(a.record, b.record));

  const selected = candidates.slice(0, query.limit || 2);
  if (!selected.length) return { records: [], matchedBy: [], warnings: [], emptyReason: EMPTY_REASON };

  return {
    records: selected.map((candidate) => candidate.record),
    matchedBy: [...new Set(selected.flatMap((candidate) => candidate.matchedBy))],
    warnings: languageWarnings(selected.map((candidate) => candidate.record), query.language),
  };
}

function scoreRecord(record: LeverRecord, query: LeverQuery): {
  record: LeverRecord;
  score: number;
  matchedBy: string[];
  excluded: boolean;
} {
  const matchedBy: string[] = [];
  let score = 0;

  if (query.concepts.length && !query.concepts.includes(record.concept)) {
    return { record, score, matchedBy, excluded: true };
  }
  if (query.concepts.includes(record.concept)) {
    score += 100;
    matchedBy.push('concept');
  }
  const factPillars = query.factObject ? factObjectPillars(query.factObject) : [];
  const queryPillars = [...new Set([...query.pillars, ...factPillars])];
  const pillarMatched = record.pillars.some((pillar) => queryPillars.includes(pillar));
  if (queryPillars.length && !pillarMatched) {
    return { record, score, matchedBy, excluded: true };
  }
  if (pillarMatched) {
    score += 40;
    matchedBy.push('pillar');
  }
  if (territoryMatches(record, query.territories)) {
    score += 20;
    matchedBy.push('territory');
  } else if (!record.territories.includes('generic')) {
    return { record, score, matchedBy, excluded: true };
  }
  if (appliesWhenMatches(record, query)) {
    score += 10;
    matchedBy.push('appliesWhen');
  }
  if (doesNotApplyWhenBlocks(record, query)) return { record, score, matchedBy, excluded: true };
  if (record.language === normalizedLanguage(query.language)) {
    score += 8;
    matchedBy.push('language');
  }
  if (record.evidence.length) {
    score += Math.min(record.evidence.length, 3);
    matchedBy.push('evidence');
  }

  return { record, score, matchedBy, excluded: false };
}

function factObjectPillars(factObject: AIChatFactObject): string[] {
  return [
    ...factObject.pillars,
    factObject.diagnosis?.weakestPillar || '',
  ].filter(Boolean);
}

function territoryMatches(record: LeverRecord, territories: string[]): boolean {
  if (record.territories.includes('generic')) return true;
  if (record.territories.includes('Borneo-wide')) return territories.length === 0 || territories.some((territory) => ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'].includes(territory));
  return territories.length === 0 ? false : record.territories.some((territory) => territories.includes(territory));
}

function appliesWhenMatches(record: LeverRecord, query: LeverQuery): boolean {
  const haystack = queryText(query);
  return record.appliesWhen.some((item) => tokenOverlap(item, haystack));
}

function doesNotApplyWhenBlocks(record: LeverRecord, query: LeverQuery): boolean {
  const haystack = queryText(query);
  return record.doesNotApplyWhen.some((item) => tokenOverlap(item, haystack));
}

function queryText(query: LeverQuery): string {
  const warnings = query.factObject?.warnings.map((warning) => warning.message) || [];
  return [
    ...query.concepts,
    ...query.pillars,
    ...query.territories,
    ...(query.factObject?.districts || []),
    ...(query.factObject?.indicators || []),
    ...(query.factObject?.requiredDisclosures || []),
    ...warnings,
  ].join(' ').toLowerCase();
}

function tokenOverlap(value: string, haystack: string): boolean {
  const tokens = value.toLowerCase().split(/[^a-z0-9_]+/).filter((token) => token.length >= 4);
  return tokens.some((token) => haystack.includes(token));
}

function normalizedLanguage(language: string): 'en' | 'ms' {
  return language === 'ms' ? 'ms' : 'en';
}

function languageWarnings(records: LeverRecord[], language: string): string[] {
  const normalized = normalizedLanguage(language);
  if (records.some((record) => record.language !== normalized)) {
    return ['No verified lever is available in the requested language; an English verified lever was retained without translation.'];
  }
  return [];
}

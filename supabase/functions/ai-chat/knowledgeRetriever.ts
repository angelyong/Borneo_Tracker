import type {
  AIChatKnowledgeMatch,
  AIChatKnowledgeQuery,
  AIChatKnowledgeRecord,
  AIChatKnowledgeRetrievalResult,
} from './contracts.ts';
import { KnowledgeRepository } from './knowledgeRepository.ts';

export const KNOWLEDGE_MIN_SCORE = 8;
export const KNOWLEDGE_LANGUAGE_FALLBACK_MIN_SCORE = 12;
export const KNOWLEDGE_AMBIGUITY_MARGIN = 2;

const EN_STOPWORDS = new Set([
  'what', 'is', 'the', 'how', 'do', 'does', 'this', 'page', 'a', 'an', 'to', 'of', 'in', 'on',
  'for', 'and', 'or', 'me', 'i', 'with', 'about',
]);

const MS_STOPWORDS = new Set([
  'apakah', 'apa', 'bagaimana', 'yang', 'dan', 'ini', 'laman', 'halaman', 'untuk', 'di', 'ke',
  'dengan', 'saya', 'fungsi',
]);

const PAGE_CATEGORY_HINTS: Record<string, string[]> = {
  reports: ['generate-report', 'reports'],
  report: ['generate-report', 'reports'],
  dashboard: ['dashboard', 'site-overview'],
  esg: ['esg-indicators', 'reports'],
  sdg: ['sdg-progress', 'reports'],
  community: ['community'],
  news: ['news'],
  about: ['site-overview'],
};

type Scored = AIChatKnowledgeMatch & {
  languageMatches: boolean;
  strongSignal: boolean;
  topicKey: string;
};

export function retrieveStaticKnowledge(
  query: AIChatKnowledgeQuery,
  repository = new KnowledgeRepository()
): AIChatKnowledgeRetrievalResult {
  if (requestsContentOutsideKnowledgeBase(query.question)) {
    return { matches: [], status: 'NO_MATCH', warnings: ['KNOWLEDGE_NO_MATCH_REQUESTED'] };
  }

  const records = repository.getAllRuntimeRecords();
  const scored = records
    .map((record) => scoreRecord(record, query))
    .filter((match) => match.score > 0)
    .sort(compareMatches);

  const preferredLanguage = normalizeLanguage(query.language);
  const sameLanguage = scored.filter((match) => match.record.language === preferredLanguage);
  const sameTop = sameLanguage[0];
  const crossTop = scored[0];
  const selectedPool = sameTop && sameTop.score >= KNOWLEDGE_MIN_SCORE
    ? sameLanguage
    : crossTop && crossTop.score >= KNOWLEDGE_LANGUAGE_FALLBACK_MIN_SCORE && crossTop.strongSignal
      ? scored
      : [];

  if (!selectedPool.length) {
    return { matches: [], status: 'NO_MATCH', warnings: [] };
  }

  const limited = selectedPool.slice(0, Math.max(1, query.limit || 3));
  const top = limited[0];
  const ambiguous = isAmbiguous(top, limited);
  if (ambiguous) {
    return {
      matches: limited,
      status: 'AMBIGUOUS',
      warnings: ['KNOWLEDGE_AMBIGUOUS'],
    };
  }

  const status = top.record.language === preferredLanguage ? 'FOUND' : 'LANGUAGE_FALLBACK';
  return {
    matches: limited,
    status,
    warnings: status === 'LANGUAGE_FALLBACK' ? ['LANGUAGE_FALLBACK'] : [],
  };
}

function scoreRecord(record: AIChatKnowledgeRecord, query: AIChatKnowledgeQuery): Scored {
  const language = normalizeLanguage(query.language);
  const question = normalizeText(query.question);
  const questionTokens = tokens(question, language);
  const title = normalizeText(record.title);
  const content = normalizeText(record.content);
  const searchable = normalizeText(record.searchableText || record.content);
  const page = normalizePage(query.currentPage);
  const recordPage = normalizePage(record.pageUrl);
  const matchedBy: string[] = [];
  let score = 0;
  let strongSignal = false;

  if (title && phraseAppears(question, title)) {
    score += 18;
    matchedBy.push('exact-title');
    strongSignal = true;
  }

  for (const keyword of record.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (isStopwordPhrase(normalizedKeyword, record.language)) continue;
    if (!normalizedKeyword || !phraseAppears(question, normalizedKeyword)) continue;
    score += normalizedKeyword.includes(' ') ? 10 : 7;
    matchedBy.push(`keyword:${keyword}`);
    strongSignal = true;
  }
  for (const keyword of record.keywords) {
    const keywordTokens = tokens(normalizeText(keyword), record.language);
    if (keywordTokens.length < 2 || !keywordTokens.every((token) => questionTokens.includes(token))) continue;
    score += 8;
    matchedBy.push(`keyword-token:${keyword}`);
    strongSignal = true;
  }

  if (record.concept && query.concepts.includes(record.concept)) {
    score += 9;
    matchedBy.push(`concept:${record.concept}`);
    strongSignal = true;
  }

  if (categoryMatches(record.category, question)) {
    score += 7;
    matchedBy.push(`category:${record.category}`);
    strongSignal = true;
  }

  if (phraseAppears(question, 'borneo tracker') && record.category === 'site-overview' && record.pageUrl === '/about') {
    score += 8;
    matchedBy.push('product-identity');
    strongSignal = true;
  }

  if (page && recordPage && (page === recordPage || page.startsWith(`${recordPage}/`) || recordPage.startsWith(`${page}/`))) {
    score += 12;
    matchedBy.push('page');
  } else {
    const hintedCategories = PAGE_CATEGORY_HINTS[page.replace(/^\//, '')] || [];
    if (hintedCategories.includes(record.category)) {
      score += 4;
      matchedBy.push(`page-category:${record.category}`);
    }
  }

  const recordRegions = [record.region, ...record.regions].filter(Boolean).map(normalizeText);
  for (const territory of query.territories.map(normalizeText)) {
    if (recordRegions.includes(territory)) {
      score += 5;
      matchedBy.push(`region:${territory}`);
    }
  }

  if (record.language === language) {
    score += 3;
    matchedBy.push(`language:${record.language}`);
  } else {
    score -= 3;
    matchedBy.push(`language-mismatch:${record.language}`);
  }

  const hint = queryHintBoost(record, question, questionTokens);
  if (hint.score) {
    score += hint.score;
    matchedBy.push(...hint.matchedBy);
    strongSignal = true;
  }

  const titleTokens = tokens(title, record.language);
  const titleOverlap = overlap(questionTokens, titleTokens);
  if (titleOverlap.length) {
    score += Math.min(9, titleOverlap.length * 3);
    matchedBy.push('title-token-overlap');
  }

  const bodyTokens = tokens(searchable || content, record.language);
  const bodyOverlap = overlap(questionTokens, bodyTokens);
  if (bodyOverlap.length) {
    score += Math.min(5, bodyOverlap.length);
    matchedBy.push('content-token-overlap');
  }

  return {
    record,
    score,
    matchedBy: [...new Set(matchedBy)],
    languageMatches: record.language === language,
    strongSignal,
    topicKey: topicKey(record),
  };
}

export function normalizeKnowledgeText(value: string, language = 'en'): string {
  return tokens(normalizeText(value), language).join(' ');
}

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’`]/g, "'")
    .replace(/[\u2010-\u2015-]+/g, ' ')
    .replace(/[^a-z0-9'%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string, language: string): string[] {
  const stopwords = language === 'ms' ? MS_STOPWORDS : EN_STOPWORDS;
  const result: string[] = [];
  for (const token of value.split(/\s+/)) {
    if (token.length < 2 || stopwords.has(token)) continue;
    result.push(token);
    if (token === 'sdgs') result.push('sdg');
    if (token.length > 4 && token.endsWith('s')) result.push(token.slice(0, -1));
  }
  return [...new Set(result)];
}

function isStopwordPhrase(value: string, language: string): boolean {
  const rawTokens = value.split(/\s+/).filter(Boolean);
  if (!rawTokens.length) return true;
  const stopwords = language === 'ms' ? MS_STOPWORDS : EN_STOPWORDS;
  return rawTokens.every((token) => stopwords.has(token));
}

function phraseAppears(text: string, phrase: string): boolean {
  const normalized = normalizeText(phrase);
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
}

function categoryMatches(category: string, question: string): boolean {
  const normalized = normalizeText(category);
  return phraseAppears(question, normalized) || phraseAppears(question, normalized.replace(/-/g, ' '));
}

function normalizePage(page?: string): string {
  if (!page) return '';
  const first = String(page).split('?')[0].split('#')[0].toLowerCase().trim();
  const normalized = first.replace(/\/+$/, '');
  return normalized || '/';
}

function overlap(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token));
}

function topicKey(record: AIChatKnowledgeRecord): string {
  return record.concept || `${record.category}:${record.pageUrl || ''}:${record.title}`;
}

function compareMatches(a: Scored, b: Scored): number {
  return b.score - a.score ||
    Number(b.languageMatches) - Number(a.languageMatches) ||
    a.record.id.localeCompare(b.record.id);
}

function isAmbiguous(top: Scored, matches: Scored[]): boolean {
  const close = matches.filter((match) => top.score - match.score <= KNOWLEDGE_AMBIGUITY_MARGIN);
  if (close.length < 2) return false;
  if (isComplementaryEsgSdg(close)) return false;
  if (top.matchedBy.some((item) => /^exact-title|^concept:/.test(item))) return false;
  if (top.matchedBy.some((item) => /^keyword:.+\s/.test(item))) return false;
  if (top.matchedBy.includes('product-identity') || top.matchedBy.includes('page')) return false;
  if (top.matchedBy.includes('title-token-overlap') && close.slice(1).every((match) => match.score < top.score || !match.matchedBy.includes('title-token-overlap'))) return false;
  return close.some((match) => match.topicKey !== top.topicKey);
}

function queryHintBoost(record: AIChatKnowledgeRecord, question: string, questionTokens: string[]): { score: number; matchedBy: string[] } {
  const matchedBy: string[] = [];
  let score = 0;
  const has = (token: string) => questionTokens.includes(token);
  const category = record.category;
  const concept = record.concept || '';

  if (has('esg') && has('sdg') && (category === 'esg-indicators' || category === 'sdg-progress')) {
    score += 12;
    matchedBy.push(`query-hint:${category}`);
  }
  if (isEsgSdgComparisonQuestion(question, questionTokens) && record.id === 'esg-vs-sdg') {
    score += 36;
    matchedBy.push('query-hint:esg-vs-sdg');
  }
  if (isSingleEsgQuestion(question, questionTokens) && record.id === 'esg-indicators-page-en') {
    score += 24;
    matchedBy.push('query-hint:esg-overview');
  }
  if (isSingleSdgQuestion(question, questionTokens) && record.id === 'sdg-progress-page-en') {
    score += 24;
    matchedBy.push('query-hint:sdg-overview');
  }
  if (phraseAppears(question, 'forest cover') && (concept === 'forest_cover' || normalizeText(record.title) === 'forest cover')) {
    score += 12;
    matchedBy.push('query-hint:forest-cover');
  }
  if (isSdgCoverageListQuestion(question, questionTokens) && record.id === 'sdg-monitored-goals') {
    score += 32;
    matchedBy.push('query-hint:sdg-monitored-goals');
  }
  if (isEnvironmentalSourceQuestion(question, questionTokens) && record.id === 'environmental-data-sources') {
    score += 24;
    matchedBy.push('query-hint:environmental-data-sources');
  }
  if (isGenerateReportHowToQuestion(question, questionTokens) && record.id === 'generate-report-how-to') {
    score += 36;
    matchedBy.push('query-hint:generate-report-how-to');
  }
  if (isGenerateReportOverviewQuestion(question) && record.id === 'generate-report-page-en') {
    score += 24;
    matchedBy.push('query-hint:generate-report-overview');
  }
  if (phraseAppears(question, 'data sources') && category === 'site-overview') {
    score += 8;
    matchedBy.push('query-hint:data-sources');
  }

  return { score, matchedBy };
}

function isSingleEsgQuestion(question: string, questionTokens: string[]): boolean {
  const has = (token: string) => questionTokens.includes(token);
  if (!has('esg') || has('sdg')) return false;
  return phraseAppears(question, 'what is esg') ||
    /\b(?:explain|define|meaning)\b.{0,20}\besg\b/.test(question) ||
    /\besg\b.{0,20}\b(?:mean|means)\b/.test(question);
}

function isSingleSdgQuestion(question: string, questionTokens: string[]): boolean {
  const has = (token: string) => questionTokens.includes(token);
  if (!has('sdg') || has('esg')) return false;
  const isSpecificGoal = /\bsdgs?\s*\d+\b/i.test(question) ||
    /\bsustainable development goals?\s*\d+\b/i.test(question);
  if (isSpecificGoal || isSdgCoverageListQuestion(question, questionTokens)) return false;
  return phraseAppears(question, 'what are sdgs') ||
    phraseAppears(question, 'what is sdg') ||
    phraseAppears(question, 'what are sustainable development goals') ||
    /\b(?:explain|define|meaning)\b.{0,40}\b(?:sdgs?|sustainable development goals?)\b/.test(question) ||
    /\b(?:sdgs?|sustainable development goals?)\b.{0,20}\b(?:mean|means)\b/.test(question);
}

function isEsgSdgComparisonQuestion(question: string, questionTokens: string[]): boolean {
  const has = (token: string) => questionTokens.includes(token);
  if (!has('esg') || !has('sdg')) return false;
  return /\b(?:difference|different|compared|compare|versus|vs|between)\b/.test(question) ||
    phraseAppears(question, 'esg and sdg') ||
    phraseAppears(question, 'esg vs sdg') ||
    phraseAppears(question, 'esg versus sdg') ||
    phraseAppears(question, 'esg compared with sdg');
}

function isSdgCoverageListQuestion(question: string, questionTokens: string[]): boolean {
  const has = (token: string) => questionTokens.includes(token);
  const hasSdg = has('sdg') || has('sdgs') ||
    phraseAppears(question, 'sustainable development goal') ||
    phraseAppears(question, 'sustainable development goals');
  if (!hasSdg) return false;
  const asksList = /\b(?:show|list|covered|coverage|monitored|monitor|tracked|tracks)\b/.test(question) ||
    phraseAppears(question, 'which sdgs') ||
    phraseAppears(question, 'what sdgs') ||
    phraseAppears(question, 'sdg coverage') ||
    phraseAppears(question, 'sustainable development goals tracked') ||
    (phraseAppears(question, 'sustainable development goals') && /\b(?:which|what|tracked|covered|monitored)\b/.test(question));
  const isSpecificGoal = /\bsdgs?\s*\d+\b/i.test(question) ||
    /\bsustainable development goals?\s*\d+\b/i.test(question);
  return asksList && !isSpecificGoal;
}

function isEnvironmentalSourceQuestion(question: string, questionTokens: string[]): boolean {
  const has = (token: string) => questionTokens.includes(token);
  const asksSource = /\b(?:source|sources|from|come|comes|get|gets|originate|provenance)\b/.test(question) ||
    phraseAppears(question, 'data source') ||
    phraseAppears(question, 'data sources') ||
    phraseAppears(question, 'where data comes from');
  const asksEnvironmental = phraseAppears(question, 'environmental data') ||
    phraseAppears(question, 'environmental indicators') ||
    (has('environmental') && (has('data') || has('indicator') || has('indicators')));
  return asksSource && asksEnvironmental;
}

function isGenerateReportHowToQuestion(question: string, questionTokens: string[]): boolean {
  const has = (token: string) => questionTokens.includes(token);
  const hasReportContext = has('report') || phraseAppears(question, 'pdf report') || phraseAppears(question, 'generate report');
  if (!hasReportContext || isGenerateReportOverviewQuestion(question)) return false;
  return phraseAppears(question, 'how do i generate a report') ||
    phraseAppears(question, 'how can i create a report') ||
    phraseAppears(question, 'how do i download a report') ||
    phraseAppears(question, 'how do i create a pdf report') ||
    phraseAppears(question, 'what steps are needed to generate a report') ||
    (/\b(?:how|steps|step|create|generate|download)\b/.test(question) && (has('report') || has('pdf')));
}

function isGenerateReportOverviewQuestion(question: string): boolean {
  return phraseAppears(question, 'what is the generate report page') ||
    phraseAppears(question, 'what is generate report page') ||
    phraseAppears(question, 'what does the generate report page do') ||
    phraseAppears(question, 'what does generate report page do') ||
    phraseAppears(question, 'describe the generate report page');
}

function isComplementaryEsgSdg(matches: Scored[]): boolean {
  const categories = new Set(matches.map((match) => match.record.category));
  return categories.has('esg-indicators') && categories.has('sdg-progress') &&
    matches.every((match) => ['esg-indicators', 'sdg-progress'].includes(match.record.category));
}

function normalizeLanguage(language: string): string {
  return language === 'ms' ? 'ms' : 'en';
}

function requestsContentOutsideKnowledgeBase(question: string): boolean {
  const normalized = normalizeText(question);
  return /\b(?:not|isn t|is not|isnt|outside|beyond|tiada|bukan)\b.{0,40}\bknowledge base\b/i.test(normalized) ||
    /\bknowledge base\b.{0,40}\b(?:not|outside|beyond)\b/i.test(normalized) ||
    /\bpangkalan pengetahuan\b.{0,40}\b(?:tiada|bukan|di luar)\b/i.test(normalized);
}

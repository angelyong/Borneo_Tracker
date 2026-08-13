import type {
  AIChatKnowledgeAnswer,
  AIChatKnowledgeMatch,
  AIChatKnowledgeRetrievalResult,
  FactSource,
} from './contracts.ts';

const NO_MATCH = {
  en: 'The current Borneo Tracker knowledge base does not contain a verified answer for this question.',
  ms: 'Pangkalan pengetahuan Borneo Tracker semasa tidak mengandungi jawapan yang telah disahkan untuk soalan ini.',
};

const AMBIGUOUS = {
  en: 'Please specify the Borneo Tracker page or topic you want explained.',
  ms: 'Sila nyatakan laman atau topik Borneo Tracker yang anda mahu dijelaskan.',
};

export function buildKnowledgeAnswer(
  retrieval: AIChatKnowledgeRetrievalResult,
  language: string
): AIChatKnowledgeAnswer {
  const resolvedLanguage = language === 'ms' ? 'ms' : 'en';
  if (retrieval.status === 'NO_MATCH') {
    return emptyAnswer(NO_MATCH[resolvedLanguage], resolvedLanguage, 'NO_MATCH', retrieval.warnings);
  }
  if (retrieval.status === 'AMBIGUOUS') {
    return emptyAnswer(AMBIGUOUS[resolvedLanguage], resolvedLanguage, 'AMBIGUOUS', retrieval.warnings);
  }

  const compatibleMatches = compatibleSelectedMatches(retrieval.matches);
  const selected = compatibleMatches.length ? compatibleMatches : retrieval.matches.slice(0, 1);
  const answer = selected.map((match) => recordAnswerText(match)).join('\n\n').trim();
  const cleanAnswer = stripUrls(answer);
  const sourceText = selected.map((match) => [
    match.record.title,
    match.record.content,
    match.record.sourceName || '',
    match.record.provenance?.sourceName || '',
  ].join(' ')).join(' ');

  return {
    answer: cleanAnswer,
    language: resolvedLanguage,
    status: retrieval.status,
    recordIds: selected.map((match) => match.record.id),
    sources: dedupeSources(selected.map((match) => sourceFromMatch(match))),
    approvedNumericTokens: extractNumericTokens(sourceText),
    approvedYearTokens: extractYearTokens(sourceText),
    warnings: [...new Set(retrieval.warnings)],
  };
}

function emptyAnswer(
  answer: string,
  language: string,
  status: AIChatKnowledgeAnswer['status'],
  warnings: string[]
): AIChatKnowledgeAnswer {
  return {
    answer,
    language,
    status,
    recordIds: [],
    sources: [],
    approvedNumericTokens: [],
    approvedYearTokens: [],
    warnings: [...new Set(warnings)],
  };
}

function compatibleSelectedMatches(matches: AIChatKnowledgeMatch[]): AIChatKnowledgeMatch[] {
  if (!matches.length) return [];
  if (usesDedicatedAnswerRecord(matches[0])) return [matches[0]];
  const complementary = complementaryEsgSdgMatches(matches);
  if (complementary.length) return complementary;
  const top = matches[0];
  const topic = top.record.concept || top.record.category;
  return matches
    .filter((match) => (match.record.concept || match.record.category) === topic)
    .slice(0, 2);
}

function usesDedicatedAnswerRecord(match: AIChatKnowledgeMatch): boolean {
  return ['esg-vs-sdg', 'generate-report-how-to', 'generate-report-page-en'].includes(match.record.id);
}

function complementaryEsgSdgMatches(matches: AIChatKnowledgeMatch[]): AIChatKnowledgeMatch[] {
  const esg = matches.find((match) => match.record.category === 'esg-indicators');
  const sdg = matches.find((match) => match.record.category === 'sdg-progress');
  if (!esg || !sdg) return [];
  const topScore = matches[0]?.score || 0;
  if (topScore - esg.score > 4 || topScore - sdg.score > 4) return [];
  return [esg, sdg].sort((a, b) => a.record.category.localeCompare(b.record.category));
}

function recordAnswerText(match: AIChatKnowledgeMatch): string {
  const title = stripUrls(match.record.title);
  const sentences = splitSentences(stripUrls(match.record.content));
  const deduped = dedupeSentences(sentences).join(' ');
  return `${title}: ${deduped}`.trim();
}

function sourceFromMatch(match: AIChatKnowledgeMatch): FactSource {
  const record = match.record;
  return {
    id: record.id,
    publisher: record.sourceName || record.provenance?.sourceName,
    title: record.title,
    url: record.sourceUrl || record.provenance?.sourceUrl,
    sourceFile: record.sourceFile,
    sourcePath: record.sourcePath,
  };
}

function splitSentences(value: string): string[] {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function dedupeSentences(sentences: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sentence of sentences) {
    const key = sentence.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sentence);
  }
  return result;
}

function stripUrls(value: string): string {
  return String(value || '')
    .replace(/\bhttps?:\/\/[^\s<>)]+/gi, '')
    .replace(/\bwww\.[^\s<>)]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumericTokens(text: string): string[] {
  const tokens = [...text.matchAll(/(^|[^\w])([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?)(?![\w])/g)]
    .map((match) => match[2])
    .filter((token) => !isYearToken(token));
  return [...new Set(tokens.flatMap((token) => [token, token.replace(/,/g, '')]))];
}

function extractYearTokens(text: string): string[] {
  return [...new Set([...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((match) => match[1]))];
}

function isYearToken(token: string): boolean {
  return /^(?:19|20)\d{2}$/.test(token.replace(/,/g, '').replace(/[+%]/g, ''));
}

function dedupeSources(sources: FactSource[]): FactSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = JSON.stringify(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

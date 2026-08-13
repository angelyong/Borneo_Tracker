import type { AIChatIntent, AIChatIntentResult, AIChatRequest } from './contracts.ts';

type IntentSignal = {
  phrase: string;
  weight: number;
  language?: 'en' | 'ms';
};

type IntentScore = {
  score: number;
  matchedTerms: string[];
  reasons: string[];
};

type RouteOptions = Pick<AIChatRequest, 'currentPage' | 'region' | 'language'>;

const INTENT_PRIORITY: AIChatIntent[] = [
  'DASHBOARD_DATA',
  'BORNEO_NEWS',
  'SITE_KNOWLEDGE',
  'OUT_OF_SCOPE',
];

const TERRITORY_TERMS = ['sabah', 'sarawak', 'brunei', 'kalimantan', 'borneo'];

const SIGNALS: Record<Exclude<AIChatIntent, 'OUT_OF_SCOPE'>, IntentSignal[]> = {
  SITE_KNOWLEDGE: [
    { phrase: 'borneo tracker', weight: 4, language: 'en' },
    { phrase: 'what is borneo tracker', weight: 5, language: 'en' },
    { phrase: 'difference between esg and sdg', weight: 8, language: 'en' },
    { phrase: 'esg and sdg different', weight: 7, language: 'en' },
    { phrase: 'esg compared with sdg', weight: 7, language: 'en' },
    { phrase: 'esg versus sdg', weight: 7, language: 'en' },
    { phrase: 'esg and sdg', weight: 6, language: 'en' },
    { phrase: 'what is esg', weight: 6, language: 'en' },
    { phrase: 'what are sdgs', weight: 6, language: 'en' },
    { phrase: 'forest cover indicator', weight: 8, language: 'en' },
    { phrase: 'explain forest cover', weight: 7, language: 'en' },
    { phrase: 'what does forest cover mean', weight: 8, language: 'en' },
    { phrase: 'forest cover mean', weight: 7, language: 'en' },
    { phrase: 'forest cover measured', weight: 7, language: 'en' },
    { phrase: 'source of forest cover data', weight: 8, language: 'en' },
    { phrase: 'source of the forest cover data', weight: 8, language: 'en' },
    { phrase: 'forest cover data come from', weight: 8, language: 'en' },
    { phrase: 'forest cover data source', weight: 8, language: 'en' },
    { phrase: 'which sdgs', weight: 7, language: 'en' },
    { phrase: 'sdgs monitored', weight: 7, language: 'en' },
    { phrase: 'environmental data come from', weight: 7, language: 'en' },
    { phrase: 'data sources', weight: 5, language: 'en' },
    { phrase: 'how do i', weight: 3, language: 'en' },
    { phrase: 'how to use', weight: 4, language: 'en' },
    { phrase: 'generate a report', weight: 5, language: 'en' },
    { phrase: 'create a report', weight: 5, language: 'en' },
    { phrase: 'download a report', weight: 5, language: 'en' },
    { phrase: 'create a pdf report', weight: 6, language: 'en' },
    { phrase: 'steps are needed to generate a report', weight: 6, language: 'en' },
    { phrase: 'report page', weight: 4, language: 'en' },
    { phrase: 'site help', weight: 4, language: 'en' },
    { phrase: 'website', weight: 3, language: 'en' },
    { phrase: 'page', weight: 2, language: 'en' },
    { phrase: 'meaning', weight: 3, language: 'en' },
    { phrase: 'explain page', weight: 3, language: 'en' },
    { phrase: 'esg page', weight: 4, language: 'en' },
    { phrase: 'sdg page', weight: 4, language: 'en' },
    { phrase: 'data policy', weight: 3, language: 'en' },
    { phrase: 'bagaimana menggunakan', weight: 5, language: 'ms' },
    { phrase: 'apakah borneo tracker', weight: 6, language: 'ms' },
    { phrase: 'apakah maksud', weight: 5, language: 'ms' },
    { phrase: 'cara guna', weight: 4, language: 'ms' },
    { phrase: 'jana laporan', weight: 5, language: 'ms' },
    { phrase: 'laman ini', weight: 4, language: 'ms' },
    { phrase: 'halaman esg', weight: 4, language: 'ms' },
    { phrase: 'halaman sdg', weight: 4, language: 'ms' },
    { phrase: 'laman', weight: 2, language: 'ms' },
    { phrase: 'halaman', weight: 2, language: 'ms' },
    { phrase: 'maksud', weight: 2, language: 'ms' },
  ],
  DASHBOARD_DATA: [
    { phrase: 'resilience score', weight: 6, language: 'en' },
    { phrase: 'resilience index', weight: 6, language: 'en' },
    { phrase: 'weakest pillar', weight: 6, language: 'en' },
    { phrase: 'which pillar', weight: 4, language: 'en' },
    { phrase: 'energy indicator', weight: 5, language: 'en' },
    { phrase: 'compare', weight: 4, language: 'en' },
    { phrase: 'difference between', weight: 3, language: 'en' },
    { phrase: 'dashboard data', weight: 5, language: 'en' },
    { phrase: 'forest cover value', weight: 8, language: 'en' },
    { phrase: 'which indicators support sdg', weight: 8, language: 'en' },
    { phrase: 'indicators support sdg', weight: 8, language: 'en' },
    { phrase: 'indicators are mapped to sdg', weight: 8, language: 'en' },
    { phrase: 'indicators mapped to sdg', weight: 8, language: 'en' },
    { phrase: 'indicators are tracked under sdg', weight: 8, language: 'en' },
    { phrase: 'indicators tracked under sdg', weight: 8, language: 'en' },
    { phrase: 'indicators for sdg', weight: 8, language: 'en' },
    { phrase: 'show me indicators for sdg', weight: 8, language: 'en' },
    { phrase: 'dashboard indicators map to', weight: 8, language: 'en' },
    { phrase: 'what does borneo tracker show for sdg', weight: 8, language: 'en' },
    { phrase: 'show for sdg', weight: 6, language: 'en' },
    { phrase: 'life on land', weight: 5, language: 'en' },
    { phrase: 'climate action', weight: 5, language: 'en' },
    { phrase: 'clean water and sanitation', weight: 5, language: 'en' },
    { phrase: 'good health and well-being', weight: 5, language: 'en' },
    { phrase: 'indicator', weight: 3, language: 'en' },
    { phrase: 'score', weight: 3, language: 'en' },
    { phrase: 'pillar', weight: 3, language: 'en' },
    { phrase: 'territory', weight: 2, language: 'en' },
    { phrase: 'region', weight: 2, language: 'en' },
    { phrase: 'daya tahan', weight: 6, language: 'ms' },
    { phrase: 'skor daya tahan', weight: 7, language: 'ms' },
    { phrase: 'penunjuk manakah', weight: 5, language: 'ms' },
    { phrase: 'paling lemah', weight: 5, language: 'ms' },
    { phrase: 'bandingkan', weight: 4, language: 'ms' },
    { phrase: 'penunjuk', weight: 3, language: 'ms' },
    { phrase: 'skor', weight: 3, language: 'ms' },
    { phrase: 'tunjang', weight: 3, language: 'ms' },
    { phrase: 'wilayah', weight: 2, language: 'ms' },
    { phrase: 'papan pemuka', weight: 3, language: 'ms' },
  ],
  BORNEO_NEWS: [
    { phrase: 'latest conservation news', weight: 7, language: 'en' },
    { phrase: 'latest news', weight: 6, language: 'en' },
    { phrase: 'recent borneo reports', weight: 6, language: 'en' },
    { phrase: 'recent reports', weight: 5, language: 'en' },
    { phrase: 'current updates', weight: 5, language: 'en' },
    { phrase: 'show recent', weight: 4, language: 'en' },
    { phrase: 'news', weight: 4, language: 'en' },
    { phrase: 'updates', weight: 3, language: 'en' },
    { phrase: 'conservation', weight: 3, language: 'en' },
    { phrase: 'forest news', weight: 5, language: 'en' },
    { phrase: 'berita terkini', weight: 7, language: 'ms' },
    { phrase: 'laporan terkini', weight: 6, language: 'ms' },
    { phrase: 'kemas kini', weight: 5, language: 'ms' },
    { phrase: 'pemuliharaan', weight: 4, language: 'ms' },
    { phrase: 'berita', weight: 4, language: 'ms' },
    { phrase: 'hutan', weight: 2, language: 'ms' },
    { phrase: 'terkini', weight: 3, language: 'ms' },
  ],
};

const OUT_OF_SCOPE_SIGNALS: IntentSignal[] = [
  { phrase: 'write code', weight: 5 },
  { phrase: 'debug', weight: 4 },
  { phrase: 'javascript', weight: 4 },
  { phrase: 'python', weight: 4 },
  { phrase: 'celebrity', weight: 5 },
  { phrase: 'movie star', weight: 5 },
  { phrase: 'homework', weight: 5 },
  { phrase: 'math problem', weight: 5 },
  { phrase: 'book a flight', weight: 6 },
  { phrase: 'hotel booking', weight: 6 },
  { phrase: 'travel booking', weight: 6 },
  { phrase: 'tempah penerbangan', weight: 6, language: 'ms' },
  { phrase: 'kerja sekolah', weight: 5, language: 'ms' },
  { phrase: 'selebriti', weight: 5, language: 'ms' },
];

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phrasePattern(phrase: string): RegExp {
  const normalized = normalizeText(phrase);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
}

function scoreSignals(normalizedQuestion: string, signals: IntentSignal[], reasonLabel: string): IntentScore {
  const result: IntentScore = { score: 0, matchedTerms: [], reasons: [] };
  const matchedNormalizedPhrases: string[] = [];

  const orderedSignals = [...signals].sort((a, b) => normalizeText(b.phrase).length - normalizeText(a.phrase).length);
  for (const signal of orderedSignals) {
    const normalizedPhrase = normalizeText(signal.phrase);
    if (matchedNormalizedPhrases.some((phrase) => phrase.includes(normalizedPhrase))) continue;
    if (!phrasePattern(signal.phrase).test(normalizedQuestion)) continue;
    result.score += signal.weight;
    result.matchedTerms.push(signal.phrase);
    result.reasons.push(`${reasonLabel}: ${signal.phrase}`);
    matchedNormalizedPhrases.push(normalizedPhrase);
  }

  return result;
}

function detectLanguage(explicitLanguage: string, normalizedQuestion: string, matchedSignals: IntentSignal[]): string {
  const hasMalaySignal = matchedSignals.some((signal) => signal.language === 'ms');
  const hasMalayToken = /\b(apakah|bagaimana|berita|terkini|kemas|kini|penunjuk|daya|tahan|skor|wilayah|laman|halaman|papan|pemuka)\b/.test(normalizedQuestion);
  if (hasMalaySignal || hasMalayToken) return 'ms';
  if (explicitLanguage === 'ms') return 'ms';
  return 'en';
}

function weakContextScore(intent: AIChatIntent, options: Partial<RouteOptions>): IntentScore {
  const result: IntentScore = { score: 0, matchedTerms: [], reasons: [] };
  const page = normalizeText(options.currentPage || '');
  const region = normalizeText(options.region || '');

  if (intent === 'BORNEO_NEWS' && page.includes('news')) {
    result.score += 0.5;
    result.reasons.push('weak context: currentPage news');
  }
  if (intent === 'DASHBOARD_DATA' && /dashboard|regions?|esg|sdg/.test(page)) {
    result.score += 0.5;
    result.reasons.push('weak context: dashboard/data page');
  }
  if (intent === 'SITE_KNOWLEDGE' && /about|reports?|privacy|terms|data-policy/.test(page)) {
    result.score += 0.5;
    result.reasons.push('weak context: site/help page');
  }
  if (intent === 'DASHBOARD_DATA' && region && TERRITORY_TERMS.includes(region)) {
    result.score += 0.25;
    result.reasons.push('weak context: selected region');
  }

  return result;
}

function mergeScores(...scores: IntentScore[]): IntentScore {
  return scores.reduce<IntentScore>((acc, score) => ({
    score: acc.score + score.score,
    matchedTerms: [...acc.matchedTerms, ...score.matchedTerms],
    reasons: [...acc.reasons, ...score.reasons],
  }), { score: 0, matchedTerms: [], reasons: [] });
}

function clampConfidence(score: number): number {
  if (score <= 0) return 0.15;
  return Math.min(0.99, Number((0.35 + score / 14).toFixed(2)));
}

export function routeAiChatIntent(
  question: string,
  options: Partial<RouteOptions> = {}
): AIChatIntentResult {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion) {
    return {
      intent: 'OUT_OF_SCOPE',
      confidence: 0.99,
      reasons: ['empty question'],
      matchedTerms: [],
      language: options.language === 'ms' ? 'ms' : 'en',
    };
  }

  const rawScores = Object.fromEntries(
    (Object.keys(SIGNALS) as Array<Exclude<AIChatIntent, 'OUT_OF_SCOPE'>>).map((intent) => [
      intent,
      scoreSignals(normalizedQuestion, SIGNALS[intent], `matched ${intent}`),
    ])
  ) as Record<Exclude<AIChatIntent, 'OUT_OF_SCOPE'>, IntentScore>;

  for (const intent of Object.keys(rawScores) as Array<Exclude<AIChatIntent, 'OUT_OF_SCOPE'>>) {
    if (rawScores[intent].score > 0) {
      rawScores[intent] = mergeScores(rawScores[intent], weakContextScore(intent, options));
    }
  }

  const outOfScope = scoreSignals(normalizedQuestion, OUT_OF_SCOPE_SIGNALS, 'matched OUT_OF_SCOPE');
  const allMatchedSignals = [
    ...Object.values(SIGNALS).flat(),
    ...OUT_OF_SCOPE_SIGNALS,
  ].filter((signal) => phrasePattern(signal.phrase).test(normalizedQuestion));
  const language = detectLanguage(options.language || 'en', normalizedQuestion, allMatchedSignals);

  const supportedScores = Object.entries(rawScores)
    .map(([intent, score]) => ({ intent: intent as AIChatIntent, ...score }))
    .filter((score) => score.score > 0)
    .sort((a, b) => b.score - a.score || INTENT_PRIORITY.indexOf(a.intent) - INTENT_PRIORITY.indexOf(b.intent));

  const strongestSupported = supportedScores[0];
  if (!strongestSupported || outOfScope.score > strongestSupported.score + 1) {
    return {
      intent: 'OUT_OF_SCOPE',
      confidence: outOfScope.score ? clampConfidence(outOfScope.score) : 0.72,
      reasons: outOfScope.reasons.length ? outOfScope.reasons : ['no supported Borneo Tracker intent matched'],
      matchedTerms: outOfScope.matchedTerms,
      language,
    };
  }

  const competingSupported = supportedScores.filter((score) => score.intent !== strongestSupported.intent && score.score > 0);
  const reasons = [...strongestSupported.reasons];
  const matchedTerms = [...new Set(strongestSupported.matchedTerms)];

  if (
    rawScores.DASHBOARD_DATA.score > 0 &&
    rawScores.BORNEO_NEWS.score > 0
  ) {
    reasons.push('ambiguous dashboard/news signals; mixed intent deferred');
    matchedTerms.push(...rawScores.DASHBOARD_DATA.matchedTerms, ...rawScores.BORNEO_NEWS.matchedTerms);
  } else if (competingSupported.length && competingSupported[0].score >= strongestSupported.score - 1) {
    reasons.push(`tie broken by priority over ${competingSupported[0].intent}`);
  }

  return {
    intent: strongestSupported.intent,
    confidence: clampConfidence(strongestSupported.score),
    reasons: [...new Set(reasons)],
    matchedTerms: [...new Set(matchedTerms)],
    language,
  };
}

// Deterministic "what if" answer builder (IS-6). Turns a resolved
// ResilienceSimulationRequest + its simulate_resilience() result into text —
// no LLM involved here. Gemini (in the RESILIENCE_SIMULATION branch of
// index.ts) only ever rephrases this text; every number in it is copied
// straight from simulate_resilience(), never computed here. Mirrors
// knowledgeAnswerBuilder.ts's shape/conventions (answer + approved token
// lists) for the same reason SITE_KNOWLEDGE has its own sibling answer type
// instead of overloading AIChatFactObject/AIChatStructuredAnswer.
import type { AIChatSimulationAnswer } from './contracts.ts';
import type { ResilienceSimulationRequest } from './resilienceSimulationRequest.ts';
import { simulate_resilience } from './resilienceSimulation.ts';

// Verbatim wording per IMPACT_SIMULATOR_SPEC.md §0/§3/§5 — the same sentence
// the /simulator UI shows on every result panel (IS-3D). Must never be
// paraphrased: this is a deliberate trust/legal safeguard, not decoration.
const ILLUSTRATIVE_EN = 'Illustrative — deterministic scenario, not a forecast.';
const ILLUSTRATIVE_MS = 'Ilustrasi — senario deterministik, bukan ramalan.';

const CLARIFICATION_INTRO = {
  en: 'I can simulate a "what if" change to the Resilience Index, but I need a bit more detail to run it:',
  ms: 'Saya boleh mensimulasikan perubahan "bagaimana jika" kepada Indeks Daya Tahan, tetapi saya perlukan sedikit maklumat lagi:',
};

const CLARIFICATION_TERRITORY_HINT = {
  en: 'Territory: one of Sabah, Sarawak, Brunei, or Kalimantan.',
  ms: 'Wilayah: salah satu daripada Sabah, Sarawak, Brunei, atau Kalimantan.',
};

const CLARIFICATION_INDICATOR_HINT = {
  en: 'Indicator to change, e.g.:',
  ms: 'Penunjuk untuk diubah, contohnya:',
};

const CLARIFICATION_VALUE_HINT = {
  en: 'A target value, e.g. "...to 70" or "...from 8 to 40".',
  ms: 'Nilai sasaran, contohnya "...kepada 70" atau "...dari 8 kepada 40".',
};

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function extractNumericTokens(text: string): string[] {
  const tokens = [...text.matchAll(/(^|[^\w])([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?)(?![\w])/g)].map((match) => match[2]);
  return [...new Set(tokens.flatMap((token) => [token, token.replace(/,/g, ''), token.replace(/^\+/, '')]))];
}

export function buildSimulationAnswer(
  request: ResilienceSimulationRequest,
  language: string
): AIChatSimulationAnswer {
  const resolvedLanguage = language === 'ms' ? 'ms' : 'en';

  if (request.status === 'NEEDS_CLARIFICATION') {
    return buildClarificationAnswer(request, resolvedLanguage);
  }

  const result = simulate_resilience(request.territory, { [request.indicator]: request.targetValue });
  const answer = buildScenarioText(request, result, resolvedLanguage);

  return {
    answer,
    language: resolvedLanguage,
    status: 'RESOLVED',
    territory: request.territory,
    indicator: request.indicator,
    targetValue: request.targetValue,
    before: result.before,
    after: result.after,
    deltas: result.deltas,
    approvedNumericTokens: extractNumericTokens(answer),
    approvedYearTokens: [],
    warnings: [],
  };
}

function buildScenarioText(
  request: Extract<ResilienceSimulationRequest, { status: 'RESOLVED' }>,
  result: ReturnType<typeof simulate_resilience>,
  language: 'en' | 'ms'
): string {
  const { territory, indicator, targetValue } = request;
  const indexBefore = result.before.index;
  const indexAfter = result.after.index;
  const strictBefore = result.before.indexStrict;
  const strictAfter = result.after.indexStrict;
  const weakestBefore = result.before.weakest;
  const weakestAfter = result.after.weakest;

  if (language === 'ms') {
    const lines = [
      `Senario: ${territory} — ${indicator} ditetapkan kepada ${targetValue}.`,
      indexBefore !== null && indexAfter !== null
        ? `Indeks Daya Tahan: ${indexBefore} → ${indexAfter} (${formatSigned(round1(indexAfter - indexBefore))}).`
        : 'Indeks Daya Tahan tidak tersedia untuk wilayah ini.',
      strictBefore !== null && strictAfter !== null
        ? `Indeks ketat (pautan terlemah): ${strictBefore} → ${strictAfter} (${formatSigned(round1(strictAfter - strictBefore))}).`
        : '',
      weakestBefore || weakestAfter
        ? `Tunjang terlemah: ${weakestBefore ?? '-'} → ${weakestAfter ?? '-'}.`
        : '',
      ILLUSTRATIVE_MS,
    ];
    return lines.filter(Boolean).join(' ');
  }

  const lines = [
    `Scenario: ${territory} — ${indicator} set to ${targetValue}.`,
    indexBefore !== null && indexAfter !== null
      ? `Resilience Index: ${indexBefore} → ${indexAfter} (${formatSigned(round1(indexAfter - indexBefore))}).`
      : 'The Resilience Index is not available for this territory.',
    strictBefore !== null && strictAfter !== null
      ? `Strict index (weakest-link): ${strictBefore} → ${strictAfter} (${formatSigned(round1(strictAfter - strictBefore))}).`
      : '',
    weakestBefore || weakestAfter
      ? `Weakest pillar: ${weakestBefore ?? '-'} → ${weakestAfter ?? '-'}.`
      : '',
    ILLUSTRATIVE_EN,
  ];
  return lines.filter(Boolean).join(' ');
}

function buildClarificationAnswer(
  request: Extract<ResilienceSimulationRequest, { status: 'NEEDS_CLARIFICATION' }>,
  language: 'en' | 'ms'
): AIChatSimulationAnswer {
  const indicatorList = request.candidateIndicators.slice(0, 6).join(', ');
  const lines =
    language === 'ms'
      ? [
          CLARIFICATION_INTRO.ms,
          CLARIFICATION_TERRITORY_HINT.ms,
          `${CLARIFICATION_INDICATOR_HINT.ms} ${indicatorList}.`,
          CLARIFICATION_VALUE_HINT.ms,
        ]
      : [
          CLARIFICATION_INTRO.en,
          CLARIFICATION_TERRITORY_HINT.en,
          `${CLARIFICATION_INDICATOR_HINT.en} ${indicatorList}.`,
          CLARIFICATION_VALUE_HINT.en,
        ];
  const answer = lines.join(' ');

  return {
    answer,
    language,
    status: 'NEEDS_CLARIFICATION',
    approvedNumericTokens: extractNumericTokens(answer),
    approvedYearTokens: [],
    warnings: request.reasons,
  };
}

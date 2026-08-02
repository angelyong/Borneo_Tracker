import type {
  AIChatFallbackMetadata,
  AIChatIntentResult,
  AIChatResponseMode,
  AIChatStructuredAnswer,
  FallbackReason,
  FactSource,
} from './contracts.ts';
import {
  assertApprovedSummaryNumbers,
  extractNumericTokens,
} from './structuredAnswerBuilder.ts';

export type TemplateFallbackInput = {
  structuredAnswer: AIChatStructuredAnswer;
  reason: FallbackReason;
  language: string;
  intent: AIChatIntentResult;
  safeErrorContext?: {
    code?: string;
    status?: number;
  };
};

export type TemplateFallbackResult = {
  answer: string;
  mode: Extract<AIChatResponseMode, 'template-fallback'>;
  sources: FactSource[];
  fallback: AIChatFallbackMetadata;
};

const NOTICES = {
  en: 'Live AI phrasing is temporarily unavailable. The verified Borneo Tracker data is shown below.',
  ms: 'Penyusunan jawapan AI secara langsung tidak tersedia buat sementara waktu. Data Borneo Tracker yang telah disahkan ditunjukkan di bawah.',
};

export function canBuildTemplateFallback(
  structuredAnswer: AIChatStructuredAnswer | undefined,
  intent: AIChatIntentResult | undefined
): structuredAnswer is AIChatStructuredAnswer {
  return Boolean(
    structuredAnswer &&
    intent?.intent === 'DASHBOARD_DATA' &&
    structuredAnswer.intent === 'DASHBOARD_DATA' &&
    structuredAnswer.summaryText.trim()
  );
}

export function buildTemplateFallback(input: TemplateFallbackInput): TemplateFallbackResult {
  const language = input.language === 'ms' || input.structuredAnswer.language === 'ms' ? 'ms' : 'en';
  const notice = NOTICES[language];
  const answer = `${notice}\n\n${input.structuredAnswer.summaryText.trim()}`;

  assertApprovedSummaryNumbers(
    answer,
    input.structuredAnswer.approvedNumericTokens,
    input.structuredAnswer.approvedYearTokens
  );

  return {
    answer,
    mode: 'template-fallback',
    sources: dedupeSources(input.structuredAnswer.sources),
    fallback: {
      used: true,
      reason: input.reason,
      generatedFrom: 'structured-answer',
      degraded: true,
    },
  };
}

export function fallbackPublicMetadata(metadata: AIChatFallbackMetadata): {
  used: true;
  reason: FallbackReason;
  degraded: true;
} {
  return {
    used: true,
    reason: metadata.reason || 'GEMINI_UNAVAILABLE',
    degraded: true,
  };
}

export function extractFallbackNumericTokens(text: string): string[] {
  return extractNumericTokens(text);
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

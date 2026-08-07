import type {
  AIChatFallbackMetadata,
  AIChatIntentResult,
  AIChatKnowledgeAnswer,
  AIChatResponseMode,
  AIChatSimulationAnswer,
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

export type KnowledgeTemplateFallbackInput = {
  knowledgeAnswer: AIChatKnowledgeAnswer;
  reason: FallbackReason;
  language: string;
};

export type SimulationTemplateFallbackInput = {
  simulationAnswer: AIChatSimulationAnswer;
  reason: FallbackReason;
  language: string;
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

export function canBuildKnowledgeTemplateFallback(
  knowledgeAnswer: AIChatKnowledgeAnswer | undefined
): knowledgeAnswer is AIChatKnowledgeAnswer {
  return Boolean(knowledgeAnswer?.answer?.trim());
}

export function canBuildSimulationTemplateFallback(
  simulationAnswer: AIChatSimulationAnswer | undefined
): simulationAnswer is AIChatSimulationAnswer {
  return Boolean(simulationAnswer?.answer?.trim());
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

export function buildKnowledgeTemplateFallback(input: KnowledgeTemplateFallbackInput): TemplateFallbackResult {
  const answer = input.knowledgeAnswer.answer.trim();
  assertNoUnsafeKnowledgeFallback(answer, input.knowledgeAnswer);
  return {
    answer,
    mode: 'template-fallback',
    sources: dedupeSources(input.knowledgeAnswer.sources),
    fallback: {
      used: true,
      reason: input.reason,
      generatedFrom: 'knowledge-answer',
      degraded: true,
    },
  };
}

export function buildSimulationTemplateFallback(input: SimulationTemplateFallbackInput): TemplateFallbackResult {
  const answer = input.simulationAnswer.answer.trim();
  assertNoUnsafeSimulationFallback(answer, input.simulationAnswer);
  return {
    answer,
    mode: 'template-fallback',
    sources: [],
    fallback: {
      used: true,
      reason: input.reason,
      generatedFrom: 'simulation-answer',
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

function assertNoUnsafeKnowledgeFallback(answer: string, knowledgeAnswer: AIChatKnowledgeAnswer): void {
  if (/\bhttps?:\/\/|\bwww\.|\b(?:public|src|supabase|knowledge|docs|data)\//i.test(answer)) {
    throw new Error('Knowledge fallback contains URLs or internal paths.');
  }
  const approved = new Set([
    ...knowledgeAnswer.approvedNumericTokens,
    ...knowledgeAnswer.approvedNumericTokens.map((token) => token.replace(/,/g, '')),
    ...knowledgeAnswer.approvedYearTokens,
  ]);
  for (const token of extractNumericTokens(answer)) {
    if (!approved.has(token) && !approved.has(token.replace(/,/g, ''))) {
      throw new Error(`Knowledge fallback contains unapproved numeric token ${token}.`);
    }
  }
}

function assertNoUnsafeSimulationFallback(answer: string, simulationAnswer: AIChatSimulationAnswer): void {
  if (/\bhttps?:\/\/|\bwww\.|\b(?:public|src|supabase|knowledge|docs|data)\//i.test(answer)) {
    throw new Error('Simulation fallback contains URLs or internal paths.');
  }
  const approved = new Set([
    ...simulationAnswer.approvedNumericTokens,
    ...simulationAnswer.approvedNumericTokens.map((token) => token.replace(/,/g, '')),
    ...simulationAnswer.approvedYearTokens,
  ]);
  for (const token of extractNumericTokens(answer)) {
    if (!approved.has(token) && !approved.has(token.replace(/,/g, ''))) {
      throw new Error(`Simulation fallback contains unapproved numeric token ${token}.`);
    }
  }
}

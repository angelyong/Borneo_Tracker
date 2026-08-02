export const MAX_MESSAGE_LENGTH = 1200;

export type AIChatRequest = {
  message: string;
  currentPage: string;
  region: string;
  language: string;
};

export type AIChatIntent =
  | 'SITE_KNOWLEDGE'
  | 'DASHBOARD_DATA'
  | 'BORNEO_NEWS'
  | 'OUT_OF_SCOPE';

export type AIChatIntentResult = {
  intent: AIChatIntent;
  confidence: number;
  reasons: string[];
  matchedTerms: string[];
  language: string;
};

export type AIChatEntityResult = {
  territories: string[];
  regions: string[];
  concepts: string[];
  indicators: string[];
  pillars: string[];
  districts: string[];
  years: number[];
  yearRange?: {
    start: number;
    end: number;
  };
  operations: {
    comparison: boolean;
    ranking: boolean;
    trend: boolean;
    weakest: boolean;
    strongest: boolean;
    targetGap: boolean;
    sdgProgress: boolean;
    districtLevel: boolean;
    latest: boolean;
  };
  ambiguities: string[];
  matchedTerms: string[];
  language: string;
};

export type ComparabilityDecision =
  | 'ALLOW'
  | 'ALLOW_WITH_WARNING'
  | 'DOWNGRADE'
  | 'REJECT'
  | 'NEEDS_CLARIFICATION';

export type ComparabilityOperation =
  | 'compare'
  | 'rank'
  | 'trend'
  | 'sdg_progress'
  | 'district_answer'
  | 'describe'
  | 'year_alignment';

export type ConceptComparabilityRule = {
  concept: string;
  crossTerritoryComparable: boolean;
  comparableBasis?: string;
  blockedReasons?: string[];
  requiresSameIndicator?: boolean;
  requiresSameUnit?: boolean;
  requiresSameDenominator?: boolean;
  requiresNormalization?: string;
  inheritedNationalValue?: boolean;
  trendAvailable?: boolean;
  methodologyBreaks?: number[];
  disclosures?: string[];
};

export type ComparabilityMetadataRow = {
  territory?: string;
  parent?: string;
  indicator?: string;
  dashboard_concept?: string;
  year?: string | number;
  unit?: string;
  source?: string;
  data_level?: string;
  confidence?: string;
  canonical?: string | number | boolean;
  is_derived?: string | number | boolean;
  derived_from?: string;
  denominator?: string;
  measurement_definition?: string;
};

export type ComparabilityInput = {
  intent?: AIChatIntentResult;
  entities?: AIChatEntityResult;
  concepts?: string[];
  indicators?: string[];
  territories?: string[];
  districts?: string[];
  years?: Array<string | number>;
  operations?: ComparabilityOperation[];
  ambiguities?: string[];
  metadata?: {
    rows?: ComparabilityMetadataRow[];
    series?: Record<string, Record<string, unknown>>;
    districts?: {
      generatedAt?: string;
      rows?: ComparabilityMetadataRow[];
      parents?: Record<string, string[]>;
    };
  };
  freshness?: {
    now?: string;
    staleAfterDays?: number;
    districtsGeneratedAt?: string;
  };
  options?: {
    explicitHistoricalComparison?: boolean;
    normalizedComparisonBasis?: string;
    rankingClaim?: boolean;
  };
};

export type ComparabilityResult = {
  decision: ComparabilityDecision;
  reasons: string[];
  warnings: string[];
  blockedOperations: string[];
  allowedOperations: string[];
  requiredDisclosures: string[];
  normalizedComparisonBasis?: string;
};

export type FactAvailability =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'BLOCKED';

export type FactValueStatus = 'direct' | 'calculated' | 'derived' | 'inherited';

export type FactValue = {
  value: number | string;
  formattedValue: string;
  unit?: string;
  year?: number;
  status: FactValueStatus;
  label?: string;
  territory?: string;
  concept?: string;
  indicator?: string;
  pillar?: string;
  sourcePath?: string;
};

export type FactSource = {
  id?: string;
  publisher?: string;
  title?: string;
  year?: number;
  url?: string;
  sourceFile: string;
  sourcePath?: string;
};

export type LeverActor =
  | 'government'
  | 'local_authority'
  | 'community'
  | 'private_sector'
  | 'civil_society'
  | 'research_institution'
  | 'multiple'
  | 'unspecified';

export type LeverHorizon =
  | 'short'
  | 'medium'
  | 'long'
  | 'unspecified';

export type LeverEvidenceStatus =
  | 'VERIFIED'
  | 'INCOMPLETE'
  | 'PLACEHOLDER'
  | 'REJECTED';

export type LeverEvidence = {
  publisher?: string;
  year?: number;
  title?: string;
  url?: string;
  sourceFile: string;
  sourcePath?: string;
  whatItActuallySays: string;
};

export type LeverRecord = {
  id: string;
  concept: string;
  pillars: string[];
  territories: string[];
  title: string;
  summary: string;
  whoActs: LeverActor[];
  horizon: LeverHorizon;
  mechanism: string;
  appliesWhen: string[];
  doesNotApplyWhen: string[];
  expectedDirection?: 'improve' | 'reduce_risk' | 'maintain';
  evidence: LeverEvidence[];
  evidenceStatus: LeverEvidenceStatus;
  language: 'en' | 'ms';
  keywords: string[];
  translationGroupId?: string;
};

export type LeverQuery = {
  concepts: string[];
  pillars: string[];
  territories: string[];
  language: string;
  factObject?: AIChatFactObject;
  limit?: number;
};

export type LeverRetrievalResult = {
  records: LeverRecord[];
  matchedBy: string[];
  warnings: string[];
  emptyReason?: 'NO_VERIFIED_APPLICABLE_LEVER' | 'BLOCKED_OR_CLARIFICATION' | 'NO_LEVER_LIBRARY_RECORDS';
};

export type LeverLibraryArtifact = {
  schemaVersion: number;
  generatedAt: string;
  recordCount: number;
  records: LeverRecord[];
};

export type LeverBuildReport = {
  buildTimestamp: string;
  inputFiles: string[];
  counts: Record<LeverEvidenceStatus, number>;
  runtimeRecords: number;
  invalidRecords: Array<{
    id?: string;
    sourceFile?: string;
    errors: string[];
  }>;
  excludedRecords: Array<{
    id: string;
    evidenceStatus: LeverEvidenceStatus;
    reason: string;
  }>;
  warnings: string[];
  outputFiles: string[];
};

export type AIChatNewsStatus =
  | 'published'
  | 'pending';

export type AIChatNewsTerritory =
  | 'Sabah'
  | 'Sarawak'
  | 'Brunei'
  | 'Kalimantan'
  | 'Borneo-wide'
  | 'unknown';

export type AIChatNewsLanguage =
  | 'en'
  | 'ms'
  | 'unknown';

export type AIChatPublishedNewsItem = {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  publisher?: string;
  url?: string;
  territory: AIChatNewsTerritory;
  language?: AIChatNewsLanguage;
  sourceFile?: string;
};

export type AIChatNewsQuery = {
  territories: string[];
  fromDate?: string;
  toDate?: string;
  latest?: boolean;
  limit?: number;
  language?: string;
};

export type AIChatPendingNewsSummary = {
  count: number;
};

export type AIChatNewsResult = {
  published: AIChatPublishedNewsItem[];
  pending: AIChatPendingNewsSummary;
  warnings: string[];
  queryApplied: {
    territories: string[];
    fromDate?: string;
    toDate?: string;
    limit: number;
  };
};

export type FactWarning = {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'blocking';
};

export type AIChatFactObject = {
  availability: FactAvailability;
  intent: AIChatIntent;
  territories: string[];
  concepts: string[];
  indicators: string[];
  pillars: string[];
  districts: string[];
  conclusion?: {
    code: string;
    text: string;
  };
  diagnosis?: {
    weakestPillar?: string;
    strongestPillar?: string;
    supportingPillars?: string[];
  };
  values: {
    rawValues: FactValue[];
    indicatorScores: FactValue[];
    pillarScores: FactValue[];
    overallResilience?: FactValue;
    target?: FactValue;
    gap?: FactValue;
    trends?: FactValue[];
    districtValues?: FactValue[];
  };
  comparison: {
    requested: boolean;
    allowed: boolean;
    basis?: string;
    decision: ComparabilityDecision;
  };
  impact?: {
    available: boolean;
    description?: string;
    method?: string;
  };
  methodologyNotes: string[];
  requiredDisclosures: string[];
  warnings: FactWarning[];
  sources: FactSource[];
  approvedNumericTokens: string[];
  approvedYearTokens: string[];
};

export type AnswerLayerStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

export type AnswerLayer = {
  status: AnswerLayerStatus;
  heading: string;
  text: string;
  codes: string[];
  factReferences: string[];
  warnings: string[];
};

export type EvidenceLeverLayer = AnswerLayer & {
  leverIds: string[];
  requiresGeminiPhrasing: boolean;
};

export type AIChatStructuredAnswer = {
  availability: FactAvailability;
  language: string;
  intent: AIChatIntent;
  layers: {
    conclusion: AnswerLayer;
    diagnosis: AnswerLayer;
    gap: AnswerLayer;
    impact: AnswerLayer;
    lever: EvidenceLeverLayer;
    honesty: AnswerLayer;
  };
  summaryText: string;
  requiredDisclosures: string[];
  warnings: FactWarning[];
  sources: FactSource[];
  approvedNumericTokens: string[];
  approvedYearTokens: string[];
  blocked: boolean;
  clarificationRequired: boolean;
};

export type AIChatResponseMode =
  | 'gemini-test'
  | 'template-fallback';

export type FallbackReason =
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_RATE_LIMIT'
  | 'GEMINI_UNAVAILABLE'
  | 'GEMINI_HTTP_ERROR'
  | 'GEMINI_MALFORMED_RESPONSE'
  | 'GEMINI_EMPTY_RESPONSE'
  | 'GEMINI_NOT_CONFIGURED'
  | 'GEMINI_RESPONSE_REJECTED'
  | 'DETERMINISTIC_BLOCKED'
  | 'DETERMINISTIC_CLARIFICATION'
  | 'QUOTA_UNAVAILABLE';

export type AIChatFallbackMetadata = {
  used: boolean;
  reason?: FallbackReason;
  generatedFrom: 'structured-answer';
  degraded: boolean;
};

export type AIChatPromptInput = {
  userQuestion: string;
  language: string;
  intent: AIChatIntent;
  entities: AIChatEntityResult;
  comparability: ComparabilityResult;
  factObject: AIChatFactObject;
  structuredAnswer: AIChatStructuredAnswer;
  levers?: LeverRetrievalResult;
};

export type AIChatSourceLabel = {
  publisher?: string;
  title?: string;
  year?: number;
};

export type AIChatPromptLever = {
  id: string;
  title: string;
  summary: string;
  whoActs: LeverActor[];
  horizon: LeverHorizon;
  mechanism: string;
  appliesWhen: string[];
  evidence: AIChatSourceLabel[];
};

export type AIChatGroundingPayload = {
  answerStatus: FactAvailability;
  blocked: boolean;
  clarificationRequired: boolean;
  conclusion: string;
  diagnosis: string;
  gap: string;
  impact: string;
  lever: string;
  honesty: string;
  requiredDisclosures: string[];
  warnings: string[];
  approvedNumericTokens: string[];
  approvedYearTokens: string[];
  sources: AIChatSourceLabel[];
  levers: AIChatPromptLever[];
};

export type AIChatPrompt = {
  systemInstruction: string;
  userContent: string;
  groundingPayload: AIChatGroundingPayload;
};

export type ResponseValidationFailureCode =
  | 'EMPTY_ANSWER'
  | 'ANSWER_TOO_LONG'
  | 'UNAPPROVED_NUMBER'
  | 'UNAPPROVED_YEAR'
  | 'URL_IN_BODY'
  | 'UNVERIFIED_SOURCE'
  | 'UNSUPPORTED_COMPARISON'
  | 'BLOCKED_STATE_BYPASSED'
  | 'CLARIFICATION_STATE_BYPASSED'
  | 'UNVERIFIED_RECOMMENDATION'
  | 'SECRET_DISCLOSURE'
  | 'SYSTEM_INSTRUCTION_DISCLOSURE'
  | 'INTERNAL_METADATA_DISCLOSURE'
  | 'UNSUPPORTED_RANKING'
  | 'UNSUPPORTED_TREND'
  | 'UNSUPPORTED_TARGET_OR_GAP'
  | 'MALFORMED_OUTPUT';

export type ResponseValidationIssue = {
  code: ResponseValidationFailureCode;
  message: string;
  token?: string;
  severity: 'blocking';
};

export type AIChatResponseValidationResult = {
  valid: boolean;
  issues: ResponseValidationIssue[];
  detectedNumericTokens: string[];
  detectedYearTokens: string[];
  detectedUrls: string[];
  normalizedAnswer?: string;
};

export type AIChatResponseValidationInput = {
  answer: unknown;
  factObject: AIChatFactObject;
  structuredAnswer: AIChatStructuredAnswer;
  comparability: ComparabilityResult;
  prompt: AIChatPrompt;
  maxAnswerLength?: number;
};

export type AIChatSuccessResponse = {
  answer: string;
  mode: AIChatResponseMode;
  sources: FactSource[];
  fallback?: {
    used: true;
    reason: FallbackReason;
    degraded: true;
  };
};

export type AIChatErrorResponse = {
  error: string;
  code: string;
};

export type AIChatResponse = AIChatSuccessResponse;
export type ErrorPayload = AIChatErrorResponse;

export class AIChatHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AIChatHttpError';
    this.status = status;
    this.code = code;
  }
}

function sanitizeOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AIChatHttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

export function validateChatRequest(body: unknown): AIChatRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AIChatHttpError(400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }

  const record = body as Record<string, unknown>;
  if (!Object.hasOwn(record, 'message')) {
    throw new AIChatHttpError(400, 'MISSING_MESSAGE', 'Message is required.');
  }
  if (typeof record.message !== 'string') {
    throw new AIChatHttpError(400, 'INVALID_MESSAGE', 'Message must be a string.');
  }

  const message = record.message.trim();
  if (!message) {
    throw new AIChatHttpError(400, 'EMPTY_MESSAGE', 'Message cannot be empty.');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new AIChatHttpError(
      400,
      'MESSAGE_TOO_LONG',
      `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`
    );
  }

  return {
    message,
    currentPage: sanitizeOptionalString(record.currentPage || '/'),
    region: sanitizeOptionalString(record.region),
    language: sanitizeOptionalString(record.language || 'en') || 'en',
  };
}

function responseHeaders(extraHeaders?: HeadersInit): Headers {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return headers;
}

export function jsonResponse(
  payload: AIChatResponse | ErrorPayload,
  status = 200,
  extraHeaders?: HeadersInit
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders(extraHeaders),
  });
}

export function errorResponse(error: unknown, extraHeaders?: HeadersInit): Response {
  if (error instanceof AIChatHttpError) {
    return jsonResponse({ error: error.message, code: error.code }, error.status, extraHeaders);
  }
  return jsonResponse(
    { error: 'The AI assistant could not respond right now.', code: 'AI_CHAT_ERROR' },
    500,
    extraHeaders
  );
}

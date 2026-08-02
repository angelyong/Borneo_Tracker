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

export type AIChatSuccessResponse = {
  answer: string;
  mode: 'gemini-test';
  sources: [];
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

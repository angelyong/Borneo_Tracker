import {
  type AIChatIdentityType,
  type AIChatIntent,
  type AIChatResponseMode,
  type AIChatTelemetryOutcome,
  type FallbackReason,
} from './contracts.ts';
import { envValue, type EnvLike } from './config.ts';

export type AIChatTelemetryEvent = {
  requestId?: string;
  identityType: AIChatIdentityType | 'unknown';
  identityKeyHash?: string;
  intent?: AIChatIntent;
  mode?: AIChatResponseMode;
  outcome: AIChatTelemetryOutcome;
  fallbackUsed?: boolean;
  fallbackReason?: FallbackReason;
  errorCode?: string;
  modelCalled?: boolean;
  quotaConsumed?: boolean;
  responseStatus?: number;
  latencyMs?: number;
  sourceCount?: number;
  language?: string;
  region?: string;
  currentPage?: string;
};

export type AIChatTelemetryInsertRow = {
  request_id?: string;
  identity_type: AIChatIdentityType | 'unknown';
  identity_key_hash?: string;
  intent?: AIChatIntent;
  mode?: AIChatResponseMode;
  outcome: AIChatTelemetryOutcome;
  fallback_used: boolean;
  fallback_reason?: FallbackReason;
  error_code?: string;
  model_called: boolean;
  quota_consumed: boolean;
  response_status?: number;
  latency_ms?: number;
  source_count?: number;
  language?: 'en' | 'ms';
  region?: string;
  current_page?: string;
};

export type AIChatTelemetryAdapter = {
  insert(row: AIChatTelemetryInsertRow): Promise<void>;
};

export type AIChatTelemetryRecordResult =
  | { status: 'recorded' }
  | { status: 'skipped'; reason: 'ADAPTER_UNAVAILABLE' }
  | { status: 'failed'; reason: 'ADAPTER_ERROR' | 'MALFORMED_EVENT' };

type TelemetryServiceOptions = {
  env?: EnvLike;
  adapter?: AIChatTelemetryAdapter;
  fetchImpl?: typeof fetch;
};

type SupabaseTelemetryAdapterOptions = {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
};

const SUPPORTED_REGIONS = new Set(['Sabah', 'Sarawak', 'Brunei', 'Kalimantan', 'Borneo-wide']);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9:_-]{8,80}$/;
const IDENTITY_KEY_PATTERN = /^[A-Za-z0-9:_-]{16,256}$/;
const SAFE_ERROR_CODE_PATTERN = /^[A-Z0-9_]{2,80}$/;

export class AIChatTelemetryService {
  private readonly adapter?: AIChatTelemetryAdapter;

  constructor(options: TelemetryServiceOptions = {}) {
    this.adapter = options.adapter || createSupabaseTelemetryAdapter(options);
  }

  async record(event: AIChatTelemetryEvent): Promise<AIChatTelemetryRecordResult> {
    if (!this.adapter) return { status: 'skipped', reason: 'ADAPTER_UNAVAILABLE' };
    const row = normalizeTelemetryEvent(event);
    if (!row) return { status: 'failed', reason: 'MALFORMED_EVENT' };
    try {
      await this.adapter.insert(row);
      return { status: 'recorded' };
    } catch {
      return { status: 'failed', reason: 'ADAPTER_ERROR' };
    }
  }
}

export class MemoryTelemetryAdapter implements AIChatTelemetryAdapter {
  readonly rows: AIChatTelemetryInsertRow[] = [];

  async insert(row: AIChatTelemetryInsertRow): Promise<void> {
    this.rows.push(row);
  }
}

export class FailingTelemetryAdapter implements AIChatTelemetryAdapter {
  async insert(): Promise<void> {
    throw new Error('telemetry unavailable');
  }
}

export class SupabaseTelemetryAdapter implements AIChatTelemetryAdapter {
  private readonly url: string;
  private readonly serviceKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseTelemetryAdapterOptions = {}) {
    const url = envValue(options.env, 'SUPABASE_URL');
    const serviceKey = envValue(options.env, 'SUPABASE_SERVICE_ROLE_KEY') || envValue(options.env, 'SUPABASE_SERVICE_KEY');
    if (!url || !serviceKey) {
      throw new Error('AI_CHAT_TELEMETRY_ADAPTER_UNAVAILABLE');
    }
    this.url = url.replace(/\/+$/, '');
    this.serviceKey = serviceKey;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async insert(row: AIChatTelemetryInsertRow): Promise<void> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/ai_chat_events`, {
      method: 'POST',
      headers: {
        apikey: this.serviceKey,
        authorization: `Bearer ${this.serviceKey}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      throw new Error('AI_CHAT_TELEMETRY_WRITE_FAILED');
    }
  }
}

export function createAIChatTelemetryService(options: TelemetryServiceOptions = {}): AIChatTelemetryService {
  return new AIChatTelemetryService(options);
}

export function generateAIChatRequestId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `req_${Date.now().toString(36)}`;
}

export function telemetryNowMs(): number {
  const value = globalThis.performance?.now?.();
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

export function telemetryElapsedMs(startMs: number): number {
  const elapsed = Math.round(telemetryNowMs() - startMs);
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.min(elapsed, 86_400_000);
}

export function normalizeTelemetryEvent(event: AIChatTelemetryEvent): AIChatTelemetryInsertRow | undefined {
  if (!['anonymous', 'authenticated', 'admin', 'ip_guard', 'unknown'].includes(event.identityType)) return undefined;
  if (!['success', 'fallback', 'refused', 'rate_limited', 'error'].includes(event.outcome)) return undefined;

  const requestId = boundedRequestId(event.requestId);
  const identityKeyHash = boundedIdentityKey(event.identityKeyHash);
  const errorCode = boundedErrorCode(event.errorCode);
  const responseStatus = boundedInteger(event.responseStatus, 100, 599);
  const latencyMs = boundedInteger(event.latencyMs, 0, 86_400_000);
  const sourceCount = boundedInteger(event.sourceCount, 0, 1000);
  const language = event.language === 'ms' ? 'ms' : event.language === 'en' ? 'en' : undefined;
  const region = normalizeTelemetryRegion(event.region);
  const currentPage = normalizeTelemetryCurrentPage(event.currentPage);

  return {
    ...(requestId ? { request_id: requestId } : {}),
    identity_type: event.identityType,
    ...(identityKeyHash ? { identity_key_hash: identityKeyHash } : {}),
    ...(event.intent ? { intent: event.intent } : {}),
    ...(event.mode ? { mode: event.mode } : {}),
    outcome: event.outcome,
    fallback_used: Boolean(event.fallbackUsed),
    ...(event.fallbackReason ? { fallback_reason: event.fallbackReason } : {}),
    ...(errorCode ? { error_code: errorCode } : {}),
    model_called: Boolean(event.modelCalled),
    quota_consumed: Boolean(event.quotaConsumed),
    ...(typeof responseStatus === 'number' ? { response_status: responseStatus } : {}),
    ...(typeof latencyMs === 'number' ? { latency_ms: latencyMs } : {}),
    ...(typeof sourceCount === 'number' ? { source_count: sourceCount } : {}),
    ...(language ? { language } : {}),
    ...(region ? { region } : {}),
    ...(currentPage ? { current_page: currentPage } : {}),
  };
}

export function normalizeTelemetryRegion(value?: string): string | undefined {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return SUPPORTED_REGIONS.has(normalized) ? normalized : undefined;
}

export function normalizeTelemetryCurrentPage(value?: string): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) return undefined;
  const withoutFragment = raw.split('#')[0] || '';
  const withoutQuery = withoutFragment.split('?')[0] || '';
  const path = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  if (path.length > 120 || !/^\/[A-Za-z0-9/_-]*$/.test(path)) return undefined;
  return path || '/';
}

function createSupabaseTelemetryAdapter(options: TelemetryServiceOptions): AIChatTelemetryAdapter | undefined {
  try {
    return new SupabaseTelemetryAdapter({ env: options.env, fetchImpl: options.fetchImpl });
  } catch {
    return undefined;
  }
}

function boundedRequestId(value?: string): string | undefined {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return REQUEST_ID_PATTERN.test(normalized) ? normalized : undefined;
}

function boundedIdentityKey(value?: string): string | undefined {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return IDENTITY_KEY_PATTERN.test(normalized) ? normalized : undefined;
}

function boundedErrorCode(value?: string): string | undefined {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return SAFE_ERROR_CODE_PATTERN.test(normalized) ? normalized : undefined;
}

function boundedInteger(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const integer = Math.floor(value);
  if (integer < min || integer > max) return undefined;
  return integer;
}

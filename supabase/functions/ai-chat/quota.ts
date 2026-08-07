import {
  AIChatHttpError,
  type AIChatIdentity,
  type AIChatQuotaMetadata,
  type AIChatQuotaRefundResult,
  type AIChatQuotaReserveResult,
  type AIChatRequestIdentityType,
} from './contracts.ts';
import { envValue, type EnvLike } from './config.ts';

export const DEFAULT_AI_CHAT_DAILY_LIMITS: Record<AIChatRequestIdentityType, number> = {
  anonymous: 5,
  authenticated: 25,
  admin: 50,
};

export type AIChatQuotaIdentityType = Extract<AIChatRequestIdentityType, 'authenticated' | 'admin'>;

export type AIChatQuotaReservation = {
  usageDate: string;
  identityType: AIChatQuotaIdentityType;
  identityKey: string;
  limit: number;
};

export type AIChatQuotaReserveInput = {
  usageDate: string;
  identityType: AIChatQuotaIdentityType;
  identityKey: string;
  dailyLimit: number;
};

export type AIChatQuotaRefundInput = {
  usageDate: string;
  identityType: AIChatQuotaIdentityType;
  identityKey: string;
};

export type AIChatQuotaAdapter = {
  reserve(input: AIChatQuotaReserveInput): Promise<AIChatQuotaReserveResult>;
  refund(input: AIChatQuotaRefundInput): Promise<AIChatQuotaRefundResult>;
};

export type AIChatQuotaReservationResult =
  | {
      status: 'reserved';
      reservation: AIChatQuotaReservation;
      quota: AIChatQuotaMetadata;
    }
  | {
      status: 'exhausted';
      quota: AIChatQuotaMetadata;
    }
  | {
      status: 'unavailable';
      reason: 'ANONYMOUS_IDENTITY_DEFERRED' | 'ADAPTER_UNAVAILABLE' | 'INVALID_IDENTITY' | 'ADAPTER_ERROR';
      limit?: number;
    };

export type AIChatQuotaRefundServiceResult =
  | { status: 'refunded'; quota: AIChatQuotaMetadata }
  | { status: 'not_refunded'; quota?: AIChatQuotaMetadata }
  | { status: 'unavailable'; reason: 'ADAPTER_UNAVAILABLE' | 'ADAPTER_ERROR' };

type QuotaServiceOptions = {
  env?: EnvLike;
  adapter?: AIChatQuotaAdapter;
  limits?: Partial<Record<AIChatRequestIdentityType, number>>;
  now?: () => Date;
};

type SupabaseQuotaAdapterOptions = {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
};

export type AIChatQuotaServiceLike = {
  reserveForModelCall(identity: AIChatIdentity): Promise<AIChatQuotaReservationResult>;
  refundReservation(reservation: AIChatQuotaReservation): Promise<AIChatQuotaRefundServiceResult>;
};

export class AIChatQuotaService implements AIChatQuotaServiceLike {
  private readonly adapter?: AIChatQuotaAdapter;
  private readonly limits: Record<AIChatRequestIdentityType, number>;
  private readonly now: () => Date;

  constructor(options: QuotaServiceOptions = {}) {
    this.adapter = options.adapter || createSupabaseQuotaAdapter(options.env);
    this.limits = {
      ...DEFAULT_AI_CHAT_DAILY_LIMITS,
      ...parseLimitEnv(options.env),
      ...sanitizeLimits(options.limits),
    };
    this.now = options.now || (() => new Date());
  }

  async reserveForModelCall(identity: AIChatIdentity): Promise<AIChatQuotaReservationResult> {
    const limit = this.limits[identity.type] ?? DEFAULT_AI_CHAT_DAILY_LIMITS.authenticated;
    if (identity.type === 'anonymous') {
      return { status: 'unavailable', reason: 'ANONYMOUS_IDENTITY_DEFERRED', limit };
    }
    if (!identity.verified || !identity.userId) {
      return { status: 'unavailable', reason: 'INVALID_IDENTITY', limit };
    }
    if (!this.adapter) {
      return { status: 'unavailable', reason: 'ADAPTER_UNAVAILABLE', limit };
    }

    const reservation: AIChatQuotaReservation = {
      usageDate: usageDateUtc(this.now()),
      identityType: identity.type,
      identityKey: stableIdentityKey(identity),
      limit,
    };

    try {
      const result = await this.adapter.reserve({
        usageDate: reservation.usageDate,
        identityType: reservation.identityType,
        identityKey: reservation.identityKey,
        dailyLimit: limit,
      });
      const quota = quotaMetadata(result);
      if (!result.allowed) {
        return { status: 'exhausted', quota };
      }
      return { status: 'reserved', reservation, quota };
    } catch {
      return { status: 'unavailable', reason: 'ADAPTER_ERROR', limit };
    }
  }

  async refundReservation(reservation: AIChatQuotaReservation): Promise<AIChatQuotaRefundServiceResult> {
    if (!this.adapter) {
      return { status: 'unavailable', reason: 'ADAPTER_UNAVAILABLE' };
    }
    try {
      const result = await this.adapter.refund({
        usageDate: reservation.usageDate,
        identityType: reservation.identityType,
        identityKey: reservation.identityKey,
      });
      return result.refunded
        ? { status: 'refunded', quota: quotaMetadata(result) }
        : { status: 'not_refunded', quota: quotaMetadata(result) };
    } catch {
      return { status: 'unavailable', reason: 'ADAPTER_ERROR' };
    }
  }
}

export class MemoryQuotaAdapter implements AIChatQuotaAdapter {
  private readonly counters = new Map<string, { limit: number; reserved: number; used: number }>();

  async reserve(input: AIChatQuotaReserveInput): Promise<AIChatQuotaReserveResult> {
    const key = adapterKey(input);
    const counter = this.counters.get(key) || { limit: input.dailyLimit, reserved: 0, used: 0 };
    counter.limit = input.dailyLimit;
    const allowed = counter.reserved + counter.used < counter.limit;
    if (allowed) counter.reserved += 1;
    this.counters.set(key, counter);
    return adapterResult(input, counter, { allowed });
  }

  async refund(input: AIChatQuotaRefundInput): Promise<AIChatQuotaRefundResult> {
    const key = adapterKey(input);
    const counter = this.counters.get(key) || { limit: 0, reserved: 0, used: 0 };
    const refunded = counter.reserved > 0;
    if (refunded) counter.reserved -= 1;
    this.counters.set(key, counter);
    return {
      ...adapterResult({
        usageDate: input.usageDate,
        identityType: input.identityType,
        identityKey: input.identityKey,
        dailyLimit: counter.limit,
      }, counter, {}),
      refunded,
    };
  }
}

export class SupabaseQuotaAdapter implements AIChatQuotaAdapter {
  private readonly url: string;
  private readonly serviceKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseQuotaAdapterOptions = {}) {
    const url = readEnv(options.env, 'SUPABASE_URL');
    const serviceKey = readEnv(options.env, 'SUPABASE_SERVICE_ROLE_KEY') || readEnv(options.env, 'SUPABASE_SERVICE_KEY');
    if (!url || !serviceKey) {
      throw new AIChatHttpError(503, 'AI_CHAT_QUOTA_UNAVAILABLE', 'The AI assistant quota check is unavailable right now.');
    }
    this.url = url.replace(/\/+$/, '');
    this.serviceKey = serviceKey;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async reserve(input: AIChatQuotaReserveInput): Promise<AIChatQuotaReserveResult> {
    return normalizeReserveResult(await this.callRpc('reserve_ai_chat_quota', {
      p_usage_date: input.usageDate,
      p_identity_type: input.identityType,
      p_identity_key_hash: input.identityKey,
      p_daily_limit: input.dailyLimit,
    }));
  }

  async refund(input: AIChatQuotaRefundInput): Promise<AIChatQuotaRefundResult> {
    return normalizeRefundResult(await this.callRpc('refund_ai_chat_quota', {
      p_usage_date: input.usageDate,
      p_identity_type: input.identityType,
      p_identity_key_hash: input.identityKey,
    }));
  }

  private async callRpc(name: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: this.serviceKey,
        authorization: `Bearer ${this.serviceKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new AIChatHttpError(503, 'AI_CHAT_QUOTA_UNAVAILABLE', 'The AI assistant quota check is unavailable right now.');
    }
    try {
      return await response.json();
    } catch {
      throw new AIChatHttpError(503, 'AI_CHAT_QUOTA_UNAVAILABLE', 'The AI assistant quota check is unavailable right now.');
    }
  }
}

export function createAIChatQuotaService(options: QuotaServiceOptions = {}): AIChatQuotaService {
  return new AIChatQuotaService(options);
}

function createSupabaseQuotaAdapter(env?: EnvLike): AIChatQuotaAdapter | undefined {
  try {
    return new SupabaseQuotaAdapter({ env });
  } catch {
    return undefined;
  }
}

function stableIdentityKey(identity: AIChatIdentity): string {
  return `${identity.type}:${identity.userId}`;
}

function usageDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function quotaMetadata(result: Pick<AIChatQuotaReserveResult, 'daily_limit' | 'remaining'>): AIChatQuotaMetadata {
  return {
    remaining: Math.max(0, Math.floor(result.remaining)),
    limit: Math.max(0, Math.floor(result.daily_limit)),
  };
}

function normalizeReserveResult(payload: unknown): AIChatQuotaReserveResult {
  const record = firstRpcRecord(payload);
  if (typeof record.allowed !== 'boolean') throw malformedQuotaResponse();
  return normalizeRpcResult(record) as AIChatQuotaReserveResult;
}

function normalizeRefundResult(payload: unknown): AIChatQuotaRefundResult {
  const record = firstRpcRecord(payload);
  if (typeof record.refunded !== 'boolean') throw malformedQuotaResponse();
  return normalizeRpcResult(record) as AIChatQuotaRefundResult;
}

function normalizeRpcResult(record: Record<string, unknown>): AIChatQuotaReserveResult | AIChatQuotaRefundResult {
  const usageDate = stringField(record, 'usage_date');
  const identityType = stringField(record, 'identity_type');
  const identityKey = stringField(record, 'identity_key_hash');
  const dailyLimit = numberField(record, 'daily_limit');
  const reserved = numberField(record, 'model_calls_reserved');
  const used = numberField(record, 'model_calls_used');
  const remaining = numberField(record, 'remaining');
  if (!['anonymous', 'authenticated', 'admin', 'ip_guard'].includes(identityType)) {
    throw malformedQuotaResponse();
  }
  return {
    usage_date: usageDate,
    identity_type: identityType as AIChatQuotaReserveResult['identity_type'],
    identity_key_hash: identityKey,
    daily_limit: dailyLimit,
    model_calls_reserved: reserved,
    model_calls_used: used,
    remaining,
    ...('allowed' in record ? { allowed: Boolean(record.allowed) } : {}),
    ...('refunded' in record ? { refunded: Boolean(record.refunded) } : {}),
  } as AIChatQuotaReserveResult | AIChatQuotaRefundResult;
}

function firstRpcRecord(payload: unknown): Record<string, unknown> {
  const value = Array.isArray(payload) ? payload[0] : payload;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw malformedQuotaResponse();
  return value as Record<string, unknown>;
}

function malformedQuotaResponse(): AIChatHttpError {
  return new AIChatHttpError(503, 'AI_CHAT_QUOTA_UNAVAILABLE', 'The AI assistant quota check is unavailable right now.');
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) throw malformedQuotaResponse();
  return value;
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw malformedQuotaResponse();
  return value;
}

function parseLimitEnv(env?: EnvLike): Partial<Record<AIChatRequestIdentityType, number>> {
  const raw = readEnv(env, 'AI_CHAT_DAILY_LIMITS_JSON');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return sanitizeLimits(parsed);
  } catch {
    return {};
  }
}

function sanitizeLimits(input: unknown): Partial<Record<AIChatRequestIdentityType, number>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output: Partial<Record<AIChatRequestIdentityType, number>> = {};
  for (const key of ['anonymous', 'authenticated', 'admin'] as const) {
    const value = (input as Partial<Record<AIChatRequestIdentityType, unknown>>)[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      output[key] = Math.floor(value);
    }
  }
  return output;
}

function readEnv(env: EnvLike | undefined, key: string): string {
  return envValue(env, key);
}

function adapterKey(input: AIChatQuotaReserveInput | AIChatQuotaRefundInput): string {
  return [input.usageDate, input.identityType, input.identityKey].join(':');
}

function adapterResult(
  input: AIChatQuotaReserveInput,
  counter: { limit: number; reserved: number; used: number },
  extra: Record<string, unknown>
): AIChatQuotaReserveResult {
  return {
    usage_date: input.usageDate,
    identity_type: input.identityType,
    identity_key_hash: input.identityKey,
    daily_limit: counter.limit,
    model_calls_reserved: counter.reserved,
    model_calls_used: counter.used,
    remaining: Math.max(0, counter.limit - counter.reserved - counter.used),
    ...extra,
  } as AIChatQuotaReserveResult;
}

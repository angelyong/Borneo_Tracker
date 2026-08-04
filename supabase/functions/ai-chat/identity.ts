import { AIChatHttpError, type AIChatIdentity } from './contracts.ts';
import { envValue, type EnvLike } from './config.ts';

type FetchLike = typeof fetch;

export type VerifiedSupabaseUser = {
  id: string;
};

export type AIChatProfile = {
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
};

export type TokenVerifier = {
  verify: (accessToken: string) => Promise<VerifiedSupabaseUser>;
};

export type ProfileRepository = {
  findProfile: (userId: string, accessToken: string) => Promise<AIChatProfile | null>;
};

export type IdentityResolverOptions = {
  env?: EnvLike;
  fetchImpl?: FetchLike;
  tokenVerifier?: TokenVerifier;
  profileRepository?: ProfileRepository;
};

type BearerResult =
  | { kind: 'none' }
  | { kind: 'bearer'; token: string };

export function parseAuthorizationHeader(headers: Headers): BearerResult {
  const authorization = headers.get('authorization');
  if (!authorization) return { kind: 'none' };

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]?.trim()) {
    throw new AIChatHttpError(
      401,
      'AI_CHAT_AUTH_MALFORMED',
      'The AI assistant could not verify this sign-in session.'
    );
  }
  return { kind: 'bearer', token: match[1].trim() };
}

export async function resolveAIChatIdentity(
  request: Request,
  options: IdentityResolverOptions = {}
): Promise<AIChatIdentity> {
  const bearer = parseAuthorizationHeader(request.headers);
  if (bearer.kind === 'none') {
    return { type: 'anonymous', verified: false };
  }

  const verifier = options.tokenVerifier || new SupabaseTokenVerifier(options);
  const profileRepository = options.profileRepository || new SupabaseProfileRepository(options);
  const verifiedUser = await verifier.verify(bearer.token);
  const profile = await profileRepository.findProfile(verifiedUser.id, bearer.token);
  const role = profile?.role === 'admin' ? 'admin' : 'user';
  const status = profile?.status === 'suspended' ? 'suspended' : 'active';

  if (status === 'suspended') {
    throw new AIChatHttpError(
      403,
      'AI_CHAT_USER_SUSPENDED',
      'This account cannot use the AI assistant right now.'
    );
  }

  return {
    type: role === 'admin' ? 'admin' : 'authenticated',
    userId: verifiedUser.id,
    role,
    status,
    verified: true,
  };
}

class SupabaseTokenVerifier implements TokenVerifier {
  private readonly env?: EnvLike;
  private readonly fetchImpl: FetchLike;

  constructor(options: IdentityResolverOptions = {}) {
    this.env = options.env;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async verify(accessToken: string): Promise<VerifiedSupabaseUser> {
    const { supabaseUrl, anonKey } = readSupabaseAuthConfig(this.env);
    const response = await this.fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      const body = await safeJson(response);
      const code = isExpiredTokenPayload(body) ? 'AI_CHAT_AUTH_EXPIRED' : 'AI_CHAT_AUTH_INVALID';
      throw new AIChatHttpError(
        401,
        code,
        'The AI assistant could not verify this sign-in session.'
      );
    }
    if (!response.ok) {
      throw new AIChatHttpError(
        503,
        'AI_CHAT_IDENTITY_UNAVAILABLE',
        'The AI assistant sign-in check is unavailable right now.'
      );
    }

    const body = await safeJson(response);
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      throw new AIChatHttpError(
        401,
        'AI_CHAT_AUTH_INVALID',
        'The AI assistant could not verify this sign-in session.'
      );
    }
    return { id };
  }
}

class SupabaseProfileRepository implements ProfileRepository {
  private readonly env?: EnvLike;
  private readonly fetchImpl: FetchLike;

  constructor(options: IdentityResolverOptions = {}) {
    this.env = options.env;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async findProfile(userId: string, accessToken: string): Promise<AIChatProfile | null> {
    const { supabaseUrl, anonKey } = readSupabaseAuthConfig(this.env);
    const query = new URLSearchParams({
      select: 'role,status',
      id: `eq.${userId}`,
      limit: '1',
    });
    const response = await this.fetchImpl(`${supabaseUrl}/rest/v1/profiles?${query.toString()}`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new AIChatHttpError(
        503,
        'AI_CHAT_IDENTITY_UNAVAILABLE',
        'The AI assistant sign-in check is unavailable right now.'
      );
    }

    const body = await safeJson(response);
    const row = Array.isArray(body) ? body[0] : null;
    if (!row || typeof row !== 'object') return null;
    return {
      role: row.role === 'admin' ? 'admin' : 'user',
      status: row.status === 'suspended' ? 'suspended' : 'active',
    };
  }
}

function readSupabaseAuthConfig(env?: EnvLike): { supabaseUrl: string; anonKey: string } {
  const supabaseUrl = envValue(env, 'SUPABASE_URL') || envValue(env, 'VITE_SUPABASE_URL');
  const anonKey = envValue(env, 'SUPABASE_ANON_KEY') || envValue(env, 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new AIChatHttpError(
      503,
      'AI_CHAT_IDENTITY_UNAVAILABLE',
      'The AI assistant sign-in check is unavailable right now.'
    );
  }
  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    anonKey,
  };
}

async function safeJson(response: Response): Promise<Record<string, unknown> | unknown[]> {
  try {
    const body = await response.json();
    if (body && typeof body === 'object') return body as Record<string, unknown> | unknown[];
  } catch {
    // The caller maps missing data to a safe auth error.
  }
  return {};
}

function isExpiredTokenPayload(body: Record<string, unknown> | unknown[]): boolean {
  if (Array.isArray(body)) return false;
  const text = `${body.code || ''} ${body.msg || ''} ${body.message || ''} ${body.error || ''}`;
  return /expired|exp/i.test(text);
}

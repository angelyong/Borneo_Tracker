import { AIChatHttpError } from './contracts.ts';
import { envValue, type EnvLike } from './config.ts';
import { LocalNewsRepository } from './localNewsRepository.ts';
import type { AIChatNewsRepository } from './newsRepository.ts';
import { SupabaseNewsRepository } from './supabaseNewsRepository.ts';

export type AIChatNewsRepositoryMode = 'local' | 'supabase';

type CreateAIChatNewsRepositoryOptions = {
  env?: EnvLike;
};

export function createAIChatNewsRepository(options: CreateAIChatNewsRepositoryOptions = {}): AIChatNewsRepository {
  const mode = newsRepositoryMode(options.env);
  if (mode === 'local') return new LocalNewsRepository();

  if (!hasSupabaseNewsConfig(options.env)) {
    throw new AIChatHttpError(503, 'NEWS_REPOSITORY_UNAVAILABLE', 'The news repository is not configured.');
  }
  return new SupabaseNewsRepository({ env: options.env });
}

export function newsRepositoryMode(env?: EnvLike): AIChatNewsRepositoryMode {
  const raw = envValue(env, 'AI_CHAT_NEWS_REPOSITORY').toLowerCase();
  if (!raw || raw === 'local' || raw === 'offline' || raw === 'test') return 'local';
  if (raw === 'supabase' || raw === 'live') return 'supabase';
  throw new AIChatHttpError(500, 'INVALID_AI_CHAT_CONFIG', 'AI_CHAT_NEWS_REPOSITORY must be local or supabase.');
}

function hasSupabaseNewsConfig(env?: EnvLike): boolean {
  return Boolean(
    envValue(env, 'SUPABASE_URL') &&
    (envValue(env, 'SUPABASE_SERVICE_ROLE_KEY') || envValue(env, 'SUPABASE_SERVICE_KEY'))
  );
}

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');

function readMigrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(migrationsDir, name), 'utf8'),
    }));
}

function migrationSql(name) {
  const file = readMigrationFiles().find((item) => item.name === name);
  return file?.sql || '';
}

function combinedMigrationSql() {
  return readMigrationFiles().map((file) => file.sql).join('\n\n');
}

function grantExecuteLines(sql) {
  return sql
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^grant execute on function public\.(reserve|refund)_ai_chat_quota/i.test(line))
    .join('\n');
}

describe('AI chat Stage 8B database migration contracts', () => {
  it('creates deterministic timestamped migrations', () => {
    const files = readMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => file.name)).toEqual([...files.map((file) => file.name)].sort());
    expect(files.every((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file.name))).toBe(true);
  });

  it('creates the expected chatbot tables without modifying the news schema', () => {
    const sql = migrationSql('20260804000100_ai_chat_infrastructure_contracts.sql');
    expect(sql).toContain('create table if not exists public.ai_chat_config');
    expect(sql).toContain('create table if not exists public.ai_chat_daily_usage');
    expect(sql).toContain('create table if not exists public.ai_chat_events');
    expect(sql).not.toMatch(/alter\s+table\s+public\.news_items/i);
    expect(sql).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.news_items/i);
  });

  it('keeps seeded config non-secret and centralizes quota limits', () => {
    const sql = migrationSql('20260804000100_ai_chat_infrastructure_contracts.sql');
    const configSeedBlock = sql.match(/insert into public\.ai_chat_config[\s\S]*?on conflict \(key\) do nothing;/i)?.[0] || '';
    expect(sql).toContain('AI_CHAT_ENABLED');
    expect(sql).toContain('AI_CHAT_DAILY_LIMITS');
    expect(sql).toContain('"anonymous":5');
    expect(sql).toContain('"authenticated":25');
    expect(sql).toContain('"admin":50');
    expect(sql.match(/AI_CHAT_DAILY_LIMITS/g)).toHaveLength(1);
    expect(configSeedBlock).not.toMatch(/(gemini|turnstile|service[_-]?role|hmac|endpoint).*['"][A-Za-z0-9_-]{16,}/i);
  });

  it('does not add raw IP, message, prompt, answer, provider, or secret telemetry columns', () => {
    const sql = migrationSql('20260804000100_ai_chat_infrastructure_contracts.sql');
    const telemetryBlock = sql.match(/create table if not exists public\.ai_chat_events \(([\s\S]*?)\n\);/i)?.[1] || '';
    expect(telemetryBlock).toContain('identity_key_hash text');
    expect(telemetryBlock).not.toMatch(/\b(raw_)?ip(_address)?\b/i);
    expect(telemetryBlock).not.toMatch(/\b(user_)?question\b/i);
    expect(telemetryBlock).not.toMatch(/\bmessage(_text)?\b/i);
    expect(telemetryBlock).not.toMatch(/\banswer(_text)?\b/i);
    expect(telemetryBlock).not.toMatch(/\bprompt\b/i);
    expect(telemetryBlock).not.toMatch(/\bgrounding(_payload)?\b/i);
    expect(telemetryBlock).not.toMatch(/\b(gemini|provider)_raw/i);
    expect(telemetryBlock).not.toMatch(/\b(source_path|authorization|api_key|secret|token)\b/i);
  });

  it('keeps quota RPC signatures stable and service-only', () => {
    const sql = combinedMigrationSql();
    expect(sql).toMatch(/create or replace function public\.reserve_ai_chat_quota\(\s*p_usage_date date,\s*p_identity_type text,\s*p_identity_key_hash text,\s*p_daily_limit integer\s*\)/i);
    expect(sql).toMatch(/create or replace function public\.refund_ai_chat_quota\(\s*p_usage_date date,\s*p_identity_type text,\s*p_identity_key_hash text\s*\)/i);
    expect(sql).toMatch(/revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from public/i);
    expect(sql).toMatch(/revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from anon/i);
    expect(sql).toMatch(/revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from authenticated/i);
    expect(sql).toMatch(/revoke execute on function public\.refund_ai_chat_quota\(date, text, text\) from public/i);
    expect(sql).toMatch(/revoke execute on function public\.refund_ai_chat_quota\(date, text, text\) from anon/i);
    expect(sql).toMatch(/revoke execute on function public\.refund_ai_chat_quota\(date, text, text\) from authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) to service_role/i);
    expect(sql).toMatch(/grant execute on function public\.refund_ai_chat_quota\(date, text, text\) to service_role/i);
    expect(grantExecuteLines(sql)).not.toMatch(/\b(?:anon|authenticated)\b/i);
  });

  it('makes reservation atomic and refund non-negative by design', () => {
    const sql = combinedMigrationSql();
    expect(sql).toMatch(/on conflict \(usage_date, identity_type, identity_key_hash\) do update/i);
    expect(sql).toMatch(/model_calls_reserved\s*\+\s*public\.ai_chat_daily_usage\.model_calls_used\s*<\s*excluded\.daily_limit/i);
    expect(sql).toMatch(/and u\.model_calls_reserved > 0/i);
    expect(sql).toMatch(/constraint ai_chat_daily_usage_reserved_chk[\s\S]*model_calls_reserved >= 0/i);
    expect(sql).toMatch(/constraint ai_chat_daily_usage_used_chk[\s\S]*model_calls_used >= 0/i);
    expect(sql).toMatch(/constraint ai_chat_daily_usage_within_limit_chk[\s\S]*model_calls_reserved \+ model_calls_used <= daily_limit/i);
  });

  it('hardens security-definer functions and enables RLS on sensitive tables', () => {
    const sql = combinedMigrationSql();
    const securityDefinerCount = (sql.match(/security definer/gi) || []).length;
    const searchPathCount = (sql.match(/set search_path to 'public'/gi) || []).length;
    expect(securityDefinerCount).toBeGreaterThanOrEqual(2);
    expect(searchPathCount).toBeGreaterThanOrEqual(2);
    expect(sql).toMatch(/alter table public\.ai_chat_config enable row level security/i);
    expect(sql).toMatch(/alter table public\.ai_chat_daily_usage enable row level security/i);
    expect(sql).toMatch(/alter table public\.ai_chat_events enable row level security/i);
    expect(sql).not.toMatch(/for (?:insert|update|delete|all)\s+to\s+(?:anon|authenticated)/i);
    expect(sql).toMatch(/revoke insert, update, delete on public\.ai_chat_config from anon, authenticated/i);
    expect(sql).toMatch(/revoke insert, update, delete on public\.ai_chat_daily_usage from anon, authenticated/i);
    expect(sql).toMatch(/revoke insert, update, delete on public\.ai_chat_events from anon, authenticated/i);
  });

  it('defines expected indexes for quota and telemetry lookups', () => {
    const sql = migrationSql('20260804000100_ai_chat_infrastructure_contracts.sql');
    [
      'ai_chat_daily_usage_identity_idx',
      'ai_chat_daily_usage_date_idx',
      'ai_chat_events_created_at_idx',
      'ai_chat_events_request_id_idx',
      'ai_chat_events_identity_idx',
      'ai_chat_events_outcome_idx',
      'ai_chat_events_intent_idx',
    ].forEach((indexName) => {
      expect(sql).toContain(`create index if not exists ${indexName}`);
    });
  });

  it('keeps the Stage 8H quota production fix forward-only and minimal', () => {
    const files = readMigrationFiles().map((file) => file.name);
    expect(files).toContain('20260804000100_ai_chat_infrastructure_contracts.sql');
    expect(files).toContain('20260804000200_ai_chat_quota_production_fixes.sql');
    expect(files).toContain('20260804000300_ai_chat_quota_rpc_conflict_target_fix.sql');

    const fixSql = migrationSql('20260804000200_ai_chat_quota_production_fixes.sql');
    expect(fixSql).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.ai_chat_/i);
    expect(fixSql).not.toMatch(/alter\s+table\s+public\.news_items/i);
    expect(fixSql).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.news_items/i);
  });

  it('replaces unsafe Postgres identity length regex bounds with explicit checks', () => {
    const fixSql = migrationSql('20260804000200_ai_chat_quota_production_fixes.sql');
    expect(fixSql).not.toMatch(/\{16,256\}/);
    expect(fixSql).toMatch(/char_length\(identity_key_hash\) between 16 and 256/i);
    expect(fixSql).toMatch(/char_length\(p_identity_key_hash\) not between 16 and 256/i);
    expect(fixSql).toMatch(/identity_key_hash ~ '\^\[A-Za-z0-9:_-\]\+\$'/);
    expect(fixSql).toMatch(/p_identity_key_hash !~ '\^\[A-Za-z0-9:_-\]\+\$'/);
  });

  it('preserves identity validation intent for min, max, malformed, and valid opaque keys', () => {
    const fixSql = migrationSql('20260804000200_ai_chat_quota_production_fixes.sql');
    const reserveGuard = fixSql.match(/if p_identity_key_hash is null[\s\S]*?raise exception 'invalid identity_key_hash'/i)?.[0] || '';
    expect(reserveGuard).toMatch(/char_length\(p_identity_key_hash\) not between 16 and 256/i);
    expect(reserveGuard).toMatch(/p_identity_key_hash !~ '\^\[A-Za-z0-9:_-\]\+\$'/);
    expect(fixSql).toMatch(/constraint ai_chat_daily_usage_identity_key_hash_chk[\s\S]*char_length\(identity_key_hash\) between 16 and 256/i);
    expect(fixSql).toMatch(/constraint ai_chat_events_identity_key_hash_chk[\s\S]*identity_key_hash is null/i);
  });

  it('reasserts effective browser-role denial for quota RPCs after function replacement', () => {
    const fixSql = migrationSql('20260804000200_ai_chat_quota_production_fixes.sql');
    [
      /revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from public/i,
      /revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from anon/i,
      /revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from authenticated/i,
      /revoke execute on function public\.refund_ai_chat_quota\(date, text, text\) from public/i,
      /revoke execute on function public\.refund_ai_chat_quota\(date, text, text\) from anon/i,
      /revoke execute on function public\.refund_ai_chat_quota\(date, text, text\) from authenticated/i,
      /grant execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) to service_role/i,
      /grant execute on function public\.refund_ai_chat_quota\(date, text, text\) to service_role/i,
    ].forEach((pattern) => {
      expect(fixSql).toMatch(pattern);
    });
  });

  it('uses the quota primary-key constraint as the reserve conflict target', () => {
    const sql = combinedMigrationSql();
    expect(sql).toMatch(/on conflict on constraint ai_chat_daily_usage_pkey do update/i);

    const liveFixSql = migrationSql('20260804000300_ai_chat_quota_rpc_conflict_target_fix.sql');
    expect(liveFixSql).toMatch(/create or replace function public\.reserve_ai_chat_quota\(/i);
    expect(liveFixSql).not.toMatch(/on conflict \(usage_date, identity_type, identity_key_hash\) do update/i);
    expect(liveFixSql).toMatch(/revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from public/i);
    expect(liveFixSql).toMatch(/revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from anon/i);
    expect(liveFixSql).toMatch(/revoke execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from authenticated/i);
    expect(liveFixSql).toMatch(/grant execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) to service_role/i);
  });
});

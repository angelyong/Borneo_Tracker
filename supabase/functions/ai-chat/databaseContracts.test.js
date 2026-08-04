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

function latestMigrationSql() {
  const files = readMigrationFiles();
  return files.at(-1)?.sql || '';
}

describe('AI chat Stage 8B database migration contracts', () => {
  it('creates deterministic timestamped migrations', () => {
    const files = readMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => file.name)).toEqual([...files.map((file) => file.name)].sort());
    expect(files.every((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file.name))).toBe(true);
  });

  it('creates the expected chatbot tables without modifying the news schema', () => {
    const sql = latestMigrationSql();
    expect(sql).toContain('create table if not exists public.ai_chat_config');
    expect(sql).toContain('create table if not exists public.ai_chat_daily_usage');
    expect(sql).toContain('create table if not exists public.ai_chat_events');
    expect(sql).not.toMatch(/alter\s+table\s+public\.news_items/i);
    expect(sql).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.news_items/i);
  });

  it('keeps seeded config non-secret and centralizes quota limits', () => {
    const sql = latestMigrationSql();
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
    const sql = latestMigrationSql();
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
    const sql = latestMigrationSql();
    expect(sql).toMatch(/create or replace function public\.reserve_ai_chat_quota\(\s*p_usage_date date,\s*p_identity_type text,\s*p_identity_key_hash text,\s*p_daily_limit integer\s*\)/i);
    expect(sql).toMatch(/create or replace function public\.refund_ai_chat_quota\(\s*p_usage_date date,\s*p_identity_type text,\s*p_identity_key_hash text\s*\)/i);
    expect(sql).toMatch(/revoke all on function public\.reserve_ai_chat_quota\(date, text, text, integer\) from public/i);
    expect(sql).toMatch(/revoke all on function public\.refund_ai_chat_quota\(date, text, text\) from public/i);
    expect(sql).toMatch(/grant execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) to service_role/i);
    expect(sql).toMatch(/grant execute on function public\.refund_ai_chat_quota\(date, text, text\) to service_role/i);
    expect(sql).not.toMatch(/grant execute on function public\.(?:reserve|refund)_ai_chat_quota[\s\S]*\b(?:anon|authenticated)\b/i);
  });

  it('makes reservation atomic and refund non-negative by design', () => {
    const sql = latestMigrationSql();
    expect(sql).toMatch(/on conflict \(usage_date, identity_type, identity_key_hash\) do update/i);
    expect(sql).toMatch(/model_calls_reserved\s*\+\s*public\.ai_chat_daily_usage\.model_calls_used\s*<\s*excluded\.daily_limit/i);
    expect(sql).toMatch(/and u\.model_calls_reserved > 0/i);
    expect(sql).toMatch(/constraint ai_chat_daily_usage_reserved_chk[\s\S]*model_calls_reserved >= 0/i);
    expect(sql).toMatch(/constraint ai_chat_daily_usage_used_chk[\s\S]*model_calls_used >= 0/i);
    expect(sql).toMatch(/constraint ai_chat_daily_usage_within_limit_chk[\s\S]*model_calls_reserved \+ model_calls_used <= daily_limit/i);
  });

  it('hardens security-definer functions and enables RLS on sensitive tables', () => {
    const sql = latestMigrationSql();
    const securityDefinerCount = (sql.match(/security definer/gi) || []).length;
    const searchPathCount = (sql.match(/set search_path to 'public'/gi) || []).length;
    expect(securityDefinerCount).toBe(2);
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
    const sql = latestMigrationSql();
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
});

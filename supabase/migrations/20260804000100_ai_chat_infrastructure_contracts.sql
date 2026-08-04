-- Borneo Tracker AI Chatbot Stage 8B: database contracts only.
--
-- This migration starts forward versioned history from the existing committed
-- baseline in supabase/auth_schema.sql and supabase/schema.sql. It deliberately
-- does not deploy functions, change verify_jwt, parse auth, enforce runtime
-- quota, write telemetry from the Edge Function, or modify news_items.

create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create table if not exists public.ai_chat_config (
  key text primary key,
  value_json jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint ai_chat_config_key_format_chk
    check (key = upper(key) and key ~ '^[A-Z0-9_]+$')
);

drop trigger if exists set_ai_chat_config_updated_at on public.ai_chat_config;
create trigger set_ai_chat_config_updated_at
  before update on public.ai_chat_config
  for each row execute function public.set_updated_at();

insert into public.ai_chat_config (key, value_json, description)
values
  (
    'AI_CHAT_ENABLED',
    'true'::jsonb,
    'Non-secret runtime kill switch. Future Edge Function code should refuse model-backed chatbot requests when false.'
  ),
  (
    'AI_CHAT_DAILY_LIMITS',
    '{"anonymous":5,"authenticated":25,"admin":50}'::jsonb,
    'Non-secret target model-call quota limits. Future trusted server code resolves the applicable limit before calling quota RPCs.'
  ),
  (
    'AI_CHAT_TELEMETRY_RETENTION_DAYS',
    '90'::jsonb,
    'Recommended retention window for metadata-only chatbot events. No cleanup job is installed in Stage 8B.'
  )
on conflict (key) do nothing;

create table if not exists public.ai_chat_daily_usage (
  usage_date date not null,
  identity_type text not null,
  identity_key_hash text not null,
  daily_limit integer not null,
  model_calls_reserved integer not null default 0,
  model_calls_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (usage_date, identity_type, identity_key_hash),
  constraint ai_chat_daily_usage_identity_type_chk
    check (identity_type in ('anonymous', 'authenticated', 'admin', 'ip_guard')),
  constraint ai_chat_daily_usage_identity_key_hash_chk
    check (identity_key_hash ~ '^[A-Za-z0-9:_-]{16,256}$'),
  constraint ai_chat_daily_usage_daily_limit_chk
    check (daily_limit > 0 and daily_limit <= 1000),
  constraint ai_chat_daily_usage_reserved_chk
    check (model_calls_reserved >= 0),
  constraint ai_chat_daily_usage_used_chk
    check (model_calls_used >= 0),
  constraint ai_chat_daily_usage_within_limit_chk
    check (model_calls_reserved + model_calls_used <= daily_limit)
);

drop trigger if exists set_ai_chat_daily_usage_updated_at on public.ai_chat_daily_usage;
create trigger set_ai_chat_daily_usage_updated_at
  before update on public.ai_chat_daily_usage
  for each row execute function public.set_updated_at();

create index if not exists ai_chat_daily_usage_identity_idx
  on public.ai_chat_daily_usage (identity_type, identity_key_hash, usage_date desc);

create index if not exists ai_chat_daily_usage_date_idx
  on public.ai_chat_daily_usage (usage_date desc);

create table if not exists public.ai_chat_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id text,
  identity_type text not null,
  identity_key_hash text,
  intent text,
  mode text,
  outcome text not null,
  fallback_used boolean not null default false,
  fallback_reason text,
  error_code text,
  model_called boolean not null default false,
  quota_consumed boolean not null default false,
  response_status integer,
  latency_ms integer,
  source_count integer,
  language text,
  region text,
  current_page text,
  constraint ai_chat_events_identity_type_chk
    check (identity_type in ('anonymous', 'authenticated', 'admin', 'ip_guard', 'unknown')),
  constraint ai_chat_events_identity_key_hash_chk
    check (identity_key_hash is null or identity_key_hash ~ '^[A-Za-z0-9:_-]{16,256}$'),
  constraint ai_chat_events_intent_chk
    check (intent is null or intent in ('SITE_KNOWLEDGE', 'DASHBOARD_DATA', 'BORNEO_NEWS', 'OUT_OF_SCOPE')),
  constraint ai_chat_events_mode_chk
    check (mode is null or mode in ('gemini-test', 'template-fallback')),
  constraint ai_chat_events_outcome_chk
    check (outcome in ('success', 'fallback', 'refused', 'rate_limited', 'error')),
  constraint ai_chat_events_response_status_chk
    check (response_status is null or response_status between 100 and 599),
  constraint ai_chat_events_latency_ms_chk
    check (latency_ms is null or latency_ms >= 0),
  constraint ai_chat_events_source_count_chk
    check (source_count is null or source_count >= 0),
  constraint ai_chat_events_language_chk
    check (language is null or language in ('en', 'ms'))
);

create index if not exists ai_chat_events_created_at_idx
  on public.ai_chat_events (created_at desc);

create index if not exists ai_chat_events_request_id_idx
  on public.ai_chat_events (request_id)
  where request_id is not null;

create index if not exists ai_chat_events_identity_idx
  on public.ai_chat_events (identity_type, identity_key_hash, created_at desc)
  where identity_key_hash is not null;

create index if not exists ai_chat_events_outcome_idx
  on public.ai_chat_events (outcome, created_at desc);

create index if not exists ai_chat_events_intent_idx
  on public.ai_chat_events (intent, created_at desc)
  where intent is not null;

create or replace function public.reserve_ai_chat_quota(
  p_usage_date date,
  p_identity_type text,
  p_identity_key_hash text,
  p_daily_limit integer
)
returns table (
  allowed boolean,
  usage_date date,
  identity_type text,
  identity_key_hash text,
  daily_limit integer,
  model_calls_reserved integer,
  model_calls_used integer,
  remaining integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  usage_row public.ai_chat_daily_usage%rowtype;
begin
  if p_usage_date is null then
    raise exception 'usage_date is required' using errcode = '22004';
  end if;
  if p_identity_type not in ('anonymous', 'authenticated', 'admin', 'ip_guard') then
    raise exception 'invalid identity_type' using errcode = '22023';
  end if;
  if p_identity_key_hash is null or p_identity_key_hash !~ '^[A-Za-z0-9:_-]{16,256}$' then
    raise exception 'invalid identity_key_hash' using errcode = '22023';
  end if;
  if p_daily_limit is null or p_daily_limit <= 0 or p_daily_limit > 1000 then
    raise exception 'invalid daily_limit' using errcode = '22023';
  end if;

  insert into public.ai_chat_daily_usage (
    usage_date,
    identity_type,
    identity_key_hash,
    daily_limit,
    model_calls_reserved,
    model_calls_used
  )
  values (
    p_usage_date,
    p_identity_type,
    p_identity_key_hash,
    p_daily_limit,
    1,
    0
  )
  on conflict (usage_date, identity_type, identity_key_hash) do update
    set model_calls_reserved = public.ai_chat_daily_usage.model_calls_reserved + 1,
        daily_limit = excluded.daily_limit,
        updated_at = now()
    where public.ai_chat_daily_usage.model_calls_reserved
        + public.ai_chat_daily_usage.model_calls_used
        < excluded.daily_limit
  returning * into usage_row;

  if found then
    return query
      select
        true,
        usage_row.usage_date,
        usage_row.identity_type,
        usage_row.identity_key_hash,
        usage_row.daily_limit,
        usage_row.model_calls_reserved,
        usage_row.model_calls_used,
        greatest(usage_row.daily_limit - usage_row.model_calls_reserved - usage_row.model_calls_used, 0);
    return;
  end if;

  select *
    into usage_row
    from public.ai_chat_daily_usage u
    where u.usage_date = p_usage_date
      and u.identity_type = p_identity_type
      and u.identity_key_hash = p_identity_key_hash;

  return query
    select
      false,
      p_usage_date,
      p_identity_type,
      p_identity_key_hash,
      coalesce(usage_row.daily_limit, p_daily_limit),
      coalesce(usage_row.model_calls_reserved, 0),
      coalesce(usage_row.model_calls_used, 0),
      greatest(coalesce(usage_row.daily_limit, p_daily_limit)
        - coalesce(usage_row.model_calls_reserved, 0)
        - coalesce(usage_row.model_calls_used, 0), 0);
end;
$function$;

create or replace function public.refund_ai_chat_quota(
  p_usage_date date,
  p_identity_type text,
  p_identity_key_hash text
)
returns table (
  refunded boolean,
  usage_date date,
  identity_type text,
  identity_key_hash text,
  daily_limit integer,
  model_calls_reserved integer,
  model_calls_used integer,
  remaining integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  usage_row public.ai_chat_daily_usage%rowtype;
begin
  if p_usage_date is null then
    raise exception 'usage_date is required' using errcode = '22004';
  end if;
  if p_identity_type not in ('anonymous', 'authenticated', 'admin', 'ip_guard') then
    raise exception 'invalid identity_type' using errcode = '22023';
  end if;
  if p_identity_key_hash is null or p_identity_key_hash !~ '^[A-Za-z0-9:_-]{16,256}$' then
    raise exception 'invalid identity_key_hash' using errcode = '22023';
  end if;

  update public.ai_chat_daily_usage u
    set model_calls_reserved = u.model_calls_reserved - 1,
        updated_at = now()
    where u.usage_date = p_usage_date
      and u.identity_type = p_identity_type
      and u.identity_key_hash = p_identity_key_hash
      and u.model_calls_reserved > 0
  returning * into usage_row;

  if found then
    return query
      select
        true,
        usage_row.usage_date,
        usage_row.identity_type,
        usage_row.identity_key_hash,
        usage_row.daily_limit,
        usage_row.model_calls_reserved,
        usage_row.model_calls_used,
        greatest(usage_row.daily_limit - usage_row.model_calls_reserved - usage_row.model_calls_used, 0);
    return;
  end if;

  select *
    into usage_row
    from public.ai_chat_daily_usage u
    where u.usage_date = p_usage_date
      and u.identity_type = p_identity_type
      and u.identity_key_hash = p_identity_key_hash;

  return query
    select
      false,
      p_usage_date,
      p_identity_type,
      p_identity_key_hash,
      coalesce(usage_row.daily_limit, 0),
      coalesce(usage_row.model_calls_reserved, 0),
      coalesce(usage_row.model_calls_used, 0),
      greatest(coalesce(usage_row.daily_limit, 0)
        - coalesce(usage_row.model_calls_reserved, 0)
        - coalesce(usage_row.model_calls_used, 0), 0);
end;
$function$;

alter table public.ai_chat_config enable row level security;
alter table public.ai_chat_daily_usage enable row level security;
alter table public.ai_chat_events enable row level security;

drop policy if exists "admin reads ai chat config" on public.ai_chat_config;
create policy "admin reads ai chat config"
  on public.ai_chat_config
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "admin reads ai chat daily usage" on public.ai_chat_daily_usage;
create policy "admin reads ai chat daily usage"
  on public.ai_chat_daily_usage
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "admin reads ai chat events" on public.ai_chat_events;
create policy "admin reads ai chat events"
  on public.ai_chat_events
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

revoke insert, update, delete on public.ai_chat_config from anon, authenticated;
revoke insert, update, delete on public.ai_chat_daily_usage from anon, authenticated;
revoke insert, update, delete on public.ai_chat_events from anon, authenticated;

revoke all on function public.reserve_ai_chat_quota(date, text, text, integer) from public;
revoke all on function public.refund_ai_chat_quota(date, text, text) from public;
grant execute on function public.reserve_ai_chat_quota(date, text, text, integer) to service_role;
grant execute on function public.refund_ai_chat_quota(date, text, text) to service_role;

-- Borneo Tracker AI Chatbot Stage 8H-2A-F: quota RPC conflict-target fix.
--
-- Forward-only follow-up to 20260804000200. Live validation reached the
-- reservation insert after regex validation was fixed and exposed a PL/pgSQL
-- ambiguity between output parameter names and the ON CONFLICT column list.

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
  if p_identity_key_hash is null
    or char_length(p_identity_key_hash) not between 16 and 256
    or p_identity_key_hash !~ '^[A-Za-z0-9:_-]+$' then
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
  on conflict on constraint ai_chat_daily_usage_pkey do update
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

revoke execute on function public.reserve_ai_chat_quota(date, text, text, integer) from public;
revoke execute on function public.reserve_ai_chat_quota(date, text, text, integer) from anon;
revoke execute on function public.reserve_ai_chat_quota(date, text, text, integer) from authenticated;
grant execute on function public.reserve_ai_chat_quota(date, text, text, integer) to service_role;

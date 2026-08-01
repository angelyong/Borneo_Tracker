-- Borneo Tracker — authentication schema: public.profiles and the role gate.
--
-- RUN ORDER: this file FIRST, then schema.sql. schema.sql's admin policies on
-- news_items call current_user_role(), which is defined here.
--
-- Idempotent: safe to re-run against the live database.
--
-- PROVENANCE — read this before editing.
-- Every object below was EXPORTED from the live `borneo-news` project (ref
-- scsvikgjxdvjmylcfnxj) on 2026-07-28 via pg_policies, pg_get_functiondef,
-- pg_get_constraintdef, information_schema.columns and
-- information_schema.column_privileges. It is not reconstructed from the design
-- docs. These objects were created by hand in the Supabase console during the
-- 2026-07-16 auth migration (docs/SUPABASE_AUTH_MIGRATION_PLAN.md, Phase 1) and
-- existed ONLY there for twelve days — a console wipe or a project migration
-- would have taken the whole role gate with it.
--
-- The one deliberate deviation from that export is marked "TIGHTENED" below.
-- Everything else is a faithful reproduction. If you change a policy in the
-- dashboard, change it here in the same sitting or this file becomes a lie.


-- Table ------------------------------------------------------------------------
-- One row per auth user. `id` IS auth.users.id — a shared primary key, not a
-- separate surrogate — so a deleted auth user takes its profile with it.
-- The two CHECK constraints are a second line of defence behind the column
-- privileges further down: even if UPDATE on role were ever granted by mistake,
-- the only reachable values are 'user' and 'admin'.
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  first_name  text,
  last_name   text,
  role        text        not null default 'user'   check (role   in ('user','admin')),
  status      text        not null default 'active' check (status in ('active','suspended')),
  created_at  timestamptz not null default now()
);
-- Note: `create table if not exists` will NOT retro-fit constraints onto an
-- existing table. Against the live database this whole statement is a no-op —
-- it is here so a rebuild from scratch lands identically.


-- Role helper ------------------------------------------------------------------
-- SECURITY DEFINER is load-bearing, not a shortcut. profiles' own RLS policies
-- call this function; if it ran with the caller's rights it would query
-- profiles, which would re-evaluate the policy, which would call this again —
-- infinite recursion. Definer rights break the loop. search_path is pinned,
-- which is mandatory hardening for any SECURITY DEFINER function.
--
-- Fails closed for anonymous callers: auth.uid() is NULL, so no row matches and
-- the function returns NULL. `NULL = 'admin'` evaluates to NULL, not true, so
-- every policy that consults it denies access.
--
-- CHANGED 2026-08-02 — the live version was
--     select role from public.profiles where id = auth.uid()
-- with no status condition, which meant suspending an admin took nothing away:
-- they kept every privilege this function grants. Requiring `status = 'active'`
-- makes suspension a real, database-enforced revocation rather than a label in
-- the admin table. Returning NULL for a suspended user is safe — nothing
-- compares the result against 'user', only against 'admin'.
create or replace function public.current_user_role()
  returns text
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select role from public.profiles where id = auth.uid() and status = 'active'
$function$;


-- Signup trigger ---------------------------------------------------------------
-- supabase.auth.signUp({ options: { data: { first_name, last_name } } }) in
-- src/auth/AuthProvider.jsx puts those keys into auth.users.raw_user_meta_data;
-- this copies them across into the profile. The key names must stay in sync with
-- AuthProvider — rename one side only and every new signup silently gets NULL
-- names. Accounts created straight from the console (Authentication → Users →
-- Add user) carry no metadata at all, so their profile names are NULL by
-- design, not by failure.
--
-- AFTER INSERT is required rather than stylistic: profiles.id is a foreign key
-- to auth.users, so the auth row must already exist before the profile row can
-- reference it. `on conflict do nothing` keeps the trigger safe to re-fire.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id,
          new.raw_user_meta_data->>'first_name',
          new.raw_user_meta_data->>'last_name')
  on conflict (id) do nothing;
  return new;
end; $function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Row-Level Security -----------------------------------------------------------
alter table public.profiles enable row level security;

-- Read your own row. Every signed-in user needs this: AuthProvider fetches the
-- profile as soon as a session exists, purely to learn its own role.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

-- Admins read the whole roster — this is what /admin/users lists.
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select
  using (current_user_role() = 'admin');

-- Edit your own row (name fields). This policy on its own would happily let a
-- user set their own role to 'admin'; what actually stops that is the column
-- privilege revoke below. The two are a pair — never remove one without
-- understanding the other.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- Column privileges ------------------------------------------------------------
-- THE anti-self-promotion control. RLS decides which ROWS you may touch;
-- column privileges decide which COLUMNS. Since profiles_update_own gives every
-- user write access to their own row, `role` and `status` must be withheld at
-- the column level or any registered visitor could PATCH themselves to admin
-- and walk into /admin/news.
--
-- This is NOT optional on a rebuild: Supabase grants anon and authenticated
-- broad privileges on new public tables by default, so a freshly created
-- profiles table starts OPEN. The revoke below is what closes it.
--
-- Live state on 2026-07-28: `authenticated` correctly had no UPDATE on either
-- column. `anon` still did — harmless in practice, because auth.uid() is NULL
-- for anonymous callers so profiles_update_own matches no row, but it is a
-- residue that should not outlive the audit that found it.
-- TIGHTENED: including anon here is the one intentional change in this file.
revoke update (role, status) on public.profiles from anon, authenticated;

-- Role changes are therefore a privileged operation by design. Promoting an
-- admin is done through the Supabase Table Editor (or any service_role client),
-- never from the app — see the 11-step procedure in
-- docs/SUPABASE_AUTH_MIGRATION_PLAN.md.


-- Admin action: suspend / reactivate an account --------------------------------
-- ADDED 2026-08-02. Fixes a bug where /admin/users' Suspend button appeared to
-- work and changed nothing: the only UPDATE policy on profiles is
-- profiles_update_own (auth.uid() = id), so an admin editing somebody else's row
-- matched zero rows — and Postgres does not treat a 0-row UPDATE as an error, so
-- PostgREST returned success with no data and the UI reported success.
--
-- Why an RPC rather than "add an admin UPDATE policy":
--   A policy alone would not have been enough. An admin's request runs as
--   `authenticated`, which the revoke above denies UPDATE on `status`. Granting
--   that column back would also hand it to every ordinary user, because
--   profiles_update_own already covers their own row — so anyone suspended could
--   simply clear their own suspension. SECURITY DEFINER keeps the column locked
--   for everyone and puts the single legitimate write behind an explicit check.
--
-- `is distinct from` rather than `<>`: current_user_role() returns NULL for an
-- anonymous or suspended caller, and `NULL <> 'admin'` is NULL, not true — a
-- plain `<>` would skip the raise and let the update through.
create or replace function public.admin_set_user_status(target_id uuid, new_status text)
  returns public.profiles
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  updated public.profiles;
begin
  if current_user_role() is distinct from 'admin' then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  -- Stops the obvious footgun of an admin suspending themselves and locking the
  -- team out of the admin pages. Recovery would need the Supabase Table Editor.
  if target_id = auth.uid() then
    raise exception 'you cannot change your own account status' using errcode = '22023';
  end if;

  if new_status not in ('active', 'suspended') then
    raise exception 'status must be active or suspended, got %', new_status
      using errcode = '22023';
  end if;

  update public.profiles
     set status = new_status
   where id = target_id
  returning * into updated;

  if not found then
    raise exception 'no account with id %', target_id using errcode = 'P0002';
  end if;

  return updated;
end
$function$;

-- Functions are executable by PUBLIC by default; narrow that to signed-in users.
-- The admin check inside the function is the real gate — this is defence in depth.
revoke execute on function public.admin_set_user_status(uuid, text) from public;
grant  execute on function public.admin_set_user_status(uuid, text) to authenticated;

-- Remaining known limit: a suspended ORDINARY user can still sign in and browse.
-- Their privileges are the same as an anonymous visitor's plus read/write of
-- their own profile name, so the practical impact is small; the case that
-- mattered — a suspended admin keeping admin powers — is closed above by
-- current_user_role(). Fully blocking sign-in would mean writing
-- auth.users.banned_until, which is a service_role operation and would need the
-- news pipeline's key in the browser. Deliberately not done.

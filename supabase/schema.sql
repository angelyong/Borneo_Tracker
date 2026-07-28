-- Borneo Tracker — News Tracker (AR-3) Supabase schema: public.news_items.
--
-- RUN ORDER: auth_schema.sql FIRST, then this file. The admin policies below
-- call current_user_role(), which auth_schema.sql defines.
--
-- Idempotent: safe to re-run against the live database. Every statement is
-- create-if-not-exists or drop-then-create, and the drops also cover the
-- RETIRED policy names — see the RLS section for why that matters.
--
-- Frontend camelCase <-> DB snake_case mapping is done in src/services/newsStore.js.

create table if not exists public.news_items (
  id            text primary key,          -- slug; also the /news/:id route id
  title         text not null,
  body          text not null default '',
  image_url     text default '',
  beat          text,
  beat_label    text,
  esg_pillar    text,                       -- 'E' | 'S' | 'G'
  sdg           text[] default '{}',        -- e.g. {SDG13,SDG3}
  country       text,                       -- 'Malaysia' | 'Brunei' | 'Indonesia'
  territories   text[] default '{}',        -- e.g. {Kalimantan}
  sources       jsonb default '[]',         -- [{name,url,publishedAt}]
  source_count  int  default 1,
  original_lang text,                        -- 'en' | 'ms' | 'id'
  ai_generated  boolean default true,
  status        text not null default 'pending'
                check (status in ('pending','published','rejected')),
  is_featured   boolean default false,
  created_at    timestamptz default now(),
  published_at  timestamptz,
  reviewed_at   timestamptz,
  reviewed_by   text
);

create index if not exists news_items_status_pub_idx
  on public.news_items (status, published_at desc);

-- Row-Level Security -----------------------------------------------------------
-- The public site uses the ANON key. RLS lets anon read ONLY published rows, so
-- pending/rejected drafts can never leak to visitors — this is the publish gate,
-- enforced by the database itself.
alter table public.news_items enable row level security;

drop policy if exists "public reads published" on public.news_items;
create policy "public reads published"
  on public.news_items
  for select
  to anon, authenticated
  using (status = 'published');

-- Writes:
--  • The daily pipeline (digest_news.py) uses the SERVICE_ROLE key, which
--    BYPASSES RLS, to upsert drafts as status='pending'. That key is secret and
--    lives only in GitHub Actions secrets / a local .env — never in the frontend.
--  • Admin approval: either the Supabase Table Editor, OR the in-app /admin/news
--    page — gated on profiles.role = 'admin', see the admin policies below.

-- Admin access (in-app approval) ----------------------------------------------
-- "Admin" = a signed-in user whose public.profiles.role is 'admin'. The check
-- goes through current_user_role(), a SECURITY DEFINER helper defined in
-- auth_schema.sql — run that file first or these two policies fail to create.
--
-- HISTORY — do NOT "simplify" these back to `to authenticated using (true)`.
-- Until 2026-07-16 that is exactly what they were, named "authenticated reads
-- all" / "authenticated updates", back when the only accounts that existed were
-- hand-created admins. Public signup then went live (profiles.role defaults to
-- 'user'), which turned those two policies into a hole: every registered visitor
-- could read unpublished drafts and edit any row. They were tightened to
-- admin-only in the console, but this file was never updated — so re-running it
-- would have ADDED the permissive pair back alongside the admin pair. Postgres
-- ORs permissive policies, so that silently re-opens the publish gate. The two
-- drops below exist to clean up any database still carrying the old names.
drop policy if exists "authenticated reads all" on public.news_items;
drop policy if exists "authenticated updates" on public.news_items;

drop policy if exists "admin reads all" on public.news_items;
create policy "admin reads all"
  on public.news_items for select
  using (current_user_role() = 'admin');

drop policy if exists "admin updates" on public.news_items;
create policy "admin updates"
  on public.news_items for update
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

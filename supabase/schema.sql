-- Borneo Tracker — News Tracker (AR-3) Supabase schema.
-- Run ONCE in the Supabase SQL editor on a new free project.
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
--    page (logged-in admins) — see the admin policies below.

-- Admin access (in-app approval) ----------------------------------------------
-- Authenticated users (your admin accounts) may see ALL rows and UPDATE them
-- (approve / edit / reject). Set this up:
--   1. Run this whole file (it's idempotent — drop-if-exists + create).
--   2. Authentication -> Providers -> Email: turn OFF "Allow new users to sign up"
--      (so ONLY accounts you create can log in — every logged-in user is an admin).
--   3. Authentication -> Users -> Add user: create your admin account(s).
drop policy if exists "authenticated reads all" on public.news_items;
create policy "authenticated reads all"
  on public.news_items for select
  to authenticated
  using (true);

drop policy if exists "authenticated updates" on public.news_items;
create policy "authenticated updates"
  on public.news_items for update
  to authenticated
  using (true)
  with check (true);

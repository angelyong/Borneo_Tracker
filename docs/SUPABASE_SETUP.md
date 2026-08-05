# Supabase setup — News Tracker live store (AR-3)

_Last updated: 2026-07-28_

> **The original database baseline is defined by two files, and they have a run order.**
> 1. [`supabase/auth_schema.sql`](../supabase/auth_schema.sql) — the `profiles` table, the `handle_new_user` signup trigger, the `current_user_role()` role helper, RLS and the column privileges that stop a user promoting themselves. **Run this first**, because step 2 depends on `current_user_role()`.
> 2. [`supabase/schema.sql`](../supabase/schema.sql) — the `news_items` table and its RLS, including the admin-only approval policies.
>
> Both are idempotent, so re-running them against a live project is safe. The auth objects were originally created by hand in the console during the 2026-07-16 migration ([`docs/SUPABASE_AUTH_MIGRATION_PLAN.md`](./SUPABASE_AUTH_MIGRATION_PLAN.md)) and were exported into `auth_schema.sql` on 2026-07-28 — until then the role gate existed nowhere but the dashboard. Change a policy in the console and you must mirror it into these files, or a rebuild will quietly restore the old rules.

> **New forward changes live under [`supabase/migrations/`](../supabase/migrations/).** Stage 8B starts versioned migration history for AI chatbot config, quota, and telemetry contracts. Future deployments should apply `auth_schema.sql`, then `schema.sql`, then every migration in timestamp order. Do not paste only `schema.sql` and ignore migrations.

The public `/news` page and the daily pipeline use a free hosted **Supabase**
project as the shared, live store. No Docker, nothing to self-host. ~5 minutes.

## 1. Create the project
1. Go to **supabase.com** → sign in → **New project** (free tier).
2. Pick a name + a database password (save it) + a region near Malaysia (e.g. Singapore).
3. Wait ~2 min for it to provision.

## 2. Create the table + policies
1. In the project, open **SQL Editor** → **New query**.
2. Paste the contents of [`supabase/schema.sql`](../supabase/schema.sql) → **Run**.
3. This creates `news_items` + enables Row-Level Security (anon can read **only**
   `published` rows — the publish gate).

## 3. Get the keys
Project → **Settings → API**:
- **Project URL** (e.g. `https://abcd1234.supabase.co`)
- **anon public** key — safe to expose in the frontend (RLS-gated)
- **service_role** key — **SECRET**; used only by the pipeline to write drafts

## 4. Where the keys go
| Key | Where | Why |
|---|---|---|
| Project URL + **anon** key | local `.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (and in the host's build env for production) | frontend reads live published news |
| Project URL + **service_role** key | local `.env` as `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`; in production → **GitHub Actions secrets** | pipeline (`digest_news.py`) upserts drafts; NEVER in the browser |

The app is **env-gated**: with the `VITE_SUPABASE_*` vars blank it runs entirely
on the local mock store (zero setup). Fill them in → the public page goes live
against Supabase.

## 5. Populate + publish
- Run the pipeline to insert drafts:
  `python fetch_news.py --days 3 --out news_fetched.json && python digest_news.py --in news_fetched.json`
  (with `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set, it upserts into `news_items`
  as `status='pending'`; without them it writes the local `mockNews.js` seed).
- **Approve (interim):** Supabase → **Table Editor** → `news_items` → set a row's
  `status` to `published` (and `published_at` = now). It appears on `/news`
  immediately. (A real in-app admin login + approve UI is a later enhancement.)

## What I need from you to wire + test it
- **Project URL**
- **anon public key**
(Put the **service_role** key into the local `.env` / GitHub secrets yourself —
I read it from the environment and never need to see it.)

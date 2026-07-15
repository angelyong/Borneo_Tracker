# Supabase Auth Migration Plan — user login + direct-admin (route C)

**Status:** In progress · **Created:** 2026-07-16 · **Owner:** Henry
**Scope:** Add real user authentication and role-based admin to the app, unified on **Supabase**.

> Companion docs: [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) (the existing News Tracker store — this plan extends the *same* Supabase project with auth) · [`PRODUCTION_ROLLOUT_PLAN.md`](PRODUCTION_ROLLOUT_PLAN.md).

---

## Why this plan (the decision)

The app needs one unified identity system for both **end users** and **admins**. Three options were weighed:

| Route | What | Verdict |
|---|---|---|
| **A** | Keep two backends (self-hosted for user + Supabase for admin) | ❌ Stopgap only — two identity sources in production |
| **B** | Unify on the self-hosted backend (`origin/login`: Express + Prisma + PostgreSQL + worker) | ❌ Needs an always-on VPS + ops; **incompatible with DirectAdmin shared hosting** (no Postgres, no long-running Node/worker) |
| **C** | Unify on **Supabase** (managed); admin = `role='admin'` user; frontend stays static | ✅ **Chosen** |

**Deciding factors:**
- Hosting target is **DirectAdmin shared hosting** → serves a static SPA + domain only; cannot run a self-hosted backend. Supabase is the managed always-on backend, so **no server to own or maintain**.
- The admin domain (news) is **already on Supabase** → route C moves the *least* code; route B would require migrating the whole news pipeline off Supabase.
- Free tier is sufficient to start (auth included; upgrade to Pro $25/mo later only for the "never pause" production guarantee).

**Strategy:** new branch off `master`; **harvest the auth-page UIs** from `origin/login` and rewire their one backend call to Supabase; **do not** merge `origin/login`'s backend.

---

## Implementation status (2026-07-16)

Phases **0–5 built** on branch `feature/supabase-auth`; **build + lint + 35 tests green**, dev server boots. Phase 6: automated checks pass — the **live browser flow (register → verify email → login → admin gate) is pending a manual test**. Phase 7 (deploy) waits on the DirectAdmin domain. Phase 8 (merge to master) after the manual test.

## Legend
🔸 = decision to lock first · ⏳ = do only after the DirectAdmin domain is live · everything else = doable now.

---

## Phase 0 — Prep & decisions ✅

**Decisions locked (2026-07-16):**
- ✅ **Supabase project:** reuse the news project (`borneo-news`, ref `scsvikgjxdvjmylcfnxj`) — shared free tier, unified, admin news already there
- ✅ **Email verification:** **ON from the start** — users must confirm their email before they can sign in
- ✅ **Admin entry:** unified — admin signs in at `/login`; `role='admin'` gates `/admin/*`; the separate `/admin/login` is retired

**Consequence of email-verification-ON:** dev testing needs working email delivery. Supabase's built-in email is rate-limited (~a few/hour) — fine for a handful of test signups, but set up **custom SMTP early** (e.g. Resend free tier, or the DirectAdmin mailbox once live) to avoid friction. This pulls part of Phase 7's SMTP task earlier.

- [x] Supabase project access confirmed (Henry can reach the dashboard)
- [x] Create working branch off `master`: `feature/supabase-auth`

## Phase 1 — Supabase console config ✅
- [x] Enable **Email** auth provider (email + password)
- [x] Auth settings: Site URL = `http://localhost:5173`; add Redirect URLs
- [x] Create **`profiles`** table: `id` (FK → `auth.users`), `first_name`, `last_name`, `role` (default `user`), `status` (default `active`), `created_at`
- [x] Trigger `handle_new_user`: auto-insert a `profiles` row on signup
- [x] `current_user_role()` SECURITY DEFINER helper (avoids RLS self-recursion)
- [x] **RLS (profiles):** user reads/updates own row; `role='admin'` reads all; column grant so users can't self-promote role/status
- [x] **RLS (news_items):** `public reads published` · `admin reads all` · `admin updates` (was "any authenticated" — tightened to admin)
- [x] Enable **"Confirm email"** in Auth settings (verification ON)
- [x] `admin@borneotracker.app` set to `role='admin'`
- [ ] Email delivery: still on Supabase built-in (rate-limited) — custom SMTP deferred to Phase 7 ⏳

## Phase 2 — Frontend auth foundation ✅
- [x] Supabase auth in `AuthProvider`: `signUp / signIn / signOut / resetPasswordForEmail / resendSignup / updatePassword`
- [x] **AuthProvider** around `supabase.auth.onAuthStateChange` → exposes `user / profile / role / isAdmin / isAuthenticated / loading`
- [x] **ProtectedRoute** (requires session), **RequireAdmin** (`role==='admin'`), **GuestOnlyRoute**
- [x] Fetch `profiles` (→ role) once a session is established
- [x] Mock mode preserved: no Supabase env → mock signed-in admin (zero-setup dev + vitest)

## Phase 3 — Auth pages (Supabase-wired) ✅
- [x] Login → `signInWithPassword` (returns to `location.state.from`)
- [x] Register → `signUp` (first/last name in metadata) → `/check-email`
- [x] Forgot → `resetPasswordForEmail` → `/check-email`
- [x] Reset → `updateUser({ password })` in the recovery session, then sign out → `/login`
- [x] CheckEmailPage → resend (verify / reset) with cooldown
- [x] VerifyEmailPage **dropped** — Supabase's confirmation link redirects to Site URL and `detectSessionInUrl` auto-logs-in; CheckEmailPage covers the "check your inbox" step
- [x] Routes wired in `src/App.jsx`; `AuthProvider` mounted in `src/main.jsx`

## Phase 4 — Direct-admin via role ✅
- [x] Unified entry: admin signs in at `/login`; `/admin/news` wrapped in `<RequireAdmin>` → **retired** `AdminLogin.jsx` + `/admin/login`
- [x] `NewsReview.jsx` uses `useAuth` (role gate handled by the route)
- [x] Sidebar "News Review (Admin)" link + top-bar admin item visible only when `isAdmin`
- [ ] *(Future, not this round)* rebuild figma-redesign's **UserManagement** / **ReportVerification** admin pages on Supabase

## Phase 5 — Cleanup / de-conflict ✅
- [x] Consolidated to **one** Supabase auth (deleted the old admin-only `services/authService.js`)
- [x] Confirmed **nothing** from `origin/login`'s backend pulled in (no `server/`, custom authService, `compose.yaml`, Mailpit)
- [x] Removed unused `Sidebar` import in `MyProfile.jsx` (lint clean)

## Phase 6 — Test & verify
- [x] Build (`vite build`), lint (`eslint src`), and the **35 existing vitest tests** pass; dev server boots
- [ ] **Manual (browser):** register → verify email → login → logout
- [ ] **Manual:** forgot password → reset password end-to-end
- [ ] **Manual:** role gate — normal user blocked from `/admin/news`; admin allowed

## Phase 7 — ⏳ Deploy prep (after DirectAdmin domain is live)
- [ ] Production build env: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- [ ] Supabase Auth: add the **production domain** to Site URL + Redirect URLs (else verify/reset links point wrong)
- [ ] Configure **custom SMTP** (Resend / DirectAdmin mailbox) so auth emails come from your domain and skip the built-in rate limit
- [ ] Verify no case-sensitive import bugs (`sidebar` vs `Sidebar` etc.) before the Linux/DirectAdmin build
- [ ] `npm run build` → upload `dist/` to `public_html`
- [ ] Add `.htaccess` (SPA route rewrite → `index.html`)
- [ ] Point the domain / document root at `dist`

## Phase 8 — Merge back
- [ ] PR `feature/supabase-auth` → `master`; review
- [ ] Manual browser test passes → merge
- [ ] Update docs / memory with the final state

---

## Explicitly NOT doing this round
Self-hosted backend (`server/`), PostgreSQL, Email Worker, VPS. The news pipeline stays on Supabase, untouched. MyProfile still saves edits to local state only (not yet persisted to `profiles`) — a follow-up.

## Cost note
Free tier covers login (auth included). Free-tier catches: project **pauses after ~7 days idle**; built-in auth email is rate-limited (→ custom SMTP); max 2 free projects/org. Upgrade to **Pro ($25/mo)** only when you need the never-pause production guarantee — and that upgrades the *whole* project (news + auth together), not login separately.

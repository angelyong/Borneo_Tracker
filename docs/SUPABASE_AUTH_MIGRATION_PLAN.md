# Supabase Auth Migration Plan — user login + direct-admin (route C)

**Status:** COMPLETED & merged to master (2026-07-16) · **Created:** 2026-07-16 · **Owner:** Henry
_Status updated: 2026-07-20_
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

## Implementation status (updated 2026-07-20)

**DONE & merged to master.** Phases **0–6 and 8 complete**: Supabase auth is live in the app (`src/auth/AuthProvider.jsx` implements `signUp / signIn / signOut / resetPasswordForEmail / resendSignup / updatePassword`, with `role / isAdmin` driven off the `profiles` table), the auth pages are Supabase-wired, `/admin/*` is role-gated, and the figma-redesign **UserManagement** admin page was rebuilt on Supabase (`src/pages/admin/UserManagement.jsx` + `src/services/adminUserService.js` reading `profiles`). The manual browser flow passed and the branch merged to `master`.

**Update 2026-08-01 — the site is deployed and HTTPS is clean.** Phase 7 is done except SMTP: the build is live at **https://borneotracker.rentsmartprop.com.my** with a valid Let's Encrypt wildcard cert, the SPA rewrite works on every route, and Supabase's Site URL + Redirect URLs now point at the production domain instead of `localhost:5173`.

**Custom SMTP is now configured too** (2026-08-01) — auth email goes out through the DirectAdmin mailbox `noreply@rentsmartprop.com.my` instead of Supabase's rate-limited built-in sender. SPF and DKIM were already correct for that domain, so no DNS changes were needed; see Phase 7 for the settings and the reasoning. **Phase 7 is complete.** Outstanding verification: confirm a real inbox shows `SPF: PASS` / `DKIM: PASS` / `DMARC: PASS` and that the message does not land in spam.

**Also 2026-08-01 — the database is finally versioned.** The `profiles` table, its RLS, the `handle_new_user` trigger and `current_user_role()` had lived only in the Supabase console since this migration; they were exported into [`supabase/auth_schema.sql`](../supabase/auth_schema.sql). Along the way `supabase/schema.sql` was found to still carry the pre-migration `authenticated reads all` / `authenticated updates` policies under *different names* than the live admin-only ones — re-running it would have OR'd the permissive pair back in and re-opened the news publish gate. Fixed. See [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) for the run order.

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
- [x] Auth settings: Site URL + Redirect URLs — was `http://localhost:5173` during the build; **repointed at the production domain on 2026-08-01** (see Phase 7), with localhost kept in the redirect allow-list for dev
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
- [x] Rebuilt figma-redesign's **UserManagement** admin page on Supabase (`src/pages/admin/UserManagement.jsx` + `adminUserService.js` on `profiles`)
- [ ] *(Future, not this round)* rebuild figma-redesign's **ReportVerification** admin page on Supabase

## Phase 5 — Cleanup / de-conflict ✅
- [x] Consolidated to **one** Supabase auth (deleted the old admin-only `services/authService.js`)
- [x] Confirmed **nothing** from `origin/login`'s backend pulled in (no `server/`, custom authService, `compose.yaml`, Mailpit)
- [x] Removed unused `Sidebar` import in `MyProfile.jsx` (lint clean)

## Phase 6 — Test & verify ✅
- [x] Build (`vite build`), lint (`eslint src`), and the **35 existing vitest tests** pass; dev server boots
- [x] **Manual (browser):** register → verify email → login → logout
- [x] **Manual:** forgot password → reset password end-to-end
- [x] **Manual:** role gate — normal user blocked from `/admin/news`; admin allowed

## Phase 7 — Deploy prep — mostly DONE (verified from outside 2026-08-01)

Live at **https://borneotracker.rentsmartprop.com.my**.

- [x] Production build env: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — confirmed: the deployed bundle (`/assets/index-DUmk8C_C.js`) contains the project ref and a `supabase.co` URL, so both were baked in at build time
- [x] Supabase Auth: production domain added to **Site URL** + **Redirect URLs** (`https://borneotracker.rentsmartprop.com.my/**`, localhost kept for dev) — 2026-08-01
- [x] `npm run build` → `dist/` uploaded to `public_html`
- [x] `.htaccess` SPA rewrite — confirmed: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/check-email`, `/news`, `/admin/news`, `/admin/users`, `/profile` all return `index.html` instead of 404
- [x] Domain / document root pointed at `dist`
- [x] **HTTPS** — Let's Encrypt wildcard `*.rentsmartprop.com.my`, strict TLS validation passes. ⚠️ **Expires 2026-10-29**; wildcards renew over DNS-01, which fails more often than HTTP-01, so re-check the expiry in mid-October or the site silently reverts to a full-page cert warning
- [x] Configure **custom SMTP** — 2026-08-01, using the **DirectAdmin mailbox**, not a third-party sender. Supabase → Project Settings → Authentication → SMTP Settings:

  | Field | Value |
  |---|---|
  | Host | `mail.rentsmartprop.com.my` (→ 160.30.208.11, the same box that serves the site) |
  | Port | `587` (STARTTLS) — `465` also open as a fallback |
  | Username / Sender | `noreply@rentsmartprop.com.my` (the **full address**; `noreply` alone fails auth) |
  | Sender name | `Borneo Tracker` |

  Auth email rate limits raised afterwards under Authentication → Rate Limits.

  **Why the main domain and not a `borneotracker.*` sending subdomain** — measured 2026-08-01, not assumed:
  - SPF already passes with **zero DNS changes**: `rentsmartprop.com.my` publishes `v=spf1 a mx ip4:160.30.208.11 include:spf.mxyeet.net ~all`, and `160.30.208.11` is the sending host.
  - DKIM is already signing: selector `x` is published at `x._domainkey.rentsmartprop.com.my`.
  - DMARC is `v=DMARC1; p=none` — monitoring only, so it will not reject.
  - The mail server presents the same Let's Encrypt wildcard as the website, so Supabase's SMTP client gets a valid certificate.

  Moving the sender to a subdomain would have discarded all four and required rebuilding SPF and DKIM there. **Never add a second SPF record to `rentsmartprop.com.my`** — the domain runs live business mail (MX → `mx1/2/3.mxfilter.net`) and a domain may carry only one SPF record; a second one is an instant permerror for the company's existing mail.

  Known limits: the server advertises `MAILMAX=100` per connection (irrelevant at this volume), but DirectAdmin shared hosting usually also imposes a per-hour outbound cap that is not visible externally — if auth mail ever stops arriving in bursts, check that first. The one thing that cannot be measured from outside is the shared IP's sender reputation.
- [ ] Verify no case-sensitive import bugs (`sidebar` vs `Sidebar` etc.) — **still open, and not disproven by the live site**: the upload was built on Windows, where the mismatch is harmless. It only bites if the build ever moves to Linux/CI

**Not part of this plan, but true of the deployment:** DirectAdmin shared hosting is not git-connected, so `refresh-data.yml`'s daily commit does not by itself reach the live site — the site serves the hand-uploaded **2026-07-23** build. That gap is what [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) exists to close (build → upload → verify against the live URL); it is written and merged but **deliberately no-ops until the repo owner adds the SFTP secrets** — see [`DEPLOYMENT_SETUP.md`](DEPLOYMENT_SETUP.md). Until then the dashboard data on production stays frozen. `/news` is the exception either way — it reads Supabase at runtime, so approved news appears live with no rebuild at all.

## Phase 8 — Merge back ✅
- [x] PR `feature/supabase-auth` → `master`; review
- [x] Manual browser test passes → merge
- [x] Update docs / memory with the final state

---

## Explicitly NOT doing this round
Self-hosted backend (`server/`), PostgreSQL, Email Worker, VPS. The news pipeline stays on Supabase, untouched. MyProfile still saves edits to local state only (not yet persisted to `profiles`) — a follow-up.

## Cost note
Free tier covers login (auth included). Free-tier catches: project **pauses after ~7 days idle**; built-in auth email is rate-limited (→ custom SMTP); max 2 free projects/org. Upgrade to **Pro ($25/mo)** only when you need the never-pause production guarantee — and that upgrades the *whole* project (news + auth together), not login separately.

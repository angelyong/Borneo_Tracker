# Borneo Tracker Testing Gaps and Playwright System Test Plan

**Status:** Plan awaiting approval  
**Prepared:** 2026-09-04  
**Implementation hold:** Do not install Playwright, create Playwright code, modify `package.json`, or run system tests until the user confirms these Markdown plans.

## 1. Current testing decision

| Testing level | Current state | Completion decision |
|---|---|---|
| Unit | Large Vitest and Python suites exist, but known failures/warnings require investigation and no fresh green sign-off exists | **Not complete** |
| Integration | Repository modules, pipeline stages and deployment contracts are tested, mainly with fixtures/mocks | **Partially complete** |
| System | Deployment HTTP smoke checks and manual procedures exist, but there is no automated real-browser journey suite | **Not complete** |

The missing system evidence matters most to **D (Data)** and **E (Ethics)** because a correct calculation is not enough if the deployed browser shows the wrong value, hides its source, mislabels geographic level or serves stale artifacts. It also matters to **A (AI)** because mocked handler tests do not prove that the browser, Supabase Edge Function and model provider work together.

## 2. What remains undone

### 2.1 Unit testing gaps

- Resolve the known unemployment/poverty inactive-target failures.
- Remove unexpected React `act(...)` warnings and overlapping async updates.
- Establish current test totals from a clean successful run.
- Add and enforce coverage thresholds.
- Review authentication, profile, suspension and reactivation units against the recorded manual bugs.
- Produce commit-specific completion evidence.

The full unit-test work is defined in `docs/testing/UNIT_TEST_COMPLETION_PLAN.md`.

### 2.2 Integration testing gaps

Current repository tests combine modules internally, but the following live boundaries are not fully proven:

| Boundary | Missing evidence |
|---|---|
| Browser ↔ Supabase Auth | Real sign-in, refresh, password reset, suspension and reactivation |
| Browser ↔ Supabase data | Real reads/writes, Row Level Security and error handling |
| Browser ↔ AI Edge Function | Production endpoint injection, CORS, bearer forwarding and rendered response |
| Edge Function ↔ Gemini | One controlled real request, timeout/failure behaviour and numeric validation |
| Edge Function ↔ quota/telemetry RPCs | Reservation, exhaustion, refund and recorded events |
| News ↔ Supabase | Published-only visibility, language/territory filters and pending-content privacy |
| Deployment ↔ published artifacts | Exact frontend/data/proof version presented together after deployment |
| Email provider ↔ user | Verification/reset delivery, sender identity and correct redirect URL |

Integration tests should be split into two groups:

1. **Hermetic integration tests:** local services or emulators, deterministic fixtures, no paid/external calls; safe on every pull request.
2. **Staging integration tests:** dedicated Supabase/staging resources and tightly controlled provider calls; run on protected workflows or manually before release.

### 2.3 System testing gaps

- No Playwright/Cypress/Selenium runner is configured.
- No `test:system` or `test:e2e` package command exists.
- Vitest uses jsdom and therefore does not prove real browser routing, layout, downloads, browser storage or network behaviour.
- The production document explicitly says browser-to-function E2E is not yet verified.
- The manual authentication/suspension procedure is not a completed repeatable automation suite.
- The existing deployment smoke test verifies HTTP/artifact behaviour but not full user journeys.
- The current bug report lists authentication, profile persistence, email, suspension and reactivation problems that require system-level regression coverage.

## 3. Playwright system-test objectives

The Playwright suite will prove that a user can use the assembled Borneo Tracker system through a real browser and that visible claims remain consistent with the committed data.

It must answer:

1. Can a public user open and navigate the application?
2. Do Dashboard, Regional, ESG, SDG and True Wealth views present consistent figures and provenance?
3. Do routes work when opened directly, not only after client-side navigation?
4. Do authentication and authorisation roles work against the intended environment?
5. Can the AI assistant reach its real backend safely and render grounded output?
6. Do admin/community/report actions persist correctly and enforce permissions?
7. Does the deployed application work on desktop and mobile-sized browsers in English and Malay?

## 4. Proposed test architecture

### 4.1 Two system-test tiers

| Tier | Environment | Purpose | CI frequency |
|---|---|---|---|
| System shell | Local production build with deterministic test configuration | Browser routing, rendering, committed data, accessibility basics, downloads and non-live error states | Every pull request |
| Full system | Protected staging deployment with dedicated Supabase and AI configuration | Real auth, RLS, persistence, Edge Function, quota, telemetry, news and one controlled provider request | Pre-release/manual protected workflow |

The local tier must never be reported as proof of live Supabase or Gemini integration. The staging tier must never use the production user database.

### 4.2 Proposed files after approval

No files below should be created yet. The intended implementation is:

```text
playwright.config.js
tests/system/
  fixtures/
    auth.js
    testData.js
  public-dashboard.spec.js
  regional-data.spec.js
  esg-sdg.spec.js
  integrity-provenance.spec.js
  navigation-i18n.spec.js
  impact-simulator.spec.js
  ai-chat.spec.js
  authentication.spec.js
  authorisation.spec.js
  community.spec.js
  report-export.spec.js
  accessibility-smoke.spec.js
  visual-smoke.spec.js
.github/workflows/system-tests.yml
```

Proposed package scripts:

```json
{
  "test:system": "playwright test",
  "test:system:headed": "playwright test --headed",
  "test:system:ui": "playwright test --ui",
  "test:system:report": "playwright show-report"
}
```

Proposed dependency after approval: `@playwright/test` as a pinned development dependency.

### 4.3 Browser projects

Start with a high-value, controlled matrix:

- Desktop Chromium — primary PR gate.
- Mobile Chrome emulation — responsive/navigation gate.
- Desktop Firefox — compatibility gate after Chromium is stable.
- WebKit — release gate if the team supports Safari/iOS users.

Running every case on every browser immediately would slow feedback and increase noise. P0 public/auth/AI journeys should be cross-browser; lower-risk visual variations can begin on Chromium.

## 5. Test data and environment design

### 5.1 Dedicated staging identities

Create non-personal test identities in a dedicated staging Supabase project:

- active user;
- suspended user;
- active admin;
- reactivated user;
- optional unverified user.

Never test suspension against the last admin. Never store passwords in the repository. CI obtains credentials from protected secrets.

### 5.2 Deterministic reset

Each state-changing test must begin from a known state and clean up its own records. Preferred methods:

- protected staging seed/reset function restricted to CI;
- unique run IDs on created posts or records;
- API-assisted setup for speed, followed by browser actions for the behaviour being tested;
- cleanup in teardown even after a failed assertion.

Tests must not depend on execution order.

### 5.3 Data truth oracle

For dashboard assertions, expected values should come from committed canonical artifacts such as `public/data/resilience.json`, `indicators.json`, `districts.json`, `manifest.json` and `resilience_model.json`.

Do not duplicate important expected scores by hand inside Playwright files. Load the canonical artifact, calculate the expected display value using reviewed helpers where appropriate, and assert the browser shows the same number, unit, year, source, geographic level and confidence.

### 5.4 Stable selectors

Prefer user-visible roles and accessible names:

```js
page.getByRole('link', { name: 'Regional Details' })
page.getByRole('button', { name: /Data as of/i })
```

Use `data-testid` only when a stable semantic selector is impossible, especially for map layers or generated chart surfaces. Never select hashed CSS classes.

## 6. Planned Playwright journeys

### P0 — Release-blocking public journeys

#### SYS-PUB-01: Application shell and deep links

- Open `/`, `/news`, `/esg`, `/sdg`, `/simulator`, `/data-sources` and `/about` directly.
- Confirm each route loads the Borneo Tracker shell and expected heading.
- Confirm no route returns a blank page, server directory listing or generic 404.
- Confirm browser console contains no unexpected errors.

#### SYS-DATA-01: Dashboard truth and provenance

- Open the Dashboard.
- Compare displayed Resilience Index, RAG band and weakest pillar with canonical JSON.
- Change territory between Sabah, Sarawak, Brunei and Kalimantan.
- Confirm all six pillars are represented and missing values remain visibly missing.
- Open the freshness/provenance UI.
- Confirm year, source, update cadence/coverage where available, confidence and data level are visible.

#### SYS-DATA-02: No invalid comparison

- Select a layer whose territory units differ.
- Confirm the map refuses to rank/shade incompatible values as equivalent.
- Confirm the displayed explanation names the incompatible units or comparison limitation.
- Confirm proxy, national and derived values remain labelled.

#### SYS-REG-01: Regional and district drill-down

- Select each territory and verify the route/view updates.
- Open a Kalimantan district with supported data.
- Confirm available indicators render with provenance.
- Open a district without sufficient coverage.
- Confirm the UI does not invent a six-pillar score.

#### SYS-ESGSDG-01: ESG/SDG reporting lenses

- Open ESG and SDG pages.
- Verify counts/cards against canonical indicators.
- Verify the same indicator retains consistent value, unit and source across lenses.
- Verify unsupported SDG composite progress is not presented as an official calculated score.

#### SYS-I18N-01: English and Malay

- Switch language on a representative page.
- Confirm navigation, headings, explanatory text and accessible names update.
- Reload and confirm intended language persistence.
- Confirm numbers and provenance do not change when language changes.

### P0 — Authentication and authorisation journeys

#### SYS-AUTH-01: Login and session persistence

- Sign in as an active staging user.
- Reload and navigate directly to a protected route.
- Confirm the session and correct role persist.
- Sign out and confirm protected content is no longer accessible.

#### SYS-AUTH-02: Suspended account enforcement

- Attempt sign-in or protected access as a suspended user.
- Confirm the suspension message is shown.
- Confirm protected data/actions and admin routes are refused.
- Confirm opening a fresh browser context does not bypass suspension.

#### SYS-AUTH-03: Reactivation

- Reactivate a staging user through the approved admin flow/setup.
- Start a new browser context and sign in.
- Confirm ordinary user access returns without accidental admin permission.

#### SYS-AUTH-04: Email redirect contract

- Trigger verification or reset using a controlled staging email inbox/service.
- Confirm the message is received from the expected sender.
- Confirm the link targets the approved staging origin, never `localhost`.
- Confirm the resulting authentication operation persists.

Email delivery can be kept as a protected staging test because it depends on an external mail system and rate limits.

### P0 — AI system journey

#### SYS-AI-01: Browser-to-function deterministic answer

- Open BorneoBot from the Dashboard.
- Submit an enabled deterministic question.
- Confirm the browser sends the bearer token when signed in.
- Confirm CORS succeeds and the UI renders a normalized response and safe sources.
- Confirm displayed numerical values match canonical data.
- Confirm internal paths, secrets, pending news and raw provider errors are absent.

#### SYS-AI-02: Controlled provider request

- In protected staging, submit one approved question that requires the model.
- Confirm the answer contains only approved numerical tokens.
- Confirm timeout/validation failure uses a deterministic fallback without a second model call.
- Confirm quota and telemetry records have the expected outcome without exposing their contents publicly.

#### SYS-AI-03: Quota and failure UI

- Put the staging identity at its configured limit using safe setup.
- Confirm the next eligible request returns the designed 429 behaviour.
- Confirm the frontend shows the safe fallback/message and does not duplicate submission.
- Confirm deterministic zero-model questions remain available if that is the approved contract.

### P1 — Decision and contribution journeys

#### SYS-SIM-01: Impact Simulator

- Enter a supported territory, indicator/development scenario and value.
- Confirm before/after values match the deterministic simulator.
- Confirm the weakest-pillar/resilience outcome updates correctly.
- Confirm the result is labelled illustrative and not a forecast or approval probability.
- Confirm invalid or ambiguous input requests clarification instead of guessing.

#### SYS-COM-01: Community post and attachment

- Create a staging post with and without an attachment.
- Reload and confirm persistence.
- Confirm another user cannot delete it unless authorised.
- Delete it and confirm both metadata and stored attachment are cleaned up.

#### SYS-REPORT-01: Report generation

- Generate a report for a known territory.
- Confirm the download completes with the expected file type and non-zero size.
- Confirm visible headline figures and sources appear in the report.
- Confirm the report does not claim unavailable data.

### P1 — Accessibility and responsive smoke

- Navigate key routes using the keyboard.
- Confirm dialogs have accessible names, focus is trapped where required and Escape returns focus.
- Confirm major landmarks/headings exist.
- Confirm desktop and mobile layouts do not hide essential source/confidence information.
- Use automated accessibility scanning as a smoke signal, followed by manual review for map/chart meaning.

## 7. Existing bug regression mapping

| Recorded issue | Planned regression |
|---|---|
| Verification redirects to localhost | `SYS-AUTH-04` |
| Password update is not persisted | Extend `SYS-AUTH-04` with old/new password sign-in checks |
| Profile details are not persisted | Add `SYS-PROFILE-01`: edit, reload and new-context verification |
| User can modify protected email unexpectedly | Add policy assertion to `SYS-PROFILE-01` |
| Suspended account can still sign in | `SYS-AUTH-02` |
| Incognito bypasses suspension | `SYS-AUTH-02` with a new browser context |
| Reactivated account has no permission | `SYS-AUTH-03` |

A bug is not closed by writing the test. It is closed only when the regression test first reproduces the defect against the affected version, the fix is applied, and the same test passes against the fixed version.

## 8. CI and artifact plan

### Pull-request workflow

1. Install exact npm dependencies and Chromium.
2. Build the application.
3. Start `vite preview` on a fixed local port.
4. Run the local system-shell P0 suite.
5. Upload Playwright HTML report, trace, screenshot and video only on failure.
6. Block merging on P0 failure.

### Protected staging workflow

1. Require explicit environment approval and staging secrets.
2. Verify the target hostname is staging, not production.
3. Reset/seed dedicated test identities and records.
4. Run P0 full-system tests, followed by approved P1 tests.
5. Run at most the agreed number of real model/email requests.
6. Clean up state-changing records.
7. Retain reports without tokens, passwords, email links or response secrets.

### Failure artifacts

Capture:

- trace on first retry;
- screenshot on failure;
- video on failure for complex flows;
- sanitized network/error summary;
- browser/viewport, commit SHA and target environment.

Artifacts must redact authorization headers, Supabase keys, provider keys, reset tokens and personally identifying data.

## 9. Flakiness policy

- No fixed sleeps such as `waitForTimeout(5000)` for ordinary synchronisation.
- Wait for a meaningful URL, response, accessible element or persisted state.
- Use retries only in CI and keep the first failure trace.
- A test that passes only on retry is tracked as flaky and is not silently considered healthy.
- Do not make tests serial unless they truly share an unavoidable resource.
- External-provider tests must have bounded timeouts and a separately reported availability result.

## 10. System-test completion criteria

System testing may be called complete for the agreed release scope only when:

- [ ] Playwright is configured and documented.
- [ ] All P0 local real-browser journeys pass from a clean build.
- [ ] All P0 protected staging journeys pass against real Supabase boundaries.
- [ ] One controlled real AI provider journey passes, including grounding validation.
- [ ] Authentication, suspension, reactivation and password/profile persistence regressions pass.
- [ ] Dashboard values, units, years, sources, data levels and confidence match canonical artifacts.
- [ ] Direct routes, desktop Chromium and the supported mobile viewport pass.
- [ ] Firefox/WebKit support is either green or explicitly excluded from the supported-browser statement.
- [ ] No unresolved P0/P1 user-facing defect remains.
- [ ] Reports are tied to an exact commit and deployment version.
- [ ] A human performs final exploratory checks for maps, charts, email delivery and overall usability.

## 11. Proposed implementation order after confirmation

1. Complete and stabilise unit tests first.
2. Install/configure Playwright without writing broad journeys.
3. Implement P0 public shell/data/provenance tests.
4. Add the local CI gate and stabilise it.
5. Prepare a dedicated staging environment and safe seed/reset mechanism.
6. Implement auth/authorisation regression journeys.
7. Implement AI, quota, telemetry and live-news journeys.
8. Add simulator, community, report, accessibility and browser expansion.
9. Execute a full staging acceptance run and produce the sign-off report.

## 12. Approval checkpoint

This document does **not** authorise implementation. After the two Markdown plans are reviewed and confirmed, the first proposed Playwright change should be a small, reviewable foundation commit containing only:

- pinned Playwright dependency;
- `playwright.config.js`;
- package scripts;
- one application-shell smoke test;
- CI artifact handling;
- documentation for local execution.

Broader system journeys should be added incrementally after that foundation is accepted.

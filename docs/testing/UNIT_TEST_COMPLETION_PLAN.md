# Borneo Tracker Unit Test Completion Plan

**Status:** Planning only — no test execution or code changes are authorised by this document  
**Prepared:** 2026-09-04  
**Target branch reviewed:** `testing`

## 1. Purpose

This plan defines the work and evidence required before Borneo Tracker can honestly claim that unit testing is complete.

The unit-test programme primarily protects:

- **D — Data:** resilience calculations, territory mappings, indicators, generated artifacts and data-pipeline rules.
- **E — Ethics:** provenance, confidence labels, comparability, fail-closed behaviour and the rule that missing data must never be silently imputed.
- **A — AI:** deterministic routing, grounding, simulation and response validation around the chatbot.
- **B — Blockchain/proof layer:** manifests, hashes, witnesses and anchoring policy.

These protections apply across all six True Wealth pillars: Food, Energy, Education, Shelter, Healthcare and Entertainment. The principal users are the team, supervisor, governments, researchers, ESG users and any future buyer who depends on reproducible data.

## 2. Current repository baseline

A static inventory on 2026-09-04 found:

| Area | Current evidence |
|---|---|
| JavaScript/TypeScript | 65 `*.test.*` files using Vitest and jsdom |
| Python | 21 `test_*.py` files, including the anchoring golden test |
| Frontend coverage | Utilities, hooks, services, components, ESG/SDG pages, simulator and AI-chat UI |
| Backend/AI coverage | AI request handler, routing, entities, comparability, facts, grounding, quota, telemetry, news and fallback logic |
| Data/proof coverage | Pipeline artifacts, resilience guardrails, manifests, release gates, witnesses, anchoring and workflow contracts |
| CI | `.github/workflows/ci.yml` runs lint, Vitest, Python unittest discovery and `test_anchoring.py` |

Historical project documents report 1,066 frontend tests and 134 data-pipeline tests. Those numbers must be treated as historical until a fresh, successful run produces a new signed baseline.

### Known issues at the start of this plan

Before test execution was put on hold, an already-started Vitest run exposed at least four failing assertions:

1. The Fact Object Builder test for an inactive unemployment bound.
2. The Fact Object Builder test for an inactive poverty bound.
3. The Structured Answer Builder test for an inactive unemployment bound.
4. The Structured Answer Builder test for an inactive poverty bound.

The run also emitted React test warnings about updates not wrapped in `act(...)`, including warnings from the AI chat, SDG, freshness and score-explainer tests. The full run was not used as a completion result.

There is no committed coverage threshold in `vite.config.js`, and file counts alone do not prove adequate behaviour coverage.

## 3. Definition of “unit testing complete”

Unit testing is complete only when all of the following are true:

- [ ] Every current JavaScript/TypeScript unit and component test passes.
- [ ] Every current Python unit test and anchoring golden test passes.
- [ ] ESLint passes because invalid test code must not be accepted as evidence.
- [ ] No unexpected React `act(...)`, unhandled rejection, open-handle or console-error warning remains.
- [ ] Tests pass from a clean dependency installation using the versions declared in `package.json` and CI.
- [ ] Critical D/E logic has explicit success, boundary, missing-data and failure-path coverage.
- [ ] Tests prove that incompatible territory units and geographic levels are not compared as if equivalent.
- [ ] Tests prove that missing pillars, sources, publishers and confidence fields remain visibly missing rather than invented.
- [ ] Flaky-test checking completes successfully on repeated runs.
- [ ] A coverage report is captured and agreed thresholds are enforced in CI.
- [ ] The final evidence records commit SHA, environment, commands, totals, failures, skipped tests, warnings and coverage.

## 4. Work plan

### Phase UT-1 — Capture a controlled baseline

After approval to execute:

1. Record the current commit SHA and working-tree status.
2. Confirm Node 22.21.1, npm 10.9.4 and Python 3.12 availability.
3. Use a clean dependency installation.
4. Run lint, Vitest and Python tests separately so one failure cannot hide another suite.
5. Save concise machine-readable reports rather than relying on console history.
6. Classify every failure as one of:
   - production defect;
   - stale test expectation;
   - fixture/data drift;
   - environment/configuration failure;
   - flaky or timing-dependent test.

Do not update an expected value merely to make a failing test green. First compare it with the current resilience methodology, `resilience_model.json`, canonical data and the UI behaviour.

### Phase UT-2 — Resolve the known target-bound failures

Investigate the unemployment and poverty failures as a single model-contract issue:

1. Trace whether each bound is active in `public/data/resilience_model.json`.
2. Trace whether the indicator participates in the current Resilience Index.
3. Verify the Fact Object Builder status and warning contract.
4. Verify the Structured Answer Builder does not publish an inactive bound as an official target.
5. Decide whether code, generated model data, fixture or test expectation is wrong.
6. Add a regression test that fails if inactive bounds are later exposed as active targets.

Required result: the chatbot may describe an observed value, but it must not call an inactive methodology bound an official Resilience Index target.

### Phase UT-3 — Remove React test warnings

For every warning:

1. Await user events and async rendering.
2. Use `act(...)` only around the update that requires it.
3. Remove overlapping `act(...)` calls.
4. Wait for fetch/state completion before asserting.
5. Fail tests on unexpected `console.error` so warnings cannot silently return.

Warning cleanup is part of correctness. A test that passes while React reports an unobserved state transition may not be testing the final user-visible state.

### Phase UT-4 — Measure and close coverage gaps

Add Vitest coverage support and generate Python coverage without changing application behaviour. Review coverage by risk, not only by percentage.

Priority areas:

| Priority | Area | Required cases |
|---|---|---|
| P0 | Resilience model and scoring | min/max bounds, inverse indicators, zero, missing values, six-pillar completeness, methodology-version changes |
| P0 | Provenance and comparability | missing source, confidence and level; mismatched units; national/province/state/proxy distinctions; fail-closed output |
| P0 | Authentication/authorisation services | unauthenticated, user, admin, suspended, reactivated, failed database write and rollback |
| P0 | AI grounding and validation | unsupported question, malformed provider output, invented numbers, blocked comparison, no target, quota and timeout |
| P1 | Data pipeline and artifacts | canonical selection, JSON schema, stale data, manifest mismatch, release sequencing and pillar-loss gate |
| P1 | UI state | loading, empty, error, Malay/English parity, keyboard interaction and inaccessible state regression |
| P1 | Community/admin services | attachment rollback, persistence failure, permissions and unsafe input |
| P2 | Formatting and presentation | dates, labels, headline text, momentum and export formatting |

Proposed initial thresholds, subject to the measured baseline:

- Critical D/E modules: **90% lines/statements/functions and 85% branches**.
- Repository-wide JavaScript/TypeScript: **80% lines/statements/functions and 75% branches**.
- Critical Python scoring/proof modules: **90% line coverage**.
- Repository-wide Python: **80% line coverage**.

If the baseline is below a proposed threshold, document the measured gap and raise the threshold in reviewable stages. Do not exclude difficult production files merely to increase the percentage.

### Phase UT-5 — Strengthen test quality

- Replace broad text assertions with exact or structural assertions.
- Use table-driven tests for territories, pillars, languages and indicator directions.
- Keep fixtures minimal and label synthetic values clearly.
- Mutation-check the most important scoring, comparability and provenance assertions.
- Avoid snapshot-only approval for numerical or ethical claims.
- Ensure each failure message identifies the violated business rule.
- Keep unit tests isolated from live APIs, email delivery and production databases.

### Phase UT-6 — CI enforcement and final sign-off

CI should publish:

- JavaScript/TypeScript test report and coverage;
- Python test report and coverage;
- lint result;
- skipped-test inventory;
- retained failure artifacts when a job fails.

The unit-test gate must block merging when any required test fails, a critical warning occurs, or coverage drops below the agreed threshold.

## 5. Planned verification commands

These commands are documented only and must not be executed until approval:

```powershell
npm ci
npm run lint
npm test
py -m unittest discover -s tests -t . -p "test_*.py"
py test_anchoring.py
```

Coverage commands will be finalised only after the team approves the coverage tooling and thresholds.

## 6. Completion evidence template

```text
Commit SHA:
Branch:
Tester:
Date/time:
Node/npm versions:
Python version:

Lint:                 PASS / FAIL
Vitest files:         passed / failed / skipped
Vitest tests:         passed / failed / skipped
Python tests:         passed / failed / skipped
Anchoring golden:     PASS / FAIL
Unexpected warnings:  0 / list
Flaky repeat runs:    PASS / FAIL / not run
JS coverage:
Python coverage:

Known exclusions with reasons:
Artifacts/report links:
Final sign-off:       APPROVED / NOT APPROVED
```

## 7. Deliverables

- [ ] All identified unit-test defects resolved.
- [ ] Warning-free JavaScript/TypeScript test run.
- [ ] Green Python and anchoring suites.
- [ ] Coverage configuration and reports.
- [ ] CI thresholds and retained reports.
- [ ] Updated test inventory.
- [ ] Completed sign-off record tied to an exact commit.

Until every required item is supported by fresh evidence, the accurate status remains: **unit tests are substantial, but unit testing is not complete**.

# BT-33 + adjacent AI Chat end-to-end fixing plan

**Prepared:** 2026-08-26  
**Status:** proposed — no implementation in this document  
**Primary scope:** BT-33 suggested questions, BT-14 delivery truth, AI Chat production wiring, scoring-bound single source of truth  
**Related:** BT-14, KIV-01, `OPEN_ISSUES_2026-08-25.md` §1, public-data release contract (BT-28)

---

## 1. Outcome this plan must produce

This work is complete only when all of the following are simultaneously true:

1. Every question shown in `SuggestedQuestions` is proven through the real pipeline — intent routing, entity resolution, comparability, fact construction, response/fallback, frontend rendering — not merely present as a string.
2. The client-facing §3.2 status distinguishes exactly what is live, what is implemented only on a branch, what is unsupported, and what is parked behind a data or methodology decision.
3. The deployed frontend has a non-empty, approved `VITE_AI_CHAT_ENDPOINT`, and a production smoke test proves the browser can reach the deployed Edge Function.
4. BorneoBot reads scoring bounds from the committed `resilience_model.json`; it does not keep a hand-copied `TARGET_BOUNDS` table.
5. Bounds that do not participate in the Resilience Index are not presented as active index methodology.
6. Target-gap wording expresses the correct direction (`increase by` / `reduce by`) and cites the artifact actually used at runtime.
7. All code, data, proof, deployment, documentation, and rollback gates are independently evidenced.

This is primarily ABCDE **A + D + E** work:

- **A — AI:** natural-language questions route into deterministic tools rather than model invention.
- **D — Data:** district, territory, pillar, target, and ranking answers come from committed data.
- **E — Ethics:** unsupported capabilities are disclosed; provenance and deployment claims match reality.

The immediate user is the supervisor/client. Downstream users include governments, researchers, NGOs, investors, and any paying decision-support customer who must be able to trust the answer and its source.

---

## 2. Verified baseline that the implementation must not forget

### 2.1 Suggested-question baseline

| Question | Current repository result | Current production result |
|---|---|---|
| `Compare Sabah and Sarawak` | Routes to `DASHBOARD_DATA`; deterministic comparison is available | Not yet in the deployed bundle |
| `Show districts with low food resilience` | Routes `OUT_OF_SCOPE`; no district Food rows exist | Not yet in the deployed bundle |
| `Find highest-risk regions` | Absent from suggestions; routes `OUT_OF_SCOPE` if submitted manually | Absent |
| `Explain the Forest Cover indicator.` | Routes to `SITE_KNOWLEDGE`; answer path exists | Present in the deployed bundle |

The current district artifact contains no Food rows. Its populated Hexagon tags are Education and Healthcare only. Therefore the low-food-district question is a **data + methodology feature**, not a synonym patch.

### 2.2 Deployment baseline

- The Supabase `ai-chat` Edge Function exists and responds to CORS preflight for the production origin.
- The production frontend bundle compiles the chat endpoint as an empty string.
- `.github/workflows/deploy.yml` does not inject or require `VITE_AI_CHAT_ENDPOINT`.
- `wave-3` contains BT-14 but has not been merged into `master`; production still carries the older suggestion list.
- `npm run ai-chat:deploy:check` verifies offline preparation only. It currently passes even though the production frontend cannot call the function.

### 2.3 Scoring-bound baseline

- `compute_resilience.BOUNDS` has 19 entries.
- BorneoBot's hand-copied `TARGET_BOUNDS` has 18; `Domestic electrification ratio` is missing.
- The 18 shared entries currently have matching units and values.
- Four Python bounds — unemployment and three poverty variants — are exported but never applied by the real index because their rows have no `hexagon_pillar`.
- The chatbot can nevertheless return those bounds as available targets and cite `compute_resilience.py.BOUNDS`, even though it actually read the TypeScript copy.
- Lower-is-better target gaps are currently rendered as negative arithmetic (`target - current`) without directional meaning.

---

## 3. Decisions that must be locked before coding

These are product/methodology decisions. They must not be silently made inside a code review.

### D1 — What may appear as a suggested question now?

**Decision:** until a question passes the end-to-end contract, it must not be shown as a one-click suggestion.

Recommended release-safe set:

1. `Compare Sabah and Sarawak`
2. `Which is Sabah's weakest pillar?`
3. `Explain the Forest Cover indicator.`

Only the first is one of the client's three verbatim examples. That fact must be stated in the client note. Do not label the set “the client's three examples.”

### D2 — What does “low food resilience” mean?

**Decision owner:** supervisor/product owner, with data owner sign-off.

Recommended definition after district Food data exists:

- calculate a district Food pillar score using the same target-normalisation rule as the territory Resilience model;
- `low` means the red band under the committed RAG threshold, not an arbitrary top-N;
- show amber separately rather than merging amber into “low”;
- if a district lacks a comparable Food input, mark it unscored and exclude it from ranking — never assign zero and never impute.

If the supervisor instead wants “lowest N districts,” record N, tie handling, minimum coverage, and sorting semantics explicitly.

### D3 — What does “highest-risk regions” mean?

**Decision owner:** supervisor/product owner.

Recommended narrow definition for this feature:

> “Resilience risk” means inverse overall Resilience Index: the territory with the lowest committed index is highest risk. This is not disaster, investment, EUDR, fire, poverty, or approval risk.

The answer must call it **resilience risk**, show the index and data date, disclose ties, and avoid the unqualified phrase “highest risk” in the conclusion. If the client intends a different risk construct, this query stays parked until that metric has an approved methodology.

### D4 — What happens to the four unused bounds?

**Decision:** remove them from `compute_resilience.BOUNDS` now. Do not map poverty or unemployment into a True Wealth pillar without supervisor approval.

Rationale:

- deletion does not change current Resilience scores because the rules never run;
- it stops publishing inactive methodology as if it were active;
- adding a pillar mapping would change scores and is a separate methodology project.

Any future proposal to score poverty/unemployment requires its own methodology card, before/after score analysis, client approval, and proof-bearing release.

### D5 — What is the deployment endpoint authority?

**Decision:** store `VITE_AI_CHAT_ENDPOINT` as a GitHub Actions secret or environment variable controlled by the production environment. Do not derive the project ref in frontend source and do not commit the live endpoint to `.env.example`.

The deployment owner must confirm the exact approved value and record only the variable name and verification result, never secret values or service credentials.

---

## 4. Work breakdown and exact implementation steps

### 4.0 Central change inventory

This is the handoff map for turning the plan into implementation cards. File names marked “recommended new” may be adjusted during review, but their responsibility must still exist in exactly one place.

| Area | What changes | Primary files | Owner | Blocking decision | Data/proof impact |
|---|---|---|---|---|---|
| Requirement source | One record per suggested question, provenance and enablement | `src/shared/aiChatContracts.js`; recommended new suggested-question contract/fixture | FE + QA + CONTENT | D1 | None |
| Suggestion UI | Render only enabled, E2E-proven prompts | `SuggestedQuestions.jsx`, `AIChatDialog.jsx` and tests | FE | D1 | None |
| Exact client-query routing | plural/hyphen/risk/district language | `intentRouter.ts`, `entityResolver.ts` and tests | AI/BACKEND | D2/D3 for semantic enablement | None |
| Comparison answer | two-territory fact and conclusion consistency | `comparabilityGate.ts`, `factObjectBuilder.ts`, `structuredAnswerBuilder.ts`, validator/tests | AI/BACKEND + QA | None | None |
| Resilience-risk ranking | all-territory deterministic ranking | contracts, comparability, fact builder, structured answer, validator, Golden cases | AI/BACKEND + DATA | D3 | Reads existing data only unless methodology artifact changes |
| District Food source | real district-level Food observations | source ingestion, `ingest_districts.py`, `data_model.py`, source registry, validation/tests | DATA | D2 + source approval | Changes proofed data |
| District Food answer | generic all-district retrieval, scoring/filtering, disclosures | `factDataRepository.ts`, `factObjectBuilder.ts`, comparability/answer/validator/tests | AI/BACKEND + DATA | D2 + completed ingestion | Reads changed proofed data |
| Bounds authority | remove inactive bounds and TS mirror | `compute_resilience.py`, `factCalculations.ts`, `factDataRepository.ts`, model tests | DATA + AI/BACKEND | D4 | Changes `resilience_model.json` bytes |
| Gap semantics | direction/magnitude/provenance | `factCalculations.ts`, `factObjectBuilder.ts`, structured answer/tests | AI/BACKEND + DATA QA | D4 | None beyond model-bound change |
| Deployment wiring | require/inject/build/smoke chat endpoint | `.github/workflows/deploy.yml`, deploy contract tests, preflight script | DEVOPS | D5 + environment-owner access | Production config/deploy |
| Branch integration | preserve new master data/proofs while merging Wave 3 | integration branch + PR | RELEASE OWNER | approved PR | Potential post-merge refresh |
| Delivery truth | replace binary “done” with evidenced status | client response/action plan, progress report, Wave 3 plan, AI deployment docs | CONTENT + RELEASE OWNER | None | None |

No single engineer should self-approve a methodology choice and its implementation. D2–D4 require a second reviewer from DATA/PRODUCT; production configuration requires the environment owner; client-facing closure requires CONTENT/RELEASE review against live evidence.

## Phase 0 — Stop false closure and establish traceability

### Step 0.1 — Reopen the delivery status

**Fix what:** change §3.2 from “delivered” to a capability matrix with four states: repository implemented, automated tests passed, deployed, production-verified.

**Fix where:** 

- `docs/CLIENT_FEEDBACK_RESPONSE_2026-08-24.md`
- `docs/CLIENT_FEEDBACK_2026-08-15_ACTION_PLAN.md`
- `PROGRESS_REPORT.md`
- `docs/WAVE_3_EXECUTION_AND_FIXING_PLAN.md`

**Correct wording:**

- search-to-chat handoff exists on `wave-3`;
- one client query is currently answerable end to end;
- the district Food query is blocked by missing district Food data;
- the risk-ranking query is blocked by an undefined risk meaning plus incomplete routing/ranking support;
- production frontend is not connected to the deployed function.

**Proof it is right:** no document uses `shipped`, `live`, `delivered`, or a green check for §3.2 unless the same row contains production evidence.

### Step 0.2 — Create one requirement contract

**Fix what:** create a machine-readable/client-traceable list that records each client example, intended semantics, required data, supported scope, and expected answer status.

**Fix where:** recommended new file `src/shared/aiChatSuggestedQuestionContracts.js`, or a JSON fixture under `tests/fixtures/ai-chat/` if it is test-only.

Each record should contain:

```js
{
  id,
  text,
  provenance: 'client-2026-08-15-§3.2' | 'team-scoped',
  requiredIntent,
  requiredOperation,
  expectedAvailability,
  enabled,
  limitationCode,
}
```

`SUGGESTED_QUESTIONS` should be derived from enabled records rather than manually restated.

**Proof it is right:** changing a displayed question without updating its contract causes a test failure.

---

## Phase 1 — Make the currently displayed suggestions truthful

### Step 1.1 — Replace unsupported one-click prompts

**Fix what:** temporarily remove `Show districts with low food resilience` from the enabled suggestions. Do not add `Find highest-risk regions` yet. Use only the release-safe set from D1.

**Fix where:**

- `src/shared/aiChatContracts.js`
- new/selected requirement-contract file
- `src/shared/aiChatContracts.test.js`

**Why this is correct:** a suggestion is an implicit product promise. Hiding an unsupported shortcut is safer than presenting a known failure, while users may still type free-form questions and receive honest clarification.

**Do not:** silently rewrite the client's question and continue calling it verbatim client delivery.

### Step 1.2 — Replace the misleading unit test

**Fix what:** retire the test name `seeds the three client decision and drill-down examples`.

Add tests that independently assert:

1. displayed questions equal the enabled contract records;
2. provenance is accurate;
3. every enabled record has an end-to-end test case;
4. no disabled/blocked client example appears in the UI;
5. question strings are unique, non-empty, and within the chat message limit.

**Fix where:**

- `src/shared/aiChatContracts.test.js`
- `src/components/ai-chat/AIChatDialog.test.jsx`
- `tests/ai-chat/golden/golden-questions.en.json`
- `scripts/ai-chat/GoldenEvaluator.js` only if the schema needs an explicit suggested-question flag

### Step 1.3 — Add a real suggested-question E2E contract test

For every enabled question, execute:

```text
question
  -> routeAiChatIntent
  -> resolveAiChatEntities
  -> evaluateComparability
  -> buildAIChatFactObject / knowledge retrieval
  -> buildStructuredAnswer or deterministic fallback
  -> response validation
```

Minimum assertions:

- expected intent is not `OUT_OF_SCOPE`;
- fact/knowledge availability matches the contract;
- no unexpected clarification is required;
- every number appears in approved numeric tokens;
- every source is public-safe;
- fallback mode does not fabricate success;
- frontend click sends exactly the tested string;
- English suggestions remain English unless a separate Malay suggestion contract is intentionally added.

**Fix where:** recommended new `supabase/functions/ai-chat/suggestedQuestions.integration.test.js` plus UI click coverage in `AIChatDialog.test.jsx`.

---

## Phase 2 — Harden the already-supported Sabah/Sarawak comparison

### Step 2.1 — Lock the client's exact wording into Golden tests

Use the exact sentence `Compare Sabah and Sarawak`, not only the expanded test sentence `Compare Sabah and Sarawak resilience scores.`

Assert:

- intent `DASHBOARD_DATA`;
- exactly Sabah and Sarawak resolved;
- comparison operation true;
- comparison gate `ALLOW`;
- both territory scores present;
- difference uses compatible overall Resilience Index values;
- conclusion names both territories and the comparison basis;
- data date and source artifact are disclosed;
- ties and missing-score behavior are deterministic.

**Fix where:**

- `intentRouter.test.js`
- `entityResolver.test.js`
- `factObjectBuilder.test.js`
- `structuredAnswerBuilder.test.js`
- `ai-chat.test.js`
- Golden English questions

### Step 2.2 — Fix comparison conclusion consistency if exposed by the test

The current fact conclusion can name only one territory before the comparison layer reshapes it. Ensure no public response emits a single-territory conclusion for a two-territory request.

**Fix where:** `factObjectBuilder.ts` and/or `structuredAnswerBuilder.ts` — choose one owner for comparison phrasing; do not duplicate phrasing logic.

---

## Phase 3 — Implement “Find highest-risk regions” safely

This phase starts only after D3 is signed off.

### Step 3.1 — Normalize the exact language

Add support for:

- singular/plural: `region`, `regions`;
- hyphen/space: `highest-risk`, `highest risk`;
- ranking phrases: `find`, `show`, `rank` combined with `risk`;
- Malay equivalents only when reviewed by a fluent owner.

**Fix where:**

- `intentRouter.ts`
- `entityResolver.ts`
- their unit tests

Avoid a general stemmer solely for this phrase unless regression-tested; broad stemming can route unrelated questions.

### Step 3.2 — Add an explicit resilience-risk concept

Do not treat generic `risk` as an invisible alias for every hazard. Introduce an explicit internal concept such as `resilience_risk`, mapped to inverse overall Resilience Index only under D3.

**Fix where:** contracts, entity resolver, comparability registry, fact builder, structured answer builder, response validator.

### Step 3.3 — Implement deterministic all-territory ranking

Ranking must:

- read all four territory indices from committed `resilience.json`;
- exclude null/unscored territories and disclose exclusions;
- sort lowest index first for resilience risk;
- preserve ties and use stable alphabetical ordering only as presentation, never as a fake tie-break;
- show score, RAG band, data date, weakest pillar, and coverage for each result;
- never ask Gemini to calculate or reorder numbers;
- validate that ranking claims are backed by approved fact tokens.

**Fix where:** preferably a dedicated ranking builder used by `factObjectBuilder.ts`; extend `comparabilityGate.ts` and `responseValidator.ts` rather than bypassing them.

### Step 3.4 — Test negative meanings of risk

The following must not silently use the resilience ranking:

- `highest fire risk regions`
- `highest EUDR risk regions`
- `highest flood risk regions`
- `highest investment risk regions`
- `highest approval risk regions`

They must route to their supported concept or return an explicit clarification/unavailable response.

### Step 3.5 — Enable the client suggestion only after all gates pass

Flip the contract record to `enabled: true` only when unit, Golden, handler, frontend, deployment, and production smoke evidence all exist.

---

## Phase 4 — Implement “Show districts with low food resilience” as a data feature

This is the largest phase and must remain separate from the small BT-33 UI patch.

### Step 4.1 — Source a real district Food indicator

Current `districts.json` has zero Food rows. The data owner must identify a comparable district-level Food anchor for the relevant territories, including:

- publisher and official URL;
- district coverage by Sabah, Sarawak, Brunei and Kalimantan;
- indicator definition and unit;
- year/cadence;
- administrative boundary version;
- licence;
- data level and confidence;
- whether values are direct, aggregated, or proxy;
- known cross-country comparability limitations.

If no sufficiently comparable source exists, the client query cannot be marked delivered. A territory-scoped alternative may be offered, clearly labelled as team wording.

### Step 4.2 — Define district Food scoring

Before ingestion, approve:

- indicator-to-Food mapping;
- best/worst bounds;
- exact unit match;
- aggregation if more than one Food indicator exists;
- minimum coverage;
- treatment of missing districts;
- RAG threshold semantics for `low`;
- whether cross-jurisdiction ranking is allowed.

The rule must be encoded in the canonical model/export, not in chatbot code.

### Step 4.3 — Extend ingestion and validation

**Likely files:** source-specific ingestion module, `ingest_districts.py`, `data_model.py`, `validate_data.py`, district tests, and source registry.

Validation must fail publication for:

- duplicate canonical district/indicator/year rows;
- unknown district join keys;
- unit mismatch;
- missing source/provenance/confidence;
- lost Food coverage relative to the accepted baseline;
- a district score computed from zero inputs;
- fake zero substituted for missing data.

### Step 4.4 — Add district Food facts and safe ranking

The generic word `districts` must be recognized as a requested aggregate district operation even when no district name is supplied.

The fact path must:

- retrieve the complete eligible district set;
- select Food inputs only;
- calculate scores deterministically;
- filter by the approved `low` rule;
- report coverage numerator/denominator;
- group or disclose parent territory;
- handle ties;
- cap display count without hiding the total;
- provide source metadata and freshness;
- return an honest empty state when no district is low.

Do not reuse the current single-district lookup loop for an all-district query without a bounded repository method and tests.

### Step 4.5 — Add cross-jurisdiction comparability gates

If district Food indicators differ between Malaysia, Indonesia, and Brunei, the answer must either:

- rank only comparable districts within a jurisdiction; or
- present jurisdiction-separated lists with an explicit non-comparability disclosure.

Never rank incompatible national definitions in one list.

### Step 4.6 — Publish the new data through BT-28

Because this phase changes `public/data/districts.json` and possibly `resilience_model.json`:

1. feature PR contains code/tests/docs only;
2. merge to `master`;
3. run `refresh-data.yml`;
4. validate generated artifacts;
5. anchor the exact data commit;
6. deploy the proof-bearing commit;
7. verify production bytes, UI, and query result.

Do not commit locally regenerated proof/data artifacts in the feature PR.

### Step 4.7 — Enable the suggestion last

Only after production verification should `Show districts with low food resilience` become an enabled one-click suggestion.

---

## Phase 5 — Remove the scoring-bound second source of truth

### Step 5.1 — Remove the four inactive Python bounds

Delete the unemployment and three poverty entries from `compute_resilience.BOUNDS` under D4.

Add a guard that every bound must resolve to a valid Hexagon pillar. An unmapped bound must fail tests/build-model validation, not print a NOTE and continue.

**Fix where:**

- `compute_resilience.py`
- `tests/test_resilience_model_export.py`
- relevant validation tests
- methodology/open-issues documentation

Update the synthetic model test: it must no longer invent `Poverty rate (absolute) -> Shelter` merely to exercise a “cross-pillar” bound that production does not use.

### Step 5.2 — Delete `TARGET_BOUNDS`

Import the already committed `public/data/resilience_model.json` in the Edge Function, following the established import-attribute pattern in `resilienceSimulation.ts`.

Provide one accessor for target bounds. Both simulation and target-gap facts should use the same loaded model object or the same repository abstraction.

**Fix where:**

- `factCalculations.ts`
- `factObjectBuilder.ts`
- `factDataRepository.ts`
- optionally a small shared `resilienceModelRepository.ts`

Do not replace one copy with a new hard-coded TypeScript copy elsewhere.

### Step 5.3 — Correct runtime provenance

Target and gap facts must cite the artifact actually read:

```text
public/data/resilience_model.json
bounds.<indicator>
dataVersion / generatedAt where available
```

Do not use the synthetic source path `compute_resilience.py.BOUNDS` in public fact objects unless the runtime actually reads that Python source, which it does not.

### Step 5.4 — Make gap direction explicit

Replace undirected `target - current` presentation with a structured result:

```js
{
  magnitude,
  direction: 'increase' | 'reduce' | 'at-target',
  target,
  current,
  unit,
  method,
}
```

Rules:

- `best > worst`: below target means `increase by best - current`;
- `best < worst`: above target means `reduce by current - best`;
- already beyond the target: state `meets/exceeds target`, do not show a misleading negative gap;
- preserve raw precision for calculation and apply the shared display rounding policy once.

### Step 5.5 — Add anti-drift and reachability tests

Tests must prove:

- chatbot target accessor equals every bound in the imported model;
- `Domestic electrification ratio` is available if it remains in the model;
- removed poverty/unemployment bounds are unavailable as index targets;
- every published bound resolves to a Hexagon pillar;
- every published bound is reachable by at least one valid synthetic scoring row;
- no separate `TARGET_BOUNDS` declaration exists under `supabase/functions/ai-chat`;
- higher-is-better and lower-is-better gap directions are correct;
- public source paths name the model artifact actually read.

### Step 5.6 — Release and anchor the model change

Removing bounds changes `resilience_model.json` bytes even though territory scores should remain identical.

Required proof:

- all four territory index, strict index, pillar scores, RAG bands, and weakest pillars are byte-for-value unchanged before vs after;
- only the intended model metadata/bounds change;
- `refresh-data.yml`, manifest generation, anchoring, and exact-proof deployment complete per `public-data-release-sequence.md`.

---

## Phase 6 — Wire the production frontend to the deployed function

### Step 6.1 — Add the endpoint to the deployment contract

**Fix where:** `.github/workflows/deploy.yml`.

Add `VITE_AI_CHAT_ENDPOINT` to:

- the gate step environment;
- required production/dry-run build inputs;
- the Vite build step environment;
- the deployment summary as configured/not-configured only — never print its sensitive neighbours;
- post-build assertions.

Although the endpoint itself is public, use the existing controlled environment mechanism so staging and production cannot be accidentally crossed.

### Step 6.2 — Add workflow contract tests

Extend `tests/test_deploy_workflow_contract.py` to assert:

- missing `VITE_AI_CHAT_ENDPOINT` is a red prerequisite failure for builds that expose BorneoBot;
- the build step receives it;
- connection-test-only mode does not require frontend build inputs;
- no Gemini/service-role secret is passed into Vite;
- production smoke includes AI Chat reachability;
- the endpoint is not printed in a way that can accidentally include query credentials.

### Step 6.3 — Strengthen `ai-chat:deploy:check`

The offline check should validate the real workflow wiring, not merely that `.env.example` mentions the variable.

Split terminology:

- `repository preflight passed` — static/offline only;
- `Edge Function verified` — live function check;
- `frontend wired` — built artifact check;
- `production E2E verified` — browser/API smoke.

Remove the assertion that a current production-readiness document must retain `NOT YET EXECUTED`. Preserve Stage 8G history in a dated historical section instead.

### Step 6.4 — Add post-build assertions

After `npm run build`, verify without logging secret values:

- endpoint configuration is non-empty;
- the built application does not contain the empty-endpoint fallback as its configured value;
- public Supabase project URL and AI function host belong to the approved environment;
- no server-only key appears in `dist`;
- the BT-14 suggestion contract/version is present in the built bundle.

### Step 6.5 — Add production smoke tests

Smoke sequence:

1. fetch production `index.html` and current JS asset;
2. prove the expected suggestion-contract marker/version is deployed;
3. send CORS `OPTIONS` from the production origin to the configured function;
4. send a deterministic zero-model or controlled authenticated smoke request;
5. assert status, response schema, CORS, safe sources, and no raw errors;
6. verify the browser forwards a bearer token when signed in;
7. verify missing/expired auth, 429, timeout, and fallback UI independently;
8. record commit SHA, function deployment version/time, frontend asset hash, and smoke result.

Do not consume an uncontrolled model quota on every deployment. Keep one explicitly approved model-backed smoke for release candidates; use deterministic paths for routine deploys.

### Step 6.6 — Update deployment documentation

Reconcile:

- `docs/ai-chat-production-deployment.md`
- `docs/ai-chat-frontend-contract.md`
- `docs/DEPLOYMENT_SETUP.md`
- AI Chat database/quota documents

Separate historical Stage 8G statements from current state. A dated claim must say whether it describes repository preparation, database migration, Edge Function deployment, frontend wiring, or full production E2E.

---

## Phase 7 — Integrate branches without regressing proofed data

`wave-3` and `master` have diverged. Before merging:

1. merge/rebase current `master` into the feature integration branch;
2. preserve master's scheduled data/proof commits;
3. do not overwrite current `public/data` with stale feature-branch copies;
4. resolve AI Chat, deployment workflow, client-note, and test conflicts explicitly;
5. run the full suites against the integrated commit;
6. open a reviewed PR to `master`;
7. use BT-28 for any model/data artifact change;
8. deploy only the exact proof-bearing master commit.

The merge PR description must list separately:

- code-only fixes;
- data-model changes requiring refresh/anchor;
- configuration changes requiring repository/environment owner action;
- client-facing claim corrections.

---

## 5. Verification matrix — how we know the fix is correct

| Layer | Required verification | Failure means |
|---|---|---|
| Requirement | Every client sentence has provenance, status, semantics, and owner | Do not claim closure |
| Suggestions | Every enabled prompt passes the real pipeline | Remove/disable the prompt |
| Router | Exact client wording and plural/hyphen variants route as expected | Capability not implemented |
| Entities | Territory/district/concept/operation sets are exact | Answer may use wrong scope |
| Comparability | incompatible definitions downgrade/reject with disclosure | Ranking is unsafe |
| Facts | all numbers come from committed artifacts | Block the answer |
| Response | numeric/source validators pass; no unsupported ranking claim | Reject/fallback |
| Frontend | click sends exact text; errors and fallback are visible | UI promise is broken |
| Bounds | no TypeScript mirror; all model bounds mapped/reachable | Second source persists |
| Data | district Food coverage and provenance pass validation | Keep query disabled |
| Build | endpoint injected; no server secrets in bundle | Do not deploy |
| Edge Function | CORS/schema/auth/quota/fallback smoke passes | Roll back function/config |
| Production | asset marker, endpoint call, and browser flow verified | Do not say live |
| Proof | model/data bytes match manifest and anchor | Do not deploy data claim |
| Docs | implementation/deployment/verification states agree | Delivery remains misleading |

Required local commands, adjusted if package scripts change:

```text
npm run lint
npm test
npm run build
npm run ai-chat:golden:validate
npm run ai-chat:golden
npm run ai-chat:deploy:check
python -m unittest discover -s tests -t .
python validate_data.py --baseline-ref <master-baseline> --require-baseline
python verify_manifest.py verify public/data
python verify_proof_contract.py public/data
python verify_anchor.py --allow-pending
```

In addition, run targeted exact-client-wording tests. A green full suite without these cases is insufficient.

---

## 6. Regression and edge-case checklist

### Query language

- singular/plural district and region;
- hyphenated/unhyphenated highest-risk;
- capitalization and punctuation;
- Sabah/Sarawak order reversal;
- ties;
- empty result;
- one territory missing a score;
- ambiguous `risk` concepts;
- generic “districts” without a named district;
- Malay parity only where an approved translation exists.

### Data honesty

- missing Food data is unscored, never zero;
- proxy/national/inherited data is disclosed;
- different jurisdiction definitions are not ranked together silently;
- stale district data produces a freshness warning;
- no bound exists without a pillar mapping;
- no target is described as an SDG/official target unless it truly is one;
- deleting inactive bounds does not change current scores.

### Security and operations

- no Gemini key, service-role key, JWT, raw prompt, or private news content enters the frontend bundle or logs;
- CORS permits only approved origins in production;
- anonymous/model quota behavior remains fail-closed;
- telemetry failure does not change the answer;
- rollback can disable the frontend endpoint without deleting the function or database records.

---

## 7. Rollback plan

### Frontend/config rollback

- redeploy the last known-good frontend commit;
- if the function is unhealthy, blank/remove `VITE_AI_CHAT_ENDPOINT` and rebuild to show the explicit unavailable state;
- do not leave a visible suggestion that submits to an unavailable service.

### Edge Function rollback

- redeploy the last known-good function source;
- preserve quota/telemetry tables and use forward database fixes; do not drop operational tables as a routine rollback;
- rotate misconfigured secrets rather than committing replacements.

### Data/model rollback

- use the prior proof-bearing artifact version;
- never hand-edit production JSON;
- if regenerated scores differ unexpectedly, stop before anchor/deploy and investigate;
- if a bad proof-bearing version is already live, deploy the prior verified version and publish a correction record rather than rewriting history.

### Suggested-question rollback

- disable the affected contract record;
- retain its failing Golden case as a regression test marked blocked/expected-unavailable;
- update the client status immediately.

---

## 8. Recommended execution order

| Order | Work | Can start now? | Release type |
|---|---|---|---|
| 1 | Phase 0 truth/status corrections | Yes | Docs/code-only |
| 2 | Phase 1 safe suggestions + E2E contract tests | Yes | Frontend/backend code |
| 3 | Phase 2 exact comparison hardening | Yes | Backend/tests |
| 4 | Phase 5 remove bound mirror + inactive bounds | Yes after D4 confirmation | Code, then data refresh/anchor |
| 5 | Phase 6 production endpoint wiring | Yes after environment owner confirms endpoint | Workflow/config/deploy |
| 6 | Phase 3 resilience-risk ranking | After D3 approval | Backend/frontend |
| 7 | Phase 4 district Food feature | Only after source + D2 methodology | Data pipeline + backend + proof release |
| 8 | Re-enable all client examples | Only after production E2E proof | Contract flag + client note |

Phase 4 must not block shipping the truth and deployment fixes in Phases 0–2, 5, and 6.

---

## 9. Final done criteria

BT-33 and its adjacent findings are closed only when:

- [ ] The suggested-question source records provenance and enablement.
- [ ] Every enabled suggestion passes unit, integration, Golden, handler, and UI tests.
- [ ] Exact client wording is tested, not paraphrase-only wording.
- [ ] Unsupported client examples are visibly parked with reasons.
- [ ] “Highest risk” has a signed-off definition or remains disabled.
- [ ] District Food data and scoring exist before the district Food prompt is enabled.
- [ ] `TARGET_BOUNDS` no longer exists.
- [ ] The four unused bounds are removed, or a separately approved methodology makes them genuinely scoreable.
- [ ] Every remaining bound maps to a Hexagon pillar and is test-reachable.
- [ ] Target/gap direction and runtime provenance are correct.
- [ ] The deploy workflow requires and injects `VITE_AI_CHAT_ENDPOINT`.
- [ ] The offline deploy check cannot pass while workflow wiring is missing.
- [ ] `wave-3` changes are integrated without replacing newer master data/proofs.
- [ ] The Edge Function and production frontend are both verified, separately and together.
- [ ] Any changed data/model artifact is refreshed, manifested, anchored, and deployed from the exact proof commit.
- [ ] Client-facing §3.2 wording matches production reality.
- [ ] Release evidence records commit SHA, data/proof SHA where applicable, function verification, frontend asset hash, and production smoke result.

Until every applicable box is checked, the honest status is **partially implemented**, not fully delivered.

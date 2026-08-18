# Draft client correction note — 2026-08-18

**Status: approval required — internal draft only. Do not email, publish, or paste into a public product surface without the product/client owner's explicit approval.**

## Proposed message

On 17 August 2026, Borneo Tracker corrected a data-processing issue affecting the Education pillar for Sabah and Sarawak. A duplicate snapshot record caused the existing Global Data Lab Education observation to be excluded from the resilience calculation.

The corrected release restores those existing observations and returns both territories to a six-pillar calculation. As a result, some displayed scores changed: Sabah's Resilience Index is now 67.6 (amber), Sarawak's is 73.6 (green), and the All-Borneo aggregate is 71.7. This is a correction to calculation completeness, not evidence that on-the-ground conditions suddenly deteriorated.

The restored Education observations are Global Data Lab `Mean years schooling (RLS)` values for 2023 (8.7 years; pillar score 45.0) and remain marked medium confidence. They are real source observations, not imputed estimates.

We also added a per-territory release gate: if a previously scored pillar disappears during a future refresh, publication fails instead of silently releasing a partial score.

## Approval and delivery checklist

- [ ] Product/client owner approves the wording and audience.
- [ ] Owner confirms whether the client needs the full score table or only the explanation above.
- [ ] Send through the agreed client channel; record date, recipient group, and final wording in the project record.
- [ ] Do not describe an OpenTimestamps/Bitcoin proof as proof that an upstream source is true. It attests the published bytes and release evidence.
- [ ] Do not claim routine daily source changes are real-world trends without source-specific review.

## Evidence for the approved sender

- Data refresh commit: `528a9b9` (`chore: scheduled data refresh`).
- Proof commit: `3ac658097a39f320ecb3e750a40ce176a91f8a37`.
- Released `public/data/resilience.json`, generated 2026-08-17: Sabah and Sarawak each contain Education in `scoredPillars`, have an empty `unscoredPillars` array, and expose the cited Global Data Lab source detail.
- The complete DevOps/data incident and release sequence are documented in `docs/DEVOPS_DATA_REMEDIATION_PLAN_2026-08-17.md` and `docs/DATA_RELEASE_AND_ANCHORING_RUNBOOK.md`.

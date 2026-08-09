# Blockchain Phase 1 — Implementation & Release Status

**Date:** 2026-08-09 (Asia/Kuala_Lumpur)
**Scope:** local implementation of `BLOCKCHAIN_PHASE1_COMPLETION_PLAN.md`, including the
provenance-ledger reconciliation authorised on 2026-08-09.
**Current status:** the planned local implementation is present and **Gate A is achieved**:
the repository-wide test baseline, clean Node 22 install, dependency audit, lint, build, and
local blockchain checks pass. The current Manifest v2 is still **not externally anchored or
deployed**.

## 1. Plain-language outcome

Phase 1 now creates a strict, versioned inventory of the dashboard's six published data
files, commits a validated prefix of the provenance ledger into that inventory, and has
code/workflows to attach external OTS and Sigstore witnesses before deploying the exact
proof-bearing commit.

This is the Borneo Tracker **D + E → B** bridge:

- **D — Data:** the six dashboard data files and their exact bytes;
- **E — Ethics:** provenance, fail-closed validation, honest UI wording, and reproducible
  audit records;
- **B — Blockchain:** OpenTimestamps as an external timestamp witness, not tokens, wallets,
  carbon-credit issuance, or a claim that source numbers are inherently true.

It serves reviewers, researchers, regulators/EUDR users, governments, investors, and
ESG-data customers who need reproducible publication evidence.

## 2. Current verified state

| Item | State |
|---|---|
| Manifest format | v2, locally verified |
| Current data version | `918a87a5dbd27e4069563f19301fc9e4cc6aa44d5251ecf50ed4b433525e0aa5` |
| Manifest provenance commitment | 62 ledger entries; root `7ae7c0059309237ac8a8c0fc9892448023363d6a42b3ccca2763a05f30219356` |
| Current external OTS/Sigstore witness | Not yet created for this v2 Manifest (`UNANCHORED` is expected) |
| Historical v1 Manifest/proof records | Three full-SHA version pairs migrated locally |
| Production deployment | Not performed |

`UNANCHORED` here does **not** mean tampering or invalid data. It means this new, local
Manifest has not yet been submitted to the external witness/release workflow.

## 3. What changed and where

### 3.1 Manifest, data scope, and provenance contract

| Files | Change |
|---|---|
| `manifest_contract.py` | Adds the strict Manifest v2 contract: six required dashboard files, safe paths, SHA-256/byte checks, strict JSON duplicate-key rejection, RFC3339 UTC validation, and canonical `dataVersion`. |
| `emit_manifest.py` | Publishes Manifest v2 atomically; embeds the RFC6962-style provenance root and entry count; prevents duplicate no-op publication; handles v1 as a migration input; detects incomplete ledger tails. |
| `verify_manifest.py` | Uses the Manifest itself as the only local/remote data verification scope and rejects HTML fallback responses. |
| `merkle.py` | Uses domain-separated RFC6962-style leaf/node hashing for ledger prefixes. |
| `json_artifacts.py` | Prevents a changed clock alone from rewriting unchanged generated JSON bytes. |

The declared data scope is:

```text
public/data/indicators.json
public/data/resilience.json
public/data/resilience_model.json
public/data/districts.json
public/data/borneo_districts.geojson
public/data/brunei.geojson
```

### 3.2 OTS, Sigstore, event reduction, and verification

| Files | Change |
|---|---|
| `anchor_provenance.py`, `upgrade_anchors.py` | Creates full-SHA version directories, preserves latest aliases, records proof SHA changes, prevents proof downgrades, and retains original data/signing identity when an upgrader records its own run identity. |
| `witness_events.py` | Adds a strict monotonic reducer. OTS and Sigstore are independent; an OTS upgrade cannot erase Sigstore or downgrade confirmation. |
| `verify_anchor.py` | Defines truthful result/exit states: `VERIFIED_CONFIRMED`, `PENDING`, `UNANCHORED`, `MISMATCH`, and `INVALID`. Self-hosted metadata cannot manufacture confirmation. |
| `verify_proof_contract.py` | Binds the current/versioned OTS proofs and witness event to the Manifest digest; arbitrary proof bytes fail. |
| `migrate_manifest_versions.py` | Restores the three known v1 Manifest/proof pairs from exact Git blobs, verifies their digests/proof subjects, and appends idempotent migration events. |
| `public/data/anchors.jsonl`, `public/data/versions/` | Stores migrated historical witness records and full-SHA Manifest/proof pairs. |

### 3.3 Browser verification and truthful public wording

| Files | Change |
|---|---|
| `src/data/useIntegrity.js` | Explicit overview/district/model/full scopes; corrupt/unknown metadata fails closed; zero checked files cannot become green; standalone Sigstore is retained. |
| `src/components/IntegrityChip.jsx`, `src/pages/info/DataVerification.jsx` | Shows file-to-Manifest verification honestly and separates OTS availability from independent Bitcoin verification. |
| `src/i18n/locales/en.json`, `src/i18n/locales/ms.json` | Removes Bitcoin/operator-tampering overclaims and adds explicit invalid/unverified states. |

The browser verifies that downloaded published bytes equal the downloaded Manifest. It does
**not** prove that an original source statistic is correct, nor does it independently verify
Bitcoin inclusion by itself.

### 3.4 Release automation and recovery

| Files | Change |
|---|---|
| `.github/workflows/refresh-data.yml`, `anchor.yml`, `anchor-upgrade.yml` | Uses shared `queue: max` publication serialisation, no in-progress cancellation, exact-SHA hand-off, and overflow/interruption catch-up. `anchor.yml` separates the read/OIDC/attestation job from the contents-writing proof job and SHA-256 checks the transferred Sigstore bundle. |
| `.github/workflows/anchor-catchup.yml`, `catch_up_anchors.py` | Finds an exact historical data commit whose v2 Manifest lacks an anchor, hash-checks it, then dispatches the exact version rather than stamping a branch tip. |
| `.github/workflows/anchor-integration.yml` | Adds a same-repository, non-mutating PR gate that attests and identity-verifies a Manifest but cannot push proof files or deploy. |
| `.github/workflows/deploy.yml` | Deploy is proof-dispatch/manual only, not every `master` push; normal and cache-buster smoke paths verify all six data files plus the current and versioned proof contract. All action references are immutable commit SHAs. |

### 3.5 Tests and specification

| Files | Change |
|---|---|
| `tests/test_manifest_integrity.py`, `tests/test_phase1_publish_integration.py`, `tests/test_proof_contract.py`, `tests/test_verifier_policy.py`, `tests/test_witness_events.py`, `tests/test_catchup_history.py`, `tests/test_workflow_contract.py`, `tests/test_json_artifacts.py` | Adds regression coverage for contract validity, recovery, proof binding, policy states, no-op bytes, catch-up, and workflow topology. |
| `src/data/useIntegrity.test.js` | Covers browser integrity states, invalid metadata, missing/HTML proof handling, and positive six-file pending-proof verification. |
| `docs/BLOCKCHAIN_ANCHORING_SPEC.md` | Rewritten to describe the truthful OTS-only Phase 1 boundary. |

## 4. Provenance-ledger reconciliation performed

The original ledger contained Git merge markers and a duplicated `impactSimulator` history.
The evidence and full decision record are in
[`PROVENANCE_LEDGER_RECONCILIATION_2026-08-09.md`](PROVENANCE_LEDGER_RECONCILIATION_2026-08-09.md).

Changes made in `public/data/provenance.jsonl`:

1. Removed the three merge delimiter lines.
2. Retained the validated GitHub Actions batch (`runId` `31051931416`).
3. Retained one complete, byte-verified four-file `impactSimulator` batch, including
   `resilience_model.json`.
4. Removed nine duplicate repetitions of the same four hashes.
5. Corrected one historical `resilience_model.json` assertion whose hash/byte count did not
   match the actual Git object at the named commit.
6. Generated the first clean Manifest v2 from the repaired ledger. It added six schema-v2
   provenance entries for the six-file current data version.

The raw conflicting material remains recoverable from Git commit
`c4ac92c9543a9014b1118291e12ddd76092c0744`; this was not an untraceable deletion.

## 5. Validation evidence and Gate A status

| Check | Result |
|---|---|
| `python -m unittest discover -s tests -p 'test_*.py' -v` | 84 tests passed |
| `python test_anchoring.py` | Passed |
| `npm ci --ignore-scripts` under Node `22.21.1` / npm `10.9.4` | Passed |
| `npm audit` and `npm audit --omit=dev` | 0 vulnerabilities |
| `npm test -- --run` | 39 files / 733 tests passed |
| `npm test -- --run src/data/useIntegrity.test.js` | 23/23 passed |
| `npm run lint` | Passed; generated `**/dist/**` is intentionally excluded |
| `npm run build` | Passed |
| `python verify_manifest.py verify public/data` | Passed |
| `python verify_anchor.py` | `UNANCHORED` (exit 3), expected until the connected proof gate |
| Workflow YAML parse and targeted workflow contracts | Passed |
| `git diff --check` | Passed |

The previously stale AI-chat fixtures now track the current committed data: current resilience
scores, current district freshness metadata, and the deliberate `UNAVAILABLE` state where there
is no canonical Sabah education row. The Node 22 lockfile includes the required `@emnapi`
entries and the audit remediation. ESLint ignores generated `**/dist/**` output while continuing
to lint real source files.

The Vite build reports a pre-existing large-chunk advisory only; it does not fail the build.

## 6. Work still required before release

The first two items below are still local/repository release blockers; the remainder require a
connected GitHub/hosting environment, repository administration, or a deliberate release decision.

### 0. Gate A is complete; do not misread it as an external proof

Gate A proves the repository can reproducibly build and test the local implementation. It does
**not** turn `UNANCHORED` into a pass, does not run GitHub OIDC/Sigstore, and does not authorise
production deployment.

### A. Synchronise safely with the current `master`

**Condition:** Before merging, incorporate the latest `master` without restoring the old
conflict markers or legacy Manifest/provenance mismatch. Re-run the data pipeline and generate
a final Manifest v2 after the exact merge result is known.

**Why:** `origin/master` currently carries the earlier corrupted ledger state. It must not
overwrite this reconciliation during a merge/rebase.

### B. Run the connected pre-release proof gate

**Conditions:** GitHub Actions permissions/secrets must be configured; the exact final commit
must be available on the intended release branch. The new PR integration workflow protects
future same-repository PRs; because it is new, the first bootstrap connected run occurs on
`master` after this release code is merged and before any production deployment.

1. Run the exact-SHA anchor workflow.
2. Create the GitHub/Sigstore attestation with the trusted signer workflow and release ref.
3. Submit the exact Manifest bytes to OTS calendars.
4. Verify the Sigstore identity using `gh attestation verify` with repository, workflow, ref,
   and expected digest constraints.

**Success evidence:** an attestation ID/URL, proof SHA-256, Manifest SHA-256, data/source
commit SHA, signer source SHA, and workflow run URL are retained as release evidence.

### C. Obtain independent OTS/Bitcoin confirmation

**Condition:** The OTS proof must have matured, and a verifier must have a trusted Bitcoin
source.

Use either the official OpenTimestamps browser verifier or `ots verify` backed by a maintained
Bitcoin Core node (a pruned node is acceptable). A parsed Bitcoin height inside a proof is not
itself independent confirmation.

### D. Deploy only the returned proof commit, then smoke-test production

**Conditions:** Hosting/SFTP/FTPS credentials and target path are configured; the proof
workflow produced its exact proof commit SHA.

Deploy that SHA only. The post-deploy job must download and hash all six datasets, current
Manifest/proof/event files, and the matching full-SHA versioned Manifest/proof pair. HTML SPA
fallback at any expected data/proof URL must fail the check.

### E. Repository governance

Before production use, repository administrators should enforce no force-push or deletion on
`master`, required checks/review, and restricted review for workflows plus
Manifest/provenance/anchor/deploy code. This protects the release process; it does not make
source numbers inherently true.

## 7. Explicit non-goals for Phase 1

Phase 1 does **not** implement wallets, tokens, smart contracts, RWA issuance, carbon-credit
issuance, DID/self-sovereign identity, or community yield. Those are possible later B-roadmap
work, not current functionality.

## 8. Recommended next sequence

```text
Gate A complete
        ↓
Synchronise latest master safely
        ↓
Regenerate final Manifest v2 from the merged data
        ↓
Run connected exact-SHA OTS + Sigstore pre-release gate
        ↓
Independently verify OTS/Bitcoin and Sigstore identity
        ↓
Deploy the exact proof commit
        ↓
Run production byte/proof smoke validation
```

Until the connected gates complete, public wording must remain: **“published files match the
published Manifest”** — not “Bitcoin verified” or “independently immutable.”

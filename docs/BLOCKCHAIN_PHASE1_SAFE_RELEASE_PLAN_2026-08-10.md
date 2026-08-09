# Blockchain Phase 1 — Safe Release Sequence Plan

**Date:** 2026-08-10 (Asia/Kuala_Lumpur)
**Status:** implementation plan; no workflow change, merge, anchor, or deployment is authorised by this document
**Source baseline:** `feature/blockchain-anchoring` at `9e06c36`, `origin/master` at `e9561fe`

## 1. Decision

Do **not** stamp the current Manifest from the feature branch and do **not** merge the branch yet.

The next implementation task is to separate proof creation from production deployment and add an
explicit, exact-SHA production approval gate. The current proof workflows automatically dispatch
production deployment after a new or upgraded proof is committed. That is inconsistent with the
agreed operating rule: test first, create and verify the proof second, and deploy only after an
explicit production decision.

After that safety change passes all local and connected pre-merge checks, the branch can be merged
to `master`. The real Sigstore identity and OTS stamp must then be created from exact `master`
bytes. Merging alone must not deploy.

## 2. Current evidence baseline

| Item | Verified state |
|---|---|
| Feature branch vs `origin/master` | `0` behind, `12` ahead |
| Working tree at review | Clean |
| Manifest schema | v2; local contract validation passes |
| Manifest SHA-256 | `a86c406e85f7cfa660e893f3344b90c861621fa67ae396c26e777c75077f00be` |
| Data version | `918a87a5dbd27e4069563f19301fc9e4cc6aa44d5251ecf50ed4b433525e0aa5` |
| Provenance commitment | 62 entries; root `7ae7c0059309237ac8a8c0fc9892448023363d6a42b3ccca2763a05f30219356` |
| Current Manifest anchor events | 0 |
| Current verifier result | `UNANCHORED`, exit 3 — expected before the connected master gate |
| Local Gate A | Passed: Python 84/84, frontend 733/733, build, lint, Manifest and anchoring golden checks |
| Pre-merge Sigstore integration | Passed on the same-repository PR; non-mutating |
| Merge to `master` | Not performed |
| Production deployment | Not performed |
| Independent Bitcoin verification | Not performed for the current v2 Manifest |

`UNANCHORED` is not a reason to restamp locally. It is the truthful state until the exact
`master` release identity exists.

## 3. Business structure and trust boundary

Phase 1 is the Borneo Tracker **D + E → B** bridge:

- **D — Data:** the exact bytes of the six published dashboard datasets;
- **E — Ethics:** provenance, confidence, fail-closed validation, explicit limitations, and a
  reproducible audit trail;
- **B — Blockchain:** an external timestamp and signer-identity witness for the Manifest bytes.

The intended users are researchers, governments, regulators/EUDR users, ESG data buyers,
investors, and reviewers who need reproducible publication evidence.

Phase 1 proves only that published bytes match a witnessed Manifest. It does **not** prove that
source values are correct and does not implement tokens, wallets, smart contracts, RWA issuance,
carbon-credit issuance, DID, or community yield. Those claims remain outside Phase 1.

The `/data-sources` route currently prioritises the integrity ledger. A full per-indicator source,
year, data-level, and confidence catalogue remains a later E-layer business improvement; it is not
a blocker for the safe anchor release.

## 4. Verified release blockers

### R1 — Proof creation automatically dispatches production deployment

`anchor.yml` dispatches `deploy-proof` immediately after it commits a new proof.
`anchor-upgrade.yml` dispatches the same event whenever a pending proof is upgraded and committed.

Impact: after the workflows are present on `master`, a manual anchor, scheduled refresh, or
scheduled proof upgrade can reach the production deploy workflow without a new explicit release
decision.

### R2 — Production has no mandatory exact proof SHA input

Manual deployment currently checks out the selected workflow ref. It does not require the operator
to provide the exact proof-bearing commit SHA.

Impact: the commit tested, approved, and deployed can differ if the branch moves.

### R3 — Production has no code-enforced confirmation

The deploy job targets the `production` GitHub environment, but repository environment approval is
external configuration and has not been evidenced. The workflow itself has no mandatory
`confirm_production` input.

Impact: the code cannot guarantee that a human deliberately approved upload.

### R4 — Missing production secrets result in a green skipped run

The current secret gate exits successfully when credentials are missing.

Impact: a green Actions result does not prove deployment prerequisites are configured.

### R5 — Dry-run is coupled to production secrets

The secret gate runs before the build/verification path. With missing hosting secrets, dry-run can
exit green without performing the intended build and release-contract checks.

Impact: the current dry-run is not reliable evidence that the release candidate is deployable.

### R6 — Public Sigstore verification command is stale

`src/pages/info/DataVerification.jsx` still displays the short relative signer-workflow path.
The verified GitHub CLI policy requires the repository-qualified workflow identity used by the
fixed Actions workflows.

Impact: a user copying the public command can receive the same identity-verification failure that
the PR workflow previously had.

### R7 — Release documentation has drifted

The implementation status still lists master synchronization as pending even though it is complete.
`DEPLOYMENT_SETUP.md` describes older `workflow_run`/`push` triggers that are not the current
release topology.

Impact: an operator can follow an obsolete sequence and misread a skipped run as release readiness.

## 5. Correct implementation and release sequence

Each work package has one outcome, an exact edit location, an acceptance gate, and a defined next
step. Do not start a later external operation while an earlier gate is incomplete.

### SR-01 — Decouple proof creation from production upload

**What:** make anchor and upgrade proof-only operations.
**Where:** `.github/workflows/anchor.yml`, `.github/workflows/anchor-upgrade.yml`.
**Work:**

1. Remove the automatic `deploy-proof` dispatch from the initial anchor workflow.
2. Remove the automatic `deploy-proof` dispatch from the scheduled upgrade workflow.
3. Keep committing the exact versioned Manifest/proof, latest proof alias, and anchor event.
4. Put the resulting proof commit SHA and verification state in the workflow summary.
5. Do not add another automatic path from refresh, catch-up, or upgrade to production.

**Acceptance:** static tests prove that neither anchor nor upgrade can invoke the production deploy
workflow. A successful anchor ends with a proof commit and release evidence, not an upload.

**Next:** SR-02.

### SR-02 — Make production deployment manual and exact-SHA only

**What:** require an explicit operator decision for every production upload.
**Where:** `.github/workflows/deploy.yml`.
**Work:**

1. Disable/remove the `repository_dispatch: deploy-proof` production entry for the Phase 1 first
   release.
2. Keep `workflow_dispatch` and replace ambiguous booleans with a clear mode or validate the
   existing inputs strictly.
3. Add `proof_commit_sha`; require a full 40-character lowercase Git commit SHA for dry-run and
   production deploy modes.
4. Add `confirm_production`, default `false`; real upload requires it to be exactly `true`.
5. Fetch `origin/master`, prove the requested commit exists, and prove it is an ancestor of the
   current `origin/master` before checkout.
6. Checkout only the requested SHA; never deploy a moving branch tip.
7. Validate that the requested commit contains the current Manifest, event log, latest proof alias,
   and the matching full-SHA versioned Manifest/proof pair.
8. Treat the GitHub `production` environment approval as a recommended second guard, not as a
   substitute for the code-enforced confirmation.

**Acceptance:** production upload is unreachable without an exact proof SHA and explicit
confirmation. Anchor, refresh, upgrade, push, and schedule cannot start it.

**Next:** SR-03.

### SR-03 — Separate dry-run, connection test, and production failure semantics

**What:** make each deployment mode prove one thing and nothing more.
**Where:** `.github/workflows/deploy.yml`, `tests/test_deploy_workflow_contract.py`.
**Work:**

1. `dry_run`: validate exact release SHA, install dependencies, validate data/proof contract,
   build, and run pre-upload assertions; do not require hosting secrets and make zero network
   connections to the server.
2. `connection_test_only`: require hosting credentials, authenticate, verify certificate/host key,
   enter the configured remote directory, and list it; do not build, write, upload, delete, or smoke.
3. `production`: require all hosting and production-build secrets. Missing prerequisites must fail
   red with names only; never print secret values.
4. Preserve non-destructive upload and strict TLS defaults.

**Acceptance:** tests prove dry-run cannot reach transport, connection test cannot write, and a
production request with missing prerequisites cannot succeed green.

**Next:** SR-04.

### SR-04 — Expand safety contract tests

**What:** prevent regression of the release boundary.
**Where:** `tests/test_workflow_contract.py`, `tests/test_deploy_workflow_contract.py`, and focused
fixtures where needed.
**Required tests:**

- anchor and upgrade contain no deploy dispatch;
- production is manual-only;
- production requires exact proof SHA and explicit confirmation;
- requested SHA must belong to `origin/master`;
- dry-run works without hosting secrets and never connects;
- connection test is read-only and never uploads/smokes;
- missing production secrets fail;
- proof contract is checked before upload;
- existing exact-SHA anchor, concurrency, path, and no-downgrade tests remain green.

**Acceptance:** targeted workflow tests and the complete Python suite pass.

**Next:** SR-05.

### SR-05 — Correct public verification and release documentation

**What:** make the UI and operator instructions match the code.
**Where:**

- `src/pages/info/DataVerification.jsx`;
- `docs/BLOCKCHAIN_PHASE1_IMPLEMENTATION_STATUS_2026-08-09.md`;
- `docs/DEPLOYMENT_SETUP.md`;
- `docs/BLOCKCHAIN_ANCHORING_SPEC.md` if release wording changes;
- this plan and the historical completion plan only where status clarification is needed.

**Work:**

1. Display the repository-qualified signer workflow in the Sigstore command:
   `angelyong/Borneo_Tracker/.github/workflows/anchor.yml`.
2. Record that master sync and pre-merge Sigstore integration have completed.
3. Record that the current v2 Manifest is still unanchored and not deployed.
4. Replace obsolete deployment triggers/instructions with manual exact-proof-SHA operation.
5. State clearly that green dry-run, connection, anchor, and deployment checks prove different
   things.
6. Preserve the historical-v1 caveat: migrated Manifest/proof pairs are not a claim that every old
   ledger root can be independently reconstructed from the reconciled current ledger.

**Acceptance:** no public or operator-facing command uses the obsolete short identity or obsolete
automatic-deploy sequence.

**Next:** SR-06.

### SR-06 — Re-run the complete pre-merge gates

**What:** prove the safety changes did not regress Phase 1.
**Where:** feature branch and its existing PR.
**Required checks:**

1. clean Node 22/npm 10 install and lockfile consistency;
2. dependency audits;
3. complete Python tests;
4. complete frontend tests;
5. integrity hook/scope tests;
6. lint and production build;
7. Manifest/provenance verification;
8. anchoring golden tests;
9. workflow YAML parse and release-contract tests;
10. current verifier remains truthfully `UNANCHORED` before the master gate;
11. same-repository PR Sigstore integration passes again;
12. working tree is clean after checks.

**Acceptance:** Gate A remains green and the non-mutating connected Sigstore gate is green.

**Next:** SR-07.

### SR-07 — Reconfirm synchronization and merge to master

**What:** establish the trusted release identity without deploying.
**Where:** Git and the existing PR.
**Work:**

1. Fetch `origin/master` immediately before merge.
2. If feature is still zero commits behind, preserve the current Manifest bytes.
3. If master moved, synchronize safely, regenerate/validate the final Manifest only when the exact
   merged data changed, and repeat SR-06.
4. Merge the feature branch to `master` only after SR-01 through SR-06 pass.
5. Confirm no production deployment run was started by the merge.

**Acceptance:** release code exists on `master`; production is unchanged; exact master SHA is
recorded.

**Next:** SR-08.

### SR-08 — Create the real master Sigstore + OTS proof

**What:** anchor the exact final master Manifest without deploying.
**Where:** GitHub Actions `Anchor published data` on `master`.
**Work:**

1. Manually run the anchor workflow for the exact current master SHA.
2. Verify repository, signer workflow, `refs/heads/master`, and source digest with
   `gh attestation verify`.
3. Submit the exact Manifest digest to OTS calendars.
4. Commit the versioned Manifest/proof, latest proof alias, and witness events.
5. Retain Manifest SHA, data commit SHA, signer source SHA, Sigstore attestation ID/URL, proof
   SHA-256, proof commit SHA, workflow run URL, and date in the run summary/release evidence.
6. Confirm production did not run.

**Acceptance:** `verify_anchor.py --allow-pending` passes for the exact proof-bearing commit;
the proof subject equals the Manifest SHA; Sigstore identity policy passes; production is unchanged.

**Next:** SR-09.

### SR-09 — Upgrade and independently verify Bitcoin inclusion

**What:** turn the calendar promise into independently checked Bitcoin evidence.
**Where:** `anchor-upgrade.yml`, official OpenTimestamps browser verifier or an official client
backed by maintained Bitcoin Core.
**Work:**

1. Allow the scheduled/manual upgrade workflow to strengthen the proof without deploying.
2. Confirm proof SHA before/after and no witness downgrade.
3. Independently verify the exact versioned `manifest.json` / `manifest.json.ots` pair.
4. Record verifier method/version, result, block height(s), date, Manifest SHA, proof SHA, and run
   URL as durable release evidence.

**Acceptance:** independent tooling validates Bitcoin inclusion for the exact Manifest pair.

**Next:** SR-10.

### SR-10 — Prove deployment prerequisites without uploading

**What:** validate the release candidate and hosting path safely.
**Where:** manual `Deploy to DirectAdmin` workflow.
**Work:**

1. Run `dry_run` against the exact confirmed-proof commit SHA.
2. Run `connection_test_only`; verify authentication, TLS/host key, and the exact remote directory.
3. Confirm production secrets/variables, Supabase production configuration, strict TLS, remote path,
   non-destructive mirror behavior, and production environment protection.
4. Stop if either mode fails; do not convert a diagnostic override into routine configuration.

**Acceptance:** dry-run proves build/release contract; connection test proves read-only hosting
access; neither changes production.

**Next:** SR-11.

### SR-11 — Explicit production deployment and smoke verification

**What:** deploy only the independently verified proof commit.
**Where:** manual `Deploy to DirectAdmin` workflow and the public production URL.
**Work:**

1. Enter the exact proof commit SHA.
2. Set `confirm_production=true` deliberately.
3. Upload non-destructively.
4. Download and hash all six datasets, current Manifest/proof/event files, and the matching
   full-SHA versioned Manifest/proof pair.
5. Reject HTML SPA fallback at every data/proof URL.
6. Verify UI states and public independent-verification commands.
7. Record production URL, deployed SHA, run URL, smoke results, and rollback point.

**Acceptance:** production bytes match the exact proof commit, all proof assets are publicly
downloadable with correct content types, and the UI makes no claim beyond the verified boundary.

**Next:** Phase 1 operational handoff.

## 6. Stop/go gates

| Gate | Go condition | Stop condition |
|---|---|---|
| Before merge | SR-01–SR-06 all green; feature zero behind master | Any automatic deploy path, ambiguous SHA, stale Manifest, or red test |
| After merge, before anchor | Exact master SHA recorded; production unchanged | Merge unexpectedly starts deploy or master moves before anchor |
| After anchor, before upgrade | Sigstore identity passes; OTS proof binds exact Manifest; no deploy | Wrong subject/ref/workflow, orphan proof, or production run |
| Before deployment preflight | Independent Bitcoin verification evidence retained | Only a parsed block-height claim or self-hosted status exists |
| Before production upload | Exact proof SHA dry-run and connection test pass; explicit approval | Missing secrets, unsafe TLS, wrong remote path, moving branch ref |
| After production upload | All remote byte/proof/UI smoke checks pass | Any mismatch, SPA fallback, missing proof pair, or overclaiming UI |

## 7. Definition of Phase 1 complete

Phase 1 is complete only when all of the following are true:

- local Gate A remains green;
- pre-merge Sigstore integration is green;
- exact master Manifest has a verified Sigstore attestation;
- exact Manifest has a versioned OTS proof and independent Bitcoin inclusion evidence;
- proof creation cannot automatically deploy;
- production deployment requires exact SHA and explicit confirmation;
- deployment prerequisites pass without changing production;
- production serves the exact six data files and complete current/versioned proof surface;
- public UI and documentation accurately state what was and was not proven;
- retained evidence identifies data SHA, Manifest SHA, proof SHA, proof commit SHA, signer identity,
  verifier result, workflow runs, production SHA, and dates.

Completing this definition delivers the attestation/trust sub-capability of B. It does not complete
the wider Blockchain roadmap.

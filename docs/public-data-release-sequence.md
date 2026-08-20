# Public Data Release Sequence

BT-28 defines the release contract for changes that regenerate `public/data`.
It protects the Data and Ethics layers of Borneo Tracker: the dashboard may only
ship numbers that match a committed manifest and a proof-bearing release commit.

## Scope

This runbook applies to data-side cards that change ingestion, scoring inputs,
schema, metadata, manifest scope, or any code path that can regenerate
`public/data`. It specifically applies to BT-11a, BT-16a, and BT-18.

Do not use this sequence to claim that production was deployed or verified. A
production claim requires a completed deploy workflow and live-byte smoke test
for the exact proof commit.

## Why feature PRs must be code-only

The repository treats the Phase-1 public data bundle as a proofed release, not
as ordinary review noise. `manifest_contract.py` declares the six manifest
datasets:

1. `public/data/indicators.json`
2. `public/data/resilience.json`
3. `public/data/resilience_model.json`
4. `public/data/districts.json`
5. `public/data/borneo_districts.geojson`
6. `public/data/brunei.geojson`

When a pull request touches `public/data/**`,
`.github/workflows/deployment-pr-validation.yml` runs the deployment contract
gate: `validate_data.py`, `verify_manifest.py verify public/data`,
`verify_proof_contract.py public/data`, `verify_anchor.py --allow-pending`,
`npm run lint`, and `npm run build`.

Directly committing regenerated data artifacts in a feature PR is unsafe because
the proof for those exact bytes can only be produced after they are committed on
`master` by the trusted publication workflows. Common unsafe states are:

- Data changes without a matching manifest fail manifest hash or byte-count
  verification.
- A regenerated manifest without a matching versioned manifest/proof fails the
  proof contract.
- New manifest paths fail unless every verifier, deploy assertion, integrity UI,
  and proof workflow is updated together.
- A feature branch cannot truthfully contain a final proof that is created by
  `anchor.yml` on `master` after the data commit exists.

Therefore a feature PR should contain pipeline, validation, tests, and
documentation changes only. Do not commit regenerated `public/data` artifacts in
the feature PR unless the repo owner explicitly chooses and documents a different
proof workflow.

## Required sequence

1. Open the feature PR with code, tests, and documentation only. Do not commit
   regenerated `public/data/*.json`, GeoJSON, manifest, provenance, anchor log,
   `.ots`, or versioned proof files.
2. Merge the approved code changes to `master`.
3. Let `.github/workflows/refresh-data.yml` run on `master` by schedule
   (`0 21 * * *`, 05:00 MYT) or by an owner-triggered manual run. This workflow
   runs `run_pipeline.py`, validates with `validate_data.py --baseline-ref
   "${{ github.sha }}" --require-baseline`, commits changed data artifacts,
   `public/data/manifest.json`, and `public/data/provenance.jsonl`, then
   dispatches `anchor-manifest`.
4. Let `.github/workflows/anchor.yml` anchor the exact data commit. It resolves
   the manifest on `master`, validates it with `manifest_contract.py`, creates
   the Sigstore attestation, stamps the manifest with OpenTimestamps, verifies
   the local proof binding, and commits `public/data/anchors.jsonl`,
   `public/data/manifest.json.ots`, and `public/data/versions/<manifest-sha>/`.
5. Deploy only from the proof-bearing commit SHA. `.github/workflows/deploy.yml`
   requires an exact 40-character `proof_commit_sha`, checks that the commit is
   on `master`, validates data, verifies the proof contract, builds the site, and
   smoke-tests production only in production mode.
6. If `AUTO_PRODUCTION_DEPLOY` is exactly `true`, `anchor.yml` dispatches
   `deploy-proof` for the exact proof commit and `deploy.yml` may run an
   automatic production deployment. If it is not exactly `true`, no automatic
   production deployment occurs; the owner must manually run `Deploy to
   DirectAdmin` in production mode with the exact proof commit SHA and
   `confirm_production=true`.

## AUTO_PRODUCTION_DEPLOY status

Committed repo evidence does not expose the live repository variable value.
The actual status is therefore **unknown** until the repo owner confirms it in
GitHub repository variables.

What the committed files do show:

- `docs/DEPLOYMENT_SETUP.md` documents `AUTO_PRODUCTION_DEPLOY` with default
  `false` and says it should be set to `true` only after cache readiness is
  verified.
- `anchor.yml` dispatches automatic deployment only when
  `vars.AUTO_PRODUCTION_DEPLOY == 'true'`.
- `deploy.yml` rejects repository-dispatch production deployment unless
  `AUTO_PRODUCTION_DEPLOY` is exactly `true`; otherwise the run fails before any
  upload.

Repo owner confirmation required: record whether the repository variable is
currently `true` or absent/false, and retain the evidence before assuming a
post-anchor deployment will reach production.

## Data-card checklist

Use this checklist for BT-11a, BT-16a, BT-18, and any future card that can
regenerate `public/data`.

- Feature PR contains pipeline/code/tests/docs only.
- No regenerated `public/data` artifacts, manifest, provenance, anchor log, OTS
  proof, or versioned proof files are committed in the feature PR.
- Manifest scope changes are explicitly reviewed against
  `manifest_contract.py`, `verify_manifest.py`, `verify_proof_contract.py`,
  `verify_anchor.py`, `deploy.yml`, and the frontend integrity UI before merge.
- Merge happens before artifact generation.
- `refresh-data.yml` regenerates and commits artifacts from `master`.
- `anchor.yml` creates and commits the proof for the new data version.
- Deployment uses the exact proof commit SHA, automatically only if
  `AUTO_PRODUCTION_DEPLOY=true`, otherwise manually by the repo owner.
- Release notes record the data commit SHA, proof commit SHA, manifest SHA,
  anchor run URL, deploy run URL if any, and whether production verification was
  actually performed.

## User-facing data gates

BT-07 and BT-17 must not ship user-facing numbers from stale pre-refresh
`public/data` artifacts. They remain blocked until the post-BT-11a
`public/data/resilience.json` is active in the workspace or in the proof-bearing
production release being referenced.

Before number-driven copy ships after BT-11a, verify all of the following from
the active `public/data/resilience.json` and UI disclosure work:

- Sabah includes Education as a scored pillar.
- Sarawak includes Education as a scored pillar.
- 4/4 territories have 6 scored pillars.
- Sabah no longer shows the old inflated `72.1` green story.
- The all-Borneo coverage disclosure from BT-32 is present before copy relies on
  the all-Borneo headline number.

If any check fails, treat the active artifact as stale or incomplete and do not
ship BT-07 or BT-17 number-driven copy.

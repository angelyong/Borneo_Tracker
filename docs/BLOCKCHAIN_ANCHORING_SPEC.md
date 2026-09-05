# Blockchain Phase 1 — OTS Evidence Contract

Phase 1 is the bounded `D + E → B` bridge: publish dataset bytes with provenance,
timestamp the exact Manifest bytes through OpenTimestamps, and make verification
limits explicit. It serves researchers, regulators and ESG-data customers who
need reproducible publication evidence. It does not implement tokens, wallets,
smart contracts, RWA/carbon-credit issuance, DID, self-sovereign data, or
community yield.

## Published contract

`manifest.json` is schema v2 and declares exactly these live dashboard inputs:

1. `indicators.json`
2. `resilience.json`
3. `resilience_model.json`
4. `districts.json`
5. `borneo_districts.geojson`
6. `brunei.geojson`

It contains canonical `dataVersion` plus a RFC6962 SHA-256 commitment to a
specific `provenance.jsonl` prefix. Every schema-v2 stamp preserves the exact
bytes at `public/data/versions/<full-manifest-sha256>/manifest.json`; its OTS
proof is the paired `manifest.json.ots`. The latest aliases are convenience
links only. Proof bytes may move monotonically pending → stronger proof; the
Manifest snapshot never changes.

This list is **frozen**. Widening it would invalidate every Manifest already
anchored, because `validate_manifest` requires the file set to match exactly;
`build_resilience_history.py` therefore states that auxiliary outputs must never
be added to it.

Auxiliary published files — `resilience_history.json` and `sources.json`
(`manifest_contract.AUXILIARY_PATHS`) — are covered through the ledger instead.
Each publication records them as additional `provenance.jsonl` rows inside the
prefix the Manifest commits to, so the same OTS proof anchors them, with no
schema change and no break to historical verification. `verify_anchor.py` checks
them against the newest recorded batch; a prefix that names none (every
publication before 2026-09-05) verifies exactly as it always did. The scope is
the newest batch rather than all history so that withdrawing an auxiliary stays
expressible. `dataVersion` is still derived from the six alone, so an
auxiliary-only change publishes a new Manifest under the same `dataVersion`.

`anchors.jsonl` is append-only witness discovery metadata. It is not an
independent witness and must never be treated as Bitcoin verification. OTS and
Sigstore events reduce independently; a later OTS update cannot remove
Sigstore, and `--force` is prohibited.

## Verification boundary

The browser verifies only: **published files match the downloaded Manifest**.
It marks malformed metadata, unknown schema/events, unsafe paths, missing
required entries and zero-file scopes invalid. It does not verify Bitcoin,
Sigstore identity, history governance, or source-number correctness.

`verify_anchor.py` checks binding and proof format. It returns
`VERIFIED_CONFIRMED` only when invoked with `--verify-bitcoin-core` and the
official `ots verify` command succeeds against configured Bitcoin Core. A
Bitcoin-height claim in an OTS structure or a `confirmed` field in
`anchors.jsonl` is only pending/recorded evidence.

For Sigstore, use a connected release check such as:

```sh
gh attestation verify manifest.json --repo angelyong/Borneo_Tracker \
  --signer-workflow angelyong/Borneo_Tracker/.github/workflows/anchor.yml \
  --source-ref refs/heads/master
```

The witness event records the bundle digest and any action-provided attestation
ID/URL for discovery; that is not signature verification.

## Publication flow and gates

`refresh (exact data SHA) → anchor (exact SHA) → proof commit SHA → deploy
(exact proof SHA)`. Proof creation never uploads production content itself. When the
repository variable `AUTO_PRODUCTION_DEPLOY=true`, anchor and proof-upgrade workflows dispatch
the exact current-master proof commit to the separate deployment workflow; otherwise deployment
remains manual. Manual dry-run and read-only connection test remain required before enabling the
automatic switch, while manual production runs still require `confirm_production=true`. The
Actions workflows share `phase1-publication` concurrency and never cancel an in-flight
publication or deployment. Automatic dispatches are accepted only when the event sender is the
GitHub Actions bot and the current-master commit has the exact bot identity, subject and proof-only
path set produced by `anchor.yml` or `anchor-upgrade.yml`. The deploy workflow rechecks current
master immediately before upload. The catch-up scanner only identifies
committed version snapshots with no OTS event and dispatches each with both its
Git commit SHA and Manifest SHA; the anchor workflow stamps that exact version,
never an arbitrary branch tip. GitHub Actions `queue: max` retains up to 100
pending runs; the catch-up scheduler is still required after capacity overflow
or interrupted dispatches.

Deploy verifies the six Manifest datasets, the current aliases, anchor log and
the matching full-SHA versioned Manifest/proof pair; HTML SPA fallbacks are
rejected.

## Migration and current repository condition

The migration tool recovers the three known v1 Manifest blobs from the recorded
Git commits, validates each SHA-256 and OTS proof subject, creates immutable
version pairs, and is idempotent. A v1 current Manifest is a migration input,
not malformed v2.

The former merge-marker conflict in `public/data/provenance.jsonl` was reconciled
under the authorised record in
`docs/PROVENANCE_LEDGER_RECONCILIATION_2026-08-09.md`. The current ledger has no
merge delimiters and Manifest v2 validation passes locally. That reconciliation
does **not** create an external witness. That was the pre-release state; the connected master
gate has since created the current proof, and the official OpenTimestamps browser verifier bound
Manifest `bda87804…b2b8e` to Bitcoin block `961779` on 2026-08-10. The repository verifier still
reports only what it can prove without independently validating Bitcoin headers.

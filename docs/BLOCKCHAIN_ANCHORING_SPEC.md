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
  --signer-workflow .github/workflows/anchor.yml --source-ref refs/heads/master
```

The witness event records the bundle digest and any action-provided attestation
ID/URL for discovery; that is not signature verification.

## Publication flow and gates

`refresh (exact data SHA) → anchor (exact SHA) → proof commit SHA → deploy
(exact proof SHA)`. The Actions workflows share `phase1-publication` concurrency
and never cancel an in-flight publication. The catch-up scanner only identifies
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
does **not** create an external witness: the current v2 Manifest remains
`UNANCHORED` until the connected release gate succeeds.

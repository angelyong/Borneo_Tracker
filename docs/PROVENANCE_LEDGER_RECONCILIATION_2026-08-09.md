# Provenance Ledger Reconciliation — 2026-08-09

## Decision

The unresolved merge markers in `public/data/provenance.jsonl` from merge commit
`c4ac92c9543a9014b1118291e12ddd76092c0744` have been reconciled using exact Git
object bytes, not branch preference. This is a one-time repair of an unanchored v1
ledger before Manifest v2 begins committing ledger prefixes.

## Retained records

1. The three first-parent/HEAD records from GitHub Actions commit
   `fdc2e254702aa76f0f1510039d41d65b3714ce03` (run `31051931416`) are retained.
   Their hashes and sizes equal the actual files in that commit.
2. One complete four-file batch from `impactSimulator` commit
   `99a6f4a43a3dee16a25c43a0033b85052b333a7e` is retained at timestamp
   `2026-08-06T16:05:43Z`. It equals that commit's Manifest and exact file bytes,
   including the newly introduced `resilience_model.json`.

## Removed conflict material

The merge delimiters and the other nine repetitions of the same four impact-simulator
file hashes are removed. They do not describe distinct byte versions. The original
material remains recoverable from the merge commit and its second parent in Git:

```text
git show c4ac92c9^2:public/data/provenance.jsonl
```

## Corrected historical assertion

The scheduled-refresh record at `2026-08-07T01:26:15Z` previously asserted that
`resilience_model.json` had SHA-256 `f9ba...` and 14,684 bytes. Exact Git bytes in
commit `a9e18b1449222109baf020115c5ed7f4d26aaebb` prove the committed file instead
has SHA-256 `939cbc1b2be8b9840a9a867602651987f38159642150618f52f5faebcdd8196b`
and 14,788 bytes. The ledger is corrected to that verified value.

## Scope and ethics boundary

This reconciliation makes no claim that the source values themselves are correct.
It establishes only that the published byte-history used for Phase 1 is internally
consistent and reproducible. Manifest v2 then commits this repaired ledger prefix;
OTS/Sigstore remain separate external-witness steps.

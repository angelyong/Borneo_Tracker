# Blockchain Anchoring — Build & Integration Spec

> **Handoff doc.** The **Blockchain workstream owns this**. **Base off `master`** (it already
> has Phase 0 + the provenance ledger + the loop fixes). **Date:** 2026-08-01.
>
> **⛔ SCOPE LINE — READ FIRST.** This is the **honest, bounded FIRST step of ABCDE's `B`**:
> anchor the data-provenance ledger on-chain so anyone can verify the published data was not
> tampered with. It is **NOT** tokenisation / RWA / carbon-credit issuance / self-sovereign
> data / community-yield. That endgame is premature, and **faking `B` in a read-only dashboard
> in front of an author-supervisor is the credibility trap the framework explicitly warns
> about.** Narrate the endgame as *horizon*; build only the anchoring.

---

## 0. What / why (ABCDE)

The framework's value chain: **measure (D) → trustworthy *without institutions* (E → B)** →
*[horizon: price/tokenise the real assets (B) → yield to the community]*.

This step is the **E → B bridge**: the sha256 provenance hashes we already publish become
**on-chain-verifiable**, so trust in the data stops depending on trusting *us*. It is the
**first real `B`** (from 0%) — and in front of the supervisor who wrote the ABCDE book, one
REAL small `B` is worth more than a faked big one.

---

## 1. Architecture (the picture)

```mermaid
flowchart LR
  RP["run_pipeline.py<br/>(daily refresh)"] --> EM["emit_manifest.py"]
  EM -->|append-only| PROV[("provenance.jsonl<br/>{ts,runId,file,sha256,bytes,generatedAt}")]
  EM --> MAN[("manifest.json")]
  PROV --> ANCH["anchor_provenance.py<br/>(NEW — Merkle root / OTS stamp)"]
  MAN --> ANCH
  ANCH -->|notarise| CHAIN["Bitcoin (OpenTimestamps)<br/>or L2/testnet contract"]
  ANCH -->|append proof| ANCHORS[("anchors.jsonl (NEW)")]
  ANCHORS --> UI["/data-sources page<br/>'verify integrity on-chain'"]
  CHAIN -. verify .-> UI
```

Text: the pipeline already writes an **append-only hash ledger**; the new anchor step notarises
those hashes (or a Merkle root of them) on a public chain and records the proof; the
`/data-sources` page exposes a **verify-on-chain** surface.

---

## 2. The seam that ALREADY exists (build on this — do NOT rebuild it)

Phase 0 built the ledger **specifically as the blockchain-anchoring seam** (see the
`emit_manifest.py` docstring, "AUDIT TRAIL / BLOCKCHAIN SEAM, ABCDE letter B"):

- **`public/data/provenance.jsonl`** — append-only, **ONE JSON line per file per pipeline run**:
  `{ts, runId, file, sha256, bytes, generatedAt}`. Written by `emit_manifest.py`, **only ever
  appended, never rewritten**.
- **`public/data/manifest.json`** — current snapshot:
  `{generatedAt, runId, files:{"<repo-relative path>":{sha256, bytes, generatedAt}}}`.
- The sha256 is of the **file bytes on disk** (streamed) — not embedded in the file it describes.

**Rules already enforced — anchoring DEPENDS on them, do not break:**
> Never truncate, reorder or rewrite `provenance.jsonl`; **only append**. Only **ADD** fields to
> a line — never rename or remove one. (A rewritten log invalidates every anchor over it.)

The daily refresh appends to the ledger and regenerates the manifest. **Your work sits on top.**

---

## 3. The anchoring design

Anchor either each run's per-file hashes, or — better — a **Merkle root** over the run's
provenance entries, so **one on-chain write covers all files** of that version.

Two honest, low-cost options — pick by goal:

- **A. OpenTimestamps** *(recommended for "cheapest + honest + no keys")* — timestamp
  `manifest.json` (or the Merkle root) → get a `.ots` proof → verifiable against **Bitcoin**.
  **Free, no wallet / gas / private keys, decentralised.** Simplest and most defensible; the
  proof is a small file you commit.
- **B. Merkle root → smart contract on an L2 / testnet** *(recommended if you want a VISIBLE
  on-chain tx to demo)* — compute the Merkle root → submit to a tiny contract → store the
  `txid` + chain. More "blockchain-looking" (a contract and a transaction to point at), but
  needs a wallet/key/gas and a chain choice. **If you use real keys, generate them OUTSIDE the
  repo and store them as GitHub Actions secrets — never `git add` a private key.**

**Record every anchor in a new append-only file** `public/data/anchors.jsonl`, e.g.:
`{ts, method:"ots"|"chain", target:"manifest"|"merkle_root", root_or_hash, proof_ref, chain, txid?}`.
Same append-only discipline as `provenance.jsonl`.

---

## 4. The verify surface — pair it with `/data-sources`

- Expose verification on the **`/data-sources`** page. It is a **placeholder today**; the real
  transparency page (per-indicator source / year / confidence) lives on
  **`feature/figma-redesign` (`DataSources.jsx`)** — **port it**, then add a
  **"verify data integrity on-chain"** panel: each data file's sha256, when/how it was anchored,
  and a documented one-click way to verify against the chain (OTS verify, or the tx on a block
  explorer).
- Honest wording: **"data integrity anchored on-chain"** — NOT "decentralised ownership" /
  "tokenised" / "self-sovereign."

---

## 5. ABCDE framing + the HARD LINE

- ✅ **Do:** anchor provenance, provide verification, narrate as a *tamper-proof,
  institution-independent audit trail* = a real, honest `B`.
- 🚫 **Do NOT (this build):** tokens, RWA, carbon-credit issuance, self-sovereign / DID data,
  community-yield. Those are the **endgame** — narrate as horizon, never claim as built. Faking
  them is the credibility trap. `B` is still ~0%; this step is what honestly moves it off zero.

---

## 6. Build checklist (in order)

1. [ ] Decide method — **OpenTimestamps** (no keys) vs **Merkle-root → L2/testnet** (visible tx).
2. [ ] `anchor_provenance.py` — read `provenance.jsonl` / `manifest.json` → per-file hashes or a
       Merkle root → anchor (OTS stamp / chain tx) → **append** the proof to `public/data/anchors.jsonl`.
3. [ ] `.github/workflows/anchor.yml` — run **after** "Refresh dashboard data" (`workflow_run`,
       `branches: [master]`), same pattern as `resilience-watch.yml` / `deploy.yml`. Daily or weekly.
4. [ ] `verify_anchor.py` + the `/data-sources` panel — given a served data file, recompute its
       hash and verify it against the recorded anchor/proof.
5. [ ] Honest labels; if you must touch `emit_manifest.py`/the ledger, **add fields only**.
6. [ ] Tests + `npm run lint` + `npm run build` green → merge (one branch merges at a time).

---

## 7. Coordination / conflict-avoidance

- **Base off current `master`** (has Phase 0 + provenance ledger + Food fix + news fix +
  resilience-watch). `git merge origin/master` first if your branch is behind.
- **Files this touches:** new `anchor_provenance.py`, new `.github/workflows/anchor.yml`, new
  `public/data/anchors.jsonl`, the `/data-sources` route in `src/App.jsx` + a real DataSources
  page (ported from `feature/figma-redesign`), maybe `verify_anchor.py`.
- ⚠️ **`emit_manifest.py` / `provenance.jsonl` format is the anchoring CONTRACT** — prefer NOT to
  change it; if unavoidable, **ADD fields only** (never rename / remove / reorder) or past
  anchors break.
- ⚠️ **`src/App.jsx`** — additive route only; `/data-sources` real page is on
  `feature/figma-redesign` — expect a small port + merge.
- Does **NOT** need `compute_resilience.py` / `run_pipeline.py` / `resilienceModel.js` →
  **no clash with the Impact Simulator build** (aichatbot workstream).
- Anchor **after** the daily refresh (it appends provenance + regenerates the manifest first).

---

## 8. Reference facts (verified in the repo, 2026-08-01)

- **The ledger:** `emit_manifest.py` writes `public/data/manifest.json` (overwrite) +
  `public/data/provenance.jsonl` (append-only). Line schema:
  `{ts, runId, file, sha256, bytes, generatedAt}`. This is loop-engineering item **"D13"** and
  is explicitly the blockchain seam.
- **ABCDE `B` row:** "trust without institutions; tokenise Real-World Assets; self-sovereign
  data" — but **only the immutable-audit-trail / anchoring part is in scope now.**
- **Value chain + endgame warning:** `.claude/skills/borneo-abcde-framework` §2 (value chain)
  and §3 ("Faking B … is a credibility trap in front of an academic/author supervisor").
- **`/data-sources` real page:** `feature/figma-redesign` → `DataSources.jsx`.
- **Sister handoff / house style:** `docs/IMPACT_SIMULATOR_SPEC.md`, `docs/LOOP_ENGINEERING_PLAN.md`.

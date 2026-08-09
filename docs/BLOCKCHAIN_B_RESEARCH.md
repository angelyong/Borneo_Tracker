# Blockchain (`B`) — Evidence, Design Review & Decisions

> **What this is.** The reasoning and evidence behind the anchoring work.
> [`BLOCKCHAIN_ANCHORING_SPEC.md`](./BLOCKCHAIN_ANCHORING_SPEC.md) says *what to build*; this
> says *why that and not something else*, reviews the design the client sent us, and records the
> corrections this investigation turned up in our own docs.
>
> **Date:** 2026-08-09. **Branch:** `feature/blockchain-anchoring`.
> Written in English to match the sibling spec; source material is quoted verbatim.
>
> **Confidence marking.** Everything below was checked against a primary source or measured
> directly. Where it was not, it says so. Two items are explicitly flagged unverified at the end.

---

## 0. The question, and the short answer

The client pointed us at **https://odsf.edisontkp.com/** as "the kind of blockchain I expect",
and asked for `B` in the ABCDE framework.

**Answer: build the attestation, not the token.**

Publish a cryptographic fingerprint of every dataset we release, anchor it on a public chain, and
let anyone recompute it themselves. In the UI this is called **"Verify"**, not "Blockchain".

That is the only form of `B` that is simultaneously (a) real, (b) free, (c) has a production
precedent, and (d) will not embarrass us in front of a supervisor who has written two books on
blockchain. The maximalist form he describes in his own book — tokenising real-world assets — has
been tried at scale and has failed; §3 is the evidence.

**One line to keep hold of:** a hash proves the *bytes have not changed*. It does not prove the
*numbers are correct*. Every design decision below follows from taking that distinction seriously.

---

## 1. What the client's reference site actually is

`odsf.edisontkp.com` is **not a product and not a specification.** It is a live dashboard attached
to a research paper — "Open Digital Synthetics Framework · Live Monitor", subtitled *ASEAN Digital
FDI & Supply-Chain Resilience*, bylined "EdisonTKP Research". Its own top banner reads
*"For Research Purposes Only — Not yet verified or acknowledged by any authority."*

Three research questions; **RQ2** is the blockchain one:

> *"How do anchor firms use **blockchain provenance** to integrate local SMEs into green GVCs?"*

**The entire blockchain content of the site is one tile** — "Blockchain / BaaS Adoption", sourced
from **Hyperledger Fabric's GitHub star and fork counts**, described in its own data matrix as
"Enterprise ledger open-source integration & BaaS growth". The site's own triangulation matrix
grades that evidence `partial`.

### What an undocumented endpoint reveals

The site exposes `/api/health` (not linked from the page). Its run log, verbatim:

| metric | ok | detail |
|---|---|---|
| `gh` (the blockchain tile) | 0 | `gh 403` |
| `mpc` | 1 | `matched=8` |
| `depa` | 0 | `reachable; count maintained manually` |
| `sme` | 0 | `no OSHUB_TOKEN` |
| `lat` | 0 | `reachable; awaiting dataset file URL` |
| `fdi` | 0 | `reachable; awaiting verified data query` |

**One of six tiles actually fetches anything.** The four World Bank series have never completed a
query; their values are baked into the Worker. The API returns `status:"error"` for several, and
the UI renders `SCHEDULED` regardless — the status field is never read.

The blockchain tile's rising trend line is manufactured, not observed. From the page source:

```js
// small live-ish sparkline anchored on current stars
const s = j.stargazers_count;
sparkline('sp-gh', [s-260, s-210, s-170, s-120, s-90, s-55, s-20, s], '#37d39b');
```

"live-ish" is the author's own comment. The offline path invents both the value (`'15,300'`) and
the history outright.

Separately: **"Open Digital Synthetics Framework" has zero exact-phrase hits anywhere on the public
web**, zero GitHub results, and does not appear in the author's own 188 repositories. Nothing on
the site is "synthetic" in any technical sense — the word appears once, inside the framework's name.

**Conclusion.** Treat ODSF as a peer's work in progress, not a requirement to match. **Do not copy
its patterns** — in particular, never render a green state over a failed fetch, and never draw a
trend line we did not measure. Our differentiator is not "a better tile"; it is that ours is real.

---

## 2. What `B` means to the framework's author

This matters more than ODSF, because the framework is the grading rubric.

**From the book's own description** (*The ABCDE Framework in The True Wealth Hexagon*,
KOH HOW TZE, published 2026-06-09, Amazon `B0H4M9QCGB`):

> **"[B] Blockchain: The immutable backbone of trust, enabling cryptographic truth and the
> tokenization of Real-World Assets (RWAs)."**

**From "The Borneo Thesis" (bsyssolution.com, 2026-06-12):**

> **"[B] Blockchain (The Trust Layer): Providing immutable security. By tokenizing Real-World
> Assets (RWAs), we turn physical infrastructure into liquid digital assets, governed by smart
> contracts rather than centralized gatekeepers."**

> Borneo is *"the world's premier sandbox for blockchain orchestration, digital asset clarity, and
> asset-backed fintech."*

Three consequences for how we build:

1. **His `B` is tokenisation, not audit logging.** His 2025 articles reduced `B` to "tamper-proof
   transparency"; the June 2026 book escalated to RWA tokenisation. Build against the 2026 version.
2. **It is explicitly anti-institutional** — "rather than centralized gatekeepers", "replaces
   institutional trust with cryptographic truth", "removing the middleman". **This rules out a
   permissioned/consortium ledger run by us, a government or an NGO.** A design that requires the
   dashboard operator to hold a key and keep paying is the thing his framing rejects.
3. **Self-sovereign data is his `D`, not his `B`.** His own split: `D` = *"data remains with the
   community, generating financial yields directly for those who produce it"*; `E` = ethics in code,
   *"protecting decentralized governance (DAOs)"*. See §9 — our skill file has this misfiled.

**Not found anywhere in his writing:** Hyperledger, Fabric, "permissioned", "consortium chain",
DIDs, Verifiable Credentials, or any named chain. The only token instrument he names is the
**JMYR/RMJDT** ringgit stablecoin, in a Johor–Singapore SEZ deck.

**On the ODSF connection:** the public record shows **no link** between EdisonTKP (Kuala Lumpur
full-stack/blockchain consultant, ex-Meyzer Group, HRDF-certified trainer) and BSYS Solution or
Koh How Tze — zero cross-references on either site. But the ODSF page's own manuscript tracker
contains a section titled **"Policy recommendations (ABCDE) — 25%"**, so a working relationship
plainly exists; it is simply not documented publicly.

**EdisonTKP's actual stack is Ethereum, not Hyperledger.** His services page offers
*"Smart contract development, ERC20/NFT deployment, DApp architecture, and Web3 integration"*; he
has authored an EIP (`erc-8888`) and forked the Ethereum `EIPs`/`ERCs` spec repos; his training
course covers *"Solidity, smart contracts, DeFi, and tokenisation"*. His three Hyperledger repos
have been dormant since 2022/2024. Most relevant to us, his portfolio includes:

> `carbon-credit-platform` — *"Proof-of-concept platform for trading **tokenised carbon credits**
> with RFQ and Auction support. Built for **Malaysian ESG compliance market**."*

So both parties converge on the same destination — verified measurement backing tokenised
real-world assets. The Hyperledger tile is a proxy metric, not the direction.

---

## 3. Market reality — what is real and what is dead

Checked against primary regulatory texts and live on-chain data, not secondary reporting.

### 3.1 Tokenised carbon has failed commercially

| Measure | Value |
|---|---|
| BCT (Toucan Base Carbon Tonne) — price / 24h volume | **$0.00082 / $3.19** (ATH $8.60, −99.99%) |
| All listed carbon & ReFi tokens — combined 24h volume | **≈ $4,174** |
| Tokenised share of voluntary-market retirements | 8.9% (2021) → 3.0% (2022) → **0.02–0.10% (2026)** |
| BCT contract holdings | 15.7 M tonnes notional, valued by the market at **$17,235** |

**Verra banned minting tokens from retired credits in May 2022; the ban still stands** and the
promised "immobilisation" framework was never delivered. Toucan's own history page: *"We
cooperated and closed the Carbon Bridge when carbon registry Verra requested the tokenization of
their credits to be halted."*

**The registries answered the question themselves.** Verra's next-generation registry went live
**2026-07-27, built by S&P Global** — no blockchain, no tokenisation. Gold Standard's replacement
(Q4 2026) uses "cryptographically verifiable" block-signing and pointedly never says *blockchain*.
Isometric, the best-funded of the new registries, has none: credits are database rows.

**Chainlink's carbon business line is abandoned.** `chain.link/use-cases/climate-markets` returns
**404**; none of the 1,328 URLs in its sitemap is a climate/carbon use case; and its own 2024 and
2025 year-in-review posts say "carbon" **zero times**.

### 3.2 No compliance market runs on a public chain

Full-text searched; `blockchain` / `distributed ledger` / `DLT` / `token` appear **0 times** in
every one of these:

| Scheme | What the binding text actually mandates |
|---|---|
| **CORSIA** (ICAO) | CCR is *"an online web application supported by a database"*. Units must be *"issued and continually maintained on the Programme-designated Registry"* to be cancellable — which **structurally excludes bridged tokens**. |
| **Paris Art. 6.4 / PACM** | *"Take the form of a standardized electronic database … Be hosted and maintained by the secretariat"* (A6.4-PROC-REGS-001 v02.0). |
| **Paris Art. 6.2 ITMOs** | Same wording (A6.2-PROC-REGS-001 v01.0). Still at MVP in mid-2026. |
| **EU ETS Union Registry** | *"an online database"*, centralised in 2012. Its fix after the 2010–11 fraud was **2FA, transaction delays and administrator reversibility** — precisely what a permissionless chain removes. |
| **EU CRCF** | Reg (EU) 2024/3012 mandates *"automated systems, including electronic templates"* and a Union registry by **2028-12-27**. |

### 3.3 EUDR does not use blockchain

Binding dates: **2026-12-30** (all operators except most micro/small), **2027-06-30** (micro/small).
Two delays have already happened; COM(2026) 191 of 2026-05-04 explicitly declines a third.

`blockchain` appears **0 times** in Reg 2023/1115, IR 2024/3084, IR 2026/1565, Commission Guidance
C/2026/3896, and the 95-page official FAQ v5. What Art. 18(2)(c)–(d) actually names is **DNA/isotope
forensics and Copernicus Earth observation**; the evidentiary standard in Art. 9(1)(g)–(h) is
*"adequately conclusive and verifiable information"*. Filing is SOAP/XML with base64 GeoJSON.

The decisive case: vendor **Global Traceability removed blockchain and moved to SAP HANA**, because
*"sometimes you need [revisability] to make corrections in data collection"*. **Immutability is a
defect when plot polygons get re-surveyed** — and the EU system explicitly supports amending and
withdrawing due-diligence statements.

### 3.4 The one production precedent — and it is our architecture

**CAD Trust** (World Bank Climate Warehouse + IETA + Government of Singapore) runs on the **Chia**
blockchain and is active through 2026 (World Bank's CATS connected 2025-12-19).

It **does not issue or hold credits**. Each registry runs its own node and keeps its own data —
*"the actual carbon market data itself is stored locally by a member"* — and **only proofs/hashes
go on chain**, with URLs to fetch the underlying data. It is a cross-registry double-counting
detector, not a ledger of ownership.

That is exactly the shape of `provenance.jsonl` + `manifest.json`. We are one step away from it.

### 3.5 The counter-argument, stated at full strength

We should be able to answer this, not dodge it.

- **Wüst & Gervais (2018):** *"If there is no trust in the operation of these employees, then the
  whole supply chain is technically compromised… If, on the other hand, all writers are trusted, a
  blockchain is not needed."*
- **NIST (NISTIR 8202):** blockchains are *"tamper evident and tamper resistant… **cannot be
  considered completely immutable**."* → **never write "tamper-proof" or "immutable" in our UI.**
- **Powell et al. (2021):** *"Data on a blockchain may simply be immutable garbage."* Pair with
  **Probst et al. (2024, Nature Communications)**: fewer than **16%** of issued carbon credits
  represent real reductions.
- **The consortium graveyard:** TradeLens (closed 2022-11-29, *"the need for full global industry
  collaboration has not been achieved"*), we.trade, B3i, Marco Polo, Contour, Everledger
  (administration 2023, ~$51.7 M raised).
- **Evidence of absence:** `blockchain` appears **zero times** across ESRS (131,722 words), EUDR
  (26,583), ISSA 5000 (95,719) and ESMA's greenwashing report (38,098). The bodies that define
  credible ESG data locate credibility in governance and corroboration, never in storage
  architecture.
- **The parable to remember:** Chainlink's Proof-of-Reserve on BCT **worked exactly as designed**,
  faithfully attesting that ~20 M real Verra credits backed the tokens. The credits were junk. The
  oracle was honest; the underlying was worthless.

**The fair concession.** A public chain does buy three things a signed database cannot:
non-equivocation against a colluding operator without recruiting a witness network, censorship
resistance, and survival beyond our organisation. **All three concern custody of the record. None
touches whether the measurement was true** — which is where ESG fraud actually lives.

---

## 4. Review of the architecture the client sent

The client supplied a four-step design: GitHub Actions computes a SHA-256 → DirectAdmin serves the
raw JSON → a smart contract on **Polygon or Arbitrum** stores the hash, signed with a **private
wallet key** → the browser recomputes the hash with **ethers.js**, reads the contract, and shows an
**"On-Chain Verified Untampered"** badge.

**The core is right and we should say so.** Data off-chain, hash on-chain, verification in the
user's own browser, and a badge that can fail — that is the correct shape.

### Where we agree

| | |
|---|---|
| Only the hash goes on chain; data stays on our server | ✅ |
| SHA-256 of the published file | ✅ already built (`emit_manifest.py`) |
| Anchored inside the existing daily automation | ✅ `refresh-data.yml` is the hook |
| Browser recomputes and compares | ✅ this is what makes it "don't trust us" |
| The badge goes red on mismatch | ✅ **the single best thing in the proposal** |
| Cost is a fraction of a cent per day | ✅ measured: Arbitrum $0.000889/anchor ≈ **$0.33/yr** |

### Three real deviations

**① Which chain — and the private key it drags in.** The proposal requires a funded hot wallet
whose key lives in GitHub Secrets. That introduces the one attack surface this feature otherwise
does not have: **if the key leaks, an attacker can write false hashes — making tampered data show
as verified.** It also has to be topped up forever, and someone must own it after the team
graduates. OpenTimestamps and Sigstore have **no key, no funds, no successor problem**, and Bitcoin
is the more secure chain. See §5.

**② What gets anchored.** The proposal anchors `indicators.json`. We publish three data files.
**Anchor `manifest.json` instead** — it already contains all three hashes, so **one anchor covers
everything transitively**. Also: anchor **only when the data actually changed** (which
`refresh-data.yml` already gates on), otherwise the ledger fills with 365 identical hashes a year.
Do not store our own timestamp on chain — the block carries one, and it is more trustworthy than
one we supply.

**③ Where verification appears.** The proposal has every visitor's browser verify on every page.
The spec only puts a panel on `/data-sources`. **Do both, and prioritise the automatic badge** — it
is what the client asked for, it is cheap (one component in the existing chip vocabulary), and it
is continuous evidence rather than a static explainer page.

### Two wording corrections that apply to both documents

- **"Untampered" / "tamper-proof" → "tamper-evident."** Per NISTIR 8202. Our own
  `BLOCKCHAIN_ANCHORING_SPEC.md` §5 says "tamper-proof" too; both need fixing.
- **Testnet is not an option.** The spec §3 lists "L2 / testnet". Testnet data can be wiped and
  carries no economic guarantee — a testnet anchor is a mock. Free-but-real (OTS) or mainnet.
  Nothing in between.

### Implementation traps the proposal does not mention

1. **The browser must hash the raw bytes.** `await res.arrayBuffer()` → `crypto.subtle.digest`.
   `JSON.parse` → `JSON.stringify` will not reproduce the same bytes (key order, whitespace, number
   formatting, trailing newline) and the badge will never match. Anything that rewrites bytes in
   transit — CDN JSON minification, line-ending conversion, a BOM — breaks it too. Commit `3978363`
   pinned `manifest.json` to LF for exactly this class of problem; test it before shipping.
2. **`ethers.js` is unnecessary.** Hashing is built into the browser (`crypto.subtle`); an RPC read
   is a plain `fetch` JSON-RPC call, or `viem` if a library is wanted. Our bundle is already ~1.7 MB
   with no route-level splitting.
3. **RPC availability.** A public RPC rate-limits and goes down. If it is unreachable the badge must
   show *cannot verify*, never *verified* and never nothing. Querying more than one independent
   endpoint is the honest mitigation, since trusting a single RPC provider reintroduces a trusted
   third party.

---

## 5. Free vs paid — and why free is the stronger engineering choice here

Costs measured live (ETH/USD $1,881.43; `eth_gasPrice` via RPC; L1 fee via the OP-stack
`GasPriceOracle`):

| Option | Per anchor | Daily for a year | Key? | Funds? |
|---|---|---|---|---|
| **OpenTimestamps (Bitcoin)** | **$0** | **$0** | none | none |
| **Sigstore / GitHub `actions/attest`** | **$0** | **$0** | none (OIDC) | none |
| Optimism | $0.000046 | $0.017 | yes | yes |
| Hedera HCS | $0.00017–0.00042 | $0.062 | yes | yes |
| Base | $0.000268 | $0.098 | yes | yes |
| Arbitrum | $0.000889 | $0.325 | yes | yes |

**Gas is a rounding error. The real costs are key custody, an ops runbook, and the credibility risk
of doing it badly.** Three arguments for the free path that are about engineering, not budget:

1. **Higher security.** Bitcoin is the more secure chain, and there is no key to leak. A leaked
   Polygon key would let an attacker make tampered data verify — the badge becomes an accomplice.
2. **No silent death.** A wallet that runs dry stops anchoring quietly. Nothing to fund means
   nothing to forget. This matters for a project that will be handed over when the team graduates.
3. **It matches the author's own framing.** A verification system that only works while *we* hold a
   key and keep paying **is** a centralized gatekeeper. OpenTimestamps requires no one's permission
   and belongs to no one.

Note the distinction from the project's other free tiers: **OpenTimestamps and Sigstore are not
vendor promotions.** OTS rides on Bitcoin with no company operating it; Sigstore's public-good
instance is Linux Foundation infrastructure that npm, PyPI and GitHub depend on
(**2,269,541,266 log entries** at the time of writing). Neither can send a "your free plan is
ending" email. Our own `vite` dependency already ships Sigstore provenance.

**Recommendation: ship OTS + Sigstore now; keep Polygon as an additive third witness.** Because all
three anchor the *same* `manifest.json` hash, adding Polygon later is a new witness, not a rebuild.

**Two known OTS operational facts** (observed, not read):
- A fresh `.ots` is a `PendingAttestation` — **still pending after 24 minutes** in testing; the docs
  say "a few hours". **You cannot stamp and verify in the same CI run.** A second, delayed job must
  run `ots upgrade`. This is why the UI needs an amber "Timestamping…" state.
- The JavaScript verifier (`javascript-opentimestamps` 0.4.5) was **last published in 2019** and
  depends on `request` and `web3` v1; it will not bundle cleanly into Vite. Full trustless
  verification in a page would need ~**76.8 MB** of Bitcoin headers. So *in-browser* OTS
  verification is over-promising: link to `opentimestamps.org`'s verifier, or verify against
  several independent block explorers and say which.

---

## 6. The design

### Three layers — witnesses are pluggable, the ledger is not

```
Layer 3  Surfaces      IntegrityChip · /data-sources verify page · copy-paste commands
                       (will change, may be rebuilt)
Layer 2  Witnesses     Sigstore · Bitcoin (OTS) · [Polygon, later]
                       (additive; any one may be unreachable without breaking the others)
Layer 1  The ledger    provenance.jsonl (append-only) · manifest.json
                       (one ledger, never rewritten — this is the thing of value)
```

Everything in Layer 2 attests to Layer 1. That is what makes adding a chain later cost nothing, and
what keeps the system alive if a given witness disappears.

### Workflow

```
① run_pipeline.py       fetch + build the datasets                    ✅ exists
② emit_manifest.py      SHA-256 per file                              ✅ exists
③                       append provenance.jsonl                       ✅ exists
④                       write manifest.json                           ✅ exists
⑤ refresh-data.yml      commit ONLY if the data changed               ✅ exists
⑥ anchor_provenance.py  Manifest-v2 provenance commitment + proof pair ✅ local code; not run connected
⑦                       Sigstore attest + OTS stamp manifest.json      ✅ local workflow; not run connected
⑧                       append anchors.jsonl                           ✅ local code; current v2 has no event
⑨ deploy.yml            publish + assert live bytes == built bytes     ✅ local workflow; never run in production
⑩ anchor-upgrade job    hours later: OTS upgrade                         ✅ local workflow; no live proof to upgrade
```

Browser, on page load: download the JSON it needs anyway → hash the raw bytes → read the anchor
record → compare → render one of four states.

### Four chip states — grey is mandatory

| State | Label | When |
|---|---|---|
| 🟢 | `Published record match` | recomputed file hash matches the downloaded Manifest and record |
| 🟡 | `Timestamping…` | Sigstore signed; Bitcoin proof still pending (normal, not an error) |
| 🔴 | `Integrity mismatch` | live bytes ≠ anchored hash — stale deploy, cache, or tampering |
| ⚪ | `Not verified` | anchor record unreachable (offline / local dev) |

**A badge that can only be green is decoration.** Grey exists so that absence of proof is never
rendered as proof — the specific failure visible on the ODSF site. Colour is reinforcement only;
each state also spells itself out in words, following the rule already set in `DataFreshness.jsx`.

Mockup: [`docs/design/blockchain-verify-mockup.html`](./design/blockchain-verify-mockup.html)
(standalone, opens by double-click).

### The copy that matters most

The verify page must give equal weight to what this does **not** prove:

> **Proves:** these files have not changed since `<date>` — including by us. You do not have to
> take our word for it; recompute the hash yourself.
>
> **Does not prove:** that the data is correct. If a source was wrong, we have preserved the error
> faithfully. Data quality is carried by the `confidence` and `source` fields, not by this page.

Stating the limitation plainly is the most persuasive thing on the page, not a disclaimer bolted on.

---

## 7. Release prerequisites — proof and deployment are separate gates

| # | Prerequisite | Status (2026-08-09) |
|---|---|---|
| 1 | TLS certificate covering the subdomain | ✅ **Done.** Let's Encrypt **wildcard** `*.rentsmartprop.com.my`, issued 2026-07-31, **expires 2026-10-29**. Strict validation passes. |
| 2 | Phase 0 merged so the manifest exists on `master` | ✅ **Done** (`80128f7`). `emit_manifest.py`, `validate_data.py`, `deploy.yml` are all on `master`. |
| 3 | GitHub connected proof gate | ❌ **Not yet run.** The exact final `master` commit still needs the OTS calendar stamp and identity-constrained Sigstore verification. This is Gate B and can run before production deployment. |
| 4 | SFTP/FTPS secrets and verified production target | ❌ **Blocking Gate C only.** Production currently serves a legacy v1 `manifest.json` and `provenance.jsonl`, while `anchors.jsonl`, `manifest.json.ots`, and the current version pair return SPA HTML. No public proof surface exists yet. |
| 5 | `master` governance | ❌ **Not evidenced.** Require no force-push/deletion, review and required release checks, plus restricted workflow/integrity-code changes before production. Signed commits remain optional until bot-compatible automation is decided. |

**Do not deploy before #4 and #5.** Proof generation is deliberately an earlier connected gate;
neither a proof nor branch protection makes the source statistics inherently true.

Once the deploy runs, flip `SMOKE_ALLOW_INSECURE_TLS` to `false` — the smoke test then catches a
certificate regression automatically, which is the durable fix for the October expiry.

### Honest threat model

| | |
|---|---|
| **Caught** | server compromise, CDN poisoning, half-completed deploy, stale cache, bytes altered in transit, quiet after-the-fact edits to published history |
| **Not caught** | a bug in the pipeline; an insider with CI access changing the data *and* the anchor together — the same workflow does both |

This is not a flaw unique to us; it is Wüst & Gervais's point. The mitigation is branch protection
and signed commits, not more blockchain.

---

## 8. Gaps in `BLOCKCHAIN_ANCHORING_SPEC.md`

The spec is sound and this document does not replace it. Five things to add:

1. **OTS proofs are pending for hours** → a second delayed CI job must run `ots upgrade`; the UI
   needs the amber state. (§5)
2. **Browser must hash raw bytes**, never `JSON.parse` → `stringify`. (§4)
3. **Anchor only when the data changed**, matching `refresh-data.yml`. The spec's "Daily or weekly"
   would produce identical hashes indefinitely. (§4)
4. **§5 says "tamper-proof"** → change to "tamper-evident" (NISTIR 8202). **§3 lists "testnet"** →
   remove it.
5. **Require the "what this does not prove" copy.** The spec draws a good line against faking
   tokenisation but does not require the UI to state the oracle-problem limitation, which is the
   single most important sentence on the page.

Also worth adding: **GitHub `actions/attest`** as a free, ~1-hour complement to OTS. Our repo is
public, so the Sigstore public-good instance is free, and verification is one command:
`gh attestation verify manifest.json --repo angelyong/Borneo_Tracker`.

---

## 9. Corrections this investigation turned up in other docs

**`docs/BUSINESS_CASE_ABCDE.md` — "B (on-chain DDS)" as the EUDR play is wrong.** The regulator's
texts mention blockchain zero times across five documents, immutability is actively harmful where
polygons get corrected, and vendors are removing chains from their products (§3.3). **The real EUDR
wedge is `D`+`E`**: Copernicus-grade geospatial evidence against Art. 9(1)(d) polygons, plus
smallholder aggregation at the dealer/ramp break-point — the gap nobody has filled in Sabah,
Sarawak or Kalimantan.

**`.claude/skills/borneo-abcde-framework/SKILL.md` — `B` row misfiles "self-sovereign data".** Per
the author's own split it belongs under `D` (§2). This matters for sequencing: community data
ownership and yield is a `D` deliverable, and `D` is already ~75%, so that story is much nearer than
the 0%-`B` scorecard implies.

**A Borneo-specific finding worth more than the blockchain question.** Under IR (EU) 2025/1093,
**Brunei is LOW risk while Malaysia and Indonesia are STANDARD risk** — so Bruneian micro/small
primary operators may use simplified due diligence and can substitute a postal address or cadastral
reference for geolocation, while Sabah, Sarawak and Kalimantan face full polygon geolocation and a
3% check rate. *On one island.* Only a unified Borneo layer can see that asymmetry. **⚠️ Unverified
directly — EUR-Lex blocks automated fetching; confirm the risk annex manually before building a
pitch on it.**

---

## 10. Honest expectations

**Expected to work after connected gates:**
- A supervisor recomputing the hash on his own machine is more persuasive than any slide.
- It will catch at least one real deployment problem. There is one right now: production data has
  been frozen at 2026-07-23 for ten days and nothing reported it.
- The trust/attestation sub-capability can be described as locally implemented, but the ABCDE
  score remains **B = 0%** until Gate B has live OTS/Sigstore evidence and Gate C has deployed
  proof assets. Tokenisation, self-sovereign data and row-level attestation remain unbuilt.

**Expected friction:**
- ~99% of visitors will never click the badge. That is fine: its value is that it *can* go red, and
  that a reviewer *can* check it.
- The first deployment will probably show a red badge because of byte-level changes in transit.
  Test this before shipping, not after.
- The client's first reaction may be "this is not the tokenisation I described." Prepare the
  argument in advance: *we are not building the token, we are building the attestation a token
  would need* — which is the bottleneck the whole market is stuck on, and it has a production
  precedent in CAD Trust.

**Not expected:** user growth, revenue, or any improvement in data accuracy. This feature does not
make a single number more correct.

**Why do it at all, stated plainly.** Our data does not technically *need* a blockchain. We are
doing this because (a) `B` is a required letter in the client's own framework, and this is the only
version of it that is real, free and defensible; and (b) about 80% of the work — hashing,
publication records, deploy verification, an honest freshness/integrity surface — is engineering we
should do regardless, and most of it is already built. **The chain is the last 20%, and it is the
cheapest 20%.**

---

## Sources

**Primary, quoted verbatim above:** Amazon `B0H4M9QCGB` (book description); bsyssolution.com
("The Borneo Thesis", "Engineering Resilient Civilizations", the automotive ABCDE article);
odsf.edisontkp.com (`/`, `/api/metrics`, `/api/health`); edisontkp.com (`/`, `/api/projects`) and
GitHub `edisontkpcom`; ICAO CCR FAQ + User Manual 4th ed.; UNFCCC A6.4-PROC-REGS-001 v02.0 and
A6.2-PROC-REGS-001 v01.0; EU Reg 2023/1115, 2024/3012, IR 2026/1565, COM(2026) 191;
climate.ec.europa.eu (Union Registry); climateactiondata.org; verra.org; blog.toucan.earth;
chain.link (sitemap + 404s); NIST NISTIR 8202.

**Academic:** Wüst & Gervais (2018) "Do you need a blockchain?"; Halaburda (CACM 2018); Powell et
al. (2021); Probst et al. (2024, Nature Communications); Caldarelli (2020, *Information* 11(11):509)
on the oracle problem; Ballesteros-Rodríguez et al. (2024, *Frontiers in Blockchain*) on KlimaDAO.

**Measured live (2026-07/08):** chain gas prices via RPC; token prices and volumes; Rekor log size;
an actual OpenTimestamps proof generated against our own `manifest.json`; our production TLS
certificate and served data files.

**Do not repeat these two claims** — both circulate publicly and both are wrong: "on-chain
retirements surpassed 45 Mt in 2025" (off by 200–1,000×), and the arXiv paper *"Immutability Does
Not Guarantee Trust"* (authored by Craig Wright; cite Powell et al. instead).

---

**Related:** [`BLOCKCHAIN_ANCHORING_SPEC.md`](./BLOCKCHAIN_ANCHORING_SPEC.md) (the build handoff) ·
[`LOOP_ENGINEERING_PLAN.md`](./LOOP_ENGINEERING_PLAN.md) (item D13, which created the seam) ·
[`ABCDE_HEXAGON_REFRAME_PLAN.md`](./ABCDE_HEXAGON_REFRAME_PLAN.md) ·
[`BUSINESS_CASE_ABCDE.md`](./BUSINESS_CASE_ABCDE.md) (see §9) ·
[`DEPLOYMENT_SETUP.md`](./DEPLOYMENT_SETUP.md) (prerequisite #3)

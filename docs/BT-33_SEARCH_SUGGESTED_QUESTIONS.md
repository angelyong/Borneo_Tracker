# BT-33 · BorneoBot seeds two of the client's three §3.2 examples

> **Historical baseline (2026-08-26).** This audit records the state found before the BT-33 contract repair. The current resolved contract and its remaining D2/D3/D4/D5 boundaries are in [BT-33 AI Chat end-to-end fixing plan](BT-33_AI_CHAT_END_TO_END_FIXING_PLAN.md) and [the client response](CLIENT_FEEDBACK_RESPONSE_2026-08-24.md).

**Raised:** 2026-08-26 · **Found during:** line-by-line re-audit of the 2026-08-15 client review against the then-shipped product
**Owner:** whoever implemented BT-14 · **Related:** BT-14 (repository implementation complete; production verification open), KIV-01 (parked, already discussed with the client)
**Role:** FE + CONTENT · **Effort:** XS · **Priority:** P2

---

## Client ask (§3.2, verbatim)

> **3.2**
> Make the search more powerful by supporting natural queries such as:
> **"Compare Sabah and Sarawak"**
> **"Show districts with low food resilience"**
> **"Find highest-risk regions"**
> This could eventually become one of the platform's strongest AI-enabled features.

BT-14's own card instructs: *"Seed `SuggestedQuestions` with the client's **three** examples."*

## What actually shipped

`src/shared/aiChatContracts.js:12-16`

```js
export const SUGGESTED_QUESTIONS = [
  'Compare Sabah and Sarawak',                    // client example 1  ✅
  'Show districts with low food resilience',      // client example 2  ✅
  'Explain the Forest Cover indicator.',          // NOT a client example
];
```

| Client example | In the product |
|---|---|
| "Compare Sabah and Sarawak" | yes, verbatim |
| "Show districts with low food resilience" | yes, verbatim |
| **"Find highest-risk regions"** | **no — replaced** |

**Historical finding:** `"Find highest-risk regions"` appeared **nowhere** in `src/`, `supabase/` or `scripts/` at audit time. The current contract now records the exact phrase as disabled, rather than substituting or silently omitting it, until D3 approves a risk methodology. See [the current fixing plan](BT-33_AI_CHAT_END_TO_END_FIXING_PLAN.md).

## Why this needs a decision rather than a quick fix

**A passing test currently asserts that this set *is* the client's three examples.**

`src/shared/aiChatContracts.test.js:4-11`

```js
describe('BorneoBot suggested questions', () => {
  it('seeds the three client decision and drill-down examples', () => {
    expect(SUGGESTED_QUESTIONS).toEqual([
      'Compare Sabah and Sarawak',
      'Show districts with low food resilience',
      'Explain the Forest Cover indicator.',
    ]);
  });
});
```

The test name claims client provenance for a string the client never wrote. So the gap is not merely unshipped — it is pinned in place and labelled as compliant. Anyone auditing by running the suite would conclude §3.2 was fully delivered.

## Open question for the BT-14 owner

**Was the substitution deliberate?** There is a plausible good reason and it is not recorded anywhere:

"Find highest-risk regions" requires ranking territories against each other — cross-territory comparison driven by the query itself. That is precisely what **KIV-01** (full natural-language query engine, per-query LLM intent routing) was parked for. Seeding a question the assistant cannot answer well would show the client a failure on his own example.

If that was the reasoning, it is sound. It simply never got written down, so from the outside it is indistinguishable from an oversight. **The owner should confirm or correct this before anything is changed.**

## Options

**(a) Record the reasoning, keep the current set.** Add a comment at `aiChatContracts.js:12` explaining why the third example is not seeded, and fix the test name so it no longer claims three client examples. Tell the client plainly in the delivery note: two of his three examples are live; the third needs cross-territory ranking, which is KIV-01's scope, already agreed as parked.

**(b) Seed the client's third example anyway.** Restore `"Find highest-risk regions"` — either as a fourth entry or replacing the Forest Cover one. Only do this after checking what BorneoBot actually answers today. If the answer is weak, this shows the client a poor result on a sentence he wrote himself, which is worse than an honest explanation.

**(c) Seed a scoped version of his intent.** Something the assistant *can* answer from committed data, e.g. a question about the weakest scored pillar in a named territory. Honest, useful, and closer to his intent than the Forest Cover string — but it is our wording, not his, so the note to the client must say so.

Recommendation: **(a)**, unless testing shows BorneoBot handles the ranking question acceptably, in which case (b).

## Done when

- The reason the third client example is or is not seeded exists in the code, not only in someone's memory.
- `aiChatContracts.test.js`'s test name matches what the array actually contains.
- The client-facing note states, for §3.2, exactly which of his three examples are live and why any are not.

## Files

- `src/shared/aiChatContracts.js` (the array)
- `src/shared/aiChatContracts.test.js` (the test name and assertion)
- `src/components/ai-chat/SuggestedQuestions.jsx` (renders the array; no change expected)
- `docs/CLIENT_FEEDBACK_RESPONSE_2026-08-24.md` (§3.2 section)

---

## Adjacent check for the same owner — not part of this ticket

Two things surfaced beside this one. They are recorded here only because the BT-14 owner is the right person to answer them; neither is BT-33's scope.

**1. Is the `ai-chat` Edge Function actually deployed?**
`docs/ai-chat-production-deployment.md` opens with *"Commands in this document are **NOT YET EXECUTED**."* If that is still current, BT-14's handoff button opens a panel that cannot answer, and §3.2's delivery status needs restating to the client. If the doc is simply stale, no action — but nobody has confirmed either way. The frontend resolves its endpoint from `VITE_AI_CHAT_ENDPOINT` (`src/services/AIChatService.js:45-47`), so this is a deployment fact, not a repo fact.

**2. BorneoBot keeps its own hand-copied mirror of the scoring bounds.**
**Historical finding:** `supabase/functions/ai-chat/factCalculations.ts` previously contained a hand-copied `TARGET_BOUNDS` mirror of `compute_resilience.BOUNDS`. This is resolved: runtime target bounds now come from `public/data/resilience_model.json`, with anti-drift coverage. The four model bounds not mapped to `indicatorToPillar` remain a D4 data-methodology decision; until approved, runtime target-gap responses label them unavailable and do not present them as active Resilience Index targets. See [the current fixing plan](BT-33_AI_CHAT_END_TO_END_FIXING_PLAN.md) and [open issue D4](OPEN_ISSUES_2026-08-25.md).
